import Phaser from 'phaser';
import { GAME_CONFIG, DEPTH } from '@/config/GameConfig';
import { CutInState } from '@/types';
import { AudioManager } from '@/systems/AudioManager';

/**
 * スペルカードカットイン演出 V2
 *
 * 新しいデザイン:
 * - スペルカードフレーム: 下部の横長の帯（シアンボーダー付き）
 * - キャラクター画像フレーム: 上部の斜めに傾いた帯（シアンボーダー付き）
 *
 * アニメーション順序:
 * 1. スペルカードフレーム（空）が左→右へスライドイン
 * 2. スペルカード名が左から流れて定位置へ + キャラクター画像フレームが瞼のように開く（同時）
 * 3. 表示維持
 * 4. 退場
 */
export class SpellCardCutInV2 {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private overlay: Phaser.GameObjects.Rectangle;

  // スペルカードフレーム（下部の帯）
  private spellFrameContainer: Phaser.GameObjects.Container;
  private spellFrameBg: Phaser.GameObjects.Graphics;
  private spellFrameBorderTop: Phaser.GameObjects.Graphics;
  private spellFrameBorderBottom: Phaser.GameObjects.Graphics;
  private spellNameText: Phaser.GameObjects.Text;

  // キャラクター画像フレーム（上部の斜め帯）
  private charFrameContainer: Phaser.GameObjects.Container;
  private charFrameMaskTop: Phaser.GameObjects.Graphics;
  private charFrameMaskBottom: Phaser.GameObjects.Graphics;
  private charFrameBorderTop: Phaser.GameObjects.Graphics;
  private charFrameBorderBottom: Phaser.GameObjects.Graphics;
  private portrait: Phaser.GameObjects.Image | null = null;
  private portraitMask: Phaser.Display.Masks.GeometryMask | null = null;

  private state: CutInState = CutInState.IDLE;
  private onCompleteCallback: (() => void) | null = null;

  // 色設定（動的に変更可能）
  private borderColor: number = 0x00ffff;                // ボーダー色
  private spellFrameBgColor1: number = 0x002233;         // スペルフレーム背景色1
  private spellFrameBgColor2: number = 0x001122;         // スペルフレーム背景色2

  // アニメーション設定
  private static readonly FRAME_SLIDE_DURATION = 300;    // フレームスライド時間(ms)
  private static readonly TEXT_FLOW_DURATION = 400;      // テキスト流れ時間(ms)
  private static readonly EYELID_OPEN_DURATION = 400;    // 瞼開き時間(ms)
  private static readonly DISPLAY_DURATION = 1500;       // 表示時間(ms)
  private static readonly EXIT_DURATION = 300;           // 退場時間(ms)

  // レイアウト設定
  private static readonly SPELL_FRAME_HEIGHT = 80;       // スペルカードフレームの高さ
  private static readonly SPELL_FRAME_Y = 750;           // スペルカードフレームのY位置
  private static readonly CHAR_FRAME_HEIGHT = 350;       // キャラクターフレームの高さ
  private static readonly CHAR_FRAME_Y = 400;            // キャラクターフレームの中心Y
  private static readonly CHAR_FRAME_SKEW = -0.15;       // 斜め傾き（ラジアン）
  private static readonly BORDER_WIDTH = 4;              // ボーダーの太さ
  private static readonly OVERLAY_ALPHA = 0.6;           // 暗転の濃さ

  constructor(scene: Phaser.Scene) {
    this.scene = scene;

    const { WIDTH, HEIGHT } = GAME_CONFIG;
    const centerX = WIDTH / 2;
    const centerY = HEIGHT / 2;

    // 暗転オーバーレイ
    this.overlay = scene.add.rectangle(centerX, centerY, WIDTH, HEIGHT, 0x000000, 1);
    this.overlay.setDepth(DEPTH.UI + 9);
    this.overlay.setAlpha(0);
    this.overlay.setVisible(false);

    // メインコンテナ
    this.container = scene.add.container(0, 0);
    this.container.setDepth(DEPTH.UI + 10);
    this.container.setVisible(false);

    // スペルカードフレームを作成
    this.spellFrameContainer = scene.add.container(0, 0);
    this.spellFrameBg = scene.add.graphics();
    this.spellFrameBorderTop = scene.add.graphics();
    this.spellFrameBorderBottom = scene.add.graphics();
    this.spellNameText = scene.add.text(0, 0, '', {
      fontFamily: '"SawarabiMincho", "Yu Mincho", "游明朝", serif',
      fontSize: '42px',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 4,
    });
    this.spellNameText.setOrigin(1, 0.5); // 右寄せ

    this.spellFrameContainer.add([
      this.spellFrameBg,
      this.spellFrameBorderTop,
      this.spellFrameBorderBottom,
      this.spellNameText,
    ]);
    this.container.add(this.spellFrameContainer);

    // キャラクター画像フレームを作成
    this.charFrameContainer = scene.add.container(0, 0);
    this.charFrameMaskTop = scene.add.graphics();
    this.charFrameMaskBottom = scene.add.graphics();
    this.charFrameBorderTop = scene.add.graphics();
    this.charFrameBorderBottom = scene.add.graphics();

    // マスク用グラフィックスは非表示だが存在する必要がある
    this.charFrameMaskTop.setVisible(false);
    this.charFrameMaskBottom.setVisible(false);

    this.charFrameContainer.add([
      this.charFrameBorderTop,
      this.charFrameBorderBottom,
    ]);
    this.container.add(this.charFrameContainer);

    // 初期描画
    this.drawSpellFrame();
    this.drawCharFrame(0); // 閉じた状態
  }

