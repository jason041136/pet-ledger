# -*- coding: utf-8 -*-
"""AI 生圖後處理：白底轉透明 → 裁切 → 補方 → 縮 1024 → 依命名放入 img/pets"""
import os
from PIL import Image, ImageDraw

SRC = r'C:\Users\USER\Downloads\新增資料夾'
DST = os.path.join(os.path.dirname(__file__), '..', 'img', 'pets')

MAPPING = {
    'ChatGPT Image 2026年7月11日 下午05_51_47.png': 'pulu_idle',
    'ChatGPT Image 2026年7月11日 下午06_12_51.png': 'pulu_happy',
    'ChatGPT Image 2026年7月11日 下午06_14_07.png': 'pulu_fat',
    'ChatGPT Image 2026年7月11日 下午06_55_03.png': 'jin_idle',
    'ChatGPT Image 2026年7月11日 下午06_55_07.png': 'jin_happy',
    'Gemini_Generated_Image_zhscbezhscbezhsc.png': 'momo_idle',
    'Gemini_Generated_Image_78ue0j78ue0j78ue.png': 'momo_happy',
    'Gemini_Generated_Image_8h2anf8h2anf8h2a.png': 'momo_fat',
    'Gemini_Generated_Image_ggsy3zggsy3zggsy.png': 'momo_sad',
    'Gemini_Generated_Image_1o12161o12161o12.png': 'zhuan_idle',
    'Gemini_Generated_Image_v7akjkv7akjkv7ak.png': 'zhuan_happy',
    'Gemini_Generated_Image_cb0qoscb0qoscb0q.png': 'zhuan_fat',
    'Gemini_Generated_Image_b6jlp5b6jlp5b6jl.png': 'zhuan_sad',
    'Gemini_Generated_Image_db7vzodb7vzodb7v.png': 'jo_idle',
    'Gemini_Generated_Image_nxai3enxai3enxai.png': 'jo_happy',
    'Gemini_Generated_Image_bvsbj4bvsbj4bvsb.png': 'jo_fat',
    'Gemini_Generated_Image_oj37nqoj37nqoj37.png': 'jo_sad',
}


def process(src_path, dst_path):
    img = Image.open(src_path).convert('RGBA')
    # 白底轉透明：從四角 flood fill
    for corner in [(0, 0), (img.width - 1, 0), (0, img.height - 1), (img.width - 1, img.height - 1)]:
        try:
            ImageDraw.floodfill(img, corner, (0, 0, 0, 0), thresh=32)
        except Exception:
            pass
    # 裁掉透明邊，留 6% 邊距
    bbox = img.getbbox()
    if bbox:
        img = img.crop(bbox)
    m = int(max(img.size) * 0.06)
    side = max(img.size) + m * 2
    canvas = Image.new('RGBA', (side, side), (0, 0, 0, 0))
    canvas.paste(img, ((side - img.width) // 2, (side - img.height) // 2), img)
    canvas = canvas.resize((1024, 1024), Image.LANCZOS)
    canvas.save(dst_path)


if __name__ == '__main__':
    os.makedirs(DST, exist_ok=True)
    done, missing = [], []
    for src, name in MAPPING.items():
        p = os.path.join(SRC, src)
        if not os.path.exists(p):
            missing.append(src)
            continue
        process(p, os.path.join(DST, name + '.png'))
        done.append(name)
    print('processed:', len(done))
    for n in sorted(done):
        print(' ', n)
    if missing:
        print('missing sources:', missing)
