import Phaser from 'phaser';
import { SCENES, GAME_CONFIG, COLORS, DEPTH, UNIT, WAVE_CONFIG } from '@/config/GameConfig';
import { Player } from '@/entities/Player';
import { Bullet } from '@/entities/Bullet';
import { MobEnemy, MobGroupA, MobGroupB, MobGroupC } from '@/entities/mobs';
import { InputManager } from '@/systems/InputManager';
import { AudioManager } from '@/systems/AudioManager';
import { BulletPool } from '@/utils/ObjectPool';
import { DamageCalculator } from '@/utils/DamageCalculator';
import { UIManager } from '@/ui/UIManager';
import { CharacterType, BulletType, GameMode, Difficulty, GameStartData, StageIntroData, WaveId, WaveState } from '@/types';
import { PauseData } from './PauseScene';

/**
 * MidStageScene - 道中シーン
 * - グループA/B/Cの雑魚敵が出現
 * - フラグ持ち（グループC）を撃破するとボスシーンへ移行
 * - 雑魚は生存時間経過でフェードアウト
 */
export class MidStageScene extends Phaser.Scene {
  private playArea!: Phaser.GameObjects.Rectangle;
  private fpsText!: Phaser.GameObjects.Text;
  private infoText!: Phaser.GameObjects.Text;
  private debugText!: Phaser.GameObjects.Text;

  // 背景スクロール
  private bgImage!: Phaser.GameObjects.Image;
  private bgVelocityX: number = 8;
  private bgVelocityY: number = 15;

  // ゲームオブジェクト
  private player!: Player;
  private inputManager!: InputManager;
  private bulletPool!: BulletPool;
  private bulletTrailGraphics!: Phaser.GameObjects.Graphics;
  private uiManager!: UIManager;

  // 道中雑魚管理
  private mobsGroupA: MobGroupA[] = [];
  private mobsGroupB: MobGroupB[] = [];
  private mobsGroupC: MobGroupC[] = [];
  private allMobs: MobEnemy[] = [];
  private mobPhysicsGroup!: Phaser.Physics.Arcade.Group;

  // ウェーブ管理（新階層構造）
  private stageStartTime: number = -1;  // -1 = 未初期化
  private score: number = 0;
  private lives: number = 3;            // 残機
  private currentWaveId: WaveId = { stage: 1, wave: 1, subWave: 0 };  // 現在のWave ID
  private waveState: WaveState = WaveState.WAITING;
  private waveStartTime: number = 0;    // 現在のWave開始時刻
  private waveClearTime: number = 0;    // Waveクリア時刻
  private waveScore: number = 0;        // 現在のWaveで獲得したスコア

  // Wave統計（リザルト表示用）
  private waveKillCount: number = 0;           // Wave中の撃破数
  private waveDamageTaken: number = 0;         // Wave中の被ダメージ

  // サブウェーブ管理（旧waveStarted配列の代替）
  private subWaveStarted: boolean[] = [];
  private wave3B1Defeated: boolean = false;  // Wave 1-1-3のB-1が撃破されたか
  private wave3B1Mob: MobGroupB | null = null;  // Wave 1-1-3のB-1の参照
  private wave4B2Defeated: boolean = false;  // Wave 1-1-4のB-2が撃破されたか

  // Wave弾幕発射管理
  private wave1_1Mobs: MobGroupA[] = [];
  private wave1_2Mobs: MobGroupA[] = [];
  private wave1_3MobsA: MobGroupA[] = [];
  private wave1_3MobB: MobGroupB | null = null;
  private wave1_4MobsA: MobGroupA[] = [];
  private wave1_4MobB: MobGroupB | null = null;
  private wave1_1SpawnTime: number = 0;
  private wave1_2SpawnTime: number = 0;
  private wave1_3SpawnTime: number = 0;
  private wave1_4SpawnTime: number = 0;
  private wave1_1LastFireTime: number = 0;  // 最後の発射時刻（0=未発射）
  private wave1_2LastFireTime: number = 0;
  private wave1_3ALastFireTime: number = 0;  // Wave 1-3 A-2用
  private wave1_3BLastFireTime: number = 0;  // Wave 1-3 B-1用
  private wave1_4ALastFireTime: number = 0;  // Wave 1-4 A-2用
  private wave1_4BLastFireTime: number = 0;  // Wave 1-4 B-2用

  // Wave 1-5 管理
  private wave1_5SpawnCount: number = 0;  // スポーン済み回数
  private wave1_5LastSpawnTime: number = 0;  // 最後のスポーン時刻
  private wave1_5StartTime: number = 0;  // 1-1-5開始時刻（0=未開始）

  // Wave 1-6 管理（B1, B2, Cのフォーメーション）
  private wave1_6MobB1: MobGroupB | null = null;
  private wave1_6MobB2: MobGroupB | null = null;
  private wave1_6MobC: MobGroupC | null = null;
  private wave1_6B1DefeatedTime: number = 0;  // B1撃破時刻（0=未撃破）
  private wave1_6B2DefeatedTime: number = 0;  // B2撃破時刻（0=未撃破）
  private wave1_6CDefeated: boolean = false;  // C撃破フラグ

  // ===== Wave 1-2 管理 =====
  // Wave 1-2-1: A-6が左から右に10体流れる
  private wave2_1Mobs: MobGroupA[] = [];
  private wave2_1SpawnTime: number = 0;
  private wave2_1LastFireTime: number = 0;
  private wave2_1AllDefeated: boolean = false;

  // Wave 1-2-2: A-5が右から左に10体流れる
  private wave2_2Mobs: MobGroupA[] = [];
  private wave2_2SpawnTime: number = 0;
  private wave2_2LastFireTime: number = 0;
  private wave2_2AllDefeated: boolean = false;

  // Wave 1-2-3: 両サイドから1→2→3の順で出現
  private wave2_3MobsLeft: MobGroupA[] = [];   // 左サイドの1,2,3
  private wave2_3MobsRight: MobGroupA[] = [];  // 右サイドの1,2,3
  private wave2_3Phase: number = 0;  // 0=未開始, 1=1出現, 2=2出現, 3=3出現
  private wave2_3PhaseTime: number = 0;
  private wave2_3AllDefeated: boolean = false;

  // Wave 1-2-4: △◯△△陣形（A-4,5,6 + B-3）
  private wave2_4MobsA: MobGroupA[] = [];
  private wave2_4MobB: MobGroupB | null = null;
  private wave2_4AllDefeated: boolean = false;

  // Wave 1-2-5: △◯△△陣形（A-4,5,6 + B-4）
  private wave2_5MobsA: MobGroupA[] = [];
  private wave2_5MobB: MobGroupB | null = null;
  private wave2_5AllDefeated: boolean = false;

  // Wave 1-2-6: フラグ持ちC-2 + B-3（開始時）、B-4（5秒後）
  private wave2_6MobB3: MobGroupB | null = null;
  private wave2_6MobB4: MobGroupB | null = null;
  private wave2_6MobC: MobGroupC | null = null;
  private wave2_6StartTime: number = 0;  // Wave開始時刻
  private wave2_6B4Spawned: boolean = false;  // B-4がスポーン済みか
  private wave2_6CDefeated: boolean = false;

  // Waveクリア演出用UI
  private waveClearOverlay: Phaser.GameObjects.Rectangle | null = null;
  private waveClearText: Phaser.GameObjects.Text | null = null;
  private waveRewardText: Phaser.GameObjects.Text | null = null;
  private waveNextText: Phaser.GameObjects.Text | null = null;
  private waveResultContainer: Phaser.GameObjects.Container | null = null;

  // ゲーム開始データ
  private gameStartData: GameStartData | null = null;

  constructor() {
    super({ key: SCENES.MID_STAGE });
  }

  init(data?: GameStartData): void {
    if (data && Object.keys(data).length > 0) {
      this.gameStartData = data;
    }

    // シーン再開始時のリセット
    this.stageStartTime = -1;  // -1 = 未初期化（最初のupdateで設定）
    this.score = 0;
    this.lives = data?.continueData?.lives ?? 3;

    // Wave管理の初期化（デバッグ用開始Wave指定がある場合はそこから開始）
    const debugWave = data?.debugWaveStart;
    if (debugWave) {
      this.currentWaveId = { stage: debugWave.stage, wave: debugWave.wave, subWave: debugWave.subWave };
      console.log(`[MidStageScene] デバッグモード: Wave ${debugWave.stage}-${debugWave.wave}-${debugWave.subWave} から開始`);
    } else {
      this.currentWaveId = { stage: 1, wave: 1, subWave: 0 };
    }
    this.waveState = WaveState.WAITING;
    this.waveStartTime = 0;
    this.waveClearTime = 0;
    this.waveScore = 0;
    this.subWaveStarted = [];

    // Wave統計の初期化
    this.waveKillCount = 0;
    this.waveDamageTaken = 0;

    this.wave3B1Defeated = false;
    this.wave3B1Mob = null;
    this.wave4B2Defeated = false;
    this.mobsGroupA = [];
    this.mobsGroupB = [];
    this.mobsGroupC = [];
    this.allMobs = [];

    // Wave弾幕発射管理のリセット
    this.wave1_1Mobs = [];
    this.wave1_2Mobs = [];
    this.wave1_3MobsA = [];
    this.wave1_3MobB = null;
    this.wave1_4MobsA = [];
    this.wave1_4MobB = null;
    this.wave1_1SpawnTime = 0;
    this.wave1_2SpawnTime = 0;
    this.wave1_3SpawnTime = 0;
    this.wave1_4SpawnTime = 0;
    this.wave1_1LastFireTime = 0;
    this.wave1_2LastFireTime = 0;
    this.wave1_3ALastFireTime = 0;
    this.wave1_3BLastFireTime = 0;
    this.wave1_4ALastFireTime = 0;
    this.wave1_4BLastFireTime = 0;

    // Wave 1-5
    this.wave1_5SpawnCount = 0;
    this.wave1_5LastSpawnTime = 0;
    this.wave1_5StartTime = 0;

    // Wave 1-6
    this.wave1_6MobB1 = null;
    this.wave1_6MobB2 = null;
    this.wave1_6MobC = null;
    this.wave1_6B1DefeatedTime = 0;
    this.wave1_6B2DefeatedTime = 0;
    this.wave1_6CDefeated = false;

    // Wave 1-2-1
    this.wave2_1Mobs = [];
    this.wave2_1SpawnTime = 0;
    this.wave2_1LastFireTime = 0;
    this.wave2_1AllDefeated = false;

    // Wave 1-2-2
    this.wave2_2Mobs = [];
    this.wave2_2SpawnTime = 0;
    this.wave2_2LastFireTime = 0;
    this.wave2_2AllDefeated = false;

    // Wave 1-2-3
    this.wave2_3MobsLeft = [];
    this.wave2_3MobsRight = [];
    this.wave2_3Phase = 0;
    this.wave2_3PhaseTime = 0;
    this.wave2_3AllDefeated = false;

    // Wave 1-2-4
    this.wave2_4MobsA = [];
    this.wave2_4MobB = null;
    this.wave2_4AllDefeated = false;

    // Wave 1-2-5
    this.wave2_5MobsA = [];
    this.wave2_5MobB = null;
    this.wave2_5AllDefeated = false;

    // Wave 1-2-6
    this.wave2_6MobB3 = null;
    this.wave2_6MobB4 = null;
    this.wave2_6MobC = null;
    this.wave2_6StartTime = 0;
    this.wave2_6B4Spawned = false;
    this.wave2_6CDefeated = false;

    // クリア演出UI
    this.waveClearOverlay = null;
    this.waveClearText = null;
    this.waveRewardText = null;
    this.waveNextText = null;
    this.waveResultContainer = null;
  }

  create(): void {
    // カメラのフェード状態をリセット
    this.cameras.main.resetFX();
    this.cameras.main.fadeIn(300);

    // プレイエリアの作成
    this.createPlayArea();

    // デバッグ情報の表示
    if (GAME_CONFIG.DEBUG) {
      this.createDebugInfo();
    }

    // ゲームプレイを開始
    this.startGameplay();
    // stageStartTimeは最初のupdateMobSpawning()で設定される（UIのtimeScoreと同期）
  }

  update(time: number, delta: number): void {
    // 背景スクロール
    this.updateScrollingBackground(delta);

    // FPS表示
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

      // 弾道補助線
      if (GAME_CONFIG.SHOW_BULLET_TRAILS) {
        this.drawBulletTrails();
      }
    }

