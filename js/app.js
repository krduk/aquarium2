// --- グローバル状態管理・UI・メインループ ---
const canvas = document.getElementById('tank');
const ctx = canvas.getContext('2d');
let W = window.innerWidth, H = window.innerHeight;

function resize() {
  W = canvas.width = window.innerWidth;
  H = canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

let chillPoints = 300;
let unlockedFish = { neon: true, medaka: true };
let tanks = [];
let activeTankIndex = 0;
let lightMode = 0; // 0: 自動(ゲーム内時刻連動), 1: 朝固定, 2: 昼固定, 3: 夕固定, 4: 夜固定
let timeScaleId = 'normal'; // 'realtime' | 'slow' | 'normal' | 'fast' | 'hyper'
// ゲーム内時計（分単位: 0〜1439 = 00:00〜23:59）。初期値は現在時刻
let gameClockMinutes = new Date().getHours() * 60 + new Date().getMinutes();
let time = 0;
let inspectedFish = null;
let adoptFilterWater = 'all';
let adoptSelectedSex = 'auto';

function getTimeScaleDef() {
  return TIME_SCALES.find(t => t.id === timeScaleId) || TIME_SCALES[2];
}

window.getTimeScaleMul = function() {
  return getTimeScaleDef().mul;
};

function getGameClockHHMM() {
  if (timeScaleId === 'realtime') {
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
  }
  const totalMin = Math.floor(((gameClockMinutes % 1440) + 1440) % 1440);
  const hh = String(Math.floor(totalMin / 60)).padStart(2, '0');
  const mm = String(totalMin % 60).padStart(2, '0');
  return `${hh}:${mm}`;
}

function getGameHour() {
  if (timeScaleId === 'realtime') {
    return new Date().getHours();
  }
  const totalMin = ((gameClockMinutes % 1440) + 1440) % 1440;
  return Math.floor(totalMin / 60);
}

// ゲーム内基準秒数を、現在のタイムスケールにおける実時間表記へ変換
function formatRealDuration(baseGameSec) {
  const realSec = Math.max(1, Math.round(baseGameSec / window.getTimeScaleMul()));
  if (realSec >= 86400) return `約${(realSec / 86400).toFixed(1)}日`;
  if (realSec >= 3600) return `約${(realSec / 3600).toFixed(1)}時間`;
  if (realSec >= 60) return `約${Math.ceil(realSec / 60)}分`;
  return `約${realSec}秒`;
}

function getActiveTank() {
  return tanks[activeTankIndex] || tanks[0];
}

window.addChillPoints = function(amount) {
  chillPoints += amount;
};

window.getCasualTank = function(excludeId) {
  return tanks.find(t => t.id !== excludeId && t.typeId === 'casual') || null;
};

window.getOtherTank = function(excludeId) {
  return tanks.find(t => t.id !== excludeId) || null;
};

window.onFishPassedAway = function(fish) {
  if (inspectedFish === fish) {
    closeModals();
  }
  // 全水槽で魚も卵も0になり、しずくも100未満の場合は救済
  const totalLiving = tanks.reduce((s, t) => s + t.fishes.length + t.spawnedEggs.length, 0);
  if (totalLiving === 0 && chillPoints < 120) {
    chillPoints = 150;
  }
};

function formatLengthMM(mm) {
  if (mm >= 1000) return `${(mm / 1000).toFixed(2)} m (${Math.round(mm).toLocaleString()} mm)`;
  if (mm >= 100) return `${(mm / 10).toFixed(1)} cm (${Math.round(mm)} mm)`;
  return `${Math.round(mm)} mm`;
}

function formatShortSize(mm) {
  if (mm >= 1000) return `${(mm / 1000).toFixed(1)}m`;
  if (mm >= 100) return `${(mm / 10).toFixed(0)}cm`;
  return `${ (mm / 10).toFixed(1) }cm`;
}

function formatRate(rate) {
  if (rate <= 0) return '0';
  if (rate >= 10) return rate.toFixed(1);
  if (rate >= 0.5) return rate.toFixed(2);
  return rate.toFixed(3);
}

// --- トースト通知 ---
window.showToast = function(msg) {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  container.appendChild(el);
  setTimeout(() => {
    if (el.parentNode) el.parentNode.removeChild(el);
  }, 4200);
};

// --- セーブ＆ロード（旧セーブデータv3からの引き継ぎ対応） ---
const SAVE_KEY_V4 = 'chill_aquarium_v4_save';
const OLD_SAVE_KEY_V3 = 'chill_aquarium_v3_save';

function safeSave() {
  try {
    const data = {
      version: 4,
      chillPoints: Number(chillPoints.toFixed(3)),
      unlockedFish,
      activeTankIndex,
      lightMode,
      timeScaleId,
      gameClockMinutes: Math.round(gameClockMinutes),
      tanks: tanks.map(t => t.serialize())
    };
    window.localStorage.setItem(SAVE_KEY_V4, JSON.stringify(data));
  } catch (e) {}
}

function safeLoad() {
  try {
    const rawV4 = window.localStorage.getItem(SAVE_KEY_V4);
    if (rawV4) {
      const data = JSON.parse(rawV4);
      chillPoints = typeof data.chillPoints === 'number' ? data.chillPoints : 300;
      if (data.unlockedFish) unlockedFish = data.unlockedFish;
      if (typeof data.lightMode === 'number') lightMode = data.lightMode;
      if (data.timeScaleId && TIME_SCALES.some(t => t.id === data.timeScaleId)) {
        timeScaleId = data.timeScaleId;
      }
      if (typeof data.gameClockMinutes === 'number') {
        gameClockMinutes = data.gameClockMinutes;
      }
      if (Array.isArray(data.tanks) && data.tanks.length > 0) {
        tanks = data.tanks.map(td => Tank.deserialize(td));
      }
      activeTankIndex = Math.min(tanks.length - 1, Math.max(0, data.activeTankIndex || 0));
    } else {
      // 旧バージョンのセーブがあれば引き継ぐ
      const rawV3 = window.localStorage.getItem(OLD_SAVE_KEY_V3);
      if (rawV3) {
        const old = JSON.parse(rawV3);
        chillPoints = typeof old.chillPoints === 'number' ? old.chillPoints : 300;
        if (old.unlockedFish) unlockedFish = old.unlockedFish;
        const firstTank = new Tank({
          name: '第1水槽 (万能)',
          typeId: 'casual',
          waterPurity: old.waterPurity || 100,
          shrimpCount: old.shrimpCount || 0,
          filterLevel: old.filterLevel || 1,
          plantCount: old.plantCount || 6,
          fishes: Array.isArray(old.fishes) ? old.fishes : []
        });
        tanks.push(firstTank);
      }
    }
  } catch (e) {}

  if (tanks.length === 0) {
    const t1 = new Tank({
      name: '第1水槽 (万能)',
      typeId: 'casual',
      waterType: 'fresh'
    });
    // 初期魚としてネオンテトラのペア(♂/♀)とヒメダカを入れる
    t1.fishes.push(new Fish('neon', 0.45, { sex: 'M' }));
    t1.fishes.push(new Fish('neon', 0.45, { sex: 'F' }));
    t1.fishes.push(new Fish('medaka', 0.35, { sex: 'F' }));
    tanks.push(t1);
  }
}

// --- 照明テーマ（ゲーム内時刻または手動固定） ---
function getActiveTheme() {
  const tank = getActiveTank();
  if (lightMode === 1) return { ...LIGHT_THEMES.morning, modeText: '固定(朝)' };
  if (lightMode === 2) return { ...LIGHT_THEMES.day, modeText: '固定(昼)' };
  if (lightMode === 3) return { ...LIGHT_THEMES.sunset, modeText: '固定(夕)' };
  if (lightMode === 4) return { ...LIGHT_THEMES.night, modeText: '固定(夜)' };

  const hour = getGameHour();
  let base = LIGHT_THEMES.night;
  let text = '自動(夜)';
  if (hour >= 5 && hour < 9) { base = LIGHT_THEMES.morning; text = '自動(朝)'; }
  else if (hour >= 9 && hour < 16) { base = LIGHT_THEMES.day; text = '自動(昼)'; }
  else if (hour >= 16 && hour < 19) { base = LIGHT_THEMES.sunset; text = '自動(夕)'; }

  // 深海モードの水槽は少し神秘的な深い青紫がかったトーンに
  if (tank && tank.waterType === 'deep' && lightMode === 0) {
    return {
      label: base.label,
      top: '#0c1f38',
      bottom: '#030712',
      ray: 'rgba(100, 180, 255, 0.03)',
      modeText: text
    };
  }
  return { ...base, modeText: text };
}

window.getActiveThemeLabel = function() {
  return getActiveTheme().label;
};

// --- アンビエントサウンド ---
let audioCtx = null;
let soundEnabled = false;
let soundTimer = null;

function toggleSound() {
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    soundEnabled = !soundEnabled;
    document.getElementById('btn-sound').textContent = `♪ 音: ${soundEnabled ? 'ON' : 'OFF'}`;
    if (soundEnabled) {
      if (audioCtx.state === 'suspended') audioCtx.resume();
      playAmbientChord();
      soundTimer = setInterval(() => {
        if (Math.random() < 0.65) playAmbientChord();
      }, 2800);
    } else {
      clearInterval(soundTimer);
    }
  } catch (e) {}
}

