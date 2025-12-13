import Phaser from 'phaser';
import { BulletType, Attackable } from '@/types';
import { DEPTH, GAME_CONFIG } from '@/config/GameConfig';

/**
 * 弾フレームID定数
 *
 * 黒縁中玉 (kshot_medium_ball.png): 4096x512px
 * - 各弾512x512px × 8色 = ID 1-8
 * - 当たり判定: 440x440px (円形、半径220px)
 *
 * 輪弾 (rindan_*.png): 各278x278px × 8色
 * - 各色別ファイル = ID 9-16
 * - 当たり判定: 275x275px (円形、半径137.5px)
 */
export const KSHOT = {
  // 黒縁中玉 (ID 1-8) - 512x512px
  MEDIUM_BALL: {
    RED: 1,
    ORANGE: 2,
    YELLOW: 3,
    GREEN: 4,
    CYAN: 5,
    BLUE: 6,
    MAGENTA: 7,
    WHITE: 8,
  },
  // 輪弾 (ID 9-16) - 278x278px
  RINDAN: {
    RED: 9,
    YELLOW: 10,
    LIME: 11,
    GREEN: 12,
    CYAN: 13,
    MAGENTA: 14,
    PURPLE: 15,
    BLUE: 16,
  },
} as const;

/**
 * 弾クラス
 */
