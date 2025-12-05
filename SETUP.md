# セットアップガイド

## 前提条件

以下のソフトウェアがインストールされている必要があります：

- **Docker Desktop for Windows**: [ダウンロード](https://www.docker.com/products/docker-desktop/)
- **Git** (オプション): バージョン管理を行う場合

## セットアップ手順

### 1. Docker Desktopの起動

1. Docker Desktopを起動します
2. タスクトレイのDockerアイコンが緑色になるまで待ちます
3. ターミナルで以下のコマンドを実行して、Dockerが正常に動作していることを確認します：

```bash
docker --version
docker info
```

### 2. プロジェクトの起動

Docker Desktopが起動したら、以下のコマンドでプロジェクトを起動します：

```bash
# プロジェクトディレクトリに移動
cd d:\repository\moba_touhou

# Dockerコンテナをビルド＆起動
docker-compose up --build
```

### 3. ブラウザでアクセス

開発サーバーが起動したら、ブラウザで以下のURLを開きます：

```
http://localhost:3000
```

### 4. 開発の開始

ファイルを編集すると、自動的にブラウザがリロードされます（ホットリロード）。

## よくあるエラーと対処法

### Docker Desktopが起動していない

**エラー内容:**
```
open //./pipe/dockerDesktopLinuxEngine: The system cannot find the file specified.
```

**対処法:**
1. Docker Desktopを起動します
2. タスクトレイのDockerアイコンが緑色になるまで待ちます
3. 再度 `docker-compose up --build` を実行します

### ポート3000が使用中

**エラー内容:**
```
Error starting userland proxy: listen tcp4 0.0.0.0:3000: bind: address already in use
```

**対処法:**

Option 1: 他のアプリケーションを停止する
```bash
# Windowsで3000番ポートを使用しているプロセスを確認
netstat -ano | findstr :3000

# プロセスIDを確認して、タスクマネージャーで終了
```

Option 2: docker-compose.ymlのポート番号を変更する
```yaml
ports:
  - "3001:3000"  # ホストのポート3001にマッピング
```

### コンテナが起動しない

**対処法:**

1. 既存のコンテナを停止・削除します：
```bash
docker-compose down
```

2. イメージをクリーンアップします：
```bash
docker-compose down --rmi all
```

3. 再度ビルド＆起動します：
```bash
docker-compose up --build
```

## 開発コマンド

### コンテナの起動（バックグラウンド）
```bash
docker-compose up -d
```

### コンテナの停止
```bash
docker-compose down
```

### コンテナのログを確認
```bash
docker-compose logs -f
```

### コンテナに入る（デバッグ用）
```bash
docker-compose exec app sh
```

### コンテナ内でnpmコマンドを実行
```bash
# 例: 型チェック
docker-compose exec app npm run type-check

# 例: ビルド
docker-compose exec app npm run build
```

## ローカル環境での開発（Dockerを使わない場合）

Dockerを使わずにローカルで開発したい場合：

```bash
# 依存関係のインストール
npm install

# 開発サーバーの起動
npm run dev

# ブラウザで http://localhost:3000 を開く
```

## トラブルシューティング

### ホットリロードが動作しない

Dockerコンテナ内でホットリロードが動作しない場合：

1. `vite.config.ts` で `usePolling: true` が設定されているか確認
2. コンテナを再起動してみる：
```bash
docker-compose restart
```

### TypeScriptのエラーが表示される

```bash
# 型チェックを実行
npm run type-check

# または Docker経由で
docker-compose exec app npm run type-check
```

### ブラウザで画面が表示されない

1. ブラウザのコンソールでエラーを確認
2. Dockerコンテナのログを確認：
```bash
docker-compose logs -f app
```

## 次のステップ

セットアップが完了したら、以下のドキュメントを参照してください：

- [README.md](README.md) - プロジェクト概要
- [REQUIREMENTS.md](REQUIREMENTS.md) - 詳細な要件定義
- [NEXT_STEPS.md](NEXT_STEPS.md) - 次の開発タスク
- [PROJECT_LOG.md](PROJECT_LOG.md) - 開発の進捗記録
