import Phaser from 'phaser';

/**
 * Phaserゲームの基本設定
 */
export const GAME_CONFIG = {
  // 画面サイズ
  WIDTH: 1920,
  HEIGHT: 1080,

  // ゲームプレイエリア（実際の弾幕が表示される領域）
  PLAY_AREA: {
    WIDTH: 800,
    HEIGHT: 1000,
    X: 560,  // (1920 - 800) / 2 = 560
    Y: 40,
  },

  // パフォーマンス設定
  TARGET_FPS: 60,
  MAX_BULLETS: 500,
  MAX_ENEMIES: 50,
  MAX_EFFECTS: 100,

  // デバッグモード
  DEBUG: true,

  // 弾道軌跡線の表示設定
  SHOW_BULLET_TRAILS: false,  // false にすると軌跡線を非表示
} as const;

/**
 * ゲームプレイの定数
 */
export const GAMEPLAY_CONFIG = {
  // プレイヤー設定
  PLAYER: {
    INITIAL_LIVES: 3,
    RESPAWN_INVINCIBILITY_TIME: 2000, // 2秒
  },

  // スクロール設定
  SCROLL: {
    BORDER_DAMAGE: 10,                // 後方境界に触れた時のダメージ
    BORDER_PUSH_SPEED: 50,            // 境界が前進する速度（px/秒）
  },

  // アイテム設定
  ITEM: {
    AUTO_COLLECT_RADIUS: 50,          // 自動吸引の範囲
    DROP_SPEED: 100,                  // アイテムの落下速度
  },
} as const;

/**
 * 物理演算の設定
 */
export const PHYSICS_CONFIG: Phaser.Types.Physics.Arcade.ArcadeWorldConfig = {
  gravity: { x: 0, y: 0 },
  debug: false,  // 物理デバッグ表示を無効化（緑の線を消す）
  debugShowBody: false,
  debugShowStaticBody: false,
};

/**
 * 色の定義
 */
export const COLORS = {
  BACKGROUND: 0x1a1a2e,
  PLAY_AREA_BG: 0x0f0f1e,
  PLAY_AREA_BORDER: 0x4a4a6a,

  PLAYER: 0x00ff88,
  ENEMY: 0xff4444,

  BULLET_PLAYER: 0x00ffff,  // シアン（味方弾 - 視認性向上）
  BULLET_ENEMY: 0xff6600,   // オレンジ（敵弾）

  // 弾道補助線専用の色
  TRAIL_PLAYER: 0x00ff00,   // 緑（味方弾の軌跡）
  TRAIL_ENEMY: 0xff00ff,    // マゼンタ（敵弾の軌跡）- 視認性向上

  UI_TEXT: 0xffffff,
  UI_HP_BAR: 0x00ff00,
  UI_HP_BAR_BG: 0x333333,
} as const;

/**
 * レイヤー深度の定義（描画順序）
 */
export const DEPTH = {
  BACKGROUND: 0,
  PLAY_AREA: 1,
  ITEMS: 10,
  BULLETS_ENEMY: 20,
  PLAYER: 30,
  ENEMIES: 40,
  BULLETS_PLAYER: 50, // プレイヤー弾を最前面に
  EFFECTS: 60,
  UI: 100,
} as const;

/**
 * シーン名の定義
 */
export const SCENES = {
  BOOT: 'BootScene',
  TITLE: 'TitleScene',
  MODE_SELECT: 'ModeSelectScene',
  ARCADE_SETUP: 'ArcadeSetupScene',
  PRACTICE_SETUP: 'PracticeSetupScene',
  STAGE_INTRO: 'StageIntroScene',
  GAME: 'GameScene',
  PAUSE: 'PauseScene',
  RESULT: 'ResultScene',
  GAME_OVER: 'GameOverScene',
  OPTION: 'OptionScene',
  CREDIT: 'CreditScene',
  // デバッグ用シーン
  DEBUG_ROOM: 'DebugRoomScene',
  BULLET_TEST: 'BulletTestScene',
} as const;

/**
 * 単位変換定数
 * 1m = 55px
 */
export const UNIT = {
  METER_TO_PIXEL: 55,
} as const;

/**
 * スキル設定
 */
