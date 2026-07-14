export const PETS = [
  {
    id: 'pulu', name: '噗嚕', title: '慾望消費', color: '#F0997B', deep: '#993C1D',
    svg: `<svg viewBox="0 0 100 100"><path d="M30 26 L24 8 L40 19Z" fill="#993C1D"/><path d="M70 26 L76 8 L60 19Z" fill="#993C1D"/><path d="M50 18 C76 18 89 40 87 62 C85 83 68 92 50 92 C32 92 15 83 13 62 C11 40 24 18 50 18Z" fill="#F0997B"/><rect x="29" y="44" width="15" height="7" rx="3.5" fill="#4A1B0C"/><rect x="56" y="44" width="15" height="7" rx="3.5" fill="#4A1B0C"/><path d="M36 64 Q50 76 68 61" stroke="#4A1B0C" stroke-width="4" fill="none" stroke-linecap="round"/></svg>`
  },
  {
    id: 'momo', name: '墨墨', title: '自我提升', color: '#5DCAA5', deep: '#0F6E56',
    svg: `<svg viewBox="0 0 100 100"><path d="M28 28 L22 12 L38 22Z" fill="#0F6E56"/><path d="M72 28 L78 12 L62 22Z" fill="#0F6E56"/><circle cx="50" cy="58" r="35" fill="#5DCAA5"/><circle cx="37" cy="50" r="11" fill="#E1F5EE" stroke="#04342C" stroke-width="3"/><circle cx="63" cy="50" r="11" fill="#E1F5EE" stroke="#04342C" stroke-width="3"/><line x1="48" y1="50" x2="52" y2="50" stroke="#04342C" stroke-width="3"/><circle cx="37" cy="50" r="3.5" fill="#04342C"/><circle cx="63" cy="50" r="3.5" fill="#04342C"/><path d="M46 66 L50 72 L54 66Z" fill="#BA7517"/></svg>`
  },
  {
    id: 'jin', name: '金金', title: '儲蓄投資', color: '#EF9F27', deep: '#854F0B',
    svg: `<svg viewBox="0 0 100 100"><rect x="64" y="70" width="24" height="12" rx="4" fill="#FAC775" stroke="#854F0B" stroke-width="2.5"/><rect x="66" y="56" width="20" height="12" rx="4" fill="#FAC775" stroke="#854F0B" stroke-width="2.5"/><path d="M40 22 L34 6 L48 15Z" fill="#854F0B"/><path d="M58 20 L64 5 L50 14Z" fill="#854F0B"/><circle cx="46" cy="58" r="33" fill="#EF9F27"/><ellipse cx="46" cy="70" rx="18" ry="13" fill="#FAC775"/><circle cx="36" cy="48" r="4.5" fill="#412402"/><circle cx="56" cy="48" r="4.5" fill="#412402"/><path d="M40 58 Q46 63 52 58" stroke="#412402" stroke-width="3.5" fill="none" stroke-linecap="round"/></svg>`
  },
  {
    id: 'zhuan', name: '磚磚', title: '必要開銷', color: '#B4B2A9', deep: '#5F5E5A',
    svg: `<svg viewBox="0 0 100 100"><rect x="20" y="24" width="60" height="64" rx="12" fill="#B4B2A9"/><rect x="30" y="42" width="12" height="10" rx="2" fill="#2C2C2A"/><rect x="58" y="42" width="12" height="10" rx="2" fill="#2C2C2A"/><line x1="36" y1="68" x2="64" y2="68" stroke="#2C2C2A" stroke-width="4" stroke-linecap="round"/><path d="M64 24 L58 34 L66 40" stroke="#888780" stroke-width="3" fill="none"/></svg>`
  },
  {
    id: 'jo', name: '啾啾', title: '社交娛樂', color: '#ED93B1', deep: '#993556',
    svg: `<svg viewBox="0 0 100 100"><path d="M50 22 C50 10 60 6 64 8 C60 12 58 18 56 24Z" fill="#D4537E"/><circle cx="50" cy="58" r="34" fill="#ED93B1"/><ellipse cx="62" cy="66" rx="13" ry="17" fill="#D4537E"/><circle cx="38" cy="48" r="5" fill="#4B1528"/><circle cx="56" cy="48" r="5" fill="#4B1528"/><path d="M42 60 L47 68 L52 60Z" fill="#BA7517"/></svg>`
  }
];

