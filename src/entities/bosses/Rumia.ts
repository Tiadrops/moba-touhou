import Phaser from 'phaser';
import { Boss } from '../Boss';
import {
  BossSkillState,
  BossSkillSlot,
  BulletType,
  BossPhaseType,
  StatusEffectType,
  StatusEffect,
} from '@/types';
import { BOSS_CONFIG, GAME_CONFIG, DEPTH } from '@/config/GameConfig';
import { KSHOT } from '../Bullet';
import { AudioManager } from '@/systems/AudioManager';

const CONFIG = BOSS_CONFIG.RUMIA;

// スキル設定の共通型
type PhaseSkillsConfig = {
  Q: {
    NAME: string;
    CAST_TIME: number;
    COOLDOWN: number;
    DAMAGE: { BASE: number; RATIO: number };
    // ノーマルフェーズ用（通常弾幕1）
    WARNING_LINE_COUNT?: number;       // 予告線の本数
    WARNING_LINE_INTERVAL?: number;    // 予告線出現間隔（ms）
    WARNING_TO_FIRE_DELAY?: number;    // 予告線から弾発射までの遅延（ms）
    BULLET_ROWS?: number;              // 縦方向の弾数
    BULLET_ROW_SPACING?: number;       // 縦方向の弾間隔（px）
    BULLET_COL_SPACING?: number;       // 横方向の弾間隔（px）
    BULLET_DISPLAY_SCALE?: number;     // 弾の表示スケール
    INTERRUPTIBLE?: boolean;           // CC中断可能フラグ
    // スペルカード用（12方向弾）
    WAY_COUNT?: number;
    ANGLE_SPREAD?: number;
    BULLETS_PER_WAY?: number;
    BULLET_INTERVAL?: number;
    WARNING_LINE_LENGTH?: number;
    WAY_DELAY?: number;
    // スペルカードPhase1用（オーブオブディセプション）
    ENABLED?: boolean;                 // スキル有効フラグ
    BULLET_COUNT?: number;             // 弾数
    BULLET_RANGE?: number;             // 射程（px）
    BULLET_SPEED_OUTGOING?: number;    // 行き弾速（px/s）
    BULLET_SPEED_RETURN_INITIAL?: number; // 帰り初速（px/s）
    BULLET_SPEED_RETURN_ACCEL?: number;   // 帰り加速度（px/s²）
    BULLET_SPEED_RETURN_MAX?: number;     // 帰り最大速度（px/s）
    // 共通
    BULLET_SPEED?: number;             // 従来の弾速（オプション）
    BULLET_RADIUS?: number;
    BULLET_COLOR?: number;  // 弾の色（オプション）
  };
  W: {
    NAME: string;
    CAST_TIME: number;
    COOLDOWN: number;
    DAMAGE: { BASE: number; RATIO: number };
    // ノーマルフェーズ用（リング弾幕）
    RING_COUNT?: number;
    BULLETS_PER_RING?: number;
    BULLET_RADIUS?: number;
    BULLET_DISPLAY_SCALE?: number;
    BULLET_COLOR?: number;
    RING_SPEEDS?: readonly number[];
    // スペルカード用（トリプルバースト - Q3連射）
    BURST_COUNT?: number;
    BURST_INTERVAL?: number;
    BULLET_SPEED?: number;  // W専用の弾速（Qより速い）
    // スペルカードPhase1用（アレンジドフォックスファイア）
    ENABLED?: boolean;                 // スキル有効フラグ
    INTERRUPTIBLE?: boolean;           // CC中断可能フラグ（Breakシステム用）
    FIELD_RADIUS?: number;             // フィールド半径
    FIELD_TOTAL_DURATION?: number;     // フィールド総持続時間（2秒）
    FIELD_YELLOW_DURATION?: number;    // 黄色フェーズ持続時間（0.6秒、キャスト扱い）
    HOMING_BULLET_COUNT?: number;      // 追尾弾数
    HOMING_BULLET_RADIUS?: number;     // 追尾弾半径
    HOMING_BULLET_SPEED?: number;      // 追尾弾速度
    HOMING_TURN_RATE?: number;         // 追尾弾旋回速度
    HOMING_DURATION?: number;          // 追尾弾持続時間
    // MSバフパラメータ
    MS_BUFF_AMOUNT?: number;           // MSバフ量
    MS_BUFF_DURATION?: number;         // バフ持続時間（ms）
  };
  E: {
    NAME: string;
    CAST_TIME: number;
    COOLDOWN: number;
    DAMAGE: { BASE: number; RATIO: number };
    // ノーマルフェーズ用（通常弾幕3 - 移動弾幕）
    MOVE_DURATION?: number;
    MOVE_DISTANCE?: number;
    BULLET_LINES?: number;
    BULLETS_PER_LINE?: number;
    BULLET_SPAWN_INTERVAL?: number;
    LINE_SPACING?: number;
    LINE_WIDTH?: number;
    BULLET_RADIUS?: number;
    BULLET_DISPLAY_SCALE?: number;
    BULLET_COLOR?: number;
    BULLET_SPEED_BASE?: number;
    BULLET_SPEED_INCREMENT?: number;
    BULLET_SPEED_PEAK_INDEX?: number;
    INTERRUPTIBLE?: boolean;
    // スペルカード用（闇の潮汐）
    SPIRAL_ARMS?: number;
    SPIRAL_DURATION?: number;
    BULLET_FIRE_INTERVAL?: number;
    BULLET_SPEED?: number;
    ROTATION_SPEED?: number;
    // スペルカードPhase1用（カーチスクロス）
    ENABLED?: boolean;                 // スキル有効フラグ
    DASH_DISTANCE?: number;            // 突進距離（px）
    DASH_SPEED?: number;               // 突進速度（px/s）
    CROSS_BULLET_RADIUS?: number;      // 十字架弾の半径（px）
    CROSS_BULLET_SPACING?: number;     // 弾の間隔（px）
    BULLET_CONTINUES_AFTER_DASH?: boolean; // 弾が突進後も継続するか
  };
  R?: {
    NAME: string;
    CAST_TIME: number;
    COOLDOWN: number;
    DAMAGE: { BASE: number; RATIO: number };
    INVINCIBILITY_DURATION: number;
    MOVE_DISTANCE: number;
    MOVE_SPEED?: number;
    BULLET_FIRE_INTERVAL: number;
    BULLET_SPEED: number;
    // 輪弾RED (ID:9) - 半径0.25m
    RINDAN_RADIUS?: number;
    RINDAN_COUNT?: number;
    RINDAN_SPEED?: number;
    RINDAN_FIRE_OFFSETS?: readonly number[];
    // 黒縁中玉WHITE (ID:8) - 半径0.125m
    MEDIUM_BALL_RADIUS?: number;
    MEDIUM_BALL_COUNT?: number;
    MEDIUM_BALL_FIRE_OFFSETS?: readonly number[];
    // 終了時リング弾
    FINISH_RING_COUNT?: number;
    FINISH_RING_RADIUS?: number;
    FINISH_RING_SPEED?: number;
    // 旧パラメータ（互換性用）
    BULLET_SIZE_SMALL?: number;
    BULLET_SIZE_MEDIUM?: number;
    BULLET_SIZE_LARGE?: number;
    BULLETS_RANDOM?: number;
    BULLETS_AIMED?: number;
  };
};

/**
 * ルーミア（ステージ1ボス）
 * 「宵闇の妖怪」
 */
export class Rumia extends Boss {
  // 現在のフェーズのスキル設定
  private currentSkillConfig: PhaseSkillsConfig = CONFIG.PHASE_0_SKILLS as PhaseSkillsConfig;

  // Qスキル用（通常弾幕1）
  private qSkillWarningLines: Array<{
    angle: number;           // 予告線の角度（ラジアン）
    createdTime: number;     // 予告線作成時間
    fired: boolean;          // 弾幕発射済みか
    lineIndex: number;       // 何本目の予告線か（0-indexed）
  }> = [];
  private qSkillNextWarningTime: number = 0;   // 次の予告線出現時間
  private qSkillWarningLineCount: number = 0;  // 現在の予告線数
  private _qSkillInterrupted: boolean = false;  // CCで中断されたか（Breakシステム用）

  /** Qスキルが中断されたかどうか（Breakシステム用） */
  get qSkillWasInterrupted(): boolean {
    return this._qSkillInterrupted;
  }

  /** Eスキルが中断されたかどうか（Breakシステム用） */
  get eSkillWasInterrupted(): boolean {
    return this._eSkillInterrupted;
  }

  // アニメーション状態
  private currentAnimState: 'idle' | 'cast' | 'move' | 'move_cast' = 'idle';

  // 当たり判定表示用（デバッグ）
  private static DEBUG_SHOW_HITBOX = false; // trueで当たり判定を表示
  private hitboxGraphics: Phaser.GameObjects.Graphics | null = null;

  // Wスキル用（リング弾幕）
  private wSkillWarningGraphics: Phaser.GameObjects.Graphics | null = null;

  // Eスキル用（通常弾幕3 - 移動弾幕）
  private eSkillMoveDirection: number = 0;      // 移動方向（ラジアン）
  private eSkillMoveStartPos: { x: number; y: number } = { x: 0, y: 0 };
  private eSkillMoveEndPos: { x: number; y: number } = { x: 0, y: 0 }; // 移動終了位置
  private eSkillMoveProgress: number = 0;       // 移動進捗（0〜1）
  private eSkillBulletsSpawned: number = 0;     // 配置済み弾数（各列）
  private eSkillBulletSpawnTimer: number = 0;   // 弾配置タイマー
  private _eSkillInterrupted: boolean = false;  // CCで中断されたか
  private eSkillBulletPositions: Array<{ x: number; y: number }[]> = []; // 事前計算した弾位置（列ごと）
  private eSkillBulletAngle: number = 0;        // 事前計算した弾の発射角度（固定）
  private eSkillPhase: 'before_move' | 'moving' | 'after_move' = 'before_move'; // フェーズ
  private eSkillAngleToPlayer: number = 0;      // プレイヤー方向（列の角度計算用）
  private eSkillCurrentLines: number = 1;       // 現在のフェーズの列数
  private eSkillCurrentSpeedBase: number = 2 * 55; // 現在のフェーズの基本弾速

  // Rスキル用（ダークサイドオブザムーン）
  private rSkillMoveDirection: number = 0;          // 移動方向（ラジアン）
  private rSkillMoveProgress: number = 0;           // 移動進捗（0〜1）
  private rSkillBulletFireTimer: number = 0;        // 弾発射タイマー
  private rSkillInvincibilityRemaining: number = 0; // 無敵残り時間
  private rSkillInvincibilityText: Phaser.GameObjects.Text | null = null; // 無敵テキスト表示
  // private rSkillDirectionChangeTimer: number = 0;   // 方向変更タイマー（将来用）

  // Phase1 Qスキル用（オーブオブディセプション）
  private orbBullets: Phaser.Physics.Arcade.Sprite[] = []; // 発射した弾の配列
  private orbPhases: ('outgoing' | 'returning')[] = [];    // 各弾のフェーズ（行き/帰り）
  private orbStartPos: { x: number; y: number } = { x: 0, y: 0 }; // 発射位置
  private orbTargetPositions: { x: number; y: number }[] = []; // 各弾の最大射程位置
  private orbReturnSpeeds: number[] = [];              // 各弾の帰り速度（加速中）

  // Phase1 Wスキル用（アレンジドフォックスファイア）
  private foxfireFieldGraphics: Phaser.GameObjects.Graphics | null = null;  // フィールド表示用
  private foxfireFieldTimer: number = 0;                  // フィールド展開タイマー
  private foxfireFieldActive: boolean = false;            // フィールドアクティブ状態
  private foxfireFieldPhase: 'yellow' | 'red' | 'none' = 'none';  // フィールドフェーズ
  private foxfireHomingBullets: Phaser.Physics.Arcade.Sprite[] = []; // 追尾弾の配列
  private foxfireHomingAngles: number[] = [];             // 各追尾弾の現在角度
  private foxfireHomingTimers: number[] = [];             // 各追尾弾の残り時間
  private foxfireMsBuffAmount: number = 0;                // 現在のMSバフ量
  private foxfireMsBuffRemainingTime: number = 0;         // バフ残り時間（ms）
  private _wSkillInterrupted: boolean = false;            // Wスキルが中断されたか（Breakシステム用）

  /** Wスキルが中断されたかどうか（Breakシステム用） */
  get wSkillWasInterrupted(): boolean {
    return this._wSkillInterrupted;
  }

  // Phase1 Eスキル用（カーチスクロス）
  private curtisCrossDashDirection: number = 0;          // 突進方向（ラジアン）
  private curtisCrossDashProgress: number = 0;           // 突進進捗（0〜1）
  private curtisCrossDashStartPos: { x: number; y: number } = { x: 0, y: 0 };  // 突進開始位置
  private curtisCrossDashTargetPos: { x: number; y: number } = { x: 0, y: 0 }; // 突進目標位置
  private curtisCrossBullets: Phaser.Physics.Arcade.Sprite[] = []; // 十字架弾幕の配列
  private curtisCrossBulletOffsets: { x: number; y: number }[] = []; // 各弾のルーミアからのオフセット
  private curtisCrossDashComplete: boolean = false;      // 突進完了フラグ

  // スペルカード用Eスキル（闘争の潮汐）- 将来用・コメントアウト
  // private spellESkillStartTime: number = 0;         // スキル開始時間
  // private spellESkillBulletTimer: number = 0;       // 弾発射タイマー
  // private spellESkillBaseAngle: number = 0;         // 螺旋の基準角度

  // スキル硬直時間（W/E使用後の硬直）
  private skillRecoveryTime: number = 0;            // 残り硬直時間（ms）
  private static readonly SKILL_RECOVERY_DURATION = 200; // 硬直時間（0.2秒）

  // Phase1用スキル硬直時間（各スキル使用後の硬直）
  private phase1SkillRecoveryTime: number = 0;      // 残り硬直時間（ms）
  private static readonly PHASE1_SKILL_RECOVERY_DURATION = 500; // 硬直時間（0.5秒）

  constructor(scene: Phaser.Scene, x: number, y: number) {
    // 最初のフェーズのHPを使用
    const initialPhase = CONFIG.PHASES[0];
    super(scene, x, y, {
      maxHp: initialPhase.HP,
      attackPower: CONFIG.ATK,
      defense: CONFIG.DEF,
      moveSpeed: CONFIG.MOVE_SPEED,
      hitboxRadius: CONFIG.HITBOX_RADIUS,
    });

    // 初期スキル設定
    this.currentSkillConfig = CONFIG.PHASE_0_SKILLS;

    // ルーミアのコマアニメーションを設定
    this.setTexture('coma_rumia_idle');
    this.play('rumia_idle');
    this.clearTint();

    // 当たり判定表示を作成
    this.hitboxGraphics = this.scene.add.graphics();
    this.hitboxGraphics.setDepth(DEPTH.ENEMIES + 1);
  }

  /**
   * フェーズを初期化
   */
  protected initializePhases(): void {
    // GameConfigからフェーズ定義を読み込み
    for (const phaseConfig of CONFIG.PHASES) {
      this.phases.push({
        name: phaseConfig.NAME,
        type: phaseConfig.TYPE === 'spell' ? BossPhaseType.SPELL_CARD : BossPhaseType.NORMAL,
        hp: phaseConfig.HP,
        isFinal: phaseConfig.IS_FINAL,
      });
    }
  }

  /**
   * フェーズ変更時の処理
   */
  protected onPhaseChange(phaseIndex: number): void {
    console.log(`Rumia: フェーズ ${phaseIndex} に変更`);

    // フェーズに応じたスキル設定を適用
    if (phaseIndex === 0) {
      this.currentSkillConfig = CONFIG.PHASE_0_SKILLS as PhaseSkillsConfig;
    } else if (phaseIndex === 1) {
      this.currentSkillConfig = CONFIG.PHASE_1_SKILLS as PhaseSkillsConfig;
    }

    // 前フェーズの予告線をクリア
    this.qSkillWarningLines = [];
    this.qSkillWarningLineCount = 0;
    this.qSkillNextWarningTime = 0;

    // Wスキルの予告線もクリア
    if (this.wSkillWarningGraphics) {
      this.wSkillWarningGraphics.clear();
    }

    this.clearTint();
  }

