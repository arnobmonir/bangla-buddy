#!/usr/bin/env python3
"""Fix all bn fields to Bengali script and regenerate vocab-extra.mjs."""
from __future__ import annotations

import importlib.util
import json
import re
import subprocess
import sys
from pathlib import Path

SCRIPTS = Path(__file__).resolve().parent
ROOT = SCRIPTS.parent
GEN = SCRIPTS / "_gen_vocab_extra.py"
OUT_MJS = SCRIPTS / "vocab-extra.mjs"
CAT_DIR = ROOT / "src" / "data" / "categories"
OVERRIDES_JSON = SCRIPTS / "bn_overrides_complete.json"
MIN_TOTAL = 1600
BN_RE = re.compile(r"[\u0980-\u09FF]")
LATIN = re.compile(r"[a-zA-Z]")

# Common English loanwords -> Bengali script (Bangladesh toddler vocab)
LOAN: dict[str, str] = {
    "abacus": "আbacus", "alligator": "অ্যালিগেটor", "almari": "আলমারি",
    "armchair": "আrmchair", "auto": "অটো", "backpack": "ব্যাকপ্যাক",
    "balloon": "বেলুন", "bandage": "ব্যান্ডেজ", "blender": "ব্লেন্ডার",
    "blouse": "ব্লাউজ", "board": "বোর্ড", "book": "বই", "boot": "বুট",
    "box": "বক্স", "bulb": "বাল্ব", "burger": "বার্গার", "cake": "কেক",
    "calculator": "ক্যালকুলেটor", "calendar": "ক্যালেন্ডার", "camera": "ক্যামেরা",
    "camping": "ক্যামping", "card": "কার্ড", "cardigan": "কার্ডigan",
    "carpet": "কার্পেট", "cart": "কart", "case": "কেস", "chalk": "চalk",
    "chart": "চart", "computer": "কম্পিউটার", "control": "কন্টrol",
    "cookie": "কookie", "copy": "কopi", "costume": "কostume", "couch": "সofa",
    "crane": "কrane", "crayon": "কrayon", "cross": "কross", "cup": "কap",
    "data": "ডeta", "delta": "ডelta", "denim": "ডenim", "detour": "ডetour",
    "diary": "ডiary", "doll": "ডoll", "donut": "ডonut", "drawer": "ডrawer",
    "dresser": "ডresser", "drill": "ডrill", "dryer": "ডryer", "dustbin": "ডastbin",
    "engine": "ইঞ্জin", "envelope": "এnvelope", "eraser": "ইraser",
    "escalator": "এscalator", "express": "এxpress", "fan": "পাখা",
    "fence": "ফence", "filter": "ফilter", "flashlight": "ফlashlight",
    "flip": "ফlip", "flop": "ফlop", "flops": "ফlops", "foil": "ফoil",
    "forklift": "ফorklift", "frame": "ফrame", "garage": "গarage", "gate": "গate",
    "geyser": "গeyser", "gift": "গift", "glue": "গlue", "gps": "জিপিএস",
    "graph": "গraph", "grid": "গrid", "hammer": "হammer", "hangar": "হangar",
    "heater": "হiter", "helipad": "হelipad", "helmet": "হelmet", "hinge": "হinge",
    "hiking": "হiking", "home": "ঘor", "hoodie": "হoodi", "hot": "হot",
    "hovercraft": "হovercraft", "humidifier": "হumidifier", "jacket": "জacket",
    "kayak": "কayak", "kettle": "কettle", "keyboard": "কeyboard", "kit": "কit",
    "ladder": "লadder", "laptop": "লaptop", "launch": "লaunch", "leggings": "লeggings",
    "lighter": "লighter", "local": "লocal", "loafers": "লoafers", "lock": "লock",
    "lunch": "লunch", "magnet": "মagnet", "maker": "মaker", "map": "মap",
    "marker": "মarker", "mask": "মask", "metro": "মetro", "microbus": "মicrobus",
    "microwave": "মicrowave", "minibus": "মinibus", "mop": "মop", "motor": "মotor",
    "motorcyclist": "মotorcyclist", "mouse": "মouse", "muffler": "মuffler",
    "muslin": "মuslin", "nail": "নail", "neon": "নeon", "notebook": "নotebook",
    "oasis": "ওasis", "octopus": "ওctopus", "odometer": "ওdometer", "of": "এর",
    "onesie": "ওnesie", "open": "ওpen", "openers": "ওpeners", "opener": "ওpener",
    "orchid": "ওrchid", "organizer": "ওrganizer", "oven": "ওven", "overalls": "ওveralls",
    "overhead": "ওverhead", "overpass": "ওverpass", "oxygen": "অxygen",
    "paddle": "পaddle", "paint": "পaint", "pan": "পan", "pancreas": "পancreas",
    "paper": "পaper", "parachute": "পarachute", "paraglider": "পaraglider",
    "park": "পark", "parking": "পarking", "pass": "পass", "passport": "পassport",
    "pattern": "পattern", "peeler": "পeeler", "petroleum": "পetroleum",
    "phone": "ফon", "photo": "ফoto", "pickup": "পickup", "picnic": "পicnic",
    "pier": "পier", "pilot": "পilot", "pizza": "পizza", "plastic": "পlastic",
    "platform": "পlatform", "plug": "পlug", "poncho": "পoncho", "porch": "পorch",
    "port": "পort", "postman": "পostman", "printer": "পrinter", "prism": "পrism",
    "puzzle": "পuzzle", "radio": "রadio", "raincoat": "রaincoat", "rake": "রake",
    "recycle": "রecycle", "reflex": "রeflex", "remote": "রemote", "retina": "রetina",
    "ribbon": "রibbon", "rickshaw": "রickshaw", "roller": "রoller", "romper": "রomper",
    "roundabout": "রoundabout", "router": "রouter", "rug": "রug", "ruler": "রuler",
    "runway": "রunway", "sail": "সail", "salad": "সalad", "salamander": "সalamander",
    "sandal": "সandal", "sardine": "সardine", "sash": "সash", "scarf": "সcarf",
    "scooter": "সcooter", "screw": "সcrew", "screwdriver": "সcrewdriver", "segway": "সegway",
    "sensor": "সensor", "set": "সet", "shawl": "শawl", "shed": "শed", "shelf": "শelf",
    "shirt": "শirt", "shovel": "শovel", "shower": "শower", "signal": "সignal",
    "skateboard": "সkateboard", "skirt": "সkirt", "sled": "সled", "slide": "সlide",
    "slipper": "সlipper", "slippers": "সlippers", "snowmobile": "সnowmobile",
    "socket": "সocket", "sofa": "সofa", "soup": "সoup", "speaker": "সpeaker",
    "speedboat": "সpeedboat", "speedometer": "সpeedometer", "sponge": "সponge",
    "spot": "সpot", "stack": "সtack", "stamp": "সtamp", "stapler": "সtapler",
    "star": "সtar", "station": "সtation", "sticker": "সticker", "stocker": "সtocker",
    "stopwatch": "সtopwatch", "stove": "সtove", "stroller": "সtroller", "studio": "সtudio",
    "subway": "সubway", "suitcase": "সuitcase", "sun": "সun", "sweater": "সweater",
    "switch": "সwitch", "tablet": "সtablet", "taxi": "টaxi", "tempo": "টempo",
    "tennis": "টennis", "thermometer": "টhermometer", "thermos": "টhermos",
    "ticket": "টicket", "timer": "টimer", "tissue": "টissue", "toast": "টoast",
    "toaster": "টoaster", "tongs": "টongs", "toolbox": "টoolbox", "top": "টop",
    "tower": "টower", "track": "টrack", "tractor": "টractor", "traffic": "টraffic",
    "train": "টrain", "trampoline": "টrampoline", "trash": "টrash", "tray": "টray",
    "trend": "টrend", "triage": "টriage", "tricycle": "টricycle", "tripod": "টripod",
    "trolley": "টrolley", "truck": "টruck", "trumpet": "টrumpet", "tulip": "টulip",
    "tunnel": "টunnel", "turtle": "টurtle", "tweezers": "টweezers", "typewriter": "টypewriter",
    "umbrella": "ছata", "underpass": "আnderpass", "uniform": "ইuniform",
    "unicycle": "ইunicycle", "vacuum": "ভacuum", "van": "ভan", "vase": "ভase",
    "vest": "ভest", "video": "ভideo", "visa": "ভisa", "volcano": "ভolcano",
    "wagon": "ওagon", "wallet": "ওallet", "washer": "ওasher", "watch": "ঘড়i",
    "water": "পani", "wheelbarrow": "ওheelbarrow", "wheelchair": "ওheelchair",
    "whisk": "উhisk", "whiteboard": "হwhiteboard", "wifi": "ওifi", "windbreaker": "ওindbreaker",
    "windshield": "ওindshield", "wiper": "ওiper", "wrench": "রench", "yacht": "ইacht",
    "yard": "ইard", "yo": "ইo", "zip": "জip", "ziplock": "জiplock",
    "nervous": "নervous", "optimistic": "ওptimistic", "nostalgic": "নostalgic",
    "discouraged": "হataash", "disappointed": "হataash", "frustrated": "হataash",
    "irritated": "বirokto", "miserable": "দukkho", "depressed": "দukkho",
    "melancholy": "দukkho", "gloomy": "দukkho", "moved": "অnubhuto",
    "thankful": "ধonnobad", "appreciative": "কritoggo", "motivated": "উtshahito",
    "overwhelmed": "বikkhisto", "drained": "কlanto", "entertained": "মoja",
    "amused": "মoja", "naughty": "দushtu", "embarrassed": "লojja",
    "regretful": "দoshi", "remorseful": "দoshi", "trusting": "বishwash",
    "hostile": "শotru", "cautious": "সavdhan", "faint": "মurtyu prox",
    "healthy": "সuস্থo", "unwell": "অshustho", "feverish": "জor",
    "chilly": "ঠanda", "warm": "গorom", "cozy": "আramdayok",
    "uncomfortable": "অshohoj", "comfortable": "আramdayok", "safe": "নirapod",
    "unsafe": "বipod", "unlucky": "ভagyohin", "shocked": "অbak",
    "amazed": "অbak", "astonished": "অbak", "clear": "পorishkar",
    "foggy": "ধundhla", "artistic": "শilpi", "musical": "সangitik",
    "cheerful": "খushi", "gleeful": "খushi", "merry": "খushi",
    "bored": "বirokto", "insecure": "অnishchit", "doubtful": "শondeh",
    "hike": "হiking", "camp": "কamp", "hiking": "হiking",
    "coffee": "কoffee", "donut": "ডonut", "toast": "টoast",
    "sandwich": "সandwich", "tiffin": "টiffin", "chop": "চop",
    "paneer": "পaneer", "firni": "ফirni", "jalebi": "জilapi",
    "boot": "বুট", "overlap": "ওverlap", "collection": "সongroho",
    "photosynthesis": "photosynthesis", "pollination": "pollination",
    "aurora": "অurora", "galaxy": "গalaxy", "petroleum": "পetroleum",
    "carbon": "কarbon", "dioxide": "ডioxide", "nature": "নature",
    "trail": "টrail", "eucalyptus": "ইucalyptus", "daisy": "ডaisy",
    "algae": "আlgae", "moss": "মoss", "lily": "লily", "orchid": "অrchid",
    "porpoise": "পorpoise", "manatee": "মanatee", "iguana": "ইguana",
    "lemur": "লemur", "gibbon": "জibbon", "baboon": "বaboon",
    "gorilla": "গorilla", "chimpanzee": "চimpanzee", "orangutan": "ওrangutan",
    "platypus": "পlatypus", "dragonfly": "ধrobolpoka", "moth": "মoth",
    "caterpillar": "ইl", "ladybug": "গুptopoka", "firefly": "জonaki",
    "wasp": "ভoral", "hornet": "ভoral", "tadpole": "বyang er chhana",
    "porcupine": "শojaru", "mongoose": "বengol", "meerkat": "মirkat",
    "armadillo": "আrmadilo", "reindeer": "রeinidear", "moose": "মus",
    "beaver": "বivar", "mole": "চucho", "raccoon": "রækun", "skunk": "গondhogokul",
    "porpoise": "porpoise", "marlin": "marlin", "trout": "trout", "carp": "carp",
    "pomfret": "pomfret", "mackerel": "mackerel", "pufferfish": "pufferfish",
    "clownfish": "clownfish", "alligator": "alligator", "salamander": "salamander",
    "double": "ডouble", "decker": "ডecker", "cargo": "কargo", "ship": "জahaj",
    "dump": "ডump", "tow": "টow", "garbage": "গarbage", "cement": "সement",
    "mixer": "মixer", "bulldozer": "বulldozer", "excavator": "এxcavator",
    "golf": "গolf", "snowmobile": "সnowmobile", "shopping": "শopping",
    "luggage": "লuggage", "conveyor": "কonveyor", "belt": "বelt",
    "elevator": "এlevator", "moving": "মoving", "walkway": "ওalkway",
    "highway": "হighway", "expressway": "এxpressway", "crosswalk": "কrosswalk",
    "intersection": "ইntersection", "crossing": "কrossing", "charging": "চarging",
    "gas": "গas", "toll": "টoll", "booth": "বooth", "weigh": "ওeigh",
    "border": "বorder", "customs": "কustoms", "harbor": "হarbor", "dock": "ডock",
    "waiting": "ওaiting", "room": "ঘor", "departure": "ডeparture", "arrival": "আrrival",
    "boarding": "বoarding", "duffel": "ডuffel", "seat": "সeat", "dashboard": "ডashboard",
    "rearview": "রearview", "mirror": "আyna", "headlight": "হeadlight",
    "taillight": "টaillight", "turn": "টurn", "life": "জibon", "jacket": "জacket",
    "oar": "oar", "propeller": "propeller", "jet": "jet", "rocket": "rocket",
    "hang": "glider", "glider": "glider", "zip": "line", "line": "line",
    "cable": "cable", "car": "car", "funicular": "funicular", "gondola": "gondola",
    "lift": "lift", "stand": "stand", "stop": "stop", "lane": "lane",
    "jam": "jam", "work": "work", "way": "way", "limit": "limit",
    "sign": "sign", "yield": "yield", "pedestrian": "peyde", "cyclist": "saikelist",
    "hot": "dog", "dog": "dog", "fast": "food", "food": "food", "street": "food",
    "spicy": "food", "healthy": "food", "sweet": "taste", "taste": "taste",
    "kathi": "roll", "roll": "roll", "shami": "kebab", "kebab": "kebab",
    "dim": "chop", "patishapta": "patishapta", "bora": "bora", "jilapi": "jilapi",
    "rice": "cake", "cake": "cake", "slice": "slice",
}

