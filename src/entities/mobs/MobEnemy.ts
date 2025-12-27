import Phaser from 'phaser';
import { MobGroupType, MobStats, MobExitMode, StatusEffect, StatusEffectType } from '@/types';
import { DEPTH, COLORS, GAME_CONFIG, MOB_GROUP_CONFIG, MID_STAGE_CONFIG } from '@/config/GameConfig';
import { BulletPool } from '@/utils/ObjectPool';
import { AudioManager } from '@/systems/AudioManager';

/**
 * 道中雑魚敵の基底クラス
 * - 生存時間経過で退場（フェードアウト or 画面端へ移動）
 * - グループごとのステータス
 * - 各サブクラスで弾幕パターンを実装
 */
export abstract class MobEnemy extends Phaser.Physics.Arcade.Sprite {
  protected groupType: MobGroupType;
  protected stats: MobStats;
  protected currentHp: number = 0;
  protected isActive: boolean = false;

  // 生存時間管理
  protected spawnTime: number = 0;
  protected isFadingOut: boolean = false;
  protected isExiting: boolean = false;  // 退場中フラグ

  // 弾幕システム
  protected bulletPool: BulletPool | null = null;
  protected lastShootTime: number = 0;
  protected playerPosition: { x: number; y: number } | null = null;
  protected hasShot: boolean = false;  // 弾を撃ったかどうか（1回限り用）

  // 状態異常
  protected statusEffects: StatusEffect[] = [];

  // 移動パターン
  protected movePattern: 'straight' | 'wave' | 'zigzag' | 'stay' | 'exit' | 'pass_through' | 'pass_through_curve' | 'descend_shoot_ascend' | 'chase_player' | 'random_walk' | 'descend_then_chase' | 'descend_then_random_walk' = 'straight';
  protected patternTime: number = 0;
  protected targetY: number = 0;  // 目標Y座標（到達すると停止）
  protected passThroughVelocityX: number = 0;  // 通過型のX速度（px/s）
  protected passThroughVelocityY: number = 0;  // 通過型のY速度（px/s）

  // カーブ移動用パラメータ
  protected curveTargetY: number = 0;       // カーブ開始Y座標
  protected curveExitVelocityX: number = 0; // カーブ後のX速度
  protected curveDuration: number = 1000;   // カーブにかかる時間（ms）
  protected curveStartTime: number = 0;     // カーブ開始時刻
  protected isCurving: boolean = false;     // カーブ中かどうか
  protected curveInitialVelY: number = 0;   // カーブ開始時のY速度

  // 下降→発射→上昇パターン用パラメータ
  protected dsaTargetY: number = 0;         // 発射地点Y座標
  protected dsaDescendSpeed: number = 100;  // 下降速度（px/s）
  protected dsaAscendSpeed: number = 100;   // 上昇速度（px/s）
  protected dsaState: 'descending' | 'ascending' = 'descending';
  protected dsaHasReachedTarget: boolean = false;  // 目標地点に到達したか
  protected dsaOnShoot: (() => void) | null = null;  // 発射時コールバック

  // プレイヤー追尾移動用パラメータ
  protected chaseSpeed: number = 0;  // 追尾速度（px/s）

  // ランダム移動用パラメータ
  protected randomWalkSpeed: number = 0;  // 移動速度（px/s）
  protected randomWalkChangeInterval: number = 2000;  // 方向変更間隔（ms）
  protected randomWalkLastChangeTime: number = 0;  // 最後の方向変更時刻
  protected randomWalkAngle: number = 0;  // 現在の移動角度

  // 下降→追尾/ランダム移動用パラメータ
  protected descendTargetY: number = 0;  // 下降目標Y座標
  protected descendSpeed: number = 150;  // 下降速度（px/s）
  protected descendNextPattern: 'chase_player' | 'random_walk' = 'chase_player';  // 下降後のパターン

  // HPバー
  protected hpBarBg: Phaser.GameObjects.Rectangle | null = null;
  protected hpBarFill: Phaser.GameObjects.Rectangle | null = null;
  private readonly HP_BAR_WIDTH = 40;
  private readonly HP_BAR_HEIGHT = 4;
  private readonly HP_BAR_OFFSET_Y = -25;

  // テクスチャ・アニメーション情報
  protected textureKey: string = 'enemy';
  protected animationKey: string | null = null;
  protected displayScale: number = 0.1;  // デフォルトスケール

  constructor(scene: Phaser.Scene, x: number, y: number, groupType: MobGroupType, textureKey?: string) {
    super(scene, x, y, textureKey || 'enemy');

    this.groupType = groupType;
    this.stats = this.getStatsForGroup(groupType);
    this.currentHp = this.stats.maxHp;
    if (textureKey) {
      this.textureKey = textureKey;
    }

    // 物理エンジンに追加
    scene.add.existing(this);
    scene.physics.add.existing(this);

    // 初期設定
    this.setActive(false);
    this.setVisible(false);
    this.setDepth(DEPTH.ENEMIES);
    // テクスチャがある場合はTintを適用しない
    if (!textureKey) {
      this.setTint(this.getTintForGroup(groupType));
    }

    // 当たり判定（初期状態では無効）
    const body = this.body as Phaser.Physics.Arcade.Body;
    if (body) {
      body.setCircle(this.stats.hitboxRadius);
      body.setOffset(
        this.width / 2 - this.stats.hitboxRadius,
        this.height / 2 - this.stats.hitboxRadius
      );
      body.enable = false;
    }

    // HPバーを作成
    this.createHpBar();
  }

