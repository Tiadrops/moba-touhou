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
  MENU: 'MenuScene',
  CHARACTER_SELECT: 'CharacterSelectScene',
  GAME: 'GameScene',
  PAUSE: 'PauseScene',
  GAME_OVER: 'GameOverScene',
  STAGE_CLEAR: 'StageClearScene',
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
    // スキルダメージ設定（テスト用: 固定200 + 攻撃力50% = 250/tick）
    DAMAGE: {
      BASE_DAMAGE: 200,          // 固定ダメージ
      SCALING_RATIO: 0.5,        // 攻撃力増幅率（50%）
    },
  },
} as const;
