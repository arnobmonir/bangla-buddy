#!/usr/bin/env python3
"""Rebuild scripts/vocab-extra.mjs from git HEAD base + curated extras."""
from __future__ import annotations

import json
import re
import subprocess
import sys
from pathlib import Path

from curated_vocab_extras import EXTRAS, BN_OVERRIDES
from quality_overrides import QUALITY_OVERRIDES
from quality_transport_extras import TRANSPORT_EXTRAS

ALL_OVERRIDES = {**BN_OVERRIDES, **QUALITY_OVERRIDES}

ROOT = Path(__file__).resolve().parent
OUT_MJS = ROOT / "vocab-extra.mjs"
OUT_GEN = ROOT / "_gen_vocab_extra.py"
MIN_TOTAL = 1600
BN_RE = re.compile(r"[\u0980-\u09FF]")

NUMBER_WORDS = {
    "zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine",
    "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen",
    "seventeen", "eighteen", "nineteen", "twenty", "thirty", "forty", "fifty",
    "sixty", "seventy", "eighty", "ninety", "hundred", "thousand", "lakh",
    "twenty-one", "twenty-two", "twenty-three", "twenty-four", "twenty-five",
    "twenty-six", "twenty-seven", "twenty-eight", "twenty-nine", "thirty-one",
    "thirty-two", "thirty-five", "forty-five", "two hundred", "five hundred",
}

CATEGORIES = [
    "animals", "colors", "family", "food", "body", "mathematics",
    "nature", "home", "clothes", "transport", "feelings", "actions",
]

SPOT_CHECKS: dict[str, str] = {
    "flour": "আটা",
    "worm": "কেঁচো",
    "balcony": "বারান্দা",
    "air conditioner": "এসি",
    "burger": "বার্গার",
    "squid": "স্কুইড",
    "chimpanzee": "শিম্পাঞ্জি",
    "near": "কাছে",
    "confident": "আত্মবিশ্বাসী",
    "eardrum": "কানের পর্দা",
    "railway crossing": "রেলগেট",
    "comb": "আঁচা",
}


def load_head_base() -> dict[str, list[list]]:
    base: dict[str, list[list]] = {}
    for cat in CATEGORIES:
        proc = subprocess.run(
            ["git", "show", f"HEAD:src/data/categories/{cat}.json"],
            capture_output=True,
            text=True,
            check=True,
        )
        words = json.loads(proc.stdout)["words"]
        rows = [
            [w["en"], w["bn"], w.get("emoji", ""), w.get("roman", "")]
            for w in words
        ]
        if cat == "mathematics":
            rows = [r for r in rows if r[0].lower() not in NUMBER_WORDS]
        base[cat] = rows
    return base


def row_to_dict(row: list) -> dict:
    entry: dict = {"en": row[0].lower(), "bn": row[1]}
    if len(row) > 2 and row[2]:
        entry["emoji"] = row[2]
    if len(row) > 3 and row[3]:
        entry["roman"] = row[3]
    return entry


def apply_override(cat: str, row: list) -> list:
    key = f"{cat}|{row[0].lower()}"
    if key in ALL_OVERRIDES:
        row = list(row)
        row[1] = ALL_OVERRIDES[key]
    return row


def merge_vocab(base: dict[str, list[list]], extras: dict[str, list[list]]) -> dict[str, list[dict]]:
    merged: dict[str, list[dict]] = {}
    for cat in CATEGORIES:
        seen: set[str] = set()
        items: list[dict] = []
        for source in (base.get(cat, []), extras.get(cat, [])):
            for raw in source:
                row = apply_override(cat, raw)
                en = row[0].lower()
                if en in seen:
                    continue
                seen.add(en)
                items.append(row_to_dict(row))
        merged[cat] = items
    return merged


def validate_bn(data: dict[str, list[dict]]) -> int:
    bad = 0
    for cat, items in data.items():
        for entry in items:
            if not BN_RE.search(entry["bn"]):
                print(f"ERROR: {cat}/{entry['en']} lacks Bengali: {entry['bn']!r}", file=sys.stderr)
                bad += 1
    return bad


def check_spot_tests(data: dict[str, list[dict]]) -> list[str]:
    lookup: dict[str, str] = {}
    for items in data.values():
        for entry in items:
            lookup[entry["en"]] = entry["bn"]
    failures: list[str] = []
    for en, expected in SPOT_CHECKS.items():
        if en not in lookup:
            continue
        actual = lookup[en]
        if actual != expected:
            failures.append(f"{en}: expected {expected!r}, got {actual!r}")
    return failures


def fmt_entry(entry: dict, indent: str = "    ") -> str:
    parts = [f'{indent}{{ en: {json.dumps(entry["en"])}, bn: {json.dumps(entry["bn"])}']
    if "emoji" in entry:
        parts.append(f", emoji: {json.dumps(entry['emoji'])}")
    if "roman" in entry:
        parts.append(f", roman: {json.dumps(entry['roman'])}")
    parts.append(" },")
    return "".join(parts)


