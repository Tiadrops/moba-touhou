# 道中システム仕様書

## 概要

道中シーン（MidStageScene）は、ボス戦前の雑魚敵フェーズを管理するシーンです。
Wave方式で敵が出現し、各Waveのフラグ持ち（グループC）を撃破するとWaveクリアとなります。
最終Waveをクリアするとボス戦へ移行します。

## Wave管理システム

### Wave ID形式 (x-y-z)

| 要素 | 説明 | 例 |
|------|------|-----|
| x | ステージ番号 | 1 |
| y | 道中Wave番号 | 1, 2 |
| z | サブウェーブ番号（枝番） | 1〜6 |

例: `1-1-6` = ステージ1、Wave1、サブウェーブ6

### ステージ1のWave構成

| Wave | サブウェーブ数 | フラグ持ち | 最終Wave |
|------|--------------|-----------|---------|
| Wave 1-1 | 6 (1-1-1〜1-1-6) | 1-1-6にC出現 | No |
| Wave 1-2 | 1 (1-2-1) | 1-2-1にC出現 | Yes |

### Waveクリア条件

各Waveのフラグ持ち（グループC）を撃破するとWaveクリアとなります。

### Waveクリア報酬

| Wave | 報酬 |
|------|------|
| Wave 1-1 | HP 30% 回復、スコア +5000 |
| Wave 1-2 | 残機 +1、スコア +10000 |

### Waveクリア演出

1. フラグ持ち撃破
2. 残りの敵弾・雑魚敵を消去
3. クリア演出UI表示（5秒間）
   - 「Wave X-Y クリア!」
   - 報酬内容表示
   - 次Wave/ボス戦への案内
4. 次Waveまたはボス戦へ移行

## シーン遷移フロー

```
TitleScene → ModeSelectScene → ArcadeSetupScene → StageIntroScene
    ↓
MidStageScene（道中）
    ↓ Wave 1-1 クリア → 5秒インターバル
    ↓ Wave 1-2 クリア（最終Wave）
    ↓
GameScene（ボス戦）
    ↓
ResultScene / GameOverScene
```

## 単位変換

| 単位 | 値 |
|------|-----|
| 1メートル | 55ピクセル |
| UNIT.METER_TO_PIXEL | 55 |

## 雑魚敵グループ

### グループA（弱い雑魚）

| 項目 | 値 |
|------|-----|
| HP | 200 |
| DEF | 0 |
| ATK | 100 |
| 移動速度 | 80 px/s |
| ヒットボックス | 16 px |
| スコア | 100 |
| 生存時間 | 15秒 |
| フラグ持ち | No |
| 退場方式 | 画面端へ移動 |

#### 弾幕パターン

| パターン | 説明 | 弾タイプ | 速度 |
|----------|------|----------|------|
| A-1 | 5way弾幕（プレイヤー狙い、全体60度） | 輪弾RED (ID:9)、半径0.25m | 8m/s (440px/s) |
| A-2 | 11way×2列（プレイヤー狙い、全体120度） | 輪弾RED (ID:9)、半径0.25m | 4m/s (220px/s)、後列は×0.8 |
| A-3 | 自機狙い1発 | 中玉WHITE (ID:8)、半径0.15m | デフォルト |
| A-4 | 12way円弾（全方向均等配置） | 輪弾RED (ID:9)、半径0.25m | 8m/s |
| A-5 | 5way加速弾（プレイヤー狙い、全体60度） | 輪弾RED (ID:9)、半径0.25m | 6→24m/s（1秒で加速） |
| A-6 | 連射重力弾（自機狙い） | 輪弾RED (ID:9)、半径0.25m | 特殊軌道（後述） |

**A-4詳細:**
- 自分を中心に12方向（30度間隔）に均等発射
- 弾速: 8m/s

**A-5詳細:**
- A-1と同じ5way弾（全体60度の扇状）
- 弾速が徐々に加速: 6m/s → 24m/s（1秒でリニア加速）

