import Phaser from 'phaser';
import { BootScene } from '@/scenes/BootScene';
import { TitleScene } from '@/scenes/TitleScene';
import { ModeSelectScene } from '@/scenes/ModeSelectScene';
import { ArcadeSetupScene } from '@/scenes/ArcadeSetupScene';
import { PracticeSetupScene } from '@/scenes/PracticeSetupScene';
import { StageIntroScene } from '@/scenes/StageIntroScene';
import { GameScene } from '@/scenes/GameScene';
import { PauseScene } from '@/scenes/PauseScene';
import { ResultScene } from '@/scenes/ResultScene';
import { GameOverScene } from '@/scenes/GameOverScene';
import { OptionScene } from '@/scenes/OptionScene';
import { CreditScene } from '@/scenes/CreditScene';
// デバッグ用シーン
import { DebugRoomScene } from '@/scenes/debug/DebugRoomScene';
import { BulletTestScene } from '@/scenes/debug/BulletTestScene';
import { CutInTestScene } from '@/scenes/debug/CutInTestScene';
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
  scene: [
    BootScene,
    TitleScene,
    ModeSelectScene,
    ArcadeSetupScene,
    PracticeSetupScene,
    StageIntroScene,
    GameScene,
    PauseScene,
    ResultScene,
    GameOverScene,
    OptionScene,
    CreditScene,
    // デバッグ用シーン
    DebugRoomScene,
    BulletTestScene,
    CutInTestScene,
  ],
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

// ゲームコンテナ内でのコンテキストメニュー（右クリックメニュー）を無効化
const gameContainer = document.getElementById('game-container');
if (gameContainer) {
  gameContainer.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    return false;
  });
}

// グローバルにゲームインスタンスを公開（デバッグ用）
if (GAME_CONFIG.DEBUG) {
  (window as any).game = game;
}

export default game;
