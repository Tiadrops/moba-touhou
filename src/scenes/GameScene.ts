import Phaser from 'phaser';
import { SCENES, GAME_CONFIG, COLORS, DEPTH } from '@/config/GameConfig';
import { Player } from '@/entities/Player';
import { Enemy } from '@/entities/Enemy';
import { Bullet } from '@/entities/Bullet';
import { InputManager } from '@/systems/InputManager';
import { BulletPool } from '@/utils/ObjectPool';
import { UIManager } from '@/ui/UIManager';
import { CharacterType, EnemyType, BulletType } from '@/types';

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
  private bulletTrailGraphics!: Phaser.GameObjects.Graphics; // 弾道補助線用
  private uiManager!: UIManager;

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

      // Rスキル範囲内の敵弾を消滅
      if (this.player && this.player.getIsRSkillActive()) {
        this.destroyEnemyBulletsInRSkillArea();
      }

      // 弾道補助線を描画（設定でONの場合のみ）
      if (GAME_CONFIG.SHOW_BULLET_TRAILS) {
        this.drawBulletTrails();
      }
    }

    // 敵の更新
    for (const enemy of this.enemies) {
      if (enemy.getIsActive()) {
        // プレイヤー位置を敵に設定（弾幕の狙い先）
        if (this.player) {
          enemy.setPlayerPosition(this.player.x, this.player.y);
        }
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

    // UI更新
    if (this.uiManager) {
      this.uiManager.update(time, delta);
    }
  }

  /**
   * 弾道補助線を描画
   */
  private drawBulletTrails(): void {
    if (!this.bulletTrailGraphics) return;

    // 前フレームの描画をクリア
    this.bulletTrailGraphics.clear();

    // プレイエリアの境界を取得
    const { X, Y, WIDTH, HEIGHT } = GAME_CONFIG.PLAY_AREA;
    const minX = X;
    const maxX = X + WIDTH;
    const minY = Y;
    const maxY = Y + HEIGHT;

    // 座標をプレイエリア内にクランプするヘルパー関数
    const clamp = (value: number, min: number, max: number) =>
      Math.max(min, Math.min(max, value));

    // すべてのアクティブな弾の軌跡を描画
    const activeBullets = this.bulletPool.getActiveBullets();
    for (const bullet of activeBullets) {
      const startPos = bullet.getStartPosition();
      const bulletType = bullet.getBulletType();

      // 弾の種類に応じて軌跡の色を変える
      if (bulletType === BulletType.PLAYER_NORMAL) {
        // プレイヤー弾: 緑
        this.bulletTrailGraphics.lineStyle(2, COLORS.TRAIL_PLAYER, 0.7);
      } else {
        // 敵弾: マゼンタ
        this.bulletTrailGraphics.lineStyle(2, COLORS.TRAIL_ENEMY, 0.7);
      }

      // 軌跡の座標をプレイエリア内にクランプ
      this.bulletTrailGraphics.lineBetween(
        clamp(startPos.x, minX, maxX),
        clamp(startPos.y, minY, maxY),
        clamp(bullet.x, minX, maxX),
        clamp(bullet.y, minY, maxY)
      );
    }
  }

  /**
   * Rスキル範囲内の敵弾を消滅させる
   */
  private destroyEnemyBulletsInRSkillArea(): void {
    const rSkillArea = this.player.getRSkillArea();
    if (!rSkillArea) return;

    const halfSize = rSkillArea.size / 2;
    const activeBullets = this.bulletPool.getActiveBullets();

    for (const bullet of activeBullets) {
      // プレイヤー弾は無視
      if (bullet.getBulletType() === BulletType.PLAYER_NORMAL) continue;

      // 長方形範囲内かチェック
      if (Math.abs(bullet.x - rSkillArea.x) <= halfSize &&
          Math.abs(bullet.y - rSkillArea.y) <= halfSize) {
        bullet.deactivate();
      }
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
    // 弾プールを作成（初期50個、最大10000個まで拡張可能）
    this.bulletPool = new BulletPool(this, 50, 10000);

    // 弾道補助線用のGraphicsを作成
    this.bulletTrailGraphics = this.add.graphics();
    this.bulletTrailGraphics.setDepth(DEPTH.BULLETS_PLAYER - 1); // 弾の下に描画

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

    // UIマネージャーを初期化
    this.uiManager = new UIManager(this, this.player);

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
    const { X, Y, WIDTH } = GAME_CONFIG.PLAY_AREA;
    const spawnX = X + Math.random() * WIDTH;
    const spawnY = Y - 50; // プレイエリアの上端から少し上に生成

    // ランダムな移動パターン
    const patterns: Array<'straight' | 'wave' | 'zigzag'> = ['straight', 'wave', 'zigzag'];
    const pattern = Phaser.Utils.Array.GetRandom(patterns);

    // ランダムな敵タイプ（重み付き）
    const rand = Math.random();
    let enemyType: EnemyType;
    if (rand < 0.6) {
      enemyType = EnemyType.NORMAL; // 60%
    } else if (rand < 0.85) {
      enemyType = EnemyType.ELITE; // 25%
    } else if (rand < 0.97) {
      enemyType = EnemyType.MINI_BOSS; // 12%
    } else {
      enemyType = EnemyType.BOSS; // 3%
    }

    // 弾プールとプレイヤー位置を設定
    enemy.setBulletPool(this.bulletPool);

    enemy.spawn(spawnX, spawnY, enemyType, pattern);

    // ボス/中ボスの場合はUI表示
    if (enemyType === EnemyType.MINI_BOSS || enemyType === EnemyType.BOSS) {
      this.uiManager.showBossInfo(enemy);
    }
  }

  /**
   * 衝突判定を設定
   */
  private setupCollisions(): void {
    // プレイヤーの弾と敵の衝突
    this.physics.add.overlap(
      this.enemies,
      this.bulletPool.getGroup(),
      (enemyObj, bulletObj) => {
        const enemy = enemyObj as Enemy;
        const bullet = bulletObj as Bullet;

        if (!bullet.getIsActive()) return;
        if (!enemy.getIsActive()) return;

        // プレイヤー弾のみ処理（敵弾は無視）
        if (bullet.getBulletType() !== BulletType.PLAYER_NORMAL) return;

        // 敵にダメージ（必中：弾が当たった時点でダメージ）
        const destroyed = enemy.takeDamage(bullet.getDamage());
        bullet.deactivate();

        // 敵を撃破したらスコア加算
        if (destroyed) {
          this.score += enemy.getScoreValue();
        }
      }
    );

    // 敵とプレイヤーの衝突（接触しても何も起きない - 物理的に重なることを許可）

    // 敵弾とプレイヤーの衝突
    this.physics.add.overlap(
      this.player,
      this.bulletPool.getGroup(),
      (_playerObj, bulletObj) => {
        const bullet = bulletObj as Bullet;

        if (!bullet.getIsActive()) return;

        // プレイヤー弾は無視（BulletTypeの値で判定）
        if (bullet.getBulletType() === BulletType.PLAYER_NORMAL) return;

        // プレイヤーがダメージを受ける
        this.player.takeDamage(bullet.getDamage());

        // 弾を消す
        bullet.deactivate();
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
