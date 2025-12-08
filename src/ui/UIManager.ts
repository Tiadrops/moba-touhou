import Phaser from 'phaser';
import { Player } from '@/entities/Player';
import { Enemy } from '@/entities/Enemy';
import { Boss } from '@/entities/Boss';
import { EnemyType } from '@/types';
import { PlayerZone } from './components/PlayerZone';
import { EnemyZone } from './components/EnemyZone';

/**
 * UI全体を管理するクラス
 */
export class UIManager {
  private scene: Phaser.Scene;
  private player: Player;

  // UIコンポーネント
  private playerZone!: PlayerZone;
  private enemyZone!: EnemyZone;

  constructor(scene: Phaser.Scene, player: Player) {
    this.scene = scene;
    this.player = player;

    this.createUI();
  }

  private createUI(): void {
    // プレイヤーゾーン（右側全体 + スキルバー + HPバー）
    this.playerZone = new PlayerZone(this.scene, this.player);

    // エネミーゾーン（左側全体、初期非表示）
    this.enemyZone = new EnemyZone(this.scene);
  }

  /**
   * 毎フレーム更新
   */
  update(time: number, _delta: number): void {
    // プレイヤーゾーンを更新（スキルバー、HPバー含む）
    this.playerZone.update(time);

    // エネミーゾーンを更新（表示中の場合のみ）
    this.enemyZone.update();
  }

  /**
   * ボス/中ボス情報を表示（Enemy用）
   */
  showBossInfo(enemy: Enemy): void {
    const enemyType = enemy.getEnemyType();
    if (enemyType === EnemyType.MINI_BOSS || enemyType === EnemyType.BOSS) {
      this.enemyZone.showBossInfo(enemy);
    }
  }

  /**
   * ボスクラス用の表示
   */
  showBoss(boss: Boss, name: string): void {
    this.enemyZone.showBoss(boss, name);
  }

  /**
   * ボス情報を非表示
   */
  hideBossInfo(): void {
    this.enemyZone.hideBossInfo();
  }

  /**
   * プレイヤーダメージ時のアニメーション
   */
  onPlayerDamage(): void {
    this.playerZone.playDamageAnimation();
  }

  /**
   * ボスダメージ時のアニメーション
   */
  onBossDamage(): void {
    if (this.enemyZone.getIsVisible()) {
      this.enemyZone.playDamageAnimation();
    }
  }

  /**
   * ボスフェーズ変更
   */
  setBossPhase(phaseIndex: number, phaseName?: string, isSpellCard?: boolean): void {
    this.enemyZone.setPhase(phaseIndex, phaseName, isSpellCard);
  }

  /**
   * 破棄
   */
  destroy(): void {
    this.playerZone.destroy();
    this.enemyZone.destroy();
  }
}
