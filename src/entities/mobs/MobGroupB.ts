import Phaser from 'phaser';
import { MobGroupType, BulletType } from '@/types';
import { MobEnemy } from './MobEnemy';
import { KSHOT } from '../Bullet';
import { UNIT, DEPTH, GAME_CONFIG } from '@/config/GameConfig';
import { AudioManager } from '@/systems/AudioManager';

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

  // B-4用: 固定射撃、ムービング、恐怖弾（同時に使用可能な要素あり）
  // 固定射撃用（移動中でも発射可能）
  private isFixedShotActive: boolean = false;
  private fixedShotStartTime: number = 0;
  private fixedShotLastFireTime: number = 0;
  private fixedShotAngle: number = 0;  // 発射角度（固定）
  private lastFixedShotCDTime: number = 0;  // 固定射撃のCD開始時刻
  private readonly FIXED_SHOT_DURATION = 2200;     // 2.2秒間
  private readonly FIXED_SHOT_INTERVAL = 220;      // 0.22秒毎
  private readonly FIXED_SHOT_SPEED = 20 * UNIT.METER_TO_PIXEL;  // 20m/s
  private readonly FIXED_SHOT_RADIUS = 0.5 * UNIT.METER_TO_PIXEL;  // 半径0.5m
  private readonly FIXED_SHOT_COOLDOWN = 3000;  // 固定射撃のCD（2.2s発射 + 0.8s待機 ≈ 3秒）
  // ムービング用（プレイヤーとの距離7.5mを維持）
  private isMoving: boolean = false;
  private moveStartPos: { x: number; y: number } = { x: 0, y: 0 };
  private moveTargetPos: { x: number; y: number } = { x: 0, y: 0 };
  private moveStartTime: number = 0;
  private moveDuration: number = 0;  // 移動時間（距離に応じて変わる）
  private lastMoveTime: number = 0;  // ムービングのCD開始時刻
  private readonly MOVE_SPEED = 10 * UNIT.METER_TO_PIXEL;    // 10m/s（ムービング用）
  private readonly BASE_MOVE_SPEED = 3 * UNIT.METER_TO_PIXEL;  // 3m/s（通常移動用）
  private readonly TARGET_DISTANCE = 7.5 * UNIT.METER_TO_PIXEL;  // 目標距離7.5m
  private readonly DISTANCE_TOLERANCE = 1 * UNIT.METER_TO_PIXEL;  // 許容誤差1m
  private readonly MOVE_COOLDOWN = 5000;  // ムービングのCD 5秒
  // 恐怖弾用
  private fearWarningCircle: Phaser.GameObjects.Graphics | null = null;
  private isFearCharging: boolean = false;
  private fearChargeStartTime: number = 0;
  private lastFearTime: number = 0;  // 恐怖弾のクールダウン用
  private readonly FEAR_RADIUS = 4.5 * UNIT.METER_TO_PIXEL;  // 半径4.5m
  private readonly FEAR_WARNING_TIME = 660;  // 0.66秒予告
  private readonly FEAR_COOLDOWN = 3000;  // 恐怖弾のクールダウン3秒

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

    // B-4専用: 継続的にAIを更新（移動と射撃の同時実行のため）
    if (this.patternType === 'B4' && this.autoShootEnabled) {
      this.updateB4AI(time);
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

    // 発射SEを再生
    AudioManager.getInstance().playSe('se_tan00', { volume: 0.6 });

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

    // 発射SEを再生
    AudioManager.getInstance().playSe('se_gun00', { volume: 0.6 });

    // 予告線を消す
    if (this.laserWarningLine) {
      this.laserWarningLine.destroy();
      this.laserWarningLine = null;
    }

    // レーザー弾の設定（画像サイズ: 550x1100px、縦長）
    const laserImageWidth = 550;
    const laserImageHeight = 1100;
    const targetWidth = 2 * UNIT.METER_TO_PIXEL;  // 横幅2m
    const displayScale = targetWidth / laserImageWidth;  // 横幅を2mに合わせる
    const displayHeight = laserImageHeight * displayScale;  // スケール後の縦幅
    const bulletSpacing = displayHeight * 0.4;  // 弾の間隔（縦幅基準、60%重なる）
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
        null  // kshotFrameIdはnull（カスタムテクスチャを使用）
      );

      // レーザー画像に変更
      bullet.setTexture('laser');
      bullet.setScale(displayScale);
      bullet.setRotation(this.laserAngle + Math.PI / 2);  // 進行方向に回転

      // 当たり判定を設定（横幅2m、縦はスケール後の高さ）
      const body = bullet.body as Phaser.Physics.Arcade.Body;
      if (body) {
        body.setSize(targetWidth, displayHeight);
        body.setOffset(0, 0);
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
    // ラプチャーの弾を破棄
    this.destroyRaptureBullets();
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
    this.lastFixedShotCDTime = 0;
    this.lastFearTime = 0;
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
    // フラッシュエフェクトは常に表示
    this.showScreamFlash();

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
  }

  /**
   * スクリームのフラッシュエフェクト
   * 円形画像を扇形にマスクして表示
   */
  private showScreamFlash(): void {
    // 扇形マスクを作成（画面に追加しない）
    const mask = new Phaser.GameObjects.Graphics(this.scene);
    const startAngle = this.screamTargetAngle - this.SCREAM_ANGLE / 2;
    const endAngle = this.screamTargetAngle + this.SCREAM_ANGLE / 2;

    mask.fillStyle(0xffffff);
    mask.beginPath();
    mask.moveTo(this.x, this.y);
    mask.arc(this.x, this.y, this.SCREAM_RADIUS, startAngle, endAngle, false);
    mask.closePath();
    mask.fillPath();

    // 円形エフェクト画像（1400x1400px）をスケーリングして配置
    const imageSize = 1400;
    const scale = (this.SCREAM_RADIUS * 2) / imageSize;
    const effect = this.scene.add.image(this.x, this.y, 'screem');
    effect.setScale(scale);
    effect.setDepth(DEPTH.BULLETS_ENEMY);
    effect.setAlpha(0.8);

    // 扇形マスクを適用
    effect.setMask(mask.createGeometryMask());

    // 0.15秒でフェードアウト
    this.scene.tweens.add({
      targets: effect,
      alpha: 0,
      duration: 150,
      onComplete: () => {
        effect.destroy();
        mask.destroy();
      }
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
   * B-4 AIの継続的な更新
   * 毎フレーム呼ばれ、条件に応じて移動・射撃を開始する
   */
  private updateB4AI(time: number): void {
    // 登場後2秒間は全ての行動を行わない
    const aliveTime = time - this.spawnTime;
    const attackDelay = 2000;  // 2秒

    // 登場後2秒間は何もしない
    if (aliveTime < attackDelay) {
      return;
    }

    if (!this.playerPosition) {
      // プレイヤー位置が分からない場合は固定射撃のみ
      if (!this.isFixedShotActive && time - this.lastFixedShotCDTime >= this.FIXED_SHOT_COOLDOWN) {
        this.startFixedShot(time);
      }
      return;
    }

    // プレイヤーとの距離を計算
    const dx = this.playerPosition.x - this.x;
    const dy = this.playerPosition.y - this.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // 通常移動：ムービング中でない場合、毎フレームプレイヤーとの距離7.5mを維持
    if (!this.isMoving) {
      this.updateBaseMovement(distance, dx, dy);
    }

    // 恐怖弾：プレイヤーが射程内(4.5m)にいて、CDが上がっていて、チャージ中でなく、固定射撃中でない場合
    if (distance <= this.FEAR_RADIUS &&
        time - this.lastFearTime >= this.FEAR_COOLDOWN &&
        !this.isFearCharging &&
        !this.isFixedShotActive) {
      this.startFear(time);
      return;
    }

    // ムービング：プレイヤーとの距離が目標距離(7.5m)から大きく離れていて、移動中でなく、CDが上がっている場合
    const distanceDiff = Math.abs(distance - this.TARGET_DISTANCE);
    if (distanceDiff > this.DISTANCE_TOLERANCE && !this.isMoving &&
        time - this.lastMoveTime >= this.MOVE_COOLDOWN) {
      this.startMovingToTargetDistance(time, distance);
    }

    // 固定射撃：CDが上がっていて、発射中でない場合（移動中でも発射可能）
    if (!this.isFixedShotActive && time - this.lastFixedShotCDTime >= this.FIXED_SHOT_COOLDOWN) {
      this.startFixedShot(time);
    }
  }

  /**
   * B-4の通常移動（毎フレーム）
   * - 固定射撃中以外: プレイヤーとの距離7.5mを維持
   * - 固定射撃中: 弾道軸を合わせる移動
   */
  private updateBaseMovement(distance: number, dx: number, dy: number): void {
    if (!this.playerPosition) return;

    const delta = this.scene.game.loop.delta / 1000;  // 秒単位

    let moveX = 0;
    let moveY = 0;

    if (this.isFixedShotActive) {
      // 固定射撃中: 弾道軸を合わせる移動
      // 目標: 妖精→プレイヤーの方向がfixedShotAngleになる位置へ移動

      // 弾道軸の単位ベクトル
      const axisX = Math.cos(this.fixedShotAngle);
      const axisY = Math.sin(this.fixedShotAngle);

      // 目標位置: プレイヤーから弾道方向の逆側へ、現在の距離分だけ離れた位置
      const targetX = this.playerPosition.x - axisX * distance;
      const targetY = this.playerPosition.y - axisY * distance;

      // 目標への差分
      const toTargetX = targetX - this.x;
      const toTargetY = targetY - this.y;
      const toTargetDist = Math.sqrt(toTargetX * toTargetX + toTargetY * toTargetY);

      // 距離が小さければ移動しない
      if (toTargetDist < 5) {
        return;
      }

      // 移動量
      const moveAmount = Math.min(this.BASE_MOVE_SPEED * delta, toTargetDist);
      moveX = (toTargetX / toTargetDist) * moveAmount;
      moveY = (toTargetY / toTargetDist) * moveAmount;
    } else {
      // 固定射撃中以外: プレイヤーとの距離7.5mを維持
      const distanceDiff = distance - this.TARGET_DISTANCE;

      // 距離が許容誤差内なら移動しない
      if (Math.abs(distanceDiff) <= this.DISTANCE_TOLERANCE * 0.5) {
        return;
      }

      // 移動方向: プレイヤーに近づく(+) or 離れる(-)
      const moveDir = distanceDiff > 0 ? 1 : -1;
      const angle = Math.atan2(dy, dx);

      // 移動量（デルタ時間ベース）
      const moveAmount = this.BASE_MOVE_SPEED * delta * moveDir;
      moveX = Math.cos(angle) * moveAmount;
      moveY = Math.sin(angle) * moveAmount;
    }

    // 新しい位置を計算
    let newX = this.x + moveX;
    let newY = this.y + moveY;

    // 画面内に収まるように調整
    const { PLAY_AREA } = GAME_CONFIG;
    newX = Phaser.Math.Clamp(newX, PLAY_AREA.X + 50, PLAY_AREA.X + PLAY_AREA.WIDTH - 50);
    newY = Phaser.Math.Clamp(newY, PLAY_AREA.Y + 50, PLAY_AREA.Y + PLAY_AREA.HEIGHT - 50);

    this.x = newX;
    this.y = newY;
  }

  /**
   * B-4攻撃開始（条件ベースのAI）
   *
   * 優先度:
   * 1. 恐怖弾: プレイヤーが射程内(4.5m)にいて、CDが上がっていれば使用
   * 2. 移動: プレイヤーとの距離が7.5mから離れていれば移動開始
   * 3. 固定射撃: CDが上がっていれば使用（移動中でも発射可能）
   *
   * 固定射撃は移動と並行して使用可能
   */
  private startB4Attack(time: number): void {
    if (!this.playerPosition) {
      // プレイヤー位置が分からない場合は固定射撃のみ
      if (!this.isFixedShotActive && time - this.lastFixedShotCDTime >= this.FIXED_SHOT_COOLDOWN) {
        this.startFixedShot(time);
      }
      return;
    }

    // プレイヤーとの距離を計算
    const dx = this.playerPosition.x - this.x;
    const dy = this.playerPosition.y - this.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // 恐怖弾：プレイヤーが射程内(4.5m)にいて、CDが上がっていて、チャージ中でない場合
    if (distance <= this.FEAR_RADIUS &&
        time - this.lastFearTime >= this.FEAR_COOLDOWN &&
        !this.isFearCharging) {
      this.startFear(time);
      return;
    }

    // 移動：プレイヤーとの距離が目標距離(7.5m)から大きく離れていて、移動中でなく、CDが上がっている場合
    const distanceDiff = Math.abs(distance - this.TARGET_DISTANCE);
    if (distanceDiff > this.DISTANCE_TOLERANCE && !this.isMoving &&
        time - this.lastMoveTime >= this.MOVE_COOLDOWN) {
      this.startMovingToTargetDistance(time, distance);
    }

    // 固定射撃：CDが上がっていて、発射中でない場合（移動中でも発射可能）
    if (!this.isFixedShotActive && time - this.lastFixedShotCDTime >= this.FIXED_SHOT_COOLDOWN) {
      this.startFixedShot(time);
    }
  }

  /**
   * 固定射撃開始
   * 2.2秒間、0.22秒毎に固定角度で弾発射
   * 射撃開始時のプレイヤー方向を固定し、移動で距離を調整して当てる
   */
  private startFixedShot(time: number): void {
    if (!this.playerPosition) return;

    this.isFixedShotActive = true;
    this.fixedShotStartTime = time;
    this.fixedShotLastFireTime = time;

    // 射撃開始時のプレイヤー方向を固定（この角度は射撃中変わらない）
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
      this.lastFixedShotCDTime = time;  // CD開始
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
   * 固定された角度（射撃開始時のプレイヤー方向）に発射
   */
  private fireFixedShotBullet(): void {
    if (!this.bulletPool) return;

    const bullet = this.bulletPool.acquire();
    if (!bullet) return;

    const displayScale = (this.FIXED_SHOT_RADIUS * 2) / 278;  // 輪弾(278px)

    // 固定角度方向へ発射
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
   * 移動開始
   *
   * 固定射撃中の場合：プレイヤーが弾道軸上に来る位置へ移動（距離は無視）
   * 固定射撃中でない場合：プレイヤー方向に距離7.5mを維持
   */
  private startMovingToTargetDistance(time: number, currentDistance: number): void {
    if (!this.playerPosition) return;

    this.isMoving = true;
    this.moveStartTime = time;
    this.moveStartPos = { x: this.x, y: this.y };

    if (this.isFixedShotActive) {
      // 固定射撃中: プレイヤーが弾道軸上に来る位置へ移動（距離は気にしない）
      //
      // 目標: 弾がプレイヤーに当たるように妖精を移動させる
      // 方法: プレイヤーから弾道方向の逆側へ移動
      //       （妖精→プレイヤーの方向がfixedShotAngleになる位置）

      // 弾道軸の単位ベクトル
      const axisX = Math.cos(this.fixedShotAngle);
      const axisY = Math.sin(this.fixedShotAngle);

      // 現在の妖精→プレイヤーの距離を計算
      const toPlayerX = this.playerPosition.x - this.x;
      const toPlayerY = this.playerPosition.y - this.y;
      const distToPlayer = Math.sqrt(toPlayerX * toPlayerX + toPlayerY * toPlayerY);

      // 目標位置: プレイヤーから弾道方向の逆側へ、現在の距離分だけ離れた位置
      // これで妖精が移動すると、弾道軸がプレイヤーを通るようになる
      this.moveTargetPos = {
        x: this.playerPosition.x - axisX * distToPlayer,
        y: this.playerPosition.y - axisY * distToPlayer,
      };
    } else {
      // 固定射撃中でない場合: プレイヤー方向に距離7.5mを維持
      const dx = this.playerPosition.x - this.x;
      const dy = this.playerPosition.y - this.y;
      const moveAngle = Math.atan2(dy, dx);

      // 目標距離との差分
      const distanceDiff = currentDistance - this.TARGET_DISTANCE;

      // 目標位置を計算
      this.moveTargetPos = {
        x: this.x + Math.cos(moveAngle) * distanceDiff,
        y: this.y + Math.sin(moveAngle) * distanceDiff,
      };
    }

    // 画面内に収まるように調整
    const { PLAY_AREA } = GAME_CONFIG;
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

    // 実際の移動距離を計算
    const actualDx = this.moveTargetPos.x - this.moveStartPos.x;
    const actualDy = this.moveTargetPos.y - this.moveStartPos.y;
    const actualMoveDistance = Math.sqrt(actualDx * actualDx + actualDy * actualDy);

    // 移動時間を計算（距離に応じて変わる）
    this.moveDuration = (actualMoveDistance / this.MOVE_SPEED) * 1000;

    // 移動距離が非常に小さい場合は移動しない
    if (actualMoveDistance < 10) {
      this.isMoving = false;
    }
  }

  /**
   * ムービングの更新
   */
  private updateMoving(time: number): void {
    const elapsed = time - this.moveStartTime;

    if (elapsed >= this.moveDuration) {
      // 移動完了
      this.x = this.moveTargetPos.x;
      this.y = this.moveTargetPos.y;
      this.isMoving = false;
      this.lastMoveTime = time;  // CD開始
      return;
    }

    // 線形補間で移動
    const progress = elapsed / this.moveDuration;
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
      this.lastFearTime = time;  // CD開始
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
   * 恐怖弾のフラッシュエフェクト（screem画像を使用）
   */
  private showFearFlash(): void {
    // 円形エフェクト画像（1400x1400px）をスケーリングして配置
    const imageSize = 1400;
    const scale = (this.FEAR_RADIUS * 2) / imageSize;
    const effect = this.scene.add.image(this.x, this.y, 'screem');
    effect.setScale(scale);
    effect.setDepth(DEPTH.BULLETS_ENEMY);
    effect.setAlpha(0.8);

    // 0.15秒でフェードアウト
    this.scene.tweens.add({
      targets: effect,
      alpha: 0,
      duration: 150,
      onComplete: () => effect.destroy()
    });
  }
}
