// --- 水槽クラス（複数水槽・難易度特性・性転換・交配管理） ---
class Tank {
  constructor(opts = {}) {
    this.id = opts.id || ('tank_' + Date.now() + '_' + Math.floor(Math.random() * 1000));
    this.typeId = opts.typeId || 'casual';
    this.typeDef = TANK_TYPES[this.typeId] || TANK_TYPES.casual;
    this.name = opts.name || this.typeDef.name;

    this.waterType = opts.waterType || 'fresh'; // 'fresh' | 'brackish' | 'marine' | 'deep'
    const defaultT = (WATER_TYPES[this.waterType] || WATER_TYPES.fresh).defaultTemp;
    this.temperature = typeof opts.temperature === 'number' ? opts.temperature : defaultT;
    this.targetTemp = typeof opts.targetTemp === 'number' ? opts.targetTemp : defaultT;
    this.heaterLevel = typeof opts.heaterLevel === 'number' ? opts.heaterLevel : (opts.thermostatLevel || 1);
    this.coolerLevel = typeof opts.coolerLevel === 'number' ? opts.coolerLevel : (opts.thermostatLevel > 1 ? opts.thermostatLevel - 1 : 0);

    this.waterPurity = typeof opts.waterPurity === 'number' ? opts.waterPurity : 100;
    this.sludge = typeof opts.sludge === 'number' ? opts.sludge : 0; // 底床の汚れ・コケ蓄積率(0〜100%, 上級水槽で進行)
    this.waterChangeBoost = 0; // 水換え直後の産卵促進タイマー
    this.filterLevel = typeof opts.filterLevel === 'number' ? opts.filterLevel : 1;
    this.shrimpCount = typeof opts.shrimpCount === 'number' ? opts.shrimpCount : 0;
    this.sizeLevel = typeof opts.sizeLevel === 'number' ? opts.sizeLevel : 1;
    this.paused = !!opts.paused;

    this.fishes = [];
    this.spawnedEggs = [];
    this.shrimps = [];
    this.plants = [];
    this.foods = [];
    this.bubbles = [];

    const W = window.innerWidth || 1000;
    const pCount = typeof opts.plantCount === 'number' ? opts.plantCount : 6;
    for (let i = 0; i < pCount; i++) {
      this.plants.push(new Plant((i + 0.5) * (W / Math.max(1, pCount))));
    }
    for (let i = 0; i < this.shrimpCount; i++) {
      this.shrimps.push(new Shrimp());
    }

    if (Array.isArray(opts.fishes)) {
      this.fishes = opts.fishes.map(fd => (fd instanceof Fish ? fd : Fish.deserialize(fd)));
    }
    if (Array.isArray(opts.spawnedEggs)) {
      this.spawnedEggs = opts.spawnedEggs.map(ed => (ed instanceof SpawnedEgg ? ed : SpawnedEgg.deserialize(ed)));
    }
  }

  setType(newTypeId) {
    if (!TANK_TYPES[newTypeId]) return;
    this.typeId = newTypeId;
    this.typeDef = TANK_TYPES[newTypeId];
  }

  getSizeDef() {
    const idx = Math.min(TANK_SIZES.length - 1, Math.max(0, (this.sizeLevel || 1) - 1));
    return TANK_SIZES[idx];
  }

  getHeaterDef() {
    const idx = Math.min(HEATER_LEVELS.length - 1, Math.max(0, this.heaterLevel || 0));
    return HEATER_LEVELS[idx];
  }

  getCoolerDef() {
    const idx = Math.min(COOLER_LEVELS.length - 1, Math.max(0, this.coolerLevel || 0));
    return COOLER_LEVELS[idx];
  }

  // 外気温（昼夜の時間帯・照明に応じた室温変化）
  getAmbientTemp() {
    const themeLabel = window.getActiveThemeLabel ? window.getActiveThemeLabel() : '昼';
    if (themeLabel === '昼') return 25.5;
    if (themeLabel === '夕') return 23.0;
    if (themeLabel === '朝') return 21.5;
    return 18.5; // 夜間冷え込み
  }

