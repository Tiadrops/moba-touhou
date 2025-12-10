import Phaser from 'phaser';
import { SCENES, GAME_CONFIG } from '@/config/GameConfig';

/**
 * OptionScene - オプション画面（仮）
 */
export class OptionScene extends Phaser.Scene {
  constructor() {
    super({ key: SCENES.OPTION });
  }

  create(): void {
    this.cameras.main.fadeIn(300);

    const centerX = GAME_CONFIG.WIDTH / 2;
    const centerY = GAME_CONFIG.HEIGHT / 2;

    // 背景
    this.add.rectangle(0, 0, GAME_CONFIG.WIDTH, GAME_CONFIG.HEIGHT, 0x1a1a2e)
      .setOrigin(0);

    // タイトル
    this.add.text(centerX, 100, 'オプション', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '48px',
      color: '#ffffff',
    }).setOrigin(0.5);

    // 仮のメッセージ
    this.add.text(centerX, centerY, '準備中...', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '32px',
      color: '#888888',
    }).setOrigin(0.5);

    this.add.text(centerX, centerY + 50, 'BGM、SE、操作設定などを追加予定', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '20px',
      color: '#666666',
    }).setOrigin(0.5);

    // 戻るボタン
    this.createBackButton();

    // キーボード入力
    this.input.keyboard?.on('keydown-ESC', () => {
      this.goBack();
    });
  }

  /**
   * 戻るボタン
   */
  private createBackButton(): void {
    const backButton = this.add.text(50, 50, '← 戻る', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '24px',
      color: '#aaaaaa',
    }).setInteractive({ useHandCursor: true });

    backButton.on('pointerover', () => backButton.setColor('#ffffff'));
    backButton.on('pointerout', () => backButton.setColor('#aaaaaa'));
    backButton.on('pointerdown', () => this.goBack());
  }

  /**
   * タイトルに戻る
   */
  private goBack(): void {
    this.cameras.main.fadeOut(300, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start(SCENES.TITLE);
    });
  }
}
