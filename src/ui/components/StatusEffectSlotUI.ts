import Phaser from 'phaser';
import { StatusEffectType, BuffType } from '@/types';
import { UI_DEPTH } from '../constants/UIConstants';

/**
 * バフ/デバフの表示設定
 */
interface EffectDisplayConfig {
  icon: string;       // 表示アイコン
  color: number;      // 枠線色
  bgColor: number;    // 背景色
  label: string;      // ラベル
}

/**
 * バフタイプの表示設定
 */
const BUFF_DISPLAY_CONFIG: Record<string, EffectDisplayConfig> = {
  [BuffType.ATTACK_SPEED]: {
    icon: '⚡',
    color: 0x00ffff,
    bgColor: 0x003333,
    label: 'AS',
  },
  [BuffType.MOVE_SPEED]: {
    icon: '💨',
    color: 0x00ff00,
    bgColor: 0x003300,
    label: 'SPD',
  },
  [BuffType.DAMAGE]: {
    icon: '⚔',
    color: 0xff6600,
    bgColor: 0x331100,
    label: 'ATK',
  },
  [BuffType.ATTACK_POWER]: {
    icon: '⚔',
    color: 0xff6600,
    bgColor: 0x331100,
    label: 'ATK',
  },
  [BuffType.AA_MULTIPLIER]: {
    icon: '🎯',
    color: 0xff00ff,
    bgColor: 0x330033,
    label: 'AA',
  },
  [BuffType.DEFENSE]: {
    icon: '🛡',
    color: 0x6666ff,
    bgColor: 0x111133,
    label: 'DEF',
  },
  [BuffType.CRIT_CHANCE]: {
    icon: '💥',
    color: 0xffff00,
    bgColor: 0x333300,
    label: 'CRT',
  },
  // 無敵（特殊バフ）
  invincible: {
    icon: '✨',
    color: 0xffff00,
    bgColor: 0x333300,
    label: '無敵',
  },
};

/**
 * デバフタイプの表示設定
 */
const DEBUFF_DISPLAY_CONFIG: Record<string, EffectDisplayConfig> = {
  [StatusEffectType.STUN]: {
    icon: '💫',
    color: 0xffff00,
    bgColor: 0x333300,
    label: 'STUN',
  },
  [StatusEffectType.SLOW]: {
    icon: '🐢',
    color: 0x6666ff,
    bgColor: 0x111133,
    label: 'SLOW',
  },
  [StatusEffectType.ROOT]: {
    icon: '🌿',
    color: 0x00aa00,
    bgColor: 0x002200,
    label: 'ROOT',
  },
  [StatusEffectType.SILENCE]: {
    icon: '🔇',
    color: 0x9900ff,
    bgColor: 0x220033,
    label: 'SLNC',
  },
};

export interface StatusEffectSlotConfig {
  x: number;
  y: number;
  size: number;
  type: string;       // BuffType | StatusEffectType | 'invincible'
  isBuff: boolean;    // true=バフ、false=デバフ
}

/**
 * 個別バフ/デバフスロットUIコンポーネント
 */
export class StatusEffectSlotUI extends Phaser.GameObjects.Container {
  private config: StatusEffectSlotConfig;
  private background!: Phaser.GameObjects.Rectangle;
  private border!: Phaser.GameObjects.Graphics;
  private durationBar!: Phaser.GameObjects.Rectangle;
  private durationBarBg!: Phaser.GameObjects.Rectangle;
  private iconText!: Phaser.GameObjects.Text;
  private labelText!: Phaser.GameObjects.Text;
  private durationText!: Phaser.GameObjects.Text;

  private displayConfig: EffectDisplayConfig;
  private maxDuration: number = 0;

