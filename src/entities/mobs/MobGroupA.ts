import Phaser from 'phaser';
import { MobGroupType, BulletType } from '@/types';
import { MobEnemy } from './MobEnemy';
import { KSHOT } from '../Bullet';
import { UNIT } from '@/config/GameConfig';

/**
 * 弾幕パターンタイプ
 */
export type MobAPatternType = 'A1' | 'A2' | 'A3' | 'A4' | 'A5' | 'A6';

/**
 * グループA雑魚
 * HP200, DEF0, ATK100
 * 生存時間15秒、1回だけ弾幕を撃って退場
 *
 * A-1: 5way弾幕 (輪弾ID:9、半径0.25m) 8m/s
 * A-2: 11way弾幕を2列 (輪弾ID:9、半径0.25m、角度120度) 4m/s
 * A-3: 自機狙い1発 (中玉ID:8、半径0.15m)
 * A-4: 自身を中心とした12個の円弾 (輪弾ID:9)
 * A-5: A-1と同様、ただし6m/s→10m/sに加速
 * A-6: 3way弾幕、逆方向に発射後、減速→停止→加速と重力軌道 8m/s→10m/s
 */
// パターン別テクスチャ設定
const PATTERN_TEXTURES: Record<MobAPatternType, { texture: string; animation: string }> = {
  'A1': { texture: 'fairy_a1', animation: 'fairy_a1_idle' },
  'A2': { texture: 'fairy_a2', animation: 'fairy_a2_idle' },
  'A3': { texture: 'fairy_a3', animation: 'fairy_a3_idle' },
  'A4': { texture: 'fairy_a1', animation: 'fairy_a1_idle' },
  'A5': { texture: 'fairy_a2', animation: 'fairy_a2_idle' },
  'A6': { texture: 'fairy_a3', animation: 'fairy_a3_idle' },
};

export class MobGroupA extends MobEnemy {
  private patternType: MobAPatternType = 'A1';
  private shootDelay: number = 1000;  // 登場後1秒後に発射
  private autoShootEnabled: boolean = true;  // 自動発射の有効/無効

  constructor(scene: Phaser.Scene, x: number, y: number) {
    // 初期パターンを決定
    const initialPattern = MobGroupA.getRandomPatternStatic();
    const config = PATTERN_TEXTURES[initialPattern];
    super(scene, x, y, MobGroupType.GROUP_A, config.texture);
    this.patternType = initialPattern;
    this.animationKey = config.animation;
    this.displayScale = 0.04;  // 850x1100を約35pxに
  }

  /**
   * ランダムなパターンを取得（静的）
   */
  private static getRandomPatternStatic(): MobAPatternType {
    const patterns: MobAPatternType[] = ['A1', 'A2', 'A3'];
    return patterns[Math.floor(Math.random() * patterns.length)];
  }

  /**
   * ランダムなパターンを取得
   */
  private getRandomPattern(): MobAPatternType {
    return MobGroupA.getRandomPatternStatic();
  }

  /**
   * スポーン時にパターンをリセット
   */
  spawn(
    x: number,
    y: number,
    targetY?: number,
    movePattern: 'straight' | 'wave' | 'zigzag' | 'stay' = 'straight'
  ): void {
    // パターンを変更してテクスチャとアニメーションを更新
    this.patternType = this.getRandomPattern();
    const config = PATTERN_TEXTURES[this.patternType];
    this.setTexture(config.texture);
    this.animationKey = config.animation;

    // 再利用時に自動発射をリセット（デフォルトは有効）
    this.autoShootEnabled = true;

    super.spawn(x, y, targetY, movePattern);
    this.hasShot = false;
  }