export const SKILL_CONFIG = {
  // 霊夢のQスキル
  REIMU_Q: {
    CAST_TIME: 200,              // キャスト時間（ms）
    PROJECTILE_COUNT: 3,         // 発射弾数
    PROJECTILE_INTERVAL: 100,    // 弾の発射間隔（ms）
    ATTACK_SPEED_BUFF: 1.5,      // AS上昇倍率（50%上昇）
    BUFF_DURATION: 5000,         // バフ持続時間（ms）
    COOLDOWN: 7000,              // クールダウン（ms）
    TARGET_DETECTION_RANGE: 0.5 * 55, // ターゲット検出範囲（0.5m = 27.5px）
    // スキルダメージ設定（テスト用: 固定100 + 攻撃力100% = 200/発, 3発で600）
    DAMAGE: {
      BASE_DAMAGE: 100,          // 固定ダメージ
      SCALING_RATIO: 1.0,        // 攻撃力増幅率（100%）
    },
  },
  // 霊夢のWスキル（封魔陣）
  REIMU_W: {
    CAST_TIME: 250,              // キャスト時間（ms）
    MOTION_TIME: 150,            // スキルモーション硬直（ms）
    PROJECTILE_WIDTH: 0.5 * 55,  // 弾の幅（0.5m = 27.5px）
    PROJECTILE_HEIGHT: 0.75 * 55, // 弾の高さ（0.75m = 41.25px）
    PROJECTILE_RANGE: 7 * 55,    // 射程（7m = 385px）
    PROJECTILE_TRAVEL_TIME: 400, // 最大射程到達時間（ms）
    STUN_DURATION: 500,          // スタン時間（ms）
    COOLDOWN: 7000,              // クールダウン（ms）
    // スキルダメージ設定（テスト用: 固定100 + 攻撃力10% = 110/発）
    DAMAGE: {
      BASE_DAMAGE: 100,          // 固定ダメージ
      SCALING_RATIO: 0.1,        // 攻撃力増幅率（10%）
    },
  },
  // 霊夢のEスキル
  REIMU_E: {
    CAST_TIME: 100,              // キャスト時間（ms）
    DASH_DISTANCE: 3 * 55,       // ダッシュ距離（3m = 165px）
    DASH_DURATION: 300,          // ダッシュ所要時間（ms）
    COOLDOWN: 10000,             // クールダウン（ms）
  },
  // 霊夢のRスキル（夢想天生）
  REIMU_R: {
    DURATION: 2000,              // 効果時間（ms）
    AREA_SIZE: 10 * 55,          // 範囲サイズ（10m = 550px、正方形の一辺）
    DAMAGE_INTERVAL: 200,        // ダメージ間隔（ms）
    COOLDOWN: 60000,             // クールダウン（ms）
    // スキルダメージ設定（デバッグ用: 10倍に増加）
    DAMAGE: {
      BASE_DAMAGE: 2000,         // 固定ダメージ（10倍）
      SCALING_RATIO: 5.0,        // 攻撃力増幅率（500%）
    },
  },
} as const;

/**
 * ボス設定
 */
