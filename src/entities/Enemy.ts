import Phaser from 'phaser';
import { EnemyType, BulletType } from '@/types';
import { DEPTH, COLORS, GAME_CONFIG } from '@/config/GameConfig';
import { BulletPool } from '@/utils/ObjectPool';

/**
 * 敵クラス
 */
export class Enemy extends Phaser.Physics.Arcade.Sprite {
  private enemyType: EnemyType;
  private maxHp: number;
  private currentHp: number;
  private damage: number;
  private moveSpeed: number;
  private scoreValue: number;
  private isActive: boolean = false;
  private hitboxRadius: number = 12;

  // 移動パターン
  private movePattern: 'straight' | 'wave' | 'zigzag' = 'straight';
  private patternTime: number = 0;

  // 弾幕システム
  private bulletPool: BulletPool | null = null;
  private lastShootTime: number = 0;
  private shootInterval: number = 2000; // 2秒ごとに発射
  private playerPosition: { x: number; y: number } | null = null;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'enemy');

    // デフォルト値
    this.enemyType = EnemyType.NORMAL;
    this.maxHp = 30;
    this.currentHp = this.maxHp;
    this.damage = 10;
    this.moveSpeed = 100;
    this.scoreValue = 100;

    // 物理エンジンに追加
    scene.add.existing(this);
    scene.physics.add.existing(this);

    // 初期設定
    this.setActive(false);
    this.setVisible(false);
    this.setDepth(DEPTH.ENEMIES);
    this.setTint(COLORS.ENEMY);

    // 当たり判定
    const body = this.body as Phaser.Physics.Arcade.Body;
    if (body) {
      body.setCircle(12);
      body.setOffset(
        this.width / 2 - 12,
        this.height / 2 - 12
      );
    }
  }

  /**
   * 敵を生成
   */
  spawn(
    x: number,
    y: number,
    enemyType: EnemyType = EnemyType.NORMAL,
    movePattern: 'straight' | 'wave' | 'zigzag' = 'straight'
  ): void {
    this.enemyType = enemyType;
    this.movePattern = movePattern;
    this.patternTime = 0;

    // 敵タイプに応じてステータスを設定
    switch (enemyType) {
      case EnemyType.NORMAL:
        this.maxHp = 30;
        this.damage = 10;
        this.moveSpeed = 100;
        this.scoreValue = 100;
        break;
      case EnemyType.ELITE:
        this.maxHp = 100;
        this.damage = 20;
        this.moveSpeed = 80;
        this.scoreValue = 300;
        break;
      case EnemyType.MINI_BOSS:
        this.maxHp = 500;
        this.damage = 30;
        this.moveSpeed = 50;
        this.scoreValue = 1000;
        this.setScale(1.5);
        break;
      case EnemyType.BOSS:
        this.maxHp = 2000;
        this.damage = 50;
        this.moveSpeed = 30;
        this.scoreValue = 5000;
        this.setScale(2);
        break;
    }

    this.currentHp = this.maxHp;
    this.isActive = true;

    // 位置を設定
    this.setPosition(x, y);
    this.setActive(true);
    this.setVisible(true);

    // 初期速度（下方向に移動）
    this.updateMovement(0);
  }

  /**
   * 更新処理
   */
  update(time: number, delta: number): void {
    if (!this.isActive) {
      return;
    }

    this.patternTime += delta;

    // 移動パターンを更新
    this.updateMovement(delta);

    // 弾幕発射
    this.updateShooting(time);

    // 画面外に出たら非アクティブ化（プレイエリア外）
    const { X, Y, WIDTH, HEIGHT } = GAME_CONFIG.PLAY_AREA;
    const margin = 100;
    if (this.x < X - margin || this.x > X + WIDTH + margin ||
        this.y < Y - margin || this.y > Y + HEIGHT + margin) {
      this.deactivate();
    }
  }

  /**
   * 移動パターンを更新
   */
  private updateMovement(_delta: number): void {
    const { X, Y, WIDTH, HEIGHT } = GAME_CONFIG.PLAY_AREA;
    const enemyRadius = 16; // 敵のサイズを考慮
    const leftBound = X + enemyRadius;
    const rightBound = X + WIDTH - enemyRadius;
    const topBound = Y + enemyRadius;
    const bottomBound = Y + HEIGHT - enemyRadius;

    let vx = 0;
    let vy = this.moveSpeed;

    switch (this.movePattern) {
      case 'straight':
        // まっすぐ下に移動
        vx = 0;
        break;

      case 'wave':
        // 波状に移動
        vx = Math.sin(this.patternTime / 500) * 100;
        break;

      case 'zigzag':
        // ジグザグに移動
        vx = Math.sin(this.patternTime / 300) * 150;
        break;
    }

    // プレイエリアの境界でX方向の速度を制限
    if (this.x <= leftBound && vx < 0) {
      vx = Math.abs(vx); // 右に反転
    } else if (this.x >= rightBound && vx > 0) {
      vx = -Math.abs(vx); // 左に反転
    }

    // 位置を強制的にプレイエリア内にクランプ（X軸）
    if (this.x < leftBound) {
      this.x = leftBound;
    } else if (this.x > rightBound) {
      this.x = rightBound;
    }

    // 位置を強制的にプレイエリア内にクランプ（Y軸）
    if (this.y < topBound) {
      this.y = topBound;
    } else if (this.y > bottomBound) {
      this.y = bottomBound;
    }

    this.setVelocity(vx, vy);
  }

  /**
   * ダメージを受ける
   */
  takeDamage(damage: number): boolean {
    if (!this.isActive) {
      return false;
    }

    this.currentHp -= damage;

    // ダメージエフェクト
    this.flashDamage();

    // 死亡判定
    if (this.currentHp <= 0) {
      this.onDeath();
      return true; // 撃破
    }

    return false;
  }

  /**
   * ダメージエフェクト
   */
  private flashDamage(): void {
    this.setTint(0xffffff);
    this.scene.time.delayedCall(100, () => {
      this.setTint(COLORS.ENEMY);
    });
  }

  /**
   * 死亡処理
   */
  private onDeath(): void {
    // TODO: 死亡エフェクト
    // TODO: アイテムドロップ

    this.deactivate();
  }

  /**
   * 弾幕発射処理
   */
  private updateShooting(time: number): void {
    if (!this.bulletPool || !this.playerPosition) {
      return;
    }

    // 発射間隔チェック
    if (time - this.lastShootTime < this.shootInterval) {
      return;
    }

    this.lastShootTime = time;

    // 敵タイプに応じて弾幕パターンを変更
    switch (this.enemyType) {
      case EnemyType.NORMAL:
        // プレイヤーを狙う単発弾
        this.shootAimedBullet();
        break;

      case EnemyType.ELITE:
        // プレイヤーを狙う3-way弾
        this.shootThreeWay();
        break;

      case EnemyType.MINI_BOSS:
        // 8方向の放射状弾幕
        this.shootRadial(8);
        break;

      case EnemyType.BOSS:
        // 5方向の放射状弾幕
        this.shootRadial(5);
        break;
    }
  }

  /**
   * プレイヤーを狙う単発弾
   */
  private shootAimedBullet(): void {
    if (!this.bulletPool || !this.playerPosition) return;

    const bullet = this.bulletPool.acquire();
    if (bullet) {
      bullet.fire(
        this.x,
        this.y,
        this.playerPosition.x,
        this.playerPosition.y,
        BulletType.ENEMY_AIMED,
        this.damage
      );
    }
  }

  /**
   * 3-way弾（プレイヤー方向 + 左右に広がる）
   */
  private shootThreeWay(): void {
    if (!this.bulletPool || !this.playerPosition) return;

    const angle = Phaser.Math.Angle.Between(
      this.x,
      this.y,
      this.playerPosition.x,
      this.playerPosition.y
    );

    // 中央、左、右の3発
    const angles = [angle, angle - 0.3, angle + 0.3];

    for (const shootAngle of angles) {
      const bullet = this.bulletPool.acquire();
      if (bullet) {
        const targetX = this.x + Math.cos(shootAngle) * 500;
        const targetY = this.y + Math.sin(shootAngle) * 500;
        bullet.fire(
          this.x,
          this.y,
          targetX,
          targetY,
          BulletType.ENEMY_NORMAL,
          this.damage
        );
      }
    }
  }

  /**
   * 放射状弾幕
   */
  private shootRadial(count: number): void {
    if (!this.bulletPool) return;

    const angleStep = (Math.PI * 2) / count;

    for (let i = 0; i < count; i++) {
      const angle = angleStep * i;
      const bullet = this.bulletPool.acquire();
      if (bullet) {
        const targetX = this.x + Math.cos(angle) * 500;
        const targetY = this.y + Math.sin(angle) * 500;
        bullet.fire(
          this.x,
          this.y,
          targetX,
          targetY,
          BulletType.ENEMY_NORMAL,
          this.damage
        );
      }
    }
  }

  /**
   * 非アクティブ化
   */
  deactivate(): void {
    this.isActive = false;
    this.setActive(false);
    this.setVisible(false);
    this.setVelocity(0, 0);
    this.setScale(1);
  }

  /**
   * 弾プールを設定
   */
  setBulletPool(pool: BulletPool): void {
    this.bulletPool = pool;
  }

  /**
   * プレイヤー位置を設定
   */
  setPlayerPosition(x: number, y: number): void {
    this.playerPosition = { x, y };
  }

  // ゲッター
  getDamage(): number {
    return this.damage;
  }

  getScoreValue(): number {
    return this.scoreValue;
  }

  getIsActive(): boolean {
    return this.isActive;
  }

  getCurrentHp(): number {
    return this.currentHp;
  }

  getMaxHp(): number {
    return this.maxHp;
  }

  getEnemyType(): EnemyType {
    return this.enemyType;
  }

  getHitboxRadius(): number {
    return this.hitboxRadius;
  }
}
