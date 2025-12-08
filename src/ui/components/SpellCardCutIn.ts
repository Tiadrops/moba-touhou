import Phaser from 'phaser';
import { GAME_CONFIG, DEPTH } from '@/config/GameConfig';
import { CutInState } from '@/types';

/**
 * スペルカードカットイン演出
 * フェーズ遷移時に表示される東方風のカットイン
 */
export class SpellCardCutIn {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private background: Phaser.GameObjects.Rectangle;
  private spellNameText: Phaser.GameObjects.Text;
  private bossNameText: Phaser.GameObjects.Text;
  private decorationLine: Phaser.GameObjects.Rectangle;

  private state: CutInState = CutInState.IDLE;
  private onCompleteCallback: (() => void) | null = null;

  // アニメーション設定
  private static readonly ENTER_DURATION = 300;    // 登場アニメーション時間(ms)
  private static readonly DISPLAY_DURATION = 1500; // 表示時間(ms)
  private static readonly EXIT_DURATION = 200;     // 退場アニメーション時間(ms)

  constructor(scene: Phaser.Scene) {
    this.scene = scene;

    const { WIDTH, HEIGHT } = GAME_CONFIG;
    const centerX = WIDTH / 2;
    const centerY = HEIGHT / 2;

    // コンテナを作成
    this.container = scene.add.container(centerX, centerY);
    this.container.setDepth(DEPTH.UI + 10); // UIより前面
    this.container.setVisible(false);
    this.container.setAlpha(0);

    // 半透明の背景バー
    this.background = scene.add.rectangle(0, 0, WIDTH, 120, 0x000000, 0.7);
    this.container.add(this.background);

    // 装飾ライン（上）
    this.decorationLine = scene.add.rectangle(0, -50, WIDTH, 3, 0xff0000, 1);
    this.container.add(this.decorationLine);

    // 装飾ライン（下）
    const decorationLine2 = scene.add.rectangle(0, 50, WIDTH, 3, 0xff0000, 1);
    this.container.add(decorationLine2);

    // スペルカード名テキスト
    this.spellNameText = scene.add.text(0, -10, '', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '36px',
      color: '#ffffff',
      stroke: '#ff0000',
      strokeThickness: 2,
    });
    this.spellNameText.setOrigin(0.5, 0.5);
    this.container.add(this.spellNameText);

    // ボス名テキスト（右寄せ）
    this.bossNameText = scene.add.text(300, 25, '', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '20px',
      color: '#ffcccc',
    });
    this.bossNameText.setOrigin(1, 0.5);
    this.container.add(this.bossNameText);
  }

  /**
   * カットイン演出を開始
   */
  show(spellCardName: string, bossName: string = 'Rumia', onComplete?: () => void): void {
    if (this.state !== CutInState.IDLE) {
      return;
    }

    this.spellNameText.setText(spellCardName);
    this.bossNameText.setText(`- ${bossName} -`);
    this.onCompleteCallback = onComplete || null;

    this.state = CutInState.ENTERING;
    this.container.setVisible(true);
    this.container.setAlpha(0);
    this.container.setScale(1, 0.1);

    // 登場アニメーション
    this.scene.tweens.add({
      targets: this.container,
      alpha: 1,
      scaleY: 1,
      duration: SpellCardCutIn.ENTER_DURATION,
      ease: 'Back.easeOut',
      onComplete: () => {
        this.state = CutInState.DISPLAYING;

        // 表示時間後に退場
        this.scene.time.delayedCall(SpellCardCutIn.DISPLAY_DURATION, () => {
          this.startExit();
        });
      },
    });

    // スペルカード名のスライドイン
    this.spellNameText.setX(-500);
    this.scene.tweens.add({
      targets: this.spellNameText,
      x: 0,
      duration: SpellCardCutIn.ENTER_DURATION + 100,
      ease: 'Power2',
    });

    console.log(`SpellCard Cut-in: ${spellCardName}`);
  }

  /**
   * 退場アニメーション開始
   */
  private startExit(): void {
    if (this.state !== CutInState.DISPLAYING) {
      return;
    }

    this.state = CutInState.EXITING;

    this.scene.tweens.add({
      targets: this.container,
      alpha: 0,
      scaleY: 0.1,
      duration: SpellCardCutIn.EXIT_DURATION,
      ease: 'Power2',
      onComplete: () => {
        this.state = CutInState.IDLE;
        this.container.setVisible(false);

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
    this.scene.tweens.killTweensOf(this.spellNameText);
    this.container.setVisible(false);
    this.container.setAlpha(0);
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
  }
}
