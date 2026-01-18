import Phaser from 'phaser';
import { Player } from '@/entities/Player';
import { PlayerSkillType, SkillSlot, SummonerSkillConfig, Attackable, BuffType } from '@/types';
import { SUMMONER_SKILLS, GAME_CONFIG, UNIT, DEPTH } from '@/config/GameConfig';
import { AudioManager } from '@/systems/AudioManager';

/**
 * ガード反撃の状態
 */
interface GuardState {
  isActive: boolean;
  isGuarding: boolean;         // 防御態勢中
  guardTimeRemaining: number;  // 防御態勢残り時間
  attackDirection: number;     // 攻撃方向（ラジアン）
  blockedAttack: boolean;      // 攻撃を防いだか
}

/**
 * 制御棒バフの状態
 */
interface ControlRodState {
  isActive: boolean;
  remainingTime: number;
}

/**
 * サモナースキル管理クラス
 * D/Fスロットのスキルを管理
 */
export class SummonerSkillManager {
  private player: Player;
  private config: SummonerSkillConfig;

  // クールダウン管理（スキルタイプごと）
  private cooldowns: Map<PlayerSkillType, number> = new Map();

  // ガード反撃状態
  private guardState: GuardState = {
    isActive: false,
    isGuarding: false,
    guardTimeRemaining: 0,
    attackDirection: 0,
    blockedAttack: false,
  };

  // シーン参照（エフェクト表示用）
  private scene: Phaser.Scene;

  // 制御棒バフ状態
  private controlRodState: ControlRodState = {
    isActive: false,
    remainingTime: 0,
  };

  // 敵弾参照（天狗団扇用）
  private enemyBullets: Phaser.GameObjects.GameObject[] = [];

  // 敵参照（霊撃用）
  private enemies: Attackable[] = [];

  constructor(scene: Phaser.Scene, player: Player, config: SummonerSkillConfig) {
    this.scene = scene;
    this.player = player;
    this.config = config;
  }

  /**
   * 敵弾リストを設定（天狗団扇用）
   */
  setEnemyBullets(bullets: Phaser.GameObjects.GameObject[]): void {
    this.enemyBullets = bullets;
  }

  /**
   * 敵リストを設定（霊撃用）
   */
  setEnemies(enemies: Attackable[]): void {
    this.enemies = enemies;
  }

  /**
   * スキル使用可能か確認
   */
  canUseSkill(slot: SkillSlot.D | SkillSlot.F, currentTime: number): boolean {
    const skillType = slot === SkillSlot.D ? this.config.D : this.config.F;
    const cooldownEnd = this.cooldowns.get(skillType) || 0;

    // ガード反撃中は他のスキル使用不可
    if (this.guardState.isActive) {
      return false;
    }

    return currentTime >= cooldownEnd;
  }

  /**
   * クールダウン残り時間を取得
   */
  getCooldownRemaining(slot: SkillSlot.D | SkillSlot.F, currentTime: number): number {
    const skillType = slot === SkillSlot.D ? this.config.D : this.config.F;
    const cooldownEnd = this.cooldowns.get(skillType) || 0;
    return Math.max(0, cooldownEnd - currentTime);
  }

  /**
   * スキルを使用
   */
  useSkill(slot: SkillSlot.D | SkillSlot.F, currentTime: number, cursorX: number, cursorY: number): boolean {
    if (!this.canUseSkill(slot, currentTime)) {
      return false;
    }

    const skillType = slot === SkillSlot.D ? this.config.D : this.config.F;

    switch (skillType) {
      case PlayerSkillType.FLASH:
        return this.useFlash(currentTime, cursorX, cursorY);
      case PlayerSkillType.SPIRIT_STRIKE:
        return this.useSpiritStrike(currentTime);
      case PlayerSkillType.GUARD_COUNTER:
        return this.useGuardCounter(currentTime, cursorX, cursorY);
      case PlayerSkillType.CONTROL_ROD:
        return this.useControlRod(currentTime);
      case PlayerSkillType.TENGU_FAN:
        return this.useTenguFan(currentTime);
      default:
        console.log(`Skill ${skillType} not implemented`);
        return false;
    }
  }

