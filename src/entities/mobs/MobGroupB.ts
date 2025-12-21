import Phaser from 'phaser';
import { MobGroupType, BulletType } from '@/types';
import { MobEnemy } from './MobEnemy';
import { KSHOT } from '../Bullet';
import { UNIT, DEPTH } from '@/config/GameConfig';

/**
 * 弾幕パターンタイプ
 */
export type MobBPatternType = 'B1' | 'B2' | 'B3' | 'B4';

/**
 * グループB雑魚
 * HP500, DEF0, ATK100
 * 生存時間無制限（撃破まで残る）
 * 4秒ごとに攻撃
 *
 * B-1: オーブオブディセプション風の自機狙い弾（1発のみ、行って戻る）
 * B-2: 予告線→レーザー（半径1mのID:3弾丸を重ねて描写）
 * B-3: ラプチャー（円形花弾幕）＋スクリーム（扇形予告ダメージ）
 * B-4: 固定射撃（2.2秒間、0.22s毎に弾発射）＋ムービング（4m移動）＋恐怖弾（円形ダメージ）
 */
// パターン別テクスチャ設定
const PATTERN_TEXTURES: Record<MobBPatternType, { texture: string; animation: string }> = {
  'B1': { texture: 'fairy_b1', animation: 'fairy_b1_idle' },
  'B2': { texture: 'fairy_b2', animation: 'fairy_b2_idle' },
  'B3': { texture: 'fairy_b3', animation: 'fairy_b3_idle' },
  'B4': { texture: 'fairy_b4', animation: 'fairy_b4_idle' },
};

export class MobGroupB extends MobEnemy {
  private patternType: MobBPatternType = 'B1';
  private attackInterval: number = 4000;  // 4秒ごとに攻撃
  private lastAttackTime: number = 0;
  private autoShootEnabled: boolean = true;  // 自動発射の有効/無効

  // B-1用: オーブ弾（行って戻る）
  private orbBullet: Phaser.Physics.Arcade.Sprite | null = null;
  private orbPhase: 'outgoing' | 'returning' | 'none' = 'none';
  private orbStartPos: { x: number; y: number } = { x: 0, y: 0 };
  private orbTargetPos: { x: number; y: number } = { x: 0, y: 0 };
  private orbReturnSpeed: number = 0;

  // B-2用: レーザー
  private laserWarningLine: Phaser.GameObjects.Graphics | null = null;
  private laserBullets: Phaser.Physics.Arcade.Sprite[] = [];
  private laserAngle: number = 0;
  private isLaserCharging: boolean = false;
  private laserChargeStartTime: number = 0;
  private readonly LASER_CHARGE_TIME = 1000;  // 予告線1秒
  private readonly LASER_LENGTH = 15 * UNIT.METER_TO_PIXEL;  // 15m

  // B-3用: ラプチャー（花開き弾幕）とスクリーム（扇形予告ダメージ）
  private b3AttackType: 'rapture' | 'scream' = 'rapture';  // 交互に使用
  // ラプチャー用
  private raptureWarningCircle: Phaser.GameObjects.Graphics | null = null;
  private raptureTargetPos: { x: number; y: number } = { x: 0, y: 0 };
  private raptureBullets: Phaser.Physics.Arcade.Sprite[] = [];
  private rapturePhase: 'none' | 'warning' | 'opening' | 'closing' = 'none';
  private rapturePhaseStartTime: number = 0;
  private readonly RAPTURE_RADIUS = 2.73 * UNIT.METER_TO_PIXEL;  // 半径2.73m
  private readonly RAPTURE_WARNING_TIME = 600;  // 0.6秒予告
  private readonly RAPTURE_OPEN_TIME = 250;     // 開く0.25秒
  private readonly RAPTURE_CLOSE_TIME = 500;    // 閉じる0.5秒
  // スクリーム用
  private screamWarningArc: Phaser.GameObjects.Graphics | null = null;
  private screamTargetAngle: number = 0;
  private isScreamCharging: boolean = false;
  private screamChargeStartTime: number = 0;
  private readonly SCREAM_RADIUS = 8.2 * UNIT.METER_TO_PIXEL;  // 半径8.2m
  private readonly SCREAM_ANGLE = Phaser.Math.DegToRad(60);   // 60度
  private readonly SCREAM_WARNING_TIME = 500;  // 0.5秒予告

  // B-4用: 固定射撃、ムービング、恐怖弾
  private b4AttackType: 'fixed_shot' | 'moving' | 'fear' = 'fixed_shot';  // ローテーション
  private b4AttackCount: number = 0;  // 攻撃回数（3つをローテーション）
  // 固定射撃用
  private isFixedShotActive: boolean = false;
  private fixedShotStartTime: number = 0;
  private fixedShotLastFireTime: number = 0;
  private fixedShotAngle: number = 0;  // 発射角度（固定）
  private readonly FIXED_SHOT_DURATION = 2200;     // 2.2秒間
  private readonly FIXED_SHOT_INTERVAL = 220;      // 0.22秒毎
  private readonly FIXED_SHOT_SPEED = 20 * UNIT.METER_TO_PIXEL;  // 20m/s
  private readonly FIXED_SHOT_RADIUS = 0.5 * UNIT.METER_TO_PIXEL;  // 半径0.5m
  // ムービング用
  private isMoving: boolean = false;
  private moveStartPos: { x: number; y: number } = { x: 0, y: 0 };
  private moveTargetPos: { x: number; y: number } = { x: 0, y: 0 };
  private moveStartTime: number = 0;
  private readonly MOVE_DISTANCE = 4 * UNIT.METER_TO_PIXEL;  // 4m
  private readonly MOVE_SPEED = 10 * UNIT.METER_TO_PIXEL;    // 10m/s
  // 恐怖弾用
  private fearWarningCircle: Phaser.GameObjects.Graphics | null = null;
  private isFearCharging: boolean = false;
  private fearChargeStartTime: number = 0;
  private readonly FEAR_RADIUS = 4.5 * UNIT.METER_TO_PIXEL;  // 半径4.5m
  private readonly FEAR_WARNING_TIME = 660;  // 0.66秒予告

