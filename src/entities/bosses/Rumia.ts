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
import { BOSS_CONFIG, GAME_CONFIG } from '@/config/GameConfig';
import { KSHOT } from '../Bullet';

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
    // 共通
    BULLET_SPEED: number;
    BULLET_RADIUS?: number;
    BULLET_COLOR?: number;  // 弾の色（オプション）
  };
  W: {
    NAME: string;
    CAST_TIME: number;
    COOLDOWN: number;
    DAMAGE: { BASE: number; RATIO: number };
    // ノーマルフェーズ用（レーザー）
    LASER_COUNT?: number;
    LASER_WIDTH?: number;
    LASER_LENGTH?: number;
    LASER_DURATION?: number;
    // スペルカード用（トリプルバースト - Q3連射）
    BURST_COUNT?: number;
    BURST_INTERVAL?: number;
    BULLET_SPEED?: number;  // W専用の弾速（Qより速い）
  };
  E: {
    NAME: string;
    CAST_TIME: number;
    COOLDOWN: number;
    DAMAGE: { BASE: number; RATIO: number };
    // ノーマルフェーズ用（ディマーケイション）
    BULLETS_PER_RING?: number;
    WAVE_COUNT?: number;
    WAVE_INTERVAL?: number;
    INITIAL_RADIUS?: number;
    EXPANSION_SPEED?: number;
    ROTATION_SPEED?: number;
    BULLET_RADIUS?: number;
    // スペルカード用（闇の潮汐）
    SPIRAL_ARMS?: number;
    SPIRAL_DURATION?: number;
    BULLET_FIRE_INTERVAL?: number;
    BULLET_SPEED?: number;
    BULLET_COLOR?: number;
  };
  R?: {
    NAME: string;
    CAST_TIME: number;
    COOLDOWN: number;
    DAMAGE: { BASE: number; RATIO: number };
    INVINCIBILITY_DURATION: number;
    MOVE_DISTANCE: number;
    BULLET_FIRE_INTERVAL: number;
    BULLET_SPEED: number;
    BULLET_SIZE_SMALL: number;
    BULLET_SIZE_MEDIUM: number;
    BULLET_SIZE_LARGE: number;
    BULLETS_RANDOM: number;   // ランダム弾6発（小2、中2、大2）
    BULLETS_AIMED: number;    // 自機狙い弾3発（小1、中1、大1）
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

  // アニメーション状態
  private currentAnimState: 'idle' | 'cast' | 'move' = 'idle';

  // Wスキル用
  private wSkillLaserAngles: number[] = [];
  private wSkillDamageApplied: boolean = false;
  private wSkillLaserGraphics: Phaser.GameObjects.Graphics | null = null;

  // Eスキル用（ディマーケイション）
  private eSkillWavesFired: number = 0;       // 発射済み波数
  private eSkillWaveTimer: number = 0;        // 波発射タイマー
  private eSkillRingBullets: Array<{          // 各弾の情報
    bullet: any;
    angle: number;
    waveIndex: number;
    spawnTime: number;
  }> = [];

  // Rスキル用（ダークサイドオブザムーン）
  private rSkillMoveDirection: number = 0;          // 移動方向（ラジアン）
  private rSkillMoveStartPos: { x: number; y: number } = { x: 0, y: 0 }; // 移動開始位置
  private rSkillMoveProgress: number = 0;           // 移動進捗（0〜1）
  private rSkillBulletFireTimer: number = 0;        // 弾発射タイマー
  private rSkillInvincibilityRemaining: number = 0; // 無敵残り時間

  // スペルカード用Wスキル（トリプルバースト - Q3連射）
  private spellWSkillBurstsFired: number = 0;       // 発射済み回数
  private spellWSkillBurstTimer: number = 0;        // 発射間隔タイマー

  // スペルカード用Eスキル（闇の潮汐）
  private spellESkillStartTime: number = 0;         // スキル開始時間
  private spellESkillBulletTimer: number = 0;       // 弾発射タイマー
  private spellESkillBaseAngle: number = 0;         // 螺旋の基準角度

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

    // Wスキル用レーザーグラフィックス
    this.wSkillLaserGraphics = scene.add.graphics();
    this.wSkillLaserGraphics.setDepth(60); // EFFECTS
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

    // スペルカードフェーズなら色を変える
    const phase = this.getCurrentPhase();
    if (phase?.type === BossPhaseType.SPELL_CARD) {
      this.setTint(0x990099); // より明るい紫
    } else {
      this.setTint(0x660066);
    }
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

    // アニメーション状態を更新
    this.updateAnimation();
  }

  /**
   * アニメーション状態を更新
   * 詠唱中は詠唱アニメーション、移動中は移動アニメーション、それ以外は待機アニメーション
   */
  private updateAnimation(): void {
    const qSkill = this.skills.get(BossSkillSlot.Q);
    const wSkill = this.skills.get(BossSkillSlot.W);
    const eSkill = this.skills.get(BossSkillSlot.E);
    const rSkill = this.skills.get(BossSkillSlot.R);

    // いずれかのスキルが詠唱中かどうか
    const isCasting =
      qSkill?.state === BossSkillState.CASTING ||
      wSkill?.state === BossSkillState.CASTING ||
      eSkill?.state === BossSkillState.CASTING ||
      rSkill?.state === BossSkillState.CASTING;

    // 移動中かどうか（速度がある程度あるか）
    const body = this.body as Phaser.Physics.Arcade.Body;
    const isMoving = body && (Math.abs(body.velocity.x) > 10 || Math.abs(body.velocity.y) > 10);

    if (isCasting && this.currentAnimState !== 'cast') {
      // 詠唱アニメーションに切り替え（最優先）
      this.play('rumia_cast');
      this.currentAnimState = 'cast';
      // 詠唱中は回転・反転をリセット
      this.setRotation(0);
      this.setFlipX(false);
    } else if (!isCasting && isMoving) {
      // 移動アニメーションに切り替え
      if (this.currentAnimState !== 'move') {
        this.play('rumia_move');
        this.currentAnimState = 'move';
      }
      // 移動方向に合わせて回転・反転
      this.updateMoveDirection(body.velocity.x, body.velocity.y);
    } else if (!isCasting && !isMoving && this.currentAnimState !== 'idle') {
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
    const angleDeg = Phaser.Math.RadToDeg(angle);

    // 左向き（90度〜270度、つまり|角度| > 90度）の場合は反転
    if (Math.abs(angleDeg) > 90) {
      this.setFlipX(true);
      // 反転時は角度を反転（上下が逆にならないように）
      this.setRotation(angle + Math.PI);
    } else {
      this.setFlipX(false);
      this.setRotation(angle);
    }
  }

  /**
   * ノーマルフェーズのAI
   */
  private updateNormalPhaseAI(time: number, delta: number): void {
    // スキル状態を確認
    const qSkill = this.skills.get(BossSkillSlot.Q);
    const wSkill = this.skills.get(BossSkillSlot.W);
    const eSkill = this.skills.get(BossSkillSlot.E);
    if (!qSkill || !wSkill || !eSkill) return;

    // 現在スキル実行中かどうか
    const isSkillActive =
      qSkill.state === BossSkillState.CASTING ||
      qSkill.state === BossSkillState.EXECUTING ||
      wSkill.state === BossSkillState.CASTING ||
      wSkill.state === BossSkillState.EXECUTING ||
      eSkill.state === BossSkillState.CASTING ||
      eSkill.state === BossSkillState.EXECUTING;

    // Wスキルの処理（Qより優先度高め）
    switch (wSkill.state) {
      case BossSkillState.READY:
        // Qスキルが使用中でなければWを使用
        if (qSkill.state !== BossSkillState.CASTING && qSkill.state !== BossSkillState.EXECUTING) {
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
        // Wスキルが使用中でなければQを使用
        if (wSkill.state !== BossSkillState.CASTING && wSkill.state !== BossSkillState.EXECUTING) {
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
        if (!isSkillActive) {
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
   * 闇符「ダークサイドオブザムーン」専用AI
   * プレイヤーに近づきながらQ + E + Rを使用
   */
  private updateDarkSideOfTheMoonAI(time: number, delta: number): void {
    const qSkill = this.skills.get(BossSkillSlot.Q);
    const wSkill = this.skills.get(BossSkillSlot.W);
    const eSkill = this.skills.get(BossSkillSlot.E);
    const rSkill = this.skills.get(BossSkillSlot.R);
    if (!qSkill || !wSkill || !eSkill || !rSkill) return;

    // Rスキル実行中は他のスキルを使用しない
    const isRSkillActive =
      rSkill.state === BossSkillState.CASTING ||
      rSkill.state === BossSkillState.EXECUTING;

    // Qスキル実行中はR/E/Wを使用しない
    const isQSkillActive =
      qSkill.state === BossSkillState.CASTING ||
      qSkill.state === BossSkillState.EXECUTING;

    // Wスキル実行中はR/Qを使用しない
    const isWSkillActive =
      wSkill.state === BossSkillState.CASTING ||
      wSkill.state === BossSkillState.EXECUTING;

    // Eスキル実行中はR/Q/Wを使用しない
    const isESkillActive =
      eSkill.state === BossSkillState.CASTING ||
      eSkill.state === BossSkillState.EXECUTING;

    // Rスキルの処理（優先度最高）
    switch (rSkill.state) {
      case BossSkillState.READY:
        if (!isQSkillActive && !isESkillActive) {
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

    // Eスキルの処理（螺旋弾幕）- Rより優先度低い
    switch (eSkill.state) {
      case BossSkillState.READY:
        if (!isRSkillActive && !isQSkillActive && !isWSkillActive) {
          this.tryUseSpellCardESkill();
        }
        break;

      case BossSkillState.CASTING:
        this.updateSpellCardESkillCasting(delta);
        break;

      case BossSkillState.EXECUTING:
        this.updateSpellCardESkillExecution(time, delta);
        break;
    }

    // Wスキルの処理（リング弾幕）- E/Rより優先度低い
    switch (wSkill.state) {
      case BossSkillState.READY:
        if (!isRSkillActive && !isQSkillActive && !isESkillActive) {
          this.tryUseSpellCardWSkill();
        }
        break;

      case BossSkillState.CASTING:
        this.updateSpellCardWSkillCasting(delta);
        break;

      case BossSkillState.EXECUTING:
        this.updateSpellCardWSkillExecution(time, delta);
        break;
    }

    // Qスキルの処理（12方向弾）- E/R/Wと並行して使用可能
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

    // 移動AI（Rスキル実行中以外はプレイヤーに近づく）
    if (!isRSkillActive) {
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
    const speed = this.stats.moveSpeed;

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
    const bulletSpeed = config.BULLET_SPEED;
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
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const bullet = this.bulletPool.acquire();
        if (!bullet) continue;

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

    console.log(`Rumia Q: 予告線${lineIndex + 1}から弾幕発射 (${rows}x${cols}発)`);
  }

  /**
   * 色IDからKSHOT番号を取得
   * 1=赤, 2=橙, 3=黄, 4=緑, 5=シアン, 6=青, 7=マゼンタ, 8=白
   */
  private getKshotFrameByColor(colorId: number): number {
    // colorIdはKSHOT.MEDIUM_BALLの値と一致（1-8）
    if (colorId >= 1 && colorId <= 8) {
      return colorId;
    }
    return KSHOT.MEDIUM_BALL.RED; // デフォルトは赤
  }

  /**
   * Wスキル使用を試みる
   */
  private tryUseWSkill(): void {
    if (!this.playerPosition) return;

    // プレイヤー方向を計算
    const angleToPlayer = Phaser.Math.Angle.Between(
      this.x,
      this.y,
      this.playerPosition.x,
      this.playerPosition.y
    );

    // スキル使用開始
    if (this.startSkill(BossSkillSlot.W, this.currentSkillConfig.W.CAST_TIME, angleToPlayer)) {
      // レーザー角度を計算（自機狙い1本 + ランダム4本）
      this.calculateWSkillAngles(angleToPlayer);
      this.wSkillDamageApplied = false;
      console.log(`Rumia: Wスキル詠唱開始 - レーザー${this.currentSkillConfig.W.LASER_COUNT}本`);
    }
  }

  /**
   * Wスキルのレーザー角度を計算
   */
  private calculateWSkillAngles(playerAngle: number): void {
    this.wSkillLaserAngles = [];

    // 1本目: 自機狙い
    this.wSkillLaserAngles.push(playerAngle);

    // 残り4本: プレイヤー方向を中心に±60度（120度範囲）のランダム
    const spreadRange = Phaser.Math.DegToRad(60); // ±60度
    const laserCount = this.currentSkillConfig.W.LASER_COUNT ?? 5;
    for (let i = 1; i < laserCount; i++) {
      const randomOffset = (Math.random() * 2 - 1) * spreadRange; // -60° ~ +60°
      this.wSkillLaserAngles.push(playerAngle + randomOffset);
    }
  }

  /**
   * Wスキル詠唱更新
   */
  private updateWSkillCasting(delta: number): void {
    const castComplete = this.updateSkillCasting(BossSkillSlot.W, delta);

    if (castComplete) {
      // 詠唱完了 → 実行開始（レーザー発射）
      const wSkill = this.skills.get(BossSkillSlot.W);
      if (wSkill) {
        wSkill.state = BossSkillState.EXECUTING;
        wSkill.executionTimeRemaining = this.currentSkillConfig.W.LASER_DURATION ?? 100;
        console.log('Rumia: Wスキル発射!');
      }
    }
  }

  /**
   * Wスキル実行更新（レーザーダメージ判定）
   */
  private updateWSkillExecution(delta: number): void {
    const wSkill = this.skills.get(BossSkillSlot.W);
    if (!wSkill) return;

    wSkill.executionTimeRemaining -= delta;

    // ダメージ判定（1回のみ）
    if (!this.wSkillDamageApplied && this.playerPosition) {
      this.applyWSkillDamage();
      this.wSkillDamageApplied = true;
    }

    // レーザー表示
    this.drawWSkillLasers();

    // 実行完了
    if (wSkill.executionTimeRemaining <= 0) {
      this.wSkillLaserGraphics?.clear();
      this.completeSkill(BossSkillSlot.W, this.currentSkillConfig.W.COOLDOWN);
      console.log('Rumia: Wスキル完了');
    }
  }

  /**
   * Wスキルのダメージを適用
   */
  private applyWSkillDamage(): void {
    if (!this.playerPosition) return;

    const laserWidth = this.currentSkillConfig.W.LASER_WIDTH ?? 30;
    const laserLength = this.currentSkillConfig.W.LASER_LENGTH ?? 800;
    const damage = this.currentSkillConfig.W.DAMAGE.BASE + this.stats.attackPower * this.currentSkillConfig.W.DAMAGE.RATIO;

    // 各レーザーとプレイヤーの当たり判定
    for (const angle of this.wSkillLaserAngles) {
      if (this.checkLaserHit(angle, laserWidth, laserLength)) {
        // プレイヤーにダメージを与える（GameSceneで処理される）
        // ここではイベントを発火
        this.scene.events.emit('playerHitByLaser', damage);
        console.log(`Rumia W: レーザーヒット! ダメージ: ${damage}`);
        break; // 1回のスキルで1回だけダメージ
      }
    }
  }

  /**
   * レーザーとプレイヤーの当たり判定
   */
  private checkLaserHit(angle: number, width: number, length: number): boolean {
    if (!this.playerPosition) return false;

    // プレイヤーの相対座標
    const relX = this.playerPosition.x - this.x;
    const relY = this.playerPosition.y - this.y;

    // レーザー方向に回転して座標変換
    const cos = Math.cos(-angle);
    const sin = Math.sin(-angle);
    const localX = relX * cos - relY * sin;
    const localY = relX * sin + relY * cos;

    // ローカル座標系でのレーザー矩形との判定
    // レーザーは原点から+X方向に伸びる
    const halfWidth = width / 2;
    const playerRadius = 10; // プレイヤーのヒットボックス半径

    // プレイヤーがレーザー範囲内か
    if (localX >= -playerRadius && localX <= length + playerRadius) {
      if (Math.abs(localY) <= halfWidth + playerRadius) {
        return true;
      }
    }

    return false;
  }

  /**
   * Eスキル使用を試みる
   */
  private tryUseESkill(): void {
    // スキル使用開始
    if (this.startSkill(BossSkillSlot.E, this.currentSkillConfig.E.CAST_TIME, 0)) {
      // 初期化
      this.eSkillWavesFired = 0;
      this.eSkillWaveTimer = 0;
      this.eSkillRingBullets = [];
      console.log(`Rumia: Eスキル詠唱開始 - ディマーケイション`);
    }
  }

  /**
   * Eスキル詠唱更新
   */
  private updateESkillCasting(delta: number): void {
    const castComplete = this.updateSkillCasting(BossSkillSlot.E, delta);

    if (castComplete) {
      // 詠唱完了 → 実行開始
      const eSkill = this.skills.get(BossSkillSlot.E);
      if (eSkill) {
        eSkill.state = BossSkillState.EXECUTING;
        // 実行時間 = 波の数 × 波の間隔 + 弾が画面外に出るまでの時間
        const waveCount = this.currentSkillConfig.E.WAVE_COUNT ?? 3;
        const waveInterval = this.currentSkillConfig.E.WAVE_INTERVAL ?? 400;
        eSkill.executionTimeRemaining = waveCount * waveInterval + 3000;
        this.eSkillWaveTimer = waveInterval; // すぐに最初の波を発射
        console.log('Rumia: Eスキル発射開始!');
      }
    }
  }

  /**
   * Eスキル実行更新（拡大するリング弾幕）
   */
  private updateESkillExecution(time: number, delta: number): void {
    const eSkill = this.skills.get(BossSkillSlot.E);
    if (!eSkill) return;

    const waveCount = this.currentSkillConfig.E.WAVE_COUNT ?? 3;
    const waveInterval = this.currentSkillConfig.E.WAVE_INTERVAL ?? 400;

    // 波タイマー更新
    this.eSkillWaveTimer += delta;

    // 新しい波を発射
    if (this.eSkillWavesFired < waveCount &&
        this.eSkillWaveTimer >= waveInterval) {
      this.fireESkillWave(time);
      this.eSkillWavesFired++;
      this.eSkillWaveTimer = 0;
    }

    // リング弾の位置を更新（拡大）
    this.updateESkillBullets(time);

    // 実行時間更新
    eSkill.executionTimeRemaining -= delta;

    // 全波発射完了かつ実行時間終了
    if (eSkill.executionTimeRemaining <= 0) {
      this.completeSkill(BossSkillSlot.E, this.currentSkillConfig.E.COOLDOWN);
      this.eSkillRingBullets = [];
      console.log('Rumia: Eスキル完了');
    }
  }

  /**
   * Eスキルの波を発射
   * kShotのPURPLE大丸弾を使用
   */
  private fireESkillWave(time: number): void {
    if (!this.bulletPool) return;

    const bulletsPerRing = this.currentSkillConfig.E.BULLETS_PER_RING ?? 16;
    const initialRadius = this.currentSkillConfig.E.INITIAL_RADIUS ?? 30;
    const damage = this.currentSkillConfig.E.DAMAGE.BASE + this.stats.attackPower * this.currentSkillConfig.E.DAMAGE.RATIO;

    for (let i = 0; i < bulletsPerRing; i++) {
      const angle = (i / bulletsPerRing) * Math.PI * 2;

      const bullet = this.bulletPool.acquire();
      if (!bullet) continue;

      // 初期位置（ルーミアの周囲、初期半径の位置）
      const initialX = this.x + Math.cos(angle) * initialRadius;
      const initialY = this.y + Math.sin(angle) * initialRadius;

      // kShotのPURPLE大丸弾を使用
      bullet.fire(
        initialX,
        initialY,
        initialX,
        initialY,
        BulletType.ENEMY_NORMAL,
        damage,
        null,
        false,
        KSHOT.MEDIUM_BALL.MAGENTA
      );

      // 弾情報を保存
      this.eSkillRingBullets.push({
        bullet,
        angle,
        waveIndex: this.eSkillWavesFired,
        spawnTime: time,
      });
    }

    console.log(`Rumia E: 波${this.eSkillWavesFired + 1}発射 (${bulletsPerRing}発)`);
  }

  /**
   * Eスキルのリング弾を更新（拡大 + 回転）
   */
  private updateESkillBullets(time: number): void {
    const { X, Y, WIDTH, HEIGHT } = GAME_CONFIG.PLAY_AREA;
    const initialRadius = this.currentSkillConfig.E.INITIAL_RADIUS ?? 30;
    const expansionSpeed = this.currentSkillConfig.E.EXPANSION_SPEED ?? 200;
    const rotationSpeed = this.currentSkillConfig.E.ROTATION_SPEED ?? 0.8;

    for (let i = this.eSkillRingBullets.length - 1; i >= 0; i--) {
      const info = this.eSkillRingBullets[i];
      const bullet = info.bullet;

      if (!bullet || !bullet.active) {
        this.eSkillRingBullets.splice(i, 1);
        continue;
      }

      // 経過時間から現在の半径を計算
      const elapsed = time - info.spawnTime;
      const elapsedSec = elapsed / 1000;
      const currentRadius = initialRadius + (expansionSpeed * elapsedSec);

      // 回転角度を計算（波ごとに交互に時計回り/反時計回り）
      // 偶数波: 時計回り（正）、奇数波: 反時計回り（負）
      const rotationDirection = info.waveIndex % 2 === 0 ? 1 : -1;
      const rotationAngle = rotationSpeed * elapsedSec * rotationDirection;
      const currentAngle = info.angle + rotationAngle;

      // 新しい位置を計算（ルーミアの位置を中心に拡大 + 回転）
      const newX = this.x + Math.cos(currentAngle) * currentRadius;
      const newY = this.y + Math.sin(currentAngle) * currentRadius;

      // 弾の位置を更新
      bullet.setPosition(newX, newY);

      // プレイエリア外に出たら削除
      if (newX < X - 50 || newX > X + WIDTH + 50 ||
          newY < Y - 50 || newY > Y + HEIGHT + 50) {
        bullet.deactivate();
        this.eSkillRingBullets.splice(i, 1);
      }
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

    this.rSkillMoveStartPos = { x: this.x, y: this.y };
    this.rSkillMoveProgress = 0;
    this.rSkillBulletFireTimer = 0;
    this.rSkillInvincibilityRemaining = rConfig.INVINCIBILITY_DURATION;

    // プレイエリア内に収まるように移動方向を調整
    const { X, Y, WIDTH, HEIGHT } = GAME_CONFIG.PLAY_AREA;
    const margin = this.stats.hitboxRadius + 20;
    const targetX = this.x + Math.cos(this.rSkillMoveDirection) * rConfig.MOVE_DISTANCE;
    const targetY = this.y + Math.sin(this.rSkillMoveDirection) * rConfig.MOVE_DISTANCE;

    // 移動先がエリア外なら方向を反転
    if (targetX < X + margin || targetX > X + WIDTH - margin ||
        targetY < Y + margin || targetY > Y + HEIGHT - margin) {
      this.rSkillMoveDirection += Math.PI; // 180度反転
    }
  }

  /**
   * Rスキル実行更新
   */
  private updateRSkillExecution(_time: number, delta: number): void {
    const rSkill = this.skills.get(BossSkillSlot.R);
    const rConfig = this.currentSkillConfig.R;
    if (!rSkill || !rConfig) return;

    // 無敵時間管理
    if (this.rSkillInvincibilityRemaining > 0) {
      this.rSkillInvincibilityRemaining -= delta;
    }

    // 移動処理
    const moveDuration = rConfig.INVINCIBILITY_DURATION; // 無敵時間中に移動完了
    this.rSkillMoveProgress += delta / moveDuration;
    this.rSkillMoveProgress = Math.min(this.rSkillMoveProgress, 1);

    // 位置を更新（イージング付き）
    const easeProgress = this.easeOutQuad(this.rSkillMoveProgress);
    const newX = this.rSkillMoveStartPos.x + Math.cos(this.rSkillMoveDirection) * rConfig.MOVE_DISTANCE * easeProgress;
    const newY = this.rSkillMoveStartPos.y + Math.sin(this.rSkillMoveDirection) * rConfig.MOVE_DISTANCE * easeProgress;
    this.setPosition(newX, newY);

    // 弾発射タイマー
    this.rSkillBulletFireTimer += delta;
    if (this.rSkillBulletFireTimer >= rConfig.BULLET_FIRE_INTERVAL) {
      this.fireRSkillBullets();
      this.rSkillBulletFireTimer = 0;
    }

    // 実行完了判定（移動完了）
    if (this.rSkillMoveProgress >= 1) {
      this.completeSkill(BossSkillSlot.R, rConfig.COOLDOWN);
      console.log('Rumia: Rスキル完了');
    }
  }

  /**
   * Rスキルの弾を発射
   * ランダム弾: 小2、中2、大2 = 6発
   * 自機狙い弾: 小2、中2、大2 = 6発
   * kShotの小丸弾/大丸弾/大玉弾を使用
   */
  private fireRSkillBullets(): void {
    if (!this.bulletPool) return;
    const rConfig = this.currentSkillConfig.R;
    if (!rConfig) return;

    const damage = rConfig.DAMAGE.BASE + this.stats.attackPower * rConfig.DAMAGE.RATIO;

    // サイズごとのkShotフレームID
    const sizeToKshot = {
      small: KSHOT.MEDIUM_BALL.MAGENTA,
      medium: KSHOT.MEDIUM_BALL.MAGENTA,
      large: KSHOT.MEDIUM_BALL.MAGENTA,
    };

    // ランダム弾6発（小2、中2、大2）
    const randomBulletConfigs = [
      { kshot: sizeToKshot.small },
      { kshot: sizeToKshot.small },
      { kshot: sizeToKshot.medium },
      { kshot: sizeToKshot.medium },
      { kshot: sizeToKshot.large },
      { kshot: sizeToKshot.large },
    ];

    for (const config of randomBulletConfigs) {
      const bullet = this.bulletPool.acquire();
      if (!bullet) continue;

      // ランダムな方向
      const angle = Math.random() * Math.PI * 2;
      const targetX = this.x + Math.cos(angle) * 1000;
      const targetY = this.y + Math.sin(angle) * 1000;

      bullet.fire(
        this.x,
        this.y,
        targetX,
        targetY,
        BulletType.ENEMY_NORMAL,
        damage,
        null,
        false,
        config.kshot
      );

      // 弾速を設定
      const body = bullet.body as Phaser.Physics.Arcade.Body;
      if (body) {
        body.setVelocity(
          Math.cos(angle) * rConfig.BULLET_SPEED,
          Math.sin(angle) * rConfig.BULLET_SPEED
        );
      }
    }

    // 自機狙い弾6発（小2、中2、大2）
    if (this.playerPosition) {
      const angleToPlayer = Phaser.Math.Angle.Between(
        this.x,
        this.y,
        this.playerPosition.x,
        this.playerPosition.y
      );

      const aimedBulletConfigs = [
        { kshot: sizeToKshot.small },
        { kshot: sizeToKshot.small },
        { kshot: sizeToKshot.medium },
        { kshot: sizeToKshot.medium },
        { kshot: sizeToKshot.large },
        { kshot: sizeToKshot.large },
      ];

      for (const config of aimedBulletConfigs) {
        const bullet = this.bulletPool.acquire();
        if (!bullet) continue;

        const targetX = this.x + Math.cos(angleToPlayer) * 1000;
        const targetY = this.y + Math.sin(angleToPlayer) * 1000;

        bullet.fire(
          this.x,
          this.y,
          targetX,
          targetY,
          BulletType.ENEMY_NORMAL,
          damage,
          null,
          false,
          config.kshot
        );

        // 弾速を設定
        const body = bullet.body as Phaser.Physics.Arcade.Body;
        if (body) {
          body.setVelocity(
            Math.cos(angleToPlayer) * rConfig.BULLET_SPEED,
            Math.sin(angleToPlayer) * rConfig.BULLET_SPEED
          );
        }
      }
    }
  }

  /**
   * イージング関数（減速）
   */
  private easeOutQuad(t: number): number {
    return t * (2 - t);
  }

  /**
   * Rスキル中の無敵判定
   */
  isInvincible(): boolean {
    return this.rSkillInvincibilityRemaining > 0;
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
      const body = bullet.body as Phaser.Physics.Arcade.Body;
      if (body) {
        body.setVelocity(
          Math.cos(angle) * qConfig.BULLET_SPEED,
          Math.sin(angle) * qConfig.BULLET_SPEED
        );
      }
    }

    console.log(`Rumia Q(Spell): ${wayCount}方向弾発射`);
  }

  // ========================================
  // スペルカード用Eスキル「闇の潮汐」
  // ========================================

  /**
   * スペルカード用Eスキル使用を試みる
   */
  private tryUseSpellCardESkill(): void {
    const eConfig = this.currentSkillConfig.E;

    if (this.startSkill(BossSkillSlot.E, eConfig.CAST_TIME, 0)) {
      console.log(`Rumia: スペルカードEスキル詠唱開始 - ${eConfig.NAME}`);
    }
  }

  /**
   * スペルカード用Eスキル詠唱更新
   */
  private updateSpellCardESkillCasting(delta: number): void {
    const eSkill = this.skills.get(BossSkillSlot.E);
    if (!eSkill) return;

    eSkill.castTimeRemaining -= delta;

    if (eSkill.castTimeRemaining <= 0) {
      // 詠唱完了 → 実行開始
      eSkill.state = BossSkillState.EXECUTING;
      const spiralDuration = this.currentSkillConfig.E.SPIRAL_DURATION ?? 2000;
      eSkill.executionTimeRemaining = spiralDuration;
      this.spellESkillStartTime = this.scene.time.now;
      this.spellESkillBulletTimer = 0;
      this.spellESkillBaseAngle = Math.random() * Math.PI * 2; // ランダムな開始角度
      console.log('Rumia: スペルカードEスキル発動!');
    }
  }

  /**
   * スペルカード用Eスキル実行更新（螺旋弾幕）
   */
  private updateSpellCardESkillExecution(time: number, delta: number): void {
    const eSkill = this.skills.get(BossSkillSlot.E);
    if (!eSkill) return;

    const eConfig = this.currentSkillConfig.E;
    const bulletInterval = eConfig.BULLET_FIRE_INTERVAL ?? 150;

    // 弾発射タイマー
    this.spellESkillBulletTimer += delta;
    if (this.spellESkillBulletTimer >= bulletInterval) {
      this.fireSpellCardESkillBullets(time);
      this.spellESkillBulletTimer = 0;
    }

    // 実行時間更新
    eSkill.executionTimeRemaining -= delta;

    if (eSkill.executionTimeRemaining <= 0) {
      this.completeSkill(BossSkillSlot.E, eConfig.COOLDOWN);
      console.log('Rumia: スペルカードEスキル完了');
    }
  }

  /**
   * スペルカード用Eスキルの弾発射（8方向スパイラル）
   * kShotのVIOLET小丸弾を使用
   */
  private fireSpellCardESkillBullets(time: number): void {
    if (!this.bulletPool) return;

    const eConfig = this.currentSkillConfig.E;
    const spiralArms = eConfig.SPIRAL_ARMS ?? 8;
    const bulletSpeed = eConfig.BULLET_SPEED ?? 165;
    const rotationSpeed = eConfig.ROTATION_SPEED ?? 1.5;
    const damage = eConfig.DAMAGE.BASE + this.stats.attackPower * eConfig.DAMAGE.RATIO;

    // 経過時間から回転角度を計算
    const elapsed = time - this.spellESkillStartTime;
    const elapsedSec = elapsed / 1000;
    const rotationAngle = this.spellESkillBaseAngle + (rotationSpeed * elapsedSec);

    // 8方向に発射
    for (let i = 0; i < spiralArms; i++) {
      const bullet = this.bulletPool.acquire();
      if (!bullet) continue;

      // 各腕の角度（360度を8分割 + 回転角度）
      const angle = (i / spiralArms) * Math.PI * 2 + rotationAngle;
      const targetX = this.x + Math.cos(angle) * 1000;
      const targetY = this.y + Math.sin(angle) * 1000;

      // kShotのVIOLET小丸弾を使用
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
      const body = bullet.body as Phaser.Physics.Arcade.Body;
      if (body) {
        body.setVelocity(
          Math.cos(angle) * bulletSpeed,
          Math.sin(angle) * bulletSpeed
        );
      }
    }
  }

  // ========================================
  // スペルカード用Wスキル「トリプルバースト」
  // ========================================

  /**
   * スペルカード用Wスキル使用を試みる
   */
  private tryUseSpellCardWSkill(): void {
    const wConfig = this.currentSkillConfig.W;

    // トリプルバースト用設定があるか確認
    if (!wConfig.BURST_COUNT) return;

    if (this.startSkill(BossSkillSlot.W, wConfig.CAST_TIME, 0)) {
      console.log(`Rumia: スペルカードWスキル詠唱開始 - ${wConfig.NAME}`);
    }
  }

  /**
   * スペルカード用Wスキル詠唱更新
   */
  private updateSpellCardWSkillCasting(delta: number): void {
    const wSkill = this.skills.get(BossSkillSlot.W);
    if (!wSkill) return;

    wSkill.castTimeRemaining -= delta;

    if (wSkill.castTimeRemaining <= 0) {
      // 詠唱完了 → 実行開始
      wSkill.state = BossSkillState.EXECUTING;
      const burstCount = this.currentSkillConfig.W.BURST_COUNT ?? 3;
      const burstInterval = this.currentSkillConfig.W.BURST_INTERVAL ?? 300;
      wSkill.executionTimeRemaining = burstCount * burstInterval + 100;
      this.spellWSkillBurstsFired = 0;
      this.spellWSkillBurstTimer = burstInterval; // すぐに最初の発射
      console.log('Rumia: スペルカードWスキル発動!');
    }
  }

  /**
   * スペルカード用Wスキル実行更新（Qスキル3連射）
   */
  private updateSpellCardWSkillExecution(_time: number, delta: number): void {
    const wSkill = this.skills.get(BossSkillSlot.W);
    if (!wSkill) return;

    const wConfig = this.currentSkillConfig.W;
    const burstCount = wConfig.BURST_COUNT ?? 3;
    const burstInterval = wConfig.BURST_INTERVAL ?? 300;

    // 発射タイマー更新
    this.spellWSkillBurstTimer += delta;

    // Q弾幕を発射
    if (this.spellWSkillBurstsFired < burstCount &&
        this.spellWSkillBurstTimer >= burstInterval) {
      this.fireSpellCardWSkillBurst();
      this.spellWSkillBurstsFired++;
      this.spellWSkillBurstTimer = 0;
    }

    // 実行時間更新
    wSkill.executionTimeRemaining -= delta;

    if (wSkill.executionTimeRemaining <= 0) {
      this.completeSkill(BossSkillSlot.W, wConfig.COOLDOWN);
      console.log('Rumia: スペルカードWスキル完了');
    }
  }

  /**
   * スペルカード用WスキルでQ弾幕を発射（Qより弾速速い）
   * kShotのPURPLE大丸弾を使用
   */
  private fireSpellCardWSkillBurst(): void {
    if (!this.bulletPool) return;

    const qConfig = this.currentSkillConfig.Q;
    const wConfig = this.currentSkillConfig.W;
    const wayCount = qConfig.WAY_COUNT ?? 12;
    const damage = wConfig.DAMAGE.BASE + this.stats.attackPower * wConfig.DAMAGE.RATIO;
    // W専用の弾速（設定がなければQの弾速を使用）
    const bulletSpeed = wConfig.BULLET_SPEED ?? qConfig.BULLET_SPEED;

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

      // 弾速を設定（W専用の弾速を使用）
      const body = bullet.body as Phaser.Physics.Arcade.Body;
      if (body) {
        body.setVelocity(
          Math.cos(angle) * bulletSpeed,
          Math.sin(angle) * bulletSpeed
        );
      }
    }

    console.log(`Rumia W(Spell): バースト${this.spellWSkillBurstsFired + 1}発射 (弾速: ${bulletSpeed})`);
  }

  /**
   * Wスキルのレーザーを描画
   */
  private drawWSkillLasers(): void {
    if (!this.wSkillLaserGraphics) return;

    this.wSkillLaserGraphics.clear();

    const laserWidth = this.currentSkillConfig.W.LASER_WIDTH ?? 30;
    const laserLength = this.currentSkillConfig.W.LASER_LENGTH ?? 800;

    // レーザー本体（赤）
    this.wSkillLaserGraphics.fillStyle(0xff0000, 0.8);

    for (const angle of this.wSkillLaserAngles) {
      this.drawLaserRect(angle, laserWidth, laserLength, true);
    }

    // レーザー輪郭（白）
    this.wSkillLaserGraphics.lineStyle(2, 0xffffff, 1);
    for (const angle of this.wSkillLaserAngles) {
      this.drawLaserRect(angle, laserWidth, laserLength, false);
    }
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
   * レーザー矩形を描画（プレイエリア内にクリップ）
   */
  private drawLaserRect(angle: number, width: number, length: number, fill: boolean): void {
    if (!this.wSkillLaserGraphics) return;

    const { X, Y, WIDTH, HEIGHT } = GAME_CONFIG.PLAY_AREA;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const halfWidth = width / 2;

    // 矩形の4頂点を計算（レーザーは進行方向に伸びる）
    const perpX = -sin * halfWidth;
    const perpY = cos * halfWidth;

    const corners = [
      { x: this.x + perpX, y: this.y + perpY },
      { x: this.x - perpX, y: this.y - perpY },
      { x: this.x + cos * length - perpX, y: this.y + sin * length - perpY },
      { x: this.x + cos * length + perpX, y: this.y + sin * length + perpY },
    ];

    // プレイエリア内にクリップ
    const clippedCorners = corners.map(c => ({
      x: Phaser.Math.Clamp(c.x, X, X + WIDTH),
      y: Phaser.Math.Clamp(c.y, Y, Y + HEIGHT),
    }));

    this.wSkillLaserGraphics.beginPath();
    this.wSkillLaserGraphics.moveTo(clippedCorners[0].x, clippedCorners[0].y);
    this.wSkillLaserGraphics.lineTo(clippedCorners[1].x, clippedCorners[1].y);
    this.wSkillLaserGraphics.lineTo(clippedCorners[2].x, clippedCorners[2].y);
    this.wSkillLaserGraphics.lineTo(clippedCorners[3].x, clippedCorners[3].y);
    this.wSkillLaserGraphics.closePath();

    if (fill) {
      this.wSkillLaserGraphics.fillPath();
    } else {
      this.wSkillLaserGraphics.strokePath();
    }
  }

  /**
   * 予告線を描画
   */
  protected drawWarningLines(): void {
    if (!this.warningGraphics) return;

    this.warningGraphics.clear();

    const qSkill = this.skills.get(BossSkillSlot.Q);
    const wSkill = this.skills.get(BossSkillSlot.W);

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
        const alpha = 0.3 + progress * 0.5; // 0.3 → 0.8

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

    // Wスキル詠唱中の予告線（レーザー位置）- ノーマルフェーズのみ
    const laserLength = this.currentSkillConfig.W.LASER_LENGTH;
    if (wSkill && wSkill.state === BossSkillState.CASTING && laserLength) {
      this.warningGraphics.lineStyle(3, 0xff6600, 0.5);

      for (const angle of this.wSkillLaserAngles) {
        const endX = this.x + Math.cos(angle) * laserLength;
        const endY = this.y + Math.sin(angle) * laserLength;

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
    const speed = this.stats.moveSpeed;

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
    this.setScale(0.2);

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

    // レーザーグラフィックスをクリア
    this.wSkillLaserGraphics?.clear();
    this.wSkillLaserAngles = [];
    this.wSkillDamageApplied = false;

    // Eスキルの弾をクリア
    this.eSkillRingBullets = [];
    this.eSkillWavesFired = 0;
    this.eSkillWaveTimer = 0;
  }

  /**
   * 被弾エフェクト（コマアニメーション用にオーバーライド）
   */
  protected flashDamage(): void {
    this.setTint(0xff0000); // 赤くフラッシュ
    this.scene.time.delayedCall(100, () => {
      if (this.isActive) {
        // コマアニメーションを使用しているのでTintをクリア
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
    const statusEffects = this.getStatusEffects();
    const existingIndex = statusEffects.findIndex(e => e.type === effect.type);
    if (existingIndex >= 0) {
      statusEffects[existingIndex] = effect;
    } else {
      statusEffects.push(effect);
    }

    // スタンの視覚エフェクト（黄色）
    if (effect.type === StatusEffectType.STUN) {
      this.setTint(0xffff00);
      this.setVelocity(0, 0);
    }
  }

  /**
   * 非アクティブ化
   */
  deactivate(): void {
    super.deactivate();
    this.wSkillLaserGraphics?.clear();
  }

  /**
   * 破棄
   */
  destroy(fromScene?: boolean): void {
    this.wSkillLaserGraphics?.destroy();
    super.destroy(fromScene);
  }
}