**A-6詳細（連射型重力弾）:**
- デフォルト: 0.5秒間隔で3発発射（`setA6Params()`でWaveから設定可能）
- 各弾の軌道:
  1. プレイヤーと逆方向に8m/sで発射
  2. 1秒かけて減速（Quad.easeOut）
  3. 0.05秒停止
  4. 1秒かけてプレイヤー方向に24m/sまで加速（Quad.easeIn）
- 画面外でも消えない（`setPersistOutsidePlayArea`フラグ使用）

### グループB（中程度の雑魚）

| 項目 | 値 |
|------|-----|
| HP | 500 |
| DEF | 0 |
| ATK | 100 |
| 移動速度 | 60 px/s |
| ヒットボックス | 20 px |
| スコア | 300 |
| 生存時間 | 無制限（撃破まで残る） |
| フラグ持ち | No |
| 退場方式 | なし |
| 攻撃間隔 | 4秒 |

#### 弾幕パターン

| パターン | 説明 | 弾タイプ | 速度 |
|----------|------|----------|------|
| B-1 | オーブ弾（行って戻る） | 大玉CYAN (ID:21)、半径0.8m | 行き: 15m/s、帰り: 0.6m/s→26m/s (加速19m/s²) |
| B-2 | 予告線→レーザー（1秒詠唱） | 中玉YELLOW (ID:3)、半径1m | 20m/s、ダメージ2倍 |
| B-3 | ラプチャー/スクリーム（交互） | 輪弾MAGENTA (ID:16)、半径0.3m | - |
| B-4 | 固定射撃/ムービング/恐怖弾（ローテーション） | 輪弾CYAN (ID:13)、半径0.5m | 20m/s |

**B-1詳細:**
- 射程: 9m (495px)
- 行きフェーズ: 15m/s でプレイヤー方向に飛ぶ
- 帰りフェーズ: 射程到達後、発射位置に向かって加速（初速0.6m/s、加速度19m/s²、最大26m/s）

**B-2詳細:**
- レーザー長: 15m (825px)
- 詠唱時間: 1秒（赤い予告線を表示）
- 弾数: レーザー長 ÷ 弾半径 = 約15発が連なって発射

**B-3詳細（ラプチャーとスクリームを交互に使用）:**

*ラプチャー:*
- 予告: プレイヤーの現在位置に半径2.73m (150px) の円
- 予告時間: 0.6秒
- 効果: 円周上に16発の弾が中心から外側へ花開くように展開、0.25秒で最大半径に到達
- 閉じ: 0.25秒かけて中心に戻り消滅
- 合計サイクル: 開く0.25秒 + 閉じる0.25秒 = 0.5秒

*スクリーム:*
- 予告: 自分からプレイヤー方向に半径8.2m (451px)、扇形60度
- 予告時間: 0.5秒
- 効果: 予告終了時点で扇形内にプレイヤーがいればダメージ
- 視覚効果: ダメージ時に黄色いフラッシュエフェクト

**B-4詳細（固定射撃→ムービング→恐怖弾をローテーション）:**

*固定射撃:*
- 2.2秒間、0.22秒毎にプレイヤー方向へ弾を発射
- 弾速: 20m/s、弾半径: 0.5m
- 発射角度は攻撃開始時に固定（妖精が動いても角度は変わらない）

*ムービング:*
- ランダムな方向に4m移動
- 移動速度: 10m/s（約0.4秒で移動完了）
- 画面外に出ないよう制限

*恐怖弾:*
- 妖精を中心に半径4.5m (247.5px) の円形予告（紫色）
- 予告時間: 0.66秒
- 効果: 予告終了時点で円内にプレイヤーがいればダメージ
- 視覚効果: ダメージ時に紫色のフラッシュエフェクト

### グループC（フラグ持ち）

| 項目 | 値 |
|------|-----|
| HP | 1500 |
| DEF | 0 |
| ATK | 100 |
| 移動速度 | 40 px/s |
| ヒットボックス | 28 px |
| スコア | 1000 |
| 生存時間 | 無制限（撃破まで残る） |
| フラグ持ち | **Yes** |
| 退場方式 | なし |
| 表示スケール | 1.5倍 |

