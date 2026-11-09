import json
import re
from pathlib import Path

import cv2
import numpy as np

# --- Extract original CSS snippets from transcript ---
transcript = Path(
    r"C:\Users\Lenovo\.cursor\projects\c-Users-Lenovo-avalpay-panel\agent-transcripts"
    r"\a86ffa20-6c52-465b-a6eb-18ea04a59271\a86ffa20-6c52-465b-a6eb-18ea04a59271.jsonl"
)
text = transcript.read_text(encoding="utf-8")
patterns = [
    r"\.btn-pay[^{]*\{[^}]+\}",
    r"\.option-pay[^{]*\{[^}]+\}",
    r"\.bank[^{]{0,40}\{[^}]+\}",
    r"Selecciona un banco",
    r"Otras Entidades",
    r"is-active",
    r"hover-color",
]
# Find the CSS dump that contains Medio de pago styles
m = re.search(r"Medio de pago.{0,5000}Selecciona un banco", text, re.S | re.I)
print("CSS context found:", bool(m))
if m:
    chunk = m.group(0)[:2000]
    print(chunk[:1500])

# Search for class names around bank selection in CSS paste
for cls in [
    "btn-option-pay",
    "option-method",
    "pay-method",
    "banks-aval",
    "bank-item",
    "item-bank",
    "select-bank",
    "content-banks",
    "btnAval",
    "btn-aval",
]:
    print(cls, text.lower().count(cls.lower()))

# Pull CSS rules containing bank / method from the big CSS message
msg_idx = None
for i, line in enumerate(text.splitlines()):
    if "btn-primary-color:#00ddf4" in line and "Otras Entidades" in line:
        msg_idx = i
        print("found pasarela CSS message at line", i, "len", len(line))
        # extract interesting rules
        for rule in re.findall(
            r"(\.[a-zA-Z0-9_-]*(?:bank|aval|method|pay|pse|radio|person|option)[a-zA-Z0-9_-]*)\{([^}]{0,400})\}",
            line,
            re.I,
        ):
            print("RULE", rule[0], "=>", rule[1][:220].replace("\\n", " "))
        break

# --- Visual structure analysis ---


def analyze(path: str, tag: str):
    img = cv2.imread(path)
    h, w = img.shape[:2]
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
    out_dir = Path(r"C:\Users\Lenovo\avalpay-panel\img-crops")
    out_dir.mkdir(exist_ok=True)

    # Detect light-blue background buttons (Aval/Otras) --blue-one #f2f7ff
    blue_one = cv2.inRange(hsv, (95, 5, 240), (120, 40, 255))
    # Selected/hover fill #d9f8ff
    hover = cv2.inRange(hsv, (90, 20, 230), (110, 90, 255))
    # Selected border #27abf4 / #5dbaeb
    border = cv2.inRange(hsv, (90, 80, 180), (115, 255, 255))
    # Gray border #ddd / #cfd8e6
    gray_border = cv2.inRange(hsv, (90, 5, 180), (120, 40, 230))

    print(f"\n=== {tag} {w}x{h} ===")
    print(
        "blue_one",
        int(blue_one.sum() / 255),
        "hover",
        int(hover.sum() / 255),
        "border",
        int(border.sum() / 255),
        "gray_b",
        int(gray_border.sum() / 255),
    )

    # Find connected components for hover (selected bank)
    num, labels, stats, centroids = cv2.connectedComponentsWithStats(hover, 8)
    sel = []
    for i in range(1, num):
        x, y, bw, bh, area = stats[i]
        if area > 200:
            sel.append((area, x, y, bw, bh))
    sel.sort(reverse=True)
    print("hover components:", sel[:8])

    # Find border components
    num, labels, stats, centroids = cv2.connectedComponentsWithStats(border, 8)
    brs = []
    for i in range(1, num):
        x, y, bw, bh, area = stats[i]
        if area > 80:
            brs.append((area, x, y, bw, bh))
    brs.sort(reverse=True)
    print("border components:", brs[:10])

    # Find blue-one button-like regions (top method tabs)
    num, labels, stats, centroids = cv2.connectedComponentsWithStats(blue_one, 8)
    btns = []
    for i in range(1, num):
        x, y, bw, bh, area = stats[i]
        if area > 500 and bw > 60 and bh > 20:
            btns.append((area, x, y, bw, bh))
    btns.sort(reverse=True)
    print("blue-one components:", btns[:10])

    # Horizontal profile of content in top 60px (method buttons)
    top = img[0:55, :]
    # darkness
    dark = (255 - cv2.cvtColor(top, cv2.COLOR_BGR2GRAY)).mean(axis=0)
    # find peaks / plateaus for two buttons
    thresh = dark.mean() * 0.5
    regions = []
    in_r = False
    start = 0
    for i, v in enumerate(dark):
        if v > thresh and not in_r:
            in_r = True
            start = i
        elif v <= thresh and in_r:
            in_r = False
            if i - start > 40:
                regions.append((start, i))
    if in_r and w - start > 40:
        regions.append((start, w))
    print("top content regions:", regions)

    # Annotate
    ann = img.copy()
    for area, x, y, bw, bh in sel[:5]:
        cv2.rectangle(ann, (x, y), (x + bw, y + bh), (0, 255, 0), 1)
    for area, x, y, bw, bh in brs[:5]:
        cv2.rectangle(ann, (x, y), (x + bw, y + bh), (0, 0, 255), 1)
    for area, x, y, bw, bh in btns[:5]:
        cv2.rectangle(ann, (x, y), (x + bw, y + bh), (255, 0, 0), 1)
    cv2.imwrite(str(out_dir / f"{tag}-struct.png"), ann)

    # Save masks for inspection
    cv2.imwrite(str(out_dir / f"{tag}-hover.png"), hover)
    cv2.imwrite(str(out_dir / f"{tag}-border.png"), border)
    cv2.imwrite(str(out_dir / f"{tag}-blueone.png"), blue_one)

    # Sample colors at key expected positions for 4-bank row
    # Assume banks centered in lower half
    print("sample grid colors (RGB):")
    for yi in [int(h * 0.25), int(h * 0.55), int(h * 0.8)]:
        row = []
        for xi in [int(w * r) for r in (0.12, 0.3, 0.5, 0.7, 0.88)]:
            b, g, r = img[min(yi, h - 1), min(xi, w - 1)]
            row.append(f"({xi},{yi})=#{r:02x}{g:02x}{b:02x}")
        print(" ", " | ".join(row))


analyze(r"C:\Users\Lenovo\avalpay-panel\img1-original.png", "orig")
analyze(r"C:\Users\Lenovo\avalpay-panel\img2-nuestra.png", "ours")

# Try OCR with pytesseract if available
try:
    import pytesseract
    from PIL import Image

    for p in [
        r"C:\Users\Lenovo\avalpay-panel\img1-original.png",
        r"C:\Users\Lenovo\avalpay-panel\img2-nuestra.png",
    ]:
        im = Image.open(p)
        # upscale
        im2 = im.resize((im.width * 3, im.height * 3))
        txt = pytesseract.image_to_string(im2, lang="spa+eng")
        print("OCR", Path(p).name, ":", repr(txt[:500]))
except Exception as e:
    print("OCR failed:", e)
