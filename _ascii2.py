import cv2
import numpy as np
from pathlib import Path


def ascii_img(path, cols=120):
    img = cv2.imread(path)
    h, w = img.shape[:2]
    scale = cols / w
    rows = max(12, int(h * scale * 0.55))
    small = cv2.resize(img, (cols, rows), interpolation=cv2.INTER_AREA)
    gray = cv2.cvtColor(small, cv2.COLOR_BGR2GRAY)
    hsv = cv2.cvtColor(small, cv2.COLOR_BGR2HSV)
    print("\n", Path(path).name, f"{w}x{h} -> {cols}x{rows}")
    for y in range(rows):
        line = []
        for x in range(cols):
            g = int(gray[y, x])
            hh, s, v = [int(t) for t in hsv[y, x]]
            if 85 <= hh <= 115 and s > 35 and v > 160:
                line.append("B")  # cyan/blue UI
            elif (hh <= 10 or hh >= 170) and s > 50 and v > 70:
                line.append("R")  # red logos
            elif 15 <= hh <= 40 and s > 50 and v > 70:
                line.append("Y")  # yellow/orange
            elif g > 248:
                line.append(" ")
            elif g > 230:
                line.append(".")
            elif g > 200:
                line.append(":")
            elif g > 150:
                line.append("+")
            elif g > 100:
                line.append("#")
            else:
                line.append("@")
        print("".join(line))


def edge_boxes(path, tag):
    img = cv2.imread(path)
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    # detect rectangles via morph on edges of non-white
    mask = cv2.threshold(gray, 245, 255, cv2.THRESH_BINARY_INV)[1]
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, np.ones((3, 3), np.uint8), iterations=2)
    cnts, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    boxes = []
    h, w = img.shape[:2]
    for c in cnts:
        x, y, bw, bh = cv2.boundingRect(c)
        area = bw * bh
        if area < 500 or area > w * h * 0.7:
            continue
        boxes.append((x, y, bw, bh, area))
    boxes.sort(key=lambda t: (t[1], t[0]))
    print(f"\n{tag} content boxes:")
    for b in boxes:
        x, y, bw, bh, area = b
        # classify by aspect
        ar = bw / bh
        kind = "wide" if ar > 1.6 else ("square" if 0.7 < ar < 1.4 else "tall")
        # border color sample
        yy = min(y + 2, h - 1)
        bgr = img[yy, x : x + bw].mean(axis=0)
        print(
            f"  {kind:6} ({x:3},{y:3}) {bw:3}x{bh:<3} area={area:5} borderRGB=#{int(bgr[2]):02x}{int(bgr[1]):02x}{int(bgr[0]):02x}"
        )
    ann = img.copy()
    for x, y, bw, bh, _ in boxes:
        cv2.rectangle(ann, (x, y), (x + bw, y + bh), (0, 0, 255), 1)
    cv2.imwrite(rf"C:\Users\Lenovo\avalpay-panel\img-crops\{tag}-boxes.png", ann)


ascii_img(r"C:\Users\Lenovo\avalpay-panel\img1-original.png", 130)
ascii_img(r"C:\Users\Lenovo\avalpay-panel\img2-nuestra.png", 130)
edge_boxes(r"C:\Users\Lenovo\avalpay-panel\img1-original.png", "orig")
edge_boxes(r"C:\Users\Lenovo\avalpay-panel\img2-nuestra.png", "ours")

# Read extracted rules
rules = Path(r"C:\Users\Lenovo\avalpay-panel\_orig_pasarela_rules.txt")
print("\n--- RULES FILE ---")
print(rules.read_text(encoding="utf-8")[:4000])
