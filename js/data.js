// --- 水質タイプ定義 ---
const WATER_TYPES = {
  fresh:    { id: 'fresh',    label: '淡水',     short: '淡水', color: '#4dd0e1', defaultTemp: 25 },
  brackish: { id: 'brackish', label: '汽水',     short: '汽水', color: '#aed581', defaultTemp: 25 },
  marine:   { id: 'marine',   label: '海水',     short: '海水', color: '#4fc3f7', defaultTemp: 25 },
  deep:     { id: 'deep',     label: '深海冷水', short: '深海', color: '#9575cd', defaultTemp: 5 }
};

// --- 水槽タイプ（3段階の特性・難易度・寿命・容量ルール） ---
const TANK_TYPES = {
  casual: {
    id: 'casual',
    name: 'ファンタジー水槽',
    badge: '初級・万能(無制限)',
    badgeClass: 'badge-casual',
    desc: '淡水・海水・深海のあらゆる生き物が一緒に暮らせる魔法の水槽。お迎え枠は無制限で寿命もありません。自然交配は「同種3匹（または水槽合計15匹）まで」で自動的に落ち着くため、増えすぎず安心です。',
    rateMul: 1.0,
    breedMul: 1.0,
    strictLevel: 0, // 0: 制限なし・寿命なし・枠無制限
    hasLifespan: false,
    hasCapacityLimit: false,
    casualMaxPerSpecies: 3, // 初級での自然交配による同種上限（魚＋卵）
    casualMaxTotalBreed: 15, // 初級での自然交配による水槽全体上限（魚＋卵）
    allowDirectSelect: 'unlocked',
    unlockCost: 0
  },
  harmony: {
    id: 'harmony',
    name: 'ハーモニー水槽',
    badge: '中級・世代交代',
    badgeClass: 'badge-harmony',
    desc: '水質区分と大まかな水温帯（±3℃の猶予）を合わせる中級水槽。水槽サイズに応じた「収容枠」と魚の「寿命」があり、水槽を拡張しながら交配による世代交代が楽しめます（報酬×1.6）。',
    rateMul: 1.6,
    breedMul: 1.6,
    strictLevel: 1, // 1: 中程度・自然寿命あり・容量制
    hasLifespan: true,
    hasCapacityLimit: true,
    allowDirectSelect: 'unlocked',
    unlockCost: 500
  },
  realistic: {
    id: 'realistic',
    name: 'プロフェッショナル水槽',
    badge: '上級・厳密管理',
    badgeClass: 'badge-realistic',
    desc: '実際の水槽に近い厳密な水質・1℃単位の水温管理・水槽サイズ拡張・水換えが求められる高難易度水槽。魚の体長に応じた収容枠管理が必要ですが、理想環境ではしずく2.5倍＆レア変異率が大幅UP！',
    rateMul: 2.5,
    breedMul: 2.5,
    strictLevel: 2, // 2: 厳密管理・環境連動寿命あり・容量制
    hasLifespan: true,
    hasCapacityLimit: true,
    allowDirectSelect: 'unlocked',
    unlockCost: 1200
  }
};

// --- 中級・上級水槽のサイズ段階（拡張可能） ---
const TANK_SIZES = [
  { level: 1, name: '45cm小型水槽',     capacity: 12,  volume: 1.0, cost: 0 },
  { level: 2, name: '60cm標準水槽',     capacity: 22,  volume: 1.7, cost: 800 },
  { level: 3, name: '90cmワイド水槽',   capacity: 36,  volume: 2.8, cost: 2500 },
  { level: 4, name: '120cm大型水槽',    capacity: 55,  volume: 4.5, cost: 7500 },
  { level: 5, name: '180cm特大水槽',    capacity: 85,  volume: 7.0, cost: 22000 },
  { level: 6, name: '300cm水族館大水槽', capacity: 130, volume: 11.0, cost: 65000 }
];

// --- ヒーター（加温設備）段階 ---
const HEATER_LEVELS = [
  { level: 0, name: '未設置',                   power: 0,    maxTemp: 20, cost: 0,    desc: '加温能力なし（室温頼み）' },
  { level: 1, name: '小型オートヒーター(初期)', power: 0.45, maxTemp: 28, cost: 0,    desc: '60cm水槽まで約28℃に加温可能（大型水槽では出力不足）' },
  { level: 2, name: 'ICサーモヒーター',         power: 1.25, maxTemp: 32, cost: 600,  desc: '120cm水槽まで31℃のディスカス適温もしっかり維持' },
  { level: 3, name: '大型プロ用ツインヒーター', power: 3.50, maxTemp: 32, cost: 2200, desc: '300cm大水槽でも夜間冷え込みに負けず高水温をピタリと維持' }
];

