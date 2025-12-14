import Phaser from 'phaser';
import { GAME_CONFIG, DEPTH } from '@/config/GameConfig';
import { CutInState } from '@/types';
import { AudioManager } from '@/systems/AudioManager';

/**
 * スペルカードカットイン演出
 *
 * 演出の流れ:
 * 1. 画面が暗転
 * 2. 立ち絵が中央に表示（フェードイン）
 * 3. スペル名テキストが右下に表示
 * 4. 約2秒表示後、フェードアウト
 */
export class SpellCardCutIn {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private overlay: Phaser.GameObjects.Rectangle;       // 暗転オーバーレイ
  private portrait: Phaser.GameObjects.Image | null = null; // 立ち絵
  private spellNameText: Phaser.GameObjects.Text;
  private bossNameText: Phaser.GameObjects.Text;

  private state: CutInState = CutInState.IDLE;
  private onCompleteCallback: (() => void) | null = null;

  // アニメーション設定
  private static readonly DARKEN_DURATION = 200;      // 暗転時間(ms)
  private static readonly ENTER_DURATION = 400;       // 登場アニメーション時間(ms)
  private static readonly DISPLAY_DURATION = 1200;    // 表示時間(ms)
  private static readonly EXIT_DURATION = 300;        // 退場アニメーション時間(ms)

  // レイアウト設定
  private static readonly PORTRAIT_SCALE = 1.0;       // 立ち絵のスケール（1920px幅で画面にぴったり）
  private static readonly PORTRAIT_ALPHA = 0.75;      // 立ち絵の透明度
  private static readonly OVERLAY_ALPHA = 0.85;       // 暗転の濃さ
  private static readonly PORTRAIT_OFFSET_Y = -80;    // 立ち絵のY方向オフセット
  // rumia_3.png: 1920x810px → スケール1.0で画面幅にぴったり

  constructor(scene: Phaser.Scene) {
    this.scene = scene;

    const { WIDTH, HEIGHT } = GAME_CONFIG;
    const centerX = WIDTH / 2;
    const centerY = HEIGHT / 2;

    // 暗転オーバーレイ（全画面）
    this.overlay = scene.add.rectangle(centerX, centerY, WIDTH, HEIGHT, 0x000000, 0);
    this.overlay.setDepth(DEPTH.UI + 9);
    this.overlay.setVisible(false);

    // コンテナを作成（カットイン要素をまとめる）
    this.container = scene.add.container(0, 0);
    this.container.setDepth(DEPTH.UI + 10);
    this.container.setVisible(false);
    this.container.setAlpha(0);

    // 画像の右下座標を計算（1920x810 * 0.8 = 1536x648）
    const portraitHalfHeight = (810 * SpellCardCutIn.PORTRAIT_SCALE) / 2; // 324
    const portraitBottomY = centerY + SpellCardCutIn.PORTRAIT_OFFSET_Y + portraitHalfHeight;

    // スペルカード名テキスト（画像の右下に重なる位置）
    this.spellNameText = scene.add.text(WIDTH - 40, portraitBottomY - 20, '', {
      fontFamily: '"SawarabiMincho", "Yu Mincho", "游明朝", serif',
      fontSize: '48px',
      color: '#ffffff',
      stroke: '#880000',
      strokeThickness: 5,
      shadow: {
        offsetX: 3,
        offsetY: 3,
        color: '#000000',
        blur: 6,
        fill: true,
      },
    });
    this.spellNameText.setOrigin(1, 1);
    this.container.add(this.spellNameText);

    // ボス名テキスト（スペル名の上）
    this.bossNameText = scene.add.text(WIDTH - 40, portraitBottomY - 60, '', {
      fontFamily: '"Yu Gothic", "游ゴシック", sans-serif',
      fontSize: '20px',
      color: '#ffcccc',
      shadow: {
        offsetX: 2,
        offsetY: 2,
        color: '#000000',
        blur: 4,
        fill: true,
      },
    });
    this.bossNameText.setOrigin(1, 1);
    this.container.add(this.bossNameText);
  }

  /**
   * カットイン演出を開始
   * @param spellCardName スペルカード名
   * @param bossName ボス名
   * @param onComplete 演出完了時のコールバック
   * @param portraitKey 立ち絵のテクスチャキー（省略時: 'cutin_rumia'）
   */
  show(
    spellCardName: string,
    bossName: string = 'Rumia',
    onComplete?: () => void,
    portraitKey: string = 'cutin_rumia'
  ): void {
    if (this.state !== CutInState.IDLE) {
      return;
    }

    this.spellNameText.setText(spellCardName);
    this.bossNameText.setText(`- ${bossName} -`);
    this.onCompleteCallback = onComplete || null;

    // 立ち絵を作成（既存のものがあれば破棄）
    this.createPortrait(portraitKey);

    this.state = CutInState.ENTERING;

    // スペルカード宣言SEを再生
    AudioManager.getInstance().playSe('se_spellcard');

    // ステップ1: 暗転
    this.overlay.setVisible(true);
    this.overlay.setAlpha(0);

    this.scene.tweens.add({
      targets: this.overlay,
      alpha: SpellCardCutIn.OVERLAY_ALPHA,
      duration: SpellCardCutIn.DARKEN_DURATION,
      ease: 'Linear',
      onComplete: () => {
        this.startEnterAnimation();
      },
    });

    console.log(`SpellCard Cut-in: ${spellCardName}`);
  }

