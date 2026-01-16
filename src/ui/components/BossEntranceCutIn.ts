import Phaser from 'phaser';
import { GAME_CONFIG, DEPTH } from '@/config/GameConfig';
import { CutInState } from '@/types';
import { AudioManager } from '@/systems/AudioManager';

/**
 * ボス登場カットイン演出
 *
 * 演出案B: 月ズームイン→ズームアウト
 * - 最初は月を極限までズーム（画像拡大、小さいマスク）
 * - 徐々にズームアウト（スケール縮小）しながらマスクも拡大
 * - 最終的に全体が映り、テロップを表示
 * - 台形の斜め枠を使用
 */
export class BossEntranceCutIn {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private overlay: Phaser.GameObjects.Rectangle;

  // 立ち絵
  private portrait: Phaser.GameObjects.Image | null = null;
  private portraitMask: Phaser.Display.Masks.GeometryMask | null = null;
  private maskGraphics: Phaser.GameObjects.Graphics | null = null;

  // テキスト
  private titleText: Phaser.GameObjects.Text | null = null;
  private nameText: Phaser.GameObjects.Text | null = null;

  // スペルカードフレーム（テロップ）
  private spellFrameContainer: Phaser.GameObjects.Container | null = null;
  private spellFrameBg: Phaser.GameObjects.Graphics | null = null;
  private spellFrameBorderTop: Phaser.GameObjects.Graphics | null = null;
  private spellFrameBorderBottom: Phaser.GameObjects.Graphics | null = null;
  private spellNameText: Phaser.GameObjects.Text | null = null;

  // 装飾（枠線）
  private borderGraphics: Phaser.GameObjects.Graphics;

  private state: CutInState = CutInState.IDLE;
  private onCompleteCallback: (() => void) | null = null;

  // 色設定
  private borderColor: number = 0xff3366;  // 闇紅テーマ


  // ズームアニメーション用パラメータ
  private currentMaskScale: number = 0.1;  // マスクの現在のスケール
  private currentMaskRotation: number = 0;  // マスクの回転角度（ラジアン）

  // 画像サイズ（ボーダー描画用）
  private portraitDisplayWidth: number = 0;
  private portraitDisplayHeight: number = 0;

  // アニメーション設定
  private static readonly FADE_IN_DURATION = 400;      // フェードイン時間(ms)
  private static readonly ZOOM_DURATION = 2000;        // ズームアウト時間(ms)
  private static readonly DISPLAY_DURATION = 1200;     // 表示維持時間(ms)
  private static readonly FADE_OUT_DURATION = 400;     // フェードアウト時間(ms)
  private static readonly SPELL_FRAME_SLIDE_DURATION = 300;  // スペルフレームスライド時間(ms)

  // レイアウト設定
  private static readonly FRAME_HEIGHT = 450;          // 表示枠の最終高さ
  private static readonly FRAME_Y = 400;               // 表示枠の中心Y
  private static readonly BORDER_WIDTH = 4;            // ボーダーの太さ
  private static readonly OVERLAY_ALPHA = 0.75;        // 暗転の濃さ
  private static readonly SPELL_FRAME_HEIGHT = 80;     // スペルカードフレームの高さ
  private static readonly SPELL_FRAME_SKEW = -60 * Math.PI / 180;  // スペルフレームの傾き（ラジアン）60度
  private static readonly SPELL_FRAME_Y = 750;         // スペルカードフレームのY位置

  // ズーム設定
  private static readonly FINAL_MASK_SCALE = 1.0;      // 最終マスクスケール

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

    // ボーダー（枠線）
    this.borderGraphics = scene.add.graphics();
    this.container.add(this.borderGraphics);

