import Phaser from 'phaser';
import { Player } from '@/entities/Player';
import { Enemy } from '@/entities/Enemy';
import { GAME_CONFIG, COLORS, DEPTH } from '@/config/GameConfig';
import { SkillSlot, Attackable } from '@/types';

/**
 * 入力管理システム
 * 右クリック移動、スキル発動などを管理
 */
export class InputManager {
  private scene: Phaser.Scene;
  private player: Player;
  private enemies: Enemy[] = [];
  private boss: Attackable | null = null;

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
   * 移動のみ（敵ターゲットは左クリックで行う）
   */
  private handleRightClick(x: number, y: number): void {
    // プレイエリア内かチェック
    if (this.playAreaBounds.contains(x, y)) {
      // プレイエリア内：通常の移動 + 波紋表示
      this.player.setTargetPosition(x, y);
      this.showMoveMarker(x, y);
    } else {
      // プレイエリア外：クリックした方角に向かって移動（波紋なし）
      // プレイヤーからクリック位置への方角を計算
      const angle = Phaser.Math.Angle.Between(
        this.player.x,
        this.player.y,
        x,
        y
      );

      // プレイエリアの境界との交点を計算
      const targetPos = this.calculatePlayAreaEdgePoint(
        this.player.x,
        this.player.y,
        angle
      );

      // プレイヤーに移動指示（波紋は表示しない）
      this.player.setTargetPosition(targetPos.x, targetPos.y);
    }
  }

  /**
   * プレイヤー位置から指定角度でプレイエリアの境界との交点を計算
   * 画面端にいる場合、移動可能な軸だけでも移動できるようにする
   */
  private calculatePlayAreaEdgePoint(
    startX: number,
    startY: number,
    angle: number
  ): { x: number; y: number } {
    const { x: areaX, y: areaY, width, height } = this.playAreaBounds;
    const areaRight = areaX + width;
    const areaBottom = areaY + height;

    // 方向ベクトル
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);

    // プレイヤーの当たり判定サイズ分のマージン
    const margin = 12; // プレイヤーのhitboxRadius

    // クリック方向の判定（斜め移動の判定に使用）
    const wantsToMoveLeft = dx < -0.1;
    const wantsToMoveRight = dx > 0.1;
    const wantsToMoveUp = dy < -0.1;
    const wantsToMoveDown = dy > 0.1;

    // 各境界までの距離を計算
    const distToLeft = startX - (areaX + margin);
    const distToRight = (areaRight - margin) - startX;
    const distToTop = startY - (areaY + margin);
    const distToBottom = (areaBottom - margin) - startY;

    // 端に近い閾値（この距離以下なら「端にいる」と判定）
    const EDGE_THRESHOLD = 30;

    // 端に近いかつクリック方向が外側の場合、軸移動を優先
    const nearLeftAndClickingLeft = distToLeft < EDGE_THRESHOLD && wantsToMoveLeft;
    const nearRightAndClickingRight = distToRight < EDGE_THRESHOLD && wantsToMoveRight;
    const nearTopAndClickingUp = distToTop < EDGE_THRESHOLD && wantsToMoveUp;
    const nearBottomAndClickingDown = distToBottom < EDGE_THRESHOLD && wantsToMoveDown;

    // X軸方向が制限されている（端に近くて外側にクリック）
    const xAxisBlocked = nearLeftAndClickingLeft || nearRightAndClickingRight;
    // Y軸方向が制限されている（端に近くて外側にクリック）
    const yAxisBlocked = nearTopAndClickingUp || nearBottomAndClickingDown;

    // 両軸ともブロックされている場合（角にいる） → 移動しない
    if (xAxisBlocked && yAxisBlocked) {
      return { x: startX, y: startY };
    }

    // X軸がブロックされている場合 → Y軸のみ移動（Y軸方向への意図がある場合）
    if (xAxisBlocked) {
      if (wantsToMoveDown) {
        return { x: startX, y: areaBottom - margin };
      } else if (wantsToMoveUp) {
        return { x: startX, y: areaY + margin };
      }
      // Y軸方向への意図がない場合は移動しない
      return { x: startX, y: startY };
    }

    // Y軸がブロックされている場合 → X軸のみ移動（X軸方向への意図がある場合）
    if (yAxisBlocked) {
      if (wantsToMoveRight) {
        return { x: areaRight - margin, y: startY };
      } else if (wantsToMoveLeft) {
        return { x: areaX + margin, y: startY };
      }
      // X軸方向への意図がない場合は移動しない
      return { x: startX, y: startY };
    }

    // 通常の交点計算（端に近くない、または内側方向へのクリック）
    let minT = Infinity;

    // 右境界との交点
    if (dx > 0) {
      const t = (areaRight - margin - startX) / dx;
      if (t > 0 && t < minT) {
        const intersectY = startY + dy * t;
        if (intersectY >= areaY + margin && intersectY <= areaBottom - margin) {
          minT = t;
        }
      }
    }