  /**
   * スキル初期化
   */
  protected initializeSkills(): void {
    // Qスキル
    this.skills.set(BossSkillSlot.Q, {
      slot: BossSkillSlot.Q,
      state: BossSkillState.READY,
      castTimeRemaining: 0,
      executionTimeRemaining: 0,
      cooldownRemaining: 0,
    });

    // Wスキル
    this.skills.set(BossSkillSlot.W, {
      slot: BossSkillSlot.W,
      state: BossSkillState.READY,
      castTimeRemaining: 0,
      executionTimeRemaining: 0,
      cooldownRemaining: 0,
    });

    this.skills.set(BossSkillSlot.E, {
      slot: BossSkillSlot.E,
      state: BossSkillState.READY,
      castTimeRemaining: 0,
      executionTimeRemaining: 0,
      cooldownRemaining: 0,
    });

    // Rスキル（スペルカードフェーズのみ）
    this.skills.set(BossSkillSlot.R, {
      slot: BossSkillSlot.R,
      state: BossSkillState.READY,
      castTimeRemaining: 0,
      executionTimeRemaining: 0,
      cooldownRemaining: 0,
    });
  }

  /**
   * スキルクールダウンを取得
   */
  protected getSkillCooldown(slot: BossSkillSlot): number {
    switch (slot) {
      case BossSkillSlot.Q:
        return this.currentSkillConfig.Q.COOLDOWN;
      case BossSkillSlot.W:
        return this.currentSkillConfig.W.COOLDOWN;
      case BossSkillSlot.E:
        return this.currentSkillConfig.E.COOLDOWN;
      case BossSkillSlot.R:
        return this.currentSkillConfig.R?.COOLDOWN ?? 99999;
      default:
        return 5000;
    }
  }

  /**
   * 全スキルを中断（ブレイク時などに呼ばれる）
   * W スキルの予告線もクリアする
   * Eスキル移動中（EXECUTING状態でINTERRUPTIBLE）もBreak判定
   * Wスキルフィールド展開中（EXECUTING状態でINTERRUPTIBLE、黄色・赤両方）もBreak判定
   */
  protected interruptAllSkills(): void {
    // EスキルがEXECUTING状態で移動中の場合、Break判定を行う
    const eSkill = this.skills.get(BossSkillSlot.E);
    const isESkillInterruptible = eSkill &&
      eSkill.state === BossSkillState.EXECUTING &&
      this.currentSkillConfig.E.INTERRUPTIBLE &&
      (this.eSkillPhase === 'moving' || this.eSkillPhase === 'before_move' || this.eSkillPhase === 'after_move');

    // WスキルがEXECUTING状態でフィールド展開中の場合、Break判定を行う（黄色・赤両方）
    const wSkill = this.skills.get(BossSkillSlot.W);
    const isWSkillInterruptible = wSkill &&
      wSkill.state === BossSkillState.EXECUTING &&
      this.currentSkillConfig.W.INTERRUPTIBLE &&
      this.foxfireFieldActive;

    // 親クラスの処理を呼び出し（CASTING状態のBreak判定含む）
    super.interruptAllSkills();

    // Eスキル移動中の中断はここでBreak演出を追加
    if (isESkillInterruptible) {
      this.showBreakText();
      AudioManager.getInstance().playSe('se_break');
      console.log('Rumia: Eスキル移動中にBreak!');
    }

    // Wスキルフィールド展開中の中断はここでBreak演出を追加（黄色・赤両方）
    if (isWSkillInterruptible) {
      this._wSkillInterrupted = true;
      this.hideFoxfireField();
      this.showBreakText();
      AudioManager.getInstance().playSe('se_break');
      console.log('Rumia: Wスキルフィールド展開中にBreak!');
    }

    // W スキルの予告線をクリア
    this.hideWSkillWarning();
  }

  /**
   * AI更新
   */
  protected updateAI(time: number, delta: number): void {
    if (!this.playerPosition) return;

    // スペルカードフェーズかどうかでAIを切り替え
    const phase = this.getCurrentPhase();
    if (phase?.type === BossPhaseType.SPELL_CARD) {
      this.updateSpellCardAI(time, delta);
    } else {
      this.updateNormalPhaseAI(time, delta);
    }

    // プレイエリア内に位置をクランプ（境界外への移動を防止）
    this.clampToPlayArea();

    // アニメーション状態を更新
    this.updateAnimation();

    // 当たり判定を描画
    this.drawHitbox();
  }

  /**
   * プレイエリア内に位置をクランプ
   */
  private clampToPlayArea(): void {
    const { X, Y, WIDTH, HEIGHT } = GAME_CONFIG.PLAY_AREA;
    const margin = this.stats.hitboxRadius;

    const minX = X + margin;
    const maxX = X + WIDTH - margin;
    const minY = Y + margin;
    const maxY = Y + HEIGHT - margin;

    const clampedX = Phaser.Math.Clamp(this.x, minX, maxX);
    const clampedY = Phaser.Math.Clamp(this.y, minY, maxY);

    if (this.x !== clampedX || this.y !== clampedY) {
      this.setPosition(clampedX, clampedY);
    }
  }

  /**
   * 当たり判定を描画（デバッグ用）
   */
  private drawHitbox(): void {
    if (!this.hitboxGraphics) return;

    this.hitboxGraphics.clear();

    // デバッグフラグがfalseの場合は描画しない
    if (!Rumia.DEBUG_SHOW_HITBOX) return;

    const radius = this.stats.hitboxRadius;

    // 赤い円で当たり判定を表示
    this.hitboxGraphics.lineStyle(2, 0xff0000, 0.8);
    this.hitboxGraphics.fillStyle(0xff0000, 0.3);
    this.hitboxGraphics.fillCircle(this.x, this.y, radius);
    this.hitboxGraphics.strokeCircle(this.x, this.y, radius);
  }

  /**
   * アニメーション状態を更新
   * Eスキル移動フェーズは移動詠唱アニメーション、詠唱中は詠唱アニメーション、
   * 移動中は移動アニメーション、それ以外は待機アニメーション
   */
  private updateAnimation(): void {
    const qSkill = this.skills.get(BossSkillSlot.Q);
    const wSkill = this.skills.get(BossSkillSlot.W);
    const eSkill = this.skills.get(BossSkillSlot.E);
    const rSkill = this.skills.get(BossSkillSlot.R);

    // Rスキル実行中は黒球スプライトを維持するため、アニメーション更新をスキップ
    if (rSkill?.state === BossSkillState.EXECUTING) {
      return;
    }

    // Eスキル移動フェーズかどうか
    const isESkillMoving = eSkill?.state === BossSkillState.EXECUTING && this.eSkillPhase === 'moving';

    // Eスキル配置フェーズ（移動前・移動後）かどうか
    const isESkillPlacing = eSkill?.state === BossSkillState.EXECUTING &&
      (this.eSkillPhase === 'before_move' || this.eSkillPhase === 'after_move');

    // いずれかのスキルが詠唱中かどうか
    const isCasting =
      qSkill?.state === BossSkillState.CASTING ||
      wSkill?.state === BossSkillState.CASTING ||
      eSkill?.state === BossSkillState.CASTING ||
      rSkill?.state === BossSkillState.CASTING ||
      isESkillPlacing; // Eスキル配置フェーズも詠唱扱い

    // 移動中かどうか（速度がある程度あるか）
    const body = this.body as Phaser.Physics.Arcade.Body;
    const isMoving = body && (Math.abs(body.velocity.x) > 10 || Math.abs(body.velocity.y) > 10);

    if (isESkillMoving && this.currentAnimState !== 'move_cast') {
      // Eスキル移動フェーズは移動詠唱アニメーション（最優先）
      this.play('rumia_move_cast');
      this.currentAnimState = 'move_cast';
      // 一度リセットしてから移動方向に合わせて反転
      this.setFlipX(false);
      this.setRotation(0);
      this.updateMoveDirectionByAngle(this.eSkillMoveDirection);
    } else if (isESkillMoving && this.currentAnimState === 'move_cast') {
      // Eスキル移動フェーズは移動方向を強制的に設定（毎フレーム）
      let angleDeg = Phaser.Math.RadToDeg(this.eSkillMoveDirection);
      // 0〜360度を-180〜180度に正規化
      if (angleDeg > 180) angleDeg -= 360;
      // 左向き（90度より大きい or -90度より小さい）の場合のみFlipX=true
      const shouldFlipX = angleDeg > 90 || angleDeg < -90;
      // 強制的に正しい値に設定
      this.setFlipX(shouldFlipX);
    } else if (isCasting && this.currentAnimState !== 'cast') {
      // 詠唱アニメーションに切り替え
      this.play('rumia_cast');
      this.currentAnimState = 'cast';
      // 詠唱中は回転・反転をリセット
      this.setRotation(0);
      this.setFlipX(false);
    } else if (!isCasting && !isESkillMoving && isMoving) {
      // 移動アニメーションに切り替え
      if (this.currentAnimState !== 'move') {
        this.play('rumia_move');
        this.currentAnimState = 'move';
      }
      // 移動方向に合わせて回転・反転
      this.updateMoveDirection(body.velocity.x, body.velocity.y);
    } else if (!isCasting && !isESkillMoving && !isMoving && this.currentAnimState !== 'idle') {
      // 待機アニメーションに切り替え
      this.play('rumia_idle');
      this.currentAnimState = 'idle';
      // 待機中は回転・反転をリセット
      this.setRotation(0);
      this.setFlipX(false);
    }
  }

  /**
   * 移動方向に合わせてスプライトを回転・反転
   */
  private updateMoveDirection(vx: number, vy: number): void {
    const angle = Math.atan2(vy, vx); // ラジアン
    this.updateMoveDirectionByAngle(angle);
  }

  /**
   * 角度に合わせてスプライトを回転・反転
   * 全てのスプライトは右向きがデフォルト
   * 左方向（90度より大きい or -90度より小さい）に移動する場合は反転
   */
  private updateMoveDirectionByAngle(angle: number): void {
    let angleDeg = Phaser.Math.RadToDeg(angle);
    // 0〜360度を-180〜180度に正規化
    if (angleDeg > 180) angleDeg -= 360;

    // 左向き（90度より大きい or -90度より小さい）の場合は反転
    if (angleDeg > 90 || angleDeg < -90) {
      this.setFlipX(true);
    } else {
      this.setFlipX(false);
    }
    // 回転は使用しない（0にリセット）
    this.setRotation(0);
  }

  /**
   * ノーマルフェーズのAI
   */
  private updateNormalPhaseAI(time: number, delta: number): void {
    // 硬直時間を更新
    if (this.skillRecoveryTime > 0) {
      this.skillRecoveryTime -= delta;
    }

    // スキル状態を確認
    const qSkill = this.skills.get(BossSkillSlot.Q);
    const wSkill = this.skills.get(BossSkillSlot.W);
    const eSkill = this.skills.get(BossSkillSlot.E);
    if (!qSkill || !wSkill || !eSkill) return;

    // 硬直中はスキルを使用しない
    const isInRecovery = this.skillRecoveryTime > 0;

    // Eスキル実行中かどうか（Eスキル中は他のスキルを使用できない）
    const isESkillActive =
      eSkill.state === BossSkillState.CASTING ||
      eSkill.state === BossSkillState.EXECUTING;

    // 現在スキル実行中かどうか
    const isSkillActive =
      qSkill.state === BossSkillState.CASTING ||
      qSkill.state === BossSkillState.EXECUTING ||
      wSkill.state === BossSkillState.CASTING ||
      wSkill.state === BossSkillState.EXECUTING ||
      isESkillActive;

    // Wスキルの処理（Qより優先度高め）
    switch (wSkill.state) {
      case BossSkillState.READY:
        // Eスキル中または硬直中は使用しない
        if (!isESkillActive && !isInRecovery &&
            qSkill.state !== BossSkillState.CASTING && qSkill.state !== BossSkillState.EXECUTING) {
          this.tryUseWSkill();
        }
        break;

      case BossSkillState.CASTING:
        this.updateWSkillCasting(delta);
        break;

      case BossSkillState.EXECUTING:
        this.updateWSkillExecution(delta);
        break;
    }

    // Qスキルの処理
    switch (qSkill.state) {
      case BossSkillState.READY:
        // Eスキル中または硬直中は使用しない
        if (!isESkillActive && !isInRecovery &&
            wSkill.state !== BossSkillState.CASTING && wSkill.state !== BossSkillState.EXECUTING) {
          this.tryUseQSkill();
        }
        break;

      case BossSkillState.CASTING:
        this.updateQSkillCasting(delta);
        break;

      case BossSkillState.EXECUTING:
        this.updateQSkillExecution(time, delta);
        break;
    }

    // Eスキルの処理（他のスキルが使用中でなければ使用）
    switch (eSkill.state) {
      case BossSkillState.READY:
        // 硬直中は使用しない
        if (!isSkillActive && !isInRecovery) {
          this.tryUseESkill();
        }
        break;

      case BossSkillState.CASTING:
        this.updateESkillCasting(delta);
        break;

      case BossSkillState.EXECUTING:
        this.updateESkillExecution(time, delta);
        break;
    }

    // 移動AI（スキル使用中は移動しない）
    if (!isSkillActive) {
      this.updateMovement();
    } else {
      this.setVelocity(0, 0);
    }
  }

  /**
   * スペルカードフェーズのAI
   * スペルカードごとに異なるAIを呼び出す
   */
  private updateSpellCardAI(time: number, delta: number): void {
    const phase = this.getCurrentPhase();
    if (!phase) return;

    // スペルカード名に応じてAIを切り替え
    switch (phase.name) {
      case '闇符「ダークサイドオブザムーン」':
        this.updateDarkSideOfTheMoonAI(time, delta);
        break;
      default:
        // デフォルトのスペルカードAI
        this.updateDefaultSpellCardAI(time, delta);
        break;
    }
  }

  /**
   * 闘符「ダークサイドオブザムーン」専用AI
   * RスキルとQスキル（フォレストフォックス）を使用
   */
  private updateDarkSideOfTheMoonAI(time: number, delta: number): void {
    const rSkill = this.skills.get(BossSkillSlot.R);
    const qSkill = this.skills.get(BossSkillSlot.Q);
    const wSkill = this.skills.get(BossSkillSlot.W);
    if (!rSkill) return;

    // Phase1スキル硬直時間を更新
    if (this.phase1SkillRecoveryTime > 0) {
      this.phase1SkillRecoveryTime -= delta;
    }

    // 硬直中フラグを取得する関数（スキル完了後に再評価するため）
    const isInRecovery = () => this.phase1SkillRecoveryTime > 0;

    // スキル実行中フラグを取得する関数（スキル開始後に再評価するため）
    const isRSkillActive = () =>
      rSkill.state === BossSkillState.CASTING ||
      rSkill.state === BossSkillState.EXECUTING;

    const isQSkillActive = () => qSkill && (
      qSkill.state === BossSkillState.CASTING ||
      qSkill.state === BossSkillState.EXECUTING
    );

    const isWSkillActive = () => wSkill && (
      wSkill.state === BossSkillState.CASTING ||
      wSkill.state === BossSkillState.EXECUTING
    );

    const isESkillActive = () => {
      const eSkill = this.skills.get(BossSkillSlot.E);
      return eSkill && (
        eSkill.state === BossSkillState.CASTING ||
        eSkill.state === BossSkillState.EXECUTING
      );
    };

    // Rスキルの処理（最優先）
    switch (rSkill.state) {
      case BossSkillState.READY:
        // Qスキル・Wスキルが実行中でなく、硬直中でなければRスキルを使用
        if (!isQSkillActive() && !isWSkillActive() && !isInRecovery()) {
          this.tryUseRSkill();
        }
        break;

      case BossSkillState.CASTING:
        this.updateRSkillCasting(delta);
        break;

      case BossSkillState.EXECUTING:
        this.updateRSkillExecution(time, delta);
        break;

      case BossSkillState.COOLDOWN:
        // クールダウン中は何もしない（Boss.tsで自動的にREADYに戻る）
        break;
    }

    // Qスキル（オーブオブディセプション）の処理（Rスキルが実行中でなければ）
    if (qSkill && !isRSkillActive()) {
      const qConfig = this.currentSkillConfig.Q;
      // ENABLEDフラグがtrueの場合のみ処理
      if (qConfig.ENABLED) {
        switch (qSkill.state) {
          case BossSkillState.READY:
            // 硬直中でなければ発動
            if (!isInRecovery()) {
              this.tryUseForestFoxSkill();
            }
            break;

          case BossSkillState.CASTING:
            this.updateForestFoxCasting(delta);
            break;

          case BossSkillState.EXECUTING:
            this.updateForestFoxExecution(time, delta);
            break;
        }
      }
    }

    // Wスキル（アレンジドフォックスファイア）の処理
    if (wSkill) {
      const wConfig = this.currentSkillConfig.W;
      // ENABLEDフラグがtrueの場合のみ処理
      if (wConfig.ENABLED) {
        switch (wSkill.state) {
          case BossSkillState.READY:
            // 新規発動はR/Qスキルが実行中でなく、硬直中でなければ
            if (!isRSkillActive() && !isQSkillActive() && !isInRecovery()) {
              this.tryUseArrangedFoxfireSkill();
            }
            break;

          case BossSkillState.CASTING:
            // 詠唱更新（Rスキル実行中は中断される可能性あり）
            if (!isRSkillActive()) {
              this.updateArrangedFoxfireCasting(delta);
            }
            break;

          case BossSkillState.EXECUTING:
            // 実行更新（フィールド追従のため常に更新）
            this.updateArrangedFoxfireExecution(time, delta);
            break;
        }
      }
    }

    // 追尾弾の更新（スキル状態に関係なく常に更新）
    this.updateFoxfireHomingBullets(delta);

    // MSバフの減衰処理（スキル状態に関係なく常に更新）
    this.updateFoxfireMsBuff(delta);

    // Eスキル（カーチスクロス）の処理
    const eSkill = this.skills.get(BossSkillSlot.E);

    if (eSkill) {
      const eConfig = this.currentSkillConfig.E;
      // ENABLEDフラグがtrueの場合のみ処理
      if (eConfig.ENABLED) {
        switch (eSkill.state) {
          case BossSkillState.READY:
            // 新規発動はR/Q/Wスキルが実行中でなく、硬直中でなければ
            if (!isRSkillActive() && !isQSkillActive() && !isWSkillActive() && !isInRecovery()) {
              this.tryUseCurtisCrossSkill();
            }
            break;

          case BossSkillState.CASTING:
            // 詠唱更新
            if (!isRSkillActive()) {
              this.updateCurtisCrossCasting(delta);
            }
            break;

          case BossSkillState.EXECUTING:
            // 実行更新
            this.updateCurtisCrossExecution(time, delta);
            break;
        }
      }
    }

    // 移動AI（Rスキル・Qスキル・Eスキル実行中以外はプレイヤーに近づく）
    if (!isRSkillActive() && !isQSkillActive() && !isESkillActive()) {
      this.updateApproachPlayerMovement();
    }
  }