  /**
   * スペルカードフレームを描画
   */
  private drawSpellFrame(): void {
    const { WIDTH } = GAME_CONFIG;
    const frameY = SpellCardCutInV2.SPELL_FRAME_Y;
    const frameH = SpellCardCutInV2.SPELL_FRAME_HEIGHT;
    const borderW = SpellCardCutInV2.BORDER_WIDTH;

    // 背景（暗めのグラデーション）
    this.spellFrameBg.clear();
    this.spellFrameBg.fillGradientStyle(
      this.spellFrameBgColor1, this.spellFrameBgColor1,
      this.spellFrameBgColor2, this.spellFrameBgColor2, 0.9
    );
    this.spellFrameBg.fillRect(0, frameY - frameH / 2, WIDTH, frameH);

    // 上ボーダー
    this.spellFrameBorderTop.clear();
    this.spellFrameBorderTop.fillStyle(this.borderColor, 1);
    this.spellFrameBorderTop.fillRect(0, frameY - frameH / 2, WIDTH, borderW);

    // 下ボーダー
    this.spellFrameBorderBottom.clear();
    this.spellFrameBorderBottom.fillStyle(this.borderColor, 1);
    this.spellFrameBorderBottom.fillRect(0, frameY + frameH / 2 - borderW, WIDTH, borderW);

    // テキスト位置（右寄せ）
    this.spellNameText.setPosition(WIDTH - 100, frameY);
  }

  /**
   * キャラクター画像フレームを描画（瞼の開き具合を指定）
   * @param openRatio 0=閉じた状態, 1=完全に開いた状態
   */
  private drawCharFrame(openRatio: number): void {
    const { WIDTH } = GAME_CONFIG;
    const centerY = SpellCardCutInV2.CHAR_FRAME_Y;
    const fullHeight = SpellCardCutInV2.CHAR_FRAME_HEIGHT;
    const borderW = SpellCardCutInV2.BORDER_WIDTH;
    const skew = SpellCardCutInV2.CHAR_FRAME_SKEW;

    // 開いている高さを計算
    const openHeight = fullHeight * openRatio;
    const halfOpen = openHeight / 2;

    // 上の瞼（上に移動）
    const topY = centerY - halfOpen;
    // 下の瞼（下に移動）
    const bottomY = centerY + halfOpen;

    // ボーダーを描画（斜めの線）
    this.charFrameBorderTop.clear();
    this.charFrameBorderBottom.clear();

    if (openRatio > 0.01) {
      // 上ボーダー（斜め線）
      this.charFrameBorderTop.lineStyle(borderW, this.borderColor, 1);
      this.charFrameBorderTop.beginPath();
      // 左端から右端へ斜めに
      const skewOffset = fullHeight * Math.tan(Math.abs(skew));
      this.charFrameBorderTop.moveTo(-50, topY + skewOffset);
      this.charFrameBorderTop.lineTo(WIDTH + 50, topY - skewOffset);
      this.charFrameBorderTop.strokePath();

      // 下ボーダー（斜め線）
      this.charFrameBorderBottom.lineStyle(borderW, this.borderColor, 1);
      this.charFrameBorderBottom.beginPath();
      this.charFrameBorderBottom.moveTo(-50, bottomY + skewOffset);
      this.charFrameBorderBottom.lineTo(WIDTH + 50, bottomY - skewOffset);
      this.charFrameBorderBottom.strokePath();
    }

    // マスク形状を更新（ポートレート用）
    this.updatePortraitMask(openRatio);
  }

