import Phaser from 'phaser';
import { SCENES, GAME_CONFIG } from '@/config/GameConfig';
import { AudioManager } from '@/systems/AudioManager';

/**
 * TitleScene - タイトル画面
 */
export class TitleScene extends Phaser.Scene {
  private menuItems: Phaser.GameObjects.Text[] = [];
  private selectedIndex: number = 0;
  private hasInteracted: boolean = false; // 初回操作フラグ

  constructor() {
    super({ key: SCENES.TITLE });
  }

  create(): void {
    // カメラのフェード状態をリセットしてからフェードイン
    this.cameras.main.resetFX();
    this.cameras.main.fadeIn(300);

    // 状態リセット
    this.menuItems = [];
    this.selectedIndex = 0;
    this.hasInteracted = false;

    // タイトルBGMを再生
    const audioManager = AudioManager.getInstance();
    audioManager.setScene(this);
    audioManager.playBgm('bgm_title');

    const centerX = GAME_CONFIG.WIDTH / 2;
    const centerY = GAME_CONFIG.HEIGHT / 2;

    // 背景
    this.createBackground();

    // タイトルロゴ
    this.add.text(centerX, centerY - 200, 'MOBA x 東方', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '72px',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 4,
    }).setOrigin(0.5);

    this.add.text(centerX, centerY - 120, '〜弾幕幻想郷〜', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '36px',
      color: '#aaaaff',
    }).setOrigin(0.5);

    // バージョン表示
    this.add.text(20, GAME_CONFIG.HEIGHT - 30, 'Version 0.1.0', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '16px',
      color: '#888888',
    });

    // メニューを直接表示
    this.createMenu();

    // キーボード入力
    this.setupKeyboardInput();

    // 画面クリックでAudioContextを再開（ブラウザのAutoPlay Policy対策）
    this.input.once('pointerdown', () => {
      if (!this.hasInteracted) {
        const audioManager = AudioManager.getInstance();
        audioManager.resumeOnUserGesture();
        audioManager.playBgm('bgm_title');
      }
    });
  }

  /**
   * 背景を作成
   */
  private createBackground(): void {
    // グラデーション風の背景
    const graphics = this.add.graphics();
    graphics.fillGradientStyle(0x1a1a2e, 0x1a1a2e, 0x16213e, 0x16213e, 1);
    graphics.fillRect(0, 0, GAME_CONFIG.WIDTH, GAME_CONFIG.HEIGHT);

    // 装飾的な弾幕パターン（背景）
    this.createBackgroundBullets();
  }

  /**
   * 背景に装飾的な弾幕を追加
   */
  private createBackgroundBullets(): void {
    const bulletCount = 50;
    for (let i = 0; i < bulletCount; i++) {
      const x = Phaser.Math.Between(0, GAME_CONFIG.WIDTH);
      const y = Phaser.Math.Between(0, GAME_CONFIG.HEIGHT);
      const radius = Phaser.Math.Between(3, 8);
      const alpha = Phaser.Math.FloatBetween(0.1, 0.3);

      const bullet = this.add.circle(x, y, radius, 0x4444aa, alpha);

      // ゆっくり動くアニメーション
      this.tweens.add({
        targets: bullet,
        y: y + Phaser.Math.Between(50, 150),
        duration: Phaser.Math.Between(3000, 6000),
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }
  }

  /**
   * メニューを作成
   */
  private createMenu(): void {
    const centerX = GAME_CONFIG.WIDTH / 2;
    const menuStartY = GAME_CONFIG.HEIGHT / 2 + 50;

    const menuOptions = [
      { text: 'ゲームスタート', scene: SCENES.MODE_SELECT },
      { text: 'オプション', scene: SCENES.OPTION },
      { text: 'クレジット', scene: SCENES.CREDIT },
      { text: 'デバッグルーム', scene: SCENES.DEBUG_ROOM },
    ];

    menuOptions.forEach((option, index) => {
      const menuItem = this.add.text(centerX, menuStartY + index * 50, option.text, {
        fontFamily: 'Arial, sans-serif',
        fontSize: '32px',
        color: index === 0 ? '#ffff00' : '#ffffff',
      }).setOrigin(0.5);

      menuItem.setInteractive({ useHandCursor: true });

      menuItem.on('pointerover', () => {
        this.selectMenuItem(index);
      });

      // シーン開始時にマウスが既にボタン上にある場合にも対応
      menuItem.on('pointermove', () => {
        if (!this.hasInteracted) {
          this.selectMenuItem(index);
        }
      });

      menuItem.on('pointerdown', () => {
        this.confirmSelection();
      });

      this.menuItems.push(menuItem);
    });
  }

  /**
   * キーボード入力を設定
   */
  private setupKeyboardInput(): void {
    this.input.keyboard?.on('keydown-UP', () => {
      this.selectMenuItem((this.selectedIndex - 1 + this.menuItems.length) % this.menuItems.length);
    });

    this.input.keyboard?.on('keydown-DOWN', () => {
      this.selectMenuItem((this.selectedIndex + 1) % this.menuItems.length);
    });

    this.input.keyboard?.on('keydown-ENTER', () => {
      this.confirmSelection();
    });

    this.input.keyboard?.on('keydown-SPACE', () => {
      this.confirmSelection();
    });
  }

  /**
   * メニュー項目を選択
   */
  private selectMenuItem(index: number): void {
    // 同じ項目で既に操作済みなら何もしない
    if (index === this.selectedIndex && this.hasInteracted) return;

    const audioManager = AudioManager.getInstance();

    // 初回操作時にAudioContextを再開してBGMを再生
    if (!this.hasInteracted) {
      audioManager.resumeOnUserGesture();
      // BGMがまだ再生されていなければ再生
      audioManager.playBgm('bgm_title');
    }

    // 選択SEを再生
    audioManager.playSe('se_select');
    this.hasInteracted = true;

    // 前の選択を解除
    if (this.menuItems[this.selectedIndex]) {
      this.menuItems[this.selectedIndex].setColor('#ffffff');
    }

    // 新しい選択
    this.selectedIndex = index;
    if (this.menuItems[this.selectedIndex]) {
      this.menuItems[this.selectedIndex].setColor('#ffff00');
    }
  }

  /**
   * 選択を確定
   */
  private confirmSelection(): void {
    // 決定SEを再生
    AudioManager.getInstance().playSe('se_decision');

    const scenes = [SCENES.MODE_SELECT, SCENES.OPTION, SCENES.CREDIT, SCENES.DEBUG_ROOM];
    const targetScene = scenes[this.selectedIndex];

    // フェードアウトして遷移
    this.cameras.main.fadeOut(300, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start(targetScene);
    });
  }
}