export const BOSS_CONFIG = {
  // ルーミア（ステージ1ボス）
  RUMIA: {
    // 基本ステータス（全フェーズ共通）
    ATK: 25,
    DEF: 50,                     // 約33%ダメージ軽減
    MOVE_SPEED: 120,
    HITBOX_RADIUS: 40,

    // フェーズ定義
    PHASES: [
      {
        NAME: 'ノーマル',
        TYPE: 'normal' as const,
        HP: 5000,
        IS_FINAL: false,
      },
      {
        NAME: '闇符「ダークサイドオブザムーン」',
        TYPE: 'spell' as const,
        HP: 4000,
        IS_FINAL: true,
      },
    ],

    // ノーマルフェーズのスキル
    PHASE_0_SKILLS: {
      // Qスキル「通常弾幕1」
      Q: {
        NAME: '通常弾幕1',
        CAST_TIME: 1400,           // 詠唱時間（ms）- 予告線7本 × 200ms = 1400ms
        COOLDOWN: 5000,            // クールダウン（ms）
        DAMAGE: {
          BASE: 30,
          RATIO: 0.5,              // ATK × 0.5
        },
        // 予告線パラメータ
        WARNING_LINE_COUNT: 7,     // 予告線の本数
        WARNING_LINE_INTERVAL: 200, // 予告線出現間隔（ms）
        WARNING_TO_FIRE_DELAY: 300, // 予告線から弾発射までの遅延（ms）
        // 弾幕パラメータ（横方向の弾数は予告線番号で変動: 1本目=1, 2-3本目=2, 4-6本目=3, 7本目=4）
        BULLET_ROWS: 10,           // 縦方向の弾数
        BULLET_ROW_SPACING: 40,    // 縦方向の弾間隔（px）
        BULLET_COL_SPACING: 30,    // 横方向の弾間隔（px）
        BULLET_SPEED: 20 * 55,     // 20m/s = 1100px/s
        BULLET_RADIUS: 0.25 * 55,  // 0.25m = 13.75px（当たり判定）
        BULLET_DISPLAY_SCALE: 0.06, // 黒縁中玉（512px）の表示スケール
        BULLET_COLOR: 1,           // 黒縁中玉の色ID（1=赤）
        // CC中断可能フラグ
        INTERRUPTIBLE: true,
      },
      // Wスキル「闇符・ダークサイドオブムーン」（デバッグ用に無効化）
      W: {
        NAME: '闇符・ダークサイドオブムーン',
        CAST_TIME: 500,
        COOLDOWN: 999999,            // 実質無効化
        DAMAGE: {
          BASE: 50,
          RATIO: 0.8,
        },
        LASER_COUNT: 5,
        LASER_WIDTH: 30,
        LASER_LENGTH: 800,
        LASER_DURATION: 100,
      },
      // Eスキル「闘符・ディマーケイション」（デバッグ用に無効化）
      E: {
        NAME: '闘符・ディマーケイション',
        CAST_TIME: 300,
        COOLDOWN: 999999,            // 実質無効化
        DAMAGE: {
          BASE: 20,
          RATIO: 0.3,
        },
        BULLETS_PER_RING: 16,
        WAVE_COUNT: 3,
        WAVE_INTERVAL: 400,
        INITIAL_RADIUS: 30,
        EXPANSION_SPEED: 200,
        ROTATION_SPEED: 0.8,
        BULLET_RADIUS: 10,
      },
    },

    // スペルカードフェーズ1のスキル
    PHASE_1_SKILLS: {
      // Qスキル: 12方向弾
      Q: {
        NAME: '闇の拡散弾',
        CAST_TIME: 200,              // キャスト時間0.2秒
        COOLDOWN: 3000,              // CD3秒
        DAMAGE: {
          BASE: 30,
          RATIO: 0.4,
        },
        // 12方向弾パラメータ
        WAY_COUNT: 12,               // 12方向
        ANGLE_SPREAD: 180,           // 360度（全方向）
        BULLETS_PER_WAY: 1,          // 各方向1発
        BULLET_INTERVAL: 0,          // 同時発射
        BULLET_SPEED: 4 * 55,        // 4m/s = 220px/s
        BULLET_RADIUS: 30,           // 特大の球（半径30）
        BULLET_COLOR: 0xffff00,      // 黄色
        WARNING_LINE_LENGTH: 0,      // 予告線なし
        WAY_DELAY: 0,                // 同時発射
      },
      // Wスキル「闘符・トリプルバースト」- Qスキルを3回連続発射
      W: {
        NAME: '闘符・トリプルバースト',
        CAST_TIME: 200,              // 詠唱時間（ms）
        COOLDOWN: 6000,              // クールダウン（ms）
        DAMAGE: {
          BASE: 25,
          RATIO: 0.4,
        },
        // 3連射パラメータ
        BURST_COUNT: 3,              // 発射回数
        BURST_INTERVAL: 300,         // 発射間隔（ms）
        BULLET_SPEED: 5 * 55,        // 弾速（Qより少し速い: 5m/s = 275px/s）
      },
      // Eスキル「闇の潮汐」- 6方向スパイラル弾幕
      E: {
        NAME: '闇の潮汐',
        CAST_TIME: 300,              // キャスト時間0.3秒
        COOLDOWN: 6000,              // CD6秒
        DAMAGE: {
          BASE: 25,
          RATIO: 0.3,
        },
        // スパイラル弾幕パラメータ
        SPIRAL_ARMS: 6,              // 6方向（螺旋の腕の数）
        SPIRAL_DURATION: 2000,       // 発射持続時間（2秒）
        BULLET_FIRE_INTERVAL: 150,   // 0.15秒ごとに発射
        BULLET_SPEED: 2.5 * 55,      // 2.5m/s = 137.5px/s
        BULLET_RADIUS: 15,           // 弾の半径（Rの大と同じ）
        ROTATION_SPEED: 1.5,         // 回転速度（rad/s）- 螺旋の回転
        BULLET_COLOR: 0x9900ff,      // 紫色
      },
      // Rスキル「闇符・ダークサイドオブザムーン」
      R: {
        NAME: '闇符「ダークサイドオブザムーン」',
        CAST_TIME: 700,              // キャスト時間0.7秒
        COOLDOWN: 8000,              // CD8秒
        DAMAGE: {
          BASE: 40,
          RATIO: 0.5,
        },
        // 移動パラメータ
        INVINCIBILITY_DURATION: 2000, // 2秒間無敵
        MOVE_DISTANCE: 5 * 55,       // 5m = 275px移動
        BULLET_FIRE_INTERVAL: 100,   // 0.1秒ごとに弾発射
        BULLET_SPEED: 1 * 55,        // 弾速1m/s = 55px/s
        // 弾サイズ（半径）
        BULLET_SIZE_SMALL: 6,        // 小さい球
        BULLET_SIZE_MEDIUM: 10,      // 中くらいの球
        BULLET_SIZE_LARGE: 15,       // 大きい球
        // ランダム弾: 小2、中2、大2 = 6発
        // 自機狙い弾: 小2、中2、大2 = 6発
        BULLETS_RANDOM: 6,           // ランダム弾6発（小2、中2、大2）
        BULLETS_AIMED: 6,            // 自機狙い弾6発（小2、中2、大2）
      },
    },

    // 互換性のための旧スキル設定（PHASE_0_SKILLSへの参照）
    get SKILL_Q() { return this.PHASE_0_SKILLS.Q; },
    get SKILL_W() { return this.PHASE_0_SKILLS.W; },
    get SKILL_E() { return this.PHASE_0_SKILLS.E; },
    // 旧HPは最初のフェーズのHPを返す
    get HP() { return this.PHASES[0].HP; },
  },
} as const;

