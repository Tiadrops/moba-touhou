import Phaser from 'phaser';
import { SCENES, GAME_CONFIG } from '@/config/GameConfig';
import { ResultData, GameMode, ScoreRank, StageIntroData } from '@/types';

/**
 * ResultScene - リザルト画面
 */
export class ResultScene extends Phaser.Scene {
  private resultData!: ResultData;

  constructor() {
    super({ key: SCENES.RESULT });
  }

  init(data: ResultData): void {
    this.resultData = data;
  }

  create(): void {
    this.cameras.main.fadeIn(300);

    const centerX = GAME_CONFIG.WIDTH / 2;

    // 背景
    this.add.rectangle(0, 0, GAME_CONFIG.WIDTH, GAME_CONFIG.HEIGHT, 0x0a0a1e)
      .setOrigin(0);

    // クリアタイトル
    this.add.text(centerX, 80, `STAGE ${this.resultData.stageNumber} CLEAR!`, {
      fontFamily: 'Arial, sans-serif',
      fontSize: '56px',
      color: '#ffff00',
      stroke: '#000000',
      strokeThickness: 4,
    }).setOrigin(0.5);

    // ランク表示
    this.createRankDisplay(centerX, 180);

    // 統計情報
    this.createStatsDisplay(centerX, 350);

    // ハイスコア更新表示
    if (this.resultData.isHighScore) {
      this.createHighScoreNotice(centerX, 600);
    }

    // ボタン群
    this.createButtons(centerX, 700);

    // キーボード入力
    this.setupKeyboardInput();
  }

  /**
   * ランク表示を作成
   */
  private createRankDisplay(centerX: number, y: number): void {
    const rankColors: Record<ScoreRank, number> = {
      [ScoreRank.S]: 0xffff00,
      [ScoreRank.A]: 0x00ff00,
      [ScoreRank.B]: 0x00aaff,
      [ScoreRank.C]: 0xaaaaaa,
    };

    // ランク枠
    this.add.rectangle(centerX, y, 120, 120, 0x1a1a3e, 1)
      .setStrokeStyle(4, rankColors[this.resultData.rank]);

    // ランク文字
    const rankText = this.add.text(centerX, y, this.resultData.rank, {
      fontFamily: 'Arial, sans-serif',
      fontSize: '72px',
      color: Phaser.Display.Color.IntegerToColor(rankColors[this.resultData.rank]).rgba,
    }).setOrigin(0.5);

    // ランクのアニメーション
    this.tweens.add({
      targets: rankText,
      scale: { from: 0, to: 1 },
      duration: 500,
      ease: 'Back.easeOut',
    });
  }

  /**
   * 統計情報を作成
   */
  private createStatsDisplay(centerX: number, y: number): void {
    const boxWidth = 500;
    const boxHeight = 220;

    // 背景
    this.add.rectangle(centerX, y + boxHeight / 2, boxWidth, boxHeight, 0x1a1a3e, 1)
      .setStrokeStyle(2, 0x4a4a6a);

    const stats = [
      { label: 'スコア', value: this.resultData.score.toLocaleString() },
      { label: 'クリアタイム', value: this.formatTime(this.resultData.time) },
      { label: '撃破数', value: this.resultData.kills.toString() },
      { label: '被弾回数', value: this.resultData.damageTaken.toString() },
      { label: '残機', value: this.resultData.lives.toString() },
      { label: '最大コンボ', value: this.resultData.maxCombo.toString() },
    ];

    const startX = centerX - boxWidth / 2 + 40;
    const startY = y + 25;
    const lineHeight = 32;

    stats.forEach((stat, index) => {
      // ラベル
      this.add.text(startX, startY + index * lineHeight, `${stat.label}:`, {
        fontFamily: 'Arial, sans-serif',
        fontSize: '22px',
        color: '#aaaaaa',
      });

      // 値
      this.add.text(startX + boxWidth - 80, startY + index * lineHeight, stat.value, {
        fontFamily: 'Arial, sans-serif',
        fontSize: '22px',
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
   * ハイスコア更新通知を作成
   */
  private createHighScoreNotice(centerX: number, y: number): void {
    const text = this.add.text(centerX, y, 'NEW RECORD!', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '32px',
      color: '#ff0000',
      stroke: '#000000',
      strokeThickness: 2,
    }).setOrigin(0.5);

    // 点滅アニメーション
    this.tweens.add({
      targets: text,
      alpha: 0.3,
      duration: 500,
      yoyo: true,
      repeat: -1,
    });
  }

  /**
   * ボタン群を作成
   */
  private createButtons(centerX: number, y: number): void {
    const buttonWidth = 180;
    const buttonHeight = 50;
    const gap = 30;

    const buttons = [
      { text: '次のステージへ', action: () => this.goToNextStage(), visible: this.canGoToNextStage() },
      { text: 'リトライ', action: () => this.retry() },
      { text: 'モード選択', action: () => this.goToModeSelect() },
      { text: 'タイトル', action: () => this.goToTitle() },
    ].filter(b => b.visible !== false);

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

    const bg = this.add.rectangle(0, 0, width, height, 0x3a3a5e, 1)
      .setStrokeStyle(2, 0x5a5a8e)
      .setInteractive({ useHandCursor: true });
    container.add(bg);

    const label = this.add.text(0, 0, text, {
      fontFamily: 'Arial, sans-serif',
      fontSize: '20px',
      color: '#ffffff',
    }).setOrigin(0.5);
    container.add(label);

    bg.on('pointerover', () => {
      bg.setFillStyle(0x4a4a7e);
    });
    bg.on('pointerout', () => {
      bg.setFillStyle(0x3a3a5e);
    });
    bg.on('pointerdown', onClick);
  }

  /**
   * 次のステージに進めるか
   */
  private canGoToNextStage(): boolean {
    // アーケードモードで、次のステージがある場合
    return this.resultData.mode === GameMode.ARCADE && this.resultData.stageNumber < 6;
  }

  /**
   * 次のステージへ
   */
  private goToNextStage(): void {
    if (!this.resultData.nextStageData) return;

    const nextStageData: StageIntroData = {
      ...this.resultData.nextStageData,
      stageNumber: this.resultData.stageNumber + 1,
    };

    this.cameras.main.fadeOut(300, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start(SCENES.STAGE_INTRO, nextStageData);
    });
  }

  /**
   * リトライ
   */
  private retry(): void {
    if (!this.resultData.nextStageData) return;

    const retryData: StageIntroData = {
      ...this.resultData.nextStageData,
      stageNumber: this.resultData.stageNumber,
      continueData: undefined, // スコアリセット
    };

    this.cameras.main.fadeOut(300, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start(SCENES.STAGE_INTRO, retryData);
    });
  }

  /**
   * モード選択へ
   */
  private goToModeSelect(): void {
    this.cameras.main.fadeOut(300, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start(SCENES.MODE_SELECT);
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