function playAmbientChord() {
  if (!soundEnabled || !audioCtx) return;
  const scale = [261.63, 293.66, 329.63, 392.00, 440.00, 523.25, 587.33];
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = 'sine';
  osc.frequency.value = scale[Math.floor(Math.random() * scale.length)];
  gain.gain.setValueAtTime(0.0001, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.025, audioCtx.currentTime + 1.4);
  gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 4.5);
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start();
  osc.stop(audioCtx.currentTime + 4.5);
}

// --- 水槽タブバー描画＆切り替え ---
function renderTankTabs() {
  const bar = document.getElementById('tank-tabs');
  if (!bar) return;
  bar.innerHTML = '';

  tanks.forEach((t, idx) => {
    const btn = document.createElement('div');
    btn.className = `tank-tab ${idx === activeTankIndex ? 'active' : ''}`;
    const hasWarn = t.typeDef.strictLevel > 0 && (t.isOvercrowded() || t.fishes.some(f => {
      const s = t.evaluateFishSuitability(f);
      return !s.waterOk || !s.tempOk || f.health < 55;
    }));
    const statusIcon = t.paused ? '⏸' : (hasWarn ? '⚠️' : (t.spawnedEggs.length > 0 ? '🥚' : ''));
    const capTxt = t.typeDef.hasCapacityLimit ? `${t.getCurrentLoad()}/${t.getMaxCapacity()}枠` : `${t.fishes.length}匹`;
    btn.innerHTML = `
      <span>${t.name}</span>
      <span class="tank-badge ${t.typeDef.badgeClass}">${t.typeDef.badge}</span>
      <span style="opacity:0.75;">🐟${capTxt}${statusIcon}</span>
    `;
    btn.onclick = () => {
      activeTankIndex = idx;
      closeModals();
      updateUI();
      safeSave();
    };
    bar.appendChild(btn);
  });

  if (tanks.length < 6) {
    const addBtn = document.createElement('div');
    addBtn.className = 'tank-tab tank-tab-Add';
    addBtn.textContent = '＋ 水槽を追加';
    addBtn.onclick = openNewTankModal;
    bar.appendChild(addBtn);
  }
}

// --- 新規水槽追加モーダル ---
function openNewTankModal() {
  closeModals();
  const listEl = document.getElementById('new-tank-list');
  listEl.innerHTML = '';

  Object.values(TANK_TYPES).forEach(tDef => {
    const card = document.createElement('div');
    card.className = 'egg-card';
    const canBuy = chillPoints >= tDef.unlockCost;
    const costText = tDef.unlockCost === 0 ? '無料 (0 しずく)' : `${tDef.unlockCost.toLocaleString()} しずく`;
    card.innerHTML = `
      <div class="egg-info">
        <span class="egg-title">
          ${tDef.name}
          <span class="tank-badge ${tDef.badgeClass}">${tDef.badge}</span>
          <span style="font-size:11px; color:var(--accent);">しずく×${tDef.rateMul.toFixed(1)}</span>
        </span>
        <span class="egg-desc">${tDef.desc}</span>
      </div>
      <button ${canBuy ? '' : 'disabled'} onclick="createNewTank('${tDef.id}')">${costText}</button>
    `;
    listEl.appendChild(card);
  });

  document.getElementById('modal-new-tank').style.display = 'flex';
}

window.createNewTank = function(typeId) {
  const tDef = TANK_TYPES[typeId];
  if (!tDef || tanks.length >= 6 || chillPoints < tDef.unlockCost) return;
  chillPoints -= tDef.unlockCost;

  const num = tanks.length + 1;
  const shortLabel = typeId === 'casual' ? '万能' : (typeId === 'harmony' ? '中級' : 'プロ');
  const newTank = new Tank({
    name: `第${num}水槽 (${shortLabel})`,
    typeId: typeId,
    waterType: 'fresh'
  });
  tanks.push(newTank);
  activeTankIndex = tanks.length - 1;
  closeModals();
  updateUI();
  safeSave();
  window.showToast(`🎉 「${newTank.name}」を新しく設置しました！`);
};

// --- 神秘の卵＆魚を選んでお迎え（指名導入） ---
window.switchAdoptTab = function(tabName) {
  const tabEgg = document.getElementById('subtab-egg');
  const tabSelect = document.getElementById('subtab-select');
  const paneEgg = document.getElementById('pane-adopt-egg');
  const paneSelect = document.getElementById('pane-adopt-select');

  if (tabName === 'egg') {
    tabEgg.classList.add('active');
    tabSelect.classList.remove('active');
    paneEgg.style.display = 'flex';
    paneSelect.style.display = 'none';
  } else {
    tabEgg.classList.remove('active');
    tabSelect.classList.add('active');
    paneEgg.style.display = 'none';
    paneSelect.style.display = 'flex';
    renderDirectAdoptList();
  }
};

window.hatchEgg = function(eggTier) {
  const tank = getActiveTank();
  const costs = { 1: 100, 2: 1000, 3: 10000 };
  const cost = costs[eggTier];
  if (chillPoints < cost) return;

  let pool = [];
  if (eggTier === 1) {
    pool = FISH_DATA.filter(d => d.tier === 1 || (d.tier === 2 && Math.random() < 0.35));
  } else if (eggTier === 2) {
    pool = FISH_DATA.filter(d => d.tier === 2 || d.tier === 3);
  } else {
    pool = FISH_DATA.filter(d => d.tier === 3 || d.tier === 4);
  }

  // 中級・上級水槽の場合は残り収容枠に入る魚種に絞る
  if (tank.typeDef.hasCapacityLimit) {
    pool = pool.filter(d => tank.canFitFish(d, 0.20));
    if (pool.length === 0) {
      window.showToast('⚠️ 水槽の空き枠が足りません！「環境・水槽管理」から水槽サイズを拡張してください');
      return;
    }
  }

  chillPoints -= cost;

  // 中級・上級水槽で卵を孵す場合は現在の水質に合う魚が出やすい親切補正
  if (tank.typeDef.strictLevel > 0) {
    const matched = pool.filter(d => d.water === tank.waterType);
    if (matched.length > 0 && Math.random() < 0.7) pool = matched;
  }

  const chosen = pool[Math.floor(Math.random() * pool.length)];
  unlockedFish[chosen.id] = true;
  const newFish = new Fish(chosen.id, 0.20);
  tank.fishes.push(newFish);
  tank.updateSequentialHermaphrodites();

  closeModals();
  updateUI();
  safeSave();
  openInspector(newFish);
};

window.setAdoptFilter = function(water) {
  adoptFilterWater = water;
  renderDirectAdoptList();
};

window.setAdoptSex = function(sex) {
  adoptSelectedSex = sex;
  const encycSel = document.getElementById('encyc-sex-select');
  if (encycSel && encycSel.value !== sex) encycSel.value = sex;
  renderDirectAdoptList();
  renderEncyclopediaList();
};

