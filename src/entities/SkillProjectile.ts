import Phaser from 'phaser';
import { StatusEffectType, Attackable } from '@/types';
import { DEPTH, GAME_CONFIG } from '@/config/GameConfig';
import { AudioManager } from '@/systems/AudioManager';

// 命中時コールバックの型定義
export type OnHitCallback = (target: Attackable, damage: number, didBreak: boolean) => void;

// 投射物発射のオプション
export interface FireOptions {
  slowDuration?: number;       // スロウ持続時間（ms）
  slowAmount?: number;         // スロウ量（0.0-1.0）
  onHitCallback?: OnHitCallback; // 命中時コールバック
  skillSource?: string;        // スキルソース識別子
  color?: number;              // 投射物の色
  speed?: number;              // 弾速（px/s）- 指定時はtravelTimeを無視
  textureKey?: string;         // 画像テクスチャキー（指定時はグラフィックスの代わりに画像を使用）
}

/**
 * スキル用の投射物（長方形弾など）
 */
export class SkillProjectile extends Phaser.GameObjects.Container {
  private graphics: Phaser.GameObjects.Graphics;
  private sprite: Phaser.GameObjects.Image | null = null; // 画像表示用
  private projectileWidth: number;   // 幅（進行方向に対して横）
  private projectileHeight: number;  // 高さ（進行方向に対して縦）
  private damage: number;
  private stunDuration: number;
  private slowDuration: number = 0;  // スロウ持続時間
  private slowAmount: number = 0;    // スロウ量（0.0-1.0）
  private isActive: boolean = false;
  private maxRange: number = 0;
  private travelTime: number = 0;
  private elapsedTime: number = 0;
  private velocityX: number = 0;
  private velocityY: number = 0;
  private directionAngle: number = 0; // 進行方向の角度（ラジアン）
  private hitTargets: Set<Attackable> = new Set(); // 既にヒットした対象（多段ヒット防止）
  private targets: Attackable[] = []; // 攻撃対象（敵とボス）
  private onHitCallback: OnHitCallback | null = null; // 命中時コールバック
  private skillSource: string = 'skill'; // スキルソース識別子
  private projectileColor: number = 0x9966ff; // 投射物の色
  private useSprite: boolean = false; // 画像を使用するか

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
   * @param travelTime 射程到達までの時間（ms）- speedが指定されている場合は無視
   * @param damage ダメージ量
   * @param stunDuration スタン時間（ms）
   * @param targets 攻撃対象配列
   * @param options オプション設定
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
    targets: Attackable[],
    options?: FireOptions
  ): void {
    this.projectileWidth = width;
    this.projectileHeight = height;
    // 長方形の先端が最大射程に到達するように調整（中心位置 = maxRange - height/2）
    this.maxRange = maxRange - height / 2;
    this.damage = damage;
    this.stunDuration = stunDuration;
    this.targets = targets;
    this.elapsedTime = 0;
    this.hitTargets.clear();
    this.isActive = true;

    // オプションを適用
    this.slowDuration = options?.slowDuration ?? 0;
    this.slowAmount = options?.slowAmount ?? 0;
    this.onHitCallback = options?.onHitCallback ?? null;
    this.skillSource = options?.skillSource ?? 'skill';
    this.projectileColor = options?.color ?? 0x9966ff;

    // 画像テクスチャの処理
    this.useSprite = !!options?.textureKey;
    if (this.useSprite && options?.textureKey) {
      // 既存のスプライトがあれば削除
      if (this.sprite) {
        this.sprite.destroy();
      }
      // 新しいスプライトを作成
      this.sprite = this.scene.add.image(0, 0, options.textureKey);
      this.sprite.setDisplaySize(width, height);
      this.add(this.sprite);
      // グラフィックスは非表示に
      this.graphics.setVisible(false);
    } else {
      // グラフィックスを表示
      this.graphics.setVisible(true);
      if (this.sprite) {
        this.sprite.setVisible(false);
      }
    }

    // 進行方向の角度を保存
    this.directionAngle = Math.atan2(directionY, directionX);

    // 速度を計算
    let speed: number;
    if (options?.speed) {
      // 弾速が指定されている場合はそれを使用（px/s → px/ms に変換）
      speed = options.speed / 1000;
      this.travelTime = this.maxRange / speed;
    } else {
      // travelTimeから速度を計算
      this.travelTime = travelTime;
      speed = this.maxRange / travelTime;
    }
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
    // 進行方向に90度足して長方形を横向きに（高さが進行方向）
    const rotation = this.directionAngle + Math.PI / 2;

    // 画像を使用する場合
    if (this.useSprite && this.sprite) {
      this.sprite.setRotation(rotation);
      return;
    }

    // グラフィックスで描画
    this.graphics.clear();

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

    // 内側（半透明、色はオプションで指定可能）
    this.graphics.fillStyle(this.projectileColor, 0.6);
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
        this.onHitTargetInternal(target);
      }
    }
  }

  /**
   * 対象がCC無効かどうかをチェック
   */
  private isCCImmune(target: Attackable): boolean {
    if ('hasStatusEffect' in target) {
      return (target as { hasStatusEffect: (type: StatusEffectType) => boolean }).hasStatusEffect(StatusEffectType.CC_IMMUNE);
    }
    return false;
  }

  /**
   * 対象にヒット（内部処理）
   */
  private onHitTargetInternal(target: Attackable): void {
    this.hitTargets.add(target);

    // ダメージを与える（防御力考慮）
    const defenseReduction = 100 / (target.getDefense() + 100);
    const finalDamage = Math.max(1, Math.floor(this.damage * defenseReduction));
    const didBreak = target.takeDamage(finalDamage);

    // CC無効チェック
    const ccImmune = this.isCCImmune(target);

    // スタンを付与（applyStatusEffectがある場合のみ、CC無効でない場合）
    if (this.stunDuration > 0 && 'applyStatusEffect' in target && !ccImmune) {
      (target as { applyStatusEffect: (effect: { type: StatusEffectType; remainingTime: number; source: string; value?: number }) => void }).applyStatusEffect({
        type: StatusEffectType.STUN,
        remainingTime: this.stunDuration,
        source: this.skillSource,
      });
    }

    // スロウを付与（applyStatusEffectがある場合のみ、CC無効でない場合）
    if (this.slowDuration > 0 && this.slowAmount > 0 && 'applyStatusEffect' in target && !ccImmune) {
      (target as { applyStatusEffect: (effect: { type: StatusEffectType; remainingTime: number; source: string; value?: number }) => void }).applyStatusEffect({
        type: StatusEffectType.SLOW,
        remainingTime: this.slowDuration,
        source: this.skillSource,
        value: this.slowAmount,
      });
    }

    // ヒットSEを再生
    AudioManager.getInstance().playSe('se_hit_arrow');

    // コールバックを呼び出し
    if (this.onHitCallback) {
      this.onHitCallback(target, finalDamage, didBreak);
    }

    console.log(`${this.skillSource} hit! Damage: ${finalDamage}, Stun: ${this.stunDuration}ms, Slow: ${this.slowAmount * 100}% for ${this.slowDuration}ms${ccImmune ? ' (CC immune)' : ''}`);
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
    if (this.sprite) {
      this.sprite.destroy();
    }
    super.destroy(fromScene);
  }
}