  // 現在の水槽サイズ（水量）とヒーター・クーラー出力から到達可能な平衡水温と状態を算出
  getThermalStatus() {
    const ambient = this.getAmbientTemp();
    if (this.typeDef.strictLevel === 0) {
      return { equilibrium: this.targetTemp, ambient, bottleneck: null };
    }

    const vol = this.getSizeDef().volume || 1.0;
    // 中級は機材効率に1.35倍のゆとり補正、上級はリアル厳密計算
    const effMul = this.typeId === 'harmony' ? 1.35 : 1.0;
    const volFactor = Math.pow(vol, 0.52);

    if (this.targetTemp > ambient) {
      const hDef = this.getHeaterDef();
      const maxLift = (hDef.power * effMul / volFactor) * 19.0;
      const maxReach = Math.min(hDef.maxTemp, Number((ambient + maxLift).toFixed(1)));
      const eq = Math.min(this.targetTemp, maxReach);
      const bottleneck = eq < this.targetTemp - 0.3
        ? `🔥ヒーター出力不足（現在の水槽水量では最大 ${maxReach}℃ までしか加温できません）`
        : null;
      return { equilibrium: eq, ambient, bottleneck };
    } else if (this.targetTemp < ambient) {
      const cDef = this.getCoolerDef();
      if (cDef.level === 0) {
        return {
          equilibrium: ambient,
          ambient,
          bottleneck: `❄️冷却設備なし（室温 ${ambient}℃ より下げるには空冷ファンまたはクーラーが必要です）`
        };
      }
      const maxDrop = Math.min(cDef.maxDrop, (cDef.power * effMul / volFactor) * 19.0);
      const minReach = Math.max(cDef.minTemp, Number((ambient - maxDrop).toFixed(1)));
      const eq = Math.max(this.targetTemp, minReach);
      const bottleneck = eq > this.targetTemp + 0.3
        ? `❄️冷却出力不足（現在の設備・水槽サイズでは最低 ${minReach}℃ までしか冷却できません）`
        : null;
      return { equilibrium: eq, ambient, bottleneck };
    }
    return { equilibrium: ambient, ambient, bottleneck: null };
  }

  // 初級は無制限(Infinity)、中級・上級は水槽サイズに応じた枠上限
  getMaxCapacity() {
    if (!this.typeDef.hasCapacityLimit) return Infinity;
    return this.getSizeDef().capacity;
  }

  // 現在の水槽内の合計占有枠（魚の体長・成長度＋受精卵の合計）
  getCurrentLoad() {
    let sum = 0;
    for (const f of this.fishes) sum += f.getSpaceLoad();
    for (const e of this.spawnedEggs) sum += e.getSpaceLoad();
    return Number(sum.toFixed(1));
  }

  isOvercrowded() {
    if (!this.typeDef.hasCapacityLimit) return false;
    return this.getCurrentLoad() > this.getMaxCapacity() + 0.05;
  }

  canFitLoad(additionalLoad) {
    if (!this.typeDef.hasCapacityLimit) return true;
    return (this.getCurrentLoad() + additionalLoad) <= this.getMaxCapacity() + 0.05;
  }

  // 指定した魚（FishインスタンスまたはFISH_DATA定義）を新しく入れられるか判定
  canFitFish(fishOrDef, initialGrowth = 0.45) {
    if (!this.typeDef.hasCapacityLimit) return true;
    if (fishOrDef instanceof Fish) {
      return this.canFitLoad(fishOrDef.getSpaceLoad());
    }
    const adultLoad = getSpeciesAdultLoad(fishOrDef);
    const estLoad = Number((adultLoad * (0.40 + 0.60 * initialGrowth)).toFixed(1));
    return this.canFitLoad(estLoad);
  }

