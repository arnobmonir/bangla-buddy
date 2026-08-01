#!/usr/bin/env python3
"""Build complete bn_overrides_complete.json and apply to vocab generator."""
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
BAD_JSON = SCRIPTS / "_bad_bn.json"
OVERRIDES_JSON = SCRIPTS / "bn_overrides_complete.json"
CAT_DIR = ROOT / "src/data/categories"
MIN_TOTAL = 1600

BN_RE = re.compile(r"[\u0980-\u09FF]")
LATIN = re.compile(r"[a-zA-Z]")

# Consonant graphemes (longest match first)
_CONS = [
    ("ng", "\u0999"), ("chh", "\u099b"), ("ch", "\u099a"), ("kh", "\u0996"),
    ("gh", "\u0998"), ("jh", "\u099d"), ("th", "\u09a5"), ("dh", "\u09a7"),
    ("bh", "\u09ad"), ("ph", "\u09ab"), ("sh", "\u09b6"), ("rr", "\u09dc"),
    ("tt", "\u099f"), ("dd", "\u09dc"), ("nn", "\u09a3"),
    ("k", "\u0995"), ("g", "\u0997"), ("c", "\u099a"), ("j", "\u099c"),
    ("t", "\u09a4"), ("d", "\u09a6"), ("n", "\u09a8"), ("p", "\u09aa"),
    ("b", "\u09ac"), ("m", "\u09ae"), ("y", "\u09af"), ("r", "\u09b0"),
    ("l", "\u09b2"), ("s", "\u09b8"), ("h", "\u09b9"), ("f", "\u09ab"),
    ("v", "\u09ad"), ("w", "\u09ac"), ("z", "\u099c"), ("x", "\u0995\u09cd\u09b8"),
    ("q", "\u0995"),
]

# Vowel signs (after consonant)
_VS = [
    ("aa", "\u09be"), ("ii", "\u09c0"), ("ee", "\u09c0"), ("oo", "\u09c1"),
    ("uu", "\u09c2"), ("ou", "\u09cc"), ("oi", "\u09c8"), ("e", "\u09c7"),
    ("o", "\u09cb"), ("i", "\u09bf"), ("u", "\u09c1"), ("a", ""),
]

# Independent vowels (word-initial)
_IV = [
    ("aa", "\u0986"), ("ii", "\u0988"), ("ee", "\u0988"), ("oo", "\u0989"),
    ("uu", "\u098a"), ("ou", "\u0994"), ("oi", "\u0990"), ("e", "\u098f"),
    ("o", "\u0993"), ("i", "\u0987"), ("u", "\u0989"), ("a", "\u0985"),
]

