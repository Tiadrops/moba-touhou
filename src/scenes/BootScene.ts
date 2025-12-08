import Phaser from 'phaser';
import { SCENES, COLORS } from '@/config/GameConfig';

/**
 * BootScene - ゲーム起動時の初期化とアセット読み込み
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: SCENES.BOOT });
  }

  preload(): void {
    // ローディングバーの表示
    this.createLoadingBar();

    // TODO: 将来的にここで画像・音声アセットを読み込む
    // this.load.image('player', 'assets/sprites/player.png');
    // this.load.audio('bgm', 'assets/audio/bgm.mp3');
  }

  create(): void {
    // 仮のスプライトをプログラムで生成（テスト用）
    this.createTemporarySprites();

    // ゲームシーンへ遷移
    this.scene.start(SCENES.GAME);
  }

  /**
   * ローディングバーを作成
   */
  private createLoadingBar(): void {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    // ローディングテキスト
    const loadingText = this.add.text(width / 2, height / 2 - 50, 'Loading...', {
      font: '32px monospace',
      color: '#ffffff',
    });
    loadingText.setOrigin(0.5);

    // プログレスバーの背景
    const progressBar = this.add.graphics();
    const progressBox = this.add.graphics();
    progressBox.fillStyle(0x222222, 0.8);
    progressBox.fillRect(width / 2 - 160, height / 2, 320, 30);

    // ローディング進捗のイベントリスナー
    this.load.on('progress', (value: number) => {
      progressBar.clear();
      progressBar.fillStyle(0x00ff88, 1);
      progressBar.fillRect(width / 2 - 150, height / 2 + 10, 300 * value, 10);
    });

    this.load.on('complete', () => {
      progressBar.destroy();
      progressBox.destroy();
      loadingText.destroy();
    });
  }

  /**
   * テスト用の仮スプライトを生成
   */
  private createTemporarySprites(): void {
    // プレイヤースプライト（緑の円）
    const playerGraphics = this.add.graphics();
    playerGraphics.fillStyle(COLORS.PLAYER, 1);
    playerGraphics.fillCircle(16, 16, 12);
    playerGraphics.generateTexture('player', 32, 32);
    playerGraphics.destroy();

    // 敵スプライト（赤の円）
    const enemyGraphics = this.add.graphics();
    enemyGraphics.fillStyle(COLORS.ENEMY, 1);
    enemyGraphics.fillCircle(16, 16, 12);
    enemyGraphics.generateTexture('enemy', 32, 32);
    enemyGraphics.destroy();

    // プレイヤーの弾（白色の大きい円 - setTint()で色を変更するため）
    const playerBulletGraphics = this.add.graphics();
    playerBulletGraphics.fillStyle(0xffffff, 1); // 白色
    playerBulletGraphics.fillCircle(8, 8, 8); // サイズを2倍に
    playerBulletGraphics.generateTexture('bullet_player', 16, 16);
    playerBulletGraphics.destroy();

    // 敵の弾（東方風 - 赤い縁 + 白い内側）
    const enemyBulletGraphics = this.add.graphics();
    const bulletRadius = 12; // 大きめのサイズ
    const textureSize = bulletRadius * 2 + 4; // 余白を含む
    const center = textureSize / 2;
    // 外側の赤い縁
    enemyBulletGraphics.fillStyle(0xff3333, 1);
    enemyBulletGraphics.fillCircle(center, center, bulletRadius);
    // 内側の白い部分
    enemyBulletGraphics.fillStyle(0xffffff, 1);
    enemyBulletGraphics.fillCircle(center, center, bulletRadius * 0.6);
    enemyBulletGraphics.generateTexture('bullet_enemy', textureSize, textureSize);
    enemyBulletGraphics.destroy();
  }
}
