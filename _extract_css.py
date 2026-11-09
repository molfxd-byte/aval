import re
from pathlib import Path

transcript = Path(
    r"C:\Users\Lenovo\.cursor\projects\c-Users-Lenovo-avalpay-panel\agent-transcripts"
    r"\a86ffa20-6c52-465b-a6eb-18ea04a59271\a86ffa20-6c52-465b-a6eb-18ea04a59271.jsonl"
)
lines = transcript.read_text(encoding="utf-8").splitlines()
for i, line in enumerate(lines):
    if "btn-primary-color:#00ddf4" in line and "--blue-one:#f2f7ff" in line:
        print("line", i, "length", len(line))
        # unescape common json
        s = line
        # find CSS-looking content after query
        # extract rules with bank/method keywords
        rules = re.findall(
            r"(\.[A-Za-z0-9_-]{2,80})\{([^}]{5,500})\}",
            s,
        )
        interesting = []
        keys = (
            "bank",
            "aval",
            "method",
            "pse",
            "radio",
            "person",
            "option",
            "pay",
            "select",
            "active",
            "hover",
            "medio",
            "entity",
            "logo",
            "card",
            "tab",
            "btn",
            "white-form",
        )
        for name, body in rules:
            low = (name + body).lower()
            if any(k in low for k in keys):
                interesting.append((name, body[:300]))
        print("interesting rules", len(interesting))
        out = Path(r"C:\Users\Lenovo\avalpay-panel\_orig_pasarela_rules.txt")
        with out.open("w", encoding="utf-8") as f:
            for name, body in interesting:
                f.write(f"{name} {{{body}}}\n\n")
        print("wrote", out)
        # also print ones with bank or method or aval in name
        for name, body in interesting:
            n = name.lower()
            if any(k in n for k in ("bank", "aval", "method", "pse", "radio", "person", "option-pay", "btn-pay")):
                print(name, "=>", body[:250])
        break
else:
    print("not found")
