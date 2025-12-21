import Phaser from 'phaser';
import { SCENES, GAME_CONFIG, DEPTH, WAVE_CONFIG } from '@/config/GameConfig';
import { AudioManager } from '@/systems/AudioManager';

/**
 * リザルトテストプリセット
 */
interface ResultPreset {
  name: string;
  waveId: { stage: number; wave: number };
  killCount: number;
  clearTimeSeconds: number;
  damageTaken: number;
  waveScore: number; // 撃破スコア
}

/**
 * ResultTestScene - Waveクリアリザルト演出テスト画面
 * リザルトUIの確認・調整ができる
 */
export class ResultTestScene extends Phaser.Scene {
  private infoText!: Phaser.GameObjects.Text;
  private presets: ResultPreset[] = [];
  private currentPresetIndex: number = 0;
  private isPlaying: boolean = false;

  // リザルトUI要素
  private resultOverlay: Phaser.GameObjects.Rectangle | null = null;
  private resultContainer: Phaser.GameObjects.Container | null = null;

  constructor() {
    super({ key: SCENES.RESULT_TEST });
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
        name: 'Wave 1-1 完璧クリア',
        waveId: { stage: 1, wave: 1 },
        killCount: 25,
        clearTimeSeconds: 60, // 90秒想定 → 30秒早い = +3000
        damageTaken: 0,
        waveScore: 12500,
      },
      {
        name: 'Wave 1-1 普通クリア',
        waveId: { stage: 1, wave: 1 },
        killCount: 20,
        clearTimeSeconds: 95, // 90秒想定 → 5秒遅い = -500
        damageTaken: 150,
        waveScore: 10000,
      },
      {
        name: 'Wave 1-1 遅いクリア',
        waveId: { stage: 1, wave: 1 },
        killCount: 15,
        clearTimeSeconds: 150, // 90秒想定 → 60秒遅い = -6000
        damageTaken: 500,
        waveScore: 7500,
      },
      {
        name: 'Wave 1-2 完璧クリア',
        waveId: { stage: 1, wave: 2 },
        killCount: 10,
        clearTimeSeconds: 20, // 30秒想定 → 10秒早い = +1000
        damageTaken: 0,
        waveScore: 8000,
      },
      {
        name: 'Wave 1-2 普通クリア',
        waveId: { stage: 1, wave: 2 },
        killCount: 8,
        clearTimeSeconds: 35, // 30秒想定 → 5秒遅い = -500
        damageTaken: 200,
        waveScore: 6000,
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
    this.add.text(20, 20, 'リザルトテスト', {
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
      '※ MidStageSceneで使用するリザルトUIのデモ',
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
      '撃破スコア: Wave中に倒した敵のスコア',
      '',
      'タイムボーナス:',
      `  (想定時間 - クリア時間) × ${WAVE_CONFIG.RESULT.TIME_BONUS.POINTS_PER_SECOND}pt/秒`,
      `  想定時間: Wave1-1=${WAVE_CONFIG.RESULT.TIME_BONUS.EXPECTED_CLEAR_TIME.WAVE_1_1}秒`,
      `           Wave1-2=${WAVE_CONFIG.RESULT.TIME_BONUS.EXPECTED_CLEAR_TIME.WAVE_1_2}秒`,
      '',
      'ノーダメボーナス:',
      `  Wave1-1: ${WAVE_CONFIG.RESULT.NO_DAMAGE_BONUS.WAVE_1_1.toLocaleString()}pt`,
      `  Wave1-2: ${WAVE_CONFIG.RESULT.NO_DAMAGE_BONUS.WAVE_1_2.toLocaleString()}pt`,
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
    const scores = this.calculateResultScores(preset);

    this.infoText.setText([
      `プリセット: ${this.currentPresetIndex + 1}/${this.presets.length}`,
      `名前: ${preset.name}`,
      '',
      '【入力データ】',
      `Wave: ${preset.waveId.stage}-${preset.waveId.wave}`,
      `撃破数: ${preset.killCount}体`,
      `クリア時間: ${preset.clearTimeSeconds}秒`,
      `被ダメージ: ${preset.damageTaken}`,
      `撃破スコア: ${preset.waveScore.toLocaleString()}`,
      '',
      '【計算結果】',
      `タイムボーナス: ${scores.timeBonus >= 0 ? '+' : ''}${scores.timeBonus.toLocaleString()}`,
      `ノーダメボーナス: ${scores.noDamageBonus > 0 ? '+' + scores.noDamageBonus.toLocaleString() : '---'}`,
      `合計: ${scores.totalScore.toLocaleString()}`,
      '',
      `状態: ${this.isPlaying ? '再生中...' : '待機中'}`,
    ].join('\n'));
  }

  /**
   * スコア計算
   */
  private calculateResultScores(preset: ResultPreset): {
    killScore: number;
    timeBonus: number;
    noDamageBonus: number;
    totalScore: number;
  } {
    const resultConfig = WAVE_CONFIG.RESULT;
    const waveNum = preset.waveId.wave;

    // 想定クリア時間
    const expectedTime = waveNum === 1
      ? resultConfig.TIME_BONUS.EXPECTED_CLEAR_TIME.WAVE_1_1
      : resultConfig.TIME_BONUS.EXPECTED_CLEAR_TIME.WAVE_1_2;

    // タイムボーナス
    const timeDiff = expectedTime - preset.clearTimeSeconds;
    const timeBonus = timeDiff * resultConfig.TIME_BONUS.POINTS_PER_SECOND;

    // ノーダメージボーナス
    const noDamageBonusValue = waveNum === 1
      ? resultConfig.NO_DAMAGE_BONUS.WAVE_1_1
      : resultConfig.NO_DAMAGE_BONUS.WAVE_1_2;
    const noDamageBonus = preset.damageTaken === 0 ? noDamageBonusValue : 0;

    // 合計
    const killScore = preset.waveScore;
    const totalScore = killScore + Math.max(0, timeBonus) + noDamageBonus;

    return {
      killScore,
      timeBonus,
      noDamageBonus,
      totalScore,
    };
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
   * リザルトUIを表示
   */
  private showResultUI(): void {
    const preset = this.presets[this.currentPresetIndex];
    const resultScores = this.calculateResultScores(preset);

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

    // コンテナを作成
    this.resultContainer = this.add.container(centerX, centerY);
    this.resultContainer.setDepth(DEPTH.UI);

    // 上部の装飾ライン
    const topLine = this.add.rectangle(0, -200, 600, 4, 0xffcc00);
    this.resultContainer.add(topLine);

    // Waveクリアテキスト
    const waveStr = `${preset.waveId.stage}-${preset.waveId.wave}`;
    const waveClearText = this.add.text(0, -170, `Wave ${waveStr} クリア!`, {
      font: 'bold 42px sans-serif',
      color: '#ffff00',
      stroke: '#000000',
      strokeThickness: 4,
    });
    waveClearText.setOrigin(0.5);
    this.resultContainer.add(waveClearText);

    // 中央の装飾ライン
    const midLine = this.add.rectangle(0, -135, 500, 2, 0x888888);
    this.resultContainer.add(midLine);

    // スコア内訳の開始Y座標
    let scoreY = -100;
    const lineHeight = 36;
    const labelX = -180;
    const valueX = 180;

    // 撃破スコア
    const killLabel = this.add.text(labelX, scoreY, '撃破スコア', {
      font: '24px sans-serif',
      color: '#ffffff',
    });
    killLabel.setOrigin(0, 0.5);
    this.resultContainer.add(killLabel);

    const killValue = this.add.text(valueX, scoreY, resultScores.killScore.toLocaleString(), {
      font: 'bold 24px sans-serif',
      color: '#ffffff',
    });
    killValue.setOrigin(1, 0.5);
    this.resultContainer.add(killValue);

    const killDetail = this.add.text(valueX + 10, scoreY, `(${preset.killCount}体)`, {
      font: '18px sans-serif',
      color: '#aaaaaa',
    });
    killDetail.setOrigin(0, 0.5);
    this.resultContainer.add(killDetail);

    scoreY += lineHeight;

    // タイムボーナス
    const timeLabel = this.add.text(labelX, scoreY, 'タイムボーナス', {
      font: '24px sans-serif',
      color: '#ffffff',
    });
    timeLabel.setOrigin(0, 0.5);
    this.resultContainer.add(timeLabel);

    const timeBonusColor = resultScores.timeBonus > 0 ? '#00ff00' : '#ff6666';
    const timeBonusPrefix = resultScores.timeBonus >= 0 ? '+' : '';
    const timeValue = this.add.text(valueX, scoreY, `${timeBonusPrefix}${resultScores.timeBonus.toLocaleString()}`, {
      font: 'bold 24px sans-serif',
      color: timeBonusColor,
    });
    timeValue.setOrigin(1, 0.5);
    this.resultContainer.add(timeValue);

    const timeDetail = this.add.text(valueX + 10, scoreY, `(${preset.clearTimeSeconds}秒)`, {
      font: '18px sans-serif',
      color: '#aaaaaa',
    });
    timeDetail.setOrigin(0, 0.5);
    this.resultContainer.add(timeDetail);

    scoreY += lineHeight;

    // ノーダメージボーナス
    const noDamageLabel = this.add.text(labelX, scoreY, 'ノーダメボーナス', {
      font: '24px sans-serif',
      color: '#ffffff',
    });
    noDamageLabel.setOrigin(0, 0.5);
    this.resultContainer.add(noDamageLabel);

    const noDamageBonusColor = resultScores.noDamageBonus > 0 ? '#ffff00' : '#666666';
    const noDamageValue = this.add.text(valueX, scoreY, resultScores.noDamageBonus > 0 ? `+${resultScores.noDamageBonus.toLocaleString()}` : '---', {
      font: 'bold 24px sans-serif',
      color: noDamageBonusColor,
    });
    noDamageValue.setOrigin(1, 0.5);
    this.resultContainer.add(noDamageValue);

    if (preset.damageTaken > 0) {
      const damageDetail = this.add.text(valueX + 10, scoreY, `(被ダメ: ${preset.damageTaken})`, {
        font: '18px sans-serif',
        color: '#ff6666',
      });
      damageDetail.setOrigin(0, 0.5);
      this.resultContainer.add(damageDetail);
    }

    scoreY += lineHeight + 10;

    // 区切り線
    const separatorLine = this.add.rectangle(0, scoreY, 400, 2, 0xffffff);
    this.resultContainer.add(separatorLine);

    scoreY += 20;

    // Wave合計
    const totalLabel = this.add.text(labelX, scoreY, 'Wave合計', {
      font: 'bold 28px sans-serif',
      color: '#ffcc00',
    });
    totalLabel.setOrigin(0, 0.5);
    this.resultContainer.add(totalLabel);

    const totalValue = this.add.text(valueX, scoreY, resultScores.totalScore.toLocaleString(), {
      font: 'bold 28px sans-serif',
      color: '#ffcc00',
    });
    totalValue.setOrigin(1, 0.5);
    this.resultContainer.add(totalValue);

    scoreY += lineHeight + 20;

    // 下部の装飾ライン
    const bottomLine1 = this.add.rectangle(0, scoreY, 600, 4, 0xffcc00);
    this.resultContainer.add(bottomLine1);

    scoreY += 25;

    // 報酬テキスト
    const waveNum = preset.waveId.wave;
    const rewards = waveNum === 1 ? WAVE_CONFIG.REWARDS.WAVE_1_1 : WAVE_CONFIG.REWARDS.WAVE_1_2;
    let rewardText = '';
    if ('HP_RECOVER_PERCENT' in rewards) {
      rewardText = `報酬: HP ${rewards.HP_RECOVER_PERCENT}% 回復!`;
    } else if ('EXTRA_LIFE' in rewards) {
      rewardText = `報酬: 残機 +${rewards.EXTRA_LIFE}!`;
    }

    const waveRewardText = this.add.text(0, scoreY, rewardText, {
      font: 'bold 30px sans-serif',
      color: '#00ff00',
      stroke: '#000000',
      strokeThickness: 3,
    });
    waveRewardText.setOrigin(0.5);
    this.resultContainer.add(waveRewardText);

    scoreY += 50;

    // 下部の装飾ライン
    const bottomLine2 = this.add.rectangle(0, scoreY, 600, 4, 0xffcc00);
    this.resultContainer.add(bottomLine2);

    scoreY += 30;

    // 次へ進むテキスト
    const isFinalWave = preset.waveId.wave >= WAVE_CONFIG.STAGE_1.TOTAL_WAVES;
    const nextText = isFinalWave ? 'ボス戦へ...' : `Wave ${preset.waveId.stage}-${preset.waveId.wave + 1} へ...`;
    const waveNextText = this.add.text(0, scoreY, nextText, {
      font: '22px sans-serif',
      color: '#aaaaaa',
      stroke: '#000000',
      strokeThickness: 2,
    });
    waveNextText.setOrigin(0.5);
    this.resultContainer.add(waveNextText);

    // フェードインアニメーション
    this.resultOverlay.setAlpha(0);
    this.resultContainer.setAlpha(0);

    this.tweens.add({
      targets: [this.resultOverlay, this.resultContainer],
      alpha: 1,
      duration: 500,
      ease: 'Power2',
    });

    // SE再生
    AudioManager.getInstance().playSe('se_spellcard');

    // 表示時間後に非表示
    this.time.delayedCall(WAVE_CONFIG.RESULT.DISPLAY_DURATION, () => {
      this.hideResultUI();
    });
  }

  /**
   * リザルトUIを非表示
   */
  private hideResultUI(): void {
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