// --- クーラー・チラー（冷却設備）段階 ---
const COOLER_LEVELS = [
  { level: 0, name: '未設置',               power: 0,    minTemp: 99, maxDrop: 0,   cost: 0,     desc: '冷却能力なし（昼間の室温上昇で水温が上がります）' },
  { level: 1, name: '空冷ファン',           power: 0.45, minTemp: 19, maxDrop: 4.5, cost: 400,   desc: '気化熱で室温から最大-4.5℃（約19℃まで）冷却。メダカ・琉金や夏場対策に' },
  { level: 2, name: 'コンプレッサー式クーラー', power: 1.30, minTemp: 13, maxDrop: 20,  cost: 1800,  desc: '13℃まで安定冷却。ミズクラゲや中〜大型の海水・温帯水槽に対応' },
  { level: 3, name: '深海用極低温チラー',   power: 2.60, minTemp: 1,  maxDrop: 35,  cost: 6000,  desc: '1℃の極低温を実現！クリオネ・メンダコ・リュウグウノツカイの飼育に必須' },
  { level: 4, name: '水族館級冷凍チラー',   power: 6.00, minTemp: 1,  maxDrop: 35,  cost: 18000, desc: '300cm大水槽でも深海の極低温(1〜5℃)を完璧に維持する最高峰チラー' }
];

// 魚種ごとの成魚時(100%成長時)の標準専有枠を計算
function getSpeciesAdultLoad(def) {
  if (def.size <= 40) return 1.0;   // 極小・小型 (クリオネ, メダカ, ネオン等)
  if (def.size <= 55) return 1.4;   // 小型 (グッピー, ダニオ, コリドラス等)
  if (def.size <= 95) return 2.5;   // 中小型 (ベタ, グラミー, クマノミ, クーリー等)
  if (def.size <= 130) return 3.2;  // 中型 (ミドリフグ, キンギョハナダイ, ベラ)
  if (def.size <= 200) return 5.0;  // 大型 (エンゼル, 琉金, ディスカス, メンダコ)
  if (def.size <= 300) return 6.5;  // 大型海水 (ミズクラゲ, ナンヨウハギ)
  if (def.size <= 900) return 14.0; // 超大型 (プラチナ・アロワナ 70cm)
  return 24.0;                      // 巨大種 (リュウグウノツカイ 2.8m)
}

// --- 性システム解説 ---
const SEX_SYSTEM_LABELS = {
  normal:        '雌雄異体 (♂/♀)',
  protandrous:   '雄性先熟・性転換 (最大個体が♀へ変化)',
  protogynous:   '雌性先熟・性転換 (最大個体が♂へ変化)',
  hermaphrodite: '雌雄同体 (⚥ 2匹で交配可)'
};

