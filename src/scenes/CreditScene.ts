import Phaser from 'phaser';
import { SCENES, GAME_CONFIG } from '@/config/GameConfig';

/**
 * CreditScene - クレジット画面（仮）
 */
export class CreditScene extends Phaser.Scene {
  constructor() {
    super({ key: SCENES.CREDIT });
  }

  create(): void {
    this.cameras.main.fadeIn(300);

    const centerX = GAME_CONFIG.WIDTH / 2;
    const centerY = GAME_CONFIG.HEIGHT / 2;

    // 背景
    this.add.rectangle(0, 0, GAME_CONFIG.WIDTH, GAME_CONFIG.HEIGHT, 0x1a1a2e)
      .setOrigin(0);

    // タイトル
    this.add.text(centerX, 100, 'クレジット', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '48px',
      color: '#ffffff',
    }).setOrigin(0.5);

    // クレジット内容
    const credits = [
      'MOBA x 東方 〜弾幕幻想郷〜',
      '',
      '--- 開発 ---',
      'プログラム: TBD',
      '',
      '--- 素材 ---',
      'キャラクター: TBD',
      '弾幕素材: かずぎつね',
      'BGM: TBD',
      'SE: TBD',
      '',
      '--- スペシャルサンクス ---',
      '東方Project - ZUN',
      'Phaser 3',
    ];

    credits.forEach((line, index) => {
      this.add.text(centerX, centerY - 150 + index * 35, line, {
        fontFamily: 'Arial, sans-serif',
        fontSize: '22px',
        color: line.startsWith('---') ? '#aaaaff' : '#ffffff',
      }).setOrigin(0.5);
    });

    // 戻るボタン
    this.createBackButton();

    // キーボード入力
    this.input.keyboard?.on('keydown-ESC', () => {
      this.goBack();
    });

    this.input.keyboard?.on('keydown-ENTER', () => {
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
