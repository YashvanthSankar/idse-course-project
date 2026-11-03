"""Download selected files from Development Data Lab's judicial-data Dropbox folder.

Dropbox does not allow single-file links into this shared folder: the only way in is
"download folder", which streams the whole folder (tens of GB) as one zip. This script reads
that stream, writes only the entries matching --want, checks each one against its CRC-32,
and stops as soon as it has everything it was asked for, so we never download the full dump.

The stream is a "store" zip (no compression) whose entries have data descriptors (sizes come
*after* the data), so an entry ends where a descriptor whose size and CRC match the bytes read
so far appears.

    uv run python scripts/fetch_ddl.py --list                    # print entry names as they pass
    uv run python scripts/fetch_ddl.py --want 'csv/cases/*2010*' --max-saves 1
"""

import argparse
import fnmatch
import struct
import sys
import time
import urllib.request
import zlib
from pathlib import Path

FOLDER = "https://www.dropbox.com/sh/hkcde3z2l1h9mq1/AADRe-BuBQ92ozAJiG7YERdCa?dl=1"
LOCAL = b"PK\x03\x04"
CENTRAL = b"PK\x01\x02"
DESCRIPTOR = b"PK\x07\x08"
CHUNK = 1 << 20
OUT = Path(__file__).resolve().parents[1] / "data" / "raw" / "ddl"


class Stream:
    """A byte stream with a small look-ahead buffer."""

    def __init__(self, response):
        self.response = response
        self.buf = bytearray()
        self.total = 0
        self.started = time.monotonic()

    def fill(self, n: int) -> bool:
        while len(self.buf) < n:
            chunk = self.response.read(CHUNK)
            if not chunk:
                return False
            self.total += len(chunk)
            self.buf += chunk
        return True

    def take(self, n: int) -> bytes:
        if not self.fill(n):
            raise EOFError("stream ended mid-record")
        out = bytes(self.buf[:n])
        del self.buf[:n]
        return out

    def rate(self) -> str:
        secs = max(time.monotonic() - self.started, 1e-6)
        return f"{self.total / 1e6:,.0f} MB read, {self.total / 1e6 / secs:.1f} MB/s"


def read_entry_data(stream: Stream, sink, zip64: bool) -> int:
    """Copy one entry's data to `sink` (or discard it when sink is None), up to and including
    its data descriptor. Returns the entry's size. A descriptor signature can also occur by
    chance inside the data, so a candidate only counts when both its size and its CRC-32
    match what was read."""
    dlen = 24 if zip64 else 16  # signature + crc + two sizes (8 bytes each in zip64)
    size_fmt = "<Q" if zip64 else "<I"
    size = crc = 0
    while True:
        ended = not stream.fill(len(stream.buf) + CHUNK)
        buf = stream.buf
        start = 0
        while (pos := buf.find(DESCRIPTOR, start)) >= 0 and pos + dlen <= len(buf):
            if struct.unpack_from(size_fmt, buf, pos + 8)[0] == size + pos:
                body = bytes(buf[:pos])
                if zlib.crc32(body, crc) == struct.unpack_from("<I", buf, pos + 4)[0]:
                    if sink:
                        sink.write(body)
                    del buf[:pos + dlen]
                    return size + pos
            start = pos + 1
        if ended:
            raise EOFError("stream ended inside an entry")
        flush = len(buf) - (dlen - 1)  # the last bytes might be the start of a descriptor
        body = bytes(buf[:flush])
        crc = zlib.crc32(body, crc)
        size += flush
        if sink:
            sink.write(body)
        del buf[:flush]


def has_zip64(extra: bytes) -> bool:
    i = 0
    while i + 4 <= len(extra):
        header, length = struct.unpack_from("<HH", extra, i)
        if header == 0x0001:
            return True
        i += 4 + length
    return False


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--want", action="append", default=[],
                        help="glob of entry paths to save (repeatable)")
    parser.add_argument("--list", action="store_true", help="only print entry names")
    parser.add_argument("--max-saves", type=int, default=0,
                        help="stop after saving this many entries (0 = read to the end)")
    parser.add_argument("--out", type=Path, default=OUT)
    args = parser.parse_args()
    if not args.want and not args.list:
        parser.error("give --want patterns or --list")

    saved = 0
    args.out.mkdir(parents=True, exist_ok=True)
    request = urllib.request.Request(FOLDER)
    with urllib.request.urlopen(request, timeout=120) as response:
        stream = Stream(response)
        while True:
            sig = stream.take(4)
            if sig == CENTRAL:
                print("reached the end of the archive")
                break
            if sig != LOCAL:
                raise ValueError(f"unexpected record {sig!r} after {stream.rate()}")
            (_ver, flag, method, _t, _d, _crc, csize, _usize, name_len,
             extra_len) = struct.unpack("<HHHHHIIIHH", stream.take(26))
            name = stream.take(name_len).decode("utf-8")
            extra = stream.take(extra_len)
            zip64 = has_zip64(extra)
            if method != 0:
                raise ValueError(f"{name}: compressed entries are not supported")
            if name.endswith("/"):  # a folder: no data, but it may still carry a descriptor
                if flag & 8:
                    read_entry_data(stream, None, zip64)
                continue
            wanted = any(fnmatch.fnmatch(name, pat) for pat in args.want)
            print(f"{'SAVE' if wanted else 'skip'} {name}  ({stream.rate()})", flush=True)
            target = args.out / name
            if wanted:
                target.parent.mkdir(parents=True, exist_ok=True)
                part = target.with_suffix(target.suffix + ".part")
                with part.open("wb") as sink:
                    if flag & 8:
                        size = read_entry_data(stream, sink, zip64)
                    else:
                        size = csize
                        sink.write(stream.take(csize))
                part.rename(target)
                saved += 1
                print(f"     saved {target.relative_to(args.out)}: {size / 1e6:,.1f} MB, CRC ok",
                      flush=True)
            elif flag & 8:
                size = read_entry_data(stream, None, zip64)
                print(f"     ({size / 1e6:,.1f} MB)", flush=True)
            else:
                stream.take(csize)
            if args.max_saves and saved >= args.max_saves:
                print(f"saved {saved} entries; stopping")
                break
    return 0


if __name__ == "__main__":
    sys.exit(main())
