import Phaser from 'phaser';
import { SCENES, GAME_CONFIG, DEPTH } from '@/config/GameConfig';
import { AudioManager } from '@/systems/AudioManager';

/**
 * ボスリザルトテストプリセット
 */
interface BossResultPreset {
  name: string;
  breakCount: number;
}

/**
 * BossResultTestScene - ボス撃破リザルト演出テスト画面
 * ボスリザルトUIの確認・調整ができる
 */
export class BossResultTestScene extends Phaser.Scene {
  private infoText!: Phaser.GameObjects.Text;
  private presets: BossResultPreset[] = [];
  private currentPresetIndex: number = 0;
  private isPlaying: boolean = false;

  // リザルトUI要素
  private resultOverlay: Phaser.GameObjects.Rectangle | null = null;
  private resultContainer: Phaser.GameObjects.Container | null = null;
  private delayedCalls: Phaser.Time.TimerEvent[] = [];
  private countdownText: Phaser.GameObjects.Text | null = null;
  private countdownTimer: Phaser.Time.TimerEvent | null = null;

  constructor() {
    super({ key: SCENES.BOSS_RESULT_TEST });
  }

  create(): void {
    this.cameras.main.fadeIn(300);

    // 初期化
    this.currentPresetIndex = 0;
    this.isPlaying = false;

    // プリセット定義
    this.initPresets();

    // 背景
    this.createBackground();

    // UI作成
    this.createUI();

    // キーボード入力
    this.setupKeyboardInput();
  }

  /**
   * リザルトプリセットを初期化
   */
  private initPresets(): void {
    this.presets = [
      {
        name: 'Break 0回',
        breakCount: 0,
      },
      {
        name: 'Break 1回',
        breakCount: 1,
      },
      {
        name: 'Break 3回',
        breakCount: 3,
      },
      {
        name: 'Break 5回',
        breakCount: 5,
      },
      {
        name: 'Break 10回',
        breakCount: 10,
      },
    ];
  }

  /**
   * 背景を作成
   */
  private createBackground(): void {
    const graphics = this.add.graphics();
    // ゲームプレイエリア風の背景
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

    // プレイエリア枠
    const { X, Y, WIDTH, HEIGHT } = GAME_CONFIG.PLAY_AREA;
    graphics.lineStyle(2, 0x4a4a6a, 1);
    graphics.strokeRect(X, Y, WIDTH, HEIGHT);
  }

