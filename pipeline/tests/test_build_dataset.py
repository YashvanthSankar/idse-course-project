import importlib.util
import io
import tarfile
from pathlib import Path

import pyarrow.parquet as pq

spec = importlib.util.spec_from_file_location(
    "build_dataset", Path(__file__).resolve().parents[1] / "scripts" / "build_dataset.py")
build = importlib.util.module_from_spec(spec)
spec.loader.exec_module(build)

CASES = (
    "ddl_case_id,year,state_code,dist_code,court_no,disp_name,date_of_filing,date_of_decision\n"
    '"10-01-01-1",2010,"10","01","01",42,"2010-01-05",""\n'
    '"01-02-03-2",2010,"01","02","03",7,"2010-02-01","2011-03-01"\n'
    '"10-09-02-3",2010,"10","09","02",,"2010-03-09","7201-10-15"\n'
)
ACTS = 'ddl_case_id,act,section\n"10-01-01-1",17353,"138"\n"01-02-03-2",11007,"302"\n'


def archive(tmp_path) -> Path:
    path = tmp_path / "cases.tar.gz"
    with tarfile.open(path, "w:gz") as tar:
        for name, text in [("./cases_2010.csv", CASES), ("./acts_sections.csv", ACTS)]:
            data = text.encode()
            info = tarfile.TarInfo(name)
            info.size = len(data)
            tar.addfile(info, io.BytesIO(data))
    return path


def test_build_keeps_codes_as_text_and_types_the_national_dates(tmp_path):
    out = tmp_path / "clean"
    assert build.main(["--archive", str(archive(tmp_path)), "--state", "10",
                       "--out", str(out)]) == 0
    tn = pq.read_table(out / "10" / "cases_2010.parquet").to_pandas()
    assert tn["ddl_case_id"].tolist() == ["10-01-01-1", "10-09-02-3"]
    assert tn["state_code"].tolist() == ["10", "10"]  # zero-padding kept
    assert tn["dist_code"].tolist() == ["01", "09"]
    nat = pq.read_table(out / "national" / "cases_2010.parquet").to_pandas()
    assert len(nat) == 3
    assert str(nat["date_of_filing"].iloc[0]) == "2010-01-05"
    assert nat["date_of_decision"].isna().tolist() == [True, False, True]  # blank and year 7201
    assert nat["disp_name"].isna().tolist() == [False, False, True]
    acts = pq.read_table(out / "10" / "acts_sections.parquet").to_pandas()
    assert acts["ddl_case_id"].tolist() == ["10-01-01-1"]


def test_a_second_run_skips_finished_years(tmp_path, capsys):
    out = tmp_path / "clean"
    args = ["--archive", str(archive(tmp_path)), "--out", str(out)]
    build.main(args)
    build.main(args)
    assert "already built" in capsys.readouterr().out