  /**
   * デフォルトのスペルカードAI（将来の他スペルカード用）
   */
  private updateDefaultSpellCardAI(time: number, delta: number): void {
    const qSkill = this.skills.get(BossSkillSlot.Q);
    const rSkill = this.skills.get(BossSkillSlot.R);
    if (!qSkill || !rSkill) return;

    const isRSkillActive =
      rSkill.state === BossSkillState.CASTING ||
      rSkill.state === BossSkillState.EXECUTING;

    const isQSkillActive =
      qSkill.state === BossSkillState.CASTING ||
      qSkill.state === BossSkillState.EXECUTING;

    // Rスキルの処理
    switch (rSkill.state) {
      case BossSkillState.READY:
        if (!isQSkillActive) {
          this.tryUseRSkill();
        }
        break;

      case BossSkillState.CASTING:
        this.updateRSkillCasting(delta);
        break;

      case BossSkillState.EXECUTING:
        this.updateRSkillExecution(time, delta);
        break;
    }

    // Qスキルの処理
    switch (qSkill.state) {
      case BossSkillState.READY:
        if (!isRSkillActive) {
          this.tryUseSpellCardQSkill();
        }
        break;

      case BossSkillState.CASTING:
        this.updateSpellCardQSkillCasting(delta);
        break;

      case BossSkillState.EXECUTING:
        this.updateSpellCardQSkillExecution(time, delta);
        break;
    }

    // 通常の移動AI（プレイヤーを追跡しない）
    if (!isRSkillActive && !isQSkillActive) {
      this.updateMovement();
    } else if (!isRSkillActive) {
      this.setVelocity(0, 0);
    }
  }

  /**
   * プレイヤーに近づく移動AI（闇符「ダークサイドオブザムーン」専用）
   */
  private updateApproachPlayerMovement(): void {
    if (!this.playerPosition) {
      this.setVelocity(0, 0);
      return;
    }

    const { X, Y, WIDTH, HEIGHT } = GAME_CONFIG.PLAY_AREA;
    const speed = this.getEffectiveMoveSpeed();

    // プレイヤー方向へ移動
    const dx = this.playerPosition.x - this.x;
    const dy = this.playerPosition.y - this.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    let vx = 0;
    let vy = 0;

    // ある程度の距離があれば近づく（近すぎると止まる）
    const minDistance = 100; // 最小距離
    if (distance > minDistance) {
      const dirX = dx / distance;
      const dirY = dy / distance;
      vx = dirX * speed;
      vy = dirY * speed;
    }

    // プレイエリア内に制限
    const margin = this.stats.hitboxRadius;
    const minX = X + margin;
    const maxX = X + WIDTH - margin;
    const minY = Y + margin;
    const maxY = Y + HEIGHT - margin;

    if (this.x <= minX && vx < 0) vx = 0;
    if (this.x >= maxX && vx > 0) vx = 0;
    if (this.y <= minY && vy < 0) vy = 0;
    if (this.y >= maxY && vy > 0) vy = 0;

    this.setVelocity(vx, vy);
  }

  /**
   * Qスキル使用を試みる（通常弾幕1）
   * 7本の予告線が0.1秒間隔で出現し、各予告線から0.5秒後に弾幕発射
   */
  private tryUseQSkill(): void {
    if (!this.playerPosition) return;

    // プレイヤー方向を計算
    const angleToPlayer = Phaser.Math.Angle.Between(
      this.x,
      this.y,
      this.playerPosition.x,
      this.playerPosition.y
    );

    // スキル使用開始
    const castTime = this.currentSkillConfig.Q.CAST_TIME;
    if (this.startSkill(BossSkillSlot.Q, castTime, angleToPlayer)) {
      // 予告線システム初期化
      this.qSkillWarningLines = [];
      this.qSkillNextWarningTime = 0;
      this.qSkillWarningLineCount = 0;
      this._qSkillInterrupted = false;
      console.log(`Rumia: Qスキル詠唱開始 - ${this.currentSkillConfig.Q.NAME}`);
    }
  }

  /**
   * 予告線番号に応じた横方向の弾数を返す
   * 1本目=1列, 2-3本目=2列, 4-6本目=3列, 7本目=4列
   */
  private getQSkillBulletColumns(lineIndex: number): number {
    if (lineIndex === 0) return 1;           // 1本目: 1列
    if (lineIndex <= 2) return 2;            // 2-3本目: 2列
    if (lineIndex <= 5) return 3;            // 4-6本目: 3列
    return 4;                                 // 7本目: 4列
  }

  /**
   * Qスキル詠唱更新（予告線を順次生成）
   */
  private updateQSkillCasting(delta: number): void {
    const qSkill = this.skills.get(BossSkillSlot.Q);
    if (!qSkill) return;

    // CC中断チェック
    if (this.currentSkillConfig.Q.INTERRUPTIBLE && this.hasStatusEffect(StatusEffectType.STUN)) {
      this._qSkillInterrupted = true;
      this.completeSkill(BossSkillSlot.Q, this.currentSkillConfig.Q.COOLDOWN);
      console.log('Rumia: Qスキル中断（CC）');
      return;
    }

    const warningLineCount = this.currentSkillConfig.Q.WARNING_LINE_COUNT ?? 7;
    const warningLineInterval = this.currentSkillConfig.Q.WARNING_LINE_INTERVAL ?? 100;

    // 予告線生成タイマー更新
    this.qSkillNextWarningTime += delta;

    // 新しい予告線を生成
    while (this.qSkillWarningLineCount < warningLineCount &&
           this.qSkillNextWarningTime >= warningLineInterval) {
      // プレイヤー方向に予告線を追加
      if (this.playerPosition) {
        const angleToPlayer = Phaser.Math.Angle.Between(
          this.x, this.y,
          this.playerPosition.x, this.playerPosition.y
        );

        this.qSkillWarningLines.push({
          angle: angleToPlayer,
          createdTime: this.scene.time.now,
          fired: false,
          lineIndex: this.qSkillWarningLineCount,
        });
      }

      this.qSkillWarningLineCount++;
      this.qSkillNextWarningTime -= warningLineInterval;
    }

    // 詠唱時間更新
    qSkill.castTimeRemaining -= delta;
    if (qSkill.castTimeRemaining <= 0) {
      // 詠唱完了 → 実行開始
      qSkill.state = BossSkillState.EXECUTING;
      // 実行時間 = 最後の予告線から弾発射までの遅延 + 弾が飛ぶ時間
      const fireDelay = this.currentSkillConfig.Q.WARNING_TO_FIRE_DELAY ?? 500;
      qSkill.executionTimeRemaining = fireDelay + 2000;
      // 弾幕発射SE（実行開始時に1回だけ再生）
      AudioManager.getInstance().playSe('se_shot1_multi');
      console.log('Rumia: Qスキル実行開始!');
    }
  }

  /**
   * Qスキル実行更新（予告線から弾幕を発射）
   */
  private updateQSkillExecution(_time: number, delta: number): void {
    if (!this.bulletPool) return;

    const qSkill = this.skills.get(BossSkillSlot.Q);
    if (!qSkill) return;

    // CC中断チェック
    if (this.currentSkillConfig.Q.INTERRUPTIBLE && this.hasStatusEffect(StatusEffectType.STUN)) {
      this._qSkillInterrupted = true;
      this.completeSkill(BossSkillSlot.Q, this.currentSkillConfig.Q.COOLDOWN);
      console.log('Rumia: Qスキル中断（CC）');
      return;
    }

    const currentTime = this.scene.time.now;
    const fireDelay = this.currentSkillConfig.Q.WARNING_TO_FIRE_DELAY ?? 500;

    // 各予告線から弾幕を発射
    for (const line of this.qSkillWarningLines) {
      if (line.fired) continue;

      // 発射タイミングチェック
      if (currentTime - line.createdTime >= fireDelay) {
        this.fireQSkillBullets(line.angle, line.lineIndex);
        line.fired = true;
      }
    }

    // 実行時間更新
    qSkill.executionTimeRemaining -= delta;

    // 全予告線から発射完了かつ実行時間終了
    const allFired = this.qSkillWarningLines.every(line => line.fired);
    if (allFired && qSkill.executionTimeRemaining <= 0) {
      this.completeSkill(BossSkillSlot.Q, this.currentSkillConfig.Q.COOLDOWN);
      this.qSkillWarningLines = [];
      console.log('Rumia: Qスキル完了');
    }
  }