  constructor(scene: Phaser.Scene, x: number, y: number) {
    // 初期パターンを決定
    const initialPattern = MobGroupB.getRandomPatternStatic();
    const config = PATTERN_TEXTURES[initialPattern];
    super(scene, x, y, MobGroupType.GROUP_B, config.texture);
    this.patternType = initialPattern;
    this.animationKey = config.animation;
    this.displayScale = 0.05;  // 1584x1344を約70pxに
  }

  /**
   * ランダムなパターンを取得（静的）
   */
  private static getRandomPatternStatic(): MobBPatternType {
    const patterns: MobBPatternType[] = ['B1', 'B2'];
    return patterns[Math.floor(Math.random() * patterns.length)];
  }

  /**
   * ランダムなパターンを取得
   */
  private getRandomPattern(): MobBPatternType {
    return MobGroupB.getRandomPatternStatic();
  }

  /**
   * スポーン時にパターンをリセット
   */
  spawn(
    x: number,
    y: number,
    targetY?: number,
    movePattern: 'straight' | 'wave' | 'zigzag' | 'stay' = 'straight'
  ): void {
    // パターンを変更してテクスチャとアニメーションを更新
    this.patternType = this.getRandomPattern();
    const config = PATTERN_TEXTURES[this.patternType];
    this.setTexture(config.texture);
    this.animationKey = config.animation;

    super.spawn(x, y, targetY, movePattern);
    this.resetAttackState();
  }

  /**
   * 特定パターンを指定してスポーン
   */
  spawnWithPattern(
    x: number,
    y: number,
    pattern: MobBPatternType,
    targetY?: number,
    movePattern: 'straight' | 'wave' | 'zigzag' | 'stay' = 'straight'
  ): void {
    // 指定されたパターンを設定
    this.patternType = pattern;
    const config = PATTERN_TEXTURES[pattern];
    this.setTexture(config.texture);
    this.animationKey = config.animation;

    super.spawn(x, y, targetY, movePattern);
    this.resetAttackState();
  }

  /**
   * パターンタイプを取得
   */
  getPatternType(): MobBPatternType {
    return this.patternType;
  }

  /**
   * 通過型スポーン（パターン指定可能）
   */
  spawnPassThroughWithPattern(
    x: number,
    y: number,
    pattern: MobBPatternType,
    velocityX: number,
    velocityY: number,
    duration: number
  ): void {
    // パターンを設定
    this.patternType = pattern;
    const config = PATTERN_TEXTURES[pattern];
    this.setTexture(config.texture);
    this.animationKey = config.animation;

    // 通過型スポーン
    this.spawnPassThrough(x, y, velocityX, velocityY, duration);
    this.resetAttackState();
  }

  /**
   * プレイヤー追尾型スポーン（パターン指定可能）
   */
  spawnChasePlayerWithPattern(
    x: number,
    y: number,
    pattern: MobBPatternType,
    speed: number
  ): void {
    // パターンを設定
    this.patternType = pattern;
    const config = PATTERN_TEXTURES[pattern];
    this.setTexture(config.texture);
    this.animationKey = config.animation;

    // プレイヤー追尾型スポーン
    this.spawnChasePlayer(x, y, speed);
    this.resetAttackState();
  }

  /**
   * ランダム移動型スポーン（パターン指定可能）
   */
  spawnRandomWalkWithPattern(
    x: number,
    y: number,
    pattern: MobBPatternType,
    speed: number,
    changeInterval: number = 2000
  ): void {
    // パターンを設定
    this.patternType = pattern;
    const config = PATTERN_TEXTURES[pattern];
    this.setTexture(config.texture);
    this.animationKey = config.animation;

    // ランダム移動型スポーン
    this.spawnRandomWalk(x, y, speed, changeInterval);
    this.resetAttackState();
  }

  /**
   * 下降→追尾移動パターンでスポーン（パターン指定付き）
   * 画面上部から下降し、目標Y座標到達後に追尾移動を開始
   */
  spawnDescendThenChaseWithPattern(
    x: number,
    y: number,
    pattern: MobBPatternType,
    targetY: number,
    descendSpeed: number,
    chaseSpeed: number
  ): void {
    // パターンを設定
    this.patternType = pattern;
    const config = PATTERN_TEXTURES[pattern];
    this.setTexture(config.texture);
    this.animationKey = config.animation;

    // 下降→追尾型スポーン
    this.spawnDescendThenChase(x, y, targetY, descendSpeed, chaseSpeed);
    this.resetAttackState();
  }

  /**
   * 下降→ランダム移動パターンでスポーン（パターン指定付き）
   * 画面上部から下降し、目標Y座標到達後にランダム移動を開始
   */
  spawnDescendThenRandomWalkWithPattern(
    x: number,
    y: number,
    pattern: MobBPatternType,
    targetY: number,
    descendSpeed: number,
    walkSpeed: number,
    changeInterval: number = 2000
  ): void {
    // パターンを設定
    this.patternType = pattern;
    const config = PATTERN_TEXTURES[pattern];
    this.setTexture(config.texture);
    this.animationKey = config.animation;

    // 下降→ランダム移動型スポーン
    this.spawnDescendThenRandomWalk(x, y, targetY, descendSpeed, walkSpeed, changeInterval);
    this.resetAttackState();
  }

  /**
   * 自動発射を有効/無効にする
   */
  setAutoShoot(enabled: boolean): void {
    this.autoShootEnabled = enabled;
  }