#### スキルA（4秒クールダウン）

- 予告範囲: 縦8.5m × 横2.2m（プレイヤー方向）
- 詠唱時間: 0.5秒
- 効果: ダメージ

#### スキルB（10秒クールダウン）

- 予告範囲: 縦9.5m × 横2.8m（プレイヤー方向）
- 詠唱時間: 0.5秒
- 効果: ダメージ + 3.5m引き寄せ（0.5秒かけて）
- 追加効果: ヒット時は即座にスキルAを追加使用

### グループC-2（Hisui型フラグ持ち）

| 項目 | 値 |
|------|-----|
| HP | 1500 |
| DEF | 0 |
| ATK | 100 |
| テクスチャ | fairy_c2 |
| パターン | C2 |

#### Skill W2（4秒クールダウン）

- 予告範囲: 前方矩形 7.2m × 1.2m
- 詠唱時間: 0.5秒
- 効果: ダメージ + 0.5秒スタン
- 追加効果: ヒット時はプレイヤー方向に接近（最小距離2mまで）

#### Skill E（8秒クールダウン）

- **Phase 0: 後退**（0.13秒）
  - プレイヤーと逆方向に2m後退
- **Phase 1: 待機1**（0.325秒）
  - その場で待機、前進予告線を表示（黄色矩形）
- **Phase 2: 前進**（0.25秒）
  - プレイヤー方向に6m前進
  - 前進中のみ半径1.2mの円形当たり判定
  - ヒット時ダメージ
- **Phase 3: 待機2**（0.25秒）
  - 硬直

#### Skill R（12秒クールダウン）

- **Phase 0: Cast1**（0.5秒）
  - 半円予告（半径5.0m、プレイヤー方向）
  - 予告終了時に半円内にプレイヤーがいればダメージ
- **Phase 1: Cast2**（0.625秒）
  - 前方矩形予告（5.5m × 2.0m）
  - 予告終了時に矩形内にプレイヤーがいればダメージ
- **Phase 2: Wait**（0.25秒）
  - 硬直

#### スキル優先度

1. Skill R（最優先、12秒毎）
2. Skill E（8秒毎）
3. Skill W2（4秒毎、デフォルト）

## 移動パターン

### 基本パターン

| パターン | 説明 |
|----------|------|
| `straight` | 下方向に直進、targetYで停止 |
| `wave` | 正弦波で左右に揺れながら下降 |
| `zigzag` | より激しいジグザグで下降 |
| `stay` | その場で停止 |
| `exit` | 最も近い画面端へ移動して退場 |

### 特殊パターン

| パターン | 説明 |
|----------|------|
| `pass_through` | 指定速度で画面を通過（生存時間無視） |
| `pass_through_curve` | 下降後、指定Y座標でカーブして横方向に退場 |
| `descend_shoot_ascend` | 下降→発射→上昇して退場 |
| `chase_player` | プレイヤーを追尾 |
| `random_walk` | ランダム方向に移動、一定間隔で方向転換 |
| `descend_then_chase` | 下降→目標Y到達後に追尾移動に切り替え |
| `descend_then_random_walk` | 下降→目標Y到達後にランダム移動に切り替え |

### カーブ移動パラメータ

- `curveAtY`: カーブ開始Y座標
- `exitVelocityX`: カーブ後の横方向速度（正=右、負=左）
- `curveDuration`: カーブにかかる時間（イージング適用）

### ランダム移動パラメータ

- `randomWalkSpeed`: 移動速度
- `randomWalkChangeInterval`: 方向変更間隔（デフォルト2000ms）
- `maxDistanceFromPlayer`: プレイヤーからの最大距離（550px）
- `minDistanceFromPlayer`: プレイヤーからの最小距離（100px）

## Wave構成（ステージ1）

### Wave 1-1