function renderDirectAdoptList() {
  const tank = getActiveTank();
  const grid = document.getElementById('direct-adopt-grid');
  if (!grid) return;
  grid.innerHTML = '';

  const noteEl = document.getElementById('direct-adopt-note');
  noteEl.textContent = '💡 図鑑に登録された魚は、通常より高価なしずくを支払うことで魚種・性別を指定して直接お迎えできます（未登録の魚は神秘の卵から発見できます）。';

  const filtered = FISH_DATA.filter(d => adoptFilterWater === 'all' || d.water === adoptFilterWater);
  filtered.forEach(d => {
    const canSelect = !!unlockedFish[d.id];
    const item = document.createElement('div');
    item.className = `list-item ${canSelect ? '' : 'locked'}`;

    const c = document.createElement('canvas');
    c.width = 80; c.height = 50;
    c.className = 'preview-canvas';
    item.appendChild(c);

    const pctx = c.getContext('2d');
    pctx.save();
    pctx.translate(40, 25);
    if (!canSelect) pctx.filter = 'brightness(0) opacity(0.5)';
    renderFishShape(pctx, d, getPreviewRadius(d, 'card'), 1.2, false, { sex: adoptSelectedSex === 'F' ? 'F' : 'M' });
    pctx.restore();

    const wLabel = WATER_TYPES[d.water].short;
    const dummySuit = tank.evaluateFishSuitability({ def: d });
    const envFitHtml = tank.typeDef.strictLevel === 0
      ? `<span class="env-match-ok">◎ 万能適合</span>`
      : (dummySuit.waterOk && dummySuit.tempOk
        ? `<span class="env-match-ok">◎ 現環境に適合</span>`
        : `<span class="env-match-ng">△ 要:${wLabel} ${d.tempMin}-${d.tempMax}℃</span>`);

    const sexTag = d.sexType === 'protandrous' ? '雄性先熟'
      : (d.sexType === 'protogynous' ? '雌性先熟'
      : (d.sexType === 'hermaphrodite' ? '雌雄同体⚥' : '♂/♀選択可'));

    const adultLoad = getSpeciesAdultLoad(d);
    const fitsSpace = tank.canFitFish(d, 0.45);
    const canAfford = canSelect && chillPoints >= d.price && fitsSpace;

    const infoDiv = document.createElement('div');
    infoDiv.innerHTML = `
      <strong>${canSelect ? d.name : '？？？'}</strong><br>
      <span class="env-tag">${canSelect ? `${wLabel} / ${formatShortSize(d.size)} (成魚${adultLoad}枠)` : '図鑑未登録'}</span><br>
      <span style="font-size:9px; color:#b0bec5;">${canSelect ? `${sexTag}・寿命${formatRealDuration(d.lifespan)}` : '卵から孵化で解放'}</span><br>
      ${canSelect ? (fitsSpace ? envFitHtml : '<span class="env-match-ng">⚠️ 空き枠不足</span>') : ''}
    `;
    item.appendChild(infoDiv);

    const btn = document.createElement('button');
    btn.style.marginTop = '4px';
    btn.style.width = '100%';
    btn.disabled = !canAfford;
    btn.textContent = !canSelect ? '未発見' : (!fitsSpace ? '枠不足(要拡張)' : `${d.price.toLocaleString()} しずく`);
    btn.onclick = () => adoptSpecificFish(d.id);
    item.appendChild(btn);

    grid.appendChild(item);
  });
}

window.adoptSpecificFish = function(fishId) {
  const tank = getActiveTank();
  const def = FISH_DATA.find(d => d.id === fishId);
  if (!def || chillPoints < def.price) return;
  if (!tank.canFitFish(def, 0.45)) {
    window.showToast('⚠️ 水槽の収容枠が足りません！水槽サイズを拡張するか初級水槽へお迎えしてください');
    return;
  }

  chillPoints -= def.price;
  unlockedFish[def.id] = true;

  let chosenSex = undefined;
  if (def.sexType === 'normal' && (adoptSelectedSex === 'M' || adoptSelectedSex === 'F')) {
    chosenSex = adoptSelectedSex;
  }

  // 指名導入個体はすぐに環境やペアリングを楽しめるよう若魚(成長45%)でお迎え（中級・上級では水合わせ状態で導入）
  const acclimSec = tank.typeDef.strictLevel > 0 ? 15 : 0;
  const newFish = new Fish(def.id, 0.45, { sex: chosenSex, acclimating: acclimSec, lastTemp: tank.temperature });
  tank.fishes.push(newFish);
  tank.updateSequentialHermaphrodites();

  closeModals();
  updateUI();
  safeSave();
  openInspector(newFish);
};

// --- 環境・水槽管理アクション ---
window.changeTankWaterType = function(newWaterType) {
  const tank = getActiveTank();
  if (!WATER_TYPES[newWaterType]) return;
  tank.waterType = newWaterType;
  updateManageModalUI();
  updateUI();
  safeSave();
  window.showToast(`💧 「${tank.name}」の水質を【${WATER_TYPES[newWaterType].label}】に切り替えました`);
};

window.adjustTargetTemp = function(delta) {
  const tank = getActiveTank();
  tank.targetTemp = Math.max(1, Math.min(32, tank.targetTemp + delta));
  // 初級のみ即座に反映、中級・上級はヒーター・クーラー出力と水量に応じて徐々に変化（急変による水温ショック防止）
  if (tank.typeDef.strictLevel === 0) {
    tank.temperature = tank.targetTemp;
  }
  updateManageModalUI();
  updateUI();
  safeSave();
};

window.matchTankToFish = function() {
  const tank = getActiveTank();
  if (tank.fishes.length === 0) return;
  const mainFish = tank.fishes[0].def;
  tank.waterType = mainFish.water;
  const midTemp = Math.round((mainFish.tempMin + mainFish.tempMax) / 2);
  tank.targetTemp = midTemp;
  if (tank.typeDef.strictLevel === 0) {
    tank.temperature = midTemp;
  }
  const thermal = tank.getThermalStatus();
  updateManageModalUI();
  updateUI();
  safeSave();
  if (thermal.bottleneck) {
    window.showToast(`⚠️ 目標を${midTemp}℃に設定しましたが、${thermal.bottleneck}`);
  } else {
    window.showToast(`✨ ${mainFish.name}に合わせて目標を【${WATER_TYPES[mainFish.water].label} / ${midTemp}℃】に設定しました！`);
  }
};

window.doWaterChange = function(matchTemp = false) {
  const tank = getActiveTank();
  if (matchTemp) {
    if (chillPoints < 50) {
      window.showToast('⚠️ 温度合わせ水換えには 50 しずくが必要です');
      return;
    }
    chillPoints -= 50;
  } else if (tank.typeDef.strictLevel > 0) {
    // そのまま水換え（常温21℃の水道水/換水が入るため、水温が21℃側へ引っ張られる）
    const tapTemp = 21.0;
    const shiftRatio = tank.typeId === 'realistic' ? 0.38 : 0.18;
    tank.temperature = Number((tank.temperature + (tapTemp - tank.temperature) * shiftRatio).toFixed(1));
  }

  tank.waterPurity = 100;
  tank.waterChangeBoost = 45;
  tank.sludge = Number((tank.sludge * 0.4).toFixed(1));
  tank.foods = [];
  for (let i = 0; i < 12; i++) {
    tank.bubbles.push({
      x: Math.random() * W,
      y: H - Math.random() * 100,
      r: Math.random() * 3 + 1.5,
      vy: -(Math.random() * 1.5 + 0.7)
    });
  }
  updateManageModalUI();
  updateUI();
  safeSave();
  window.showToast(matchTemp
    ? `🌡 「${tank.name}」を温度合わせして水換えし、水温変化なしで水質100%に回復しました！（産卵刺激＋）`
    : `🪣 「${tank.name}」をそのまま水換えしました（常温水により現在水温 ${tank.temperature.toFixed(1)}℃）`);
};