    // マスクスケール（最大サイズ固定）
    this.currentMaskScale = BossEntranceCutIn.FINAL_MASK_SCALE;
  }

  /**
   * ボーダーを描画（台形45度テーパー形状）
   */
  private drawBorders(scale: number = 1.0): void {
    const { WIDTH } = GAME_CONFIG;
    const centerX = WIDTH / 2;
    const frameY = BossEntranceCutIn.FRAME_Y;
    const frameH = BossEntranceCutIn.FRAME_HEIGHT * scale;
    const frameW = WIDTH * 2.0 * scale;  // 形状の横幅（2倍に拡大）
    const borderW = BossEntranceCutIn.BORDER_WIDTH;

    this.borderGraphics.clear();

    // 台形45度（右上が大きく開き、左下がほぼ点に近い形状）
    // 基本回転(-45度) + アニメーション回転を合成
    const baseAngleB = -Math.PI / 4;
    const totalAngleB = baseAngleB + this.currentMaskRotation;
    const cos45t = Math.cos(totalAngleB);
    const sin45t = Math.sin(totalAngleB);
    const hwt = frameW / 2;
    const hht = frameH / 2;
    // 左辺を大幅に短くする（ほぼ点に近く）
    const taperRatio = 0.95;  // 95%短縮（さらに狭く）
    // 広い方（右辺側）を更に伸ばす
    const rightExtend = 2.5;  // 右辺を2.5倍に拡大
    // 高さを拡大して広い辺を長くする
    const heightExtend = 2.0;  // 高さを2倍に

    // 画像の範囲内のみにボーダーを描画
    // 画像の半幅を使って、マスク形状と画像の交点を計算
    const imgHalfW = this.portraitDisplayWidth / 2;
    const imgHalfH = this.portraitDisplayHeight / 2;

    // 画像のY座標（プレイエリア中央）
    const imgCenterY = GAME_CONFIG.PLAY_AREA.Y + GAME_CONFIG.PLAY_AREA.HEIGHT / 2;

    this.borderGraphics.lineStyle(borderW, this.borderColor, 1);
    this.borderGraphics.beginPath();

    // マスクの4頂点を計算（右辺側を拡大、高さも拡大）
    const extHht = hht * heightExtend;  // 拡大された半高
    const ltx = -hwt, lty = -extHht + (extHht * taperRatio);
    const rtx = hwt * rightExtend, rty = -extHht;
    const rbx = hwt * rightExtend, rby = extHht;
    const lbx = -hwt, lby = extHht - (extHht * taperRatio);

    // 回転後の座標を計算
    const ltRotX = centerX + (ltx * cos45t - lty * sin45t);
    const ltRotY = frameY + (ltx * sin45t + lty * cos45t);
    const rtRotX = centerX + (rtx * cos45t - rty * sin45t);
    const rtRotY = frameY + (rtx * sin45t + rty * cos45t);
    const rbRotX = centerX + (rbx * cos45t - rby * sin45t);
    const rbRotY = frameY + (rbx * sin45t + rby * cos45t);
    const lbRotX = centerX + (lbx * cos45t - lby * sin45t);
    const lbRotY = frameY + (lbx * sin45t + lby * cos45t);

    // 画像の境界
    const imgLeft = centerX - imgHalfW;
    const imgRight = centerX + imgHalfW;
    const imgTop = imgCenterY - imgHalfH;
    const imgBottom = imgCenterY + imgHalfH;

    // 線分と画像境界の交点を計算するヘルパー関数
    const clipLineToImage = (x1: number, y1: number, x2: number, y2: number) => {
      // 線分が画像内に完全に収まっているかチェック
      const isInside = (x: number, y: number) =>
        x >= imgLeft && x <= imgRight && y >= imgTop && y <= imgBottom;

      if (isInside(x1, y1) && isInside(x2, y2)) {
        return { x1, y1, x2, y2, visible: true };
      }

      // 画像境界との交点を計算
      const intersections: { x: number; y: number; t: number }[] = [];
      const dx = x2 - x1;
      const dy = y2 - y1;

      // 左境界
      if (dx !== 0) {
        const t = (imgLeft - x1) / dx;
        if (t >= 0 && t <= 1) {
          const y = y1 + t * dy;
          if (y >= imgTop && y <= imgBottom) {
            intersections.push({ x: imgLeft, y, t });
          }
        }
      }
      // 右境界
      if (dx !== 0) {
        const t = (imgRight - x1) / dx;
        if (t >= 0 && t <= 1) {
          const y = y1 + t * dy;
          if (y >= imgTop && y <= imgBottom) {
            intersections.push({ x: imgRight, y, t });
          }
        }
      }
      // 上境界
      if (dy !== 0) {
        const t = (imgTop - y1) / dy;
        if (t >= 0 && t <= 1) {
          const x = x1 + t * dx;
          if (x >= imgLeft && x <= imgRight) {
            intersections.push({ x, y: imgTop, t });
          }
        }
      }
      // 下境界
      if (dy !== 0) {
        const t = (imgBottom - y1) / dy;
        if (t >= 0 && t <= 1) {
          const x = x1 + t * dx;
          if (x >= imgLeft && x <= imgRight) {
            intersections.push({ x, y: imgBottom, t });
          }
        }
      }

      if (intersections.length < 2) {
        // 画像範囲内に入らない
        if (isInside(x1, y1)) return { x1, y1, x2: intersections[0]?.x ?? x1, y2: intersections[0]?.y ?? y1, visible: true };
        if (isInside(x2, y2)) return { x1: intersections[0]?.x ?? x2, y1: intersections[0]?.y ?? y2, x2, y2, visible: true };
        return { x1, y1, x2, y2, visible: false };
      }

      intersections.sort((a, b) => a.t - b.t);
      return { x1: intersections[0].x, y1: intersections[0].y, x2: intersections[1].x, y2: intersections[1].y, visible: true };
    };

    // 各辺を画像範囲でクリップして描画
    const edges = [
      clipLineToImage(ltRotX, ltRotY, rtRotX, rtRotY),
      clipLineToImage(rtRotX, rtRotY, rbRotX, rbRotY),
      clipLineToImage(rbRotX, rbRotY, lbRotX, lbRotY),
      clipLineToImage(lbRotX, lbRotY, ltRotX, ltRotY),
    ];

    for (const edge of edges) {
      if (edge.visible) {
        this.borderGraphics.moveTo(edge.x1, edge.y1);
        this.borderGraphics.lineTo(edge.x2, edge.y2);
      }
    }

    this.borderGraphics.strokePath();
  }

  /**
   * 立ち絵を作成（スライドインアニメーション用）
   */
  private createPortrait(key: string): void {
    const { WIDTH } = GAME_CONFIG;

    // 既存を削除
    this.destroyPortrait();

    // テクスチャ確認
    if (!this.scene.textures.exists(key)) {
      console.warn(`Portrait texture not found: ${key}`);
      return;
    }

    // 立ち絵を作成
    const texture = this.scene.textures.get(key);
    const frame = texture.get();

    // 縦長画像の場合は高さ基準、横長画像の場合は幅基準でスケール
    const aspectRatio = frame.width / frame.height;
    const targetHeight = GAME_CONFIG.PLAY_AREA.HEIGHT;  // プレイエリアの高さ（1000px）
    let baseScale: number;

    if (aspectRatio < 1) {
      // 縦長画像: 高さ基準でスケール（表示枠の高さに収める）
      baseScale = targetHeight / frame.height;
    } else {
      // 横長画像: 幅基準でスケール
      baseScale = WIDTH / frame.width;
    }

    // 最終スケール（ズーム倍率1.0）
    const finalScale = baseScale;
    // 最終位置: プレイエリアの中央に配置
    const playAreaCenterY = GAME_CONFIG.PLAY_AREA.Y + GAME_CONFIG.PLAY_AREA.HEIGHT / 2;
    const finalY = playAreaCenterY;

    // 画像の表示サイズを保存（ボーダー描画用）
    this.portraitDisplayWidth = frame.width * finalScale;
    this.portraitDisplayHeight = frame.height * finalScale;

    this.portrait = this.scene.add.image(WIDTH / 2, finalY, key);
    this.portrait.setScale(finalScale);
    this.portrait.setOrigin(0.5, 0.5);
    this.portrait.setAlpha(0);

    // マスクを最大サイズで作成、初期回転角度を設定
    // 青側（狭い方）が8時方向から開始
    this.currentMaskScale = BossEntranceCutIn.FINAL_MASK_SCALE;
    this.currentMaskRotation = 0;  // 初期: 0度（青側が8時方向）
    this.updateMask();

    // コンテナに追加（ボーダーの下）
    this.container.addAt(this.portrait, 0);
  }

  /**
   * マスクを更新（スケールに応じて）
   */
  private updateMask(): void {
    const { WIDTH } = GAME_CONFIG;
    const frameY = BossEntranceCutIn.FRAME_Y;
    const frameH = BossEntranceCutIn.FRAME_HEIGHT * this.currentMaskScale;

    // マスクを再作成
    if (this.maskGraphics) {
      this.maskGraphics.destroy();
    }
    if (this.portraitMask) {
      if (this.portrait) {
        this.portrait.clearMask();
      }
      this.portraitMask.destroy();
    }

    this.maskGraphics = this.scene.make.graphics({ x: 0, y: 0 });
    this.maskGraphics.fillStyle(0xffffff);
    this.drawMaskShape(this.maskGraphics, WIDTH, frameY, frameH, this.currentMaskScale);
    this.portraitMask = this.maskGraphics.createGeometryMask();

    if (this.portrait) {
      this.portrait.setMask(this.portraitMask);
    }
  }

  /**
   * スペルカードフレーム（テロップ）を作成
   */
  private createSpellFrame(_spellName: string): void {
    const { WIDTH } = GAME_CONFIG;
    const frameY = BossEntranceCutIn.SPELL_FRAME_Y;
    const frameH = BossEntranceCutIn.SPELL_FRAME_HEIGHT;
    const skew = BossEntranceCutIn.SPELL_FRAME_SKEW;

    // 既存のスペルフレームを削除
    this.destroySpellFrame();

    // スペルフレームコンテナを作成（frameYを基準に配置）
    this.spellFrameContainer = this.scene.add.container(0, frameY);

    // 背景
    this.spellFrameBg = this.scene.add.graphics();
    this.drawSpellFrameBackground();
    this.spellFrameContainer.add(this.spellFrameBg);

    // 上下ボーダー
    this.spellFrameBorderTop = this.scene.add.graphics();
    this.spellFrameBorderBottom = this.scene.add.graphics();
    this.drawSpellFrameBorders();
    this.spellFrameContainer.add(this.spellFrameBorderTop);
    this.spellFrameContainer.add(this.spellFrameBorderBottom);

    // テキストのY位置を斜めに合わせて調整
    // 斜めの平行四辺形の中央線に沿って配置
    // 背景描画: 左端(x=0)で中央Y=skewOffset, 右端(x=WIDTH)で中央Y=-skewOffset
    const skewOffset = frameH * Math.tan(Math.abs(skew));
    // 線形補間でX位置に応じた中央Y座標を計算
    const getCenterYAtX = (x: number) => skewOffset * (1 - 2 * x / WIDTH);

    // テキストの傾き角度（フレームの上辺/下辺の傾きに合わせる）
    // フレームは左から右へ下がる傾き（左端が高く、右端が低い）
    // getCenterYAtXの傾き: 左端Y=skewOffset、右端Y=-skewOffset → 傾き=-2*skewOffset/WIDTH
    const textRotation = Math.atan(-skewOffset * 2 / WIDTH);

    // 「宵闘の妖怪」テキスト（白文字、黒縁）- 右寄せでルーミアの左隣に配置
    const titleX = WIDTH - 460;
    const titleY = getCenterYAtX(titleX);
    const titleText = this.scene.add.text(titleX, titleY, '宵闇の妖怪    ', {
      fontFamily: '"SawarabiMincho", "Yu Mincho", "游明朝", serif',
      fontSize: '36px',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 4,
    });
    titleText.setOrigin(1, 0.5);
    titleText.setRotation(textRotation);
    titleText.setAlpha(0);
    this.spellFrameContainer.add(titleText);

    // 「ルーミア」テキスト（赤文字、白縁）- 宵闘の妖怪の右隣に配置
    const nameX = WIDTH - 300;
    const nameY = getCenterYAtX(nameX);
    this.spellNameText = this.scene.add.text(nameX, nameY, 'ルーミア', {
      fontFamily: '"SawarabiMincho", "Yu Mincho", "游明朝", serif',
      fontSize: '42px',
      color: '#ff3366',
      stroke: '#ffffff',
      strokeThickness: 4,
    });
    this.spellNameText.setOrigin(1, 0.5);  // 右寄せ
    this.spellNameText.setRotation(textRotation);  // テロップの傾きに合わせる
    this.spellNameText.setAlpha(0);
    this.spellFrameContainer.add(this.spellNameText);

    // titleTextも一緒にフェードインさせるため保持
    (this.spellFrameContainer as any).titleText = titleText;

    // コンテナに追加
    this.container.add(this.spellFrameContainer);

    // 初期状態で非表示（スライドイン時に表示開始）
    this.spellFrameContainer.setVisible(false);
  }

  /**
   * スペルフレームの背景を描画（斜めの平行四辺形）
   * コンテナのローカル座標で描画（Y=0がframeYの中央）
   */
  private drawSpellFrameBackground(): void {
    if (!this.spellFrameBg) return;

    const { WIDTH } = GAME_CONFIG;
    const frameH = BossEntranceCutIn.SPELL_FRAME_HEIGHT;
    const skew = BossEntranceCutIn.SPELL_FRAME_SKEW;
    const skewOffset = frameH * Math.tan(Math.abs(skew));

    this.spellFrameBg.clear();

    // 背景色
    const bgColor = 0x220011;  // 闇紅テーマ背景色

    // 斜めの平行四辺形を描画（ローカル座標：Y=0が中央）
    this.spellFrameBg.fillStyle(bgColor, 0.85);
    this.spellFrameBg.beginPath();
    this.spellFrameBg.moveTo(-50, -frameH / 2 + skewOffset);
    this.spellFrameBg.lineTo(WIDTH + 50, -frameH / 2 - skewOffset);
    this.spellFrameBg.lineTo(WIDTH + 50, frameH / 2 - skewOffset);
    this.spellFrameBg.lineTo(-50, frameH / 2 + skewOffset);
    this.spellFrameBg.closePath();
    this.spellFrameBg.fillPath();
  }

  /**
   * スペルフレームのボーダーを描画（斜め）
   * コンテナのローカル座標で描画（Y=0がframeYの中央）
   */
  private drawSpellFrameBorders(): void {
    if (!this.spellFrameBorderTop || !this.spellFrameBorderBottom) return;

    const { WIDTH } = GAME_CONFIG;
    const frameH = BossEntranceCutIn.SPELL_FRAME_HEIGHT;
    const borderW = BossEntranceCutIn.BORDER_WIDTH;
    const skew = BossEntranceCutIn.SPELL_FRAME_SKEW;
    const skewOffset = frameH * Math.tan(Math.abs(skew));

    this.spellFrameBorderTop.clear();
    this.spellFrameBorderBottom.clear();

    // 上ボーダー（斜め）ローカル座標
    this.spellFrameBorderTop.lineStyle(borderW, this.borderColor, 1);
    this.spellFrameBorderTop.beginPath();
    this.spellFrameBorderTop.moveTo(-50, -frameH / 2 + skewOffset);
    this.spellFrameBorderTop.lineTo(WIDTH + 50, -frameH / 2 - skewOffset);
    this.spellFrameBorderTop.strokePath();

    // 下ボーダー（斜め）ローカル座標
    this.spellFrameBorderBottom.lineStyle(borderW, this.borderColor, 1);
    this.spellFrameBorderBottom.beginPath();
    this.spellFrameBorderBottom.moveTo(-50, frameH / 2 + skewOffset);
    this.spellFrameBorderBottom.lineTo(WIDTH + 50, frameH / 2 - skewOffset);
    this.spellFrameBorderBottom.strokePath();
  }

  /**
   * スペルフレームを破棄
   */
  private destroySpellFrame(): void {
    if (this.spellNameText) {
      this.spellNameText.destroy();
      this.spellNameText = null;
    }
    if (this.spellFrameBorderTop) {
      this.spellFrameBorderTop.destroy();
      this.spellFrameBorderTop = null;
    }
    if (this.spellFrameBorderBottom) {
      this.spellFrameBorderBottom.destroy();
      this.spellFrameBorderBottom = null;
    }
    if (this.spellFrameBg) {
      this.spellFrameBg.destroy();
      this.spellFrameBg = null;
    }
    if (this.spellFrameContainer) {
      this.spellFrameContainer.destroy();
      this.spellFrameContainer = null;
    }
  }

  /**
   * カットイン演出を開始
   */
  show(
    title: string,
    name: string,
    onComplete?: () => void,
    portraitKey: string = 'cutin_rumia_entrance'
  ): void {
    if (this.state !== CutInState.IDLE) {
      return;
    }

    this.onCompleteCallback = onComplete || null;
    this.state = CutInState.ENTERING;

    // 立ち絵とスペルフレームを作成
    this.createPortrait(portraitKey);
    this.createSpellFrame(name);  // ボス名をスペルフレームに表示

    // SE再生（音量1.5倍）
    AudioManager.getInstance().playSe('se_boss_entrance', { volume: 1.5 });

    // 表示開始
    this.overlay.setVisible(true);
    this.overlay.setAlpha(0);
    this.container.setVisible(true);

    // ボーダーを最大スケールで描画（固定）
    this.borderGraphics.setAlpha(0);
    this.drawBorders(BossEntranceCutIn.FINAL_MASK_SCALE);

    // ステップ1: 暗転 + ボーダー表示
    this.scene.tweens.add({
      targets: this.overlay,
      alpha: BossEntranceCutIn.OVERLAY_ALPHA,
      duration: BossEntranceCutIn.FADE_IN_DURATION,
      ease: 'Linear',
    });

    this.scene.tweens.add({
      targets: this.borderGraphics,
      alpha: 1,
      duration: BossEntranceCutIn.FADE_IN_DURATION,
      ease: 'Linear',
    });

    // 立ち絵フェードイン + スイープアニメーション
    if (this.portrait) {
      this.scene.tweens.add({
        targets: this.portrait,
        alpha: 1,
        duration: BossEntranceCutIn.FADE_IN_DURATION,
        ease: 'Linear',
        onComplete: () => {
          this.startSweepAnimation();
        },
      });
    }

    console.log(`Boss Entrance Cut-in: ${title} ${name}`);
  }

  /**
   * スイープアニメーション開始（マスクが回転して画像を表示）
   */
  private startSweepAnimation(): void {
    if (!this.portrait) return;

    // テロップスライドを回転終了と同時に完了させるため、先にスライドを開始
    const slideStartDelay = BossEntranceCutIn.ZOOM_DURATION - BossEntranceCutIn.SPELL_FRAME_SLIDE_DURATION;
    this.scene.time.delayedCall(slideStartDelay, () => {
      this.showText();
    });

    // マスク回転アニメーション（反時計回り: +60度 → -60度、120度回転）
    const rotationAnimObj = { rotation: this.currentMaskRotation };
    this.scene.tweens.add({
      targets: rotationAnimObj,
      rotation: -Math.PI / 3,  // 最終: -60度（10時方向）
      duration: BossEntranceCutIn.ZOOM_DURATION,
      ease: 'Sine.easeInOut',
      onUpdate: () => {
        this.currentMaskRotation = rotationAnimObj.rotation;
        this.updateMask();
        this.drawBorders(this.currentMaskScale);
      },
    });
  }

  /**
   * テロップ表示（スペルカードフレームをスライドイン）
   */
  private showText(): void {
    this.state = CutInState.DISPLAYING;

    // スペルフレームをスライドイン
    if (this.spellFrameContainer) {
      // 表示開始、左端から開始
      this.spellFrameContainer.setVisible(true);
      this.spellFrameContainer.setX(-200);  // 左側から少しだけ見える位置から開始

      this.scene.tweens.add({
        targets: this.spellFrameContainer,
        x: 0,
        duration: BossEntranceCutIn.SPELL_FRAME_SLIDE_DURATION,
        ease: 'Power2',
        onComplete: () => {
          // テキストをフェードイン（タイトルと名前の両方）
          const titleText = (this.spellFrameContainer as any)?.titleText;
          const targets = [this.spellNameText, titleText].filter(t => t);
          if (targets.length > 0) {
            this.scene.tweens.add({
              targets,
              alpha: 1,
              duration: 200,
              ease: 'Linear',
            });
          }
        },
      });
    }

    // 表示維持後に退場
    this.scene.time.delayedCall(BossEntranceCutIn.DISPLAY_DURATION, () => {
      this.startExit();
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

    // 全体をフェードアウト
    const targets = [
      this.overlay,
      this.portrait,
      this.borderGraphics,
      this.spellFrameContainer,
    ].filter(t => t !== null);

    this.scene.tweens.add({
      targets,
      alpha: 0,
      duration: BossEntranceCutIn.FADE_OUT_DURATION,
      ease: 'Linear',
      onComplete: () => {
        this.finishCutIn();
      },
    });
  }

  /**
   * カットイン終了処理
   */
  private finishCutIn(): void {
    this.state = CutInState.IDLE;
    this.container.setVisible(false);
    this.overlay.setVisible(false);

    // リソース破棄
    this.destroyPortrait();
    this.destroyText();
    this.destroySpellFrame();

    // コールバック実行
    if (this.onCompleteCallback) {
      this.onCompleteCallback();
      this.onCompleteCallback = null;
    }
  }

  /**
   * 立ち絵を破棄
   */
  private destroyPortrait(): void {
    if (this.portrait) {
      this.portrait.clearMask();
      this.portrait.destroy();
      this.portrait = null;
    }
    if (this.portraitMask) {
      this.portraitMask.destroy();
      this.portraitMask = null;
    }
    if (this.maskGraphics) {
      this.maskGraphics.destroy();
      this.maskGraphics = null;
    }
  }

  /**
   * テキストを破棄
   */
  private destroyText(): void {
    if (this.titleText) {
      this.titleText.destroy();
      this.titleText = null;
    }
    if (this.nameText) {
      this.nameText.destroy();
      this.nameText = null;
    }
  }

  /**
   * 即座に非表示
   */
  hide(): void {
    this.scene.tweens.killTweensOf(this.overlay);
    this.scene.tweens.killTweensOf(this.borderGraphics);

    if (this.portrait) {
      this.scene.tweens.killTweensOf(this.portrait);
    }
    if (this.titleText) {
      this.scene.tweens.killTweensOf(this.titleText);
    }
    if (this.nameText) {
      this.scene.tweens.killTweensOf(this.nameText);
    }

    this.destroyPortrait();
    this.destroyText();

    this.container.setVisible(false);
    this.overlay.setVisible(false);
    this.overlay.setAlpha(0);
    this.borderGraphics.clear();
    this.state = CutInState.IDLE;
    this.onCompleteCallback = null;

    // マスクスケールと回転をリセット
    this.currentMaskScale = BossEntranceCutIn.FINAL_MASK_SCALE;
    this.currentMaskRotation = 0;
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
   */
  setColorTheme(borderColor: number): void {
    this.borderColor = borderColor;
    this.drawBorders();
  }

  /**
   * マスク形状を描画（台形45度テーパー形状）
   */
  private drawMaskShape(
    graphics: Phaser.GameObjects.Graphics,
    width: number,
    frameY: number,
    _frameH: number,
    scale: number = 1.0
  ): void {
    const centerX = width / 2;
    const frameW = width * 2.0 * scale;  // 形状の横幅（2倍に拡大）
    const scaledFrameH = BossEntranceCutIn.FRAME_HEIGHT * scale;

    // 台形45度（右上が大きく開き、左下がほぼ点に近い形状）
    // 基本回転(-45度) + アニメーション回転を合成
    const baseAngle = -Math.PI / 4;
    const totalAngle = baseAngle + this.currentMaskRotation;
    const cos45mt = Math.cos(totalAngle);
    const sin45mt = Math.sin(totalAngle);
    const hwmt = frameW / 2;
    const hhmt = scaledFrameH / 2;
    const taperRatioM = 0.95;  // 95%短縮（さらに狭く）
    // 広い方（右辺側）を更に伸ばす
    const rightExtendM = 2.5;  // 右辺を2.5倍に拡大
    // 高さを拡大して広い辺を長くする
    const heightExtendM = 2.0;  // 高さを2倍に
    const extHhmt = hhmt * heightExtendM;  // 拡大された半高
    graphics.beginPath();
    // 左上（大きく内側に）
    const ltxm = -hwmt, ltym = -extHhmt + (extHhmt * taperRatioM);
    graphics.moveTo(centerX + (ltxm * cos45mt - ltym * sin45mt), frameY + (ltxm * sin45mt + ltym * cos45mt));
    // 右上（拡大）
    const rtxm = hwmt * rightExtendM, rtym = -extHhmt;
    graphics.lineTo(centerX + (rtxm * cos45mt - rtym * sin45mt), frameY + (rtxm * sin45mt + rtym * cos45mt));
    // 右下（拡大）
    const rbxm = hwmt * rightExtendM, rbym = extHhmt;
    graphics.lineTo(centerX + (rbxm * cos45mt - rbym * sin45mt), frameY + (rbxm * sin45mt + rbym * cos45mt));
    // 左下（大きく内側に）
    const lbxm = -hwmt, lbym = extHhmt - (extHhmt * taperRatioM);
    graphics.lineTo(centerX + (lbxm * cos45mt - lbym * sin45mt), frameY + (lbxm * sin45mt + lbym * cos45mt));
    graphics.closePath();
    graphics.fillPath();
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
