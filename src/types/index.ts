/**
 * ゲーム全体で使用する型定義
 */

// プレイヤーの位置情報
export interface Position {
  x: number;
  y: number;
}

// ゲームの難易度
export enum Difficulty {
  EASY = 'easy',
  NORMAL = 'normal',
  HARD = 'hard',
}

// キャラクタータイプ
export enum CharacterType {
  REIMU = 'reimu',
  MARISA = 'marisa',
  SAKUYA = 'sakuya',
  YOUMU = 'youmu',
}

// スキルスロット
export enum SkillSlot {
  Q = 'Q',
  W = 'W',
  E = 'E',
  R = 'R',
  D = 'D',
  F = 'F',
}

// プレイヤー選択スキル（D/Fスロット）- サモナースキル
export enum PlayerSkillType {
  FLASH = 'flash',              // フラッシュ - 3m以内のカーソル位置にワープ
  SPIRIT_STRIKE = 'spirit',     // 霊撃 - 5.5m範囲に0.1秒スタン
  GUARD_COUNTER = 'guard',      // ガード反撃 - 0.75秒防御態勢→3m移動
  CONTROL_ROD = 'control',      // 制御棒 - 5秒間射程+1.5m、攻撃力+10%
  TENGU_FAN = 'tengu',          // 天狗団扇 - 5.5m以内の敵弾を消去
  BOOST = 'boost',              // ブースト - 検討中（選択不可）
}

// スキルの基本情報
export interface SkillData {
  id: string;
  name: string;
  description: string;
  cooldown: number;          // クールダウン時間（ミリ秒）
  manaCost?: number;         // 将来的にMPを追加する場合
}

// スキルの実行状態
export enum SkillState {
  READY = 'ready',           // 使用可能
  CASTING = 'casting',       // キャスト中
  EXECUTING = 'executing',   // 実行中（弾発射など）
  COOLDOWN = 'cooldown',     // クールダウン中
}

// スキル実行中の情報
export interface SkillExecution {
  skillSlot: SkillSlot;
  state: SkillState;
  castTimeRemaining: number;   // キャスト残り時間（ms）
  executionTimeRemaining: number; // 実行残り時間（ms）
  target?: Enemy;              // ターゲット（対象指定スキルの場合）
  targetPosition?: Position;   // ターゲット位置（方向指定スキルの場合）
}

// バフの種類
export enum BuffType {
  ATTACK_SPEED = 'attack_speed',
  MOVE_SPEED = 'move_speed',
  DAMAGE = 'damage',
  ATTACK_POWER = 'attack_power',
  AA_MULTIPLIER = 'aa_multiplier',
  DEFENSE = 'defense',
  CRIT_CHANCE = 'crit_chance',
  HARIBABA_STACK = 'haribaba_stack',  // 針巫女スタック
}

// バフ情報
export interface Buff {
  type: BuffType;
  multiplier: number;          // 倍率（1.5 = 50%上昇）
  remainingTime: number;       // 残り時間（ms）
  source: string;              // バフの発生源（スキルIDなど）
  stacks?: number;             // スタック数（スタック系バフ用）
}

// 状態異常の種類
export enum StatusEffectType {
  STUN = 'stun',               // スタン（移動不可、スキル使用不可）
  SLOW = 'slow',               // スロウ（移動速度低下）
  ROOT = 'root',               // ルート（移動不可、スキル使用可）
  SILENCE = 'silence',         // サイレンス（スキル使用不可）
  CC_IMMUNE = 'cc_immune',     // CC無効（スタン、スロウ、ルート、サイレンスを無効化）
}

// 状態異常情報
export interface StatusEffect {
  type: StatusEffectType;
  remainingTime: number;       // 残り時間（ms）
  source: string;              // 発生源（スキルIDなど）
  value?: number;              // 効果値（スロウの場合は移動速度低下率など）
}

// 前方参照用にEnemyをインポート不要にする
type Enemy = import('@/entities/Enemy').Enemy;

