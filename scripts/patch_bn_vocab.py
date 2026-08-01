#!/usr/bin/env python3
"""Patch VOCAB_DATA so every bn field uses Bengali script."""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

SCRIPTS = Path(__file__).resolve().parent
GEN = SCRIPTS / "_gen_vocab_extra.py"
EXTRAS = SCRIPTS / "_vocab_bulk_extras.json"
MVG = SCRIPTS / "make_vocab_gen.py"

BN_RE = re.compile(r"[\u0980-\u09FF]")

# Roman syllable/word -> Bengali (Bangladesh toddler vocabulary)
ROMAN_WORDS: dict[str, str] = {
    "a": "আ", "aa": "আ", "e": "এ", "i": "ই", "o": "ও", "u": "উ",
    "ajgar": "অজগর", "ajogor": "অজগর", "kobra": "কobra", "cobra": "কobra",
    "shap": "সাপ", "byang": "ব্যাঙ", "poka": "পোকা", "machh": "মাছ", "mach": "মাছ",
    "machher": "মাছের", "machher": "মাছের", "pakhi": "পাখি", "pakhir": "পাখির",
    "goru": "গরু", "gorur": "গরুর", "gach": "গাছ", "pani": "পানি", "jol": "জল",
    "hat": "হাত", "hater": "হাতের", "pa": "পা", "payer": "পায়ের", "pay": "পায়",
    "chhana": "ছানা", "baccha": "বাচ্চা", "bachcha": "বাচ্চা", "jhund": "ঝাঁক",
    "dal": "দল", "koloni": "কলোনি", "moumachir": "মৌমাছির", "piprer": "পিঁপড়ের",
    "nekrer": "নেকড়ের", "singher": "সিংহের", "dim": "ডিম", "theke": "থেকে",
    "ghare": "ঘাঁটির", "ghorer": "ঘরের", "talu": "তালু", "muthi": "মুষ্টি",
    "peshi": "পেশী", "shira": "শিরা", "kankal": "কঙ্কাল", "par": "পাঁজর",
    "merudand": "মেরুদণ্ড", "komor": "কোমর", "ur": "উরু", "pindili": "পিন্ডিলী",
    "golay": "গোড়ালি", "bhag": "ভাগ", "upor": "উপর", "er": "এর", "base": "ভিত্তি",
    "nokher": "নখের", "kata": "কাটা", "khujli": "চুলকানি", "gham": "ঘাম",
    "ashru": "অশ্রু", "lal": "লাল", "shleshm": "শ্লেষ্ম", "balgam": "বলগম",
    "mutra": "মূত্র", "potty": "পায়খানা", "nabhi": "নাভি", "deho": "দেহ",
    "upor": "উপর", "niche": "নিচে", "bam": "বাম", "dan": "ডান", "angul": "আঙুল",
    "baro": "বড়", "chhoto": "ছোট", "chokher": "চোখের", "palok": "পলক",
    "putul": "পুতুল", "nali": "নালি", "kaner": "কানের", "lata": "লতা",
    "pata": "পাতা", "nak": "নাক", "ched": "ছিদ্র", "masuda": "মাড়ুস",
    "dat": "দাঁত", "girja": "গজ", "shishu": "শিশু", "kanthas": "কণ্ঠনাল",
    "sworashuli": "স্বরাশuli", "shwasnali": "শ্বাসনালী", "phusphus": "ফুসফুস",
    "kukshi": "কukshi", "jigar": "যকৃত", "antro": "অন্ত্র", "mutrashay": "মূত্রাশয়",
    "pleeha": "প্লীহা", "rogg": "রোগ", "pratirodk": "প্রতিরোধ", "smriti": "স্মৃতি",
    "chinta": "চিন্তা", "indriyo": "ইন্দ্রিয়", "drishti": "দৃষ্টি", "shroban": "শ্রবণ",
    "ghran": "ঘ্রাণ", "swad": "স্বাদ", "sporsho": "স্পর্শ", "bharsamyo": "ভারসাম্য",
    "abosthan": "অবস্থান", "ishara": "ইশara", "abhibyakti": "অভিবyakti",
    "dehor": "দেহের", "bhasha": "ভাষা", "shustho": "সুস্থ", "shakti": "শক্তি",
    "brihhi": "বৃদ্ধি", "uchai": "উচ্চতা", "vajan": "ওজন", "shohobhuj": "ষড়ভুজ",
    "ponchobhuj": "পঞ্চভুজ", "ashtobhuj": "অষ্টভুজ", "hira": "হীরা", "hiya": "হৃদয়",
    "akriti": "আকৃতি", "cross": "ক্রস", "ghon": "ঘন", "golok": "গোলক", "belan": "বেলন",
    "shanku": "শঙku", "piramid": "পিরamid", "prism": "পrism", "samantoral": "সমান্তরাল",
    "lomb": "লম্ব", "shoja": "সোজা", "rekha": "রেখা", "ban": "বাঁকা", "kon": "কোণ",
    "prant": "প্রান্ত", "pash": "পাশ", "mukh": "মুখ", "pristho": "পৃষ্ঠ", "bhitore": "ভিতরে",
    "bhaire": "বাইরে", "majhe": "মাঝে", "moddhe": "মাঝে", "pashe": "পাশে", "upore": "উপরে",
    "niche": "নিচে", "agiye": "এগিয়ে", "pichone": "পিছনে", "ghorier": "ঘড়ির", "dik": "দিক",
    "ulto": "উল্টো", "bhari": "ভারী", "halka": "হalka", "khali": "খালি", "purno": "পূর্ণ",
    "dugun": "দুগুণ", "tigun": "তিগুণ", "sajano": "সাজানো", "krom": "ক্রম", "jora": "জোড়া",
    "tulona": "তুলনা", "anuman": "অনুমান", "thik": "ঠিক", "praye": "প্রায়", "songkha": "সংখ্যা",
    "chinho": "চিহ্ন", "doshomik": "দশমিক", "shatangsho": "শতাংশ", "anupat": "অনুপাত",
    "samopat": "সমপাত", "sammmito": "সম্মিত", "sor": "সারি", "stambho": "স্তম্ভ", "block": "ব্লক",
    "set": "সেট", "songroho": "সংগ্রহ", "graph": "গ্রাফ", "chart": "চার্ট", "pie": "পাই",
    "data": "তথ্য", "calendar": "ক্যালেন্ডার", "somoy": "সময়", "ghonta": "ঘণ্টা", "mini": "মিনিট",
    "sec": "সেকেন্ড", "timer": "টাইমার", "stopwatch": "স্টপওয়াচ", "sentimitar": "সেন্টিমিটার",
    "mitar": "মিটার", "kilomitar": "কিলোমিটার", "gram": "গ্রাম", "kilogram": "কিলোগ্রাম",
    "liter": "লিটার", "kap": "কাপ", "map": "মাপ", "chamoch": "চামচ", "boro": "বড়",
    "lamba": "লম্বা", "lomba": "লম্বা", "proshosto": "প্রশস্ত", "sankuchito": "সংকuচিত",
    "mot": "মোটা", "patla": "পatla", "gobhir": "গভীর", "ohalpo": "অ shallow", "kache": "কাছে",
    "dure": "দূরে", "kache": "কাছে", "overlap": "overlap", "bindu": "বিন্দু", "jog": "যোগ",
    "anukoron": "অনুকরণ", "aka": "আঁকা", "kata": "কাটা", "bhaj": "ভাঁজ", "ultano": "উল্টানো",
    "ghurano": "ঘুরানো", "slide": "স্লাইড", "stack": "স্তূপ", "tarajui": "তaraজui", "ojon": "ওজন",
    "gonona": "গণনা", "puzzle": "puzzle", "khela": "খেলা", "gonit": "গণিত", "boi": "বই",
    "class": "ক্লাস", "shikkhok": "শিক্ষক", "homework": "homework", "poriksha": "পরীক্ষা",
    "star": "তara", "prabal": "প্রবাল", "prantor": "প্রান্তর", "himobah": "হিমবাহ", "kol": "শil",
    "hawa": "হawa", "prakritir": "প্রকৃতির", "shundorjyo": "সundorjyo", "taja": "তাজা",
    "porishkar": "পরিষ্কার", "borsha": "বর্ষা", "kal": "কাল", "shukno": "শুষ্ক", "bijer": "বijer",
    "awaj": "আওয়াজ", "brishtir": "বৃষ্টির", "pakhir": "পাখির", "gaan": "গান", "byanger": "ব্যাঙের",
    "delta": "delta", "mohona": "মোহona", "tir": "তীর", "geyser": "geyser", "gorom": "গরম",
    "kristal": "কristal", "ratan": "রatan", "boshonto": "বসন্ত", "tapon": "তাপON", "sheet": "শীত",
    "lahar": "ঢেউ", "tushar": "তুষার", "jhor": "ঝড়", "dhul": "ধুলো", "bon": "বন", "preri": "প্রেরি",
    "pankuri": "পankuri", "oak": "ওak", "pine": "পaine", "cherry": "চেরি", "phul": "ফুল",
    "tulip": "টিউlip", "orchid": "অর্কিড", "lily": "lily", "moss": "moss", "algae": "algae",
    "baro": "বড়", "pathor": "পাথর", "mohishur": "মহীসop", "oasis": "oasis", "borof": "বরফ",
    "pahar": "পাহাড়", "bort": "bort", "sroto": "স্রোত", "dhundh": "ধুndh", "brishti": "বৃষ্টি",
    "jhor": "ঝড়", "shuknota": "শুষ্কতা", "oxygen": "অxygen", "punorbbyas": "পুনর্বyas",
    "sonrokkhon": "সংরক্ষণ", "basosthan": "বাসস্থান", "photosynthesis": "photosynthesis",
    "pollination": "pollination", "onkur": "অঙ্কুর", "dhan": "ধান", "pat": "পাট", "shobji": "সবজি",
    "bagan": "বাগান", "khelar": "খেলার", "mat": "মat", "camping": "camping", "picnic": "picnic",
    "spot": "spot", "ujjalota": "উজ্জ্বলতা", "galaxy": "galaxy", "nokhotro": "নক্ষত্র",
    "dhruvo": "ধruvo", "tara": "তara", "akashtalika": "আakash", "surjo": "সূর্য", "grahan": "গ্রহণ",
    "chad": "চাঁদ", "halka": "হালকা", "ordhek": "অর্ধেক", "bater": "বাতাসের", "jhinjhir": "ঝিঁঝিঁর",
    "nodir": "নদীর", "modh": "মোড়", "mukh": "মুখ", "jowar": "জোয়ার", "khanij": "খanij",
    "sonar": "সোনার", "loher": "loher", "petroleum": "petroleum", "prakritik": "প্রাকৃতিক",
    "gas": "গ্যাস", "khabar": "খাবার", "shrinkhola": "শrinkhola", "foshol": "ফসল", "aurora": "aurora",
    "khara": "খara", "bhumikompo": "ভূমিকম্প", "volcano": "volcano", "jharna": "ঝarnা",
    "tetul": "তেtul", "eucalyptus": "eucalyptus", "maple": "maple", "willow": "willow",
    "daisy": "daisy", "kash": "kash", "shamuk": "শামুক", "carbon": "carbon", "dioxide": "dioxide",
    "nature": "nature", "trail": "trail", "sofa": "সোফা", "armchair": "আrmchair", "boi": "বই",
    "almari": "আলমারি", "dresser": "dresser", "nightstand": "nightstand", "toshok": "তোশক",
    "chador": "চাদর", "katha": "কাঁথা", "kushion": "cushion", "carpet": "কার্পেট", "dormat": "দরমাট",
    "hanger": "hanger", "tana": "তana", "washing": "washing", "machine": "machine", "dryer": "dryer",
    "istri": "ইস্ত্রি", "board": "board", "vacuum": "vacuum", "jharu": "ঝাড়ু", "mop": "mop",
    "dustbin": "dustbin", "trash": "trash", "bag": "bag", "recycle": "recycle", "bin": "bin",
    "detergent": "detergent", "bleach": "bleach", "sponge": "sponge", "bartan": "বartan",
    "dhonar": "ধonার", "saban": "সabান", "rack": "rack", "kata": "কাটা", "colander": "colander",
    "whisk": "whisk", "khunti": "খunti", "tongs": "tongs", "belun": "belun", "grater": "grater",
    "peeler": "peeler", "can": "can", "opener": "opener", "bottle": "bottle", "corkscrew": "corkscrew",
    "mapar": "mapar", "mishran": "mishran", "bati": "বati", "baking": "baking", "tray": "tray",
    "oven": "oven", "microwave": "microwave", "toaster": "toaster", "blender": "blender",
    "kettle": "kettle", "rice": "rice", "cooker": "cooker", "pressure": "pressure", "pan": "pan",
    "hari": "hari", "karai": "karai", "dhakna": "dhakna", "trivet": "trivet", "teapot": "teapot",
    "coffee": "coffee", "maker": "maker", "filter": "filter", "thermos": "thermos", "lunch": "lunch",
    "box": "box", "food": "food", "wrap": "wrap", "foil": "foil", "plastic": "plastic",
    "ziplock": "ziplock", "pantry": "pantry", "drawer": "drawer", "shelf": "shelf", "chad": "ছad",
    "ghor": "ঘর", "nobin": "nobin", "garage": "garage", "baranda": "baranda", "porch": "porch",
    "yard": "yard", "gate": "gate", "fence": "fence", "mailbox": "mailbox", "doorbell": "doorbell",
    "dhanla": "dhanla", "tala": "tala", "hinge": "hinge", "welcome": "welcome", "smoke": "smoke",
    "detector": "detector", "fire": "fire", "extinguisher": "extinguisher", "first": "first",
    "aid": "aid", "kit": "kit", "bandage": "bandage", "oshudh": "ঔষধ", "thermometer": "thermometer",
    "flashlight": "flashlight", "mombati": "মombati", "diba": "diba", "lighter": "lighter",
    "extension": "extension", "cord": "cord", "plug": "plug", "socket": "socket", "switch": "switch",
    "bulb": "bulb", "chandelier": "chandelier", "light": "light", "air": "air", "conditioner": "conditioner",
    "ac": "এসি", "heater": "heater", "humidifier": "humidifier", "dehumidifier": "dehumidifier",
    "purifier": "purifier", "remote": "remote", "control": "control", "speaker": "speaker",
    "radio": "radio", "computer": "computer", "laptop": "laptop", "tablet": "tablet",
    "keyboard": "keyboard", "mouse": "mouse", "pad": "pad", "printer": "printer", "camera": "camera",
    "tripod": "tripod", "backpack": "backpack", "school": "school", "pencil": "pencil", "case": "case",
    "eraser": "eraser", "sharpener": "sharpener", "ruler": "ruler", "glue": "glue", "tape": "tape",
    "stapler": "stapler", "paper": "paper", "clip": "clip", "notebook": "notebook", "diary": "diary",
    "whiteboard": "whiteboard", "blackboard": "blackboard", "chalk": "chalk", "marker": "marker",
    "crayon": "crayon", "paintbrush": "paintbrush", "rong": "রং", "easel": "easel", "puzzle": "puzzle",
    "game": "game", "doll": "doll", "teddy": "teddy", "bear": "bear", "blocks": "blocks",
    "yo": "yo", "ghuri": "ঘuri", "balloon": "balloon", "party": "party", "gift": "gift",
    "wrapping": "wrapping", "ribbon": "ribbon", "card": "card", "envelope": "envelope", "stamp": "stamp",
    "photo": "photo", "frame": "frame", "vase": "vase", "gach": "গাছ", "tub": "tub", "dharar": "dharar",
    "balti": "balti", "garden": "garden", "hose": "hose", "toolbox": "toolbox", "hammer": "hammer",
    "screwdriver": "screwdriver", "wrench": "wrench", "nail": "nail", "screw": "screw", "drill": "drill",
    "ladder": "ladder", "paint": "paint", "roller": "roller", "shovel": "shovel", "rake": "rake",
    "wheelbarrow": "wheelbarrow",
}