window.doCleanSludge = function() {
  const tank = getActiveTank();
  tank.sludge = 0;
  tank.foods = tank.foods.filter(f => f.y <= H - 35);
  for (let i = 0; i < 8; i++) {
    tank.bubbles.push({
      x: Math.random() * W,
      y: H - 20 - Math.random() * 40,
      r: Math.random() * 2.5 + 1.2,
      vy: -(Math.random() * 1.2 + 0.6)
    });
  }
  updateManageModalUI();
  updateUI();
  safeSave();
  window.showToast(`🧹 「${tank.name}」の底床クリーナー・コケ掃除を行い、フィルターのろ過効率が100%に回復しました！`);
};

window.toggleTankPause = function() {
  const tank = getActiveTank();
  tank.paused = !tank.paused;
  updateManageModalUI();
  updateUI();
  safeSave();
};

window.setTimeScale = function(newId) {
  const found = TIME_SCALES.find(t => t.id === newId);
  if (!found) return;
  if (newId === 'realtime') {
    gameClockMinutes = new Date().getHours() * 60 + new Date().getMinutes();
  }
  timeScaleId = found.id;
  updateManageModalUI();
  updateUI();
  safeSave();
  window.showToast(`⏳ 時間の進み方を【${found.label}】に変更しました`);
};

window.renameActiveTank = function() {
  const tank = getActiveTank();
  const input = document.getElementById('input-tank-name');
  if (input && input.value.trim()) {
    tank.name = input.value.trim().slice(0, 18);
    updateManageModalUI();
    updateUI();
    safeSave();
    window.showToast(`🏷 水槽の名前を「${tank.name}」に変更しました`);
  }
};

window.buyShrimp = function() {
  const tank = getActiveTank();
  if (chillPoints >= 300) {
    chillPoints -= 300;
    tank.shrimpCount++;
    tank.shrimps.push(new Shrimp());
    updateManageModalUI();
    updateUI();
    safeSave();
  }
};

window.upgradeTankSize = function() {
  const tank = getActiveTank();
  if (!tank.typeDef.hasCapacityLimit) return;
  if (tank.sizeLevel >= TANK_SIZES.length) return;
  const nextDef = TANK_SIZES[tank.sizeLevel];
  if (!nextDef || chillPoints < nextDef.cost) return;

  chillPoints -= nextDef.cost;
  tank.sizeLevel++;
  updateManageModalUI();
  updateUI();
  safeSave();
  window.showToast(`📐 「${tank.name}」を【${nextDef.name} (最大${nextDef.capacity}枠)】に拡張しました！`);
};

window.upgradeFilter = function() {
  const tank = getActiveTank();
  const cost = tank.filterLevel * 500;
  if (tank.filterLevel < 10 && chillPoints >= cost) {
    chillPoints -= cost;
    tank.filterLevel++;
    updateManageModalUI();
    updateUI();
    safeSave();
  }
};

window.upgradeHeater = function() {
  const tank = getActiveTank();
  if (tank.heaterLevel >= HEATER_LEVELS.length - 1) return;
  const nextDef = HEATER_LEVELS[tank.heaterLevel + 1];
  if (!nextDef || chillPoints < nextDef.cost) return;
  chillPoints -= nextDef.cost;
  tank.heaterLevel++;
  updateManageModalUI();
  updateUI();
  safeSave();
  window.showToast(`🔥 「${tank.name}」に【${nextDef.name}】を導入しました！`);
};

window.upgradeCooler = function() {
  const tank = getActiveTank();
  if (tank.coolerLevel >= COOLER_LEVELS.length - 1) return;
  const nextDef = COOLER_LEVELS[tank.coolerLevel + 1];
  if (!nextDef || chillPoints < nextDef.cost) return;
  chillPoints -= nextDef.cost;
  tank.coolerLevel++;
  updateManageModalUI();
  updateUI();
  safeSave();
  window.showToast(`❄️ 「${tank.name}」に【${nextDef.name}】を導入しました！`);
};

window.addPlant = function() {
  const tank = getActiveTank();
  if (chillPoints >= 150) {
    chillPoints -= 150;
    tank.plants.push(new Plant(Math.random() * (W - 100) + 50));
    updateManageModalUI();
    updateUI();
    safeSave();
  }
};

// --- 水槽のリセット・削除 ---
window.executeTankReset = function() {
  const tank = getActiveTank();
  const newTypeId = document.getElementById('select-reset-type').value;
  const fishAction = document.getElementById('select-reset-fish').value;

  const refund = tank.reset(newTypeId, fishAction);
  chillPoints += refund;

  // もし全水槽の魚が0匹になってしまったら、初期魚をプレゼント
  const totalFishAllTanks = tanks.reduce((sum, t) => sum + t.fishes.length, 0);
  if (totalFishAllTanks === 0) {
    tank.fishes.push(new Fish('neon', 0.35, { sex: 'M' }));
    tank.fishes.push(new Fish('neon', 0.35, { sex: 'F' }));
  }

  closeModals();
  updateUI();
  safeSave();
  window.showToast(`🧹 「${tank.name}」を【${tank.typeDef.name}】としてリセットしました！${refund > 0 ? ' (+' + refund.toLocaleString() + ' しずく還元)' : ''}`);
};

window.deleteActiveTank = function() {
  if (tanks.length <= 1) return;
  const tank = getActiveTank();
  const refund = tank.reset(tank.typeId, 'move');
  chillPoints += refund;
  const removedName = tank.name;
  tanks.splice(activeTankIndex, 1);
  activeTankIndex = Math.max(0, activeTankIndex - 1);
  closeModals();
  updateUI();
  safeSave();
  window.showToast(`🗑 「${removedName}」を撤去し、生き物を他の水槽へ移動しました`);
};

// --- 魚インスペクター（観察・他水槽への引っ越し・リリース） ---
function openInspector(fish) {
  inspectedFish = fish;
  refreshInspectorText();
  document.getElementById('modal-inspector').style.display = 'flex';
}

