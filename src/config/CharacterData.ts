import { CharacterType, CharacterConfig, CharacterStats } from '@/types';

/**
 * キャラクターの基本ステータス定義
 */
const REIMU_STATS: CharacterStats = {
  maxHp: 100,
  moveSpeed: 300,           // ピクセル/秒
  attackDamage: 10,
  attackSpeed: 10,           // 1秒に10回攻撃（0.1秒クールダウン）
  attackRange: 150,         // 攻撃範囲を半分に調整
  hitboxRadius: 8,           // 当たり判定は小さめ（弾幕回避のため）
};

const MARISA_STATS: CharacterStats = {
  maxHp: 80,
  moveSpeed: 320,
  attackDamage: 15,
  attackSpeed: 1.5,
  attackRange: 250,
  hitboxRadius: 8,
};

const SAKUYA_STATS: CharacterStats = {
  maxHp: 90,
  moveSpeed: 280,
  attackDamage: 12,
  attackSpeed: 3,
  attackRange: 200,
  hitboxRadius: 8,
};

const YOUMU_STATS: CharacterStats = {
  maxHp: 110,
  moveSpeed: 310,
  attackDamage: 8,
  attackSpeed: 2.5,
  attackRange: 150,
  hitboxRadius: 8,
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
