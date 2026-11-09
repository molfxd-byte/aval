from PIL import Image, ImageDraw
import os, collections

orig = Image.open(r'C:\Users\Lenovo\avalpay-panel\img1-original.png').convert('RGB')
ours = Image.open(r'C:\Users\Lenovo\avalpay-panel\img2-nuestra.png').convert('RGB')
out = r'C:\Users\Lenovo\avalpay-panel\img-crops'
os.makedirs(out, exist_ok=True)

def find_nonwhite_bbox(im, thresh=248):
    w, h = im.size
    px = im.load()
    minx, miny, maxx, maxy = w, h, 0, 0
    found = False
    for y in range(h):
        for x in range(w):
            r, g, b = px[x, y]
            if r < thresh or g < thresh or b < thresh:
                found = True
                minx = min(minx, x)
                miny = min(miny, y)
                maxx = max(maxx, x)
                maxy = max(maxy, y)
    return (minx, miny, maxx, maxy) if found else None

print('ORIG content bbox', find_nonwhite_bbox(orig))
print('OURS content bbox', find_nonwhite_bbox(ours))

def is_sel_blue(c):
    r, g, b = c
    return b > 160 and b > r + 30 and g > 100

def is_dark_blue(c):
    r, g, b = c
    return b > 100 and b > r + 40 and r < 80

def is_gray_border(c):
    r, g, b = c
    return abs(r - g) < 12 and abs(g - b) < 12 and 160 < r < 230

def is_light_blue_fill(c):
    r, g, b = c
    # light cyan/blue fill like #B5DFF7
    return r > 140 and r < 230 and g > 190 and b > 220 and b > r + 10 and g >= r

def map_mask(im, pred, name):
    w, h = im.size
    px = im.load()
    mask = Image.new('RGB', (w, h), (255, 255, 255))
    mp = mask.load()
    count = 0
    ys = []
    xs = []
    for y in range(h):
        for x in range(w):
            if pred(px[x, y]):
                mp[x, y] = (255, 0, 0)
                count += 1
                ys.append(y)
                xs.append(x)
    mask.save(os.path.join(out, name))
    if xs:
        print(name, 'count', count, 'bbox', (min(xs), min(ys), max(xs), max(ys)))
    else:
        print(name, 'count 0')
    return xs, ys

print('\n--- ORIG masks ---')
map_mask(orig, is_sel_blue, 'mask-orig-selblue.png')
map_mask(orig, is_dark_blue, 'mask-orig-darkblue.png')
map_mask(orig, is_gray_border, 'mask-orig-gray.png')
map_mask(orig, is_light_blue_fill, 'mask-orig-lightfill.png')

print('\n--- OURS masks ---')
map_mask(ours, is_sel_blue, 'mask-ours-selblue.png')
map_mask(ours, is_dark_blue, 'mask-ours-darkblue.png')
map_mask(ours, is_gray_border, 'mask-ours-gray.png')
map_mask(ours, is_light_blue_fill, 'mask-ours-lightfill.png')

def hproj(im, thresh=250):
    w, h = im.size
    px = im.load()
    dens = []
    for y in range(h):
        n = 0
        for x in range(w):
            r, g, b = px[x, y]
            if r < thresh or g < thresh or b < thresh:
                n += 1
        dens.append(n)
    return dens

def print_bands(name, dens, thresh=30):
    print(f'\n{name} content bands (density>{thresh}):')
    inb = False
    start = 0
    for y, d in enumerate(dens):
        if d > thresh and not inb:
            inb = True
            start = y
        elif d <= thresh and inb:
            inb = False
            print(f'  y={start}-{y-1} maxdens={max(dens[start:y])}')
    if inb:
        print(f'  y={start}-{len(dens)-1} maxdens={max(dens[start:])}')

def vproj(im, y0, y1, thresh=250):
    w, h = im.size
    px = im.load()
    dens = []
    for x in range(w):
        n = 0
        for y in range(y0, min(y1, h)):
            r, g, b = px[x, y]
            if r < thresh or g < thresh or b < thresh:
                n += 1
        dens.append(n)
    return dens

def print_cols(name, dens, thresh=5):
    print(f'{name} columns:')
    inb = False
    start = 0
    for x, d in enumerate(dens):
        if d > thresh and not inb:
            inb = True
            start = x
        elif d <= thresh and inb:
            inb = False
            print(f'  x={start}-{x-1} w={x-start} maxd={max(dens[start:x])}')
    if inb:
        print(f'  x={start}-{len(dens)-1} w={len(dens)-start}')

print_bands('ORIG', hproj(orig))
print_bands('OURS', hproj(ours))

print('\nORIG method band cols (y70-115):')
print_cols('orig-methods', vproj(orig, 70, 115), 8)
print('\nORIG bank band cols (y120-210):')
print_cols('orig-banks', vproj(orig, 120, 210), 8)
print('\nOURS top band cols (y0-80):')
print_cols('ours-top', vproj(ours, 0, 80), 5)
print('\nOURS bot band cols (y70-149):')
print_cols('ours-bot', vproj(ours, 70, 149), 5)

# Crop key regions and save 3x for visual Read
def save_crop(im, box, name, scale=3):
    c = im.crop(box)
    c.resize((c.width * scale, c.height * scale), Image.NEAREST).save(os.path.join(out, name))
    print('saved', name, 'from', box, 'src size', c.size)

# ORIG: header strip, methods, banks
save_crop(orig, (0, 0, 582, 50), 'vis-orig-header.png')
save_crop(orig, (0, 50, 582, 130), 'vis-orig-methods.png')
save_crop(orig, (0, 115, 582, 227), 'vis-orig-banks.png')
save_crop(ours, (0, 0, 426, 80), 'vis-ours-top.png')
save_crop(ours, (0, 60, 426, 149), 'vis-ours-bot.png')
save_crop(orig, (0, 0, 582, 227), 'vis-orig-full3x.png', 3)
save_crop(ours, (0, 0, 426, 149), 'vis-ours-full3x.png', 3)