  constructor(scene: Phaser.Scene, config: StatusEffectSlotConfig) {
    super(scene, config.x, config.y);
    this.config = config;

    // 表示設定を取得
    if (config.isBuff) {
      this.displayConfig = BUFF_DISPLAY_CONFIG[config.type] || {
        icon: '?',
        color: 0x888888,
        bgColor: 0x222222,
        label: '???',
      };
    } else {
      this.displayConfig = DEBUFF_DISPLAY_CONFIG[config.type] || {
        icon: '?',
        color: 0x888888,
        bgColor: 0x222222,
        label: '???',
      };
    }

    this.createSlot();

    // 親コンテナに追加されるため、scene.add.existingは呼ばない
    this.setDepth(UI_DEPTH.SKILL_ICON);
  }

  private createSlot(): void {
    const { size } = this.config;
    const { color, bgColor, icon, label } = this.displayConfig;
    const halfSize = size / 2;

    // 背景
    this.background = this.scene.add.rectangle(0, 0, size, size, bgColor);
    this.background.setAlpha(0.8);
    this.add(this.background);

    // 枠線
    this.border = this.scene.add.graphics();
    this.border.lineStyle(2, color, 1);
    this.border.strokeRect(-halfSize, -halfSize, size, size);
    this.add(this.border);

    // 持続時間バー背景
    const barWidth = size - 8;
    const barHeight = 4;
    this.durationBarBg = this.scene.add.rectangle(
      0,
      halfSize - 6,
      barWidth,
      barHeight,
      0x000000
    );
    this.durationBarBg.setAlpha(0.5);
    this.add(this.durationBarBg);

    // 持続時間バー
    this.durationBar = this.scene.add.rectangle(
      -barWidth / 2,
      halfSize - 6,
      barWidth,
      barHeight,
      color
    );
    this.durationBar.setOrigin(0, 0.5);
    this.add(this.durationBar);

    // アイコン
    this.iconText = this.scene.add.text(0, -4, icon, {
      font: `${Math.floor(size * 0.5)}px sans-serif`,
    });
    this.iconText.setOrigin(0.5, 0.5);
    this.add(this.iconText);

    // ラベル（下部）
    this.labelText = this.scene.add.text(0, halfSize + 10, label, {
      font: '10px monospace',
      color: '#ffffff',
    });
    this.labelText.setOrigin(0.5, 0);
    this.add(this.labelText);

    // 残り時間テキスト（上部）
    this.durationText = this.scene.add.text(0, -halfSize - 12, '', {
      font: 'bold 11px monospace',
      color: '#ffffff',
    });
    this.durationText.setOrigin(0.5, 0.5);
    this.add(this.durationText);
  }

  /**
   * 残り時間を更新
   * @param remainingTime 残り時間（ms）
   * @param totalDuration 総持続時間（ms）- 最初に設定される
   */
  updateDuration(remainingTime: number, totalDuration?: number): void {
    // 総持続時間が指定されたら更新
    if (totalDuration !== undefined && totalDuration > 0) {
      this.maxDuration = totalDuration;
    }

    // バーの幅を更新
    const { size } = this.config;
    const barWidth = size - 8;
    const ratio = this.maxDuration > 0 ? remainingTime / this.maxDuration : 1;
    this.durationBar.width = barWidth * Math.max(0, Math.min(1, ratio));

    // 残り時間テキスト
    const seconds = remainingTime / 1000;
    this.durationText.setText(seconds.toFixed(1) + 's');

    // 残り時間が少ない時は点滅
    if (seconds <= 1) {
      this.durationText.setColor('#ff4444');
      this.iconText.setAlpha(0.5 + Math.sin(Date.now() / 100) * 0.5);
    } else {
      this.durationText.setColor('#ffffff');
      this.iconText.setAlpha(1);
    }
  }

  /**
   * 出現アニメーション
   */
  playAppearAnimation(): void {
    this.setScale(0);
    this.setAlpha(0);
    this.scene.tweens.add({
      targets: this,
      scale: 1,
      alpha: 1,
      duration: 200,
      ease: 'Back.easeOut',
    });
  }

