import Phaser from 'phaser';
import { SCENES, GAME_CONFIG, COLORS, DEPTH } from '@/config/GameConfig';
import { Player } from '@/entities/Player';
import { Enemy } from '@/entities/Enemy';
import { Bullet } from '@/entities/Bullet';
import { Rumia } from '@/entities/bosses/Rumia';
import { Boss } from '@/entities/Boss';
import { InputManager } from '@/systems/InputManager';
import { AudioManager } from '@/systems/AudioManager';
import { SummonerSkillManager } from '@/systems/SummonerSkillManager';
import { BulletPool } from '@/utils/ObjectPool';
import { DamageCalculator } from '@/utils/DamageCalculator';
import { UIManager } from '@/ui/UIManager';
import { SpellCardCutInV2 } from '@/ui/components/SpellCardCutInV2';
import { CharacterType, EnemyType, BulletType, BossPhaseType, GameMode, Difficulty, GameStartData, StageIntroData, PlayerSkillType, SummonerSkillConfig } from '@/types';
import { PauseData } from './PauseScene';

/**
 * GameScene - メインゲームプレイシーン
 */
export class GameScene extends Phaser.Scene {
  private playArea!: Phaser.GameObjects.Rectangle;
  private fpsText!: Phaser.GameObjects.Text;
  private infoText!: Phaser.GameObjects.Text;
  private debugText!: Phaser.GameObjects.Text;

  // 背景スクロール（パン方式）
  private bgImage!: Phaser.GameObjects.Image;
  private bgVelocityX: number = 8; // X方向速度（ピクセル/秒）
  private bgVelocityY: number = 15; // Y方向速度（ピクセル/秒）

  // ゲームオブジェクト
  private player!: Player;
  private inputManager!: InputManager;
  private summonerSkillManager!: SummonerSkillManager;
  private bulletPool!: BulletPool;
  private enemies: Enemy[] = [];
  private rumia: Rumia | null = null; // ルーミア（ボス）
  private bulletTrailGraphics!: Phaser.GameObjects.Graphics; // 弾道補助線用
  private uiManager!: UIManager;
  private spellCardCutIn!: SpellCardCutInV2; // スペルカードカットイン演出

  // 敵の生成管理
  private lastEnemySpawnTime: number = 0;
  private enemySpawnInterval: number = 2000; // 2秒ごと
  private score: number = 0;

  // ボス撃破リザルトUI
  private bossResultOverlay: Phaser.GameObjects.Rectangle | null = null;
  private bossResultContainer: Phaser.GameObjects.Container | null = null;
  private bossResultDelayedCalls: Phaser.Time.TimerEvent[] = [];
  private bossResultCountdownText: Phaser.GameObjects.Text | null = null;
  private bossResultCountdownTimer: Phaser.Time.TimerEvent | null = null;
  private isBossDefeated: boolean = false;

  // ゲーム開始データ（リトライ時に使用）
  private gameStartData: GameStartData | null = null;

  constructor() {
    super({ key: SCENES.GAME });
  }

  init(data?: GameStartData): void {
    // ゲーム開始データを保存
    if (data && Object.keys(data).length > 0) {
      this.gameStartData = data;
    }
  }