// 戦闘ステータス（共通）
export interface CombatStats {
  maxHp: number;
  attackPower: number;       // 攻撃力
  aaMultiplier: number;      // AAダメージ増幅（1.0 = 100%）
  defense: number;           // 防御力
  attackSpeed: number;       // 1秒あたりの攻撃回数
  critChance: number;        // クリティカル確率（0.0 - 1.0）
  moveSpeed: number;         // 移動速度（ピクセル/秒）
}

// キャラクターステータス（プレイヤー用）
export interface CharacterStats extends CombatStats {
  attackRange: number;       // 攻撃射程
  hitboxRadius: number;      // 当たり判定の半径
}

// 敵のステータス（敵用）
export interface EnemyStats extends CombatStats {
  hitboxRadius: number;      // 当たり判定の半径
  scoreValue: number;        // 撃破時のスコア
}

// キャラクター設定
export interface CharacterConfig {
  type: CharacterType;
  name: string;
  stats: CharacterStats;
  skills: {
    Q: SkillData;
    W: SkillData;
    E: SkillData;
    R: SkillData;
  };
}

// 敵の種類
export enum EnemyType {
  NORMAL = 'normal',
  ELITE = 'elite',
  MINI_BOSS = 'miniboss',
  BOSS = 'boss',
}

// 道中雑魚グループタイプ
export enum MobGroupType {
  GROUP_A = 'group_a',  // HP200, DEF0, ATK100
  GROUP_B = 'group_b',  // HP500, DEF0, ATK100
  GROUP_C = 'group_c',  // HP1500, DEF0, ATK100（フラグ持ち）
}

// 雑魚敵の退場方式
export type MobExitMode = 'fade_out' | 'move_to_edge' | 'none';

// 道中雑魚のステータス定義
export interface MobStats {
  maxHp: number;
  attackPower: number;
  defense: number;
  moveSpeed: number;
  hitboxRadius: number;
  scoreValue: number;
  expValue: number;         // 経験値
  survivalTime: number;     // 生存時間（ms）- -1は無制限
  isFlagCarrier: boolean;   // フラグ持ちかどうか（撃破でボス移行）
  exitMode: MobExitMode;    // 退場方式
}

// 敵の設定
export interface EnemyConfig {
  type: EnemyType;
  name: string;
  stats: EnemyStats;
}

// スキルダメージ設定
export interface SkillDamageConfig {
  baseDamage: number;        // 固定ダメージ
  scalingRatio: number;      // 攻撃力増幅率（0.0 - 2.0など）
  additionalMultiplier?: number;  // その他補正（デフォルト1.0）
}

// ダメージ結果
export interface DamageResult {
  rawDamage: number;         // 防御適用前ダメージ
  finalDamage: number;       // 最終ダメージ
  isCritical: boolean;       // クリティカル発動
  damageReduction: number;   // 防御による軽減率
}

// アイテムの種類
export enum ItemType {
  HP_SMALL = 'hp_small',
  HP_LARGE = 'hp_large',
  POWER_UP = 'power_up',
  SPEED_UP = 'speed_up',
  SHIELD = 'shield',
  SCORE = 'score',
  EXTRA_LIFE = 'extra_life',
}

// アイテム設定
export interface ItemConfig {
  type: ItemType;
  name: string;
  value: number;             // 回復量、スコア等
  duration?: number;         // バフの持続時間（ミリ秒）
}

// ゲームの状態
export interface GameState {
  score: number;
  lives: number;
  currentHp: number;
  maxHp: number;
  difficulty: Difficulty;
  selectedCharacter: CharacterType;
  selectedSkills: {
    D: PlayerSkillType;
    F: PlayerSkillType;
  };
  currentStage: number;
}

// スコアランク
export enum ScoreRank {
  S = 'S',
  A = 'A',
  B = 'B',
  C = 'C',
}

// ステージクリア結果
export interface StageResult {
  score: number;
  rank: ScoreRank;
  clearTime: number;         // クリアタイム（ミリ秒）
  livesRemaining: number;
  damagesTaken: number;
}