  /**
   * フラッシュ: 3m以内のカーソル位置に即座にワープ
   */
  private useFlash(currentTime: number, cursorX: number, cursorY: number): boolean {
    const config = SUMMONER_SKILLS.flash;
    const maxRange = config.range;

    // プレイヤーからカーソルへの距離と方向を計算
    const dx = cursorX - this.player.x;
    const dy = cursorY - this.player.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    let targetX: number;
    let targetY: number;

    if (distance <= maxRange) {
      // 3m以内: カーソル位置へ
      targetX = cursorX;
      targetY = cursorY;
    } else {
      // 3m以上: カーソル方向に3m
      const ratio = maxRange / distance;
      targetX = this.player.x + dx * ratio;
      targetY = this.player.y + dy * ratio;
    }

    // プレイエリア内にクランプ
    const { X, Y, WIDTH, HEIGHT } = GAME_CONFIG.PLAY_AREA;
    const margin = 12; // プレイヤーの当たり判定分
    targetX = Phaser.Math.Clamp(targetX, X + margin, X + WIDTH - margin);
    targetY = Phaser.Math.Clamp(targetY, Y + margin, Y + HEIGHT - margin);

    // 即座にワープ
    this.player.setPosition(targetX, targetY);
    this.player.stopMovement();

    // SE再生
    AudioManager.getInstance().playSe('se_flash');

    // クールダウン開始
    this.cooldowns.set(PlayerSkillType.FLASH, currentTime + config.cooldown);

    console.log(`Flash used! Warped to (${targetX.toFixed(0)}, ${targetY.toFixed(0)})`);
    return true;
  }

  /**
   * 霊撃(α): 5.5m範囲の敵に0.1秒スタン
   */
  private useSpiritStrike(currentTime: number): boolean {
    const config = SUMMONER_SKILLS.spirit;
    const range = config.range;
    const stunDuration = config.stunDuration;

    let stunCount = 0;

    // 範囲内の敵にスタンを付与
    for (const enemy of this.enemies) {
      if (!enemy.getIsActive()) continue;

      const distance = Phaser.Math.Distance.Between(
        this.player.x, this.player.y,
        enemy.x, enemy.y
      );

      if (distance <= range) {
        // スタン付与（Attackableインターフェースには直接スタン付与メソッドがないため、
        // 実際の敵クラスでStatusEffectを付与する必要がある）
        // ここでは敵がsetStunnedメソッドを持っている場合に呼び出す
        if ('setStunned' in enemy && typeof (enemy as any).setStunned === 'function') {
          (enemy as any).setStunned(stunDuration);
          stunCount++;
        }
      }
    }

    // 範囲エフェクト表示
    this.showCircleEffect(range, 0x00ffff);

    // SE再生
    AudioManager.getInstance().playSe('se_spirit');

    // クールダウン開始
    this.cooldowns.set(PlayerSkillType.SPIRIT_STRIKE, currentTime + config.cooldown);

    console.log(`Spirit Strike used! Stunned ${stunCount} enemies for ${stunDuration}ms`);
    return true;
  }

  /**
   * ガード反撃: 0.75秒防御態勢→台形範囲攻撃
   */
  private useGuardCounter(currentTime: number, cursorX: number, cursorY: number): boolean {
    const config = SUMMONER_SKILLS.guard;

    // 攻撃方向を計算（入力時のカーソル方向）
    const angle = Phaser.Math.Angle.Between(this.player.x, this.player.y, cursorX, cursorY);

    // 防御態勢開始
    this.guardState = {
      isActive: true,
      isGuarding: true,
      guardTimeRemaining: config.guardDuration,
      attackDirection: angle,
      blockedAttack: false,
    };

    // プレイヤーを無敵+CC免疫状態に
    this.player.setInvincible(true);
    this.player.stopMovement();

    // SE再生（発動時）
    AudioManager.getInstance().playSe('se_guard_start', { volume: 1.5 });

    // クールダウン開始（攻撃を防いだ場合は後で50%減少）
    this.cooldowns.set(PlayerSkillType.GUARD_COUNTER, currentTime + config.cooldown);

    console.log('Guard Counter activated! Guarding...');
    return true;
  }

