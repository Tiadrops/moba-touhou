import Phaser from 'phaser';
import { SCENES, GAME_CONFIG, DEPTH, UNIT } from '@/config/GameConfig';
import { MobGroupA, MobAPatternType } from '@/entities/mobs/MobGroupA';
import { MobGroupB, MobBPatternType } from '@/entities/mobs/MobGroupB';
import { MobGroupC, MobCPatternType } from '@/entities/mobs/MobGroupC';
import { BulletPool } from '@/utils/ObjectPool';

/**
 * 移動パターンタイプ
 */
type MovementType = 'stay' | 'chase' | 'random_walk';

/**
 * 雑魚パターン情報
 */
interface MobPatternInfo {
  name: string;
  group: 'A' | 'B' | 'C';
  pattern: MobAPatternType | MobBPatternType | MobCPatternType;
  description: string;
  movement?: MovementType;  // 移動パターン（デフォルト: stay）
}

/**
 * MobTestScene - 雑魚弾幕テスト画面
 * 全雑魚パターンを確認・テストできる
 */
export class MobTestScene extends Phaser.Scene {
  private mobGroupA: MobGroupA | null = null;
  private mobGroupB: MobGroupB | null = null;
  private mobGroupC: MobGroupC | null = null;
  private bulletPool!: BulletPool;
  private currentPatternIndex: number = 0;
  private patterns: MobPatternInfo[] = [];
  private infoText!: Phaser.GameObjects.Text;
  private playerMarker!: Phaser.GameObjects.Graphics;
  private playerPos: { x: number; y: number } = { x: 0, y: 0 };

  constructor() {
    super({ key: SCENES.MOB_TEST });
  }

  create(): void {
    this.cameras.main.fadeIn(300);

    // 初期化
    this.currentPatternIndex = 0;

    // パターン情報を初期化
    this.initPatterns();

    // 背景
    this.createBackground();

    // 弾プール作成
    this.bulletPool = new BulletPool(this);

    // UI作成
    this.createUI();

    // プレイヤーマーカー作成（仮想プレイヤー位置）
    this.createPlayerMarker();

    // キーボード入力
    this.setupKeyboardInput();

    // マウス入力
    this.setupMouseInput();

    // 初期雑魚をスポーン
    this.spawnCurrentMob();
  }

  /**
   * パターン情報を初期化
   */
  private initPatterns(): void {
    this.patterns = [
      { name: 'A-1: 5way弾', group: 'A', pattern: 'A1', description: '5方向弾（8m/s）' },
      { name: 'A-2: 11way×2列', group: 'A', pattern: 'A2', description: '11方向×2列弾（4m/s）' },
      { name: 'A-3: 狙い弾', group: 'A', pattern: 'A3', description: '自機狙い1発（6m/s）' },
      { name: 'A-4: 12way円弾', group: 'A', pattern: 'A4', description: '12方向円弾（8m/s）' },
      { name: 'A-5: 5way加速弾', group: 'A', pattern: 'A5', description: '5方向弾（6→24m/sに加速）' },
      { name: 'A-6: 連射重力弾', group: 'A', pattern: 'A6', description: '0.5s毎に3発、逆方向発射→1秒減速→停止→プレイヤー方向24m/s' },
      { name: 'B-1: オーブ弾', group: 'B', pattern: 'B1', description: '行って戻るオーブ（射程9m）' },
      { name: 'B-2: レーザー', group: 'B', pattern: 'B2', description: '予告線→15mレーザー' },
      { name: 'B-3: ラプチャー/スクリーム', group: 'B', pattern: 'B3', description: '円形花弾幕・扇形ダメージ' },
      { name: 'B-4: 固定射撃/ムービング/恐怖弾', group: 'B', pattern: 'B4', description: '2.2秒連射、4m移動、円形ダメージ' },
      { name: 'B-4(追尾): 移動しながら固定射撃', group: 'B', pattern: 'B4', description: '追尾移動+固定射撃', movement: 'chase' },
      { name: 'B-4(ランダム): 移動しながら固定射撃', group: 'B', pattern: 'B4', description: 'ランダム移動+固定射撃', movement: 'random_walk' },
      { name: 'C-1: スキルA/B使用', group: 'C', pattern: 'C1', description: 'スキルA（2.4秒）、スキルB（2.4秒）' },
      { name: 'C-2: Hisui (W2/E/R)', group: 'C', pattern: 'C2', description: 'W2:前方矩形、E:バックステップ→ダッシュ、R:半円→矩形' },
    ];
  }

