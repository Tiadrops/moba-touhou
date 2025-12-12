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

    // キャラクター立ち絵の読み込み
    this.load.image('portrait_reimu', 'img/reimu/reimu_1.png');
    this.load.image('portrait_rumia_1', 'img/Rumia/rumia_1.png');
    this.load.image('portrait_rumia_2', 'img/Rumia/rumia_2.png');

    // キャラクターコマ（スプライトシート）の読み込み
    // 霊夢コマ: 2816x1504px, 2x2グリッド、4フレーム
    this.load.spritesheet('coma_reimu_idle', 'img/reimu/reimu_coma1.png', {
      frameWidth: 1408,  // 2816 / 2
      frameHeight: 752,  // 1504 / 2
    });
    this.load.spritesheet('coma_reimu_move', 'img/reimu/reimu_coma2.png', {
      frameWidth: 1408,  // 2816 / 2
      frameHeight: 752,  // 1504 / 2
    });
    // ルーミアコマ1（詠唱用）: 2816x800px, 横4フレーム
    this.load.spritesheet('coma_rumia_cast', 'img/Rumia/rumia_koma1.png', {
      frameWidth: 704,   // 2816 / 4
      frameHeight: 800,
    });
    // ルーミアコマ2（デフォルト）: 2816x800px, 横4フレーム
    this.load.spritesheet('coma_rumia_idle', 'img/Rumia/rumia_koma2.png', {
      frameWidth: 704,   // 2816 / 4
      frameHeight: 800,
    });
    // ルーミアコマ3（移動用）: 1408x800px, 横2フレーム
    this.load.spritesheet('coma_rumia_move', 'img/Rumia/rumia_koma3.png', {
      frameWidth: 704,   // 1408 / 2
      frameHeight: 800,
    });

    // 弾幕スプライトシートの読み込み
    // 黒縁中玉: 4096x512px (512x512 × 8色)
    this.load.image('kshot_medium_ball', 'img/bullets/kshot_medium_ball.png');

    // 輪弾: 各278x278px × 8色（個別ファイル）
    this.load.image('rindan_9', 'img/bullets/rindan_red.png');
    this.load.image('rindan_10', 'img/bullets/rindan_yellow.png');
    this.load.image('rindan_11', 'img/bullets/rindan_lime.png');
    this.load.image('rindan_12', 'img/bullets/rindan_green.png');
    this.load.image('rindan_13', 'img/bullets/rindan_cyan.png');
    this.load.image('rindan_14', 'img/bullets/rindan_magenta.png');
    this.load.image('rindan_15', 'img/bullets/rindan_purple.png');
    this.load.image('rindan_16', 'img/bullets/rindan_blue.png');

    // TODO: 将来的にここで音声アセットを読み込む
    // this.load.audio('bgm', 'assets/audio/bgm.mp3');
  }

  create(): void {
    // 仮のスプライトをプログラムで生成（テスト用）
    this.createTemporarySprites();

    // 弾幕スプライトシートからテクスチャを生成
    this.createBulletTextures();

    // キャラクターアニメーションを定義
    this.createCharacterAnimations();

    // タイトル画面へ遷移
    this.scene.start(SCENES.TITLE);
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

    // 敵の弾（東方風 - 赤い縁 + 白い内側）- フォールバック用
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

  /**
   * 弾幕スプライトシートからテクスチャを生成
   *
   * 黒縁中玉 (kshot_medium_ball.png): 4096x512px
   * - 各弾512x512px × 8色 = ID 1-8
   */
  private createBulletTextures(): void {
    const mediumBallTexture = this.textures.get('kshot_medium_ball');

    if (!mediumBallTexture || mediumBallTexture.key === '__MISSING') {
      console.warn('kshot_medium_ball not loaded');
      return;
    }

    // 黒縁中玉: 8色 (512x512px × 8 = 4096x512px)
    for (let col = 0; col < 8; col++) {
      const x = col * 512;
      const frameId = col + 1; // ID 1-8
      mediumBallTexture.add(`kshot_${frameId}`, 0, x, 0, 512, 512);
    }

    console.log('Bullet textures created: 8 frames (黒縁中玉), 8 rindan textures (輪弾)');
  }

  /**
   * キャラクターアニメーションを定義
   */
  private createCharacterAnimations(): void {
    // 霊夢待機アニメーション（左上→右上→左下→右下→左上...）
    // フレーム順: 0(左上), 1(右上), 2(左下), 3(右下)
    this.anims.create({
      key: 'reimu_idle',
      frames: this.anims.generateFrameNumbers('coma_reimu_idle', {
        frames: [0, 1, 2, 3],
      }),
      frameRate: 6, // 1秒間に6フレーム
      repeat: -1,   // 無限ループ
    });

    // 霊夢移動アニメーション
    this.anims.create({
      key: 'reimu_move',
      frames: this.anims.generateFrameNumbers('coma_reimu_move', {
        frames: [0, 1, 2, 3],
      }),
      frameRate: 8, // 移動時は少し速めに
      repeat: -1,   // 無限ループ
    });

    // ルーミア待機アニメーション（1→3→2→4の順）
    this.anims.create({
      key: 'rumia_idle',
      frames: this.anims.generateFrameNumbers('coma_rumia_idle', {
        frames: [0, 2, 1, 3], // 1→3→2→4 (0-indexed)
      }),
      frameRate: 1.5, // ゆっくり
      repeat: -1,
    });

    // ルーミア詠唱アニメーション（1→3→2→4の順）
    this.anims.create({
      key: 'rumia_cast',
      frames: this.anims.generateFrameNumbers('coma_rumia_cast', {
        frames: [0, 2, 1, 3], // 1→3→2→4 (0-indexed)
      }),
      frameRate: 1.5, // ゆっくり
      repeat: -1,
    });

    // ルーミア移動アニメーション（2フレーム）
    this.anims.create({
      key: 'rumia_move',
      frames: this.anims.generateFrameNumbers('coma_rumia_move', {
        frames: [0, 1],
      }),
      frameRate: 4, // 移動時は少し速めに
      repeat: -1,
    });

    console.log('Character animations created: reimu_idle, reimu_move, rumia_idle, rumia_cast, rumia_move');
  }
}