  /**
   * 立ち絵を作成
   */
  private createPortrait(key: string): void {
    const { WIDTH, HEIGHT } = GAME_CONFIG;
    const centerX = WIDTH / 2;
    const centerY = HEIGHT / 2;

    // 既存の立ち絵を削除
    if (this.portrait) {
      this.portrait.destroy();
      this.portrait = null;
    }

    // テクスチャが存在するか確認
    if (!this.scene.textures.exists(key)) {
      console.warn(`Portrait texture not found: ${key}`);
      return;
    }

    // 立ち絵を作成（中央やや上に配置）
    this.portrait = this.scene.add.image(centerX, centerY + SpellCardCutIn.PORTRAIT_OFFSET_Y, key);
    this.portrait.setOrigin(0.5, 0.5);
    this.portrait.setScale(SpellCardCutIn.PORTRAIT_SCALE);
    this.portrait.setAlpha(0);

    // コンテナに追加
    this.container.add(this.portrait);
    this.container.sendToBack(this.portrait);
  }

  /**
   * 登場アニメーション
   */
  private startEnterAnimation(): void {
    const { WIDTH, HEIGHT } = GAME_CONFIG;

    // コンテナを表示
    this.container.setVisible(true);
    this.container.setAlpha(1);

    // 立ち絵のフェードイン（中央で少しズームしながら登場、透明度付き）
    if (this.portrait) {
      this.portrait.setScale(SpellCardCutIn.PORTRAIT_SCALE * 1.05);
      this.portrait.setAlpha(0);
      this.scene.tweens.add({
        targets: this.portrait,
        scale: SpellCardCutIn.PORTRAIT_SCALE,
        alpha: SpellCardCutIn.PORTRAIT_ALPHA,
        duration: SpellCardCutIn.ENTER_DURATION,
        ease: 'Power2',
      });
    }

    // スペル名テキストのスライドイン（右下から）
    this.spellNameText.setX(WIDTH + 100);
    this.spellNameText.setAlpha(0);
    this.bossNameText.setX(WIDTH + 100);
    this.bossNameText.setAlpha(0);

    this.scene.tweens.add({
      targets: this.bossNameText,
      x: WIDTH - 40,
      alpha: 1,
      duration: SpellCardCutIn.ENTER_DURATION,
      ease: 'Back.easeOut',
    });

    this.scene.tweens.add({
      targets: this.spellNameText,
      x: WIDTH - 40,
      alpha: 1,
      duration: SpellCardCutIn.ENTER_DURATION + 100,
      ease: 'Back.easeOut',
      onComplete: () => {
        this.state = CutInState.DISPLAYING;

        // 表示時間後に退場
        this.scene.time.delayedCall(SpellCardCutIn.DISPLAY_DURATION, () => {
          this.startExit();
        });
      },
    });
  }

  /**
   * 退場アニメーション開始
   */
  private startExit(): void {
    if (this.state !== CutInState.DISPLAYING) {
      return;
    }

    this.state = CutInState.EXITING;

    // 立ち絵をフェードアウト
    if (this.portrait) {
      this.scene.tweens.add({
        targets: this.portrait,
        alpha: 0,
        scale: SpellCardCutIn.PORTRAIT_SCALE * 0.9,
        duration: SpellCardCutIn.EXIT_DURATION,
        ease: 'Power2',
      });
    }

    // テキストをフェードアウト
    this.scene.tweens.add({
      targets: [this.spellNameText, this.bossNameText],
      alpha: 0,
      duration: SpellCardCutIn.EXIT_DURATION,
      ease: 'Power2',
    });

    // 暗転解除
    this.scene.tweens.add({
      targets: this.overlay,
      alpha: 0,
      duration: SpellCardCutIn.EXIT_DURATION,
      ease: 'Linear',
      onComplete: () => {
        this.state = CutInState.IDLE;
        this.container.setVisible(false);
        this.overlay.setVisible(false);

        // 立ち絵を破棄
        if (this.portrait) {
          this.portrait.destroy();
          this.portrait = null;
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
    this.scene.tweens.killTweensOf(this.container);
    this.scene.tweens.killTweensOf(this.overlay);
    this.scene.tweens.killTweensOf(this.spellNameText);
    this.scene.tweens.killTweensOf(this.bossNameText);
    if (this.portrait) {
      this.scene.tweens.killTweensOf(this.portrait);
      this.portrait.destroy();
      this.portrait = null;
    }

    this.container.setVisible(false);
    this.container.setAlpha(0);
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
   * 破棄
   */
  destroy(): void {
    this.hide();
    this.container.destroy();
    this.overlay.destroy();
  }
}