// --- 全24種のビジュアル・生態・現実準拠サイズ(mm)・寿命(秒)データ ---
// size: 成魚時の現実的な体長(mm), lifespan: 標準寿命(秒, 中級・上級水槽で適用)
// price: 図鑑からの指名お迎えコスト（ランダム卵より大幅に高価なプレミアム価格）
const FISH_DATA = [
  // Tier 1 (素朴な卵: 100しずく に対し、指名お迎え: 600〜1,200しずく)
  {
    id: 'neon', name: 'ネオンテトラ', rate: 1.2, size: 38, lifespan: 1400, tier: 1, price: 750,
    water: 'fresh', tempMin: 22, tempMax: 28, sexType: 'normal',
    shape: 'tetra', c1: '#00e5ff', c2: '#ff1744',
    desc: '青い発光ラインと赤い尾が美しい、アマゾン原産の小さな群泳魚（成魚約3.8cm）。'
  },
  {
    id: 'medaka', name: 'ヒメダカ', rate: 1.0, size: 35, lifespan: 1000, tier: 1, price: 600,
    water: 'fresh', tempMin: 15, tempMax: 28, sexType: 'normal',
    shape: 'slim', c1: '#ffb74d', c2: '#ffe082',
    desc: '水面近くを穏やかに泳ぐ黄金色の小魚（成魚約3.5cm）。寿命は短めだが繁殖しやすい。'
  },
  {
    id: 'guppy', name: 'ファンシーグッピー', rate: 1.5, size: 45, lifespan: 1100, tier: 1, price: 950,
    water: 'fresh', tempMin: 23, tempMax: 28, sexType: 'normal',
    shape: 'guppy', c1: '#ff7043', c2: '#ffca28',
    desc: 'オスはドレスのように大きく華やかな尾ビレを持ち、世代交代が早い人気種（成魚約4.5cm）。'
  },
  {
    id: 'danio', name: 'ゼブラダニオ', rate: 1.4, size: 45, lifespan: 1400, tier: 1, price: 850,
    water: 'fresh', tempMin: 18, tempMax: 27, sexType: 'normal',
    shape: 'slim', c1: '#5c6bc0', c2: '#fff59d', stripe: 'h',
    desc: '紺と金の美しい縦縞を持ち、元気よく水槽を駆け回る丈夫な小型魚（成魚約4.5cm）。'
  },
  {
    id: 'killifish', name: 'アフリカン・ランプアイ', rate: 1.5, size: 32, lifespan: 1050, tier: 1, price: 950,
    water: 'fresh', tempMin: 22, tempMax: 27, sexType: 'normal',
    shape: 'slim', c1: '#b0bec5', c2: '#00e5ff', eyeGlow: true,
    desc: '暗がりの中で目の上部がネオンブルーにキラリと光る華奢な小型魚（成魚約3.2cm）。'
  },
  {
    id: 'kuhli', name: 'クーリーローチ', rate: 1.8, size: 90, lifespan: 1900, tier: 1, price: 1200,
    water: 'fresh', tempMin: 24, tempMax: 29, sexType: 'normal',
    shape: 'eel', c1: '#ffb74d', c2: '#3e2723', zone: 'bottom',
    desc: '縞模様の細長い体で、水底をくねくねと這うように泳ぐ愛嬌のあるドジョウの仲間（成魚約9cm）。'
  },

  // Tier 2 (蒼海の卵: 1,000しずく に対し、指名お迎え: 4,500〜9,500しずく)
  {
    id: 'cory', name: 'コリドラス・パンダ', rate: 2.5, size: 50, lifespan: 2100, tier: 2, price: 4500,
    water: 'fresh', tempMin: 21, tempMax: 26, sexType: 'normal',
    shape: 'cory', c1: '#f5f5f5', c2: '#263238', zone: 'bottom',
    desc: '目元と尾の付け根に黒い模様がある、水底の愛らしい働き者（成魚約5cm）。比較的長生き。'
  },
  {
    id: 'cherry_barb', name: 'チェリーバルブ', rate: 2.8, size: 48, lifespan: 1600, tier: 2, price: 5000,
    water: 'fresh', tempMin: 23, tempMax: 27, sexType: 'normal',
    shape: 'tetra', c1: '#d81b60', c2: '#ff8a80',
    desc: '熟したサクランボのような深い紅色が水草によく映えるコイ科の小型魚（成魚約4.8cm）。'
  },
  {
    id: 'harlequin', name: 'ラスボラ・ヘテロモルファ', rate: 3.0, size: 42, lifespan: 1550, tier: 2, price: 5500,
    water: 'fresh', tempMin: 23, tempMax: 28, sexType: 'normal',
    shape: 'tetra', c1: '#ffab91', c2: '#283593', patch: true,
    desc: '体後半の黒い三角形の模様がアクセントになった温和な水草水槽の主役（成魚約4.2cm）。'
  },
  {
    id: 'dwarf_gourami', name: 'コバルト・グラミー', rate: 3.8, size: 60, lifespan: 1650, tier: 2, price: 6800,
    water: 'fresh', tempMin: 24, tempMax: 28, sexType: 'normal',
    shape: 'round', c1: '#29b6f6', c2: '#ef5350', stripe: 'v',
    desc: '輝くコバルトブルーの体に赤い縞が浮かぶ優美な中型熱帯魚（成魚約6cm）。'
  },
  {
    id: 'clownfish', name: 'カクレクマノミ', rate: 4.5, size: 95, lifespan: 2600, tier: 2, price: 7800,
    water: 'marine', tempMin: 24, tempMax: 27, sexType: 'protandrous',
    shape: 'round', c1: '#ff6d00', c2: '#ffffff', bands: true,
    desc: '海のアイドル（成魚約9〜11cm）。【雄性先熟】で群れで最大の個体がメス(♀)、2番目がオス(♂)へ性転換し、メスが寿命を迎えると次のオスが女王を継ぐ。'
  },
  {
    id: 'anthias', name: 'キンギョハナダイ', rate: 5.0, size: 120, lifespan: 2200, tier: 2, price: 8500,
    water: 'marine', tempMin: 22, tempMax: 26, sexType: 'protogynous',
    shape: 'tetra', c1: '#ff8a65', c2: '#ff4081',
    desc: 'サンゴ礁を彩る中型海水魚（成魚約12cm）。【雌性先熟】で生まれた時はすべてオレンジ色のメス(♀)だが、最大の1匹が紅紫色のオス(♂)へ性転換する。'
  },
  {
    id: 'goldfish', name: '更紗琉金', rate: 5.5, size: 170, lifespan: 3800, tier: 2, price: 9500,
    water: 'fresh', tempMin: 15, tempMax: 24, sexType: 'normal',
    shape: 'goldfish', c1: '#e53935', c2: '#ffffff',
    desc: '丸みのある大きな体と長い四つ尾が魅力の観賞魚（成魚約17cm）。非常に長寿。'
  },

  // Tier 3 (指名お迎え: 18,000〜32,000しずく)
  {
    id: 'betta', name: 'ハーフムーン・ベタ', rate: 9.0, size: 65, lifespan: 1450, tier: 3, price: 18000,
    water: 'fresh', tempMin: 25, tempMax: 29, sexType: 'normal',
    shape: 'betta', c1: '#8e24aa', c2: '#00bcd4',
    desc: '半月のように180度広がる絹のようなヒレを揺らして泳ぐ中型魚（成魚約6.5cm）。'
  },
  {
    id: 'angelfish', name: 'エンゼルフィッシュ', rate: 11.0, size: 150, lifespan: 2700, tier: 3, price: 22000,
    water: 'fresh', tempMin: 25, tempMax: 29, sexType: 'normal',
    shape: 'angel', c1: '#eceff1', c2: '#37474f', stripe: 'v',
    desc: '上下に長く伸びたヒレで水中を滑空するように優雅に佇む大型シクリッド（成魚約15cm）。'
  },
  {
    id: 'blue_tang', name: 'ナンヨウハギ', rate: 12.5, size: 240, lifespan: 3200, tier: 3, price: 25000,
    water: 'marine', tempMin: 24, tempMax: 27, sexType: 'normal',
    shape: 'round', c1: '#1565c0', c2: '#ffd600',
    desc: 'ロイヤルブルーの体と黄色い尾ビレが目を引く大型海水魚（成魚約24cm）。小型魚より一回り大きい。'
  },
  {
    id: 'cleaner_wrasse', name: 'ホンソメワケベラ', rate: 13.0, size: 100, lifespan: 2100, tier: 3, price: 26000,
    water: 'marine', tempMin: 23, tempMax: 27, sexType: 'protogynous',
    shape: 'slim', c1: '#4fc3f7', c2: '#1a237e', stripe: 'h',
    desc: '他の魚の体を掃除して健康を保つ細長い海水魚（成魚約10cm）。【雌性先熟】で最大個体が♀から♂に性転換する。'
  },
  {
    id: 'discus', name: 'ターコイズ・ディスカス', rate: 15.0, size: 180, lifespan: 2900, tier: 3, price: 32000,
    water: 'fresh', tempMin: 27, tempMax: 31, sexType: 'normal',
    shape: 'discus', c1: '#00acc1', c2: '#ff7043',
    desc: '大きな円盤状の体にターコイズ模様が描かれた「熱帯魚の王様」（成魚約18cm）。'
  },
  {
    id: 'puffer', name: 'ミドリフグ', rate: 14.0, size: 110, lifespan: 2300, tier: 3, price: 28000,
    water: 'brackish', tempMin: 24, tempMax: 28, sexType: 'normal',
    shape: 'puffer', c1: '#c0ca33', c2: '#33691e', spots: true,
    desc: '丸っこい体で胸ビレをパタパタと動かしてホバリングする汽水フグ（成魚約11cm）。'
  },

  // Tier 4 (深淵の卵: 10,000しずく に対し、指名お迎え: 65,000〜250,000しずく)
  {
    id: 'jellyfish', name: '発光ミズクラゲ', rate: 25.0, size: 210, lifespan: 1200, tier: 4, price: 65000,
    water: 'marine', tempMin: 14, tempMax: 23, sexType: 'hermaphrodite',
    shape: 'jelly', c1: 'rgba(186, 104, 200, 0.75)', c2: '#e1bee7', glow: true,
    desc: '直径約20cmの半透明の傘をゆっくりと拍動させ、幻想的な光を放ちながら漂う。'
  },
  {
    id: 'clione', name: 'クリオネ', rate: 28.0, size: 25, lifespan: 1100, tier: 4, price: 75000,
    water: 'deep', tempMin: 1, tempMax: 7, sexType: 'hermaphrodite',
    shape: 'clione', c1: 'rgba(128, 222, 234, 0.8)', c2: '#ff5252', glow: true,
    desc: '体長わずか2.5cmほどの小さな体に赤い輝きを宿し、翼足で羽ばたく流氷の天使。【雌雄同体(⚥)】。'
  },
  {
    id: 'mendako', name: '深海メンダコ', rate: 32.0, size: 200, lifespan: 1800, tier: 4, price: 90000,
    water: 'deep', tempMin: 3, tempMax: 10, sexType: 'normal',
    shape: 'mendako', c1: '#ff7043', c2: '#ffccbc',
    desc: '直径約20cmのパラシュートのような体で、耳のようなヒレをパタパタと動かして浮遊する深海生物。'
  },
  {
    id: 'arowana', name: 'プラチナ・アロワナ', rate: 65.0, size: 700, lifespan: 4500, tier: 4, price: 150000,
    water: 'fresh', tempMin: 26, tempMax: 30, sexType: 'normal',
    shape: 'arowana', c1: '#e0f7fa', c2: '#fff9c4', glow: true,
    desc: '成魚は70cmに達する巨大な白銀の古代魚。圧倒的な存在感で水面近くを悠然と巡り、非常に長寿。'
  },
  {
    id: 'oarfish', name: '銀河リュウグウノツカイ', rate: 110.0, size: 2800, lifespan: 5400, tier: 4, price: 250000,
    water: 'deep', tempMin: 2, tempMax: 9, sexType: 'normal',
    shape: 'oarfish', c1: '#b3e5fc', c2: '#ff1744', glow: true,
    desc: '全長2.8mに及ぶ長大な銀色の体を波打たせ、紅い冠のような背ビレをなびかせる深海の巨大な神秘。'
  }
];