  /**
   * Qスキルの弾幕を発射（予告線1本分）
   * 縦10発 × 横N列（予告線番号で変動）
   * 八の字に広がるように角度をつけて発射
   */
  private fireQSkillBullets(angle: number, lineIndex: number): void {
    if (!this.bulletPool) return;

    const config = this.currentSkillConfig.Q;
    const rows = config.BULLET_ROWS ?? 10;
    const cols = this.getQSkillBulletColumns(lineIndex);
    const rowSpacing = config.BULLET_ROW_SPACING ?? 40;
    const colSpacing = config.BULLET_COL_SPACING ?? 30;
    const bulletSpeed = config.BULLET_SPEED ?? 1100; // デフォルト20m/s
    const bulletColor = config.BULLET_COLOR ?? 1;
    const displayScale = config.BULLET_DISPLAY_SCALE ?? 0.12;
    const damage = config.DAMAGE.BASE + this.stats.attackPower * config.DAMAGE.RATIO;

    // 八の字の広がり角度（各列ごとの角度オフセット、度単位）
    const spreadAngleDeg = 3; // 各列が中心から3度ずつ広がる
    const spreadAngleRad = Phaser.Math.DegToRad(spreadAngleDeg);

    // 横方向の単位ベクトル（90度回転）
    const perpX = -Math.sin(angle);
    const perpY = Math.cos(angle);

    // 弾発射
    let acquiredCount = 0;
    let failedCount = 0;
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const bullet = this.bulletPool.acquire();
        if (!bullet) {
          failedCount++;
          continue;
        }
        acquiredCount++;

        // 横方向のオフセット（中央揃え）- 列番号から中央を引いた値
        const colFromCenter = col - (cols - 1) / 2;
        const colOffset = colFromCenter * colSpacing;

        // 八の字の角度オフセット（中央から離れるほど広がる）
        const angleOffset = colFromCenter * spreadAngleRad;
        const bulletAngle = angle + angleOffset;

        // 角度の単位ベクトル（八の字用）
        const dirX = Math.cos(bulletAngle);
        const dirY = Math.sin(bulletAngle);

        // 発射位置（縦方向は進行方向、横方向は垂直方向）
        const startX = this.x + perpX * colOffset;
        const startY = this.y + perpY * colOffset;

        // 目標座標
        const targetX = startX + dirX * 1000;
        const targetY = startY + dirY * 1000;

        // 黒縁中玉を使用
        const kshotFrame = this.getKshotFrameByColor(bulletColor);
        bullet.fire(
          startX,
          startY,
          targetX,
          targetY,
          BulletType.ENEMY_NORMAL,
          damage,
          null,
          false,
          kshotFrame
        );

        // 表示スケール設定
        bullet.setScale(displayScale);

        // 弾速を設定（八の字方向に発射）
        const body = bullet.body as Phaser.Physics.Arcade.Body;
        if (body) {
          // 縦方向の遅延（row番号が大きいほど遅く発射される効果）
          const delayOffset = row * rowSpacing;
          body.setVelocity(
            dirX * bulletSpeed,
            dirY * bulletSpeed
          );
          // 初期位置をずらして縦の列を作る
          bullet.setPosition(
            startX - dirX * delayOffset,
            startY - dirY * delayOffset
          );
        }
      }
    }

  }

  /**
   * 色IDからKSHOT番号を取得
   * 黒縁中玉: 1-8, 輪弾: 9-16, 大玉: 17-24
   */
  private getKshotFrameByColor(colorId: number): number {
    // colorIdはKSHOT定数の値と一致（1-24）
    if (colorId >= 1 && colorId <= 24) {
      return colorId;
    }
    return KSHOT.MEDIUM_BALL.RED; // デフォルトは赤
  }

  /**
   * Wスキル使用を試みる（通常弾幕2 - リング弾幕）
   */
  private tryUseWSkill(): void {
    // スキル使用開始
    if (this.startSkill(BossSkillSlot.W, this.currentSkillConfig.W.CAST_TIME, 0)) {
      const ringCount = this.currentSkillConfig.W.RING_COUNT ?? 3;
      // スキル開始と同時に予告線を表示
      this.showWSkillWarning();
      console.log(`Rumia: Wスキル詠唱開始 - ${this.currentSkillConfig.W.NAME}（リング${ringCount}つ）`);
    }
  }

  /**
   * Wスキル詠唱更新
   */
  private updateWSkillCasting(delta: number): void {
    const wSkill = this.skills.get(BossSkillSlot.W);
    if (!wSkill) return;

    const castComplete = this.updateSkillCasting(BossSkillSlot.W, delta);

    if (castComplete) {
      // 予告線を消去
      this.hideWSkillWarning();
      // 詠唱完了 → リング弾幕を発射
      this.fireWSkillRings();
      // 発射後すぐに完了
      this.completeSkill(BossSkillSlot.W, this.currentSkillConfig.W.COOLDOWN);
      console.log('Rumia: Wスキル発射完了!');
    }
  }

  /**
   * Wスキルの予告線を表示（プレイエリア内に制限）
   */
  private showWSkillWarning(): void {
    if (!this.wSkillWarningGraphics) {
      this.wSkillWarningGraphics = this.scene.add.graphics();
      this.wSkillWarningGraphics.setDepth(DEPTH.EFFECTS);
    }

    const wConfig = this.currentSkillConfig.W;
    const bulletsPerRing = wConfig.BULLETS_PER_RING ?? 20;

    // プレイエリアの境界
    const areaLeft = GAME_CONFIG.PLAY_AREA.X;
    const areaRight = GAME_CONFIG.PLAY_AREA.X + GAME_CONFIG.PLAY_AREA.WIDTH;
    const areaTop = GAME_CONFIG.PLAY_AREA.Y;
    const areaBottom = GAME_CONFIG.PLAY_AREA.Y + GAME_CONFIG.PLAY_AREA.HEIGHT;

    this.wSkillWarningGraphics.clear();
    this.wSkillWarningGraphics.lineStyle(2, 0x00ffff, 0.15); // 水色、薄く（Qと同程度）

    // 各弾の方向に予告線を描画（プレイエリア境界でクリップ）
    for (let i = 0; i < bulletsPerRing; i++) {
      const angle = (i / bulletsPerRing) * Math.PI * 2;
      const dx = Math.cos(angle);
      const dy = Math.sin(angle);

      // プレイエリア境界との交点を計算
      let t = Infinity;

      // 右境界との交点
      if (dx > 0) {
        t = Math.min(t, (areaRight - this.x) / dx);
      }
      // 左境界との交点
      if (dx < 0) {
        t = Math.min(t, (areaLeft - this.x) / dx);
      }
      // 下境界との交点
      if (dy > 0) {
        t = Math.min(t, (areaBottom - this.y) / dy);
      }
      // 上境界との交点
      if (dy < 0) {
        t = Math.min(t, (areaTop - this.y) / dy);
      }

      const endX = this.x + dx * t;
      const endY = this.y + dy * t;

      this.wSkillWarningGraphics.beginPath();
      this.wSkillWarningGraphics.moveTo(this.x, this.y);
      this.wSkillWarningGraphics.lineTo(endX, endY);
      this.wSkillWarningGraphics.strokePath();
    }
  }

  /**
   * Wスキルの予告線を消去
   */
  private hideWSkillWarning(): void {
    if (this.wSkillWarningGraphics) {
      this.wSkillWarningGraphics.clear();
    }
  }

  /**
   * Wスキル実行更新（リング弾幕は発射後すぐ完了するので実質使用しない）
   */
  private updateWSkillExecution(delta: number): void {
    const wSkill = this.skills.get(BossSkillSlot.W);
    if (!wSkill) return;

    wSkill.executionTimeRemaining -= delta;

    // 実行完了
    if (wSkill.executionTimeRemaining <= 0) {
      this.completeSkill(BossSkillSlot.W, this.currentSkillConfig.W.COOLDOWN);
      // Wスキル完了後の硬直時間を設定
      this.skillRecoveryTime = Rumia.SKILL_RECOVERY_DURATION;
      console.log('Rumia: Wスキル完了');
    }
  }

  /**
   * Wスキルのリング弾幕を発射
   * 3つのリングを異なる速度で発射
   */
  private fireWSkillRings(): void {
    if (!this.bulletPool) return;

    const wConfig = this.currentSkillConfig.W;
    const ringCount = wConfig.RING_COUNT ?? 3;
    const bulletsPerRing = wConfig.BULLETS_PER_RING ?? 20;
    const displayScale = wConfig.BULLET_DISPLAY_SCALE ?? 0.06;
    const bulletColor = wConfig.BULLET_COLOR ?? 5; // 水色
    const ringSpeeds = wConfig.RING_SPEEDS ?? [5 * 55, 10 * 55, 15 * 55];
    const damage = wConfig.DAMAGE.BASE + this.stats.attackPower * wConfig.DAMAGE.RATIO;

    // SE再生
    AudioManager.getInstance().playSe('se_shot1');

    // 各リングを発射
    for (let ringIndex = 0; ringIndex < ringCount; ringIndex++) {
      const speed = ringSpeeds[ringIndex] ?? ringSpeeds[0];

      for (let i = 0; i < bulletsPerRing; i++) {
        const bullet = this.bulletPool.acquire();
        if (!bullet) continue;

        // 360度を均等に分割
        const angle = (i / bulletsPerRing) * Math.PI * 2;
        const targetX = this.x + Math.cos(angle) * 1000;
        const targetY = this.y + Math.sin(angle) * 1000;

        // 黒縁中玉（水色）を使用
        const kshotFrame = this.getKshotFrameByColor(bulletColor);
        bullet.fire(
          this.x,
          this.y,
          targetX,
          targetY,
          BulletType.ENEMY_NORMAL,
          damage,
          null,
          false,
          kshotFrame
        );

        // 表示スケール設定
        bullet.setScale(displayScale);

        // 弾速を設定
        const body = bullet.body as Phaser.Physics.Arcade.Body;
        if (body) {
          body.setVelocity(
            Math.cos(angle) * speed,
            Math.sin(angle) * speed
          );
        }
      }
    }

    console.log(`Rumia W: リング弾幕発射 (${ringCount}リング × ${bulletsPerRing}発)`);
  }

  /**
   * Eスキル使用を試みる（通常弾幕3 - 移動弾幕）
   * 移動前（1列、弾速2m/s開始）と移動後（3列、弾速3m/s開始）に弾を出現させる
   */
  private tryUseESkill(): void {
    if (!this.playerPosition) return;

    const castTime = this.currentSkillConfig.E.CAST_TIME;
    console.log(`Rumia: Eスキル開始試行 (CAST_TIME: ${castTime}ms)`);

    // スキル使用開始（詠唱時間あり）
    if (this.startSkill(BossSkillSlot.E, castTime, 0)) {
      const eConfig = this.currentSkillConfig.E;
      const moveDistance = eConfig.MOVE_DISTANCE ?? 275;

      // ランダムな移動方向を決定（プレイエリア内に収まるように調整）
      this.eSkillMoveDirection = this.calculateSafeESkillDirection();
      this.eSkillMoveStartPos = { x: this.x, y: this.y };
      this.eSkillMoveEndPos = {
        x: this.x + Math.cos(this.eSkillMoveDirection) * moveDistance,
        y: this.y + Math.sin(this.eSkillMoveDirection) * moveDistance,
      };
      this.eSkillMoveProgress = 0;
      this.eSkillBulletsSpawned = 0;
      this.eSkillBulletSpawnTimer = 0;
      this._eSkillInterrupted = false;
      this.eSkillPhase = 'before_move';

      // 移動前フェーズの設定（1列、弾速2m/s開始）
      this.eSkillCurrentLines = 1;
      this.eSkillCurrentSpeedBase = 2 * 55; // 2m/s = 110px/s

      // プレイヤー方向を保存（列の角度計算用）
      this.eSkillAngleToPlayer = Phaser.Math.Angle.Between(
        this.x, this.y,
        this.playerPosition.x, this.playerPosition.y
      );

      // 移動前の弾位置を事前計算（ルーミアの現在位置を中心に、1列）
      this.calculateESkillBulletPositions(this.eSkillMoveStartPos);

      // 詠唱アニメーション開始
      this.play('rumia_cast');
      this.currentAnimState = 'cast';

      console.log(`Rumia: Eスキル詠唱開始 - ${this.currentSkillConfig.E.NAME}（移動方向: ${Phaser.Math.RadToDeg(this.eSkillMoveDirection).toFixed(0)}度）`);
    }
  }

  /**
   * Eスキルの弾発生位置を事前計算
   * 指定位置を中心に、プレイヤー方向に垂直な方向で列を配置
   * 列数はeSkillCurrentLinesで指定（移動前1列、移動後3列）
   * 発射角度も事前に固定（全弾同じ方向に飛ぶ）
   */
  private calculateESkillBulletPositions(centerPos: { x: number; y: number }): void {
    const eConfig = this.currentSkillConfig.E;
    const bulletLines = this.eSkillCurrentLines; // 現在のフェーズの列数を使用
    const bulletsPerLine = eConfig.BULLETS_PER_LINE ?? 20;
    const lineSpacing = eConfig.LINE_SPACING ?? 55; // 列の間隔
    const lineWidth = eConfig.LINE_WIDTH ?? 550; // 1列の横幅（10m = 550px）

    // プレイヤー方向に垂直な方向（列の傾き）
    const perpToPlayer = this.eSkillAngleToPlayer + Math.PI / 2;
    // プレイヤー方向（列の配置方向）
    const toPlayer = this.eSkillAngleToPlayer;

    // 弾の発射角度を固定（この時点のプレイヤー方向）
    this.eSkillBulletAngle = this.eSkillAngleToPlayer;

    // 弾と弾の間隔（列方向、プレイヤー垂直方向に沿った間隔）
    const bulletSpacing = lineWidth / (bulletsPerLine - 1);

    // 列ごとの位置配列を初期化
    this.eSkillBulletPositions = [];

    for (let line = 0; line < bulletLines; line++) {
      const linePositions: { x: number; y: number }[] = [];

      // 列のオフセット（プレイヤー方向に配置、中央揃え）
      const toPlayerOffset = (line - (bulletLines - 1) / 2) * lineSpacing;

      for (let i = 0; i < bulletsPerLine; i++) {
        // プレイヤー垂直方向に沿った位置（中心位置が中心）
        const perpOffset = (i - (bulletsPerLine - 1) / 2) * bulletSpacing;

        // 弾の配置位置を計算
        const posX = centerPos.x + Math.cos(perpToPlayer) * perpOffset + Math.cos(toPlayer) * toPlayerOffset;
        const posY = centerPos.y + Math.sin(perpToPlayer) * perpOffset + Math.sin(toPlayer) * toPlayerOffset;

        linePositions.push({ x: posX, y: posY });
      }

      this.eSkillBulletPositions.push(linePositions);
    }
  }

  /**
   * プレイエリア内に収まる安全な移動方向を計算
   */
  private calculateSafeESkillDirection(): number {
    const { X, Y, WIDTH, HEIGHT } = GAME_CONFIG.PLAY_AREA;
    const moveDistance = this.currentSkillConfig.E.MOVE_DISTANCE ?? 137.5;
    const margin = this.stats.hitboxRadius + 20;

    // 最大10回試行
    for (let attempt = 0; attempt < 10; attempt++) {
      const angle = Math.random() * Math.PI * 2;
      const targetX = this.x + Math.cos(angle) * moveDistance;
      const targetY = this.y + Math.sin(angle) * moveDistance;

      // プレイエリア内に収まるか確認
      if (targetX >= X + margin && targetX <= X + WIDTH - margin &&
          targetY >= Y + margin && targetY <= Y + HEIGHT - margin) {
        return angle;
      }
    }

    // 安全な方向が見つからない場合、中央方向に移動
    const centerX = X + WIDTH / 2;
    const centerY = Y + HEIGHT / 3;
    return Math.atan2(centerY - this.y, centerX - this.x);
  }

  /**
   * Eスキル詠唱更新
   */
  private updateESkillCasting(delta: number): void {
    const eSkill = this.skills.get(BossSkillSlot.E);
    if (!eSkill) return;

    // 詠唱時間を減少
    eSkill.castTimeRemaining -= delta;

    if (eSkill.castTimeRemaining <= 0) {
      // 詠唱完了 → 実行開始
      eSkill.state = BossSkillState.EXECUTING;
      const moveDuration = this.currentSkillConfig.E.MOVE_DURATION ?? 1000;
      // 移動前配置 + 移動 + 移動後配置の時間
      eSkill.executionTimeRemaining = moveDuration + 1000;
      console.log('Rumia: Eスキル詠唱完了、実行開始!');
    }
  }

  /**
   * Eスキル実行更新（移動前配置 → 移動 → 移動後配置）
   */
  private updateESkillExecution(_time: number, delta: number): void {
    const eSkill = this.skills.get(BossSkillSlot.E);
    if (!eSkill) return;

    const eConfig = this.currentSkillConfig.E;
    const moveDuration = eConfig.MOVE_DURATION ?? 1000;
    const bulletSpawnInterval = eConfig.BULLET_SPAWN_INTERVAL ?? 50;
    const bulletsPerLine = eConfig.BULLETS_PER_LINE ?? 20;

    // CC中断チェック（ブレイク）
    if (eConfig.INTERRUPTIBLE && this.hasStatusEffect(StatusEffectType.STUN)) {
      this._eSkillInterrupted = true;
      this.completeSkill(BossSkillSlot.E, eConfig.COOLDOWN);
      // Eスキル中断後も硬直時間を設定
      this.skillRecoveryTime = Rumia.SKILL_RECOVERY_DURATION;
      console.log('Rumia: Eスキル中断（CC - ブレイク）');
      return;
    }

    // 実行時間更新
    eSkill.executionTimeRemaining -= delta;

    // フェーズごとの処理
    switch (this.eSkillPhase) {
      case 'before_move':
        // 移動前の弾配置
        this.eSkillBulletSpawnTimer += delta;
        while (this.eSkillBulletSpawnTimer >= bulletSpawnInterval &&
               this.eSkillBulletsSpawned < bulletsPerLine) {
          this.spawnESkillBullets(this.eSkillBulletsSpawned);
          this.eSkillBulletsSpawned++;
          this.eSkillBulletSpawnTimer -= bulletSpawnInterval;
        }

        // 全弾配置完了 → 移動フェーズへ
        if (this.eSkillBulletsSpawned >= bulletsPerLine) {
          this.eSkillPhase = 'moving';
          this.eSkillMoveProgress = 0;
          // 移動開始時にアニメーションを即座に切り替え
          this.play('rumia_move_cast');
          this.currentAnimState = 'move_cast';
          // FlipXを正しい方向に設定（0〜360度対応）
          let angleDeg = Phaser.Math.RadToDeg(this.eSkillMoveDirection);
          // 0〜360度を-180〜180度に正規化
          if (angleDeg > 180) angleDeg -= 360;
          const shouldFlipX = angleDeg > 90 || angleDeg < -90;
          this.setFlipX(shouldFlipX);
          this.setRotation(0);
          console.log(`Rumia: Eスキル - 移動開始 (角度: ${angleDeg.toFixed(1)}度, FlipX: ${shouldFlipX})`);
        }
        break;

      case 'moving':
        // 移動処理
        this.eSkillMoveProgress += delta / moveDuration;
        this.eSkillMoveProgress = Math.min(this.eSkillMoveProgress, 1);

        // 位置を更新（線形補間）
        const newX = this.eSkillMoveStartPos.x + (this.eSkillMoveEndPos.x - this.eSkillMoveStartPos.x) * this.eSkillMoveProgress;
        const newY = this.eSkillMoveStartPos.y + (this.eSkillMoveEndPos.y - this.eSkillMoveStartPos.y) * this.eSkillMoveProgress;
        this.setPosition(newX, newY);

        // 移動完了 → 移動後配置フェーズへ
        if (this.eSkillMoveProgress >= 1) {
          this.eSkillPhase = 'after_move';
          this.eSkillBulletsSpawned = 0;
          this.eSkillBulletSpawnTimer = 0;

          // 移動後フェーズの設定（3列、弾速3m/s開始）
          this.eSkillCurrentLines = 3;
          this.eSkillCurrentSpeedBase = 3 * 55; // 3m/s = 165px/s

          // 移動後のプレイヤー方向を再計算（現在のプレイヤー位置に向ける）
          if (this.playerPosition) {
            this.eSkillAngleToPlayer = Phaser.Math.Angle.Between(
              this.eSkillMoveEndPos.x, this.eSkillMoveEndPos.y,
              this.playerPosition.x, this.playerPosition.y
            );
          }
          // 移動後の弾位置を計算（移動終了位置を中心に、3列で）
          this.calculateESkillBulletPositions(this.eSkillMoveEndPos);
          console.log('Rumia: Eスキル - 移動後配置開始（3列）');
        }
        break;

      case 'after_move':
        // 移動後の弾配置
        this.eSkillBulletSpawnTimer += delta;
        while (this.eSkillBulletSpawnTimer >= bulletSpawnInterval &&
               this.eSkillBulletsSpawned < bulletsPerLine) {
          this.spawnESkillBullets(this.eSkillBulletsSpawned);
          this.eSkillBulletsSpawned++;
          this.eSkillBulletSpawnTimer -= bulletSpawnInterval;
        }

        // 全弾配置完了 → スキル終了
        if (this.eSkillBulletsSpawned >= bulletsPerLine) {
          this.completeSkill(BossSkillSlot.E, eConfig.COOLDOWN);
          // Eスキル完了後の硬直時間を設定
          this.skillRecoveryTime = Rumia.SKILL_RECOVERY_DURATION;
          console.log('Rumia: Eスキル完了');
        }
        break;
    }
  }

  /**
   * Eスキルの弾を配置（事前計算した位置から発射）
   * 弾は事前計算した角度に向けて発射（全弾同じ方向）
   * 弾速: サイン曲線で滑らかな山型（移動前2m/s→8m/s→2m/s、移動後3m/s→8m/s→3m/s）
   */
  private spawnESkillBullets(bulletIndex: number): void {
    if (!this.bulletPool) return;
    if (this.eSkillBulletPositions.length === 0) return;

    const eConfig = this.currentSkillConfig.E;
    const bulletColor = eConfig.BULLET_COLOR ?? 12; // 輪弾の緑
    const displayScale = eConfig.BULLET_DISPLAY_SCALE ?? 0.1;
    const speedBase = this.eSkillCurrentSpeedBase; // フェーズごとの基本弾速を使用
    const bulletsPerLine = eConfig.BULLETS_PER_LINE ?? 20;
    const speedMax = 8 * 55; // 最大弾速 8m/s = 440px/s
    const damage = eConfig.DAMAGE.BASE + this.stats.attackPower * eConfig.DAMAGE.RATIO;

    // 弾速計算（サイン曲線で滑らかな弧）
    // 0〜19のインデックスを0〜πにマッピングし、sin()で滑らかな山型を作る
    const t = bulletIndex / (bulletsPerLine - 1); // 0〜1に正規化
    const sinValue = Math.sin(t * Math.PI); // 0→1→0の滑らかな曲線
    const bulletSpeed = speedBase + (speedMax - speedBase) * sinValue;

    // 各列に1発ずつ配置（事前計算した位置を使用）
    for (let line = 0; line < this.eSkillBulletPositions.length; line++) {
      const linePositions = this.eSkillBulletPositions[line];
      if (bulletIndex >= linePositions.length) continue;

      // 事前計算した位置を使用
      const spawnPos = linePositions[bulletIndex];

      // プレイエリア外の弾も発射する（非表示だが、プレイエリアに入ると表示される）
      const bullet = this.bulletPool.acquire();
      if (!bullet) continue;

      // 事前計算した角度を使用（全弾同じ方向に飛ぶ）
      const targetX = spawnPos.x + Math.cos(this.eSkillBulletAngle) * 1000;
      const targetY = spawnPos.y + Math.sin(this.eSkillBulletAngle) * 1000;

      // 輪弾（緑）を使用
      bullet.fire(
        spawnPos.x,
        spawnPos.y,
        targetX,
        targetY,
        BulletType.ENEMY_NORMAL,
        damage,
        null,
        false,
        bulletColor // KSHOT.RINDAN.GREEN = 12
      );

      // 表示スケール設定
      bullet.setScale(displayScale);

      // 弾速を設定（事前計算した角度を使用）
      const body = bullet.body as Phaser.Physics.Arcade.Body;
      if (body) {
        body.setVelocity(
          Math.cos(this.eSkillBulletAngle) * bulletSpeed,
          Math.sin(this.eSkillBulletAngle) * bulletSpeed
        );
      }
    }

    if (bulletIndex === 0) {
      // SE再生（最初の弾配置時のみ）
      AudioManager.getInstance().playSe('se_shot1');
    }
  }

  // ========================================
  // Rスキル「闇符・ダークサイドオブザムーン」
  // ========================================

  /**
   * Rスキル使用を試みる
   */
  private tryUseRSkill(): void {
    const rConfig = this.currentSkillConfig.R;
    if (!rConfig) return;

    if (this.startSkill(BossSkillSlot.R, rConfig.CAST_TIME, 0)) {
      console.log(`Rumia: Rスキル詠唱開始 - ${rConfig.NAME}`);
    }
  }

  /**
   * Rスキル詠唱更新
   */
  private updateRSkillCasting(delta: number): void {
    const rSkill = this.skills.get(BossSkillSlot.R);
    if (!rSkill) return;

    rSkill.castTimeRemaining -= delta;

    // スタン中は詠唱失敗（不発+CD）
    if (this.hasStatusEffect(StatusEffectType.STUN)) {
      const rConfig = this.currentSkillConfig.R;
      if (rConfig) {
        this.completeSkill(BossSkillSlot.R, rConfig.COOLDOWN);
        console.log('Rumia: Rスキル不発（スタン中）');
      }
      return;
    }

    if (rSkill.castTimeRemaining <= 0) {
      // 詠唱完了 → 実行開始
      rSkill.state = BossSkillState.EXECUTING;
      this.initializeRSkillExecution();
      console.log('Rumia: Rスキル発動!');
    }
  }

  /**
   * Rスキル実行初期化
   */
  private initializeRSkillExecution(): void {
    const rConfig = this.currentSkillConfig.R;
    if (!rConfig) return;

    // プレイヤー方向に移動
    if (this.playerPosition) {
      this.rSkillMoveDirection = Phaser.Math.Angle.Between(
        this.x,
        this.y,
        this.playerPosition.x,
        this.playerPosition.y
      );
    } else {
      // プレイヤー位置が不明な場合はランダム
      this.rSkillMoveDirection = Math.random() * Math.PI * 2;
    }

    this.rSkillMoveProgress = 0;
    this.rSkillBulletFireTimer = 0;
    this.rSkillInvincibilityRemaining = rConfig.INVINCIBILITY_DURATION;
    // this.rSkillDirectionChangeTimer = 0;

    // 無敵時間中は黒球スプライトに変更（1m x 1m = 55px x 55px）
    this.anims.stop();
    this.setTexture('coma_rumia_rskill');
    this.clearTint(); // 紫色を解除
    // 画像サイズに応じてスケール調整（元画像が約390pxなので、55px / 390px ≈ 0.14）
    this.setScale(55 / 390);
    console.log('Rumia: 黒球スプライトに変更', this.texture.key);

    // 無敵テキストを表示
    this.showInvincibilityText();
  }

  /**
   * Rスキル実行更新
   */
  private updateRSkillExecution(_time: number, delta: number): void {
    const rSkill = this.skills.get(BossSkillSlot.R);
    const rConfig = this.currentSkillConfig.R;
    if (!rSkill || !rConfig) return;

    // 無敵時間管理
    const wasInvincible = this.rSkillInvincibilityRemaining > 0;
    if (this.rSkillInvincibilityRemaining > 0) {
      this.rSkillInvincibilityRemaining -= delta;
    }

    // 移動処理（プレイヤー追尾）
    const moveSpeed = rConfig.MOVE_SPEED ?? 92; // 1.67m/s

    // プレイヤー方向を常に更新（追尾）
    if (this.playerPosition) {
      this.rSkillMoveDirection = Phaser.Math.Angle.Between(
        this.x, this.y,
        this.playerPosition.x, this.playerPosition.y
      );
    }

    // 移動量を計算
    const moveAmount = moveSpeed * (delta / 1000);
    let newX = this.x + Math.cos(this.rSkillMoveDirection) * moveAmount;
    let newY = this.y + Math.sin(this.rSkillMoveDirection) * moveAmount;

    // エリア境界チェック（境界で停止）
    const { X, Y, WIDTH, HEIGHT } = GAME_CONFIG.PLAY_AREA;
    const margin = 50;
    newX = Math.max(X + margin, Math.min(X + WIDTH - margin, newX));
    newY = Math.max(Y + margin, Math.min(Y + HEIGHT - margin, newY));

    this.setPosition(newX, newY);

    // 無敵テキストの位置を更新
    if (this.rSkillInvincibilityText) {
      this.rSkillInvincibilityText.setPosition(newX, newY - 50);
    }

    // 移動進捗を更新（無敵時間ベース）
    const moveDuration = rConfig.INVINCIBILITY_DURATION;
    this.rSkillMoveProgress += delta / moveDuration;
    this.rSkillMoveProgress = Math.min(this.rSkillMoveProgress, 1);

    // 弾発射タイマー（移動中のみ発射）
    if (this.rSkillMoveProgress < 1) {
      this.rSkillBulletFireTimer += delta;
      if (this.rSkillBulletFireTimer >= rConfig.BULLET_FIRE_INTERVAL) {
        this.fireRSkillBullets();
        this.rSkillBulletFireTimer = 0;
      }
    }

    // 無敵終了時にリング弾を発射
    if (wasInvincible && this.rSkillInvincibilityRemaining <= 0) {
      this.fireRSkillFinishRing();
    }

    // 実行完了判定（無敵時間終了）
    if (this.rSkillMoveProgress >= 1) {
      // 元のスプライトに戻す
      this.restoreNormalSprite();
      this.completeSkill(BossSkillSlot.R, rConfig.COOLDOWN);
      console.log('Rumia: Rスキル完了');
    }
  }

  /**
   * 通常スプライトに戻す
   */
  private restoreNormalSprite(): void {
    // 待機アニメーションに戻す（ノーマル状態と同じスケール: 0.16）
    this.setTexture('coma_rumia_idle', 0);
    this.setScale(0.16);
    this.play('rumia_idle');
    this.clearTint();

    // 無敵テキストを非表示
    this.hideInvincibilityText();
  }

  /**
   * 無敵テキストを表示
   */
  private showInvincibilityText(): void {
    // 既存のテキストがあれば削除
    this.hideInvincibilityText();

    // 「無敵」テキストを作成（キャラの上に表示）
    this.rSkillInvincibilityText = this.scene.add.text(this.x, this.y - 50, '無敵', {
      fontSize: '16px',
      fontFamily: 'SawarabiMincho, sans-serif',
      color: '#ffff00',
      stroke: '#000000',
      strokeThickness: 3,
    });
    this.rSkillInvincibilityText.setOrigin(0.5, 1);
    this.rSkillInvincibilityText.setDepth(DEPTH.UI);
  }

  /**
   * 無敵テキストを非表示
   */
  private hideInvincibilityText(): void {
    if (this.rSkillInvincibilityText) {
      this.rSkillInvincibilityText.destroy();
      this.rSkillInvincibilityText = null;
    }
  }

  /**
   * Rスキルの弾を発射
   * 輪弾RED (ID:9) - ランダム4発 - 半径0.25m
   * 黒縁中玉WHITE (ID:8) - ランダム4発 - 半径0.125m
   * 200ms間隔で呼ばれる（BULLET_FIRE_INTERVALで制御）
   */
  private fireRSkillBullets(): void {
    if (!this.bulletPool) return;
    const rConfig = this.currentSkillConfig.R;
    if (!rConfig) return;

    const damage = rConfig.DAMAGE.BASE + this.stats.attackPower * rConfig.DAMAGE.RATIO;

    // 弾数
    const rindanCount = rConfig.RINDAN_COUNT ?? 4;
    const mediumBallCount = rConfig.MEDIUM_BALL_COUNT ?? 4;

    // 弾速（輪弾は黒縁中玉の2倍）
    const rindanSpeed = rConfig.RINDAN_SPEED ?? rConfig.BULLET_SPEED * 2;
    const mediumBallSpeed = rConfig.BULLET_SPEED;

    // 表示スケール計算
    // 輪弾RED: 半径0.25m = 13.75px → 直径27.5px / 278px ≈ 0.1
    const rindanScale = 0.1;
    // 黒縁中玉WHITE: 半径0.125m = 6.875px → 直径13.75px / 512px ≈ 0.027
    const mediumBallScale = 0.027;

    // 当たり判定半径（スケール前の元画像サイズ基準）
    // スケールを適用すると当たり判定も縮小されるので、スケール前の値で設定
    // 輪弾: 278px * 0.1 = 27.8px表示、当たり判定は表示全体をカバー
    const rindanHitboxRadius = 278 / 2; // 元画像の半径
    // 黒縁中玉: 512px * 0.027 = 13.8px表示、当たり判定は表示全体をカバー
    const mediumBallHitboxRadius = 512 / 2; // 元画像の半径

    // 輪弾RED - ランダム4発を即時発射
    for (let i = 0; i < rindanCount; i++) {
      const bullet = this.bulletPool.acquire();
      if (!bullet) continue;

      const angle = Math.random() * Math.PI * 2;
      const targetX = this.x + Math.cos(angle) * 1000;
      const targetY = this.y + Math.sin(angle) * 1000;

      bullet.fire(this.x, this.y, targetX, targetY, BulletType.ENEMY_NORMAL, damage, null, false, KSHOT.RINDAN.RED);
      bullet.setScale(rindanScale);

      const body = bullet.body as Phaser.Physics.Arcade.Body;
      if (body) {
        // 当たり判定を画像中央に配置（オフセット不要、円の中心が画像中心）
        body.setCircle(rindanHitboxRadius, 0, 0);
        body.setVelocity(Math.cos(angle) * rindanSpeed, Math.sin(angle) * rindanSpeed);
      }
    }

    // 黒縁中玉WHITE - ランダム4発を即時発射
    for (let i = 0; i < mediumBallCount; i++) {
      const bullet = this.bulletPool.acquire();
      if (!bullet) continue;

      const angle = Math.random() * Math.PI * 2;
      const targetX = this.x + Math.cos(angle) * 1000;
      const targetY = this.y + Math.sin(angle) * 1000;

      bullet.fire(this.x, this.y, targetX, targetY, BulletType.ENEMY_NORMAL, damage, null, false, KSHOT.MEDIUM_BALL.WHITE);
      bullet.setScale(mediumBallScale);

      const body = bullet.body as Phaser.Physics.Arcade.Body;
      if (body) {
        // 当たり判定を画像中央に配置
        body.setCircle(mediumBallHitboxRadius, 0, 0);
        body.setVelocity(Math.cos(angle) * mediumBallSpeed, Math.sin(angle) * mediumBallSpeed);
      }
    }
  }

  /**
   * Rスキル終了時のリング弾を発射
   * 20発の黒縁中玉YELLOW (ID:3) - 半径1.0m - 弾速3m/s
   */
  private fireRSkillFinishRing(): void {
    if (!this.bulletPool) return;
    const rConfig = this.currentSkillConfig.R;
    if (!rConfig) return;

    const damage = rConfig.DAMAGE.BASE + this.stats.attackPower * rConfig.DAMAGE.RATIO;
    const bulletCount = rConfig.FINISH_RING_COUNT ?? 20;
    const ringSpeed = rConfig.FINISH_RING_SPEED ?? 165; // 3m/s = 165px/s
    const angleStep = (Math.PI * 2) / bulletCount;

    // 黒縁中玉YELLOW: 半径0.5m = 27.5px → 直径55px / 512px ≈ 0.107（元の半分）
    const finishRingScale = 0.107;
    // 当たり判定半径（スケール前の元画像サイズ基準）
    const finishRingHitboxRadius = 512 / 2; // 元画像の半径

    for (let i = 0; i < bulletCount; i++) {
      const bullet = this.bulletPool.acquire();
      if (!bullet) continue;

      const angle = angleStep * i;
      const targetX = this.x + Math.cos(angle) * 1000;
      const targetY = this.y + Math.sin(angle) * 1000;

      bullet.fire(
        this.x, this.y, targetX, targetY,
        BulletType.ENEMY_NORMAL, damage, null, false,
        KSHOT.MEDIUM_BALL.YELLOW
      );
      bullet.setScale(finishRingScale);

      const body = bullet.body as Phaser.Physics.Arcade.Body;
      if (body) {
        // 当たり判定を画像中央に配置
        body.setCircle(finishRingHitboxRadius, 0, 0);
        body.setVelocity(
          Math.cos(angle) * ringSpeed,
          Math.sin(angle) * ringSpeed
        );
      }
    }

    console.log('Rumia: Rスキル終了リング弾発射');
  }

  // /**
  //  * イージング関数（減速）- 将来用
  //  */
  // private easeOutQuad(t: number): number {
  //   return t * (2 - t);
  // }

  /**
   * Rスキル中の無敵判定
   */
  isInvincible(): boolean {
    return this.rSkillInvincibilityRemaining > 0;
  }

  // ========================================
  // Phase1 Qスキル「フォレストフォックス」
  // ========================================

  /**
   * Qスキル「フォレストフォックス」使用を試みる
   */
  private tryUseForestFoxSkill(): void {
    const qConfig = this.currentSkillConfig.Q;
    if (!qConfig.ENABLED) return;

    if (this.startSkill(BossSkillSlot.Q, qConfig.CAST_TIME, 0)) {
      console.log(`Rumia: Qスキル詠唱開始 - ${qConfig.NAME}`);
    }
  }

  /**
   * Qスキル「フォレストフォックス」詠唱更新
   */
  private updateForestFoxCasting(delta: number): void {
    const qSkill = this.skills.get(BossSkillSlot.Q);
    if (!qSkill) return;

    qSkill.castTimeRemaining -= delta;

    // スタン中は詠唱失敗（不発+CD）
    if (this.hasStatusEffect(StatusEffectType.STUN)) {
      const qConfig = this.currentSkillConfig.Q;
      this.completeSkill(BossSkillSlot.Q, qConfig.COOLDOWN);
      console.log('Rumia: Qスキル不発（スタン中）');
      return;
    }

    if (qSkill.castTimeRemaining <= 0) {
      // 詠唱完了 → 実行開始
      qSkill.state = BossSkillState.EXECUTING;
      this.initializeForestFoxExecution();
      console.log('Rumia: Qスキル発動!');
    }
  }

  /**
   * Qスキル「オーブオブディセプション」実行初期化
   */
  private initializeForestFoxExecution(): void {
    const qConfig = this.currentSkillConfig.Q;
    if (!this.bulletPool || !this.playerPosition) return;

    const bulletCount = qConfig.BULLET_COUNT ?? 9;
    const range = qConfig.BULLET_RANGE ?? 495;
    const radius = qConfig.BULLET_RADIUS ?? 44;
    const speedOutgoing = qConfig.BULLET_SPEED_OUTGOING ?? 825;
    const displayScale = qConfig.BULLET_DISPLAY_SCALE ?? 0.172;
    const bulletColor = qConfig.BULLET_COLOR ?? 7;
    const returnInitial = qConfig.BULLET_SPEED_RETURN_INITIAL ?? 33;
    const damage = qConfig.DAMAGE.BASE + this.stats.attackPower * qConfig.DAMAGE.RATIO;

    // プレイヤー方向を計算
    const centerAngle = Phaser.Math.Angle.Between(
      this.x, this.y,
      this.playerPosition.x, this.playerPosition.y
    );

    // 発射位置を記録
    this.orbStartPos = { x: this.x, y: this.y };

    // 配列をリセット
    this.orbBullets = [];
    this.orbPhases = [];
    this.orbTargetPositions = [];
    this.orbReturnSpeeds = [];

    // kShotフレームを取得
    const kshotFrame = this.getKshotFrameByColor(bulletColor);

    // 弾を円状に360度均等配置
    // 9発の場合: 40度間隔（360/9=40度）
    const angleStep = (Math.PI * 2) / bulletCount;

    for (let i = 0; i < bulletCount; i++) {
      // プレイヤー方向を基準に円状に配置
      const angle = centerAngle + i * angleStep;

      // 各弾のターゲット位置を計算
      const targetPos = {
        x: this.x + Math.cos(angle) * range,
        y: this.y + Math.sin(angle) * range
      };
      this.orbTargetPositions.push(targetPos);
      this.orbPhases.push('outgoing');
      this.orbReturnSpeeds.push(returnInitial);

      // 弾を取得
      const bullet = this.bulletPool.acquire();
      if (!bullet) {
        console.log(`Rumia: Qスキル弾${i + 1}取得失敗`);
        continue;
      }

      bullet.fire(
        this.x, this.y,
        targetPos.x, targetPos.y,
        BulletType.ENEMY_NORMAL, damage, null, false,
        kshotFrame
      );
      bullet.setScale(displayScale);

      // 当たり判定を設定
      const body = bullet.body as Phaser.Physics.Arcade.Body;
      if (body) {
        const hitboxRadius = radius / displayScale;
        body.setCircle(hitboxRadius, 0, 0);
        body.setVelocity(
          Math.cos(angle) * speedOutgoing,
          Math.sin(angle) * speedOutgoing
        );
      }

      // 弾がプレイエリア外でも消えないようにフラグを設定（戻り弾用）
      bullet.setPersistOutsidePlayArea(true);

      this.orbBullets.push(bullet);
    }

    // 弾が1発も取得できなかった場合はスキル終了
    if (this.orbBullets.length === 0) {
      console.log('Rumia: Qスキル弾全て取得失敗');
      const qSkill = this.skills.get(BossSkillSlot.Q);
      if (qSkill) {
        this.completeSkill(BossSkillSlot.Q, qConfig.COOLDOWN);
        this.phase1SkillRecoveryTime = Rumia.PHASE1_SKILL_RECOVERY_DURATION;
      }
      return;
    }

    // SE再生
    AudioManager.getInstance().playSe('se_shot1');
    console.log(`Rumia: Qスキル発射完了（${this.orbBullets.length}発）`);
  }

  /**
   * Qスキル「オーブオブディセプション」実行更新
   */
  private updateForestFoxExecution(_time: number, delta: number): void {
    const qSkill = this.skills.get(BossSkillSlot.Q);
    const qConfig = this.currentSkillConfig.Q;

    // 弾がなくなった（すべて消滅した）場合はスキル終了
    if (!qSkill || this.orbBullets.length === 0) {
      if (qSkill) {
        this.completeSkill(BossSkillSlot.Q, qConfig.COOLDOWN);
        this.phase1SkillRecoveryTime = Rumia.PHASE1_SKILL_RECOVERY_DURATION;
        console.log('Rumia: Qスキル終了（全弾消滅）');
      }
      return;
    }

    const range = qConfig.BULLET_RANGE ?? 495;
    const returnInitial = qConfig.BULLET_SPEED_RETURN_INITIAL ?? 33;
    const returnAccel = qConfig.BULLET_SPEED_RETURN_ACCEL ?? 1045;
    const returnMax = qConfig.BULLET_SPEED_RETURN_MAX ?? 1430;

    // 画面外判定用
    const { X, Y, WIDTH, HEIGHT } = GAME_CONFIG.PLAY_AREA;
    const margin = 50;

    // 回収済みの弾を追跡
    const bulletsToRemove: number[] = [];

    // 各弾を更新
    for (let i = 0; i < this.orbBullets.length; i++) {
      const bullet = this.orbBullets[i];
      const body = bullet.body as Phaser.Physics.Arcade.Body;

      // 弾が非アクティブになった場合は削除対象に追加
      if (!bullet.active || !body) {
        bulletsToRemove.push(i);
        continue;
      }

      if (this.orbPhases[i] === 'outgoing') {
        // 行きフェーズ: 最大射程に到達したか、または画面外に出たか確認
        const dx = bullet.x - this.orbStartPos.x;
        const dy = bullet.y - this.orbStartPos.y;
        const distanceTraveled = Math.sqrt(dx * dx + dy * dy);

        const isOutOfBounds =
          bullet.x < X - margin ||
          bullet.x > X + WIDTH + margin ||
          bullet.y < Y - margin ||
          bullet.y > Y + HEIGHT + margin;

        if (distanceTraveled >= range || isOutOfBounds) {
          // 最大射程到達 or 画面外 → 帰りフェーズへ
          this.orbPhases[i] = 'returning';
          this.orbReturnSpeeds[i] = returnInitial;
        }
      }

      if (this.orbPhases[i] === 'returning') {
        // 帰りフェーズ: ルーミアを追尾しながら戻る

        // 加速度で速度を増加
        this.orbReturnSpeeds[i] += returnAccel * (delta / 1000);
        if (this.orbReturnSpeeds[i] > returnMax) {
          this.orbReturnSpeeds[i] = returnMax;
        }

        // ルーミアの現在位置への方向を計算
        const angleToRumia = Phaser.Math.Angle.Between(
          bullet.x, bullet.y,
          this.x, this.y
        );

        // 速度を設定
        body.setVelocity(
          Math.cos(angleToRumia) * this.orbReturnSpeeds[i],
          Math.sin(angleToRumia) * this.orbReturnSpeeds[i]
        );

        // ルーミアに到達したか確認
        const dxToRumia = this.x - bullet.x;
        const dyToRumia = this.y - bullet.y;
        const distanceToRumia = Math.sqrt(dxToRumia * dxToRumia + dyToRumia * dyToRumia);

        // ルーミアに接触したら弾を消去
        if (distanceToRumia < 30) {
          bullet.setActive(false);
          bullet.setVisible(false);
          body.setVelocity(0, 0);
          bullet.setPosition(-1000, -1000);
          bulletsToRemove.push(i);
        }
      }
    }

    // 回収済みの弾を配列から削除（逆順で削除）
    for (let i = bulletsToRemove.length - 1; i >= 0; i--) {
      const idx = bulletsToRemove[i];
      this.orbBullets.splice(idx, 1);
      this.orbPhases.splice(idx, 1);
      this.orbTargetPositions.splice(idx, 1);
      this.orbReturnSpeeds.splice(idx, 1);
    }

    // すべての弾が回収されたらスキル終了
    if (this.orbBullets.length === 0) {
      this.completeSkill(BossSkillSlot.Q, qConfig.COOLDOWN);
      console.log('Rumia: Qスキル完了（全弾回収）');
    }
  }

  // ========================================
  // スペルカード用Qスキル（12方向弾）
  // ========================================

  /**
   * スペルカード用Qスキル使用を試みる
   */
  private tryUseSpellCardQSkill(): void {
    const qConfig = this.currentSkillConfig.Q;

    if (this.startSkill(BossSkillSlot.Q, qConfig.CAST_TIME, 0)) {
      console.log(`Rumia: スペルカードQスキル詠唱開始 - ${qConfig.NAME}`);
    }
  }

  /**
   * スペルカード用Qスキル詠唱更新
   */
  private updateSpellCardQSkillCasting(delta: number): void {
    const qSkill = this.skills.get(BossSkillSlot.Q);
    if (!qSkill) return;

    qSkill.castTimeRemaining -= delta;

    if (qSkill.castTimeRemaining <= 0) {
      // 詠唱完了 → 発射
      qSkill.state = BossSkillState.EXECUTING;
      qSkill.executionTimeRemaining = 100; // 短い実行時間
      this.fireSpellCardQSkillBullets();
      console.log('Rumia: スペルカードQスキル発射!');
    }
  }

  /**
   * スペルカード用Qスキル実行更新
   */
  private updateSpellCardQSkillExecution(_time: number, delta: number): void {
    const qSkill = this.skills.get(BossSkillSlot.Q);
    if (!qSkill) return;

    qSkill.executionTimeRemaining -= delta;

    if (qSkill.executionTimeRemaining <= 0) {
      this.completeSkill(BossSkillSlot.Q, this.currentSkillConfig.Q.COOLDOWN);
      console.log('Rumia: スペルカードQスキル完了');
    }
  }

  /**
   * スペルカード用Qスキルの弾発射（12方向同時）
   * kShotのPURPLE大丸弾を使用
   */
  private fireSpellCardQSkillBullets(): void {
    if (!this.bulletPool) return;

    const qConfig = this.currentSkillConfig.Q;
    const wayCount = qConfig.WAY_COUNT ?? 12;
    const damage = qConfig.DAMAGE.BASE + this.stats.attackPower * qConfig.DAMAGE.RATIO;

    for (let i = 0; i < wayCount; i++) {
      const bullet = this.bulletPool.acquire();
      if (!bullet) continue;

      // 360度を12分割
      const angle = (i / wayCount) * Math.PI * 2;
      const targetX = this.x + Math.cos(angle) * 1000;
      const targetY = this.y + Math.sin(angle) * 1000;

      // kShotのPURPLE大丸弾を使用
      bullet.fire(
        this.x,
        this.y,
        targetX,
        targetY,
        BulletType.ENEMY_NORMAL,
        damage,
        null,
        false,
        KSHOT.MEDIUM_BALL.MAGENTA
      );

      // 弾速を設定
      const bulletSpeed = qConfig.BULLET_SPEED ?? 550; // デフォルト10m/s
      const body = bullet.body as Phaser.Physics.Arcade.Body;
      if (body) {
        body.setVelocity(
          Math.cos(angle) * bulletSpeed,
          Math.sin(angle) * bulletSpeed
        );
      }
    }

    console.log(`Rumia Q(Spell): ${wayCount}方向弾発射`);
  }

  // ========================================
  // スペルカード用Eスキル「闇の潮汐」（将来用・コメントアウト）
  // ========================================
  /*
  private tryUseSpellCardESkill(): void {
    const eConfig = this.currentSkillConfig.E;
    if (this.startSkill(BossSkillSlot.E, eConfig.CAST_TIME, 0)) {
      console.log(`Rumia: スペルカードEスキル詠唱開始 - ${eConfig.NAME}`);
    }
  }

  private updateSpellCardESkillCasting(delta: number): void {
    const eSkill = this.skills.get(BossSkillSlot.E);
    if (!eSkill) return;
    eSkill.castTimeRemaining -= delta;
    if (eSkill.castTimeRemaining <= 0) {
      eSkill.state = BossSkillState.EXECUTING;
      const spiralDuration = this.currentSkillConfig.E.SPIRAL_DURATION ?? 2000;
      eSkill.executionTimeRemaining = spiralDuration;
      this.spellESkillStartTime = this.scene.time.now;
      this.spellESkillBulletTimer = 0;
      this.spellESkillBaseAngle = Math.random() * Math.PI * 2;
      console.log('Rumia: スペルカードEスキル発動!');
    }
  }

  private updateSpellCardESkillExecution(time: number, delta: number): void {
    const eSkill = this.skills.get(BossSkillSlot.E);
    if (!eSkill) return;
    const eConfig = this.currentSkillConfig.E;
    const bulletInterval = eConfig.BULLET_FIRE_INTERVAL ?? 150;
    this.spellESkillBulletTimer += delta;
    if (this.spellESkillBulletTimer >= bulletInterval) {
      this.fireSpellCardESkillBullets(time);
      this.spellESkillBulletTimer = 0;
    }
    eSkill.executionTimeRemaining -= delta;
    if (eSkill.executionTimeRemaining <= 0) {
      this.completeSkill(BossSkillSlot.E, eConfig.COOLDOWN);
      console.log('Rumia: スペルカードEスキル完了');
    }
  }

  private fireSpellCardESkillBullets(time: number): void {
    if (!this.bulletPool) return;
    const eConfig = this.currentSkillConfig.E;
    const spiralArms = eConfig.SPIRAL_ARMS ?? 8;
    const bulletSpeed = eConfig.BULLET_SPEED ?? 165;
    const rotationSpeed = eConfig.ROTATION_SPEED ?? 1.5;
    const damage = eConfig.DAMAGE.BASE + this.stats.attackPower * eConfig.DAMAGE.RATIO;
    const elapsed = time - this.spellESkillStartTime;
    const elapsedSec = elapsed / 1000;
    const rotationAngle = this.spellESkillBaseAngle + (rotationSpeed * elapsedSec);
    for (let i = 0; i < spiralArms; i++) {
      const bullet = this.bulletPool.acquire();
      if (!bullet) continue;
      const angle = (i / spiralArms) * Math.PI * 2 + rotationAngle;
      const targetX = this.x + Math.cos(angle) * 1000;
      const targetY = this.y + Math.sin(angle) * 1000;
      bullet.fire(this.x, this.y, targetX, targetY, BulletType.ENEMY_NORMAL, damage, null, false, KSHOT.MEDIUM_BALL.MAGENTA);
      const body = bullet.body as Phaser.Physics.Arcade.Body;
      if (body) {
        body.setVelocity(Math.cos(angle) * bulletSpeed, Math.sin(angle) * bulletSpeed);
      }
    }
  }
  */

  // ========================================
  // スペルカード用Wスキル「トリプルバースト」（将来用・コメントアウト）
  // ========================================
  /*
  private tryUseSpellCardWSkill(): void {
    const wConfig = this.currentSkillConfig.W;
    if (!wConfig.BURST_COUNT) return;
    if (this.startSkill(BossSkillSlot.W, wConfig.CAST_TIME, 0)) {
      console.log(`Rumia: スペルカードWスキル詠唱開始 - ${wConfig.NAME}`);
    }
  }

  private updateSpellCardWSkillCasting(delta: number): void {
    const wSkill = this.skills.get(BossSkillSlot.W);
    if (!wSkill) return;
    wSkill.castTimeRemaining -= delta;
    if (wSkill.castTimeRemaining <= 0) {
      wSkill.state = BossSkillState.EXECUTING;
      const burstCount = this.currentSkillConfig.W.BURST_COUNT ?? 3;
      const burstInterval = this.currentSkillConfig.W.BURST_INTERVAL ?? 300;
      wSkill.executionTimeRemaining = burstCount * burstInterval + 100;
      this.spellWSkillBurstsFired = 0;
      this.spellWSkillBurstTimer = burstInterval;
      console.log('Rumia: スペルカードWスキル発動!');
    }
  }

  private updateSpellCardWSkillExecution(_time: number, delta: number): void {
    const wSkill = this.skills.get(BossSkillSlot.W);
    if (!wSkill) return;
    const wConfig = this.currentSkillConfig.W;
    const burstCount = wConfig.BURST_COUNT ?? 3;
    const burstInterval = wConfig.BURST_INTERVAL ?? 300;
    this.spellWSkillBurstTimer += delta;
    if (this.spellWSkillBurstsFired < burstCount && this.spellWSkillBurstTimer >= burstInterval) {
      this.fireSpellCardWSkillBurst();
      this.spellWSkillBurstsFired++;
      this.spellWSkillBurstTimer = 0;
    }
    wSkill.executionTimeRemaining -= delta;
    if (wSkill.executionTimeRemaining <= 0) {
      this.completeSkill(BossSkillSlot.W, wConfig.COOLDOWN);
      console.log('Rumia: スペルカードWスキル完了');
    }
  }

  private fireSpellCardWSkillBurst(): void {
    if (!this.bulletPool) return;
    const qConfig = this.currentSkillConfig.Q;
    const wConfig = this.currentSkillConfig.W;
    const wayCount = qConfig.WAY_COUNT ?? 12;
    const damage = wConfig.DAMAGE.BASE + this.stats.attackPower * wConfig.DAMAGE.RATIO;
    const bulletSpeed = wConfig.BULLET_SPEED ?? qConfig.BULLET_SPEED ?? 550;
    for (let i = 0; i < wayCount; i++) {
      const bullet = this.bulletPool.acquire();
      if (!bullet) continue;
      const angle = (i / wayCount) * Math.PI * 2;
      const targetX = this.x + Math.cos(angle) * 1000;
      const targetY = this.y + Math.sin(angle) * 1000;
      bullet.fire(this.x, this.y, targetX, targetY, BulletType.ENEMY_NORMAL, damage, null, false, KSHOT.MEDIUM_BALL.MAGENTA);
      const body = bullet.body as Phaser.Physics.Arcade.Body;
      if (body) {
        body.setVelocity(Math.cos(angle) * bulletSpeed, Math.sin(angle) * bulletSpeed);
      }
    }
    console.log(`Rumia W(Spell): バースト${this.spellWSkillBurstsFired + 1}発射 (弾速: ${bulletSpeed})`);
  }
  */

  // ========================================
  // Phase1 Wスキル「アレンジドフォックスファイア」
  // ========================================

  /**
   * アレンジドフォックスファイアを使用
   */
  private tryUseArrangedFoxfireSkill(): void {
    const wConfig = this.currentSkillConfig.W;
    if (!wConfig.ENABLED) return;

    if (this.startSkill(BossSkillSlot.W, wConfig.CAST_TIME, 0)) {
      console.log(`Rumia: アレンジドフォックスファイア詠唱開始`);
    }
  }

  /**
   * アレンジドフォックスファイア詠唱更新（初期詠唱0.1秒）
   */
  private updateArrangedFoxfireCasting(delta: number): void {
    const wSkill = this.skills.get(BossSkillSlot.W);
    if (!wSkill) return;

    wSkill.castTimeRemaining -= delta;

    if (wSkill.castTimeRemaining <= 0) {
      // 初期詠唱完了 → 実行状態へ（黄色フェーズ開始）
      wSkill.state = BossSkillState.EXECUTING;
      const wConfig = this.currentSkillConfig.W;
      const totalDuration = wConfig.FIELD_TOTAL_DURATION ?? 2000;
      wSkill.executionTimeRemaining = totalDuration;

      // フィールド展開開始（黄色フェーズ）
      this.foxfireFieldActive = true;
      this.foxfireFieldTimer = 0;
      this.foxfireFieldPhase = 'yellow';
      this._wSkillInterrupted = false;
      this.showFoxfireField();

      // MSバフを適用（+40%、2秒間）
      const msBuffAmount = wConfig.MS_BUFF_AMOUNT ?? 0.40;
      const msBuffDuration = wConfig.MS_BUFF_DURATION ?? 2000;
      this.foxfireMsBuffAmount = msBuffAmount;
      this.foxfireMsBuffRemainingTime = msBuffDuration;
      this.moveSpeedBuffMultiplier = 1 + this.foxfireMsBuffAmount;
      console.log(`Rumia: アレンジドフォックスファイア発動! (MS +${Math.round(msBuffAmount * 100)}% / ${msBuffDuration / 1000}秒)`);
    }
  }

  /**
   * フォックスファイアフィールドを表示
   */
  private showFoxfireField(): void {
    if (!this.foxfireFieldGraphics) {
      this.foxfireFieldGraphics = this.scene.add.graphics();
      this.foxfireFieldGraphics.setDepth(DEPTH.EFFECTS - 1);
    }
    this.updateFoxfireFieldGraphics();
  }

  /**
   * フォックスファイアフィールドのグラフィックを更新
   */
  private updateFoxfireFieldGraphics(): void {
    if (!this.foxfireFieldGraphics) return;

    const wConfig = this.currentSkillConfig.W;
    const radius = wConfig.FIELD_RADIUS ?? 247.5;

    this.foxfireFieldGraphics.clear();

    // フェーズに応じて色を変更
    let strokeColor: number;
    let fillColor: number;
    if (this.foxfireFieldPhase === 'yellow') {
      // 黄色フェーズ（0.6秒間、キャスト扱い）
      strokeColor = 0xffcc00;
      fillColor = 0xffcc00;
    } else {
      // 赤フェーズ（残り時間、プレイヤーが入ったら発射）
      strokeColor = 0xff3300;
      fillColor = 0xff3300;
    }

    // 外円（半透明）
    this.foxfireFieldGraphics.lineStyle(3, strokeColor, 0.8);
    this.foxfireFieldGraphics.strokeCircle(this.x, this.y, radius);

    // 内部（非常に薄い）
    this.foxfireFieldGraphics.fillStyle(fillColor, 0.15);
    this.foxfireFieldGraphics.fillCircle(this.x, this.y, radius);
  }

  /**
   * フォックスファイアフィールドを非表示
   */
  private hideFoxfireField(): void {
    if (this.foxfireFieldGraphics) {
      this.foxfireFieldGraphics.clear();
    }
    this.foxfireFieldActive = false;
    this.foxfireFieldPhase = 'none';
  }

  /**
   * アレンジドフォックスファイア実行更新
   * 新仕様:
   * - 黄色フェーズ（0.6秒）: キャスト扱い、CCでBreak可能
   * - 赤フェーズ（残り1.4秒）: キャスト扱い、CCでBreak可能、プレイヤーが入ったら即追尾弾発射して終了
   */
  private updateArrangedFoxfireExecution(_time: number, delta: number): void {
    const wSkill = this.skills.get(BossSkillSlot.W);
    if (!wSkill) return;

    const wConfig = this.currentSkillConfig.W;
    const yellowDuration = wConfig.FIELD_YELLOW_DURATION ?? 600;
    const fieldRadius = wConfig.FIELD_RADIUS ?? 247.5;

    // CC中断チェック（黄色・赤フェーズ両方でBreak可能）
    if (wConfig.INTERRUPTIBLE && this.hasStatusEffect(StatusEffectType.STUN)) {
      this._wSkillInterrupted = true;
      this.hideFoxfireField();
      this.completeSkill(BossSkillSlot.W, wConfig.COOLDOWN);
      this.phase1SkillRecoveryTime = Rumia.PHASE1_SKILL_RECOVERY_DURATION;
      console.log('Rumia: アレンジドフォックスファイア中断（CC）');
      return;
    }

    // フィールドタイマー更新
    this.foxfireFieldTimer += delta;

    // フィールドグラフィック更新（位置追従）
    if (this.foxfireFieldActive) {
      // 黄色フェーズから赤フェーズへの移行
      if (this.foxfireFieldPhase === 'yellow' && this.foxfireFieldTimer >= yellowDuration) {
        this.foxfireFieldPhase = 'red';
        console.log('Rumia: フォックスファイア 赤フェーズ開始');
      }

      this.updateFoxfireFieldGraphics();

      // 赤フェーズ中のみプレイヤー判定
      if (this.foxfireFieldPhase === 'red' && this.playerPosition) {
        const dx = this.playerPosition.x - this.x;
        const dy = this.playerPosition.y - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance <= fieldRadius) {
          // プレイヤーが赤エリア内に入った！追尾弾発射してスキル終了
          console.log('Rumia: プレイヤーが赤エリアに侵入！追尾弾発射');
          this.fireFoxfireHomingBullets();
          this.hideFoxfireField();
          this.completeSkill(BossSkillSlot.W, wConfig.COOLDOWN);
          this.phase1SkillRecoveryTime = Rumia.PHASE1_SKILL_RECOVERY_DURATION;
          return;
        }
      }
    }

    // スキル実行時間更新
    wSkill.executionTimeRemaining -= delta;

    // フィールド持続時間終了（プレイヤーが入らなかった場合）
    if (wSkill.executionTimeRemaining <= 0) {
      this.hideFoxfireField();
      this.completeSkill(BossSkillSlot.W, wConfig.COOLDOWN);
      this.phase1SkillRecoveryTime = Rumia.PHASE1_SKILL_RECOVERY_DURATION;
      console.log('Rumia: アレンジドフォックスファイア終了（プレイヤー未侵入）');
    }
  }

  /**
   * 追尾弾を発射
   */
  private fireFoxfireHomingBullets(): void {
    if (!this.bulletPool || !this.playerPosition) return;

    const wConfig = this.currentSkillConfig.W;
    const bulletCount = wConfig.HOMING_BULLET_COUNT ?? 3;
    const bulletRadius = wConfig.HOMING_BULLET_RADIUS ?? 27.5;
    const bulletSpeed = wConfig.HOMING_BULLET_SPEED ?? 330;
    const homingDuration = wConfig.HOMING_DURATION ?? 3000;
    const bulletScale = wConfig.BULLET_DISPLAY_SCALE ?? 0.11;
    const bulletColor = wConfig.BULLET_COLOR ?? 22; // LARGE_BALL.ORANGE

    // プレイヤー方向に向けて発射（少し角度をずらす）
    const baseAngle = Math.atan2(
      this.playerPosition.y - this.y,
      this.playerPosition.x - this.x
    );

    for (let i = 0; i < bulletCount; i++) {
      const bullet = this.bulletPool.acquire();
      if (!bullet) continue;

      // 弾の角度（-30度、0度、30度の3方向）
      const angleOffset = (i - (bulletCount - 1) / 2) * (Math.PI / 6);
      const angle = baseAngle + angleOffset;

      // ダメージ計算
      const damage = wConfig.DAMAGE.BASE + this.stats.attackPower * wConfig.DAMAGE.RATIO;

      // 弾を発射（初期方向に向かって）
      const targetX = this.x + Math.cos(angle) * 1000;
      const targetY = this.y + Math.sin(angle) * 1000;

      bullet.fire(
        this.x, this.y,
        targetX, targetY,
        BulletType.ENEMY_NORMAL,
        damage,
        null,
        false,
        bulletColor
      );

      // 弾のサイズと当たり判定を設定
      bullet.setScale(bulletScale);
      const body = bullet.body as Phaser.Physics.Arcade.Body;
      if (body) {
        body.setCircle(bulletRadius / bulletScale);
        body.setVelocity(
          Math.cos(angle) * bulletSpeed,
          Math.sin(angle) * bulletSpeed
        );
      }

      // 追尾弾として登録
      this.foxfireHomingBullets.push(bullet);
      this.foxfireHomingAngles.push(angle);
      this.foxfireHomingTimers.push(homingDuration);
    }

    // SE再生
    AudioManager.getInstance().playSe('se_shot1');
    console.log(`Rumia: 追尾弾${bulletCount}発発射!`);
  }

  /**
   * 追尾弾の更新
   */
  private updateFoxfireHomingBullets(delta: number): void {
    if (this.foxfireHomingBullets.length === 0) return;
    if (!this.playerPosition) return;

    const wConfig = this.currentSkillConfig.W;
    const bulletSpeed = wConfig.HOMING_BULLET_SPEED ?? 330;
    const turnRate = wConfig.HOMING_TURN_RATE ?? (Math.PI * 2);  // ラジアン/秒

    const bulletsToRemove: number[] = [];

    for (let i = 0; i < this.foxfireHomingBullets.length; i++) {
      const bullet = this.foxfireHomingBullets[i];

      // 弾が無効化されている場合はスキップ
      if (!bullet.active) {
        bulletsToRemove.push(i);
        continue;
      }

      // 追尾時間を減少
      this.foxfireHomingTimers[i] -= delta;

      // 追尾時間が終了した場合、直進に切り替え
      if (this.foxfireHomingTimers[i] <= 0) {
        bulletsToRemove.push(i);
        continue;
      }

      // プレイヤー方向への目標角度を計算
      const targetAngle = Math.atan2(
        this.playerPosition.y - bullet.y,
        this.playerPosition.x - bullet.x
      );

      // 現在の角度との差分を計算
      let angleDiff = targetAngle - this.foxfireHomingAngles[i];

      // 角度差を-πからπの範囲に正規化
      while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
      while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

      // 旋回速度に基づいて角度を更新
      const maxTurn = turnRate * (delta / 1000);
      if (Math.abs(angleDiff) <= maxTurn) {
        this.foxfireHomingAngles[i] = targetAngle;
      } else if (angleDiff > 0) {
        this.foxfireHomingAngles[i] += maxTurn;
      } else {
        this.foxfireHomingAngles[i] -= maxTurn;
      }

      // 速度を更新
      const body = bullet.body as Phaser.Physics.Arcade.Body;
      if (body) {
        body.setVelocity(
          Math.cos(this.foxfireHomingAngles[i]) * bulletSpeed,
          Math.sin(this.foxfireHomingAngles[i]) * bulletSpeed
        );
      }

      // スプライトの回転を更新（弾の向きを速度方向に）
      bullet.setRotation(this.foxfireHomingAngles[i] + Math.PI / 2);
    }

    // 終了した追尾弾をリストから削除（逆順で削除）
    for (let i = bulletsToRemove.length - 1; i >= 0; i--) {
      const index = bulletsToRemove[i];
      this.foxfireHomingBullets.splice(index, 1);
      this.foxfireHomingAngles.splice(index, 1);
      this.foxfireHomingTimers.splice(index, 1);
    }
  }

  /**
   * MSバフの持続時間処理
   * 固定時間（2秒）後にバフが終了
   */
  private updateFoxfireMsBuff(delta: number): void {
    // バフがない場合はスキップ
    if (this.foxfireMsBuffAmount <= 0) return;

    // 残り時間を減少
    this.foxfireMsBuffRemainingTime -= delta;

    // 時間切れでバフ終了
    if (this.foxfireMsBuffRemainingTime <= 0) {
      this.foxfireMsBuffAmount = 0;
      this.foxfireMsBuffRemainingTime = 0;
      this.moveSpeedBuffMultiplier = 1.0;
      console.log('Rumia: MSバフ終了');
    }
  }

  // ========================================
  // Phase1 Eスキル「カーチスクロス」関連メソッド
  // ========================================

  /**
   * カーチスクロスの使用を試みる
   * プレイヤー方向に十字架弾幕を纏って突進
   */
  private tryUseCurtisCrossSkill(): void {
    if (!this.playerPosition) return;

    const eConfig = this.currentSkillConfig.E;
    const castTime = eConfig.CAST_TIME;

    // プレイヤー方向を計算
    const angleToPlayer = Phaser.Math.Angle.Between(
      this.x, this.y,
      this.playerPosition.x, this.playerPosition.y
    );

    if (this.startSkill(BossSkillSlot.E, castTime, angleToPlayer)) {
      // 初期化
      this.curtisCrossDashDirection = angleToPlayer;
      this.curtisCrossDashProgress = 0;
      this.curtisCrossDashComplete = false;
      this.curtisCrossBullets = [];
      this.curtisCrossBulletOffsets = [];

      console.log(`Rumia: Eスキル詠唱開始 - ${eConfig.NAME}`);
    }
  }

  /**
   * カーチスクロスの詠唱更新
   */
  private updateCurtisCrossCasting(delta: number): void {
    const eSkill = this.skills.get(BossSkillSlot.E);
    if (!eSkill) return;

    // 詠唱時間を減少
    eSkill.castTimeRemaining -= delta;

    if (eSkill.castTimeRemaining <= 0) {
      // 詠唱完了 → 実行開始
      eSkill.state = BossSkillState.EXECUTING;
      this.startCurtisCrossDash();
      console.log('Rumia: カーチスクロス実行開始!');
    }
  }

  /**
   * カーチスクロスの突進開始
   */
  private startCurtisCrossDash(): void {
    if (!this.playerPosition || !this.bulletPool) return;

    const eConfig = this.currentSkillConfig.E;
    const dashDistance = eConfig.DASH_DISTANCE ?? 385;
    const spacing = eConfig.CROSS_BULLET_SPACING ?? 55;

    // 突進開始位置と目標位置を設定
    this.curtisCrossDashStartPos = { x: this.x, y: this.y };

    // プレイヤー方向に向けて突進目標を計算
    const targetX = this.x + Math.cos(this.curtisCrossDashDirection) * dashDistance;
    const targetY = this.y + Math.sin(this.curtisCrossDashDirection) * dashDistance;

    // プレイエリア内に制限
    const { X, Y, WIDTH, HEIGHT } = GAME_CONFIG.PLAY_AREA;
    const margin = this.stats.hitboxRadius;
    this.curtisCrossDashTargetPos = {
      x: Phaser.Math.Clamp(targetX, X + margin, X + WIDTH - margin),
      y: Phaser.Math.Clamp(targetY, Y + margin, Y + HEIGHT - margin),
    };

    // 十字架の弾オフセットを計算（突進方向を基準に回転）
    // 十字架配置（上が先頭 = 進行方向）:
    //     ◯      ← 先頭1個 (0, -1) → 進行方向
    //   ◯◯◯    ← 横3個 (-1,0), (0,0), (1,0)
    //     ◯      ← 後方1個 (0, 1)
    //     ◯      ← 後方2個目 (0, 2)
    const crossPattern = [
      { x: 0, y: -1 },  // 先頭（進行方向）
      { x: -1, y: 0 },  // 左
      { x: 0, y: 0 },   // 中央
      { x: 1, y: 0 },   // 右
      { x: 0, y: 1 },   // 後方1
      { x: 0, y: 2 },   // 後方2
    ];

    // 突進方向に合わせてオフセットを回転
    // 「上」(0, -1) を進行方向に向けるため、角度を +90度オフセット
    const rotationAngle = this.curtisCrossDashDirection + Math.PI / 2;
    const cos = Math.cos(rotationAngle);
    const sin = Math.sin(rotationAngle);

    this.curtisCrossBulletOffsets = crossPattern.map(p => ({
      x: (p.x * cos - p.y * sin) * spacing,
      y: (p.x * sin + p.y * cos) * spacing,
    }));

    // 弾を生成
    const bulletRadius = eConfig.CROSS_BULLET_RADIUS ?? 27.5;
    const bulletScale = eConfig.BULLET_DISPLAY_SCALE ?? 0.11;
    const bulletColor = eConfig.BULLET_COLOR ?? 3;
    const bulletDamage = eConfig.DAMAGE.BASE + this.stats.attackPower * eConfig.DAMAGE.RATIO;

    for (const offset of this.curtisCrossBulletOffsets) {
      const bulletX = this.x + offset.x;
      const bulletY = this.y + offset.y;

      const bullet = this.bulletPool.acquire();
      if (!bullet) continue;

      // 弾を初期化（速度0で位置に配置）
      bullet.fire(
        bulletX, bulletY,
        bulletX, bulletY,  // ターゲット位置も同じ（動かない）
        BulletType.ENEMY_NORMAL,
        bulletDamage,
        null,
        false,
        bulletColor
      );

      // 弾のサイズと当たり判定を設定
      bullet.setScale(bulletScale);
      const body = bullet.body as Phaser.Physics.Arcade.Body;
      if (body) {
        body.setCircle(bulletRadius / bulletScale);
        body.setVelocity(0, 0); // 初期速度0（ルーミアに追従）
      }

      this.curtisCrossBullets.push(bullet);
    }

    // SE再生
    AudioManager.getInstance().playSe('se_shot1_multi');
  }

  /**
   * カーチスクロスの実行更新
   */
  private updateCurtisCrossExecution(_time: number, delta: number): void {
    const eSkill = this.skills.get(BossSkillSlot.E);
    if (!eSkill) return;

    const eConfig = this.currentSkillConfig.E;
    const dashSpeed = eConfig.DASH_SPEED ?? 770;

    // CC中断チェック（Break時は弾を消す）
    if (this.hasStatusEffect(StatusEffectType.STUN)) {
      this.cancelCurtisCrossBullets();
      this.curtisCrossDashComplete = true;
      this.setVelocity(0, 0);
      this.completeSkill(BossSkillSlot.E, eConfig.COOLDOWN);
      this.phase1SkillRecoveryTime = Rumia.PHASE1_SKILL_RECOVERY_DURATION;
      console.log('Rumia: カーチスクロス中断（CC）');
      return;
    }

    if (!this.curtisCrossDashComplete) {
      // 突進中
      const dx = this.curtisCrossDashTargetPos.x - this.curtisCrossDashStartPos.x;
      const dy = this.curtisCrossDashTargetPos.y - this.curtisCrossDashStartPos.y;
      const totalDistance = Math.sqrt(dx * dx + dy * dy);

      if (totalDistance > 0) {
        // 進捗を更新
        const moveAmount = (dashSpeed * delta) / 1000;
        this.curtisCrossDashProgress += moveAmount / totalDistance;

        if (this.curtisCrossDashProgress >= 1) {
          // 突進完了
          this.curtisCrossDashProgress = 1;
          this.curtisCrossDashComplete = true;
          this.setPosition(this.curtisCrossDashTargetPos.x, this.curtisCrossDashTargetPos.y);
          this.setVelocity(0, 0);

          // 弾を解放して同速度で継続させる
          this.releaseCurtisCrossBullets();

          // スキル完了
          this.completeSkill(BossSkillSlot.E, eConfig.COOLDOWN);
          this.phase1SkillRecoveryTime = Rumia.PHASE1_SKILL_RECOVERY_DURATION;
          console.log('Rumia: カーチスクロス完了');
        } else {
          // 突進中の位置を更新
          const newX = this.curtisCrossDashStartPos.x + dx * this.curtisCrossDashProgress;
          const newY = this.curtisCrossDashStartPos.y + dy * this.curtisCrossDashProgress;
          this.setPosition(newX, newY);

          // 弾もルーミアに追従
          this.updateCurtisCrossBulletPositions();
        }
      } else {
        // 移動距離が0の場合は即完了
        this.curtisCrossDashComplete = true;
        this.releaseCurtisCrossBullets();
        this.completeSkill(BossSkillSlot.E, eConfig.COOLDOWN);
        this.phase1SkillRecoveryTime = Rumia.PHASE1_SKILL_RECOVERY_DURATION;
      }
    }
  }

  /**
   * 十字架弾幕の位置をルーミアに追従させる
   */
  private updateCurtisCrossBulletPositions(): void {
    for (let i = 0; i < this.curtisCrossBullets.length; i++) {
      const bullet = this.curtisCrossBullets[i];
      const offset = this.curtisCrossBulletOffsets[i];
      if (bullet && bullet.active && offset) {
        bullet.setPosition(this.x + offset.x, this.y + offset.y);
      }
    }
  }

  /**
   * 突進完了時に弾を解放して同方向・同速度で飛ばす
   */
  private releaseCurtisCrossBullets(): void {
    const eConfig = this.currentSkillConfig.E;
    const dashSpeed = eConfig.DASH_SPEED ?? 770;

    const vx = Math.cos(this.curtisCrossDashDirection) * dashSpeed;
    const vy = Math.sin(this.curtisCrossDashDirection) * dashSpeed;

    for (const bullet of this.curtisCrossBullets) {
      if (bullet && bullet.active) {
        // 弾に速度を設定して飛ばす
        const body = bullet.body as Phaser.Physics.Arcade.Body;
        if (body) {
          body.setVelocity(vx, vy);
        }
      }
    }

    // 配列をクリア（弾自体は飛んでいく）
    this.curtisCrossBullets = [];
    this.curtisCrossBulletOffsets = [];
  }

  /**
   * 十字架弾幕をキャンセル（Break時に弾を消す）
   */
  private cancelCurtisCrossBullets(): void {
    for (const bullet of this.curtisCrossBullets) {
      if (bullet && bullet.active) {
        bullet.setActive(false);
        bullet.setVisible(false);
      }
    }
    this.curtisCrossBullets = [];
    this.curtisCrossBulletOffsets = [];
  }

  /**
   * 線をプレイエリア内にクリップ（Cohen-Sutherland風）
   */
  private clipLineToPlayArea(
    x1: number, y1: number, x2: number, y2: number
  ): { x1: number; y1: number; x2: number; y2: number } | null {
    const { X, Y, WIDTH, HEIGHT } = GAME_CONFIG.PLAY_AREA;
    const minX = X;
    const maxX = X + WIDTH;
    const minY = Y;
    const maxY = Y + HEIGHT;

    // 線分の方向
    const dx = x2 - x1;
    const dy = y2 - y1;

    let t0 = 0;
    let t1 = 1;

    // 各境界でクリップ
    const clips = [
      { p: -dx, q: x1 - minX }, // 左
      { p: dx, q: maxX - x1 },  // 右
      { p: -dy, q: y1 - minY }, // 上
      { p: dy, q: maxY - y1 },  // 下
    ];

    for (const { p, q } of clips) {
      if (p === 0) {
        if (q < 0) return null; // 境界外
      } else {
        const t = q / p;
        if (p < 0) {
          t0 = Math.max(t0, t);
        } else {
          t1 = Math.min(t1, t);
        }
      }
    }

    if (t0 > t1) return null;

    return {
      x1: x1 + t0 * dx,
      y1: y1 + t0 * dy,
      x2: x1 + t1 * dx,
      y2: y1 + t1 * dy,
    };
  }

  /**
   * 予告線を描画
   */
  protected drawWarningLines(): void {
    if (!this.warningGraphics) return;

    this.warningGraphics.clear();

    const qSkill = this.skills.get(BossSkillSlot.Q);

    // Qスキル詠唱中/実行中の予告線（通常弾幕1）
    const isCastingOrExecuting = qSkill && (
      qSkill.state === BossSkillState.CASTING ||
      qSkill.state === BossSkillState.EXECUTING
    );
    if (isCastingOrExecuting && this.qSkillWarningLines.length > 0) {
      const currentTime = this.scene.time.now;
      const fireDelay = this.currentSkillConfig.Q.WARNING_TO_FIRE_DELAY ?? 500;
      const warningLineLength = 800; // 予告線の長さ

      for (const line of this.qSkillWarningLines) {
        // 発射済みの予告線は表示しない
        if (line.fired) continue;

        // 発射までの残り時間で透明度を変化
        const elapsed = currentTime - line.createdTime;
        const progress = Math.min(elapsed / fireDelay, 1);
        const alpha = 0.1 + progress * 0.15; // 0.1 → 0.25（さらに薄く）

        // 予告線番号で色を変化（1本目=薄い、7本目=濃い）
        const colorIntensity = 0.5 + (line.lineIndex / 6) * 0.5;
        this.warningGraphics.lineStyle(2 + line.lineIndex * 0.5, 0xff0000, alpha * colorIntensity);

        const endX = this.x + Math.cos(line.angle) * warningLineLength;
        const endY = this.y + Math.sin(line.angle) * warningLineLength;

        // プレイエリア内にクリップ
        const clipped = this.clipLineToPlayArea(this.x, this.y, endX, endY);
        if (clipped) {
          this.warningGraphics.lineBetween(clipped.x1, clipped.y1, clipped.x2, clipped.y2);
        }
      }
    }
  }

  /**
   * 移動AI
   */
  private updateMovement(): void {
    if (!this.playerPosition) {
      this.setVelocity(0, 0);
      return;
    }

    const { X, Y, WIDTH, HEIGHT } = GAME_CONFIG.PLAY_AREA;

    // プレイエリア上部1/3で左右に移動
    const targetY = Y + HEIGHT / 4;
    const speed = this.getEffectiveMoveSpeed();

    // プレイヤーのX座標に緩やかに追従
    const dx = this.playerPosition.x - this.x;
    const dy = targetY - this.y;

    let vx = 0;
    let vy = 0;

    // X方向: プレイヤーを追跡（緩やか）
    if (Math.abs(dx) > 50) {
      vx = Math.sign(dx) * speed * 0.5;
    }

    // Y方向: 目標位置に移動
    if (Math.abs(dy) > 10) {
      vy = Math.sign(dy) * speed;
    }

    // プレイエリア内に制限
    const margin = this.stats.hitboxRadius;
    const minX = X + margin;
    const maxX = X + WIDTH - margin;
    const minY = Y + margin;
    const maxY = Y + HEIGHT / 2; // 上半分のみ

    if (this.x <= minX && vx < 0) vx = 0;
    if (this.x >= maxX && vx > 0) vx = 0;
    if (this.y <= minY && vy < 0) vy = 0;
    if (this.y >= maxY && vy > 0) vy = 0;

    this.setVelocity(vx, vy);
  }

  /**
   * スポーン時の初期化
   */
  spawn(x: number, y: number): void {
    super.spawn(x, y);

    // ルーミアのコマアニメーションを再生（super.spawnでTintが上書きされるため）
    this.setTexture('coma_rumia_idle');
    this.play('rumia_idle');
    this.clearTint();
    // スケール調整（704x800は大きいので縮小）
    this.setScale(0.16);

    // 最初のスキル発動までの遅延
    const qSkill = this.skills.get(BossSkillSlot.Q);
    if (qSkill) {
      qSkill.state = BossSkillState.COOLDOWN;
      qSkill.cooldownRemaining = 1000; // 1秒後に最初のスキル
    }

    const wSkill = this.skills.get(BossSkillSlot.W);
    if (wSkill) {
      wSkill.state = BossSkillState.COOLDOWN;
      wSkill.cooldownRemaining = 2000; // 2秒後に最初のWスキル
    }

    const eSkill = this.skills.get(BossSkillSlot.E);
    if (eSkill) {
      eSkill.state = BossSkillState.COOLDOWN;
      eSkill.cooldownRemaining = 3000; // 3秒後に最初のEスキル
    }

    const rSkill = this.skills.get(BossSkillSlot.R);
    if (rSkill) {
      rSkill.state = BossSkillState.COOLDOWN;
      rSkill.cooldownRemaining = 2000; // 2秒後に最初のRスキル
    }

    // Rスキル状態をクリア
    this.rSkillMoveProgress = 0;
    this.rSkillBulletFireTimer = 0;
    this.rSkillInvincibilityRemaining = 0;

    // Eスキル状態をクリア
    this.eSkillMoveDirection = 0;
    this.eSkillMoveStartPos = { x: 0, y: 0 };
    this.eSkillMoveProgress = 0;
    this.eSkillBulletsSpawned = 0;
    this.eSkillBulletSpawnTimer = 0;
    this._eSkillInterrupted = false;
  }

  /**
   * 被弾エフェクト（コマアニメーション用にオーバーライド）
   */
  protected flashDamage(): void {
    this.setTint(0xff0000); // 赤くフラッシュ
    this.scene.time.delayedCall(100, () => {
      if (this.isActive) {
        this.clearTint();
      }
    });
  }

  /**
   * 状態異常を更新（コマアニメーション用にオーバーライド）
   */
  protected updateStatusEffects(delta: number): void {
    const statusEffects = this.getStatusEffects();
    for (let i = statusEffects.length - 1; i >= 0; i--) {
      statusEffects[i].remainingTime -= delta;
      if (statusEffects[i].remainingTime <= 0) {
        // スタン解除時はTintをクリア（コマアニメーション用）
        if (statusEffects[i].type === StatusEffectType.STUN) {
          this.clearTint();
        }
        statusEffects.splice(i, 1);
      }
    }
  }

  /**
   * 状態異常を付与（コマアニメーション用にオーバーライド）
   */
  applyStatusEffect(effect: StatusEffect): void {
    // 親クラスの処理を呼び出し（Break!表示、SE再生含む）
    super.applyStatusEffect(effect);
  }

  /**
   * 非アクティブ化
   */
  deactivate(): void {
    super.deactivate();
  }
}