    // 道中雑魚の更新
    for (const mob of this.allMobs) {
      if (mob.getIsActive()) {
        if (this.player) {
          mob.setPlayerPosition(this.player.x, this.player.y);
        }
        mob.update(time, delta);
      }
    }

    // 手動での衝突判定（プレイヤー弾 vs 雑魚）
    this.checkBulletMobCollisions();

    // 雑魚のスポーン
    this.updateMobSpawning(time);

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
   * 道中雑魚のスポーン管理（ウェーブシステム）
   */
  private updateMobSpawning(time: number): void {
    // 最初のupdateでstageStartTimeを設定（UIのtimeScoreと同期）
    if (this.stageStartTime < 0) {
      this.stageStartTime = time;
      this.waveStartTime = time;
      this.waveState = WaveState.ACTIVE;

      // デバッグモードでの開始Wave処理
      const debugWave = this.gameStartData?.debugWaveStart;
      if (debugWave) {
        // デバッグ開始Waveが設定されている場合
        this.currentWaveId = { stage: debugWave.stage, wave: debugWave.wave, subWave: debugWave.subWave };
        console.log(`[MidStageScene] デバッグモード: Wave ${this.getWaveIdString()} から即座にスポーン`);
        // 該当サブウェーブを即座にスポーン
        this.spawnDebugStartWave(debugWave);
      } else {
        this.currentWaveId = { stage: 1, wave: 1, subWave: 1 };
      }

      // Wave統計の初期化
      this.waveKillCount = 0;
      this.waveDamageTaken = 0;
      console.log(`[MidStageScene] stageStartTime initialized: ${time}ms`);
      console.log(`[Wave ${this.getWaveIdString()}] 開始!`);
    }

    // Waveクリア演出中はスポーン処理をスキップ
    if (this.waveState === WaveState.CLEARING) {
      this.updateWaveClearInterval(time);
      return;
    }

    const elapsedTime = time - this.waveStartTime;

    // 現在のWaveに応じたサブウェーブ処理
    if (this.currentWaveId.wave === 1) {
      this.updateWave1SubWaves(time, elapsedTime);
    } else if (this.currentWaveId.wave === 2) {
      this.updateWave2SubWaves(time, elapsedTime);
    }

    // Wave弾幕発射の更新
    this.updateWaveShooting(time);
  }

  /**
   * Wave 1-1（サブウェーブ1-1-1〜1-1-6）の処理
   */
  private updateWave1SubWaves(time: number, elapsedTime: number): void {
    // サブウェーブ 1-1-1: 開始1秒後
    if (!this.subWaveStarted[0] && elapsedTime >= 1000) {
      this.subWaveStarted[0] = true;
      console.log(`[SubWave 1-1-1] 開始!`);
      this.spawnWave1_1();
    }

    // サブウェーブ 1-1-2: 開始4秒後
    if (!this.subWaveStarted[1] && elapsedTime >= 4000) {
      this.subWaveStarted[1] = true;
      console.log(`[SubWave 1-1-2] 開始! (4秒経過)`);
      this.spawnWave1_2();
    }

    // サブウェーブ 1-1-3: 開始10秒後
    if (!this.subWaveStarted[2] && elapsedTime >= 10000) {
      this.subWaveStarted[2] = true;
      console.log(`[SubWave 1-1-3] 開始! (10秒経過)`);
      this.spawnWave1_3();
    }

    // サブウェーブ 1-1-4: Wave 1-1-3のB-1撃破後
    if (!this.subWaveStarted[3] && this.subWaveStarted[2]) {
      // B-1が撃破されたかチェック
      if (this.wave3B1Mob && !this.wave3B1Mob.getIsActive() && !this.wave3B1Defeated) {
        this.wave3B1Defeated = true;
      }

      // B-1撃破のみ（時間経過は条件から削除）
      if (this.wave3B1Defeated) {
        this.subWaveStarted[3] = true;
        console.log(`[SubWave 1-1-4] 開始! (B-1撃破後)`);
        this.spawnWave1_4();
      }
    }

    // Wave 1-1-4のB-2撃破チェック
    if (this.subWaveStarted[3] && !this.wave4B2Defeated) {
      if (this.wave1_4MobB && !this.wave1_4MobB.getIsActive()) {
        this.wave4B2Defeated = true;
        console.log(`[SubWave 1-1-4] B-2撃破!`);
      }
    }

    // サブウェーブ 1-1-5: Wave 1-1-4のB-2撃破後
    if (!this.subWaveStarted[4] && this.wave4B2Defeated) {
      console.log(`[SubWave 1-1-5] 開始! (B-2撃破後)`);
      this.subWaveStarted[4] = true;
      this.wave1_5SpawnCount = 0;
      this.wave1_5LastSpawnTime = time;
      this.wave1_5StartTime = time;  // 1-1-5開始時刻を記録
      this.spawnWave1_5Quad();  // 最初の4体をすぐにスポーン
    }

    // サブウェーブ 1-1-5の継続スポーン（10秒間、1秒毎にA-1/A-3 x 2 = 4体）
    if (this.subWaveStarted[4] && this.wave1_5SpawnCount < 10) {
      const timeSinceLastSpawn = time - this.wave1_5LastSpawnTime;
      if (timeSinceLastSpawn >= 1000) {  // 1秒毎
        this.wave1_5LastSpawnTime = time;
        this.spawnWave1_5Quad();
      }
    }

    // サブウェーブ 1-1-6: 1-1-5開始から12秒後
    if (!this.subWaveStarted[5] && this.wave1_5StartTime > 0) {
      const timeSinceStart = time - this.wave1_5StartTime;
      if (timeSinceStart >= 12000) {
        console.log(`[SubWave 1-1-6] 開始! (1-1-5開始から12秒後)`);
        this.subWaveStarted[5] = true;
        this.spawnWave1_6();
      }
    }

    // サブウェーブ 1-1-6の更新（B1/B2リスポーン、C撃破チェック）
    if (this.subWaveStarted[5] && !this.wave1_6CDefeated) {
      this.updateWave1_6(time);
    }
  }

  /**
   * 指定されたMob配列が全て撃破（非アクティブ）かどうかをチェック
   */
  private areAllMobsDefeated(mobs: MobEnemy[]): boolean {
    if (mobs.length === 0) return false;
    return mobs.every(mob => !mob.getIsActive());
  }

  /**
   * Wave 1-2（サブウェーブ1-2-1〜1-2-6）の処理
   */
  private updateWave2SubWaves(time: number, elapsedTime: number): void {
    // サブウェーブ 1-2-1: 開始1秒後、A-6が左から右に10体流れる
    if (!this.subWaveStarted[0] && elapsedTime >= 1000) {
      this.subWaveStarted[0] = true;
      console.log(`[SubWave 1-2-1] 開始! A-6×10 左→右`);
      this.spawnWave2_1();
    }

    // 1-2-1の更新（弾幕発射）
    if (this.subWaveStarted[0] && !this.wave2_1AllDefeated) {
      this.updateWave2_1(time);
      // 全滅チェック
      if (this.areAllMobsDefeated(this.wave2_1Mobs)) {
        this.wave2_1AllDefeated = true;
        console.log(`[SubWave 1-2-1] 全滅!`);
      }
    }

    // サブウェーブ 1-2-2: 6秒後 or 1-2-1全滅後、A-5が右から左に10体流れる
    if (!this.subWaveStarted[1] && this.subWaveStarted[0]) {
      if (elapsedTime >= 6000 || this.wave2_1AllDefeated) {
        this.subWaveStarted[1] = true;
        const trigger = this.wave2_1AllDefeated ? '1-2-1全滅' : '6秒経過';
        console.log(`[SubWave 1-2-2] 開始! (${trigger}) A-6×10 右→左`);
        this.spawnWave2_2();
      }
    }

    // 1-2-2の更新（弾幕発射）
    if (this.subWaveStarted[1] && !this.wave2_2AllDefeated) {
      this.updateWave2_2(time);
      // 全滅チェック
      if (this.areAllMobsDefeated(this.wave2_2Mobs)) {
        this.wave2_2AllDefeated = true;
        console.log(`[SubWave 1-2-2] 全滅!`);
      }
    }

    // サブウェーブ 1-2-3: 15秒後 or 1-2-2全滅後、両サイドから1→2→3順で出現
    if (!this.subWaveStarted[2] && this.subWaveStarted[1]) {
      if (elapsedTime >= 15000 || this.wave2_2AllDefeated) {
        this.subWaveStarted[2] = true;
        const trigger = this.wave2_2AllDefeated ? '1-2-2全滅' : '15秒経過';
        console.log(`[SubWave 1-2-3] 開始! (${trigger}) 両サイド1→2→3`);
        this.spawnWave2_3Phase1(time);
      }
    }

    // 1-2-3の更新（フェーズ進行・弾幕発射）
    if (this.subWaveStarted[2] && !this.wave2_3AllDefeated) {
      this.updateWave2_3(time);
    }

    // サブウェーブ 1-2-4: 1-2-3全滅後、△◯△△陣形（A-4,5,6 + B-3）
    if (!this.subWaveStarted[3] && this.subWaveStarted[2] && this.wave2_3AllDefeated) {
      this.subWaveStarted[3] = true;
      console.log(`[SubWave 1-2-4] 開始! △◯△△陣形 (A-4,5,6 + B-3)`);
      this.spawnWave2_4();
    }

    // 1-2-4の更新
    if (this.subWaveStarted[3] && !this.wave2_4AllDefeated) {
      this.updateWave2_4(time);
      // 全滅チェック
      const aDefeated = this.areAllMobsDefeated(this.wave2_4MobsA);
      const bDefeated = !this.wave2_4MobB || !this.wave2_4MobB.getIsActive();
      if (aDefeated && bDefeated) {
        this.wave2_4AllDefeated = true;
        console.log(`[SubWave 1-2-4] 全滅!`);
      }
    }

    // サブウェーブ 1-2-5: 1-2-4全滅後、△◯△△陣形（A-4,5,6 + B-4）
    if (!this.subWaveStarted[4] && this.subWaveStarted[3] && this.wave2_4AllDefeated) {
      this.subWaveStarted[4] = true;
      console.log(`[SubWave 1-2-5] 開始! △◯△△陣形 (A-4,5,6 + B-4)`);
      this.spawnWave2_5();
    }

    // 1-2-5の更新
    if (this.subWaveStarted[4] && !this.wave2_5AllDefeated) {
      this.updateWave2_5(time);
      // 全滅チェック
      const aDefeated = this.areAllMobsDefeated(this.wave2_5MobsA);
      const bDefeated = !this.wave2_5MobB || !this.wave2_5MobB.getIsActive();
      if (aDefeated && bDefeated) {
        this.wave2_5AllDefeated = true;
        console.log(`[SubWave 1-2-5] 全滅!`);
      }
    }

    // サブウェーブ 1-2-6: 1-2-5全滅後、フラグ持ちC-2 + B-3 + B-4
    if (!this.subWaveStarted[5] && this.subWaveStarted[4] && this.wave2_5AllDefeated) {
      this.subWaveStarted[5] = true;
      console.log(`[SubWave 1-2-6] 開始! フラグ持ちC-2 + B-3 + B-4`);
      this.spawnWave2_6();
    }

    // 1-2-6の更新（B3/B4リスポーン、C撃破チェック）
    if (this.subWaveStarted[5] && !this.wave2_6CDefeated) {
      this.updateWave2_6(time);
    }
  }

