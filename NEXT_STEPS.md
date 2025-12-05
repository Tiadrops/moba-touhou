# 次のセッションでの作業内容

## すぐに開始できるタスク

### Option 1: プロジェクトセットアップ（推奨）
次のセッションで以下のコマンドを実行してプロジェクトを初期化できます：

```bash
# npm でプロジェクト初期化
npm create vite@latest . -- --template vanilla-ts

# 依存関係インストール
npm install phaser zustand

# 開発サーバー起動
npm run dev
```

### Option 2: 手動セットアップ
より細かい制御が必要な場合は、以下の構成で手動セットアップ：

#### 必要なファイル
1. `package.json` - 依存関係定義
2. `tsconfig.json` - TypeScript設定
3. `vite.config.ts` - Viteビルド設定
4. `src/main.ts` - エントリーポイント
5. `index.html` - HTMLテンプレート

---

## プロトタイプ Phase 1 のタスクリスト

### 1. プロジェクト基盤（1-2日）
- [ ] Vite + TypeScript + Phaser 3 セットアップ
- [ ] 基本的なフォルダ構成作成
- [ ] Phaserゲームインスタンス初期化
- [ ] 開発サーバー起動確認

### 2. 基本ゲームループ（1日）
- [ ] メインゲームシーン作成
- [ ] 背景・プレイスペース設定
- [ ] FPSカウンター表示（デバッグ用）

### 3. プレイヤーキャラクター（2-3日）
- [ ] プレイヤースプライト表示（仮画像でOK）
- [ ] 右クリック移動システム実装
- [ ] 移動アニメーション（簡易）
- [ ] 画面境界の制限

### 4. 通常攻撃（AA）（2日）
- [ ] 弾オブジェクトの作成
- [ ] オブジェクトプーリング実装
- [ ] 自動攻撃ロジック（最も近い敵を狙う）
- [ ] 攻撃速度制御

### 5. テスト用の敵（1-2日）
- [ ] 敵スプライト表示
- [ ] 簡単な移動パターン
- [ ] HP システム
- [ ] 撃破時の処理

### 6. 基本的な当たり判定（1日）
- [ ] プレイヤーと敵弾の衝突判定
- [ ] プレイヤー弾と敵の衝突判定
- [ ] ダメージ処理

### 7. 簡易UI（1日）
- [ ] プレイヤーHPバー
- [ ] 残機表示
- [ ] スコア表示（仮）

---

## 推奨フォルダ構成

```
moba_touhou/
├── public/
│   └── assets/          # ゲームアセット
│       ├── sprites/     # キャラクター、敵、弾等
│       ├── audio/       # BGM、SE
│       └── ui/          # UIアセット
├── src/
│   ├── main.ts          # エントリーポイント
│   ├── config/          # ゲーム設定
│   │   └── GameConfig.ts
│   ├── scenes/          # Phaserシーン
│   │   ├── MenuScene.ts
│   │   ├── GameScene.ts
│   │   └── ResultScene.ts
│   ├── entities/        # ゲームエンティティ
│   │   ├── Player.ts
│   │   ├── Enemy.ts
│   │   └── Bullet.ts
│   ├── systems/         # ゲームシステム
│   │   ├── InputManager.ts
│   │   ├── CollisionSystem.ts
│   │   └── SkillSystem.ts
│   ├── components/      # ECSコンポーネント（任意）
│   ├── ui/              # UI関連
│   │   └── HUD.ts
│   ├── utils/           # ユーティリティ
│   │   └── ObjectPool.ts
│   └── types/           # 型定義
│       └── index.ts
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
├── REQUIREMENTS.md      # 要件定義書
├── PROJECT_LOG.md       # 進捗記録
└── NEXT_STEPS.md        # このファイル
```

---

## 仮アセットの準備

### 最小限必要なアセット

#### スプライト（仮）
- `player.png` - 32x32px、プレイヤーキャラクター（色付き四角でOK）
- `enemy.png` - 32x32px、敵キャラクター（色付き円でOK）
- `bullet_player.png` - 8x8px、プレイヤーの弾（青い円）
- `bullet_enemy.png` - 8x8px、敵の弾（赤い円）

#### プログラムで生成可能
Phaser の Graphics API を使用して、コードでプリミティブな図形を描画することも可能：
```typescript
// 例: 円形スプライトをコードで生成
const graphics = this.add.graphics();
graphics.fillStyle(0xff0000, 1);
graphics.fillCircle(16, 16, 16);
graphics.generateTexture('enemy', 32, 32);
graphics.destroy();
```

---

## コード例: 最小限のセットアップ

### package.json (最小構成)
```json
{
  "name": "moba-touhou",
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "phaser": "^3.80.1",
    "zustand": "^4.5.0"
  },
  "devDependencies": {
    "@types/node": "^20.11.0",
    "typescript": "^5.3.3",
    "vite": "^5.0.11"
  }
}
```

### vite.config.ts
```typescript
import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          phaser: ['phaser']
        }
      }
    }
  }
});
```

### src/main.ts (エントリーポイント)
```typescript
import Phaser from 'phaser';
import { GameScene } from './scenes/GameScene';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: 1920,
  height: 1080,
  parent: 'game-container',
  backgroundColor: '#000000',
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { y: 0 },
      debug: true
    }
  },
  scene: [GameScene]
};

new Phaser.Game(config);
```

---

## 次のセッションで聞くべき質問

1. **アセットの状況**
   - 仮素材から始めるか？
   - グラフィックは自作 or 外注 or フリー素材？

2. **開発環境**
   - Node.js はインストール済みか？
   - エディタは VSCode を使用するか？

3. **プロトタイプのスコープ**
   - まずは動くものを優先するか？
   - 特定の機能から実装したいものはあるか？

4. **Git リポジトリ**
   - Git で管理するか？
   - GitHub/GitLab などにプッシュするか？

---

## 開発時の注意事項

### パフォーマンス
- 初期段階から Object Pooling を意識
- 弾は最初から再利用可能な設計に

### コードの整理
- 早い段階でファイル分割を徹底
- 1ファイル200行以内を目安に

### デバッグ
- Phaser の Debug モードを活用
- FPS、オブジェクト数を常に表示

### テスト
- 小さな機能ごとに動作確認
- ブラウザのコンソールでエラーチェック

---

## クイックスタートコマンド（次のセッション用）

次のセッションで、すぐに開発を開始する場合：

```bash
# 1. プロジェクト初期化
npm create vite@latest . -- --template vanilla-ts

# 2. 依存関係インストール
npm install phaser zustand

# 3. 開発サーバー起動
npm run dev
```

または、手動セットアップを希望する場合は「手動セットアップを開始したい」と伝えてください。

---

## 完了の定義（Phase 1 プロトタイプ）

以下が動作すればプロトタイプ完了：
- [x] プレイヤーが右クリックで移動できる
- [x] プレイヤーが自動で敵に向かって弾を撃つ
- [x] 敵が画面上部から出現し、下に移動する
- [x] 敵がプレイヤーに向かって弾を撃つ
- [x] プレイヤーが敵弾に当たるとHPが減る
- [x] プレイヤーの弾が敵に当たると敵のHPが減る
- [x] 敵のHPが0になると敵が消える
- [x] プレイヤーのHPが0になるとゲームオーバー

---

最終更新: 2025-12-04