  /**
   * 特定パターンを指定してスポーン
   */
  spawnWithPattern(
    x: number,
    y: number,
    pattern: MobAPatternType,
    targetY?: number,
    movePattern: 'straight' | 'wave' | 'zigzag' | 'stay' = 'straight'
  ): void {
    // 指定されたパターンを設定
    this.patternType = pattern;
    const config = PATTERN_TEXTURES[pattern];
    this.setTexture(config.texture);
    this.animationKey = config.animation;

    // 再利用時に自動発射をリセット（デフォルトは有効）
    this.autoShootEnabled = true;

    super.spawn(x, y, targetY, movePattern);
    this.hasShot = false;
  }

  /**
   * パターンタイプを取得
   */
  getPatternType(): MobAPatternType {
    return this.patternType;
  }

  /**
   * 通過型スポーン（パターン指定可能）
   */
  spawnPassThroughWithPattern(
    x: number,
    y: number,
    pattern: MobAPatternType,
    velocityX: number,
    velocityY: number,
    duration: number
  ): void {
    // パターンを設定
    this.patternType = pattern;
    const config = PATTERN_TEXTURES[pattern];
    this.setTexture(config.texture);
    this.animationKey = config.animation;

    // 通過型スポーン
    this.spawnPassThrough(x, y, velocityX, velocityY, duration);
    this.hasShot = false;
  }

  /**
   * カーブ付き通過型スポーン（パターン指定可能）
   * 下方向に移動後、指定Y座標でカーブして横方向に抜ける
   */
  spawnPassThroughCurveWithPattern(
    x: number,
    y: number,
    pattern: MobAPatternType,
    velocityY: number,
    curveAtY: number,
    exitVelocityX: number,
    curveDuration: number = 1000
  ): void {
    // パターンを設定
    this.patternType = pattern;
    const config = PATTERN_TEXTURES[pattern];
    this.setTexture(config.texture);
    this.animationKey = config.animation;

    // カーブ付き通過型スポーン
    this.spawnPassThroughCurve(x, y, velocityY, curveAtY, exitVelocityX, curveDuration);
    this.hasShot = false;
  }

  /**
   * 自動発射を有効/無効にする
   */
  setAutoShoot(enabled: boolean): void {
    this.autoShootEnabled = enabled;
  }

  /**
   * 下降→発射→上昇パターンでスポーン（パターン指定可能）
   */
  spawnDescendShootAscendWithPattern(
    x: number,
    y: number,
    pattern: MobAPatternType,
    targetY: number,
    descendSpeed: number = 100,
    ascendSpeed: number = 120
  ): void {
    // パターンを設定
    this.patternType = pattern;
    const config = PATTERN_TEXTURES[pattern];
    this.setTexture(config.texture);
    this.animationKey = config.animation;

    // 自動発射を無効化（目標到達時に手動で発射）
    this.autoShootEnabled = false;

    // 発射時コールバックを設定
    this.spawnDescendShootAscend(x, y, targetY, descendSpeed, ascendSpeed, () => {
      this.shoot();
    });

    this.hasShot = false;
  }

  /**
   * 下降→ランダム移動パターンでスポーン（パターン指定付き）
   * 画面上部から下降し、目標Y座標到達後にランダム移動を開始
   */
  spawnDescendThenRandomWalkWithPattern(
    x: number,
    y: number,
    pattern: MobAPatternType,
    targetY: number,
    descendSpeed: number,
    walkSpeed: number,
    changeInterval: number = 2000
  ): void {
    // パターンを設定
    this.patternType = pattern;
    const config = PATTERN_TEXTURES[this.patternType];
    this.setTexture(config.texture);
    this.animationKey = config.animation;

    // 再利用時に自動発射をリセット（デフォルトは有効）
    this.autoShootEnabled = true;

    // 下降→ランダム移動型スポーン
    this.spawnDescendThenRandomWalk(x, y, targetY, descendSpeed, walkSpeed, changeInterval);
    this.hasShot = false;
  }