  /**
   * HPバーを作成
   */
  private createHpBar(): void {
    // 背景（黒）
    this.hpBarBg = this.scene.add.rectangle(
      this.x,
      this.y + this.HP_BAR_OFFSET_Y,
      this.HP_BAR_WIDTH,
      this.HP_BAR_HEIGHT,
      0x000000
    );
    this.hpBarBg.setDepth(DEPTH.ENEMIES + 1);
    this.hpBarBg.setVisible(false);

    // HP（緑）
    this.hpBarFill = this.scene.add.rectangle(
      this.x,
      this.y + this.HP_BAR_OFFSET_Y,
      this.HP_BAR_WIDTH,
      this.HP_BAR_HEIGHT,
      0x00ff00
    );
    this.hpBarFill.setDepth(DEPTH.ENEMIES + 2);
    this.hpBarFill.setVisible(false);
  }

  /**
   * HPバーを更新
   */
  protected updateHpBar(): void {
    if (!this.hpBarBg || !this.hpBarFill) return;

    const hpRatio = Math.max(0, this.currentHp / this.stats.maxHp);
    const scale = this.stats.isFlagCarrier ? 1.5 : 1;
    const barWidth = this.HP_BAR_WIDTH * scale;

    // 位置を更新
    this.hpBarBg.setPosition(this.x, this.y + this.HP_BAR_OFFSET_Y * scale);
    this.hpBarFill.setPosition(
      this.x - (barWidth * (1 - hpRatio)) / 2,
      this.y + this.HP_BAR_OFFSET_Y * scale
    );

    // サイズを更新
    this.hpBarBg.setSize(barWidth, this.HP_BAR_HEIGHT);
    this.hpBarFill.setSize(barWidth * hpRatio, this.HP_BAR_HEIGHT);

    // 色を更新（HP残量に応じて）
    if (hpRatio > 0.5) {
      this.hpBarFill.setFillStyle(0x00ff00); // 緑
    } else if (hpRatio > 0.25) {
      this.hpBarFill.setFillStyle(0xffff00); // 黄
    } else {
      this.hpBarFill.setFillStyle(0xff0000); // 赤
    }
  }

  /**
   * グループに応じたステータスを取得
   */
  private getStatsForGroup(groupType: MobGroupType): MobStats {
    const config = MOB_GROUP_CONFIG[groupType.toUpperCase() as keyof typeof MOB_GROUP_CONFIG];
    return {
      maxHp: config.HP,
      attackPower: config.ATK,
      defense: config.DEF,
      moveSpeed: config.MOVE_SPEED,
      hitboxRadius: config.HITBOX_RADIUS,
      scoreValue: config.SCORE_VALUE,
      expValue: config.EXP_VALUE,
      survivalTime: config.SURVIVAL_TIME,
      isFlagCarrier: config.IS_FLAG_CARRIER,
      exitMode: config.EXIT_MODE as MobExitMode,
    };
  }

  /**
   * グループに応じた色を取得
   */
  private getTintForGroup(groupType: MobGroupType): number {
    switch (groupType) {
      case MobGroupType.GROUP_A:
        return 0x88aaff;  // 青っぽい
      case MobGroupType.GROUP_B:
        return 0xffaa88;  // オレンジっぽい
      case MobGroupType.GROUP_C:
        return 0xff4488;  // ピンク（フラグ持ち）
      default:
        return COLORS.ENEMY;
    }
  }

  /**
   * 敵を生成
   */
  spawn(
    x: number,
    y: number,
    targetY?: number,
    movePattern: 'straight' | 'wave' | 'zigzag' | 'stay' = 'straight'
  ): void {
    this.movePattern = movePattern;
    this.patternTime = 0;
    this.spawnTime = this.scene.time.now;
    this.isFadingOut = false;
    this.isExiting = false;
    this.hasShot = false;
    this.isCurving = false;  // カーブ状態をリセット

    // ステータスをリセット
    this.currentHp = this.stats.maxHp;
    this.isActive = true;
    this.statusEffects = [];
    this.setAlpha(1);

    // スケールを設定（フラグ持ちは1.5倍）
    let scale = this.displayScale;
    if (this.stats.isFlagCarrier) {
      scale *= 1.5;
    }
    this.setScale(scale);

    // 位置を設定
    this.setPosition(x, y);
    this.setActive(true);
    this.setVisible(true);

    // 目標Y座標
    this.targetY = targetY ?? (GAME_CONFIG.PLAY_AREA.Y + GAME_CONFIG.PLAY_AREA.HEIGHT / 3);

    // 当たり判定を更新・有効化
    const body = this.body as Phaser.Physics.Arcade.Body;
    if (body) {
      body.enable = true;
      body.setCircle(this.stats.hitboxRadius);
      body.setOffset(
        (this.width - this.stats.hitboxRadius * 2) / 2,
        (this.height - this.stats.hitboxRadius * 2) / 2
      );
    }

    // アニメーションを再生（設定されている場合）
    if (this.animationKey) {
      this.play(this.animationKey);
    }

    // Tintをクリア（妖精画像を使う場合）
    this.clearTint();

    // HPバーを表示
    if (this.hpBarBg) this.hpBarBg.setVisible(true);
    if (this.hpBarFill) this.hpBarFill.setVisible(true);
    this.updateHpBar();

    // 初期速度
    this.updateMovement(0);
  }

