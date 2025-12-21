# Claude Code プロジェクトルール

このファイルはClaude Codeがセッションを跨いで守るべきプロジェクト固有のルールを定義しています。

## ファイル削除ポリシー

**重要: ファイルを削除する際は `rm` コマンドを使用しないでください。**

不要になったファイルは以下の手順で処理してください：

1. `trash/` ディレクトリまたは適切な一時ディレクトリを作成
2. 不要ファイルをそのディレクトリに移動（`mv` または `cp` コマンドを使用）
3. ユーザーに「以下のファイルを削除してください」と依頼

### 理由
- 誤削除を防ぐため
- ユーザーが削除前に確認できるようにするため
- 必要に応じてファイルを復元できるようにするため

### 例
```bash
# 良い例
mkdir -p trash
mv old_file.ts trash/

# 悪い例（使用しない）
rm old_file.ts
```

## プロジェクト構成

### 弾幕システム
- 弾幕素材: かずぎつね氏の素材を使用
- 弾定義: `src/entities/Bullet.ts` の `KSHOT` 定数
- テクスチャ読み込み: `src/scenes/BootScene.ts`
- テストシーン: `src/scenes/debug/BulletTestScene.ts`

### 現在実装済みの弾タイプ
1. **黒縁中玉 (MEDIUM_BALL)**: ID 1-8, 512x512px, 当たり判定440px
2. **輪弾 (RINDAN)**: ID 9-16, 278x278px, 当たり判定275px

### キャラクターコマ（アニメーション用スプライト）
- **霊夢**: `img/reimu/reimu_coma1.png`（待機）, `reimu_coma2.png`（移動）
  - サイズ: 2816x1504px (2x2グリッド、各1408x752px)
  - アニメーション: 6fps（待機）、8fps（移動）
- **ルーミア**:
  - `rumia_koma1.png`（詠唱）: 2816x800px, 横4フレーム, 1.5fps
  - `rumia_koma2.png`（待機）: 2816x800px, 横4フレーム, 1.5fps
  - `rumia_koma3.png`（移動）: 1408x800px, 横2フレーム, 4fps
  - `rumia_koma4.png`（移動詠唱）: 1408x800px, 横2フレーム, 4fps
  - `rumia_koma5.png`（Rスキル無敵用黒球）: 約390x390px, 単一画像
  - 待機・詠唱のフレーム順: 1→3→2→4
  - Rスキル中のスケール: 55px / 390px ≈ 0.14（1m x 1mサイズ）

### ステージ背景
- 背景画像: `img/background/stage1.png`
- 読み込み: `src/scenes/BootScene.ts`
- 表示・スクロール: `src/scenes/GameScene.ts`
- スクロール方式: パン方式（斜め移動、端で反転）
- 速度: X方向8px/秒、Y方向15px/秒
- 画像サイズに応じて自動スケール（プレイエリア+50%余白）

### スペルカードカットイン演出
- 実装V1: `src/ui/components/SpellCardCutIn.ts`
- 実装V2: `src/ui/components/SpellCardCutInV2.ts`（現在使用中）
- 呼び出し: `src/scenes/GameScene.ts` のフェーズ移行処理
- 立ち絵読み込み: `src/scenes/BootScene.ts`
- テスト: `src/scenes/debug/CutInTestScene.ts`
- フォント: `fonts/SawarabiMincho-Regular.ttf`（さわらび明朝）
- 詳細仕様: `docs/CUTIN_SYSTEM.md`

#### カットイン立ち絵
| キャラ | キー | ファイル | サイズ |
|-------|-----|---------|--------|
| ルーミア | `cutin_rumia` | `img/Rumia/rumia_3.png` | 1920x810px |

#### V2演出パラメータ（現在使用中）
- フレームスライド: 300ms
- テキスト流れ: 400ms
- 瞼開き: 400ms
- 表示時間: 1500ms
- 退場: 300ms
- 暗転濃さ: 60%
- 色テーマ: 闇紅（borderColor: 0xff3366, bgColor1: 0x220011, bgColor2: 0x110008）
- SE: `sound/se/spellcard.mp3`

