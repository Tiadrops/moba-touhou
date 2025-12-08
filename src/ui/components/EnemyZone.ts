import Phaser from 'phaser';
import { Enemy } from '@/entities/Enemy';
import { Boss } from '@/entities/Boss';
import { EnemyType } from '@/types';
import { UI_LAYOUT, UI_DEPTH } from '../constants/UIConstants';
import { HealthBar } from './HealthBar';

/**
 * エネミーゾーン（左側全体）
 * ボス/中ボス戦時のみ表示
 */
export class EnemyZone extends Phaser.GameObjects.Container {
  private currentEnemy: Enemy | null = null;
  private currentBoss: Boss | null = null;

  // 表示要素
  private portrait!: Phaser.GameObjects.Rectangle;
  private nameText!: Phaser.GameObjects.Text;
  private healthBar!: HealthBar;
  private phaseText!: Phaser.GameObjects.Text;
  private phaseStars!: Phaser.GameObjects.Text;
  private spellCardName!: Phaser.GameObjects.Text;

  private isVisible: boolean = false;
  private totalPhases: number = 1;
  private currentPhaseIndex: number = 0;

  constructor(scene: Phaser.Scene) {
    super(scene, 0, 0);

    this.createPortrait();
    this.createInfoPanel();

    scene.add.existing(this);
    this.setDepth(UI_DEPTH.ZONE_BG);

    // 初期状態は非表示
    this.setVisible(false);
    this.setAlpha(0);
  }

  private createPortrait(): void {
    const layout = UI_LAYOUT.ENEMY_ZONE.PORTRAIT;

    // 仮の立ち絵（左側全体を覆う半透明の四角形）
    this.portrait = this.scene.add.rectangle(
      layout.X,
      layout.Y,
      layout.WIDTH,
      layout.HEIGHT,
      0xff4444,
      layout.ALPHA
    );
    this.add(this.portrait);

    // ボス名テキスト（立ち絵の上部）
    const portraitNameText = this.scene.add.text(
      layout.X,
      layout.Y - layout.HEIGHT / 2 + 50,
      '',
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
    const layout = UI_LAYOUT.ENEMY_ZONE.INFO_PANEL;

    // エネミー名
    this.nameText = this.scene.add.text(
      layout.X,
      layout.Y,
      '',
      {
        font: 'bold 20px monospace',
        color: '#ff6666',
        backgroundColor: '#000000aa',
        padding: { x: 8, y: 4 },
      }
    );
    this.add(this.nameText);

    // HPバー
    const hpLayout = UI_LAYOUT.ENEMY_ZONE.HP_BAR;
    this.healthBar = new HealthBar(this.scene, {
      x: hpLayout.X + hpLayout.WIDTH / 2,
      y: hpLayout.Y,
      width: hpLayout.WIDTH,
      height: hpLayout.HEIGHT,
      showText: true,
      isBossBar: true,
    });

    // フェーズ表示（Phase 1/2のような表示）- HPバーの下に配置
    const hpBarBottom = hpLayout.Y + hpLayout.HEIGHT;
    this.phaseText = this.scene.add.text(
      layout.X,
      hpBarBottom + 15,
      '',
      {
        font: 'bold 16px monospace',
        color: '#ffffff',
        backgroundColor: '#000000aa',
        padding: { x: 8, y: 4 },
      }
    );
    this.add(this.phaseText);

    // フェーズスター表示（★★★のような東方風表示）
    this.phaseStars = this.scene.add.text(
      layout.X,
      hpBarBottom + 45,
      '',
      {
        font: 'bold 24px monospace',
        color: '#ffff00',
      }
    );
    this.add(this.phaseStars);

    // スペルカード名（スペルカードフェーズ時のみ表示）
    this.spellCardName = this.scene.add.text(
      layout.X,
      hpBarBottom + 80,
      '',
      {
        font: 'bold 18px monospace',
        color: '#ff6666',
        backgroundColor: '#000000cc',
        padding: { x: 12, y: 6 },
      }
    );
    this.spellCardName.setVisible(false);
    this.add(this.spellCardName);
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

    // ルーミアの色（暗い紫）
    this.portrait.setFillStyle(0x660066, 0.4);

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

      if (!this.currentEnemy.getIsActive()) {
        this.hideBossInfo();
      }
    }
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
    this.scene.tweens.add({
      targets: this.portrait,
      fillColor: { from: 0xffffff, to: 0xff4444 },
      duration: 100,
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
    super.destroy(fromScene);
  }
}
