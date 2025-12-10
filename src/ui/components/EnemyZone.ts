import Phaser from 'phaser';
import { Enemy } from '@/entities/Enemy';
import { Boss } from '@/entities/Boss';
import { EnemyType, StatusEffectType, BossSkillSlot, BossSkillState } from '@/types';
import { UI_LAYOUT, UI_DEPTH } from '../constants/UIConstants';
import { HealthBar } from './HealthBar';
import { CombinedStatusEffectBar } from './StatusEffectSlotUI';

/**
 * エネミーゾーン（左側全体）
 * ボス/中ボス戦時のみ表示
 */
export class EnemyZone extends Phaser.GameObjects.Container {
  private currentEnemy: Enemy | null = null;
  private currentBoss: Boss | null = null;

  // 表示要素
  private portrait!: Phaser.GameObjects.Image;
  private nameText!: Phaser.GameObjects.Text;
  private healthBar!: HealthBar;
  private phaseText!: Phaser.GameObjects.Text;
  private phaseStars!: Phaser.GameObjects.Text;
  private spellCardName!: Phaser.GameObjects.Text;

  private isVisible: boolean = false;
  private totalPhases: number = 1;
  private currentPhaseIndex: number = 0;
  private isCCed: boolean = false;  // CC状態を追跡

  // ボススキルバー
  private skillSlotContainers: Phaser.GameObjects.Container[] = [];
  private skillSlotBgs: Phaser.GameObjects.Rectangle[] = [];
  private skillSlotOverlays: Phaser.GameObjects.Rectangle[] = [];
  private skillSlotLabels: Phaser.GameObjects.Text[] = [];
  private skillSlotCdTexts: Phaser.GameObjects.Text[] = [];

  // バフ/デバフ表示
  private statusEffectBar!: CombinedStatusEffectBar;

  constructor(scene: Phaser.Scene) {
    super(scene, 0, 0);

    this.createPortrait();
    this.createInfoPanel();
    this.createBossSkillBar();
    this.createStatusEffectDisplay();

    scene.add.existing(this);
    this.setDepth(UI_DEPTH.ZONE_BG);

    // 初期状態は非表示
    this.setVisible(false);
    this.setAlpha(0);
  }

  private createPortrait(): void {
    const layout = UI_LAYOUT.ENEMY_ZONE.PORTRAIT;

    // ルーミアの立ち絵画像（初期状態は通常立ち絵）
    this.portrait = this.scene.add.image(layout.X, layout.Y, 'portrait_rumia_1');
    this.portrait.setAlpha(layout.ALPHA);
    this.portrait.setDisplaySize(layout.WIDTH, layout.HEIGHT);
    this.add(this.portrait);
  }

  private createInfoPanel(): void {
    const layout = UI_LAYOUT.ENEMY_ZONE.INFO_PANEL;
    const hpLayout = UI_LAYOUT.ENEMY_ZONE.HP_BAR;
    const phaseY = UI_LAYOUT.ENEMY_ZONE.PHASE_INFO.Y;

    // ボス名（中央揃え、HPバーの上）
    this.nameText = this.scene.add.text(
      layout.X,
      layout.Y,
      '',
      {
        font: 'bold 24px monospace',
        color: '#ff6666',
      }
    );
    this.nameText.setOrigin(0.5, 0.5);
    this.add(this.nameText);

    // HPバー（名前の下）
    this.healthBar = new HealthBar(this.scene, {
      x: hpLayout.X + hpLayout.WIDTH / 2,
      y: hpLayout.Y,
      width: hpLayout.WIDTH,
      height: hpLayout.HEIGHT,
      showText: true,
      isBossBar: true,
    });

    // フェーズスター表示（★★★のような東方風表示）- 中央揃え
    this.phaseStars = this.scene.add.text(
      layout.X,
      phaseY,
      '',
      {
        font: 'bold 28px monospace',
        color: '#ffff00',
      }
    );
    this.phaseStars.setOrigin(0.5, 0);
    this.add(this.phaseStars);

    // フェーズ表示（Phase 1/2のような表示）- 中央揃え
    this.phaseText = this.scene.add.text(
      layout.X,
      phaseY + 35,
      '',
      {
        font: '16px monospace',
        color: '#aaaaaa',
      }
    );
    this.phaseText.setOrigin(0.5, 0);
    this.add(this.phaseText);

    // スペルカード名（スペルカードフェーズ時のみ表示）- 中央揃え
    this.spellCardName = this.scene.add.text(
      layout.X,
      phaseY + 65,
      '',
      {
        font: 'bold 18px monospace',
        color: '#ff4444',
        backgroundColor: '#000000cc',
        padding: { x: 12, y: 6 },
      }
    );
    this.spellCardName.setOrigin(0.5, 0);
    this.spellCardName.setVisible(false);
    this.add(this.spellCardName);
  }

