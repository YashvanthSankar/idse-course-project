"""Turn DDL's case archive into the parquet files the notebooks and models use, in one pass.

cases.tar.gz holds one CSV per filing year (cases_2010.csv … cases_2018.csv, 857 MB to
2.7 GB each). Unpacking it would need ~20 GB of disk, so this script streams each CSV out of
the archive in batches and writes:

- data/clean/national/cases_<year>.parquet : every case in India, only the columns needed for
  scrape cutoffs and national charts (state, district, filing and decision dates, disposition
  code), with dates typed and codes dictionary-encoded so all years fit in memory together;
- data/clean/<state>/cases_<year>.parquet  : every column, as stored, for the chosen state;
- data/clean/<state>/<other>.parquet       : any other CSV in the archive (e.g. acts and
  sections), filtered to the state by the case id prefix ("10-…" is Tamil Nadu).

    uv run python scripts/build_dataset.py                 # Tamil Nadu (state code 10)
    uv run python scripts/build_dataset.py --state 10 --force
"""

import argparse
import csv as csv_module
import datetime
import re
import sys
import tarfile
import time
from pathlib import Path

import pyarrow as pa
import pyarrow.compute as pc
import pyarrow.csv as pacsv
import pyarrow.parquet as pq

ROOT = Path(__file__).resolve().parents[1]
ARCHIVE = ROOT / "data" / "raw" / "ddl" / "csv" / "cases" / "cases.tar.gz"
CLEAN = ROOT / "data" / "clean"
NATIONAL_COLUMNS = ["state_code", "dist_code", "court_no", "date_of_filing",
                    "date_of_decision", "disp_name"]
BLOCK = 64 << 20  # bytes of CSV per batch
EARLIEST = pa.scalar(datetime.date(1950, 1, 1), pa.date32())  # same window as tareekh.cases
LATEST = pa.scalar(datetime.date(2022, 12, 31), pa.date32())


def as_date(column: pa.ChunkedArray | pa.Array) -> pa.Array:
    """ISO date strings to date32. Blanks, unparseable strings and dates outside the window
    `tareekh.cases` accepts (1950–2022: year 0001, 5000-01-01, 7201-…) become null, so the
    national files and the state files agree on which dates exist."""
    parsed = pc.cast(pc.strptime(column, format="%Y-%m-%d", unit="s", error_is_null=True),
                     pa.date32())
    ok = pc.and_(pc.greater_equal(parsed, EARLIEST), pc.less_equal(parsed, LATEST))
    return pc.if_else(ok, parsed, None)


def narrow(batch: pa.RecordBatch) -> pa.Table:
    table = pa.Table.from_batches([batch]).select(NATIONAL_COLUMNS)
    cols = {}
    for name in NATIONAL_COLUMNS:
        col = table[name]
        if name.startswith("date_"):
            cols[name] = as_date(col)
        elif name == "disp_name":
            cols[name] = pc.cast(pc.if_else(pc.equal(col, ""), None, col), pa.int16())
        else:
            cols[name] = pc.dictionary_encode(col)
    return pa.table(cols)


def stream_csv(member) -> tuple[pacsv.CSVStreamingReader, pa.Schema]:
    """A batch reader with every column as text. pyarrow would otherwise infer types and turn
    the zero-padded codes ("01") into integers, silently breaking every join with the keys.
    The header is read by hand so the column names are known before the reader starts."""
    header = member.readline().decode("utf-8").strip()
    names = next(csv_module.reader([header]))
    schema = pa.schema([pa.field(name, pa.string()) for name in names])
    reader = pacsv.open_csv(
        member,
        read_options=pacsv.ReadOptions(column_names=names, block_size=BLOCK),
        convert_options=pacsv.ConvertOptions(
            column_types=schema, strings_can_be_null=False, quoted_strings_can_be_null=False),
    )
    return reader, schema


def narrow_schema() -> pa.Schema:
    dictionary = pa.dictionary(pa.int32(), pa.string())
    return pa.schema([("state_code", dictionary), ("dist_code", dictionary),
                      ("court_no", dictionary), ("date_of_filing", pa.date32()),
                      ("date_of_decision", pa.date32()), ("disp_name", pa.int16())])


def process_cases(member, year: str, state: str, force: bool, clean: Path = CLEAN) -> None:
    national = clean / "national" / f"cases_{year}.parquet"
    local = clean / state / f"cases_{year}.parquet"
    if national.exists() and local.exists() and not force:
        print(f"  {year}: already built, skipping (use --force to rebuild)")
        return
    national.parent.mkdir(parents=True, exist_ok=True)
    local.parent.mkdir(parents=True, exist_ok=True)
    reader, schema = stream_csv(member)
    n_all = n_state = 0
    started = time.monotonic()
    nat_tmp, loc_tmp = national.with_suffix(".tmp"), local.with_suffix(".tmp")
    with pq.ParquetWriter(nat_tmp, narrow_schema()) as nat, \
            pq.ParquetWriter(loc_tmp, schema) as loc:
        for batch in reader:
            n_all += batch.num_rows
            nat.write_table(narrow(batch).cast(narrow_schema()))
            mine = batch.filter(pc.equal(batch["state_code"], state))
            n_state += mine.num_rows
            if mine.num_rows:
                loc.write_batch(mine)
    nat_tmp.rename(national)
    loc_tmp.rename(local)
    print(f"  {year}: {n_all:,} cases in India, {n_state:,} in state {state} "
          f"({time.monotonic() - started:.0f}s)", flush=True)


def process_other(member, name: str, state: str, force: bool, clean: Path = CLEAN) -> None:
    out = clean / state / f"{Path(name).stem}.parquet"
    if out.exists() and not force:
        print(f"  {name}: already built, skipping")
        return
    reader, schema = stream_csv(member)
    key = "ddl_case_id" if "ddl_case_id" in schema.names else None
    kept = 0
    out.parent.mkdir(parents=True, exist_ok=True)
    tmp = out.with_suffix(".tmp")
    with pq.ParquetWriter(tmp, schema) as writer:
        for batch in reader:
            if key:
                batch = batch.filter(pc.starts_with(batch[key], f"{state}-"))
            kept += batch.num_rows
            if batch.num_rows:
                writer.write_batch(batch)
    tmp.rename(out)
    print(f"  {name}: {kept:,} rows for state {state}"
          + ("" if key else " (no ddl_case_id column: kept everything)"), flush=True)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--archive", type=Path, default=ARCHIVE)
    parser.add_argument("--state", default="10", help="DDL state code (10 = Tamil Nadu)")
    parser.add_argument("--force", action="store_true")
    parser.add_argument("--out", type=Path, default=CLEAN)
    args = parser.parse_args(argv)

    with tarfile.open(args.archive, mode="r|gz") as archive:
        for info in archive:
            if not info.isfile() or not info.name.endswith(".csv"):
                continue
            member = archive.extractfile(info)
            name = Path(info.name).name
            print(f"{name} ({info.size / 1e9:.2f} GB)", flush=True)
            if m := re.fullmatch(r"cases_(\d{4})\.csv", name):
                process_cases(member, m.group(1), args.state, args.force, args.out)
            else:
                process_other(member, name, args.state, args.force, args.out)
    return 0


if __name__ == "__main__":
    sys.exit(main())
