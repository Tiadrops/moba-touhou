# トラブルシューティング記録

このドキュメントは開発中に遭遇した問題とその解決策を記録しています。

---

## 2024年 - ルーミアEスキル移動時のスプライト方向バグ

### 問題の症状

ルーミアのEスキル（通常弾幕3）で移動する際、**稀に**左を向いたまま右方向に移動することがあった。
- 「左を向いたまま右に移動」のパターンのみ発生
- 「右を向いたまま左に移動」は発生しなかった
- 再現率が低く、原因特定に時間がかかった

### 原因

**角度の範囲の不一致**が原因だった。

1. `calculateSafeESkillDirection()`が`Math.random() * Math.PI * 2`で**0〜360度（0〜2π）**の角度を生成
2. FlipXの判定は`angleDeg > 90 || angleDeg < -90`で**-180〜180度**を前提としていた
3. 例：332度は右下方向（-28度と同等）だが、`332 > 90`でtrue判定 → FlipX=true（間違い）

```typescript
// 問題のあったコード
const angleDeg = Phaser.Math.RadToDeg(this.eSkillMoveDirection);
const shouldFlipX = angleDeg > 90 || angleDeg < -90;
// 332度 → 332 > 90 → true → 左向き（間違い！本当は右向きであるべき）
```

### 解決策

全ての角度判定箇所で、180度を超える角度を-180〜180度の範囲に正規化する処理を追加。

```typescript
// 修正後のコード
let angleDeg = Phaser.Math.RadToDeg(this.eSkillMoveDirection);
// 0〜360度を-180〜180度に正規化
if (angleDeg > 180) angleDeg -= 360;
const shouldFlipX = angleDeg > 90 || angleDeg < -90;
// 332度 → -28度 → -28 > 90 も -28 < -90 もfalse → 右向き（正しい！）
```

### 修正箇所

1. `updateMoveDirectionByAngle()` - 通常移動時のスプライト方向
2. `updateAnimation()`内のEスキル移動判定 - 毎フレームの方向チェック
3. `before_move` → `moving`遷移時 - 移動開始時のスプライト方向設定

### 教訓

- `Math.random() * Math.PI * 2`は0〜2π（0〜360度）を返す
- `Math.atan2()`は-π〜π（-180〜180度）を返す
- 角度を扱う際は、生成元と判定ロジックの範囲が一致しているか確認する
- 「稀に発生」「特定の方向のみ」といったパターンがある場合、境界値や範囲の問題を疑う

### デバッグのポイント

1. ログに角度とFlipXの値を出力して、期待値との差異を確認
2. 問題が「片方向のみ」発生する場合、条件判定の非対称性を疑う
3. ランダム値が関係する場合、その値の範囲を確認する

---

## 2024年 - プレイエリア外で生成された弾が表示されない問題

### 問題の症状

ルーミアのQスキルとEスキルで、プレイエリア外で生成された弾幕がプレイエリア内に入っても表示されなかった。
- Qスキル：予告線から発射される弾幕の一部が消失
- Eスキル：移動弾幕の端の弾が消失

### 原因

**`fire()`内でのプレイエリア判定と、その後の`setPosition()`呼び出しによるフラグの不整合**が原因だった。

1. `Bullet.fire()`が呼ばれる
2. `fire()`内で引数の座標(x, y)を使ってプレイエリア判定を行い、`hasEnteredPlayArea`フラグを設定
3. Rumia側で`bullet.setPosition(newX, newY)`を呼んで弾の位置を調整（縦列を作るため）
4. 手順2のフラグは元の座標で設定されているため、実際の位置と不整合が発生
5. 弾がプレイエリア外にある場合、`hasEnteredPlayArea=false`かつ`visible=false`のまま
6. `update()`でプレイエリアに入っても正しく表示されない

```typescript
// Rumia.ts - fireQSkillBullets()
bullet.fire(startX, startY, ...);  // fire()内でhasEnteredPlayAreaが設定される
// ...
bullet.setPosition(                 // 位置が変更されるが、フラグは更新されない
  startX - dirX * delayOffset,
  startY - dirY * delayOffset
);
```

### 解決策

1. `Bullet.setPosition()`をオーバーライドして、位置変更時に`hasEnteredPlayArea`フラグと表示状態を自動更新
2. `fire()`内のプレイエリア判定コードを削除し、すべて`setPosition`オーバーライドに統一

```typescript
// Bullet.ts - setPositionオーバーライド
setPosition(x?: number, y?: number, z?: number, w?: number): this {
  super.setPosition(x, y, z, w);

  if (this.isActive && x !== undefined && y !== undefined) {
    const isInsidePlayArea = /* プレイエリア判定 */;

    if (isInsidePlayArea) {
      this.hasEnteredPlayArea = true;
      this.setVisible(true);
    } else if (!this.hasEnteredPlayArea) {
      this.setVisible(false);
    }
  }
  return this;
}
```

### 修正箇所

1. `src/entities/Bullet.ts`
   - `setPosition()`メソッドをオーバーライドして追加
   - `fire()`内のプレイエリア判定コード（119-128行目相当）を削除

### 教訓

- Phaserで`fire()`後に`setPosition()`を呼ぶパターンがある場合、状態フラグとの整合性に注意
- 弾幕ゲームでは弾の生成位置と初期表示位置が異なるケースがある
- 状態管理は一箇所に集約する（`fire()`と`setPosition`で二重に判定しない）
- プールから再利用するオブジェクトは、初期化時にフラグをリセットすることを忘れない

---

## 2024年 - Eスキルの弾幕が欠ける・早期に消失する問題

### 問題の症状

