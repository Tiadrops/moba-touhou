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

## 2024年 - 画面端での斜め移動が機能しない問題

### 問題の症状

プレイヤーがプレイエリアの端にいる状態で、プレイエリア外を斜め方向にクリックした場合：
- 一度端で停止してしまい、移動しない
- もう一度クリックすると移動できる
- 移動可能な軸（例：左端なら上下方向）にすぐ移動できない

### 原因

**交点計算のロジックが端付近で短い距離を返す**のが原因だった。

1. プレイエリア外クリック時、プレイヤー位置からクリック方向への直線とプレイエリア境界の交点を計算
2. プレイヤーが端に近い場合、斜め方向のクリックでは近い境界との交点が先に計算される
3. 結果として移動距離が非常に短くなり（数px）、実質的に移動しない

```typescript
// 例：左端にいて左下をクリックした場合
// 左境界との交点が計算され、移動距離はほぼ0になる
```

### 解決策

1. **端近接判定と方向判定の組み合わせ**
   - 各境界までの距離を計算（`distToLeft`, `distToRight`など）
   - `EDGE_THRESHOLD = 30`px以内で外側方向へのクリックを検出
   - X軸またはY軸がブロックされている場合、もう一方の軸のみで移動

2. **移動距離フォールバック**
   - 通常の交点計算後、移動距離が50px未満なら軸単独移動にフォールバック
   - より強い移動意図のある軸（`|dx|` vs `|dy|`）を優先

```typescript
// 修正後のロジック
const xAxisBlocked = nearLeftAndClickingLeft || nearRightAndClickingRight;
const yAxisBlocked = nearTopAndClickingUp || nearBottomAndClickingDown;

if (xAxisBlocked && yAxisBlocked) {
  return { x: startX, y: startY }; // 角にいる場合は移動しない
}

if (xAxisBlocked) {
  // Y軸のみ移動
  if (wantsToMoveDown) return { x: startX, y: areaBottom - margin };
  if (wantsToMoveUp) return { x: startX, y: areaY + margin };
}
```

### 修正箇所

1. `src/systems/InputManager.ts`
   - `calculatePlayAreaEdgePoint()`メソッドを大幅に書き換え
   - 境界距離計算、軸ブロック判定、フォールバックロジックを追加

### 教訓

- 画面端での操作は境界値問題が発生しやすい
- 交点計算だけでなく、移動距離が十分かどうかのチェックも必要
- ユーザーの「移動意図」を汲み取る代替ロジックを用意する
- 斜め移動は両軸の処理が必要なため、片軸のみのフォールバックを考慮する

---

## 2024年 - 右クリックでブラウザのコンテキストメニューが表示される問題

### 問題の症状

ゲーム内で右クリックした際に、Windowsのコンテキストメニュー（「戻る」などのメニュー）が表示されてしまう。

### 原因

Phaserの`disableContextMenu()`だけでは、一部のブラウザや環境で完全にコンテキストメニューを防げない。

### 解決策

HTML要素に直接`contextmenu`イベントリスナーを追加し、`preventDefault()`でイベントをキャンセル。

```typescript
// main.ts
const gameContainer = document.getElementById('game-container');
if (gameContainer) {
  gameContainer.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    return false;
  });
}
```

### 修正箇所

1. `src/main.ts`
   - ゲームコンテナへの`contextmenu`イベントリスナーを追加

### 教訓

- Phaserのビルトイン機能だけでなく、DOM APIも併用することで確実な制御が可能
- ゲームUIでブラウザのデフォルト動作を抑制する場合は複数の方法を組み合わせる

---

## 2024年 - 確認ダイアログで「はい」を選択しても動作しない問題

### 問題の症状

ポーズメニューの確認ダイアログで「はい」を選択してEnterを押しても、アクション（ステージやり直し、タイトルに戻る等）が実行されず、メインメニューに戻るだけだった。

### 原因

**`closeConfirmDialog()`内で`confirmAction`をnullにしてから、switchで判定していた**のが原因。

```typescript
// 問題のあったコード
if (this.confirmSelectedIndex === 0) {
  this.closeConfirmDialog();  // ここでthis.confirmAction = null
  switch (this.confirmAction) {  // nullと比較されるため、どのcaseにもマッチしない
    case ConfirmAction.RESTART_STAGE:
      this.restartStage();  // 実行されない
      break;
    // ...
  }
}
```

### 解決策

アクションをローカル変数に保存してから`closeConfirmDialog()`を呼び、保存した変数でswitchする。

```typescript
// 修正後のコード
if (this.confirmSelectedIndex === 0) {
  const action = this.confirmAction;  // 先にローカル変数に保存
  this.closeConfirmDialog();
  switch (action) {  // 保存した値で判定
    case ConfirmAction.RESTART_STAGE:
      this.restartStage();
      break;
    // ...
  }
}
```

### 修正箇所

1. `src/scenes/PauseScene.ts`
   - `executeConfirmAction()`メソッド内で、アクションをローカル変数に保存してからダイアログを閉じるように修正

### 教訓

- クロージャやコールバック内でオブジェクトのプロパティを参照する場合、参照タイミングに注意
- 「先に状態を変更してから参照」というパターンでは、参照時に値が変わっている可能性がある
- 特にUIの状態管理では、操作の順序が重要

---

## 2026年 - B-4がスキルを使用しない問題

### 問題の症状