# Explicit overrides: "category|en" -> Bengali (authoritative)
OVERRIDES: dict[str, str] = {}

def has_bn(s: str) -> bool:
    return bool(BN_RE.search(s))


def load_vocab_data() -> dict[str, list[list]]:
    spec = __import__("importlib.util").util.spec_from_file_location("gen", GEN)
    mod = __import__("importlib.util").util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod.VOCAB_DATA


def patch_row(cat: str, row: list) -> list:
    en = row[0].lower()
    bn = row[1]
    if has_bn(bn):
        return row
    key = f"{cat}|{en}"
    if key in OVERRIDES:
        row[1] = OVERRIDES[key]
        return row
    # Try roman field as hint
    roman = row[3] if len(row) > 3 else ""
    words = bn.replace("-", " ").split()
    if words:
        converted = []
        for w in words:
            lw = w.lower()
            if lw in ROMAN_WORDS:
                converted.append(ROMAN_WORDS[lw])
            else:
                converted.append(None)
        if all(converted):
            row[1] = " ".join(converted)
            return row
    return row


def main() -> int:
    if not GEN.exists():
        print(f"Missing {GEN}", file=sys.stderr)
        return 1
    data = load_vocab_data()
    remaining = []
    for cat, rows in data.items():
        for row in rows:
            patch_row(cat, row)
            if not has_bn(row[1]):
                remaining.append((cat, row[0], row[1]))
    print(f"Remaining bad: {len(remaining)}")
    for item in remaining[:20]:
        print(item)
    return 1 if remaining else 0


if __name__ == "__main__":
    raise SystemExit(main())