  // 魚にとって現在の水槽環境が適しているか判定
  evaluateFishSuitability(fish) {
    const def = fish.def;
    const strict = this.typeDef.strictLevel;

    // 1. 初級（ファンタジー水槽）：すべての魚が快適
    if (strict === 0) {
      return {
        waterOk: true,
        tempOk: true,
        canGrow: true,
        growMul: 1.0,
        rateMul: this.typeDef.rateMul,
        breedMul: this.typeDef.breedMul,
        healthDelta: 0.5,
        statusText: '◎ 万能環境（すべての魚が快適）'
      };
    }

    // 2. 中級（ハーモニー水槽）：水質一致＆水温±3℃の猶予
    if (strict === 1) {
      const waterOk = (this.waterType === def.water) ||
        (this.waterType === 'fresh' && def.water === 'brackish') ||
        (this.waterType === 'marine' && def.water === 'brackish');
      const tempOk = this.temperature >= (def.tempMin - 3) && this.temperature <= (def.tempMax + 3);

      if (waterOk && tempOk) {
        return {
          waterOk: true,
          tempOk: true,
          canGrow: true,
          growMul: 1.5,
          rateMul: this.typeDef.rateMul,
          breedMul: this.typeDef.breedMul,
          healthDelta: 0.4,
          statusText: '◎ 環境調和ボーナス発動中 (×1.6)'
        };
      }
      return {
        waterOk,
        tempOk,
        canGrow: false,
        growMul: 0.15,
        rateMul: 0.55,
        breedMul: 0,
        healthDelta: 0.1, // 中級では弱って死ぬことはない
        statusText: `△ 環境不一致（推奨: ${WATER_TYPES[def.water].label} / ${def.tempMin}〜${def.tempMax}℃）`
      };
    }

    // 3. 上級（プロフェッショナル水槽）：厳密な水質・水温・水質純度管理
    const waterOk = this.waterType === def.water;
    const tempOk = this.temperature >= def.tempMin && this.temperature <= def.tempMax;
    const tempNear = this.temperature >= (def.tempMin - 2) && this.temperature <= (def.tempMax + 2);
    const purityOk = this.waterPurity >= 70;

    if (waterOk && tempOk && purityOk) {
      return {
        waterOk: true,
        tempOk: true,
        canGrow: true,
        growMul: 2.2,
        rateMul: this.typeDef.rateMul,
        breedMul: this.typeDef.breedMul,
        healthDelta: 0.6,
        statusText: '★ 理想的なプロ環境 (×2.5)'
      };
    }
    if (waterOk && tempNear && this.waterPurity >= 45) {
      return {
        waterOk: true,
        tempOk: tempOk,
        canGrow: true,
        growMul: 0.9,
        rateMul: 1.2,
        breedMul: 0.8,
        healthDelta: 0.0,
        statusText: '○ 許容範囲（水温・水質をさらに整えると×2.5）'
      };
    }
    return {
      waterOk,
      tempOk,
      canGrow: false,
      growMul: 0,
      rateMul: 0.25,
      breedMul: 0,
      healthDelta: -1.1,
      statusText: `⚠️ 環境不適！推奨: ${WATER_TYPES[def.water].label} / ${def.tempMin}〜${def.tempMax}℃ / 水質70%以上`
    };
  }

  // 性転換（クマノミの雄性先熟・キンギョハナダイ等の雌性先熟）の更新
  updateSequentialHermaphrodites() {
    const byType = {};
    for (const f of this.fishes) {
      if (!byType[f.type]) byType[f.type] = [];
      byType[f.type].push(f);
    }

    Object.keys(byType).forEach(type => {
      const group = byType[type];
      if (group.length === 0) return;
      const sexType = group[0].def.sexType;

      // 成長度（体格）の大きい順にソート
      group.sort((a, b) => b.growth - a.growth);

      if (sexType === 'protandrous') {
        // 【雄性先熟】（カクレクマノミ等）
        // 幼魚(U)が一定以上育つとまずオス(M)へ成熟
        group.forEach((f, idx) => {
          if (f.sex === 'U' && f.growth >= 0.35 && idx <= 1) {
            f.sex = 'M';
          }
        });
        // 水槽内にメス(F)が1匹もいなくて、2匹以上いる＆最大個体が成長50%以上なら、最大個体がメス(F)へ性転換！
        const hasFemale = group.some(f => f.sex === 'F');
        if (!hasFemale && group.length >= 2 && group[0].growth >= 0.50) {
          const prevSex = group[0].sex;
          group[0].sex = 'F';
          if (group[1].sex === 'U') group[1].sex = 'M';
          if (prevSex !== 'F' && window.showToast) {
            window.showToast(`🔄 【${this.name}】最大の${group[0].def.name}が群れの女王(♀)へ性転換しました！`);
          }
        }
      } else if (sexType === 'protogynous') {
        // 【雌性先熟】（キンギョハナダイ・ホンソメワケベラ等）
        // 最初はすべてメス(F)。水槽内にオス(M)がいなくて2匹以上＆最大個体が成長50%以上なら、最大個体がオス(M)へ性転換！
        const hasMale = group.some(f => f.sex === 'M');
        if (!hasMale && group.length >= 2 && group[0].growth >= 0.50) {
          group[0].sex = 'M';
          if (window.showToast) {
            window.showToast(`🔄 【${this.name}】最大の${group[0].def.name}がメス(♀)から群れのリーダー(♂)へ性転換しました！`);
          }
        }
      }
    });
  }