  /**
   * 消滅アニメーション
   */
  playDisappearAnimation(onComplete?: () => void): void {
    this.scene.tweens.add({
      targets: this,
      scale: 0,
      alpha: 0,
      duration: 150,
      ease: 'Power2',
      onComplete: () => {
        if (onComplete) onComplete();
        this.destroy();
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

/**
 * 複数のバフ/デバフを管理するコンテナ
 */
export interface StatusEffectBarConfig {
  x: number;
  y: number;
  slotSize: number;
  slotGap: number;
  slotsPerRow: number;  // 1行あたりのスロット数
  maxRows: number;      // 最大行数
  isBuff: boolean;      // true=バフバー、false=デバフバー
}

export class StatusEffectBar extends Phaser.GameObjects.Container {
  private barConfig: StatusEffectBarConfig;
  private slots: Map<string, StatusEffectSlotUI> = new Map();
  private background!: Phaser.GameObjects.Rectangle;
  private backgroundBorder!: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene, config: StatusEffectBarConfig) {
    super(scene, config.x, config.y);
    this.barConfig = config;

    this.createBackground();

    scene.add.existing(this);
    this.setDepth(UI_DEPTH.SKILL_ICON);
  }

  /**
   * 背景エリアを作成
   */
  private createBackground(): void {
    const { slotSize, slotGap, slotsPerRow, isBuff } = this.barConfig;

    // 背景エリアのサイズ計算
    const bgWidth = slotsPerRow * (slotSize + slotGap) + 20;
    // スロット: 上部テキスト(12px上) + 本体(slotSize) + ラベル(10px下) = slotSize + 22
    // 1行あたりの高さ + 少し余白
    const singleRowHeight = slotSize + 24;
    const bgHeight = singleRowHeight + 16; // 1行分 + 上下パディング

    // バフは緑系、デバフは赤/オレンジ系
    const bgColor = isBuff ? 0x004422 : 0x442200;
    const borderColor = isBuff ? 0x00ff88 : 0xff6644;

    // 背景中心のY座標（スロット中心がY=0なので、背景も中心をY=0に）
    const centerY = 0;

    this.background = this.scene.add.rectangle(0, centerY, bgWidth, bgHeight, bgColor, 0.25);
    this.background.setStrokeStyle(1, borderColor, 0.5);
    this.add(this.background);

    // 装飾枠
    this.backgroundBorder = this.scene.add.graphics();
    this.backgroundBorder.lineStyle(1, borderColor, 0.3);

    // 上部の装飾ライン
    const topY = centerY - bgHeight / 2 + 4;
    const bottomY = centerY + bgHeight / 2 - 4;
    this.backgroundBorder.lineBetween(-bgWidth / 2 + 8, topY, bgWidth / 2 - 8, topY);
    // 下部の装飾ライン
    this.backgroundBorder.lineBetween(-bgWidth / 2 + 8, bottomY, bgWidth / 2 - 8, bottomY);
    this.add(this.backgroundBorder);
  }

  /**
   * バフ/デバフリストを更新（2段表示対応）
   * @param effects { type: string, remainingTime: number, totalDuration?: number }[]
   */
  updateEffects(effects: { type: string; remainingTime: number; totalDuration?: number }[]): void {
    const { slotSize, slotGap, slotsPerRow, maxRows, isBuff } = this.barConfig;
    const maxSlots = slotsPerRow * maxRows;
    const currentTypes = new Set(effects.map(e => e.type));

    // 削除されたエフェクトを消す
    this.slots.forEach((slot, type) => {
      if (!currentTypes.has(type)) {
        slot.playDisappearAnimation(() => {
          this.slots.delete(type);
        });
      }
    });

    // エフェクトを更新/追加（2段表示）
    const effectsToShow = effects.slice(0, maxSlots);
    const rowHeight = slotSize + 28;

    effectsToShow.forEach((effect, index) => {
      const row = Math.floor(index / slotsPerRow);
      const col = index % slotsPerRow;

      // その行のスロット数
      const slotsInThisRow = Math.min(
        slotsPerRow,
        effectsToShow.length - row * slotsPerRow
      );
      const rowWidth = slotsInThisRow * (slotSize + slotGap) - slotGap;
      const rowStartX = -rowWidth / 2 + slotSize / 2;

      const x = rowStartX + col * (slotSize + slotGap);
      const y = row * rowHeight;

      let slot = this.slots.get(effect.type);

      if (!slot) {
        // 新しいスロットを作成
        slot = new StatusEffectSlotUI(this.scene, {
          x,
          y,
          size: slotSize,
          type: effect.type,
          isBuff,
        });
        this.add(slot);
        this.slots.set(effect.type, slot);
        slot.playAppearAnimation();
      } else {
        // 既存スロットの位置を更新（アニメーション付き）
        if (slot.x !== x || slot.y !== y) {
          this.scene.tweens.add({
            targets: slot,
            x,
            y,
            duration: 150,
            ease: 'Power2',
          });
        }
      }

      // 残り時間を更新
      slot.updateDuration(effect.remainingTime, effect.totalDuration);
    });
  }

  /**
   * 全てのスロットをクリア
   */
  clearAll(): void {
    this.slots.forEach(slot => {
      slot.playDisappearAnimation();
    });
    this.slots.clear();
  }

  /**
   * 破棄
   */
  destroy(fromScene?: boolean): void {
    this.slots.forEach(slot => slot.destroy());
    this.slots.clear();
    this.backgroundBorder.destroy();
    super.destroy(fromScene);
  }
}

/**
 * 上段バフ・下段デバフの2行構成バー
 */
export interface CombinedStatusEffectBarConfig {
  x: number;
  y: number;
  slotSize: number;
  slotGap: number;
  slotsPerRow: number;  // 1行あたりのスロット数
}

export class CombinedStatusEffectBar extends Phaser.GameObjects.Container {
  private barConfig: CombinedStatusEffectBarConfig;
  private buffSlots: Map<string, StatusEffectSlotUI> = new Map();
  private debuffSlots: Map<string, StatusEffectSlotUI> = new Map();
  private background!: Phaser.GameObjects.Rectangle;
  private backgroundBorder!: Phaser.GameObjects.Graphics;
  private buffLabel!: Phaser.GameObjects.Text;
  private debuffLabel!: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, config: CombinedStatusEffectBarConfig) {
    super(scene, config.x, config.y);
    this.barConfig = config;

    this.createBackground();

    scene.add.existing(this);
    this.setDepth(UI_DEPTH.SKILL_ICON);
  }

  /**
   * 背景エリアを作成（2行分）
   */
  private createBackground(): void {
    const { slotSize, slotGap, slotsPerRow } = this.barConfig;

    // 背景エリアのサイズ計算
    const bgWidth = slotsPerRow * (slotSize + slotGap) + 20;
    // 2行分: 各行 = slotSize + 24（上部テキスト + ラベル）
    const rowHeight = slotSize + 28;
    const bgHeight = rowHeight * 2 + 16; // 2行分 + 上下パディング

    // 紫系の統一背景
    const bgColor = 0x222244;
    const borderColor = 0x6666aa;

    this.background = this.scene.add.rectangle(0, 0, bgWidth, bgHeight, bgColor, 0.25);
    this.background.setStrokeStyle(1, borderColor, 0.5);
    this.add(this.background);

    // 装飾枠
    this.backgroundBorder = this.scene.add.graphics();
    this.backgroundBorder.lineStyle(1, borderColor, 0.3);

    // 上部の装飾ライン
    const topY = -bgHeight / 2 + 4;
    const bottomY = bgHeight / 2 - 4;
    this.backgroundBorder.lineBetween(-bgWidth / 2 + 8, topY, bgWidth / 2 - 8, topY);
    // 中央の分割ライン
    this.backgroundBorder.lineStyle(1, 0x888888, 0.3);
    this.backgroundBorder.lineBetween(-bgWidth / 2 + 8, 0, bgWidth / 2 - 8, 0);
    // 下部の装飾ライン
    this.backgroundBorder.lineStyle(1, borderColor, 0.3);
    this.backgroundBorder.lineBetween(-bgWidth / 2 + 8, bottomY, bgWidth / 2 - 8, bottomY);
    this.add(this.backgroundBorder);

    // バフ/デバフラベル（左側）
    this.buffLabel = this.scene.add.text(-bgWidth / 2 + 4, -rowHeight / 2, 'BUFF', {
      font: 'bold 10px monospace',
      color: '#00ff88',
    });
    this.buffLabel.setOrigin(0, 0.5);
    this.buffLabel.setAlpha(0.7);
    this.add(this.buffLabel);

    this.debuffLabel = this.scene.add.text(-bgWidth / 2 + 4, rowHeight / 2, 'DEBUFF', {
      font: 'bold 10px monospace',
      color: '#ff6644',
    });
    this.debuffLabel.setOrigin(0, 0.5);
    this.debuffLabel.setAlpha(0.7);
    this.add(this.debuffLabel);
  }

  /**
   * バフとデバフを更新
   * @param buffs バフリスト
   * @param debuffs デバフリスト
   */
  updateEffects(
    buffs: { type: string; remainingTime: number; totalDuration?: number }[],
    debuffs: { type: string; remainingTime: number; totalDuration?: number }[]
  ): void {
    const { slotSize, slotGap, slotsPerRow } = this.barConfig;
    const rowHeight = slotSize + 28;

    // 上段（バフ）の更新 - Y座標は負の方向
    this.updateRow(buffs, this.buffSlots, -rowHeight / 2, true, slotSize, slotGap, slotsPerRow);

    // 下段（デバフ）の更新 - Y座標は正の方向
    this.updateRow(debuffs, this.debuffSlots, rowHeight / 2, false, slotSize, slotGap, slotsPerRow);
  }

  /**
   * 1行分のエフェクトを更新
   */
  private updateRow(
    effects: { type: string; remainingTime: number; totalDuration?: number }[],
    slots: Map<string, StatusEffectSlotUI>,
    rowY: number,
    isBuff: boolean,
    slotSize: number,
    slotGap: number,
    slotsPerRow: number
  ): void {
    const currentTypes = new Set(effects.map(e => e.type));

    // 削除されたエフェクトを消す
    slots.forEach((slot, type) => {
      if (!currentTypes.has(type)) {
        slot.playDisappearAnimation(() => {
          slots.delete(type);
        });
      }
    });

    // エフェクトを更新/追加
    const effectsToShow = effects.slice(0, slotsPerRow);
    const rowWidth = effectsToShow.length * (slotSize + slotGap) - slotGap;
    const rowStartX = -rowWidth / 2 + slotSize / 2;

    effectsToShow.forEach((effect, index) => {
      const x = rowStartX + index * (slotSize + slotGap);
      const y = rowY;

      let slot = slots.get(effect.type);

      if (!slot) {
        // 新しいスロットを作成
        slot = new StatusEffectSlotUI(this.scene, {
          x,
          y,
          size: slotSize,
          type: effect.type,
          isBuff,
        });
        this.add(slot);
        slots.set(effect.type, slot);
        slot.playAppearAnimation();
      } else {
        // 既存スロットの位置を更新（アニメーション付き）
        if (slot.x !== x || slot.y !== y) {
          this.scene.tweens.add({
            targets: slot,
            x,
            y,
            duration: 150,
            ease: 'Power2',
          });
        }
      }

      // 残り時間を更新
      slot.updateDuration(effect.remainingTime, effect.totalDuration);
    });
  }

  /**
   * 全てのスロットをクリア
   */
  clearAll(): void {
    this.buffSlots.forEach(slot => {
      slot.playDisappearAnimation();
    });
    this.buffSlots.clear();
    this.debuffSlots.forEach(slot => {
      slot.playDisappearAnimation();
    });
    this.debuffSlots.clear();
  }

  /**
   * 破棄
   */
  destroy(fromScene?: boolean): void {
    this.buffSlots.forEach(slot => slot.destroy());
    this.buffSlots.clear();
    this.debuffSlots.forEach(slot => slot.destroy());
    this.debuffSlots.clear();
    this.backgroundBorder.destroy();
    super.destroy(fromScene);
  }
}
