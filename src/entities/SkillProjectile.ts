import Phaser from 'phaser';
import { StatusEffectType, Attackable } from '@/types';
import { DEPTH, GAME_CONFIG } from '@/config/GameConfig';

/**
 * スキル用の投射物（長方形弾など）
 */
export class SkillProjectile extends Phaser.GameObjects.Container {
  private graphics: Phaser.GameObjects.Graphics;
  private projectileWidth: number;   // 幅（進行方向に対して横）
  private projectileHeight: number;  // 高さ（進行方向に対して縦）
  private damage: number;
  private stunDuration: number;
  private isActive: boolean = false;
  private maxRange: number = 0;
  private travelTime: number = 0;
  private elapsedTime: number = 0;
  private velocityX: number = 0;
  private velocityY: number = 0;
  private directionAngle: number = 0; // 進行方向の角度（ラジアン）
  private hitTargets: Set<Attackable> = new Set(); // 既にヒットした対象（多段ヒット防止）
  private targets: Attackable[] = []; // 攻撃対象（敵とボス）

  constructor(scene: Phaser.Scene) {
    super(scene, 0, 0);

    this.projectileWidth = 27.5;  // 0.5m
    this.projectileHeight = 41.25; // 0.75m
    this.damage = 0;
    this.stunDuration = 0;

    // グラフィックスを作成
    this.graphics = scene.add.graphics();
    this.add(this.graphics);

    scene.add.existing(this);
    this.setDepth(DEPTH.BULLETS_PLAYER);
    this.setActive(false);
    this.setVisible(false);
  }

  /**
   * 投射物を発射
   * @param x 開始X座標
   * @param y 開始Y座標
   * @param directionX 方向X（正規化済み）
   * @param directionY 方向Y（正規化済み）
   * @param width 長方形の幅（px）
   * @param height 長方形の高さ（px）
   * @param maxRange 最大射程（px）- 弾の先端がここまで到達
   * @param travelTime 射程到達までの時間（ms）
   * @param damage ダメージ量
   * @param stunDuration スタン時間（ms）
   * @param enemies 敵配列
   */
  fire(
    x: number,
    y: number,
    directionX: number,
    directionY: number,
    width: number,
    height: number,
    maxRange: number,
    travelTime: number,
    damage: number,
    stunDuration: number,
    targets: Attackable[]
  ): void {
    this.projectileWidth = width;
    this.projectileHeight = height;
    // 長方形の先端が最大射程に到達するように調整（中心位置 = maxRange - height/2）
    this.maxRange = maxRange - height / 2;
    this.travelTime = travelTime;
    this.damage = damage;
    this.stunDuration = stunDuration;
    this.targets = targets;
    this.elapsedTime = 0;
    this.hitTargets.clear();
    this.isActive = true;

    // 進行方向の角度を保存
    this.directionAngle = Math.atan2(directionY, directionX);

    // 速度を計算（距離 / 時間）
    const speed = this.maxRange / travelTime;
    this.velocityX = directionX * speed;
    this.velocityY = directionY * speed;

    // 初期位置を設定
    this.setPosition(x, y);
    this.setActive(true);
    this.setVisible(true);

    // グラフィックを描画
    this.drawProjectile();
  }

  /**
   * 投射物を描画（進行方向に回転した長方形）
   */
  private drawProjectile(): void {
    this.graphics.clear();

    // 進行方向に90度足して長方形を横向きに（高さが進行方向）
    const rotation = this.directionAngle + Math.PI / 2;

    // 回転行列の計算用
    const cos = Math.cos(rotation);
    const sin = Math.sin(rotation);

    // 長方形の4頂点（中心を原点として）
    const halfW = this.projectileWidth / 2;
    const halfH = this.projectileHeight / 2;
    const corners = [
      { x: -halfW, y: -halfH }, // 左上
      { x: halfW, y: -halfH },  // 右上
      { x: halfW, y: halfH },   // 右下
      { x: -halfW, y: halfH },  // 左下
    ];

    // 回転を適用
    const rotatedCorners = corners.map(c => ({
      x: c.x * cos - c.y * sin,
      y: c.x * sin + c.y * cos,
    }));

    // 外枠（白）
    this.graphics.lineStyle(2, 0xffffff, 1);
    this.graphics.beginPath();
    this.graphics.moveTo(rotatedCorners[0].x, rotatedCorners[0].y);
    for (let i = 1; i < rotatedCorners.length; i++) {
      this.graphics.lineTo(rotatedCorners[i].x, rotatedCorners[i].y);
    }
    this.graphics.closePath();
    this.graphics.strokePath();

    // 内側（半透明の紫/封魔陣イメージ）
    this.graphics.fillStyle(0x9966ff, 0.6);
    this.graphics.beginPath();
    this.graphics.moveTo(rotatedCorners[0].x, rotatedCorners[0].y);
    for (let i = 1; i < rotatedCorners.length; i++) {
      this.graphics.lineTo(rotatedCorners[i].x, rotatedCorners[i].y);
    }
    this.graphics.closePath();
    this.graphics.fillPath();

    // 中央に円形のエフェクト
    this.graphics.fillStyle(0xffffff, 0.4);
    this.graphics.fillCircle(0, 0, Math.min(this.projectileWidth, this.projectileHeight) / 4);
  }

