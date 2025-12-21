import Phaser from 'phaser';
import { MobGroupType } from '@/types';
import { MobEnemy } from './MobEnemy';
import { UNIT, DEPTH } from '@/config/GameConfig';

/**
 * グループC雑魚（フラグ持ち）
 * HP1500, DEF0, ATK100
 * 生存時間無制限（撃破まで残る）
 * 撃破でボス戦へ移行
 *
 * スキルA: 4秒ごと
 * - プレイヤー方向に縦8.5m、横2.2mの攻撃範囲を予告
 * - 0.5秒後にダメージ
 *
 * スキルB: 10秒ごと
 * - プレイヤー方向に縦9.5m、横2.8mの攻撃範囲を予告
 * - 0.5秒後にダメージ + プレイヤーを3.5m引き寄せ（0.5秒かけて）
 * - ヒット時は即座にスキルAを追加で使用
 *
 * テクスチャ: fairy_c (zakoA1.png - 1488x1440)
 */
export class MobGroupC extends MobEnemy {
  // スキルクールダウン
  private skillACooldown: number = 4000;  // 4秒
  private skillBCooldown: number = 10000; // 10秒
  private lastSkillATime: number = 0;
  private lastSkillBTime: number = 0;

  // スキル詠唱
  private isChargingSkillA: boolean = false;
  private isChargingSkillB: boolean = false;
  private chargeStartTime: number = 0;
  private readonly CHARGE_TIME = 500;  // 0.5秒

  // スキル範囲
  private skillAWidth: number = 2.2 * UNIT.METER_TO_PIXEL;   // 横2.2m
  private skillAHeight: number = 8.5 * UNIT.METER_TO_PIXEL;  // 縦8.5m
  private skillBWidth: number = 2.8 * UNIT.METER_TO_PIXEL;   // 横2.8m
  private skillBHeight: number = 9.5 * UNIT.METER_TO_PIXEL;  // 縦9.5m

  // 予告範囲表示
  private warningGraphics: Phaser.GameObjects.Graphics | null = null;
  private currentSkillAngle: number = 0;