  /**
   * 通過型スポーン（画面を通過して消える）
   * @param x 開始X座標
   * @param y 開始Y座標
   * @param velocityX X方向速度（px/s）
   * @param velocityY Y方向速度（px/s）
   * @param duration 通過にかかる時間（ms）
   */
  spawnPassThrough(
    x: number,
    y: number,
    velocityX: number,
    velocityY: number,
    _duration: number
  ): void {
    this.movePattern = 'pass_through';
    this.patternTime = 0;
    this.spawnTime = this.scene.time.now;
    this.isFadingOut = false;
    this.isExiting = false;
    this.hasShot = false;

    // 速度を保存
    this.passThroughVelocityX = velocityX;
    this.passThroughVelocityY = velocityY;

    // ステータスをリセット
    this.currentHp = this.stats.maxHp;
    this.isActive = true;
    this.statusEffects = [];
    this.setAlpha(1);

    // スケールを設定
    let scale = this.displayScale;
    if (this.stats.isFlagCarrier) {
      scale *= 1.5;
    }
    this.setScale(scale);

    // 位置を設定
    this.setPosition(x, y);
    this.setActive(true);
    this.setVisible(true);

    // 当たり判定を更新・有効化
    const body = this.body as Phaser.Physics.Arcade.Body;
    if (body) {
      body.enable = true;
      body.setCircle(this.stats.hitboxRadius);
      body.setOffset(
        (this.width - this.stats.hitboxRadius * 2) / 2,
        (this.height - this.stats.hitboxRadius * 2) / 2
      );
      // 速度を設定
      body.setVelocity(velocityX, velocityY);
    }

    // アニメーションを再生
    if (this.animationKey) {
      this.play(this.animationKey);
    }

    // Tintをクリア
    this.clearTint();

    // HPバーを表示
    if (this.hpBarBg) this.hpBarBg.setVisible(true);
    if (this.hpBarFill) this.hpBarFill.setVisible(true);
    this.updateHpBar();
  }

  /**
   * カーブ付き通過型スポーン
   * 最初は下方向に移動し、指定Y座標でカーブして横方向に抜ける
   * @param x 初期X座標
   * @param y 初期Y座標
   * @param velocityY 下方向速度（px/s）
   * @param curveAtY カーブ開始Y座標
   * @param exitVelocityX カーブ後のX速度（正=右、負=左）
   * @param curveDuration カーブにかかる時間（ms）
   */
  spawnPassThroughCurve(
    x: number,
    y: number,
    velocityY: number,
    curveAtY: number,
    exitVelocityX: number,
    curveDuration: number = 1000
  ): void {
    this.movePattern = 'pass_through_curve';
    this.patternTime = 0;
    this.spawnTime = this.scene.time.now;
    this.isFadingOut = false;
    this.isExiting = false;
    this.hasShot = false;

    // 速度を保存（最初は下方向のみ）
    this.passThroughVelocityX = 0;
    this.passThroughVelocityY = velocityY;

    // カーブ用パラメータを設定
    this.curveTargetY = curveAtY;
    this.curveExitVelocityX = exitVelocityX;
    this.curveDuration = curveDuration;
    this.curveStartTime = 0;
    this.isCurving = false;
    this.curveInitialVelY = velocityY;

    // ステータスをリセット
    this.currentHp = this.stats.maxHp;
    this.isActive = true;
    this.statusEffects = [];
    this.setAlpha(1);

    // スケールを設定
    let scale = this.displayScale;
    if (this.stats.isFlagCarrier) {
      scale *= 1.5;
    }
    this.setScale(scale);

    // 位置を設定
    this.setPosition(x, y);
    this.setActive(true);
    this.setVisible(true);

    // 当たり判定を更新・有効化
    const body = this.body as Phaser.Physics.Arcade.Body;
    if (body) {
      body.enable = true;
      body.setCircle(this.stats.hitboxRadius);
      body.setOffset(
        (this.width - this.stats.hitboxRadius * 2) / 2,
        (this.height - this.stats.hitboxRadius * 2) / 2
      );
      // 速度を設定（最初は下方向のみ）
      body.setVelocity(0, velocityY);
    }

    // アニメーションを再生
    if (this.animationKey) {
      this.play(this.animationKey);
    }

    // Tintをクリア
    this.clearTint();

    // HPバーを表示
    if (this.hpBarBg) this.hpBarBg.setVisible(true);
    if (this.hpBarFill) this.hpBarFill.setVisible(true);
    this.updateHpBar();
  }

  /**
   * 下降→発射→上昇パターンでスポーン
   * 指定Y座標まで下降し、弾幕を発射してから上昇して退場
   * @param x 初期X座標
   * @param y 初期Y座標
   * @param targetY 発射地点のY座標
   * @param descendSpeed 下降速度（px/s）
   * @param ascendSpeed 上昇速度（px/s）
   * @param onShoot 発射時に呼ばれるコールバック（外部から発射タイミングを制御）
   */
  spawnDescendShootAscend(
    x: number,
    y: number,
    targetY: number,
    descendSpeed: number = 100,
    ascendSpeed: number = 120,
    onShoot?: () => void
  ): void {
    this.movePattern = 'descend_shoot_ascend';
    this.patternTime = 0;
    this.spawnTime = this.scene.time.now;
    this.isFadingOut = false;
    this.isExiting = false;
    this.hasShot = false;

    // 下降→発射→上昇パラメータを設定
    this.dsaTargetY = targetY;
    this.dsaDescendSpeed = descendSpeed;
    this.dsaAscendSpeed = ascendSpeed;
    this.dsaState = 'descending';
    this.dsaHasReachedTarget = false;
    this.dsaOnShoot = onShoot || null;

    // ステータスをリセット
    this.currentHp = this.stats.maxHp;
    this.isActive = true;
    this.statusEffects = [];
    this.setAlpha(1);

    // スケールを設定
    let scale = this.displayScale;
    if (this.stats.isFlagCarrier) {
      scale *= 1.5;
    }
    this.setScale(scale);

    // 位置を設定
    this.setPosition(x, y);
    this.setActive(true);
    this.setVisible(true);

    // 当たり判定を更新・有効化
    const body = this.body as Phaser.Physics.Arcade.Body;
    if (body) {
      body.enable = true;
      body.setCircle(this.stats.hitboxRadius);
      body.setOffset(
        (this.width - this.stats.hitboxRadius * 2) / 2,
        (this.height - this.stats.hitboxRadius * 2) / 2
      );
      // 下方向に移動開始
      body.setVelocity(0, descendSpeed);
    }

    // アニメーションを再生
    if (this.animationKey) {
      this.play(this.animationKey);
    }

    // Tintをクリア
    this.clearTint();

    // HPバーを表示
    if (this.hpBarBg) this.hpBarBg.setVisible(true);
    if (this.hpBarFill) this.hpBarFill.setVisible(true);
    this.updateHpBar();
  }