#### サブウェーブ 1-1-1（開始から1秒後）

- **構成**: A-1 × 10体（2列×5体）
- **出現位置**: 左上
- **移動**: 画面の1/3まで下降 → 右にカーブして退場
- **発射タイミング**: Wave制御（登場+1秒後に初回、以後5秒ごと）
- **パラメータ**:
  - 下降速度: 60px/s
  - カーブY: 画面の1/3
  - 退場速度: 150px/s（右方向）
  - カーブ時間: 1.5秒

#### サブウェーブ 1-1-2（開始から7秒後）

- **構成**: A-1 × 10体（2列×5体）
- **出現位置**: 右上
- **移動**: 画面の1/3まで下降 → 左にカーブして退場
- **発射タイミング**: Wave制御（登場+1秒後に初回、以後5秒ごと）
- **パラメータ**: サブウェーブ 1-1-1の左右反転

#### サブウェーブ 1-1-3（開始から20秒後）

- **構成**: A-2 × 2体、B-1 × 1体
- **フォーメーション**:
  ```
  ◯　◯   ← A-2
  　△     ← B-1
  ```
- **出現位置**: 画面左1/3の位置
- **移動**: 下降して画面上部1/3の位置で停止
- **発射タイミング**: A-2は8秒ごと、B-1は4秒ごと

#### サブウェーブ 1-1-4（1-1-3のB-1撃破後 or 開始から35秒後）

- **構成**: A-2 × 2体、B-2 × 1体
- **フォーメーション**:
  ```
  ◯　◯   ← A-2
  　△     ← B-2
  ```
- **出現位置**: 画面右2/3の位置
- **移動**: 下降して画面上部1/3の位置で停止
- **発射タイミング**: A-2は8秒ごと、B-2は4秒ごと
- **トリガー**: サブウェーブ 1-1-3のB-1撃破、または35秒経過

#### サブウェーブ 1-1-5（開始から45秒後）

- **構成**: A-1 + A-3 を1秒ごとにスポーン、計20回（40体）
- **出現位置**: ランダムなX座標（左右マージン60px）
- **移動**: `descend_shoot_ascend`パターン
  - 下降速度: 120px/s
  - 発射Y: 画面の1/4
  - 上昇速度: 150px/s
- **発射タイミング**: 目標Y到達時に自動発射

#### サブウェーブ 1-1-6（開始から70秒後）★フラグ持ち

- **構成**: B-1 × 1、B-2 × 1、C × 1
- **フォーメーション**:
  ```
  B1  B2
    C
  ```
- **出現位置**: 画面中央上部
- **移動**:
  - B1: 下降 → 追尾移動（1.5m/s）
  - B2: 下降 → ランダム移動（1.5m/s、1.5秒ごとに方向変更）
  - C: 下降 → 追尾移動（3m/s）
- **リスポーン**: B1/B2は撃破後5秒で再出現
- **クリア条件**: C（フラグ持ち）を撃破 → Wave 1-1 クリア

### Wave 1-2

#### サブウェーブ 1-2-1（開始から1秒後）★フラグ持ち

- **構成**: B-1 × 1、B-2 × 1、C × 1
- **フォーメーション**:
  ```
  B1  B2
    C
  ```
- **出現位置**: 画面中央上部
- **移動**:
  - B1: 下降 → 追尾移動（2m/s）
  - B2: 下降 → ランダム移動（2m/s、1.2秒ごとに方向変更）
  - C: 下降 → 追尾移動（3.5m/s）
- **リスポーン**: B1/B2は撃破後5秒で再出現
- **クリア条件**: C（フラグ持ち）を撃破 → Wave 1-2 クリア → ボス戦へ

## オブジェクトプール

### 初期プール数

| グループ | 初期数 |
|----------|--------|
| MobGroupA | 5 |
| MobGroupB | 3 |
| MobGroupC | 1 |

### プール管理関数

- `getOrCreateMobA()`: MobGroupAを取得または新規作成
- `getOrCreateMobB()`: MobGroupBを取得または新規作成
- `getOrCreateMobC()`: MobGroupCを取得または新規作成