# Words that don't follow simple rules — authoritative roman -> Bengali
EXTRA_WORDS: dict[str, str] = {
    "ajgar": "\u0985\u099c\u0997\u09b0", "ajogor": "\u0985\u099c\u0997\u09b0",
    "kobra": "\u0995\u09cb\u09ac\u09cd\u09b0\u09be", "cobra": "\u0995\u09cb\u09ac\u09cd\u09b0\u09be",
    "shamuk": "\u09b6\u09be\u09ae\u09c1\u0995", "bichhi": "\u09ac\u09bf\u099a\u09cd\u099b\u09bf",
    "jonaki": "\u099c\u09cb\u09a8\u09be\u0995\u09bf", "bhoral": "\u09ad\u09cb\u09b0\u09be\u09b2",
    "kencho": "\u0995\u09c7\u09c1\u09bc\u099a\u09cb", "krmo": "\u0995\u09c7\u09c1\u09bc\u099a\u09cb",
    "jok": "\u099c\u09cb\u09c1\u09bc", "resham": "\u09b0\u09c7\u09b6\u09ae", "poka": "\u09aa\u09cb\u0995\u09be",
    "prem": "\u09aa\u09cd\u09b0\u09c7\u09ae", "pakhi": "\u09aa\u09be\u0996\u09bf", "nil": "\u09a8\u09c0\u09b2",
    "kak": "\u0995\u09be\u0995", "titti": "\u099f\u09bf\u099f\u099f\u09bf", "doel": "\u09a6\u09cb\u09af\u09bc\u09be\u09b2",
    "bulbuli": "\u09ac\u09c1\u09b2\u09ac\u09c1\u09b2\u09bf", "bonrui": "\u09ac\u09a8\u09cd\u09b0\u09c1\u0987",
    "machh": "\u09ae\u09be\u099b", "mach": "\u09ae\u09be\u099b", "machher": "\u09ae\u09be\u099b\u09c7\u09b0",
    "timi": "\u09a4\u09bf\u09ae\u09bf", "singho": "\u09b8\u09bf\u09c2\u09b9", "chhana": "\u099b\u09be\u09a8\u09be",
    "baccha": "\u09ac\u09be\u099a\u09cd\u099a\u09be", "bachcha": "\u09ac\u09be\u099a\u09cd\u099a\u09be",
    "jhund": "\u099d\u09be\u09c1\u09dc", "dal": "\u09a6\u09b2", "koloni": "\u0995\u09b2\u09cb\u09a8\u09bf",
    "goru": "\u0997\u09b0\u09c1", "gorur": "\u0997\u09b0\u09c1\u09b0", "nekrer": "\u09a8\u09c7\u0995\u09dc\u09c7\u09b0",
    "singher": "\u09b8\u09bf\u09c2\u09b9\u09c7\u09b0", "piprer": "\u09aa\u09bf\u09c1\u09bc\u09a1\u09bc\u09be\u09b0",
    "moumachir": "\u09ae\u09cc\u09ae\u09be\u099b\u09bf\u09b0", "dim": "\u09a1\u09bf\u09ae", "theke": "\u09a5\u09c7\u0995\u09c7",
    "ghare": "\u0998\u09be\u09a1\u09bc\u09bf\u09b0", "byang": "\u09ac\u09cd\u09af\u09be\u09a6\u09cd\u09af\u09be\u09b0",
    "byanger": "\u09ac\u09cd\u09af\u09be\u09a6\u09cd\u09af\u09be\u09b0\u09c7\u09b0", "bagh": "\u09ac\u09be\u09b9",
    "hati": "\u09b9\u09be\u09a4\u09bf", "banor": "\u09ac\u09be\u09a8\u09b0", "khorgosh": "\u0996\u09b0\u09a7\u09cb\u09b6",
    "kukur": "\u0995\u09c1\u0995\u09bc\u09c1\u09b0", "hash": "\u09b9\u09be\u09c1\u09b8", "pecha": "\u09aa\u09c7\u09c1\u09bc\u09be",
    "tiya": "\u099f\u09bf\u09af\u09bc\u09be", "kakra": "\u0995\u09be\u0995\u09dc\u09be", "samudrik": "\u09b8\u09be\u09ae\u09c1\u09a6\u09cd\u09b0\u09bf\u0995",
    "ghora": "\u0998\u09cb\u09c1\u09bc\u09be", "ghorachhana": "\u0998\u09cb\u09c1\u09bc\u09be\u099b\u09be\u09a8\u09be",
    "kukurchhana": "\u0995\u09c1\u0995\u09bc\u09c1\u09b0\u099b\u09be\u09a8\u09be", "nekre": "\u09a8\u09c7\u0995\u09dc\u09c7",
    "rajhanser": "\u09b0\u09be\u099c\u09b9\u09be\u09b8\u09c7\u09b0", "ishor": "\u0987\u09a7\u09bf\u09b0\u09be\u099c",
    "sil": "\u0998\u09c7\u09b2\u09be\u09ab\u09c7\u09b0", "penguin": "\u09aa\u09c7\u09c7\u09c1\u09bc\u09a8",
    "basantaraj": "\u09ac\u09b8\u09a8\u09cd\u09a4\u09be\u09b0\u09be\u099c", "nilkantho": "\u09a8\u09c0\u09b2\u0995\u09a8\u09cd\u09a0",
    "moutusi": "\u09ae\u09cc\u09a4\u09c1\u09b8\u09bf", "bela": "\u09ac\u09c7\u09b2\u09be", "pankowri": "\u09aa\u09be\u09a8\u09c7\u0995\u09cb\u09dc\u09c0",
    "shatopadi": "\u09b6\u09a4\u09aa\u09be\u09a6\u09c0", "hajar": "\u09b9\u09be\u099c\u09be\u09b0", "padi": "\u09aa\u09be\u09a6\u09c0",
    "upad": "\u0989\u09aa\u09be\u09a6", "tik": "\u099f\u09bf\u0995", "sikada": "\u09b6\u09c7\u09b9\u09b0\u09be",
    "uistachor": "\u0989\u0987\u09a1\u09bc\u09be\u099b\u09a4\u09cd\u09b0\u09c0", "bambelbi": "\u09ac\u09be\u09ae\u09cd\u09ac\u09b2\u09ac\u09bf",
    "hermit": "\u098f\u0995\u09be\u09a8\u09cd\u09a4", "toyar": "\u09a4\u09cb\u09af\u09bc\u09be\u09b0",
    "fufo": "\u09ab\u09c1\u09aa\u09cb", "klown": "\u0995\u09cd\u09b2\u09cc\u09a8", "karp": "\u0995\u09be\u09b0\u09cd\u09aa",
    "marlin": "\u09ae\u09be\u09b0\u09cd\u09b2\u09bf\u09a8", "trout": "\u099f\u09cd\u09b0\u09be\u0989\u099f",
    "pomfret": "\u09aa\u09ae\u09cd\u09ab\u09cd\u09b0\u09c7\u099f", "sardine": "\u09b8\u09be\u09b0\u09cd\u09a1\u09bf\u09a8",
    "mackerel": "\u09ae\u09cd\u09af\u09be\u0995\u09b0\u09c7\u09b2", "beluga": "\u09ac\u09c7\u09b2\u09c1\u0997\u09be",
    "si": "\u09b8\u09bf", "layon": "\u09b2\u09be\u09af\u09bc\u09b8\u09b8", "platipus": "\u09aa\u09cd\u09b2\u09cd\u09af\u09be\u099f\u09bf\u09aa\u09be\u09b8",
    "chimpanji": "\u09b6\u09bf\u09ae\u09cd\u09aa\u09be\u09b9\u09cd\u09af\u09bc\u09be\u09b0", "gorila": "\u09a7\u09c2\u09ac\u09b0\u09cd",
    "babun": "\u09ac\u09ac\u09c1\u09a8", "dragonfly": "\u09a7\u09cd\u09b0\u09cb\u09ac\u09b2\u09aa\u09cb\u0995\u09be",
    "moth": "\u09aa\u09a4\u09be\u0999\u09cd\u0997\u09be", "caterpillar": "\u0987\u09b2", "tadpole": "\u09ac\u09cd\u09af\u09be\u09a4\u09cd\u09af\u09be\u09b0 \u099b\u09be\u09a8\u09be",
    "guruhipokkh": "\u09a8\u09c7\u09a8\u09c7 \u09aa\u09cb\u0995\u09be", "ladybug": "\u09a8\u09c7\u09a8\u09c7 \u09aa\u09cb\u0995\u09be",
    "alligator": "\u0986\u09b2\u09bf\u0997\u09c7\u099f\u09b0", "iguana": "\u0987\u0997\u09c1\u09f1\u09be\u09b8",
    "salamander": "\u09b8\u09cd\u09af\u09be\u09b2\u09be\u09ae\u09cd\u09af\u09be\u09a8\u09cd\u09a1\u09be\u09b0",
    "lemur": "\u09b2\u09bf\u09ae\u09c1\u09b0", "gibbon": "\u099c\u09bf\u09ac\u09c7\u09a8", "orangutan": "\u0985\u09b0\u09c7\u099e\u09cd\u099c\u09c1\u099f\u09be\u09a8",
    "porpoise": "\u09aa\u09cb\u09b0\u09cd\u09aa\u09cb\u09bf\u09b8", "porpois": "\u09aa\u09cb\u09b0\u09cd\u09aa\u09cb\u09bf\u09b8",
    "manatee": "\u09ae\u09be\u09a8\u09be\u099f\u09bf", "manati": "\u09ae\u09be\u09a8\u09be\u099f\u09bf",
    "centipede": "\u09b6\u09a4\u09aa\u09be\u09a6\u09c0", "millipede": "\u09b9\u09be\u099c\u09be\u09b0 \u09aa\u09be\u09a6\u09c0",
    "flea": "\u0989\u09aa\u09be\u09a6", "cicada": "\u09b6\u09c7\u09b9\u09b0\u09be", "termite": "\u0989\u0987\u09a1\u09bc\u09be\u099b\u09a4\u09cd\u09b0\u09c0",
    "bumblebee": "\u09ac\u09be\u09ae\u09cd\u09ac\u09b2\u09ac\u09bf", "platypus": "\u09aa\u09cd\u09b2\u09cd\u09af\u09be\u099f\u09bf\u09aa\u09be\u09b8",
    "gorilla": "\u09a7\u09c2\u09ac\u09b0\u09cd", "baboon": "\u09ac\u09ac\u09c1\u09a8", "chimpanzee": "\u09b6\u09bf\u09ae\u09cd\u09aa\u09be\u09b9\u09cd\u09af\u09bc\u09be\u09b0",
    "nightingale": "\u09ac\u09c1\u09b2\u09ac\u09c1\u09b2\u09bf", "lovebird": "\u09aa\u09cd\u09b0\u09c7\u09ae \u09aa\u09be\u0996\u09bf",
    "parakeet": "\u099f\u09bf\u09af\u09bc\u09be \u09aa\u09be\u0996\u09bf", "wren": "\u099f\u09bf\u099f\u099f\u09bf",
    "thrush": "\u09a6\u09cb\u09af\u09bc\u09be\u09b2", "sunbird": "\u09ae\u09cc\u09a4\u09c1\u09b8\u09bf",
    "sandpiper": "\u09ac\u09c7\u09b2\u09be \u09aa\u09be\u0996\u09bf", "tern": "\u09b8\u09be\u09ae\u09c1\u09a6\u09cd\u09b0\u09bf\u0995 \u09aa\u09be\u0996\u09bf",
    "cormorant": "\u09aa\u09be\u09a8\u09c7\u0995\u09cb\u09dc\u09c0", "sand": "\u09ac\u09c7\u09b2\u09be\u09c7\u09b0",
    "crab": "\u0995\u09be\u0995\u09dc\u09be", "blue": "\u09a8\u09c0\u09b2", "jay": "\u0995\u09be\u09c7",
    "whale": "\u09a4\u09bf\u09ae\u09bf", "swordfish": "\u09a4\u09cb\u09af\u09bc\u09be\u09b0 \u09ae\u09be\u099b",
    "pufferfish": "\u09ab\u09c1\u09aa\u09cb \u09ae\u09be\u099b", "clownfish": "\u09ae\u09be\u09a7\u09cd\u09af\u09ae \u09ae\u09be\u099b",
    "barbet": "\u09ac\u09b8\u09a8\u09cd\u09a4\u09be\u09b0\u09be\u099c", "roller": "\u09a8\u09c0\u09b2\u0995\u09a8\u09cd\u09a0",
    "bird": "\u09aa\u09be\u0996\u09bf", "snake": "\u09b8\u09be\u09aa", "python": "\u0985\u099c\u0997\u09b0",
    "sea": "\u09b8\u09be\u09ae\u09c1\u09a6\u09cd\u09b0", "lion": "\u09b8\u09bf\u09c2\u09b9",
    "colt": "\u0998\u09cb\u09c1\u09bc\u09be\u099b\u09be\u09a8\u09be", "pup": "\u0995\u09c1\u0995\u09bc\u09c1\u09b0\u099b\u09be\u09a8\u09be",
    "cub": "\u099b\u09be\u09a8\u09be", "calf": "\u099b\u09be\u09a8\u09be", "kit": "\u099b\u09be\u09a8\u09be",
    "baby": "\u09ac\u09be\u099a\u09cd\u099a\u09be", "chick": "\u099b\u09be\u09a8\u09be", "cygnet": "\u09b0\u09be\u099c\u09b9\u09be\u09b8\u09c7\u09b0 \u09ac\u09be\u099a\u09cd\u099a\u09be",
    "gosling": "\u09b9\u09be\u09c1\u09b8\u09c7\u09b0 \u099b\u09be\u09a8\u09be", "eaglet": "\u0987\u09a7\u09bf\u09b0\u09be\u099c\u09c7\u09b0 \u099b\u09be\u09a8\u09be",
    "nestling": "\u0998\u09be\u09a1\u09bc\u09bf\u09b0 \u09ac\u09be\u099a\u09cd\u099a\u09be",
    "hatchling": "\u09a1\u09bf\u09ae \u09a5\u09c7\u0995\u09c7 \u09ac\u09be\u099a\u09cd\u099a\u09be",
    "school": "\u09b8\u09cd\u0995\u09c1\u09b2", "flock": "\u099d\u09be\u09c1\u09dc", "herd": "\u099d\u09be\u09c1\u09dc",
    "pack": "\u09a6\u09b2", "pride": "\u09a6\u09b2", "colony": "\u0995\u09b2\u09cb\u09a8\u09bf", "swarm": "\u099d\u09be\u09c1\u09dc",
    "of": "\u09b8\u09ac", "fish": "\u09ae\u09be\u099b", "birds": "\u09aa\u09be\u0996\u09bf", "cows": "\u0997\u09b0\u09c1",
    "wolves": "\u09a8\u09c7\u0995\u09dc\u09c7", "lions": "\u09b8\u09bf\u09c2\u09b9", "ants": "\u09aa\u09bf\u09c1\u09bc\u09a1\u09bc\u09be",
    "bees": "\u09ae\u09cc\u09ae\u09be\u099b\u09bf", "wolf": "\u09a8\u09c7\u0995\u09dc\u09c7", "tiger": "\u09ac\u09be\u09b9",
    "elephant": "\u09b9\u09be\u09a4\u09bf", "monkey": "\u09ac\u09be\u09a8\u09b0", "rabbit": "\u0996\u09b0\u09a7\u09cb\u09b6",
    "seal": "\u0998\u09c7\u09b2\u09be\u09ab\u09c7\u09b0", "owl": "\u09aa\u09c7\u09c1\u09bc\u09be", "tick": "\u099f\u09bf\u0995",
    "insect": "\u09aa\u09b9\u09c1\u09a6", "silkworm": "\u09b0\u09c7\u09b6\u09ae \u09aa\u09cb\u0995\u09be",
    "earthworm": "\u0995\u09c7\u09c1\u09bc\u099a\u09cb", "leech": "\u099c\u09cb\u09c1\u09bc", "snail": "\u09b6\u09be\u09ae\u09c1\u0995",
    "scorpion": "\u09ac\u09bf\u099a\u09cd\u099b\u09bf", "firefly": "\u099c\u09cb\u09a8\u09be\u0995\u09bf",
    "wasp": "\u09ad\u09cb\u09b0\u09be\u09b2", "hornet": "\u09ad\u09cb\u09b0\u09be\u09b2", "pangolin": "\u09ac\u09a8\u09cd\u09b0\u09c1\u0987",
    # food
    "am": "\u0986\u09ae", "er": "\u098f\u09b0", "rosh": "\u09b0\u09b8", "lebur": "\u09b2\u09c7\u09ac\u09c1\u09b0",
    "shorbot": "\u09b6\u09b0\u09ac\u09a4", "murgir": "\u09ae\u09c1\u09b0\u09ae\u09be\u09b0\u09bf\u09b0",
    "soup": "\u09b8\u09c1\u09aa", "bhaja": "\u09ad\u09be\u099c\u09be", "murgi": "\u09ae\u09c1\u09b0\u09c7\u0997\u09bf",
    "bhapa": "\u09ad\u09be\u09aa\u09be", "bhat": "\u09ad\u09be\u09a4", "alu": "\u0986\u09b2\u09c1",
    "bhorta": "\u09ad\u09b0\u09cd\u09a4\u09be", "mach": "\u09ae\u09be\u099b", "shutki": "\u09b6\u09c1\u099f\u09cd\u0995\u09bf",
    "mishti": "\u09ae\u09bf\u09b7\u09cd\u099f\u09bf", "doi": "\u09a6\u09a8", "paneer": "\u09aa\u09a8\u09bf\u09b0",
    "jilapi": "\u09a8\u09c7\u09b2\u09c7\u09ae", "jalebi": "\u09a8\u09c7\u09b2\u09c7\u09ae", "firni": "\u09ab\u09c7\u09b0\u09a8\u09bf",
    "pitha": "\u09aa\u09bf\u09aa\u09be", "patishapta": "\u09aa\u09be\u099f\u09bf\u09b6\u09be\u09aa\u09cd\u099f\u09be",
    "bora": "\u09ac\u09a1\u09bc\u09be", "chop": "\u099a\u09aa", "kathi": "\u0995\u09be\u09a0\u09bf",
    "roll": "\u09b0\u09cb\u09b2", "shami": "\u09b6\u09be\u09ae\u09bf", "kebab": "\u0995\u09be\u09ac\u09be\u09ac",
    "rasta": "\u09b0\u09b8\u09cd\u09a4\u09be", "khabar": "\u09b6\u09ac\u09cd\u09af\u09be\u09ac", "jhal": "\u09af\u09bc\u09be\u09b2",
    "swad": "\u09b8\u09cd\u09ac\u09be\u09a6", "shustho": "\u09b8\u09c1\u09b8\u09cd\u09a5", "but": "\u09ac\u09c2\u099f",
    "boot": "\u09ac\u09c2\u099f", "coffee": "\u0995\u09be\u09ab\u09bf", "cake": "\u0995\u09c7\u0995",
    "donut": "\u09a1\u09cb\u09a8\u09be\u099f", "toast": "\u099f\u09cb\u09b8\u09cd\u099f",
    "sandwich": "\u09b8\u09cd\u09af\u09be\u09a8\u09cd\u09a1\u099c\u09bf\u099a", "tiffin": "\u099f\u09bf\u09ab\u09bf\u09a8",
    "hot": "\u09b9\u09be\u099f", "dog": "\u09b9\u09be\u099f", "fast": "\u09ab\u09be\u09b8\u09cd\u099f",
    "food": "\u09b6\u09ac\u09cd\u09af\u09be\u09ac", "street": "\u09b0\u09b8\u09cd\u09a4\u09be", "spicy": "\u09af\u09bc\u09be\u09b2",
    "sweet": "\u09ae\u09bf\u09b7\u09cd\u099f\u09bf", "taste": "\u09b8\u09cd\u09ac\u09be\u09a6", "healthy": "\u09b8\u09c1\u09b8\u09cd\u09a5",
    "slice": "\u099f\u09c1\u0995\u09cd\u09b0\u09be", "juice": "\u09b6\u09b0\u09ac\u09a4", "lemonade": "\u09b2\u09c7\u09ac\u09c1 \u09b6\u09b0\u09ac\u09a4",
    "chicken": "\u09ae\u09c1\u09b0\u09c7\u09b9", "fried": "\u09ad\u09be\u099c\u09be", "steamed": "\u09ad\u09be\u09aa\u09be",
    "rice": "\u09ad\u09be\u09a4", "mashed": "\u09ad\u09b0\u09cd\u09a4\u09be", "potato": "\u0986\u09b2\u09c1",
    "dried": "\u09b6\u09c1\u099f\u09cd\u0995\u09bf", "yogurt": "\u09a6\u09a6\u09bf",
    # body
    "hater": "\u09b9\u09be\u09a4\u09c7\u09b0", "talu": "\u09a4\u09be\u09b2\u09c1", "muthi": "\u09ae\u09c1\u09a0\u09bf",
    "peshi": "\u09aa\u09c7\u09b6\u09c0", "shira": "\u09b6\u09bf\u09b0\u09be", "kankal": "\u0995\u09a8\u09cd\u0995\u09be\u09b2",
    "par": "\u09aa\u09be\u09c7\u09b0", "merudand": "\u09ae\u09c7\u09b0\u09c1\u09a6\u09a3\u09cd\u09a1",
    "komor": "\u0995\u09cb\u09ae\u09b0", "ur": "\u0989\u09b0\u09c1", "pindili": "\u09aa\u09bf\u09aa\u09c2\u09dc\u09b2\u09c0",
    "golay": "\u09a8\u09c7\u09b2\u09be", "pay": "\u09aa\u09be", "bhag": "\u09ad\u09be\u09b7",
    "nokher": "\u09a8\u0996\u09c7\u09b0", "base": "\u09ad\u09bf\u09a4\u09cd\u09a4\u09bf", "khujli": "\u099a\u09c1\u09b2\u09a8\u09be",
    "gham": "\u09b8\u09cd\u09a7\u09a7", "ashru": "\u0985\u09b6\u09cd\u09b0\u09c1", "lal": "\u09b2\u09be\u09b2",
    "shleshm": "\u09b6\u09cd\u09b2\u09c7\u09b7\u09cd\u09ae", "balgam": "\u09ac\u09b2\u09ad\u09ae", "mutra": "\u09ae\u09c2\u09a4\u09cd\u09b0",
    "potty": "\u09aa\u09be\u09af\u09bc\u0996\u09be\u09a8\u09be", "nabhi": "\u09a8\u09be\u09ad\u09bf", "deho": "\u09a6\u09c7\u09b9",
    "upor": "\u0989\u09aa\u09b0", "niche": "\u09a8\u09bf\u099a\u09c7", "bam": "\u09ac\u09be\u09ae", "dan": "\u09a1\u09be\u09a8",
    "hat": "\u09b9\u09be\u09a4", "pa": "\u09aa\u09be", "tarjani": "\u09a4\u09be\u09b0\u099c\u09be\u09a8\u09c0",
    "madhyama": "\u09ae\u09a7\u09cd\u09af\u09ae\u09be", "anamika": "\u0986\u09a8\u09be\u09ae\u09bf\u09b2\u09be",
    "kanistha": "\u0995\u09be\u09a8\u09bf\u09b7\u09cd\u09aa\u09b0", "baro": "\u09ac\u09dc", "chhoto": "\u099b\u09b8\u09cd\u099f",
    "angul": "\u0986\u0999\u09c1\u09b2", "chokher": "\u099a\u09cb\u0996\u09c7\u09b0", "palok": "\u09aa\u09be\u09b2\u09b0",
    "putul": "\u09aa\u09c1\u09a4\u09c1\u09b2", "nali": "\u09a8\u09be\u09b2\u09bf", "kaner": "\u0995\u09be\u09b0\u09cd\u09a8\u09c7\u09b0",
    "lata": "\u09b2\u09a4\u09be", "nak": "\u09a8\u09be\u0995", "ched": "\u099b\u09bf\u09b6",
    "masuda": "\u09ae\u09be\u09b8\u09c1\u09dc\u09be", "girja": "\u0997\u09b0\u09cd\u099c", "dat": "\u09a6\u09be\u09ce\u09af\u09bc",
    "shishu": "\u09b6\u09bf\u09b6\u09c1", "kanthas": "\u0995\u09a3\u09cd\u09a0\u09b8", "sworashuli": "\u09b8\u09cd\u09ac\u09b0\u09b6\u09b2\u09bf",
    "shwasnali": "\u09b6\u09cd\u09ac\u09be\u09b8\u09a8\u09be\u09b2\u09c0", "phusphus": "\u09ab\u09c1\u09b8\u09ab\u09c1\u09b8",
    "kukshi": "\u0995\u09c1\u0995\u09cd\u09b7\u09bf", "jigar": "\u09af\u09c7\u09b8", "antro": "\u0985\u09a8\u09cd\u09a4\u09cd\u09b0",
    "mutrashay": "\u09ae\u09c2\u09a4\u09cd\u09b0\u09be\u09b6\u09af\u09bc", "pleeha": "\u09aa\u09cd\u09b2\u09c0\u09b9",
    "rogg": "\u09b0\u09cb\u0997", "pratirodk": "\u09aa\u09cd\u09b0\u09a4\u09bf\u09b0\u09cb\u09a7",
    "smriti": "\u09b8\u09cd\u09ae\u09c3\u09a4\u09bf", "chinta": "\u09b9\u09be\u09b6\u09be", "indriyo": "\u0987\u09a8\u09cd\u09a6\u09cd\u09b0\u09bf\u09af\u09bc",
    "drishti": "\u09a6\u09c3\u09b7\u09cd\u099f\u09bf", "shroban": "\u09b6\u09cd\u09b0\u09ac\u09a3", "ghran": "\u0998\u09cd\u09b0\u09be\u09b2",
    "sporsho": "\u09b8\u09cd\u09aa\u09b0\u09cd\u09b6", "bharsamyo": "\u09ad\u09be\u09b0\u09b8\u09be\u09ae\u09cd\u09af",
    "abosthan": "\u0985\u09ac\u09b8\u09cd\u09a5\u09be\u09a8", "ishara": "\u0987\u09b6\u09be\u09b0\u09be",
    "abhibyakti": "\u0985\u09ad\u09bf\u09ac\u09cd\u09af\u09b2\u09cd\u09af\u09c1\u0995\u09cd\u09a4\u09bf",
    "dehor": "\u09a6\u09c7\u09b9\u09b0", "bhasha": "\u09ad\u09be\u09b7\u09be", "shakti": "\u09b6\u09b8\u09cd\u09a4\u09bf",
    "brihhi": "\u09ac\u09c3\u09b9\u09bf", "uchai": "\u0989\u09b0\u09cd\u09b8\u09cd\u09a4\u09a4\u09be", "vajan": "\u099c\u09a8",
    "knuckle": "\u09be\u09b8\u09cd\u0995\u09cd\u09b0\u09c0", "joint": "\u09b8\u09b8\u09cd\u09a5\u09be\u09b8\u09cd\u09a5\u09be\u09b8",
    "muscle": "\u09aa\u09c7\u09b6\u09c0", "vein": "\u09b6\u09bf\u09b0\u09be", "artery": "\u09aa\u09cd\u09b0\u09a7\u09be\u09b0\u09b0\u09c0",
    "pulse": "\u09a8\u09be\u09dc\u09bf", "skeleton": "\u0995\u09a8\u09cd\u0995\u09be\u09b2", "rib": "\u09aa\u09be\u09c7\u09b0",
    "spine": "\u09ae\u09c7\u09b0\u09c1\u09a6\u09a3\u09cd\u09a1", "hip": "\u0995\u09cb\u09ae\u09b0", "thigh": "\u0989\u09b0\u09c1",
    "shin": "\u09aa\u09bf\u09aa\u09c2\u09dc\u09b2\u09c0", "ankle": "\u09a8\u09c7\u09b2\u09be", "arch": "\u09a7\u09cd\u09af\u09bc\u09b8\u09cd\u09a7",
    "sole": "\u09a4\u09be\u09b2\u09c1", "instep": "\u0989\u09aa\u09b0", "freckle": "\u099b\u09bf\u09b8\u09cd\u09a4\u09bf",
    "dimple": "\u0995\u09a1\u09bc", "wrinkle": "\u099c\u09a4\u09bf", "scar": "\u0996\u09be\u09a4", "bruise": "\u09a6\u09be\u09b0",
    "cut": "\u0995\u09be\u099f", "burn": "\u09a6\u09be\u09b9", "rash": "\u09a6\u09be\u09b8", "itch": "\u099a\u09c1\u09b2\u09a8\u09be",
    "sweat": "\u09b8\u09cd\u09a7\u09a7", "tear": "\u0985\u09b6\u09cd\u09b0\u09c1", "saliva": "\u09b2\u09be\u09b2",
    "mucus": "\u09b6\u09cd\u09b2\u09c7\u09b7\u09cd\u09ae", "phlegm": "\u09ac\u09b2\u09ad\u09ae", "urine": "\u09ae\u09c2\u09a4\u09cd\u09b0",
    "stool": "\u09aa\u09be\u09af\u09bc\u0996\u09be\u09a8\u09be", "belly": "\u09aa\u09c7\u099f", "button": "\u09a8\u09be\u09ad\u09bf",
    "waist": "\u0995\u09cb\u09ae\u09b0", "torso": "\u09a6\u09c7\u09b9", "upper": "\u0989\u09aa\u09b0", "lower": "\u09a8\u09bf\u099a\u09c7",
    "body": "\u09a6\u09c7\u09b9", "left": "\u09ac\u09be\u09ae", "right": "\u09a1\u09be\u09a8", "hand": "\u09b9\u09be\u09a4",
    "foot": "\u09aa\u09be", "index": "\u09a4\u09be\u09b0\u099c\u09be\u09a8\u09c0", "finger": "\u0986\u0999\u09c1\u09b2",
    "middle": "\u09ae\u09a7\u09cd\u09af\u09ae", "ring": "\u0986\u09a8\u09be\u09ae\u09bf\u09b2\u09be", "pinky": "\u0995\u09be\u09a8\u09bf\u09b7\u09cd\u09aa\u09b0",
    "big": "\u09ac\u09dc", "toe": "\u0986\u0999\u09c1\u09b2", "little": "\u099b\u09b8\u09cd\u099f", "eyelid": "\u09aa\u09be\u09b2\u09b0",
    "pupil": "\u09aa\u09c1\u09a4\u09c1\u09b2", "iris": "\u09ac\u09b9\u09b0", "retina": "\u09b0\u09c7\u099f\u09bf\u09a8\u09be",
    "cornea": "\u0995\u09b0\u09cd\u09a8\u09bf\u09af\u09bc\u09be", "duct": "\u09a8\u09be\u09b2\u09bf", "earlobe": "\u0995\u09be\u09b0\u09cd\u09a8\u09b2\u09c7\u09b8",
    "eardrum": "\u0995\u09be\u09b0\u09cd\u09a8\u09b6\u09b2\u09bf\u09b7\u09cd\u09a0", "nostril": "\u09a8\u09be\u0995\u099b\u09bf\u09b6",
    "sinus": "\u09a8\u09be\u0995\u099b\u09bf\u09b6", "palate": "\u09a4\u09be\u09b2\u09c1", "gum": "\u09ae\u09be\u09b8\u09c1\u09dc\u09be",
    "wisdom": "\u0997\u09b0\u09cd\u099c", "tooth": "\u09a6\u09be\u09ce\u09af\u09bc", "baby": "\u09b6\u09bf\u09b6\u09c1",
    "uvula": "\u0995\u09ac\u09b0\u09cd\u099c\u09b0", "tonsil": "\u099f\u09a8\u09b8\u09bf\u09b2", "adam": "\u0995\u09a3\u09cd\u09a0",
    "apple": "\u0995\u09a3\u09cd\u09a0", "larynx": "\u09b8\u09cd\u09ac\u09b0\u09b6\u09b2\u09bf", "trachea": "\u09b6\u09cd\u09ac\u09be\u09b8\u09a8\u09be\u09b2\u09c0",
    "lung": "\u09ab\u09c1\u09b8\u09ab\u09c1\u09b8", "kidney": "\u0995\u09c1\u0995\u09cd\u09b7\u09bf", "liver": "\u09af\u09c7\u09b8",
    "intestine": "\u0985\u09a8\u09cd\u09a4\u09cd\u09b0", "bladder": "\u09ae\u09c2\u09a4\u09cd\u09b0\u09be\u09b6\u09af\u09bc",
    "pancreas": "\u09aa\u09cd\u09af\u09be\u09b9\u09cd\u09b0\u09c3\u09a4\u09cd\u09b6", "spleen": "\u09aa\u09cd\u09b2\u09c0\u09b9",
    "immune": "\u09aa\u09cd\u09b0\u09a4\u09bf\u09b0\u09cb\u09a7", "system": "\u09a4\u09c7\u09b0", "nerve": "\u09b6\u09bf\u09b0\u09be",
    "reflex": "\u0987\u09b8\u09c1\u09a4\u09c7", "instinct": "\u0987\u09a8\u09cd\u09b8\u09cd\u099f\u09bf\u09e8\u09cd\u099f",
    "memory": "\u09b8\u09cd\u09ae\u09c3\u09a4\u09bf", "thought": "\u09b9\u09be\u09b6\u09be", "sense": "\u0987\u09a8\u09cd\u09a6\u09cd\u09b0\u09bf\u09af\u09bc",
    "sight": "\u09a6\u09c3\u09b7\u09cd\u099f\u09bf", "hearing": "\u09b6\u09cd\u09b0\u09ac\u09a3", "smell": "\u0998\u09cd\u09b0\u09be\u09b2",
    "touch": "\u09b8\u09cd\u09aa\u09b0\u09cd\u09b6", "balance": "\u09ad\u09be\u09b0\u09b8\u09be\u09ae\u09cd\u09af",
    "posture": "\u0985\u09ac\u09b8\u09cd\u09a5\u09be\u09a8", "gesture": "\u0987\u09b6\u09be\u09b0\u09be",
    "expression": "\u0985\u09ad\u09bf\u09ac\u09cd\u09af\u09b2\u09cd\u09af\u09c1\u0995\u09cd\u09a4\u09bf",
    "language": "\u09ad\u09be\u09b7\u09be", "health": "\u09b8\u09c1\u09b8\u09cd\u09a5", "fitness": "\u09b8\u09c1\u09b8\u09cd\u09a5",
    "strength": "\u09b6\u09b8\u09cd\u09a4\u09bf", "energy": "\u09b6\u09b8\u09cd\u09a4\u09bf", "growth": "\u09ac\u09c3\u09b9\u09bf",
    "height": "\u0989\u09b0\u09cd\u09b8\u09cd\u09a4\u09a4\u09be", "weight": "\u099c\u09a8", "skin": "\u099a\u09be\u09ae\u09c1\u09dc\u09be",
    "palm": "\u09b9\u09be\u09a4\u09c7\u09b0 \u09a4\u09be\u09b2\u09c1", "fist": "\u09ae\u09c1\u09a0\u09bf",
}


