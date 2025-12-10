import Phaser from 'phaser';
import { SCENES, GAME_CONFIG } from '@/config/GameConfig';

/**
 * ModeSelectScene - モード選択画面
 */
export class ModeSelectScene extends Phaser.Scene {
  private selectedIndex: number = 0;
  private modeCards: Phaser.GameObjects.Container[] = [];

  constructor() {
    super({ key: SCENES.MODE_SELECT });
  }

  create(): void {
    this.cameras.main.fadeIn(300);

    const centerX = GAME_CONFIG.WIDTH / 2;

    // 背景
    this.add.rectangle(0, 0, GAME_CONFIG.WIDTH, GAME_CONFIG.HEIGHT, 0x1a1a2e)
      .setOrigin(0);

    // タイトル
    this.add.text(centerX, 100, 'モード選択', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '48px',
      color: '#ffffff',
    }).setOrigin(0.5);

    // 戻るボタン
    const backButton = this.add.text(50, 50, '← 戻る', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '24px',
      color: '#aaaaaa',
    }).setInteractive({ useHandCursor: true });

    backButton.on('pointerover', () => backButton.setColor('#ffffff'));
    backButton.on('pointerout', () => backButton.setColor('#aaaaaa'));
    backButton.on('pointerdown', () => this.goBack());

    // モードカード
    this.createModeCards();

    // 操作説明
    this.add.text(centerX, GAME_CONFIG.HEIGHT - 50, 'Enter: 決定  Esc: 戻る  ←→: 選択', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '20px',
      color: '#888888',
    }).setOrigin(0.5);

    // キーボード入力
    this.setupKeyboardInput();
  }

  /**
   * モードカードを作成
   */
  private createModeCards(): void {
    const centerY = GAME_CONFIG.HEIGHT / 2;
    const cardWidth = 350;
    const cardHeight = 400;
    const cardGap = 100;

    const modes = [
      {
        title: 'アーケードモード',
        description: 'ステージ1から順に\nクリアを目指す',
        icon: '🎮',
        scene: SCENES.ARCADE_SETUP,
      },
      {
        title: '練習モード',
        description: '好きなステージを\n選んで練習',
        icon: '📝',
        scene: SCENES.PRACTICE_SETUP,
      },
    ];

    modes.forEach((mode, index) => {
      const offsetX = (index - 0.5) * (cardWidth + cardGap);
      const card = this.createModeCard(
        GAME_CONFIG.WIDTH / 2 + offsetX,
        centerY,
        cardWidth,
        cardHeight,
        mode,
        index
      );
      this.modeCards.push(card);
    });

    // 初期選択
    this.updateSelection();
  }

  /**
   * 個別のモードカードを作成
   */
  private createModeCard(
    x: number,
    y: number,
    width: number,
    height: number,
    mode: { title: string; description: string; icon: string; scene: string },
    index: number
  ): Phaser.GameObjects.Container {
    const container = this.add.container(x, y);

    // カード背景
    const bg = this.add.rectangle(0, 0, width, height, 0x2a2a4e, 1)
      .setStrokeStyle(3, 0x4a4a6a);
    container.add(bg);

    // アイコン
    const icon = this.add.text(0, -100, mode.icon, {
      fontSize: '64px',
    }).setOrigin(0.5);
    container.add(icon);

    // タイトル
    const title = this.add.text(0, -10, mode.title, {
      fontFamily: 'Arial, sans-serif',
      fontSize: '28px',
      color: '#ffffff',
    }).setOrigin(0.5);
    container.add(title);

    // 説明
    const description = this.add.text(0, 60, mode.description, {
      fontFamily: 'Arial, sans-serif',
      fontSize: '20px',
      color: '#aaaaaa',
      align: 'center',
    }).setOrigin(0.5);
    container.add(description);

    // インタラクティブ設定
    bg.setInteractive({ useHandCursor: true });
    bg.on('pointerover', () => {
      this.selectedIndex = index;
      this.updateSelection();
    });
    bg.on('pointerdown', () => {
      this.confirmSelection();
    });

    // データを保存
    container.setData('scene', mode.scene);
    container.setData('bg', bg);

    return container;
  }

  /**
   * 選択状態を更新
   */
  private updateSelection(): void {
    this.modeCards.forEach((card, index) => {
      const bg = card.getData('bg') as Phaser.GameObjects.Rectangle;
      if (index === this.selectedIndex) {
        bg.setStrokeStyle(4, 0xffff00);
        card.setScale(1.05);
      } else {
        bg.setStrokeStyle(3, 0x4a4a6a);
        card.setScale(1);
      }
    });
  }

  /**
   * キーボード入力を設定
   */
  private setupKeyboardInput(): void {
    this.input.keyboard?.on('keydown-LEFT', () => {
      this.selectedIndex = Math.max(0, this.selectedIndex - 1);
      this.updateSelection();
    });

    this.input.keyboard?.on('keydown-RIGHT', () => {
      this.selectedIndex = Math.min(this.modeCards.length - 1, this.selectedIndex + 1);
      this.updateSelection();
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
   * 選択を確定
   */
  private confirmSelection(): void {
    const targetScene = this.modeCards[this.selectedIndex].getData('scene') as string;

    this.cameras.main.fadeOut(300, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start(targetScene);
    });
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