  /**
   * ポートレートのマスクを更新
   */
  private updatePortraitMask(openRatio: number): void {
    if (!this.portrait) return;

    const { WIDTH } = GAME_CONFIG;
    const centerY = SpellCardCutInV2.CHAR_FRAME_Y;
    const fullHeight = SpellCardCutInV2.CHAR_FRAME_HEIGHT;
    const skew = SpellCardCutInV2.CHAR_FRAME_SKEW;

    const openHeight = fullHeight * openRatio;
    const halfOpen = openHeight / 2;
    const topY = centerY - halfOpen;
    const bottomY = centerY + halfOpen;
    const skewOffset = fullHeight * Math.tan(Math.abs(skew));

    // 既存のマスクを破棄
    if (this.portraitMask) {
      this.portraitMask.destroy();
      this.portraitMask = null;
    }

    if (openRatio > 0.01) {
      // マスクが適用される時に画像を表示
      this.portrait.setVisible(true);

      // マスク用のシェイプを作成
      const maskShape = this.scene.make.graphics({ x: 0, y: 0 });
      maskShape.fillStyle(0xffffff);
      maskShape.beginPath();
      // 斜めの四角形（平行四辺形）
      maskShape.moveTo(-50, topY + skewOffset);
      maskShape.lineTo(WIDTH + 50, topY - skewOffset);
      maskShape.lineTo(WIDTH + 50, bottomY - skewOffset);
      maskShape.lineTo(-50, bottomY + skewOffset);
      maskShape.closePath();
      maskShape.fillPath();

      this.portraitMask = maskShape.createGeometryMask();
      this.portrait.setMask(this.portraitMask);
    } else {
      // 閉じた状態では非表示
      this.portrait.setVisible(false);
      this.portrait.clearMask();
    }
  }

  /**
   * 立ち絵を作成
   */
  private createPortrait(key: string): void {
    const { WIDTH } = GAME_CONFIG;
    const centerY = SpellCardCutInV2.CHAR_FRAME_Y;

    // 既存の立ち絵を削除
    if (this.portrait) {
      this.portrait.clearMask();
      this.portrait.destroy();
      this.portrait = null;
    }

    if (this.portraitMask) {
      this.portraitMask.destroy();
      this.portraitMask = null;
    }

    // テクスチャが存在するか確認
    if (!this.scene.textures.exists(key)) {
      console.warn(`Portrait texture not found: ${key}`);
      return;
    }

    // 立ち絵を作成
    this.portrait = this.scene.add.image(WIDTH / 2, centerY, key);
    this.portrait.setOrigin(0.5, 0.5);

    // 画像サイズに応じてスケール調整（横幅を画面幅に合わせる）
    const texture = this.scene.textures.get(key);
    const frame = texture.get();
    const scale = WIDTH / frame.width;
    this.portrait.setScale(scale);

    // 初期状態では非表示（瞼が開くまで見せない）
    this.portrait.setVisible(false);

    // コンテナに追加（ボーダーの下に配置）
    this.charFrameContainer.addAt(this.portrait, 0);
  }

  /**
   * カットイン演出を開始
   */
  show(
    spellCardName: string,
    _bossName: string = 'Rumia',
    onComplete?: () => void,
    portraitKey: string = 'cutin_rumia'
  ): void {
    if (this.state !== CutInState.IDLE) {
      return;
    }

    this.spellNameText.setText(spellCardName);
    this.onCompleteCallback = onComplete || null;

    // 立ち絵を作成
    this.createPortrait(portraitKey);

    // 初期状態（閉じた状態）
    this.drawCharFrame(0);

    this.state = CutInState.ENTERING;

    // SE再生
    AudioManager.getInstance().playSe('se_spellcard');

    // ステップ1: 暗転 + スペルカードフレームスライドイン
    this.overlay.setVisible(true);
    this.overlay.setAlpha(0);
    this.container.setVisible(true);

    // スペルカードフレームを左に隠す
    this.spellFrameContainer.setX(-GAME_CONFIG.WIDTH);
    // テキストは非表示
    this.spellNameText.setAlpha(0);

    // 暗転
    this.scene.tweens.add({
      targets: this.overlay,
      alpha: SpellCardCutInV2.OVERLAY_ALPHA,
      duration: SpellCardCutInV2.FRAME_SLIDE_DURATION,
      ease: 'Linear',
    });

    // スペルカードフレームをスライドイン
    this.scene.tweens.add({
      targets: this.spellFrameContainer,
      x: 0,
      duration: SpellCardCutInV2.FRAME_SLIDE_DURATION,
      ease: 'Power2',
      onComplete: () => {
        this.startTextAndEyelidAnimation();
      },
    });

    console.log(`SpellCard Cut-in V2: ${spellCardName}`);
  }