/**
 * ステージ情報
 */
export const STAGE_INFO = [
  {
    number: 1,
    name: 'Stage 1',
    bossName: 'ルーミア',
    bossTitle: '宵闇の妖怪',
    hint: 'ルーミアは闇の弾幕を多用します。回避スキルがあると安心です。',
    isUnlocked: true,
  },
  {
    number: 2,
    name: 'Stage 2',
    bossName: '???',
    bossTitle: '???',
    hint: '未実装',
    isUnlocked: false,
  },
  {
    number: 3,
    name: 'Stage 3',
    bossName: '???',
    bossTitle: '???',
    hint: '未実装',
    isUnlocked: false,
  },
  {
    number: 4,
    name: 'Stage 4',
    bossName: '???',
    bossTitle: '???',
    hint: '未実装',
    isUnlocked: false,
  },
  {
    number: 5,
    name: 'Stage 5',
    bossName: '???',
    bossTitle: '???',
    hint: '未実装',
    isUnlocked: false,
  },
  {
    number: 6,
    name: 'Stage 6',
    bossName: '???',
    bossTitle: '???',
    hint: '未実装',
    isUnlocked: false,
  },
] as const;

/**
 * サモナースキル情報
 */
export const SUMMONER_SKILLS = {
  flash: {
    id: 'flash',
    name: 'フラッシュ',
    description: '短距離瞬間移動。緊急回避に最適。',
    cooldown: 180000,
  },
  heal: {
    id: 'heal',
    name: 'ヒール',
    description: 'HPを30%回復。持久戦に有効。',
    cooldown: 180000,
  },
  shield: {
    id: 'shield',
    name: 'バリア',
    description: '3秒間ダメージを無効化。',
    cooldown: 210000,
  },
  bomb: {
    id: 'bomb',
    name: 'ボム',
    description: '画面上の敵弾を消去。',
    cooldown: 120000,
  },
  timestop: {
    id: 'timestop',
    name: '時間停止',
    description: '2秒間敵の動きを止める。',
    cooldown: 240000,
  },
  boost: {
    id: 'boost',
    name: 'ブースト',
    description: '10秒間攻撃力50%上昇。',
    cooldown: 150000,
  },
} as const;