  /**
   * 外部から弾幕を発射させる（Wave制御用）
   */
  shoot(): void {
    if (!this.bulletPool || !this.playerPosition || !this.isActive) {
      return;
    }

    // カーブ中（横移動中）は発射しない
    if (this.getIsCurving()) {
      return;
    }

    // プレイエリア外にいる場合は発射しない
    if (!this.isInsidePlayArea()) {
      return;
    }

    // パターンに応じた弾幕を発射
    switch (this.patternType) {
      case 'A1':
        this.shootPatternA1();
        break;
      case 'A2':
        this.shootPatternA2();
        break;
      case 'A3':
        this.shootPatternA3();
        break;
      case 'A4':
        this.shootPatternA4();
        break;
      case 'A5':
        this.shootPatternA5();
        break;
      case 'A6':
        this.shootPatternA6();
        break;
    }
  }

  /**
   * 弾幕発射処理
   * 登場後1秒後に1回だけ発射（自動発射が有効な場合のみ）
   */
  protected updateShooting(time: number): void {
    // 自動発射が無効なら何もしない
    if (!this.autoShootEnabled) {
      return;
    }

    // カーブ中は発射しない
    if (this.getIsCurving()) {
      return;
    }

    if (!this.bulletPool || !this.playerPosition) {
      return;
    }

    // 既に発射済みなら何もしない
    if (this.hasShot) {
      return;
    }

    // 登場後1秒経過したら発射
    const aliveTime = time - this.spawnTime;
    if (aliveTime < this.shootDelay) {
      return;
    }

    // プレイエリア外にいる場合は発射しない
    if (!this.isInsidePlayArea()) {
      return;
    }

    this.hasShot = true;

    // パターンに応じた弾幕を発射
    switch (this.patternType) {
      case 'A1':
        this.shootPatternA1();
        break;
      case 'A2':
        this.shootPatternA2();
        break;
      case 'A3':
        this.shootPatternA3();
        break;
      case 'A4':
        this.shootPatternA4();
        break;
      case 'A5':
        this.shootPatternA5();
        break;
      case 'A6':
        this.shootPatternA6();
        break;
    }
  }

  /**
   * A-1: 5way弾幕
   * 輪弾ID:9（赤）、半径0.25m
   */
  private shootPatternA1(): void {
    if (!this.bulletPool || !this.playerPosition) return;

    const wayCount = 5;
    const bulletRadius = 0.25 * UNIT.METER_TO_PIXEL;  // 0.25m = 13.75px
    const displayScale = (bulletRadius * 2) / 278;    // 輪弾は278px
    const spreadAngle = Math.PI / 6;  // 30度（全体60度の扇）
    const bulletSpeed = 8 * UNIT.METER_TO_PIXEL;  // 8m/s = 440px/s

    // プレイヤー方向の角度
    const centerAngle = Phaser.Math.Angle.Between(
      this.x, this.y,
      this.playerPosition.x, this.playerPosition.y
    );

    for (let i = 0; i < wayCount; i++) {
      const angle = centerAngle + (i - (wayCount - 1) / 2) * (spreadAngle / (wayCount - 1) * 2);
      const bullet = this.bulletPool.acquire();
      if (bullet) {
        const targetX = this.x + Math.cos(angle) * 500;
        const targetY = this.y + Math.sin(angle) * 500;
        bullet.fire(
          this.x, this.y,
          targetX, targetY,
          BulletType.ENEMY_NORMAL,
          this.stats.attackPower,
          null, false,
          KSHOT.RINDAN.RED  // ID:9
        );
        bullet.setScale(displayScale);

        // 当たり判定と速度を設定
        const body = bullet.body as Phaser.Physics.Arcade.Body;
        if (body) {
          body.setCircle(bulletRadius / displayScale, 0, 0);
          // 速度を遅くする
          body.setVelocity(
            Math.cos(angle) * bulletSpeed,
            Math.sin(angle) * bulletSpeed
          );
        }
      }
    }
  }

