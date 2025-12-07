import Phaser from 'phaser';
import { CharacterType, CharacterConfig, Position, BulletType, SkillSlot, SkillState, Buff, BuffType } from '@/types';
import { CHARACTER_DATA } from '@/config/CharacterData';
import { DEPTH, COLORS, SKILL_CONFIG, GAME_CONFIG } from '@/config/GameConfig';
import { BulletPool } from '@/utils/ObjectPool';
import { Enemy } from './Enemy';

/**
 * プレイヤーキャラクタークラス
 */
export class Player extends Phaser.Physics.Arcade.Sprite {
  // キャラクター設定
  private characterConfig: CharacterConfig;

  // 現在の状態
  private currentHp: number = 0;
  private isInvincible: boolean = false;

  // 移動関連
  private targetPosition: Position | null = null;
  private isMoving: boolean = false;

  // 攻撃関連
  private lastAttackTime: number = 0;
  private attackCooldown: number = 0;
  private bulletPool: BulletPool | null = null;
  private enemies: Enemy[] = [];

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
  private skillTarget: Enemy | null = null;
  private skillProjectilesRemaining: number = 0;
  private skillProjectileTimer: number = 0;

  // 現在キャスト中のスキル
  private currentCastingSkill: SkillSlot | null = null;

  // Wスキル用（方向指定・スタックシステム）
  private skillTargetDirection: number = 0; // ラジアン
  private wSkillStacks: number = SKILL_CONFIG.REIMU_W.MAX_STACKS;
  private wSkillNextStackTime: number = 0; // 次のスタック回復時刻

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

