import Phaser from 'phaser';
import { SCENES, GAME_CONFIG } from '@/config/GameConfig';
import { StageIntroData } from '@/types';

/**
 * PauseScene用のデータ
 */
export interface PauseData {
  retryData: StageIntroData;
}

/**
 * PauseScene - 一時停止画面（オーバーレイ）
 */
export class PauseScene extends Phaser.Scene {
  private pauseData!: PauseData;
  private selectedIndex: number = 0;
  private menuItems: Phaser.GameObjects.Text[] = [];

  constructor() {
    super({ key: SCENES.PAUSE });
  }

  init(data: PauseData): void {
    this.pauseData = data;
  }

  create(): void {
    const centerX = GAME_CONFIG.WIDTH / 2;
    const centerY = GAME_CONFIG.HEIGHT / 2;

    // 半透明の背景オーバーレイ
    this.add.rectangle(0, 0, GAME_CONFIG.WIDTH, GAME_CONFIG.HEIGHT, 0x000000, 0.7)
      .setOrigin(0);

    // ポーズメニューボックス
    const boxWidth = 350;
    const boxHeight = 320;
    this.add.rectangle(centerX, centerY, boxWidth, boxHeight, 0x1a1a2e, 1)
      .setStrokeStyle(3, 0x4a4a6a);

    // PAUSEテキスト
    this.add.text(centerX, centerY - 110, 'PAUSE', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '42px',
      color: '#ffffff',
    }).setOrigin(0.5);

    // メニュー項目
    this.createMenuItems(centerX, centerY);

    // キーボード入力
    this.setupKeyboardInput();

    // 初期選択
    this.updateSelection();
  }

  /**
   * メニュー項目を作成
   */
  private createMenuItems(centerX: number, centerY: number): void {
    const menuOptions = [
      { text: '再開', action: () => this.resume() },
      { text: 'リスタート', action: () => this.restart() },
      { text: 'オプション', action: () => this.openOptions() },
      { text: 'タイトルへ', action: () => this.goToTitle() },
    ];

    const startY = centerY - 40;
    const lineHeight = 50;

    menuOptions.forEach((option, index) => {
      const y = startY + index * lineHeight;

      const menuItem = this.add.text(centerX, y, option.text, {
        fontFamily: 'Arial, sans-serif',
        fontSize: '28px',
        color: '#ffffff',
      }).setOrigin(0.5);

      menuItem.setInteractive({ useHandCursor: true });

      menuItem.on('pointerover', () => {
        this.selectedIndex = index;
        this.updateSelection();
      });

      menuItem.on('pointerdown', () => {
        option.action();
      });

      menuItem.setData('action', option.action);
      this.menuItems.push(menuItem);
    });
  }

  /**
   * 選択状態を更新
   */
  private updateSelection(): void {
    this.menuItems.forEach((item, index) => {
      if (index === this.selectedIndex) {
        item.setColor('#ffff00');
        item.setText('▶ ' + item.text.replace('▶ ', ''));
      } else {
        item.setColor('#ffffff');
        item.setText(item.text.replace('▶ ', ''));
      }
    });
  }

  /**
   * キーボード入力を設定
   */
  private setupKeyboardInput(): void {
    this.input.keyboard?.on('keydown-UP', () => {
      this.selectedIndex = (this.selectedIndex - 1 + this.menuItems.length) % this.menuItems.length;
      this.updateSelection();
    });

    this.input.keyboard?.on('keydown-DOWN', () => {
      this.selectedIndex = (this.selectedIndex + 1) % this.menuItems.length;
      this.updateSelection();
    });

    this.input.keyboard?.on('keydown-ENTER', () => {
      const action = this.menuItems[this.selectedIndex].getData('action') as () => void;
      action();
    });

    this.input.keyboard?.on('keydown-SPACE', () => {
      const action = this.menuItems[this.selectedIndex].getData('action') as () => void;
      action();
    });

    this.input.keyboard?.on('keydown-ESC', () => {
      this.resume();
    });
  }

  /**
   * ゲームを再開
   */
  private resume(): void {
    this.scene.stop();
    this.scene.resume(SCENES.GAME);
  }

  /**
   * リスタート
   */
  private restart(): void {
    this.scene.stop(SCENES.GAME);
    this.scene.stop();

    const retryData: StageIntroData = {
      ...this.pauseData.retryData,
      continueData: undefined,
    };

    this.scene.start(SCENES.STAGE_INTRO, retryData);
  }

  /**
   * オプションを開く
   */
  private openOptions(): void {
    // TODO: オプション画面を実装後に連携
    console.log('Options not yet implemented');
  }

  /**
   * タイトルへ
   */
  private goToTitle(): void {
    this.scene.stop(SCENES.GAME);
    this.scene.stop();
    this.scene.start(SCENES.TITLE);
  }
}
