import Phaser from 'phaser';
import { SCENES, GAME_CONFIG } from '@/config/GameConfig';
import { SpellCardCutIn } from '@/ui/components/SpellCardCutIn';
import { SpellCardCutInV2 } from '@/ui/components/SpellCardCutInV2';

/**
 * カットインプリセット
 */
interface CutInPreset {
  name: string;
  spellName: string;
  bossName: string;
  portraitKey: string;
}

/**
 * カットインバージョン
 */
type CutInVersion = 'V1' | 'V2';

/**
 * 色テーマ定義
 */
interface ColorTheme {
  name: string;
  borderColor: number;
  bgColor1: number;
  bgColor2: number;
}

/**
 * CutInTestScene - カットイン演出テスト画面
 * カットイン演出の確認・調整ができる
 */
export class CutInTestScene extends Phaser.Scene {
  private cutInV1!: SpellCardCutIn;
  private cutInV2!: SpellCardCutInV2;
  private currentVersion: CutInVersion = 'V2';
  private infoText!: Phaser.GameObjects.Text;
  private versionText!: Phaser.GameObjects.Text;
  private colorText!: Phaser.GameObjects.Text;
  private presets: CutInPreset[] = [];
  private currentPresetIndex: number = 0;
  private isPlaying: boolean = false;
  private colorThemes: ColorTheme[] = [];
  private currentColorIndex: number = 0;

  constructor() {
    super({ key: SCENES.CUTIN_TEST });
  }

  create(): void {
    this.cameras.main.fadeIn(300);

    // 初期化
    this.currentPresetIndex = 0;
    this.isPlaying = false;
    this.currentVersion = 'V2';
    this.currentColorIndex = 0;

    // プリセット定義
    this.initPresets();
    this.initColorThemes();

    // 背景
    this.createBackground();

    // UI作成
    this.createUI();

    // カットインシステム初期化
    this.cutInV1 = new SpellCardCutIn(this);
    this.cutInV2 = new SpellCardCutInV2(this);

    // キーボード入力
    this.setupKeyboardInput();
  }

  /**
   * カットインプリセットを初期化
   */
  private initPresets(): void {
    this.presets = [
      {
        name: 'ルーミア - ダークサイドオブザムーン',
        spellName: '闇符「ダークサイドオブザムーン」',
        bossName: 'Rumia',
        portraitKey: 'cutin_rumia',
      },
      {
        name: 'テスト - 短いスペル名',
        spellName: '夜符「ナイト」',
        bossName: 'Rumia',
        portraitKey: 'cutin_rumia',
      },
      {
        name: 'テスト - 長いスペル名',
        spellName: '闇符「ディマーケイション・オブ・エターナルダークネス」',
        bossName: 'Rumia',
        portraitKey: 'cutin_rumia',
      },
    ];
  }

  /**
   * 色テーマを初期化
   */
  private initColorThemes(): void {
    this.colorThemes = [
      // シアン系（デフォルト）
      { name: 'シアン', borderColor: 0x00ffff, bgColor1: 0x002233, bgColor2: 0x001122 },
      // 赤/闇系（ルーミア向け）
      { name: '闇紅', borderColor: 0xff3366, bgColor1: 0x220011, bgColor2: 0x110008 },
      // 紫系
      { name: '魔紫', borderColor: 0xaa66ff, bgColor1: 0x1a0033, bgColor2: 0x0d001a },
      // 金/黄系
      { name: '金輝', borderColor: 0xffcc00, bgColor1: 0x332200, bgColor2: 0x1a1100 },
      // 白/銀系
      { name: '銀白', borderColor: 0xcccccc, bgColor1: 0x222222, bgColor2: 0x111111 },
      // 緑系
      { name: '翠緑', borderColor: 0x00ff88, bgColor1: 0x002211, bgColor2: 0x001108 },
      // オレンジ系
      { name: '橙焔', borderColor: 0xff6600, bgColor1: 0x331a00, bgColor2: 0x1a0d00 },
      // 青系
      { name: '蒼海', borderColor: 0x3399ff, bgColor1: 0x001133, bgColor2: 0x00081a },
      // ピンク系
      { name: '桜桃', borderColor: 0xff88cc, bgColor1: 0x220022, bgColor2: 0x110011 },
    ];
  }

