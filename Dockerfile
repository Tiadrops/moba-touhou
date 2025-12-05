# Node.js 20 LTS をベースイメージとして使用
FROM node:20-alpine

# 作業ディレクトリを設定
WORKDIR /app

# package.json と package-lock.json をコピー
COPY package*.json ./

# 依存関係をインストール
RUN npm install

# ソースコードをコピー
COPY . .

# Vite開発サーバーのポートを公開
EXPOSE 3000

# 開発サーバーを起動
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