  // 初級水槽（casual）における自然交配の上限チェック（手動お迎えは無制限のまま、自然増殖のみストッパーをかける）
  getSpeciesTotalCount(speciesId) {
    let cnt = 0;
    for (const f of this.fishes) if (f.type === speciesId) cnt++;
    for (const e of this.spawnedEggs) if (e.type === speciesId) cnt++;
    return cnt;
  }

  getTotalBreedPopulation() {
    return this.fishes.length + this.spawnedEggs.length;
  }

  // 初級水槽で自然交配がストップしている理由を返す（制限内なら null）
  getCasualBreedLimitReason(speciesId) {
    if (this.typeId !== 'casual') return null;
    const maxTotal = this.typeDef.casualMaxTotalBreed || 15;
    const maxSpecies = this.typeDef.casualMaxPerSpecies || 3;
    if (this.getTotalBreedPopulation() >= maxTotal) {
      return 'total';
    }
    if (speciesId && this.getSpeciesTotalCount(speciesId) >= maxSpecies) {
      return 'species';
    }
    return null;
  }

  // 交配・受精卵の進行（1秒ごと・タイムスケール連動）
  updateBreeding() {
    const ts = window.getTimeScaleMul ? window.getTimeScaleMul() : 1.0;

    // 1. 既存の受精卵の孵化カウント進行（上級水槽では過密・水草不足時に食卵リスクあり）
    for (let i = this.spawnedEggs.length - 1; i >= 0; i--) {
      const egg = this.spawnedEggs[i];

      // 上級水槽：過密状態や他魚が多いのに隠れ家（水草）が少ない場合、食卵されるリスク
      if (this.typeId === 'realistic' && this.fishes.length > 2) {
        const plantCover = Math.min(0.85, this.plants.length * 0.08); // 水草が多いほど卵が守られる
        const crowdFactor = this.isOvercrowded() ? 0.028 : (this.fishes.length > 6 ? 0.008 : 0.002);
        const eatenChance = crowdFactor * (1 - plantCover) * ts;
        if (Math.random() < eatenChance) {
          this.spawnedEggs.splice(i, 1);
          if (window.showToast) {
            window.showToast(`🐟 【${this.name}】過密・隠れ家不足により、${egg.def.name}の卵が他の魚に食べられてしまいました（水草を増やすか別水槽への隔離が有効です）`);
          }
          continue;
        }
      }

      const tempDummyFish = { def: egg.def };
      const suit = this.evaluateFishSuitability(tempDummyFish);
      const step = (suit.canGrow ? (3.5 * Math.max(0.8, suit.breedMul * 0.7)) : 0.8) * ts;
      egg.progress = Math.min(100, egg.progress + step);

      if (egg.progress >= 100) {
        this.spawnedEggs.splice(i, 1);
        const baby = new Fish(egg.type, 0.10, {
          generation: egg.generation,
          variant: egg.variant,
          x: egg.x,
          y: egg.y - 10,
          breedCooldown: 45
        });
        this.fishes.push(baby);
        if (window.showToast) {
          const overWarn = (this.typeId === 'realistic' && this.isOvercrowded()) ? ' ⚠️過密状態のため水質急落に注意！' : '';
          const rareTxt = egg.variant === 'rare' ? '✨煌めき変異個体✨ ' : '';
          window.showToast(`🐣 【${this.name}】${rareTxt}${baby.def.name}（第${baby.generation}世代）が孵化しました！${overWarn}`);
        }
      }
    }

    // 2. クールダウン減少
    for (const f of this.fishes) {
      if (f.breedCooldown > 0) f.breedCooldown = Math.max(0, f.breedCooldown - ts);
    }

    // 初級水槽（ファンタジー水槽）：水槽全体で15匹以上（魚＋卵）いる場合は自然産卵をストップ（手動お迎えは引き続き無制限）
    if (this.typeId === 'casual' && this.getCasualBreedLimitReason(null) === 'total') return;

    // 中級水槽では枠超過時は自動で産卵を控える（上級水槽では環境さえ良ければ枠超過でも産卵し、過密崩壊や食卵のリスクが生じるリアル仕様）
    if (this.typeId === 'harmony' && this.isOvercrowded()) return;
    if (this.waterPurity < 60) return;

    // 3. 種ごとのペア成立判定
    const byType = {};
    for (const f of this.fishes) {
      if (!byType[f.type]) byType[f.type] = [];
      byType[f.type].push(f);
    }

    Object.keys(byType).forEach(type => {
      const group = byType[type];
      if (group.length < 2) return;

      // 初級水槽：同種がすでに3匹以上（魚＋卵）または合計15匹に達している場合はそれ以上産卵しない
      if (this.typeId === 'casual' && this.getCasualBreedLimitReason(type) !== null) return;

      const eggLoad = Number((getSpeciesAdultLoad(group[0].def) * 0.35).toFixed(1));
      if (this.typeId === 'harmony' && !this.canFitLoad(eggLoad)) return;

      const ready = group.filter(f => f.canBreed() && this.evaluateFishSuitability(f).breedMul > 0);
      if (ready.length < 2) return;

      let parentA = null;
      let parentB = null;
      const sexType = ready[0].def.sexType;

      if (sexType === 'hermaphrodite') {
        parentA = ready[0];
        parentB = ready[1];
      } else {
        parentA = ready.find(f => f.sex === 'M');
        parentB = ready.find(f => f.sex === 'F');
      }

      if (parentA && parentB) {
        // ペアが成立している場合、互いに少しずつ歩み寄りハートを表示
        parentA.courtingTimer = 75;
        parentB.courtingTimer = 75;
        const dx = parentB.x - parentA.x;
        const dy = parentB.y - parentA.y;
        const dist = Math.hypot(dx, dy);
        if (dist > 45) {
          parentA.vx += (dx / dist) * 0.15;
          parentA.vy += (dy / dist) * 0.15;
          parentB.vx -= (dx / dist) * 0.15;
          parentB.vy -= (dy / dist) * 0.15;
        }

        const suit = this.evaluateFishSuitability(parentA);
        // 水換え直後の新鮮な水は産卵スイッチを刺激する（リアルな水換え産卵誘発）
        const wcBonus = this.waterChangeBoost > 0 ? 1.5 : 1.0;
        const baseChance = Math.min(0.45, 0.045 * suit.breedMul * wcBonus * ts);
        if (Math.random() < baseChance) {
          parentA.breedCooldown = 70;
          parentB.breedCooldown = 70;
          const nextGen = Math.max(parentA.generation, parentB.generation) + 1;
          const rareChance = (this.typeId === 'realistic' ? 0.22 : (this.typeId === 'harmony' ? 0.12 : 0.06)) +
            ((parentA.variant === 'rare' || parentB.variant === 'rare') ? 0.25 : 0);
          const variant = Math.random() < rareChance ? 'rare' : 'normal';
          const eggX = (parentA.x + parentB.x) * 0.5;
          const H = window.innerHeight || 700;
          const eggY = H - 26 - Math.random() * 14;

          this.spawnedEggs.push(new SpawnedEgg(type, nextGen, eggX, eggY, 0, variant));
          if (window.showToast) {
            window.showToast(`💕 【${this.name}】${parentA.def.name}のペアが産卵しました！（第${nextGen}世代の卵）`);
          }
        }
      }
    });
  }

