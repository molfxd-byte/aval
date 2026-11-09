from pathlib import Path

line = Path(
    r"C:\Users\Lenovo\.cursor\projects\c-Users-Lenovo-avalpay-panel\agent-transcripts"
    r"\a86ffa20-6c52-465b-a6eb-18ea04a59271\a86ffa20-6c52-465b-a6eb-18ea04a59271.jsonl"
).read_text(encoding="utf-8").splitlines()[1785]
s = line.replace("\\n", "\n").replace('\\"', '"')

i = s.find("bank-payment-aval-option")
print(s[i : i + 2200])
print("\n\n==== payment-method active ====")
j = s.find(".payment-method.active")
if j < 0:
    j = s.find("payment-method[_ngcontent")
print(s[j : j + 1800])
print("\n\n==== grid banks ====")
k = s.find("grid-template-columns:repeat(2,1fr)")
print(s[k - 200 : k + 400])
