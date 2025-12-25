import Phaser from 'phaser';
import { CharacterType, CharacterConfig, Position, BulletType, SkillSlot, SkillState, Buff, BuffType, Attackable } from '@/types';
import { CHARACTER_DATA } from '@/config/CharacterData';
import { DEPTH, COLORS, SKILL_CONFIG, GAME_CONFIG } from '@/config/GameConfig';
import { BulletPool } from '@/utils/ObjectPool';
import { DamageCalculator } from '@/utils/DamageCalculator';
import { AudioManager } from '@/systems/AudioManager';
import { Enemy } from './Enemy';
import { SkillProjectile } from './SkillProjectile';

/**
 * プレイヤーキャラクタークラス
 */
export class Player extends Phaser.Physics.Arcade.Sprite {
  // キャラクター設定
  private characterConfig: CharacterConfig;

  // 現在の状態
  private currentHp: number = 0;
  private isInvincible: boolean = false;
  private isStunned: boolean = false;  // 行動不能状態
  private stunEndTime: number = 0;     // スタン終了時刻
  private stunDuration: number = 0;    // スタン総時間

  // 移動関連
  private targetPosition: Position | null = null;
  private isMoving: boolean = false;

  // 攻撃関連
  private lastAttackTime: number = 0;
  private attackCooldown: number = 0;
  private bulletPool: BulletPool | null = null;
  private enemies: Enemy[] = [];
  private mobs: Attackable[] = []; // 道中雑魚敵
  private boss: Attackable | null = null; // 現在のボス（Rumiaなど）

  // Attack Move関連
  private isAttackMove: boolean = false;
  private attackMoveTarget: Position | null = null;

  // スキル関連
  private skillCooldowns: Record<SkillSlot, number> = {
    [SkillSlot.Q]: 0,
    [SkillSlot.W]: 0,
    [SkillSlot.E]: 0,
    [SkillSlot.R]: 0,
    [SkillSlot.D]: 0,
    [SkillSlot.F]: 0,
  };
  private currentSkillState: SkillState = SkillState.READY;
  private skillCastTimeRemaining: number = 0;
  private skillExecutionTimeRemaining: number = 0;

  // 現在キャスト中のスキル
  private currentCastingSkill: SkillSlot | null = null;

  // Wスキル用（方向指定）
  private skillTargetDirection: number = 0; // ラジアン
  private wSkillProjectile: SkillProjectile | null = null;
  private wSkillMotionTime: number = 0; // モーション硬直残り時間

  // Qスキル用（妖怪バスター）
  private qSkillProjectile: SkillProjectile | null = null;
  private qSkillMotionTime: number = 0; // モーション硬直残り時間

  // 針巫女スタック
  private haribabaStacks: number = 0;
  private haribabaStackTimer: number = 0;

  // Eスキル用（ダッシュ）
  private isDashing: boolean = false;
  private dashTimeRemaining: number = 0;
  private dashTargetX: number = 0;
  private dashTargetY: number = 0;
  private dashStartX: number = 0;
  private dashStartY: number = 0;
  private dashTotalTime: number = 0;

  // Rスキル用（夢想天生）
  private isRSkillActive: boolean = false;
  private rSkillTimeRemaining: number = 0;
  private rSkillDamageTimer: number = 0;
  private rSkillAreaGraphics: Phaser.GameObjects.Graphics | null = null;

  // 当たり判定表示用
  private hitboxGraphics: Phaser.GameObjects.Graphics | null = null;

