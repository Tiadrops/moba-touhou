import Phaser from 'phaser';
import { BootScene } from '@/scenes/BootScene';
import { GameScene } from '@/scenes/GameScene';
import { GAME_CONFIG, PHYSICS_CONFIG, COLORS } from '@/config/GameConfig';

/**
 * Phaserゲームインスタンスの設定
 */
const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: GAME_CONFIG.WIDTH,
  height: GAME_CONFIG.HEIGHT,
  parent: 'game-container',
  backgroundColor: COLORS.BACKGROUND,
  physics: {
    default: 'arcade',
    arcade: PHYSICS_CONFIG,
  },
  scene: [BootScene, GameScene],
  fps: {
    target: GAME_CONFIG.TARGET_FPS,
    forceSetTimeOut: false,
  },
  render: {
    pixelArt: false,
    antialias: true,
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
};

// ゲームインスタンスを作成
const game = new Phaser.Game(config);

// ローディング画面を非表示にする
window.addEventListener('load', () => {
  const loadingElement = document.getElementById('loading');
  if (loadingElement) {
    loadingElement.classList.add('hidden');
  }
});

// グローバルにゲームインスタンスを公開（デバッグ用）
if (GAME_CONFIG.DEBUG) {
  (window as any).game = game;
}

export default game;
