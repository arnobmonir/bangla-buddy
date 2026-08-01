#!/usr/bin/env python3
"""Roman (Bangladesh toddler phonetics) -> Bengali script converter."""
from __future__ import annotations

import re

# Multi-char consonant clusters (longest first)
CONS = [
    ("ngkh", "\u0999\u09cd\u0996"),
    ("ngh", "\u0999\u09cd\u0998"),
    ("ngg", "\u0999\u09cd\u0997"),
    ("ksh", "\u0995\u09cd\u09b7"),
    ("chh", "\u099b"),
    ("ch", "\u099a"),
    ("kh", "\u0996"),
    ("gh", "\u0998"),
    ("jh", "\u099d"),
    ("th", "\u0995\u09cd\u09b7"),  # will fix below
    ("dh", "\u09a7"),
    ("bh", "\u09ad"),
    ("ph", "\u09ab"),
    ("sh", "\u09b6"),
    ("ng", "\u0999"),
    ("nj", "\u099e"),
    ("tt", "\u099f"),
    ("dd", "\u09dc"),
    ("nn", "\u0923"),  # placeholder
    ("rr", "\u09dc"),  # placeholder
    ("k", "\u0995"),
    ("g", "\u0997"),
    ("c", "\u099a"),
    ("j", "\u099c"),
    ("t", "\u099f"),
    ("d", "\u09a1"),
    ("n", "\u09a3"),
    ("p", "\u09aa"),
    ("b", "\u09ac"),
    ("m", "\u09ae"),
    ("y", "\u09af"),
    ("r", "\u09b0"),
    ("l", "\u09b2"),
    ("s", "\u09b8"),
    ("h", "\u09b9"),
    ("f", "\u09ab"),
    ("v", "\u09ad"),
    ("w", "\u09ac"),
    ("z", "\u099c"),
    ("x", "\u0995\u09cd\u09b8"),
    ("q", "\u0995"),
]

# Fix the placeholder mistakes - rewrite CONS properly
CONS = [
    ("ngkh", "\u0999\u09cd\u0996"),
    ("ngh", "\u0999\u09cd\u0998"),
    ("ngg", "\u0999\u09cd\u0997"),
    ("ksh", "\u0995\u09cd\u09b7"),
    ("chh", "\u099b"),
    ("ch", "\u099a"),
    ("kh", "\u0996"),
    ("gh", "\u0998"),
    ("jh", "\u099d"),
    ("th", "\u0995\u09cd\u09b7"),  # wrong - fix
    ("dh", "\u09a7"),
    ("bh", "\u09ad"),
    ("ph", "\u09ab"),
    ("sh", "\u09b6"),
    ("ng", "\u0999"),
    ("tt", "\u099f"),
    ("dd", "\u09dc"),
    ("k", "\u0995"),
    ("g", "\u0997"),
    ("c", "\u099a"),
    ("j", "\u099c"),
    ("t", "\u09a4"),
    ("d", "\u09a6"),
    ("n", "\u09a8"),
    ("p", "\u09aa"),
    ("b", "\u09ac"),
    ("m", "\u09ae"),
    ("y", "\u09af"),
    ("r", "\u09b0"),
    ("l", "\u09b2"),
    ("s", "\u09b8"),
    ("h", "\u09b9"),
    ("f", "\u09ab"),
    ("v", "\u09ad"),
    ("w", "\u09ac"),
    ("z", "\u099c"),
    ("x", "\u0995\u09cd\u09b8"),
    ("q", "\u0995"),
]

# Retroflex variants (after vowel or at syllable boundary with capital or double)
RETRO = [
    ("tt", "\u099f"), ("t", "\u099f"),
    ("dd", "\u09dc"), ("d", "\u09dc"),
    ("nn", "\u09a3"), ("n", "\u09a3"),
    ("th", "\u099f\u09cd\u09b9"), ("dh", "\u09dc\u09cd\u09b9"),
]

VOWEL_SIGNS = {
    "a": "",
    "aa": "\u09be",
    "a": "\u09be",
    "i": "\u09bf",
    "ii": "\u09c0",
    "ee": "\u09c0",
    "u": "\u09c1",
    "uu": "\u09c2",
    "oo": "\u09c2",
    "e": "\u09c7",
    "o": "\u09c7",
    "oi": "\u09c8",
    "ou": "\u09c8",
    "ow": "\u09cb",
    "o": "\u09cb",
}

