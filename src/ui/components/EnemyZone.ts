import Phaser from 'phaser';
import { Enemy } from '@/entities/Enemy';
import { EnemyType } from '@/types';
import { UI_LAYOUT, UI_DEPTH } from '../constants/UIConstants';
import { HealthBar } from './HealthBar';

/**
 * エネミーゾーン（左側全体）
 * ボス/中ボス戦時のみ表示
 */
export class EnemyZone extends Phaser.GameObjects.Container {
  private currentEnemy: Enemy | null = null;

  // 表示要素
  private portrait!: Phaser.GameObjects.Rectangle;
  private nameText!: Phaser.GameObjects.Text;
  private healthBar!: HealthBar;
  private phaseText!: Phaser.GameObjects.Text;

  private isVisible: boolean = false;

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

    // フェーズ表示
    this.phaseText = this.scene.add.text(
      layout.X,
      layout.Y + 150,
      '',
      {
        font: 'bold 16px monospace',
        color: '#ffff00',
        backgroundColor: '#000000aa',
        padding: { x: 8, y: 4 },
      }
    );
    this.add(this.phaseText);
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
        this.isVisible = false;
      },
    });
  }

  /**
   * 毎フレーム更新
   */
  update(): void {
    if (!this.isVisible || !this.currentEnemy) return;

    // HPバーを更新
    this.healthBar.update(
      this.currentEnemy.getCurrentHp(),
      this.currentEnemy.getMaxHp()
    );

    // 敵が倒されたら非表示
    if (!this.currentEnemy.getIsActive()) {
      this.hideBossInfo();
    }
  }

  /**
   * フェーズ変更時の表示更新
   */
  setPhase(phase: number): void {
    this.phaseText.setText(`[PHASE ${phase}]`);
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