  /**
   * デバッグ開始Wave用のスポーン処理
   * 指定されたサブウェーブを即座にスポーンし、それ以前のサブウェーブはスキップ扱いにする
   */
  private spawnDebugStartWave(waveId: WaveId): void {
    const { wave, subWave } = waveId;

    if (wave === 1) {
      // Wave 1-1のサブウェーブ
      // 指定サブウェーブ未満は「開始済み」としてマーク
      for (let i = 0; i < subWave - 1; i++) {
        this.subWaveStarted[i] = true;
      }

      // サブウェーブ5以降を開始する場合、1-1-4のB-2は撃破済み扱い
      if (subWave >= 5) {
        this.wave3B1Defeated = true;
        this.wave4B2Defeated = true;
      } else if (subWave >= 4) {
        this.wave3B1Defeated = true;
      }

      // 指定サブウェーブをスポーン
      switch (subWave) {
        case 1:
          this.subWaveStarted[0] = true;
          this.spawnWave1_1();
          break;
        case 2:
          this.subWaveStarted[1] = true;
          this.spawnWave1_2();
          break;
        case 3:
          this.subWaveStarted[2] = true;
          this.spawnWave1_3();
          break;
        case 4:
          this.subWaveStarted[3] = true;
          this.spawnWave1_4();
          break;
        case 5:
          this.subWaveStarted[4] = true;
          this.wave1_5SpawnCount = 0;
          this.wave1_5LastSpawnTime = this.time.now;
          this.wave1_5StartTime = this.time.now;
          this.spawnWave1_5Quad();
          break;
        case 6:
          this.subWaveStarted[5] = true;
          this.wave1_5SpawnCount = 10;  // 1-1-5は完了済み扱い
          this.wave1_5StartTime = this.time.now - 12000;  // 12秒前に開始済み扱い
          this.spawnWave1_6();
          break;
      }
    } else if (wave === 2) {
      // Wave 1-2のサブウェーブ
      // 指定サブウェーブ未満は「開始済み・全滅済み」としてマーク
      for (let i = 0; i < subWave - 1; i++) {
        this.subWaveStarted[i] = true;
      }
      // 前提条件を満たすためのフラグ設定
      if (subWave >= 2) this.wave2_1AllDefeated = true;
      if (subWave >= 3) this.wave2_2AllDefeated = true;
      if (subWave >= 4) this.wave2_3AllDefeated = true;
      if (subWave >= 5) this.wave2_4AllDefeated = true;
      if (subWave >= 6) this.wave2_5AllDefeated = true;

      switch (subWave) {
        case 1:
          this.subWaveStarted[0] = true;
          this.spawnWave2_1();
          break;
        case 2:
          this.subWaveStarted[1] = true;
          this.spawnWave2_2();
          break;
        case 3:
          this.subWaveStarted[2] = true;
          this.spawnWave2_3Phase1(this.time.now);
          break;
        case 4:
          this.subWaveStarted[3] = true;
          this.spawnWave2_4();
          break;
        case 5:
          this.subWaveStarted[4] = true;
          this.spawnWave2_5();
          break;
        case 6:
          this.subWaveStarted[5] = true;
          this.spawnWave2_6();
          break;
      }
    }
  }

  /**
   * Wave 1-2-1: A-6が左から右に10体流れる
   * 画像の赤い矢印のように水平移動
   */
  private spawnWave2_1(): void {
    const { X, Y, HEIGHT } = GAME_CONFIG.PLAY_AREA;
    const startX = X - 50;  // 画面左外から
    const moveY = Y + HEIGHT / 4;  // 画面上側1/4の高さ（上に調整）
    const velocityX = 120;  // 右へ移動
    const velocityY = 0;
    const spacing = 80;  // 敵同士の間隔

    this.wave2_1Mobs = [];
    this.wave2_1SpawnTime = this.time.now;
    this.wave2_1LastFireTime = 0;

    // A-6を10体スポーン（左から右へ流れる）
    for (let i = 0; i < 10; i++) {
      const mob = this.getOrCreateMobA();
      mob.spawnPassThroughWithPattern(
        startX - i * spacing,  // 時差をつけて配置
        moveY,
        'A6',
        velocityX,
        velocityY,
        15000  // 十分な時間
      );
      mob.setAutoShoot(false);  // 自動発射を無効化（手動で制御）
      this.wave2_1Mobs.push(mob);
    }
  }

  /**
   * Wave 1-2-1の更新処理
   * 登場時と3秒毎に弾幕発射
   */
  private updateWave2_1(time: number): void {
    if (this.wave2_1SpawnTime === 0) return;

    const timeSinceSpawn = time - this.wave2_1SpawnTime;
    const timeSinceLastFire = time - this.wave2_1LastFireTime;

    // 登場時（1秒後）に発射
    if (this.wave2_1LastFireTime === 0 && timeSinceSpawn >= 1000) {
      this.wave2_1LastFireTime = time;
      this.fireWave2_1();
    }
    // 以降3秒毎に発射
    else if (this.wave2_1LastFireTime > 0 && timeSinceLastFire >= 3000) {
      this.wave2_1LastFireTime = time;
      this.fireWave2_1();
    }
  }

  /**
   * Wave 1-2-1の弾幕発射
   */
  private fireWave2_1(): void {
    for (const mob of this.wave2_1Mobs) {
      if (mob.getIsActive()) {
        mob.shoot();
      }
    }
  }

  /**
   * Wave 1-2-2: A-5が右から左に10体流れる
   */
  private spawnWave2_2(): void {
    const { X, Y, WIDTH, HEIGHT } = GAME_CONFIG.PLAY_AREA;
    const startX = X + WIDTH + 50;  // 画面右外から
    const moveY = Y + HEIGHT / 4;  // 画面上側1/4の高さ（上に調整）
    const velocityX = -120;  // 左へ移動
    const velocityY = 0;
    const spacing = 80;

    this.wave2_2Mobs = [];
    this.wave2_2SpawnTime = this.time.now;
    this.wave2_2LastFireTime = 0;

    // A-6を10体スポーン（右から左へ流れる）
    for (let i = 0; i < 10; i++) {
      const mob = this.getOrCreateMobA();
      mob.spawnPassThroughWithPattern(
        startX + i * spacing,  // 時差をつけて配置
        moveY,
        'A6',
        velocityX,
        velocityY,
        15000
      );
      mob.setAutoShoot(false);
      this.wave2_2Mobs.push(mob);
    }
  }

  /**
   * Wave 1-2-2の更新処理
   * 登場時と3秒毎に弾幕発射
   */
  private updateWave2_2(time: number): void {
    if (this.wave2_2SpawnTime === 0) return;

    const timeSinceSpawn = time - this.wave2_2SpawnTime;
    const timeSinceLastFire = time - this.wave2_2LastFireTime;

    // 登場時（1秒後）に発射
    if (this.wave2_2LastFireTime === 0 && timeSinceSpawn >= 1000) {
      this.wave2_2LastFireTime = time;
      this.fireWave2_2();
    }
    // 以降3秒毎に発射
    else if (this.wave2_2LastFireTime > 0 && timeSinceLastFire >= 3000) {
      this.wave2_2LastFireTime = time;
      this.fireWave2_2();
    }
  }

  /**
   * Wave 1-2-2の弾幕発射
   */
  private fireWave2_2(): void {
    for (const mob of this.wave2_2Mobs) {
      if (mob.getIsActive()) {
        mob.shoot();
      }
    }
  }

  /**
   * Wave 1-2-3 Phase1: 両サイドから1番目の敵が出現（A-6）
   */
  private spawnWave2_3Phase1(time: number): void {
    const { X, WIDTH } = GAME_CONFIG.PLAY_AREA;

    this.wave2_3MobsLeft = [];
    this.wave2_3MobsRight = [];
    this.wave2_3Phase = 1;
    this.wave2_3PhaseTime = time;

    // 青ラインの1: 左側と右側の端から下降（A-6）
    const leftX = X + 60;
    const rightX = X + WIDTH - 60;
    const startY = -50;
    const targetY = 250;
    const descendSpeed = 100;
    const ascendSpeed = 120;

    // 左サイド 1番目（A-6）
    const mobLeft1 = this.getOrCreateMobA();
    mobLeft1.spawnDescendShootAscendWithPattern(
      leftX, startY, 'A6', targetY, descendSpeed, ascendSpeed
    );
    this.wave2_3MobsLeft.push(mobLeft1);

    // 右サイド 1番目（A-6）
    const mobRight1 = this.getOrCreateMobA();
    mobRight1.spawnDescendShootAscendWithPattern(
      rightX, startY, 'A6', targetY, descendSpeed, ascendSpeed
    );
    this.wave2_3MobsRight.push(mobRight1);
  }

  /**
   * Wave 1-2-3 Phase2: 2番目の敵が出現（A-4）
   */
  private spawnWave2_3Phase2(): void {
    const { X, WIDTH } = GAME_CONFIG.PLAY_AREA;

    const leftX = X + 120;
    const rightX = X + WIDTH - 120;
    const startY = -50;
    const targetY = 200;
    const descendSpeed = 100;
    const ascendSpeed = 120;

    // 左サイド 2番目（A-4）
    const mobLeft2 = this.getOrCreateMobA();
    mobLeft2.spawnDescendShootAscendWithPattern(
      leftX, startY, 'A4', targetY, descendSpeed, ascendSpeed
    );
    this.wave2_3MobsLeft.push(mobLeft2);

    // 右サイド 2番目（A-4）
    const mobRight2 = this.getOrCreateMobA();
    mobRight2.spawnDescendShootAscendWithPattern(
      rightX, startY, 'A4', targetY, descendSpeed, ascendSpeed
    );
    this.wave2_3MobsRight.push(mobRight2);
  }

  /**
   * Wave 1-2-3 Phase3: 3番目の敵が出現（A-5）
   */
  private spawnWave2_3Phase3(): void {
    const { X, WIDTH } = GAME_CONFIG.PLAY_AREA;

    const leftX = X + 180;
    const rightX = X + WIDTH - 180;
    const startY = -50;
    const targetY = 150;
    const descendSpeed = 100;
    const ascendSpeed = 120;

    // 左サイド 3番目（A-5）
    const mobLeft3 = this.getOrCreateMobA();
    mobLeft3.spawnDescendShootAscendWithPattern(
      leftX, startY, 'A5', targetY, descendSpeed, ascendSpeed
    );
    this.wave2_3MobsLeft.push(mobLeft3);

    // 右サイド 3番目（A-5）
    const mobRight3 = this.getOrCreateMobA();
    mobRight3.spawnDescendShootAscendWithPattern(
      rightX, startY, 'A5', targetY, descendSpeed, ascendSpeed
    );
    this.wave2_3MobsRight.push(mobRight3);
  }

  /**
   * Wave 1-2-3の更新処理
   */
  private updateWave2_3(time: number): void {
    const timeSincePhase = time - this.wave2_3PhaseTime;

    // Phase2: 1秒後に2番目の敵出現
    if (this.wave2_3Phase === 1 && timeSincePhase >= 1000) {
      this.wave2_3Phase = 2;
      this.wave2_3PhaseTime = time;
      this.spawnWave2_3Phase2();
      console.log(`[SubWave 1-2-3] Phase2: A-4出現`);
    }
    // Phase3: さらに1秒後に3番目の敵出現
    else if (this.wave2_3Phase === 2 && timeSincePhase >= 1000) {
      this.wave2_3Phase = 3;
      this.wave2_3PhaseTime = time;
      this.spawnWave2_3Phase3();
      console.log(`[SubWave 1-2-3] Phase3: A-5出現`);
    }

    // 全滅チェック
    const allMobs = [...this.wave2_3MobsLeft, ...this.wave2_3MobsRight];
    if (this.wave2_3Phase >= 3 && allMobs.length > 0 && this.areAllMobsDefeated(allMobs)) {
      this.wave2_3AllDefeated = true;
      console.log(`[SubWave 1-2-3] 全滅!`);
    }
  }

  /**
   * Wave 1-2-4: △◯△△陣形（A-4,5,6 + B-3）
   * △◯△
   *  △
   */
  private spawnWave2_4(): void {
    const { X, Y, WIDTH, HEIGHT } = GAME_CONFIG.PLAY_AREA;
    const centerX = X + WIDTH / 2;
    const startY = Y - 50;
    const targetY = Y + HEIGHT / 4;
    const spacing = 100;
    const descendSpeed = 100;
    const walkSpeed = 1.5 * UNIT.METER_TO_PIXEL;

    this.wave2_4MobsA = [];

    // 上段左: A-4
    const mobA4 = this.getOrCreateMobA();
    mobA4.spawnDescendThenRandomWalkWithPattern(
      centerX - spacing, startY, 'A4', targetY, descendSpeed, walkSpeed
    );
    this.wave2_4MobsA.push(mobA4);

    // 上段右: A-5
    const mobA5 = this.getOrCreateMobA();
    mobA5.spawnDescendThenRandomWalkWithPattern(
      centerX + spacing, startY, 'A5', targetY, descendSpeed, walkSpeed
    );
    this.wave2_4MobsA.push(mobA5);

    // 下段中央: A-6
    const mobA6 = this.getOrCreateMobA();
    mobA6.spawnDescendThenRandomWalkWithPattern(
      centerX, startY + spacing / 2, 'A6', targetY + spacing / 2, descendSpeed, walkSpeed
    );
    this.wave2_4MobsA.push(mobA6);

    // 上段中央: B-3
    this.wave2_4MobB = this.getOrCreateMobB();
    this.wave2_4MobB.spawnDescendThenRandomWalkWithPattern(
      centerX, startY, 'B3', targetY, descendSpeed, walkSpeed, 1500
    );
  }