# NOTE: LOAN dict above still has issues - use explicit overrides file as source of truth


def is_bn(s: str) -> bool:
    return bool(BN_RE.search(s)) and not LATIN.search(s)


def load_maps() -> tuple[dict[str, str], dict[str, str]]:
    """Build phrase and token maps from good vocabulary entries."""
    spec = importlib.util.spec_from_file_location("gen", GEN)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    data = mod.build_vocab()

    phrase: dict[str, str] = {}
    token: dict[str, str] = {}

    def ingest(bn: str, roman: str) -> None:
        if not is_bn(bn) or not roman:
            return
        rl = roman.lower().strip()
        phrase[rl] = bn
        rb = re.split(r"[\s\-]+", rl)
        bb = bn.split()
        if len(rb) == len(bb):
            for r, b in zip(rb, bb):
                if r and is_bn(b):
                    token[r] = b

    for items in data.values():
        for x in items:
            ingest(x["bn"], x.get("roman", ""))

    for cat_file in CAT_DIR.glob("*.json"):
        cat = json.loads(cat_file.read_text(encoding="utf-8"))
        for w in cat.get("words", []):
            ingest(w["bn"], w.get("roman", ""))

    return phrase, token


def convert_phrase(text: str, phrase: dict[str, str], token: dict[str, str]) -> str | None:
    if not text:
        return None
    t = text.lower().strip()
    if t in phrase:
        return phrase[t]
    words = re.split(r"[\s\-]+", t)
    out: list[str | None] = []
    for w in words:
        if not w:
            continue
        if w in token:
            out.append(token[w])
        elif w in LOAN and is_bn(LOAN[w]):
            out.append(LOAN[w])
        else:
            out.append(None)
    if out and all(out):
        return " ".join(out)
    return None


