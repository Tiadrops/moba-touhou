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

// プレイヤー選択スキル（D/Fスロット）
export enum PlayerSkillType {
  FLASH = 'flash',           // 瞬間移動
  SHIELD = 'shield',         // シールド生成
  TIME_STOP = 'timestop',    // 時間停止
  BOMB = 'bomb',             // 弾幕消去（ボム）
  HEAL = 'heal',             // HP回復
  DAMAGE_BOOST = 'boost',    // ダメージブースト
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
}

// バフ情報
export interface Buff {
  type: BuffType;
  multiplier: number;          // 倍率（1.5 = 50%上昇）
  remainingTime: number;       // 残り時間（ms）
  source: string;              // バフの発生源（スキルIDなど）
}

// 状態異常の種類
export enum StatusEffectType {
  STUN = 'stun',               // スタン（移動不可、スキル使用不可）
  SLOW = 'slow',               // スロウ（移動速度低下）
  ROOT = 'root',               // ルート（移動不可、スキル使用可）
  SILENCE = 'silence',         // サイレンス（スキル使用不可）
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