  /**
   * ボススキルバーを作成（左下に配置）
   */
  private createBossSkillBar(): void {
    const skillBarLayout = UI_LAYOUT.ENEMY_ZONE.BOSS_SKILL_BAR;
    const { SLOT_SIZE, SLOT_GAP } = skillBarLayout;
    const slots = [BossSkillSlot.Q, BossSkillSlot.W, BossSkillSlot.E, BossSkillSlot.R];
    const totalWidth = (SLOT_SIZE + SLOT_GAP) * slots.length - SLOT_GAP;
    const startX = skillBarLayout.X - totalWidth / 2 + SLOT_SIZE / 2;

    slots.forEach((slot, index) => {
      const x = startX + index * (SLOT_SIZE + SLOT_GAP);
      const y = skillBarLayout.Y;

      // スロットコンテナ
      const container = this.scene.add.container(x, y);
      this.add(container);
      this.skillSlotContainers.push(container);

      // 背景
      const bg = this.scene.add.rectangle(0, 0, SLOT_SIZE, SLOT_SIZE, 0x2a2a4e);
      bg.setStrokeStyle(2, 0x4a4a6a);
      container.add(bg);
      this.skillSlotBgs.push(bg);

      // クールダウンオーバーレイ
      const overlay = this.scene.add.rectangle(0, 0, SLOT_SIZE, SLOT_SIZE, 0x000000, 0.7);
      overlay.setVisible(false);
      container.add(overlay);
      this.skillSlotOverlays.push(overlay);

      // スキルラベル（Q/W/E/R）
      const label = this.scene.add.text(0, 0, slot, {
        font: 'bold 20px monospace',
        color: '#ff6666',
      });
      label.setOrigin(0.5, 0.5);
      container.add(label);
      this.skillSlotLabels.push(label);

      // クールダウンテキスト
      const cdText = this.scene.add.text(0, SLOT_SIZE / 2 + 12, '', {
        font: '12px monospace',
        color: '#aaaaaa',
      });
      cdText.setOrigin(0.5, 0);
      container.add(cdText);
      this.skillSlotCdTexts.push(cdText);
    });
  }