def load_overrides() -> dict[str, str]:
    if OVERRIDES_JSON.exists():
        return json.loads(OVERRIDES_JSON.read_text(encoding="utf-8"))
    return {}


def build_overrides(phrase: dict[str, str], token: dict[str, str]) -> dict[str, str]:
    """Generate overrides for all bad entries."""
    bad = json.loads((SCRIPTS / "_bad_bn.json").read_text(encoding="utf-8"))
    overrides: dict[str, str] = {}
    missing: list[tuple[str, str, str, str]] = []

    for e in bad:
        key = f"{e['cat']}|{e['en']}"
        bn = convert_phrase(e["bn"], phrase, token) or convert_phrase(e.get("roman", ""), phrase, token)
        if bn and is_bn(bn):
            overrides[key] = bn
        else:
            missing.append((e["cat"], e["en"], e["bn"], e.get("roman", "")))

    if missing:
        print(f"WARNING: {len(missing)} entries need manual overrides", file=sys.stderr)
        for m in missing[:20]:
            print(f"  {m[0]}|{m[1]} bn={m[2]!r} roman={m[3]!r}", file=sys.stderr)

    return overrides


def apply_to_vocab(overrides: dict[str, str]) -> dict[str, list[list]]:
    spec = importlib.util.spec_from_file_location("gen", GEN)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    data = mod.VOCAB_DATA

    for cat, rows in data.items():
        for row in rows:
            key = f"{cat}|{row[0].lower()}"
            if key in overrides:
                row[1] = overrides[key]
            elif not is_bn(row[1]):
                raise SystemExit(f"Missing override for {key}: {row[1]!r}")

    return data


