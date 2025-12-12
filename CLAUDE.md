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
  - 待機・詠唱のフレーム順: 1→3→2→4

### ドキュメント
- 弾幕仕様: `docs/BULLET_SYSTEM.md`
- ボスシステム: `docs/BOSS_SYSTEM.md`
- ルーミアスキル: `docs/RUMIA_SKILLS.md`

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
