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