  /**
   * 更新処理
   */
  update(time: number, delta: number): void {
    if (!this.isActive) {
      return;
    }

    // 生存時間チェック（-1は無制限、pass_throughは無視）
    if (this.stats.survivalTime > 0 && this.movePattern !== 'pass_through') {
      const aliveTime = time - this.spawnTime;
      if (aliveTime >= this.stats.survivalTime && !this.isFadingOut && !this.isExiting) {
        this.startExit();
      }
    }

    // フェードアウト中の処理
    if (this.isFadingOut) {
      return;  // フェードアウト中は他の処理をスキップ
    }

    // 退場中の処理
    if (this.isExiting) {
      this.updateExitMovement(delta);
      this.updateHpBar();
      return;
    }

    // 状態異常を更新
    this.updateStatusEffects(delta);

    // スタン中は移動・攻撃不可
    const isStunned = this.hasStatusEffect(StatusEffectType.STUN);

    this.patternTime += delta;

    // 移動パターンを更新（スタン中は停止）
    if (!isStunned) {
      this.updateMovement(delta);
    } else {
      this.setVelocity(0, 0);
    }

    // 弾幕発射（スタン中は不可）
    if (!isStunned) {
      this.updateShooting(time);
    }

    // プレイヤー方向を向く（左右反転）
    this.updateFacing();

    // HPバーを更新
    this.updateHpBar();

    // プレイエリア外にいる場合は描画しない（pass_throughでスポーン待ち中など）
    const insidePlayArea = this.isInsidePlayArea();
    if (!insidePlayArea && this.visible) {
      this.setVisible(false);
      if (this.hpBarBg) this.hpBarBg.setVisible(false);
      if (this.hpBarFill) this.hpBarFill.setVisible(false);
    } else if (insidePlayArea && !this.visible) {
      this.setVisible(true);
      // HPバーはupdateHpBar()で制御されるのでここでは変更しない
    }

    // 画面外に出たら非アクティブ化
    // pass_through/pass_through_curveモードでは上方向・横方向のマージンを大きくする（スポーン位置対応）
    const { X, WIDTH } = GAME_CONFIG.PLAY_AREA;
    const Y = GAME_CONFIG.PLAY_AREA.Y;
    const HEIGHT = GAME_CONFIG.PLAY_AREA.HEIGHT;
    const margin = 100;
    const isPassThrough = this.movePattern === 'pass_through' || this.movePattern === 'pass_through_curve';
    const topMargin = isPassThrough ? 300 : margin;
    const sideMargin = isPassThrough ? 1000 : margin;  // 横方向は遠くからスポーンする可能性がある
    if (this.x < X - sideMargin || this.x > X + WIDTH + sideMargin ||
        this.y < Y - topMargin || this.y > Y + HEIGHT + margin) {
      this.deactivate();
    }
  }

  /**
   * 退場開始（exitModeに応じた処理）
   */
  protected startExit(): void {
    if (this.isExiting || this.isFadingOut) return;

    switch (this.stats.exitMode) {
      case 'fade_out':
        this.startFadeOut();
        break;
      case 'move_to_edge':
        this.startMoveToEdge();
        break;
      case 'none':
        // 退場処理なし（撃破まで残る）
        break;
    }
  }

  /**
   * フェードアウト開始
   */
  protected startFadeOut(): void {
    if (this.isFadingOut) return;

    this.isFadingOut = true;
    this.setVelocity(0, 0);

    // フェードアウトアニメーション
    this.scene.tweens.add({
      targets: this,
      alpha: 0,
      duration: MID_STAGE_CONFIG.STAGE_1.FADE_OUT_DURATION,
      ease: 'Power2',
      onComplete: () => {
        this.deactivate();
      },
    });
  }

  /**
   * 画面端へ移動して退場開始
   */
  protected startMoveToEdge(): void {
    if (this.isExiting) return;

    this.isExiting = true;
    this.movePattern = 'exit';
    // 注: 物理ボディは有効のままにして、setVelocity()で移動
    // 衝突判定の無効化はコリジョングループの設定で行う
  }

  /**
   * 退場移動の更新
   */
  protected updateExitMovement(_delta: number): void {
    const { X, Y, WIDTH, HEIGHT } = GAME_CONFIG.PLAY_AREA;
    const margin = 100;

    // 一番近い画面端を計算
    const distToTop = this.y - Y;
    const distToBottom = (Y + HEIGHT) - this.y;
    const distToLeft = this.x - X;
    const distToRight = (X + WIDTH) - this.x;

    const minDist = Math.min(distToTop, distToBottom, distToLeft, distToRight);
    const exitSpeed = 200; // 退場速度

    let vx = 0;
    let vy = 0;

    if (minDist === distToTop) {
      vy = -exitSpeed; // 上へ
    } else if (minDist === distToBottom) {
      vy = exitSpeed; // 下へ
    } else if (minDist === distToLeft) {
      vx = -exitSpeed; // 左へ
    } else {
      vx = exitSpeed; // 右へ
    }

    this.setVelocity(vx, vy);

    // 画面外に出たら非アクティブ化
    if (this.x < X - margin || this.x > X + WIDTH + margin ||
        this.y < Y - margin || this.y > Y + HEIGHT + margin) {
      this.deactivate();
    }
  }