## スポーン関数一覧

### MobEnemy（基底クラス）

| 関数 | 説明 |
|------|------|
| `spawn(x, y, targetY?, movePattern?)` | 基本スポーン |
| `spawnPassThrough(x, y, velX, velY, duration)` | 通過型スポーン |
| `spawnPassThroughCurve(x, y, velY, curveAtY, exitVelX, curveDur)` | カーブ付き通過型 |
| `spawnDescendShootAscend(x, y, targetY, descSpeed, ascSpeed, onShoot?)` | 下降→発射→上昇 |
| `spawnChasePlayer(x, y, speed)` | プレイヤー追尾 |
| `spawnRandomWalk(x, y, speed, changeInterval?)` | ランダム移動 |
| `spawnDescendThenChase(x, y, targetY, descSpeed, chaseSpeed)` | 下降→追尾 |
| `spawnDescendThenRandomWalk(x, y, targetY, descSpeed, walkSpeed, interval?)` | 下降→ランダム |

### MobGroupA

| 関数 | 説明 |
|------|------|
| `spawnWithPattern(x, y, pattern, targetY?, movePattern?)` | パターン指定スポーン |
| `spawnPassThroughCurveWithPattern(...)` | パターン指定カーブ通過 |
| `spawnDescendShootAscendWithPattern(...)` | パターン指定下降→発射→上昇 |
| `setAutoShoot(enabled)` | 自動発射の有効/無効 |
| `setA6Params(bulletCount, interval?)` | A-6連射パラメータ設定（弾数、間隔ms） |
| `shoot()` | 弾幕を発射（Wave制御用） |

### MobGroupB

| 関数 | 説明 |
|------|------|
| `spawnWithPattern(...)` | パターン指定スポーン |
| `spawnChasePlayerWithPattern(...)` | パターン指定追尾スポーン |
| `spawnRandomWalkWithPattern(...)` | パターン指定ランダム移動 |
| `spawnDescendThenChaseWithPattern(...)` | パターン指定下降→追尾 |
| `spawnDescendThenRandomWalkWithPattern(...)` | パターン指定下降→ランダム |
| `setAutoShoot(enabled)` | 自動発射の有効/無効 |
| `shoot()` | 弾幕を発射（Wave制御用） |

### MobGroupC

| 関数 | 説明 |
|------|------|
| `spawnWithPattern(x, y, pattern, targetY?, movePattern?)` | パターン指定スポーン（C1/C2） |
| `spawnChasePlayerMode(x, y, speed)` | 追尾スポーン |
| `spawnDescendThenChaseMode(...)` | 下降→追尾スポーン |
| `setAutoShoot(enabled)` | 自動発射の有効/無効 |

## イベント

### 発火するイベント

| イベント名 | 発火条件 | データ |
|------------|----------|--------|
| `flag-carrier-defeated` | フラグ持ち撃破時 | なし |
| `mob-skill-hit` | MobGroupCのスキル命中時 | `{ mob, damage, skillType, pull? }` |

### イベント処理

```typescript
// フラグ持ち撃破時
this.events.on('flag-carrier-defeated', () => {
  this.onFlagCarrierDefeated();  // Waveクリア処理
});

// 雑魚スキルヒット時
this.events.on('mob-skill-hit', (data) => {
  this.onMobSkillHit(data);  // ダメージ + 引き寄せ処理
});
```

## テクスチャ・アニメーション