  // 1秒ごとのシミュレーション更新（アクティブ・バックグラウンド共通）
  tickOneSecond() {
    if (this.paused) return 0;
    const ts = window.getTimeScaleMul ? window.getTimeScaleMul() : 1.0;

    // 1. 水温のリアル変動（外気温・水槽サイズ水量・ヒーター＆クーラー出力に基づく熱移動）
    const thermal = this.getThermalStatus();
    const vol = this.getSizeDef().volume || 1.0;
    // 小型水槽ほど温度が動きやすく、大型水槽ほど熱容量が大きくゆっくり変化する
    const stepRate = this.typeDef.strictLevel === 0 ? 0.5 : (0.28 / Math.pow(vol, 0.35)) * Math.max(0.25, ts);
    const diff = thermal.equilibrium - this.temperature;
    if (Math.abs(diff) > 0.05) {
      const maxStep = Math.sign(diff) * Math.min(Math.abs(diff), Math.max(0.1, Math.abs(diff) * stepRate));
      this.temperature = Number((this.temperature + maxStep).toFixed(1));
    } else {
      this.temperature = Number(thermal.equilibrium.toFixed(1));
    }

    // 2. 水質と底床汚れ（コケ・デトリタス）の変動
    if (this.waterChangeBoost > 0) {
      this.waterChangeBoost = Math.max(0, this.waterChangeBoost - ts);
    }
    const H = window.innerHeight || 700;
    const uneaten = this.foods.filter(f => f.y > H - 35).length;
    const currLoad = this.getCurrentLoad();
    const maxCap = this.getMaxCapacity();

    if (this.typeId === 'realistic') {
      // 【上級プロ水槽】：高級フィルターでも硝酸塩や老廃物は自然消滅しないため、水質は自力では100%に戻らず徐々に低下する（定期的な水換え・掃除が必須）
      // エビはコケ・残りエサの蓄積を抑えるが、排泄物はゼロにはならない
      const shrimpCleanFactor = Math.max(0.35, 1 - this.shrimpCount * 0.07);
      const sludgeGain = (0.045 + currLoad * 0.008 + uneaten * 0.18) * shrimpCleanFactor * ts;
      this.sludge = Math.min(100, Number((this.sludge + sludgeGain).toFixed(2)));

      // フィルターLvが高いほど水質低下を強力に抑えるが、底床汚れ(sludge)が溜まるとフィルターが目詰まりして効率が落ちる
      const filterMitigation = Math.max(0.18, 1 - this.filterLevel * 0.082);
      const clogMul = 1 + Math.max(0, this.sludge - 25) * 0.018;
      const overPenalty = this.isOvercrowded() ? Math.pow(currLoad - maxCap, 1.25) * 0.16 : 0;
      const baseNitrateLoss = (0.045 + currLoad * 0.011) * filterMitigation * clogMul;
      const foodLoss = uneaten * 0.48 * shrimpCleanFactor;
      const totalLoss = (baseNitrateLoss + foodLoss + overPenalty) * ts;

      this.waterPurity = Math.max(10, Number((this.waterPurity - totalLoss).toFixed(2)));
    } else {
      // 【初級・中級水槽】：フィルターで自動回復する快適仕様
      this.sludge = 0;
      const overLoad = this.isOvercrowded() ? (currLoad - maxCap) * 0.15 : 0;
      if (uneaten > 0 || overLoad > 0) {
        const dirtyLoss = (uneaten * 0.35 + overLoad) * ts;
        const filterGain = (this.filterLevel * 0.28 + this.shrimpCount * 0.08) * ts;
        this.waterPurity = Math.max(20, Math.min(100, this.waterPurity - dirtyLoss + filterGain));
      } else {
        this.waterPurity = Math.min(100, this.waterPurity + this.filterLevel * 0.4 * Math.max(0.25, ts));
      }
    }

    // 3. ホンソメワケベラ（クリーナーフィッシュ）がいれば同じ水槽の魚の健康度を回復
    const cleanerCount = this.fishes.filter(f => f.type === 'cleaner_wrasse').length;

    // 4. 各魚の健康度・水温ショック・水合わせ・寿命・しずく獲得更新
    let totalGain = 0;
    let sexHierarchyChanged = false;
    for (let i = this.fishes.length - 1; i >= 0; i--) {
      const f = this.fishes[i];
      if (f.shockTimer > 0) f.shockTimer--;

      // 水合わせ（温度・水質順応）タイマーの進行
      if (f.acclimating > 0) {
        f.acclimating = Math.max(0, f.acclimating - 1);
        f.lastTemp = this.temperature;
      } else if (this.typeDef.strictLevel > 0) {
        if (f.lastTemp !== null) {
          const tempJump = Math.abs(this.temperature - f.lastTemp);
          // 急激な水温変化（2.2℃以上の急変）で水温ショック発生
          if (tempJump >= 2.2) {
            f.shockTimer = 14;
            const shockDmg = this.typeId === 'realistic' ? tempJump * 4.2 : tempJump * 1.4;
            f.health = Math.max(12, f.health - shockDmg);
            if (window.showToast) {
              window.showToast(`⚡ 【${this.name}】急激な水温差(${tempJump.toFixed(1)}℃)で${f.def.name}が水温ショックを受けました！`);
            }
          }
        }
        f.lastTemp = this.temperature;
      } else {
        f.lastTemp = this.temperature;
      }

      const suit = this.evaluateFishSuitability(f);
      const cleanerBonus = cleanerCount > 0 ? 0.35 : 0;
      f.health = Math.max(10, Math.min(100, f.health + (suit.healthDelta + cleanerBonus) * ts));

      // 中級・上級水槽では「寿命」が進行（初級ファンタジー水槽では不老）
      if (this.typeDef.hasLifespan) {
        let ageStep = 1.0 * ts;
        if (this.typeId === 'realistic') {
          if (suit.canGrow && f.health >= 85) {
            ageStep = 0.82 * ts; // 理想的な環境では長寿化
          } else if (!suit.canGrow || f.health < 55) {
            ageStep = 2.4 * ts;  // 環境ストレス下では老化が早まる
          }
        }
        f.age += ageStep;

        if (f.age >= f.maxLifespan) {
          const legacyBonus = Math.floor(f.getReleaseValue() * 1.25);
          totalGain += legacyBonus;
          for (let b = 0; b < 8; b++) {
            this.bubbles.push({
              x: f.x + (Math.random() - 0.5) * 24,
              y: f.y + (Math.random() - 0.5) * 18,
              r: Math.random() * 3.5 + 1.5,
              vy: -(Math.random() * 1.3 + 0.6)
            });
          }
          this.fishes.splice(i, 1);
          sexHierarchyChanged = true;
          if (window.onFishPassedAway) window.onFishPassedAway(f);
          if (window.showToast) {
            window.showToast(`🌈 【${this.name}】${f.def.name}(第${f.generation}世代)が天寿を全うし、生命のしずく(+${legacyBonus.toLocaleString()})を遺しました`);
          }
          continue;
        }
      }

      // プロ水槽で極度に弱った場合の安全保護（万能水槽へ緊急退避）
      if (this.typeId === 'realistic' && f.health <= 12 && this.fishes.length > 1) {
        const casualTank = window.getCasualTank ? window.getCasualTank(this.id) : null;
        if (casualTank && casualTank.canFitFish(f)) {
          this.fishes.splice(i, 1);
          f.health = 65;
          casualTank.fishes.push(f);
          sexHierarchyChanged = true;
          if (window.showToast) {
            window.showToast(`🚑 【緊急退避】弱った${f.def.name}を「${casualTank.name}」へ保護しました！`);
          }
          continue;
        }
      }

      totalGain += f.getEffectiveRate(this);
    }

    // 5. 性転換・交配更新
    this.updateSequentialHermaphrodites();
    this.updateBreeding();

    return totalGain;
  }