  /**
   * 外部から弾幕を発射させる（Wave制御用）
   */
  shoot(): void {
    if (!this.bulletPool || !this.playerPosition || !this.isActive) {
      return;
    }

    // 既に攻撃中なら無視
    if (this.isAttacking()) {
      return;
    }

    // パターンに応じた攻撃
    switch (this.patternType) {
      case 'B1':
        this.startOrbAttack();
        break;
      case 'B2':
        this.startLaserCharge(this.scene.time.now);
        break;
      case 'B3':
        this.startB3Attack(this.scene.time.now);
        break;
      case 'B4':
        this.startB4Attack(this.scene.time.now);
        break;
    }
  }

  /**
   * 弾幕発射処理
   * 4秒ごとに攻撃（自動発射が有効な場合のみ）
   */
  protected updateShooting(time: number): void {
    if (!this.bulletPool || !this.playerPosition) {
      return;
    }

    // オーブの更新（B-1）- 自動発射無効でも継続中の弾は更新
    if (this.orbPhase !== 'none') {
      this.updateOrb(time);
    }

    // レーザーチャージ中の処理（B-2）- 自動発射無効でも継続中は更新
    if (this.isLaserCharging) {
      this.updateLaserCharge(time);
    }

    // B-3: ラプチャー・スクリームの更新
    if (this.rapturePhase !== 'none') {
      this.updateRapture(time);
    }
    if (this.isScreamCharging) {
      this.updateScream(time);
    }

    // B-4: 固定射撃・ムービング・恐怖弾の更新
    if (this.isFixedShotActive) {
      this.updateFixedShot(time);
    }
    if (this.isMoving) {
      this.updateMoving(time);
    }
    if (this.isFearCharging) {
      this.updateFear(time);
    }

    // 自動発射が無効なら新規攻撃はしない
    if (!this.autoShootEnabled) {
      return;
    }

    // 攻撃間隔チェック
    if (time - this.lastAttackTime < this.attackInterval) {
      return;
    }

    // 既に攻撃中なら待機
    if (this.isAttacking()) {
      return;
    }

    this.lastAttackTime = time;

    // パターンに応じた攻撃
    switch (this.patternType) {
      case 'B1':
        this.startOrbAttack();
        break;
      case 'B2':
        this.startLaserCharge(time);
        break;
      case 'B3':
        this.startB3Attack(time);
        break;
      case 'B4':
        this.startB4Attack(time);
        break;
    }
  }

  /**
   * B-1: オーブオブディセプション風攻撃開始
   * 自機狙い1発、行って戻る
   */
  private startOrbAttack(): void {
    if (!this.bulletPool || !this.playerPosition) return;

    const range = 9 * UNIT.METER_TO_PIXEL;  // 射程9m
    const bulletRadius = 0.8 * UNIT.METER_TO_PIXEL;  // 半径0.8m（ルーミアと同じ）
    const displayScale = (bulletRadius * 2) / 512;  // 大玉は512px
    const speedOutgoing = 15 * UNIT.METER_TO_PIXEL;  // 行き弾速15m/s

    // プレイヤー方向の角度
    const angle = Phaser.Math.Angle.Between(
      this.x, this.y,
      this.playerPosition.x, this.playerPosition.y
    );

    // ターゲット位置
    this.orbStartPos = { x: this.x, y: this.y };
    this.orbTargetPos = {
      x: this.x + Math.cos(angle) * range,
      y: this.y + Math.sin(angle) * range
    };

    const bullet = this.bulletPool.acquire();
    if (!bullet) return;

    bullet.fire(
      this.x, this.y,
      this.orbTargetPos.x, this.orbTargetPos.y,
      BulletType.ENEMY_NORMAL,
      this.stats.attackPower,
      null, false,
      KSHOT.LARGE_BALL.CYAN  // ID:21（シアン）
    );
    bullet.setScale(displayScale);
    bullet.setPersistOutsidePlayArea(true);  // 戻り弾用

    // 当たり判定を設定
    const body = bullet.body as Phaser.Physics.Arcade.Body;
    if (body) {
      body.setCircle(bulletRadius / displayScale, 0, 0);
      body.setVelocity(
        Math.cos(angle) * speedOutgoing,
        Math.sin(angle) * speedOutgoing
      );
    }

    this.orbBullet = bullet;
    this.orbPhase = 'outgoing';
    this.orbReturnSpeed = 0.6 * UNIT.METER_TO_PIXEL;  // 帰り初速0.6m/s
  }