// 弾の種類
export enum BulletType {
  PLAYER_NORMAL = 'player_normal',
  ENEMY_NORMAL = 'enemy_normal',
  ENEMY_AIMED = 'enemy_aimed',
  ENEMY_LASER = 'enemy_laser',
}

// 弾の設定
export interface BulletConfig {
  type: BulletType;
  damage: number;
  speed: number;
  radius: number;            // 当たり判定の半径
  color?: number;            // 色（16進数）
}

// ボススキルのステート
export enum BossSkillState {
  READY = 'ready',           // 使用可能
  CASTING = 'casting',       // 詠唱中（予告表示）
  EXECUTING = 'executing',   // モーション中（弾発射中）
  COOLDOWN = 'cooldown',     // クールダウン中
}

// ボススキルスロット
export enum BossSkillSlot {
  Q = 'Q',
  W = 'W',
  E = 'E',
  R = 'R',
}

// ボススキル定義
export interface BossSkillConfig {
  slot: BossSkillSlot;
  name: string;
  castTime: number;          // 詠唱時間（ms）
  executionTime: number;     // モーション時間（ms）
  cooldown: number;          // クールダウン（ms）
  damage: {
    base: number;
    ratio: number;           // 攻撃力増幅率
  };
}

// ボススキル実行状態
export interface BossSkillExecution {
  slot: BossSkillSlot;
  state: BossSkillState;
  castTimeRemaining: number;
  executionTimeRemaining: number;
  cooldownRemaining: number;
  targetAngle?: number;      // 発射方向（ラジアン）
}

// ボスタイプ
export enum BossType {
  RUMIA = 'rumia',
  // 今後追加
}

// ボスステータス
export interface BossStats {
  maxHp: number;
  attackPower: number;
  defense: number;
  moveSpeed: number;
  hitboxRadius: number;
}

/**
 * 攻撃可能なエンティティの共通インターフェース
 * Enemy と Boss の両方が実装する
 */
export interface Attackable {
  x: number;
  y: number;
  getIsActive(): boolean;
  getDefense(): number;
  getHitboxRadius(): number;
  takeDamage(damage: number): boolean;
}

/**
 * ボスフェーズシステム関連の型定義
 */

// フェーズの種類
export enum BossPhaseType {
  NORMAL = 'normal',       // 通常フェーズ
  SPELL_CARD = 'spell',    // スペルカードフェーズ
}

// フェーズ定義
export interface BossPhaseConfig {
  name: string;            // フェーズ名（スペルカード名）
  type: BossPhaseType;     // フェーズの種類
  hp: number;              // このフェーズのHP
  isFinal: boolean;        // 最終フェーズかどうか
}

// フェーズ実行状態
export interface BossPhaseExecution {
  phaseIndex: number;      // 現在のフェーズインデックス
  currentHp: number;       // 現在のHP
  maxHp: number;           // このフェーズの最大HP
  isTransitioning: boolean; // フェーズ遷移中かどうか
}

// カットイン演出の状態
export enum CutInState {
  IDLE = 'idle',           // 非表示
  ENTERING = 'entering',   // 登場アニメーション中
  DISPLAYING = 'displaying', // 表示中
  EXITING = 'exiting',     // 退場アニメーション中
}

// ========================================
// シーン遷移システム関連の型定義
// ========================================

// ゲームモード
export enum GameMode {
  ARCADE = 'arcade',
  PRACTICE = 'practice',
}

// 練習モードの練習対象
export enum PracticeTarget {
  FULL = 'full',           // ステージ全体（道中 + ボス）
  BOSS = 'boss',           // ボスのみ
  ROUTE = 'route',         // 道中のみ
}

// 練習モードオプション
export interface PracticeOptions {
  infiniteLives: boolean;     // 残機無限
  invincible: boolean;        // 無敵モード
  slowMode: boolean;          // スローモーション
  showHitbox: boolean;        // 当たり判定表示
  startFromPhase?: number;    // 特定フェーズから開始（ボス練習時）
}

