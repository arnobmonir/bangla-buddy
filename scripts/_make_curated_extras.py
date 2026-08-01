#!/usr/bin/env python3
"""Generate scripts/curated_vocab_extras.py from _gen_vocab_extra + native Bangla fixes."""
from __future__ import annotations

import importlib.util
import json
import re
import subprocess
from pathlib import Path

SCRIPTS = Path(__file__).resolve().parent

NUMBER_WORDS = {
    "zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine",
    "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen",
    "seventeen", "eighteen", "nineteen", "twenty", "thirty", "forty", "fifty",
    "sixty", "seventy", "eighty", "ninety", "hundred", "thousand", "lakh",
    "twenty-one", "twenty-two", "twenty-three", "twenty-four", "twenty-five",
    "twenty-six", "twenty-seven", "twenty-eight", "twenty-nine", "thirty-one",
    "twenty-two", "thirty-five", "forty-five", "two hundred", "five hundred",
}

CATS = [
    "animals", "colors", "family", "food", "body", "mathematics",
    "nature", "home", "clothes", "transport", "feelings", "actions",
]

BN_RE = re.compile(r"[\u0980-\u09FF]")

# Garbled bn -> corrected Bangla (from auto-transliteration audit)
BN_BY_EN: dict[str, str] = {
    # spot-checks
    "flour": "আটা",
    "worm": "কেঁচো",
    "earthworm": "কেঁচো",
    "balcony": "বারান্দা",
    "air conditioner": "এসি",
    "burger": "বার্গার",
    "squid": "স্কুইড",
    "chimpanzee": "শিম্পাঞ্জি",
    "near": "কাছে",
    "confident": "আত্মবিশ্বাসী",
    # animals
    "macaw": "ম্যাকাও",
    "starfish": "তারামাছ",
    "stingray": "শঙ্কুচ",
    "catfish": "মাগুর",
    "rohu fish": "রুই",
    "katla fish": "কাতলা",
    "python snake": "অজগর",
    "cobra snake": "কোব্রা",
    "toad": "ব্যাঙ",
    "dragonfly": "ধ্রোবলপোকা",
    "grasshopper": "ঘাসফড়িং",
    "cockroach": "তেলাপোকা",
    "moth": "পতঙ্গ",
    "caterpillar": "ইল",
    "scorpion": "বিচ্ছি",
    "ladybug": "নেনে পোকা",
    "firefly": "জোনাকি",
    "wasp": "ভোরাল",
    "hornet": "ভোরাল",
    "tadpole": "ব্যাঙের ছানা",
    "silkworm": "রেশম পোকা",
    "leech": "জোঁক",
    "sea lion": "সামুদ্রিক সিংহ",
    "platypus": "প্ল্যাটিপাস",
    "lemur": "লেমুর",
    "gibbon": "জিব্বন",
    "orangutan": "অরেঞ্জুটান",
    "gorilla": "গোরিলা",
    "baboon": "বেবুন",
    "pangolin": "বন্রুই",
    "porpoise": "শুশুক",
    "manatee": "মানাটি",
    "alligator": "অ্যালিগেটর",
    "iguana": "ইগুয়ানা",
    "salamander": "স্যালাম্যান্ডার",
    "termite": "উইপোকা",
    "bumblebee": "বাম্বলবি",
    "robin bird": "রবিন",
    "nightingale": "বুলবুলি",
    "lovebird": "প্রেম পাখি",
    "parakeet": "টিয়া পাখি",
    "blue jay": "নীল কাক",
    "wren": "টিটটি",
    "thrush": "দোয়াল",
    "barbet bird": "বসন্তরাজ",
    "roller bird": "নীলকণ্ঠ",
    "sunbird": "মৌটাতি",
    "sandpiper": "বেলা পাখি",
    "tern bird": "সামুদ্রিক পাখি",
    "cormorant": "পানকৌড়ি",
    "sand crab": "কাঁকড়া",
    "hermit crab": "একাকী কাঁকড়া",
    "beluga whale": "বেলুগা তিমি",
    "swordfish": "তলোয়ার মাছ",
    "marlin": "মার্লিন মাছ",
    "trout": "ট্রাউট মাছ",
    "carp": "কার্প মাছ",
    "pomfret": "পমফ্রেট",
    "sardine": "সারডিন",
    "mackerel": "ম্যাকরেল",
    "pufferfish": "ফুপো মাছ",
    "clownfish": "মাধ্যম মাছ",
    "fawn": "হরিণ ছানা",
    "kitten": "বিড়াল ছানা",
    "gosling": "হাঁসের ছানা",
    "penguin chick": "পেঙ্গুইন ছানা",
    "colt": "ঘোড়াছানা",
    "pup": "কুকুরছানা",
    "lizard": "টিকটিকি",
    "gecko": "টিকটিকি",
    "centipede": "শতপাদী",
    "millipede": "হাজার পা",
    "flea": "উপাড়",
    "cicada": "শেহরা",
    "wolf cub": "নেকড়ে ছানা",
    "lion cub": "সিংহ ছানা",
    "tiger cub": "বাঘ ছানা",
    "monkey baby": "বানর ছানা",
    "rabbit kit": "খরগোশ ছানা",
    "seal pup": "সিল ছানা",
    "owl chick": "পেঁচা ছানা",
    "eaglet": "ঈগল ছানা",
    "nestling": "ঘাঁটির বাচ্চা",
    "hatchling": "ডিম থেকে বাচ্চা",
    # food
    "peanut": "বাদাম",
    "pickle": "আচার",
    "ginger": "আদা",
    "pizza": "পিজ্জা",
    "chocolate": "চকোলেট",
    "breakfast": "নাশতা",
    "lunch": "দুপুরের খাবার",
    "dinner": "রাতের খাবার",
    "popcorn": "পপকর্ন",
    "french fries": "ফ্রেঞ্চ ফ্রাই",
    "hot dog": "হটডগ",
    "sandwich": "স্যান্ডউইচ",
    "noodles": "নুডলস",
    "mushroom": "মাশরুম",
    "corn": "ভুট্টা",
    "peas": "মটর",
    "radish": "মূলা",
    "mustard oil": "সরিষার তেল",
    "jaggery": "গুড়",
    "semolina": "সুজি",
    "naan": "নান",
    "lollipop": "ললিপপ",
    "donut": "ডোনাট",
    "toast": "টোস্ট",
    "coffee": "কফি",
    "lemonade": "লেবুর শরবত",
    "mango juice": "আমের রস",
    "omelet": "ডিম ভাজি",
    "jalebi": "জিলাপি",
    "firni": "ফিরনি",
    "halim": "হালিম",
    "borhani": "বোরহানি",
    "lassi": "লাসি",
    "fuchka": "ফুচকা",
    "dragon fruit": "ড্রাগন ফল",
    "strawberry": "স্ট্রবেরি",
    "pear": "নাশপাতি",
    "chicken soup": "মুরগির সুপ",
    "fried chicken": "ভাজা মুরগি",
    "steamed rice": "ভাপা ভাত",
    "mashed potato": "আলু ভর্তা",
    "mashed fish": "মাছ ভর্তা",
    "dried fish": "শুঁটকি মাছ",
    "rice cake": "পিঠা",
    "street food": "রাস্তার খাবার",
    "spicy food": "ঝাল খাবার",
    "fast food": "ফাস্ট ফুড",
    "healthy food": "সুস্থ খাবার",
    "sweet yogurt": "মিষ্টি দই",
    # home
    "sofa": "সোফা",
    "armchair": "আর্মচেয়ার",
    "dresser": "ড্রেসার",
    "nightstand": "বেডসাইড টেবিল",
    "mattress": "তোশক",
    "sheet": "চাদর",
    "quilt": "কাঁথা",
    "cushion": "কুশন",
    "rug": "কার্পেট",
    "doormat": "দরজার চটাই",
    "washing machine": "ওয়াশিং মেশিন",
    "dryer": "ড্রায়ার",
    "vacuum cleaner": "ভ্যাকুয়াম ক্লিনার",
    "broom": "ঝাড়ু",
    "dustbin": "আবর্জনার ঝুড়ি",
    "trash bag": "আবর্জনার ব্যাগ",
    "recycle bin": "পুনর্ব্যবহারের বাক্স",
    "detergent": "ডিটারজেন্ট",
    "bleach": "ব্লিচ",
    "sponge": "স্পঞ্জ",
    "dish soap": "বাসন ধোয়ার সাবান",
    "dish rack": "বাসনের র্যাক",
    "cutting board": "কাটার বোর্ড",
    "colander": "ছাকা",
    "whisk": "ফুড়া",
    "peeler": "পিলার",
    "measuring cup": "মাপের কাপ",
    "mixing bowl": "মিশ্রণের বাটি",
    "baking tray": "বেকিং ট্রে",
    "oven": "ওভেন",
    "microwave": "মাইক্রোওয়েভ",
    "toaster": "টোস্টার",
    "blender": "ব্লেন্ডার",
    "kettle": "কেটল",
    "rice cooker": "রাইস কুকার",
    "pressure cooker": "প্রেশার কুকার",
    "pan": "প্যান",
    "pot": "হাঁড়ি",
    "wok": "কড়াই",
    "lid": "ঢাকনা",
    "porch": "বারান্দা",
    "yard": "উঠান",
    "gate": "গেট",
    "fence": "বেড়া",
    "mailbox": "মেইলবক্স",
    "doorbell": "দরজার ঘণ্টা",
    "door handle": "দরজার হাতল",
    "lock": "তালা",
    "doorknob": "দরজার হাতল",
    "smoke detector": "ধোঁয়া সেন্সর",
    "fire extinguisher": "অগ্নিনির্বাপক",
    "first aid kit": "প্রাথমিক চিকিৎসা",
    "bandage": "ব্যান্ডেজ",
    "medicine": "ঔষধ",
    "thermometer": "থার্মোমিটার",
    "flashlight": "ফ্ল্যাশলাইট",
    "matchbox": "দিয়াসলাই",
    "lighter": "লাইটার",
    "extension cord": "এক্সটেনশন কোর্ড",
    "plug": "প্লাগ",
    "socket": "সকেট",
    "switch": "সুইচ",
    "bulb": "বাল্ব",
    "chandelier": "ঝাড়বাতি",
    "night light": "রাতের আলো",
    "heater": "হিটার",
    "humidifier": "হিউমিডিফায়ার",
    "dehumidifier": "ডিহিউমিডিফায়ার",
    "air purifier": "বায়ু পরিশোধক",
    "remote control": "রিমোট",
    "speaker": "স্পিকার",
    "radio": "রেডিও",
    "computer": "কম্পিউটার",
    "laptop": "ল্যাপটপ",
    "tablet": "ট্যাবলেট",
    "keyboard": "কীবোর্ড",
    "mouse pad": "মাউস প্যাড",
    "printer": "প্রিন্টার",
    "camera": "ক্যামেরা",
    "tripod": "ট্রাইপড",
    "backpack": "ব্যাকপ্যাক",
    "school bag": "স্কুল ব্যাগ",
    "pencil case": "পেন্সিল বক্স",
    "eraser": "রবার",
    "sharpener": "শার্পনার",
    "ruler": "রুলার",
    "glue": "আঠা",
    "tape": "টেপ",
    "stapler": "স্ট্যাপলার",
    "paper clip": "পেপার ক্লিপ",
    "notebook": "নোটবুক",
    "diary": "ডায়েরি",
    "calendar": "ক্যালেন্ডার",
    "whiteboard": "হোয়াইটবোর্ড",
    "blackboard": "ব্ল্যাকবোর্ড",
    "chalk": "চাল্খ",
    "marker": "মার্কার",
    "crayon": "ক্রেয়ন",
    "paintbrush": "পেন্টব্রাশ",
    "easel": "ইজল",
    "puzzle": "ধাঁধা",
    "board game": "বোর্ড গেম",
    "doll": "পুতুল",
    "teddy bear": "টেডি ভালুক",
    "blocks": "ব্লক",
    "balloon": "বেলুন",
    "party hat": "পার্টি টুপি",
    "gift": "উপহার",
    "card": "কার্ড",
    "envelope": "খাম",
    "stamp": "ডাকটিকিট",
    "photo frame": "ছবির ফ্রেম",
    "vase": "ফুলদানি",
    "plant pot": "গাছের টব",
    "watering can": "পানি ধরার বালতি",
    "garden hose": "বাগানের পাইপ",
    "toolbox": "টুলবক্স",
    "hammer": "হাতুড়ি",
    "screwdriver": "স্ক্রুড্রাইভার",
    "wrench": "রেনচ",
    "nail": "পেরেক",
    "screw": "স্ক্রু",
    "drill": "ড্রিল",
    "ladder": "মই",
    "shovel": "বেলচা",
    "rake": "ঝাুড়ু",
    "wheelbarrow": "ঠেলাগাড়ি",
    # feelings
    "nervous": "উদ্বিগ্ন",
    "stressed": "চাপগ্রস্ত",
    "peaceful": "শান্ত",
    "content": "সন্তুষ্ট",
    "hopeless": "নিরাশ",
    "discouraged": "হতাশ",
    "disappointed": "হতাশ",
    "frustrated": "হতাশ",
    "furious": "রাগান্বিত",
    "rage": "রাগ",
    "mad": "রাগান্ন",
    "refreshed": "সতেজ",
    "generous": "উদার",
    "warm feeling": "উষ্ণ অনুভূতি",
    "safe feeling": "নিরাপদ",
    "insecure": "অসুরক্ষিত",
    "humble": "বিনয়ী",
    "selfish": "স্বার্থপর",
    "caring": "যত্নশীল",
    "romantic": "রোমান্টিক",
    "hostile": "শত্রুতাপূর্ণ",
    "dizzy": "মাথা ঘোরা",
    "faint": "অজ্ঞান",
    "unwell": "অসুস্থ",
    "feverish": "জ্বরযুক্ত",
    "chilly": "ঠান্ডা লাগা",
    "cozy": "আরামদায়ক",
    "uncomfortable": "অস্বস্তিকর",
    "comfortable": "আরামদায়ক",
    "trapped": "আটক",
    "lucky": "ভাগ্যবান",
    "unlucky": "দুর্ভাগ্য",
    "shocked": "হতবাক",
    "amazed": "বিস্মিত",
    "foggy mind": "মন ঘোলাটে",
    "creative": "সৃজনশীল",
    "artistic": "শিল্পপ্রেমী",
    "musical": "সঙ্গীতপ্রেমী",
    # mathematics
    "hexagon": "ষড়ভুজ",
    "pentagon": "পঞ্চভুজ",
    "octagon": "অষ্টভুজ",
    "diamond shape": "হীরক আকৃতি",
    "heart shape": "হৃদ আকৃতি",
    "cross shape": "ক্রস আকৃতি",
    "cube": "ঘনক",
    "corner": "কোণ",
    "side": "পাশ",
    "between": "মাঝে",
    "next to": "পাশে",
    "heavy": "ভারী",
    "empty": "খালি",
    "full amount": "পূর্ণ",
    "sort items": "সাজানো",
    "order items": "ক্রম",
    "estimate": "অনুমান",
    "approximately": "প্রায়",
    "abacus": "গণনা ফ্রেম",
    "calculator": "ক্যালকুলেটার",
    "fraction part": "ভগ্নাংশ",
    "decimal point": "দশমিক",
    "percent": "শতাংশ",
    "ratio": "অনুপাত",
    "proportion": "সমপাত",
    "symmetry": "সমমিতি",
    "grid": "গ্রিড",
    "row": "সারি",
    "column": "স্তম্ভ",
    "collection": "সংগ্রহ",
    "data": "তথ্য",
    "clock time": "সময়",
    "minute hand": "মিনিট",
    "second hand": "সেকেন্ড",
    "timer": "টাইমার",
    "stopwatch": "স্টপওয়াচ",
    "centimeter": "সেন্টিমিটার",
    "meter unit": "মিটার",
    "kilometer": "কিলোমিটার",
    "gram": "গ্রাম",
    "kilogram": "কিলোগ্রাম",
    "liter": "লিটার",
    "cup measure": "কাপ মাপ",
    "spoon measure": "চামচ মাপ",
    "long object": "লম্বা",
    "short object": "ছোট",
    "tall object": "লম্বা",
    "wide object": "প্রশস্ত",
    "narrow object": "সংকীর্ণ",
    "thick object": "মোটা",
    "thin object": "পাতলা",
    "deep": "গভীর",
    "shallow": "অগভীর",
    "close together": "কাছাকাছি",
    "far apart": "দূর দূর",
    "stack blocks": "স্তূপ",
    "balance scale": "তরাজু",
    "math puzzle": "গণিত ধাঁধা",
    "math game": "গণিত খেলা",
    "math class": "গণিত ক্লাস",
    "math homework": "গণিত বাড়ির কাজ",
    "math star": "গণিত তারকা",
}