#### V1演出パラメータ（レガシー）
- 暗転時間: 200ms
- 登場アニメーション: 400ms
- 表示時間: 1200ms
- 退場アニメーション: 300ms
- 立ち絵透明度: 75%
- 暗転濃さ: 85%

### 道中シーンシステム
- シーン: `src/scenes/MidStageScene.ts`
- 雑魚敵クラス: `src/entities/mobs/`
  - 基底クラス: `MobEnemy.ts`
  - グループA: `MobGroupA.ts`（A1: 5way弾、A2: 11way×2列、A3: 狙い弾）
  - グループB: `MobGroupB.ts`（B1: オーブ弾、B2: レーザー、B3: ラプチャー/スクリーム、B4: 固定射撃/ムービング/恐怖弾）
  - グループC: `MobGroupC.ts`（スキルA/B、フラグ持ち）
- 設定: `src/config/GameConfig.ts` の `MOB_GROUP_CONFIG`, `MID_STAGE_CONFIG`, `WAVE_CONFIG`
- 型定義: `src/types/index.ts` の `MobGroupType`, `MobStats`, `WaveId`, `WaveState`
- 詳細仕様: `docs/MID_STAGE_SYSTEM.md`

#### Wave管理システム（x-y-z形式）
| 要素 | 説明 | 例 |
|-----|------|-----|
| x | ステージ番号 | 1 |
| y | 道中Wave番号 | 1, 2 |
| z | サブウェーブ番号 | 1〜6 |

例: `1-1-6` = ステージ1、Wave1、サブウェーブ6

#### ステージ1のWave構成
| Wave | 内容 | フラグ持ち | クリア報酬 |
|------|------|-----------|-----------|
| Wave 1-1 | サブウェーブ6個 (1-1-1〜1-1-6) | 1-1-6にC | HP30%回復、スコア+5000 |
| Wave 1-2 | サブウェーブ1個 (1-2-1) | 1-2-1にC | 残機+1、スコア+10000 |

#### 雑魚グループステータス
| グループ | HP | DEF | ATK | 生存時間 | 特徴 |
|---------|-----|-----|-----|---------|------|
| GROUP_A | 200 | 0 | 100 | 15秒 | A1(5way 8m/s), A2(11way×2 4m/s), A3(狙い弾) |
| GROUP_B | 500 | 0 | 100 | 無制限 | B1(オーブ弾), B2(レーザー), B3(ラプチャー/スクリーム), B4(固定射撃/ムービング/恐怖弾) |
| GROUP_C | 1500 | 0 | 100 | 無制限 | フラグ持ち（撃破でWaveクリア）|

#### Waveクリアフロー
1. フラグ持ち（C）撃破
2. 残りの敵弾・雑魚敵を消去
3. クリア演出UI表示（5秒間）
   - スコア内訳（撃破スコア、タイムボーナス、ノーダメボーナス）
   - Wave合計スコア
   - 報酬内容
4. 報酬適用（HP回復 or 残機追加）
5. 次Wave開始 or ボス戦へ

#### Waveクリアリザルト設定
| 項目 | Wave 1-1 | Wave 1-2 |
|------|----------|----------|
| 想定クリア時間 | 90秒 | 30秒 |
| タイムボーナス | (想定時間 - 実際の時間) × 100pt/秒 |
| ノーダメボーナス | 5,000点 | 10,000点 |

#### 移動パターン
| パターン | 説明 |
|---------|------|
| straight | 直線下降 |
| wave | 波状移動 |
| zigzag | ジグザグ移動 |
| stay | 停止 |
| pass_through | 通過（画面外で消滅） |
| pass_through_curve | 下降後カーブして横に退場 |
| descend_shoot_ascend | 下降→発射→上昇退場 |
| chase_player | プレイヤー追尾 |
| random_walk | ランダム移動（プレイヤーとの距離維持） |
| descend_then_chase | 下降後→追尾移動 |
| descend_then_random_walk | 下降後→ランダム移動 |

#### シーン遷移フロー
```
StageIntroScene → MidStageScene（道中）
                    ↓ Wave 1-1 クリア → 5秒インターバル
                    ↓ Wave 1-2 クリア（最終Wave）
                    ↓
                  GameScene（ボス戦）
                    ↑
練習モード「ボスのみ」の場合は直接GameSceneへ
```