  /**
   * 制御棒: 5秒間射程+1.5m、攻撃力+10%
   */
  private useControlRod(currentTime: number): boolean {
    const config = SUMMONER_SKILLS.control;

    // バフを付与
    this.player.addBuff(
      BuffType.ATTACK_POWER,
      1 + config.attackPowerBonus, // 1.10
      config.duration,
      'control_rod'
    );

    // 射程バフ状態を設定
    this.controlRodState = {
      isActive: true,
      remainingTime: config.duration,
    };

    // SE再生
    AudioManager.getInstance().playSe('se_control');

    // クールダウン開始
    this.cooldowns.set(PlayerSkillType.CONTROL_ROD, currentTime + config.cooldown);

    console.log(`Control Rod used! Range +${config.rangeBonus / UNIT.METER_TO_PIXEL}m, ATK +${config.attackPowerBonus * 100}% for ${config.duration / 1000}s`);
    return true;
  }

  /**
   * 霊撃(β): 5.5m以内の敵弾を消去
   */
  private useTenguFan(currentTime: number): boolean {
    const config = SUMMONER_SKILLS.tengu;
    const range = config.range;

    let clearedCount = 0;

    // 範囲内の敵弾を消去
    for (const bullet of this.enemyBullets) {
      if (!bullet.active) continue;

      const bulletSprite = bullet as Phaser.Physics.Arcade.Sprite;
      const distance = Phaser.Math.Distance.Between(
        this.player.x, this.player.y,
        bulletSprite.x, bulletSprite.y
      );

      if (distance <= range) {
        bulletSprite.destroy();
        clearedCount++;
      }
    }

    // 範囲エフェクト表示（霊撃(α)とは別の色）
    this.showCircleEffect(range, 0xff00ff);

    // SE再生（霊撃と同じ）
    AudioManager.getInstance().playSe('se_spirit');

    // クールダウン開始
    this.cooldowns.set(PlayerSkillType.TENGU_FAN, currentTime + config.cooldown);

    console.log(`Tengu Fan used! Cleared ${clearedCount} bullets`);
    return true;
  }

  /**
   * 攻撃を受けた際の処理（ガード反撃用）
   * @returns true: 攻撃を防いだ, false: 防いでいない
   */
  onAttackReceived(): boolean {
    if (this.guardState.isGuarding) {
      this.guardState.blockedAttack = true;
      // ガード成功SE再生
      AudioManager.getInstance().playSe('se_guard_success', { volume: 1.5 });
      console.log('Guard Counter: Attack blocked!');
      return true;
    }
    return false;
  }

  /**
   * 制御棒による射程ボーナスを取得
   */
  getRangeBonus(): number {
    if (this.controlRodState.isActive) {
      return SUMMONER_SKILLS.control.rangeBonus;
    }
    return 0;
  }

  /**
   * ガード反撃がアクティブかどうか
   */
  isGuardActive(): boolean {
    return this.guardState.isActive;
  }

  /**
   * ガード中（防御態勢）かどうか
   */
  isGuarding(): boolean {
    return this.guardState.isGuarding;
  }

  /**
   * 更新処理
   */
  update(time: number, delta: number): void {
    // ガード反撃の更新
    this.updateGuardCounter(time, delta);

    // 制御棒バフの更新
    this.updateControlRod(delta);
  }

