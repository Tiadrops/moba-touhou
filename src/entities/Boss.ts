import Phaser from 'phaser';
import {
  BossSkillState,
  BossSkillSlot,
  BossSkillExecution,
  BossStats,
  StatusEffect,
  StatusEffectType,
  BossPhaseConfig,
  BossPhaseType,
} from '@/types';
import { DEPTH, COLORS } from '@/config/GameConfig';
import { BulletPool } from '@/utils/ObjectPool';
import { AudioManager } from '@/systems/AudioManager';

/**
 * ボス基底クラス
 * フェーズシステムを持つボスの基底クラス
 */
export abstract class Boss extends Phaser.Physics.Arcade.Sprite {
  // 基本ステータス
  protected stats: BossStats;
  protected currentHp: number;
  protected isActive: boolean = false;

  // フェーズシステム
  protected phases: BossPhaseConfig[] = [];
  protected currentPhaseIndex: number = 0;
  protected isPhaseTransitioning: boolean = false;

  // スキルシステム
  protected skills: Map<BossSkillSlot, BossSkillExecution> = new Map();

  // 弾幕システム
  protected bulletPool: BulletPool | null = null;
  protected playerPosition: { x: number; y: number } | null = null;

  // 状態異常
  protected statusEffects: StatusEffect[] = [];

  // グラフィックス（予告線など）
  protected warningGraphics: Phaser.GameObjects.Graphics | null = null;

  constructor(scene: Phaser.Scene, x: number, y: number, stats: BossStats) {
    super(scene, x, y, 'enemy');

    this.stats = stats;
    this.currentHp = stats.maxHp;

    // シーンに追加
    scene.add.existing(this);
    scene.physics.add.existing(this);

    // 初期設定
    this.setActive(false);
    this.setVisible(false);
    this.setDepth(DEPTH.ENEMIES);

    // 当たり判定は初期状態で無効（spawn時に有効化）
    const body = this.body as Phaser.Physics.Arcade.Body;
    if (body) {
      body.enable = false;
    }

    // 予告線用グラフィックス
    this.warningGraphics = scene.add.graphics();
    this.warningGraphics.setDepth(DEPTH.EFFECTS);

    // フェーズ初期化（サブクラスで実装）
    this.initializePhases();

    // スキル初期化（サブクラスで実装）
    this.initializeSkills();
  }

  /**
   * フェーズを初期化（サブクラスで実装）
   */
  protected abstract initializePhases(): void;

  /**
   * スキルを初期化（サブクラスで実装）
   * フェーズごとに異なるスキルセットを設定可能
   */
  protected abstract initializeSkills(): void;

  /**
   * フェーズ変更時のスキル再初期化（サブクラスで実装）
   */
  protected abstract onPhaseChange(phaseIndex: number): void;

  /**
   * AI更新（サブクラスで実装）
   */
  protected abstract updateAI(time: number, delta: number): void;

  /**
   * ボスを生成
   */
  spawn(x: number, y: number): void {
    // フェーズを最初に戻す
    this.currentPhaseIndex = 0;
    this.isPhaseTransitioning = false;

    // 現在のフェーズのHPを設定
    const currentPhase = this.getCurrentPhase();
    if (currentPhase) {
      this.currentHp = currentPhase.hp;
      this.stats.maxHp = currentPhase.hp;
    } else {
      this.currentHp = this.stats.maxHp;
    }

    this.isActive = true;
    this.statusEffects = [];

    // 位置とスケールを先に設定
    this.setPosition(x, y);
    this.setActive(true);
    this.setVisible(true);
    this.setTint(COLORS.ENEMY);
    this.setScale(1.6); // ボスは大きめ

    // 物理ボディを有効化（スケール後に設定）
    const body = this.body as Phaser.Physics.Arcade.Body;
    if (body) {
      body.enable = true;
      // スケールを考慮した当たり判定サイズ
      const scaledRadius = this.stats.hitboxRadius * 1.6;
      body.setCircle(scaledRadius);
      // オフセットはスプライトの中心に合わせる
      // displayWidthはスケール適用後のサイズ
      const offsetX = (this.displayWidth / 2) - scaledRadius;
      const offsetY = (this.displayHeight / 2) - scaledRadius;
      body.setOffset(offsetX, offsetY);
    }

    // スキルをリセット
    this.resetSkills();

    console.log(`Boss spawned at (${x}, ${y}) with HP: ${this.currentHp}, body enabled: ${body?.enable}`);
  }