  /**
   * A-2: 11way弾幕を2列
   * 輪弾ID:9（赤）、半径0.25m、角度120度
   */
  private shootPatternA2(): void {
    if (!this.bulletPool || !this.playerPosition) return;
    console.log(`[A-2 shootPatternA2] 発射! time=${Math.floor(this.scene.time.now)}ms`);

    const wayCount = 11;
    const rowCount = 2;
    const bulletRadius = 0.25 * UNIT.METER_TO_PIXEL;  // 0.25m = 13.75px
    const displayScale = (bulletRadius * 2) / 278;    // 輪弾は278px
    const totalSpread = Math.PI * 2 / 3;  // 120度
    const bulletSpeed = 4 * UNIT.METER_TO_PIXEL;  // 4m/s = 220px/s（遅め）

    // プレイヤー方向の角度
    const centerAngle = Phaser.Math.Angle.Between(
      this.x, this.y,
      this.playerPosition.x, this.playerPosition.y
    );

    for (let row = 0; row < rowCount; row++) {
      const speedMultiplier = 1 - row * 0.2;  // 後列は遅い

      for (let i = 0; i < wayCount; i++) {
        const angle = centerAngle + (i - (wayCount - 1) / 2) * (totalSpread / (wayCount - 1));
        const bullet = this.bulletPool.acquire();
        if (bullet) {
          const targetX = this.x + Math.cos(angle) * 500;
          const targetY = this.y + Math.sin(angle) * 500;
          bullet.fire(
            this.x, this.y,
            targetX, targetY,
            BulletType.ENEMY_NORMAL,
            this.stats.attackPower,
            null, false,
            KSHOT.RINDAN.RED  // ID:9
          );
          bullet.setScale(displayScale);

          // 当たり判定と速度を設定
          const body = bullet.body as Phaser.Physics.Arcade.Body;
          if (body) {
            body.setCircle(bulletRadius / displayScale, 0, 0);
            // 速度を遅くし、後列はさらに遅い
            body.setVelocity(
              Math.cos(angle) * bulletSpeed * speedMultiplier,
              Math.sin(angle) * bulletSpeed * speedMultiplier
            );
          }
        }
      }
    }
  }

  /**
   * A-3: 自機狙い1発
   * 中玉ID:8（白）、半径0.15m、6m/s
   */
  private shootPatternA3(): void {
    if (!this.bulletPool || !this.playerPosition) return;

    const bulletRadius = 0.15 * UNIT.METER_TO_PIXEL;  // 0.15m = 8.25px
    const displayScale = (bulletRadius * 2) / 512;     // 中玉は512px
    const bulletSpeed = 6 * UNIT.METER_TO_PIXEL;       // 6m/s = 330px/s

    // プレイヤー方向の角度
    const angle = Phaser.Math.Angle.Between(
      this.x, this.y,
      this.playerPosition.x, this.playerPosition.y
    );

    const bullet = this.bulletPool.acquire();
    if (bullet) {
      bullet.fire(
        this.x, this.y,
        this.playerPosition.x, this.playerPosition.y,
        BulletType.ENEMY_AIMED,
        this.stats.attackPower,
        null, false,
        KSHOT.MEDIUM_BALL.WHITE  // ID:8
      );
      bullet.setScale(displayScale);

      // 当たり判定と速度を設定
      const body = bullet.body as Phaser.Physics.Arcade.Body;
      if (body) {
        body.setCircle(bulletRadius / displayScale, 0, 0);
        body.setVelocity(
          Math.cos(angle) * bulletSpeed,
          Math.sin(angle) * bulletSpeed
        );
      }
    }
  }

