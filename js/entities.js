// --- プレビュー枠用の適切な描画サイズ計算（図鑑・インスペクター用） ---
function getPreviewRadius(def, mode = 'card') {
  // mode: 'card' (80x50) | 'inspector' (120x95)
  const scale = mode === 'inspector' ? 1.45 : 1.0;
  if (def.shape === 'oarfish') return 9.5 * scale;
  if (def.shape === 'arowana') return 11.5 * scale;
  if (def.shape === 'eel') return 11.0 * scale;
  if (def.shape === 'angel' || def.shape === 'jelly') return 13.5 * scale;
  if (def.size <= 38) return 9.5 * scale;   // 小型魚はプレビューでも可愛らしく小さめに
  if (def.size <= 65) return 12.5 * scale;
  if (def.size <= 130) return 15.0 * scale;
  return 17.5 * scale;
}

// --- 魚ビジュアル描画関数（現実的な体型比率・性的二形・レア個体対応） ---
function renderFishShape(ctx, def, r, phase, isNight, opts = {}) {
  const sw = Math.sin(phase) * (r * 0.22);
  const sw2 = Math.cos(phase * 0.8) * (r * 0.15);
  const sex = opts.sex || 'M';
  const isRare = opts.variant === 'rare';

  let c1 = def.c1;
  let c2 = def.c2;
  if (def.id === 'anthias') {
    if (sex === 'M') {
      c1 = '#d81b60';
      c2 = '#ab47bc';
    } else {
      c1 = '#ff8a65';
      c2 = '#ffd54f';
    }
  }
  if (isRare) {
    ctx.shadowColor = '#ffd54f';
    ctx.shadowBlur = 16;
  } else if (def.glow || isNight) {
    ctx.shadowColor = c1;
    ctx.shadowBlur = def.glow ? 16 : 8;
  }

  // 1. クラゲ
  if (def.shape === 'jelly') {
    const pulse = Math.sin(phase * 0.5);
    const w = r * (0.85 - pulse * 0.12);
    const h = r * (0.65 + pulse * 0.1);
    ctx.strokeStyle = c2;
    ctx.lineWidth = Math.max(1, r * 0.05);
    for (let i = -3; i <= 3; i++) {
      ctx.beginPath();
      ctx.moveTo(i * w * 0.22, h * 0.1);
      ctx.quadraticCurveTo(
        i * w * 0.28 + Math.sin(phase + i) * r * 0.2, h * 0.9,
        i * w * 0.2 + Math.cos(phase + i) * r * 0.25, h * 1.8
      );
      ctx.stroke();
    }
    const g = ctx.createRadialGradient(0, -h * 0.2, r * 0.1, 0, 0, w);
    g.addColorStop(0, c2);
    g.addColorStop(1, c1);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, w, Math.PI, 0, false);
    ctx.quadraticCurveTo(0, h * 0.35, -w, 0);
    ctx.fill();
    return;
  }

  // 2. クリオネ
  if (def.shape === 'clione') {
    const flap = Math.sin(phase * 1.1) * r * 0.55;
    ctx.fillStyle = c1;
    ctx.beginPath();
    ctx.moveTo(0, -r * 0.2);
    ctx.quadraticCurveTo(-r * 0.9, -r * 0.5 + flap, -r * 0.2, r * 0.1);
    ctx.moveTo(0, -r * 0.2);
    ctx.quadraticCurveTo(r * 0.9, -r * 0.5 + flap, r * 0.2, r * 0.1);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(0, -r * 0.85);
    ctx.quadraticCurveTo(r * 0.45, -r * 0.1, 0, r * 0.95);
    ctx.quadraticCurveTo(-r * 0.45, -r * 0.1, 0, -r * 0.85);
    ctx.fill();
    ctx.fillStyle = c2;
    ctx.beginPath();
    ctx.ellipse(0, -r * 0.15, r * 0.16, r * 0.24, 0, 0, Math.PI * 2);
    ctx.fill();
    return;
  }

  // 3. メンダコ
  if (def.shape === 'mendako') {
    const ear = Math.sin(phase * 0.8) * r * 0.2;
    ctx.fillStyle = c1;
    ctx.beginPath();
    ctx.ellipse(-r * 0.55, -r * 0.3 + ear, r * 0.3, r * 0.13, -0.3, 0, Math.PI * 2);
    ctx.ellipse(r * 0.55, -r * 0.3 + ear, r * 0.3, r * 0.13, 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.75, Math.PI, 0, false);
    for (let i = 3; i >= -3; i--) {
      ctx.quadraticCurveTo(i * r * 0.22, r * 0.45 + Math.sin(phase + i) * r * 0.1, (i - 0.5) * r * 0.22, r * 0.15);
    }
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(-r * 0.25, -r * 0.1, r * 0.12, 0, Math.PI * 2);
    ctx.arc(r * 0.25, -r * 0.1, r * 0.12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#111';
    ctx.beginPath();
    ctx.arc(-r * 0.25, -r * 0.1, r * 0.06, 0, Math.PI * 2);
    ctx.arc(r * 0.25, -r * 0.1, r * 0.06, 0, Math.PI * 2);
    ctx.fill();
    return;
  }

  // 4. 多関節うねり系（クーリーローチ・アロワナ・リュウグウノツカイ）
  // それぞれ現実のプロポーションに合わせて全長・太さ・ヒレを描き分け
  if (def.shape === 'arowana' || def.shape === 'oarfish' || def.shape === 'eel') {
    const segs = def.shape === 'oarfish' ? 18 : (def.shape === 'arowana' ? 10 : 12);
    const totalLen = def.shape === 'oarfish' ? r * 4.6 : (def.shape === 'arowana' ? r * 3.5 : r * 3.1);
    const step = totalLen / segs;
    const headX = totalLen * 0.42;
    const pts = [];
    for (let i = 0; i <= segs; i++) {
      const x = headX - i * step;
      const waveAmp = def.shape === 'arowana' ? 0.024 : 0.042;
      const y = Math.sin(phase - i * 0.5) * (i * r * waveAmp);
      pts.push({ x, y });
    }

    // リュウグウノツカイの赤い背ビレと冠ヒレ
    if (def.shape === 'oarfish') {
      ctx.strokeStyle = c2;
      ctx.lineWidth = Math.max(1.5, r * 0.06);
      ctx.beginPath();
      for (let i = 0; i < 5; i++) {
        ctx.moveTo(pts[0].x, pts[0].y - r * 0.08);
        ctx.lineTo(pts[0].x - r * 0.15 + i * r * 0.14, pts[0].y - r * 0.85 + Math.sin(phase + i) * r * 0.12);
      }
      ctx.stroke();

      // 背面に連なる赤いリボン状の背ビレ
      ctx.fillStyle = 'rgba(255, 23, 68, 0.75)';
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y - r * 0.1);
      for (let i = 1; i <= segs; i++) {
        const finH = r * 0.22 * (1 - (i / segs) * 0.6);
        ctx.lineTo(pts[i].x, pts[i].y - finH + Math.sin(phase * 1.3 - i) * r * 0.04);
      }
      for (let i = segs; i >= 0; i--) {
        ctx.lineTo(pts[i].x, pts[i].y);
      }
      ctx.closePath();
      ctx.fill();
    }

    // アロワナの尾ビレ・背ビレ・口ヒゲ
    if (def.shape === 'arowana') {
      const tailPt = pts[segs];
      ctx.fillStyle = c2;
      ctx.beginPath();
      ctx.arc(tailPt.x - r * 0.15, tailPt.y, r * 0.34, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (let i = 0; i < segs; i++) {
      const ratio = def.shape === 'arowana'
        ? (1 - Math.pow(i / segs, 1.5) * 0.65)
        : (1 - (i / segs) * 0.78);
      ctx.strokeStyle = (def.shape === 'eel' && i % 2 === 1) ? c2 : (isRare ? '#fff59d' : c1);
      const baseThick = def.shape === 'arowana' ? r * 0.62 : (def.shape === 'oarfish' ? r * 0.28 : r * 0.20);
      ctx.lineWidth = Math.max(1.5, baseThick * ratio);
      ctx.beginPath();
      ctx.moveTo(pts[i].x, pts[i].y);
      ctx.lineTo(pts[i + 1].x, pts[i + 1].y);
      ctx.stroke();
    }

    // アロワナの口ヒゲと胸ビレ
    if (def.shape === 'arowana') {
      ctx.strokeStyle = c2;
      ctx.lineWidth = Math.max(1.2, r * 0.05);
      ctx.beginPath();
      ctx.moveTo(pts[0].x + r * 0.22, pts[0].y - r * 0.02);
      ctx.lineTo(pts[0].x + r * 0.42, pts[0].y - r * 0.12);
      ctx.moveTo(pts[0].x + r * 0.22, pts[0].y + r * 0.03);
      ctx.lineTo(pts[0].x + r * 0.40, pts[0].y + r * 0.08);
      ctx.stroke();

      ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
      ctx.beginPath();
      ctx.ellipse(pts[2].x, pts[2].y + r * 0.22, r * 0.35, r * 0.11, 0.45, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = '#050b12';
    ctx.beginPath();
    ctx.arc(pts[0].x + r * 0.06, pts[0].y - r * 0.05, Math.max(1.5, r * 0.08), 0, Math.PI * 2);
    ctx.fill();
    return;
  }

  // --- 一般魚類の共通パーツ描画 ---
  const bodyW = r * (def.shape === 'discus' || def.shape === 'angel' ? 0.85 : 1.05);
  let bodyH = r * (
    def.shape === 'discus' ? 0.78 :
    def.shape === 'angel' ? 0.72 :
    def.shape === 'goldfish' || def.shape === 'round' || def.shape === 'puffer' ? 0.62 :
    def.shape === 'slim' ? 0.35 : 0.45
  );
  if (sex === 'F') bodyH *= 1.06;

  // 背ビレ・腹ビレ
  ctx.fillStyle = c2;
  ctx.globalAlpha = 0.85;
  if (def.shape === 'angel') {
    ctx.beginPath();
    ctx.moveTo(r * 0.1, -bodyH * 0.5);
    ctx.quadraticCurveTo(-r * 0.4, -r * 1.65 + sw2, -r * 0.85, -r * 1.5 + sw);
    ctx.lineTo(-r * 0.4, -bodyH * 0.3);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(r * 0.0, bodyH * 0.5);
    ctx.quadraticCurveTo(-r * 0.4, r * 1.65 + sw2, -r * 0.9, r * 1.55 + sw);
    ctx.lineTo(-r * 0.4, bodyH * 0.3);
    ctx.fill();
  } else if (def.shape === 'betta') {
    const finMul = sex === 'F' ? 0.65 : 1.0;
    ctx.beginPath();
    ctx.moveTo(r * 0.1, -bodyH * 0.6);
    ctx.quadraticCurveTo(-r * 0.6 * finMul, -r * 1.2 * finMul + sw, -r * 1.1 * finMul, -r * 0.3 + sw2);
    ctx.lineTo(-r * 0.5, 0);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(r * 0.1, bodyH * 0.6);
    ctx.quadraticCurveTo(-r * 0.6 * finMul, r * 1.2 * finMul + sw, -r * 1.1 * finMul, r * 0.3 + sw2);
    ctx.lineTo(-r * 0.5, 0);
    ctx.fill();
  } else {
    const dorsalStretch = (def.id === 'anthias' && sex === 'M') ? 1.45 : 1.0;
    ctx.beginPath();
    ctx.moveTo(r * 0.15, -bodyH * 0.75);
    ctx.quadraticCurveTo(-r * 0.2, -bodyH * 1.35 * dorsalStretch + sw2 * 0.4, -r * 0.5, -bodyH * 0.65);
    ctx.closePath();
    ctx.fill();
  }

  // 尾ビレ
  ctx.beginPath();
  if (def.shape === 'betta' || def.shape === 'guppy' || def.shape === 'goldfish') {
    let tailR = def.shape === 'betta' ? r * 1.15 : r * 0.85;
    if ((def.shape === 'betta' || def.shape === 'guppy') && sex === 'F') {
      tailR *= 0.68;
    }
    ctx.moveTo(-bodyW * 0.75, 0);
    ctx.quadraticCurveTo(-bodyW - tailR * 0.6, -tailR * 0.85 + sw, -bodyW - tailR, -tailR * 0.35 + sw * 1.3);
    ctx.quadraticCurveTo(-bodyW - tailR * 1.15, sw * 1.5, -bodyW - tailR, tailR * 0.35 + sw * 1.3);
    ctx.quadraticCurveTo(-bodyW - tailR * 0.6, tailR * 0.85 + sw, -bodyW * 0.75, 0);
  } else {
    ctx.moveTo(-bodyW * 0.8, 0);
    ctx.lineTo(-bodyW - r * 0.55, -bodyH * 0.75 + sw);
    ctx.lineTo(-bodyW - r * 0.32, sw * 0.5);
    ctx.lineTo(-bodyW - r * 0.55, bodyH * 0.75 + sw);
    ctx.closePath();
  }
  ctx.fill();
  ctx.globalAlpha = 1.0;

  // 胴体グラデーション
  const grad = ctx.createLinearGradient(0, -bodyH, 0, bodyH);
  grad.addColorStop(0, isRare ? '#fff59d' : c1);
  grad.addColorStop(1, c2);
  ctx.fillStyle = grad;

  ctx.beginPath();
  ctx.ellipse(0, 0, bodyW, bodyH, 0, 0, Math.PI * 2);
  ctx.fill();

  // 体表の模様
  ctx.save();
  ctx.clip();
  if (def.id === 'neon') {
    ctx.strokeStyle = '#00e5ff';
    ctx.lineWidth = r * 0.16;
    ctx.beginPath();
    ctx.moveTo(bodyW * 0.5, -bodyH * 0.12);
    ctx.lineTo(-bodyW * 0.7, -bodyH * 0.12);
    ctx.stroke();
  } else if (def.bands) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(r * 0.25, -bodyH, r * 0.18, bodyH * 2);
    ctx.fillRect(-r * 0.22, -bodyH, r * 0.18, bodyH * 2);
  } else if (def.patch) {
    ctx.fillStyle = c2;
    ctx.beginPath();
    ctx.moveTo(0, -bodyH * 0.2);
    ctx.lineTo(-bodyW * 0.85, -bodyH * 0.6);
    ctx.lineTo(-bodyW * 0.85, bodyH * 0.6);
    ctx.closePath();
    ctx.fill();
  } else if (def.stripe === 'v') {
    ctx.fillStyle = 'rgba(20, 30, 40, 0.55)';
    for (let i = -1; i <= 1; i++) {
      ctx.fillRect(i * r * 0.38, -bodyH, r * 0.12, bodyH * 2);
    }
  } else if (def.stripe === 'h') {
    ctx.fillStyle = c2;
    for (let i = -1; i <= 1; i++) {
      ctx.fillRect(-bodyW, i * bodyH * 0.45, bodyW * 2, bodyH * 0.16);
    }
  } else if (def.spots) {
    ctx.fillStyle = c2;
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.arc(i * r * 0.35, (i % 2) * r * 0.15, r * 0.12, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();

  // 胸ビレ
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.beginPath();
  ctx.ellipse(r * 0.15, bodyH * 0.25, r * 0.22, r * 0.1, 0.4 + sw2 * 0.05, 0, Math.PI * 2);
  ctx.fill();

  // 目
  const eyeX = bodyW * 0.55;
  const eyeY = -bodyH * 0.18;
  const eyeR = Math.max(1.4, r * 0.13);
  if (def.eyeGlow) {
    ctx.fillStyle = '#00e5ff';
    ctx.shadowColor = '#00e5ff';
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(eyeX, eyeY - eyeR * 0.4, eyeR * 0.9, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(eyeX, eyeY, eyeR, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#06101a';
  ctx.beginPath();
  ctx.arc(eyeX + eyeR * 0.2, eyeY, eyeR * 0.6, 0, Math.PI * 2);
  ctx.fill();
}

// --- 魚クラス ---
let _fishUidCounter = 1;

class Fish {
  constructor(type, customGrowth, opts = {}) {
    this.uid = opts.uid || ('f_' + Date.now() + '_' + (_fishUidCounter++));
    this.type = type;
    this.def = FISH_DATA.find(d => d.id === type) || FISH_DATA[0];
    this.growth = typeof customGrowth === 'number' ? customGrowth : 0.12;
    this.generation = opts.generation || 1;
    this.variant = opts.variant || 'normal';
    this.health = typeof opts.health === 'number' ? opts.health : 100;
    this.breedCooldown = typeof opts.breedCooldown === 'number' ? opts.breedCooldown : 15;
    this.courtingTimer = 0;
    this.acclimating = typeof opts.acclimating === 'number' ? opts.acclimating : 0; // 水合わせ残り秒数
    this.shockTimer = 0; // 水温ショック表示タイマー
    this.lastTemp = typeof opts.lastTemp === 'number' ? opts.lastTemp : null;

    // 寿命（秒）：個体差 ±10%、レア変異個体は1.2倍長寿
    const baseLife = this.def.lifespan || 1800;
    const rareLifeMul = this.variant === 'rare' ? 1.2 : 1.0;
    this.maxLifespan = opts.maxLifespan || Math.round(baseLife * (0.92 + Math.random() * 0.16) * rareLifeMul);
    this.age = typeof opts.age === 'number' ? opts.age : Math.round(this.growth * 120);

    // 初期性別の決定
    if (opts.sex) {
      this.sex = opts.sex;
    } else if (this.def.sexType === 'hermaphrodite') {
      this.sex = 'H';
    } else if (this.def.sexType === 'protandrous') {
      this.sex = this.growth >= 0.45 ? 'M' : 'U';
    } else if (this.def.sexType === 'protogynous') {
      this.sex = 'F';
    } else {
      this.sex = Math.random() < 0.5 ? 'M' : 'F';
    }

    const W = window.innerWidth || 1000;
    const H = window.innerHeight || 700;
    this.x = opts.x || (Math.random() * (W - 140) + 70);
    this.y = opts.y || (this.def.zone === 'bottom'
      ? H - 45 - Math.random() * 40
      : Math.random() * (H - 220) + 95);
    this.vx = (Math.random() - 0.5) * 1.5;
    this.vy = (Math.random() - 0.5) * 0.5;
    this.phase = Math.random() * Math.PI * 2;
    this.baseSpeed = this.def.tier >= 4 ? 0.78 : (this.def.size <= 45 ? 1.35 : 1.15);
  }

  getSexInfo() {
    if (this.sex === 'M') return { symbol: '♂', label: 'オス', cls: 'sex-m' };
    if (this.sex === 'F') return { symbol: '♀', label: 'メス', cls: 'sex-f' };
    if (this.sex === 'H') return { symbol: '⚥', label: '雌雄同体', cls: 'sex-h' };
    return { symbol: '⚲', label: '未分化(幼魚)', cls: 'sex-u' };
  }

  getSizeMM() {
    let sexScale = 1.0;
    if (this.def.sexType === 'protandrous' && this.sex === 'F') sexScale = 1.18;
    if (this.def.sexType === 'protogynous' && this.sex === 'M') sexScale = 1.15;
    return this.def.size * (0.32 + 0.68 * this.growth) * sexScale;
  }

  // 成魚時（100%成長時）の標準必要枠
  getAdultLoad() {
    return getSpeciesAdultLoad(this.def);
  }

  // 現在の体長（成長度・性転換体格差）に応じた現在の占有枠
  getSpaceLoad() {
    let sexScale = 1.0;
    if (this.def.sexType === 'protandrous' && this.sex === 'F') sexScale = 1.12;
    if (this.def.sexType === 'protogynous' && this.sex === 'M') sexScale = 1.10;
    const raw = this.getAdultLoad() * (0.40 + 0.60 * this.growth) * sexScale;
    return Number(raw.toFixed(1));
  }

  // 画面上の視覚的なスケール（小型魚・中型魚・大型魚・超大型魚の体格差をリアルに表現）
  getRadiusPx() {
    const mm = this.getSizeMM();
    if (mm <= 55) {
      // 小型魚 (クリオネ25mm, メダカ35mm, ネオン38mm, グッピー45mm, コリドラス50mm) -> r: 5.0〜11.8px
      return Math.max(5.0, mm * 0.215);
    }
    if (mm <= 135) {
      // 中型魚 (ベタ65mm, クマノミ95mm, ミドリフグ110mm, キンギョハナダイ120mm) -> r: 12.0〜21.5px
      return 11.8 + (mm - 55) * 0.122;
    }
    if (mm <= 260) {
      // 大型魚 (エンゼル150mm, 琉金170mm, ディスカス180mm, ナンヨウハギ240mm) -> r: 22.0〜33.0px
      return 21.5 + (mm - 135) * 0.092;
    }
    // 超大型・長大種 (アロワナ700mm, リュウグウノツカイ2800mm)
    // renderFishShape内でさらに全長3.5〜4.6倍に伸びるため、rは36〜48pxで圧倒的な迫力に
    return Math.min(48, 33.0 + Math.log10(mm / 260) * 14.5);
  }

  getRemainingLifeSec() {
    return Math.max(0, Math.round(this.maxLifespan - this.age));
  }

  getRemainingLifePct() {
    return Math.max(0, Math.min(100, ((this.maxLifespan - this.age) / this.maxLifespan) * 100));
  }

  isSenior() {
    return this.getRemainingLifePct() <= 18;
  }

  getGenerationBonus() {
    const genMul = 1 + Math.max(0, this.generation - 1) * 0.12;
    const varMul = this.variant === 'rare' ? 1.35 : 1.0;
    return genMul * varMul;
  }

  getEffectiveRate(tank) {
    const ts = window.getTimeScaleMul ? window.getTimeScaleMul() : 1.0;
    const base = this.def.rate * (0.5 + this.growth * 0.5) * this.getGenerationBonus() * ts;
    if (!tank) return base;
    const suit = tank.evaluateFishSuitability(this);
    const purityMul = 0.4 + (tank.waterPurity / 100) * 0.6;
    const healthMul = 0.3 + (this.health / 100) * 0.7;
    return base * suit.rateMul * purityMul * healthMul;
  }

  getReleaseValue() {
    const baseByTier = { 1: 35, 2: 260, 3: 1250, 4: 4600 }[this.def.tier] || 50;
    return Math.floor(baseByTier * (0.5 + this.growth * 1.0) * this.getGenerationBonus());
  }

  canBreed() {
    return this.growth >= 0.65 && this.health >= 70 && this.breedCooldown <= 0 && this.sex !== 'U';
  }

  update(tank) {
    const W = window.innerWidth;
    const H = window.innerHeight;
    this.phase += 0.08;
    if (this.courtingTimer > 0) this.courtingTimer--;

    const ts = window.getTimeScaleMul ? window.getTimeScaleMul() : 1.0;
    const suit = tank.evaluateFishSuitability(this);
    if (tank.waterPurity > 55 && suit.canGrow && this.growth < 1.0) {
      const growSpeed = 0.000035 * suit.growMul * ts;
      this.growth = Math.min(1.0, this.growth + growSpeed);
    }

    if (this.def.shape === 'jelly' || this.def.shape === 'mendako' || this.def.shape === 'clione') {
      this.vy = Math.sin(this.phase * 0.45) * 0.45 - 0.05;
      this.vx = Math.cos(this.phase * 0.25) * 0.35;
      this.x += this.vx;
      this.y += this.vy;
      if (this.y < 85) this.y = 85;
      if (this.y > H - 90) this.y = H - 90;
      if (this.x < 50) this.x = W - 50;
      if (this.x > W - 50) this.x = 50;
      return;
    }

    let target = null;
    let minDist = 240;
    for (const f of tank.foods) {
      const d = Math.hypot(f.x - this.x, f.y - this.y);
      if (d < minDist) { minDist = d; target = f; }
    }

    const r = this.getRadiusPx();
    if (target) {
      const ang = Math.atan2(target.y - this.y, target.x - this.x);
      this.vx += Math.cos(ang) * 0.11;
      this.vy += Math.sin(ang) * 0.11;
      if (minDist < r + 8) {
        target.eaten = true;
        if (suit.canGrow) {
          // エサやりによる成長もタイムスケールに連動（極端に遅い設定でもエサの手応えは少し残す）
          const feedScale = Math.min(1.5, Math.max(0.08, Math.pow(ts, 0.75)));
          this.growth = Math.min(1.0, this.growth + 0.015 * suit.growMul * feedScale);
        }
        this.health = Math.min(100, this.health + 2.5);
        window.addChillPoints(this.getEffectiveRate(tank) * 1.5);
        tank.bubbles.push({ x: this.x, y: this.y, r: 2, vy: -0.9 });
      }
    } else {
      this.vx += (Math.random() - 0.5) * 0.05;
      this.vy += (Math.random() - 0.5) * 0.03;
    }

    const margin = Math.max(75, r * 1.6);
    if (this.x < margin) this.vx += 0.07;
    if (this.x > W - margin) this.vx -= 0.07;
    if (this.def.zone === 'bottom') {
      if (this.y < H - 110) this.vy += 0.06;
      if (this.y > H - 35) this.vy -= 0.08;
    } else {
      if (this.y < 95) this.vy += 0.06;
      if (this.y > H - 70) this.vy -= 0.07;
    }

    const healthSpeedMul = (this.health < 50 ? 0.6 : 1.0) * (this.isSenior() && tank.typeDef.hasLifespan ? 0.78 : 1.0);
    const maxSp = this.baseSpeed * healthSpeedMul;
    const sp = Math.hypot(this.vx, this.vy);
    if (sp > maxSp) {
      this.vx = (this.vx / sp) * maxSp;
      this.vy = (this.vy / sp) * maxSp;
    } else if (sp < 0.3) {
      this.vx *= 1.05;
    }

    this.x += this.vx;
    this.y += this.vy;
  }

  draw(ctx, isNight, tank) {
    ctx.save();
    ctx.translate(this.x, this.y);
    const r = this.getRadiusPx();

    ctx.save();
    if (this.def.shape !== 'jelly' && this.def.shape !== 'mendako' && this.def.shape !== 'clione') {
      const dir = this.vx >= 0 ? 1 : -1;
      const tilt = Math.atan2(this.vy, Math.abs(this.vx)) * 0.32 * dir;
      ctx.rotate(tilt);
      ctx.scale(dir, 1);
    }
    if (this.health < 60) {
      ctx.globalAlpha = 0.65 + (this.health / 100) * 0.35;
    }
    renderFishShape(ctx, this.def, r, this.phase, isNight, {
      sex: this.sex,
      variant: this.variant
    });
    ctx.restore();

    if (this.courtingTimer > 0) {
      ctx.fillStyle = '#ff80ab';
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('💕', 0, -r - 8 - Math.sin(this.phase * 0.5) * 3);
    }

    // 水合わせ中（温度・水質順応用の保護バッグ表示）
    if (this.acclimating > 0) {
      ctx.strokeStyle = 'rgba(100, 255, 218, 0.55)';
      ctx.fillStyle = 'rgba(100, 255, 218, 0.08)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(0, 0, r * 1.35 + 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#64ffda';
      ctx.font = '9px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`💧水合わせ中(${Math.ceil(this.acclimating)}s)`, 0, -r - 9);
    } else if (this.shockTimer > 0) {
      ctx.fillStyle = '#ff5252';
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('⚡水温ショック！', 0, -r - 8);
    } else if (tank && tank.typeDef.strictLevel > 0) {
      const suit = tank.evaluateFishSuitability(this);
      if (!suit.waterOk || !suit.tempOk || this.health < 55) {
        ctx.fillStyle = this.health < 55 ? '#ff5252' : '#ffd54f';
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(this.health < 55 ? '⚠️弱り' : '💧環境差', 0, -r - 6);
      } else if (tank.typeDef.hasLifespan && this.isSenior()) {
        ctx.fillStyle = 'rgba(255, 224, 130, 0.85)';
        ctx.font = '9px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('⏳老魚', 0, -r - 5);
      }
    }

    ctx.restore();
  }

  serialize() {
    return {
      uid: this.uid,
      type: this.type,
      growth: Number(this.growth.toFixed(4)),
      sex: this.sex,
      generation: this.generation,
      variant: this.variant,
      health: Math.round(this.health),
      breedCooldown: Math.round(this.breedCooldown),
      age: Math.round(this.age),
      maxLifespan: Math.round(this.maxLifespan)
    };
  }

  static deserialize(d) {
    return new Fish(d.type, d.growth, {
      uid: d.uid,
      sex: d.sex,
      generation: d.generation || 1,
      variant: d.variant || 'normal',
      health: typeof d.health === 'number' ? d.health : 100,
      breedCooldown: typeof d.breedCooldown === 'number' ? d.breedCooldown : 10,
      age: typeof d.age === 'number' ? d.age : 0,
      maxLifespan: d.maxLifespan
    });
  }
}

// --- 交配で産まれた受精卵クラス ---
class SpawnedEgg {
  constructor(type, generation, x, y, progress = 0, variant = 'normal') {
    this.type = type;
    this.def = FISH_DATA.find(d => d.id === type) || FISH_DATA[0];
    this.generation = generation || 2;
    this.variant = variant;
    const W = window.innerWidth || 1000;
    const H = window.innerHeight || 700;
    this.x = x || (Math.random() * (W - 160) + 80);
    this.y = y || (H - 28 - Math.random() * 14);
    this.progress = progress;
  }

  getSpaceLoad() {
    return Number((getSpeciesAdultLoad(this.def) * 0.35).toFixed(1));
  }

  draw(ctx, time) {
    ctx.save();
    ctx.translate(this.x, this.y);
    const pulse = 1 + Math.sin(time * 0.08 + this.x) * 0.08;
    ctx.scale(pulse, pulse);

    ctx.shadowColor = this.variant === 'rare' ? '#ffd54f' : this.def.c1;
    ctx.shadowBlur = 10;
    ctx.fillStyle = this.variant === 'rare' ? 'rgba(255, 213, 79, 0.85)' : 'rgba(224, 247, 250, 0.78)';
    ctx.beginPath();
    ctx.arc(0, 0, 6.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = this.def.c1;
    ctx.beginPath();
    ctx.arc(0, 0, 3.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = '9px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`🥚${Math.floor(this.progress)}%`, 0, -10);
    ctx.restore();
  }

  serialize() {
    return {
      type: this.type,
      generation: this.generation,
      x: Math.round(this.x),
      y: Math.round(this.y),
      progress: Math.round(this.progress),
      variant: this.variant
    };
  }

  static deserialize(d) {
    return new SpawnedEgg(d.type, d.generation, d.x, d.y, d.progress || 0, d.variant || 'normal');
  }
}

// --- ヤマトヌマエビ＆水草 ---
class Shrimp {
  constructor() {
    const W = window.innerWidth || 1000;
    this.x = Math.random() * (W - 100) + 50;
    this.vx = (Math.random() < 0.5 ? -1 : 1) * 0.65;
    this.phase = Math.random() * 10;
  }
  update(tank) {
    const W = window.innerWidth;
    const H = window.innerHeight;
    this.phase += 0.15;
    const bottomFood = tank.foods.find(f => f.y > H - 45);
    if (bottomFood) {
      this.vx = bottomFood.x > this.x ? 0.9 : -0.9;
      if (Math.abs(bottomFood.x - this.x) < 12) bottomFood.eaten = true;
    }
    this.x += this.vx;
    if (this.x < 40) this.vx = Math.abs(this.vx);
    if (this.x > W - 40) this.vx = -Math.abs(this.vx);
  }
  draw(ctx) {
    const H = window.innerHeight;
    const y = H - 24 + Math.sin(this.x * 0.02) * 5;
    ctx.save();
    ctx.translate(this.x, y);
    ctx.scale(this.vx >= 0 ? 1 : -1, 1);
    ctx.fillStyle = 'rgba(255, 160, 120, 0.85)';
    ctx.beginPath();
    ctx.ellipse(0, 0, 9, 4, -0.15, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 220, 200, 0.7)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(7, -2);
    ctx.quadraticCurveTo(15, -8 + Math.sin(this.phase) * 2, 20, -4);
    ctx.stroke();
    ctx.restore();
  }
}

class Plant {
  constructor(x) {
    this.x = x;
    this.blades = 2 + Math.floor(Math.random() * 3);
    this.height = 75 + Math.random() * 65;
    this.hue = 125 + Math.random() * 35;
  }
  draw(ctx, isNight, time, waterType) {
    const H = window.innerHeight;
    ctx.save();
    let baseHue = this.hue;
    if (waterType === 'marine') baseHue = 310 + (this.hue % 40);
    if (waterType === 'deep') baseHue = 200 + (this.hue % 35);

    for (let b = 0; b < this.blades; b++) {
      const bx = this.x + (b - 1) * 8;
      const h = this.height * (0.75 + b * 0.15);
      const sway = Math.sin(time * 0.018 + this.x * 0.01 + b) * 14;
      ctx.strokeStyle = `hsl(${baseHue}, 52%, ${isNight ? 18 : 32}%)`;
      ctx.lineWidth = 5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(bx, H - 18);
      ctx.quadraticCurveTo(bx + sway * 0.4, H - 18 - h * 0.5, bx + sway, H - 18 - h);
      ctx.stroke();
    }
    ctx.restore();
  }
}