  // 引き寄せパラメータ
  private readonly PULL_DISTANCE = 3.5 * UNIT.METER_TO_PIXEL;  // 3.5m
  private readonly PULL_DURATION = 500;  // 0.5秒

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, MobGroupType.GROUP_C, 'fairy_c');
    this.animationKey = 'fairy_c_idle';
    this.displayScale = 0.045;  // 1488x1440を約65pxに
  }

  /**
   * スポーン時にリセット
   */
  spawn(
    x: number,
    y: number,
    targetY?: number,
    movePattern: 'straight' | 'wave' | 'zigzag' | 'stay' = 'straight'
  ): void {
    super.spawn(x, y, targetY, movePattern);
    this.lastSkillATime = this.scene.time.now;
    this.lastSkillBTime = this.scene.time.now - 6000;  // 最初のBは4秒後に使用可能
    this.isChargingSkillA = false;
    this.isChargingSkillB = false;
    this.cleanupWarning();
  }

  /**
   * プレイヤー追尾型スポーン
   */
  spawnChasePlayerMode(x: number, y: number, speed: number): void {
    this.spawnChasePlayer(x, y, speed);
    this.lastSkillATime = this.scene.time.now;
    this.lastSkillBTime = this.scene.time.now - 6000;  // 最初のBは4秒後に使用可能
    this.isChargingSkillA = false;
    this.isChargingSkillB = false;
    this.cleanupWarning();
  }

  /**
   * 下降→追尾型スポーン
   * 画面上部から下降し、目標Y座標到達後に追尾移動を開始
   */
  spawnDescendThenChaseMode(
    x: number,
    y: number,
    targetY: number,
    descendSpeed: number,
    chaseSpeed: number
  ): void {
    this.spawnDescendThenChase(x, y, targetY, descendSpeed, chaseSpeed);
    this.lastSkillATime = this.scene.time.now;
    this.lastSkillBTime = this.scene.time.now - 6000;  // 最初のBは4秒後に使用可能
    this.isChargingSkillA = false;
    this.isChargingSkillB = false;
    this.cleanupWarning();
  }

  /**
   * スキル処理
   */
  protected updateShooting(time: number): void {
    if (!this.playerPosition) {
      return;
    }

    // チャージ中の処理
    if (this.isChargingSkillA || this.isChargingSkillB) {
      this.updateCharge(time);
      return;
    }

    // スキルBが使用可能ならスキルB優先
    if (time - this.lastSkillBTime >= this.skillBCooldown) {
      this.startSkillB(time);
      return;
    }

    // スキルAの使用
    if (time - this.lastSkillATime >= this.skillACooldown) {
      this.startSkillA(time);
    }
  }

  /**
   * スキルA開始
   */
  private startSkillA(time: number): void {
    if (!this.playerPosition) return;

    this.isChargingSkillA = true;
    this.chargeStartTime = time;
    this.lastSkillATime = time;

    // プレイヤー方向の角度
    this.currentSkillAngle = Phaser.Math.Angle.Between(
      this.x, this.y,
      this.playerPosition.x, this.playerPosition.y
    );

    // 予告範囲を表示
    this.showWarning(this.skillAWidth, this.skillAHeight, 0xffff00);  // 黄色
  }

  /**
   * スキルB開始
   */
  private startSkillB(time: number): void {
    if (!this.playerPosition) return;

    this.isChargingSkillB = true;
    this.chargeStartTime = time;
    this.lastSkillBTime = time;

    // プレイヤー方向の角度
    this.currentSkillAngle = Phaser.Math.Angle.Between(
      this.x, this.y,
      this.playerPosition.x, this.playerPosition.y
    );

    // 予告範囲を表示
    this.showWarning(this.skillBWidth, this.skillBHeight, 0xff00ff);  // マゼンタ
  }

  /**
   * 予告範囲を表示
   */
  private showWarning(width: number, height: number, color: number): void {
    this.cleanupWarning();

    this.warningGraphics = this.scene.add.graphics();
    this.warningGraphics.setDepth(DEPTH.EFFECTS);

    // 回転した矩形を描画（プレイヤー方向）
    this.updateWarningGraphics(width, height, color);
  }

  /**
   * 予告範囲グラフィックスを更新
   */
  private updateWarningGraphics(width: number, height: number, color: number): void {
    if (!this.warningGraphics) return;

    this.warningGraphics.clear();

    // 半透明の塗りつぶし
    this.warningGraphics.fillStyle(color, 0.3);
    // 枠線
    this.warningGraphics.lineStyle(3, color, 0.8);

    // 矩形の4つの角を計算（回転考慮）
    const halfWidth = width / 2;
    const halfHeight = height / 2;
    const cos = Math.cos(this.currentSkillAngle);
    const sin = Math.sin(this.currentSkillAngle);

    // 中心は敵から height/2 だけ前方
    const centerX = this.x + cos * (height / 2);
    const centerY = this.y + sin * (height / 2);

    // 回転した矩形の4つの角
    const corners = [
      // 左上（敵に近い左側）
      {
        x: centerX - cos * halfHeight - sin * halfWidth,
        y: centerY - sin * halfHeight + cos * halfWidth
      },
      // 右上（敵に近い右側）
      {
        x: centerX - cos * halfHeight + sin * halfWidth,
        y: centerY - sin * halfHeight - cos * halfWidth
      },
      // 右下（プレイヤーに近い右側）
      {
        x: centerX + cos * halfHeight + sin * halfWidth,
        y: centerY + sin * halfHeight - cos * halfWidth
      },
      // 左下（プレイヤーに近い左側）
      {
        x: centerX + cos * halfHeight - sin * halfWidth,
        y: centerY + sin * halfHeight + cos * halfWidth
      }
    ];

    // パスを描画
    this.warningGraphics.beginPath();
    this.warningGraphics.moveTo(corners[0].x, corners[0].y);
    for (let i = 1; i < corners.length; i++) {
      this.warningGraphics.lineTo(corners[i].x, corners[i].y);
    }
    this.warningGraphics.closePath();
    this.warningGraphics.fillPath();
    this.warningGraphics.strokePath();
  }

  /**
   * チャージ更新
   */
  private updateCharge(time: number): void {
    // チャージ完了チェック
    if (time - this.chargeStartTime >= this.CHARGE_TIME) {
      if (this.isChargingSkillA) {
        this.executeSkillA();
        this.isChargingSkillA = false;
      } else if (this.isChargingSkillB) {
        this.executeSkillB();
        this.isChargingSkillB = false;
      }
      this.cleanupWarning();
    }
  }

  /**
   * スキルA実行
   */
  private executeSkillA(): void {
    if (!this.playerPosition) return;

    // 範囲内にプレイヤーがいるかチェック
    if (this.isPlayerInArea(this.skillAWidth, this.skillAHeight)) {
      // ダメージイベントを発火
      this.scene.events.emit('mob-skill-hit', {
        mob: this,
        damage: this.stats.attackPower,
        skillType: 'A'
      });
    }
  }

  /**
   * スキルB実行
   */
  private executeSkillB(): void {
    if (!this.playerPosition) return;

    // 範囲内にプレイヤーがいるかチェック
    if (this.isPlayerInArea(this.skillBWidth, this.skillBHeight)) {
      // ダメージ + 引き寄せイベントを発火
      this.scene.events.emit('mob-skill-hit', {
        mob: this,
        damage: this.stats.attackPower,
        skillType: 'B',
        pull: {
          targetX: this.x,
          targetY: this.y,
          distance: this.PULL_DISTANCE,
          duration: this.PULL_DURATION
        }
      });

      // ヒット時は即座にスキルAを使用
      this.scene.time.delayedCall(this.PULL_DURATION + 100, () => {
        if (this.isActive && this.playerPosition) {
          this.startSkillA(this.scene.time.now);
        }
      });
    }
  }

  /**
   * プレイヤーが攻撃範囲内にいるかチェック
   */
  private isPlayerInArea(width: number, height: number): boolean {
    if (!this.playerPosition) return false;

    // プレイヤーの位置を敵のローカル座標系に変換
    const dx = this.playerPosition.x - this.x;
    const dy = this.playerPosition.y - this.y;

    // スキル方向を基準に回転して軸に沿った座標に変換
    // スキル方向（currentSkillAngle）が「前方」になるように変換
    const cos = Math.cos(this.currentSkillAngle);
    const sin = Math.sin(this.currentSkillAngle);
    // 回転行列の転置（逆回転）を適用
    const localX = dx * cos + dy * sin;  // 横方向（スキル方向に垂直）
    const localY = -dx * sin + dy * cos; // 縦方向（スキル方向）

    // 矩形は敵の前方に伸びるので、localXが0〜heightの範囲（スキル方向）
    // localYは-width/2〜width/2の範囲（横方向）
    const halfWidth = width / 2;
    const isInWidth = Math.abs(localY) <= halfWidth;
    const isInHeight = localX >= 0 && localX <= height;

    return isInWidth && isInHeight;
  }

  /**
   * 予告グラフィックスのクリーンアップ
   */
  private cleanupWarning(): void {
    if (this.warningGraphics) {
      this.warningGraphics.destroy();
      this.warningGraphics = null;
    }
  }

  /**
   * 更新処理（オーバーライド）
   * スキルチャージ中は移動を停止する
   */
  update(time: number, delta: number): void {
    // チャージ中は移動を停止
    if (this.isChargingSkillA || this.isChargingSkillB) {
      this.setVelocity(0, 0);
    }

    // 基底クラスの更新処理を呼ぶ
    super.update(time, delta);

    // チャージ中は再度速度を0にする（基底クラスで設定された速度をリセット）
    if (this.isChargingSkillA || this.isChargingSkillB) {
      this.setVelocity(0, 0);
    }
  }

  /**
   * 非アクティブ化時のクリーンアップ
   */
  deactivate(): void {
    this.cleanupWarning();
    this.isChargingSkillA = false;
    this.isChargingSkillB = false;
    super.deactivate();
  }
}
