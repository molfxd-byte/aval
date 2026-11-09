import re
from pathlib import Path

transcript = Path(
    r"C:\Users\Lenovo\.cursor\projects\c-Users-Lenovo-avalpay-panel\agent-transcripts"
    r"\a86ffa20-6c52-465b-a6eb-18ea04a59271\a86ffa20-6c52-465b-a6eb-18ea04a59271.jsonl"
)
lines = transcript.read_text(encoding="utf-8").splitlines()
# line 1693 (0-index 1692) and 1786
for idx in (1692, 1785):
    line = lines[idx]
    # get the CSS body from styles.pasarelapagosaval
    # find all class rules
    rules = re.findall(r"(\.[A-Za-z][A-Za-z0-9_-]*)\{([^}]+)\}", line)
    print(f"\n==== line {idx+1}: {len(rules)} rules ====")
    out = []
    for name, body in rules:
        low = (name + body).lower()
        if any(
            k in low
            for k in (
                "bank",
                "aval",
                "method",
                "pse",
                "radio",
                "person",
                "option",
                "pay-type",
                "paytype",
                "medio",
                "entity",
                "tab",
                "selected",
                "active",
                "hover-color",
                "d9f8ff",
                "27ab",
                "list-bank",
                "btn-bank",
                "card-bank",
                "financial",
                "franchise",
                "product-pay",
            )
        ):
            out.append(f"{name} {{{body}}}")
    print("matched", len(out))
    Path(rf"C:\Users\Lenovo\avalpay-panel\_rules_{idx}.txt").write_text(
        "\n\n".join(out), encoding="utf-8"
    )
    for r in out[:80]:
        print(r[:300])
        print("---")
