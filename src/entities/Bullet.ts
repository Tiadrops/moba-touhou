import Phaser from 'phaser';
import { BulletType } from '@/types';
import { DEPTH, COLORS } from '@/config/GameConfig';
import { Enemy } from './Enemy';

/**
 * 弾クラス
 */
export class Bullet extends Phaser.Physics.Arcade.Sprite {
  private bulletType: BulletType;
  private damage: number;
  private speed: number;
  private isActive: boolean = false;
  private target: Enemy | null = null; // 追尾対象

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'bullet_player');

    // 初期値
    this.bulletType = BulletType.PLAYER_NORMAL;
    this.damage = 10;
    this.speed = 500;

    // 物理エンジンに追加
    scene.add.existing(this);
    scene.physics.add.existing(this);

    // 初期設定
    this.setActive(false);
    this.setVisible(false);
    this.setDepth(DEPTH.BULLETS_PLAYER);

    // 当たり判定
    const body = this.body as Phaser.Physics.Arcade.Body;
    if (body) {
      body.setCircle(4);
    }
  }

  /**
   * 弾を発射
   */
  fire(
    x: number,
    y: number,
    targetX: number,
    targetY: number,
    bulletType: BulletType = BulletType.PLAYER_NORMAL,
    damage: number = 10,
    target: Enemy | null = null
  ): void {
    this.bulletType = bulletType;
    this.damage = damage;
    this.isActive = true;
    this.target = target;

    // 位置を設定
    this.setPosition(x, y);
    this.setActive(true);
    this.setVisible(true);

    // テクスチャと色を設定
    if (bulletType === BulletType.PLAYER_NORMAL) {
      this.setTexture('bullet_player');
      this.setTint(COLORS.BULLET_PLAYER);
    } else if (bulletType === BulletType.ENEMY_NORMAL || bulletType === BulletType.ENEMY_AIMED) {
      this.setTexture('bullet_enemy');
      this.setTint(COLORS.BULLET_ENEMY);
    }

    // 初期方向を計算
    const angle = Phaser.Math.Angle.Between(x, y, targetX, targetY);

    // 速度を設定
    this.setVelocity(
      Math.cos(angle) * this.speed,
      Math.sin(angle) * this.speed
    );

    // 回転を設定（弾の向き）
    this.setRotation(angle);
  }

  /**
   * 更新処理
   */
  update(): void {
    if (!this.isActive) {
      return;
    }

    // 追尾処理（プレイヤーの弾のみ）
    if (this.bulletType === BulletType.PLAYER_NORMAL && this.target && this.target.getIsActive()) {
      // ターゲットへの角度を計算
      const angle = Phaser.Math.Angle.Between(
        this.x,
        this.y,
        this.target.x,
        this.target.y
      );

      // 速度を更新（追尾）
      this.setVelocity(
        Math.cos(angle) * this.speed,
        Math.sin(angle) * this.speed
      );

      // 回転を更新
      this.setRotation(angle);
    }

    // 画面外に出たら非アクティブ化
    if (this.x < -50 || this.x > 2000 || this.y < -50 || this.y > 1200) {
      this.deactivate();
    }
  }

  /**
   * 弾を非アクティブ化
   */
  deactivate(): void {
    this.isActive = false;
    this.target = null;
    this.setActive(false);
    this.setVisible(false);
    this.setVelocity(0, 0);
  }

  /**
   * ダメージを取得
   */
  getDamage(): number {
    return this.damage;
  }

  /**
   * 弾の種類を取得
   */
  getBulletType(): BulletType {
    return this.bulletType;
  }

  /**
   * アクティブかどうか
   */
  getIsActive(): boolean {
    return this.isActive;
  }
}
