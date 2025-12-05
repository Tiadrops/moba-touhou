import Phaser from 'phaser';
import { SCENES, GAME_CONFIG, COLORS, DEPTH } from '@/config/GameConfig';
import { Player } from '@/entities/Player';
import { Enemy } from '@/entities/Enemy';
import { InputManager } from '@/systems/InputManager';
import { BulletPool } from '@/utils/ObjectPool';
import { CharacterType, EnemyType } from '@/types';

/**
 * GameScene - メインゲームプレイシーン
 */
export class GameScene extends Phaser.Scene {
  private playArea!: Phaser.GameObjects.Rectangle;
  private fpsText!: Phaser.GameObjects.Text;
  private infoText!: Phaser.GameObjects.Text;
  private debugText!: Phaser.GameObjects.Text;

  // ゲームオブジェクト
  private player!: Player;
  private inputManager!: InputManager;
  private bulletPool!: BulletPool;
  private enemies: Enemy[] = [];

  // 敵の生成管理
  private lastEnemySpawnTime: number = 0;
  private enemySpawnInterval: number = 2000; // 2秒ごと
  private score: number = 0;

  constructor() {
    super({ key: SCENES.GAME });
  }

  create(): void {
    // プレイエリアの作成
    this.createPlayArea();

    // デバッグ情報の表示
    if (GAME_CONFIG.DEBUG) {
      this.createDebugInfo();
    }

    // ウェルカムメッセージ
    this.createWelcomeMessage();
  }

  update(time: number, delta: number): void {
    // FPS表示の更新
    if (GAME_CONFIG.DEBUG && this.fpsText) {
      const fps = Math.round(this.game.loop.actualFps);
      this.fpsText.setText(`FPS: ${fps}`);
    }

    // プレイヤーの更新
    if (this.player) {
      this.player.update(time, delta);
    }

    // 入力管理の更新
    if (this.inputManager) {
      this.inputManager.update(time, delta);
    }

    // 弾の更新
    if (this.bulletPool) {
      this.bulletPool.update();
    }

    // 敵の更新
    for (const enemy of this.enemies) {
      if (enemy.getIsActive()) {
        enemy.update(time, delta);
      }
    }

    // 敵の生成
    if (this.player && time - this.lastEnemySpawnTime > this.enemySpawnInterval) {
      this.spawnEnemy();
      this.lastEnemySpawnTime = time;
    }

    // デバッグ情報の更新
    if (GAME_CONFIG.DEBUG && this.player && this.debugText) {
      this.updateDebugText();
    }
  }

  /**
   * プレイエリアを作成
   */
  private createPlayArea(): void {
    const { X, Y, WIDTH, HEIGHT } = GAME_CONFIG.PLAY_AREA;

    // プレイエリアの背景
    this.playArea = this.add.rectangle(
      X,
      Y,
      WIDTH,
      HEIGHT,
      COLORS.PLAY_AREA_BG
    );
    this.playArea.setOrigin(0, 0);
    this.playArea.setDepth(DEPTH.PLAY_AREA);

    // プレイエリアの枠線
    const border = this.add.graphics();
    border.lineStyle(2, COLORS.PLAY_AREA_BORDER, 1);
    border.strokeRect(X, Y, WIDTH, HEIGHT);
    border.setDepth(DEPTH.PLAY_AREA);
  }

  /**
   * デバッグ情報の表示
   */
  private createDebugInfo(): void {
    // FPS表示
    this.fpsText = this.add.text(10, 10, 'FPS: 60', {
      font: '16px monospace',
      color: '#00ff00',
    });
    this.fpsText.setDepth(DEPTH.UI);

    // システム情報
    this.infoText = this.add.text(10, 40, [
      `Resolution: ${GAME_CONFIG.WIDTH}x${GAME_CONFIG.HEIGHT}`,
      `Play Area: ${GAME_CONFIG.PLAY_AREA.WIDTH}x${GAME_CONFIG.PLAY_AREA.HEIGHT}`,
      `Renderer: ${this.game.renderer.type === Phaser.WEBGL ? 'WebGL' : 'Canvas'}`,
      '',
      'Debug Mode: ON',
    ], {
      font: '14px monospace',
      color: '#ffffff',
      backgroundColor: '#000000aa',
      padding: { x: 5, y: 5 },
    });
    this.infoText.setDepth(DEPTH.UI);
  }

  /**
   * ウェルカムメッセージを表示
   */
  private createWelcomeMessage(): void {
    const centerX = GAME_CONFIG.WIDTH / 2;
    const centerY = GAME_CONFIG.HEIGHT / 2;

    const title = this.add.text(centerX, centerY - 100, 'MOBA × TOUHOU', {
      font: 'bold 64px monospace',
      color: '#00ff88',
    });
    title.setOrigin(0.5);
    title.setDepth(DEPTH.UI);

    const subtitle = this.add.text(centerX, centerY, 'Danmaku Shooting Game', {
      font: '32px monospace',
      color: '#ffffff',
    });
    subtitle.setOrigin(0.5);
    subtitle.setDepth(DEPTH.UI);

    const message = this.add.text(centerX, centerY + 100, [
      'Project Setup Complete!',
      '',
      'Press any key to continue...',
    ], {
      font: '20px monospace',
      color: '#aaaaaa',
      align: 'center',
    });
    message.setOrigin(0.5);
    message.setDepth(DEPTH.UI);

    // 点滅アニメーション
    this.tweens.add({
      targets: message,
      alpha: 0.3,
      duration: 1000,
      yoyo: true,
      repeat: -1,
    });

    // キー入力待ち
    this.input.keyboard?.once('keydown', () => {
      title.destroy();
      subtitle.destroy();
      message.destroy();
      this.startGameplay();
    });
  }