  /**
   * 背景を作成
   */
  private createBackground(): void {
    const graphics = this.add.graphics();
    // 明るい背景（暗転確認用）
    graphics.fillStyle(0x6688aa, 1);
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
  }

  /**
   * UIを作成
   */
  private createUI(): void {
    // タイトル
    this.add.text(20, 20, 'カットインテスト', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '32px',
      color: '#ffffff',
    });

    // バージョン表示
    this.versionText = this.add.text(300, 28, '', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '24px',
      color: '#00ffff',
    });
    this.updateVersionText();

    // 色テーマ表示
    this.colorText = this.add.text(420, 28, '', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '24px',
      color: '#ffffff',
    });
    this.updateColorText();

    // 情報表示
    this.infoText = this.add.text(20, 70, '', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '20px',
      color: '#ffffff',
      lineSpacing: 8,
    });
    this.updateInfoText();

    // 操作説明
    this.add.text(20, GAME_CONFIG.HEIGHT - 220, [
      '【操作】',
      '←→: プリセット切替',
      '↑↓: バージョン切替 (V1/V2)',
      'C: 色テーマ切替 (V2のみ)',
      'Space/Enter: カットイン再生',
      'R: 連続再生（3回）',
      'Esc: 戻る',
      '',
      '※ V1: SpellCardCutIn.ts / V2: SpellCardCutInV2.ts',
    ].join('\n'), {
      fontFamily: 'Arial, sans-serif',
      fontSize: '16px',
      color: '#888888',
      lineSpacing: 4,
    });

    // 現在のカットイン設定を表示
    this.add.text(GAME_CONFIG.WIDTH - 400, 20, '【V1 設定】', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '18px',
      color: '#ffff00',
    });

    this.add.text(GAME_CONFIG.WIDTH - 400, 50, [
      '暗転時間: 200ms',
      '登場アニメ: 400ms',
      '表示時間: 1200ms',
      '退場アニメ: 300ms',
    ].join('\n'), {
      fontFamily: 'Arial, sans-serif',
      fontSize: '14px',
      color: '#aaaaaa',
      lineSpacing: 4,
    });

    this.add.text(GAME_CONFIG.WIDTH - 400, 160, '【V2 設定】', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '18px',
      color: '#00ffff',
    });

    this.add.text(GAME_CONFIG.WIDTH - 400, 190, [
      'フレームスライド: 300ms',
      'テキスト流れ: 400ms',
      '瞼開き: 400ms',
      '表示時間: 1500ms',
      '退場: 300ms',
    ].join('\n'), {
      fontFamily: 'Arial, sans-serif',
      fontSize: '14px',
      color: '#aaaaaa',
      lineSpacing: 4,
    });
  }

  /**
   * バージョン表示を更新
   */
  private updateVersionText(): void {
    this.versionText.setText(`[ ${this.currentVersion} ]`);
    this.versionText.setColor(this.currentVersion === 'V2' ? '#00ffff' : '#ffff00');
  }

  /**
   * 色テーマ表示を更新
   */
  private updateColorText(): void {
    const theme = this.colorThemes[this.currentColorIndex];
    this.colorText.setText(`色: ${theme.name}`);
    // ボーダー色をテキストカラーに反映
    this.colorText.setColor(`#${theme.borderColor.toString(16).padStart(6, '0')}`);
  }

  /**
   * 情報テキストを更新
   */
  private updateInfoText(): void {
    const preset = this.presets[this.currentPresetIndex];
    const theme = this.colorThemes[this.currentColorIndex];

    this.infoText.setText([
      `バージョン: ${this.currentVersion}`,
      `プリセット: ${this.currentPresetIndex + 1}/${this.presets.length}`,
      `名前: ${preset.name}`,
      `スペル名: ${preset.spellName}`,
      `ボス名: ${preset.bossName}`,
      `立ち絵: ${preset.portraitKey}`,
      `色テーマ: ${theme.name}`,
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

    this.input.keyboard?.on('keydown-UP', () => {
      if (!this.isPlaying) {
        this.currentVersion = this.currentVersion === 'V1' ? 'V2' : 'V1';
        this.updateVersionText();
        this.updateInfoText();
      }
    });

    this.input.keyboard?.on('keydown-DOWN', () => {
      if (!this.isPlaying) {
        this.currentVersion = this.currentVersion === 'V1' ? 'V2' : 'V1';
        this.updateVersionText();
        this.updateInfoText();
      }
    });

    this.input.keyboard?.on('keydown-SPACE', () => {
      this.playCutIn();
    });

    this.input.keyboard?.on('keydown-ENTER', () => {
      this.playCutIn();
    });

    this.input.keyboard?.on('keydown-R', () => {
      this.playMultipleCutIns(3);
    });

    this.input.keyboard?.on('keydown-C', () => {
      if (!this.isPlaying) {
        this.currentColorIndex = (this.currentColorIndex + 1) % this.colorThemes.length;
        this.applyColorTheme();
        this.updateColorText();
        this.updateInfoText();
      }
    });

    this.input.keyboard?.on('keydown-ESC', () => {
      this.goBack();
    });
  }

  /**
   * 色テーマをV2に適用
   */
  private applyColorTheme(): void {
    const theme = this.colorThemes[this.currentColorIndex];
    this.cutInV2.setColorTheme(theme.borderColor, theme.bgColor1, theme.bgColor2);
  }

  /**
   * 現在のカットインインスタンスを取得
   */
  private getCurrentCutIn(): SpellCardCutIn | SpellCardCutInV2 {
    return this.currentVersion === 'V1' ? this.cutInV1 : this.cutInV2;
  }

  /**
   * カットインを再生
   */
  private playCutIn(): void {
    if (this.isPlaying) return;

    const preset = this.presets[this.currentPresetIndex];
    this.isPlaying = true;
    this.updateInfoText();

    const cutIn = this.getCurrentCutIn();
    cutIn.show(
      preset.spellName,
      preset.bossName,
      () => {
        this.isPlaying = false;
        this.updateInfoText();
      },
      preset.portraitKey
    );
  }

  /**
   * 複数回連続でカットインを再生
   */
  private playMultipleCutIns(count: number): void {
    if (this.isPlaying) return;

    let remaining = count;

    const playNext = () => {
      if (remaining <= 0) {
        this.isPlaying = false;
        this.updateInfoText();
        return;
      }

      remaining--;
      const preset = this.presets[this.currentPresetIndex];
      this.isPlaying = true;
      this.updateInfoText();

      const cutIn = this.getCurrentCutIn();
      cutIn.show(
        preset.spellName,
        preset.bossName,
        () => {
          // 少し間を開けて次を再生
          this.time.delayedCall(500, playNext);
        },
        preset.portraitKey
      );
    };

    playNext();
  }

  /**
   * 戻る
   */
  private goBack(): void {
    if (this.cutInV1.isPlaying()) {
      this.cutInV1.hide();
    }
    if (this.cutInV2.isPlaying()) {
      this.cutInV2.hide();
    }

    this.cameras.main.fadeOut(300, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start(SCENES.DEBUG_ROOM);
    });
  }

  /**
   * 破棄時の処理
   */
  shutdown(): void {
    if (this.cutInV1) {
      this.cutInV1.destroy();
    }
    if (this.cutInV2) {
      this.cutInV2.destroy();
    }
  }
}
