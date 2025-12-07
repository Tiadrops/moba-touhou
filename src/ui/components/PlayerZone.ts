import Phaser from 'phaser';
import { Player } from '@/entities/Player';
import { SkillSlot, SkillState } from '@/types';
import { SKILL_CONFIG } from '@/config/GameConfig';
import { UI_LAYOUT, UI_DEPTH, BUFF_DISPLAY_NAMES, SKILL_KEY_LABELS } from '../constants/UIConstants';
import { SkillSlotUI } from './SkillSlotUI';
import { HealthBar } from './HealthBar';

/**
 * プレイヤーゾーン（右側全体）
 * 立ち絵 + ステータス表示 + スキルバー + HPバー
 */
export class PlayerZone extends Phaser.GameObjects.Container {
  private player: Player;

  // 表示要素
  private portrait!: Phaser.GameObjects.Rectangle;
  private nameText!: Phaser.GameObjects.Text;
  private statsText!: Phaser.GameObjects.Text;
  private buffContainer!: Phaser.GameObjects.Container;
  private buffTexts: Phaser.GameObjects.Text[] = [];

  // スキルバー
  private skillSlots: SkillSlotUI[] = [];
  private healthBar!: HealthBar;

  // スキルスロット順序
  private readonly slotOrder: SkillSlot[] = [
    SkillSlot.Q,
    SkillSlot.W,
    SkillSlot.E,
    SkillSlot.R,
    SkillSlot.D,
    SkillSlot.F,
  ];

  // 各スキルの最大CD（ms）
  private readonly maxCooldowns: Record<SkillSlot, number> = {
    [SkillSlot.Q]: SKILL_CONFIG.REIMU_Q.COOLDOWN,
    [SkillSlot.W]: SKILL_CONFIG.REIMU_W.COOLDOWN,
    [SkillSlot.E]: SKILL_CONFIG.REIMU_E.COOLDOWN,
    [SkillSlot.R]: SKILL_CONFIG.REIMU_R.COOLDOWN,
    [SkillSlot.D]: 180000,
    [SkillSlot.F]: 180000,
  };

  constructor(scene: Phaser.Scene, player: Player) {
    super(scene, 0, 0);
    this.player = player;

    this.createPortrait();
    this.createInfoPanel();
    this.createBuffDisplay();
    this.createSkillBar();

    scene.add.existing(this);
    this.setDepth(UI_DEPTH.ZONE_BG);
  }

  private createPortrait(): void {
    const layout = UI_LAYOUT.PLAYER_ZONE.PORTRAIT;

    // 仮の立ち絵（右側全体を覆う半透明の四角形）
    this.portrait = this.scene.add.rectangle(
      layout.X,
      layout.Y,
      layout.WIDTH,
      layout.HEIGHT,
      0x00ff88,
      layout.ALPHA
    );
    this.add(this.portrait);

    // キャラクター名テキスト（立ち絵の上部）
    const charConfig = this.player.getCharacterConfig();
    const portraitNameText = this.scene.add.text(
      layout.X,
      layout.Y - layout.HEIGHT / 2 + 50,
      charConfig.name,
      {
        font: 'bold 32px monospace',
        color: '#ffffff',
      }
    );
    portraitNameText.setOrigin(0.5, 0.5);
    portraitNameText.setAlpha(0.6);
    this.add(portraitNameText);
  }

  private createInfoPanel(): void {
    const layout = UI_LAYOUT.PLAYER_ZONE.INFO_PANEL;

    // キャラクター名
    const charConfig = this.player.getCharacterConfig();
    this.nameText = this.scene.add.text(
      layout.X,
      layout.Y,
      charConfig.name,
      {
        font: 'bold 20px monospace',
        color: '#00ff88',
        backgroundColor: '#000000aa',
        padding: { x: 8, y: 4 },
      }
    );
    this.add(this.nameText);

    // ステータステキスト
    this.statsText = this.scene.add.text(
      layout.X,
      layout.Y + 35,
      '',
      {
        font: '16px monospace',
        color: '#ffffff',
        backgroundColor: '#000000aa',
        padding: { x: 8, y: 4 },
        lineSpacing: 6,
      }
    );
    this.add(this.statsText);
  }

  private createBuffDisplay(): void {
    const layout = UI_LAYOUT.PLAYER_ZONE.INFO_PANEL;

    this.buffContainer = this.scene.add.container(layout.X, layout.Y + 150);
    this.add(this.buffContainer);
  }

