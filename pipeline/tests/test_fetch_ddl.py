"""The DDL fetcher parses a streamed zip with data descriptors. Python's zipfile writes exactly
that format when the output can't seek, so we can build a faithful test archive in memory."""

import importlib.util
import io
import zipfile
from pathlib import Path

import pytest

spec = importlib.util.spec_from_file_location(
    "fetch_ddl", Path(__file__).resolve().parents[1] / "scripts" / "fetch_ddl.py")
fetch_ddl = importlib.util.module_from_spec(spec)
spec.loader.exec_module(fetch_ddl)


class Unseekable(io.RawIOBase):
    def __init__(self):
        self.data = bytearray()

    def writable(self):
        return True

    def write(self, b):
        self.data += b
        return len(b)


class Reader:
    """Hands bytes out in awkward small pieces, like a slow network."""

    def __init__(self, data: bytes, piece: int = 7):
        self.data, self.pos, self.piece = data, 0, piece

    def read(self, _n):
        out = self.data[self.pos:self.pos + self.piece]
        self.pos += len(out)
        return out


def streamed_zip(entries: dict[str, bytes], zip64: bool = False) -> bytes:
    sink = Unseekable()
    with zipfile.ZipFile(sink, "w", compression=zipfile.ZIP_STORED) as zf:
        zf.writestr("csv/", b"")
        for name, data in entries.items():
            with zf.open(name, "w", force_zip64=zip64) as f:
                f.write(data)
    return bytes(sink.data)


def read_all(archive: bytes, piece: int = 7) -> dict[str, bytes]:
    stream = fetch_ddl.Stream(Reader(archive, piece))
    out = {}
    while True:
        sig = stream.take(4)
        if sig == fetch_ddl.CENTRAL:
            return out
        assert sig == fetch_ddl.LOCAL
        fields = stream.take(26)
        flag = int.from_bytes(fields[2:4], "little")
        name_len = int.from_bytes(fields[22:24], "little")
        extra_len = int.from_bytes(fields[24:26], "little")
        name = stream.take(name_len).decode()
        extra = stream.take(extra_len)
        assert flag & 8, "the test archive should use data descriptors, like Dropbox"
        sink = io.BytesIO()
        size = fetch_ddl.read_entry_data(stream, sink, fetch_ddl.has_zip64(extra))
        assert size == len(sink.getvalue())
        if not name.endswith("/"):
            out[name] = sink.getvalue()


@pytest.mark.parametrize("zip64", [False, True])
@pytest.mark.parametrize("piece", [1, 7, 4096])
def test_entries_come_back_byte_for_byte(zip64, piece):
    entries = {
        "license.txt": b"ODbL v1.0\n" * 50,
        # a fake descriptor signature inside the data must not end the entry early
        "csv/keys/keys.tar.gz": b"\x1f\x8b" + b"PK\x07\x08" + bytes(range(256)) * 40,
        "csv/cases/cases_2010.csv": b"ddl_case_id,year\n" + b"01-01-01,2010\n" * 3000,
        "empty.txt": b"",
    }
    assert read_all(streamed_zip(entries, zip64), piece) == entries


def test_a_truncated_stream_is_an_error_not_a_short_file():
    archive = streamed_zip({"a.csv": b"x" * 5000})
    with pytest.raises(EOFError):
        read_all(archive[:3000])
