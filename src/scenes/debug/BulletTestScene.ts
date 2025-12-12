import Phaser from 'phaser';
import { SCENES, GAME_CONFIG } from '@/config/GameConfig';
import { KSHOT, Bullet } from '@/entities/Bullet';
import { BulletType } from '@/types';

/**
 * 弾タイプ情報
 */
interface BulletTypeInfo {
  name: string;
  key: keyof typeof KSHOT;
  description: string;
}

/**
 * BulletTestScene - 弾幕テスト画面
 * 全弾タイプを確認・テストできる
 */
export class BulletTestScene extends Phaser.Scene {
  private bullets: Bullet[] = [];
  private hitboxGraphics: Phaser.GameObjects.Graphics[] = [];
  private currentTypeIndex: number = 0;
  private currentColorIndex: number = 0;
  private bulletTypes: BulletTypeInfo[] = [];
  private colorNames: string[] = [];
  private infoText!: Phaser.GameObjects.Text;
  private previewBullets: Phaser.GameObjects.Sprite[] = [];
  private autoFireEnabled: boolean = false;
  private autoFireTimer: number = 0;
  private showHitbox: boolean = true; // 当たり判定表示フラグ
  private bulletScale: number = 1; // 弾幕の表示倍率
  private scaleOptions: number[] = [1, 2, 3, 4]; // 選択可能な倍率
  private scaleIndex: number = 0; // 現在の倍率インデックス

  constructor() {
    super({ key: SCENES.BULLET_TEST });
  }

  create(): void {
    this.cameras.main.fadeIn(300);

    // 初期化
    this.bullets = [];
    this.hitboxGraphics = [];
    this.currentTypeIndex = 0;
    this.currentColorIndex = 0;
    this.previewBullets = [];
    this.autoFireEnabled = false;
    this.autoFireTimer = 0;
    this.showHitbox = true;
    this.bulletScale = 1;
    this.scaleIndex = 0;

    // 弾タイプ情報を初期化
    this.initBulletTypes();

    // 背景
    this.createBackground();

    // UI作成
    this.createUI();

    // プレビュー作成
    this.createPreview();

    // キーボード入力
    this.setupKeyboardInput();

    // マウス入力
    this.setupMouseInput();
  }

  /**
   * 弾タイプ情報を初期化
   */
  private initBulletTypes(): void {
    this.bulletTypes = [
      { name: '黒縁中玉', key: 'MEDIUM_BALL', description: '512x512px - 黒縁中玉（円形判定440px）' },
      { name: '輪弾', key: 'RINDAN', description: '278x278px - 輪弾（円形判定275px）' },
    ];

    // 初期状態の色リストを設定
    this.updateColorNames();
  }

  /**
   * 現在の弾タイプに応じた色リストを更新
   */
  private updateColorNames(): void {
    const type = this.bulletTypes[this.currentTypeIndex];
    if (type.key === 'MEDIUM_BALL') {
      this.colorNames = ['RED', 'ORANGE', 'YELLOW', 'GREEN', 'CYAN', 'BLUE', 'MAGENTA', 'WHITE'];
    } else if (type.key === 'RINDAN') {
      this.colorNames = ['RED', 'YELLOW', 'LIME', 'GREEN', 'CYAN', 'MAGENTA', 'PURPLE', 'BLUE'];
    }
    // 色インデックスが範囲外にならないよう調整
    if (this.currentColorIndex >= this.colorNames.length) {
      this.currentColorIndex = 0;
    }
  }

  /**
   * 背景を作成
   */
  private createBackground(): void {
    const graphics = this.add.graphics();
    graphics.fillStyle(0x1a1a2e, 1);
    graphics.fillRect(0, 0, GAME_CONFIG.WIDTH, GAME_CONFIG.HEIGHT);

    // グリッドパターン
    graphics.lineStyle(1, 0x333344, 0.5);
    const gridSize = 50;
    for (let x = 0; x < GAME_CONFIG.WIDTH; x += gridSize) {
      graphics.moveTo(x, 0);
      graphics.lineTo(x, GAME_CONFIG.HEIGHT);
    }
    for (let y = 0; y < GAME_CONFIG.HEIGHT; y += gridSize) {
      graphics.moveTo(0, y);
      graphics.lineTo(GAME_CONFIG.WIDTH, y);
    }
    graphics.strokePath();
  }