  /**
   * Wave 1-2-4の更新処理
   */
  private updateWave2_4(_time: number): void {
    // 特に追加処理なし（自動発射）
  }

  /**
   * Wave 1-2-5: △◯△△陣形（A-4,5,6 + B-4）
   */
  private spawnWave2_5(): void {
    const { X, Y, WIDTH, HEIGHT } = GAME_CONFIG.PLAY_AREA;
    const centerX = X + WIDTH / 2;
    const startY = Y - 50;
    const targetY = Y + HEIGHT / 4;
    const spacing = 100;
    const descendSpeed = 100;
    const walkSpeed = 1.5 * UNIT.METER_TO_PIXEL;

    this.wave2_5MobsA = [];

    // 上段左: A-6
    const mobA6 = this.getOrCreateMobA();
    mobA6.spawnDescendThenRandomWalkWithPattern(
      centerX - spacing, startY, 'A6', targetY, descendSpeed, walkSpeed
    );
    this.wave2_5MobsA.push(mobA6);

    // 上段右: A-4
    const mobA4 = this.getOrCreateMobA();
    mobA4.spawnDescendThenRandomWalkWithPattern(
      centerX + spacing, startY, 'A4', targetY, descendSpeed, walkSpeed
    );
    this.wave2_5MobsA.push(mobA4);

    // 下段中央: A-5
    const mobA5 = this.getOrCreateMobA();
    mobA5.spawnDescendThenRandomWalkWithPattern(
      centerX, startY + spacing / 2, 'A5', targetY + spacing / 2, descendSpeed, walkSpeed
    );
    this.wave2_5MobsA.push(mobA5);

    // 上段中央: B-4
    this.wave2_5MobB = this.getOrCreateMobB();
    this.wave2_5MobB.spawnDescendThenRandomWalkWithPattern(
      centerX, startY, 'B4', targetY, descendSpeed, walkSpeed, 1500
    );
  }

  /**
   * Wave 1-2-5の更新処理
   */
  private updateWave2_5(_time: number): void {
    // 特に追加処理なし（自動発射）
  }

  /**
   * Wave 1-2-6: フラグ持ちC-2 + B-3（開始時）、B-4（5秒後）
   * 開始時: □△の陣形（□がC-2、△がB-3）
   * 5秒後: B-4が追加出現
   */
  private spawnWave2_6(): void {
    const { X, Y, WIDTH, HEIGHT } = GAME_CONFIG.PLAY_AREA;
    const centerX = X + WIDTH / 2;
    const startY = Y - 50;
    const targetY = Y + HEIGHT / 3;
    const spacing = 100;
    const descendSpeed = 120;
    const chaseSpeed = 2.5 * UNIT.METER_TO_PIXEL;
    const walkSpeed = 2 * UNIT.METER_TO_PIXEL;

    // 左: B-3
    this.wave2_6MobB3 = this.getOrCreateMobB();
    this.wave2_6MobB3.spawnDescendThenRandomWalkWithPattern(
      centerX - spacing, startY, 'B3', targetY, descendSpeed, walkSpeed, 1200
    );

    // 中央: C-2（フラグ持ち）
    this.wave2_6MobC = this.getOrCreateMobC();
    this.wave2_6MobC.spawnDescendThenChaseWithPattern(
      centerX, startY, 'C2', targetY, descendSpeed, chaseSpeed
    );

    // B-4は5秒後にスポーン（updateWave2_6で処理）
    this.wave2_6StartTime = this.time.now;
    this.wave2_6B4Spawned = false;
    this.wave2_6CDefeated = false;
  }

  /**
   * Wave 1-2-6の更新処理
   * 5秒後にB-4が出現、妖精のリスポーンなし、C-2撃破でWaveクリア
   */
  private updateWave2_6(time: number): void {
    // 5秒後にB-4をスポーン
    if (!this.wave2_6B4Spawned && time - this.wave2_6StartTime >= 5000) {
      const { X, Y, WIDTH, HEIGHT } = GAME_CONFIG.PLAY_AREA;
      const centerX = X + WIDTH / 2;
      const startY = Y - 50;
      const targetY = Y + HEIGHT / 3;
      const spacing = 100;
      const descendSpeed = 120;
      const walkSpeed = 2 * UNIT.METER_TO_PIXEL;

      this.wave2_6MobB4 = this.getOrCreateMobB();
      this.wave2_6MobB4.spawnDescendThenRandomWalkWithPattern(
        centerX + spacing, startY, 'B4', targetY, descendSpeed, walkSpeed, 1200
      );
      this.wave2_6B4Spawned = true;
      console.log('[Wave 1-2-6] B-4出現!');
    }

    // C撃破チェック（フラグ持ち）
    if (this.wave2_6MobC && !this.wave2_6MobC.getIsActive()) {
      this.wave2_6CDefeated = true;
      console.log('[Wave 1-2-6] C-2撃破! Waveクリア');

      // 残りのB3/B4も消滅させる
      if (this.wave2_6MobB3 && this.wave2_6MobB3.getIsActive()) {
        this.wave2_6MobB3.deactivate();
      }
      if (this.wave2_6MobB4 && this.wave2_6MobB4.getIsActive()) {
        this.wave2_6MobB4.deactivate();
      }

      // Waveクリア処理
      this.startWaveClear();
      return;
    }

    // 妖精のリスポーンなし（B-3、B-4が倒されてもそのまま）
  }

  /**
   * Waveクリア後インターバルの更新
   */
  private updateWaveClearInterval(time: number): void {
    const elapsed = time - this.waveClearTime;
    const intervalMs = WAVE_CONFIG.CLEAR_INTERVAL_MS;

    if (elapsed >= intervalMs) {
      // インターバル終了、次のWaveへ
      this.waveState = WaveState.COMPLETED;
      this.hideWaveClearUI();
      this.startNextWave(time);
    }
  }

  /**
   * 次のWaveを開始
   */
  private startNextWave(time: number): void {
    const isFinalWave = this.currentWaveId.wave >= WAVE_CONFIG.STAGE_1.TOTAL_WAVES;

    if (isFinalWave) {
      // 最終Waveクリア → ボス戦へ
      console.log(`[Wave ${this.getWaveIdString()}] 最終Wave完了! ボス戦へ移行`);
      this.transitionToBossScene();
      return;
    }

    // 次のWaveへ
    this.currentWaveId = {
      stage: this.currentWaveId.stage,
      wave: this.currentWaveId.wave + 1,
      subWave: 1,
    };
    this.waveState = WaveState.ACTIVE;
    this.waveStartTime = time;
    this.waveScore = 0;
    this.subWaveStarted = [];

    // Wave統計のリセット
    this.waveKillCount = 0;
    this.waveDamageTaken = 0;

    // Wave 1-6関連のリセット
    this.wave1_6MobB1 = null;
    this.wave1_6MobB2 = null;
    this.wave1_6MobC = null;
    this.wave1_6B1DefeatedTime = 0;
    this.wave1_6B2DefeatedTime = 0;
    this.wave1_6CDefeated = false;

    console.log(`[Wave ${this.getWaveIdString()}] 開始!`);
  }

  /**
   * Wave IDを文字列で取得（例: "1-1-6"）
   */
  private getWaveIdString(): string {
    return `${this.currentWaveId.stage}-${this.currentWaveId.wave}-${this.currentWaveId.subWave}`;
  }

  /**
   * Wave制御による弾幕発射の更新
   */
  private updateWaveShooting(time: number): void {
    // Wave 1-1: 登場+4秒後に最初の発射（全員が画面内に入るまで待つ）、その後5秒毎（1-1-5開始後は停止）
    if (this.wave1_1SpawnTime > 0 && !this.subWaveStarted[4]) {
      const timeSinceSpawn = time - this.wave1_1SpawnTime;
      const timeSinceLastFire = time - this.wave1_1LastFireTime;
      // 最初の発射は登場+4秒後（最後尾が画面内に入るまで約3.8秒）
      if (this.wave1_1LastFireTime === 0 && timeSinceSpawn >= 4000) {
        this.wave1_1LastFireTime = time;
        this.fireWave1_1();
      } else if (this.wave1_1LastFireTime > 0 && timeSinceLastFire >= 5000) {
        this.wave1_1LastFireTime = time;
        this.fireWave1_1();
      }
    }

    // Wave 1-2: 登場+4秒後に最初の発射（全員が画面内に入るまで待つ）、その後5秒毎（1-1-5開始後は停止）
    if (this.wave1_2SpawnTime > 0 && !this.subWaveStarted[4]) {
      const timeSinceSpawn = time - this.wave1_2SpawnTime;
      const timeSinceLastFire = time - this.wave1_2LastFireTime;
      // 最初の発射は登場+4秒後（最後尾が画面内に入るまで待つ）
      if (this.wave1_2LastFireTime === 0 && timeSinceSpawn >= 4000) {
        this.wave1_2LastFireTime = time;
        this.fireWave1_2();
      } else if (this.wave1_2LastFireTime > 0 && timeSinceLastFire >= 5000) {
        this.wave1_2LastFireTime = time;
        this.fireWave1_2();
      }
    }

    // Wave 1-3: A-2は8秒毎、B-1は4秒毎（1-1-5開始後は停止）
    if (this.wave1_3SpawnTime > 0 && !this.subWaveStarted[4]) {
      const timeSinceSpawn = time - this.wave1_3SpawnTime;

      // A-2（MobGroupA）: 登場+1秒後に最初の発射、その後8秒毎
      const timeSinceLastFireA = time - this.wave1_3ALastFireTime;
      if (this.wave1_3ALastFireTime === 0 && timeSinceSpawn >= 1000) {
        this.wave1_3ALastFireTime = time;
        this.fireWave1_3A();
      } else if (this.wave1_3ALastFireTime > 0 && timeSinceLastFireA >= 8000) {
        this.wave1_3ALastFireTime = time;
        this.fireWave1_3A();
      }

      // B-1（MobGroupB）: 登場+1秒後に最初の発射、その後4秒毎
      const timeSinceLastFireB = time - this.wave1_3BLastFireTime;
      if (this.wave1_3BLastFireTime === 0 && timeSinceSpawn >= 1000) {
        this.wave1_3BLastFireTime = time;
        this.fireWave1_3B();
      } else if (this.wave1_3BLastFireTime > 0 && timeSinceLastFireB >= 4000) {
        this.wave1_3BLastFireTime = time;
        this.fireWave1_3B();
      }
    }

    // Wave 1-4: A-2は8秒毎、B-2は4秒毎（1-1-5開始後は停止）
    if (this.wave1_4SpawnTime > 0 && !this.subWaveStarted[4]) {
      const timeSinceSpawn = time - this.wave1_4SpawnTime;

      // A-2（MobGroupA）: 登場+1秒後に最初の発射、その後8秒毎
      const timeSinceLastFireA = time - this.wave1_4ALastFireTime;
      if (this.wave1_4ALastFireTime === 0 && timeSinceSpawn >= 1000) {
        this.wave1_4ALastFireTime = time;
        this.fireWave1_4A();
      } else if (this.wave1_4ALastFireTime > 0 && timeSinceLastFireA >= 8000) {
        this.wave1_4ALastFireTime = time;
        this.fireWave1_4A();
      }

      // B-2（MobGroupB）: 登場+1秒後に最初の発射、その後4秒毎
      const timeSinceLastFireB = time - this.wave1_4BLastFireTime;
      if (this.wave1_4BLastFireTime === 0 && timeSinceSpawn >= 1000) {
        this.wave1_4BLastFireTime = time;
        this.fireWave1_4B();
      } else if (this.wave1_4BLastFireTime > 0 && timeSinceLastFireB >= 4000) {
        this.wave1_4BLastFireTime = time;
        this.fireWave1_4B();
      }
    }
  }

  /**
   * Wave 1-1の弾幕発射
   */
  private fireWave1_1(): void {
    for (const mob of this.wave1_1Mobs) {
      // アクティブかつA-1パターンのみ発射（再利用されたMobを除外）
      if (mob.getIsActive() && mob.getPatternType() === 'A1') {
        mob.shoot();
      }
    }
  }