  /**
   * ガード反撃の更新処理
   */
  private updateGuardCounter(time: number, delta: number): void {
    if (!this.guardState.isActive) return;

    if (this.guardState.isGuarding) {
      // 防御態勢中
      this.guardState.guardTimeRemaining -= delta;

      if (this.guardState.guardTimeRemaining <= 0) {
        // 防御態勢終了 → 台形範囲攻撃を実行
        this.executeGuardCounterAttack(time);
      }
    }
  }

  /**
   * ガード反撃の台形範囲攻撃を実行
   */
  private executeGuardCounterAttack(time: number): void {
    const config = SUMMONER_SKILLS.guard;

    // 無敵解除
    this.player.setInvincible(false);
    this.guardState.isGuarding = false;

    // ガードに成功した場合のみ攻撃を実行
    if (this.guardState.blockedAttack) {
      // 台形範囲内の敵にダメージを与える
      const damage = this.player.getEffectiveAttackPower() * config.damageRatio;
      let hitCount = 0;

      for (const enemy of this.enemies) {
        if (!enemy.getIsActive()) continue;

        if (this.isInTrapezoidArea(enemy.x, enemy.y)) {
          enemy.takeDamage(Math.floor(damage));
          hitCount++;
        }
      }

      // エフェクト表示（台形範囲を表示）
      this.showTrapezoidEffect();

      // ヒットした敵がいれば被弾SEを再生
      if (hitCount > 0) {
        AudioManager.getInstance().playSe('se_hit_enemy');
      }

      console.log(`Guard Counter attack! Hit ${hitCount} enemies for ${damage.toFixed(0)} damage`);
    } else {
      console.log('Guard Counter: No attack blocked, counter attack not triggered');
    }

    // ガード反撃終了
    this.endGuardCounter(time);
  }

  /**
   * 座標が台形範囲内にあるかチェック
   * 台形: 下底（霊夢側）3m、上底0.8m、高さ6m
   */
  private isInTrapezoidArea(x: number, y: number): boolean {
    const config = SUMMONER_SKILLS.guard;
    const bottomWidth = config.attackBottomWidth;
    const topWidth = config.attackTopWidth;
    const height = config.attackHeight;
    const direction = this.guardState.attackDirection;

    // プレイヤーから対象への相対座標を計算
    const dx = x - this.player.x;
    const dy = y - this.player.y;

    // 攻撃方向に対するローカル座標に変換
    // forward = 攻撃方向（高さ方向）, right = 攻撃方向に対して右方向（幅方向）
    const cos = Math.cos(direction);
    const sin = Math.sin(direction);
    const forward = dx * cos + dy * sin;    // 攻撃方向への距離
    const right = -dx * sin + dy * cos;     // 攻撃方向に対して右方向の距離

    // 範囲チェック
    // forward: 0（プレイヤー位置）〜 height（攻撃先端）
    if (forward < 0 || forward > height) {
      return false;
    }

    // 台形の幅を計算（高さに応じて線形補間）
    // forward = 0 で bottomWidth、forward = height で topWidth
    const progress = forward / height;
    const currentHalfWidth = (bottomWidth + (topWidth - bottomWidth) * progress) / 2;

    // 幅方向のチェック
    return Math.abs(right) <= currentHalfWidth;
  }

  /**
   * 円形範囲エフェクトを表示
   */
  private showCircleEffect(range: number, color: number): void {
    const graphics = this.scene.add.graphics();
    graphics.setDepth(DEPTH.EFFECTS);
    graphics.fillStyle(color, 0.3);
    graphics.lineStyle(3, color, 0.8);

    // プレイヤーを中心に円を描画
    graphics.fillCircle(this.player.x, this.player.y, range);
    graphics.strokeCircle(this.player.x, this.player.y, range);

    // フェードアウト
    this.scene.tweens.add({
      targets: graphics,
      alpha: 0,
      duration: 300,
      onComplete: () => {
        graphics.destroy();
      },
    });
  }