# Remove any entries that accidentally contain Latin letters
BN_BY_EN = {k: v for k, v in BN_BY_EN.items() if BN_RE.search(v) and not re.search(r"[a-zA-Z]", v)}

# Build category-keyed overrides
BN_OVERRIDES: dict[str, str] = {f"{cat}|{en}": bn for cat in CATS for en, bn in BN_BY_EN.items()}


def head_keys() -> dict[str, set[str]]:
    head: dict[str, set[str]] = {}
    for cat in CATS:
        proc = subprocess.run(
            ["git", "show", f"HEAD:src/data/categories/{cat}.json"],
            capture_output=True, text=True, check=True,
        )
        words = json.loads(proc.stdout)["words"]
        if cat == "mathematics":
            words = [w for w in words if w["en"].lower() not in NUMBER_WORDS]
        head[cat] = {w["en"].lower() for w in words}
    return head


def load_raw_extras() -> dict[str, list[list]]:
    spec = importlib.util.spec_from_file_location("gen", SCRIPTS / "_gen_vocab_extra.py")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    head = head_keys()
    extras: dict[str, list[list]] = {c: [] for c in CATS}
    for cat in CATS:
        for row in mod.VOCAB_DATA[cat]:
            en = row[0].lower()
            if en not in head[cat]:
                extras[cat].append(list(row))
    return extras