  // バフ関連
  private buffs: Buff[] = [];

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    characterType: CharacterType = CharacterType.REIMU
  ) {
    super(scene, x, y, 'player');

    // キャラクター設定を取得
    this.characterConfig = CHARACTER_DATA[characterType];

    // 物理エンジンに追加
    scene.add.existing(this);
    scene.physics.add.existing(this);

    // 初期化
    this.initialize();
  }

  /**
   * 初期化
   */
  private initialize(): void {
    const { stats } = this.characterConfig;

    // HP設定
    this.currentHp = stats.maxHp;

    // 攻撃クールダウン計算（ミリ秒）
    this.attackCooldown = 1000 / stats.attackSpeed;

    // 表示設定
    this.setDepth(DEPTH.PLAYER);
    this.setTint(COLORS.PLAYER);

    // 当たり判定設定
    const body = this.body as Phaser.Physics.Arcade.Body;
    if (body) {
      body.setCircle(stats.hitboxRadius);
      body.setOffset(
        this.width / 2 - stats.hitboxRadius,
        this.height / 2 - stats.hitboxRadius
      );
    }
  }

  /**
   * 更新処理
   */
  update(time: number, delta: number): void {
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
    // Wスキルのスタック回復
    this.updateWSkillStacks(time);

    if (this.currentSkillState === SkillState.CASTING) {
      // キャスト中
      this.skillCastTimeRemaining -= delta;
      if (this.skillCastTimeRemaining <= 0) {
        // キャスト完了 → 実行開始
        if (this.currentCastingSkill === SkillSlot.Q) {
          this.startQSkillExecution(time);
        } else if (this.currentCastingSkill === SkillSlot.W) {
          this.executeWSkill();
        } else if (this.currentCastingSkill === SkillSlot.E) {
          this.executeESkill(time);
        }
      }
    } else if (this.currentSkillState === SkillState.EXECUTING) {
      // スキル実行中（Qスキルの弾発射中）
      this.skillProjectileTimer -= delta;
      if (this.skillProjectileTimer <= 0 && this.skillProjectilesRemaining > 0) {
        this.fireSkillProjectile();
        this.skillProjectilesRemaining--;
        this.skillProjectileTimer = SKILL_CONFIG.REIMU_Q.PROJECTILE_INTERVAL;
      }

      // 全弾発射完了
      if (this.skillProjectilesRemaining <= 0) {
        this.finishSkillExecution();
      }
    }
  }

  /**
   * Wスキルのスタック回復処理
   */
  private updateWSkillStacks(time: number): void {
    if (this.wSkillStacks < SKILL_CONFIG.REIMU_W.MAX_STACKS && time >= this.wSkillNextStackTime) {
      this.wSkillStacks++;
      console.log(`W skill stack recovered: ${this.wSkillStacks}/${SKILL_CONFIG.REIMU_W.MAX_STACKS}`);

      // まだ最大でなければ次のスタック回復タイマーを設定
      if (this.wSkillStacks < SKILL_CONFIG.REIMU_W.MAX_STACKS) {
        this.wSkillNextStackTime = time + SKILL_CONFIG.REIMU_W.COOLDOWN;
      }
    }
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
   * Qスキルを使用開始
   */
  useQSkill(currentTime: number, target: Enemy): boolean {
    if (!this.canUseSkill(SkillSlot.Q, currentTime)) {
      return false;
    }

    // キャスト開始
    this.currentSkillState = SkillState.CASTING;
    this.currentCastingSkill = SkillSlot.Q;
    this.skillCastTimeRemaining = SKILL_CONFIG.REIMU_Q.CAST_TIME;
    this.skillTarget = target;

    // 移動を停止
    this.stopMovement();

    return true;
  }

  /**
   * Wスキルを使用開始
   */
  useWSkill(currentTime: number, targetX: number, targetY: number): boolean {
    // スタックチェック
    if (this.wSkillStacks <= 0) {
      return false;
    }

    // スキル実行中は使用不可
    if (this.isSkillLocked()) {
      return false;
    }

    // スタック消費
    this.wSkillStacks--;
    console.log(`W skill used! Stacks remaining: ${this.wSkillStacks}/${SKILL_CONFIG.REIMU_W.MAX_STACKS}`);

    // スタック回復タイマーを開始（まだ開始していなければ）
    if (this.wSkillStacks === SKILL_CONFIG.REIMU_W.MAX_STACKS - 1) {
      this.wSkillNextStackTime = currentTime + SKILL_CONFIG.REIMU_W.COOLDOWN;
    }

    // 方向を計算
    this.skillTargetDirection = Phaser.Math.Angle.Between(this.x, this.y, targetX, targetY);

    // キャスト開始
    this.currentSkillState = SkillState.CASTING;
    this.currentCastingSkill = SkillSlot.W;
    this.skillCastTimeRemaining = SKILL_CONFIG.REIMU_W.CAST_TIME;

    // 移動を停止
    this.stopMovement();

    return true;
  }

  /**
   * Qスキル実行開始（キャスト完了後）
   */
  private startQSkillExecution(time: number): void {
    this.currentSkillState = SkillState.EXECUTING;
    this.skillProjectilesRemaining = SKILL_CONFIG.REIMU_Q.PROJECTILE_COUNT;
    this.skillProjectileTimer = 0; // 即座に1発目を発射

    // クールダウン開始
    this.skillCooldowns[SkillSlot.Q] = time + SKILL_CONFIG.REIMU_Q.COOLDOWN;
  }

  /**
   * Wスキル実行（キャスト完了後、即座に7way弾発射）
   */
  private executeWSkill(): void {
    if (!this.bulletPool) {
      this.currentSkillState = SkillState.READY;
      this.currentCastingSkill = null;
      return;
    }

    const { PROJECTILE_COUNT, SPREAD_ANGLE, PROJECTILE_RANGE, DAMAGE_MULTIPLIER } = SKILL_CONFIG.REIMU_W;
    const spreadRad = Phaser.Math.DegToRad(SPREAD_ANGLE);
    const angleStep = spreadRad / (PROJECTILE_COUNT - 1);
    const startAngle = this.skillTargetDirection - spreadRad / 2;

    // 7way弾を発射
    for (let i = 0; i < PROJECTILE_COUNT; i++) {
      const angle = startAngle + angleStep * i;
      const targetX = this.x + Math.cos(angle) * PROJECTILE_RANGE;
      const targetY = this.y + Math.sin(angle) * PROJECTILE_RANGE;

      const bullet = this.bulletPool.acquire();
      if (bullet) {
        bullet.fire(
          this.x,
          this.y,
          targetX,
          targetY,
          BulletType.PLAYER_NORMAL,
          this.characterConfig.stats.attackDamage * DAMAGE_MULTIPLIER,
          null // 追尾しない
        );
      }
    }

    console.log(`W skill executed! Fired ${PROJECTILE_COUNT} bullets in ${SPREAD_ANGLE}° spread`);

    // スキル完了
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
   * Eスキル実行（キャスト完了後、ダッシュ開始）
   */
  private executeESkill(time: number): void {
    const { DASH_DISTANCE, DASH_DURATION, COOLDOWN } = SKILL_CONFIG.REIMU_E;

    // ダッシュ先の位置を計算
    const targetX = this.x + Math.cos(this.skillTargetDirection) * DASH_DISTANCE;
    const targetY = this.y + Math.sin(this.skillTargetDirection) * DASH_DISTANCE;

    // プレイエリア内にクランプ
    const { X, Y, WIDTH, HEIGHT } = GAME_CONFIG.PLAY_AREA;
    const clampedX = Phaser.Math.Clamp(targetX, X, X + WIDTH);
    const clampedY = Phaser.Math.Clamp(targetY, Y, Y + HEIGHT);

    // ダッシュ開始（0.5秒かけて移動）
    this.isDashing = true;
    this.dashStartX = this.x;
    this.dashStartY = this.y;
    this.dashTargetX = clampedX;
    this.dashTargetY = clampedY;
    this.dashTotalTime = DASH_DURATION;
    this.dashTimeRemaining = DASH_DURATION;

    // Wスキルのスタックを1回復
    if (this.wSkillStacks < SKILL_CONFIG.REIMU_W.MAX_STACKS) {
      this.wSkillStacks++;
      console.log(`E skill: W stack recovered! ${this.wSkillStacks}/${SKILL_CONFIG.REIMU_W.MAX_STACKS}`);
    }

    // QスキルのCDを完全回復
    this.skillCooldowns[SkillSlot.Q] = 0;
    console.log('E skill: Q cooldown reset!');

    // クールダウン開始
    this.skillCooldowns[SkillSlot.E] = time + COOLDOWN;

    console.log(`E skill executed! Dashing ${DASH_DISTANCE}px over ${DASH_DURATION}ms`);

    // スキル完了（硬直なし、ダッシュ中も行動可能）
    this.currentSkillState = SkillState.READY;
    this.currentCastingSkill = null;
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
    const { AREA_SIZE, DAMAGE_INTERVAL, DAMAGE_MULTIPLIER } = SKILL_CONFIG.REIMU_R;
    const halfSize = AREA_SIZE / 2;

    // 範囲表示をプレイヤーに追従
    if (this.rSkillAreaGraphics) {
      this.rSkillAreaGraphics.setPosition(this.x, this.y);
    }

    // ダメージタイマー更新
    this.rSkillDamageTimer -= delta;
    if (this.rSkillDamageTimer <= 0) {
      // 範囲内の敵にダメージ
      const damage = this.characterConfig.stats.attackDamage * DAMAGE_MULTIPLIER;
      for (const enemy of this.enemies) {
        if (!enemy.getIsActive()) continue;

        // 長方形範囲内かチェック
        if (Math.abs(enemy.x - this.x) <= halfSize &&
            Math.abs(enemy.y - this.y) <= halfSize) {
          enemy.takeDamage(damage);
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
   * スキル弾を発射
   */
  private fireSkillProjectile(): void {
    if (!this.bulletPool || !this.skillTarget) {
      return;
    }

    // ターゲットが死んでいる場合は発射しない
    if (!this.skillTarget.getIsActive()) {
      return;
    }

    const bullet = this.bulletPool.acquire();
    if (bullet) {
      bullet.fire(
        this.x,
        this.y,
        this.skillTarget.x,
        this.skillTarget.y,
        BulletType.PLAYER_NORMAL,
        this.characterConfig.stats.attackDamage * SKILL_CONFIG.REIMU_Q.DAMAGE_MULTIPLIER,
        this.skillTarget // 追尾弾
      );
    }
  }

  /**
   * Qスキル実行完了
   */
  private finishSkillExecution(): void {
    this.currentSkillState = SkillState.READY;
    this.currentCastingSkill = null;
    this.skillTarget = null;

    // 攻撃速度バフを付与
    this.addBuff(
      BuffType.ATTACK_SPEED,
      SKILL_CONFIG.REIMU_Q.ATTACK_SPEED_BUFF,
      SKILL_CONFIG.REIMU_Q.BUFF_DURATION,
      'reimu_q'
    );

    // デバッグログ
    const baseAS = this.characterConfig.stats.attackSpeed;
    const buffedAS = baseAS * SKILL_CONFIG.REIMU_Q.ATTACK_SPEED_BUFF;
    console.log(`Q skill finished! AS buff applied: ${baseAS} → ${buffedAS} (${SKILL_CONFIG.REIMU_Q.BUFF_DURATION / 1000}s)`);
  }

  /**
   * Wスキルのスタック数を取得
   */
  getWSkillStacks(): number {
    return this.wSkillStacks;
  }

  /**
   * Wスキルの次のスタック回復までの時間を取得
   */
  getWSkillNextStackTime(currentTime: number): number {
    if (this.wSkillStacks >= SKILL_CONFIG.REIMU_W.MAX_STACKS) {
      return 0;
    }
    return Math.max(0, this.wSkillNextStackTime - currentTime);
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

    this.isMoving = true;
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

    this.currentHp = Math.max(0, this.currentHp - damage);

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
      this.setTint(COLORS.PLAYER);
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
   * 最も近い敵を探す
   */
  findNearestEnemy(): Enemy | null {
    let nearestEnemy: Enemy | null = null;
    let nearestDistance = Infinity;

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
        nearestEnemy = enemy;
      }
    }

    return nearestEnemy;
  }

  /**
   * 指定位置の最も近い敵を探す
   */
  findNearestEnemyToPosition(x: number, y: number): Enemy | null {
    let nearestEnemy: Enemy | null = null;
    let nearestDistance = Infinity;

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
        nearestEnemy = enemy;
      }
    }

    return nearestEnemy;
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
  attackTarget(currentTime: number, target: Enemy): void {
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
          this.characterConfig.stats.attackDamage,
          target // 追尾対象を渡す
        );
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
    return this.characterConfig.stats.attackSpeed * multiplier;
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
    return this.characterConfig.stats.moveSpeed * multiplier;
  }

  /**
   * バフ込みの実効攻撃力を取得
   */
  getEffectiveAttackDamage(): number {
    let multiplier = 1;
    for (const buff of this.buffs) {
      if (buff.type === BuffType.DAMAGE) {
        multiplier *= buff.multiplier;
      }
    }
    return this.characterConfig.stats.attackDamage * multiplier;
  }
}