function refreshInspectorText() {
  if (!inspectedFish) return;
  const tank = getActiveTank();
  const def = inspectedFish.def;
  const pct = Math.floor(inspectedFish.growth * 100);
  const stage = pct < 35 ? '稚魚' : (pct < 65 ? '幼魚' : (pct < 98 ? '成魚' : '主'));
  const currentRate = formatRate(inspectedFish.getEffectiveRate(tank));
  const refund = inspectedFish.getReleaseValue();
  const sexInfo = inspectedFish.getSexInfo();
  const suit = tank.evaluateFishSuitability(inspectedFish);

  const rareBadge = inspectedFish.variant === 'rare'
    ? `<span class="tank-badge badge-harmony">✨煌めき変異</span>` : '';

  document.getElementById('insp-name').innerHTML = `
    ${def.name}
    <span class="sex-badge ${sexInfo.cls}">${sexInfo.symbol} ${sexInfo.label}</span>
    <span class="env-tag">第${inspectedFish.generation}世代</span>
    ${rareBadge}
  `;
  document.getElementById('insp-size').textContent = `${formatLengthMM(inspectedFish.getSizeMM())} (成魚標準: ${formatShortSize(def.size)})`;
  document.getElementById('insp-load').textContent = `現在 ${inspectedFish.getSpaceLoad()} 枠 (成魚時 ${inspectedFish.getAdultLoad()} 枠)`;
  document.getElementById('insp-stage').textContent = (tank.typeDef.hasLifespan && inspectedFish.isSenior()) ? '老魚(余生)' : stage;
  document.getElementById('insp-pct').textContent = pct;
  document.getElementById('insp-bar').style.width = `${pct}%`;
  document.getElementById('insp-health').textContent = `${Math.round(inspectedFish.health)}%`;
  document.getElementById('insp-rate').textContent = currentRate;

  // 寿命表示（初級ファンタジー水槽では不老、中級・上級では余命を表示）
  const lifeEl = document.getElementById('insp-lifespan');
  const lifeBar = document.getElementById('insp-life-bar');
  const lifePct = Math.round(inspectedFish.getRemainingLifePct());
  const remSec = inspectedFish.getRemainingLifeSec();
  const remTimeTxt = formatRealDuration(remSec);
  if (!tank.typeDef.hasLifespan) {
    lifeEl.textContent = `∞ 不老（ファンタジー水槽では寿命が減りません / 残り${lifePct}%）`;
    lifeBar.style.width = `${lifePct}%`;
    lifeBar.style.background = '#64ffda';
  } else {
    const speedNote = (tank.typeId === 'realistic' && (!suit.canGrow || inspectedFish.health < 55))
      ? ' ⚠️環境ストレスで老化加速中'
      : (tank.typeId === 'realistic' && suit.canGrow && inspectedFish.health >= 85 ? ' ✨理想環境で長寿化中' : '');
    lifeEl.textContent = `残り ${lifePct}% (${remTimeTxt})${speedNote}`;
    lifeBar.style.width = `${lifePct}%`;
    lifeBar.style.background = lifePct <= 20 ? '#ff6b6b' : '#ffd54f';
  }

  // 生態・環境情報
  const wLabel = WATER_TYPES[def.water].label;
  document.getElementById('insp-ecology').innerHTML = `
    <div><strong>好む水質・水温:</strong> ${wLabel} / ${def.tempMin}〜${def.tempMax}℃</div>
    <div><strong>現在の環境判定:</strong> <span style="color:${suit.canGrow ? 'var(--accent)' : '#ff8a80'}">${suit.statusText}</span></div>
    <div><strong>性別の特徴:</strong> ${SEX_SYSTEM_LABELS[def.sexType]}</div>
  `;

  // 交配ステータス判定
  const sameSpecies = tank.fishes.filter(f => f.type === inspectedFish.type && f !== inspectedFish);
  const eggLoad = Number((getSpeciesAdultLoad(def) * 0.35).toFixed(1));
  const casualLimit = tank.getCasualBreedLimitReason(inspectedFish.type);
  let breedStatus = '';
  if (!suit.canGrow || suit.breedMul <= 0) {
    breedStatus = '⚠️ 環境が合わないため交配できません（水質・水温を確認してください）';
  } else if (casualLimit === 'total') {
    const maxTot = tank.typeDef.casualMaxTotalBreed || 15;
    breedStatus = `🕊 初級水槽の自然交配上限（水槽合計 ${maxTot}匹まで）に達しているため産卵を控えています（※お迎えは自由・本格的な世代交代は中級以上の水槽へ）`;
  } else if (casualLimit === 'species') {
    const maxSp = tank.typeDef.casualMaxPerSpecies || 3;
    breedStatus = `🕊 初級水槽の自然交配上限（同種 ${maxSp}匹まで）に達しているため産卵を控えています（※お迎えは自由・本格的な世代交代は中級以上の水槽へ）`;
  } else if (tank.typeId === 'harmony' && (tank.isOvercrowded() || !tank.canFitLoad(eggLoad))) {
    breedStatus = `⚠️ 中級水槽では収容枠がいっぱい（または超過）のため産卵を控えています（必要空き枠: ${eggLoad}枠）`;
  } else if (inspectedFish.growth < 0.65) {
    breedStatus = `🌱 成魚（成長65%以上）になると交配可能になります（現在 ${pct}%）`;
  } else if (inspectedFish.breedCooldown > 0) {
    breedStatus = `⏳ 産卵後の休息中（${formatRealDuration(inspectedFish.breedCooldown)}で交配可能）`;
  } else {
    const hasMate = def.sexType === 'hermaphrodite'
      ? sameSpecies.some(f => f.canBreed())
      : sameSpecies.some(f => f.canBreed() && f.sex !== inspectedFish.sex && f.sex !== 'U');
    if (hasMate) {
      if (tank.typeId === 'casual') {
        const spCnt = tank.getSpeciesTotalCount(inspectedFish.type);
        const maxSp = tank.typeDef.casualMaxPerSpecies || 3;
        breedStatus = `💕 ペア成立中！もうすぐ産卵のチャンスがあります（初級: 同種${spCnt}/${maxSp}匹・全体${tank.getTotalBreedPopulation()}/${tank.typeDef.casualMaxTotalBreed || 15}匹まで自然交配）`;
      } else {
        breedStatus = '💕 ペア成立中！もうすぐ産卵のチャンスがあります';
      }
      if (tank.typeId === 'realistic' && (tank.isOvercrowded() || !tank.canFitLoad(eggLoad))) {
        breedStatus += '（※過密のため食卵・水質急落リスクあり。水草の増設や別水槽への隔離推奨）';
      }
    } else if (sameSpecies.length === 0) {
      breedStatus = '🔍 同じ水槽に同種のパートナーを入れると交配できます';
    } else {
      breedStatus = '🔍 パートナーの成長または性転換・休息完了を待っています';
    }
  }
  document.getElementById('insp-breed-status').textContent = breedStatus;
  document.getElementById('insp-desc').textContent = def.desc;
  document.getElementById('insp-refund').textContent = refund.toLocaleString();

  // 他水槽への移動セレクト更新
  const moveBox = document.getElementById('insp-move-box');
  const moveSelect = document.getElementById('select-move-tank');
  if (tanks.length > 1) {
    moveBox.style.display = 'flex';
    const prevVal = moveSelect.value;
    moveSelect.innerHTML = '';
    tanks.forEach((t, idx) => {
      if (idx === activeTankIndex) return;
      const s = t.evaluateFishSuitability(inspectedFish);
      const fits = t.canFitFish(inspectedFish);
      const fitIcon = !fits ? '×枠不足' : (s.canGrow ? '◎適' : '△不適');
      const capLabel = t.typeDef.hasCapacityLimit ? `${t.getCurrentLoad()}/${t.getMaxCapacity()}枠` : '∞枠';
      const opt = document.createElement('option');
      opt.value = idx;
      opt.textContent = `${t.name} [${fitIcon} / ${capLabel}]`;
      moveSelect.appendChild(opt);
    });
    if (prevVal && Array.from(moveSelect.options).some(o => o.value === prevVal)) {
      moveSelect.value = prevVal;
    }
  } else {
    moveBox.style.display = 'none';
  }

  // リリースボタン制御
  const totalFishAll = tanks.reduce((s, t) => s + t.fishes.length, 0);
  const btnRelease = document.getElementById('btn-release-fish');
  const noteRelease = document.getElementById('insp-release-note');
  if (totalFishAll <= 1) {
    btnRelease.disabled = true;
    noteRelease.textContent = '最後の1匹はリリースできません';
  } else {
    btnRelease.disabled = false;
    noteRelease.textContent = '広い水辺へ還すことができます';
  }
}

window.moveInspectedFish = function() {
  if (!inspectedFish) return;
  const tank = getActiveTank();
  const destIdx = Number(document.getElementById('select-move-tank').value);
  const destTank = tanks[destIdx];
  if (!destTank || destTank === tank) return;
  if (!destTank.canFitFish(inspectedFish)) {
    window.showToast(`⚠️ 移動先の水槽の空き枠が足りません！（必要: ${inspectedFish.getSpaceLoad()}枠）`);
    return;
  }

  const idx = tank.fishes.indexOf(inspectedFish);
  if (idx !== -1) {
    const doAcclimate = document.getElementById('chk-acclimate-move')?.checked;
    const tempDiff = Math.abs(destTank.temperature - tank.temperature);
    tank.fishes.splice(idx, 1);

    if (doAcclimate && destTank.typeDef.strictLevel > 0) {
      inspectedFish.acclimating = 18;
      inspectedFish.lastTemp = destTank.temperature;
    } else {
      inspectedFish.acclimating = 0;
      inspectedFish.lastTemp = tank.temperature; // 水合わせ無しの場合、移動元との温度差で次秒にショック判定
    }

    destTank.fishes.push(inspectedFish);
    // 移動元・移動先の両方で性転換ルール（クマノミ等の順位変動）を再評価！
    tank.updateSequentialHermaphrodites();
    destTank.updateSequentialHermaphrodites();
    const movedName = inspectedFish.def.name;
    closeModals();
    updateUI();
    safeSave();
    window.showToast(doAcclimate && destTank.typeDef.strictLevel > 0
      ? `💧 ${movedName}を水合わせしながら「${destTank.name}」へ引っ越しさせました（水温差 ${tempDiff.toFixed(1)}℃）`
      : `🔄 ${movedName}を「${destTank.name}」へ直接移動させました`);
  }
};