Wave 1-2-5およびWave 1-2-6で出現するB-4敵がスキル（固定射撃、ムービング、恐怖弾）を一切使用しなかった。
- B-4は画面上に出現するが、完全に攻撃しない状態
- MobTestSceneでも同様の問題が発生

### 原因

**B-4生成時に`setAutoShoot(true)`が呼ばれていなかった**のが原因。

B-4は他のB系敵（B-1〜B-3）と異なり、AI駆動で動作する：
- B-1〜B-3: インターバル攻撃（`autoShootEnabled`に依存しない）
- B-4: `updateB4AI()`が毎フレーム呼ばれて自律判断（`autoShootEnabled=true`が必須）

```typescript
// 問題のあったコード（MobGroupB.ts）
// updateB4AIはautoShootEnabledがtrueの時のみ実行される
if (this.patternType === 'B4' && this.autoShootEnabled) {
  this.updateB4AI(time);
}

// しかし生成時にsetAutoShoot(true)が呼ばれていなかった
// spawnDescendThenRandomWalkWithPattern() 内でパターン設定のみ
```

デバッグログで`autoShootEnabled=false`を確認：
```
[B-4 updateShooting] autoShootEnabled=false, bulletPool=true, playerPosition=true
```

### 解決策

`spawnDescendThenRandomWalkWithPattern()`メソッド内で、B4パターンの場合は自動的に`setAutoShoot(true)`を呼び出すように修正。

```typescript
// 修正後のコード（MobGroupB.ts）
spawnDescendThenRandomWalkWithPattern(...) {
  // パターン設定...
  this.spawnDescendThenRandomWalk(...);
  this.resetAttackState();

  // B4はAI駆動なのでautoShootを有効にする
  if (pattern === 'B4') {
    this.setAutoShoot(true);
  }
}
```

### 修正箇所

1. `src/entities/mobs/MobGroupB.ts`
   - `spawnDescendThenRandomWalkWithPattern()`メソッド（300-303行）にB4用autoShoot有効化を追加

2. `src/scenes/debug/MobTestScene.ts`
   - B-4テスト時にautoShootを有効にするよう修正（313-315行）

### 教訓

- 同じクラス内でも、パターンによって動作方式が異なる場合がある（インターバル vs AI駆動）
- AI駆動の敵は必要なフラグ（`autoShootEnabled`）が有効になっているか確認
- デバッグログで状態フラグの値を出力することで、問題の原因を特定できる
- 新しいパターンを追加する際は、既存の生成処理が対応しているか確認する

---

## 2026年 - ボスシーン遷移時にリザルトSEが再生される問題

### 問題の症状

Wave 1-2クリア後、リザルト表示終了 → BGM停止 → ボス登場カットイン（MidStageScene）の間に、リザルト行表示SE（`lab_taiko1.mp3`, `lab_taiko2.mp3`）が意図せず再生されていた。

### 原因

**ボスシーン遷移開始後もMidStageSceneのupdate()が動作を続け、Wave処理が重複実行された**のが原因。

遷移の流れ：
1. Wave 1-2-6完了 → `transitionToBossScene()`呼び出し
2. ボス登場カットイン表示開始
3. **MidStageSceneのupdate()がまだ動作中**
4. update()内で敵撃破判定 → C-2撃破検出 → `showWaveClearUI()`再実行
5. 新たにリザルトUIが作成され、SE再生のdelayedCallが登録される
6. カットイン演出中にSEが再生される

デバッグログで確認された重複処理：
```
[transitionToBossScene] Called at 1736673456789, pendingTimers=0
[Wave 1-2-6] B-4出現!
[Wave 1-2-6] C-2撃破! Waveクリア
[showWaveClearUI] SE登録開始...
```

### 解決策

**`isTransitioningToBoss`フラグを追加し、遷移中のWave処理を防止**した。

1. `MidStageScene`クラスに`isTransitioningToBoss`フラグを追加
2. `transitionToBossScene()`の冒頭でフラグをチェックし、既に遷移中なら早期リターン
3. 遷移開始時にフラグをtrueに設定
4. `showWaveClearUI()`でもフラグをチェックし、遷移中なら処理をスキップ
5. シーン再初期化時（`init()`）にフラグをfalseにリセット

```typescript
// MidStageScene.ts

// フラグ追加
private isTransitioningToBoss: boolean = false;

// showWaveClearUIでの早期リターン
private showWaveClearUI(): void {
  if (this.isTransitioningToBoss) {
    return;
  }
  // ...
}

// transitionToBossSceneでの重複防止
private transitionToBossScene(): void {
  if (this.isTransitioningToBoss) {
    return;
  }
  this.isTransitioningToBoss = true;
  // ...
}
```

### 修正箇所

1. `src/scenes/MidStageScene.ts`
   - 149-150行: `isTransitioningToBoss`フラグ追加
   - 273行: `init()`でフラグをリセット
   - 1881-1884行: `showWaveClearUI()`に遷移中チェック追加
   - 2380-2384行: `transitionToBossScene()`に重複遷移防止を追加

### 教訓

- Phaserのシーン遷移は非同期であり、遷移開始後も元シーンのupdate()は動作を続ける
- delayedCallでスケジュールされたSE再生は、元のシーンが破棄されるまで実行される可能性がある
- シーン遷移時は「遷移中」フラグを設けて、後続の処理をブロックする
- 「条件を満たしたらXを実行」のパターンでは、一度実行したら再実行を防ぐガードが必要

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