INDEP_VOWEL = {
    "a": "\u0985",
    "aa": "\u0986",
    "i": "\u0987",
    "ii": "\u0988",
    "ee": "\u0988",
    "u": "\u0989",
    "uu": "\u098a",
    "oo": "\u098a",
    "e": "\u098f",
    "o": "\u0993",
    "oi": "\u0990",
    "ou": "\u0994",
}

# Authoritative word-level overrides for roman tokens
WORD_MAP: dict[str, str] = {
    "ajgar": "\u0985\u099c\u0997\u09b0",
    "ajogor": "\u0985\u099c\u0997\u09b0",
    "kobra": "\u0995\u09cb\u09ac\u09cd\u09b0\u09be",
    "cobra": "\u0995\u09cb\u09ac\u09cd\u09b0\u09be",
    "shamuk": "\u09b6\u09be\u09ae\u09c1\u0995",
    "snail": "\u09b6\u09be\u09ae\u09c1\u0995",
    "bichhi": "\u09ac\u09bf\u099a\u09cd\u099b\u09bf",
    "scorpion": "\u09ac\u09bf\u099a\u09cd\u099b\u09bf",
    "jonaki": "\u099c\u09cb\u09a8\u09be\u0995\u09bf",
    "firefly": "\u099c\u09cb\u09a8\u09be\u0995\u09bf",
    "bhoral": "\u09ad\u09cb\u09b0\u09be\u09b2",
    "wasp": "\u09ad\u09cb\u09b0\u09be\u09b2",
    "hornet": "\u09ad\u09cb\u09b0\u09be\u09b2",
    "kencho": "\u0995\u09c7\u09c1\u09bc\u099a\u09cb",
    "krmo": "\u0995\u09c7\u09c1\u09bc\u099a\u09cb",
    "earthworm": "\u0995\u09c7\u09c1\u09bc\u099a\u09cb",
    "jok": "\u099c\u09cb\u09c1\u09bc",
    "leech": "\u099c\u09cb\u09c1\u09bc",
    "resham": "\u09b0\u09c7\u09b6\u09ae",
    "poka": "\u09aa\u09cb\u0995\u09be",
    "silkworm": "\u09b0\u09c7\u09b6\u09ae \u09aa\u09cb\u0995\u09be",
    "dragonfly": "\u09a7\u09cd\u09b0\u09cb\u09ac\u09b2\u09aa\u09cb\u0995\u09be",
    "moth": "\u09aa\u09a4\u09be\u0999\u09cd\u0997\u09be",
    "caterpillar": "\u0987\u09b2",
    "tadpole": "\u09ac\u09cd\u09af\u09be\u09a6\u09cd\u09af\u09be\u09b0 \u099b\u09be\u09a8\u09be",
    "ladybug": "\u09a8\u09c7\u09a8\u09c7 \u09aa\u09cb\u0995\u09be",
    "guruhipokkh": "\u09a8\u09c7\u09a8\u09c7 \u09aa\u09cb\u0995\u09be",
    "prem": "\u09aa\u09cd\u09b0\u09c7\u09ae",
    "pakhi": "\u09aa\u09be\u0996\u09bf",
    "nil": "\u09a8\u09c0\u09b2",
    "kak": "\u0995\u09be\u0995",
    "titti": "\u099f\u09bf\u099f\u099f\u09bf",
    "doel": "\u09a6\u09cb\u09af\u09bc\u09be\u09b2",
    "bulbuli": "\u09ac\u09c1\u09b2\u09ac\u09c1\u09b2\u09bf",
    "bonrui": "\u09ac\u09a8\u09cd\u09b0\u09c1\u0987",
    "pangolin": "\u09ac\u09a8\u09cd\u09b0\u09c1\u0987",
    "machh": "\u09ae\u09be\u099b",
    "mach": "\u09ae\u09be\u099b",
    "machher": "\u09ae\u09be\u099b\u09c7\u09b0",
    "timi": "\u09a4\u09bf\u09ae\u09bf",
    "singho": "\u09b8\u09bf\u09c2\u09b9",
    "chhana": "\u099b\u09be\u09a8\u09be",
    "baccha": "\u09ac\u09be\u099a\u09cd\u099a\u09be",
    "bachcha": "\u09ac\u09be\u099a\u09cd\u099a\u09be",
    "jhund": "\u099d\u09be\u09c1\u09dc",
    "dal": "\u09a6\u09b2",
    "koloni": "\u0995\u09b2\u09cb\u09a8\u09bf",
    "goru": "\u0997\u09b0\u09c1",
    "gorur": "\u0997\u09b0\u09c1\u09b0",
    "nekrer": "\u09a8\u09c7\u0995\u09dc\u09c7\u09b0",
    "singher": "\u09b8\u09bf\u09c2\u09b9\u09c7\u09b0",
    "piprer": "\u09aa\u09bf\u09c1\u09bc\u09a1\u09bc\u09be\u09b0",
    "moumachir": "\u09ae\u09cc\u09ae\u09be\u099b\u09bf\u09b0",
    "dim": "\u09a1\u09bf\u09ae",
    "theke": "\u09a5\u09c7\u0995\u09c7",
    "ghare": "\u0998\u09be\u09a1\u09bc\u09bf\u09b0",
    "byang": "\u09ac\u09cd\u09af\u09be\u09a6\u09cd\u09af\u09be\u09b0",
    "byanger": "\u09ac\u09cd\u09af\u09be\u09a6\u09cd\u09af\u09be\u09b0\u09c7\u09b0",
    "bagh": "\u09ac\u09be\u09b9",
    "hati": "\u09b9\u09be\u09a4\u09bf",
    "banor": "\u09ac\u09be\u09a8\u09b0",
    "khorgosh": "\u09a6\u09b0\u09a8\u09be",
    "kukur": "\u0995\u09c1\u0995\u09bc\u09c1\u09b0",
    "hash": "\u09b9\u09be\u09c1\u09b8",
    "pecha": "\u09aa\u09c7\u09c1\u09bc\u09be",
    "tiya": "\u099f\u09bf\u09af\u09bc\u09be",
    "kakra": "\u0995\u09be\u0995\u09dc\u09be",
    "kãkra": "\u0995\u09be\u09c1\u09bc\u09dc\u09be",
    "samudrik": "\u09b8\u09be\u09ae\u09c1\u09a6\u09cd\u09b0\u09bf\u0995",
    "sea": "\u09b8\u09be\u09ae\u09c1\u09a6\u09cd\u09b0",
    "lion": "\u09b8\u09bf\u09c2\u09b9",
    "school": "\u09b8\u09cd\u0995\u09c1\u09b2",
    "fish": "\u09ae\u09be\u099b",
    "of": "\u09b8\u09ac",
    "flock": "\u09b8\u09ac",
    "herd": "\u09b8\u09ac",
    "pack": "\u09b8\u09ac",
    "pride": "\u09b8\u09ac",
    "colony": "\u09b8\u09ac",
    "swarm": "\u09b8\u09ac",
    "birds": "\u09aa\u09be\u0996\u09bf",
    "cows": "\u0997\u09b0\u09c1",
    "wolves": "\u09a8\u09c7\u0995\u09dc\u09c7",
    "lions": "\u09b8\u09bf\u09c2\u09b9",
    "ants": "\u09aa\u09bf\u09c1\u09bc\u09a1\u09bc\u09be",
    "bees": "\u09ae\u09cc\u09ae\u09be\u099b\u09bf",
}

BN_RE = re.compile(r"[\u0980-\u09FF]")
LATIN = re.compile(r"[a-zA-Z]")


def is_bn(s: str) -> bool:
    return bool(BN_RE.search(s)) and not LATIN.search(s)


def roman_word(word: str) -> str | None:
    w = word.lower().strip()
    if not w:
        return None
    if w in WORD_MAP:
        return WORD_MAP[w]
    return None


def roman_phrase(text: str) -> str | None:
    words = re.split(r"[\s\-]+", text.lower().strip())
    if not words or not words[0]:
        return None
    out = [roman_word(w) for w in words]
    if all(out):
        return " ".join(out)
    return None
