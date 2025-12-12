import Phaser from 'phaser';
import { UI_COLORS } from '@/ui/constants/UIConstants';

/**
 * スライダー設定
 */
interface VolumeSliderConfig {
  x: number;
  y: number;
  width?: number;
  height?: number;
  label: string;
  initialValue: number;
  onChange: (value: number) => void;
}

/**
 * 音量スライダーコンポーネント
 */
export class VolumeSlider extends Phaser.GameObjects.Container {
  private background: Phaser.GameObjects.Graphics;
  private fillBar: Phaser.GameObjects.Graphics;
  private handle: Phaser.GameObjects.Graphics;
  private labelText: Phaser.GameObjects.Text;
  private valueText: Phaser.GameObjects.Text;

  private sliderWidth: number;
  private sliderHeight: number;
  private value: number;
  private onChange: (value: number) => void;

  private isDragging: boolean = false;

  constructor(scene: Phaser.Scene, config: VolumeSliderConfig) {
    super(scene, config.x, config.y);

    this.sliderWidth = config.width ?? 300;
    this.sliderHeight = config.height ?? 20;
    this.value = config.initialValue;
    this.onChange = config.onChange;

    // ラベルテキスト
    this.labelText = scene.add.text(-this.sliderWidth / 2 - 20, 0, config.label, {
      fontFamily: 'Arial, sans-serif',
      fontSize: '24px',
      color: '#ffffff',
    }).setOrigin(1, 0.5);
    this.add(this.labelText);

    // 背景バー
    this.background = scene.add.graphics();
    this.add(this.background);

    // 塗りつぶしバー
    this.fillBar = scene.add.graphics();
    this.add(this.fillBar);

    // ハンドル
    this.handle = scene.add.graphics();
    this.add(this.handle);

    // 値表示テキスト
    this.valueText = scene.add.text(this.sliderWidth / 2 + 20, 0, `${this.value}%`, {
      fontFamily: 'Arial, sans-serif',
      fontSize: '24px',
      color: '#ffffff',
    }).setOrigin(0, 0.5);
    this.add(this.valueText);

    // 描画
    this.drawSlider();

    // インタラクティブ設定
    this.setupInteraction();

    scene.add.existing(this);
  }

  /**
   * スライダーを描画
   */
  private drawSlider(): void {
    const halfWidth = this.sliderWidth / 2;
    const halfHeight = this.sliderHeight / 2;

    // 背景
    this.background.clear();
    this.background.fillStyle(UI_COLORS.SLOT_BG, 1);
    this.background.lineStyle(2, UI_COLORS.SLOT_BORDER, 1);
    this.background.fillRoundedRect(-halfWidth, -halfHeight, this.sliderWidth, this.sliderHeight, 4);
    this.background.strokeRoundedRect(-halfWidth, -halfHeight, this.sliderWidth, this.sliderHeight, 4);

    // 塗りつぶし
    const fillWidth = (this.value / 100) * this.sliderWidth;
    this.fillBar.clear();
    if (fillWidth > 0) {
      this.fillBar.fillStyle(UI_COLORS.SLOT_BORDER_READY, 1);
      this.fillBar.fillRoundedRect(-halfWidth + 2, -halfHeight + 2, fillWidth - 4, this.sliderHeight - 4, 2);
    }

    // ハンドル
    const handleX = -halfWidth + fillWidth;
    this.handle.clear();
    this.handle.fillStyle(0xffffff, 1);
    this.handle.fillCircle(handleX, 0, 12);
    this.handle.lineStyle(2, UI_COLORS.SLOT_BORDER, 1);
    this.handle.strokeCircle(handleX, 0, 12);
  }

  /**
   * インタラクション設定
   */
  private setupInteraction(): void {
    const halfWidth = this.sliderWidth / 2;
    const halfHeight = this.sliderHeight / 2;

    // スライダー全体をインタラクティブに
    const hitArea = new Phaser.Geom.Rectangle(
      -halfWidth - 12,
      -halfHeight - 12,
      this.sliderWidth + 24,
      this.sliderHeight + 24
    );

    this.setInteractive(hitArea, Phaser.Geom.Rectangle.Contains);

    // マウスダウン
    this.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.isDragging = true;
      this.updateValueFromPointer(pointer);
    });

    // シーン全体でマウスムーブを監視
    this.scene.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (this.isDragging) {
        this.updateValueFromPointer(pointer);
      }
    });

    // マウスアップ
    this.scene.input.on('pointerup', () => {
      this.isDragging = false;
    });

    // ホバー時のカーソル変更
    this.on('pointerover', () => {
      this.scene.input.setDefaultCursor('pointer');
    });

    this.on('pointerout', () => {
      if (!this.isDragging) {
        this.scene.input.setDefaultCursor('default');
      }
    });
  }

  /**
   * ポインター位置から値を更新
   */
  private updateValueFromPointer(pointer: Phaser.Input.Pointer): void {
    // コンテナのワールド座標を取得
    const localX = pointer.x - this.x;
    const halfWidth = this.sliderWidth / 2;

    // 値を計算（0-100）
    let newValue = ((localX + halfWidth) / this.sliderWidth) * 100;
    newValue = Math.round(Math.max(0, Math.min(100, newValue)));

    if (newValue !== this.value) {
      this.value = newValue;
      this.valueText.setText(`${this.value}%`);
      this.drawSlider();
      this.onChange(this.value);
    }
  }

  /**
   * 値を設定
   */
  setValue(value: number): void {
    this.value = Math.max(0, Math.min(100, value));
    this.valueText.setText(`${this.value}%`);
    this.drawSlider();
  }

  /**
   * 現在の値を取得
   */
  getValue(): number {
    return this.value;
  }

  /**
   * クリーンアップ
   */
  destroy(fromScene?: boolean): void {
    this.scene.input.setDefaultCursor('default');
    super.destroy(fromScene);
  }
}