  /**
   * 更新処理
   */
  update(time: number, delta: number): void {
    if (!this.isActive) {
      return;
    }

    // フェーズ遷移中は更新を停止
    if (this.isPhaseTransitioning) {
      return;
    }

    // 状態異常を更新
    this.updateStatusEffects(delta);

    // スタン中はスキルを中断
    const isStunned = this.hasStatusEffect(StatusEffectType.STUN);
    if (isStunned) {
      this.interruptAllSkills();
      this.setVelocity(0, 0);
      return;
    }

    // スキルクールダウンを更新
    this.updateSkillCooldowns(delta);

    // AI更新（サブクラス）
    this.updateAI(time, delta);

    // 予告線を描画
    this.drawWarningLines();
  }

  /**
   * スキルをリセット
   */
  protected resetSkills(): void {
    for (const [, skill] of this.skills) {
      skill.state = BossSkillState.READY;
      skill.castTimeRemaining = 0;
      skill.executionTimeRemaining = 0;
      skill.cooldownRemaining = 0;
    }
  }

  /**
   * すべてのスキルを中断（スタン時）
   */
  protected interruptAllSkills(): void {
    let didBreak = false;

    for (const [slot, skill] of this.skills) {
      if (skill.state === BossSkillState.CASTING || skill.state === BossSkillState.EXECUTING) {
        // キャスト中のスキルを中断した場合のみBreak
        if (skill.state === BossSkillState.CASTING) {
          didBreak = true;
        }
        console.log(`Skill ${slot} interrupted by stun!`);
        skill.state = BossSkillState.COOLDOWN;
        skill.cooldownRemaining = this.getSkillCooldown(skill.slot) / 2;
      }
    }

    // Break!演出（キャスト中断時のみ）
    if (didBreak) {
      this.showBreakText();
      AudioManager.getInstance().playSe('se_break');
    }

    // 予告線をクリア
    this.warningGraphics?.clear();
  }

  /**
   * スキルのクールダウンを取得（サブクラスでオーバーライド）
   */
  protected abstract getSkillCooldown(slot: BossSkillSlot): number;

  /**
   * スキルクールダウンを更新
   */
  protected updateSkillCooldowns(delta: number): void {
    for (const [, skill] of this.skills) {
      if (skill.state === BossSkillState.COOLDOWN) {
        skill.cooldownRemaining -= delta;
        if (skill.cooldownRemaining <= 0) {
          skill.state = BossSkillState.READY;
          skill.cooldownRemaining = 0;
        }
      }
    }
  }

  /**
   * スキルを使用開始
   */
  protected startSkill(slot: BossSkillSlot, castTime: number, targetAngle?: number): boolean {
    const skill = this.skills.get(slot);
    if (!skill || skill.state !== BossSkillState.READY) {
      return false;
    }

    skill.state = BossSkillState.CASTING;
    skill.castTimeRemaining = castTime;
    skill.targetAngle = targetAngle;

    console.log(`Boss starting skill ${slot}, cast time: ${castTime}ms`);
    return true;
  }

  /**
   * スキル詠唱を更新
   */
  protected updateSkillCasting(slot: BossSkillSlot, delta: number): boolean {
    const skill = this.skills.get(slot);
    if (!skill || skill.state !== BossSkillState.CASTING) {
      return false;
    }

    skill.castTimeRemaining -= delta;
    if (skill.castTimeRemaining <= 0) {
      skill.state = BossSkillState.EXECUTING;
      return true; // 詠唱完了
    }
    return false;
  }

  /**
   * スキル実行を完了
   */
  protected completeSkill(slot: BossSkillSlot, cooldown: number): void {
    const skill = this.skills.get(slot);
    if (!skill) return;

    skill.state = BossSkillState.COOLDOWN;
    skill.cooldownRemaining = cooldown;
    skill.executionTimeRemaining = 0;

    // 予告線をクリア
    this.warningGraphics?.clear();
  }

