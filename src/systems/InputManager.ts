import Phaser from 'phaser';
import { Player } from '@/entities/Player';
import { Enemy } from '@/entities/Enemy';
import { GAME_CONFIG, COLORS, DEPTH } from '@/config/GameConfig';

/**
 * 入力管理システム
 * 右クリック移動、スキル発動などを管理
 */
export class InputManager {
  private scene: Phaser.Scene;
  private player: Player;
  private enemies: Enemy[] = [];

  // マウス移動先のマーカー
  private moveMarker: Phaser.GameObjects.Graphics | null = null;
  private markerTween: Phaser.Tweens.Tween | null = null;

  // 攻撃範囲表示
  private attackRangeCircle: Phaser.GameObjects.Graphics | null = null;
  private isShowingAttackRange: boolean = false;

  // プレイエリアの境界
  private playAreaBounds: Phaser.Geom.Rectangle;

  constructor(scene: Phaser.Scene, player: Player) {
    this.scene = scene;
    this.player = player;

    // プレイエリアの境界を設定
    const { X, Y, WIDTH, HEIGHT } = GAME_CONFIG.PLAY_AREA;
    this.playAreaBounds = new Phaser.Geom.Rectangle(X, Y, WIDTH, HEIGHT);

    this.setupInput();
  }