export class Bullet extends Phaser.Physics.Arcade.Sprite {
  private bulletType: BulletType;
  private damage: number;
  private speed: number;
  private isActive: boolean = false;
  private target: Attackable | null = null; // 追尾対象（Enemy または Boss）
  private startX: number = 0; // 発射開始位置X
  private startY: number = 0; // 発射開始位置Y
  private isCritical: boolean = false; // クリティカルヒットフラグ
  private kshotFrameId: number | null = null; // kShotフレームID（使用時）
  private hasEnteredPlayArea: boolean = false; // プレイエリアに入ったことがあるか
  private fireTime: number = 0; // 発射時刻（猶予時間用）

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'bullet_player');

    // 初期値
    this.bulletType = BulletType.PLAYER_NORMAL;
    this.damage = 10;
    this.speed = 600; // AA弾速（600px/s）

    // 物理エンジンに追加
    scene.add.existing(this);
    scene.physics.add.existing(this);

    // 初期設定
    this.setActive(false);
    this.setVisible(false);
    this.setDepth(DEPTH.BULLETS_PLAYER);

    // 当たり判定（プレイヤー弾は大きめ、敵弾は小さめ）
    const body = this.body as Phaser.Physics.Arcade.Body;
    if (body) {
      body.setCircle(4); // デフォルトは敵弾サイズ
    }
  }

  /**
   * 弾を発射
   * @param kshotFrameId kShotスプライトシートのフレームID（省略時は従来のテクスチャを使用）
   */
  fire(
    x: number,
    y: number,
    targetX: number,
    targetY: number,
    bulletType: BulletType = BulletType.PLAYER_NORMAL,
    damage: number = 10,
    target: Attackable | null = null,
    isCritical: boolean = false,
    kshotFrameId: number | null = null
  ): void {
    this.bulletType = bulletType;
    this.damage = damage;
    this.isActive = true;
    this.target = target;
    this.isCritical = isCritical;
    this.kshotFrameId = kshotFrameId;
    this.hasEnteredPlayArea = false; // プレイエリア入場フラグをリセット
    this.fireTime = this.scene.time.now; // 発射時刻を記録

    // 発射開始位置を記録
    this.startX = x;
    this.startY = y;

    // 物理ボディを有効化（重要: setActive/setVisibleの前に行う）
    const body = this.body as Phaser.Physics.Arcade.Body;
    if (body) {
      body.enable = true;
    }

    // 位置を設定（setPositionの前にbodyを有効化）
    // 注: setPositionオーバーライドで自動的にプレイエリア判定と表示制御が行われる
    this.setPosition(x, y);
    this.setActive(true);
    this.setScale(1); // スケールを明示的に1に設定
    this.setAlpha(1); // 透明度を明示的に1に設定

    // テクスチャと色を設定
    if (kshotFrameId !== null) {
      // テクスチャ名を決定（フレームIDに応じて切り替え）
      const textureName = this.getTextureNameForFrameId(kshotFrameId);
      // 輪弾(ID 9-16)は個別テクスチャなのでフレーム指定なし
      if (kshotFrameId >= 9 && kshotFrameId <= 16) {
        this.setTexture(textureName);
      } else {
        this.setTexture(textureName, `kshot_${kshotFrameId}`);
      }
      this.clearTint();
      this.setScale(1);
      // 当たり判定
      const bodyRef = this.body as Phaser.Physics.Arcade.Body;
      if (bodyRef) {
        const hitboxRadius = this.getKshotHitboxRadius(kshotFrameId);
        bodyRef.setCircle(hitboxRadius);
      }
    } else if (bulletType === BulletType.PLAYER_NORMAL) {
      this.setTexture('reimu_aa');
      this.clearTint(); // テクスチャ自体に色があるのでTintなし
      this.setScale(0.5); // 画像サイズに応じてスケール調整
      // プレイヤー弾は当たり判定を大きめに
      const bodyRef = this.body as Phaser.Physics.Arcade.Body;
      if (bodyRef) {
        bodyRef.setCircle(8);
      }
    } else if (bulletType === BulletType.ENEMY_NORMAL || bulletType === BulletType.ENEMY_AIMED) {
      this.setTexture('bullet_enemy');
      this.clearTint(); // テクスチャ自体に色があるのでTintなし
      // 敵弾のサイズ（視覚・当たり判定）
      this.setScale(0.8); // 視覚的に0.8倍
      const bodyRef = this.body as Phaser.Physics.Arcade.Body;
      if (bodyRef) {
        bodyRef.setCircle(10); // 当たり判定
      }
    }

    // 初期方向を計算
    const angle = Phaser.Math.Angle.Between(x, y, targetX, targetY);

    // 速度を設定
    this.setVelocity(
      Math.cos(angle) * this.speed,
      Math.sin(angle) * this.speed
    );

    // 回転を設定（弾の向き）
    if (kshotFrameId === null) {
      this.setRotation(angle);
    } else {
      // 方向のある弾は進行方向に回転（左側が弾頭なのでπを加算）
      if (this.isDirectionalBullet(kshotFrameId)) {
        this.setRotation(angle + Math.PI);
      } else {
        this.setRotation(0); // 丸弾は回転させない
      }
    }
  }

  /**
   * 位置設定をオーバーライド（hasEnteredPlayAreaフラグを更新）
   * fire()後にsetPosition()で位置を変更した場合に対応
   */
  setPosition(x?: number, y?: number, z?: number, w?: number): this {
    super.setPosition(x, y, z, w);

    // アクティブな弾の場合、位置に応じてフラグと表示を更新
    if (this.isActive && x !== undefined && y !== undefined) {
      const { X, Y, WIDTH, HEIGHT } = GAME_CONFIG.PLAY_AREA;
      const isInsidePlayArea = x >= X && x <= X + WIDTH && y >= Y && y <= Y + HEIGHT;

      if (isInsidePlayArea) {
        // プレイエリア内に入った
        this.hasEnteredPlayArea = true;
        this.setVisible(true);
      } else {
        // プレイエリア外に配置された場合、フラグをリセットして非表示に
        // （弾列形成のため後方に配置される場合への対応）
        this.hasEnteredPlayArea = false;
        this.setVisible(false);
      }
    }

    return this;
  }

  /**
   * 更新処理
   */
  update(): void {
    if (!this.isActive) {
      return;
    }

    // 追尾処理（プレイヤーの弾のみ）
    if (this.bulletType === BulletType.PLAYER_NORMAL && this.target) {
      // ターゲットが死んでいたら弾も消滅（LoL風必中システム）
      if (!this.target.getIsActive()) {
        this.deactivate();
        return;
      }

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

    // プレイエリア判定
    const { X, Y, WIDTH, HEIGHT } = GAME_CONFIG.PLAY_AREA;
    const isInsidePlayArea = this.x >= X && this.x <= X + WIDTH &&
                             this.y >= Y && this.y <= Y + HEIGHT;

    // プレイエリアに入ったらフラグを立てて表示
    if (isInsidePlayArea && !this.hasEnteredPlayArea) {
      this.hasEnteredPlayArea = true;
      this.setVisible(true);
    }

    // プレイエリア外にいる弾は非表示にする（常に）
    if (!isInsidePlayArea) {
      this.setVisible(false);
    } else {
      this.setVisible(true);
    }

    // 弾が発射位置から一定距離を移動するまでは保護する（消さない）
    const MIN_TRAVEL_DISTANCE = 300; // 最低移動距離（px）
    const distanceFromStart = Phaser.Math.Distance.Between(this.startX, this.startY, this.x, this.y);
    const isProtected = distanceFromStart <= MIN_TRAVEL_DISTANCE;

    // プレイエリアに一度入った後に出たら非アクティブ化
    // ただし、弾が発射位置から一定距離を移動するまでは消さない
    if (this.hasEnteredPlayArea && !isInsidePlayArea && !isProtected) {
      this.deactivate();
    }

    // プレイエリアに入っていない弾でも、極端に遠い場合は消す（プール枯渇防止）
    // ただし、発射から一定時間は猶予を与える（弾列形成のため後方に配置される弾への対応）
    const GRACE_PERIOD = 2000; // 発射から2秒間は猶予
    const timeSinceFire = this.scene.time.now - this.fireTime;
    const FAR_BOUNDARY = 500;
    const isTooFarAway = this.x < X - FAR_BOUNDARY || this.x > X + WIDTH + FAR_BOUNDARY ||
                         this.y < Y - FAR_BOUNDARY || this.y > Y + HEIGHT + FAR_BOUNDARY;
    if (!this.hasEnteredPlayArea && isTooFarAway && timeSinceFire > GRACE_PERIOD) {
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

    // 物理ボディを無効化
    const body = this.body as Phaser.Physics.Arcade.Body;
    if (body) {
      body.enable = false;
    }
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

  /**
   * 発射開始位置を取得
   */
  getStartPosition(): { x: number; y: number } {
    return { x: this.startX, y: this.startY };
  }

  /**
   * クリティカルヒットかどうか
   */
  getIsCritical(): boolean {
    return this.isCritical;
  }

  /**
   * kShotフレームIDを取得
   */
  getKshotFrameId(): number | null {
    return this.kshotFrameId;
  }

  /**
   * フレームIDに対応するテクスチャ名を取得
   */
  private getTextureNameForFrameId(frameId: number): string {
    // 黒縁中玉 (ID 1-8)
    if (frameId >= 1 && frameId <= 8) return 'kshot_medium_ball';
    // 輪弾 (ID 9-16)
    if (frameId >= 9 && frameId <= 16) return `rindan_${frameId}`;
    // デフォルト
    return 'kshot_medium_ball';
  }

  /**
   * 弾フレームIDから当たり判定の半径を取得
   * 当たり判定は画像サイズより小さく設定
   */
  private getKshotHitboxRadius(frameId: number): number {
    // 黒縁中玉 (ID 1-8): 512x512px → 当たり判定440x440px → 半径220px
    if (frameId >= 1 && frameId <= 8) return 220;
    // 輪弾 (ID 9-16): 278x278px → 当たり判定275x275px → 半径137.5px
    if (frameId >= 9 && frameId <= 16) return 137.5;
    // デフォルト
    return 4;
  }

  /**
   * 方向のある弾かどうかを判定
   * これらの弾は進行方向に回転する
   * TODO: 新しい弾幕画像に合わせて設定を追加してください
   */
  private isDirectionalBullet(_frameId: number): boolean {
    // デフォルト: 回転しない（新しい弾幕画像に合わせて調整してください）
    return false;
  }
}
