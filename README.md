# MOBA × TOUHOU - Danmaku Shooting Game

LoLの操作感と東方Projectの弾幕を組み合わせた新しいタイプのアクションゲーム

## 🚀 クイックスタート

### Docker を使用する場合（推奨）

```bash
# Dockerコンテナをビルド＆起動
docker-compose up --build

# ブラウザで開く
# http://localhost:3000
```

### ローカル環境で実行する場合

```bash
# 依存関係のインストール
npm install

# 開発サーバーの起動
npm run dev

# ブラウザで開く
# http://localhost:3000
```

## 📁 プロジェクト構成

```
moba_touhou/
├── public/                 # 静的アセット
│   └── assets/
│       ├── sprites/        # キャラクター、敵、弾等
│       ├── audio/          # BGM、SE
│       └── ui/             # UIアセット
├── src/
│   ├── main.ts             # エントリーポイント
│   ├── config/             # ゲーム設定
│   ├── scenes/             # Phaserシーン
│   ├── entities/           # ゲームエンティティ
│   ├── systems/            # ゲームシステム
│   ├── components/         # コンポーネント
│   ├── ui/                 # UI関連
│   ├── utils/              # ユーティリティ
│   └── types/              # 型定義
├── Dockerfile              # Docker設定
├── docker-compose.yml      # Docker Compose設定
├── vite.config.ts          # Viteビルド設定
├── tsconfig.json           # TypeScript設定
├── REQUIREMENTS.md         # 要件定義書
├── PROJECT_LOG.md          # プロジェクト進捗記録
└── NEXT_STEPS.md           # 次のステップ
```

## 🛠️ 技術スタック

- **ゲームエンジン**: Phaser 3
- **言語**: TypeScript
- **ビルドツール**: Vite
- **状態管理**: Zustand
- **コンテナ**: Docker

## 📝 開発コマンド

```bash
# 開発サーバー起動（Docker）
docker-compose up

# 開発サーバー起動（ローカル）
npm run dev

# ビルド
npm run build

# プレビュー（本番ビルドの確認）
npm run preview

# 型チェック
npm run type-check
```

## 🎮 ゲームの特徴

- **操作感**: LoL風の右クリック移動
- **弾幕**: 東方風のパターン弾幕
- **スキルシステム**: QWER（キャラクター固有）+ DF（プレイヤー選択）
- **HP制**: 弾幕一発アウトではなく、HP＋残機システム
- **縦スクロール**: プレイヤーの移動に応じたスクロール

## 📚 ドキュメント

- [要件定義書](REQUIREMENTS.md) - 詳細なゲーム仕様
- [プロジェクト進捗記録](PROJECT_LOG.md) - 開発の進捗と決定事項
- [次のステップ](NEXT_STEPS.md) - 今後の開発計画

## 🔧 開発状況

現在の開発フェーズ: **プロジェクトセットアップ完了**

### 完了済み
- [x] プロジェクト初期化
- [x] Docker環境構築
- [x] 基本的なフォルダ構成
- [x] Phaser 3 基本設定
- [x] BootScene, GameScene 作成

### 次のステップ
- [ ] プレイヤーキャラクターの実装
- [ ] 右クリック移動システム
- [ ] 通常攻撃（AA）の実装
- [ ] 基本的な弾幕システム

## 📄 ライセンス

MIT

## 🤝 コントリビューション

現在開発中です。詳細は [REQUIREMENTS.md](REQUIREMENTS.md) を参照してください。