  /**
   * Wave 1-2の弾幕発射
   */
  private fireWave1_2(): void {
    for (const mob of this.wave1_2Mobs) {
      // アクティブかつA-1パターンのみ発射（再利用されたMobを除外）
      if (mob.getIsActive() && mob.getPatternType() === 'A1') {
        mob.shoot();
      }
    }
  }

  /**
   * Wave 1-3のA-2弾幕発射（8秒毎）
   */
  private fireWave1_3A(): void {
    for (const mob of this.wave1_3MobsA) {
      // アクティブかつA-2パターンのみ発射（再利用されたMobを除外）
      if (mob.getIsActive() && mob.getPatternType() === 'A2') {
        mob.shoot();
      }
    }
  }

  /**
   * Wave 1-3のB-1弾幕発射（4秒毎）
   */
  private fireWave1_3B(): void {
    if (this.wave1_3MobB && this.wave1_3MobB.getIsActive()) {
      this.wave1_3MobB.shoot();
    }
  }

  /**
   * Wave 1-4のA-2弾幕発射（8秒毎）
   */
  private fireWave1_4A(): void {
    for (const mob of this.wave1_4MobsA) {
      // アクティブかつA-2パターンのみ発射（再利用されたMobを除外）
      if (mob.getIsActive() && mob.getPatternType() === 'A2') {
        mob.shoot();
      }
    }
  }

  /**
   * Wave 1-4のB-2弾幕発射（4秒毎）
   */
  private fireWave1_4B(): void {
    if (this.wave1_4MobB && this.wave1_4MobB.getIsActive()) {
      this.wave1_4MobB.shoot();
    }
  }

  /**
   * MobGroupAを取得または作成
   */
  private getOrCreateMobA(): MobGroupA {
    for (const m of this.mobsGroupA) {
      if (!m.getIsActive()) {
        return m;
      }
    }

    const mob = new MobGroupA(this, 0, 0);
    mob.setBulletPool(this.bulletPool);
    this.mobsGroupA.push(mob);
    this.allMobs.push(mob);
    this.mobPhysicsGroup.add(mob);
    return mob;
  }

  /**
   * MobGroupBを取得または作成
   */
  private getOrCreateMobB(): MobGroupB {
    for (const m of this.mobsGroupB) {
      if (!m.getIsActive()) {
        return m;
      }
    }

    const mob = new MobGroupB(this, 0, 0);
    mob.setBulletPool(this.bulletPool);
    this.mobsGroupB.push(mob);
    this.allMobs.push(mob);
    this.mobPhysicsGroup.add(mob);
    return mob;
  }

  /**
   * MobGroupCを取得または作成
   */
  private getOrCreateMobC(): MobGroupC {
    for (const m of this.mobsGroupC) {
      if (!m.getIsActive()) {
        return m;
      }
    }

    const mob = new MobGroupC(this, 0, 0);
    mob.setBulletPool(this.bulletPool);
    this.mobsGroupC.push(mob);
    this.allMobs.push(mob);
    this.mobPhysicsGroup.add(mob);
    return mob;
  }

  /**
   * Wave 1-1: 左上からA-1×10
   * 2列×5体
   * 画面の1/3まで下りてから右にカーブして退場
   * 弾幕発射: 登場+1秒後、その後5秒毎
   */
  private spawnWave1_1(): void {
    const { X, Y, HEIGHT } = GAME_CONFIG.PLAY_AREA;

    // Wave追跡用配列をリセット
    this.wave1_1Mobs = [];
    this.wave1_1SpawnTime = this.time.now;
    this.wave1_1LastFireTime = 0;

    // 左上から出現
    const startX = X + 80;  // 左寄り
    const startY = Y - 50;
    const spacing = 35;  // 妖精同士の間隔

    // 速度設定
    const velocityY = 60;  // 下方向速度（px/s）
    const curveAtY = Y + HEIGHT / 3;  // 画面の1/3でカーブ開始
    const exitVelocityX = 150;  // 右方向に退場（px/s）
    const curveDuration = 1500;  // カーブに1.5秒

    // 2列×5体のA-1を配置
    for (let col = 0; col < 2; col++) {
      for (let row = 0; row < 5; row++) {
        const mob = this.getOrCreateMobA();
        const offsetX = col * spacing;
        const offsetY = -row * spacing;  // 上に向かって配置
        mob.spawnPassThroughCurveWithPattern(
          startX + offsetX,
          startY + offsetY,
          'A1',
          velocityY,
          curveAtY,
          exitVelocityX,
          curveDuration
        );
        mob.setAutoShoot(false);  // 自動発射を無効化
        this.wave1_1Mobs.push(mob);
      }
    }
  }

  /**
   * Wave 1-2: 右上からA-1×10
   * 2列×5体
   * 画面の1/3まで下りてから左にカーブして退場
   * 弾幕発射: 登場+1秒後、その後5秒毎
   */
  private spawnWave1_2(): void {
    const { X, Y, WIDTH, HEIGHT } = GAME_CONFIG.PLAY_AREA;

    // Wave追跡用配列をリセット
    this.wave1_2Mobs = [];
    this.wave1_2SpawnTime = this.time.now;
    this.wave1_2LastFireTime = 0;

    // 右上から出現
    const startX = X + WIDTH - 80;  // 右寄り
    const startY = Y - 50;
    const spacing = 35;

    // 速度設定
    const velocityY = 60;  // 下方向速度（px/s）
    const curveAtY = Y + HEIGHT / 3;  // 画面の1/3でカーブ開始
    const exitVelocityX = -150;  // 左方向に退場（px/s）
    const curveDuration = 1500;  // カーブに1.5秒

    // 2列×5体のA-1を配置
    for (let col = 0; col < 2; col++) {
      for (let row = 0; row < 5; row++) {
        const mob = this.getOrCreateMobA();
        const offsetX = -col * spacing;  // 右から左へ
        const offsetY = -row * spacing;
        mob.spawnPassThroughCurveWithPattern(
          startX + offsetX,
          startY + offsetY,
          'A1',
          velocityY,
          curveAtY,
          exitVelocityX,
          curveDuration
        );
        mob.setAutoShoot(false);  // 自動発射を無効化
        this.wave1_2Mobs.push(mob);
      }
    }
  }

  /**
   * Wave 1-3: 左寄りから陣形で出現
   * ◯　◯
   * 　△
   * ◯=A-2, △=B-1
   * 2.5秒で中央まで移動後停止
   * 弾幕発射: A-2は8秒毎、B-1は4秒毎
   */
  private spawnWave1_3(): void {
    const { X, Y, WIDTH, HEIGHT } = GAME_CONFIG.PLAY_AREA;

    // Wave追跡用配列をリセット
    this.wave1_3MobsA = [];
    this.wave1_3MobB = null;
    this.wave1_3SpawnTime = this.time.now;
    this.wave1_3ALastFireTime = 0;
    this.wave1_3BLastFireTime = 0;

    // 左寄りに配置（Wave 1-4と被らないように）
    const centerX = X + WIDTH / 3;  // 左1/3の位置
    const startY = Y - 50;
    const targetY = Y + HEIGHT / 3;  // 画面上部1/3の位置で停止
    const formationSpacing = 60;

    // A-2×2（上の2体）
    const mobA1 = this.getOrCreateMobA();
    mobA1.spawnWithPattern(
      centerX - formationSpacing,
      startY,
      'A2',
      targetY - formationSpacing / 2,
      'straight'
    );
    mobA1.setAutoShoot(false);  // 自動発射を無効化
    this.wave1_3MobsA.push(mobA1);

    const mobA2 = this.getOrCreateMobA();
    mobA2.spawnWithPattern(
      centerX + formationSpacing,
      startY,
      'A2',
      targetY - formationSpacing / 2,
      'straight'
    );
    mobA2.setAutoShoot(false);  // 自動発射を無効化
    this.wave1_3MobsA.push(mobA2);

    // B-1（下の1体）
    const mobB = this.getOrCreateMobB();
    mobB.spawnWithPattern(
      centerX,
      startY + formationSpacing,
      'B1',
      targetY + formationSpacing / 2,
      'straight'
    );
    mobB.setAutoShoot(false);  // 自動発射を無効化
    this.wave1_3MobB = mobB;

    // Wave 1-4トリガー用に参照を保持
    this.wave3B1Mob = mobB;
  }

  /**
   * Wave 1-4: 右寄りから陣形で出現
   * ◯　◯
   * 　△
   * ◯=A-2, △=B-2
   * 2.5秒で中央まで移動後停止
   * 弾幕発射: A-2は8秒毎、B-2は4秒毎
   */
  private spawnWave1_4(): void {
    const { X, Y, WIDTH, HEIGHT } = GAME_CONFIG.PLAY_AREA;

    // Wave追跡用配列をリセット
    this.wave1_4MobsA = [];
    this.wave1_4MobB = null;
    this.wave1_4SpawnTime = this.time.now;
    this.wave1_4ALastFireTime = 0;
    this.wave1_4BLastFireTime = 0;

    // 右寄りに配置（Wave 1-3と被らないように）
    const centerX = X + WIDTH * 2 / 3;  // 右1/3の位置
    const startY = Y - 50;
    const targetY = Y + HEIGHT / 3;
    const formationSpacing = 60;

    // A-2×2（上の2体）
    const mobA1 = this.getOrCreateMobA();
    mobA1.spawnWithPattern(
      centerX - formationSpacing,
      startY,
      'A2',
      targetY - formationSpacing / 2,
      'straight'
    );
    mobA1.setAutoShoot(false);  // 自動発射を無効化
    this.wave1_4MobsA.push(mobA1);

    const mobA2 = this.getOrCreateMobA();
    mobA2.spawnWithPattern(
      centerX + formationSpacing,
      startY,
      'A2',
      targetY - formationSpacing / 2,
      'straight'
    );
    mobA2.setAutoShoot(false);  // 自動発射を無効化
    this.wave1_4MobsA.push(mobA2);

    // B-2（下の1体）
    const mobB = this.getOrCreateMobB();
    mobB.spawnWithPattern(
      centerX,
      startY + formationSpacing,
      'B2',
      targetY + formationSpacing / 2,
      'straight'
    );
    mobB.setAutoShoot(false);  // 自動発射を無効化
    this.wave1_4MobB = mobB;
  }

  /**
   * Wave 1-5: A-1 x 1, A-3 x 2 を1秒毎にスポーン（計10回 = 30体）
   */
  private spawnWave1_5Quad(): void {
    if (this.wave1_5SpawnCount >= 10) return;

    const { X, Y, WIDTH, HEIGHT } = GAME_CONFIG.PLAY_AREA;
    const startY = Y - 50;  // 画面上部から開始
    // 画面の1/4の位置で発射
    const shootTargetY = Y + HEIGHT / 4;

    // ランダムなX座標（画面幅内でマージンを取る）
    const margin = 60;

    // 移動速度
    const descendSpeed = 120;  // 下降速度
    const ascendSpeed = 150;   // 上昇速度

    // A-1を1体スポーン
    {
      const randomX = X + margin + Math.random() * (WIDTH - margin * 2);
      const mobA1 = this.getOrCreateMobA();
      // スポーン前にplayerPositionを設定（発射時に必要）
      if (this.player) {
        mobA1.setPlayerPosition(this.player.x, this.player.y);
      }
      mobA1.spawnDescendShootAscendWithPattern(
        randomX,
        startY,
        'A1',
        shootTargetY,
        descendSpeed,
        ascendSpeed
      );
    }

    // A-3を2体スポーン
    for (let i = 0; i < 2; i++) {
      const randomX = X + margin + Math.random() * (WIDTH - margin * 2);
      const mobA3 = this.getOrCreateMobA();
      // スポーン前にplayerPositionを設定（発射時に必要）
      if (this.player) {
        mobA3.setPlayerPosition(this.player.x, this.player.y);
      }
      mobA3.spawnDescendShootAscendWithPattern(
        randomX,
        startY,
        'A3',
        shootTargetY,
        descendSpeed,
        ascendSpeed
      );
    }

    this.wave1_5SpawnCount++;
  }