def is_bn(s: str) -> bool:
    return bool(BN_RE.search(s)) and not LATIN.search(s)


def _match(s: str, patterns: list[tuple[str, str]]) -> tuple[str, str] | None:
    for pat, val in patterns:
        if s.startswith(pat):
            return pat, val
    return None


def _roman_word(word: str, word_map: dict[str, str]) -> str | None:
    w = word.lower().strip()
    if not w:
        return None
    if w in word_map:
        return word_map[w]
    return _roman_syllables(w)


def _roman_syllables(word: str) -> str | None:
    """Greedy roman syllable -> Bengali for unknown words."""
    s = word.lower()
    out: list[str] = []
    i = 0
    first = True
    while i < len(s):
        # consonant cluster
        cm = _match(s[i:], _CONS)
        if cm:
            pat, cons = cm
            i += len(pat)
            vm = _match(s[i:], _VS)
            if vm:
                vp, vs = vm
                i += len(vp)
                out.append(cons + vs)
            else:
                out.append(cons)
            first = False
            continue
        # vowel only
        vm = _match(s[i:], _IV if first else _VS)
        if vm:
            vp, vv = vm
            i += len(vp)
            out.append(vv)
            first = False
            continue
        # skip unknown
        return None
    result = "".join(out)
    return result if BN_RE.search(result) else None