  /**
   * 台形エフェクトを表示
   */
  private showTrapezoidEffect(): void {
    const config = SUMMONER_SKILLS.guard;
    const bottomWidth = config.attackBottomWidth;
    const topWidth = config.attackTopWidth;
    const height = config.attackHeight;
    const direction = this.guardState.attackDirection;

    // 台形の4頂点を計算（プレイヤー位置を原点として）
    const cos = Math.cos(direction);
    const sin = Math.sin(direction);

    // 右方向のベクトル（攻撃方向に対して垂直）
    const rightX = -sin;
    const rightY = cos;

    // 下底（プレイヤー側）の左右の点
    const bottomLeft = {
      x: this.player.x - rightX * bottomWidth / 2,
      y: this.player.y - rightY * bottomWidth / 2,
    };
    const bottomRight = {
      x: this.player.x + rightX * bottomWidth / 2,
      y: this.player.y + rightY * bottomWidth / 2,
    };

    // 上底（攻撃先端側）の左右の点
    const topLeft = {
      x: this.player.x + cos * height - rightX * topWidth / 2,
      y: this.player.y + sin * height - rightY * topWidth / 2,
    };
    const topRight = {
      x: this.player.x + cos * height + rightX * topWidth / 2,
      y: this.player.y + sin * height + rightY * topWidth / 2,
    };

    // グラフィックスで台形を描画
    const graphics = this.scene.add.graphics();
    graphics.setDepth(DEPTH.EFFECTS);
    graphics.fillStyle(0xffff00, 0.4);
    graphics.lineStyle(3, 0xffff00, 0.8);

    graphics.beginPath();
    graphics.moveTo(bottomLeft.x, bottomLeft.y);
    graphics.lineTo(topLeft.x, topLeft.y);
    graphics.lineTo(topRight.x, topRight.y);
    graphics.lineTo(bottomRight.x, bottomRight.y);
    graphics.closePath();
    graphics.fillPath();
    graphics.strokePath();

    // フェードアウト
    this.scene.tweens.add({
      targets: graphics,
      alpha: 0,
      duration: 300,
      onComplete: () => {
        graphics.destroy();
      },
    });
  }

  /**
   * ガード反撃終了
   */
  private endGuardCounter(time: number): void {
    // 攻撃を防いでいた場合、CDを減少
    if (this.guardState.blockedAttack) {
      const config = SUMMONER_SKILLS.guard;
      const currentCooldownEnd = this.cooldowns.get(PlayerSkillType.GUARD_COUNTER) || 0;
      const remainingCooldown = currentCooldownEnd - time;
      const reducedCooldown = remainingCooldown * (1 - config.cdReductionOnBlock);
      this.cooldowns.set(PlayerSkillType.GUARD_COUNTER, time + reducedCooldown);
      console.log(`Guard Counter: CD reduced by ${config.cdReductionOnBlock * 100}%!`);
    }

    this.guardState = {
      isActive: false,
      isGuarding: false,
      guardTimeRemaining: 0,
      attackDirection: 0,
      blockedAttack: false,
    };

    console.log('Guard Counter ended!');
  }

  /**
   * 制御棒バフの更新
   */
  private updateControlRod(delta: number): void {
    if (!this.controlRodState.isActive) return;

    this.controlRodState.remainingTime -= delta;

    if (this.controlRodState.remainingTime <= 0) {
      this.controlRodState.isActive = false;
      console.log('Control Rod buff ended');
    }
  }

  /**
   * スキル設定を取得
   */
  getSkillConfig(slot: SkillSlot.D | SkillSlot.F): typeof SUMMONER_SKILLS[keyof typeof SUMMONER_SKILLS] {
    const skillType = slot === SkillSlot.D ? this.config.D : this.config.F;
    return SUMMONER_SKILLS[skillType as keyof typeof SUMMONER_SKILLS];
  }

  /**
   * スキルタイプを取得
   */
  getSkillType(slot: SkillSlot.D | SkillSlot.F): PlayerSkillType {
    return slot === SkillSlot.D ? this.config.D : this.config.F;
  }

  /**
   * クリーンアップ
   */
  destroy(): void {
    this.cooldowns.clear();
  }
}