  /**
   * 背景を作成
   */
  private createBackground(): void {
    const graphics = this.add.graphics();
    graphics.fillStyle(0x1a2a1a, 1);
    graphics.fillRect(0, 0, GAME_CONFIG.WIDTH, GAME_CONFIG.HEIGHT);

    // グリッドパターン（1m = 55pxのグリッド）
    graphics.lineStyle(1, 0x334433, 0.5);
    const gridSize = UNIT.METER_TO_PIXEL;  // 1m
    for (let x = 0; x < GAME_CONFIG.WIDTH; x += gridSize) {
      graphics.moveTo(x, 0);
      graphics.lineTo(x, GAME_CONFIG.HEIGHT);
    }
    for (let y = 0; y < GAME_CONFIG.HEIGHT; y += gridSize) {
      graphics.moveTo(0, y);
      graphics.lineTo(GAME_CONFIG.WIDTH, y);
    }
    graphics.strokePath();

    // 中央線
    graphics.lineStyle(2, 0x446644, 0.8);
    graphics.moveTo(GAME_CONFIG.WIDTH / 2, 0);
    graphics.lineTo(GAME_CONFIG.WIDTH / 2, GAME_CONFIG.HEIGHT);
    graphics.moveTo(0, GAME_CONFIG.HEIGHT / 2);
    graphics.lineTo(GAME_CONFIG.WIDTH, GAME_CONFIG.HEIGHT / 2);
    graphics.strokePath();
  }

  /**
   * UIを作成
   */
  private createUI(): void {
    // タイトル
    this.add.text(20, 20, '雑魚弾幕テスト', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '32px',
      color: '#88ff88',
    });