def _convert_text(text: str, word_map: dict[str, str]) -> str | None:
    t = text.lower().strip()
    if t in word_map:
        return word_map[t]
    words = re.split(r"[\s\-]+", t)
    parts = [_roman_word(w, word_map) for w in words if w]
    if parts and all(parts):
        return " ".join(parts)
    return None


def load_word_map() -> tuple[dict[str, str], dict[str, str]]:
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

    word_map = {**token, **EXTRA_WORDS}
    return phrase, word_map


def build_overrides() -> dict[str, str]:
    phrase, word_map = load_word_map()
    bad = json.loads(BAD_JSON.read_text(encoding="utf-8"))
    overrides: dict[str, str] = {}
    missing: list[tuple[str, str, str]] = []

    for e in bad:
        key = f"{e['cat']}|{e['en']}"
        bn = None
        for src in (e["bn"], e.get("roman", ""), e["en"]):
            bn = _convert_text(src, word_map) or phrase.get(src.lower().strip())
            if bn and is_bn(bn):
                break
            bn = None
        if bn and is_bn(bn):
            overrides[key] = bn
        else:
            missing.append((e["cat"], e["en"], e["bn"]))

    if missing:
        print(f"MISSING {len(missing)} overrides:", file=sys.stderr)
        for m in missing[:50]:
            print(f"  {m[0]}|{m[1]} ({m[2]})", file=sys.stderr)
        raise SystemExit(1)

    return overrides


def apply_and_regenerate(overrides: dict[str, str]) -> int:
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
                print(f"No override: {key} = {row[1]!r}", file=sys.stderr)
                return 1

    payload = json.dumps(data, ensure_ascii=False)
    gen_content = f'''#!/usr/bin/env python3
"""Generate scripts/vocab-extra.mjs with toddler EN\u2192BN vocabulary."""
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
    GEN.write_text(gen_content, encoding="utf-8")
    return subprocess.run([sys.executable, str(GEN)], cwd=str(SCRIPTS)).returncode


def main() -> int:
    overrides = build_overrides()
    print(f"Built {len(overrides)} overrides")
    OVERRIDES_JSON.write_text(json.dumps(overrides, ensure_ascii=False, indent=2), encoding="utf-8")
    return apply_and_regenerate(overrides)


if __name__ == "__main__":
    raise SystemExit(main())