  /**
   * Wave 1-6: B1, B2, Cのフォーメーション
   * B1  B2
   *   C
   * 画面上部から出現し、下降後にプレイヤーに向かって移動
   */
  private spawnWave1_6(): void {
    const { X, Y, WIDTH, HEIGHT } = GAME_CONFIG.PLAY_AREA;
    const centerX = X + WIDTH / 2;
    const startY = Y - 50;  // 画面上部（画面外）からスタート
    const targetY = Y + HEIGHT / 3;  // 下降目標: 画面上部1/3の位置

    const formationSpacing = 80;  // フォーメーションの間隔
    const descendSpeed = 150;  // 下降速度（px/s）
    const chaseSpeedB1 = 1.5 * UNIT.METER_TO_PIXEL;  // B1: 1.5m/s（追尾）
    const randomWalkSpeedB2 = 1.5 * UNIT.METER_TO_PIXEL;  // B2: 1.5m/s（ランダム移動）
    const chaseSpeedC = 3 * UNIT.METER_TO_PIXEL;    // C: 3m/s

    // B1（左上）- 下降後、追尾移動
    this.wave1_6MobB1 = this.getOrCreateMobB();
    this.wave1_6MobB1.spawnDescendThenChaseWithPattern(
      centerX - formationSpacing,
      startY - formationSpacing / 2,
      'B1',
      targetY - formationSpacing / 2,
      descendSpeed,
      chaseSpeedB1
    );

    // B2（右上）- 下降後、ランダム移動
    this.wave1_6MobB2 = this.getOrCreateMobB();
    this.wave1_6MobB2.spawnDescendThenRandomWalkWithPattern(
      centerX + formationSpacing,
      startY - formationSpacing / 2,
      'B2',
      targetY - formationSpacing / 2,
      descendSpeed,
      randomWalkSpeedB2,
      1500  // 1.5秒ごとに方向変更
    );

    // C（下中央）- 下降後、追尾移動
    this.wave1_6MobC = this.getOrCreateMobC();
    this.wave1_6MobC.spawnDescendThenChaseMode(
      centerX,
      startY + formationSpacing / 2,
      targetY + formationSpacing / 2,
      descendSpeed,
      chaseSpeedC
    );

    // 撃破タイムをリセット
    this.wave1_6B1DefeatedTime = 0;
    this.wave1_6B2DefeatedTime = 0;
    this.wave1_6CDefeated = false;
  }

  /**
   * Wave 1-6の更新処理
   * - B1/B2の撃破後5秒でリスポーン
   * - C撃破でB1/B2も消滅
   */
  private updateWave1_6(time: number): void {
    const { X, Y, WIDTH, HEIGHT } = GAME_CONFIG.PLAY_AREA;
    const centerX = X + WIDTH / 2;
    const startY = Y - 50;  // 画面上部（画面外）からスタート
    const targetY = Y + HEIGHT / 3;  // 下降目標: 画面上部1/3の位置
    const formationSpacing = 80;
    const descendSpeed = 150;  // 下降速度（px/s）
    const chaseSpeedB1 = 1.5 * UNIT.METER_TO_PIXEL;  // B1: 1.5m/s（追尾）
    const randomWalkSpeedB2 = 1.5 * UNIT.METER_TO_PIXEL;  // B2: 1.5m/s（ランダム移動）
    const respawnDelay = 5000;  // 5秒

    // Cが撃破されたかチェック
    if (this.wave1_6MobC && !this.wave1_6MobC.getIsActive() && !this.wave1_6CDefeated) {
      this.wave1_6CDefeated = true;
      console.log('[Wave 1-6] C撃破! B1/B2を消滅させます');

      // B1/B2を強制消滅
      if (this.wave1_6MobB1 && this.wave1_6MobB1.getIsActive()) {
        this.wave1_6MobB1.deactivate();
      }
      if (this.wave1_6MobB2 && this.wave1_6MobB2.getIsActive()) {
        this.wave1_6MobB2.deactivate();
      }
      return;
    }

    // B1の撃破チェック＆リスポーン（下降→追尾移動）
    if (this.wave1_6MobB1 && !this.wave1_6MobB1.getIsActive()) {
      if (this.wave1_6B1DefeatedTime === 0) {
        this.wave1_6B1DefeatedTime = time;
        console.log('[Wave 1-6] B1撃破! 5秒後にリスポーン');
      } else if (time - this.wave1_6B1DefeatedTime >= respawnDelay) {
        // リスポーン
        this.wave1_6MobB1 = this.getOrCreateMobB();
        this.wave1_6MobB1.spawnDescendThenChaseWithPattern(
          centerX - formationSpacing,
          startY - formationSpacing / 2,
          'B1',
          targetY - formationSpacing / 2,
          descendSpeed,
          chaseSpeedB1
        );
        this.wave1_6B1DefeatedTime = 0;
        console.log('[Wave 1-6] B1リスポーン!');
      }
    }

    // B2の撃破チェック＆リスポーン（下降→ランダム移動）
    if (this.wave1_6MobB2 && !this.wave1_6MobB2.getIsActive()) {
      if (this.wave1_6B2DefeatedTime === 0) {
        this.wave1_6B2DefeatedTime = time;
        console.log('[Wave 1-6] B2撃破! 5秒後にリスポーン');
      } else if (time - this.wave1_6B2DefeatedTime >= respawnDelay) {
        // リスポーン
        this.wave1_6MobB2 = this.getOrCreateMobB();
        this.wave1_6MobB2.spawnDescendThenRandomWalkWithPattern(
          centerX + formationSpacing,
          startY - formationSpacing / 2,
          'B2',
          targetY - formationSpacing / 2,
          descendSpeed,
          randomWalkSpeedB2,
          1500  // 1.5秒ごとに方向変更
        );
        this.wave1_6B2DefeatedTime = 0;
        console.log('[Wave 1-6] B2リスポーン!');
      }
    }
  }

  /**
   * フラグ持ち撃破時の処理
   */
  private onFlagCarrierDefeated(): void {
    const waveStr = `${this.currentWaveId.stage}-${this.currentWaveId.wave}`;
    console.log(`[Wave ${waveStr}] フラグ持ち撃破! Waveクリア!`);

    // スコアを加算
    this.score += 1000;
    this.waveScore += 1000;

    // Waveクリア処理を開始
    this.startWaveClear();
  }

  /**
   * Waveクリア処理を開始
   */
  private startWaveClear(): void {
    this.waveState = WaveState.CLEARING;
    this.waveClearTime = this.time.now;

    // 残っている敵弾を消去
    this.clearAllEnemyBullets();

    // 残っている雑魚敵を消滅
    this.deactivateAllMobs();

    // 報酬を適用
    this.applyWaveRewards();

    // クリア演出UIを表示
    this.showWaveClearUI();
  }

  /**
   * 全ての敵弾を消去
   */
  private clearAllEnemyBullets(): void {
    if (!this.bulletPool) return;
    const activeBullets = this.bulletPool.getActiveBullets();
    for (const bullet of activeBullets) {
      if (bullet.getBulletType() !== BulletType.PLAYER_NORMAL) {
        bullet.deactivate();
      }
    }
  }

  /**
   * 全ての雑魚敵を消滅
   */
  private deactivateAllMobs(): void {
    for (const mob of this.allMobs) {
      if (mob.getIsActive()) {
        mob.deactivate();
      }
    }
  }

  /**
   * Wave報酬を適用
   */
  private applyWaveRewards(): void {
    const waveNum = this.currentWaveId.wave;
    const rewards = waveNum === 1 ? WAVE_CONFIG.REWARDS.WAVE_1_1 : WAVE_CONFIG.REWARDS.WAVE_1_2;

    // HP回復（Wave 1-1）
    if ('HP_RECOVER_PERCENT' in rewards) {
      const recoverAmount = Math.floor(this.player.getMaxHp() * rewards.HP_RECOVER_PERCENT / 100);
      this.player.heal(recoverAmount);
      console.log(`[Wave報酬] HP ${rewards.HP_RECOVER_PERCENT}% 回復 (+${recoverAmount})`);
    }

    // 残機追加（Wave 1-2）
    if ('EXTRA_LIFE' in rewards) {
      this.lives += rewards.EXTRA_LIFE;
      console.log(`[Wave報酬] 残機 +${rewards.EXTRA_LIFE}`);
    }

    // スコアボーナス
    if ('SCORE_BONUS' in rewards) {
      this.score += rewards.SCORE_BONUS;
      console.log(`[Wave報酬] スコアボーナス +${rewards.SCORE_BONUS}`);
    }
  }

  /**
   * Waveクリア演出UIを表示
   */
  private showWaveClearUI(): void {
    const { X, Y, WIDTH, HEIGHT } = GAME_CONFIG.PLAY_AREA;
    const centerX = X + WIDTH / 2;
    const centerY = Y + HEIGHT / 2;

    // スコア計算
    const resultScores = this.calculateWaveResultScores();

    // UIManagerを通じてスコアを精算（Total Scoreに加算、TimeScoreとタイマーをリセット）
    if (this.uiManager) {
      this.uiManager.finalizeWaveScore(resultScores.totalScore, this.time.now);
    }

    // 半透明オーバーレイ
    this.waveClearOverlay = this.add.rectangle(
      centerX,
      centerY,
      WIDTH,
      HEIGHT,
      0x000000,
      0.7
    );
    this.waveClearOverlay.setDepth(DEPTH.UI - 10);

    // コンテナを作成
    this.waveResultContainer = this.add.container(centerX, centerY);
    this.waveResultContainer.setDepth(DEPTH.UI);

    // 上部の装飾ライン
    const topLine = this.add.rectangle(0, -200, 600, 4, 0xffcc00);
    this.waveResultContainer.add(topLine);

    // Waveクリアテキスト
    const waveStr = `${this.currentWaveId.stage}-${this.currentWaveId.wave}`;
    this.waveClearText = this.add.text(0, -170, `Wave ${waveStr} クリア!`, {
      font: 'bold 42px sans-serif',
      color: '#ffff00',
      stroke: '#000000',
      strokeThickness: 4,
    });
    this.waveClearText.setOrigin(0.5);
    this.waveResultContainer.add(this.waveClearText);

    // 中央の装飾ライン
    const midLine = this.add.rectangle(0, -135, 500, 2, 0x888888);
    this.waveResultContainer.add(midLine);

    // スコア内訳の開始Y座標
    let scoreY = -100;
    const lineHeight = 36;
    const labelX = -180;
    const valueX = 180;

    // 撃破スコア
    const killLabel = this.add.text(labelX, scoreY, '撃破スコア', {
      font: '24px sans-serif',
      color: '#ffffff',
    });
    killLabel.setOrigin(0, 0.5);
    this.waveResultContainer.add(killLabel);

    const killValue = this.add.text(valueX, scoreY, this.formatScore(resultScores.killScore), {
      font: 'bold 24px sans-serif',
      color: '#ffffff',
    });
    killValue.setOrigin(1, 0.5);
    this.waveResultContainer.add(killValue);

    const killDetail = this.add.text(valueX + 10, scoreY, `(${this.waveKillCount}体)`, {
      font: '18px sans-serif',
      color: '#aaaaaa',
    });
    killDetail.setOrigin(0, 0.5);
    this.waveResultContainer.add(killDetail);

    scoreY += lineHeight;

    // タイムボーナス
    const timeLabel = this.add.text(labelX, scoreY, 'タイムボーナス', {
      font: '24px sans-serif',
      color: '#ffffff',
    });
    timeLabel.setOrigin(0, 0.5);
    this.waveResultContainer.add(timeLabel);

    const timeBonusColor = resultScores.timeBonus > 0 ? '#00ff00' : '#ff6666';
    const timeBonusPrefix = resultScores.timeBonus >= 0 ? '+' : '';
    const timeValue = this.add.text(valueX, scoreY, `${timeBonusPrefix}${this.formatScore(resultScores.timeBonus)}`, {
      font: 'bold 24px sans-serif',
      color: timeBonusColor,
    });
    timeValue.setOrigin(1, 0.5);
    this.waveResultContainer.add(timeValue);

    const timeDetail = this.add.text(valueX + 10, scoreY, `(${resultScores.clearTimeSeconds}秒)`, {
      font: '18px sans-serif',
      color: '#aaaaaa',
    });
    timeDetail.setOrigin(0, 0.5);
    this.waveResultContainer.add(timeDetail);

    scoreY += lineHeight;

    // ノーダメージボーナス
    const noDamageLabel = this.add.text(labelX, scoreY, 'ノーダメボーナス', {
      font: '24px sans-serif',
      color: '#ffffff',
    });
    noDamageLabel.setOrigin(0, 0.5);
    this.waveResultContainer.add(noDamageLabel);

    const noDamageBonusColor = resultScores.noDamageBonus > 0 ? '#ffff00' : '#666666';
    const noDamageValue = this.add.text(valueX, scoreY, resultScores.noDamageBonus > 0 ? `+${this.formatScore(resultScores.noDamageBonus)}` : '---', {
      font: 'bold 24px sans-serif',
      color: noDamageBonusColor,
    });
    noDamageValue.setOrigin(1, 0.5);
    this.waveResultContainer.add(noDamageValue);

    if (this.waveDamageTaken > 0) {
      const damageDetail = this.add.text(valueX + 10, scoreY, `(被ダメ: ${this.waveDamageTaken})`, {
        font: '18px sans-serif',
        color: '#ff6666',
      });
      damageDetail.setOrigin(0, 0.5);
      this.waveResultContainer.add(damageDetail);
    }

    scoreY += lineHeight + 10;

    // 区切り線
    const separatorLine = this.add.rectangle(0, scoreY, 400, 2, 0xffffff);
    this.waveResultContainer.add(separatorLine);

    scoreY += 20;

    // Wave合計
    const totalLabel = this.add.text(labelX, scoreY, 'Wave合計', {
      font: 'bold 28px sans-serif',
      color: '#ffcc00',
    });
    totalLabel.setOrigin(0, 0.5);
    this.waveResultContainer.add(totalLabel);

    const totalValue = this.add.text(valueX, scoreY, this.formatScore(resultScores.totalScore), {
      font: 'bold 28px sans-serif',
      color: '#ffcc00',
    });
    totalValue.setOrigin(1, 0.5);
    this.waveResultContainer.add(totalValue);

    scoreY += lineHeight + 20;

    // 下部の装飾ライン
    const bottomLine1 = this.add.rectangle(0, scoreY, 600, 4, 0xffcc00);
    this.waveResultContainer.add(bottomLine1);

    scoreY += 25;

    // 報酬テキスト
    const waveNum = this.currentWaveId.wave;
    const rewards = waveNum === 1 ? WAVE_CONFIG.REWARDS.WAVE_1_1 : WAVE_CONFIG.REWARDS.WAVE_1_2;
    let rewardText = '';
    if ('HP_RECOVER_PERCENT' in rewards) {
      rewardText = `報酬: HP ${rewards.HP_RECOVER_PERCENT}% 回復!`;
    } else if ('EXTRA_LIFE' in rewards) {
      rewardText = `報酬: 残機 +${rewards.EXTRA_LIFE}!`;
    }

    this.waveRewardText = this.add.text(0, scoreY, rewardText, {
      font: 'bold 30px sans-serif',
      color: '#00ff00',
      stroke: '#000000',
      strokeThickness: 3,
    });
    this.waveRewardText.setOrigin(0.5);
    this.waveResultContainer.add(this.waveRewardText);

    scoreY += 50;

    // 下部の装飾ライン
    const bottomLine2 = this.add.rectangle(0, scoreY, 600, 4, 0xffcc00);
    this.waveResultContainer.add(bottomLine2);

    scoreY += 30;

    // 次へ進むテキスト
    const isFinalWave = this.currentWaveId.wave >= WAVE_CONFIG.STAGE_1.TOTAL_WAVES;
    const nextText = isFinalWave ? 'ボス戦へ...' : `Wave ${this.currentWaveId.stage}-${this.currentWaveId.wave + 1} へ...`;
    this.waveNextText = this.add.text(0, scoreY, nextText, {
      font: '22px sans-serif',
      color: '#aaaaaa',
      stroke: '#000000',
      strokeThickness: 2,
    });
    this.waveNextText.setOrigin(0.5);
    this.waveResultContainer.add(this.waveNextText);

    // フェードインアニメーション
    this.waveClearOverlay.setAlpha(0);
    this.waveResultContainer.setAlpha(0);

    this.tweens.add({
      targets: [this.waveClearOverlay, this.waveResultContainer],
      alpha: 1,
      duration: 500,
      ease: 'Power2',
    });

    // SE再生
    AudioManager.getInstance().playSe('se_spellcard');

    // ボーナススコアを実際のスコアに加算
    this.score += resultScores.timeBonus + resultScores.noDamageBonus;
  }