// 練習モード設定
export interface PracticeModeConfig {
  stageNumber: number;
  practiceTarget: PracticeTarget;
  options: PracticeOptions;
}

// サモナースキル設定
export interface SummonerSkillConfig {
  D: PlayerSkillType;
  F: PlayerSkillType;
}

// SetupScene → StageIntroScene へのデータ
export interface StageIntroData {
  mode: GameMode;
  character: CharacterType;
  difficulty: Difficulty;
  stageNumber: number;
  // アーケードモード継続時
  continueData?: {
    score: number;
    lives: number;
  };
  // 練習モード専用
  practiceConfig?: PracticeModeConfig;
}

// StageIntroScene → GameScene へのデータ
export interface GameStartData {
  mode: GameMode;
  character: CharacterType;
  difficulty: Difficulty;
  stageNumber: number;
  summonerSkills?: SummonerSkillConfig;
  // アーケードモード継続時
  continueData?: {
    score: number;
    lives: number;
  };
  // 練習モード専用
  practiceConfig?: PracticeModeConfig;
  // デバッグ用: 開始Wave指定
  debugWaveStart?: WaveId;
}

// GameScene → ResultScene へのデータ
export interface ResultData {
  mode: GameMode;
  stageNumber: number;
  score: number;
  time: number;
  kills: number;
  damageTaken: number;
  lives: number;
  maxCombo: number;
  rank: ScoreRank;
  isHighScore: boolean;
  // 次ステージ用（ResultScene → StageIntroScene）
  nextStageData?: StageIntroData;
}

// ステージ情報
export interface StageInfo {
  number: number;
  name: string;
  bossName: string;
  bossTitle: string;
  hint: string;
  isUnlocked: boolean;
}

// ========================================
// 道中Waveシステム関連の型定義
// ========================================

/**
 * Wave ID (x-y-z形式)
 * x: ステージ番号
 * y: 道中Wave番号
 * z: Wave内の枝番（サブウェーブ）
 */
export interface WaveId {
  stage: number;      // x: ステージ番号
  wave: number;       // y: 道中Wave番号
  subWave: number;    // z: 枝番（サブウェーブ）
}

/**
 * Wave報酬の種類
 */
export enum WaveRewardType {
  HP_RECOVER = 'hp_recover',    // HP回復（即時）
  EXTRA_LIFE = 'extra_life',    // 残機追加
  SCORE_BONUS = 'score_bonus',  // スコアボーナス
}

/**
 * Wave報酬設定
 */
export interface WaveReward {
  type: WaveRewardType;
  value: number;              // 回復量、残機数、スコア値など
  displayName: string;        // 表示名
}

/**
 * Waveクリア条件
 */
export enum WaveClearCondition {
  FLAG_CARRIER_DEFEATED = 'flag_carrier_defeated',  // フラグ持ち撃破
  ALL_ENEMIES_DEFEATED = 'all_enemies_defeated',    // 全敵撃破
  TIME_ELAPSED = 'time_elapsed',                    // 時間経過
}

/**
 * Wave実行状態
 */
export enum WaveState {
  WAITING = 'waiting',          // 開始待ち
  ACTIVE = 'active',            // 実行中
  CLEARING = 'clearing',        // クリア演出中
  COMPLETED = 'completed',      // 完了
}

/**
 * Wave設定
 */
export interface WaveConfig {
  id: WaveId;
  clearCondition: WaveClearCondition;
  rewards: WaveReward[];
  isFinalWave: boolean;         // 最終Waveかどうか（trueならボス戦へ）
  clearIntervalMs: number;      // クリア後インターバル（ms）
}

/**
 * Wave実行情報
 */
export interface WaveExecution {
  config: WaveConfig;
  state: WaveState;
  startTime: number;            // Wave開始時刻
  clearTime?: number;           // クリア時刻
  score: number;                // このWaveで獲得したスコア
}