  /**
   * バフ/デバフ表示を作成
   */
  private createStatusEffectDisplay(): void {
    const layout = UI_LAYOUT.ENEMY_ZONE.STATUS_EFFECTS;

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
   * ボス/中ボス情報を表示
   */
  showBossInfo(enemy: Enemy): void {
    this.currentEnemy = enemy;
    this.isVisible = true;

    // エネミー名を設定
    const enemyType = enemy.getEnemyType();
    let displayName = '';
    switch (enemyType) {
      case EnemyType.MINI_BOSS:
        displayName = '中ボス';
        break;
      case EnemyType.BOSS:
        displayName = 'ボス';
        break;
      default:
        displayName = 'エネミー';
    }
    this.nameText.setText(displayName);

    // 表示アニメーション（左から入る）
    this.setVisible(true);
    this.x = -200;
    this.scene.tweens.add({
      targets: this,
      alpha: 1,
      x: 0,
      duration: 500,
      ease: 'Power2',
    });
  }

  /**
   * Bossクラス用の表示
   */
  showBoss(boss: Boss, name: string): void {
    this.currentBoss = boss;
    this.currentEnemy = null;
    this.isVisible = true;

    this.nameText.setText(name);

    // フェーズ情報を初期化
    this.totalPhases = boss.getTotalPhases();
    this.currentPhaseIndex = boss.getCurrentPhaseIndex();
    this.updatePhaseDisplay();

    // 立ち絵を通常状態にリセット
    this.portrait.setTexture('portrait_rumia_1');

    // 表示アニメーション（左から入る）
    this.setVisible(true);
    this.x = -200;
    this.scene.tweens.add({
      targets: this,
      alpha: 1,
      x: 0,
      duration: 500,
      ease: 'Power2',
    });
  }

  /**
   * ボス情報を非表示
   */
  hideBossInfo(): void {
    this.scene.tweens.add({
      targets: this,
      alpha: 0,
      x: -200,
      duration: 300,
      ease: 'Power2',
      onComplete: () => {
        this.setVisible(false);
        this.currentEnemy = null;
        this.currentBoss = null;
        this.isVisible = false;
      },
    });
  }

  /**
   * 毎フレーム更新
   */
  update(): void {
    if (!this.isVisible) return;

    // Bossクラスの場合
    if (this.currentBoss) {
      this.healthBar.update(
        this.currentBoss.getCurrentHp(),
        this.currentBoss.getMaxHp()
      );

      // CC状態に応じて立ち絵を切り替え
      this.updatePortraitByCC(this.currentBoss.hasStatusEffect(StatusEffectType.STUN));

      // ボススキルバーを更新
      this.updateBossSkillBar();

      // バフ/デバフ表示を更新
      this.updateStatusEffects();

      if (!this.currentBoss.getIsActive()) {
        this.hideBossInfo();
      }
      return;
    }

    // Enemyクラスの場合
    if (this.currentEnemy) {
      this.healthBar.update(
        this.currentEnemy.getCurrentHp(),
        this.currentEnemy.getMaxHp()
      );

      // CC状態に応じて立ち絵を切り替え
      this.updatePortraitByCC(this.currentEnemy.hasStatusEffect(StatusEffectType.STUN));

      if (!this.currentEnemy.getIsActive()) {
        this.hideBossInfo();
      }
    }
  }

  /**
   * CC状態に応じて立ち絵を切り替え
   */
  private updatePortraitByCC(isStunned: boolean): void {
    // 状態が変わった時のみテクスチャを切り替え
    if (isStunned && !this.isCCed) {
      this.isCCed = true;
      this.portrait.setTexture('portrait_rumia_2');
    } else if (!isStunned && this.isCCed) {
      this.isCCed = false;
      this.portrait.setTexture('portrait_rumia_1');
    }
  }

  /**
   * ボススキルバーを更新
   */
  private updateBossSkillBar(): void {
    if (!this.currentBoss) return;

    const skillStates = this.currentBoss.getAllSkillStates();
    const slots = [BossSkillSlot.Q, BossSkillSlot.W, BossSkillSlot.E, BossSkillSlot.R];

    slots.forEach((slot, index) => {
      const skillState = skillStates.get(slot);
      const overlay = this.skillSlotOverlays[index];
      const cdText = this.skillSlotCdTexts[index];
      const label = this.skillSlotLabels[index];
      const bg = this.skillSlotBgs[index];

      if (!skillState) {
        // スキルが存在しない場合は非表示
        overlay.setVisible(false);
        cdText.setText('');
        return;
      }

      const { state, cooldownRemaining } = skillState;

      if (state === BossSkillState.CASTING) {
        // キャスト中 - 黄色枠
        bg.setStrokeStyle(3, 0xffff00);
        overlay.setVisible(false);
        cdText.setText('');
        label.setColor('#ffff00');
      } else if (state === BossSkillState.EXECUTING) {
        // 実行中 - 緑枠
        bg.setStrokeStyle(3, 0x00ff00);
        overlay.setVisible(false);
        cdText.setText('');
        label.setColor('#00ff00');
      } else if (cooldownRemaining > 0) {
        // クールダウン中
        bg.setStrokeStyle(2, 0x4a4a6a);
        overlay.setVisible(true);
        const cdSeconds = (cooldownRemaining / 1000).toFixed(1);
        cdText.setText(`${cdSeconds}s`);
        label.setColor('#666666');
      } else {
        // 準備完了
        bg.setStrokeStyle(2, 0xff6666);
        overlay.setVisible(false);
        cdText.setText('');
        label.setColor('#ff6666');
      }
    });
  }

  /**
   * バフ/デバフ表示を更新
   */
  private updateStatusEffects(): void {
    if (!this.currentBoss) {
      this.statusEffectBar.updateEffects([], []);
      return;
    }

    const statusEffects = this.currentBoss.getStatusEffects();
    const debuffEffects: { type: string; remainingTime: number; totalDuration?: number }[] = [];

    // 状態異常を追加（デバフ）
    statusEffects.forEach(effect => {
      debuffEffects.push({
        type: effect.type,
        remainingTime: effect.remainingTime,
        totalDuration: 3000, // デバフのデフォルト持続時間
      });
    });

    // バフ（現在ボスにはバフなし）
    const buffEffects: { type: string; remainingTime: number; totalDuration?: number }[] = [];

    this.statusEffectBar.updateEffects(buffEffects, debuffEffects);
  }

  /**
   * フェーズ変更時の表示更新
   */
  setPhase(phaseIndex: number, phaseName?: string, isSpellCard?: boolean): void {
    this.currentPhaseIndex = phaseIndex;
    this.updatePhaseDisplay(phaseName, isSpellCard);

    // フェーズ変更時のアニメーション
    this.scene.tweens.add({
      targets: this.phaseStars,
      scale: { from: 1.5, to: 1 },
      duration: 300,
      ease: 'Back.easeOut',
    });
  }

  /**
   * フェーズ表示を更新
   */
  private updatePhaseDisplay(phaseName?: string, isSpellCard?: boolean): void {
    // Phase X/Y 表示
    this.phaseText.setText(`Phase ${this.currentPhaseIndex + 1}/${this.totalPhases}`);

    // 残りフェーズを★で表示（現在以降のフェーズ数）
    const remainingPhases = this.totalPhases - this.currentPhaseIndex;
    const stars = '★'.repeat(remainingPhases);
    const emptyStars = '☆'.repeat(this.currentPhaseIndex);
    this.phaseStars.setText(emptyStars + stars);

    // スペルカード名の表示
    if (isSpellCard && phaseName) {
      this.spellCardName.setText(phaseName);
      this.spellCardName.setVisible(true);
      // スペルカード時は星の色を赤に
      this.phaseStars.setColor('#ff4444');
    } else {
      // 通常フェーズではスペルカード名を非表示、星は黄色
      this.spellCardName.setVisible(false);
      this.phaseStars.setColor('#ffff00');
    }

    // ボスから現在のフェーズ情報を取得して表示を更新
    if (this.currentBoss && !phaseName) {
      const phase = this.currentBoss.getCurrentPhase();
      if (phase) {
        const bossIsSpellCard = this.currentBoss.isInSpellCard();
        if (bossIsSpellCard) {
          this.spellCardName.setText(phase.name);
          this.spellCardName.setVisible(true);
          this.phaseStars.setColor('#ff4444');
        }
      }
    }
  }

  /**
   * ダメージ時のフラッシュアニメーション
   */
  playDamageAnimation(): void {
    // 立ち絵を白くフラッシュ
    this.scene.tweens.add({
      targets: this.portrait,
      tint: { from: 0xffffff, to: 0xffffff },
      alpha: { from: 0.8, to: UI_LAYOUT.ENEMY_ZONE.PORTRAIT.ALPHA },
      duration: 100,
      onComplete: () => {
        this.portrait.clearTint();
      },
    });
  }

  /**
   * 現在表示中かどうか
   */
  getIsVisible(): boolean {
    return this.isVisible;
  }

  /**
   * 破棄
   */
  destroy(fromScene?: boolean): void {
    this.healthBar.destroy();
    this.statusEffectBar.destroy();
    super.destroy(fromScene);
  }
}