  /**
   * 予告線を描画（サブクラスでオーバーライド可能）
   */
  protected drawWarningLines(): void {
    // デフォルトは何もしない（サブクラスで実装）
  }

  /**
   * 状態異常を更新
   */
  protected updateStatusEffects(delta: number): void {
    for (let i = this.statusEffects.length - 1; i >= 0; i--) {
      this.statusEffects[i].remainingTime -= delta;
      if (this.statusEffects[i].remainingTime <= 0) {
        // スタン解除時のエフェクト
        if (this.statusEffects[i].type === StatusEffectType.STUN) {
          this.clearTint();
          this.setTint(COLORS.ENEMY);
        }
        this.statusEffects.splice(i, 1);
      }
    }
  }

  /**
   * 状態異常を付与
   */
  applyStatusEffect(effect: StatusEffect): void {
    const existingIndex = this.statusEffects.findIndex(e => e.type === effect.type);
    if (existingIndex >= 0) {
      this.statusEffects[existingIndex] = effect;
    } else {
      this.statusEffects.push(effect);
    }

    // スタンの視覚エフェクト
    if (effect.type === StatusEffectType.STUN) {
      this.setTint(0xffff00);
      this.setVelocity(0, 0);
    }
  }

  /**
   * Break!テキストを頭上に表示
   */
  protected showBreakText(): void {
    const breakText = this.scene.add.text(
      this.x,
      this.y - 80,
      'Break!',
      {
        font: 'bold 32px monospace',
        color: '#ffff00',
        stroke: '#000000',
        strokeThickness: 4,
      }
    );
    breakText.setOrigin(0.5, 0.5);
    breakText.setDepth(DEPTH.UI + 10);

    // アニメーション: 上に浮かびながらフェードアウト
    this.scene.tweens.add({
      targets: breakText,
      y: breakText.y - 50,
      alpha: { from: 1, to: 0 },
      scale: { from: 1, to: 1.3 },
      duration: 1000,
      ease: 'Power2',
      onComplete: () => {
        breakText.destroy();
      },
    });
  }

  /**
   * 特定の状態異常があるか確認
   */
  hasStatusEffect(type: StatusEffectType): boolean {
    return this.statusEffects.some(e => e.type === type);
  }

  /**
   * 全ての状態異常を取得
   */
  getStatusEffects(): StatusEffect[] {
    return this.statusEffects;
  }

  /**
   * スロウ効果を考慮した実効移動速度を取得
   */
  getEffectiveMoveSpeed(): number {
    const slowEffect = this.statusEffects.find(e => e.type === StatusEffectType.SLOW);
    if (slowEffect && slowEffect.value) {
      return this.stats.moveSpeed * (1 - slowEffect.value);
    }
    return this.stats.moveSpeed;
  }

  /**
   * 無敵状態かどうか（サブクラスでオーバーライド可能）
   */
  isInvincible(): boolean {
    return false;
  }

  /**
   * ダメージを受ける
   * @returns true: ボス撃破（最終フェーズ終了）, false: まだ生存
   */
  takeDamage(damage: number): boolean {
    if (!this.isActive || this.isPhaseTransitioning || this.isInvincible()) {
      return false;
    }

    this.currentHp -= damage;

    // 被弾SE再生
    AudioManager.getInstance().playSe('se_hit_enemy');

    this.flashDamage();

    if (this.currentHp <= 0) {
      this.currentHp = 0;
      const currentPhase = this.getCurrentPhase();

      // 最終フェーズならボス撃破
      if (currentPhase?.isFinal) {
        this.onDeath();
        return true;
      }

      // 次のフェーズへ遷移
      this.transitionToNextPhase();
      return false;
    }

    return false;
  }

  /**
   * 次のフェーズへ遷移
   */
  protected transitionToNextPhase(): void {
    if (this.isPhaseTransitioning) return;

    this.isPhaseTransitioning = true;

    // すべてのスキルを中断
    this.interruptAllSkills();
    this.setVelocity(0, 0);

    const previousPhaseIndex = this.currentPhaseIndex;
    const nextPhaseIndex = this.currentPhaseIndex + 1;

    console.log(`Phase transition: ${previousPhaseIndex} -> ${nextPhaseIndex}`);

    // フェーズ遷移イベントを発行（カットイン演出用）
    this.scene.events.emit('boss-phase-complete', {
      boss: this,
      completedPhaseIndex: previousPhaseIndex,
      nextPhaseIndex: nextPhaseIndex,
    });

    // 次フェーズの準備（カットイン後に呼ばれる）
    // startNextPhase()でフェーズを開始
  }