window.releaseInspectedFish = function() {
  const tank = getActiveTank();
  const totalFishAll = tanks.reduce((s, t) => s + t.fishes.length, 0);
  if (!inspectedFish || totalFishAll <= 1) return;

  const idx = tank.fishes.indexOf(inspectedFish);
  if (idx !== -1) {
    const refund = inspectedFish.getReleaseValue();
    chillPoints += refund;
    for (let i = 0; i < 6; i++) {
      tank.bubbles.push({
        x: inspectedFish.x + (Math.random() - 0.5) * 20,
        y: inspectedFish.y + (Math.random() - 0.5) * 15,
        r: Math.random() * 3 + 1.5,
        vy: -(Math.random() * 1.2 + 0.6)
      });
    }
    tank.fishes.splice(idx, 1);
    // 女王やリーダーがいなくなった場合、残った個体で性転換が発生！
    tank.updateSequentialHermaphrodites();
    closeModals();
    updateUI();
    safeSave();
  }
};

// --- モーダル開閉 ---
window.closeModals = function() {
  document.querySelectorAll('.modal-overlay').forEach(m => m.style.display = 'none');
  inspectedFish = null;
};

document.getElementById('btn-menu-egg').onclick = () => {
  closeModals();
  updateUI();
  const tank = getActiveTank();
  // 中級・上級水槽は「魚を選んでお迎え」タブを優先表示しても使いやすい
  if (tank.typeDef.strictLevel > 0) {
    switchAdoptTab('select');
  } else {
    switchAdoptTab('egg');
  }
  document.getElementById('modal-egg').style.display = 'flex';
};

function renderEncyclopediaList() {
  const tank = getActiveTank();
  const listEl = document.getElementById('encyclopedia-list');
  if (!listEl) return;
  listEl.innerHTML = '';
  let count = 0;

  FISH_DATA.forEach(d => {
    const unlocked = !!unlockedFish[d.id];
    if (unlocked) count++;
    const item = document.createElement('div');
    item.className = `list-item ${unlocked ? '' : 'locked'}`;
    const c = document.createElement('canvas');
    c.width = 80; c.height = 50;
    c.className = 'preview-canvas';
    item.appendChild(c);

    const pctx = c.getContext('2d');
    pctx.save();
    pctx.translate(40, 25);
    if (!unlocked) pctx.filter = 'brightness(0) opacity(0.5)';
    renderFishShape(pctx, d, getPreviewRadius(d, 'card'), 1.2, false, { sex: adoptSelectedSex === 'F' ? 'F' : 'M' });
    pctx.restore();

    const wShort = WATER_TYPES[d.water].short;
    const sexNote = d.sexType === 'protandrous' ? '🔄雄性先熟'
      : (d.sexType === 'protogynous' ? '🔄雌性先熟'
      : (d.sexType === 'hermaphrodite' ? '⚥雌雄同体' : '♂/♀'));

    const dummySuit = tank.evaluateFishSuitability({ def: d });
    const envFitHtml = !unlocked ? '' : (
      tank.typeDef.strictLevel === 0
        ? `<span class="env-match-ok">◎ 万能適合</span>`
        : (dummySuit.waterOk && dummySuit.tempOk
          ? `<span class="env-match-ok">◎ 現水槽に適合</span>`
          : `<span class="env-match-ng">△ 要:${wShort} ${d.tempMin}-${d.tempMax}℃</span>`)
    );

    const adultLoad = getSpeciesAdultLoad(d);
    const fitsSpace = tank.canFitFish(d, 0.45);
    const scaledBaseRate = formatRate(d.rate * window.getTimeScaleMul());
    const title = document.createElement('div');
    title.innerHTML = `
      <strong>${unlocked ? d.name : '？？？'}</strong><br>
      <span style="color:var(--accent)">${unlocked ? scaledBaseRate + '/秒' : '-'}</span><br>
      <span class="env-tag">${unlocked ? `${wShort} / ${formatShortSize(d.size)} (成魚${adultLoad}枠)` : '？'}</span><br>
      <span style="font-size:9px; color:#b0bec5;">${unlocked ? `${sexNote}・寿命${formatRealDuration(d.lifespan)}` : ''}</span><br>
      ${unlocked ? (fitsSpace ? envFitHtml : '<span class="env-match-ng">⚠️ 空き枠不足</span>') : ''}
    `;
    item.appendChild(title);

    const btn = document.createElement('button');
    btn.style.marginTop = '4px';
    btn.style.width = '100%';
    const canAfford = unlocked && chillPoints >= d.price && fitsSpace;
    btn.disabled = !canAfford;
    btn.textContent = !unlocked ? '未発見' : (!fitsSpace ? '枠不足(要拡張)' : `お迎え: ${d.price.toLocaleString()}`);
    btn.onclick = () => adoptSpecificFish(d.id);
    item.appendChild(btn);

    listEl.appendChild(item);
  });

  document.getElementById('encyc-count').textContent = count;
  document.getElementById('encyc-total').textContent = FISH_DATA.length;
}

document.getElementById('btn-menu-encyclopedia').onclick = () => {
  closeModals();
  renderEncyclopediaList();
  document.getElementById('modal-encyclopedia').style.display = 'flex';
};

