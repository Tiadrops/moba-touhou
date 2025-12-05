import Phaser from 'phaser';
import { CharacterType, CharacterConfig, Position, BulletType } from '@/types';
import { CHARACTER_DATA } from '@/config/CharacterData';
import { DEPTH, COLORS } from '@/config/GameConfig';
import { BulletPool } from '@/utils/ObjectPool';
import { Enemy } from './Enemy';

/**
 * プレイヤーキャラクタークラス
 */
export class Player extends Phaser.Physics.Arcade.Sprite {
  // キャラクター設定
  private characterConfig: CharacterConfig;

  // 現在の状態
  private currentHp: number;
  private isInvincible: boolean = false;

  // 移動関連
  private targetPosition: Position | null = null;
  private isMoving: boolean = false;

  // 攻撃関連
  private lastAttackTime: number = 0;
  private attackCooldown: number;
  private bulletPool: BulletPool | null = null;
  private enemies: Enemy[] = [];

  // Attack Move関連
  private isAttackMove: boolean = false;
  private attackMoveTarget: Position | null = null;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    characterType: CharacterType = CharacterType.REIMU
  ) {
    super(scene, x, y, 'player');

    // キャラクター設定を取得
    this.characterConfig = CHARACTER_DATA[characterType];

    // 物理エンジンに追加
    scene.add.existing(this);
    scene.physics.add.existing(this);

    // 初期化
    this.initialize();
  }

  /**
   * 初期化
   */
  private initialize(): void {
    const { stats } = this.characterConfig;

    // HP設定
    this.currentHp = stats.maxHp;

    // 攻撃クールダウン計算（ミリ秒）
    this.attackCooldown = 1000 / stats.attackSpeed;

    // 表示設定
    this.setDepth(DEPTH.PLAYER);
    this.setTint(COLORS.PLAYER);

    // 当たり判定設定
    const body = this.body as Phaser.Physics.Arcade.Body;
    if (body) {
      body.setCircle(stats.hitboxRadius);
      body.setOffset(
        this.width / 2 - stats.hitboxRadius,
        this.height / 2 - stats.hitboxRadius
      );
    }
  }

  /**
   * 更新処理
   */
  update(time: number, delta: number): void {
    // 移動処理
    this.updateMovement(delta);

    // Attack Move処理
    this.updateAttackMove(time);
  }

  /**
   * 移動処理
   */
  private updateMovement(delta: number): void {
    if (!this.targetPosition) {
      // 目標位置がない場合は停止
      this.setVelocity(0, 0);
      this.isMoving = false;
      return;
    }

    const dx = this.targetPosition.x - this.x;
    const dy = this.targetPosition.y - this.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // 目標に到達したら停止
    const arrivalThreshold = 5;
    if (distance < arrivalThreshold) {
      this.setVelocity(0, 0);
      this.targetPosition = null;
      this.isMoving = false;

      // Attack Move中に到達したらAttack Move終了
      if (this.isAttackMove) {
        this.isAttackMove = false;
        this.attackMoveTarget = null;
      }
      return;
    }

    // 移動速度を計算
    const { moveSpeed } = this.characterConfig.stats;
    const directionX = dx / distance;
    const directionY = dy / distance;

    this.setVelocity(
      directionX * moveSpeed,
      directionY * moveSpeed
    );

    this.isMoving = true;
  }

  /**
   * 目標位置を設定（右クリック移動）
   */
  setTargetPosition(x: number, y: number): void {
    this.targetPosition = { x, y };
  }

  /**
   * ダメージを受ける
   */
  takeDamage(damage: number): void {
    if (this.isInvincible) {
      return;
    }

    this.currentHp = Math.max(0, this.currentHp - damage);

    // 被弾エフェクト
    this.flashDamage();

    // HPが0になったら死亡処理
    if (this.currentHp <= 0) {
      this.onDeath();
    }
  }

  /**
   * HP回復
   */
  heal(amount: number): void {
    this.currentHp = Math.min(
      this.characterConfig.stats.maxHp,
      this.currentHp + amount
    );
  }

  /**
   * 無敵状態を設定
   */
  setInvincible(duration: number): void {
    this.isInvincible = true;

    // 点滅アニメーション
    this.scene.tweens.add({
      targets: this,
      alpha: 0.3,
      duration: 100,
      yoyo: true,
      repeat: Math.floor(duration / 200),
      onComplete: () => {
        this.isInvincible = false;
        this.setAlpha(1);
      },
    });
  }

  /**
   * 被弾エフェクト
   */
  private flashDamage(): void {
    this.setTint(0xff0000);
    this.scene.time.delayedCall(100, () => {
      this.setTint(COLORS.PLAYER);
    });
  }

  /**
   * 死亡処理
   */
  private onDeath(): void {
    // TODO: 死亡エフェクト
    // TODO: 残機処理
    console.log('Player died!');

    // 仮：復活処理
    this.scene.time.delayedCall(1000, () => {
      this.respawn();
    });
  }

  /**
   * 復活処理
   */
  private respawn(): void {
    this.currentHp = this.characterConfig.stats.maxHp;
    this.setInvincible(2000); // 2秒間無敵

    // TODO: リスポーン位置を設定
  }

  /**
   * Attack Move処理
   * Aキーで設定された地点に移動中、射程内の敵を発見したら攻撃して停止
   */
  private updateAttackMove(time: number): void {
    if (!this.isAttackMove || !this.isMoving) {
      return;
    }

    // 攻撃クールダウン中は処理しない
    if (!this.canAttack(time)) {
      return;
    }

    // 最も近い敵を探す
    const nearestEnemy = this.findNearestEnemy();
    if (!nearestEnemy) {
      return;
    }

    // 射程内かチェック
    const distance = Phaser.Math.Distance.Between(
      this.x,
      this.y,
      nearestEnemy.x,
      nearestEnemy.y
    );

    if (distance <= this.characterConfig.stats.attackRange) {
      // 攻撃して移動を停止
      this.attackTarget(time, nearestEnemy);
      this.stopMovement();
      this.isAttackMove = false;
      this.attackMoveTarget = null;
    }
  }

  /**
   * 最も近い敵を探す
   */
  findNearestEnemy(): Enemy | null {
    let nearestEnemy: Enemy | null = null;
    let nearestDistance = Infinity;

    for (const enemy of this.enemies) {
      if (!enemy.getIsActive()) {
        continue;
      }

      const distance = Phaser.Math.Distance.Between(
        this.x,
        this.y,
        enemy.x,
        enemy.y
      );

      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestEnemy = enemy;
      }
    }

    return nearestEnemy;
  }

  /**
   * 指定位置の最も近い敵を探す
   */
  findNearestEnemyToPosition(x: number, y: number): Enemy | null {
    let nearestEnemy: Enemy | null = null;
    let nearestDistance = Infinity;

    for (const enemy of this.enemies) {
      if (!enemy.getIsActive()) {
        continue;
      }

      const distance = Phaser.Math.Distance.Between(
        x,
        y,
        enemy.x,
        enemy.y
      );

      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestEnemy = enemy;
      }
    }

    return nearestEnemy;
  }

  /**
   * 通常攻撃可能か判定
   */
  canAttack(currentTime: number): boolean {
    return currentTime - this.lastAttackTime >= this.attackCooldown;
  }

  /**
   * 指定した敵に攻撃（手動攻撃用）
   * LoL風の必中システム：弾が当たった時点でダメージ（打ち消し可能）
   */
  attackTarget(currentTime: number, target: Enemy): void {
    if (!this.canAttack(currentTime)) {
      return;
    }

    // 射程内かチェック
    const distance = Phaser.Math.Distance.Between(
      this.x,
      this.y,
      target.x,
      target.y
    );

    if (distance > this.characterConfig.stats.attackRange) {
      return;
    }

    this.lastAttackTime = currentTime;

    // 弾を発射（追尾弾）
    if (this.bulletPool) {
      const bullet = this.bulletPool.acquire();
      if (bullet) {
        bullet.fire(
          this.x,
          this.y,
          target.x,
          target.y,
          BulletType.PLAYER_NORMAL,
          this.characterConfig.stats.attackDamage,
          target // 追尾対象を渡す
        );
      }
    }
  }

  /**
   * 移動を停止
   */
  stopMovement(): void {
    this.setVelocity(0, 0);
    this.targetPosition = null;
    this.isMoving = false;
  }

  /**
   * Attack Moveを設定
   */
  setAttackMove(x: number, y: number): void {
    this.isAttackMove = true;
    this.attackMoveTarget = { x, y };
    this.setTargetPosition(x, y);
  }

  /**
   * 弾プールを設定
   */
  setBulletPool(pool: BulletPool): void {
    this.bulletPool = pool;
  }

  /**
   * 敵リストを設定
   */
  setEnemies(enemies: Enemy[]): void {
    this.enemies = enemies;
  }

  // ゲッター
  getCurrentHp(): number {
    return this.currentHp;
  }

  getMaxHp(): number {
    return this.characterConfig.stats.maxHp;
  }

  getCharacterConfig(): CharacterConfig {
    return this.characterConfig;
  }

  getIsMoving(): boolean {
    return this.isMoving;
  }

  getAttackRange(): number {
    return this.characterConfig.stats.attackRange;
  }
}