  /**
   * 状態異常を更新
   */
  private updateStatusEffects(delta: number): void {
    for (let i = this.statusEffects.length - 1; i >= 0; i--) {
      this.statusEffects[i].remainingTime -= delta;
      if (this.statusEffects[i].remainingTime <= 0) {
        // スタン解除時のエフェクト
        if (this.statusEffects[i].type === StatusEffectType.STUN) {
          this.setTint(this.getTintForGroup(this.groupType));
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
   * 特定の状態異常があるか確認
   */
  hasStatusEffect(type: StatusEffectType): boolean {
    return this.statusEffects.some(e => e.type === type);
  }

  /**
   * 移動パターンを更新
   */
  protected updateMovement(_delta: number): void {
    const { X, WIDTH } = GAME_CONFIG.PLAY_AREA;
    const enemyRadius = this.stats.hitboxRadius;
    const leftBound = X + enemyRadius;
    const rightBound = X + WIDTH - enemyRadius;

    // pass_throughモードは独自の処理をするので先にチェック
    if (this.movePattern === 'pass_through') {
      this.setVelocity(this.passThroughVelocityX, this.passThroughVelocityY);
      return;
    }

    // pass_through_curveモード: カーブ付き通過
    if (this.movePattern === 'pass_through_curve') {
      this.updateCurveMovement();
      return;
    }

    // descend_shoot_ascendモード: 下降→発射→上昇
    if (this.movePattern === 'descend_shoot_ascend') {
      this.updateDescendShootAscendMovement();
      return;
    }

    // chase_playerモード: プレイヤー追尾
    if (this.movePattern === 'chase_player') {
      this.updateChasePlayerMovement();
      return;
    }

    // random_walkモード: ランダム移動
    if (this.movePattern === 'random_walk') {
      this.updateRandomWalkMovement();
      return;
    }

    // descend_then_chaseモード: 下降→追尾
    if (this.movePattern === 'descend_then_chase') {
      this.updateDescendThenChaseMovement();
      return;
    }

    // descend_then_random_walkモード: 下降→ランダム移動
    if (this.movePattern === 'descend_then_random_walk') {
      this.updateDescendThenRandomWalkMovement();
      return;
    }

    // 目標Y座標に到達したら停止（pass_through以外）
    if (this.y >= this.targetY) {
      if (this.movePattern !== 'stay') {
        this.movePattern = 'stay';
      }
    }

    let vx = 0;
    let vy = 0;

    switch (this.movePattern) {
      case 'straight':
        vy = this.stats.moveSpeed;
        break;

      case 'wave':
        vx = Math.sin(this.patternTime / 500) * 80;
        vy = this.stats.moveSpeed;
        break;

      case 'zigzag':
        vx = Math.sin(this.patternTime / 300) * 120;
        vy = this.stats.moveSpeed;
        break;

      case 'stay':
        // 停止状態
        vx = 0;
        vy = 0;
        break;

      // pass_throughは関数の最初で処理済み
    }

    // プレイエリアの境界でX方向の速度を制限
    if (this.x <= leftBound && vx < 0) {
      vx = Math.abs(vx);
    } else if (this.x >= rightBound && vx > 0) {
      vx = -Math.abs(vx);
    }

    // 位置を強制的にプレイエリア内にクランプ
    if (this.x < leftBound) {
      this.x = leftBound;
    } else if (this.x > rightBound) {
      this.x = rightBound;
    }

    this.setVelocity(vx, vy);
  }

  /**
   * カーブ移動の更新処理
   * Y座標がcurveTargetYに達したらカーブを開始し、
   * curveDuration時間かけてY速度を0にしながらX速度を加速
   */
  protected updateCurveMovement(): void {
    const time = this.scene.time.now;

    // カーブ開始判定
    if (!this.isCurving && this.y >= this.curveTargetY) {
      this.isCurving = true;
      this.curveStartTime = time;
      this.curveInitialVelY = this.passThroughVelocityY;
    }

    if (this.isCurving) {
      // カーブ中: Y速度を減らしながらX速度を増やす
      const elapsed = time - this.curveStartTime;
      const progress = Math.min(elapsed / this.curveDuration, 1);

      // イージング（easeOutQuad）で滑らかなカーブ
      const eased = 1 - (1 - progress) * (1 - progress);

      // Y速度: 初期値から0へ
      const currentVelY = this.curveInitialVelY * (1 - eased);
      // X速度: 0から目標値へ
      const currentVelX = this.curveExitVelocityX * eased;

      this.setVelocity(currentVelX, currentVelY);
    } else {
      // カーブ前: 下方向に移動
      this.setVelocity(0, this.passThroughVelocityY);
    }
  }

  /**
   * 下降→発射→上昇パターンの移動更新
   */
  protected updateDescendShootAscendMovement(): void {
    if (this.dsaState === 'descending') {
      // 下降中: 目標Y座標に到達したか確認
      if (this.y >= this.dsaTargetY && !this.dsaHasReachedTarget) {
        this.dsaHasReachedTarget = true;

        // 弾幕を発射
        if (this.dsaOnShoot) {
          this.dsaOnShoot();
        }

        // 上昇状態に移行
        this.dsaState = 'ascending';
        this.setVelocity(0, -this.dsaAscendSpeed);
      } else if (!this.dsaHasReachedTarget) {
        // まだ目標に到達していない場合は下降継続
        this.setVelocity(0, this.dsaDescendSpeed);
      }
    } else if (this.dsaState === 'ascending') {
      // 上昇中
      this.setVelocity(0, -this.dsaAscendSpeed);
    }
  }

  /**
   * プレイヤー追尾移動の更新
   */
  protected updateChasePlayerMovement(): void {
    if (!this.playerPosition) {
      this.setVelocity(0, 0);
      return;
    }

    // プレイヤー方向への単位ベクトルを計算
    const dx = this.playerPosition.x - this.x;
    const dy = this.playerPosition.y - this.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance < 1) {
      // プレイヤーとほぼ同じ位置なら停止
      this.setVelocity(0, 0);
      return;
    }

    // 正規化して速度を掛ける
    const vx = (dx / distance) * this.chaseSpeed;
    const vy = (dy / distance) * this.chaseSpeed;

    this.setVelocity(vx, vy);
  }

  /**
   * プレイヤー追尾パターンでスポーン
   * @param x 初期X座標
   * @param y 初期Y座標
   * @param speed 追尾速度（px/s）
   */
  spawnChasePlayer(x: number, y: number, speed: number): void {
    this.movePattern = 'chase_player';
    this.patternTime = 0;
    this.spawnTime = this.scene.time.now;
    this.isFadingOut = false;
    this.isExiting = false;
    this.hasShot = false;
    this.chaseSpeed = speed;

    // ステータスをリセット
    this.currentHp = this.stats.maxHp;
    this.isActive = true;
    this.statusEffects = [];
    this.setAlpha(1);

    // スケールを設定
    let scale = this.displayScale;
    if (this.stats.isFlagCarrier) {
      scale *= 1.5;
    }
    this.setScale(scale);

    // 位置を設定
    this.setPosition(x, y);
    this.setActive(true);
    this.setVisible(true);

    // 当たり判定を更新・有効化
    const body = this.body as Phaser.Physics.Arcade.Body;
    if (body) {
      body.enable = true;
      body.setCircle(this.stats.hitboxRadius);
      body.setOffset(
        (this.width - this.stats.hitboxRadius * 2) / 2,
        (this.height - this.stats.hitboxRadius * 2) / 2
      );
    }

    // アニメーションを再生
    if (this.animationKey) {
      this.play(this.animationKey);
    }

    // Tintをクリア
    this.clearTint();

    // HPバーを表示
    if (this.hpBarBg) this.hpBarBg.setVisible(true);
    if (this.hpBarFill) this.hpBarFill.setVisible(true);
    this.updateHpBar();
  }

  /**
   * ランダム移動の更新
   * プレイヤーから離れすぎると近づき、近すぎると離れる
   */
  protected updateRandomWalkMovement(): void {
    const { X, Y, WIDTH, HEIGHT } = GAME_CONFIG.PLAY_AREA;
    const margin = 50;  // 画面端からのマージン
    const time = this.scene.time.now;
    const maxDistanceFromPlayer = 550;  // プレイヤーからの最大距離（広めに設定）
    const minDistanceFromPlayer = 100;  // プレイヤーからの最小距離

    // プレイヤーとの距離をチェック
    if (this.playerPosition) {
      const dx = this.x - this.playerPosition.x;
      const dy = this.y - this.playerPosition.y;
      const distanceToPlayer = Math.sqrt(dx * dx + dy * dy);

      // プレイヤーから離れすぎている場合、プレイヤー方向に向かう
      if (distanceToPlayer > maxDistanceFromPlayer) {
        this.randomWalkAngle = Math.atan2(-dy, -dx);  // プレイヤー方向
        this.randomWalkLastChangeTime = time;  // タイマーリセット
      }
      // プレイヤーに近すぎる場合、離れる
      else if (distanceToPlayer < minDistanceFromPlayer) {
        this.randomWalkAngle = Math.atan2(dy, dx);  // プレイヤーと反対方向
        this.randomWalkLastChangeTime = time;  // タイマーリセット
      }
    }

    // 方向変更の間隔チェック
    if (time - this.randomWalkLastChangeTime >= this.randomWalkChangeInterval) {
      this.randomWalkLastChangeTime = time;
      // ランダムな角度に変更（プレイヤー方向を中心に±90度）
      if (this.playerPosition) {
        const toPlayerAngle = Math.atan2(
          this.playerPosition.y - this.y,
          this.playerPosition.x - this.x
        );
        // プレイヤー方向を基準に±90度のランダム
        this.randomWalkAngle = toPlayerAngle + (Math.random() - 0.5) * Math.PI;
      } else {
        this.randomWalkAngle = Math.random() * Math.PI * 2;
      }
    }

    // 速度を計算
    let vx = Math.cos(this.randomWalkAngle) * this.randomWalkSpeed;
    let vy = Math.sin(this.randomWalkAngle) * this.randomWalkSpeed;

    // 画面端で反射
    if (this.x <= X + margin && vx < 0) {
      this.randomWalkAngle = Math.PI - this.randomWalkAngle;
      vx = Math.cos(this.randomWalkAngle) * this.randomWalkSpeed;
    } else if (this.x >= X + WIDTH - margin && vx > 0) {
      this.randomWalkAngle = Math.PI - this.randomWalkAngle;
      vx = Math.cos(this.randomWalkAngle) * this.randomWalkSpeed;
    }
    if (this.y <= Y + margin && vy < 0) {
      this.randomWalkAngle = -this.randomWalkAngle;
      vy = Math.sin(this.randomWalkAngle) * this.randomWalkSpeed;
    } else if (this.y >= Y + HEIGHT - margin && vy > 0) {
      this.randomWalkAngle = -this.randomWalkAngle;
      vy = Math.sin(this.randomWalkAngle) * this.randomWalkSpeed;
    }

    this.setVelocity(vx, vy);
  }

  /**
   * ランダム移動パターンでスポーン
   * @param x 初期X座標
   * @param y 初期Y座標
   * @param speed 移動速度（px/s）
   * @param changeInterval 方向変更間隔（ms）
   */
  spawnRandomWalk(x: number, y: number, speed: number, changeInterval: number = 2000): void {
    this.movePattern = 'random_walk';
    this.patternTime = 0;
    this.spawnTime = this.scene.time.now;
    this.isFadingOut = false;
    this.isExiting = false;
    this.hasShot = false;
    this.randomWalkSpeed = speed;
    this.randomWalkChangeInterval = changeInterval;
    this.randomWalkLastChangeTime = this.scene.time.now;
    this.randomWalkAngle = Math.random() * Math.PI * 2;  // 初期方向はランダム

    // ステータスをリセット
    this.currentHp = this.stats.maxHp;
    this.isActive = true;
    this.statusEffects = [];
    this.setAlpha(1);

    // スケールを設定
    let scale = this.displayScale;
    if (this.stats.isFlagCarrier) {
      scale *= 1.5;
    }
    this.setScale(scale);

    // 位置を設定
    this.setPosition(x, y);
    this.setActive(true);
    this.setVisible(true);

    // 当たり判定を更新・有効化
    const body = this.body as Phaser.Physics.Arcade.Body;
    if (body) {
      body.enable = true;
      body.setCircle(this.stats.hitboxRadius);
      body.setOffset(
        (this.width - this.stats.hitboxRadius * 2) / 2,
        (this.height - this.stats.hitboxRadius * 2) / 2
      );
    }

    // アニメーションを再生
    if (this.animationKey) {
      this.play(this.animationKey);
    }

    // Tintをクリア
    this.clearTint();

    // HPバーを表示
    if (this.hpBarBg) this.hpBarBg.setVisible(true);
    if (this.hpBarFill) this.hpBarFill.setVisible(true);
    this.updateHpBar();
  }

  /**
   * 下降→追尾移動の更新処理
   * 目標Y座標に到達するまで下降し、到達後は追尾モードに切り替え
   */
  protected updateDescendThenChaseMovement(): void {
    // 目標Y座標に到達したか確認
    if (this.y >= this.descendTargetY) {
      // 追尾モードに切り替え
      this.movePattern = 'chase_player';
      this.updateChasePlayerMovement();
    } else {
      // 下降中
      this.setVelocity(0, this.descendSpeed);
    }
  }

  /**
   * 下降→ランダム移動の更新処理
   * 目標Y座標に到達するまで下降し、到達後はランダム移動モードに切り替え
   */
  protected updateDescendThenRandomWalkMovement(): void {
    // 目標Y座標に到達したか確認
    if (this.y >= this.descendTargetY) {
      // ランダム移動モードに切り替え
      this.movePattern = 'random_walk';
      this.randomWalkLastChangeTime = this.scene.time.now;
      this.randomWalkAngle = Math.random() * Math.PI * 2;
      this.updateRandomWalkMovement();
    } else {
      // 下降中
      this.setVelocity(0, this.descendSpeed);
    }
  }

  /**
   * 下降→追尾パターンでスポーン
   * 画面上部からスポーンし、targetYまで下降してから追尾移動を開始
   * @param x 初期X座標
   * @param y 初期Y座標
   * @param targetY 下降目標Y座標
   * @param descendSpeed 下降速度（px/s）
   * @param chaseSpeed 追尾速度（px/s）
   */
  spawnDescendThenChase(x: number, y: number, targetY: number, descendSpeed: number, chaseSpeed: number): void {
    this.movePattern = 'descend_then_chase';
    this.patternTime = 0;
    this.spawnTime = this.scene.time.now;
    this.isFadingOut = false;
    this.isExiting = false;
    this.hasShot = false;
    this.descendTargetY = targetY;
    this.descendSpeed = descendSpeed;
    this.chaseSpeed = chaseSpeed;

    // ステータスをリセット
    this.currentHp = this.stats.maxHp;
    this.isActive = true;
    this.statusEffects = [];
    this.setAlpha(1);

    // スケールを設定
    let scale = this.displayScale;
    if (this.stats.isFlagCarrier) {
      scale *= 1.5;
    }
    this.setScale(scale);

    // 位置を設定
    this.setPosition(x, y);
    this.setActive(true);
    this.setVisible(true);

    // 当たり判定を更新・有効化
    const body = this.body as Phaser.Physics.Arcade.Body;
    if (body) {
      body.enable = true;
      body.setCircle(this.stats.hitboxRadius);
      body.setOffset(
        (this.width - this.stats.hitboxRadius * 2) / 2,
        (this.height - this.stats.hitboxRadius * 2) / 2
      );
    }

    // アニメーションを再生
    if (this.animationKey) {
      this.play(this.animationKey);
    }

    // Tintをクリア
    this.clearTint();

    // HPバーを表示
    if (this.hpBarBg) this.hpBarBg.setVisible(true);
    if (this.hpBarFill) this.hpBarFill.setVisible(true);
    this.updateHpBar();
  }

  /**
   * 下降→ランダム移動パターンでスポーン
   * 画面上部からスポーンし、targetYまで下降してからランダム移動を開始
   * @param x 初期X座標
   * @param y 初期Y座標
   * @param targetY 下降目標Y座標
   * @param descendSpeed 下降速度（px/s）
   * @param walkSpeed ランダム移動速度（px/s）
   * @param changeInterval 方向変更間隔（ms）
   */
  spawnDescendThenRandomWalk(
    x: number, y: number, targetY: number,
    descendSpeed: number, walkSpeed: number, changeInterval: number = 2000
  ): void {
    this.movePattern = 'descend_then_random_walk';
    this.patternTime = 0;
    this.spawnTime = this.scene.time.now;
    this.isFadingOut = false;
    this.isExiting = false;
    this.hasShot = false;
    this.descendTargetY = targetY;
    this.descendSpeed = descendSpeed;
    this.randomWalkSpeed = walkSpeed;
    this.randomWalkChangeInterval = changeInterval;

    // ステータスをリセット
    this.currentHp = this.stats.maxHp;
    this.isActive = true;
    this.statusEffects = [];
    this.setAlpha(1);

    // スケールを設定
    let scale = this.displayScale;
    if (this.stats.isFlagCarrier) {
      scale *= 1.5;
    }
    this.setScale(scale);

    // 位置を設定
    this.setPosition(x, y);
    this.setActive(true);
    this.setVisible(true);

    // 当たり判定を更新・有効化
    const body = this.body as Phaser.Physics.Arcade.Body;
    if (body) {
      body.enable = true;
      body.setCircle(this.stats.hitboxRadius);
      body.setOffset(
        (this.width - this.stats.hitboxRadius * 2) / 2,
        (this.height - this.stats.hitboxRadius * 2) / 2
      );
    }

    // アニメーションを再生
    if (this.animationKey) {
      this.play(this.animationKey);
    }

    // Tintをクリア
    this.clearTint();

    // HPバーを表示
    if (this.hpBarBg) this.hpBarBg.setVisible(true);
    if (this.hpBarFill) this.hpBarFill.setVisible(true);
    this.updateHpBar();

    // プレイエリア外にスポーンした場合は非表示にする（下降してきてから表示）
    if (!this.isInsidePlayArea()) {
      this.setVisible(false);
      if (this.hpBarBg) this.hpBarBg.setVisible(false);
      if (this.hpBarFill) this.hpBarFill.setVisible(false);
    }
  }

  /**
   * プレイヤー方向を向く（左右反転）
   */
  protected updateFacing(): void {
    if (!this.playerPosition) return;

    // プレイヤーが左側にいる場合は左向き（flipX = false）
    // プレイヤーが右側にいる場合は右向き（flipX = true）
    const shouldFaceRight = this.playerPosition.x > this.x;
    this.setFlipX(shouldFaceRight);
  }

  /**
   * 弾幕発射処理（サブクラスで実装）
   */
  protected abstract updateShooting(time: number): void;

  /**
   * ダメージを受ける
   */
  takeDamage(damage: number): boolean {
    if (!this.isActive || this.isFadingOut || this.isExiting) {
      return false;
    }

    this.currentHp -= damage;

    // ダメージエフェクト
    this.flashDamage();

    // 死亡判定
    if (this.currentHp <= 0) {
      this.onDeath();
      return true; // 撃破
    }

    return false;
  }

  /**
   * ダメージエフェクト
   */
  private flashDamage(): void {
    this.setTint(0xffffff);
    this.scene.time.delayedCall(100, () => {
      if (this.isActive) {
        this.setTint(this.getTintForGroup(this.groupType));
      }
    });
  }

  /**
   * 死亡処理
   */
  protected onDeath(): void {
    // 戦闘不能SEを再生
    AudioManager.getInstance().playSe('se_enep00');

    // TODO: 死亡エフェクト
    // TODO: アイテムドロップ

    // フラグ持ちの場合はイベントを発火
    if (this.stats.isFlagCarrier) {
      this.scene.events.emit('flag-carrier-defeated', this);
    }

    this.deactivate();
  }

  /**
   * 非アクティブ化
   */
  deactivate(): void {
    this.isActive = false;
    this.isFadingOut = false;
    this.isExiting = false;
    this.setActive(false);
    this.setVisible(false);
    this.setVelocity(0, 0);
    this.setScale(1);
    this.setAlpha(1);

    // 物理ボディを無効化
    const body = this.body as Phaser.Physics.Arcade.Body;
    if (body) {
      body.enable = false;
    }

    // HPバーを非表示
    if (this.hpBarBg) this.hpBarBg.setVisible(false);
    if (this.hpBarFill) this.hpBarFill.setVisible(false);
  }

  /**
   * 弾プールを設定
   */
  setBulletPool(pool: BulletPool): void {
    this.bulletPool = pool;
  }

  /**
   * プレイヤー位置を設定
   */
  setPlayerPosition(x: number, y: number): void {
    this.playerPosition = { x, y };
  }

  // ゲッター
  getAttackPower(): number {
    return this.stats.attackPower;
  }

  getDefense(): number {
    return this.stats.defense;
  }

  getScoreValue(): number {
    return this.stats.scoreValue;
  }

  getExpValue(): number {
    return this.stats.expValue;
  }

  getIsActive(): boolean {
    return this.isActive;
  }

  getCurrentHp(): number {
    return this.currentHp;
  }

  getMaxHp(): number {
    return this.stats.maxHp;
  }

  getGroupType(): MobGroupType {
    return this.groupType;
  }

  getHitboxRadius(): number {
    return this.stats.hitboxRadius;
  }

  getStats(): MobStats {
    return this.stats;
  }

  isFlagCarrier(): boolean {
    return this.stats.isFlagCarrier;
  }

  /**
   * カーブ中かどうかを取得
   */
  getIsCurving(): boolean {
    return this.isCurving;
  }

  /**
   * プレイエリア内にいるかどうかを判定
   */
  isInsidePlayArea(): boolean {
    const { X, Y, WIDTH, HEIGHT } = GAME_CONFIG.PLAY_AREA;
    return this.x >= X && this.x <= X + WIDTH &&
           this.y >= Y && this.y <= Y + HEIGHT;
  }
}
