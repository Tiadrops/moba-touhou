import Phaser from 'phaser';
import { SCENES, GAME_CONFIG } from '@/config/GameConfig';

/**
 * DebugRoomScene - デバッグルーム
 * 各種デバッグ機能へアクセスするためのメニュー画面
 */
export class DebugRoomScene extends Phaser.Scene {
  private menuItems: Phaser.GameObjects.Text[] = [];
  private selectedIndex: number = 0;
  private menuOptions: { text: string; scene: string | null; action?: () => void }[] = [];

  constructor() {
    super({ key: SCENES.DEBUG_ROOM });
  }

  create(): void {
    this.cameras.main.fadeIn(300);

    // 状態リセット
    this.menuItems = [];
    this.selectedIndex = 0;

    const centerX = GAME_CONFIG.WIDTH / 2;

    // 背景
    this.createBackground();

    // タイトル
    this.add.text(centerX, 80, 'DEBUG ROOM', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '48px',
      color: '#ff6600',
      stroke: '#000000',
      strokeThickness: 4,
    }).setOrigin(0.5);

    this.add.text(centerX, 130, '開発・デバッグ用メニュー', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '20px',
      color: '#888888',
    }).setOrigin(0.5);

    // メニュー作成
    this.createMenu();

    // キーボード入力
    this.setupKeyboardInput();
  }

  /**
   * 背景を作成
   */
  private createBackground(): void {
    const graphics = this.add.graphics();
    // 暗めの赤/オレンジ系グラデーション（デバッグ感）
    graphics.fillGradientStyle(0x2a1a1a, 0x2a1a1a, 0x1a1a2a, 0x1a1a2a, 1);
    graphics.fillRect(0, 0, GAME_CONFIG.WIDTH, GAME_CONFIG.HEIGHT);

    // グリッドパターン
    graphics.lineStyle(1, 0x333333, 0.3);
    const gridSize = 40;
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
   * メニューを作成
   */
  private createMenu(): void {
    const centerX = GAME_CONFIG.WIDTH / 2;
    const menuStartY = 220;

    this.menuOptions = [
      { text: '弾幕テスト', scene: SCENES.BULLET_TEST },
      { text: 'カットインテスト', scene: SCENES.CUTIN_TEST },
      // 今後追加するメニュー
      // { text: 'キャラクターテスト', scene: SCENES.CHARACTER_TEST },
      // { text: 'ボステスト', scene: SCENES.BOSS_TEST },
      // { text: 'UIテスト', scene: SCENES.UI_TEST },
      { text: '戻る', scene: SCENES.TITLE },
    ];

    this.menuOptions.forEach((option, index) => {
      const menuItem = this.add.text(centerX, menuStartY + index * 60, option.text, {
        fontFamily: 'Arial, sans-serif',
        fontSize: '28px',
        color: index === 0 ? '#ffff00' : '#ffffff',
      }).setOrigin(0.5);

      menuItem.setInteractive({ useHandCursor: true });

      menuItem.on('pointerover', () => {
        this.selectMenuItem(index);
      });

      menuItem.on('pointerdown', () => {
        this.confirmSelection();
      });

      this.menuItems.push(menuItem);
    });

    // 操作説明
    this.add.text(centerX, GAME_CONFIG.HEIGHT - 60, '↑↓: 選択  Enter/Space: 決定  Esc: 戻る', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '18px',
      color: '#666666',
    }).setOrigin(0.5);
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

    this.input.keyboard?.on('keydown-ESC', () => {
      this.goBack();
    });
  }

  /**
   * メニュー項目を選択
   */
  private selectMenuItem(index: number): void {
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
    const option = this.menuOptions[this.selectedIndex];

    if (option.action) {
      option.action();
      return;
    }

    if (option.scene) {
      this.cameras.main.fadeOut(300, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => {
        this.scene.start(option.scene!);
      });
    }
  }

  /**
   * 戻る
   */
  private goBack(): void {
    this.cameras.main.fadeOut(300, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start(SCENES.TITLE);
    });
  }
}
