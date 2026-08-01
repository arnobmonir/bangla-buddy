#!/usr/bin/env python3
"""Build scripts/_gen_vocab_extra.py and optionally run it."""
import json
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


def add_extras(v):
    """Add toddler extras with Bangladesh-friendly Bangla."""
    # Import animals extras from make_vocab_gen
    import importlib.util
    spec = importlib.util.spec_from_file_location("mvg", SCRIPTS / "make_vocab_gen.py")
    mvg = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mvg)
    extra_animals = mvg.build_vocab_data()["animals"]
    base_en = {r[0].lower() for r in v["animals"]}
    for r in extra_animals:
        if r[0].lower() not in base_en:
            v["animals"].append(r)

    v["colors"] += [
        t("violet", "বেগুনি", "🟣", "beguni"), t("indigo", "নীল", "🔵", "nil"),
        t("turquoise", "ফিরোজা", "🩵", "firoza"), t("teal", "সবুজাভ নীল", "🩵", "sabujabh nil"),
        t("lime", "লেবু সবুজ", "🟢", "lebu sobuj"), t("olive", "জলপাই", "🫒", "jolpai"),
        t("navy", "গাঢ় নীল", "🔵", "garho nil"), t("crimson", "লালচে", "🔴", "lalche"),
        t("azure", "আকাশি", "🩵", "akashi"), t("amber", "অ্যাম্বার", "🟠", "amber"),
        t("peach", "পীচ", "🍑", "peach"), t("mint green", "পudina sobuj", "🟢", "pudina sobuj"),
        t("charcoal", "কoyla", "⚫", "koyla"), t("silver gray", "রূপালি", "🩶", "rupal"),
        t("golden yellow", "সোনালি", "🟡", "sonali"), t("transparent", "স্বচ্ছ", "⬜", "shwochho"),
        t("shiny", "চকচকে", "✨", "chokchoke"), t("warm color", "উষ্ণ রং", "🟠", "ushno rong"),
        t("cool color", "শীতল রং", "🔵", "shitol rong"), t("primary color", "মূল রং", "🎨", "mul rong"),
        t("pastel", "প্যাস্টেল", "🎨", "pastel"), t("earthy", "মাটির", "🟤", "matir"),
        t("sky color", "আকাশের রং", "🩵", "akasher rong"), t("leaf green", "পাতার সবুজ", "🍃", "patar sobuj"),
        t("sunset orange", "সূর্যাস্ত কমলা", "🌅", "surjasto komola"), t("midnight blue", "মধ্যরাত নীল", "🌌", "madhyorat nil"),
        t("snow white", "তুষার সাদা", "❄️", "tushar shada"), t("ink black", "কালি কালো", "🖤", "kali kalo"),
        t("rust", "মরিচা", "🟤", "moricha"), t("copper", "তামা", "🟠", "tama"),
        t("rainbow color", "রামধনু রং", "🌈", "ramdhonu rong"), t("neon", "নeon", "💡", "neon"),
        t("metallic", "ধাতব", "🔩", "dhatob"), t("floral pink", "ফুলের গোলাপি", "🌸", "phuler golapi"),
        t("dull color", "নিস্তেজ", "🩶", "nistej"), t("secondary color", "গৌণ রং", "🎨", "goun rong"),
        t("opaque", "অস্বচ্ছ", "⬛", "oshwochho"), t("scarlet", "লাল", "🔴", "lal"),
    ]

    v["family"] += [
        t("grandson", "নati", "👦", "nati"), t("granddaughter", "nati", "👧", "nati"),
        t("son", "chele", "👦", "chele"), t("daughter", "meye", "👧", "meye"),
        t("husband", "swami", "👨", "swami"), t("wife", "stri", "👩", "stri"),
        t("parents", "baba ma", "👨‍👩‍👧", "baba ma"), t("relatives", "atiyo", "👨‍👩‍👧", "atiyo"),
        t("elder brother", "dada", "👨", "dada"), t("elder sister", "didi", "👩", "didi"),
        t("younger brother", "chhoto bhai", "👦", "chhoto bhai"), t("younger sister", "chhoto bon", "👧", "chhoto bon"),
        t("bride", "konna", "👰", "konna"), t("groom", "dulha", "🤵", "dulha"),
        t("wedding", "biye", "💒", "biye"), t("twins", "joma", "👯", "joma"),
        t("babysitter", "baccha dekhar", "👩", "baccha dekhar"), t("shopkeeper", "dokandar", "🏪", "dokandar"),
        t("rickshaw puller", "rickshawala", "🛺", "rickshawala"), t("engineer", "engineer", "👷", "engineer"),
        t("pilot", "pilot", "✈️", "pilot"), t("artist", "shilpi", "🎨", "shilpi"),
        t("singer", "gayok", "🎤", "gayok"), t("student", "student", "🎓", "student"),
        t("classmate", "sohopathi", "🧑‍🎓", "sohopathi"), t("principal", "principal", "🏫", "principal"),
        t("chef", "chef", "👨‍🍳", "chef"), t("barber", "hajam", "💇", "hajam"),
        t("tailor", "darji", "🧵", "darji"), t("mechanic", "mechanic", "🔧", "mechanic"),
        t("electrician", "electrician", "💡", "electrician"), t("plumber", "plumber", "🔧", "plumber"),
        t("carpenter", "thory", "🪚", "thory"), t("gardener", "malik", "🌻", "malik"),
        t("fisherman", "machhi", "🎣", "machhi"), t("milkman", "dudh wala", "🥛", "dudh wala"),
        t("teenager", "kishor", "🧑", "kishor"), t("adult", "proposho", "🧑", "proposho"),
        t("elder", "briddho", "👴", "briddho"), t("newborn", "newborn", "👶", "newborn"),
        t("orphan", "anath", "🧒", "anath"), t("guardian", "oparok", "🧑", "oparok"),
        t("postman", "postman", "📮", "postman"), t("porter", "hamal", "🧳", "hamal"),
        t("guard", "prhori", "🛡️", "prhori"), t("builder", "nirmata", "👷", "nirmata"),
        t("sailor", "nabiik", "⚓", "nabiik"), t("dancer", "nachok", "💃", "nachok"),
        t("writer", "lekhok", "✍️", "lekhok"), t("scientist", "biggyani", "🔬", "biggyani"),
        t("librarian", "librarian", "📚", "librarian"), t("coach", "coach", "🏃", "coach"),
        t("judge", "judge", "⚖️", "judge"), t("lawyer", "ukil", "⚖️", "ukil"),
        t("banker", "banker", "🏦", "banker"), t("waiter", "waiter", "🍽️", "waiter"),
        t("baker", "baker", "🥖", "baker"), t("cobbler", "mochi", "👞", "mochi"),
        t("mason", "rjar", "🧱", "rjar"), t("shepherd", "gopal", "🐑", "gopal"),
        t("stepmother", "sotrir ma", "👩", "sotrir ma"), t("stepfather", "sotrir baba", "👨", "sotrir baba"),
        t("father in law", "shoshur", "👨", "shoshur"), t("mother in law", "shashuri", "👩", "shashuri"),
        t("brother in law", "jamai baba", "👨", "jamai baba"), t("sister in law", "nanad", "👩", "nanad"),
        t("grandchild", "nati", "👶", "nati"), t("ancestor", "purbo purush", "👴", "purbo purush"),
        t("midwife", "daini", "👩", "daini"), t("fish seller", "mach wala", "🐟", "mach wala"),
        t("vegetable seller", "shobji wala", "🥬", "shobji wala"), t("sweeper", "porishkar kari", "🧹", "porishkar kari"),
        t("cashier", "cashier", "💵", "cashier"), t("actor", "abhineta", "🎭", "abhineta"),
        t("referee", "referee", "🧑‍⚖️", "referee"), t("headmaster", "headmaster", "🏫", "headmaster"),
        t("cowherd", "goal", "🐄", "goal"), t("hunter", "shikari", "🏹", "shikari"),
        t("triplets", "tin joma", "👶", "tin joma"), t("stepbrother", "sotrir bhai", "👦", "sotrir bhai"),
        t("stepsister", "sotrir bon", "👧", "sotrir bon"),
    ]

    # Load food/nature extras from inline block file if exists else minimal
    food_block = (SCRIPTS / "_food_extras.json")
    if food_block.exists():
        v["food"] += json.loads(food_block.read_text(encoding="utf-8"))

    return v


