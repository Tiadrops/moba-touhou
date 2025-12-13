/**
 * UI用定数
 */

/**
 * UIカラーパレット
 */
export const UI_COLORS = {
  // パネル背景
  PANEL_BG: 0x1a1a2e,
  PANEL_BG_ALPHA: 0.85,

  // スキルスロット
  SLOT_BG: 0x2a2a4e,
  SLOT_BORDER: 0x4a4a6a,
  SLOT_BORDER_READY: 0x00ff88,
  SLOT_BORDER_CASTING: 0xffff00,
  SLOT_COOLDOWN_OVERLAY: 0x000000,

  // HPバー
  HP_HIGH: 0x00ff00,
  HP_MID: 0xffff00,
  HP_LOW: 0xff4444,
  HP_BG: 0x333333,
  HP_BORDER: 0x666666,

  // ボスHP
  BOSS_HP: 0xff6666,
  BOSS_HP_BG: 0x442222,

  // テキスト
  TEXT_PRIMARY: 0xffffff,
  TEXT_SECONDARY: 0xaaaaaa,
  TEXT_COOLDOWN: 0xff6666,
  TEXT_STACK: 0x00ffff,
  TEXT_BUFF: 0x88ff88,

  // ゾーン
  ZONE_SEPARATOR: 0x4a4a6a,
} as const;

/**
 * UIレイヤー（Depth）
 */
export const UI_DEPTH = {
  PORTRAIT: 95,
  ZONE_BG: 96,
  PANEL_BG: 100,
  PANEL_CONTENT: 101,
  SKILL_ICON: 102,
  SKILL_OVERLAY: 103,
  SKILL_TEXT: 104,
  TOOLTIP: 110,
} as const;

/**
 * HUDエリアの高さ（画面下部）
 */
export const HUD_HEIGHT = 120;

/**
 * UIレイアウト座標
 */
export const UI_LAYOUT = {
  // エネミーゾーン（左側全体、HUDより上）
  ENEMY_ZONE: {
    X: 0,
    Y: 0,
    WIDTH: 560,
    HEIGHT: 1080 - HUD_HEIGHT, // HUDより上の領域
    PORTRAIT: {
      X: 280,                   // ゾーン中央
      Y: (1080 - HUD_HEIGHT) / 2, // プレイヤーと同じY座標（中央）
      WIDTH: 500,               // プレイヤーと同じサイズ
      HEIGHT: 800,              // プレイヤーと同じサイズ
      ALPHA: 0.4,
    },
    INFO_PANEL: {
      X: 280,                   // ゾーン中央
      Y: 560,                   // 名前を上に移動（HPバーより上）
      WIDTH: 480,
    },
    HP_BAR: {
      X: 40,
      Y: 595,                   // 名前の下
      WIDTH: 480,
      HEIGHT: 28,
    },
    // フェーズ情報（HPバーの下）
    PHASE_INFO: {
      Y: 640,                   // HPバーの下
    },
    // ボススキルバー（左下の余白に配置）
    BOSS_SKILL_BAR: {
      X: 280,                   // ゾーン中央
      Y: 820,                   // 左下エリア
      SLOT_SIZE: 56,
      SLOT_GAP: 8,
    },
    // バフ/デバフ表示エリア（スキルバーの下）
    STATUS_EFFECTS: {
      X: 280,                   // ゾーン中央
      Y: 960,                   // スキルバーの下、十分な余裕を持たせる
    },
  },

  // プレイヤーゾーン（右側全体、HUDより上）- エネミーゾーンと左右対称
  PLAYER_ZONE: {
    X: 1360,
    Y: 0,
    WIDTH: 560,
    HEIGHT: 1080 - HUD_HEIGHT, // HUDより上の領域
    PORTRAIT: {
      X: 1640,                  // ゾーン中央
      Y: (1080 - HUD_HEIGHT) / 2, // ゾーン中央
      WIDTH: 500,               // エネミーと同じサイズ
      HEIGHT: 800,              // エネミーと同じサイズ
      ALPHA: 0.3,
    },
    INFO_PANEL: {
      X: 1640,                  // ゾーン中央（エネミーと対称）
      Y: 560,                   // エネミーと同じ位置
      WIDTH: 480,
    },
    HP_BAR: {
      X: 1400,                  // 右寄せ開始位置
      Y: 595,                   // エネミーと同じY位置
      WIDTH: 480,
      HEIGHT: 28,
    },
    // 残機情報（エネミーのフェーズ情報と対称位置）
    LIVES_INFO: {
      Y: 640,                   // HPバーの下（エネミーのPHASE_INFOと同じY）
    },
    // 装備スロット（残機とスキルバーの間）
    EQUIPMENT_SLOTS: {
      X: 1640,                  // ゾーン中央
      Y: 730,                   // 残機(640+35)とスキルバー(820)の間
      SLOT_SIZE: 48,            // スロットサイズ
      SLOT_GAP: 6,              // スロット間隔
      SLOT_COUNT: 6,            // スロット数
    },
    // パラメータ表示（右上、スコアボードの左）
    STATS_PANEL: {
      X: 1400,                  // スコアボードの左
      Y: 20,                    // スコアボードと同じ上部位置
      LINE_HEIGHT: 22,          // スコアボードと同じ行の高さ
      PADDING: 12,              // スコアボードと同じパディング
      WIDTH: 140,               // 背景の幅
    },
    // スコアボード（右上）
    SCOREBOARD: {
      X: 1780,                  // 右上エリア
      Y: 20,                    // 上部
      LINE_HEIGHT: 22,          // 行の高さ
      PADDING: 12,              // パディング
      WIDTH: 260,               // 背景の幅
      TARGET_TIME: 180,         // 目標時間（秒）
    },
    // スキルバー（エネミーのボススキルバーと対称位置）
    SKILL_BAR: {
      X: 1640,                  // ゾーン中央
      Y: 820,                   // エネミーのBOSS_SKILL_BARと同じY
      SLOT_SIZE: 56,            // エネミーと同じサイズ
      SLOT_GAP: 8,
    },
    // バフ/デバフ表示エリア（エネミーと対称位置）
    STATUS_EFFECTS: {
      X: 1640,                  // ゾーン中央
      Y: 960,                   // エネミーと同じY
    },
  },
} as const;

/**
 * スキルスロットのキーラベル
 */
export const SKILL_KEY_LABELS = ['Q', 'W', 'E', 'R', 'D', 'F'] as const;

/**
 * バフタイプの表示名
 */
export const BUFF_DISPLAY_NAMES: Record<string, string> = {
  attack_speed: 'AS',
  move_speed: 'SPD',
  damage: 'ATK',
  invincible: '無敵',
} as const;