  /**
   * 入力設定
   */
  private setupInput(): void {
    // マウスクリック
    this.scene.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (pointer.rightButtonDown()) {
        // 右クリック移動
        this.handleRightClick(pointer.x, pointer.y);
      } else if (pointer.leftButtonDown()) {
        // 左クリック攻撃
        this.handleLeftClick(pointer.x, pointer.y);
      }
    });

    // コンテキストメニューを無効化
    this.scene.input.mouse?.disableContextMenu();

    // キーボード入力
    const keyboard = this.scene.input.keyboard;
    if (keyboard) {
      // スキルキー
      keyboard.on('keydown-Q', () => this.handleSkillKey('Q'));
      keyboard.on('keydown-W', () => this.handleSkillKey('W'));
      keyboard.on('keydown-E', () => this.handleSkillKey('E'));
      keyboard.on('keydown-R', () => this.handleSkillKey('R'));
      keyboard.on('keydown-D', () => this.handleSkillKey('D'));
      keyboard.on('keydown-F', () => this.handleSkillKey('F'));

      // Aキー: Attack Move
      keyboard.on('keydown-A', () => this.handleAttackMoveKey());

      // Sキー: 射程範囲表示トグル
      keyboard.on('keydown-S', () => this.handleShowRangeKey());
    }
  }

  /**
   * 右クリック処理
   */
  private handleRightClick(x: number, y: number): void {
    // プレイエリア内かチェック
    if (!this.playAreaBounds.contains(x, y)) {
      return;
    }

    // プレイヤーに移動指示
    this.player.setTargetPosition(x, y);

    // 移動先マーカーを表示
    this.showMoveMarker(x, y);
  }

  /**
   * 移動先マーカーを表示
   */
  private showMoveMarker(x: number, y: number): void {
    // 既存のマーカーを削除
    if (this.moveMarker) {
      this.moveMarker.destroy();
    }
    if (this.markerTween) {
      this.markerTween.remove();
    }

    // 新しいマーカーを作成
    this.moveMarker = this.scene.add.graphics();
    this.moveMarker.lineStyle(2, COLORS.PLAYER, 1);
    this.moveMarker.strokeCircle(0, 0, 20);
    this.moveMarker.setPosition(x, y);
    this.moveMarker.setDepth(1000);

    // フェードアウトアニメーション
    this.markerTween = this.scene.tweens.add({
      targets: this.moveMarker,
      alpha: 0,
      scale: 1.5,
      duration: 500,
      onComplete: () => {
        if (this.moveMarker) {
          this.moveMarker.destroy();
          this.moveMarker = null;
        }
      },
    });
  }

  /**
   * 左クリック処理
   */
  private handleLeftClick(x: number, y: number): void {
    // プレイエリア内かチェック
    if (!this.playAreaBounds.contains(x, y)) {
      return;
    }

    // Sキーで射程範囲表示中の場合
    if (this.isShowingAttackRange) {
      this.attackNearestEnemyAt(x, y);
      // AA後は範囲表示を消す
      this.isShowingAttackRange = false;
      this.hideAttackRange();
      return;
    }

    // 通常の左クリック：クリックした位置の敵を攻撃
    const clickedEnemy = this.getEnemyAtPosition(x, y);
    if (clickedEnemy) {
      this.player.attackTarget(this.scene.time.now, clickedEnemy);
    }
  }

  /**
   * 指定位置の敵を取得
   */
  private getEnemyAtPosition(x: number, y: number): Enemy | null {
    const clickRadius = 30; // クリック判定の半径

    for (const enemy of this.enemies) {
      if (!enemy.getIsActive()) {
        continue;
      }

      const distance = Phaser.Math.Distance.Between(x, y, enemy.x, enemy.y);
      if (distance <= clickRadius) {
        return enemy;
      }
    }

    return null;
  }

  /**
   * Aキー: Attack Move処理（LoLの移動攻撃クリック）
   * クリック不要で即座にカーソル位置への移動攻撃を実行
   * 1. カーソル位置に敵がいて射程内なら即攻撃
   * 2. 射程外ならカーソル位置まで移動
   * 3. 移動中に射程内の敵がいたら攻撃
   */
  private handleAttackMoveKey(): void {
    console.log('Attack Move Click executed');

    // 現在のマウスカーソル位置を取得
    const pointer = this.scene.input.activePointer;
    const x = pointer.x;
    const y = pointer.y;

    // プレイエリア内かチェック
    if (!this.playAreaBounds.contains(x, y)) {
      return;
    }

    // Attack Move実行
    this.executeAttackMove(x, y);
  }

  /**
   * Attack Move実行
   */
  private executeAttackMove(x: number, y: number): void {
    // プレイエリア内かチェック
    if (!this.playAreaBounds.contains(x, y)) {
      return;
    }

    // カーソル位置に最も近い敵を探す
    const nearestEnemy = this.player.findNearestEnemyToPosition(x, y);

    if (nearestEnemy) {
      // 敵がプレイヤーの射程内かチェック
      const distance = Phaser.Math.Distance.Between(
        this.player.x,
        this.player.y,
        nearestEnemy.x,
        nearestEnemy.y
      );

      if (distance <= this.player.getAttackRange()) {
        // 射程内なら即攻撃
        this.player.attackTarget(this.scene.time.now, nearestEnemy);
        return;
      }
    }

    // 射程外なら移動開始（移動中に敵を見つけたら攻撃）
    this.player.setAttackMove(x, y);
    this.showMoveMarker(x, y);
  }

  /**
   * Sキー: 射程範囲表示トグル
   */
  private handleShowRangeKey(): void {
    this.isShowingAttackRange = !this.isShowingAttackRange;

    if (this.isShowingAttackRange) {
      this.showAttackRange();
    } else {
      this.hideAttackRange();
    }
  }

  /**
   * 攻撃範囲を表示
   */
  private showAttackRange(): void {
    // 既存の範囲表示を削除
    if (this.attackRangeCircle) {
      this.attackRangeCircle.destroy();
    }

    // 攻撃範囲の円を作成
    this.attackRangeCircle = this.scene.add.graphics();
    this.attackRangeCircle.lineStyle(2, COLORS.PLAYER, 0.5);
    this.attackRangeCircle.fillStyle(COLORS.PLAYER, 0.1);
    this.attackRangeCircle.fillCircle(0, 0, this.player.getAttackRange());
    this.attackRangeCircle.strokeCircle(0, 0, this.player.getAttackRange());
    this.attackRangeCircle.setDepth(DEPTH.UI - 1);
  }

  /**
   * 攻撃範囲を非表示
   */
  private hideAttackRange(): void {
    if (this.attackRangeCircle) {
      this.attackRangeCircle.destroy();
      this.attackRangeCircle = null;
    }
  }

  /**
   * 指定位置の最も近い敵に攻撃
   */
  private attackNearestEnemyAt(x: number, y: number): void {
    const nearestEnemy = this.player.findNearestEnemyToPosition(x, y);

    if (nearestEnemy) {
      // 射程内かチェック
      const distance = Phaser.Math.Distance.Between(
        this.player.x,
        this.player.y,
        nearestEnemy.x,
        nearestEnemy.y
      );

      if (distance <= this.player.getAttackRange()) {
        this.player.attackTarget(this.scene.time.now, nearestEnemy);
      }
    }
  }

  /**
   * スキルキー処理
   */
  private handleSkillKey(key: string): void {
    console.log(`Skill ${key} pressed`);
    // TODO: スキルシステムの実装後に処理を追加
  }

  /**
   * 敵リストを設定
   */
  setEnemies(enemies: Enemy[]): void {
    this.enemies = enemies;
  }

  /**
   * 更新処理
   */
  update(time: number, delta: number): void {
    // 攻撃範囲表示をプレイヤーの位置に追従
    if (this.isShowingAttackRange && this.attackRangeCircle) {
      this.attackRangeCircle.setPosition(this.player.x, this.player.y);
    }
  }

  /**
   * クリーンアップ
   */
  destroy(): void {
    if (this.moveMarker) {
      this.moveMarker.destroy();
    }
    if (this.markerTween) {
      this.markerTween.remove();
    }
    if (this.attackRangeCircle) {
      this.attackRangeCircle.destroy();
    }
  }
}