  /**
   * UIを作成
   */
  private createUI(): void {
    // タイトル
    this.add.text(20, 20, 'ボスリザルトテスト', {
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
    this.add.text(20, GAME_CONFIG.HEIGHT - 180, [
      '【操作】',
      '←→: プリセット切替',
      'Space/Enter: リザルト再生',
      'Esc: 戻る',
      '',
      '※ GameSceneで使用するボスリザルトUIのデモ',
    ].join('\n'), {
      fontFamily: 'Arial, sans-serif',
      fontSize: '16px',
      color: '#888888',
      lineSpacing: 4,
    });

    // スコア計算式の説明
    this.add.text(GAME_CONFIG.WIDTH - 450, 20, '【スコア計算】', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '18px',
      color: '#ffff00',
    });

    this.add.text(GAME_CONFIG.WIDTH - 450, 50, [
      '撃破スコア: -- (mid only)',
      '',
      'ブレイクスコア:',
      '  Break回数 × 100pt',
      '',
      'タイムボーナス: (未実装)',
      '',
      'ノーダメボーナス: (未実装)',
    ].join('\n'), {
      fontFamily: 'Arial, sans-serif',
      fontSize: '14px',
      color: '#aaaaaa',
      lineSpacing: 4,
    });
  }

  /**
   * 情報テキストを更新
   */
  private updateInfoText(): void {
    const preset = this.presets[this.currentPresetIndex];
    const breakScore = preset.breakCount * 100;

    this.infoText.setText([
      `プリセット: ${this.currentPresetIndex + 1}/${this.presets.length}`,
      `名前: ${preset.name}`,
      '',
      '【入力データ】',
      `Break回数: ${preset.breakCount}回`,
      '',
      '【計算結果】',
      `ブレイクスコア: ${breakScore.toLocaleString()}`,
      `ボス合計: ${breakScore.toLocaleString()}`,
      '',
      `状態: ${this.isPlaying ? '再生中...' : '待機中'}`,
    ].join('\n'));
  }

  /**
   * キーボード入力を設定
   */
  private setupKeyboardInput(): void {
    this.input.keyboard?.on('keydown-LEFT', () => {
      if (!this.isPlaying) {
        this.currentPresetIndex = (this.currentPresetIndex - 1 + this.presets.length) % this.presets.length;
        this.updateInfoText();
      }
    });

    this.input.keyboard?.on('keydown-RIGHT', () => {
      if (!this.isPlaying) {
        this.currentPresetIndex = (this.currentPresetIndex + 1) % this.presets.length;
        this.updateInfoText();
      }
    });

    this.input.keyboard?.on('keydown-SPACE', () => {
      this.playResult();
    });

    this.input.keyboard?.on('keydown-ENTER', () => {
      this.playResult();
    });

    this.input.keyboard?.on('keydown-ESC', () => {
      this.goBack();
    });
  }

  /**
   * リザルト再生
   */
  private playResult(): void {
    if (this.isPlaying) return;

    this.isPlaying = true;
    this.updateInfoText();

    this.showResultUI();
  }

  /**
   * スコアをカンマ区切りでフォーマット
   */
  private formatScore(score: number): string {
    return score.toLocaleString();
  }

  /**
   * リザルトUIを表示
   */
  private showResultUI(): void {
    const preset = this.presets[this.currentPresetIndex];
    const breakCount = preset.breakCount;
    const breakScore = breakCount * 100;

    // 前回の遅延呼び出しをクリア
    this.delayedCalls.forEach(timer => {
      if (timer && !timer.hasDispatched) {
        timer.destroy();
      }
    });
    this.delayedCalls = [];

    const { X, Y, WIDTH, HEIGHT } = GAME_CONFIG.PLAY_AREA;
    const centerX = X + WIDTH / 2;
    const centerY = Y + HEIGHT / 2;

    // 半透明オーバーレイ
    this.resultOverlay = this.add.rectangle(
      centerX,
      centerY,
      WIDTH,
      HEIGHT,
      0x000000,
      0.7
    );
    this.resultOverlay.setDepth(DEPTH.UI - 10);

    // コンテナを作成（スコアボードは中央に配置）
    this.resultContainer = this.add.container(centerX, centerY);
    this.resultContainer.setDepth(DEPTH.UI);

    // ルーミア立ち絵を左側に配置（スコアボードの反対側）
    const rumiaImage = this.add.image(-500, HEIGHT / 2, 'portrait_rumia_2');
    rumiaImage.setScale(0.7);
    rumiaImage.setOrigin(0.5, 1); // 下端基準
    rumiaImage.setAlpha(0);
    rumiaImage.setFlipX(true); // 左向きに反転
    this.resultContainer.add(rumiaImage);

    // 霊夢立ち絵を右側に配置
    const reimuImage = this.add.image(360, HEIGHT / 2, 'result_reimu');
    reimuImage.setScale(0.6);
    reimuImage.setOrigin(0.5, 1);
    reimuImage.setAlpha(0);
    this.resultContainer.add(reimuImage);

    // リザルト背景画像
    const resultBackground = this.add.image(0, 30, 'result_background');
    resultBackground.setDisplaySize(500, 520);
    resultBackground.setAlpha(0);
    this.resultContainer.add(resultBackground);

    // 上部の装飾ライン（深紅色）
    const topLine = this.add.rectangle(0, -200, 450, 4, 0x8b0000);
    topLine.setAlpha(0);
    this.resultContainer.add(topLine);

    // ボス撃破テキスト
    const clearText = this.add.text(0, -170, 'ルーミア 撃破!', {
      font: 'bold 42px sans-serif',
      color: '#8b0000',
      stroke: '#ffffff',
      strokeThickness: 3,
    });
    clearText.setOrigin(0.5);
    clearText.setAlpha(0);
    this.resultContainer.add(clearText);

    // 中央の装飾ライン（深紅色）
    const midLine = this.add.rectangle(0, -135, 380, 2, 0x8b0000);
    midLine.setAlpha(0);
    this.resultContainer.add(midLine);

    // ヘッダー要素（SE再生と同時に表示）
    const headerElements = [topLine, clearText, midLine, rumiaImage, reimuImage];

    // スコア内訳の開始Y座標
    let scoreY = -100;
    const lineHeight = 36;
    const labelX = -150;
    const valueX = 150;

    // 順次表示用の要素配列
    const sequentialElements: Phaser.GameObjects.GameObject[][] = [];

    // 撃破スコア（ボスでは--表示）
    const killLabel = this.add.text(labelX, scoreY, '撃破スコア', {
      font: '24px sans-serif',
      color: '#2d2d2d',
    });
    killLabel.setOrigin(0, 0.5);
    killLabel.setAlpha(0);
    this.resultContainer.add(killLabel);

    const killValue = this.add.text(valueX, scoreY, '--', {
      font: 'bold 24px sans-serif',
      color: '#888888',
    });
    killValue.setOrigin(1, 0.5);
    killValue.setAlpha(0);
    this.resultContainer.add(killValue);

    const killDetail = this.add.text(valueX + 10, scoreY, '(mid only)', {
      font: '18px sans-serif',
      color: '#888888',
    });
    killDetail.setOrigin(0, 0.5);
    killDetail.setAlpha(0);
    this.resultContainer.add(killDetail);

    scoreY += lineHeight;

    // ブレイクスコア（ボスで有効）
    const breakLabel = this.add.text(labelX, scoreY, 'ブレイクスコア', {
      font: '24px sans-serif',
      color: '#2d2d2d',
    });
    breakLabel.setOrigin(0, 0.5);
    breakLabel.setAlpha(0);
    this.resultContainer.add(breakLabel);

    const breakValue = this.add.text(valueX, scoreY, this.formatScore(breakScore), {
      font: 'bold 24px sans-serif',
      color: '#1a1a1a',
    });
    breakValue.setOrigin(1, 0.5);
    breakValue.setAlpha(0);
    this.resultContainer.add(breakValue);

    const breakDetail = this.add.text(valueX + 10, scoreY, `(${breakCount}回)`, {
      font: '18px sans-serif',
      color: '#555555',
    });
    breakDetail.setOrigin(0, 0.5);
    breakDetail.setAlpha(0);
    this.resultContainer.add(breakDetail);

    // 撃破スコアとブレイクスコアを同時に表示
    sequentialElements.push([killLabel, killValue, killDetail, breakLabel, breakValue, breakDetail]);

    scoreY += lineHeight;

    // タイムボーナス（仮 - 0表示）
    const timeLabel = this.add.text(labelX, scoreY, 'タイムボーナス', {
      font: '24px sans-serif',
      color: '#2d2d2d',
    });
    timeLabel.setOrigin(0, 0.5);
    timeLabel.setAlpha(0);
    this.resultContainer.add(timeLabel);

    const timeValue = this.add.text(valueX, scoreY, '+0', {
      font: 'bold 24px sans-serif',
      color: '#888888',
    });
    timeValue.setOrigin(1, 0.5);
    timeValue.setAlpha(0);
    this.resultContainer.add(timeValue);

    sequentialElements.push([timeLabel, timeValue]);

    scoreY += lineHeight;

    // ノーダメージボーナス（仮 - 0表示）
    const noDamageLabel = this.add.text(labelX, scoreY, 'ノーダメボーナス', {
      font: '24px sans-serif',
      color: '#2d2d2d',
    });
    noDamageLabel.setOrigin(0, 0.5);
    noDamageLabel.setAlpha(0);
    this.resultContainer.add(noDamageLabel);

    const noDamageValue = this.add.text(valueX, scoreY, '---', {
      font: 'bold 24px sans-serif',
      color: '#888888',
    });
    noDamageValue.setOrigin(1, 0.5);
    noDamageValue.setAlpha(0);
    this.resultContainer.add(noDamageValue);

    sequentialElements.push([noDamageLabel, noDamageValue]);

    scoreY += lineHeight + 10;

    // 区切り線（深紅色）
    const separatorLine = this.add.rectangle(0, scoreY, 400, 2, 0x8b0000);
    separatorLine.setAlpha(0);
    this.resultContainer.add(separatorLine);

    scoreY += 20;

    // ボス合計
    const totalLabel = this.add.text(labelX, scoreY, 'ボス合計', {
      font: 'bold 28px sans-serif',
      color: '#8b0000',
    });
    totalLabel.setOrigin(0, 0.5);
    totalLabel.setAlpha(0);
    this.resultContainer.add(totalLabel);

    const totalValue = this.add.text(valueX, scoreY, this.formatScore(breakScore), {
      font: 'bold 28px sans-serif',
      color: '#8b0000',
    });
    totalValue.setOrigin(1, 0.5);
    totalValue.setAlpha(0);
    this.resultContainer.add(totalValue);

    sequentialElements.push([separatorLine, totalLabel, totalValue]);

    scoreY += lineHeight + 20;

    // 下部の装飾ライン（深紅色）
    const bottomLine1 = this.add.rectangle(0, scoreY, 450, 4, 0x8b0000);
    bottomLine1.setAlpha(0);
    this.resultContainer.add(bottomLine1);

    scoreY += 25;

    // クリアテキスト
    const completeText = this.add.text(0, scoreY, 'Stage 1 クリア!', {
      font: 'bold 30px sans-serif',
      color: '#006400',
      stroke: '#ffffff',
      strokeThickness: 2,
    });
    completeText.setOrigin(0.5);
    completeText.setAlpha(0);
    this.resultContainer.add(completeText);

    scoreY += 50;

    // 下部の装飾ライン（深紅色）
    const bottomLine2 = this.add.rectangle(0, scoreY, 450, 4, 0x8b0000);
    bottomLine2.setAlpha(0);
    this.resultContainer.add(bottomLine2);

    sequentialElements.push([bottomLine1, completeText, bottomLine2]);

    // フェードインアニメーション（オーバーレイと背景とヘッダー部分）
    this.resultOverlay.setAlpha(0);
    this.resultContainer.setAlpha(1);

    this.tweens.add({
      targets: this.resultOverlay,
      alpha: 0.7,
      duration: 500,
      ease: 'Power2',
    });

    this.tweens.add({
      targets: resultBackground,
      alpha: 0.7,
      duration: 500,
      ease: 'Power2',
    });

    // SE再生
    AudioManager.getInstance().playSe('se_spellcard');

    // ヘッダー部分を即座に表示
    this.tweens.add({
      targets: headerElements,
      alpha: 1,
      duration: 300,
      ease: 'Power2',
    });

    // 順次表示アニメーション（SE後0.5秒ごとに各行を表示）
    const displayInterval = 500;
    const totalIndex = 3;  // ボス合計のインデックス
    const completeIndex = 4; // Stage クリアのインデックス
    sequentialElements.forEach((elements, index) => {
      const timerEvent = this.time.delayedCall(displayInterval * (index + 1), () => {
        // 行ごとのSE再生
        if (index === totalIndex) {
          AudioManager.getInstance().playSe('se_result_total');
        } else if (index === completeIndex) {
          AudioManager.getInstance().playSe('se_result_reward');
        } else if (index < sequentialElements.length - 1) {
          AudioManager.getInstance().playSe('se_result_line');
        }
        this.tweens.add({
          targets: elements,
          alpha: 1,
          duration: 200,
          ease: 'Power2',
        });
      });
      this.delayedCalls.push(timerEvent);
    });

    // カウントダウン表示（Waveと同様）
    const allElementsDisplayedTime = displayInterval * sequentialElements.length;
    const countdownDuration = 5; // 5秒カウントダウン
    let remainingSeconds = countdownDuration;

    // カウントダウンテキストを作成（最初は非表示）
    this.countdownText = this.add.text(
      180,  // コンテナ中心から右に180px
      scoreY + 40,  // 最後の要素の下
      `${remainingSeconds}`,
      {
        font: 'bold 48px sans-serif',
        color: '#8b0000',
        stroke: '#ffffff',
        strokeThickness: 3,
      }
    );
    this.countdownText.setOrigin(1, 0.5);
    this.countdownText.setAlpha(0);
    this.resultContainer.add(this.countdownText);

    // 全要素表示後にカウントダウン開始
    const countdownStartTimer = this.time.delayedCall(allElementsDisplayedTime + displayInterval, () => {
      if (this.countdownText) {
        this.countdownText.setAlpha(1);
        AudioManager.getInstance().playSe('se_result_countdown');
      }

      // 1秒ごとにカウントダウン（0まで表示）
      this.countdownTimer = this.time.addEvent({
        delay: 1000,
        callback: () => {
          remainingSeconds--;
          if (this.countdownText && remainingSeconds >= 0) {
            this.countdownText.setText(`${remainingSeconds}`);
            AudioManager.getInstance().playSe('se_result_countdown');
          }
          // カウントダウン終了後にUIを非表示
          if (remainingSeconds <= 0) {
            this.hideResultUI();
          }
        },
        repeat: countdownDuration,
      });
    });
    this.delayedCalls.push(countdownStartTimer);
  }

  /**
   * リザルトUIを非表示
   */
  private hideResultUI(): void {
    // カウントダウンタイマーをクリア
    if (this.countdownTimer) {
      this.countdownTimer.destroy();
      this.countdownTimer = null;
    }

    const targets = [this.resultOverlay, this.resultContainer]
      .filter(t => t !== null);

    if (targets.length === 0) {
      this.isPlaying = false;
      this.updateInfoText();
      return;
    }

    this.tweens.add({
      targets,
      alpha: 0,
      duration: 300,
      ease: 'Power2',
      onComplete: () => {
        if (this.resultOverlay) {
          this.resultOverlay.destroy();
          this.resultOverlay = null;
        }
        if (this.resultContainer) {
          this.resultContainer.destroy();
          this.resultContainer = null;
        }
        this.isPlaying = false;
        this.updateInfoText();
      },
    });
  }

  /**
   * 戻る
   */
  private goBack(): void {
    // 遅延呼び出しをクリア
    this.delayedCalls.forEach(timer => {
      if (timer && !timer.hasDispatched) {
        timer.destroy();
      }
    });
    this.delayedCalls = [];

    // カウントダウンタイマーをクリア
    if (this.countdownTimer) {
      this.countdownTimer.destroy();
      this.countdownTimer = null;
    }

    // 再生中なら即座に非表示
    if (this.resultOverlay) {
      this.resultOverlay.destroy();
      this.resultOverlay = null;
    }
    if (this.resultContainer) {
      this.resultContainer.destroy();
      this.resultContainer = null;
    }

    this.cameras.main.fadeOut(300, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start(SCENES.DEBUG_ROOM);
    });
  }
}