  create(): void {
    // カメラのフェード状態をリセットしてからフェードイン
    this.cameras.main.resetFX();
    this.cameras.main.fadeIn(300);

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
    // 背景スクロール
    this.updateScrollingBackground(delta);

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

    // サモナースキルマネージャーの更新
    if (this.summonerSkillManager) {
      // 敵弾リストを設定（天狗団扇用）
      const enemyBullets = this.bulletPool?.getActiveBullets().filter(
        (b: Bullet) => b.getBulletType() === BulletType.ENEMY_NORMAL
      ) || [];
      this.summonerSkillManager.setEnemyBullets(enemyBullets);

      // 敵リストを設定（霊撃用）- ボスと通常敵を含む
      const activeEnemies: import('@/types').Attackable[] = [...this.enemies.filter(e => e.getIsActive())];
      if (this.rumia && this.rumia.getIsActive()) {
        activeEnemies.push(this.rumia);
      }
      this.summonerSkillManager.setEnemies(activeEnemies);

      // 射程ボーナスをプレイヤーに反映
      this.player?.setRangeBonus(this.summonerSkillManager.getRangeBonus());

      this.summonerSkillManager.update(time, delta);
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
    if (this.rumia) {
      if (this.rumia.getIsActive()) {
        if (this.player) {
          this.rumia.setPlayerPosition(this.player.x, this.player.y);
        }
        this.rumia.update(time, delta);

        // ルーミアとの衝突判定（手動チェック）
        this.checkRumiaCollision();
      } else if (!this.isBossDefeated) {
        // ボスが非アクティブ化された（スキル等で撃破された）
        this.score += 5000;
        console.log('Rumia defeated by skill! Score: +5000');
        this.onBossDefeated();
      }
    }

    // 敵の生成（ボス戦中・ボス撃破後は雑魚敵をスポーンしない）
    const isBossBattle = this.rumia && this.rumia.getIsActive();
    if (this.player && !isBossBattle && !this.isBossDefeated && time - this.lastEnemySpawnTime > this.enemySpawnInterval) {
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

    // プレイエリアの背景（フォールバック用）
    this.playArea = this.add.rectangle(
      X,
      Y,
      WIDTH,
      HEIGHT,
      COLORS.PLAY_AREA_BG
    );
    this.playArea.setOrigin(0, 0);
    this.playArea.setDepth(DEPTH.BACKGROUND);

    // スクロール背景を作成
    this.createScrollingBackground();

    // プレイエリアの枠線
    const border = this.add.graphics();
    border.lineStyle(2, COLORS.PLAY_AREA_BORDER, 1);
    border.strokeRect(X, Y, WIDTH, HEIGHT);
    border.setDepth(DEPTH.PLAY_AREA);
  }

  /**
   * スクロール背景を作成（パン方式）
   */
  private createScrollingBackground(): void {
    const { X, Y, WIDTH, HEIGHT } = GAME_CONFIG.PLAY_AREA;
    const centerX = X + WIDTH / 2;
    const centerY = Y + HEIGHT / 2;

    // 背景テクスチャが存在するか確認
    if (!this.textures.exists('bg_stage1')) {
      console.warn('bg_stage1 texture not found');
      return;
    }

    // 背景画像の元サイズを取得
    const bgTexture = this.textures.get('bg_stage1');
    const bgFrame = bgTexture.get();
    const bgOriginalWidth = bgFrame.width;
    const bgOriginalHeight = bgFrame.height;

    // プレイエリアをカバーしつつ、パン用の余白を確保するスケール
    // 幅と高さの両方をカバーし、さらに50%余白を追加
    const scaleX = (WIDTH * 1.5) / bgOriginalWidth;
    const scaleY = (HEIGHT * 1.5) / bgOriginalHeight;
    const scale = Math.max(scaleX, scaleY);

    // 背景画像を作成（中央配置）
    this.bgImage = this.add.image(centerX, centerY, 'bg_stage1');
    this.bgImage.setOrigin(0.5, 0.5);
    this.bgImage.setScale(scale);
    this.bgImage.setDepth(DEPTH.PLAY_AREA);

    // プレイエリア外をマスクで隠す
    const maskGraphics = this.make.graphics({ x: 0, y: 0 });
    maskGraphics.fillStyle(0xffffff);
    maskGraphics.fillRect(X, Y, WIDTH, HEIGHT);
    const mask = maskGraphics.createGeometryMask();
    this.bgImage.setMask(mask);

    console.log(`Background created: scale=${scale.toFixed(2)}, size=${(bgOriginalWidth * scale).toFixed(0)}x${(bgOriginalHeight * scale).toFixed(0)}`);
  }

  /**
   * 背景スクロールを更新（パン方式 - 端で反転）
   */
  private updateScrollingBackground(delta: number): void {
    if (!this.bgImage) return;

    const { X, Y, WIDTH, HEIGHT } = GAME_CONFIG.PLAY_AREA;
    const centerX = X + WIDTH / 2;
    const centerY = Y + HEIGHT / 2;

    // 画像の表示サイズ
    const imgHalfWidth = this.bgImage.displayWidth / 2;
    const imgHalfHeight = this.bgImage.displayHeight / 2;

    // 移動可能な範囲（画像がプレイエリアをはみ出さない範囲）
    const maxOffsetX = imgHalfWidth - WIDTH / 2;
    const maxOffsetY = imgHalfHeight - HEIGHT / 2;

    // 移動
    const deltaSeconds = delta / 1000;
    this.bgImage.x += this.bgVelocityX * deltaSeconds;
    this.bgImage.y += this.bgVelocityY * deltaSeconds;

    // 端に達したら方向を反転
    if (this.bgImage.x <= centerX - maxOffsetX) {
      this.bgImage.x = centerX - maxOffsetX;
      this.bgVelocityX = Math.abs(this.bgVelocityX);
    } else if (this.bgImage.x >= centerX + maxOffsetX) {
      this.bgImage.x = centerX + maxOffsetX;
      this.bgVelocityX = -Math.abs(this.bgVelocityX);
    }

    if (this.bgImage.y <= centerY - maxOffsetY) {
      this.bgImage.y = centerY - maxOffsetY;
      this.bgVelocityY = Math.abs(this.bgVelocityY);
    } else if (this.bgImage.y >= centerY + maxOffsetY) {
      this.bgImage.y = centerY + maxOffsetY;
      this.bgVelocityY = -Math.abs(this.bgVelocityY);
    }
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
    // ルーミア戦BGMを再生
    const audioManager = AudioManager.getInstance();
    audioManager.setScene(this);
    audioManager.playBgm('bgm_rumia');

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

    // サモナースキルマネージャー（デフォルトでフラッシュと霊撃を設定）
    const summonerConfig: SummonerSkillConfig = this.gameStartData?.summonerSkills || {
      D: PlayerSkillType.FLASH,
      F: PlayerSkillType.SPIRIT_STRIKE,
    };
    this.summonerSkillManager = new SummonerSkillManager(this, this.player, summonerConfig);
    this.inputManager.setSummonerSkillManager(this.summonerSkillManager);
    this.player.setSummonerSkillManager(this.summonerSkillManager);

    // 衝突判定を設定
    this.setupCollisions();

    // デバッグ情報を追加
    if (GAME_CONFIG.DEBUG) {
      this.createPlayerDebugInfo();
    }

    // UIマネージャーを初期化
    this.uiManager = new UIManager(this, this.player);
    this.uiManager.setSummonerSkillManager(this.summonerSkillManager);

    // テスト用: ルーミア（中ボス）を配置
    this.spawnRumia();

    // 操作説明を表示
    this.showControls();

    // ポーズ画面の入力設定
    this.setupPauseInput();
  }

  /**
   * ポーズ入力の設定
   */
  private setupPauseInput(): void {
    this.input.keyboard?.on('keydown-SPACE', () => {
      this.openPauseMenu();
    });

    this.input.keyboard?.on('keydown-ESC', () => {
      this.openPauseMenu();
    });
  }

  /**
   * ポーズメニューを開く
   */
  private openPauseMenu(): void {
    // 既にポーズ中なら何もしない
    if (this.scene.isPaused(SCENES.GAME)) {
      return;
    }

    // ポーズSEを鳴らす
    AudioManager.getInstance().playSe('se_pause');

    // ゲームを一時停止してポーズシーンを起動
    this.scene.pause();

    // ゲーム開始データからリトライ用データを作成
    const retryData: StageIntroData = this.gameStartData ? {
      mode: this.gameStartData.mode,
      character: this.gameStartData.character,
      difficulty: this.gameStartData.difficulty,
      stageNumber: this.gameStartData.stageNumber,
      continueData: this.gameStartData.continueData,
      practiceConfig: this.gameStartData.practiceConfig,
    } : {
      // デフォルト値（データがない場合）
      mode: GameMode.ARCADE,
      character: CharacterType.REIMU,
      difficulty: Difficulty.NORMAL,
      stageNumber: 1,
    };

    const pauseData: PauseData = {
      retryData,
      player: this.player,
      boss: this.rumia,
    };

    this.scene.launch(SCENES.PAUSE, pauseData);
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

    // スペルカードカットインを初期化（V2 + 闇紅テーマ）
    if (!this.spellCardCutIn) {
      this.spellCardCutIn = new SpellCardCutInV2(this);
      // 闇紅カラーテーマを適用
      this.spellCardCutIn.setColorTheme(0xff3366, 0x220011, 0x110008);
    }

    // ルーミアを生成
    this.rumia = new Rumia(this, centerX, centerY);
    this.rumia.setBulletPool(this.bulletPool);
    this.rumia.spawn(centerX, centerY);

    // プレイヤーとInputManagerにボスを設定（攻撃対象として認識させる）
    this.player.setBoss(this.rumia);
    this.inputManager.setBoss(this.rumia);

    // ボス登場カットインはMidStageSceneで表示済みなので、即座にUIを表示
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

    // ブレイクイベントをリスニング（スコア加算）
    this.events.on('bossBreak', () => {
      this.uiManager?.onBreak();
    });

    const initialPhase = this.rumia.getCurrentPhase();
    console.log(`Rumia spawned! Phase: ${initialPhase?.name || 'ノーマル'}, HP: ${initialPhase?.hp}`);
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

        // ダメージを与える（撃破判定はupdateループで行う）
        this.rumia.takeDamage(finalDamage);
        bullet.deactivate();
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

        // AA弾はターゲット以外の敵をすり抜ける
        const bulletTarget = bullet.getTarget();
        if (bulletTarget && bulletTarget !== enemy) {
          return; // ターゲット以外の敵は無視
        }

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

  /**
   * ボス撃破時の処理
   */
  private onBossDefeated(): void {
    if (this.isBossDefeated) return;
    this.isBossDefeated = true;

    // ボス撃破SE再生
    AudioManager.getInstance().playSe('se_boss_defeat');

    // 敵弾を全消去
    this.bulletPool.deactivateEnemyBullets();

    // ボスUIを非表示
    this.uiManager?.hideBossInfo();

    // BGMをフェードアウト
    AudioManager.getInstance().stopBgm();

    // 少し遅延してリザルト画面を表示
    this.time.delayedCall(1000, () => {
      this.showBossResultUI();
    });
  }

  /**
   * ボス撃破リザルトUIを表示
   */
  private showBossResultUI(): void {
    // 前回の遅延呼び出しをクリア（念のため）
    this.bossResultDelayedCalls.forEach(timer => {
      if (timer && !timer.hasDispatched) {
        timer.destroy();
      }
    });
    this.bossResultDelayedCalls = [];

    // カウントダウンタイマーをクリア
    if (this.bossResultCountdownTimer) {
      this.bossResultCountdownTimer.destroy();
      this.bossResultCountdownTimer = null;
    }

    const { X, Y, WIDTH, HEIGHT } = GAME_CONFIG.PLAY_AREA;
    const centerX = X + WIDTH / 2;
    const centerY = Y + HEIGHT / 2;

    // ブレイクスコアを取得
    const breakCount = this.uiManager?.getBreakCount() ?? 0;
    const breakScore = breakCount * 100;

    // 半透明オーバーレイ
    this.bossResultOverlay = this.add.rectangle(
      centerX,
      centerY,
      WIDTH,
      HEIGHT,
      0x000000,
      0.7
    );
    this.bossResultOverlay.setDepth(DEPTH.UI - 10);

    // コンテナを作成（スコアボードは中央に配置）
    this.bossResultContainer = this.add.container(centerX, centerY);
    this.bossResultContainer.setDepth(DEPTH.UI);

    // ルーミア立ち絵を左側に配置（スコアボードの反対側）
    const rumiaImage = this.add.image(-500, HEIGHT / 2, 'portrait_rumia_2');
    rumiaImage.setScale(0.7);
    rumiaImage.setOrigin(0.5, 1); // 下端基準
    rumiaImage.setAlpha(0);
    rumiaImage.setFlipX(true); // 左向きに反転
    this.bossResultContainer.add(rumiaImage);

    // 霊夢立ち絵を右側に配置
    const reimuImage = this.add.image(360, HEIGHT / 2, 'result_reimu');
    reimuImage.setScale(0.6);
    reimuImage.setOrigin(0.5, 1);
    reimuImage.setAlpha(0);
    this.bossResultContainer.add(reimuImage);

    // リザルト背景画像
    const resultBackground = this.add.image(0, 30, 'result_background');
    resultBackground.setDisplaySize(500, 520);
    resultBackground.setAlpha(0);
    this.bossResultContainer.add(resultBackground);

    // 上部の装飾ライン（深紅色）
    const topLine = this.add.rectangle(0, -200, 450, 4, 0x8b0000);
    topLine.setAlpha(0);
    this.bossResultContainer.add(topLine);

    // ボス撃破テキスト
    const clearText = this.add.text(0, -170, 'ルーミア 撃破!', {
      font: 'bold 42px sans-serif',
      color: '#8b0000',
      stroke: '#ffffff',
      strokeThickness: 3,
    });
    clearText.setOrigin(0.5);
    clearText.setAlpha(0);
    this.bossResultContainer.add(clearText);

    // 中央の装飾ライン（深紅色）
    const midLine = this.add.rectangle(0, -135, 380, 2, 0x8b0000);
    midLine.setAlpha(0);
    this.bossResultContainer.add(midLine);

    // ヘッダー要素（SE再生と同時に表示）
    const headerElements = [topLine, clearText, midLine, rumiaImage, reimuImage];

    // スコア内訳の開始Y座標
    let scoreY = -100;
    const lineHeight = 36;
    const labelX = -150;
    const valueX = 150;

    // 順次表示用の要素配列
    const sequentialElements: Phaser.GameObjects.GameObject[][] = [];

    // 撃破スコア（ボスでは--表示）
    const killLabel = this.add.text(labelX, scoreY, '撃破スコア', {
      font: '24px sans-serif',
      color: '#2d2d2d',
    });
    killLabel.setOrigin(0, 0.5);
    killLabel.setAlpha(0);
    this.bossResultContainer.add(killLabel);

    const killValue = this.add.text(valueX, scoreY, '--', {
      font: 'bold 24px sans-serif',
      color: '#888888',
    });
    killValue.setOrigin(1, 0.5);
    killValue.setAlpha(0);
    this.bossResultContainer.add(killValue);

    const killDetail = this.add.text(valueX + 10, scoreY, '(mid only)', {
      font: '18px sans-serif',
      color: '#888888',
    });
    killDetail.setOrigin(0, 0.5);
    killDetail.setAlpha(0);
    this.bossResultContainer.add(killDetail);

    scoreY += lineHeight;

    // ブレイクスコア（ボスで有効）
    const breakLabel = this.add.text(labelX, scoreY, 'ブレイクスコア', {
      font: '24px sans-serif',
      color: '#2d2d2d',
    });
    breakLabel.setOrigin(0, 0.5);
    breakLabel.setAlpha(0);
    this.bossResultContainer.add(breakLabel);

    const breakValue = this.add.text(valueX, scoreY, this.formatScore(breakScore), {
      font: 'bold 24px sans-serif',
      color: '#1a1a1a',
    });
    breakValue.setOrigin(1, 0.5);
    breakValue.setAlpha(0);
    this.bossResultContainer.add(breakValue);

    const breakDetail = this.add.text(valueX + 10, scoreY, `(${breakCount}回)`, {
      font: '18px sans-serif',
      color: '#555555',
    });
    breakDetail.setOrigin(0, 0.5);
    breakDetail.setAlpha(0);
    this.bossResultContainer.add(breakDetail);

    // 撃破スコアとブレイクスコアを同時に表示
    sequentialElements.push([killLabel, killValue, killDetail, breakLabel, breakValue, breakDetail]);

    scoreY += lineHeight;

    // タイムボーナス（仮 - 0表示）
    const timeLabel = this.add.text(labelX, scoreY, 'タイムボーナス', {
      font: '24px sans-serif',
      color: '#2d2d2d',
    });
    timeLabel.setOrigin(0, 0.5);
    timeLabel.setAlpha(0);
    this.bossResultContainer.add(timeLabel);

    const timeValue = this.add.text(valueX, scoreY, '+0', {
      font: 'bold 24px sans-serif',
      color: '#888888',
    });
    timeValue.setOrigin(1, 0.5);
    timeValue.setAlpha(0);
    this.bossResultContainer.add(timeValue);

    sequentialElements.push([timeLabel, timeValue]);

    scoreY += lineHeight;

    // ノーダメージボーナス（仮 - 0表示）
    const noDamageLabel = this.add.text(labelX, scoreY, 'ノーダメボーナス', {
      font: '24px sans-serif',
      color: '#2d2d2d',
    });
    noDamageLabel.setOrigin(0, 0.5);
    noDamageLabel.setAlpha(0);
    this.bossResultContainer.add(noDamageLabel);

    const noDamageValue = this.add.text(valueX, scoreY, '---', {
      font: 'bold 24px sans-serif',
      color: '#888888',
    });
    noDamageValue.setOrigin(1, 0.5);
    noDamageValue.setAlpha(0);
    this.bossResultContainer.add(noDamageValue);

    sequentialElements.push([noDamageLabel, noDamageValue]);

    scoreY += lineHeight + 10;

    // 区切り線（深紅色）
    const separatorLine = this.add.rectangle(0, scoreY, 400, 2, 0x8b0000);
    separatorLine.setAlpha(0);
    this.bossResultContainer.add(separatorLine);

    scoreY += 20;

    // ボス合計
    const totalLabel = this.add.text(labelX, scoreY, 'ボス合計', {
      font: 'bold 28px sans-serif',
      color: '#8b0000',
    });
    totalLabel.setOrigin(0, 0.5);
    totalLabel.setAlpha(0);
    this.bossResultContainer.add(totalLabel);

    const totalValue = this.add.text(valueX, scoreY, this.formatScore(breakScore), {
      font: 'bold 28px sans-serif',
      color: '#8b0000',
    });
    totalValue.setOrigin(1, 0.5);
    totalValue.setAlpha(0);
    this.bossResultContainer.add(totalValue);

    sequentialElements.push([separatorLine, totalLabel, totalValue]);

    scoreY += lineHeight + 20;

    // 下部の装飾ライン（深紅色）
    const bottomLine1 = this.add.rectangle(0, scoreY, 450, 4, 0x8b0000);
    bottomLine1.setAlpha(0);
    this.bossResultContainer.add(bottomLine1);

    scoreY += 25;

    // クリアテキスト
    const completeText = this.add.text(0, scoreY, 'Stage 1 クリア!', {
      font: 'bold 30px sans-serif',
      color: '#006400',
      stroke: '#ffffff',
      strokeThickness: 2,
    });
    completeText.setOrigin(0.5);
    completeText.setAlpha(0);
    this.bossResultContainer.add(completeText);

    scoreY += 50;

    // 下部の装飾ライン（深紅色）
    const bottomLine2 = this.add.rectangle(0, scoreY, 450, 4, 0x8b0000);
    bottomLine2.setAlpha(0);
    this.bossResultContainer.add(bottomLine2);

    sequentialElements.push([bottomLine1, completeText, bottomLine2]);

    // フェードインアニメーション（オーバーレイと背景とヘッダー部分）
    this.bossResultOverlay.setAlpha(0);
    this.bossResultContainer.setAlpha(1);

    this.tweens.add({
      targets: this.bossResultOverlay,
      alpha: 0.7,
      duration: 500,
      ease: 'Power2',
    });

    this.tweens.add({
      targets: resultBackground,
      alpha: 0.7,
      duration: 500,
      ease: 'Power2',
    });

    // SE再生
    AudioManager.getInstance().playSe('se_spellcard');

    // ヘッダー部分を即座に表示
    this.tweens.add({
      targets: headerElements,
      alpha: 1,
      duration: 300,
      ease: 'Power2',
    });

    // 順次表示アニメーション（SE後0.5秒ごとに各行を表示）
    const displayInterval = 500;
    const totalIndex = 3;  // ボス合計のインデックス
    const completeIndex = 4; // Stage クリアのインデックス
    sequentialElements.forEach((elements, index) => {
      const timerEvent = this.time.delayedCall(displayInterval * (index + 1), () => {
        // 行ごとのSE再生
        if (index === totalIndex) {
          AudioManager.getInstance().playSe('se_result_total');
        } else if (index === completeIndex) {
          AudioManager.getInstance().playSe('se_result_reward');
        } else if (index < sequentialElements.length - 1) {
          AudioManager.getInstance().playSe('se_result_line');
        }
        this.tweens.add({
          targets: elements,
          alpha: 1,
          duration: 200,
          ease: 'Power2',
        });
      });
      this.bossResultDelayedCalls.push(timerEvent);
    });

    // カウントダウン表示（Waveと同様）
    const allElementsDisplayedTime = displayInterval * sequentialElements.length;
    const countdownDuration = 5; // 5秒カウントダウン
    let remainingSeconds = countdownDuration;

    // カウントダウンテキストを作成（最初は非表示）
    this.bossResultCountdownText = this.add.text(
      180,  // コンテナ中心から右に180px
      scoreY + 40,  // 最後の要素の下
      `${remainingSeconds}`,
      {
        font: 'bold 48px sans-serif',
        color: '#8b0000',
        stroke: '#ffffff',
        strokeThickness: 3,
      }
    );
    this.bossResultCountdownText.setOrigin(1, 0.5);
    this.bossResultCountdownText.setAlpha(0);
    this.bossResultContainer.add(this.bossResultCountdownText);

    // 全要素表示後にカウントダウン開始
    const countdownStartTimer = this.time.delayedCall(allElementsDisplayedTime + displayInterval, () => {
      if (this.bossResultCountdownText) {
        this.bossResultCountdownText.setAlpha(1);
        AudioManager.getInstance().playSe('se_result_countdown');
      }

      // 1秒ごとにカウントダウン（0まで表示）
      this.bossResultCountdownTimer = this.time.addEvent({
        delay: 1000,
        callback: () => {
          remainingSeconds--;
          if (this.bossResultCountdownText && remainingSeconds >= 0) {
            this.bossResultCountdownText.setText(`${remainingSeconds}`);
            AudioManager.getInstance().playSe('se_result_countdown');
          }
          // カウントダウン終了後に遷移
          if (remainingSeconds <= 0) {
            this.transitionToStage2();
          }
        },
        repeat: countdownDuration,
      });
    });
    this.bossResultDelayedCalls.push(countdownStartTimer);
  }

  /**
   * ステージ2の出撃画面へ遷移
   */
  private transitionToStage2(): void {
    // フェードアウト
    this.cameras.main.fadeOut(500, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      // ステージ2の出撃画面データを作成
      const stage2Data: StageIntroData = {
        mode: this.gameStartData?.mode ?? GameMode.ARCADE,
        character: this.gameStartData?.character ?? CharacterType.REIMU,
        difficulty: this.gameStartData?.difficulty ?? Difficulty.NORMAL,
        stageNumber: 2,
        continueData: {
          score: this.score,
          lives: 3, // TODO: 現在の残機を引き継ぐ
        },
      };

      this.scene.start(SCENES.STAGE_INTRO, stage2Data);
    });
  }

  /**
   * スコアをカンマ区切りでフォーマット
   */
  private formatScore(score: number): string {
    return score.toLocaleString();
  }
}
