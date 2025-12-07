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
}

// バフ情報
export interface Buff {
  type: BuffType;
  multiplier: number;          // 倍率（1.5 = 50%上昇）
  remainingTime: number;       // 残り時間（ms）
  source: string;              // バフの発生源（スキルIDなど）
}

// 前方参照用にEnemyをインポート不要にする
type Enemy = import('@/entities/Enemy').Enemy;

// キャラクターステータス
export interface CharacterStats {
  maxHp: number;
  moveSpeed: number;
  attackDamage: number;
  attackSpeed: number;       // 1秒あたりの攻撃回数
  attackRange: number;
  hitboxRadius: number;      // 当たり判定の半径
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
  hp: number;
  damage: number;
  moveSpeed: number;
  scoreValue: number;
  hitboxRadius: number;
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