  /**
   * 次のフェーズを開始（カットイン演出完了後に呼ばれる）
   */
  startNextPhase(): void {
    if (!this.isPhaseTransitioning) return;

    this.currentPhaseIndex++;

    const nextPhase = this.getCurrentPhase();
    if (!nextPhase) {
      console.error('No next phase found!');
      this.onDeath();
      return;
    }

    // 新フェーズのHP設定
    this.currentHp = nextPhase.hp;
    this.stats.maxHp = nextPhase.hp;

    // スキルを再初期化（フェーズごとに異なるスキルセット）
    this.onPhaseChange(this.currentPhaseIndex);
    this.resetSkills();

    // 遷移完了
    this.isPhaseTransitioning = false;

    console.log(`Phase ${this.currentPhaseIndex} started: ${nextPhase.name}, HP: ${nextPhase.hp}`);

    // フェーズ開始イベントを発行
    this.scene.events.emit('boss-phase-start', {
      boss: this,
      phaseIndex: this.currentPhaseIndex,
      phaseName: nextPhase.name,
      isSpellCard: nextPhase.type === BossPhaseType.SPELL_CARD,
    });
  }

  /**
   * ダメージエフェクト
   */
  protected flashDamage(): void {
    this.setTint(0xffffff);
    this.scene.time.delayedCall(100, () => {
      if (this.isActive) {
        this.setTint(COLORS.ENEMY);
      }
    });
  }

  /**
   * 死亡処理
   */
  protected onDeath(): void {
    console.log('Boss defeated!');
    this.deactivate();
  }

  /**
   * 非アクティブ化
   */
  deactivate(): void {
    this.isActive = false;
    this.setActive(false);
    this.setVisible(false);
    this.setVelocity(0, 0);
    this.warningGraphics?.clear();
  }

  /**
   * 破棄
   */
  destroy(fromScene?: boolean): void {
    this.warningGraphics?.destroy();
    super.destroy(fromScene);
  }

  // セッター
  setBulletPool(pool: BulletPool): void {
    this.bulletPool = pool;
  }

  setPlayerPosition(x: number, y: number): void {
    this.playerPosition = { x, y };
  }

  // ゲッター
  getIsActive(): boolean {
    return this.isActive;
  }

  getCurrentHp(): number {
    return this.currentHp;
  }

  getMaxHp(): number {
    return this.stats.maxHp;
  }

  getDefense(): number {
    return this.stats.defense;
  }

  getAttackPower(): number {
    return this.stats.attackPower;
  }

  getStats(): BossStats {
    return this.stats;
  }

  getHitboxRadius(): number {
    return this.stats.hitboxRadius;
  }

  getSkillState(slot: BossSkillSlot): BossSkillExecution | undefined {
    return this.skills.get(slot);
  }

  getAllSkillStates(): Map<BossSkillSlot, BossSkillExecution> {
    return this.skills;
  }

  // フェーズ関連ゲッター
  getCurrentPhase(): BossPhaseConfig | null {
    if (this.phases.length === 0) return null;
    return this.phases[this.currentPhaseIndex] || null;
  }

  getCurrentPhaseIndex(): number {
    return this.currentPhaseIndex;
  }

  getTotalPhases(): number {
    return this.phases.length;
  }

  isInSpellCard(): boolean {
    const phase = this.getCurrentPhase();
    return phase ? phase.type === BossPhaseType.SPELL_CARD : false;
  }

  getIsPhaseTransitioning(): boolean {
    return this.isPhaseTransitioning;
  }

  getCurrentPhaseName(): string {
    const phase = this.getCurrentPhase();
    return phase?.name || 'Unknown';
  }

  /**
   * 次のフェーズ情報を取得（カットイン表示用）
   */
  getNextPhase(): BossPhaseConfig | null {
    const nextIndex = this.currentPhaseIndex + 1;
    if (nextIndex >= this.phases.length) return null;
    return this.phases[nextIndex];
  }
}
