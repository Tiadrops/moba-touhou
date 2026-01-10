# アニメーション一覧

このドキュメントはゲーム内で使用されているスプライトシートとアニメーションの一覧です。

## プレイヤーキャラクター

### 霊夢

| アニメーションキー | スプライトシート | ファイル | 画像サイズ | フレームサイズ | フレーム数 | FPS |
|------------------|-----------------|----------|-----------|---------------|-----------|-----|
| `reimu_idle` | `coma_reimu_idle` | `img/reimu/reimu_coma1.png` | 2816x1504px | 1408x752px | 4 | 6 |
| `reimu_move` | `coma_reimu_move` | `img/reimu/reimu_coma2.png` | 2816x1504px | 1408x752px | 4 | 8 |

**備考:**
- 2x2グリッド配置
- フレーム順序: 0→1→2→3

## ボスキャラクター

### ルーミア

| アニメーションキー | スプライトシート | ファイル | 画像サイズ | フレームサイズ | フレーム数 | FPS |
|------------------|-----------------|----------|-----------|---------------|-----------|-----|
| `rumia_idle` | `coma_rumia_idle` | `img/Rumia/rumia_koma2.png` | 2816x800px | 704x800px | 4 | 1.5 |
| `rumia_cast` | `coma_rumia_cast` | `img/Rumia/rumia_koma1.png` | 2816x800px | 704x800px | 4 | 1.5 |
| `rumia_move` | `coma_rumia_move` | `img/Rumia/rumia_koma3.png` | 1408x800px | 704x800px | 2 | 4 |
| `rumia_move_cast` | `coma_rumia_move_cast` | `img/Rumia/rumia_koma4.png` | 1408x800px | 704x800px | 2 | 4 |
| (静止画) | `coma_rumia_rskill` | `img/Rumia/rumia_koma5.png` | 約390x390px | - | 1 | - |

**備考:**
- 待機・詠唱のフレーム順序: 1→3→2→4 (0-indexed: 0→2→1→3)
- `rumia_koma5.png`はRスキル無敵時の黒球画像（単一画像）
- スケール: 55px / 390px ≈ 0.14（1m x 1mサイズ）

## 雑魚敵キャラクター

### GROUP_A (moe-kedama)

**素材提供:** 7B(点睛集積)

| アニメーションキー | スプライトシート | ファイル | 画像サイズ | フレームサイズ | 使用行 | フレーム | FPS | 回転 |
|------------------|-----------------|----------|-----------|---------------|--------|---------|-----|------|
| `fairy_a1_idle` | `fairy_a1` | `img/fairy/moe-kedama.png` | 128x128px | 32x32px | 1行目 | 0-3 | 6 | 2rad/s |
| `fairy_a2_idle` | `fairy_a1` | `img/fairy/moe-kedama.png` | 128x128px | 32x32px | 2行目 | 4-7 | 6 | 2rad/s |
| `fairy_a3_idle` | `fairy_a1` | `img/fairy/moe-kedama.png` | 128x128px | 32x32px | 3行目 | 8-11 | 6 | 2rad/s |

**パターン割り当て:**
| パターン | アニメーション | 弾幕タイプ |
|---------|--------------|-----------|
| A-1 | `fairy_a1_idle` | 5way弾幕 |
| A-2 | `fairy_a2_idle` | 11way×2列弾幕 |
| A-3 | `fairy_a3_idle` | 自機狙い1発 |
| A-4 | `fairy_a1_idle` | 12way円弾 |
| A-5 | `fairy_a2_idle` | 5way加速弾 |
| A-6 | `fairy_a3_idle` | 3way重力弾 |

**備考:**
- 4x4グリッド配置（4行目は未使用）
- 全パターンで回転アニメーション付き（2rad/s）
- 表示スケール: 1.1（約35px表示）

### GROUP_B

| アニメーションキー | スプライトシート | ファイル | 画像サイズ | フレームサイズ | フレーム数 | FPS |
|------------------|-----------------|----------|-----------|---------------|-----------|-----|
| `fairy_b1_idle` | `fairy_b1` | `img/fairy/zakoC1.png` | 1700x1100px | 850x1100px | 2 | 2 |
| `fairy_b2_idle` | `fairy_b2` | `img/fairy/zakoC2.png` | 1700x1100px | 850x1100px | 2 | 2 |
| `fairy_b3_idle` | `fairy_b3` | `img/fairy/zakoC3.png` | 1700x1100px | 850x1100px | 2 | 2 |
| `fairy_b4_idle` | `fairy_b4` | `img/fairy/zakoC4.png` | 850x550px | 425x550px | 2 | 2 |