export const DEFAULT_CATS = [
  { id: 'bubbletea', name: '手搖飲', emo: '🧋', pet: 'pulu' },
  { id: 'snack', name: '零食點心', emo: '🍟', pet: 'pulu' },
  { id: 'latenight', name: '宵夜', emo: '🌙', pet: 'pulu' },
  { id: 'shopping', name: '購物', emo: '🛍️', pet: 'pulu' },
  { id: 'gacha', name: '課金儲值', emo: '🎮', pet: 'pulu' },
  { id: 'books', name: '書籍課程', emo: '📚', pet: 'momo' },
  { id: 'gym', name: '健身運動', emo: '💪', pet: 'momo' },
  { id: 'saving', name: '儲蓄', emo: '🐖', pet: 'jin' },
  { id: 'invest', name: '投資', emo: '📈', pet: 'jin' },
  { id: 'rent', name: '房租', emo: '🏠', pet: 'zhuan' },
  { id: 'utils', name: '水電網路', emo: '💡', pet: 'zhuan' },
  { id: 'transport', name: '交通', emo: '🚌', pet: 'zhuan' },
  { id: 'breakfast', name: '早餐', emo: '🍳', pet: 'zhuan' },
  { id: 'lunch', name: '午餐', emo: '🍜', pet: 'zhuan' },
  { id: 'dinner', name: '晚餐', emo: '🍛', pet: 'zhuan' },
  { id: 'daily', name: '日用品', emo: '🧻', pet: 'zhuan' },
  { id: 'social', name: '聚餐社交', emo: '🍻', pet: 'jo' },
  { id: 'fun', name: '娛樂', emo: '🎬', pet: 'jo' },
  { id: 'travel', name: '旅遊', emo: '✈️', pet: 'jo' },
  { id: 'coffee', name: '咖啡', emo: '☕', pet: 'zhuan' },
  { id: 'clothes', name: '治裝', emo: '👕', pet: 'pulu' },
  { id: 'tech', name: '3C配件', emo: '📱', pet: 'pulu' },
  { id: 'beauty', name: '美容美髮', emo: '💇', pet: 'jo' },
  { id: 'gift', name: '紅包禮金', emo: '🧧', pet: 'jo' },
  { id: 'medical', name: '醫療健康', emo: '🏥', pet: 'zhuan' },
  { id: 'home', name: '家居用品', emo: '🛋️', pet: 'zhuan' },
  { id: 'insurance', name: '保險', emo: '🛡️', pet: 'zhuan' },
  { id: 'petcare', name: '寵物', emo: '🐾', pet: 'zhuan' },
  { id: 'other', name: '其他', emo: '🏷️', pet: 'zhuan' }
];

/* 已被拆分/移除、但舊帳目仍需要顯示的分類 */
export const LEGACY_CATS = [
  { id: 'meals', name: '三餐', emo: '🍱', pet: 'zhuan' }
];

export const DIALOG = {
  pulu: {
    feed: [
      '嘿嘿，{cat}入手！這是本月第 {n} 次囉～',
      '才 {amt}？小意思啦，下次課大一點嘛',
      '香～你的錢錢變成我的肥肉了，讚喔',
      '本月第 {n} 筆{cat}…你根本離不開我吧？嘻嘻'
    ],
    idle: {
      low: [
        '哼，{days} 天沒餵我了…你很自律嘛，無聊',
        '這個月我只佔 {share}%？你變了…'
      ],
      mid: [
        '嘻嘻，這個月你餵了我 {total}，感覺不錯喔',
        '要不要…再來一杯手搖？我不會跟別人說的'
      ],
      high: [
        '哇哈哈！本月 {share}% 都進我肚子！我就是這個家的老大！',
        '{total} 全部變成我的肥肉！你完蛋了嘿嘿'
      ]
    }
  },
  momo: {
    feed: [
      '善哉！{cat}乃立身之本',
      '今日投資 {amt} 於己身，明日必有所成',
      '本月第 {n} 筆自我提升，孺子可教也'
    ],
    idle: {
      low: [
        '主人…{days} 天未曾進學了，老朽甚憂',
        '書卷都積灰了…該讀點書了吧'
      ],
      mid: ['本月修身 {total}，穩紮穩打，甚好'],
      high: ['吾主勤學不倦！此月 {share}% 皆為成長之資，老朽與有榮焉！']
    }
  },
  jin: {
    feed: [
      '入庫 {amt}！金山又高了一寸，甚好甚好',
      '本月第 {n} 筆進帳，朕心甚慰',
      '嗯～金幣的味道，真香'
    ],
    idle: {
      low: [
        '金山…{days} 天沒有長高了，吾王…',
        '本月僅佔 {share}%？國庫堪憂啊'
      ],
      mid: ['本月已囤 {total}，金山穩固'],
      high: ['哈哈哈！{share}% 盡入國庫！誰能撼動朕的金山！']
    }
  },
  zhuan: {
    feed: [
      '{cat} {amt}，記下了。安穩如山',
      '該繳的繳，日子才踏實'
    ],
    idle: {
      low: ['…這個月的固定開銷，都處理了嗎'],
      mid: ['本月必要開銷 {total}，一切如常'],
      high: ['必要開銷佔了 {share}%…建議檢查一下固定支出有沒有能省的']
    }
  },
  jo: {
    feed: [
      '耶！{cat}！生活就是要這樣～',
      '本月第 {n} 攤！記得拍照打卡喔'
    ],
    idle: {
      low: ['{days} 天都沒出去玩了…我的羽毛都要灰了啦！'],
      mid: ['這個月玩了 {total}，剛剛好的快樂～'],
      high: ['咳咳…{share}% 都在玩，太兇了啦，嗓子都啞了…']
    }
  }
};