  /**
   * Waveリザルトのスコアを計算
   */
  private calculateWaveResultScores(): {
    killScore: number;
    timeBonus: number;
    noDamageBonus: number;
    totalScore: number;
    clearTimeSeconds: number;
  } {
    const waveNum = this.currentWaveId.wave;
    const resultConfig = WAVE_CONFIG.RESULT;

    // クリア時間（秒）
    const clearTimeMs = this.waveClearTime - this.waveStartTime;
    const clearTimeSeconds = Math.floor(clearTimeMs / 1000);

    // 想定クリア時間
    const expectedTime = waveNum === 1
      ? resultConfig.TIME_BONUS.EXPECTED_CLEAR_TIME.WAVE_1_1
      : resultConfig.TIME_BONUS.EXPECTED_CLEAR_TIME.WAVE_1_2;

    // タイムボーナス: (想定時間 - 実際の時間) × ポイント/秒
    const timeDiff = expectedTime - clearTimeSeconds;
    const timeBonus = timeDiff * resultConfig.TIME_BONUS.POINTS_PER_SECOND;

    // ノーダメージボーナス
    const noDamageBonusValue = waveNum === 1
      ? resultConfig.NO_DAMAGE_BONUS.WAVE_1_1
      : resultConfig.NO_DAMAGE_BONUS.WAVE_1_2;
    const noDamageBonus = this.waveDamageTaken === 0 ? noDamageBonusValue : 0;

    // 撃破スコア（Wave中に獲得したスコア）
    const killScore = this.waveScore;

    // 合計
    const totalScore = killScore + Math.max(0, timeBonus) + noDamageBonus;

    return {
      killScore,
      timeBonus,
      noDamageBonus,
      totalScore,
      clearTimeSeconds,
    };
  }

  /**
   * スコアをカンマ区切りでフォーマット
   */
  private formatScore(score: number): string {
    return score.toLocaleString();
  }

  /**
   * Waveクリア演出UIを非表示
   */
  private hideWaveClearUI(): void {
    const targets = [this.waveClearOverlay, this.waveResultContainer]
      .filter(t => t !== null);

    if (targets.length === 0) return;

    this.tweens.add({
      targets,
      alpha: 0,
      duration: 300,
      ease: 'Power2',
      onComplete: () => {
        this.waveClearOverlay?.destroy();
        this.waveResultContainer?.destroy();
        this.waveClearOverlay = null;
        this.waveClearText = null;
        this.waveRewardText = null;
        this.waveNextText = null;
        this.waveResultContainer = null;
      }
    });
  }

