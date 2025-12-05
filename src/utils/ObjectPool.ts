import Phaser from 'phaser';
import { Bullet } from '@/entities/Bullet';

/**
 * オブジェクトプール
 * 弾などの頻繁に生成・破棄されるオブジェクトを再利用してパフォーマンスを向上
 */
export class BulletPool {
  private scene: Phaser.Scene;
  private pool: Bullet[] = [];
  private maxSize: number;

  constructor(scene: Phaser.Scene, initialSize: number = 50, maxSize: number = 200) {
    this.scene = scene;
    this.maxSize = maxSize;

    // 初期プールを作成
    for (let i = 0; i < initialSize; i++) {
      const bullet = new Bullet(scene, 0, 0);
      bullet.deactivate();
      this.pool.push(bullet);
    }
  }

  /**
   * プールから弾を取得（または新規作成）
   */
  acquire(): Bullet | null {
    // 非アクティブな弾を探す
    for (const bullet of this.pool) {
      if (!bullet.getIsActive()) {
        return bullet;
      }
    }

    // プールに空きがない場合、新しく作成（最大サイズまで）
    if (this.pool.length < this.maxSize) {
      const bullet = new Bullet(this.scene, 0, 0);
      bullet.deactivate();
      this.pool.push(bullet);
      return bullet;
    }

    // 最大サイズに達している場合はnullを返す
    console.warn('BulletPool: Maximum pool size reached');
    return null;
  }

  /**
   * すべての弾を更新
   */
  update(): void {
    for (const bullet of this.pool) {
      if (bullet.getIsActive()) {
        bullet.update();
      }
    }
  }

  /**
   * すべてのアクティブな弾を取得
   */
  getActiveBullets(): Bullet[] {
    return this.pool.filter(bullet => bullet.getIsActive());
  }

  /**
   * プールの統計情報を取得
   */
  getStats(): { total: number; active: number; inactive: number } {
    const active = this.pool.filter(b => b.getIsActive()).length;
    return {
      total: this.pool.length,
      active,
      inactive: this.pool.length - active,
    };
  }

  /**
   * すべての弾を非アクティブ化
   */
  clear(): void {
    for (const bullet of this.pool) {
      bullet.deactivate();
    }
  }

  /**
   * プールを破棄
   */
  destroy(): void {
    for (const bullet of this.pool) {
      bullet.destroy();
    }
    this.pool = [];
  }
}