  /**
   * A-4: 自身を中心とした12個の円弾
   * 輪弾ID:9（赤）、半径0.25m、8m/s
   * 全方向に均等配置
   */
  private shootPatternA4(): void {
    if (!this.bulletPool) return;

    const wayCount = 12;
    const bulletRadius = 0.25 * UNIT.METER_TO_PIXEL;  // 0.25m
    const displayScale = (bulletRadius * 2) / 278;    // 輪弾は278px
    const bulletSpeed = 4 * UNIT.METER_TO_PIXEL;      // 4m/s（半減）

    for (let i = 0; i < wayCount; i++) {
      const angle = (Math.PI * 2 / wayCount) * i;
      const bullet = this.bulletPool.acquire();
      if (bullet) {
        const targetX = this.x + Math.cos(angle) * 500;
        const targetY = this.y + Math.sin(angle) * 500;
        bullet.fire(
          this.x, this.y,
          targetX, targetY,
          BulletType.ENEMY_NORMAL,
          this.stats.attackPower,
          null, false,
          KSHOT.RINDAN.RED  // ID:9
        );
        bullet.setScale(displayScale);

        const body = bullet.body as Phaser.Physics.Arcade.Body;
        if (body) {
          body.setCircle(bulletRadius / displayScale, 0, 0);
          body.setVelocity(
            Math.cos(angle) * bulletSpeed,
            Math.sin(angle) * bulletSpeed
          );
        }
      }
    }
  }

  /**
   * A-5: 5way弾幕（加速タイプ）
   * A-1と同様だが、6m/s→18m/sに徐々に加速
   */
  private shootPatternA5(): void {
    if (!this.bulletPool || !this.playerPosition) return;

    const wayCount = 5;
    const bulletRadius = 0.25 * UNIT.METER_TO_PIXEL;
    const displayScale = (bulletRadius * 2) / 278;
    const spreadAngle = Math.PI / 6;  // 30度（全体60度の扇）
    const initialSpeed = 3 * UNIT.METER_TO_PIXEL;   // 3m/s（半減）
    const maxSpeed = 12 * UNIT.METER_TO_PIXEL;      // 12m/s（半減）
    const accelerationTime = 1000;  // 1秒で最高速度に

    const centerAngle = Phaser.Math.Angle.Between(
      this.x, this.y,
      this.playerPosition.x, this.playerPosition.y
    );

    for (let i = 0; i < wayCount; i++) {
      const angle = centerAngle + (i - (wayCount - 1) / 2) * (spreadAngle / (wayCount - 1) * 2);
      const bullet = this.bulletPool.acquire();
      if (bullet) {
        const targetX = this.x + Math.cos(angle) * 500;
        const targetY = this.y + Math.sin(angle) * 500;
        bullet.fire(
          this.x, this.y,
          targetX, targetY,
          BulletType.ENEMY_NORMAL,
          this.stats.attackPower,
          null, false,
          KSHOT.RINDAN.RED
        );
        bullet.setScale(displayScale);

        const body = bullet.body as Phaser.Physics.Arcade.Body;
        if (body) {
          body.setCircle(bulletRadius / displayScale, 0, 0);
          body.setVelocity(
            Math.cos(angle) * initialSpeed,
            Math.sin(angle) * initialSpeed
          );

          // 加速処理: ダミーオブジェクトをTweenターゲットにして速度を更新
          const vx = Math.cos(angle);
          const vy = Math.sin(angle);
          const speedObj = { speed: initialSpeed };
          this.scene.tweens.add({
            targets: speedObj,
            speed: maxSpeed,
            duration: accelerationTime,
            ease: 'Linear',
            onUpdate: () => {
              if (bullet.active && body.enable) {
                body.setVelocity(vx * speedObj.speed, vy * speedObj.speed);
              }
            }
          });
        }
      }
    }
  }