**パターン割り当て:**
| パターン | アニメーション | スキル |
|---------|--------------|-------|
| B-1 | `fairy_b1_idle` | オーブ弾 |
| B-2 | `fairy_b2_idle` | レーザー |
| B-3 | `fairy_b3_idle` | ラプチャー/スクリーム |
| B-4 | `fairy_b4_idle` | 固定射撃/ムービング/恐怖弾 |

**備考:**
- 横2フレーム配置
- 回転なし
- B-4のみ画像サイズが半分
- 表示スケール: 0.082 × scale
  - B-1〜B-3: 0.082 × 0.8 = 0.066（約56px表示）
  - B-4: 0.082 × 1.6 = 0.131（約56px表示、画像が半分なので1.6倍で同等サイズ）

### GROUP_C (フラグ持ち)

| アニメーションキー | スプライトシート | ファイル | 画像サイズ | フレームサイズ | フレーム数 | FPS |
|------------------|-----------------|----------|-----------|---------------|-----------|-----|
| `fairy_c_idle` | `fairy_c` | `img/fairy/zakoB1.png` | 3168x1344px | 1584x1344px | 2 | 2 |
| `fairy_c2_idle` | `fairy_c2` | `img/fairy/zakoB2.png` | 3168x1344px | 1584x1344px | 2 | 2 |

**パターン割り当て:**
| パターン | アニメーション | スキル |
|---------|--------------|-------|
| C-1 (Kaiser型) | `fairy_c_idle` | オブリテレイト/デスグラスプ |
| C-2 (Hisui型) | `fairy_c2_idle` | W2/E/R |

**備考:**
- 横2フレーム配置
- 撃破でWaveクリア
- 表示スケール: 0.048（約76px表示）

## スプライトシート一覧

### プレイヤー・ボス

| キー | ファイルパス | サイズ | グリッド | 用途 |
|-----|-------------|--------|---------|------|
| `coma_reimu_idle` | `img/reimu/reimu_coma1.png` | 2816x1504px | 2x2 | 霊夢待機 |
| `coma_reimu_move` | `img/reimu/reimu_coma2.png` | 2816x1504px | 2x2 | 霊夢移動 |
| `coma_rumia_cast` | `img/Rumia/rumia_koma1.png` | 2816x800px | 4x1 | ルーミア詠唱 |
| `coma_rumia_idle` | `img/Rumia/rumia_koma2.png` | 2816x800px | 4x1 | ルーミア待機 |
| `coma_rumia_move` | `img/Rumia/rumia_koma3.png` | 1408x800px | 2x1 | ルーミア移動 |
| `coma_rumia_move_cast` | `img/Rumia/rumia_koma4.png` | 1408x800px | 2x1 | ルーミア移動詠唱 |
| `coma_rumia_rskill` | `img/Rumia/rumia_koma5.png` | 約390x390px | 1x1 | ルーミアRスキル |

### 雑魚敵

| キー | ファイルパス | サイズ | グリッド | 用途 |
|-----|-------------|--------|---------|------|
| `fairy_a1` | `img/fairy/moe-kedama.png` | 128x128px | 4x4 | GROUP_A全パターン |
| `fairy_b1` | `img/fairy/zakoC1.png` | 1700x1100px | 2x1 | B-1 |
| `fairy_b2` | `img/fairy/zakoC2.png` | 1700x1100px | 2x1 | B-2 |
| `fairy_b3` | `img/fairy/zakoC3.png` | 1700x1100px | 2x1 | B-3 |
| `fairy_b4` | `img/fairy/zakoC4.png` | 850x550px | 2x1 | B-4 |
| `fairy_c` | `img/fairy/zakoB1.png` | 3168x1344px | 2x1 | C-1 |
| `fairy_c2` | `img/fairy/zakoB2.png` | 3168x1344px | 2x1 | C-2 |

## 実装ファイル

- スプライトシート読み込み: `src/scenes/BootScene.ts` (27-98行)
- アニメーション定義: `src/scenes/BootScene.ts` (298-421行)
- GROUP_Aパターン設定: `src/entities/mobs/MobGroupA.ts` (25-33行)
- GROUP_Bパターン設定: `src/entities/mobs/MobGroupB.ts`
- GROUP_Cパターン設定: `src/entities/mobs/MobGroupC.ts`

## 更新履歴

- 2026-01-10: GROUP_BをzakoC1〜C4スプライトシートに変更
- 2026-01-10: GROUP_Aをmoe-kedamaスプライトシートに統一、回転アニメーション追加