  /**
   * ボスシーンへ遷移
   */
  private transitionToBossScene(): void {
    // ゲームデータを引き継いでGameSceneへ
    const gameData: GameStartData = this.gameStartData ?? {
      mode: GameMode.ARCADE,
      character: CharacterType.REIMU,
      difficulty: Difficulty.NORMAL,
      stageNumber: 1,
      summonerSkills: {
        D: 'flash' as any,
        F: 'heal' as any,
      },
    };

    // スコアを引き継ぎ（continueDataに保存）
    gameData.continueData = {
      score: this.score,
      lives: 3, // TODO: 実際の残機を引き継ぐ
    };

    this.cameras.main.fadeOut(500, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start(SCENES.GAME, gameData);
    });
  }

  /**
   * プレイエリアを作成
   */
  private createPlayArea(): void {
    const { X, Y, WIDTH, HEIGHT } = GAME_CONFIG.PLAY_AREA;

    this.playArea = this.add.rectangle(
      X,
      Y,
      WIDTH,
      HEIGHT,
      COLORS.PLAY_AREA_BG
    );
    this.playArea.setOrigin(0, 0);
    this.playArea.setDepth(DEPTH.BACKGROUND);

    this.createScrollingBackground();

    const border = this.add.graphics();
    border.lineStyle(2, COLORS.PLAY_AREA_BORDER, 1);
    border.strokeRect(X, Y, WIDTH, HEIGHT);
    border.setDepth(DEPTH.PLAY_AREA);
  }

  /**
   * スクロール背景を作成
   */
  private createScrollingBackground(): void {
    const { X, Y, WIDTH, HEIGHT } = GAME_CONFIG.PLAY_AREA;
    const centerX = X + WIDTH / 2;
    const centerY = Y + HEIGHT / 2;

    if (!this.textures.exists('bg_stage1')) {
      console.warn('bg_stage1 texture not found');
      return;
    }

    const bgTexture = this.textures.get('bg_stage1');
    const bgFrame = bgTexture.get();
    const bgOriginalWidth = bgFrame.width;
    const bgOriginalHeight = bgFrame.height;

    const scaleX = (WIDTH * 1.5) / bgOriginalWidth;
    const scaleY = (HEIGHT * 1.5) / bgOriginalHeight;
    const scale = Math.max(scaleX, scaleY);

    this.bgImage = this.add.image(centerX, centerY, 'bg_stage1');
    this.bgImage.setOrigin(0.5, 0.5);
    this.bgImage.setScale(scale);
    this.bgImage.setDepth(DEPTH.PLAY_AREA);

    const maskGraphics = this.make.graphics({ x: 0, y: 0 });
    maskGraphics.fillStyle(0xffffff);
    maskGraphics.fillRect(X, Y, WIDTH, HEIGHT);
    const mask = maskGraphics.createGeometryMask();
    this.bgImage.setMask(mask);
  }

  /**
   * 背景スクロールを更新
   */
  private updateScrollingBackground(delta: number): void {
    if (!this.bgImage) return;

    const { X, Y, WIDTH, HEIGHT } = GAME_CONFIG.PLAY_AREA;
    const centerX = X + WIDTH / 2;
    const centerY = Y + HEIGHT / 2;

    const imgHalfWidth = this.bgImage.displayWidth / 2;
    const imgHalfHeight = this.bgImage.displayHeight / 2;

    const maxOffsetX = imgHalfWidth - WIDTH / 2;
    const maxOffsetY = imgHalfHeight - HEIGHT / 2;

    const deltaSeconds = delta / 1000;
    this.bgImage.x += this.bgVelocityX * deltaSeconds;
    this.bgImage.y += this.bgVelocityY * deltaSeconds;

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
    this.fpsText = this.add.text(10, 10, 'FPS: 60', {
      font: '16px monospace',
      color: '#00ff00',
    });
    this.fpsText.setDepth(DEPTH.UI);

    this.infoText = this.add.text(10, 40, [
      `Resolution: ${GAME_CONFIG.WIDTH}x${GAME_CONFIG.HEIGHT}`,
      `Play Area: ${GAME_CONFIG.PLAY_AREA.WIDTH}x${GAME_CONFIG.PLAY_AREA.HEIGHT}`,
      `Scene: MidStageScene`,
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
    // 道中BGMを再生
    const audioManager = AudioManager.getInstance();
    audioManager.setScene(this);
    audioManager.playBgm('bgm_stage1'); // Stage1 道中BGM（赤より紅い夢）

    // 弾プールを作成
    this.bulletPool = new BulletPool(this, 50, 5000);

    // 弾道補助線用のGraphics
    this.bulletTrailGraphics = this.add.graphics();
    this.bulletTrailGraphics.setDepth(DEPTH.BULLETS_PLAYER - 1);

    // 道中雑魚プールを初期化
    this.initMobPools();

    // プレイヤーを生成
    const { X, Y, WIDTH, HEIGHT } = GAME_CONFIG.PLAY_AREA;
    const playerX = X + WIDTH / 2;
    const playerY = Y + HEIGHT - 100;

    this.player = new Player(this, playerX, playerY, CharacterType.REIMU);
    this.player.setBulletPool(this.bulletPool);
    // 道中雑魚を攻撃対象として設定
    this.player.setMobs(this.allMobs);

    // 入力管理システム
    this.inputManager = new InputManager(this, this.player);

    // 衝突判定
    this.setupCollisions();

    // デバッグ情報
    if (GAME_CONFIG.DEBUG) {
      this.createPlayerDebugInfo();
    }

    // UIマネージャー
    this.uiManager = new UIManager(this, this.player);

    // ポーズ入力
    this.setupPauseInput();

    // フラグ持ち撃破イベント
    this.events.on('flag-carrier-defeated', () => {
      this.onFlagCarrierDefeated();
    });

    // 雑魚スキルヒットイベント（MobGroupCのスキルA/B/W2/E/R）
    this.events.on('mob-skill-hit', (data: {
      mob: MobEnemy;
      damage: number;
      skillType: 'A' | 'B' | 'W2' | 'E' | 'R1' | 'R2';
      pull?: { targetX: number; targetY: number; distance: number; duration: number };
      stun?: { duration: number };
    }) => {
      this.onMobSkillHit(data);
    });

    // ウェーブ管理の初期化（stageStartTimeはupdateMobSpawningで最初のupdate時に設定）
    this.subWaveStarted = [false, false, false, false, false, false];  // SubWave 1-1-1 ~ 1-1-6
    this.wave3B1Defeated = false;
    this.wave3B1Mob = null;

    // 操作説明
    this.showControls();
  }

  /**
   * 道中雑魚プールを初期化
   */
  private initMobPools(): void {
    // Physicsグループを作成
    this.mobPhysicsGroup = this.physics.add.group();

    // 各グループを事前に数体作成
    for (let i = 0; i < 5; i++) {
      const mobA = new MobGroupA(this, 0, 0);
      mobA.deactivate();
      mobA.setBulletPool(this.bulletPool);
      this.mobsGroupA.push(mobA);
      this.allMobs.push(mobA);
      this.mobPhysicsGroup.add(mobA);
    }

    for (let i = 0; i < 3; i++) {
      const mobB = new MobGroupB(this, 0, 0);
      mobB.deactivate();
      mobB.setBulletPool(this.bulletPool);
      this.mobsGroupB.push(mobB);
      this.allMobs.push(mobB);
      this.mobPhysicsGroup.add(mobB);
    }

    // フラグ持ちは1体
    const mobC = new MobGroupC(this, 0, 0);
    mobC.deactivate();
    mobC.setBulletPool(this.bulletPool);
    this.mobsGroupC.push(mobC);
    this.allMobs.push(mobC);
    this.mobPhysicsGroup.add(mobC);
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
    if (this.scene.isPaused(SCENES.MID_STAGE)) {
      return;
    }

    AudioManager.getInstance().playSe('se_pause');
    this.scene.pause();

    const retryData: StageIntroData = this.gameStartData ? {
      mode: this.gameStartData.mode,
      character: this.gameStartData.character,
      difficulty: this.gameStartData.difficulty,
      stageNumber: this.gameStartData.stageNumber,
      continueData: this.gameStartData.continueData,
      practiceConfig: this.gameStartData.practiceConfig,
    } : {
      mode: GameMode.ARCADE,
      character: CharacterType.REIMU,
      difficulty: Difficulty.NORMAL,
      stageNumber: 1,
    };

    const pauseData: PauseData = {
      retryData,
      player: this.player,
      boss: null,
    };

    this.scene.launch(SCENES.PAUSE, pauseData);
  }

  /**
   * 衝突判定を設定
   */
  private setupCollisions(): void {
    // プレイヤー弾と道中雑魚の衝突（配列を直接使用）
    this.physics.add.overlap(
      this.allMobs,
      this.bulletPool.getGroup(),
      (mobObj, bulletObj) => {
        const mob = mobObj as MobEnemy;
        const bullet = bulletObj as Bullet;

        if (!bullet.getIsActive()) return;
        if (!mob.getIsActive()) return;
        if (bullet.getBulletType() !== BulletType.PLAYER_NORMAL) return;

        // AA弾はターゲット以外の敵をすり抜ける
        const bulletTarget = bullet.getTarget();
        if (bulletTarget && bulletTarget !== mob) {
          return; // ターゲット以外の敵は無視
        }

        const rawDamage = bullet.getDamage();
        const defenseReduction = DamageCalculator.calculateDamageReduction(mob.getDefense());
        const finalDamage = Math.max(1, Math.floor(rawDamage * defenseReduction));

        // ヒットSEを再生
        AudioManager.getInstance().playSe('se_hit_arrow');

        const destroyed = mob.takeDamage(finalDamage);
        bullet.deactivate();

        if (destroyed) {
          this.score += mob.getScoreValue();
          this.waveScore += mob.getScoreValue();
          this.waveKillCount++;
          // UIに経験値を通知
          if (this.uiManager) {
            this.uiManager.addExp(mob.getExpValue());
          }
        }
      }
    );

    // 敵弾とプレイヤーの衝突
    this.physics.add.overlap(
      this.player,
      this.bulletPool.getGroup(),
      (_playerObj, bulletObj) => {
        const bullet = bulletObj as Bullet;

        if (!bullet.getIsActive()) return;
        if (bullet.getBulletType() === BulletType.PLAYER_NORMAL) return;

        const rawDamage = bullet.getDamage();
        const defenseReduction = DamageCalculator.calculateDamageReduction(this.player.getDefense());
        const finalDamage = Math.max(1, Math.floor(rawDamage * defenseReduction));

        this.player.takeDamage(finalDamage);
        this.waveDamageTaken += finalDamage;  // 被ダメージを記録
        // UIに被ダメージを通知
        if (this.uiManager) {
          this.uiManager.onDamageTaken(finalDamage);
        }
        bullet.deactivate();
      }
    );
  }

  /**
   * 手動での衝突判定（プレイヤー弾 vs 雑魚敵）
   */
  private checkBulletMobCollisions(): void {
    const activeBullets = this.bulletPool.getActiveBullets();
    const activeMobs = this.allMobs.filter(m => m.getIsActive());

    for (const bullet of activeBullets) {
      if (!bullet.getIsActive()) continue;
      if (bullet.getBulletType() !== BulletType.PLAYER_NORMAL) continue;

      // 弾のヒットボックス（中心からの半径）
      const bulletRadius = 8; // プレイヤー弾の大まかなサイズ

      for (const mob of activeMobs) {
        // AA弾はターゲット以外の敵をすり抜ける
        const bulletTarget = bullet.getTarget();
        if (bulletTarget && bulletTarget !== mob) {
          continue; // ターゲット以外の敵は無視
        }

        // 円と円の衝突判定
        const dx = bullet.x - mob.x;
        const dy = bullet.y - mob.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const hitDistance = bulletRadius + mob.getHitboxRadius();

        if (distance < hitDistance) {
          // 衝突！
          const rawDamage = bullet.getDamage();
          const defenseReduction = DamageCalculator.calculateDamageReduction(mob.getDefense());
          const finalDamage = Math.max(1, Math.floor(rawDamage * defenseReduction));

          // ヒットSEを再生
          AudioManager.getInstance().playSe('se_hit_arrow');

          const destroyed = mob.takeDamage(finalDamage);
          bullet.deactivate();

          if (destroyed) {
            this.score += mob.getScoreValue();
            this.waveScore += mob.getScoreValue();
            this.waveKillCount++;
            // UIに経験値を通知
            if (this.uiManager) {
              this.uiManager.addExp(mob.getExpValue());
            }
          }

          // この弾は処理済みなので次の弾へ
          break;
        }
      }
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
      if (bullet.getBulletType() === BulletType.PLAYER_NORMAL) continue;

      if (Math.abs(bullet.x - rSkillArea.x) <= halfSize &&
          Math.abs(bullet.y - rSkillArea.y) <= halfSize) {
        bullet.deactivate();
      }
    }
  }

  /**
   * 雑魚スキルヒット時の処理
   */
  private onMobSkillHit(data: {
    mob: MobEnemy;
    damage: number;
    skillType: 'A' | 'B' | 'W2' | 'E' | 'R1' | 'R2';
    pull?: { targetX: number; targetY: number; distance: number; duration: number };
    stun?: { duration: number };
  }): void {
    if (!this.player) return;

    // ダメージを与える
    const defenseReduction = DamageCalculator.calculateDamageReduction(this.player.getDefense());
    const finalDamage = Math.max(1, Math.floor(data.damage * defenseReduction));
    this.player.takeDamage(finalDamage);
    this.waveDamageTaken += finalDamage;  // 被ダメージを記録
    // UIに被ダメージを通知
    if (this.uiManager) {
      this.uiManager.onDamageTaken(finalDamage);
    }

    // 引き寄せ処理（スキルB）
    if (data.pull) {
      this.pullPlayerToward(data.pull.targetX, data.pull.targetY, data.pull.distance, data.pull.duration);
    }

    // スタン処理（スキルW2など）
    if (data.stun) {
      this.player.setStunned(true, data.stun.duration);
      this.time.delayedCall(data.stun.duration, () => {
        if (this.player) {
          this.player.setStunned(false);
        }
      });
    }
  }

  /**
   * プレイヤーを特定位置に引き寄せる
   */
  private pullPlayerToward(targetX: number, targetY: number, distance: number, duration: number): void {
    if (!this.player) return;

    // プレイヤーを行動不能にする
    this.player.setStunned(true);

    // ターゲット方向の角度
    const angle = Phaser.Math.Angle.Between(this.player.x, this.player.y, targetX, targetY);

    // 引き寄せ先の位置を計算（現在位置からtarget方向にdistance分移動）
    const pullToX = this.player.x + Math.cos(angle) * distance;
    const pullToY = this.player.y + Math.sin(angle) * distance;

    // プレイエリア内にクランプ
    const { X, Y, WIDTH, HEIGHT } = GAME_CONFIG.PLAY_AREA;
    const margin = 20;
    const clampedX = Phaser.Math.Clamp(pullToX, X + margin, X + WIDTH - margin);
    const clampedY = Phaser.Math.Clamp(pullToY, Y + margin, Y + HEIGHT - margin);

    // Tweenで移動
    this.tweens.add({
      targets: this.player,
      x: clampedX,
      y: clampedY,
      duration: duration,
      ease: 'Power2',
      onComplete: () => {
        // 引き寄せ完了後、行動可能に
        if (this.player) {
          this.player.setStunned(false);
        }
      }
    });
  }

  /**
   * 弾道補助線を描画
   */
  private drawBulletTrails(): void {
    if (!this.bulletTrailGraphics) return;

    this.bulletTrailGraphics.clear();

    const { X, Y, WIDTH, HEIGHT } = GAME_CONFIG.PLAY_AREA;
    const clamp = (value: number, min: number, max: number) =>
      Math.max(min, Math.min(max, value));

    const activeBullets = this.bulletPool.getActiveBullets();
    for (const bullet of activeBullets) {
      const startPos = bullet.getStartPosition();
      const bulletType = bullet.getBulletType();

      if (bulletType === BulletType.PLAYER_NORMAL) {
        this.bulletTrailGraphics.lineStyle(2, COLORS.TRAIL_PLAYER, 0.7);
      } else {
        this.bulletTrailGraphics.lineStyle(2, COLORS.TRAIL_ENEMY, 0.7);
      }

      this.bulletTrailGraphics.lineBetween(
        clamp(startPos.x, X, X + WIDTH),
        clamp(startPos.y, Y, Y + HEIGHT),
        clamp(bullet.x, X, X + WIDTH),
        clamp(bullet.y, Y, Y + HEIGHT)
      );
    }
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
    const activeMobs = this.allMobs.filter(m => m.getIsActive()).length;
    const elapsedTime = this.stageStartTime >= 0
      ? Math.floor((this.time.now - this.stageStartTime) / 1000)
      : 0;

    const waveIdStr = this.getWaveIdString();
    this.debugText.setText([
      `Character: ${config.name}`,
      `HP: ${this.player.getCurrentHp()}/${this.player.getMaxHp()}`,
      `Lives: ${this.lives}`,
      `Score: ${this.score}`,
      `Position: (${Math.round(this.player.x)}, ${Math.round(this.player.y)})`,
      `Bullets: ${bulletStats?.active || 0}/${bulletStats?.total || 0}`,
      `Active Mobs: ${activeMobs}`,
      `Elapsed: ${elapsedTime}s`,
      `Wave: ${waveIdStr} (${this.waveState})`,
      `SubWaves: ${this.subWaveStarted.filter(w => w).length}/${this.subWaveStarted.length}`,
    ]);
  }

  /**
   * 操作説明を表示
   */
  private showControls(): void {
    const centerX = GAME_CONFIG.WIDTH / 2;
    const y = GAME_CONFIG.HEIGHT - 80;

    const controlsText = this.add.text(centerX, y, [
      '【道中シーン】',
      'フラグ持ち（ピンク色の敵）を撃破してWaveをクリアしよう!',
      '',
      '右クリック: 移動 / 左クリック: 攻撃',
      'Q/W/E/R: スキル',
    ], {
      font: '16px monospace',
      color: '#ffffff',
      backgroundColor: '#000000cc',
      padding: { x: 10, y: 10 },
      align: 'center',
    });
    controlsText.setOrigin(0.5);
    controlsText.setDepth(DEPTH.UI);

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
