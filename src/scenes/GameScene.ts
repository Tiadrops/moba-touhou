import Phaser from 'phaser';
import { SCENES, GAME_CONFIG, COLORS, DEPTH } from '@/config/GameConfig';
import { Player } from '@/entities/Player';
import { Enemy } from '@/entities/Enemy';
import { Bullet } from '@/entities/Bullet';
import { Rumia } from '@/entities/bosses/Rumia';
import { Boss } from '@/entities/Boss';
import { InputManager } from '@/systems/InputManager';
import { BulletPool } from '@/utils/ObjectPool';
import { DamageCalculator } from '@/utils/DamageCalculator';
import { UIManager } from '@/ui/UIManager';
import { SpellCardCutIn } from '@/ui/components/SpellCardCutIn';
import { CharacterType, EnemyType, BulletType, BossPhaseType } from '@/types';

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
  private rumia: Rumia | null = null; // ルーミア（ボス）
  private bulletTrailGraphics!: Phaser.GameObjects.Graphics; // 弾道補助線用
  private uiManager!: UIManager;
  private spellCardCutIn!: SpellCardCutIn; // スペルカードカットイン演出

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

    // 即座にゲームプレイを開始
    this.startGameplay();
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

    // ルーミア（中ボス）の更新
    if (this.rumia && this.rumia.getIsActive()) {
      if (this.player) {
        this.rumia.setPlayerPosition(this.player.x, this.player.y);
      }
      this.rumia.update(time, delta);

      // ルーミアとの衝突判定（手動チェック）
      this.checkRumiaCollision();
    }

    // 敵の生成（ボス戦中は雑魚敵をスポーンしない）
    const isBossBattle = this.rumia && this.rumia.getIsActive();
    if (this.player && !isBossBattle && time - this.lastEnemySpawnTime > this.enemySpawnInterval) {
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

    // テスト用: ルーミア（中ボス）を配置
    this.spawnRumia();

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
   * ルーミア（ボス）を生成
   */
  private spawnRumia(): void {
    // プレイエリアの中央上部に配置
    const { X, Y, WIDTH, HEIGHT } = GAME_CONFIG.PLAY_AREA;
    const centerX = X + WIDTH / 2;
    const centerY = Y + HEIGHT / 4; // 上から1/4の位置

    // スペルカードカットインを初期化
    if (!this.spellCardCutIn) {
      this.spellCardCutIn = new SpellCardCutIn(this);
    }

    // ルーミアを生成
    this.rumia = new Rumia(this, centerX, centerY);
    this.rumia.setBulletPool(this.bulletPool);
    this.rumia.spawn(centerX, centerY);

    // プレイヤーとInputManagerにボスを設定（攻撃対象として認識させる）
    this.player.setBoss(this.rumia);
    this.inputManager.setBoss(this.rumia);

    // UIにルーミアを表示（フェーズ名付き）
    const currentPhase = this.rumia.getCurrentPhase();
    const phaseName = currentPhase?.name || 'ノーマル';
    this.uiManager?.showBoss(this.rumia, `ルーミア - ${phaseName}`);

    // レーザーダメージイベントをリスニング
    this.events.on('playerHitByLaser', (damage: number) => {
      if (this.player && this.player.active) {
        this.player.takeDamage(damage);
        console.log(`Player hit by laser! Damage: ${damage}`);
      }
    });

    // フェーズ完了イベントをリスニング（カットイン表示）
    this.events.on('boss-phase-complete', (data: {
      boss: Boss;
      completedPhaseIndex: number;
      nextPhaseIndex: number;
    }) => {
      this.onBossPhaseComplete(data);
    });

    // フェーズ開始イベントをリスニング（UI更新）
    this.events.on('boss-phase-start', (data: {
      boss: Boss;
      phaseIndex: number;
      phaseName: string;
      isSpellCard: boolean;
    }) => {
      this.onBossPhaseStart(data);
    });

    console.log(`Rumia spawned! Phase: ${phaseName}, HP: ${currentPhase?.hp}`);
  }

  /**
   * ボスフェーズ完了時の処理
   */
  private onBossPhaseComplete(data: {
    boss: Boss;
    completedPhaseIndex: number;
    nextPhaseIndex: number;
  }): void {
    console.log(`Phase ${data.completedPhaseIndex} complete! Showing cut-in...`);

    // 次のフェーズの情報を取得
    const nextPhase = data.boss.getNextPhase();
    if (!nextPhase) {
      console.log('No next phase, boss defeated!');
      return;
    }

    // スペルカードフェーズならカットイン演出
    if (nextPhase.type === BossPhaseType.SPELL_CARD) {
      // 敵弾を全消去
      this.bulletPool.deactivateEnemyBullets();

      // カットイン演出を表示
      this.spellCardCutIn.show(nextPhase.name, 'ルーミア', () => {
        // カットイン終了後に次フェーズを開始
        data.boss.startNextPhase();
      });
    } else {
      // 通常フェーズなら即座に次へ
      data.boss.startNextPhase();
    }
  }

  /**
   * ボスフェーズ開始時の処理
   */
  private onBossPhaseStart(data: {
    boss: Boss;
    phaseIndex: number;
    phaseName: string;
    isSpellCard: boolean;
  }): void {
    console.log(`Phase ${data.phaseIndex} started: ${data.phaseName}`);

    // UIのボス名を更新
    this.uiManager?.showBoss(
      this.rumia!,
      `ルーミア - ${data.phaseName}`
    );

    // UIのフェーズ表示を更新
    this.uiManager?.setBossPhase(data.phaseIndex, data.phaseName, data.isSpellCard);
  }

  /**
   * ルーミアとの衝突判定（毎フレーム手動チェック）
   */
  private checkRumiaCollision(): void {
    if (!this.rumia || !this.rumia.getIsActive()) return;

    const activeBullets = this.bulletPool.getActiveBullets();
    const bossX = this.rumia.x;
    const bossY = this.rumia.y;
    const bossRadius = this.rumia.getStats().hitboxRadius * 1.6; // スケール適用

    for (const bullet of activeBullets) {
      if (!bullet.getIsActive()) continue;

      // プレイヤー弾のみ処理
      if (bullet.getBulletType() !== BulletType.PLAYER_NORMAL) continue;

      // 円と円の衝突判定
      const dx = bullet.x - bossX;
      const dy = bullet.y - bossY;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const bulletRadius = 8; // プレイヤー弾の当たり判定

      if (distance < bossRadius + bulletRadius) {
        // 衝突！
        const rawDamage = bullet.getDamage();
        const defenseReduction = DamageCalculator.calculateDamageReduction(this.rumia.getDefense());
        const finalDamage = Math.max(1, Math.floor(rawDamage * defenseReduction));

        // ダメージを与える
        const destroyed = this.rumia.takeDamage(finalDamage);
        bullet.deactivate();

        if (destroyed) {
          this.score += 5000; // ボス撃破スコア
          console.log('Rumia defeated! Score: +5000');
        }
      }
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
    // テスト用: 中ボス/ボスは通常スポーンしない（テスト用中ボスのみ）
    const rand = Math.random();
    let enemyType: EnemyType;
    if (rand < 0.7) {
      enemyType = EnemyType.NORMAL; // 70%
    } else {
      enemyType = EnemyType.ELITE; // 30%
    }

    // 弾プールとプレイヤー位置を設定
    enemy.setBulletPool(this.bulletPool);

    enemy.spawn(spawnX, spawnY, enemyType, pattern);
    // 注: テスト用中ボスはspawnTestMiniBoss()で個別にスポーンし、UIManagerに登録済み
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

        // 防御力を考慮したダメージ計算
        const rawDamage = bullet.getDamage();
        const defenseReduction = DamageCalculator.calculateDamageReduction(enemy.getDefense());
        const finalDamage = Math.max(1, Math.floor(rawDamage * defenseReduction));

        // 敵にダメージ（必中：弾が当たった時点でダメージ）
        const destroyed = enemy.takeDamage(finalDamage);
        bullet.deactivate();

        // クリティカルヒット表示（デバッグ用）
        if (bullet.getIsCritical()) {
          // TODO: クリティカルエフェクト表示
        }

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

        // 防御力を考慮したダメージ計算
        const rawDamage = bullet.getDamage();
        const defenseReduction = DamageCalculator.calculateDamageReduction(this.player.getDefense());
        const finalDamage = Math.max(1, Math.floor(rawDamage * defenseReduction));

        // プレイヤーがダメージを受ける
        this.player.takeDamage(finalDamage);

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
