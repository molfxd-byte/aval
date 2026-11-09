from pathlib import Path

line = Path(
    r"C:\Users\Lenovo\.cursor\projects\c-Users-Lenovo-avalpay-panel\agent-transcripts"
    r"\a86ffa20-6c52-465b-a6eb-18ea04a59271\a86ffa20-6c52-465b-a6eb-18ea04a59271.jsonl"
).read_text(encoding="utf-8").splitlines()[1785]

s = line.replace("\\n", "\n").replace('\\"', '"')

needles = [
    "bank-payment-aval-option",
    "payment-method-group",
    "btn-pay",
    "icon-grupoaval",
    "icon-banks",
    "person-type",
    "pse",
    "radio",
    "Seleccione",
    "Natural",
    "Jur",
]
for needle in needles:
    start = 0
    count = 0
    while True:
        i = s.lower().find(needle.lower(), start)
        if i < 0:
            break
        count += 1
        print(f"\n=== {needle} #{count} @ {i} ===")
        print(s[max(0, i - 80) : i + 350])
        start = i + len(needle)
        if count >= 3:
            break