  // 水槽のリセット
  reset(newTypeId, fishHandling = 'refund') {
    let refundTotal = 0;
    if (fishHandling === 'move') {
      const dest = window.getOtherTank ? window.getOtherTank(this.id) : null;
      if (dest) {
        this.fishes.forEach(f => {
          f.health = 100;
          dest.fishes.push(f);
        });
      } else {
        this.fishes.forEach(f => { refundTotal += f.getReleaseValue(); });
      }
    } else {
      this.fishes.forEach(f => { refundTotal += f.getReleaseValue(); });
    }

    this.fishes = [];
    this.spawnedEggs = [];
    this.foods = [];
    this.bubbles = [];
    this.waterPurity = 100;
    this.sludge = 0;

    if (newTypeId && TANK_TYPES[newTypeId]) {
      this.setType(newTypeId);
    }
    this.waterType = 'fresh';
    this.temperature = 25;
    this.targetTemp = 25;

    return refundTotal;
  }

  serialize() {
    return {
      id: this.id,
      name: this.name,
      typeId: this.typeId,
      waterType: this.waterType,
      temperature: this.temperature,
      targetTemp: this.targetTemp,
      heaterLevel: this.heaterLevel,
      coolerLevel: this.coolerLevel,
      waterPurity: Math.round(this.waterPurity),
      sludge: Math.round(this.sludge || 0),
      filterLevel: this.filterLevel,
      shrimpCount: this.shrimpCount,
      sizeLevel: this.sizeLevel,
      paused: this.paused,
      plantCount: this.plants.length,
      fishes: this.fishes.map(f => f.serialize()),
      spawnedEggs: this.spawnedEggs.map(e => e.serialize())
    };
  }

  static deserialize(data) {
    return new Tank(data);
  }
}
