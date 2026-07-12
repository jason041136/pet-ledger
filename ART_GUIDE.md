# 怪獸小窩 美術規格＋AI 生圖 Prompt 包

## 產圖規格

- **尺寸**：1024×1024，正方形，角色置中、佔畫面約 70%
- **背景**：純白（之後去背）或直接要求透明背景
- **檔名與資料夾**：去背 PNG 放進 `img/pets/`，命名 `{怪獸id}_{狀態}.png`
  - 怪獸 id：`pulu`噗嚕 / `momo`墨墨 / `jin`金金 / `zhuan`磚磚 / `jo`啾啾
  - 狀態：`idle`平常 / `happy`開心 / `fat`肥胖失控 / `sad`被冷落
  - 例：`pulu_fat.png`、`momo_idle.png`，共 5×4＝20 張
- **App 會自動偵測**：有圖用圖、沒圖用內建 SVG，可以一隻一隻慢慢換

## 統一風格字串（每張都要加在 prompt 開頭）

```
cute chibi monster mascot, flat vector sticker style, thick clean dark outline,
simple rounded shapes, soft cel shading, kawaii game asset,
full body, centered, plain white background, square composition
```

負面提示（如果工具支援 negative prompt）：
```
realistic, 3d render, photo, gradient background, text, watermark, human, complex details
```

## 角色一致性的作法（重要！）

1. 每隻先用「idle 平常」的 prompt 生**定裝照**，生到滿意為止
2. 之後三個狀態用**同一張定裝照做 img2img（墊圖）**＋修改 prompt，五官體型才不會跑掉
3. 一隻做完四態再做下一隻，不要交錯

---

## 🔥 噗嚕（pulu）— 貪吃鬼史萊姆・慾望消費

基底設定（每張都加）：
```
a mischievous coral-orange slime blob monster with two small dark red devil horns,
smug half-lidded eyes, wide sly grin, glossy jelly texture,
color palette: coral orange body #F0997B, dark brown features #4A1B0C, dark red horns #993C1D
```

| 狀態 | 追加 prompt |
|---|---|
| idle | sitting contentedly, slight smirk |
| happy | bouncing excitedly, mouth open eating a bubble tea cup, sparkling eyes, drooling slightly |
| fat | extremely round and obese, tiny crown on head, arrogant laughing expression, surrounded by snack crumbs and empty cups |
| sad | deflated and droopy like melting pudding, teary puppy eyes, dramatic fake crying |

## 📚 墨墨（momo）— 書生貓頭鷹・自我提升

```
a round mint-green owl scholar monster wearing big circular glasses,
small amber beak, calm wise expression, two small ear tufts,
color palette: mint green body #5DCAA5, deep teal accents #0F6E56, cream face #E1F5EE
```

| 狀態 | 追加 prompt |
|---|---|
| idle | standing straight holding a tiny old book under wing, serene smile |
| happy | eyes closed in delight, reading an open book, floating sparkles of knowledge around head |
| fat | plump and content, sitting on a pile of books like a throne, adjusting glasses proudly |
| sad | drooping ear tufts, glasses slightly askew, cobweb and dust on head, lonely sigh |

## 💰 金金（jin）— 守財小龍・儲蓄投資

```
a chubby golden-amber baby dragon monster with tiny wings and small brown horns,
proud narrow smile, round belly in lighter cream gold,
color palette: golden amber body #EF9F27, cream belly #FAC775, dark brown features #412402
```

| 狀態 | 追加 prompt |
|---|---|
| idle | sitting beside a small neat stack of gold coins, guarding pose |
| happy | hugging a big gold coin lovingly, tail wagging, eyes shaped like stars |
| fat | majestic and plump, lounging on top of a huge mountain of gold coins, royal smug expression |
| sad | sitting beside three lonely coins, holding an empty coin sack upside down, worried face |

## 🧱 磚磚（zhuan）— 石頭管家・必要開銷

```
a sturdy rectangular gray stone golem monster butler, square dark eyes,
flat calm mouth, one small crack on shoulder, tiny bow tie,
color palette: warm gray stone body #B4B2A9, dark charcoal features #2C2C2A
```

| 狀態 | 追加 prompt |
|---|---|
| idle | standing firmly like a reliable wall, hands at sides, dependable aura |
| happy | small proud smile, polishing itself with a tiny cloth, sparkle of cleanliness |
| fat | slightly wider and heavier build, carrying a huge stack of bills and receipts calmly on head |
| sad | more cracks appearing on body, moss growing on shoulder, slightly tilted posture |

## 🎉 啾啾（jo）— 派對鸚鵡・社交娛樂

```
a cheerful round pink parrot monster with a curly head feather,
big sparkly eyes, small amber beak, one wing raised in greeting,
color palette: pink body #ED93B1, deep rose wings #D4537E, dark plum features #4B1528
```

| 狀態 | 追加 prompt |
|---|---|
| idle | perky and alert, tail feathers fanned slightly |
| happy | dancing with party confetti falling around, wings spread wide, singing note symbols |
| fat | round like a balloon, wearing tilted party hat, exhausted but happy grin, holding empty drink |
| sad | grey-ish faded feathers, drooping head feather, sitting alone with a wilted balloon |

---

## 圖生好之後

1. 去背（用生圖工具內建去背，或 remove.bg）
2. 存成 PNG，照上面的檔名放進 `pet-ledger/img/pets/`
3. 重新整理 App 兩次——有圖的怪獸自動換裝，缺的照舊用 SVG
4. 狀態切換規則（App 自動判斷）：當月佔比 ≥35% → fat；今天餵過 → happy；超過 7 天沒餵 → sad；其他 → idle
