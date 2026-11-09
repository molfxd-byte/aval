import cv2
import numpy as np
from pathlib import Path


def sample_rect(img, x, y, w, h):
    crop = img[y : y + h, x : x + w]
    mean = crop.mean(axis=(0, 1))
    return tuple(int(v) for v in mean[::-1])  # RGB


def find_top_buttons(path, tag):
    img = cv2.imread(path)
    h, w = img.shape[:2]
    # Top strip for method buttons - look for non-white rows
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    # find first content row with darker pixels
    for y0 in range(0, h // 3):
        if (gray[y0] < 230).sum() > w * 0.05:
            break
    # find button band height
    y1 = y0
    while y1 < h // 2 and (gray[y1] < 245).sum() > w * 0.02:
        y1 += 1
    band = img[y0:y1, :]
    print(f"\n{tag} method band y={y0}:{y1} h={y1-y0}")
    # split by vertical white gaps
    col_dark = (cv2.cvtColor(band, cv2.COLOR_BGR2GRAY) < 240).mean(axis=0)
    regions = []
    in_r = False
    s = 0
    for i, v in enumerate(col_dark):
        if v > 0.02 and not in_r:
            in_r = True
            s = i
        elif v <= 0.02 and in_r:
            in_r = False
            if i - s > 30:
                regions.append((s, i))
    if in_r and w - s > 30:
        regions.append((s, w))
    print("  regions", regions)
    for i, (a, b) in enumerate(regions[:4]):
        rgb = sample_rect(img, a, y0, b - a, max(1, y1 - y0))
        # corners to detect bg
        bg = sample_rect(img, a + 5, y0 + 5, 10, 10)
        print(f"  btn{i} x={a}-{b} meanRGB={rgb} cornerRGB={bg}")


def bank_card_stats(path, tag):
    img = cv2.imread(path)
    h, w = img.shape[:2]
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
    # selected-like: strong cyan border OR fill
    fill = cv2.inRange(hsv, (85, 25, 200), (115, 120, 255))
    border = cv2.inRange(hsv, (90, 70, 170), (115, 255, 255))
    # gray card borders
    # detect approx square cards in lower 70%
    roi = img[int(h * 0.25) :, :]
    gray = cv2.cvtColor(roi, cv2.COLOR_BGR2GRAY)
    edges = cv2.Canny(gray, 50, 150)
    edges = cv2.dilate(edges, np.ones((2, 2), np.uint8), iterations=1)
    cnts, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    cards = []
    for c in cnts:
        x, y, bw, bh = cv2.boundingRect(c)
        y += int(h * 0.25)
        if bw < 50 or bh < 50 or bw > 280 or bh > 200:
            continue
        ar = bw / bh
        if 0.55 < ar < 2.2:
            # measure fill ratio inside
            inner = fill[y + 4 : y + bh - 4, x + 4 : x + bw - 4]
            bord = border[y : y + bh, x : x + bw]
            fill_pct = 100 * inner.mean() / 255 if inner.size else 0
            bord_pct = 100 * bord.mean() / 255 if bord.size else 0
            bg = sample_rect(img, x + bw // 3, y + bh // 3, bw // 3, bh // 3)
            border_c = sample_rect(img, x, y, bw, 3)
            cards.append((x, y, bw, bh, fill_pct, bord_pct, bg, border_c))
    cards.sort(key=lambda t: t[0])
    # dedupe overlapping
    kept = []
    for c in cards:
        if any(abs(c[0] - k[0]) < 20 and abs(c[1] - k[1]) < 20 for k in kept):
            continue
        kept.append(c)
    print(f"\n{tag} bank-like cards:")
    for c in kept:
        x, y, bw, bh, fp, bp, bg, bc = c
        print(
            f"  ({x},{y}) {bw}x{bh} fill%={fp:.1f} border%={bp:.1f} centerRGB={bg} topBorderRGB={bc}"
        )


find_top_buttons(r"C:\Users\Lenovo\avalpay-panel\img1-original.png", "ORIG")
find_top_buttons(r"C:\Users\Lenovo\avalpay-panel\img2-nuestra.png", "OURS")
bank_card_stats(r"C:\Users\Lenovo\avalpay-panel\img1-original.png", "ORIG")
bank_card_stats(r"C:\Users\Lenovo\avalpay-panel\img2-nuestra.png", "OURS")

# Compare method active: white vs blue-one
# In ORIG large selected area fill color histogram
img = cv2.imread(r"C:\Users\Lenovo\avalpay-panel\img1-original.png")
crop = img[80:190, 170:400]
print("\nORIG selected crop mean RGB", sample_rect(img, 170, 80, 230, 110))
print("ORIG selected crop unique-ish via resize:")
tiny = cv2.resize(crop, (8, 5), interpolation=cv2.INTER_AREA)
for row in tiny:
    print(" ", ["#%02x%02x%02x" % (p[2], p[1], p[0]) for p in row])

img2 = cv2.imread(r"C:\Users\Lenovo\avalpay-panel\img2-nuestra.png")
print("\nOURS selected crop mean RGB", sample_rect(img2, 145, 58, 88, 64))
crop2 = img2[58:122, 145:233]
tiny2 = cv2.resize(crop2, (8, 5), interpolation=cv2.INTER_AREA)
for row in tiny2:
    print(" ", ["#%02x%02x%02x" % (p[2], p[1], p[0]) for p in row])