// --- 時間の進み方（全難易度共通のタイムスケール設定） ---
const TIME_SCALES = [
  {
    id: 'realtime',
    label: 'リアル(現実時間)',
    short: 'リアル',
    mul: 0.01, // 従来の1/100の速度（寿命や成長が数日〜数週間単位の現実的なペース）
    desc: '現実のアクアリウムに近い極めて緩やかな時間経過（従来の1/100速度）。水質変化や成長・寿命が数日〜数週間単位でゆっくり進みます。'
  },
  {
    id: 'slow',
    label: 'スロー(じっくり)',
    short: 'スロー',
    mul: 0.08, // 約12倍ゆっくり
    desc: 'デスクトップ鑑賞に最適な、数時間〜数日かけて成長・世代交代する落ち着いたペース（従来の約1/12速度）。'
  },
  {
    id: 'normal',
    label: '標準(ゆったり)',
    short: '標準',
    mul: 0.25, // 4倍ゆっくり（デフォルト推奨）
    desc: '成長や寿命、水質変化が急すぎず、じっくり育成と交配を楽しめる標準ペース（従来の1/4速度）。'
  },
  {
    id: 'fast',
    label: '高速(ゲーム速度)',
    short: '高速',
    mul: 1.0, // 従来の速度
    desc: '15〜60分ほどで世代交代が進む、テンポ重視のゲームモード（従来の速度）。'
  },
  {
    id: 'hyper',
    label: '倍速(早送り)',
    short: '倍速×3',
    mul: 3.0, // 3倍速
    desc: '交配や性転換、世代交代をすぐに試したいときのための早送りモード（3倍速）。'
  }
];

const LIGHT_THEMES = {
  morning: { label: '朝', top: '#1e6b7b', bottom: '#0a2233', ray: 'rgba(220, 250, 255, 0.05)' },
  day:     { label: '昼', top: '#12537a', bottom: '#061928', ray: 'rgba(180, 240, 255, 0.04)' },
  sunset:  { label: '夕', top: '#432c52', bottom: '#150d26', ray: 'rgba(255, 165, 115, 0.045)' },
  night:   { label: '夜', top: '#050d1a', bottom: '#020409', ray: 'rgba(70, 140, 255, 0.02)' }
};
