#!/usr/bin/env python3
"""Compile full vocabulary and write scripts/_gen_vocab_extra.py."""
import importlib.util
import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SCRIPTS = ROOT / "scripts"
OUT = SCRIPTS / "_gen_vocab_extra.py"
CAT_DIR = ROOT / "src" / "data" / "categories"
MIN_TOTAL = 1600

NUMBER_WORDS = {
    "zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine",
    "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen",
    "seventeen", "eighteen", "nineteen", "twenty", "thirty", "forty", "fifty",
    "sixty", "seventy", "eighty", "ninety", "hundred", "thousand", "lakh",
    "twenty-one", "twenty-two", "twenty-three", "twenty-four", "twenty-five",
    "twenty-six", "twenty-seven", "twenty-eight", "twenty-nine", "thirty-one",
    "thirty-two", "thirty-five", "forty-five", "two hundred", "five hundred",
}


def t(en, bn, emoji="", roman=""):
    return [en, bn, emoji, roman]


def load_base(cat):
    data = json.loads((CAT_DIR / f"{cat}.json").read_text(encoding="utf-8"))
    return [t(w["en"], w["bn"], w.get("emoji", ""), w.get("roman", "")) for w in data["words"]]


def dedupe_rows(rows):
    seen, out = set(), []
    for r in rows:
        k = r[0].lower()
        if k in seen:
            continue
        seen.add(k)
        out.append(r)
    return out


def extend(cat, rows):
    V[cat].extend(rows)


# Load base
cats = ["animals", "colors", "family", "food", "body", "mathematics", "nature", "home", "clothes", "transport", "feelings", "actions"]
V = {c: load_base(c) for c in cats}
V["mathematics"] = [r for r in V["mathematics"] if r[0].lower() not in NUMBER_WORDS]

# Animals from make_vocab_gen
spec = importlib.util.spec_from_file_location("mvg", SCRIPTS / "make_vocab_gen.py")
mvg = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mvg)
V["animals"] = dedupe_rows(mvg.build_vocab_data()["animals"])

# Load bulk extras from companion JSON (generated inline below if missing)
extras_path = SCRIPTS / "_vocab_bulk_extras.json"
if not extras_path.exists():
    print("Missing _vocab_bulk_extras.json - run generate_extras first", file=sys.stderr)
    sys.exit(1)

extras = json.loads(extras_path.read_text(encoding="utf-8"))
for cat, rows in extras.items():
    extend(cat, rows)

for k in V:
    V[k] = dedupe_rows(V[k])

counts = {k: len(v) for k, v in V.items()}
total = sum(counts.values())
print("Counts:", counts)
print("Total:", total)
if total < MIN_TOTAL:
    print(f"ERROR: total {total} < {MIN_TOTAL}", file=sys.stderr)
    sys.exit(1)

payload = json.dumps(V, ensure_ascii=False)
script = f'''#!/usr/bin/env python3
"""Generate scripts/vocab-extra.mjs with toddler EN→BN vocabulary."""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
OUT = ROOT / "vocab-extra.mjs"
MIN_TOTAL = {MIN_TOTAL}
BN_RE = re.compile(r"[\\u0980-\\u09FF]")

VOCAB_DATA = json.loads({payload!r})


def w(en: str, bn: str, emoji: str | None = None, roman: str | None = None) -> dict:
    o: dict = {{"en": en.lower(), "bn": bn}}
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
                print(f"ERROR: {{cat}}/{{x['en']}} bn lacks Bengali: {{x['bn']!r}}", file=sys.stderr)
                bad += 1
    return bad


def fmt_entry(entry: dict, indent: str = "    ") -> str:
    parts = [f'{{indent}}{{{{ en: {{json.dumps(entry["en"])}}, bn: {{json.dumps(entry["bn"])}}']
    if "emoji" in entry:
        parts.append(f", emoji: {{json.dumps(entry['emoji'])}}")
    if "roman" in entry:
        parts.append(f", roman: {{json.dumps(entry['roman'])}}")
    parts.append(" }},")
    return "".join(parts)


def write_js(data: dict[str, list[dict]], path: Path) -> None:
    lines = ["export default {{"]
    keys = list(data.keys())
    for i, key in enumerate(keys):
        lines.append(f"  {{key}}: [")
        for entry in data[key]:
            lines.append(fmt_entry(entry))
        lines.append("  ]," if i < len(keys) - 1 else "  ]")
    lines.append("}};")
    lines.append("")
    path.write_text("\\n".join(lines), encoding="utf-8")


def build_vocab() -> dict[str, list[dict]]:
    order = [
        "animals", "colors", "family", "food", "body", "mathematics",
        "nature", "home", "clothes", "transport", "feelings", "actions",
    ]
    return {{k: dedupe(from_rows(VOCAB_DATA[k])) for k in order}}


def main() -> int:
    data = build_vocab()
    counts = {{k: len(v) for k, v in data.items()}}
    total = sum(counts.values())
    bad = validate_bn(data)
    for cat, n in counts.items():
        print(f"{{cat}}: {{n}}")
    print(f"total: {{total}}")
    print(f"bad_bn: {{bad}}")
    if total < MIN_TOTAL or bad > 0:
        return 1
    write_js(data, OUT)
    print(f"Wrote {{OUT}}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
'''
OUT.write_text(script, encoding="utf-8")
print(f"Wrote {OUT}")
subprocess.run([sys.executable, str(OUT)], check=True)