def build_vocab_data():
    cats = ["animals", "colors", "family", "food", "body", "mathematics", "nature", "home", "clothes", "transport", "feelings", "actions"]
    v = {c: load_base(c) for c in cats}
    v["mathematics"] = [r for r in v["mathematics"] if r[0].lower() not in NUMBER_WORDS]
    v = add_extras(v)
    for k in v:
        v[k] = dedupe_rows(v[k])
    return v


def write_gen_script(vocab_data):
    payload = json.dumps(vocab_data, ensure_ascii=False, indent=2)
    template = f'''#!/usr/bin/env python3
"""Generate scripts/vocab-extra.mjs with toddler EN→BN vocabulary."""
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
OUT = ROOT / "vocab-extra.mjs"
MIN_TOTAL = {MIN_TOTAL}

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


def fmt_entry(entry: dict, indent: str = "    ") -> str:
    parts = [f'{{indent}}{{ en: {{json.dumps(entry["en"])}}, bn: {{json.dumps(entry["bn"])}}']
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
    for cat, n in counts.items():
        print(f"{{cat}}: {{n}}")
    print(f"total: {{total}}")
    if total < MIN_TOTAL:
        print(f"ERROR: total {{total}} < {{MIN_TOTAL}}", file=sys.stderr)
        return 1
    write_js(data, OUT)
    print(f"Wrote {{OUT}}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
'''
    OUT.write_text(template, encoding="utf-8")


if __name__ == "__main__":
    data = build_vocab_data()
    counts = {k: len(v) for k, v in data.items()}
    total = sum(counts.values())
    print("Preview counts:", counts)
    print("Preview total:", total)
    if total < MIN_TOTAL:
        print("Need more words before writing gen script")
        sys.exit(1)
    write_gen_script(data)
    print(f"Wrote {OUT}")
    subprocess.run([sys.executable, str(OUT)], check=True)