  /**
   * 更新処理
   */
  update(_time: number, delta: number): void {
    if (!this.isActive) return;

    this.elapsedTime += delta;

    // 位置を更新
    this.x += this.velocityX * delta;
    this.y += this.velocityY * delta;

    // 当たり判定
    this.checkCollisions();

    // 最大射程に到達したら消滅
    if (this.elapsedTime >= this.travelTime) {
      this.deactivate();
      return;
    }

    // プレイエリア外に出たら消滅
    const { X, Y, WIDTH, HEIGHT } = GAME_CONFIG.PLAY_AREA;
    const maxDim = Math.max(this.projectileWidth, this.projectileHeight);
    if (this.x < X - maxDim || this.x > X + WIDTH + maxDim ||
        this.y < Y - maxDim || this.y > Y + HEIGHT + maxDim) {
      this.deactivate();
    }
  }

  /**
   * 当たり判定（回転した長方形と円の衝突）
   */
  private checkCollisions(): void {
    // 回転角度
    const rotation = this.directionAngle + Math.PI / 2;
    const cos = Math.cos(-rotation); // 逆回転で敵座標を変換
    const sin = Math.sin(-rotation);

    const halfW = this.projectileWidth / 2;
    const halfH = this.projectileHeight / 2;

    for (const target of this.targets) {
      if (!target.getIsActive()) continue;
      if (this.hitTargets.has(target)) continue; // 既にヒット済み

      const targetRadius = target.getHitboxRadius();

      // 対象の座標を投射物のローカル座標系に変換（逆回転）
      const relX = target.x - this.x;
      const relY = target.y - this.y;
      const localX = relX * cos - relY * sin;
      const localY = relX * sin + relY * cos;

      // ローカル座標系での矩形と円の衝突判定
      const closestX = Phaser.Math.Clamp(localX, -halfW, halfW);
      const closestY = Phaser.Math.Clamp(localY, -halfH, halfH);

      const distanceX = localX - closestX;
      const distanceY = localY - closestY;
      const distanceSquared = distanceX * distanceX + distanceY * distanceY;

      if (distanceSquared < targetRadius * targetRadius) {
        // ヒット！
        this.onHitTarget(target);
      }
    }
  }

  /**
   * 対象にヒット
   */
  private onHitTarget(target: Attackable): void {
    this.hitTargets.add(target);

    // ダメージを与える（防御力考慮）
    const defenseReduction = 100 / (target.getDefense() + 100);
    const finalDamage = Math.max(1, Math.floor(this.damage * defenseReduction));
    target.takeDamage(finalDamage);

    // スタンを付与（applyStatusEffectがある場合のみ）
    if (this.stunDuration > 0 && 'applyStatusEffect' in target) {
      (target as { applyStatusEffect: (effect: { type: StatusEffectType; remainingTime: number; source: string }) => void }).applyStatusEffect({
        type: StatusEffectType.STUN,
        remainingTime: this.stunDuration,
        source: 'reimu_w',
      });
    }

    console.log(`W skill hit! Damage: ${finalDamage}, Stun: ${this.stunDuration}ms`);
  }

  /**
   * 非アクティブ化
   */
  deactivate(): void {
    this.isActive = false;
    this.setActive(false);
    this.setVisible(false);
    this.hitTargets.clear();
  }

  /**
   * アクティブ状態を取得
   */
  getIsActive(): boolean {
    return this.isActive;
  }

  /**
   * 破棄
   */
  destroy(fromScene?: boolean): void {
    this.graphics.destroy();
    super.destroy(fromScene);
  }
}
