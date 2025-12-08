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
      Y: (1080 - HUD_HEIGHT) / 2, // ゾーン中央
      WIDTH: 500,               // ゾーン幅に近いサイズ
      HEIGHT: 800,              // 縦長の立ち絵
      ALPHA: 0.3,
    },
    INFO_PANEL: {
      X: 40,
      Y: 620,                   // 立ち絵の下部に配置（上に移動）
      WIDTH: 480,
    },
    HP_BAR: {
      X: 40,
      Y: 660,                   // HPバーを上に移動
      WIDTH: 480,
      HEIGHT: 24,
    },
    // スキルバー（エネミーゾーン下部）
    SKILL_BAR: {
      X: 280,                   // ゾーン中央
      Y: 1080 - HUD_HEIGHT + 60, // HUDエリア内
      SLOT_SIZE: 48,            // 少し小さめ
      SLOT_GAP: 6,
    },
  },

  // プレイヤーゾーン（右側全体、HUDより上）
  PLAYER_ZONE: {
    X: 1360,
    Y: 0,
    WIDTH: 560,
    HEIGHT: 1080 - HUD_HEIGHT, // HUDより上の領域
    PORTRAIT: {
      X: 1640,                  // ゾーン中央
      Y: (1080 - HUD_HEIGHT) / 2, // ゾーン中央
      WIDTH: 500,               // ゾーン幅に近いサイズ
      HEIGHT: 800,              // 縦長の立ち絵
      ALPHA: 0.3,
    },
    INFO_PANEL: {
      X: 1400,
      Y: 700,                   // 立ち絵の下部に配置
      WIDTH: 480,
    },
    // スキルバー（プレイヤーゾーン下部）
    SKILL_BAR: {
      X: 1640,                  // ゾーン中央
      Y: 1080 - HUD_HEIGHT + 60, // HUDエリア内
      SLOT_SIZE: 64,
      SLOT_GAP: 8,
      HP_BAR: {
        WIDTH: 400,
        HEIGHT: 24,
        OFFSET_Y: 45,
      },
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
