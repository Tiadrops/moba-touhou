import Phaser from 'phaser';
import { EnemyType } from '@/types';
import { DEPTH, COLORS } from '@/config/GameConfig';

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

  // 移動パターン
  private movePattern: 'straight' | 'wave' | 'zigzag' = 'straight';
  private patternTime: number = 0;

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

    // 画面外に出たら非アクティブ化
    if (this.y > 1200 || this.x < -100 || this.x > 2100) {
      this.deactivate();
    }
  }

  /**
   * 移動パターンを更新
   */
  private updateMovement(delta: number): void {
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
   * 非アクティブ化
   */
  deactivate(): void {
    this.isActive = false;
    this.setActive(false);
    this.setVisible(false);
    this.setVelocity(0, 0);
    this.setScale(1);
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
}
