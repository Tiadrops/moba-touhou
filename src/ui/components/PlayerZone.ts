import Phaser from 'phaser';
import { Player } from '@/entities/Player';
import { SkillSlot, SkillState, BuffType } from '@/types';
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

  // 装備スロット
  private equipmentSlots: Phaser.GameObjects.Rectangle[] = [];
  private equipmentBorders: Phaser.GameObjects.Graphics[] = [];

  // パラメータ表示
  private statsPanelBg!: Phaser.GameObjects.Rectangle;
  private statsTexts: Phaser.GameObjects.Text[] = [];

  // スコアボード
  private scoreboardBg!: Phaser.GameObjects.Rectangle;
  private scoreboardTexts: Phaser.GameObjects.Text[] = [];
  private breakScoreUnit!: Phaser.GameObjects.Text; // x100単位表示
  private breakCount: number = 0;
  private gameStartTime: number = 0;
  private totalScore: number = 0; // 過去ステージのスコア合算

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
    this.createEquipmentSlots();
    this.createStatsPanel();
    this.createScoreboard();
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

  /**
   * 装備スロットを作成（6スロット）
   */
  private createEquipmentSlots(): void {
    const layout = UI_LAYOUT.PLAYER_ZONE.EQUIPMENT_SLOTS;
    const { SLOT_SIZE, SLOT_GAP, SLOT_COUNT } = layout;
    const totalWidth = (SLOT_SIZE + SLOT_GAP) * SLOT_COUNT - SLOT_GAP;
    const startX = layout.X - totalWidth / 2 + SLOT_SIZE / 2;

    for (let i = 0; i < SLOT_COUNT; i++) {
      const slotX = startX + i * (SLOT_SIZE + SLOT_GAP);

      // スロット背景
      const slot = this.scene.add.rectangle(
        slotX,
        layout.Y,
        SLOT_SIZE,
        SLOT_SIZE,
        0x2a2a4e
      );
      slot.setAlpha(0.8);
      this.add(slot);
      this.equipmentSlots.push(slot);

      // スロット枠線
      const border = this.scene.add.graphics();
      border.lineStyle(2, 0x4a4a6a, 1);
      border.strokeRect(
        slotX - SLOT_SIZE / 2,
        layout.Y - SLOT_SIZE / 2,
        SLOT_SIZE,
        SLOT_SIZE
      );
      this.add(border);
      this.equipmentBorders.push(border);
    }
  }

  /**
   * パラメータ表示パネルを作成
   */
  private createStatsPanel(): void {
    const layout = UI_LAYOUT.PLAYER_ZONE.STATS_PANEL;
    const stats = this.player.getCombatStats();

    const statLabels = [
      { label: 'ATK', getValue: () => Math.floor(this.player.getEffectiveAttackPower()) },
      { label: 'AS', getValue: () => this.player.getEffectiveAttackSpeed().toFixed(2) },
      { label: 'DEF', getValue: () => this.player.getDefense() },
      { label: 'MS', getValue: () => Math.floor(this.player.getEffectiveMoveSpeed()) },
      { label: 'Range', getValue: () => Math.floor(stats.attackRange) },
      { label: 'Crit', getValue: () => `${Math.floor(stats.critChance * 100)}%` },
    ];

    // 背景パネル
    const bgHeight = statLabels.length * layout.LINE_HEIGHT + layout.PADDING * 2;
    this.statsPanelBg = this.scene.add.rectangle(
      layout.X + layout.WIDTH / 2,
      layout.Y + bgHeight / 2,
      layout.WIDTH,
      bgHeight,
      0x1a1a2e
    );
    this.statsPanelBg.setAlpha(0.7);
    this.add(this.statsPanelBg);

    statLabels.forEach((stat, index) => {
      const text = this.scene.add.text(
        layout.X,
        layout.Y + layout.PADDING + index * layout.LINE_HEIGHT,
        `${stat.label}: ${stat.getValue()}`,
        {
          font: '16px monospace',
          color: '#aaddaa',
        }
      );
      this.add(text);
      this.statsTexts.push(text);
    });
  }

  /**
   * スコアボードを作成
   */
  private createScoreboard(): void {
    const layout = UI_LAYOUT.PLAYER_ZONE.SCOREBOARD;

    // 背景パネル（4行分）
    const bgHeight = 4 * layout.LINE_HEIGHT + layout.PADDING * 2;
    this.scoreboardBg = this.scene.add.rectangle(
      layout.X,
      layout.Y + bgHeight / 2,
      layout.WIDTH,
      bgHeight,
      0x1a1a2e
    );
    this.scoreboardBg.setAlpha(0.7);
    this.add(this.scoreboardBg);

    // スコアテキスト（4行）
    const labels = ['Total Score', 'Stage Score', 'Break Score', 'Time Score'];
    labels.forEach((label, index) => {
      const text = this.scene.add.text(
        layout.X - layout.WIDTH / 2 + layout.PADDING,
        layout.Y + layout.PADDING + index * layout.LINE_HEIGHT,
        `${label}: 0`,
        {
          font: '16px monospace',
          color: '#ffdd88',
        }
      );
      this.add(text);
      this.scoreboardTexts.push(text);
    });

    // Break Score用の単位表示（小さいフォント、後で位置調整）
    this.breakScoreUnit = this.scene.add.text(
      0, 0,
      'x100',
      {
        font: '11px monospace',
        color: '#ffdd88',
      }
    );
    this.breakScoreUnit.setAlpha(0.8);
    this.add(this.breakScoreUnit);

    // ゲーム開始時間を記録
    this.gameStartTime = this.scene.time.now;
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
    this.updateStatsPanel();
    this.updateScoreboard(time);
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
    const buffEffects: { type: string; remainingTime: number; totalDuration?: number; stacks?: number }[] = [];

    // バフを追加
    buffs.forEach(buff => {
      buffEffects.push({
        type: buff.type,
        remainingTime: buff.remainingTime,
        totalDuration: 5000, // バフのデフォルト持続時間（適切な値に調整）
      });
    });

    // 針巫女スタック
    const haribabaStacks = this.player.getHaribabaStacks();
    if (haribabaStacks > 0) {
      const haribabaTimer = this.player.getHaribabaStackTimer();
      buffEffects.push({
        type: BuffType.HARIBABA_STACK,
        remainingTime: haribabaTimer,
        totalDuration: SKILL_CONFIG.REIMU_Q.HARIBABA_STACK.DURATION,
        stacks: haribabaStacks,
      });
    }

    // Eスキルダッシュ中のダメージカット
    if (this.player.getIsDashing()) {
      buffEffects.push({
        type: 'damage_cut',
        remainingTime: this.player.getDashTimeRemaining(),
        totalDuration: SKILL_CONFIG.REIMU_E.DASH_DURATION,
      });
    }

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
   * パラメータ表示を更新
   */
  private updateStatsPanel(): void {
    const stats = this.player.getCombatStats();
    // 1m = 55px で変換
    const msInMeters = (this.player.getEffectiveMoveSpeed() / 55).toFixed(1);
    const rangeInMeters = (stats.attackRange / 55).toFixed(1);
    const statValues = [
      `ATK: ${Math.floor(this.player.getEffectiveAttackPower())}`,
      `AS: ${this.player.getEffectiveAttackSpeed().toFixed(2)}`,
      `DEF: ${this.player.getDefense()}`,
      `MS: ${msInMeters}m`,
      `Range: ${rangeInMeters}m`,
      `Crit: ${Math.floor(stats.critChance * 100)}%`,
    ];

    this.statsTexts.forEach((text, index) => {
      if (statValues[index]) {
        text.setText(statValues[index]);
      }
    });
  }

  /**
   * スコアボードを更新
   */
  private updateScoreboard(time: number): void {
    const layout = UI_LAYOUT.PLAYER_ZONE.SCOREBOARD;
    const targetTime = layout.TARGET_TIME;

    // 経過時間（秒）
    const elapsedSeconds = Math.floor((time - this.gameStartTime) / 1000);

    // タイムスコア表示: 経過時間 / 目標時間
    const timeScoreDisplay = `${elapsedSeconds}s / ${targetTime}s`;

    // タイムボーナス（目標時間 - 経過時間）、マイナスにならないように
    const timeBonus = Math.max(0, targetTime - elapsedSeconds);

    // ステージスコア: BreakScore x 100 + タイムボーナス x 100（0以上）
    const stageScore = Math.max(0, this.breakCount * 100 + timeBonus * 100);

    // トータルスコア: 過去ステージのスコア合算 + 現在のステージスコア
    const currentTotalScore = this.totalScore + stageScore;

    // テキスト更新
    if (this.scoreboardTexts[0]) {
      this.scoreboardTexts[0].setText(`Total Score: ${currentTotalScore}`);
    }
    if (this.scoreboardTexts[1]) {
      this.scoreboardTexts[1].setText(`Stage Score: ${stageScore}`);
    }
    if (this.scoreboardTexts[2]) {
      this.scoreboardTexts[2].setText(`Break Score: ${this.breakCount}`);
      // 単位をBreak Scoreテキストの直後に配置
      const breakText = this.scoreboardTexts[2];
      this.breakScoreUnit.setPosition(
        breakText.x + breakText.width + 4,
        breakText.y + 4
      );
    }
    if (this.scoreboardTexts[3]) {
      this.scoreboardTexts[3].setText(`Time Score: ${timeScoreDisplay}`);
    }
  }

  /**
   * ブレイク回数を増加
   */
  addBreak(): void {
    this.breakCount++;
  }

  /**
   * 現在のブレイク回数を取得
   */
  getBreakCount(): number {
    return this.breakCount;
  }

  /**
   * ステージクリア時にスコアを確定してtotalScoreに加算
   */
  finalizeStageScore(time: number): number {
    const layout = UI_LAYOUT.PLAYER_ZONE.SCOREBOARD;
    const targetTime = layout.TARGET_TIME;
    const elapsedSeconds = Math.floor((time - this.gameStartTime) / 1000);
    const timeBonus = Math.max(0, targetTime - elapsedSeconds);
    const stageScore = Math.max(0, this.breakCount * 100 + timeBonus * 100);

    this.totalScore += stageScore;

    // 次のステージ用にリセット
    this.breakCount = 0;
    this.gameStartTime = time;

    return stageScore;
  }

  /**
   * 現在のトータルスコアを取得
   */
  getTotalScore(): number {
    return this.totalScore;
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
    this.equipmentBorders.forEach(border => border.destroy());
    this.statsTexts.forEach(text => text.destroy());
    this.scoreboardTexts.forEach(text => text.destroy());
    this.breakScoreUnit?.destroy();
    super.destroy(fromScene);
  }
}