  /**
   * オーブの更新
   */
  private updateOrb(_time: number): void {
    if (!this.orbBullet || !this.orbBullet.active) {
      this.orbPhase = 'none';
      this.orbBullet = null;
      return;
    }

    const range = 9 * UNIT.METER_TO_PIXEL;
    const returnAccel = 19 * UNIT.METER_TO_PIXEL;  // 帰り加速度19m/s²
    const returnMax = 26 * UNIT.METER_TO_PIXEL;    // 帰り最大速度26m/s
    const delta = this.scene.game.loop.delta / 1000;  // 秒単位

    const body = this.orbBullet.body as Phaser.Physics.Arcade.Body;
    if (!body) return;

    if (this.orbPhase === 'outgoing') {
      // 行きフェーズ: 最大射程に到達したか確認
      const dx = this.orbBullet.x - this.orbStartPos.x;
      const dy = this.orbBullet.y - this.orbStartPos.y;
      const distanceTraveled = Math.sqrt(dx * dx + dy * dy);

      if (distanceTraveled >= range) {
        // 帰りフェーズへ
        this.orbPhase = 'returning';
        this.orbReturnSpeed = 0.6 * UNIT.METER_TO_PIXEL;
      }
    }

    if (this.orbPhase === 'returning') {
      // 帰りフェーズ: 発射位置に向かって加速
      const dx = this.orbStartPos.x - this.orbBullet.x;
      const dy = this.orbStartPos.y - this.orbBullet.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < 20) {
        // 発射位置に到達 → 弾を消す
        this.orbBullet.destroy();
        this.orbBullet = null;
        this.orbPhase = 'none';
        return;
      }

      // 加速
      this.orbReturnSpeed = Math.min(this.orbReturnSpeed + returnAccel * delta, returnMax);

      // 発射位置への方向
      const angle = Math.atan2(dy, dx);
      body.setVelocity(
        Math.cos(angle) * this.orbReturnSpeed,
        Math.sin(angle) * this.orbReturnSpeed
      );
    }
  }

  /**
   * B-2: レーザーチャージ開始
   */
  private startLaserCharge(time: number): void {
    if (!this.playerPosition) return;

    this.isLaserCharging = true;
    this.laserChargeStartTime = time;

    // プレイヤー方向の角度
    this.laserAngle = Phaser.Math.Angle.Between(
      this.x, this.y,
      this.playerPosition.x, this.playerPosition.y
    );

    // 予告線を作成
    this.laserWarningLine = this.scene.add.graphics();
    this.laserWarningLine.setDepth(DEPTH.BULLETS_ENEMY - 1);
    this.updateWarningLine();
  }

  /**
   * 予告線を更新
   */
  private updateWarningLine(): void {
    if (!this.laserWarningLine) return;

    this.laserWarningLine.clear();
    this.laserWarningLine.lineStyle(4, 0xff0000, 0.5);

    const endX = this.x + Math.cos(this.laserAngle) * this.LASER_LENGTH;
    const endY = this.y + Math.sin(this.laserAngle) * this.LASER_LENGTH;

    this.laserWarningLine.beginPath();
    this.laserWarningLine.moveTo(this.x, this.y);
    this.laserWarningLine.lineTo(endX, endY);
    this.laserWarningLine.strokePath();
  }

  /**
   * レーザーチャージの更新
   */
  private updateLaserCharge(time: number): void {
    // 予告線を更新（自分の位置に合わせる）
    this.updateWarningLine();

    // チャージ完了チェック
    if (time - this.laserChargeStartTime >= this.LASER_CHARGE_TIME) {
      this.fireLaser();
      this.isLaserCharging = false;
    }
  }

  /**
   * レーザー発射
   */
  private fireLaser(): void {
    if (!this.bulletPool) return;

    // 予告線を消す
    if (this.laserWarningLine) {
      this.laserWarningLine.destroy();
      this.laserWarningLine = null;
    }

    const bulletRadius = 1 * UNIT.METER_TO_PIXEL;  // 半径1m
    const displayScale = (bulletRadius * 2) / 512;  // 中玉は512px
    const bulletSpacing = bulletRadius;  // 弾の半径分の間隔（重なって密に見える）
    const bulletCount = Math.ceil(this.LASER_LENGTH / bulletSpacing);
    const bulletSpeed = 20 * UNIT.METER_TO_PIXEL;  // 20m/s

    // レーザーを構成する弾を発射
    for (let i = 0; i < bulletCount; i++) {
      const bullet = this.bulletPool.acquire();
      if (!bullet) continue;

      // 少しずらした位置から発射（レーザー効果）
      const offset = i * bulletSpacing;
      const startX = this.x + Math.cos(this.laserAngle) * offset;
      const startY = this.y + Math.sin(this.laserAngle) * offset;
      const targetX = startX + Math.cos(this.laserAngle) * 500;
      const targetY = startY + Math.sin(this.laserAngle) * 500;

      bullet.fire(
        startX, startY,
        targetX, targetY,
        BulletType.ENEMY_NORMAL,
        this.stats.attackPower * 2,  // レーザーは高ダメージ
        null, false,
        KSHOT.MEDIUM_BALL.YELLOW  // ID:3（黄色）
      );
      bullet.setScale(displayScale);

      // 当たり判定を設定
      const body = bullet.body as Phaser.Physics.Arcade.Body;
      if (body) {
        body.setCircle(bulletRadius / displayScale, 0, 0);
        body.setVelocity(
          Math.cos(this.laserAngle) * bulletSpeed,
          Math.sin(this.laserAngle) * bulletSpeed
        );
      }

      this.laserBullets.push(bullet);
    }
  }

  /**
   * レーザー関連のクリーンアップ
   */
  private cleanupLaser(): void {
    if (this.laserWarningLine) {
      this.laserWarningLine.destroy();
      this.laserWarningLine = null;
    }
    this.laserBullets = [];
  }

  /**
   * B-3関連のクリーンアップ
   */
  private cleanupB3(): void {
    // ラプチャー
    if (this.raptureWarningCircle) {
      this.raptureWarningCircle.destroy();
      this.raptureWarningCircle = null;
    }
    this.raptureBullets = [];
    this.rapturePhase = 'none';

    // スクリーム
    if (this.screamWarningArc) {
      this.screamWarningArc.destroy();
      this.screamWarningArc = null;
    }
    this.isScreamCharging = false;
  }

  /**
   * B-4関連のクリーンアップ
   */
  private cleanupB4(): void {
    this.isFixedShotActive = false;
    this.isMoving = false;
    this.isFearCharging = false;
    if (this.fearWarningCircle) {
      this.fearWarningCircle.destroy();
      this.fearWarningCircle = null;
    }
  }

  /**
   * 攻撃状態リセット（スポーン時に呼ばれる）
   */
  private resetAttackState(): void {
    this.lastAttackTime = this.scene.time.now;
    this.orbPhase = 'none';
    this.orbBullet = null;
    this.isLaserCharging = false;
    this.cleanupLaser();
    this.cleanupB3();
    this.cleanupB4();
    this.b3AttackType = 'rapture';  // 最初はラプチャーから
    this.b4AttackType = 'fixed_shot';  // 最初は固定射撃から
    this.b4AttackCount = 0;
  }

  /**
   * 攻撃中かどうかを判定
   */
  private isAttacking(): boolean {
    // 注意: isFixedShotActiveは含めない（固定射撃中も移動可能）
    return (
      this.orbPhase !== 'none' ||
      this.isLaserCharging ||
      this.rapturePhase !== 'none' ||
      this.isScreamCharging ||
      this.isMoving ||
      this.isFearCharging
    );
  }

  // =============================================
  // B-3: ラプチャー（花開き弾幕）とスクリーム（扇形予告ダメージ）
  // =============================================

  /**
   * B-3攻撃開始（ラプチャーとスクリームを交互に使用）
   */
  private startB3Attack(time: number): void {
    if (!this.playerPosition) return;

    if (this.b3AttackType === 'rapture') {
      this.startRapture(time);
      this.b3AttackType = 'scream';  // 次はスクリーム
    } else {
      this.startScream(time);
      this.b3AttackType = 'rapture';  // 次はラプチャー
    }
  }

  /**
   * ラプチャー開始: 円形予告 → 花開き弾幕
   */
  private startRapture(time: number): void {
    if (!this.playerPosition) return;

    // プレイヤーの現在位置を記録
    this.raptureTargetPos = {
      x: this.playerPosition.x,
      y: this.playerPosition.y
    };
    this.rapturePhase = 'warning';
    this.rapturePhaseStartTime = time;

    // 予告円を作成
    this.raptureWarningCircle = this.scene.add.graphics();
    this.raptureWarningCircle.setDepth(DEPTH.BULLETS_ENEMY - 1);
    this.updateRaptureWarning();
  }

  /**
   * 予告円を更新（アニメーション用）
   */
  private updateRaptureWarning(): void {
    if (!this.raptureWarningCircle) return;

    this.raptureWarningCircle.clear();
    // 赤い円（塗り）
    this.raptureWarningCircle.fillStyle(0xff0000, 0.2);
    this.raptureWarningCircle.fillCircle(
      this.raptureTargetPos.x,
      this.raptureTargetPos.y,
      this.RAPTURE_RADIUS
    );
    // 赤い縁
    this.raptureWarningCircle.lineStyle(3, 0xff0000, 0.6);
    this.raptureWarningCircle.strokeCircle(
      this.raptureTargetPos.x,
      this.raptureTargetPos.y,
      this.RAPTURE_RADIUS
    );
  }

  /**
   * ラプチャーの更新
   */
  private updateRapture(time: number): void {
    const elapsed = time - this.rapturePhaseStartTime;

    switch (this.rapturePhase) {
      case 'warning':
        // 予告表示を点滅させる
        if (this.raptureWarningCircle) {
          const alpha = 0.2 + 0.2 * Math.sin(elapsed * 0.01);
          this.raptureWarningCircle.clear();
          this.raptureWarningCircle.fillStyle(0xff0000, alpha);
          this.raptureWarningCircle.fillCircle(
            this.raptureTargetPos.x,
            this.raptureTargetPos.y,
            this.RAPTURE_RADIUS
          );
          this.raptureWarningCircle.lineStyle(3, 0xff0000, 0.6 + 0.3 * Math.sin(elapsed * 0.01));
          this.raptureWarningCircle.strokeCircle(
            this.raptureTargetPos.x,
            this.raptureTargetPos.y,
            this.RAPTURE_RADIUS
          );
        }

        // 予告時間経過 → 花開きフェーズへ
        if (elapsed >= this.RAPTURE_WARNING_TIME) {
          this.fireRaptureBullets();
          this.rapturePhase = 'opening';
          this.rapturePhaseStartTime = time;
          // 予告円を消す
          if (this.raptureWarningCircle) {
            this.raptureWarningCircle.destroy();
            this.raptureWarningCircle = null;
          }
        }
        break;

      case 'opening':
        // 花開き: 中心から外側へ弾が広がる（0.25秒）
        this.updateRaptureOpening(elapsed);
        if (elapsed >= this.RAPTURE_OPEN_TIME) {
          this.rapturePhase = 'closing';
          this.rapturePhaseStartTime = time;
        }
        break;

      case 'closing':
        // 花閉じ: 外側から中心へ弾が戻る（0.5秒）
        this.updateRaptureClosing(elapsed);
        if (elapsed >= this.RAPTURE_CLOSE_TIME) {
          // 完了: 弾を消す
          this.destroyRaptureBullets();
          this.rapturePhase = 'none';
        }
        break;
    }
  }

  /**
   * ラプチャー弾幕発射: 円周上に弾を配置
   */
  private fireRaptureBullets(): void {
    if (!this.bulletPool) return;

    const bulletCount = 16;  // 円周上に16発
    const bulletRadius = 0.3 * UNIT.METER_TO_PIXEL;  // 弾の半径0.3m
    const displayScale = (bulletRadius * 2) / 278;  // 輪弾(278px)のスケール

    for (let i = 0; i < bulletCount; i++) {
      const bullet = this.bulletPool.acquire();
      if (!bullet) continue;

      const angle = (i / bulletCount) * Math.PI * 2;
      // 中心位置から開始
      const startX = this.raptureTargetPos.x;
      const startY = this.raptureTargetPos.y;

      bullet.fire(
        startX, startY,
        startX, startY,  // 初期位置は中心
        BulletType.ENEMY_NORMAL,
        this.stats.attackPower,
        null, false,
        KSHOT.RINDAN.MAGENTA  // マゼンタ（ID:16）
      );
      bullet.setScale(displayScale);

      // 当たり判定設定
      const body = bullet.body as Phaser.Physics.Arcade.Body;
      if (body) {
        body.setCircle(bulletRadius / displayScale, 0, 0);
        body.setVelocity(0, 0);  // 初期は静止
      }

      // 角度情報を保存（開閉アニメーション用）
      (bullet as unknown as { raptureAngle: number }).raptureAngle = angle;
      this.raptureBullets.push(bullet);
    }
  }

  /**
   * 花開きアニメーション（螺旋回転付き）
   */
  private updateRaptureOpening(elapsed: number): void {
    const progress = Math.min(elapsed / this.RAPTURE_OPEN_TIME, 1);
    // イージング: 加速→減速
    const eased = 1 - Math.pow(1 - progress, 2);
    const currentRadius = eased * this.RAPTURE_RADIUS;
    // 螺旋回転: 開くときに半回転（180度）
    const spiralRotation = eased * Math.PI;

    for (const bullet of this.raptureBullets) {
      if (!bullet.active) continue;
      const baseAngle = (bullet as unknown as { raptureAngle: number }).raptureAngle;
      const finalAngle = baseAngle + spiralRotation;
      bullet.x = this.raptureTargetPos.x + Math.cos(finalAngle) * currentRadius;
      bullet.y = this.raptureTargetPos.y + Math.sin(finalAngle) * currentRadius;
    }
  }

  /**
   * 花閉じアニメーション（螺旋回転付き）
   */
  private updateRaptureClosing(elapsed: number): void {
    const progress = Math.min(elapsed / this.RAPTURE_CLOSE_TIME, 1);
    // イージング: 減速→加速
    const eased = 1 - Math.pow(progress, 2);
    const currentRadius = eased * this.RAPTURE_RADIUS;
    // 螺旋回転: 閉じるときにさらに1回転（合計540度）
    // 開き終わりの位置（+PI）から始まり、閉じ終わりで +3PI に
    const spiralRotation = Math.PI + (1 - eased) * Math.PI * 2;

    for (const bullet of this.raptureBullets) {
      if (!bullet.active) continue;
      const baseAngle = (bullet as unknown as { raptureAngle: number }).raptureAngle;
      const finalAngle = baseAngle + spiralRotation;
      bullet.x = this.raptureTargetPos.x + Math.cos(finalAngle) * currentRadius;
      bullet.y = this.raptureTargetPos.y + Math.sin(finalAngle) * currentRadius;
    }
  }

  /**
   * ラプチャー弾を破壊
   */
  private destroyRaptureBullets(): void {
    for (const bullet of this.raptureBullets) {
      if (bullet.active) {
        bullet.destroy();
      }
    }
    this.raptureBullets = [];
  }

  /**
   * スクリーム開始: 扇形予告 → ダメージ判定
   */
  private startScream(time: number): void {
    if (!this.playerPosition) return;

    // プレイヤー方向の角度を記録
    this.screamTargetAngle = Phaser.Math.Angle.Between(
      this.x, this.y,
      this.playerPosition.x, this.playerPosition.y
    );
    this.isScreamCharging = true;
    this.screamChargeStartTime = time;

    // 予告扇形を作成
    this.screamWarningArc = this.scene.add.graphics();
    this.screamWarningArc.setDepth(DEPTH.BULLETS_ENEMY - 1);
    this.updateScreamWarning();
  }

  /**
   * 予告扇形を更新
   */
  private updateScreamWarning(): void {
    if (!this.screamWarningArc) return;

    this.screamWarningArc.clear();
    // 扇形を描画
    const startAngle = this.screamTargetAngle - this.SCREAM_ANGLE / 2;
    const endAngle = this.screamTargetAngle + this.SCREAM_ANGLE / 2;

    // 塗り
    this.screamWarningArc.fillStyle(0xff6600, 0.25);
    this.screamWarningArc.beginPath();
    this.screamWarningArc.moveTo(this.x, this.y);
    this.screamWarningArc.arc(
      this.x, this.y,
      this.SCREAM_RADIUS,
      startAngle, endAngle,
      false
    );
    this.screamWarningArc.closePath();
    this.screamWarningArc.fillPath();

    // 縁
    this.screamWarningArc.lineStyle(3, 0xff6600, 0.6);
    this.screamWarningArc.beginPath();
    this.screamWarningArc.moveTo(this.x, this.y);
    this.screamWarningArc.arc(
      this.x, this.y,
      this.SCREAM_RADIUS,
      startAngle, endAngle,
      false
    );
    this.screamWarningArc.lineTo(this.x, this.y);
    this.screamWarningArc.strokePath();
  }

  /**
   * スクリームの更新
   */
  private updateScream(time: number): void {
    const elapsed = time - this.screamChargeStartTime;

    // 予告を点滅させる
    if (this.screamWarningArc) {
      const alpha = 0.25 + 0.15 * Math.sin(elapsed * 0.015);
      this.screamWarningArc.clear();

      const startAngle = this.screamTargetAngle - this.SCREAM_ANGLE / 2;
      const endAngle = this.screamTargetAngle + this.SCREAM_ANGLE / 2;

      this.screamWarningArc.fillStyle(0xff6600, alpha);
      this.screamWarningArc.beginPath();
      this.screamWarningArc.moveTo(this.x, this.y);
      this.screamWarningArc.arc(this.x, this.y, this.SCREAM_RADIUS, startAngle, endAngle, false);
      this.screamWarningArc.closePath();
      this.screamWarningArc.fillPath();

      this.screamWarningArc.lineStyle(3, 0xff6600, 0.6 + 0.3 * Math.sin(elapsed * 0.015));
      this.screamWarningArc.beginPath();
      this.screamWarningArc.moveTo(this.x, this.y);
      this.screamWarningArc.arc(this.x, this.y, this.SCREAM_RADIUS, startAngle, endAngle, false);
      this.screamWarningArc.lineTo(this.x, this.y);
      this.screamWarningArc.strokePath();
    }

    // 予告時間経過 → ダメージ判定
    if (elapsed >= this.SCREAM_WARNING_TIME) {
      this.executeScreamDamage();
      this.isScreamCharging = false;
      if (this.screamWarningArc) {
        this.screamWarningArc.destroy();
        this.screamWarningArc = null;
      }
    }
  }

  /**
   * スクリームダメージ判定: 扇形内にプレイヤーがいればダメージ
   */
  private executeScreamDamage(): void {
    if (!this.playerPosition) return;

    // プレイヤーとの距離
    const dx = this.playerPosition.x - this.x;
    const dy = this.playerPosition.y - this.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // 距離チェック
    if (distance > this.SCREAM_RADIUS) {
      return;  // 範囲外
    }

    // 角度チェック
    const angleToPlayer = Math.atan2(dy, dx);
    let angleDiff = angleToPlayer - this.screamTargetAngle;
    // -PI ~ PI の範囲に正規化
    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

    if (Math.abs(angleDiff) <= this.SCREAM_ANGLE / 2) {
      // 扇形内にいる場合、ダメージを与える
      // GameSceneのプレイヤーにダメージを与える（MidStageSceneでもGameSceneでも動作）
      const scene = this.scene as Phaser.Scene & {
        player?: { takeDamage: (damage: number) => void };
        reimu?: { takeDamage: (damage: number) => void };
      };
      const player = scene.player || scene.reimu;
      if (player && typeof player.takeDamage === 'function') {
        player.takeDamage(this.stats.attackPower);
      }
    }

    // ダメージフラッシュエフェクト（範囲内にいた場合の視覚効果）
    this.showScreamFlash();
  }

  /**
   * スクリームのフラッシュエフェクト
   */
  private showScreamFlash(): void {
    const flash = this.scene.add.graphics();
    flash.setDepth(DEPTH.BULLETS_ENEMY);

    const startAngle = this.screamTargetAngle - this.SCREAM_ANGLE / 2;
    const endAngle = this.screamTargetAngle + this.SCREAM_ANGLE / 2;

    flash.fillStyle(0xffff00, 0.6);
    flash.beginPath();
    flash.moveTo(this.x, this.y);
    flash.arc(this.x, this.y, this.SCREAM_RADIUS, startAngle, endAngle, false);
    flash.closePath();
    flash.fillPath();

    // 0.1秒でフェードアウト
    this.scene.tweens.add({
      targets: flash,
      alpha: 0,
      duration: 100,
      onComplete: () => flash.destroy()
    });
  }

  /**
   * 非アクティブ化時のクリーンアップ
   */
  deactivate(): void {
    this.cleanupLaser();
    this.cleanupB3();
    this.cleanupB4();
    if (this.orbBullet) {
      this.orbBullet = null;
    }
    this.orbPhase = 'none';
    super.deactivate();
  }

  // =============================================
  // B-4: 固定射撃、ムービング、恐怖弾
  // =============================================

  /**
   * B-4攻撃開始（固定射撃→ムービング→恐怖弾をローテーション）
   */
  private startB4Attack(time: number): void {
    const attackTypes: ('fixed_shot' | 'moving' | 'fear')[] = ['fixed_shot', 'moving', 'fear'];
    this.b4AttackType = attackTypes[this.b4AttackCount % 3];
    this.b4AttackCount++;

    switch (this.b4AttackType) {
      case 'fixed_shot':
        this.startFixedShot(time);
        break;
      case 'moving':
        this.startMoving(time);
        break;
      case 'fear':
        this.startFear(time);
        break;
    }
  }

  /**
   * 固定射撃開始
   * 2.2秒間、0.22秒毎に妖精の向いている方向に弾発射
   */
  private startFixedShot(time: number): void {
    if (!this.playerPosition) return;

    this.isFixedShotActive = true;
    this.fixedShotStartTime = time;
    this.fixedShotLastFireTime = time;

    // プレイヤー方向を固定（この角度は変わらない）
    this.fixedShotAngle = Phaser.Math.Angle.Between(
      this.x, this.y,
      this.playerPosition.x, this.playerPosition.y
    );

    // 最初の弾を発射
    this.fireFixedShotBullet();
  }

  /**
   * 固定射撃の更新
   */
  private updateFixedShot(time: number): void {
    const elapsed = time - this.fixedShotStartTime;

    // 2.2秒経過で終了
    if (elapsed >= this.FIXED_SHOT_DURATION) {
      this.isFixedShotActive = false;
      return;
    }

    // 0.22秒毎に発射
    if (time - this.fixedShotLastFireTime >= this.FIXED_SHOT_INTERVAL) {
      this.fixedShotLastFireTime = time;
      this.fireFixedShotBullet();
    }
  }

  /**
   * 固定射撃の弾を発射
   */
  private fireFixedShotBullet(): void {
    if (!this.bulletPool) return;

    const bullet = this.bulletPool.acquire();
    if (!bullet) return;

    const displayScale = (this.FIXED_SHOT_RADIUS * 2) / 278;  // 輪弾(278px)

    // 発射位置から角度方向へ
    const targetX = this.x + Math.cos(this.fixedShotAngle) * 500;
    const targetY = this.y + Math.sin(this.fixedShotAngle) * 500;

    bullet.fire(
      this.x, this.y,
      targetX, targetY,
      BulletType.ENEMY_NORMAL,
      this.stats.attackPower,
      null, false,
      KSHOT.RINDAN.CYAN  // シアン（ID:13）
    );
    bullet.setScale(displayScale);

    // 当たり判定設定
    const body = bullet.body as Phaser.Physics.Arcade.Body;
    if (body) {
      body.setCircle(this.FIXED_SHOT_RADIUS / displayScale, 0, 0);
      body.setVelocity(
        Math.cos(this.fixedShotAngle) * this.FIXED_SHOT_SPEED,
        Math.sin(this.fixedShotAngle) * this.FIXED_SHOT_SPEED
      );
    }
  }

  /**
   * ムービング開始
   * 任意の方向に4m移動（10m/s）
   */
  private startMoving(time: number): void {
    this.isMoving = true;
    this.moveStartTime = time;
    this.moveStartPos = { x: this.x, y: this.y };

    // ランダムな方向を決定
    const angle = Math.random() * Math.PI * 2;
    this.moveTargetPos = {
      x: this.x + Math.cos(angle) * this.MOVE_DISTANCE,
      y: this.y + Math.sin(angle) * this.MOVE_DISTANCE,
    };

    // 画面内に収まるように調整
    const { PLAY_AREA } = require('@/config/GameConfig').GAME_CONFIG;
    this.moveTargetPos.x = Phaser.Math.Clamp(
      this.moveTargetPos.x,
      PLAY_AREA.X + 50,
      PLAY_AREA.X + PLAY_AREA.WIDTH - 50
    );
    this.moveTargetPos.y = Phaser.Math.Clamp(
      this.moveTargetPos.y,
      PLAY_AREA.Y + 50,
      PLAY_AREA.Y + PLAY_AREA.HEIGHT - 50
    );
  }

  /**
   * ムービングの更新
   */
  private updateMoving(time: number): void {
    const elapsed = time - this.moveStartTime;
    const moveDuration = (this.MOVE_DISTANCE / this.MOVE_SPEED) * 1000;  // 移動にかかる時間（ms）

    if (elapsed >= moveDuration) {
      // 移動完了
      this.x = this.moveTargetPos.x;
      this.y = this.moveTargetPos.y;
      this.isMoving = false;
      return;
    }

    // 線形補間で移動
    const progress = elapsed / moveDuration;
    this.x = this.moveStartPos.x + (this.moveTargetPos.x - this.moveStartPos.x) * progress;
    this.y = this.moveStartPos.y + (this.moveTargetPos.y - this.moveStartPos.y) * progress;
  }

  /**
   * 恐怖弾開始
   * 妖精を中心に半径4.5mの円形予告、0.66秒後にダメージ
   */
  private startFear(time: number): void {
    this.isFearCharging = true;
    this.fearChargeStartTime = time;

    // 予告円を作成
    this.fearWarningCircle = this.scene.add.graphics();
    this.fearWarningCircle.setDepth(DEPTH.BULLETS_ENEMY - 1);
    this.updateFearWarning();
  }

  /**
   * 恐怖弾予告円を更新
   */
  private updateFearWarning(): void {
    if (!this.fearWarningCircle) return;

    this.fearWarningCircle.clear();
    // 紫の円（塗り）
    this.fearWarningCircle.fillStyle(0x8800ff, 0.2);
    this.fearWarningCircle.fillCircle(this.x, this.y, this.FEAR_RADIUS);
    // 紫の縁
    this.fearWarningCircle.lineStyle(3, 0x8800ff, 0.6);
    this.fearWarningCircle.strokeCircle(this.x, this.y, this.FEAR_RADIUS);
  }

  /**
   * 恐怖弾の更新
   */
  private updateFear(time: number): void {
    const elapsed = time - this.fearChargeStartTime;

    // 予告円を点滅させながら追従
    if (this.fearWarningCircle) {
      const alpha = 0.2 + 0.2 * Math.sin(elapsed * 0.015);
      this.fearWarningCircle.clear();
      this.fearWarningCircle.fillStyle(0x8800ff, alpha);
      this.fearWarningCircle.fillCircle(this.x, this.y, this.FEAR_RADIUS);
      this.fearWarningCircle.lineStyle(3, 0x8800ff, 0.6 + 0.3 * Math.sin(elapsed * 0.015));
      this.fearWarningCircle.strokeCircle(this.x, this.y, this.FEAR_RADIUS);
    }

    // 予告時間経過 → ダメージ判定
    if (elapsed >= this.FEAR_WARNING_TIME) {
      this.executeFearDamage();
      this.isFearCharging = false;
      if (this.fearWarningCircle) {
        this.fearWarningCircle.destroy();
        this.fearWarningCircle = null;
      }
    }
  }

  /**
   * 恐怖弾ダメージ判定
   */
  private executeFearDamage(): void {
    if (!this.playerPosition) return;

    // プレイヤーとの距離
    const dx = this.playerPosition.x - this.x;
    const dy = this.playerPosition.y - this.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // 距離チェック
    if (distance <= this.FEAR_RADIUS) {
      // 範囲内にいる場合、ダメージを与える
      const scene = this.scene as Phaser.Scene & {
        player?: { takeDamage: (damage: number) => void };
        reimu?: { takeDamage: (damage: number) => void };
      };
      const player = scene.player || scene.reimu;
      if (player && typeof player.takeDamage === 'function') {
        player.takeDamage(this.stats.attackPower);
      }
    }

    // ダメージフラッシュエフェクト
    this.showFearFlash();
  }

  /**
   * 恐怖弾のフラッシュエフェクト
   */
  private showFearFlash(): void {
    const flash = this.scene.add.graphics();
    flash.setDepth(DEPTH.BULLETS_ENEMY);

    flash.fillStyle(0xcc00ff, 0.6);
    flash.fillCircle(this.x, this.y, this.FEAR_RADIUS);

    // 0.1秒でフェードアウト
    this.scene.tweens.add({
      targets: flash,
      alpha: 0,
      duration: 100,
      onComplete: () => flash.destroy()
    });
  }
}
