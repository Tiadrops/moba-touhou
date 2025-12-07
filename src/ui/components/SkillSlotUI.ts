import Phaser from 'phaser';
import { SkillSlot, SkillState } from '@/types';
import { UI_COLORS, UI_DEPTH } from '../constants/UIConstants';

export interface SkillSlotConfig {
  slot: SkillSlot;
  x: number;
  y: number;
  size: number;
  keyLabel: string;
}

/**
 * 個別スキルスロットUIコンポーネント
 */
export class SkillSlotUI extends Phaser.GameObjects.Container {
  private config: SkillSlotConfig;
  private background!: Phaser.GameObjects.Rectangle;
  private border!: Phaser.GameObjects.Graphics;
  private cooldownOverlay!: Phaser.GameObjects.Graphics;
  private keyText!: Phaser.GameObjects.Text;
  private cooldownText!: Phaser.GameObjects.Text;
  private stackText: Phaser.GameObjects.Text | null = null;

  private cooldownProgress: number = 0; // 0-1, 0=ready, 1=full cooldown

  constructor(scene: Phaser.Scene, config: SkillSlotConfig) {
    super(scene, config.x, config.y);
    this.config = config;

    this.createSlot();

    scene.add.existing(this);
    this.setDepth(UI_DEPTH.SKILL_ICON);
  }

  private createSlot(): void {
    const { size, keyLabel, slot } = this.config;
    const halfSize = size / 2;

    // 背景
    this.background = this.scene.add.rectangle(0, 0, size, size, UI_COLORS.SLOT_BG);
    this.add(this.background);

    // 枠線
    this.border = this.scene.add.graphics();
    this.drawBorder(UI_COLORS.SLOT_BORDER);
    this.add(this.border);

    // CDオーバーレイ（扇形）
    this.cooldownOverlay = this.scene.add.graphics();
    this.cooldownOverlay.setDepth(UI_DEPTH.SKILL_OVERLAY);
    this.add(this.cooldownOverlay);

    // CD秒数テキスト（上部・キーラベルより上）
    this.cooldownText = this.scene.add.text(0, -halfSize - 28, '', {
      font: '12px monospace',
      color: '#ff6666',
    });
    this.cooldownText.setOrigin(0.5, 0.5);
    this.cooldownText.setDepth(UI_DEPTH.SKILL_TEXT);
    this.add(this.cooldownText);

    // キーラベル（スロット直上）
    this.keyText = this.scene.add.text(0, -halfSize - 12, keyLabel, {
      font: 'bold 14px monospace',
      color: '#ffffff',
    });
    this.keyText.setOrigin(0.5, 0.5);
    this.keyText.setDepth(UI_DEPTH.SKILL_TEXT);
    this.add(this.keyText);

    // Wスキル用スタック表示
    if (slot === SkillSlot.W) {
      this.stackText = this.scene.add.text(0, 0, '', {
        font: 'bold 24px monospace',
        color: '#00ffff',
      });
      this.stackText.setOrigin(0.5, 0.5);
      this.stackText.setDepth(UI_DEPTH.SKILL_TEXT);
      this.add(this.stackText);
    }
  }

  private drawBorder(color: number): void {
    const { size } = this.config;
    const halfSize = size / 2;

    this.border.clear();
    this.border.lineStyle(2, color, 1);
    this.border.strokeRect(-halfSize, -halfSize, size, size);
  }

  /**
   * CDオーバーレイを扇形で描画
   * @param progress 0-1 (0=使用可能, 1=CD開始直後)
   */
  private drawCooldownArc(progress: number): void {
    const { size } = this.config;
    const halfSize = size / 2;
    const radius = halfSize - 2;

    this.cooldownOverlay.clear();

    if (progress <= 0) return;

    this.cooldownOverlay.fillStyle(UI_COLORS.SLOT_COOLDOWN_OVERLAY, 0.7);

    // 12時方向から時計回りに描画
    const startAngle = -Math.PI / 2;
    const endAngle = startAngle + Math.PI * 2 * progress;

    this.cooldownOverlay.slice(0, 0, radius, startAngle, endAngle, false);
    this.cooldownOverlay.fillPath();
  }

  /**
   * スロット状態を更新
   */
  updateState(
    state: SkillState,
    cooldownRemaining: number,
    cooldownTotal: number,
    stacks?: number
  ): void {
    // 枠線の色を更新
    switch (state) {
      case SkillState.READY:
        this.drawBorder(UI_COLORS.SLOT_BORDER_READY);
        this.cooldownText.setText('READY');
        this.cooldownText.setColor('#00ff88');
        break;
      case SkillState.CASTING:
        this.drawBorder(UI_COLORS.SLOT_BORDER_CASTING);
        this.cooldownText.setText('CAST');
        this.cooldownText.setColor('#ffff00');
        break;
      case SkillState.EXECUTING:
        this.drawBorder(UI_COLORS.SLOT_BORDER_CASTING);
        this.cooldownText.setText('');
        break;
      case SkillState.COOLDOWN:
        this.drawBorder(UI_COLORS.SLOT_BORDER);
        // 秒数表示（小数点1桁）
        const seconds = cooldownRemaining / 1000;
        this.cooldownText.setText(seconds.toFixed(1) + 's');
        this.cooldownText.setColor('#ff6666');
        break;
    }

    // CDオーバーレイ更新
    if (state === SkillState.COOLDOWN && cooldownTotal > 0) {
      this.cooldownProgress = cooldownRemaining / cooldownTotal;
      this.drawCooldownArc(this.cooldownProgress);
    } else {
      this.cooldownProgress = 0;
      this.drawCooldownArc(0);
    }

    // スタック表示（Wスキル）
    if (this.stackText && stacks !== undefined) {
      if (stacks > 0) {
        this.stackText.setText(stacks.toString());
        this.stackText.setVisible(true);
      } else {
        this.stackText.setVisible(false);
      }
    }
  }

  /**
   * Wスキル用：スタックとCD両方を更新
   */
  updateStackState(
    stacks: number,
    _maxStacks: number,
    nextStackTime: number
  ): void {
    // スタックがある場合はREADY扱い
    if (stacks > 0) {
      this.drawBorder(UI_COLORS.SLOT_BORDER_READY);
      this.cooldownText.setText(`x${stacks}`);
      this.cooldownText.setColor('#00ffff');
      this.drawCooldownArc(0);
    } else {
      // スタック0の場合はCD表示
      this.drawBorder(UI_COLORS.SLOT_BORDER);
      const seconds = nextStackTime / 1000;
      this.cooldownText.setText(seconds.toFixed(1) + 's');
      this.cooldownText.setColor('#ff6666');
      // 進捗表示（7秒CDを想定）
      this.drawCooldownArc(nextStackTime / 7000);
    }

    // スタック数を中央に表示
    if (this.stackText) {
      this.stackText.setText(stacks.toString());
      this.stackText.setVisible(true);
    }
  }

  /**
   * 使用可能になった時のパルスアニメーション
   */
  playReadyAnimation(): void {
    this.scene.tweens.add({
      targets: this.background,
      alpha: { from: 1, to: 0.5 },
      duration: 200,
      yoyo: true,
      repeat: 2,
    });
  }

  /**
   * 破棄
   */
  destroy(fromScene?: boolean): void {
    this.border.destroy();
    this.cooldownOverlay.destroy();
    super.destroy(fromScene);
  }
}