/* 帳戶。tracked=true 代表是真資產、有餘額（現金/銀行/悠遊卡/投資）；
   信用卡走簡單模式 tracked=false，只當支付標籤、不追餘額。
   initBalance = 使用者設定的起始餘額，目前餘額由交易即時計算。 */
/* type: cash/bank/easycard/invest = 資產（正餘額）；card = 信用卡（負餘額 = 待繳）。
   全部 tracked（有餘額）。淨資產 = 資產總額 − 信用卡待繳。 */
export const DEFAULT_PAYMENTS = [
  { id: 'cash', name: '現金', emo: '💵', type: 'cash', tracked: true, initBalance: 0, order: 0 },
  { id: 'bank', name: '銀行帳戶', emo: '🏦', type: 'bank', tracked: true, initBalance: 0, order: 1 },
  { id: 'easycard', name: '悠遊卡', emo: '🚌', type: 'easycard', tracked: true, initBalance: 0, order: 2 },
  { id: 'richart', name: '台新Richart', emo: '💳', type: 'card', tracked: true, initBalance: 0, order: 3 },
  { id: 'sinopac', name: '永豐卡', emo: '💳', type: 'card', tracked: true, initBalance: 0, order: 4 }
];

export const ACCOUNT_TYPES = [
  { type: 'cash', label: '現金', emo: '💵', tracked: true },
  { type: 'bank', label: '銀行帳戶', emo: '🏦', tracked: true },
  { type: 'easycard', label: '悠遊卡／電子票證', emo: '🚌', tracked: true },
  { type: 'invest', label: '投資帳戶', emo: '📈', tracked: true },
  { type: 'card', label: '信用卡', emo: '💳', tracked: true }
];

export const isCard = (a) => a && a.type === 'card';
export const isAsset = (a) => a && a.tracked && a.type !== 'card';

/* 收入分類（餵金金——收入越多金金越開心） */
export const INCOME_CATS = [
  { id: 'salary', name: '薪水', emo: '💼' },
  { id: 'bonus', name: '獎金', emo: '🎯' },
  { id: 'redpack', name: '紅包禮金', emo: '🧧' },
  { id: 'refund', name: '退款', emo: '↩️' },
  { id: 'invest_gain', name: '投資收益', emo: '📈' },
  { id: 'sidejob', name: '副業外快', emo: '💡' },
  { id: 'income_other', name: '其他收入', emo: '🪙' }
];

export const incomeCatById = (id) =>
  INCOME_CATS.find((c) => c.id === id) || { id, name: '其他收入', emo: '🪙' };

/* ===== 金幣經濟 ===== */
export const COIN = {
  perRecord: 3,       // 每筆手動記帳
  dailyBonus: 15      // 每天第一筆的登入獎勵
};

/* 怪獸裝扮（emoji 配件，戴在頭上）。之後可換成精緻美術。 */
export const COSTUMES = [
  { id: 'bow', emo: '🎀', name: '蝴蝶結', price: 50 },
  { id: 'flower', emo: '🌸', name: '小花', price: 50 },
  { id: 'cap', emo: '🧢', name: '棒球帽', price: 90 },
  { id: 'grad', emo: '🎓', name: '學士帽', price: 120 },
  { id: 'tophat', emo: '🎩', name: '紳士帽', price: 160 },
  { id: 'party', emo: '🥳', name: '派對帽', price: 110 },
  { id: 'sunglasses', emo: '🕶️', name: '墨鏡', price: 130 },
  { id: 'halo', emo: '😇', name: '光環', price: 200 },
  { id: 'crown', emo: '👑', name: '皇冠', price: 300 },
  { id: 'star', emo: '⭐', name: '閃星', price: 80 }
];
export const costumeById = (id) => COSTUMES.find((c) => c.id === id);

