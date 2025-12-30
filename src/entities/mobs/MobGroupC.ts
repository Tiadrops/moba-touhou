import Phaser from 'phaser';
import { MobGroupType } from '@/types';
import { MobEnemy } from './MobEnemy';
import { UNIT, DEPTH } from '@/config/GameConfig';
import { AudioManager } from '@/systems/AudioManager';

/**
 * グループCパターンタイプ
 */
export type MobCPatternType = 'C1' | 'C2';

// パターン別テクスチャ設定
const PATTERN_TEXTURES: Record<MobCPatternType, { texture: string; animation: string }> = {
  'C1': { texture: 'fairy_c', animation: 'fairy_c_idle' },
  'C2': { texture: 'fairy_c2', animation: 'fairy_c2_idle' },
};

/**
 * グループC雑魚（フラグ持ち）
 * HP1500, DEF0, ATK100
 * 生存時間無制限（撃破まで残る）
 * 撃破でボス戦へ移行
 *
 * C-1（従来型）:
 * スキルA: 4秒ごと
 * - プレイヤー方向に縦8.5m、横2.2mの攻撃範囲を予告
 * - 0.5秒後にダメージ
 *
 * スキルB: 10秒ごと
 * - プレイヤー方向に縦9.5m、横2.8mの攻撃範囲を予告
 * - 0.5秒後にダメージ + プレイヤーを3.5m引き寄せ（0.5秒かけて）
 * - ヒット時は即座にスキルAを追加で使用
 *
 * C-2（Hisui）:
 * Skill W2: 予告0.5秒 → 前方矩形7.2m×1.2m、ヒット時0.5秒スタン＋プレイヤーに接近
 * Skill E: 後退2m(0.13s) → 待機(0.325s) → 前進6m(0.25s) → 待機(0.25s)
 *          前進中のみ半径1.2mの円形判定
 * Skill R: Cast1(0.5s)→半円5.0m → Cast2(0.625s)→前方矩形5.5m×2.0m → Wait0.25s
 */
export class MobGroupC extends MobEnemy {
  private patternType: MobCPatternType = 'C1';
  private autoShootEnabled: boolean = true;  // 自動発射の有効/無効

  // ========================================
  // C-1用プロパティ
  // ========================================
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

  // ========================================
  // C-2 (Hisui) 用プロパティ
  // ========================================
  // スキルクールダウン
  private c2SkillW2Cooldown: number = 4000;   // 4秒
  private c2SkillECooldown: number = 6000;    // 6秒
  private c2SkillRCooldown: number = 10000;   // 10秒
  private lastSkillW2Time: number = 0;
  private lastSkillETime: number = 0;
  private lastSkillRTime: number = 0;

  // 現在実行中のスキル情報
  private c2CurrentSkill: 'W2' | 'E' | 'R' | null = null;
  private c2SkillPhase: number = 0;
  private c2SkillPhaseStartTime: number = 0;

  // Skill W2パラメータ
  private readonly C2_W2_TELEGRAPH_TIME = 500;  // 0.5秒
  private readonly C2_W2_WIDTH = 1.2 * UNIT.METER_TO_PIXEL;   // 横1.2m
  private readonly C2_W2_HEIGHT = 7.2 * UNIT.METER_TO_PIXEL;  // 縦7.2m

  // Skill Eパラメータ
  private readonly C2_E_BACK_DISTANCE = 2 * UNIT.METER_TO_PIXEL;    // 後退2m
  private readonly C2_E_BACK_TIME = 130;                              // 0.13秒
  private readonly C2_E_WAIT1_TIME = 325;                             // 0.325秒
  private readonly C2_E_FORWARD_DISTANCE = 6 * UNIT.METER_TO_PIXEL; // 前進6m
  private readonly C2_E_FORWARD_TIME = 250;                           // 0.25秒
  private readonly C2_E_WAIT2_TIME = 250;                             // 0.25秒
  private readonly C2_E_RADIUS = 1.2 * UNIT.METER_TO_PIXEL;         // 当たり判定半径1.2m
  private c2EStartPos: { x: number; y: number } = { x: 0, y: 0 };
  private c2EBackTargetPos: { x: number; y: number } = { x: 0, y: 0 };
  private c2EForwardTargetPos: { x: number; y: number } = { x: 0, y: 0 };
  private c2EDamageDealt: boolean = false;  // 前進中のダメージ判定済みフラグ