def write_gen_py(data: dict[str, list[list]]) -> None:
    payload = json.dumps(data, ensure_ascii=False)
    content = f'''#!/usr/bin/env python3
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
    GEN.write_text(content, encoding="utf-8")


def main() -> int:
    phrase, token = load_maps()
    print(f"Loaded {len(phrase)} phrases, {len(token)} tokens")

    overrides = load_overrides()
    if not overrides:
        overrides = build_overrides(phrase, token)
        OVERRIDES_JSON.write_text(json.dumps(overrides, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"Wrote {len(overrides)} auto overrides to {OVERRIDES_JSON}")

    # Merge with manual overrides file if partial
    manual = json.loads(OVERRIDES_JSON.read_text(encoding="utf-8")) if OVERRIDES_JSON.exists() else {}
    overrides.update(manual)

    bad_count = len(json.loads((SCRIPTS / "_bad_bn.json").read_text()))
    if len(overrides) < bad_count:
        print(f"ERROR: only {len(overrides)}/{bad_count} overrides", file=sys.stderr)
        return 1

    data = apply_to_vocab(overrides)
    write_gen_py(data)
    print(f"Updated {GEN}")

    rc = subprocess.run([sys.executable, str(GEN)], cwd=str(SCRIPTS)).returncode
    return rc


if __name__ == "__main__":
    raise SystemExit(main())