/* 成就任務。check 收到即時統計，達成一次自動發金幣。 */
export const ACHIEVEMENTS = [
  { id: 'first', name: '記帳新手', desc: '記下第一筆帳', coin: 50, check: (s) => s.txCount >= 1 },
  { id: 'income1', name: '開始賺錢', desc: '記錄第一筆收入', coin: 30, check: (s) => s.hasIncome },
  { id: 'accounts', name: '理財起步', desc: '設定帳戶起始餘額', coin: 40, check: (s) => s.hasInitBalance },
  { id: 'streak3', name: '三日不間斷', desc: '連續記帳 3 天', coin: 40, check: (s) => s.streak >= 3 },
  { id: 'streak7', name: '一週達成', desc: '連續記帳 7 天', coin: 120, check: (s) => s.streak >= 7 },
  { id: 'streak30', name: '記帳達人', desc: '連續記帳 30 天', coin: 500, check: (s) => s.streak >= 30 },
  { id: 'allpets', name: '雨露均霑', desc: '一個月餵到全部 5 隻怪獸', coin: 100, check: (s) => s.petsThisMonth >= 5 },
  { id: 'budget', name: '守住預算', desc: '設定總預算且當月不超支', coin: 150, check: (s) => s.underBudget },
  { id: 'rich', name: '小富翁', desc: '淨資產突破 10 萬', coin: 200, check: (s) => s.netWorth >= 100000 },
  { id: 'dresser', name: '時尚教主', desc: '幫怪獸戴上第一件裝扮', coin: 60, check: (s) => s.hasEquipped }
];

/* 台新 Richart 卡權益（2026/7/1～2027/3/31，每日可在 Richart Life APP 切換一次，預設天天刷） */
export const RICHART_PLANS = {
  chill: { name: 'Chill刷', pct: '最高10%', desc: '火鍋燒肉、追星串流、運動保健指定品牌' },
  pay: { name: 'Pay著刷', pct: '3.8%', desc: '台新Pay 3.8%／LINE Pay 2.3%' },
  daily: { name: '天天刷', pct: '3.3%', desc: '超商超市、通勤交通、加油充電、藥妝' },
  big: { name: '大筆刷', pct: '3.3%', desc: '百貨、Outlets、居家裝修、時尚品牌' },
  food: { name: '好饗刷', pct: '3.3%', desc: '餐飲外送、展演購票、飯店樂園' },
  net: { name: '數趣刷', pct: '3.3%', desc: '網購、線上課程、遊戲影音、AI 服務' },
  travel: { name: '玩旅刷', pct: '3.3%', desc: '海外消費＋航空訂房旅遊平台' },
  holiday: { name: '假日刷', pct: '2%', desc: '假日不限通路' }
};

/* 分類 → 建議方案（依 2026/7 起權益通路對照，可自行調整） */
export const CAT_PLAN = {
  meals: 'food', breakfast: 'food', lunch: 'food', dinner: 'food', latenight: 'food',
  social: 'food', coffee: 'food',
  bubbletea: 'daily', snack: 'daily', transport: 'daily', daily: 'daily', medical: 'daily',
  shopping: 'net', gacha: 'net', books: 'net', tech: 'net',
  fun: 'chill', gym: 'chill',
  clothes: 'big', home: 'big',
  travel: 'travel'
};

/* 永豐 DAWHO 卡（2026/7/1～12/31）：國內 1%、海外 2% 無上限；
   大戶等級：指定任務 +2.5%、悠遊卡自動加值 +3%（上限100/月）、行動支付 +2%（上限200/月） */
export const DAWHO = {
  domestic: '1%', overseas: '2%',
  easycardTip: '悠遊卡改設「永豐 DAWHO 自動加值」可多賺 +3% 回饋'
};

export let CATS = [...DEFAULT_CATS];

export function setCats(list) {
  CATS = list;
}

export const petById = (id) => PETS.find((p) => p.id === id);

export const catById = (id) =>
  CATS.find((c) => c.id === id) ||
  DEFAULT_CATS.find((c) => c.id === id) ||
  LEGACY_CATS.find((c) => c.id === id) ||
  { id, name: '（已刪除分類）', emo: '❔', pet: 'zhuan' };