  private createSkillBar(): void {
    const skillBarLayout = UI_LAYOUT.PLAYER_ZONE.SKILL_BAR;
    const { SLOT_SIZE, SLOT_GAP } = skillBarLayout;
    const totalWidth = (SLOT_SIZE + SLOT_GAP) * 6 - SLOT_GAP;
    const startX = skillBarLayout.X - totalWidth / 2 + SLOT_SIZE / 2;

    this.slotOrder.forEach((slot, index) => {
      const slotUI = new SkillSlotUI(this.scene, {
        slot,
        x: startX + index * (SLOT_SIZE + SLOT_GAP),
        y: skillBarLayout.Y,
        size: SLOT_SIZE,
        keyLabel: SKILL_KEY_LABELS[index],
      });
      this.skillSlots.push(slotUI);
    });

    // HPバー
    const hpBarLayout = skillBarLayout.HP_BAR;
    this.healthBar = new HealthBar(this.scene, {
      x: skillBarLayout.X,
      y: skillBarLayout.Y + hpBarLayout.OFFSET_Y,
      width: hpBarLayout.WIDTH,
      height: hpBarLayout.HEIGHT,
      showText: true,
    });
  }

  /**
   * 毎フレーム更新
   */
  update(time: number): void {
    this.updateStats();
    this.updateBuffs();
    this.updateSkillSlots(time);
    this.updateHealthBar();
  }

  private updateStats(): void {
    const charConfig = this.player.getCharacterConfig();
    const stats = charConfig.stats;

    const effectiveAS = this.player.getEffectiveAttackSpeed();
    const effectiveSPD = this.player.getEffectiveMoveSpeed();
    const effectiveATK = this.player.getEffectiveAttackPower();

    const hasASBuff = effectiveAS !== stats.attackSpeed;
    const hasSPDBuff = effectiveSPD !== stats.moveSpeed;
    const hasATKBuff = effectiveATK !== stats.attackPower;

    const lines = [
      `HP: ${Math.ceil(this.player.getCurrentHp())} / ${stats.maxHp}`,
      `ATK: ${stats.attackPower}${hasATKBuff ? ` (${effectiveATK.toFixed(1)})` : ''}`,
      `AS: ${stats.attackSpeed.toFixed(1)}${hasASBuff ? ` (${effectiveAS.toFixed(1)})` : ''}`,
      `SPD: ${stats.moveSpeed}${hasSPDBuff ? ` (${effectiveSPD.toFixed(0)})` : ''}`,
      `DEF: ${stats.defense}`,
      `CRIT: ${(stats.critChance * 100).toFixed(0)}%`,
    ];

    this.statsText.setText(lines.join('\n'));
  }

  private updateBuffs(): void {
    const buffs = this.player.getBuffs();

    this.buffTexts.forEach(text => text.destroy());
    this.buffTexts = [];

    if (buffs.length > 0) {
      const separatorText = this.scene.add.text(0, 0, '─────────────', {
        font: '12px monospace',
        color: '#4a4a6a',
      });
      this.buffContainer.add(separatorText);
      this.buffTexts.push(separatorText);
    }

    buffs.forEach((buff, index) => {
      const displayName = BUFF_DISPLAY_NAMES[buff.type] || buff.type;
      const seconds = (buff.remainingTime / 1000).toFixed(1);
      const text = this.scene.add.text(
        0,
        20 + index * 24,
        `[${displayName}↑ ${seconds}s]`,
        {
          font: '14px monospace',
          color: '#88ff88',
        }
      );
      this.buffContainer.add(text);
      this.buffTexts.push(text);
    });

    if (this.player.getIsRSkillActive()) {
      const invincibleText = this.scene.add.text(
        0,
        20 + buffs.length * 24,
        '[無敵]',
        {
          font: 'bold 14px monospace',
          color: '#ffff00',
        }
      );
      this.buffContainer.add(invincibleText);
      this.buffTexts.push(invincibleText);
    }
  }

  private updateSkillSlots(time: number): void {
    this.slotOrder.forEach((slot, index) => {
      const slotUI = this.skillSlots[index];

      if (slot === SkillSlot.D || slot === SkillSlot.F) {
        slotUI.updateState(SkillState.READY, 0, 0);
      } else {
        const cooldownRemaining = this.player.getSkillCooldownRemaining(slot, time);
        const maxCooldown = this.maxCooldowns[slot];

        let state: SkillState;
        if (cooldownRemaining > 0) {
          state = SkillState.COOLDOWN;
        } else {
          state = SkillState.READY;
        }

        slotUI.updateState(state, cooldownRemaining, maxCooldown);
      }
    });
  }

  private updateHealthBar(): void {
    this.healthBar.update(
      this.player.getCurrentHp(),
      this.player.getMaxHp()
    );
  }

  /**
   * ダメージ時のフラッシュアニメーション
   */
  playDamageAnimation(): void {
    this.scene.tweens.add({
      targets: this.portrait,
      fillColor: { from: 0xff0000, to: 0x00ff88 },
      duration: 200,
    });
    this.healthBar.playDamageAnimation();
  }

  /**
   * 破棄
   */
  destroy(fromScene?: boolean): void {
    this.buffTexts.forEach(text => text.destroy());
    this.skillSlots.forEach(slot => slot.destroy());
    this.healthBar.destroy();
    super.destroy(fromScene);
  }
}