  /**
   * ゲームプレイ開始
   */
  private startGameplay(): void {
    // 弾プールを作成
    this.bulletPool = new BulletPool(this, 50, 200);

    // 敵を事前生成
    this.createEnemyPool();

    // プレイヤーを生成（プレイエリアの中央下部）
    const { X, Y, WIDTH, HEIGHT } = GAME_CONFIG.PLAY_AREA;
    const playerX = X + WIDTH / 2;
    const playerY = Y + HEIGHT - 100;

    this.player = new Player(this, playerX, playerY, CharacterType.REIMU);

    // プレイヤーに弾プールと敵リストを設定
    this.player.setBulletPool(this.bulletPool);
    this.player.setEnemies(this.enemies);

    // 入力管理システムを初期化
    this.inputManager = new InputManager(this, this.player);
    this.inputManager.setEnemies(this.enemies);

    // 衝突判定を設定
    this.setupCollisions();

    // デバッグ情報を追加
    if (GAME_CONFIG.DEBUG) {
      this.createPlayerDebugInfo();
    }

    // 操作説明を表示
    this.showControls();
  }

  /**
   * 敵プールを作成
   */
  private createEnemyPool(): void {
    for (let i = 0; i < 20; i++) {
      const enemy = new Enemy(this, 0, 0);
      enemy.deactivate();
      this.enemies.push(enemy);
    }
  }

  /**
   * 敵を生成
   */
  private spawnEnemy(): void {
    // 非アクティブな敵を探す
    let enemy: Enemy | null = null;
    for (const e of this.enemies) {
      if (!e.getIsActive()) {
        enemy = e;
        break;
      }
    }

    if (!enemy) {
      return;
    }

    // プレイエリア内のランダムな位置に生成
    const { X, WIDTH } = GAME_CONFIG.PLAY_AREA;
    const spawnX = X + Math.random() * WIDTH;
    const spawnY = -50;

    // ランダムな移動パターン
    const patterns: Array<'straight' | 'wave' | 'zigzag'> = ['straight', 'wave', 'zigzag'];
    const pattern = Phaser.Utils.Array.GetRandom(patterns);

    enemy.spawn(spawnX, spawnY, EnemyType.NORMAL, pattern);
  }

  /**
   * 衝突判定を設定
   */
  private setupCollisions(): void {
    // プレイヤーの弾と敵の衝突
    this.physics.add.overlap(
      this.bulletPool.getActiveBullets(),
      this.enemies.filter(e => e.getIsActive()),
      (bulletObj, enemyObj) => {
        const bullet = bulletObj as any;
        const enemy = enemyObj as any;

        if (!bullet.getIsActive || !bullet.getIsActive()) return;
        if (!enemy.getIsActive || !enemy.getIsActive()) return;

        // 敵にダメージ（必中：弾が当たった時点でダメージ）
        const destroyed = enemy.takeDamage(bullet.getDamage());
        bullet.deactivate();

        // 敵を撃破したらスコア加算
        if (destroyed) {
          this.score += enemy.getScoreValue();
        }
      }
    );

    // 敵とプレイヤーの衝突
    this.physics.add.overlap(
      this.player,
      this.enemies.filter(e => e.getIsActive()),
      (playerObj, enemyObj) => {
        const enemy = enemyObj as any;

        if (!enemy.getIsActive || !enemy.getIsActive()) return;

        // プレイヤーがダメージを受ける
        this.player.takeDamage(enemy.getDamage());

        // 敵も消える
        enemy.deactivate();
      }
    );
  }

  /**
   * プレイヤーのデバッグ情報を作成
   */
  private createPlayerDebugInfo(): void {
    this.debugText = this.add.text(10, 150, '', {
      font: '14px monospace',
      color: '#ffff00',
      backgroundColor: '#000000aa',
      padding: { x: 5, y: 5 },
    });
    this.debugText.setDepth(DEPTH.UI);
  }

  /**
   * デバッグテキストを更新
   */
  private updateDebugText(): void {
    const config = this.player.getCharacterConfig();
    const bulletStats = this.bulletPool?.getStats();
    const activeEnemies = this.enemies.filter(e => e.getIsActive()).length;

    this.debugText.setText([
      `Character: ${config.name}`,
      `HP: ${this.player.getCurrentHp()}/${this.player.getMaxHp()}`,
      `Score: ${this.score}`,
      `Position: (${Math.round(this.player.x)}, ${Math.round(this.player.y)})`,
      `Moving: ${this.player.getIsMoving() ? 'Yes' : 'No'}`,
      `Bullets: ${bulletStats?.active || 0}/${bulletStats?.total || 0}`,
      `Enemies: ${activeEnemies}`,
    ]);
  }

  /**
   * 操作説明を表示
   */
  private showControls(): void {
    const centerX = GAME_CONFIG.WIDTH / 2;
    const y = GAME_CONFIG.HEIGHT - 80;

    const controlsText = this.add.text(centerX, y, [
      '右クリック: 移動',
      '左クリック: 敵を攻撃',
      'A: Attack Move (移動+自動攻撃)',
      'S: 射程範囲表示 (左クリックで範囲攻撃)',
      'Q/W/E/R: スキル (未実装)',
      'D/F: プレイヤースキル (未実装)',
    ], {
      font: '16px monospace',
      color: '#ffffff',
      backgroundColor: '#000000cc',
      padding: { x: 10, y: 10 },
      align: 'center',
    });
    controlsText.setOrigin(0.5);
    controlsText.setDepth(DEPTH.UI);

    // 5秒後にフェードアウト
    this.time.delayedCall(5000, () => {
      this.tweens.add({
        targets: controlsText,
        alpha: 0,
        duration: 1000,
        onComplete: () => {
          controlsText.destroy();
        },
      });
    });
  }
}
