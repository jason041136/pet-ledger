# -*- coding: utf-8 -*-
"""怪獸小窩立繪產生器 — Jelly Pop 風格
用法: python gen_pets.py pulu_idle
輸出: ../img/pets/{name}.png (1024x1024 透明背景)
"""
import math
import sys
import os
from PIL import Image, ImageDraw, ImageFilter, ImageChops

S = 4                # 超取樣倍數
W = 1024 * S
OUT = os.path.join(os.path.dirname(__file__), '..', 'img', 'pets')

OUTLINE = (59, 29, 18, 255)      # #3B1D12 暖褐描邊
STROKE = 14 * S                  # 描邊粗細


def blob_points(cx, cy, rx, ry, wob1=0.045, wob2=0.02, flat=0.82, n=240, seed=0.0):
    """參數化果凍輪廓：不完美的圓 + 壓扁的底"""
    pts = []
    for i in range(n):
        t = i / n * 2 * math.pi
        r = 1 + wob1 * math.sin(3 * t + seed) + wob2 * math.sin(7 * t + seed * 2.3)
        x = cx + rx * r * math.cos(t)
        y = cy + ry * r * math.sin(t)
        maxy = cy + ry * flat
        if y > maxy:  # 底部壓扁
            y = maxy + (y - maxy) * 0.25
        pts.append((x, y))
    return pts


def mask_of(size, draw_fn):
    m = Image.new('L', size, 0)
    d = ImageDraw.Draw(m)
    draw_fn(d)
    return m


def dilate(mask, px):
    """快速近似膨脹：高斯模糊 + 閾值（圓角接合，正合果凍風）"""
    blurred = mask.filter(ImageFilter.GaussianBlur(px * 0.55))
    return blurred.point(lambda v: 255 if v > 60 else 0)


def paste_color(canvas, color, mask):
    layer = Image.new('RGBA', canvas.size, color)
    canvas.paste(layer, (0, 0), mask)


def cel_shade(canvas, body_mask, color, dx, dy):
    """兩階平塗的陰影月牙：本體遮罩減去位移後的自身"""
    shifted = ImageChops.offset(body_mask, dx, dy)
    crescent = ImageChops.subtract(body_mask, shifted)
    paste_color(canvas, color, crescent)


def ground_shadow(canvas, cx, y, rx, ry):
    m = mask_of(canvas.size, lambda d: d.ellipse([cx - rx, y - ry, cx + rx, y + ry], fill=255))
    m = m.filter(ImageFilter.GaussianBlur(8 * S))
    m = m.point(lambda v: int(v * 0.14))
    paste_color(canvas, (59, 29, 18, 255), m)


def gloss(canvas, body_mask, spots):
    """果凍高光：銳利剪紙邊界的白"""
    m = mask_of(canvas.size, lambda d: [d.ellipse(s, fill=255) for s in spots])
    m = ImageChops.multiply(m, body_mask)
    m = m.point(lambda v: int(v * 0.55))
    paste_color(canvas, (255, 255, 255, 255), m)


def shape_with_outline(canvas, mask, fill):
    paste_color(canvas, OUTLINE, dilate(mask, STROKE))
    paste_color(canvas, fill, mask)


# ============ 噗嚕 pulu：珊瑚橘貪吃鬼史萊姆 ============

PULU = {
    'body': (240, 153, 123, 255),    # #F0997B
    'shade': (213, 111, 82, 255),
    'horn': (166, 67, 31, 255),
    'blush': (245, 168, 140, 255),
}


def curved_horn(cx, cy, rx, ry, side):
    """短胖彎角：貝茲曲線內外緣圍成的月牙尖"""
    bx = cx + side * rx * 0.44          # 角根中心
    by = cy - ry * 0.70
    tipx = bx + side * rx * 0.17        # 角尖（微微外彎的短胖角）
    tipy = by - ry * 0.44
    base_w = rx * 0.30
    pts = []
    # 外緣（鼓起）
    for i in range(13):
        t = i / 12
        x0, y0 = bx + side * base_w / 2, by
        cx1, cy1 = bx + side * base_w * 1.25, by - ry * 0.30
        x = (1 - t) ** 2 * x0 + 2 * (1 - t) * t * cx1 + t ** 2 * tipx
        y = (1 - t) ** 2 * y0 + 2 * (1 - t) * t * cy1 + t ** 2 * tipy
        pts.append((x, y))
    # 內緣（直些）
    for i in range(13):
        t = 1 - i / 12
        x0, y0 = bx - side * base_w / 2, by
        cx1, cy1 = bx + side * base_w * 0.1, by - ry * 0.32
        x = (1 - t) ** 2 * x0 + 2 * (1 - t) * t * cx1 + t ** 2 * tipx
        y = (1 - t) ** 2 * y0 + 2 * (1 - t) * t * cy1 + t ** 2 * tipy
        pts.append((x, y))
    return pts