### デバッグシーン
| シーン | 説明 | ファイル |
|-------|------|---------|
| DebugRoomScene | デバッグメニュー | `src/scenes/debug/DebugRoomScene.ts` |
| BulletTestScene | 弾幕テスト | `src/scenes/debug/BulletTestScene.ts` |
| CutInTestScene | カットイン演出テスト | `src/scenes/debug/CutInTestScene.ts` |
| MobTestScene | 雑魚弾幕テスト | `src/scenes/debug/MobTestScene.ts` |
| ResultTestScene | Waveリザルト演出テスト | `src/scenes/debug/ResultTestScene.ts` |

### ドキュメント
- 弾幕仕様: `docs/BULLET_SYSTEM.md`
- ボスシステム: `docs/BOSS_SYSTEM.md`
- ルーミアスキル: `docs/RUMIA_SKILLS.md`
- カットイン演出: `docs/CUTIN_SYSTEM.md`
- 道中システム: `docs/MID_STAGE_SYSTEM.md`
- トラブルシューティング: `docs/TROUBLESHOOTING.md`

## ゲームバランス設計

### バフ・デバフ計算ポリシー

**重要: ステータス計算は「バフ → デバフ」の順番で適用する**

```
最終ステータス = (基本値 × バフ倍率の合計) × デバフ倍率の合計
```

#### 計算順序
1. 基本ステータスを取得
2. すべてのバフ効果を乗算（加算ではなく乗算）
3. 最後にすべてのデバフ効果を乗算

#### 例: 移動速度計算
- 基本MS: 100
- バフ: +40% (×1.4)
- デバフ: -30% スロウ (×0.7)
- 結果: 100 × 1.4 × 0.7 = 98

#### 理由
- デバフが常に最後に適用されることで、スロウなどのCC効果が確実に機能する
- バフを積んでもデバフの影響を完全に無効化できない

#### 該当コード
- `Entity.getEffectiveMoveSpeed()`: 移動速度計算
- 今後追加されるステータス計算も同様のポリシーに従う

### ステータスエフェクト

#### 利用可能なステータスエフェクト
| タイプ | 説明 |
|-------|------|
| STUN | スタン（行動不能） |
| SLOW | スロウ（移動速度低下） |
| ROOT | ルート（移動不能） |
| SILENCE | サイレンス（スキル使用不能） |
| CC_IMMUNE | CC無効（スタン、スロウ、ルート、サイレンスを無効化） |

#### 無敵とCC無効の分離
- **無敵（Invincibility）**: ダメージを受けない
- **CC無効（CC_IMMUNE）**: CCエフェクト（スタン、スロウ等）を受けない
- 例: ルーミアRスキル中は「無敵 + CC無効」の両方を付与

#### 実装箇所
- ステータスエフェクト定義: `src/types/index.ts` の `StatusEffectType`
- CC無効チェック: `src/entities/SkillProjectile.ts` の `isCCImmune()`
- ルーミアRスキル: `src/entities/bosses/Rumia.ts` の `initializeRSkillExecution()`

## コーディング規約

### TypeScript
- strict mode有効
- パスエイリアス: `@/` = `src/`

### Phaser 3
- 物理エンジン: Arcade Physics
- FPS: 60fps

## Git運用

- コミットメッセージは日本語可
- 機能追加は `feat:` プレフィックス
- バグ修正は `fix:` プレフィックス

## 素材管理

- 弾幕画像: `img/bullets/`
- キャラクター立ち絵: `img/[キャラ名]/`
- 一時ファイル: `tmp/`

## トラブルシューティング記録

開発中に遭遇したバグや問題の解決策は `docs/TROUBLESHOOTING.md` に記録してください。

### 記録すべき内容
- 原因特定に時間がかかった問題
- 再現率が低い、または条件が複雑なバグ
- 今後の参考になる教訓を含む問題

### 記録フォーマット
1. **問題の症状**: 何が起きたか
2. **原因**: なぜ起きたか
3. **解決策**: どう直したか
4. **修正箇所**: どのファイル・行を修正したか
5. **教訓**: 今後のために学んだこと

### 例
- 角度の範囲不一致（0〜360度 vs -180〜180度）によるスプライト方向バグ