    // 情報表示
    this.infoText = this.add.text(20, 70, '', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '18px',
      color: '#ffffff',
      lineSpacing: 6,
    });
    this.updateInfoText();

    // 操作説明
    this.add.text(20, GAME_CONFIG.HEIGHT - 140, [
      '【操作】',
      '←→: パターン切替',
      'クリック: プレイヤー位置移動',
      'Space: 弾幕発射  R: 雑魚リスポーン',
      'C: 弾クリア  Esc: 戻る',
    ].join('\n'), {
      fontFamily: 'Arial, sans-serif',
      fontSize: '16px',
      color: '#888888',
      lineSpacing: 4,
    });
  }

  /**
   * プレイヤーマーカーを作成
   */
  private createPlayerMarker(): void {
    this.playerPos = {
      x: GAME_CONFIG.WIDTH / 2,
      y: GAME_CONFIG.HEIGHT * 0.75
    };

    this.playerMarker = this.add.graphics();
    this.playerMarker.setDepth(DEPTH.PLAYER);
    this.updatePlayerMarker();
  }

  /**
   * プレイヤーマーカーを更新
   */
  private updatePlayerMarker(): void {
    this.playerMarker.clear();
    // 外側の円（プレイヤーを表す）
    this.playerMarker.lineStyle(3, 0x00ff00, 1);
    this.playerMarker.strokeCircle(this.playerPos.x, this.playerPos.y, 20);
    // 中心点
    this.playerMarker.fillStyle(0x00ff00, 1);
    this.playerMarker.fillCircle(this.playerPos.x, this.playerPos.y, 5);
    // 十字
    this.playerMarker.lineStyle(2, 0x00ff00, 0.5);
    this.playerMarker.moveTo(this.playerPos.x - 30, this.playerPos.y);
    this.playerMarker.lineTo(this.playerPos.x + 30, this.playerPos.y);
    this.playerMarker.moveTo(this.playerPos.x, this.playerPos.y - 30);
    this.playerMarker.lineTo(this.playerPos.x, this.playerPos.y + 30);
    this.playerMarker.strokePath();
  }

  /**
   * 情報テキストを更新
   */
  private updateInfoText(): void {
    const pattern = this.patterns[this.currentPatternIndex];

    this.infoText.setText([
      `パターン: ${pattern.name}`,
      `グループ: ${pattern.group}`,
      `説明: ${pattern.description}`,
      ``,
      `グリッド: 1マス = 1m (${UNIT.METER_TO_PIXEL}px)`,
      `弾数: ${this.bulletPool ? this.bulletPool.getStats().active : 0}`,
    ].join('\n'));
  }

  /**
   * キーボード入力を設定
   */
  private setupKeyboardInput(): void {
    this.input.keyboard?.on('keydown-LEFT', () => {
      this.currentPatternIndex = (this.currentPatternIndex - 1 + this.patterns.length) % this.patterns.length;
      this.updateInfoText();
      this.spawnCurrentMob();
    });

    this.input.keyboard?.on('keydown-RIGHT', () => {
      this.currentPatternIndex = (this.currentPatternIndex + 1) % this.patterns.length;
      this.updateInfoText();
      this.spawnCurrentMob();
    });

    this.input.keyboard?.on('keydown-SPACE', () => {
      this.triggerMobAttack();
    });

    this.input.keyboard?.on('keydown-R', () => {
      this.spawnCurrentMob();
    });

    this.input.keyboard?.on('keydown-C', () => {
      this.clearBullets();
    });

    this.input.keyboard?.on('keydown-ESC', () => {
      this.goBack();
    });
  }

  /**
   * マウス入力を設定
   */
  private setupMouseInput(): void {
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      // プレイヤー位置を移動
      this.playerPos.x = pointer.x;
      this.playerPos.y = pointer.y;
      this.updatePlayerMarker();
      this.updateMobPlayerPosition();
    });
  }

  /**
   * 雑魚のプレイヤー位置を更新
   */
  private updateMobPlayerPosition(): void {
    if (this.mobGroupA) {
      this.mobGroupA.setPlayerPosition(this.playerPos.x, this.playerPos.y);
    }
    if (this.mobGroupB) {
      this.mobGroupB.setPlayerPosition(this.playerPos.x, this.playerPos.y);
    }
    if (this.mobGroupC) {
      this.mobGroupC.setPlayerPosition(this.playerPos.x, this.playerPos.y);
    }
  }

  /**
   * 現在のパターンで雑魚をスポーン
   */
  private spawnCurrentMob(): void {
    // 既存の雑魚を非アクティブ化
    if (this.mobGroupA) {
      this.mobGroupA.deactivate();
      this.mobGroupA.destroy();
      this.mobGroupA = null;
    }
    if (this.mobGroupB) {
      this.mobGroupB.deactivate();
      this.mobGroupB.destroy();
      this.mobGroupB = null;
    }
    if (this.mobGroupC) {
      this.mobGroupC.deactivate();
      this.mobGroupC.destroy();
      this.mobGroupC = null;
    }

    const pattern = this.patterns[this.currentPatternIndex];
    const spawnX = GAME_CONFIG.WIDTH / 2;
    const spawnY = GAME_CONFIG.HEIGHT * 0.25;

    if (pattern.group === 'A') {
      this.mobGroupA = new MobGroupA(this, spawnX, spawnY);
      this.mobGroupA.setDepth(DEPTH.ENEMIES);
      this.mobGroupA.setBulletPool(this.bulletPool);
      this.mobGroupA.setAutoShoot(false);  // 手動発射
      this.mobGroupA.spawnWithPattern(
        spawnX, spawnY,
        pattern.pattern as MobAPatternType,
        undefined,
        'stay'
      );
      this.mobGroupA.setPlayerPosition(this.playerPos.x, this.playerPos.y);
    } else if (pattern.group === 'B') {
      this.mobGroupB = new MobGroupB(this, spawnX, spawnY);
      this.mobGroupB.setDepth(DEPTH.ENEMIES);
      this.mobGroupB.setBulletPool(this.bulletPool);
      // B-4はAI駆動なので自動発射を有効にする、それ以外は手動発射
      const isB4 = pattern.pattern === 'B4';
      this.mobGroupB.setAutoShoot(isB4);

      // 移動パターンに応じたスポーン
      const movement = pattern.movement || 'stay';
      const moveSpeed = 2 * UNIT.METER_TO_PIXEL;  // 2m/s

      if (movement === 'chase') {
        this.mobGroupB.spawnChasePlayerWithPattern(
          spawnX, spawnY,
          pattern.pattern as MobBPatternType,
          moveSpeed
        );
      } else if (movement === 'random_walk') {
        this.mobGroupB.spawnRandomWalkWithPattern(
          spawnX, spawnY,
          pattern.pattern as MobBPatternType,
          moveSpeed,
          1500  // 1.5秒毎に方向転換
        );
      } else {
        this.mobGroupB.spawnWithPattern(
          spawnX, spawnY,
          pattern.pattern as MobBPatternType,
          undefined,
          'stay'
        );
      }

      this.mobGroupB.setPlayerPosition(this.playerPos.x, this.playerPos.y);
    } else if (pattern.group === 'C') {
      this.mobGroupC = new MobGroupC(this, spawnX, spawnY);
      this.mobGroupC.setDepth(DEPTH.ENEMIES);
      this.mobGroupC.setAutoShoot(true);  // C系はクールダウン制で自動発射
      this.mobGroupC.spawnWithPattern(
        spawnX, spawnY,
        pattern.pattern as MobCPatternType,
        undefined,
        'stay'
      );
      this.mobGroupC.setPlayerPosition(this.playerPos.x, this.playerPos.y);
    }

    this.updateInfoText();
  }

  /**
   * 雑魚の攻撃をトリガー
   */
  private triggerMobAttack(): void {
    if (this.mobGroupA && this.mobGroupA.active) {
      this.mobGroupA.shoot();
    }
    if (this.mobGroupB && this.mobGroupB.active) {
      this.mobGroupB.shoot();
    }
    if (this.mobGroupC && this.mobGroupC.active) {
      this.mobGroupC.shoot();
    }
  }

  /**
   * 弾をクリア
   */
  private clearBullets(): void {
    this.bulletPool.clear();
    this.updateInfoText();
  }

  /**
   * 戻る
   */
  private goBack(): void {
    this.clearBullets();
    if (this.mobGroupA) {
      this.mobGroupA.deactivate();
      this.mobGroupA.destroy();
    }
    if (this.mobGroupB) {
      this.mobGroupB.deactivate();
      this.mobGroupB.destroy();
    }
    if (this.mobGroupC) {
      this.mobGroupC.deactivate();
      this.mobGroupC.destroy();
    }
    this.cameras.main.fadeOut(300, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start(SCENES.DEBUG_ROOM);
    });
  }

  update(time: number, delta: number): void {
    // 雑魚の更新
    if (this.mobGroupA && this.mobGroupA.active) {
      this.mobGroupA.update(time, delta);
    }
    if (this.mobGroupB && this.mobGroupB.active) {
      this.mobGroupB.update(time, delta);
    }
    if (this.mobGroupC && this.mobGroupC.active) {
      this.mobGroupC.update(time, delta);
    }

    // 弾プールの更新
    this.bulletPool.update();

    this.updateInfoText();
  }
}