ルーミアのEスキル（移動弾幕）で、以下の問題が発生した：
1. 弾が18発中一部しか表示されない（列が欠ける）
2. ルーミアが画面端にいると特に発生しやすい
3. Qスキルでも同様に弾が早期に消失することがあった

### 原因

複数の原因が絡み合っていた：

**原因1: プレイエリア境界でのスキップ処理**
- Eスキルは弾をプレイエリア境界の外側にも配置することがある（幅550pxの弾列）
- プレイエリア外の弾は`spawnESkillBullets()`内でスキップされ、発射されなかった

```typescript
// 問題のあったコード
if (spawnPos.x < areaX + margin || spawnPos.x > areaX + areaW - margin ||
    spawnPos.y < areaY + margin || spawnPos.y > areaY + areaH - margin) {
  skippedCount++;
  continue;  // 発射されない
}
```

**原因2: 弾の早期消失判定**
- 弾がプレイエリアに入った後、すぐに出ると消される（`hasEnteredPlayArea && !isInsidePlayArea`）
- 画面端で発射された弾は、プレイエリアの境界をわずかに出入りして即座に消されていた

**原因3: 非表示状態の維持**
- プレイエリア外の弾は`setVisible(false)`になるが、保護中（300px未満の移動）でも非表示のままだった
- 弾は存在するが見えない状態だった

### 解決策

**解決策1: スキップ処理の削除**
- プレイエリア外の弾もスキップせずに発射する
- 弾はプレイエリア外では非表示だが、プレイエリアに入ると表示される

```typescript
// 修正後：スキップ処理を削除
// プレイエリア外の弾も発射する（非表示だが、プレイエリアに入ると表示される）
const bullet = this.bulletPool.acquire();
```

**解決策2: 距離ベースの保護**
- 時間ベース（500ms）ではなく、距離ベース（300px）で弾を保護
- 弾が発射位置から300px移動するまでは、プレイエリア外に出ても消さない

```typescript
const MIN_TRAVEL_DISTANCE = 300;
const distanceFromStart = Phaser.Math.Distance.Between(this.startX, this.startY, this.x, this.y);
const isProtected = distanceFromStart <= MIN_TRAVEL_DISTANCE;

if (this.hasEnteredPlayArea && !isInsidePlayArea && !isProtected) {
  this.deactivate();
}
```

**解決策3: 表示制御はプレイエリア内のみ**
- プレイエリア外の弾は常に非表示（`setVisible(false)`）
- プレイエリア内の弾は常に表示（`setVisible(true)`）
- 保護状態でも表示制御は同じ（プレイエリア外なら非表示）

### 修正箇所

1. `src/entities/Bullet.ts`
   - `update()`内の消失判定を距離ベースに変更
   - 表示制御をシンプル化（プレイエリア内外のみで判定）

2. `src/entities/bosses/Rumia.ts`
   - `spawnESkillBullets()`のプレイエリア外スキップ処理を削除

### 教訓

- 弾幕ゲームでは、弾がプレイエリア境界を出入りするケースが多い
- 「弾が消えた」と「弾が非表示」は別問題として切り分ける
- 時間ベースの保護は弾速によって効果が変わるため、距離ベースの方が安定
- デバッグログは問題解決まで消さない

---

## 2024年 - Rスキル中のスプライト変更が反映されない問題

### 問題の症状

ルーミアのRスキル（ダークサイドオブザムーン）で、無敵時間中に黒球スプライト（rumia_koma5.png）に変更しても、スプライトが変わらずサイズだけが小さくなった。

### 原因

**`updateAnimation()`が毎フレーム呼ばれてアニメーションを上書きしていた**のが原因。

1. `initializeRSkillExecution()`で`setTexture('coma_rumia_rskill')`を呼び出してスプライトを変更
2. 同フレーム内で`update()` → `updateAnimation()`が呼ばれる
3. `updateAnimation()`内の条件分岐で`play('rumia_idle')`や`play('rumia_move')`が呼ばれてテクスチャが上書きされる
4. 結果としてスプライトは元に戻り、スケール変更のみが残る

```typescript
// 問題のあったコード（updateAnimation内）
// Rスキル実行中のチェックがなかった
} else if (!isCasting && !isESkillMoving && !isMoving && this.currentAnimState !== 'idle') {
  this.play('rumia_idle');  // ここでテクスチャが上書きされる
  this.currentAnimState = 'idle';
}
```

### 解決策

`updateAnimation()`の先頭でRスキルが実行中かどうかをチェックし、実行中は早期リターンする。

```typescript
private updateAnimation(): void {
  const rSkill = this.skills.get(BossSkillSlot.R);

  // Rスキル実行中は黒球スプライトを維持するため、アニメーション更新をスキップ
  if (rSkill?.state === BossSkillState.EXECUTING) {
    return;
  }

  // 以降の通常アニメーション処理...
}
```

### 修正箇所

1. `src/entities/bosses/Rumia.ts`
   - `updateAnimation()`メソッドの先頭にRスキル実行中チェックを追加

### 教訓

- Phaserでスプライトを変更する場合、毎フレーム呼ばれるアニメーション更新処理に注意
- `setTexture()`は一瞬で上書きされる可能性がある
- 特殊状態中はアニメーション更新をスキップするガード条件を入れる
- デバッグ時は`console.log(this.texture.key)`で実際のテクスチャを確認する

---

## テンプレート

### 問題の症状

（症状を記述）

### 原因

（原因を記述）

### 解決策

（解決策を記述）

### 修正箇所

（修正したファイル・行を記述）

### 教訓

（今後のために学んだことを記述）