    // 左境界との交点
    if (dx < 0) {
      const t = (areaX + margin - startX) / dx;
      if (t > 0 && t < minT) {
        const intersectY = startY + dy * t;
        if (intersectY >= areaY + margin && intersectY <= areaBottom - margin) {
          minT = t;
        }
      }
    }

    // 下境界との交点
    if (dy > 0) {
      const t = (areaBottom - margin - startY) / dy;
      if (t > 0 && t < minT) {
        const intersectX = startX + dx * t;
        if (intersectX >= areaX + margin && intersectX <= areaRight - margin) {
          minT = t;
        }
      }
    }

    // 上境界との交点
    if (dy < 0) {
      const t = (areaY + margin - startY) / dy;
      if (t > 0 && t < minT) {
        const intersectX = startX + dx * t;
        if (intersectX >= areaX + margin && intersectX <= areaRight - margin) {
          minT = t;
        }
      }
    }

    // 交点が見つかった場合
    if (minT !== Infinity) {
      const targetX = startX + dx * minT;
      const targetY = startY + dy * minT;

      // 移動距離を計算
      const moveDistance = Math.sqrt(
        Math.pow(targetX - startX, 2) + Math.pow(targetY - startY, 2)
      );

      // 移動距離が短すぎる場合（端に近い状態で斜めクリック）
      // 軸単独移動にフォールバック
      const MIN_MOVE_DISTANCE = 50;
      if (moveDistance < MIN_MOVE_DISTANCE) {
        // より移動意図が強い軸を優先
        const absX = Math.abs(dx);
        const absY = Math.abs(dy);

        if (absY > absX) {
          // Y軸移動を優先
          if (wantsToMoveDown) {
            return { x: startX, y: areaBottom - margin };
          } else if (wantsToMoveUp) {
            return { x: startX, y: areaY + margin };
          }
        } else {
          // X軸移動を優先
          if (wantsToMoveRight) {
            return { x: areaRight - margin, y: startY };
          } else if (wantsToMoveLeft) {
            return { x: areaX + margin, y: startY };
          }
        }
      }

      return { x: targetX, y: targetY };
    }

    // 交点が見つからない場合は現在位置を返す
    return { x: startX, y: startY };
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

    // 新しいマーカーを作成（プレイヤー弾と同じ黄色）
    this.moveMarker = this.scene.add.graphics();
    this.moveMarker.lineStyle(2, COLORS.BULLET_PLAYER, 1);
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