  /**
   * テキスト流れ + 瞼開きアニメーション（同時）
   */
  private startTextAndEyelidAnimation(): void {
    const { WIDTH } = GAME_CONFIG;

    // テキストを左から流して定位置（右寄せ）へ
    this.spellNameText.setX(-this.spellNameText.width);
    this.spellNameText.setAlpha(1);

    this.scene.tweens.add({
      targets: this.spellNameText,
      x: WIDTH - 100,
      duration: SpellCardCutInV2.TEXT_FLOW_DURATION,
      ease: 'Power2',
    });

    // 瞼を開くアニメーション
    const eyelidTween = { openRatio: 0 };
    this.scene.tweens.add({
      targets: eyelidTween,
      openRatio: 1,
      duration: SpellCardCutInV2.EYELID_OPEN_DURATION,
      ease: 'Power2',
      onUpdate: () => {
        this.drawCharFrame(eyelidTween.openRatio);
      },
      onComplete: () => {
        this.state = CutInState.DISPLAYING;

        // 表示時間後に退場
        this.scene.time.delayedCall(SpellCardCutInV2.DISPLAY_DURATION, () => {
          this.startExit();
        });
      },
    });
  }

  /**
   * 退場アニメーション
   */
  private startExit(): void {
    if (this.state !== CutInState.DISPLAYING) {
      return;
    }

    this.state = CutInState.EXITING;

    // 瞼を閉じる
    const eyelidTween = { openRatio: 1 };
    this.scene.tweens.add({
      targets: eyelidTween,
      openRatio: 0,
      duration: SpellCardCutInV2.EXIT_DURATION,
      ease: 'Power2',
      onUpdate: () => {
        this.drawCharFrame(eyelidTween.openRatio);
      },
    });

    // スペルカードフレームを右へスライドアウト
    this.scene.tweens.add({
      targets: this.spellFrameContainer,
      x: GAME_CONFIG.WIDTH,
      duration: SpellCardCutInV2.EXIT_DURATION,
      ease: 'Power2',
    });

    // 暗転解除
    this.scene.tweens.add({
      targets: this.overlay,
      alpha: 0,
      duration: SpellCardCutInV2.EXIT_DURATION,
      ease: 'Linear',
      onComplete: () => {
        this.state = CutInState.IDLE;
        this.container.setVisible(false);
        this.overlay.setVisible(false);

        // 立ち絵を破棄
        if (this.portrait) {
          this.portrait.clearMask();
          this.portrait.destroy();
          this.portrait = null;
        }
        if (this.portraitMask) {
          this.portraitMask.destroy();
          this.portraitMask = null;
        }

        // コールバック実行
        if (this.onCompleteCallback) {
          this.onCompleteCallback();
          this.onCompleteCallback = null;
        }
      },
    });
  }

  /**
   * 即座に非表示
   */
  hide(): void {
    this.scene.tweens.killTweensOf(this.spellFrameContainer);
    this.scene.tweens.killTweensOf(this.spellNameText);
    this.scene.tweens.killTweensOf(this.overlay);

    if (this.portrait) {
      this.scene.tweens.killTweensOf(this.portrait);
      this.portrait.clearMask();
      this.portrait.destroy();
      this.portrait = null;
    }

    if (this.portraitMask) {
      this.portraitMask.destroy();
      this.portraitMask = null;
    }

    this.container.setVisible(false);
    this.overlay.setVisible(false);
    this.overlay.setAlpha(0);
    this.state = CutInState.IDLE;
    this.onCompleteCallback = null;
  }

  /**
   * 現在の状態を取得
   */
  getState(): CutInState {
    return this.state;
  }

  /**
   * 演出中かどうか
   */
  isPlaying(): boolean {
    return this.state !== CutInState.IDLE;
  }

  /**
   * 色テーマを設定
   * @param borderColor ボーダー色
   * @param bgColor1 スペルフレーム背景色1（上側）
   * @param bgColor2 スペルフレーム背景色2（下側）
   */
  setColorTheme(borderColor: number, bgColor1: number, bgColor2: number): void {
    this.borderColor = borderColor;
    this.spellFrameBgColor1 = bgColor1;
    this.spellFrameBgColor2 = bgColor2;
    // 再描画
    this.drawSpellFrame();
  }

  /**
   * 現在の色設定を取得
   */
  getColorTheme(): { borderColor: number; bgColor1: number; bgColor2: number } {
    return {
      borderColor: this.borderColor,
      bgColor1: this.spellFrameBgColor1,
      bgColor2: this.spellFrameBgColor2,
    };
  }

  /**
   * 破棄
   */
  destroy(): void {
    this.hide();
    this.container.destroy();
    this.overlay.destroy();
    this.charFrameMaskTop.destroy();
    this.charFrameMaskBottom.destroy();
  }
}