  /**
   * A-6: 3way重力弾（自機狙い）
   * 3方向に弾を発射、各弾はプレイヤーと逆方向に発射後、減速→停止→プレイヤー方向に加速
   */
  private shootPatternA6(): void {
    if (!this.bulletPool || !this.playerPosition) return;

    // プレイエリア外にいる場合は発射しない
    if (!this.isInsidePlayArea()) {
      return;
    }

    const wayCount = 3;
    const spreadAngle = Math.PI / 8;  // 22.5度（全体45度の扇）
    const bulletRadius = 0.25 * UNIT.METER_TO_PIXEL;
    const displayScale = (bulletRadius * 2) / 512;  // 中玉は512px
    const initialSpeed = 5.3 * UNIT.METER_TO_PIXEL;   // 初速5.3m/s（2/3に減速）
    const finalSpeed = 16 * UNIT.METER_TO_PIXEL;     // 最終速度16m/s（2/3に減速）

    // プレイヤー方向の角度
    const playerAngle = Phaser.Math.Angle.Between(
      this.x, this.y,
      this.playerPosition.x, this.playerPosition.y
    );
    // 逆方向
    const reverseAngle = playerAngle + Math.PI;

    // 落下順序: 左(i=0)→右(i=2)→中央(i=1)
    // 各弾の落下遅延（ms）
    const fallDelays = [0, 400, 200];  // i=0: 0ms, i=1: 400ms, i=2: 200ms
    // 上がる高さ: 中央(i=1)＞右(i=2)＞左(i=0)
    // 減速時間が長いほど高く上がる
    const decelerateTimes = [1200, 1800, 1500];  // i=0: 1.2秒, i=1: 1.8秒, i=2: 1.5秒

    for (let i = 0; i < wayCount; i++) {
      // 3way: 左(i=0)、中央(i=1)、右(i=2)
      const angleOffset = (i - 1) * spreadAngle;
      const fireAngle = reverseAngle + angleOffset;

      const bullet = this.bulletPool.acquire();
      if (bullet) {
        const targetX = this.x + Math.cos(fireAngle) * 500;
        const targetY = this.y + Math.sin(fireAngle) * 500;
        bullet.fire(
          this.x, this.y,
          targetX, targetY,
          BulletType.ENEMY_NORMAL,
          this.stats.attackPower,
          null, false,
          KSHOT.MEDIUM_BALL.CYAN  // ID 5（黒縁中玉シアン）
        );
        bullet.setScale(displayScale);

        // プレイエリア外でも消えないようにする（戻り弾用）
        bullet.setPersistOutsidePlayArea(true);

        const body = bullet.body as Phaser.Physics.Arcade.Body;
        if (body) {
          body.setCircle(bulletRadius / displayScale, 0, 0);

          // 初速を逆方向に設定
          body.setVelocity(
            Math.cos(fireAngle) * initialSpeed,
            Math.sin(fireAngle) * initialSpeed
          );

          // 減速→即座に反転（Linearで一定減速、停止時間なし）
          const decelerateTime = decelerateTimes[i];  // 弾ごとに異なる減速時間
          const accelerateTime = 600;   // 加速は早めに
          const fallDelay = fallDelays[i];  // 落下タイミングの遅延

          const speedObj = { speed: initialSpeed };
          const currentFireAngle = fireAngle;
          const fallAngle = Math.PI / 2;  // 真下に落下

          this.scene.tweens.add({
            targets: speedObj,
            speed: 0,
            duration: decelerateTime,
            ease: 'Linear',  // 一定速度で減速（最後に遅くならない）
            onUpdate: () => {
              if (bullet.active && body.enable) {
                body.setVelocity(
                  Math.cos(currentFireAngle) * speedObj.speed,
                  Math.sin(currentFireAngle) * speedObj.speed
                );
              }
            },
            onComplete: () => {
              if (!bullet.active || !body.enable) return;

              // 落下遅延後に反転して落下開始
              this.scene.time.delayedCall(fallDelay, () => {
                if (!bullet.active || !body.enable) return;

                const accelObj = { speed: 0 };
                this.scene.tweens.add({
                  targets: accelObj,
                  speed: finalSpeed,
                  duration: accelerateTime,
                  ease: 'Quad.easeIn',
                  onUpdate: () => {
                    if (bullet.active && body.enable) {
                      body.setVelocity(
                        Math.cos(fallAngle) * accelObj.speed,
                        Math.sin(fallAngle) * accelObj.speed
                      );
                    }
                  }
                });
              });
            }
          });
        }
      }
    }
  }
}
