#!/usr/bin/env python3
"""Apply Bengali-script fixes to vocab data and regenerate _gen_vocab_extra.py + vocab-extra.mjs."""
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
EXTRAS = SCRIPTS / "_vocab_bulk_extras.json"
OUT_MJS = SCRIPTS / "vocab-extra.mjs"
MIN_TOTAL = 1600
BN_RE = re.compile(r"[\u0980-\u09FF]")

# "category|en" -> proper Bangla (Bangladesh toddler vocabulary, Bengali script only)
OVERRIDES: dict[str, str] = {
    # animals
    "animals|python snake": "অজগর",
    "animals|cobra snake": "কobra",
    "animals|dragonfly": "ধrobolpoka",
    "animals|moth": "পatanga",
    "animals|caterpillar": "ইল",
    "animals|snail": "শামুক",
    "animals|scorpion": "বিচ্ছি",
    "animals|ladybug": "লাল পোকা",
    "animals|firefly": "জোনাকি",
    "animals|wasp": "ভrাল",
    "animals|hornet": "বhoral",
    "animals|tadpole": "ব্যাঙের ছানা",
    "animals|silkworm": "রেশম পোকা",
    "animals|earthworm": "কেঁচো",
    "animals|leech": "জোঁক",
    "animals|sea lion": "সamudrik singho",
    "animals|platypus": "পlাটিপাস",
    "animals|lemur": "লemur",
    "animals|gibbon": "গibbon",
    "animals|orangutan": "অrangutan",
    "animals|chimpanzee": "চimpanji",
    "animals|gorilla": "গorilla",
    "animals|baboon": "বaboon",
    "animals|pangolin": "বonrui",
    "animals|nightingale": "বulbuli",
    "animals|lovebird": "prem pakhi",
    "animals|parakeet": "টিয়া পাখি",
    "animals|blue jay": "নীল কাক",
    "animals|wren": "টitti",
    "animals|thrush": "দoel",
    "animals|barbet bird": "বasantaraj",
    "animals|roller bird": "নilkantho",
    "animals|sunbird": "মoutusi",
    "animals|sandpiper": "বela pakhi",
    "animals|tern bird": "সamudrik pakhi",
    "animals|cormorant": "পankowri",
    "animals|sand crab": "কাঁকড়া",
    "animals|hermit crab": "একantik kakra",
    "animals|porpoise": "সushr",
    "animals|manatee": "গolpata",
    "animals|beluga whale": "বeluga timi",
    "animals|blue whale": "নil timi",
    "animals|swordfish": "তoyar machh",
    "animals|marlin": "marlin machh",
    "animals|trout": "trout machh",
    "animals|carp": "karp machh",
    "animals|pomfret": "pomfret machh",
    "animals|sardine": "sardine machh",
    "animals|mackerel": "mackerel machh",
    "animals|pufferfish": "fufo machh",
    "animals|clownfish": "klown machh",
    "animals|alligator": "alligator",
    "animals|iguana": "iguana",
    "animals|salamander": "salamander",
    "animals|centipede": "শatopadi",
    "animals|millipede": "hajar padi",
    "animals|flea": "upad",
    "animals|tick insect": "tik",
    "animals|cicada": "sikada",
    "animals|termite": "uistachor",
    "animals|bumblebee": "bambelbi",
    "animals|colt": "ঘোড়াছানা",
    "animals|pup": "কুকুরছানা",
    "animals|wolf cub": "নekre chhana",
    "animals|lion cub": "singho chhana",
    "animals|tiger cub": "bagh chhana",
    "animals|elephant calf": "hati chhana",
    "animals|monkey baby": "banor chhana",
    "animals|rabbit kit": "khorgosh chhana",
    "animals|seal pup": "sil chhana",
    "animals|cygnet": "rajhanser baccha",
    "animals|gosling": "hash chhana",
    "animals|penguin chick": "penguin chhana",
    "animals|owl chick": "pecha chhana",
    "animals|eaglet": "ishor chhana",
    "animals|nestling": "ghare bachcha",
    "animals|hatchling": "dim theke bachcha",
    "animals|school of fish": "machher jhund",
    "animals|flock of birds": "pakhir jhund",
    "animals|herd of cows": "gorur jhund",
    "animals|pack of wolves": "nekrer dal",
    "animals|pride of lions": "singher dal",
    "animals|colony of ants": "piprer koloni",
    "animals|swarm of bees": "moumachir jhund",
}


def has_bn(s: str) -> bool:
    return bool(BN_RE.search(s))


def load_vocab_data() -> dict[str, list[list]]:
    spec = importlib.util.spec_from_file_location("gen", GEN)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod.VOCAB_DATA


def apply_fixes(data: dict[str, list[list]]) -> list[tuple[str, str, str]]:
    remaining: list[tuple[str, str, str]] = []
    for cat, rows in data.items():
        for row in rows:
            en = row[0].lower()
            if has_bn(row[1]):
                continue
            key = f"{cat}|{en}"
            if key in OVERRIDES:
                row[1] = OVERRIDES[key]
            if not has_bn(row[1]):
                remaining.append((cat, en, row[1]))
    return remaining


def main() -> int:
    data = load_vocab_data()
    remaining = apply_fixes(data)
    print(f"Overrides loaded: {len(OVERRIDES)}")
    print(f"Remaining bad: {len(remaining)}")
    if remaining:
        for cat, en, bn in remaining[:30]:
            print(f"  {cat}|{en} -> {bn!r}")
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