def resolve_bn(cat: str, en: str, bn: str) -> str:
    key = f"{cat}|{en.lower()}"
    if key in BN_OVERRIDES:
        return BN_OVERRIDES[key]
    if en.lower() in BN_BY_EN:
        return BN_BY_EN[en.lower()]
    return bn


def build_extras() -> dict[str, list[tuple[str, str, str, str]]]:
    raw = load_raw_extras()
    out: dict[str, list[tuple[str, str, str, str]]] = {}
    for cat in CATS:
        rows: list[tuple[str, str, str, str]] = []
        seen: set[str] = set()
        for row in raw[cat]:
            en = row[0].lower()
            if en in seen:
                continue
            seen.add(en)
            emoji = row[2] if len(row) > 2 else ""
            roman = row[3] if len(row) > 3 else ""
            bn = resolve_bn(cat, en, row[1])
            if not BN_RE.search(bn):
                continue
            rows.append((en, bn, emoji, roman))
        out[cat] = rows
    return out


def emit_curated(extras: dict[str, list[tuple[str, str, str, str]]]) -> str:
    lines = [
        '"""Curated toddler vocabulary extras with native-quality Bangla."""',
        "from __future__ import annotations",
        "",
        "BN_OVERRIDES: dict[str, str] = {",
    ]
    for key in sorted(BN_OVERRIDES):
        lines.append(f"    {key!r}: {BN_OVERRIDES[key]!r},")
    lines.append("}")
    lines.append("")
    lines.append("EXTRAS: dict[str, list[tuple[str, str, str, str]]] = {")
    for cat in CATS:
        lines.append(f'    "{cat}": [')
        for en, bn, emoji, roman in extras[cat]:
            lines.append(f"        ({en!r}, {bn!r}, {emoji!r}, {roman!r}),")
        lines.append("    ],")
    lines.append("}")
    lines.append("")
    return "\n".join(lines)


def main() -> None:
    extras = build_extras()
    print("Counts:", {c: len(v) for c, v in extras.items()})
    print("Total:", sum(len(v) for v in extras.values()))
    out = SCRIPTS / "curated_vocab_extras.py"
    out.write_text(emit_curated(extras), encoding="utf-8")
    print(f"Wrote {out}")


if __name__ == "__main__":
    main()