def pulu_base(canvas, cx, cy, rx, ry, seed=0.7):
    """身體 + 角 + 滴垂凸起，回傳 body_mask"""
    for side in (-1, 1):
        h = mask_of(canvas.size, lambda d: d.polygon(curved_horn(cx, cy, rx, ry, side), fill=255))
        shape_with_outline(canvas, h, PULU['horn'])

    def draw_body(d):
        d.polygon(blob_points(cx, cy, rx, ry, seed=seed), fill=255)
        d.ellipse([cx - rx * 0.28 - 26 * S, cy - ry * 0.98 - 26 * S,
                   cx - rx * 0.28 + 26 * S, cy - ry * 0.98 + 26 * S], fill=255)  # 頭頂滴垂
        d.ellipse([cx + rx * 0.10 - 17 * S, cy - ry * 1.04 - 17 * S,
                   cx + rx * 0.10 + 17 * S, cy - ry * 1.04 + 17 * S], fill=255)
    body = mask_of(canvas.size, draw_body)
    shape_with_outline(canvas, body, PULU['body'])
    cel_shade(canvas, body, PULU['shade'], -34 * S, -40 * S)
    return body


def pulu_face_smug(canvas, cx, cy, rx, ry):
    """半闔奸笑臉"""
    ew, eh = int(rx * 0.155), int(ry * 0.14)
    for sx in (-1, 1):
        ex = cx + sx * rx * 0.30
        ey = cy - ry * 0.10
        eye = mask_of(canvas.size, lambda d: d.ellipse([ex - ew, ey - eh, ex + ew, ey + eh], fill=255))
        lid = mask_of(canvas.size, lambda d: d.rectangle([ex - ew * 1.3, ey - eh * 1.4, ex + ew * 1.3, ey - eh * 0.25], fill=255))
        eye = ImageChops.subtract(eye, lid)  # 切平上緣 = 半闔
        paste_color(canvas, OUTLINE, eye)
        glint = mask_of(canvas.size, lambda d: d.ellipse(
            [ex + ew * 0.25, ey + eh * 0.05, ex + ew * 0.62, ey + eh * 0.5], fill=255))
        paste_color(canvas, (255, 255, 255, 230), glint)

    d = ImageDraw.Draw(canvas)
    mw = 11 * S
    # 不對稱奸笑：二次貝茲，右端上挑
    x0, y0 = cx - rx * 0.30, cy + ry * 0.24
    x1, y1 = cx + rx * 0.05, cy + ry * 0.46   # 控制點（下垂弧度）
    x2, y2 = cx + rx * 0.44, cy + ry * 0.10   # 右端挑高 = 得意
    prev = None
    fang_anchor = None
    for i in range(41):
        t = i / 40
        x = (1 - t) ** 2 * x0 + 2 * (1 - t) * t * x1 + t ** 2 * x2
        y = (1 - t) ** 2 * y0 + 2 * (1 - t) * t * y1 + t ** 2 * y2
        if prev:
            d.line([prev, (x, y)], fill=OUTLINE, width=mw)
        d.ellipse([x - mw / 2, y - mw / 2, x + mw / 2, y + mw / 2], fill=OUTLINE)
        if abs(t - 0.72) < 0.013:
            fang_anchor = (x, y)
        prev = (x, y)
    # 小尖牙掛在奸笑曲線上
    fx, fy = fang_anchor
    d.polygon([(fx - 14 * S, fy + 2 * S), (fx + 14 * S, fy - 2 * S), (fx + 2 * S, fy + 30 * S)],
              fill=(255, 255, 255, 255), outline=OUTLINE, width=3 * S)
    # 腮紅
    for sx in (-1, 1):
        bx = cx + sx * rx * 0.55
        by = cy + ry * 0.18
        bm = mask_of(canvas.size, lambda d2: d2.ellipse([bx - rx * 0.13, by - ry * 0.07, bx + rx * 0.13, by + ry * 0.07], fill=255))
        bm = bm.point(lambda v: int(v * 0.5))
        paste_color(canvas, PULU['blush'], bm)


def gen_pulu_idle():
    canvas = Image.new('RGBA', (W, W), (0, 0, 0, 0))
    cx, cy = W // 2, int(W * 0.55)
    rx, ry = int(W * 0.315), int(W * 0.28)
    ground_shadow(canvas, cx, cy + ry * 0.86, rx * 1.05, ry * 0.16)
    body = pulu_base(canvas, cx, cy, rx, ry)
    gloss(canvas, body, [
        [cx - rx * 0.62, cy - ry * 0.66, cx - rx * 0.18, cy - ry * 0.30],
        [cx - rx * 0.14, cy - ry * 0.72, cx + rx * 0.04, cy - ry * 0.52],
    ])
    pulu_face_smug(canvas, cx, cy, rx, ry)
    return canvas


GENERATORS = {
    'pulu_idle': gen_pulu_idle,
}


if __name__ == '__main__':
    name = sys.argv[1] if len(sys.argv) > 1 else 'pulu_idle'
    img = GENERATORS[name]()
    img = img.resize((1024, 1024), Image.LANCZOS)
    os.makedirs(OUT, exist_ok=True)
    path = os.path.join(OUT, name + '.png')
    img.save(path)
    print('saved', path)
