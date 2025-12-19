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
  // 霊夢のQスキル「妖怪バスター」
  REIMU_Q: {
    CAST_TIME: 250,              // キャスト時間（ms）
    MOTION_TIME: 150,            // モーション硬直（ms）
    PROJECTILE_WIDTH: 0.5 * 55,  // 弾の幅（0.5m = 27.5px）
    PROJECTILE_HEIGHT: 1.0 * 55, // 弾の高さ（1.0m = 55px）
    PROJECTILE_RANGE: 6.5 * 55,  // 射程（6.5m = 357.5px）※弾の半分0.5mを考慮し最大7mに収まる
    PROJECTILE_TRAVEL_TIME: 400, // 最大射程到達時間（ms）→ 約16.25m/s
    COOLDOWN: 4000,              // クールダウン（ms）
    CD_REFUND_ON_HIT: 0.75,      // 命中時CD解消率（75%）
    SLOW_DURATION: 1000,         // スロウ持続時間（ms）
    SLOW_AMOUNT: 0.30,           // スロウ量（30%減速）
    // 針巫女スタック
    HARIBABA_STACK: {
      ATK_PER_STACK: 5,          // 1スタックあたり攻撃力上昇
      AS_PER_STACK: 0.10,        // 1スタックあたりAS上昇（+0.1、数値加算）
      MS_PER_5_STACK: 0.10,      // 5スタック毎に移動速度上昇（10%）
      MAX_STACK: 10,             // 最大スタック数
      DURATION: 6000,            // 持続時間（ms）
    },
    // スキルダメージ設定
    DAMAGE: {
      BASE_DAMAGE: 80,           // 固定ダメージ
      SCALING_RATIO: 0.6,        // 攻撃力増幅率（60%）
    },
  },
  // 霊夢のWスキル「封魔針」
  REIMU_W: {
    CAST_TIME: 0,                // キャスト時間（即時発動）
    MOTION_TIME: 150,            // スキルモーション硬直（ms）
    PROJECTILE_WIDTH: 0.5 * 55,  // 弾の幅（0.5m = 27.5px）
    PROJECTILE_HEIGHT: 1.0 * 55, // 弾の高さ（1.0m = 55px）
    PROJECTILE_RANGE: 9 * 55,    // 射程（9m = 495px）
    PROJECTILE_SPEED: 14 * 55,   // 弾速（14m/s = 770px/s）
    STUN_DURATION: 1000,         // スタン時間（ms）
    COOLDOWN: 6000,              // クールダウン（ms）
    E_CD_REFUND_ON_BREAK: 0.50,  // ブレイク時EスキルCD解消率（50%）
    BREAK_BONUS_DAMAGE_RATIO: 0.5, // ブレイク時追加ダメージ倍率（50%）
    // スキルダメージ設定
    DAMAGE: {
      BASE_DAMAGE: 60,           // 固定ダメージ
      SCALING_RATIO: 0.4,        // 攻撃力増幅率（40%）
    },
  },
  // 霊夢のEスキル「昇天蹴」
  REIMU_E: {
    CAST_TIME: 100,              // キャスト時間（ms）
    DASH_DISTANCE: 3 * 55,       // ダッシュ距離（3m = 165px）
    DASH_DURATION: 200,          // ダッシュ所要時間（ms）
    COOLDOWN: 12000,             // クールダウン（ms）
    DAMAGE_REDUCTION: 0.90,      // ダッシュ中ダメージカット（90%）
    // ダッシュダメージ設定
    DAMAGE: {
      BASE_DAMAGE: 50,           // 固定ダメージ
      SCALING_RATIO: 0.3,        // 攻撃力増幅率（30%）
    },
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
      // Wスキル「通常弾幕2」- 3つのリング弾幕
      W: {
        NAME: '通常弾幕2',
        CAST_TIME: 500,
        COOLDOWN: 6000,
        DAMAGE: {
          BASE: 30,
          RATIO: 0.5,
        },
        // リング弾幕パラメータ
        RING_COUNT: 3,               // リングの数
        BULLETS_PER_RING: 20,        // 1リングあたりの弾数
        BULLET_RADIUS: 0.25 * 55,    // 当たり判定半径 0.25m = 13.75px
        BULLET_DISPLAY_SCALE: 0.06,  // 黒縁中玉（512px）の表示スケール
        BULLET_COLOR: 5,             // 水色（KSHOT.MEDIUM_BALL.CYAN）
        // 各リングの弾速（外側ほど速い）
        RING_SPEEDS: [5 * 55, 10 * 55, 15 * 55], // 5m/s, 10m/s, 15m/s
      },
      // Eスキル「通常弾幕3」- 移動しながら直線弾幕を配置
      E: {
        NAME: '通常弾幕3',
        CAST_TIME: 500,              // 詠唱時間（0.5秒）
        COOLDOWN: 6000,              // クールダウン（ms）
        DAMAGE: {
          BASE: 20,
          RATIO: 0.3,
        },
        // 移動パラメータ
        MOVE_DURATION: 1000,         // 移動時間（1秒）
        MOVE_DISTANCE: 5 * 55,       // 移動距離（5m = 275px）
        // 弾幕パラメータ
        BULLET_LINES: 2,             // 弾列数（2列 - 前方に配置）
        BULLETS_PER_LINE: 18,        // 1列あたりの弾数（横に並べる）
        BULLET_SPAWN_INTERVAL: 50,   // 弾配置間隔（0.05秒 = 50ms）
        LINE_SPACING: 1 * 55,        // 列の間隔（1m = 55px）- 前方2列の距離
        LINE_WIDTH: 10 * 55,         // 1列の横幅（10m = 550px）
        BULLET_RADIUS: 0.25 * 55,    // 弾の半径（0.25m = 13.75px）
        BULLET_DISPLAY_SCALE: 0.1,   // 輪弾（278px）の表示スケール
        BULLET_COLOR: 12,            // 輪弾の緑（KSHOT.RINDAN.GREEN）
        // 弾速パラメータ（山型: 3m/s → 8m/s → 3m/s）
        BULLET_SPEED_BASE: 3 * 55,   // 基本弾速（3m/s = 165px/s）
        BULLET_SPEED_INCREMENT: 0.5 * 55, // 弾速増加量（0.5m/s = 27.5px/s）
        BULLET_SPEED_PEAK_INDEX: 10, // 最速になるインデックス（11発目、0始まりなので10）
        // CC中断可能フラグ（ブレイク）
        INTERRUPTIBLE: true,
      },
    },

    // スペルカードフェーズ1のスキル
    PHASE_1_SKILLS: {
      // Qスキル「オーブオブディセプション」
      Q: {
        NAME: 'オーブオブディセプション',
        CAST_TIME: 250,              // キャスト時間0.25秒
        COOLDOWN: 5000,              // クールダウン5秒
        DAMAGE: {
          BASE: 50,
          RATIO: 0.6,
        },
        ENABLED: true,
        // 弾パラメータ
        BULLET_COUNT: 9,             // 弾数9発
        BULLET_RANGE: 9 * 55,        // 射程9m = 495px
        BULLET_RADIUS: 0.8 * 55,     // 弾幕判定半径0.8m = 44px
        BULLET_SPEED_OUTGOING: 15 * 55, // 行き弾速15m/s = 825px/s
        BULLET_SPEED_RETURN_INITIAL: 0.6 * 55, // 帰り初速0.6m/s = 33px/s
        BULLET_SPEED_RETURN_ACCEL: 19 * 55, // 帰り加速度19m/s² = 1045px/s²
        BULLET_SPEED_RETURN_MAX: 26 * 55, // 帰り最大速度26m/s = 1430px/s
        // 弾の表示スケール（大玉: 直径1.6m = 88px → 88/512 ≈ 0.172）
        BULLET_DISPLAY_SCALE: 0.172,
        BULLET_COLOR: 21,            // 大玉CYAN（シアン）
      },
      // Wスキル: 無効化（リメイク予定）
      W: {
        NAME: '（無効）',
        CAST_TIME: 99999999,
        COOLDOWN: 99999999,
        DAMAGE: { BASE: 0, RATIO: 0 },
        ENABLED: false,
      },
      // Eスキル: 無効化（リメイク予定）
      E: {
        NAME: '（無効）',
        CAST_TIME: 99999999,
        COOLDOWN: 99999999,
        DAMAGE: { BASE: 0, RATIO: 0 },
        ENABLED: false,
      },
      // Rスキル「闇符・ダークサイドオブザムーン」
      R: {
        NAME: '闇符「ダークサイドオブザムーン」',
        CAST_TIME: 600,              // 詠唱時間600ms
        COOLDOWN: 8000,              // CD8秒
        DAMAGE: {
          BASE: 40,
          RATIO: 0.5,
        },
        // 移動パラメータ
        INVINCIBILITY_DURATION: 3000, // 3秒間無敵
        MOVE_DISTANCE: 5 * 55,       // 5m = 275px移動
        MOVE_SPEED: 3 * 55,          // 3m/s = 165px/s
        BULLET_FIRE_INTERVAL: 100,   // 0.1秒ごとに弾発射（3秒間で30回）
        BULLET_SPEED: 1 * 55,        // 黒縁中玉の弾速1m/s = 55px/s
        // 移動中の弾幕
        // 輪弾RED (ID:9) - ランダム4発 - 半径0.25m（元0.5mの半分）
        RINDAN_RADIUS: 0.25 * 55,    // 半径0.25m = 13.75px
        RINDAN_COUNT: 4,             // ランダム4発
        RINDAN_SPEED: 2 * 55,        // 輪弾の弾速2m/s = 110px/s（黒縁中玉の2倍）
        RINDAN_FIRE_OFFSETS: [100, 300, 500, 700, 900, 1100, 1300, 1500, 1700, 1900], // 200ms間隔、10回
        // 黒縁中玉WHITE (ID:8) - ランダム4発 - 半径0.125m（元0.25mの半分）
        MEDIUM_BALL_RADIUS: 0.125 * 55, // 半径0.125m = 6.875px
        MEDIUM_BALL_COUNT: 4,        // ランダム4発
        MEDIUM_BALL_FIRE_OFFSETS: [0, 200, 400, 600, 800, 1000, 1200, 1400, 1600, 1800], // 200ms間隔、10回
        // 無敵終了時のリング弾
        FINISH_RING_COUNT: 20,       // 20発
        FINISH_RING_RADIUS: 0.5 * 55, // 半径0.5m = 27.5px（元1.0mの半分）
        FINISH_RING_SPEED: 3 * 55,   // 弾速3m/s = 165px/s
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