| グループ | テクスチャキー | アニメーションキー | サイズ |
|----------|----------------|-------------------|--------|
| A-1 | fairy_a1 | fairy_a1_idle | 850x1100 |
| A-2 | fairy_a2 | fairy_a2_idle | 850x1100 |
| A-3 | fairy_a3 | fairy_a3_idle | 850x1100 |
| A-4 | fairy_a1 | fairy_a1_idle | 850x1100 |
| A-5 | fairy_a2 | fairy_a2_idle | 850x1100 |
| A-6 | fairy_a3 | fairy_a3_idle | 850x1100 |
| B-1 | fairy_b1 | fairy_b1_idle | 1584x1344 |
| B-2 | fairy_b2 | fairy_b2_idle | 1584x1344 |
| B-3 | fairy_b3 | fairy_b3_idle | 1488x1440 |
| B-4 | fairy_b4 | fairy_b4_idle | 1584x1344 |
| C-1 | fairy_c | fairy_c_idle | 1488x1440 |
| C-2 | fairy_c2 | fairy_c2_idle | 1488x1440 |

## 設定値（GameConfig）

### WAVE_CONFIG

```typescript
WAVE_CONFIG = {
  CLEAR_INTERVAL_MS: 5000,  // Waveクリア後インターバル（5秒）
  REWARDS: {
    WAVE_1_1: {
      HP_RECOVER_PERCENT: 30,  // HP30%回復
      SCORE_BONUS: 5000
    },
    WAVE_1_2: {
      EXTRA_LIFE: 1,           // 残機+1
      SCORE_BONUS: 10000
    }
  },
  STAGE_1: {
    WAVE_1: {
      SUB_WAVES: 6,
      FINAL_SUB_WAVE: 6,
      IS_FINAL_WAVE: false
    },
    WAVE_2: {
      SUB_WAVES: 1,
      FINAL_SUB_WAVE: 1,
      IS_FINAL_WAVE: true
    },
    TOTAL_WAVES: 2
  }
}
```

### MOB_GROUP_CONFIG

```typescript
MOB_GROUP_CONFIG = {
  GROUP_A: {
    HP: 200, DEF: 0, ATK: 100,
    MOVE_SPEED: 80, HITBOX_RADIUS: 16,
    SCORE_VALUE: 100, SURVIVAL_TIME: 15000,
    IS_FLAG_CARRIER: false, EXIT_MODE: 'move_to_edge'
  },
  GROUP_B: {
    HP: 500, DEF: 0, ATK: 100,
    MOVE_SPEED: 60, HITBOX_RADIUS: 20,
    SCORE_VALUE: 300, SURVIVAL_TIME: -1,
    IS_FLAG_CARRIER: false, EXIT_MODE: 'none'
  },
  GROUP_C: {
    HP: 1500, DEF: 0, ATK: 100,
    MOVE_SPEED: 40, HITBOX_RADIUS: 28,
    SCORE_VALUE: 1000, SURVIVAL_TIME: -1,
    IS_FLAG_CARRIER: true, EXIT_MODE: 'none'
  }
}
```

### MID_STAGE_CONFIG

```typescript
MID_STAGE_CONFIG = {
  STAGE_1: {
    FLAG_CARRIER_SPAWN_DELAY: 30000,  // 30秒（未使用）
    SPAWN_INTERVAL: {
      GROUP_A: 2000,  // 2秒（未使用）
      GROUP_B: 5000   // 5秒（未使用）
    },
    MAX_MOBS: 15,
    FADE_OUT_DURATION: 1000
  }
}
```

## 関連ファイル

| ファイル | 説明 |
|----------|------|
| [src/scenes/MidStageScene.ts](../src/scenes/MidStageScene.ts) | 道中シーン本体 |
| [src/entities/mobs/MobEnemy.ts](../src/entities/mobs/MobEnemy.ts) | 雑魚敵基底クラス |
| [src/entities/mobs/MobGroupA.ts](../src/entities/mobs/MobGroupA.ts) | グループA実装 |
| [src/entities/mobs/MobGroupB.ts](../src/entities/mobs/MobGroupB.ts) | グループB実装 |
| [src/entities/mobs/MobGroupC.ts](../src/entities/mobs/MobGroupC.ts) | グループC実装 |
| [src/config/GameConfig.ts](../src/config/GameConfig.ts) | 設定値定義 |
| [src/types/index.ts](../src/types/index.ts) | 型定義（WaveId, WaveState等） |