  /**
   * UIを作成
   */
  private createUI(): void {
    // タイトル
    this.add.text(20, 20, '弾幕テスト', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '32px',
      color: '#ffffff',
    });

    // 情報表示
    this.infoText = this.add.text(20, 70, '', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '20px',
      color: '#ffffff',
      lineSpacing: 8,
    });
    this.updateInfoText();

    // 操作説明
    this.add.text(20, GAME_CONFIG.HEIGHT - 160, [
      '【操作】',
      '←→: 弾タイプ切替  ↑↓: 色切替',
      'クリック: 弾発射  A: 自動発射ON/OFF',
      'H: 当たり判定表示切替  S: 倍率切替',
      'C: 弾クリア  Esc: 戻る',
    ].join('\n'), {
      fontFamily: 'Arial, sans-serif',
      fontSize: '16px',
      color: '#888888',
      lineSpacing: 4,
    });
  }

  /**
   * プレビューを作成
   */
  private createPreview(): void {
    this.updatePreview();
  }

  /**
   * プレビューを更新
   */
  private updatePreview(): void {
    // 既存のプレビューを削除
    this.previewBullets.forEach(b => b.destroy());
    this.previewBullets = [];

    const type = this.bulletTypes[this.currentTypeIndex];
    const kshotType = KSHOT[type.key];
    const startX = GAME_CONFIG.WIDTH - 300;
    const startY = 100;

    // 色数を取得
    const colorCount = this.colorNames.length;
    const availableColors = this.colorNames;

    // テクスチャ名を決定
    const textureName = this.getTextureNameForType(type.key);

    // 全色をプレビュー表示
    availableColors.forEach((colorName, index) => {
      const frameId = kshotType[colorName as keyof typeof kshotType];
      if (frameId === undefined) return;

      const cols = 4;
      const spacing = 60;
      const x = startX + (index % cols) * spacing;
      const y = startY + Math.floor(index / cols) * spacing;

      // RINDANは個別テクスチャなのでフレーム指定なし
      let sprite: Phaser.GameObjects.Sprite;
      if (type.key === 'RINDAN') {
        const rindanTexture = this.getTextureNameForType(type.key, frameId);
        sprite = this.add.sprite(x, y, rindanTexture);
        sprite.setScale(0.15); // 278px → 約42px表示
      } else {
        sprite = this.add.sprite(x, y, textureName, `kshot_${frameId}`);
        sprite.setScale(0.08); // 512px → 約40px表示
      }

      // 選択中の色はハイライト
      if (index === this.currentColorIndex) {
        sprite.setScale(type.key === 'RINDAN' ? 0.18 : 0.1);
        // 枠線を追加
        const highlight = this.add.graphics();
        highlight.lineStyle(2, 0xffff00, 1);
        highlight.strokeCircle(x, y, 30);
        this.previewBullets.push(highlight as unknown as Phaser.GameObjects.Sprite);
      }

      this.previewBullets.push(sprite);
    });

    // 色ラベル
    const actualColorIndex = Math.min(this.currentColorIndex, colorCount - 1);
    const colorLabel = this.add.text(startX, startY + 150, `選択中: ${availableColors[actualColorIndex]}`, {
      fontFamily: 'Arial, sans-serif',
      fontSize: '18px',
      color: '#ffff00',
    });
    this.previewBullets.push(colorLabel as unknown as Phaser.GameObjects.Sprite);
  }

  /**
   * 弾タイプに対応するテクスチャ名を取得
   * @param typeKey 弾タイプキー
   * @param frameId フレームID（RINDANは個別テクスチャなので必要）
   */
  private getTextureNameForType(typeKey: string, frameId?: number): string {
    switch (typeKey) {
      case 'MEDIUM_BALL':
        return 'kshot_medium_ball';
      case 'RINDAN':
        // 輪弾は個別テクスチャ
        return frameId !== undefined ? `rindan_${frameId}` : 'rindan_9';
      default:
        return 'kshot_medium_ball';
    }
  }

  /**
   * 情報テキストを更新
   */
  private updateInfoText(): void {
    const type = this.bulletTypes[this.currentTypeIndex];
    const color = this.colorNames[this.currentColorIndex];
    const kshotType = KSHOT[type.key];
    const frameId = kshotType[color as keyof typeof kshotType];

    this.infoText.setText([
      `タイプ: ${type.name} (KSHOT.${type.key})`,
      `色: ${color}`,
      `フレームID: ${frameId}`,
      `説明: ${type.description}`,
      ``,
      `自動発射: ${this.autoFireEnabled ? 'ON' : 'OFF'}`,
      `当たり判定表示: ${this.showHitbox ? 'ON' : 'OFF'}`,
      `表示倍率: ${this.bulletScale}x`,
      `弾数: ${this.bullets.filter(b => b.active).length}`,
    ].join('\n'));
  }

  /**
   * キーボード入力を設定
   */
  private setupKeyboardInput(): void {
    this.input.keyboard?.on('keydown-LEFT', () => {
      this.currentTypeIndex = (this.currentTypeIndex - 1 + this.bulletTypes.length) % this.bulletTypes.length;
      this.updateColorNames();
      this.updateInfoText();
      this.updatePreview();
    });

    this.input.keyboard?.on('keydown-RIGHT', () => {
      this.currentTypeIndex = (this.currentTypeIndex + 1) % this.bulletTypes.length;
      this.updateColorNames();
      this.updateInfoText();
      this.updatePreview();
    });

    this.input.keyboard?.on('keydown-UP', () => {
      this.currentColorIndex = (this.currentColorIndex - 1 + this.colorNames.length) % this.colorNames.length;
      this.updateInfoText();
      this.updatePreview();
    });

    this.input.keyboard?.on('keydown-DOWN', () => {
      this.currentColorIndex = (this.currentColorIndex + 1) % this.colorNames.length;
      this.updateInfoText();
      this.updatePreview();
    });

    this.input.keyboard?.on('keydown-A', () => {
      this.autoFireEnabled = !this.autoFireEnabled;
      this.updateInfoText();
    });

    this.input.keyboard?.on('keydown-C', () => {
      this.clearBullets();
    });

    this.input.keyboard?.on('keydown-H', () => {
      this.showHitbox = !this.showHitbox;
      this.updateInfoText();
    });

    this.input.keyboard?.on('keydown-S', () => {
      this.scaleIndex = (this.scaleIndex + 1) % this.scaleOptions.length;
      this.bulletScale = this.scaleOptions[this.scaleIndex];
      this.updateInfoText();
    });

    this.input.keyboard?.on('keydown-ESC', () => {
      this.goBack();
    });
  }

  /**
   * マウス入力を設定
   */
  private setupMouseInput(): void {
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.fireBullet(pointer.x, pointer.y);
    });
  }

  /**
   * 弾を発射
   */
  private fireBullet(targetX: number, targetY: number): void {
    const type = this.bulletTypes[this.currentTypeIndex];
    const kshotType = KSHOT[type.key];

    // 色数を取得
    const colorCount = this.colorNames.length;
    const actualColorIndex = Math.min(this.currentColorIndex, colorCount - 1);
    const color = this.colorNames[actualColorIndex];

    const frameId = kshotType[color as keyof typeof kshotType];
    if (frameId === undefined) return;

    // 画面中央から発射
    const startX = GAME_CONFIG.WIDTH / 2;
    const startY = GAME_CONFIG.HEIGHT / 2;

    const bullet = new Bullet(this, startX, startY);
    this.physics.add.existing(bullet);

    bullet.fire(
      startX,
      startY,
      targetX,
      targetY,
      BulletType.ENEMY_NORMAL,
      0, // ダメージ（テストなので0）
      null,
      false,
      frameId
    );

    // 弾を半透明にして当たり判定が見えるように
    bullet.setAlpha(0.6);

    // 表示倍率を適用
    bullet.setScale(this.bulletScale);

    // 当たり判定表示用のグラフィックスを作成
    const hitboxGraphic = this.add.graphics();
    hitboxGraphic.setDepth(1000); // 弾より上に表示
    this.hitboxGraphics.push(hitboxGraphic);

    this.bullets.push(bullet);
    this.updateInfoText();
  }

  /**
   * 自動発射
   */
  private autoFire(): void {
    const centerX = GAME_CONFIG.WIDTH / 2;
    const centerY = GAME_CONFIG.HEIGHT / 2;
    const angle = (this.autoFireTimer / 100) * Math.PI * 2;
    const targetX = centerX + Math.cos(angle) * 300;
    const targetY = centerY + Math.sin(angle) * 300;

    this.fireBullet(targetX, targetY);
  }

  /**
   * 弾をクリア
   */
  private clearBullets(): void {
    this.bullets.forEach(bullet => {
      bullet.destroy();
    });
    this.bullets = [];

    // 当たり判定グラフィックスもクリア
    this.hitboxGraphics.forEach(g => g.destroy());
    this.hitboxGraphics = [];

    this.updateInfoText();
  }

  /**
   * 戻る
   */
  private goBack(): void {
    this.clearBullets();
    this.cameras.main.fadeOut(300, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start(SCENES.DEBUG_ROOM);
    });
  }

  update(_time: number, delta: number): void {
    // 弾の更新
    this.bullets.forEach(bullet => {
      bullet.update();
    });

    // 画面外の弾を削除（対応するグラフィックスも削除）
    const newBullets: Bullet[] = [];
    const newGraphics: Phaser.GameObjects.Graphics[] = [];

    for (let i = 0; i < this.bullets.length; i++) {
      const bullet = this.bullets[i];
      const graphic = this.hitboxGraphics[i];

      if (bullet.active) {
        newBullets.push(bullet);
        newGraphics.push(graphic);
      } else {
        bullet.destroy();
        if (graphic) graphic.destroy();
      }
    }

    this.bullets = newBullets;
    this.hitboxGraphics = newGraphics;

    // 当たり判定の描画更新
    this.updateHitboxGraphics();

    // 自動発射
    if (this.autoFireEnabled) {
      this.autoFireTimer += delta;
      if (this.autoFireTimer >= 100) { // 100msごとに発射
        this.autoFire();
        this.autoFireTimer = 0;
      }
    }

    this.updateInfoText();
  }

  /**
   * 当たり判定グラフィックスを更新
   */
  private updateHitboxGraphics(): void {
    for (let i = 0; i < this.bullets.length; i++) {
      const bullet = this.bullets[i];
      const graphic = this.hitboxGraphics[i];

      if (!graphic || !bullet.active) continue;

      graphic.clear();

      if (this.showHitbox) {
        // 当たり判定を描画（黒い縁）
        const body = bullet.body as Phaser.Physics.Arcade.Body;
        if (body) {
          graphic.lineStyle(2, 0x000000, 1);

          // 弾のスケールを取得（表示に合わせて当たり判定も拡大表示）
          const scale = bullet.scaleX;

          // 円形判定と矩形判定を区別
          if (body.isCircle) {
            const radius = (body.radius || 5) * scale;
            graphic.strokeCircle(bullet.x, bullet.y, radius);
          } else {
            // 矩形判定（LASER弾など）- 弾の回転に合わせて描画
            // Phaserのbody.widthはスプライトのスケールを自動反映するため、スケールを適用しない
            const width = body.width;
            const height = body.height;
            const rotation = bullet.rotation;

            // 回転した矩形の4頂点を計算
            const cos = Math.cos(rotation);
            const sin = Math.sin(rotation);
            const hw = width / 2;
            const hh = height / 2;

            // 4頂点（左上、右上、右下、左下）
            const corners = [
              { x: -hw, y: -hh },
              { x: hw, y: -hh },
              { x: hw, y: hh },
              { x: -hw, y: hh },
            ];

            // 回転を適用
            const rotatedCorners = corners.map(c => ({
              x: bullet.x + c.x * cos - c.y * sin,
              y: bullet.y + c.x * sin + c.y * cos,
            }));

            // 回転した矩形を描画
            graphic.beginPath();
            graphic.moveTo(rotatedCorners[0].x, rotatedCorners[0].y);
            for (let j = 1; j < rotatedCorners.length; j++) {
              graphic.lineTo(rotatedCorners[j].x, rotatedCorners[j].y);
            }
            graphic.closePath();
            graphic.strokePath();
          }

          // 中心点
          graphic.fillStyle(0x000000, 1);
          graphic.fillCircle(bullet.x, bullet.y, 2);
        }
      }
    }
  }
}