def write_mjs(data: dict[str, list[dict]], path: Path) -> None:
    lines = ["export default {"]
    keys = list(data.keys())
    for i, key in enumerate(keys):
        lines.append(f"  {key}: [")
        for entry in data[key]:
            lines.append(fmt_entry(entry))
        lines.append("  ]," if i < len(keys) - 1 else "  ]")
    lines.append("};")
    lines.append("")
    path.write_text("\n".join(lines), encoding="utf-8")


def rows_from_dict(data: dict[str, list[dict]]) -> dict[str, list[list]]:
    out: dict[str, list[list]] = {}
    for cat, items in data.items():
        rows: list[list] = []
        for entry in items:
            row = [entry["en"], entry["bn"], entry.get("emoji", ""), entry.get("roman", "")]
            rows.append(row)
        out[cat] = rows
    return out


def write_gen_py(data: dict[str, list[dict]], path: Path) -> None:
    payload = json.dumps(rows_from_dict(data), ensure_ascii=False)
    order = json.dumps(CATEGORIES)
    header = '''#!/usr/bin/env python3
"""Generate scripts/vocab-extra.mjs — regenerated by rebuild_vocab_extra.py."""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
OUT = ROOT / "vocab-extra.mjs"
MIN_TOTAL = '''
    footer = '''

def w(en: str, bn: str, emoji: str | None = None, roman: str | None = None) -> dict:
    o: dict = {"en": en.lower(), "bn": bn}
    if emoji:
        o["emoji"] = emoji
    if roman:
        o["roman"] = roman
    return o


def dedupe(items: list[dict]) -> list[dict]:
    seen: set[str] = set()
    out: list[dict] = []
    for x in items:
        key = x["en"]
        if key in seen:
            continue
        seen.add(key)
        out.append(x)
    return out


def from_rows(rows: list[list]) -> list[dict]:
    return [
        w(r[0], r[1], r[2] if len(r) > 2 and r[2] else None, r[3] if len(r) > 3 and r[3] else None)
        for r in rows
    ]


def validate_bn(data: dict[str, list[dict]]) -> int:
    bad = 0
    for cat, items in data.items():
        for x in items:
            if not BN_RE.search(x["bn"]):
                print(f"ERROR: {cat}/{x['en']} bn lacks Bengali: {x['bn']!r}", file=sys.stderr)
                bad += 1
    return bad


def fmt_entry(entry: dict, indent: str = "    ") -> str:
    parts = [f'{indent}{{ en: {json.dumps(entry["en"])}, bn: {json.dumps(entry["bn"])}']
    if "emoji" in entry:
        parts.append(f", emoji: {json.dumps(entry['emoji'])}")
    if "roman" in entry:
        parts.append(f", roman: {json.dumps(entry['roman'])}")
    parts.append(" },")
    return "".join(parts)


def write_js(data: dict[str, list[dict]], path: Path) -> None:
    lines = ["export default {"]
    keys = list(data.keys())
    for i, key in enumerate(keys):
        lines.append(f"  {key}: [")
        for entry in data[key]:
            lines.append(fmt_entry(entry))
        lines.append("  ]," if i < len(keys) - 1 else "  ]")
    lines.append("};")
    lines.append("")
    path.write_text("\\n".join(lines), encoding="utf-8")


def build_vocab() -> dict[str, list[dict]]:
    order = '''
    tail = '''
    return {k: dedupe(from_rows(VOCAB_DATA[k])) for k in order}


def main() -> int:
    data = build_vocab()
    counts = {k: len(v) for k, v in data.items()}
    total = sum(counts.values())
    bad = validate_bn(data)
    for cat, n in counts.items():
        print(f"{cat}: {n}")
    print(f"total: {total}")
    print(f"bad_bn: {bad}")
    if total < MIN_TOTAL or bad > 0:
        return 1
    write_js(data, OUT)
    print(f"Wrote {OUT}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
'''
    mid = f'''BN_RE = re.compile(r"[\\u0980-\\u09FF]")

VOCAB_DATA = json.loads({payload!r})
'''
    content = header + str(MIN_TOTAL) + mid + footer + order + tail
    path.write_text(content, encoding="utf-8")


def main() -> int:
    base = load_head_base()
    extras = dict(EXTRAS)
    extras["transport"] = list(TRANSPORT_EXTRAS)
    data = merge_vocab(base, extras)
    counts = {cat: len(items) for cat, items in data.items()}
    total = sum(counts.values())

    bad = validate_bn(data)
    spot_failures = check_spot_tests(data)

    for cat, n in counts.items():
        print(f"{cat}: {n}")
    print(f"TOTAL: {total}")
    print(f"bad_bn: {bad}")

    if spot_failures:
        print("SPOT CHECK FAILURES:", file=sys.stderr)
        for msg in spot_failures:
            print(f"  {msg}", file=sys.stderr)

    if bad > 0 or total < MIN_TOTAL or spot_failures:
        return 1

    write_mjs(data, OUT_MJS)
    write_gen_py(data, OUT_GEN)
    print(f"Wrote {OUT_MJS}")
    print(f"Wrote {OUT_GEN}")
    print("Spot checks passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
