from pathlib import Path

line = Path(
    r"C:\Users\Lenovo\.cursor\projects\c-Users-Lenovo-avalpay-panel\agent-transcripts"
    r"\a86ffa20-6c52-465b-a6eb-18ea04a59271\a86ffa20-6c52-465b-a6eb-18ea04a59271.jsonl"
).read_text(encoding="utf-8").splitlines()[1785]
s = line.replace("\\n", "\n").replace('\\"', '"')

for needle in [
    "selected",
    "is-selected",
    "banks-payment-aval",
    "payment-method-group",
    "image-active-icon-banks",
    "icon-banks",
    "person-type",
    "form-check",
    "radio",
]:
    print(f"\n######## {needle} count={s.lower().count(needle.lower())}")
    start = 0
    n = 0
    while n < 4:
        i = s.lower().find(needle.lower(), start)
        if i < 0:
            break
        print(repr(s[max(0, i - 60) : i + 200]))
        start = i + 1
        n += 1
