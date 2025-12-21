import Phaser from 'phaser';
import { MobGroupType, BulletType } from '@/types';
import { MobEnemy } from './MobEnemy';
import { KSHOT } from '../Bullet';
import { UNIT, DEPTH } from '@/config/GameConfig';

/**
 * 弾幕パターンタイプ
 */
export type MobBPatternType = 'B1' | 'B2';

/**
 * グループB雑魚
 * HP500, DEF0, ATK100
 * 生存時間無制限（撃破まで残る）
 * 4秒ごとに攻撃
 *
 * B-1: オーブオブディセプション風の自機狙い弾（1発のみ、行って戻る）
 * B-2: 予告線→レーザー（半径1mのID:3弾丸を重ねて描写）
 */
// パターン別テクスチャ設定
const PATTERN_TEXTURES: Record<MobBPatternType, { texture: string; animation: string }> = {
  'B1': { texture: 'fairy_b1', animation: 'fairy_b1_idle' },
  'B2': { texture: 'fairy_b2', animation: 'fairy_b2_idle' },
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
    this.lastAttackTime = this.scene.time.now;
    this.orbPhase = 'none';
    this.orbBullet = null;
    this.isLaserCharging = false;
    this.cleanupLaser();
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
    this.lastAttackTime = this.scene.time.now;
    this.orbPhase = 'none';
    this.orbBullet = null;
    this.isLaserCharging = false;
    this.cleanupLaser();
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
    this.lastAttackTime = this.scene.time.now;
    this.orbPhase = 'none';
    this.orbBullet = null;
    this.isLaserCharging = false;
    this.cleanupLaser();
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
    this.lastAttackTime = this.scene.time.now;
    this.orbPhase = 'none';
    this.orbBullet = null;
    this.isLaserCharging = false;
    this.cleanupLaser();
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
    this.lastAttackTime = this.scene.time.now;
    this.orbPhase = 'none';
    this.orbBullet = null;
    this.isLaserCharging = false;
    this.cleanupLaser();
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
    this.lastAttackTime = this.scene.time.now;
    this.orbPhase = 'none';
    this.orbBullet = null;
    this.isLaserCharging = false;
    this.cleanupLaser();
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
    this.lastAttackTime = this.scene.time.now;
    this.orbPhase = 'none';
    this.orbBullet = null;
    this.isLaserCharging = false;
    this.cleanupLaser();
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
    if (this.orbPhase !== 'none' || this.isLaserCharging) {
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

    // 自動発射が無効なら新規攻撃はしない
    if (!this.autoShootEnabled) {
      return;
    }

    // 攻撃間隔チェック
    if (time - this.lastAttackTime < this.attackInterval) {
      return;
    }

    // 既に攻撃中なら待機
    if (this.orbPhase !== 'none' || this.isLaserCharging) {
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
   * 非アクティブ化時のクリーンアップ
   */
  deactivate(): void {
    this.cleanupLaser();
    if (this.orbBullet) {
      this.orbBullet = null;
    }
    this.orbPhase = 'none';
    super.deactivate();
  }
}
