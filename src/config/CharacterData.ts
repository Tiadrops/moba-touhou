import { CharacterType, CharacterConfig, CharacterStats, EnemyType, EnemyStats } from '@/types';

/**
 * キャラクターの基本ステータス定義
 * 新戦闘システム対応: attackPower, aaMultiplier, defense, critChance
 */
const REIMU_STATS: CharacterStats = {
  maxHp: 100,
  attackPower: 100,          // テスト用: 攻撃力100
  aaMultiplier: 0,           // テスト用: AAダメージ増幅0
  defense: 5,                // 防御力
  attackSpeed: 2.0,          // 1秒に2回攻撃（0.5秒クールダウン）
  critChance: 0,             // テスト用: クリティカル確率0
  moveSpeed: 300,            // ピクセル/秒
  attackRange: 150,          // 攻撃範囲
  hitboxRadius: 8,           // 当たり判定は小さめ（弾幕回避のため）
};

const MARISA_STATS: CharacterStats = {
  maxHp: 80,
  attackPower: 15,           // 高火力
  aaMultiplier: 1.2,         // AAダメージ増幅（120%）
  defense: 0,                // 防御力なし
  attackSpeed: 1.5,
  critChance: 0.10,          // クリティカル確率 10%
  moveSpeed: 320,
  attackRange: 250,
  hitboxRadius: 8,
};

const SAKUYA_STATS: CharacterStats = {
  maxHp: 90,
  attackPower: 12,
  aaMultiplier: 0.9,         // AAダメージ増幅（90%）手数で補う
  defense: 3,
  attackSpeed: 3.0,          // 高速攻撃
  critChance: 0.15,          // クリティカル確率 15%
  moveSpeed: 280,
  attackRange: 200,
  hitboxRadius: 8,
};

const YOUMU_STATS: CharacterStats = {
  maxHp: 110,
  attackPower: 8,
  aaMultiplier: 1.3,         // AAダメージ増幅（130%）近接ボーナス
  defense: 10,               // 高防御
  attackSpeed: 2.5,
  critChance: 0.20,          // クリティカル確率 20%（剣士）
  moveSpeed: 310,
  attackRange: 150,
  hitboxRadius: 8,
};

/**
 * 敵のステータス定義
 */
export const ENEMY_STATS: Record<EnemyType, EnemyStats> = {
  [EnemyType.NORMAL]: {
    maxHp: 1000,
    attackPower: 10,
    aaMultiplier: 1.0,
    defense: 0,
    attackSpeed: 1.0,
    critChance: 0,
    moveSpeed: 100,
    hitboxRadius: 12,
    scoreValue: 100,
  },
  [EnemyType.ELITE]: {
    maxHp: 100,
    attackPower: 20,
    aaMultiplier: 1.0,
    defense: 10,
    attackSpeed: 1.2,
    critChance: 0,
    moveSpeed: 80,
    hitboxRadius: 16,
    scoreValue: 300,
  },
  [EnemyType.MINI_BOSS]: {
    maxHp: 5000,             // テスト用: HP5000
    attackPower: 30,
    aaMultiplier: 1.0,
    defense: 100,            // テスト用: 防御力100（50%軽減）
    attackSpeed: 1.5,
    critChance: 0.05,
    moveSpeed: 0,            // テスト用: 移動しない
    hitboxRadius: 24,
    scoreValue: 1000,
  },
  [EnemyType.BOSS]: {
    maxHp: 2000,
    attackPower: 50,
    aaMultiplier: 1.2,
    defense: 50,
    attackSpeed: 2.0,
    critChance: 0.10,
    moveSpeed: 30,
    hitboxRadius: 32,
    scoreValue: 5000,
  },
};

/**
 * キャラクター設定（スキルは後で実装）
 */
export const CHARACTER_DATA: Record<CharacterType, CharacterConfig> = {
  [CharacterType.REIMU]: {
    type: CharacterType.REIMU,
    name: '博麗 霊夢',
    stats: REIMU_STATS,
    skills: {
      Q: {
        id: 'reimu_q',
        name: '霊符「夢想封印」',
        description: '前方に追尾弾を発射',
        cooldown: 5000,
      },
      W: {
        id: 'reimu_w',
        name: '夢符「封魔陣」',
        description: '周囲の敵にダメージ',
        cooldown: 8000,
      },
      E: {
        id: 'reimu_e',
        name: '神技「八方龍殺陣」',
        description: '8方向に弾を発射',
        cooldown: 10000,
      },
      R: {
        id: 'reimu_r',
        name: '夢想天生',
        description: '無敵になり周囲を攻撃',
        cooldown: 60000,
      },
    },
  },
  [CharacterType.MARISA]: {
    type: CharacterType.MARISA,
    name: '霧雨 魔理沙',
    stats: MARISA_STATS,
    skills: {
      Q: {
        id: 'marisa_q',
        name: '魔符「ミルキーウェイ」',
        description: '直線レーザーを発射',
        cooldown: 4000,
      },
      W: {
        id: 'marisa_w',
        name: '恋符「マスタースパーク」',
        description: '極太レーザー',
        cooldown: 12000,
      },
      E: {
        id: 'marisa_e',
        name: 'イリュージョンレーザー',
        description: '複数のレーザーを展開',
        cooldown: 10000,
      },
      R: {
        id: 'marisa_r',
        name: 'ファイナルスパーク',
        description: '超強力なレーザー',
        cooldown: 60000,
      },
    },
  },
  [CharacterType.SAKUYA]: {
    type: CharacterType.SAKUYA,
    name: '十六夜 咲夜',
    stats: SAKUYA_STATS,
    skills: {
      Q: {
        id: 'sakuya_q',
        name: '幻在「クロックコープス」',
        description: 'ナイフを投げる',
        cooldown: 3000,
      },
      W: {
        id: 'sakuya_w',
        name: '時符「プライベートスクウェア」',
        description: '時間を遅くする',
        cooldown: 15000,
      },
      E: {
        id: 'sakuya_e',
        name: 'メイド秘技「操りドール」',
        description: 'ナイフの雨を降らせる',
        cooldown: 10000,
      },
      R: {
        id: 'sakuya_r',
        name: '「ザ・ワールド」',
        description: '時間を止める',
        cooldown: 60000,
      },
    },
  },
  [CharacterType.YOUMU]: {
    type: CharacterType.YOUMU,
    name: '魂魄 妖夢',
    stats: YOUMU_STATS,
    skills: {
      Q: {
        id: 'youmu_q',
        name: '剣技「桜花閃々」',
        description: '高速斬撃',
        cooldown: 4000,
      },
      W: {
        id: 'youmu_w',
        name: '人鬼「未来永劫斬」',
        description: '広範囲斬撃',
        cooldown: 10000,
      },
      E: {
        id: 'youmu_e',
        name: '魂魄「幽明の苦輪」',
        description: '半霊を飛ばす',
        cooldown: 8000,
      },
      R: {
        id: 'youmu_r',
        name: '「無想三段」',
        description: '3回連続で瞬間移動斬り',
        cooldown: 60000,
      },
    },
  },
};

/**
 * デフォルトキャラクター
 */
export const DEFAULT_CHARACTER = CharacterType.REIMU;