function updateManageModalUI() {
  const tank = getActiveTank();
  const cpFloor = Math.floor(chillPoints);

  document.getElementById('input-tank-name').value = tank.name;
  document.getElementById('manage-tank-badge').textContent = `${tank.typeDef.name} (${tank.typeDef.badge})`;
  document.getElementById('manage-tank-desc').textContent = tank.typeDef.desc;

  const pauseBtn = document.getElementById('btn-toggle-pause');
  pauseBtn.textContent = tank.paused ? '▶ 時間経過を再開する' : '⏸ この水槽の時間を一時停止';

  // タイムスケールボタンのハイライトと説明
  const tsDef = getTimeScaleDef();
  document.getElementById('manage-timescale-label').textContent = `現在: ${tsDef.label} [🕒 ${getGameClockHHMM()} ${window.getActiveThemeLabel()}]`;
  document.getElementById('manage-timescale-desc').textContent = tsDef.desc;
  TIME_SCALES.forEach(t => {
    const b = document.getElementById(`btn-ts-${t.id}`);
    if (b) b.className = t.id === timeScaleId ? 'btn-accent' : '';
  });

  // 水質ボタンのハイライト
  ['fresh', 'brackish', 'marine', 'deep'].forEach(w => {
    const b = document.getElementById(`btn-water-${w}`);
    if (b) {
      b.className = tank.waterType === w ? 'btn-accent' : '';
    }
  });

  document.getElementById('manage-curr-temp').textContent = `${tank.temperature.toFixed(1)}℃`;
  document.getElementById('manage-target-temp').textContent = `${tank.targetTemp}℃`;

  const thermal = tank.getThermalStatus();
  const ambEl = document.getElementById('manage-ambient-temp');
  if (ambEl) ambEl.textContent = `(現在の室温: ${thermal.ambient.toFixed(1)}℃ [${window.getActiveThemeLabel()}])`;

  const thStatusEl = document.getElementById('manage-thermal-status');
  if (thStatusEl) {
    if (tank.typeDef.strictLevel === 0) {
      thStatusEl.style.color = 'var(--accent)';
      thStatusEl.textContent = '◎ 初級ファンタジー水槽では機材・室温に関わらず全ての魚が適温で過ごせます';
    } else if (thermal.bottleneck) {
      thStatusEl.style.color = '#ff8a80';
      thStatusEl.textContent = `${thermal.bottleneck}（到達限界: ${thermal.equilibrium.toFixed(1)}℃）`;
    } else if (Math.abs(tank.temperature - tank.targetTemp) >= 0.4) {
      thStatusEl.style.color = '#ffd54f';
      thStatusEl.textContent = `⏳ 目標水温(${tank.targetTemp}℃)へ向けて緩やかに温調中...（急激な温度変化を防いでいます）`;
    } else {
      thStatusEl.style.color = 'var(--accent)';
      thStatusEl.textContent = `◎ 温調設備の出力は十分で、目標水温(${tank.targetTemp}℃)を安定維持できています`;
    }
  }

  // 水槽内の魚が求める環境ガイド
  const guideEl = document.getElementById('manage-env-guide');
  if (tank.fishes.length === 0) {
    guideEl.textContent = '現在この水槽には魚がいません。入れる魚に合わせて水質と水温を設定しましょう。';
  } else {
    const f0 = tank.fishes[0].def;
    guideEl.textContent = `💡 現在の主な魚（${f0.name}など）の推奨環境: 【${WATER_TYPES[f0.water].label} / ${f0.tempMin}〜${f0.tempMax}℃】`;
  }

  // 水質・底床汚れステータス表示
  const cleanStatusEl = document.getElementById('manage-clean-status');
  if (cleanStatusEl) {
    if (tank.typeId === 'realistic') {
      const filterEff = Math.round(100 / (1 + Math.max(0, tank.sludge - 25) * 0.018));
      cleanStatusEl.textContent = `水質純度: ${Math.floor(tank.waterPurity)}% / 底床汚れ・コケ: ${Math.round(tank.sludge)}% (フィルター効率: ${filterEff}%)`;
      cleanStatusEl.style.color = (tank.waterPurity < 70 || tank.sludge >= 45) ? '#ffd54f' : '#b2ebf2';
    } else {
      cleanStatusEl.textContent = `水質純度: ${Math.floor(tank.waterPurity)}% / 底床汚れ・コケ: 自動浄化中 (0%)`;
      cleanStatusEl.style.color = '#b2ebf2';
    }
  }

  // 水槽サイズ拡張UI更新
  const sizeNameEl = document.getElementById('tank-size-name');
  const sizeDescEl = document.getElementById('tank-size-desc');
  const sizeBtnEl = document.getElementById('btn-buy-tank-size');
  const sizeCostEl = document.getElementById('tank-size-cost');
  if (!tank.typeDef.hasCapacityLimit) {
    sizeNameEl.textContent = `魔法の無限空間 (お迎え枠 ∞ / 自然交配は最大${tank.typeDef.casualMaxTotalBreed || 15}匹まで)`;
    sizeDescEl.textContent = '初級ファンタジー水槽では手動お迎えは無制限で、自然交配は「同種3匹・合計15匹」で自動的にストップするため放置でも増えすぎません';
    sizeBtnEl.disabled = true;
    sizeCostEl.textContent = '無制限';
  } else {
    const currSize = tank.getSizeDef();
    const nextSize = TANK_SIZES[tank.sizeLevel];
    sizeNameEl.textContent = `${currSize.name} (現在 ${tank.getCurrentLoad()}/${currSize.capacity} 枠)`;
    if (nextSize) {
      sizeDescEl.textContent = `次段階: 【${nextSize.name}】へ拡張すると最大収容枠が ${currSize.capacity} → ${nextSize.capacity} 枠に増えます`;
      sizeBtnEl.disabled = cpFloor < nextSize.cost;
      sizeCostEl.textContent = `${nextSize.cost.toLocaleString()} しずく`;
    } else {
      sizeDescEl.textContent = '最大サイズの水族館大水槽まで拡張済みです！';
      sizeBtnEl.disabled = true;
      sizeCostEl.textContent = 'MAX';
    }
  }

  document.getElementById('shrimp-count').textContent = tank.shrimpCount;
  document.getElementById('filter-lvl').textContent = tank.filterLevel;
  const fCost = tank.filterLevel * 500;
  document.getElementById('filter-cost').textContent = fCost.toLocaleString();

  // ヒーター設備UI
  const currHeater = tank.getHeaterDef();
  const nextHeater = HEATER_LEVELS[tank.heaterLevel + 1];
  document.getElementById('heater-name').textContent = `Lv.${currHeater.level} ${currHeater.name}`;
  if (nextHeater) {
    document.getElementById('heater-desc').textContent = `現在: ${currHeater.desc} → 次: 【${nextHeater.name}】(${nextHeater.desc})`;
    document.getElementById('btn-buy-heater').disabled = cpFloor < nextHeater.cost;
    document.getElementById('heater-cost').textContent = `${nextHeater.cost.toLocaleString()} しずく`;
  } else {
    document.getElementById('heater-desc').textContent = currHeater.desc;
    document.getElementById('btn-buy-heater').disabled = true;
    document.getElementById('heater-cost').textContent = 'MAX';
  }

  // クーラー・チラー設備UI
  const currCooler = tank.getCoolerDef();
  const nextCooler = COOLER_LEVELS[tank.coolerLevel + 1];
  document.getElementById('cooler-name').textContent = `Lv.${currCooler.level} ${currCooler.name}`;
  if (nextCooler) {
    document.getElementById('cooler-desc').textContent = `現在: ${currCooler.desc} → 次: 【${nextCooler.name}】(${nextCooler.desc})`;
    document.getElementById('btn-buy-cooler').disabled = cpFloor < nextCooler.cost;
    document.getElementById('cooler-cost').textContent = `${nextCooler.cost.toLocaleString()} しずく`;
  } else {
    document.getElementById('cooler-desc').textContent = currCooler.desc;
    document.getElementById('btn-buy-cooler').disabled = true;
    document.getElementById('cooler-cost').textContent = 'MAX';
  }

  document.getElementById('btn-buy-shrimp').disabled = cpFloor < 300;
  document.getElementById('btn-buy-filter').disabled = cpFloor < fCost || tank.filterLevel >= 10;
  document.getElementById('btn-buy-plant').disabled = cpFloor < 150;

  document.getElementById('select-reset-type').value = tank.typeId;
  const delBtn = document.getElementById('btn-delete-tank');
  delBtn.style.display = tanks.length > 1 ? 'inline-block' : 'none';
}

document.getElementById('btn-menu-manage').onclick = () => {
  closeModals();
  updateManageModalUI();
  document.getElementById('modal-manage').style.display = 'flex';
};

document.getElementById('btn-timescale').onclick = () => {
  const idx = TIME_SCALES.findIndex(t => t.id === timeScaleId);
  const next = TIME_SCALES[(idx + 1) % TIME_SCALES.length];
  setTimeScale(next.id);
};

document.getElementById('btn-light').onclick = () => {
  lightMode = (lightMode + 1) % 5;
  updateUI();
  safeSave();
};

document.getElementById('btn-sound').onclick = toggleSound;

window.toggleZen = function() {
  document.body.classList.toggle('zen-mode');
};
document.getElementById('btn-zen').onclick = toggleZen;

// キャンバスクリック (魚観察 or エサやり)
canvas.addEventListener('pointerdown', (e) => {
  const tank = getActiveTank();
  const rect = canvas.getBoundingClientRect();
  const cx = e.clientX - rect.left;
  const cy = e.clientY - rect.top;

  for (let i = tank.fishes.length - 1; i >= 0; i--) {
    const f = tank.fishes[i];
    if (Math.hypot(f.x - cx, f.y - cy) < Math.max(f.getRadiusPx() * 1.2, 22)) {
      openInspector(f);
      return;
    }
  }
  tank.foods.push({ x: cx, y: cy, eaten: false });
});

