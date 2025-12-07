import Phaser from 'phaser';
import { UI_COLORS, UI_DEPTH } from '../constants/UIConstants';

export interface HealthBarConfig {
  x: number;
  y: number;
  width: number;
  height: number;
  showText?: boolean;
  isBossBar?: boolean;
}

/**
 * HPバーコンポーネント
 * プレイヤー用・ボス用の両方に対応
 */
export class HealthBar extends Phaser.GameObjects.Container {
  private config: HealthBarConfig;
  private background!: Phaser.GameObjects.Rectangle;
  private healthFill!: Phaser.GameObjects.Rectangle;
  private border!: Phaser.GameObjects.Graphics;
  private healthText: Phaser.GameObjects.Text | null = null;

  constructor(scene: Phaser.Scene, config: HealthBarConfig) {
    super(scene, config.x, config.y);
    this.config = config;

    this.createBar();

    scene.add.existing(this);
    this.setDepth(UI_DEPTH.PANEL_CONTENT);
  }

  private createBar(): void {
    const { width, height, showText = true, isBossBar = false } = this.config;

    // 背景
    const bgColor = isBossBar ? UI_COLORS.BOSS_HP_BG : UI_COLORS.HP_BG;
    this.background = this.scene.add.rectangle(0, 0, width, height, bgColor);
    this.background.setOrigin(0.5, 0.5);
    this.add(this.background);

    // HP部分（最初は全体）
    const hpColor = isBossBar ? UI_COLORS.BOSS_HP : UI_COLORS.HP_HIGH;
    this.healthFill = this.scene.add.rectangle(
      -width / 2,
      0,
      width,
      height - 4,
      hpColor
    );
    this.healthFill.setOrigin(0, 0.5);
    this.add(this.healthFill);

    // 枠線
    this.border = this.scene.add.graphics();
    this.border.lineStyle(2, UI_COLORS.HP_BORDER, 1);
    this.border.strokeRect(-width / 2, -height / 2, width, height);
    this.add(this.border);

    // テキスト
    if (showText) {
      this.healthText = this.scene.add.text(0, 0, '', {
        font: '14px monospace',
        color: '#ffffff',
      });
      this.healthText.setOrigin(0.5, 0.5);
      this.add(this.healthText);
    }
  }

  /**
   * HPを更新
   */
  update(currentHp: number, maxHp: number): void {
    const ratio = Math.max(0, Math.min(1, currentHp / maxHp));
    const { width, isBossBar = false } = this.config;

    // HP部分の幅を更新
    this.healthFill.width = width * ratio;

    // 色を更新（ボスバーは赤固定）
    if (!isBossBar) {
      let color: number;
      if (ratio > 0.5) {
        color = UI_COLORS.HP_HIGH;
      } else if (ratio > 0.25) {
        color = UI_COLORS.HP_MID;
      } else {
        color = UI_COLORS.HP_LOW;
      }
      this.healthFill.setFillStyle(color);
    }

    // テキスト更新
    if (this.healthText) {
      this.healthText.setText(`${Math.ceil(currentHp)} / ${maxHp}`);
    }
  }

  /**
   * ダメージ時のシェイクアニメーション
   */
  playDamageAnimation(): void {
    this.scene.tweens.add({
      targets: this,
      x: this.x - 3,
      duration: 50,
      yoyo: true,
      repeat: 3,
      onComplete: () => {
        this.x = this.config.x;
      },
    });
  }

  /**
   * 破棄
   */
  destroy(fromScene?: boolean): void {
    this.border.destroy();
    super.destroy(fromScene);
  }
}
