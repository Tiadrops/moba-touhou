import Phaser from 'phaser';
import { SCENES, GAME_CONFIG } from '@/config/GameConfig';
import { StageIntroData, GameMode } from '@/types';

/**
 * GameOverScene用のデータ
 */
export interface GameOverData {
  mode: GameMode;
  stageNumber: number;
  score: number;
  playTime: number;
  kills: number;
  // リトライ用データ
  retryData: StageIntroData;
}

/**
 * GameOverScene - ゲームオーバー画面
 */
export class GameOverScene extends Phaser.Scene {
  private gameOverData!: GameOverData;

  constructor() {
    super({ key: SCENES.GAME_OVER });
  }

  init(data: GameOverData): void {
    this.gameOverData = data;
  }

  create(): void {
    this.cameras.main.fadeIn(500);

    const centerX = GAME_CONFIG.WIDTH / 2;

    // 背景（暗め）
    this.add.rectangle(0, 0, GAME_CONFIG.WIDTH, GAME_CONFIG.HEIGHT, 0x0a0a0a)
      .setOrigin(0);

    // GAME OVER テキスト
    const gameOverText = this.add.text(centerX, 200, 'GAME OVER', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '72px',
      color: '#ff0000',
      stroke: '#000000',
      strokeThickness: 4,
    }).setOrigin(0.5);

    // アニメーション
    this.tweens.add({
      targets: gameOverText,
      alpha: { from: 0, to: 1 },
      scale: { from: 1.5, to: 1 },
      duration: 800,
      ease: 'Power2',
    });

    // 統計情報
    this.createStatsDisplay(centerX, 350);

    // ボタン群
    this.createButtons(centerX, 580);

    // 注意書き
    this.add.text(centerX, 680, '※コンティニューはスコアがリセットされます', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '16px',
      color: '#888888',
    }).setOrigin(0.5);

    // キーボード入力
    this.setupKeyboardInput();
  }

  /**
   * 統計情報を作成
   */
  private createStatsDisplay(centerX: number, y: number): void {
    const boxWidth = 400;
    const boxHeight = 160;

    // 背景
    this.add.rectangle(centerX, y + boxHeight / 2, boxWidth, boxHeight, 0x1a1a1a, 1)
      .setStrokeStyle(2, 0x333333);

    const stats = [
      { label: '到達ステージ', value: `Stage ${this.gameOverData.stageNumber}` },
      { label: 'スコア', value: this.gameOverData.score.toLocaleString() },
      { label: 'プレイ時間', value: this.formatTime(this.gameOverData.playTime) },
      { label: '撃破数', value: this.gameOverData.kills.toString() },
    ];

    const startX = centerX - boxWidth / 2 + 40;
    const startY = y + 25;
    const lineHeight = 32;

    stats.forEach((stat, index) => {
      this.add.text(startX, startY + index * lineHeight, `${stat.label}:`, {
        fontFamily: 'Arial, sans-serif',
        fontSize: '20px',
        color: '#888888',
      });

      this.add.text(startX + boxWidth - 80, startY + index * lineHeight, stat.value, {
        fontFamily: 'Arial, sans-serif',
        fontSize: '20px',
        color: '#ffffff',
      }).setOrigin(1, 0);
    });
  }

  /**
   * 時間をフォーマット
   */
  private formatTime(ms: number): string {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const centiseconds = Math.floor((ms % 1000) / 10);
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${centiseconds.toString().padStart(2, '0')}`;
  }

  /**
   * ボタン群を作成
   */
  private createButtons(centerX: number, y: number): void {
    const buttonWidth = 200;
    const buttonHeight = 55;
    const gap = 40;

    const buttons = [
      { text: 'コンティニュー', action: () => this.continue() },
      { text: 'リトライ', action: () => this.retry() },
      { text: 'タイトルへ', action: () => this.goToTitle() },
    ];

    const totalWidth = buttons.length * buttonWidth + (buttons.length - 1) * gap;
    const startX = centerX - totalWidth / 2 + buttonWidth / 2;

    buttons.forEach((btn, index) => {
      const x = startX + index * (buttonWidth + gap);
      this.createButton(x, y, buttonWidth, buttonHeight, btn.text, btn.action);
    });
  }

  /**
   * ボタンを作成
   */
  private createButton(
    x: number,
    y: number,
    width: number,
    height: number,
    text: string,
    onClick: () => void
  ): void {
    const container = this.add.container(x, y);

    const bg = this.add.rectangle(0, 0, width, height, 0x2a2a2a, 1)
      .setStrokeStyle(2, 0x4a4a4a)
      .setInteractive({ useHandCursor: true });
    container.add(bg);

    const label = this.add.text(0, 0, text, {
      fontFamily: 'Arial, sans-serif',
      fontSize: '22px',
      color: '#ffffff',
    }).setOrigin(0.5);
    container.add(label);

    bg.on('pointerover', () => {
      bg.setFillStyle(0x3a3a3a);
      bg.setStrokeStyle(2, 0x666666);
    });
    bg.on('pointerout', () => {
      bg.setFillStyle(0x2a2a2a);
      bg.setStrokeStyle(2, 0x4a4a4a);
    });
    bg.on('pointerdown', onClick);
  }

  /**
   * コンティニュー（スコアリセットして同じステージから再開）
   */
  private continue(): void {
    const continueData: StageIntroData = {
      ...this.gameOverData.retryData,
      continueData: undefined, // スコアリセット
    };

    this.cameras.main.fadeOut(300, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start(SCENES.STAGE_INTRO, continueData);
    });
  }

  /**
   * リトライ（ステージ1から再開）
   */
  private retry(): void {
    const retryData: StageIntroData = {
      ...this.gameOverData.retryData,
      stageNumber: 1,
      continueData: undefined,
    };

    this.cameras.main.fadeOut(300, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start(SCENES.STAGE_INTRO, retryData);
    });
  }

  /**
   * タイトルへ
   */
  private goToTitle(): void {
    this.cameras.main.fadeOut(300, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start(SCENES.TITLE);
    });
  }

  /**
   * キーボード入力を設定
   */
  private setupKeyboardInput(): void {
    this.input.keyboard?.on('keydown-ESC', () => {
      this.goToTitle();
    });
  }
}