    // 通常の左クリック：クリックした位置の敵をターゲット設定
    const clickedEnemy = this.getEnemyAtPosition(x, y);
    if (clickedEnemy) {
      // ターゲットを設定（Player側で射程判定と攻撃/接近を行う）
      this.player.setAttackTarget(clickedEnemy);
    }
  }

  /**
   * 指定位置の攻撃対象を取得（敵、道中雑魚、ボス全てを含む）
   */
  private getEnemyAtPosition(x: number, y: number): Attackable | null {
    const clickRadius = 40; // クリック判定の半径

    // 道中雑魚をチェック
    const mobs = this.player.getMobs();
    for (const mob of mobs) {
      if (!mob.getIsActive()) {
        continue;
      }

      const distance = Phaser.Math.Distance.Between(x, y, mob.x, mob.y);
      if (distance <= clickRadius) {
        return mob;
      }
    }

    // 通常の敵をチェック
    for (const enemy of this.enemies) {
      if (!enemy.getIsActive()) {
        continue;
      }

      const distance = Phaser.Math.Distance.Between(x, y, enemy.x, enemy.y);
      if (distance <= clickRadius) {
        return enemy;
      }
    }

    // ボスもチェック（ボスは大きいのでクリック判定を広めに）
    if (this.boss && this.boss.getIsActive()) {
      const bossClickRadius = this.boss.getHitboxRadius() * 1.6 + 20; // スケール考慮 + 余裕
      const distance = Phaser.Math.Distance.Between(x, y, this.boss.x, this.boss.y);
      if (distance <= bossClickRadius) {
        return this.boss;
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
    // 現在のマウスカーソル位置を取得
    const pointer = this.scene.input.activePointer;
    let x = pointer.x;
    let y = pointer.y;

    // プレイエリア外の場合は、プレイエリア内にクランプ
    if (!this.playAreaBounds.contains(x, y)) {
      x = Phaser.Math.Clamp(x, this.playAreaBounds.x, this.playAreaBounds.x + this.playAreaBounds.width);
      y = Phaser.Math.Clamp(y, this.playAreaBounds.y, this.playAreaBounds.y + this.playAreaBounds.height);
    }

    // Attack Move実行
    this.executeAttackMove(x, y);
  }

  /**
   * Attack Move実行
   * カーソル位置の最寄りの敵をターゲットに設定し、その方向に移動
   * ターゲットが射程内に入り次第攻撃する
   */
  private executeAttackMove(x: number, y: number): void {
    // プレイエリア内かチェック
    if (!this.playAreaBounds.contains(x, y)) {
      return;
    }

    // カーソル位置の最寄りの敵をターゲットとして設定
    const nearestEnemy = this.player.findNearestEnemyToPosition(x, y);
    if (nearestEnemy) {
      this.player.setAttackTarget(nearestEnemy);
    }

    // 指定位置に向けてAttack Moveを開始
    // ターゲットがいれば移動中に射程に入り次第攻撃する
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

    // 攻撃範囲の円を作成（プレイヤー弾と同じ黄色）
    this.attackRangeCircle = this.scene.add.graphics();
    this.attackRangeCircle.lineStyle(2, COLORS.BULLET_PLAYER, 0.5);
    this.attackRangeCircle.fillStyle(COLORS.BULLET_PLAYER, 0.1);
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
    const currentTime = this.scene.time.now;

    switch (key) {
      case 'Q':
        this.handleQSkill(currentTime);
        break;
      case 'W':
        this.handleWSkill(currentTime);
        break;
      case 'E':
        this.handleESkill(currentTime);
        break;
      case 'R':
        this.handleRSkill(currentTime);
        break;
      case 'D':
      case 'F':
        // TODO: 他のスキルを実装
        console.log(`Skill ${key} not implemented yet`);
        break;
    }
  }

  /**
   * Wスキル処理
   * 方向指定スキル：マウスカーソルの方向に正方形弾を発射（スタン付与）
   */
  private handleWSkill(currentTime: number): void {
    // スキル使用可能か確認
    if (!this.player.canUseSkill(SkillSlot.W, currentTime)) {
      const remaining = this.player.getSkillCooldownRemaining(SkillSlot.W, currentTime);
      if (remaining > 0) {
        console.log(`W skill on cooldown: ${(remaining / 1000).toFixed(1)}s`);
      }
      return;
    }

    // スキル実行中は使用不可
    if (this.player.isSkillLocked()) {
      return;
    }

    // モーション硬直中は使用不可
    if (this.player.isWSkillInMotion()) {
      return;
    }

    // 現在のマウスカーソル位置を取得
    const pointer = this.scene.input.activePointer;
    const cursorX = pointer.x;
    const cursorY = pointer.y;

    // スキル発動
    const success = this.player.useWSkill(currentTime, cursorX, cursorY);
    if (success) {
      console.log('W skill activated!');
    }
  }

  /**
   * Eスキル処理
   * 方向指定スキル：マウスカーソルの方向に3mダッシュ
   */
  private handleESkill(currentTime: number): void {
    // スキル使用可能か確認
    if (!this.player.canUseSkill(SkillSlot.E, currentTime)) {
      const remaining = this.player.getSkillCooldownRemaining(SkillSlot.E, currentTime);
      if (remaining > 0) {
        console.log(`E skill on cooldown: ${(remaining / 1000).toFixed(1)}s`);
      }
      return;
    }

    // スキル実行中は使用不可
    if (this.player.isSkillLocked()) {
      return;
    }

    // 現在のマウスカーソル位置を取得
    const pointer = this.scene.input.activePointer;
    const cursorX = pointer.x;
    const cursorY = pointer.y;

    // スキル発動
    const success = this.player.useESkill(currentTime, cursorX, cursorY);
    if (success) {
      console.log('E skill activated!');
    }
  }

  /**
   * Rスキル処理
   * 自身中心スキル：即時発動、範囲内弾消し＋無敵＋継続ダメージ
   */
  private handleRSkill(currentTime: number): void {
    // スキル使用可能か確認
    if (!this.player.canUseSkill(SkillSlot.R, currentTime)) {
      const remaining = this.player.getSkillCooldownRemaining(SkillSlot.R, currentTime);
      if (remaining > 0) {
        console.log(`R skill on cooldown: ${(remaining / 1000).toFixed(1)}s`);
      }
      return;
    }

    // スキル発動
    const success = this.player.useRSkill(currentTime);
    if (success) {
      console.log('R skill activated!');
    }
  }

  /**
   * Qスキル処理
   * 方向指定スキル：カーソル方向に妖怪バスターを発射
   */
  private handleQSkill(currentTime: number): void {
    // スキル使用可能か確認
    if (!this.player.canUseSkill(SkillSlot.Q, currentTime)) {
      const remaining = this.player.getSkillCooldownRemaining(SkillSlot.Q, currentTime);
      if (remaining > 0) {
        console.log(`Q skill on cooldown: ${(remaining / 1000).toFixed(1)}s`);
      }
      return;
    }

    // 現在のマウスカーソル位置を取得
    const pointer = this.scene.input.activePointer;
    const cursorX = pointer.x;
    const cursorY = pointer.y;

    // スキル発動（カーソル方向に発射）
    const success = this.player.useQSkill(currentTime, cursorX, cursorY);
    if (success) {
      console.log('Q skill activated!');
    }
  }

  /**
   * 敵リストを設定
   */
  setEnemies(enemies: Enemy[]): void {
    this.enemies = enemies;
  }

  /**
   * ボスを設定
   */
  setBoss(boss: Attackable | null): void {
    this.boss = boss;
  }

  /**
   * 更新処理
   */
  update(_time: number, _delta: number): void {
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
