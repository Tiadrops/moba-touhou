import Phaser from 'phaser';
import { Player } from '@/entities/Player';
import { SkillSlot, SkillState } from '@/types';
import { SKILL_CONFIG } from '@/config/GameConfig';
import { UI_LAYOUT, UI_DEPTH, SKILL_KEY_LABELS } from '../constants/UIConstants';
import { SkillSlotUI } from './SkillSlotUI';
import { HealthBar } from './HealthBar';
import { CombinedStatusEffectBar } from './StatusEffectSlotUI';

/**
 * プレイヤーゾーン（右側全体）
 * エネミーゾーンと左右対称のレイアウト
 * 立ち絵 + HPバー + 残機 + スキルバー + バフ表示
 */
export class PlayerZone extends Phaser.GameObjects.Container {
  private player: Player;

  // 表示要素
  private portrait!: Phaser.GameObjects.Image;
  private nameText!: Phaser.GameObjects.Text;
  private healthBar!: HealthBar;
  private livesStars!: Phaser.GameObjects.Text;
  private livesText!: Phaser.GameObjects.Text;

  // スキルバー
  private skillSlots: SkillSlotUI[] = [];

  // バフ/デバフ表示
  private statusEffectBar!: CombinedStatusEffectBar;

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

  // 残機
  private lives: number = 3;
  private maxLives: number = 3;

  constructor(scene: Phaser.Scene, player: Player) {
    super(scene, 0, 0);
    this.player = player;

    this.createPortrait();
    this.createInfoPanel();
    this.createSkillBar();
    this.createStatusEffectDisplay();

    scene.add.existing(this);
    this.setDepth(UI_DEPTH.ZONE_BG);
  }

  private createPortrait(): void {
    const layout = UI_LAYOUT.PLAYER_ZONE.PORTRAIT;

    // 霊夢の立ち絵画像
    this.portrait = this.scene.add.image(layout.X, layout.Y, 'portrait_reimu');
    this.portrait.setAlpha(layout.ALPHA);
    // 画像サイズをレイアウトに合わせてスケール
    this.portrait.setDisplaySize(layout.WIDTH, layout.HEIGHT);
    this.add(this.portrait);
  }

  private createInfoPanel(): void {
    const layout = UI_LAYOUT.PLAYER_ZONE.INFO_PANEL;
    const hpLayout = UI_LAYOUT.PLAYER_ZONE.HP_BAR;
    const livesY = UI_LAYOUT.PLAYER_ZONE.LIVES_INFO.Y;

    // プレイヤー名（中央揃え、HPバーの上）
    this.nameText = this.scene.add.text(
      layout.X,
      layout.Y,
      '博麗 霊夢',
      {
        font: 'bold 24px monospace',
        color: '#00ff88',
      }
    );
    this.nameText.setOrigin(0.5, 0.5);
    this.add(this.nameText);

    // HPバー（エネミーと同じ位置）
    this.healthBar = new HealthBar(this.scene, {
      x: hpLayout.X + hpLayout.WIDTH / 2,
      y: hpLayout.Y,
      width: hpLayout.WIDTH,
      height: hpLayout.HEIGHT,
      showText: true,
    });

    // 残機スター表示（★★★のような東方風表示）- 中央揃え
    this.livesStars = this.scene.add.text(
      layout.X,
      livesY,
      '',
      {
        font: 'bold 28px monospace',
        color: '#00ff88',
      }
    );
    this.livesStars.setOrigin(0.5, 0);
    this.add(this.livesStars);

    // 残機テキスト表示（残機 3/3のような表示）- 中央揃え
    this.livesText = this.scene.add.text(
      layout.X,
      livesY + 35,
      '',
      {
        font: '16px monospace',
        color: '#aaaaaa',
      }
    );
    this.livesText.setOrigin(0.5, 0);
    this.add(this.livesText);

    // 初期表示更新
    this.updateLivesDisplay();
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
  }

  /**
   * バフ/デバフ表示を作成
   */
  private createStatusEffectDisplay(): void {
    const layout = UI_LAYOUT.PLAYER_ZONE.STATUS_EFFECTS;

    // CombinedStatusEffectBarはscene.add.existingで追加されるため、
    // this.add()せずに絶対座標で直接配置
    this.statusEffectBar = new CombinedStatusEffectBar(this.scene, {
      x: layout.X,
      y: layout.Y,
      slotSize: 40,
      slotGap: 8,
      slotsPerRow: 10,   // 1行10個（横幅を広く）
    });
    // Containerに追加しない（絶対座標で配置済み）
  }

  /**
   * 毎フレーム更新
   */
  update(time: number): void {
    this.updateSkillSlots(time);
    this.updateHealthBar();
    this.updateStatusEffects();
  }

  /**
   * 残機表示を更新
   */
  private updateLivesDisplay(): void {
    // 残り残機を★で表示
    const stars = '★'.repeat(this.lives);
    const emptyStars = '☆'.repeat(this.maxLives - this.lives);
    this.livesStars.setText(stars + emptyStars);

    // 残機テキスト
    this.livesText.setText(`残機 ${this.lives}/${this.maxLives}`);
  }

  /**
   * バフ/デバフ表示を更新
   */
  private updateStatusEffects(): void {
    const buffs = this.player.getBuffs();
    const buffEffects: { type: string; remainingTime: number; totalDuration?: number }[] = [];

    // バフを追加
    buffs.forEach(buff => {
      buffEffects.push({
        type: buff.type,
        remainingTime: buff.remainingTime,
        totalDuration: 5000, // バフのデフォルト持続時間（適切な値に調整）
      });
    });

    // 無敵状態
    if (this.player.getIsRSkillActive()) {
      buffEffects.push({
        type: 'invincible',
        remainingTime: 2000, // 無敵の残り時間（適切な値に調整）
        totalDuration: 2000,
      });
    }

    // デバフ（現在プレイヤーにはデバフなし）
    const debuffEffects: { type: string; remainingTime: number; totalDuration?: number }[] = [];

    this.statusEffectBar.updateEffects(buffEffects, debuffEffects);
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
   * 残機を設定
   */
  setLives(lives: number, maxLives?: number): void {
    this.lives = lives;
    if (maxLives !== undefined) {
      this.maxLives = maxLives;
    }
    this.updateLivesDisplay();
  }

  /**
   * 残機を1減らす
   */
  loseLife(): void {
    if (this.lives > 0) {
      this.lives--;
      this.updateLivesDisplay();

      // 残機減少アニメーション
      this.scene.tweens.add({
        targets: this.livesStars,
        scale: { from: 1.5, to: 1 },
        duration: 300,
        ease: 'Back.easeOut',
      });
    }
  }

  /**
   * 現在の残機を取得
   */
  getLives(): number {
    return this.lives;
  }

  /**
   * ダメージ時のフラッシュアニメーション
   */
  playDamageAnimation(): void {
    // 立ち絵を赤くフラッシュ
    this.scene.tweens.add({
      targets: this.portrait,
      tint: { from: 0xff0000, to: 0xffffff },
      duration: 200,
      onComplete: () => {
        this.portrait.clearTint();
      },
    });
    this.healthBar.playDamageAnimation();
  }

  /**
   * 破棄
   */
  destroy(fromScene?: boolean): void {
    this.skillSlots.forEach(slot => slot.destroy());
    this.healthBar.destroy();
    this.statusEffectBar.destroy();
    super.destroy(fromScene);
  }
}
