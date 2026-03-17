#!/usr/bin/env python3
"""Generate minimal RGB PNGs (stdlib only)."""
import struct
import zlib
from pathlib import Path

BG = (30, 41, 51)  # #1e2933
FG = (148, 163, 184)  # #94a3b8 — "J" shape


def pixel_j(x: int, y: int, w: int, h: int) -> tuple[int, int, int]:
    nx, ny = x / w, y / h
    # Normalized bar + hook for letter J
    in_top_bar = 0.22 <= ny <= 0.32 and 0.28 <= nx <= 0.72
    in_stem = 0.58 <= nx <= 0.72 and 0.22 <= ny <= 0.78
    in_hook = 0.28 <= ny <= 0.78 and 0.28 <= nx <= 0.58 and ny >= 0.55
    if in_top_bar or in_stem or in_hook:
        return FG
    return BG


def write_png(path: Path, size: int) -> None:
    w = h = size
    raw = bytearray()
    for y in range(h):
        raw.append(0)  # filter type None
        for x in range(w):
            raw.extend(pixel_j(x, y, w, h))

    def chunk(tag: bytes, data: bytes) -> bytes:
        return (
            struct.pack(">I", len(data))
            + tag
            + data
            + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
        )

    ihdr = struct.pack(">IIBBBBB", w, h, 8, 2, 0, 0, 0)
    compressed = zlib.compress(bytes(raw), 9)
    png = (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", ihdr)
        + chunk(b"IDAT", compressed)
        + chunk(b"IEND", b"")
    )
    path.write_bytes(png)


def main() -> None:
    root = Path(__file__).resolve().parent
    for name, sz in (("icon16.png", 16), ("icon48.png", 48), ("icon128.png", 128)):
        write_png(root / name, sz)
        print("wrote", root / name)


if __name__ == "__main__":
    main()