// --- UI更新 ---
function updateUI() {
  const tank = getActiveTank();
  const cpFloor = Math.floor(chillPoints);

  renderTankTabs();

  // 全水槽合計のしずく獲得レート計算
  let totalRate = 0;
  tanks.forEach(t => {
    if (!t.paused) {
      t.fishes.forEach(f => { totalRate += f.getEffectiveRate(t); });
    }
  });

  document.getElementById('cp').textContent = `${cpFloor.toLocaleString()} (+${formatRate(totalRate)}/s)`;

  const purityEl = document.getElementById('water-purity');
  const sludgeSuffix = (tank.typeId === 'realistic' && tank.sludge >= 30) ? ` (コケ${Math.round(tank.sludge)}%)` : '';
  purityEl.textContent = `${Math.floor(tank.waterPurity)}%${sludgeSuffix}`;
  purityEl.className = 'stat-val ' + (tank.waterPurity < 55 ? 'danger' : ((tank.waterPurity < 75 || (tank.typeId === 'realistic' && tank.sludge >= 50)) ? 'warn' : ''));

  const envEl = document.getElementById('water-env');
  const wInfo = WATER_TYPES[tank.waterType] || WATER_TYPES.fresh;
  if (tank.typeDef.strictLevel === 0) {
    envEl.textContent = `万能 (${wInfo.short}/${tank.temperature.toFixed(0)}℃)`;
    envEl.className = 'stat-val';
  } else {
    const mismatch = tank.fishes.some(f => {
      const s = tank.evaluateFishSuitability(f);
      return !s.waterOk || !s.tempOk;
    });
    envEl.textContent = `${wInfo.short} ${tank.temperature.toFixed(1)}℃`;
    envEl.className = 'stat-val ' + (mismatch ? 'warn' : '');
  }

  const eggTxt = tank.spawnedEggs.length > 0 ? ` 🥚${tank.spawnedEggs.length}` : '';
  const fishCountEl = document.getElementById('fish-count');
  if (!tank.typeDef.hasCapacityLimit) {
    fishCountEl.textContent = `${tank.fishes.length}匹 (枠∞)${eggTxt}`;
    fishCountEl.className = 'stat-val';
  } else {
    const sDef = tank.getSizeDef();
    const load = tank.getCurrentLoad();
    fishCountEl.textContent = `${tank.fishes.length}匹 (${load}/${sDef.capacity}枠)${eggTxt}`;
    fishCountEl.className = 'stat-val ' + (tank.isOvercrowded() ? 'danger' : (load >= sDef.capacity * 0.85 ? 'warn' : ''));
  }

  const theme = getActiveTheme();
  document.getElementById('btn-light').textContent = `照明: ${theme.modeText}`;
  const tsBtn = document.getElementById('btn-timescale');
  if (tsBtn) tsBtn.textContent = `⏳ ${getTimeScaleDef().short} (${getGameClockHHMM()} ${theme.label})`;

  const b1 = document.getElementById('btn-buy-egg1');
  const b2 = document.getElementById('btn-buy-egg2');
  const b3 = document.getElementById('btn-buy-egg3');
  const minEggFit = !tank.typeDef.hasCapacityLimit || tank.canFitLoad(0.5);
  if (b1) b1.disabled = cpFloor < 100 || !minEggFit;
  if (b2) b2.disabled = cpFloor < 1000 || !minEggFit;
  if (b3) b3.disabled = cpFloor < 10000 || !minEggFit;
}

// --- 初期化＆1秒ごとの全水槽シミュレーション ---
safeLoad();
updateUI();

setInterval(() => {
  // ゲーム内時計の進行（リアル時間モード時はPCの実時計に同期、それ以外はタイムスケールに応じて進行）
  if (timeScaleId === 'realtime') {
    gameClockMinutes = new Date().getHours() * 60 + new Date().getMinutes();
  } else {
    // 基準(高速1.0x)で1秒あたり6分進行（＝1日が4分、標準0.25xで1日が16分、倍速3.0xで1日が80秒）
    gameClockMinutes = (gameClockMinutes + 6 * window.getTimeScaleMul()) % 1440;
  }

  let gainAll = 0;
  tanks.forEach(t => {
    gainAll += t.tickOneSecond();
  });
  chillPoints += gainAll;

  updateUI();
  if (inspectedFish) refreshInspectorText();
  safeSave();
}, 1000);

// --- メイン60fps描画ループ ---
const inspCanvas = document.getElementById('insp-canvas');
const inspCtx = inspCanvas.getContext('2d');

function loop() {
  time++;
  const tank = getActiveTank();
  const theme = getActiveTheme();
  const isNight = theme.label === '夜';

  // 背景グラデーション
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, theme.top);
  grad.addColorStop(1, theme.bottom);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // 水質の濁りオーバーレイ
  if (tank.waterPurity < 95) {
    ctx.fillStyle = `rgba(60, 95, 50, ${(100 - tank.waterPurity) * 0.0038})`;
    ctx.fillRect(0, 0, W, H);
  }

  // 光のカーテン
  ctx.save();
  ctx.fillStyle = theme.ray;
  for (let i = 0; i < 4; i++) {
    const rx = (W * 0.22 * (i + 1)) + Math.sin(time * 0.008 + i) * 35;
    ctx.beginPath();
    ctx.moveTo(rx - 35, 0);
    ctx.lineTo(rx + 55, 0);
    ctx.lineTo(rx + 190, H);
    ctx.lineTo(rx - 110, H);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  // 底砂（水質タイプに応じて少し色味を変える）
  let sandColor = isNight ? '#060e16' : '#13222e';
  if (tank.waterType === 'marine') sandColor = isNight ? '#0a1622' : '#1e3545';
  if (tank.waterType === 'deep') sandColor = '#050811';
  ctx.fillStyle = sandColor;
  ctx.beginPath();
  ctx.moveTo(0, H);
  for (let x = 0; x <= W + 50; x += 50) {
    ctx.lineTo(x, H - 22 + Math.sin(x * 0.02) * 5);
  }
  ctx.lineTo(W, H);
  ctx.fill();

  // 上級水槽の底床デトリタス・茶ゴケの蓄積表現
  if (tank.typeId === 'realistic' && tank.sludge > 10) {
    ctx.fillStyle = `rgba(75, 95, 35, ${Math.min(0.42, tank.sludge * 0.0042)})`;
    ctx.beginPath();
    ctx.moveTo(0, H);
    for (let x = 0; x <= W + 50; x += 50) {
      ctx.lineTo(x, H - 24 + Math.sin(x * 0.02) * 5);
    }
    ctx.lineTo(W, H);
    ctx.fill();
  }

  // 水草
  tank.plants.forEach(p => p.draw(ctx, isNight, time, tank.waterType));

  // 受精卵（交配で産み落とされた卵）
  tank.spawnedEggs.forEach(egg => egg.draw(ctx, time));

  // エビ
  tank.shrimps.forEach(s => {
    if (!tank.paused) s.update(tank);
    s.draw(ctx);
  });

  // 泡
  if (!tank.paused && Math.random() < 0.04 + tank.filterLevel * 0.015) {
    tank.bubbles.push({
      x: Math.random() * W,
      y: H - 15,
      r: Math.random() * 2.5 + 1,
      vy: -(Math.random() * 1.1 + 0.5)
    });
  }
  for (let i = tank.bubbles.length - 1; i >= 0; i--) {
    const b = tank.bubbles[i];
    if (!tank.paused) {
      b.y += b.vy;
      b.x += Math.sin(time * 0.05 + i) * 0.3;
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.28)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    ctx.stroke();
    if (b.y < -10) tank.bubbles.splice(i, 1);
  }

  // エサ
  ctx.fillStyle = '#ffb74d';
  for (let i = tank.foods.length - 1; i >= 0; i--) {
    const f = tank.foods[i];
    if (!tank.paused) {
      if (f.y < H - 24) {
        f.y += 0.65;
        f.x += Math.sin(time * 0.08 + i) * 0.25;
      } else {
        f.decay = (f.decay || 0) + 1;
      }
    }
    ctx.beginPath();
    ctx.arc(f.x, f.y, 2.6, 0, Math.PI * 2);
    ctx.fill();
    if (f.eaten || f.decay > 900) tank.foods.splice(i, 1);
  }

  // 魚
  tank.fishes.forEach(f => {
    if (!tank.paused) f.update(tank);
    f.draw(ctx, isNight, tank);
  });

  // 一時停止中のオーバーレイ表示
  if (tank.paused) {
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
    ctx.font = '600 15px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('⏸ この水槽は時間経過を一時停止中です（環境メニューから再開可能）', W / 2, H / 2);
    ctx.restore();
  }

  // インスペクターのライブプレビュー描画
  if (inspectedFish) {
    inspCtx.clearRect(0, 0, 120, 95);
    inspCtx.save();
    inspCtx.translate(60, 48);
    renderFishShape(inspCtx, inspectedFish.def, getPreviewRadius(inspectedFish.def, 'inspector'), time * 0.08, isNight, {
      sex: inspectedFish.sex,
      variant: inspectedFish.variant
    });
    inspCtx.restore();
  }

  requestAnimationFrame(loop);
}
loop();