  // バフ関連
  private buffs: Buff[] = [];

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    characterType: CharacterType = CharacterType.REIMU
  ) {
    // キャラクターに応じたテクスチャを選択
    const textureKey = characterType === CharacterType.REIMU ? 'coma_reimu_idle' : 'player';
    super(scene, x, y, textureKey);

    // キャラクター設定を取得
    this.characterConfig = CHARACTER_DATA[characterType];

    // 物理エンジンに追加
    scene.add.existing(this);
    scene.physics.add.existing(this);

    // 初期化
    this.initialize(characterType);
  }

  /**
   * 初期化
   */
  private initialize(characterType: CharacterType): void {
    const { stats } = this.characterConfig;

    // HP設定
    this.currentHp = stats.maxHp;

    // 攻撃クールダウン計算（ミリ秒）
    this.attackCooldown = 1000 / stats.attackSpeed;

    // 表示設定
    this.setDepth(DEPTH.PLAYER);

    // キャラクターに応じた表示設定
    if (characterType === CharacterType.REIMU) {
      // 霊夢のコマアニメーションを再生
      this.play('reimu_idle');
      // スケール調整（1408x752は大きすぎるので縮小）
      this.setScale(0.16);
      // Tintをクリア（元の色で表示）
      this.clearTint();
    } else {
      // フォールバック: 仮スプライトを使用
      this.setTint(COLORS.PLAYER);
    }

    // 当たり判定設定
    const body = this.body as Phaser.Physics.Arcade.Body;
    if (body) {
      body.setCircle(stats.hitboxRadius);
      body.setOffset(
        (this.width - stats.hitboxRadius * 2) / 2,
        (this.height - stats.hitboxRadius * 2) / 2
      );
    }

    // 当たり判定表示を作成
    this.hitboxGraphics = this.scene.add.graphics();
    this.hitboxGraphics.setDepth(DEPTH.PLAYER + 1);
    this.drawHitbox();
  }

  /**
   * 当たり判定を描画
   */
  private drawHitbox(): void {
    if (!this.hitboxGraphics) return;

    const radius = this.characterConfig.stats.hitboxRadius;

    this.hitboxGraphics.clear();
    // 黄色い円で当たり判定を表示
    this.hitboxGraphics.lineStyle(2, 0xffff00, 0.8);
    this.hitboxGraphics.fillStyle(0xffff00, 0.3);
    this.hitboxGraphics.fillCircle(this.x, this.y, radius);
    this.hitboxGraphics.strokeCircle(this.x, this.y, radius);
  }

  /**
   * 更新処理
   */
  update(time: number, delta: number): void {
    // スタン中（引き寄せなど）は処理をスキップ
    if (this.isStunned) {
      this.setVelocity(0, 0);
      this.drawHitbox();
      return;
    }

    // バフの更新
    this.updateBuffs(delta);

    // スキル処理
    this.updateSkill(time, delta);

    // Rスキル処理
    if (this.isRSkillActive) {
      this.updateRSkill(delta);
    }

    // ダッシュ処理
    if (this.isDashing) {
      this.updateDash(delta);
      // 当たり判定表示を更新
      this.drawHitbox();
      return; // ダッシュ中は他の移動処理をスキップ
    }

    // 移動処理（スキル中は移動不可）
    if (!this.isSkillLocked()) {
      this.updateMovement(delta);
    } else {
      this.setVelocity(0, 0);
    }

    // Attack Move処理
    this.updateAttackMove(time);

    // 当たり判定表示を更新
    this.drawHitbox();
  }

  /**
   * ダッシュの更新処理
   */
  private updateDash(delta: number): void {
    this.dashTimeRemaining -= delta;

    // 進行度を計算（0〜1）
    const progress = 1 - (this.dashTimeRemaining / this.dashTotalTime);
    const clampedProgress = Phaser.Math.Clamp(progress, 0, 1);

    // 線形補間で現在位置を計算
    const currentX = Phaser.Math.Linear(this.dashStartX, this.dashTargetX, clampedProgress);
    const currentY = Phaser.Math.Linear(this.dashStartY, this.dashTargetY, clampedProgress);

    this.setPosition(currentX, currentY);

    // ダッシュ完了
    if (this.dashTimeRemaining <= 0) {
      this.setPosition(this.dashTargetX, this.dashTargetY);
      this.isDashing = false;
      console.log('E skill dash completed!');
    }
  }

  /**
   * スキル中かどうか（移動不可状態）
   */
  isSkillLocked(): boolean {
    return this.currentSkillState === SkillState.CASTING ||
           this.currentSkillState === SkillState.EXECUTING;
  }

  /**
   * バフの更新処理
   */
  private updateBuffs(delta: number): void {
    for (let i = this.buffs.length - 1; i >= 0; i--) {
      this.buffs[i].remainingTime -= delta;
      if (this.buffs[i].remainingTime <= 0) {
        const expiredBuff = this.buffs[i];
        console.log(`Buff expired: ${expiredBuff.source} (${expiredBuff.type})`);
        this.buffs.splice(i, 1);
      }
    }
    // 攻撃速度の再計算
    this.recalculateAttackCooldown();
  }

  /**
   * 攻撃クールダウンを再計算（バフを考慮）
   */
  private recalculateAttackCooldown(): void {
    const baseAttackSpeed = this.characterConfig.stats.attackSpeed;
    let totalMultiplier = 1.0;

    for (const buff of this.buffs) {
      if (buff.type === BuffType.ATTACK_SPEED) {
        totalMultiplier *= buff.multiplier;
      }
    }

    this.attackCooldown = 1000 / (baseAttackSpeed * totalMultiplier);
  }

  /**
   * バフを追加
   */
  addBuff(type: BuffType, multiplier: number, duration: number, source: string): void {
    // 同じソースのバフがあれば更新
    const existingBuff = this.buffs.find(b => b.source === source);
    if (existingBuff) {
      existingBuff.multiplier = multiplier;
      existingBuff.remainingTime = duration;
    } else {
      this.buffs.push({
        type,
        multiplier,
        remainingTime: duration,
        source,
      });
    }
  }

  /**
   * スキルの更新処理
   */
  private updateSkill(time: number, delta: number): void {
    // Qスキルのモーション硬直と投射物の更新
    this.updateQSkillMotion(delta);

    // Wスキルのモーション硬直と投射物の更新
    this.updateWSkillMotion(delta);

    // 針巫女スタックの更新
    this.updateHaribabaStack(delta);

    if (this.currentSkillState === SkillState.CASTING) {
      // キャスト中
      this.skillCastTimeRemaining -= delta;
      if (this.skillCastTimeRemaining <= 0) {
        // キャスト完了 → 実行開始
        if (this.currentCastingSkill === SkillSlot.Q) {
          this.executeQSkill(time);
        } else if (this.currentCastingSkill === SkillSlot.W) {
          this.executeWSkill(time);
        } else if (this.currentCastingSkill === SkillSlot.E) {
          this.executeESkill(time);
        }
      }
    }
  }

  /**
   * Qスキルのモーション硬直更新
   */
  private updateQSkillMotion(delta: number): void {
    if (this.qSkillMotionTime > 0) {
      this.qSkillMotionTime -= delta;
      if (this.qSkillMotionTime <= 0) {
        this.qSkillMotionTime = 0;
      }
    }

    // Qスキル投射物の更新
    if (this.qSkillProjectile && this.qSkillProjectile.getIsActive()) {
      this.qSkillProjectile.update(0, delta);
    }
  }

  /**
   * Wスキルのモーション硬直更新
   */
  private updateWSkillMotion(delta: number): void {
    if (this.wSkillMotionTime > 0) {
      this.wSkillMotionTime -= delta;
      if (this.wSkillMotionTime <= 0) {
        this.wSkillMotionTime = 0;
      }
    }

    // Wスキル投射物の更新
    if (this.wSkillProjectile && this.wSkillProjectile.getIsActive()) {
      this.wSkillProjectile.update(0, delta);
    }
  }

  /**
   * 針巫女スタックの更新
   */
  private updateHaribabaStack(delta: number): void {
    if (this.haribabaStacks > 0) {
      this.haribabaStackTimer -= delta;
      if (this.haribabaStackTimer <= 0) {
        // スタック全て失う
        this.haribabaStacks = 0;
        console.log('Haribaba stacks expired!');
      }
    }
  }

  /**
   * 針巫女スタックを追加
   */
  private addHaribabaStack(): void {
    const { MAX_STACK, DURATION } = SKILL_CONFIG.REIMU_Q.HARIBABA_STACK;

    if (this.haribabaStacks < MAX_STACK) {
      this.haribabaStacks++;
    }
    // 持続時間を更新
    this.haribabaStackTimer = DURATION;

    console.log(`Haribaba stack: ${this.haribabaStacks}/${MAX_STACK}`);
  }

  /**
   * 針巫女スタック数を取得
   */
  getHaribabaStacks(): number {
    return this.haribabaStacks;
  }

  /**
   * 針巫女スタックの残り時間を取得
   */
  getHaribabaStackTimer(): number {
    return this.haribabaStackTimer;
  }

  /**
   * ダッシュ中かどうかを取得
   */
  getIsDashing(): boolean {
    return this.isDashing;
  }

  /**
   * ダッシュ残り時間を取得
   */
  getDashTimeRemaining(): number {
    return this.dashTimeRemaining;
  }

  /**
   * スキル使用可能か判定
   */
  canUseSkill(slot: SkillSlot, currentTime: number): boolean {
    // スキル実行中は使用不可
    if (this.isSkillLocked()) {
      return false;
    }

    // クールダウンチェック
    const cooldownEnd = this.skillCooldowns[slot];
    return currentTime >= cooldownEnd;
  }

  /**
   * Qスキルを使用開始（妖怪バスター - 方向指定）
   */
  useQSkill(currentTime: number, targetX: number, targetY: number): boolean {
    if (!this.canUseSkill(SkillSlot.Q, currentTime)) {
      return false;
    }

    // モーション硬直中は使用不可
    if (this.qSkillMotionTime > 0) {
      return false;
    }

    // 方向を計算
    this.skillTargetDirection = Phaser.Math.Angle.Between(this.x, this.y, targetX, targetY);

    // キャスト開始
    this.currentSkillState = SkillState.CASTING;
    this.currentCastingSkill = SkillSlot.Q;
    this.skillCastTimeRemaining = SKILL_CONFIG.REIMU_Q.CAST_TIME;

    // 移動を停止
    this.stopMovement();

    console.log('Q skill (Youkai Buster) casting started');

    return true;
  }

  /**
   * Wスキルを使用開始
   */
  useWSkill(currentTime: number, targetX: number, targetY: number): boolean {
    // クールダウンチェック
    if (!this.canUseSkill(SkillSlot.W, currentTime)) {
      return false;
    }

    // スキル実行中は使用不可
    if (this.isSkillLocked()) {
      return false;
    }

    // モーション硬直中は使用不可
    if (this.wSkillMotionTime > 0) {
      return false;
    }

    // 方向を計算
    this.skillTargetDirection = Phaser.Math.Angle.Between(this.x, this.y, targetX, targetY);

    // キャスト開始
    this.currentSkillState = SkillState.CASTING;
    this.currentCastingSkill = SkillSlot.W;
    this.skillCastTimeRemaining = SKILL_CONFIG.REIMU_W.CAST_TIME;

    // 移動を停止
    this.stopMovement();

    console.log('W skill casting started');

    return true;
  }

  /**
   * Qスキル実行（妖怪バスター - キャスト完了後、長方形弾を発射）
   */
  private executeQSkill(time: number): void {
    const { PROJECTILE_WIDTH, PROJECTILE_HEIGHT, PROJECTILE_RANGE, PROJECTILE_TRAVEL_TIME,
            SLOW_DURATION, SLOW_AMOUNT, CD_REFUND_ON_HIT, DAMAGE, MOTION_TIME, COOLDOWN } = SKILL_CONFIG.REIMU_Q;

    // スキルダメージ計算
    const rawDamage = DAMAGE.BASE_DAMAGE +
      this.characterConfig.stats.attackPower * DAMAGE.SCALING_RATIO;

    // 方向ベクトルを正規化
    const dirX = Math.cos(this.skillTargetDirection);
    const dirY = Math.sin(this.skillTargetDirection);

    // SkillProjectileを作成（なければ新規作成）
    if (!this.qSkillProjectile) {
      this.qSkillProjectile = new SkillProjectile(this.scene);
    }

    // ターゲット配列を作成（敵 + 雑魚 + ボス）
    const targets: Attackable[] = [...this.enemies, ...this.mobs];
    if (this.boss && this.boss.getIsActive()) {
      targets.push(this.boss);
    }

    // 命中時コールバック
    const onHit = (_target: Attackable, _damage: number, _didBreak: boolean) => {
      // CD75%解消
      const currentCd = this.skillCooldowns[SkillSlot.Q] - time;
      if (currentCd > 0) {
        const refund = COOLDOWN * CD_REFUND_ON_HIT;
        this.skillCooldowns[SkillSlot.Q] = Math.max(time, this.skillCooldowns[SkillSlot.Q] - refund);
        console.log(`Q skill hit! CD reduced by ${refund}ms`);
      }

      // 針巫女スタック追加
      this.addHaribabaStack();
    };

    // 投射物を発射
    this.qSkillProjectile.fire(
      this.x,
      this.y,
      dirX,
      dirY,
      PROJECTILE_WIDTH,
      PROJECTILE_HEIGHT,
      PROJECTILE_RANGE,
      PROJECTILE_TRAVEL_TIME,
      rawDamage,
      0, // スタンなし
      targets,
      {
        slowDuration: SLOW_DURATION,
        slowAmount: SLOW_AMOUNT,
        onHitCallback: onHit,
        skillSource: 'reimu_q',
        color: 0xff6666, // 赤っぽい色
        textureKey: 'reimu_skill_q',
      }
    );

    console.log(`Q skill (Youkai Buster) executed! (${PROJECTILE_WIDTH}x${PROJECTILE_HEIGHT}px, Damage: ${rawDamage})`);

    // クールダウン開始
    this.skillCooldowns[SkillSlot.Q] = time + COOLDOWN;

    // モーション硬直開始
    this.qSkillMotionTime = MOTION_TIME;

    // スキル完了
    this.currentSkillState = SkillState.READY;
    this.currentCastingSkill = null;
  }

  /**
   * Wスキル実行（封魔針 - 即時発動、長方形弾を発射）
   */
  private executeWSkill(time: number): void {
    const { PROJECTILE_WIDTH, PROJECTILE_HEIGHT, PROJECTILE_RANGE, PROJECTILE_SPEED,
            STUN_DURATION, DAMAGE, MOTION_TIME, COOLDOWN, E_CD_REFUND_ON_BREAK, BREAK_BONUS_DAMAGE_RATIO } = SKILL_CONFIG.REIMU_W;

    // スキルダメージ計算
    const rawDamage = DAMAGE.BASE_DAMAGE +
      this.characterConfig.stats.attackPower * DAMAGE.SCALING_RATIO;

    // 方向ベクトルを正規化
    const dirX = Math.cos(this.skillTargetDirection);
    const dirY = Math.sin(this.skillTargetDirection);

    // SkillProjectileを作成（なければ新規作成）
    if (!this.wSkillProjectile) {
      this.wSkillProjectile = new SkillProjectile(this.scene);
    }

    // ターゲット配列を作成（敵 + 雑魚 + ボス）
    const targets: Attackable[] = [...this.enemies, ...this.mobs];
    if (this.boss && this.boss.getIsActive()) {
      targets.push(this.boss);
    }

    // 命中時コールバック（ブレイク時にEスキルCD回復 + 追加ダメージ）
    const onHit = (target: Attackable, damage: number, didBreak: boolean) => {
      if (didBreak) {
        // EスキルのCD30%解消
        const currentECd = this.skillCooldowns[SkillSlot.E] - time;
        if (currentECd > 0) {
          const refund = SKILL_CONFIG.REIMU_E.COOLDOWN * E_CD_REFUND_ON_BREAK;
          this.skillCooldowns[SkillSlot.E] = Math.max(time, this.skillCooldowns[SkillSlot.E] - refund);
          console.log(`W skill break! E CD reduced by ${refund}ms`);
        }

        // 追加ダメージ
        const bonusDamage = Math.floor(damage * BREAK_BONUS_DAMAGE_RATIO);
        target.takeDamage(bonusDamage);
        console.log(`W skill break bonus damage: ${bonusDamage}`);
      }
    };

    // 投射物を発射（弾速指定）
    this.wSkillProjectile.fire(
      this.x,
      this.y,
      dirX,
      dirY,
      PROJECTILE_WIDTH,
      PROJECTILE_HEIGHT,
      PROJECTILE_RANGE,
      0, // travelTimeは使わない
      rawDamage,
      STUN_DURATION,
      targets,
      {
        speed: PROJECTILE_SPEED,
        onHitCallback: onHit,
        skillSource: 'reimu_w',
        color: 0x9966ff, // 紫色
        textureKey: 'reimu_skill_w',
      }
    );

    console.log(`W skill (Fuuma Needle) executed! (${PROJECTILE_WIDTH}x${PROJECTILE_HEIGHT}px, Speed: ${PROJECTILE_SPEED}px/s, Damage: ${rawDamage}, Stun: ${STUN_DURATION}ms)`);

    // クールダウン開始
    this.skillCooldowns[SkillSlot.W] = time + COOLDOWN;

    // モーション硬直開始
    this.wSkillMotionTime = MOTION_TIME;

    // スキル完了（モーション硬直は別で管理）
    this.currentSkillState = SkillState.READY;
    this.currentCastingSkill = null;
  }

  /**
   * Eスキルを使用開始
   */
  useESkill(currentTime: number, targetX: number, targetY: number): boolean {
    if (!this.canUseSkill(SkillSlot.E, currentTime)) {
      return false;
    }

    // 方向を計算
    this.skillTargetDirection = Phaser.Math.Angle.Between(this.x, this.y, targetX, targetY);

    // キャスト開始
    this.currentSkillState = SkillState.CASTING;
    this.currentCastingSkill = SkillSlot.E;
    this.skillCastTimeRemaining = SKILL_CONFIG.REIMU_E.CAST_TIME;

    // 移動を停止
    this.stopMovement();

    return true;
  }

  /**
   * Eスキル実行（昇天蹴 - キャスト完了後、ダッシュ開始）
   */
  private executeESkill(time: number): void {
    const { DASH_DISTANCE, DASH_DURATION, COOLDOWN, DAMAGE } = SKILL_CONFIG.REIMU_E;

    // ダッシュ先の位置を計算
    const targetX = this.x + Math.cos(this.skillTargetDirection) * DASH_DISTANCE;
    const targetY = this.y + Math.sin(this.skillTargetDirection) * DASH_DISTANCE;

    // プレイエリア内にクランプ
    const { X, Y, WIDTH, HEIGHT } = GAME_CONFIG.PLAY_AREA;
    const clampedX = Phaser.Math.Clamp(targetX, X, X + WIDTH);
    const clampedY = Phaser.Math.Clamp(targetY, Y, Y + HEIGHT);

    // ダッシュ開始
    this.isDashing = true;
    this.dashStartX = this.x;
    this.dashStartY = this.y;
    this.dashTargetX = clampedX;
    this.dashTargetY = clampedY;
    this.dashTotalTime = DASH_DURATION;
    this.dashTimeRemaining = DASH_DURATION;

    // ダッシュダメージ計算
    const rawDamage = DAMAGE.BASE_DAMAGE +
      this.characterConfig.stats.attackPower * DAMAGE.SCALING_RATIO;

    // ダッシュ経路上の敵にダメージ（即座に判定）
    this.dealDashDamage(this.x, this.y, clampedX, clampedY, rawDamage);

    // WスキルのCDを完全回復
    this.skillCooldowns[SkillSlot.W] = 0;
    console.log('E skill (Shouten Kick): W cooldown reset!');

    // QスキルのCDを完全回復
    this.skillCooldowns[SkillSlot.Q] = 0;
    console.log('E skill (Shouten Kick): Q cooldown reset!');

    // クールダウン開始
    this.skillCooldowns[SkillSlot.E] = time + COOLDOWN;

    console.log(`E skill (Shouten Kick) executed! Dashing ${DASH_DISTANCE}px over ${DASH_DURATION}ms, Damage: ${rawDamage}`);

    // スキル完了（硬直なし、ダッシュ中も行動可能）
    this.currentSkillState = SkillState.READY;
    this.currentCastingSkill = null;
  }

  /**
   * ダッシュ経路上の敵にダメージを与える
   */
  private dealDashDamage(startX: number, startY: number, endX: number, endY: number, damage: number): void {
    // ターゲット配列を作成（敵 + 雑魚 + ボス）
    const targets: Attackable[] = [...this.enemies, ...this.mobs];
    if (this.boss && this.boss.getIsActive()) {
      targets.push(this.boss);
    }

    // ダッシュ経路（線分）と敵の円の当たり判定
    const dashWidth = 30; // ダッシュの幅（当たり判定用）

    for (const target of targets) {
      if (!target.getIsActive()) continue;

      // 線分と円の距離を計算
      const targetRadius = target.getHitboxRadius();
      const dist = this.pointToLineDistance(target.x, target.y, startX, startY, endX, endY);

      if (dist < targetRadius + dashWidth) {
        // ダメージを与える（防御力考慮）
        const defenseReduction = 100 / (target.getDefense() + 100);
        const finalDamage = Math.max(1, Math.floor(damage * defenseReduction));
        target.takeDamage(finalDamage);
        console.log(`E skill dash hit! Damage: ${finalDamage}`);
      }
    }
  }

  /**
   * 点から線分への最短距離を計算
   */
  private pointToLineDistance(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const lengthSquared = dx * dx + dy * dy;

    if (lengthSquared === 0) {
      // 線分の長さが0の場合
      return Math.sqrt((px - x1) * (px - x1) + (py - y1) * (py - y1));
    }

    // 線分上の最近傍点のパラメータt（0〜1にクランプ）
    const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lengthSquared));

    // 最近傍点の座標
    const nearestX = x1 + t * dx;
    const nearestY = y1 + t * dy;

    // 距離を返す
    return Math.sqrt((px - nearestX) * (px - nearestX) + (py - nearestY) * (py - nearestY));
  }

  /**
   * Rスキルを使用（夢想天生）
   */
  useRSkill(currentTime: number): boolean {
    if (!this.canUseSkill(SkillSlot.R, currentTime)) {
      return false;
    }

    // 既にRスキル発動中なら使用不可
    if (this.isRSkillActive) {
      return false;
    }

    const { DURATION, AREA_SIZE, COOLDOWN } = SKILL_CONFIG.REIMU_R;

    // Rスキル開始
    this.isRSkillActive = true;
    this.rSkillTimeRemaining = DURATION;
    this.rSkillDamageTimer = 0; // 即座に最初のダメージ

    // 無敵状態を設定
    this.isInvincible = true;

    // 範囲表示を作成
    this.rSkillAreaGraphics = this.scene.add.graphics();
    this.rSkillAreaGraphics.lineStyle(3, 0xffff00, 0.8);
    this.rSkillAreaGraphics.fillStyle(0xffff00, 0.2);
    const halfSize = AREA_SIZE / 2;
    this.rSkillAreaGraphics.fillRect(-halfSize, -halfSize, AREA_SIZE, AREA_SIZE);
    this.rSkillAreaGraphics.strokeRect(-halfSize, -halfSize, AREA_SIZE, AREA_SIZE);
    this.rSkillAreaGraphics.setPosition(this.x, this.y);
    this.rSkillAreaGraphics.setDepth(DEPTH.EFFECTS);

    // クールダウン開始
    this.skillCooldowns[SkillSlot.R] = currentTime + COOLDOWN;

    console.log(`R skill activated! Duration: ${DURATION}ms, Area: ${AREA_SIZE}px`);

    return true;
  }

  /**
   * Rスキルの更新処理
   */
  private updateRSkill(delta: number): void {
    const { AREA_SIZE, DAMAGE_INTERVAL, DAMAGE } = SKILL_CONFIG.REIMU_R;
    const halfSize = AREA_SIZE / 2;

    // 範囲表示をプレイヤーに追従
    if (this.rSkillAreaGraphics) {
      this.rSkillAreaGraphics.setPosition(this.x, this.y);
    }

    // ダメージタイマー更新
    this.rSkillDamageTimer -= delta;
    if (this.rSkillDamageTimer <= 0) {
      // スキルダメージ計算
      const rawDamage = DAMAGE.BASE_DAMAGE +
        this.characterConfig.stats.attackPower * DAMAGE.SCALING_RATIO;

      // ターゲット配列を作成（敵 + 雑魚 + ボス）
      const targets: Attackable[] = [...this.enemies, ...this.mobs];
      if (this.boss && this.boss.getIsActive()) {
        targets.push(this.boss);
      }

      for (const target of targets) {
        if (!target.getIsActive()) continue;

        // 長方形範囲内かチェック
        if (Math.abs(target.x - this.x) <= halfSize &&
            Math.abs(target.y - this.y) <= halfSize) {
          // 敵の防御力を考慮したダメージを適用
          const finalDamage = DamageCalculator.calculateDamageReduction(target.getDefense()) * rawDamage;
          target.takeDamage(Math.max(1, Math.floor(finalDamage)));
        }
      }

      this.rSkillDamageTimer = DAMAGE_INTERVAL;
    }

    // 残り時間更新
    this.rSkillTimeRemaining -= delta;
    if (this.rSkillTimeRemaining <= 0) {
      this.endRSkill();
    }
  }

  /**
   * Rスキル終了
   */
  private endRSkill(): void {
    this.isRSkillActive = false;
    this.isInvincible = false;

    // 範囲表示を削除
    if (this.rSkillAreaGraphics) {
      this.rSkillAreaGraphics.destroy();
      this.rSkillAreaGraphics = null;
    }

    console.log('R skill ended!');
  }

  /**
   * Rスキルがアクティブかどうか
   */
  getIsRSkillActive(): boolean {
    return this.isRSkillActive;
  }

  /**
   * Rスキルの範囲を取得
   */
  getRSkillArea(): { x: number; y: number; size: number } | null {
    if (!this.isRSkillActive) return null;
    return {
      x: this.x,
      y: this.y,
      size: SKILL_CONFIG.REIMU_R.AREA_SIZE,
    };
  }

  /**
   * Wスキルのモーション硬直中か確認
   */
  isWSkillInMotion(): boolean {
    return this.wSkillMotionTime > 0;
  }

  /**
   * Wスキルのモーション硬直残り時間を取得
   */
  getWSkillMotionTimeRemaining(): number {
    return this.wSkillMotionTime;
  }

  /**
   * スキルのクールダウン残り時間を取得
   */
  getSkillCooldownRemaining(slot: SkillSlot, currentTime: number): number {
    const cooldownEnd = this.skillCooldowns[slot];
    return Math.max(0, cooldownEnd - currentTime);
  }

  /**
   * 現在のスキル状態を取得
   */
  getSkillState(): SkillState {
    return this.currentSkillState;
  }

  /**
   * スキル実行残り時間を取得
   */
  getSkillExecutionTimeRemaining(): number {
    return this.skillExecutionTimeRemaining;
  }

  /**
   * バフがあるか確認
   */
  hasBuff(source: string): boolean {
    return this.buffs.some(b => b.source === source);
  }

  /**
   * 移動処理
   */
  private updateMovement(_delta: number): void {
    if (!this.targetPosition) {
      // 目標位置がない場合は停止
      this.setVelocity(0, 0);
      // 移動中だった場合は待機アニメーションに戻す
      if (this.isMoving) {
        this.switchToIdleAnimation();
      }
      this.isMoving = false;
      return;
    }

    const dx = this.targetPosition.x - this.x;
    const dy = this.targetPosition.y - this.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // 目標に到達したら停止
    const arrivalThreshold = 5;
    if (distance < arrivalThreshold) {
      this.setVelocity(0, 0);
      this.targetPosition = null;
      // 移動中だった場合は待機アニメーションに戻す
      if (this.isMoving) {
        this.switchToIdleAnimation();
      }
      this.isMoving = false;

      // Attack Move中に到達したらAttack Move終了
      if (this.isAttackMove) {
        this.isAttackMove = false;
        this.attackMoveTarget = null;
      }
      return;
    }

    // 移動速度を計算
    const { moveSpeed } = this.characterConfig.stats;
    const directionX = dx / distance;
    const directionY = dy / distance;

    this.setVelocity(
      directionX * moveSpeed,
      directionY * moveSpeed
    );

    // 移動方向に応じてスプライトを回転・反転
    const angle = Math.atan2(dy, dx); // ラジアン
    const angleDeg = Phaser.Math.RadToDeg(angle);

    // 左向き（90度〜270度）の場合は反転して角度を調整
    if (Math.abs(angleDeg) > 90) {
      this.setFlipX(true);
      // 反転時は角度を反転（上下が逆にならないように）
      this.setRotation(angle + Math.PI);
    } else {
      this.setFlipX(false);
      this.setRotation(angle);
    }

    // 移動開始時に移動アニメーションに切り替え
    if (!this.isMoving) {
      this.switchToMoveAnimation();
    }

    this.isMoving = true;
  }

  /**
   * 待機アニメーションに切り替え
   */
  private switchToIdleAnimation(): void {
    if (this.characterConfig.type === CharacterType.REIMU) {
      this.play('reimu_idle');
      // 回転をリセット
      this.setRotation(0);
      this.setFlipX(false);
    }
  }

  /**
   * 移動アニメーションに切り替え
   */
  private switchToMoveAnimation(): void {
    if (this.characterConfig.type === CharacterType.REIMU) {
      this.play('reimu_move');
    }
  }

  /**
   * 目標位置を設定（右クリック移動）
   */
  setTargetPosition(x: number, y: number): void {
    this.targetPosition = { x, y };
  }

  /**
   * ダメージを受ける
   */
  takeDamage(damage: number): void {
    if (this.isInvincible) {
      return;
    }

    // Eスキルダッシュ中はダメージ軽減
    if (this.isDashing) {
      damage = Math.floor(damage * (1 - SKILL_CONFIG.REIMU_E.DAMAGE_REDUCTION));
    }

    this.currentHp = Math.max(0, this.currentHp - damage);

    // 被弾SE再生
    AudioManager.getInstance().playSe('se_hit_player');

    // 被弾エフェクト
    this.flashDamage();

    // HPが0になったら死亡処理
    if (this.currentHp <= 0) {
      this.onDeath();
    }
  }

  /**
   * HP回復
   */
  heal(amount: number): void {
    this.currentHp = Math.min(
      this.characterConfig.stats.maxHp,
      this.currentHp + amount
    );
  }

  /**
   * 無敵状態を設定
   */
  setInvincible(duration: number): void {
    this.isInvincible = true;

    // 点滅アニメーション
    this.scene.tweens.add({
      targets: this,
      alpha: 0.3,
      duration: 100,
      yoyo: true,
      repeat: Math.floor(duration / 200),
      onComplete: () => {
        this.isInvincible = false;
        this.setAlpha(1);
      },
    });
  }

  /**
   * 被弾エフェクト
   */
  private flashDamage(): void {
    this.setTint(0xff0000);
    this.scene.time.delayedCall(100, () => {
      // 霊夢の場合はTintをクリア、それ以外は緑に戻す
      if (this.characterConfig.type === CharacterType.REIMU) {
        this.clearTint();
      } else {
        this.setTint(COLORS.PLAYER);
      }
    });
  }

  /**
   * 死亡処理
   */
  private onDeath(): void {
    // TODO: 死亡エフェクト
    // TODO: 残機処理
    console.log('Player died!');

    // 仮：復活処理
    this.scene.time.delayedCall(1000, () => {
      this.respawn();
    });
  }

  /**
   * 復活処理
   */
  private respawn(): void {
    this.currentHp = this.characterConfig.stats.maxHp;
    this.setInvincible(2000); // 2秒間無敵

    // TODO: リスポーン位置を設定
  }

  /**
   * Attack Move処理
   * Aキーで設定された地点に移動中、射程内の敵を発見したら攻撃して停止
   */
  private updateAttackMove(time: number): void {
    if (!this.isAttackMove || !this.isMoving) {
      return;
    }

    // 攻撃クールダウン中は処理しない
    if (!this.canAttack(time)) {
      return;
    }

    // 最も近い敵を探す
    const nearestEnemy = this.findNearestEnemy();
    if (!nearestEnemy) {
      return;
    }

    // 射程内かチェック
    const distance = Phaser.Math.Distance.Between(
      this.x,
      this.y,
      nearestEnemy.x,
      nearestEnemy.y
    );

    if (distance <= this.characterConfig.stats.attackRange) {
      // 攻撃して移動を停止
      this.attackTarget(time, nearestEnemy);
      this.stopMovement();
      this.isAttackMove = false;
      this.attackMoveTarget = null;
    }
  }

  /**
   * 最も近い攻撃対象を探す（敵とボス両方を含む）
   */
  findNearestEnemy(): Attackable | null {
    let nearestTarget: Attackable | null = null;
    let nearestDistance = Infinity;

    // 通常の敵をチェック
    for (const enemy of this.enemies) {
      if (!enemy.getIsActive()) {
        continue;
      }

      const distance = Phaser.Math.Distance.Between(
        this.x,
        this.y,
        enemy.x,
        enemy.y
      );

      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestTarget = enemy;
      }
    }

    // 道中雑魚をチェック
    for (const mob of this.mobs) {
      if (!mob.getIsActive()) {
        continue;
      }

      const distance = Phaser.Math.Distance.Between(
        this.x,
        this.y,
        mob.x,
        mob.y
      );

      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestTarget = mob;
      }
    }

    // ボスもチェック
    if (this.boss && this.boss.getIsActive()) {
      const distance = Phaser.Math.Distance.Between(
        this.x,
        this.y,
        this.boss.x,
        this.boss.y
      );

      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestTarget = this.boss;
      }
    }

    return nearestTarget;
  }

  /**
   * 指定位置の最も近い攻撃対象を探す（敵とボス両方を含む）
   */
  findNearestEnemyToPosition(x: number, y: number): Attackable | null {
    let nearestTarget: Attackable | null = null;
    let nearestDistance = Infinity;

    // 通常の敵をチェック
    for (const enemy of this.enemies) {
      if (!enemy.getIsActive()) {
        continue;
      }

      const distance = Phaser.Math.Distance.Between(
        x,
        y,
        enemy.x,
        enemy.y
      );

      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestTarget = enemy;
      }
    }

    // 道中雑魚をチェック
    for (const mob of this.mobs) {
      if (!mob.getIsActive()) {
        continue;
      }

      const distance = Phaser.Math.Distance.Between(
        x,
        y,
        mob.x,
        mob.y
      );

      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestTarget = mob;
      }
    }

    // ボスもチェック
    if (this.boss && this.boss.getIsActive()) {
      const distance = Phaser.Math.Distance.Between(
        x,
        y,
        this.boss.x,
        this.boss.y
      );

      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestTarget = this.boss;
      }
    }

    return nearestTarget;
  }

  /**
   * 通常攻撃可能か判定
   */
  canAttack(currentTime: number): boolean {
    return currentTime - this.lastAttackTime >= this.attackCooldown;
  }

  /**
   * 指定した敵に攻撃（手動攻撃用）
   * LoL風の必中システム：弾が当たった時点でダメージ（打ち消し可能）
   */
  attackTarget(currentTime: number, target: Attackable): void {
    if (!this.canAttack(currentTime)) {
      return;
    }

    // 射程内かチェック
    const distance = Phaser.Math.Distance.Between(
      this.x,
      this.y,
      target.x,
      target.y
    );

    if (distance > this.characterConfig.stats.attackRange) {
      return;
    }

    this.lastAttackTime = currentTime;

    // AAダメージ計算（クリティカル判定込み）
    const stats = this.characterConfig.stats;
    const isCritical = Math.random() < stats.critChance;
    const critMultiplier = isCritical ? 1.5 : 1.0;
    const aaDamage = stats.attackPower * stats.aaMultiplier * critMultiplier;

    // 弾を発射（追尾弾）
    if (this.bulletPool) {
      const bullet = this.bulletPool.acquire();
      if (bullet) {
        bullet.fire(
          this.x,
          this.y,
          target.x,
          target.y,
          BulletType.PLAYER_NORMAL,
          aaDamage,
          target, // 追尾対象を渡す
          isCritical // クリティカルフラグ
        );

        if (isCritical) {
          console.log(`Critical hit! Damage: ${aaDamage.toFixed(1)}`);
        }
      }
    }
  }

  /**
   * 移動を停止
   */
  stopMovement(): void {
    this.setVelocity(0, 0);
    this.targetPosition = null;
    this.isMoving = false;
  }

  /**
   * Attack Moveを設定
   */
  setAttackMove(x: number, y: number): void {
    this.isAttackMove = true;
    this.attackMoveTarget = { x, y };
    this.setTargetPosition(x, y);
  }

  /**
   * 弾プールを設定
   */
  setBulletPool(pool: BulletPool): void {
    this.bulletPool = pool;
  }

  /**
   * 敵リストを設定
   */
  setEnemies(enemies: Enemy[]): void {
    this.enemies = enemies;
  }

  /**
   * 道中雑魚リストを設定
   */
  setMobs(mobs: Attackable[]): void {
    this.mobs = mobs;
  }

  /**
   * ボスを設定
   */
  setBoss(boss: Attackable | null): void {
    this.boss = boss;
  }

  // ゲッター
  getCurrentHp(): number {
    return this.currentHp;
  }

  getMaxHp(): number {
    return this.characterConfig.stats.maxHp;
  }

  getCharacterConfig(): CharacterConfig {
    return this.characterConfig;
  }

  getIsMoving(): boolean {
    return this.isMoving;
  }

  getAttackRange(): number {
    return this.characterConfig.stats.attackRange;
  }

  getIsAttackMove(): boolean {
    return this.isAttackMove;
  }

  getAttackMoveTarget(): Position | null {
    return this.attackMoveTarget;
  }

  /**
   * アクティブなバフ一覧を取得
   */
  getBuffs(): Buff[] {
    return [...this.buffs];
  }

  /**
   * バフ込みの実効攻撃速度を取得
   */
  getEffectiveAttackSpeed(): number {
    let multiplier = 1;
    for (const buff of this.buffs) {
      if (buff.type === BuffType.ATTACK_SPEED) {
        multiplier *= buff.multiplier;
      }
    }
    // 針巫女スタックによる攻撃速度上昇（1スタックあたり+0.1、数値加算）
    const haribabaBonus = this.haribabaStacks * SKILL_CONFIG.REIMU_Q.HARIBABA_STACK.AS_PER_STACK;
    return this.characterConfig.stats.attackSpeed * multiplier + haribabaBonus;
  }

  /**
   * バフ込みの実効移動速度を取得
   */
  getEffectiveMoveSpeed(): number {
    let multiplier = 1;
    for (const buff of this.buffs) {
      if (buff.type === BuffType.MOVE_SPEED) {
        multiplier *= buff.multiplier;
      }
    }
    // 針巫女スタックによる移動速度上昇（5スタック毎に10%）
    const fiveStackSets = Math.floor(this.haribabaStacks / 5);
    const haribabaBonus = 1 + fiveStackSets * SKILL_CONFIG.REIMU_Q.HARIBABA_STACK.MS_PER_5_STACK;
    return this.characterConfig.stats.moveSpeed * multiplier * haribabaBonus;
  }

  /**
   * バフ込みの実効攻撃力を取得
   */
  getEffectiveAttackPower(): number {
    let multiplier = 1;
    for (const buff of this.buffs) {
      if (buff.type === BuffType.DAMAGE || buff.type === BuffType.ATTACK_POWER) {
        multiplier *= buff.multiplier;
      }
    }
    // 針巫女スタックによる攻撃力上昇（1スタックあたり+5）
    const haribabaBonus = this.haribabaStacks * SKILL_CONFIG.REIMU_Q.HARIBABA_STACK.ATK_PER_STACK;
    return this.characterConfig.stats.attackPower * multiplier + haribabaBonus;
  }

  /**
   * 防御力を取得
   */
  getDefense(): number {
    return this.characterConfig.stats.defense;
  }

  /**
   * 戦闘ステータスを取得
   */
  getCombatStats() {
    return this.characterConfig.stats;
  }

  /**
   * スタン状態を設定（引き寄せなど外部からの行動不能）
   * @param stunned スタン状態にするかどうか
   * @param duration スタン持続時間（ms）、0の場合は手動解除まで
   */
  setStunned(stunned: boolean, duration: number = 0): void {
    this.isStunned = stunned;
    if (stunned) {
      // スタン中は移動を停止
      this.targetPosition = null;
      this.isMoving = false;
      this.setVelocity(0, 0);

      // スタン時間を記録
      if (duration > 0) {
        this.stunDuration = duration;
        this.stunEndTime = this.scene.time.now + duration;
      } else {
        this.stunDuration = 0;
        this.stunEndTime = 0;
      }
    } else {
      this.stunDuration = 0;
      this.stunEndTime = 0;
    }
  }

  /**
   * スタン状態かどうか
   */
  getIsStunned(): boolean {
    return this.isStunned;
  }

  /**
   * スタン情報を取得（デバフ表示用）
   * @returns スタン中ならば { remainingTime, totalDuration }、そうでなければ null
   */
  getStunInfo(): { remainingTime: number; totalDuration: number } | null {
    if (!this.isStunned || this.stunDuration <= 0) {
      return null;
    }
    const remaining = Math.max(0, this.stunEndTime - this.scene.time.now);
    return {
      remainingTime: remaining,
      totalDuration: this.stunDuration
    };
  }
}
