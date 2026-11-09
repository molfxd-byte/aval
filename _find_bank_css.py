import re
from pathlib import Path

line = Path(
    r"C:\Users\Lenovo\.cursor\projects\c-Users-Lenovo-avalpay-panel\agent-transcripts"
    r"\a86ffa20-6c52-465b-a6eb-18ea04a59271\a86ffa20-6c52-465b-a6eb-18ea04a59271.jsonl"
).read_text(encoding="utf-8").splitlines()[1785]

# Unescape JSON fragments roughly
s = line.replace("\\n", "\n").replace('\\"', '"')

# Search keywords near CSS
for kw in [
    "Selecciona un banco",
    "Otras Entidades",
    "listBanks",
    "bank-logo",
    "banks",
    "btn-option",
    "option-aval",
    "pay-option",
    "financial",
    "d9f8ff",
    "27abf4",
    "border-radius:8px",
    "aspect-ratio",
    "85px",
    "120px",
    "100px",
]:
    i = s.lower().find(kw.lower())
    print(f"{kw}: {i}")
    if i >= 0:
        print("  ctx:", repr(s[max(0, i - 120) : i + 180]))

# Find any rule containing 'banco' or 'Bank'
for m in re.finditer(r"[.#][A-Za-z0-9_-]{0,40}[Bb]ank[A-Za-z0-9_-]{0,40}\s*\{[^}]{0,400}\}", s):
    print("RULE", m.group(0)[:350])
for m in re.finditer(r"[.#][A-Za-z0-9_-]{0,40}[Aa]val[A-Za-z0-9_-]{0,40}\s*\{[^}]{0,400}\}", s):
    print("AVAL", m.group(0)[:350])