  // Skill Rパラメータ
  private readonly C2_R_CAST1_TIME = 500;      // 0.5秒
  private readonly C2_R_SEMICIRCLE_RADIUS = 5.0 * UNIT.METER_TO_PIXEL;  // 半円5.0m
  private readonly C2_R_CAST2_TIME = 625;      // 0.625秒
  private readonly C2_R_RECT_WIDTH = 2.0 * UNIT.METER_TO_PIXEL;   // 矩形幅2.0m
  private readonly C2_R_RECT_HEIGHT = 5.5 * UNIT.METER_TO_PIXEL;  // 矩形長5.5m
  private readonly C2_R_WAIT_TIME = 250;       // 0.25秒

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, MobGroupType.GROUP_C, 'fairy_c');
    this.animationKey = 'fairy_c_idle';
    this.displayScale = 0.045;  // 1488x1440を約65pxに
  }

  /**
   * パターンタイプを設定
   */
  setPatternType(pattern: MobCPatternType): void {
    this.patternType = pattern;
    const config = PATTERN_TEXTURES[pattern];
    this.setTexture(config.texture);
    this.animationKey = config.animation;
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
    this.resetSkillState();
  }

  /**
   * プレイヤー追尾型スポーン
   */
  spawnChasePlayerMode(x: number, y: number, speed: number): void {
    this.spawnChasePlayer(x, y, speed);
    this.resetSkillState();
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
    this.resetSkillState();
  }

  /**
   * 下降→追尾型スポーン（パターン指定付き）
   * 画面上部から下降し、目標Y座標到達後に追尾移動を開始
   */
  spawnDescendThenChaseWithPattern(
    x: number,
    y: number,
    pattern: MobCPatternType,
    targetY: number,
    descendSpeed: number,
    chaseSpeed: number
  ): void {
    this.setPatternType(pattern);
    this.spawnDescendThenChase(x, y, targetY, descendSpeed, chaseSpeed);
    this.resetSkillState();
  }

  /**
   * パターン指定付きスポーン
   */
  spawnWithPattern(
    x: number,
    y: number,
    pattern: MobCPatternType,
    targetY?: number,
    movePattern: 'straight' | 'wave' | 'zigzag' | 'stay' = 'stay'
  ): void {
    this.setPatternType(pattern);
    super.spawn(x, y, targetY, movePattern);
    this.resetSkillState();
  }

  /**
   * 自動発射の有効/無効を設定
   */
  setAutoShoot(enabled: boolean): void {
    this.autoShootEnabled = enabled;
  }

  /**
   * スキルを手動で発射
   */
  shoot(): void {
    const time = this.scene.time.now;
    if (this.patternType === 'C1') {
      // C-1: スキルAを優先的に発射
      if (!this.isChargingSkillA && !this.isChargingSkillB) {
        this.startSkillA(time);
      }
    } else {
      // C-2: 優先順位に従って発射
      if (!this.c2CurrentSkill) {
        if (time - this.lastSkillRTime >= this.c2SkillRCooldown) {
          this.startC2SkillR(time);
        } else if (time - this.lastSkillETime >= this.c2SkillECooldown) {
          this.startC2SkillE(time);
        } else {
          this.startC2SkillW2(time);
        }
      }
    }
  }

  /**
   * スキル状態をリセット
   */
  private resetSkillState(): void {
    const now = this.scene.time.now;

    // C-1用
    this.lastSkillATime = now;
    this.lastSkillBTime = now - 6000;  // 最初のBは4秒後に使用可能
    this.isChargingSkillA = false;
    this.isChargingSkillB = false;
    this.cleanupWarning();

    // C-2用
    this.lastSkillW2Time = now;
    this.lastSkillETime = now - 2000;  // Eは4秒後に使用可能
    this.lastSkillRTime = now - 4000;  // Rは6秒後に使用可能
    this.c2CurrentSkill = null;
    this.c2SkillPhase = 0;
    this.c2EDamageDealt = false;
  }

  /**
   * スキル処理
   */
  protected updateShooting(time: number): void {
    if (!this.playerPosition) {
      return;
    }

    // 自動発射が無効の場合はスキップ（ただしチャージ中やスキル実行中は継続）
    if (!this.autoShootEnabled) {
      // C-1: チャージ中の処理は継続
      if (this.patternType === 'C1' && (this.isChargingSkillA || this.isChargingSkillB)) {
        this.updateCharge(time);
      }
      // C-2: スキル実行中の処理は継続
      if (this.patternType === 'C2' && this.c2CurrentSkill) {
        this.updateC2SkillExecution(time);
      }
      return;
    }

    if (this.patternType === 'C1') {
      this.updateC1Shooting(time);
    } else {
      this.updateC2Shooting(time);
    }
  }

  // ========================================
  // C-1（従来型）の処理
  // ========================================

  /**
   * C-1のスキル処理
   */
  private updateC1Shooting(time: number): void {
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
   * スキルA実行（オブリテレイト）
   */
  private executeSkillA(): void {
    if (!this.playerPosition) return;

    // SEは常に再生（ヒット有無に関わらず）
    AudioManager.getInstance().playSe('se_obliterate', { volume: 1.5 });

    // エフェクト表示
    this.showObliterateEffect();

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
   * スキルB実行（デスグラスプ）
   */
  private executeSkillB(): void {
    if (!this.playerPosition) return;

    // SE・演出は常に再生（ヒット有無に関わらず）
    AudioManager.getInstance().playSe('se_death_grasp', { volume: 1.5 });
    this.showDeathGraspEffect();

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
   * オブリテレイトエフェクトを表示
   * impact1-1 → impact1-2 → impact1-3 のアニメーション（ループなし）
   */
  private showObliterateEffect(): void {
    if (!this.playerPosition) return;

    // エフェクトの位置（攻撃範囲の中心）
    const effectX = this.x + Math.cos(this.currentSkillAngle) * (this.skillAHeight / 2);
    const effectY = this.y + Math.sin(this.currentSkillAngle) * (this.skillAHeight / 2);

    // 画像のオリジナルサイズ: 550x1100px
    // 攻撃範囲: 横2.5m(skillAWidth)、縦7m(skillAHeight)
    const scaleX = this.skillAWidth / 550;   // 横方向
    const scaleY = this.skillAHeight / 1100; // 縦方向

    // 最初のフレームを表示
    const effect = this.scene.add.image(effectX, effectY, 'impact1-1');
    effect.setDepth(DEPTH.BULLETS_ENEMY + 1);
    effect.setScale(scaleX, scaleY);
    effect.setRotation(this.currentSkillAngle - Math.PI / 2);  // 攻撃方向に回転（画像は縦長なので-90度）
    effect.setAlpha(0.5);  // 薄めに表示

    // アニメーション: 各フレーム80msで切り替え
    const frameDuration = 80;

    this.scene.time.delayedCall(frameDuration, () => {
      if (effect.active) effect.setTexture('impact1-2');
    });

    this.scene.time.delayedCall(frameDuration * 2, () => {
      if (effect.active) effect.setTexture('impact1-3');
    });

    // アニメーション終了後に削除
    this.scene.time.delayedCall(frameDuration * 3, () => {
      if (effect.active) effect.destroy();
    });
  }

  /**
   * デスグラスプエフェクトを表示
   * shadow3-1 → 3-2 → 3-3 → 3-4 → 3-5 → 3-4 → 3-3 → 3-2 → 3-1 のアニメーション（ループなし）
   */
  private showDeathGraspEffect(): void {
    if (!this.playerPosition) return;

    // エフェクトの位置（攻撃範囲の中心）
    const effectX = this.x + Math.cos(this.currentSkillAngle) * (this.skillBHeight / 2);
    const effectY = this.y + Math.sin(this.currentSkillAngle) * (this.skillBHeight / 2);

    // 画像のオリジナルサイズ: 550x1100px
    // 攻撃範囲: 横2.8m(skillBWidth)、縦9.5m(skillBHeight)
    const scaleX = this.skillBWidth / 550;   // 横方向
    const scaleY = this.skillBHeight / 1100; // 縦方向

    // 最初のフレームを表示
    const effect = this.scene.add.image(effectX, effectY, 'shadow3-0');
    effect.setDepth(DEPTH.BULLETS_ENEMY + 1);
    effect.setScale(scaleX, scaleY);
    effect.setRotation(this.currentSkillAngle + Math.PI / 2);  // 攻撃方向に回転（画像は縦長なので+90度、180度反転）
    effect.setAlpha(0.9);  // はっきり表示

    // アニメーション: 各フレーム45msで切り替え（11フレーム × 45ms = 495ms ≈ 500ms）
    // 3-0 → 3-1 → 3-2 → 3-3 → 3-4 → 3-5 → 3-4 → 3-3 → 3-2 → 3-1 → 3-0
    const frameDuration = 45;
    const frames = ['shadow3-0', 'shadow3-1', 'shadow3-2', 'shadow3-3', 'shadow3-4', 'shadow3-5', 'shadow3-4', 'shadow3-3', 'shadow3-2', 'shadow3-1', 'shadow3-0'];

    frames.forEach((frame, index) => {
      if (index === 0) return; // 最初のフレームはすでに表示
      this.scene.time.delayedCall(frameDuration * index, () => {
        if (effect.active) effect.setTexture(frame);
      });
    });

    // アニメーション終了後に削除
    this.scene.time.delayedCall(frameDuration * frames.length, () => {
      if (effect.active) effect.destroy();
    });
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

  // ========================================
  // C-2 (Hisui) の処理
  // ========================================

  /**
   * C-2のスキル処理
   */
  private updateC2Shooting(time: number): void {
    // スキル実行中
    if (this.c2CurrentSkill) {
      this.updateC2SkillExecution(time);
      return;
    }

    // スキル優先順位: R > E > W2
    if (time - this.lastSkillRTime >= this.c2SkillRCooldown) {
      this.startC2SkillR(time);
      return;
    }

    if (time - this.lastSkillETime >= this.c2SkillECooldown) {
      this.startC2SkillE(time);
      return;
    }

    if (time - this.lastSkillW2Time >= this.c2SkillW2Cooldown) {
      this.startC2SkillW2(time);
    }
  }

  /**
   * C-2スキル実行更新
   */
  private updateC2SkillExecution(time: number): void {
    if (!this.c2CurrentSkill) return;

    switch (this.c2CurrentSkill) {
      case 'W2':
        this.updateC2SkillW2(time);
        break;
      case 'E':
        this.updateC2SkillE(time);
        break;
      case 'R':
        this.updateC2SkillR(time);
        break;
    }
  }

  /**
   * C-2スキル終了
   */
  private endC2Skill(): void {
    this.cleanupWarning();
    this.c2CurrentSkill = null;
  }

  // ----------------------------------------
  // C-2 Skill W2: 前方矩形攻撃
  // ----------------------------------------

  /**
   * Skill W2 開始
   */
  private startC2SkillW2(time: number): void {
    if (!this.playerPosition) return;

    this.c2CurrentSkill = 'W2';
    this.c2SkillPhase = 0;
    this.c2SkillPhaseStartTime = time;
    this.lastSkillW2Time = time;

    // プレイヤー方向の角度を固定
    this.currentSkillAngle = Phaser.Math.Angle.Between(
      this.x, this.y,
      this.playerPosition.x, this.playerPosition.y
    );

    // 予告表示（黄色）
    this.showWarning(this.C2_W2_WIDTH, this.C2_W2_HEIGHT, 0xffff00);
  }

  /**
   * Skill W2 更新
   */
  private updateC2SkillW2(time: number): void {
    const elapsed = time - this.c2SkillPhaseStartTime;

    if (elapsed >= this.C2_W2_TELEGRAPH_TIME) {
      // 予告終了、ダメージ判定
      const hit = this.isPlayerInArea(this.C2_W2_WIDTH, this.C2_W2_HEIGHT);
      if (hit) {
        this.scene.events.emit('mob-skill-hit', {
          mob: this,
          damage: this.stats.attackPower,
          skillType: 'W2',
          stun: {
            duration: 500  // 0.5秒スタン
          }
        });
        // ヒット時、プレイヤー方向に接近（重ならない程度に）
        this.moveTowardsPlayer();
      }
      this.showDamageFlash(this.C2_W2_WIDTH, this.C2_W2_HEIGHT, 0xffff00);
      this.endC2Skill();
    }
  }

  /**
   * プレイヤー方向に高速移動で接近（重ならない程度に）
   */
  private moveTowardsPlayer(): void {
    if (!this.playerPosition) return;

    const dx = this.playerPosition.x - this.x;
    const dy = this.playerPosition.y - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // 最小距離（これより近づかない）
    const minDistance = 0.5 * UNIT.METER_TO_PIXEL;  // 0.5m

    if (dist > minDistance) {
      // プレイヤーとの距離が最小距離になるまで移動
      const targetDist = minDistance;
      const ratio = (dist - targetDist) / dist;
      const targetX = this.x + dx * ratio;
      const targetY = this.y + dy * ratio;

      // 高速移動（0.15秒で移動）
      this.scene.tweens.add({
        targets: this,
        x: targetX,
        y: targetY,
        duration: 150,
        ease: 'Quad.easeOut'
      });
    }
  }

  // ----------------------------------------
  // C-2 Skill E: バックステップ→ダッシュ攻撃
  // ----------------------------------------

  /**
   * Skill E 開始
   */
  private startC2SkillE(time: number): void {
    if (!this.playerPosition) return;

    this.c2CurrentSkill = 'E';
    this.c2SkillPhase = 0;
    this.c2SkillPhaseStartTime = time;
    this.lastSkillETime = time;
    this.c2EDamageDealt = false;

    // プレイヤー方向の角度を固定
    this.currentSkillAngle = Phaser.Math.Angle.Between(
      this.x, this.y,
      this.playerPosition.x, this.playerPosition.y
    );

    this.c2EStartPos = { x: this.x, y: this.y };

    // 後退目標位置を計算（プレイヤーと反対方向に2m）
    const backAngle = this.currentSkillAngle + Math.PI;
    this.c2EBackTargetPos = {
      x: this.x + Math.cos(backAngle) * this.C2_E_BACK_DISTANCE,
      y: this.y + Math.sin(backAngle) * this.C2_E_BACK_DISTANCE
    };

    // 前進目標位置を計算（後退位置からプレイヤー方向に6m）
    this.c2EForwardTargetPos = {
      x: this.c2EBackTargetPos.x + Math.cos(this.currentSkillAngle) * this.C2_E_FORWARD_DISTANCE,
      y: this.c2EBackTargetPos.y + Math.sin(this.currentSkillAngle) * this.C2_E_FORWARD_DISTANCE
    };

    // 前進中の当たり判定範囲を表示（黄色）
    this.showSkillEPreview();
  }

  /**
   * Skill E 予告表示
   */
  private showSkillEPreview(): void {
    this.cleanupWarning();
    this.warningGraphics = this.scene.add.graphics();
    this.warningGraphics.setDepth(DEPTH.EFFECTS);

    // 前進経路を黄色矩形で表示
    const startX = this.c2EBackTargetPos.x;
    const startY = this.c2EBackTargetPos.y;
    const endX = this.c2EForwardTargetPos.x;
    const endY = this.c2EForwardTargetPos.y;

    // 経路の長さと角度
    const pathLength = this.C2_E_FORWARD_DISTANCE;
    const cos = Math.cos(this.currentSkillAngle);
    const sin = Math.sin(this.currentSkillAngle);

    // 経路の中心
    const centerX = (startX + endX) / 2;
    const centerY = (startY + endY) / 2;

    // 矩形の幅は当たり判定の直径
    const width = this.C2_E_RADIUS * 2;
    const halfWidth = width / 2;
    const halfLength = pathLength / 2;

    // 回転した矩形の4つの角
    const corners = [
      { x: centerX - cos * halfLength - sin * halfWidth, y: centerY - sin * halfLength + cos * halfWidth },
      { x: centerX - cos * halfLength + sin * halfWidth, y: centerY - sin * halfLength - cos * halfWidth },
      { x: centerX + cos * halfLength + sin * halfWidth, y: centerY + sin * halfLength - cos * halfWidth },
      { x: centerX + cos * halfLength - sin * halfWidth, y: centerY + sin * halfLength + cos * halfWidth }
    ];

    this.warningGraphics.fillStyle(0xffff00, 0.3);
    this.warningGraphics.lineStyle(3, 0xffff00, 0.8);

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
   * Skill E 更新
   */
  private updateC2SkillE(time: number): void {
    const elapsed = time - this.c2SkillPhaseStartTime;

    // Phase 0: 後退 (0.13秒)
    if (this.c2SkillPhase === 0) {
      const progress = Math.min(elapsed / this.C2_E_BACK_TIME, 1);
      this.x = this.c2EStartPos.x + (this.c2EBackTargetPos.x - this.c2EStartPos.x) * progress;
      this.y = this.c2EStartPos.y + (this.c2EBackTargetPos.y - this.c2EStartPos.y) * progress;

      if (elapsed >= this.C2_E_BACK_TIME) {
        this.c2SkillPhase = 1;
        this.c2SkillPhaseStartTime = time;
      }
      return;
    }

    // Phase 1: 待機1 (0.325秒)
    if (this.c2SkillPhase === 1) {
      if (elapsed >= this.C2_E_WAIT1_TIME) {
        this.c2SkillPhase = 2;
        this.c2SkillPhaseStartTime = time;
        this.c2EDamageDealt = false;
      }
      return;
    }

    // Phase 2: 前進 (0.25秒) - ダメージ判定あり
    if (this.c2SkillPhase === 2) {
      const progress = Math.min(elapsed / this.C2_E_FORWARD_TIME, 1);
      this.x = this.c2EBackTargetPos.x + (this.c2EForwardTargetPos.x - this.c2EBackTargetPos.x) * progress;
      this.y = this.c2EBackTargetPos.y + (this.c2EForwardTargetPos.y - this.c2EBackTargetPos.y) * progress;

      // 前進中のダメージ判定（1回のみ）
      if (!this.c2EDamageDealt && this.isPlayerInCircle(this.C2_E_RADIUS)) {
        this.c2EDamageDealt = true;
        this.scene.events.emit('mob-skill-hit', {
          mob: this,
          damage: this.stats.attackPower,
          skillType: 'E'
        });
      }

      if (elapsed >= this.C2_E_FORWARD_TIME) {
        this.c2SkillPhase = 3;
        this.c2SkillPhaseStartTime = time;
        // ダメージフラッシュ
        this.showCircleDamageFlash(0xffff00);
      }
      return;
    }

    // Phase 3: 待機2 (0.25秒)
    if (this.c2SkillPhase === 3) {
      if (elapsed >= this.C2_E_WAIT2_TIME) {
        this.endC2Skill();
      }
    }
  }

  /**
   * プレイヤーが円形範囲内にいるかチェック
   */
  private isPlayerInCircle(radius: number): boolean {
    if (!this.playerPosition) return false;
    const dx = this.playerPosition.x - this.x;
    const dy = this.playerPosition.y - this.y;
    return Math.sqrt(dx * dx + dy * dy) <= radius;
  }

  /**
   * プレイヤーが半円範囲内にいるかチェック
   */
  private isPlayerInSemicircle(radius: number): boolean {
    if (!this.playerPosition) return false;
    const dx = this.playerPosition.x - this.x;
    const dy = this.playerPosition.y - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > radius) return false;

    // プレイヤーへの角度
    const angleToPlayer = Math.atan2(dy, dx);
    // 前方角度との差（-PI〜PI）
    let angleDiff = angleToPlayer - this.currentSkillAngle;
    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

    // 前方180度（半円）以内
    return Math.abs(angleDiff) <= Math.PI / 2;
  }

  // ----------------------------------------
  // C-2 Skill R: 半円→矩形の2段攻撃
  // ----------------------------------------

  /**
   * Skill R 開始
   */
  private startC2SkillR(time: number): void {
    if (!this.playerPosition) return;

    this.c2CurrentSkill = 'R';
    this.c2SkillPhase = 0;
    this.c2SkillPhaseStartTime = time;
    this.lastSkillRTime = time;

    // プレイヤー方向の角度を固定
    this.currentSkillAngle = Phaser.Math.Angle.Between(
      this.x, this.y,
      this.playerPosition.x, this.playerPosition.y
    );

    // Phase 0: Cast1予告（半円、黄色）
    this.showSemicircleWarning(this.C2_R_SEMICIRCLE_RADIUS, 0xffff00);
  }

  /**
   * 半円予告表示
   */
  private showSemicircleWarning(radius: number, color: number): void {
    this.cleanupWarning();
    this.warningGraphics = this.scene.add.graphics();
    this.warningGraphics.setDepth(DEPTH.EFFECTS);

    this.warningGraphics.fillStyle(color, 0.3);
    this.warningGraphics.lineStyle(3, color, 0.8);

    // 半円を描画
    const startAngle = this.currentSkillAngle - Math.PI / 2;
    const endAngle = this.currentSkillAngle + Math.PI / 2;

    this.warningGraphics.beginPath();
    this.warningGraphics.moveTo(this.x, this.y);
    this.warningGraphics.arc(this.x, this.y, radius, startAngle, endAngle, false);
    this.warningGraphics.closePath();
    this.warningGraphics.fillPath();
    this.warningGraphics.strokePath();
  }

  /**
   * Skill R 更新
   */
  private updateC2SkillR(time: number): void {
    const elapsed = time - this.c2SkillPhaseStartTime;

    // Phase 0: Cast1 (0.5秒) → 半円ダメージ
    if (this.c2SkillPhase === 0) {
      if (elapsed >= this.C2_R_CAST1_TIME) {
        // 半円ダメージ判定
        if (this.isPlayerInSemicircle(this.C2_R_SEMICIRCLE_RADIUS)) {
          this.scene.events.emit('mob-skill-hit', {
            mob: this,
            damage: this.stats.attackPower,
            skillType: 'R1'
          });
        }
        this.showSemicircleDamageFlash(this.C2_R_SEMICIRCLE_RADIUS, 0xffff00);

        // Phase 1: Cast2予告開始（矩形、黄色）
        this.c2SkillPhase = 1;
        this.c2SkillPhaseStartTime = time;
        this.showWarning(this.C2_R_RECT_WIDTH, this.C2_R_RECT_HEIGHT, 0xffff00);
      }
      return;
    }

    // Phase 1: Cast2 (0.625秒) → 矩形ダメージ
    if (this.c2SkillPhase === 1) {
      if (elapsed >= this.C2_R_CAST2_TIME) {
        // 矩形ダメージ判定
        if (this.isPlayerInArea(this.C2_R_RECT_WIDTH, this.C2_R_RECT_HEIGHT)) {
          this.scene.events.emit('mob-skill-hit', {
            mob: this,
            damage: this.stats.attackPower,
            skillType: 'R2'
          });
        }
        this.showDamageFlash(this.C2_R_RECT_WIDTH, this.C2_R_RECT_HEIGHT, 0xffff00);

        // Phase 2: Wait
        this.c2SkillPhase = 2;
        this.c2SkillPhaseStartTime = time;
        this.cleanupWarning();
      }
      return;
    }

    // Phase 2: Wait (0.25秒)
    if (this.c2SkillPhase === 2) {
      if (elapsed >= this.C2_R_WAIT_TIME) {
        this.endC2Skill();
      }
    }
  }

  // ----------------------------------------
  // エフェクト
  // ----------------------------------------

  /**
   * 矩形ダメージフラッシュ
   */
  private showDamageFlash(width: number, height: number, color: number): void {
    const flash = this.scene.add.graphics();
    flash.setDepth(DEPTH.EFFECTS);

    const cos = Math.cos(this.currentSkillAngle);
    const sin = Math.sin(this.currentSkillAngle);
    const centerX = this.x + cos * (height / 2);
    const centerY = this.y + sin * (height / 2);
    const halfWidth = width / 2;
    const halfHeight = height / 2;

    const corners = [
      { x: centerX - cos * halfHeight - sin * halfWidth, y: centerY - sin * halfHeight + cos * halfWidth },
      { x: centerX - cos * halfHeight + sin * halfWidth, y: centerY - sin * halfHeight - cos * halfWidth },
      { x: centerX + cos * halfHeight + sin * halfWidth, y: centerY + sin * halfHeight - cos * halfWidth },
      { x: centerX + cos * halfHeight - sin * halfWidth, y: centerY + sin * halfHeight + cos * halfWidth }
    ];

    flash.fillStyle(color, 0.6);
    flash.beginPath();
    flash.moveTo(corners[0].x, corners[0].y);
    for (let i = 1; i < corners.length; i++) {
      flash.lineTo(corners[i].x, corners[i].y);
    }
    flash.closePath();
    flash.fillPath();

    this.scene.tweens.add({
      targets: flash,
      alpha: 0,
      duration: 150,
      onComplete: () => flash.destroy()
    });
  }

  /**
   * 円形ダメージフラッシュ
   */
  private showCircleDamageFlash(color: number): void {
    const flash = this.scene.add.graphics();
    flash.setDepth(DEPTH.EFFECTS);
    flash.fillStyle(color, 0.6);
    flash.fillCircle(this.x, this.y, this.C2_E_RADIUS);

    this.scene.tweens.add({
      targets: flash,
      alpha: 0,
      duration: 150,
      onComplete: () => flash.destroy()
    });
  }

  /**
   * 半円ダメージフラッシュ
   */
  private showSemicircleDamageFlash(radius: number, color: number): void {
    const flash = this.scene.add.graphics();
    flash.setDepth(DEPTH.EFFECTS);
    flash.fillStyle(color, 0.6);

    const startAngle = this.currentSkillAngle - Math.PI / 2;
    const endAngle = this.currentSkillAngle + Math.PI / 2;

    flash.beginPath();
    flash.moveTo(this.x, this.y);
    flash.arc(this.x, this.y, radius, startAngle, endAngle, false);
    flash.closePath();
    flash.fillPath();

    this.scene.tweens.add({
      targets: flash,
      alpha: 0,
      duration: 150,
      onComplete: () => flash.destroy()
    });
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
    // C-1: チャージ中は移動を停止
    if (this.patternType === 'C1' && (this.isChargingSkillA || this.isChargingSkillB)) {
      this.setVelocity(0, 0);
    }

    // C-2: スキル実行中は移動を停止（Skill Eの移動フェーズは除く）
    if (this.patternType === 'C2' && this.c2CurrentSkill) {
      if (!(this.c2CurrentSkill === 'E' && (this.c2SkillPhase === 0 || this.c2SkillPhase === 2))) {
        this.setVelocity(0, 0);
      }
    }

    // 基底クラスの更新処理を呼ぶ
    super.update(time, delta);

    // チャージ中は再度速度を0にする（基底クラスで設定された速度をリセット）
    if (this.patternType === 'C1' && (this.isChargingSkillA || this.isChargingSkillB)) {
      this.setVelocity(0, 0);
    }
    if (this.patternType === 'C2' && this.c2CurrentSkill) {
      if (!(this.c2CurrentSkill === 'E' && (this.c2SkillPhase === 0 || this.c2SkillPhase === 2))) {
        this.setVelocity(0, 0);
      }
    }
  }

  /**
   * 非アクティブ化時のクリーンアップ
   */
  deactivate(): void {
    this.cleanupWarning();
    this.isChargingSkillA = false;
    this.isChargingSkillB = false;
    this.c2CurrentSkill = null;
    super.deactivate();
  }
}
