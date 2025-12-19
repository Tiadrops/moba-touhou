# 弾幕システム仕様書

## 概要

本ゲームでは、かずぎつね氏の弾幕素材を使用した弾幕システムを実装しています。

## kShot弾の使用方法

### 基本的な使い方

```typescript
import { KSHOT } from '../Bullet';

// 弾を発射
bullet.fire(
  x, y,                    // 発射位置
  targetX, targetY,        // 目標位置（方向計算用）
  BulletType.ENEMY_NORMAL, // 弾タイプ
  damage,                  // ダメージ
  null,                    // 追尾対象（nullで追尾なし）
  false,                   // クリティカルフラグ
  KSHOT.MEDIUM_BALL.MAGENTA // kShotフレームID ← ここで指定
);
```

### KSHOT定数一覧

```typescript
export const KSHOT = {
  // 黒縁中玉 (ID 1-8) - 512x512px
  MEDIUM_BALL: {
    RED: 1,
    ORANGE: 2,
    YELLOW: 3,
    GREEN: 4,
    CYAN: 5,
    BLUE: 6,
    MAGENTA: 7,
    WHITE: 8,
  },
  // 輪弾 (ID 9-16) - 278x278px
  RINDAN: {
    RED: 9,
    YELLOW: 10,
    LIME: 11,
    GREEN: 12,
    CYAN: 13,
    MAGENTA: 14,
    PURPLE: 15,
    BLUE: 16,
  },
  // 大玉 (ID 17-24) - 512x512px
  LARGE_BALL: {
    RED: 17,
    ORANGE: 18,
    YELLOW: 19,
    GREEN: 20,
    CYAN: 21,
    BLUE: 22,
    MAGENTA: 23,
    WHITE: 24,
  },
} as const;
```

## 弾タイプ詳細

### 黒縁中玉 (KSHOT.MEDIUM_BALL)

| プロパティ | 値 |
|-----------|-----|
| ID範囲 | 1-8 |
| 画像サイズ | 512x512 px |
| スプライトシート | 4096x512 px (8色横並び) |
| 当たり判定 | 440x440 px (円形、半径220px) |
| 用途 | 汎用弾、ボス弾幕 |

### 輪弾 (KSHOT.RINDAN)

| プロパティ | 値 |
|-----------|-----|
| ID範囲 | 9-16 |
| 画像サイズ | 278x278 px |
| ファイル形式 | 各色個別ファイル |
| 当たり判定 | 275x275 px (円形、半径137.5px) |
| 用途 | 輪状の弾、リング弾幕 |

### 大玉 (KSHOT.LARGE_BALL)

| プロパティ | 値 |
|-----------|-----|
| ID範囲 | 17-24 |
| 画像サイズ | 512x512 px |
| スプライトシート | 4096x512 px (8色横並び) |
| 当たり判定 | 440x440 px (円形、半径220px) |
| 用途 | 大型弾、ボス弾幕 |

## 色一覧

### 黒縁中玉の色

| 色名 | ID | 説明 | 推奨キャラ/シーン |
|------|-----|------|------------------|
| RED | 1 | 赤 | 霊夢、炎系 |
| ORANGE | 2 | 橙 | 炎、夕焼け系 |
| YELLOW | 3 | 黄 | 雷、光系 |
| GREEN | 4 | 緑 | 自然、毒系 |
| CYAN | 5 | 水色 | 氷、水系 |
| BLUE | 6 | 青 | 水、氷系 |
| MAGENTA | 7 | マゼンタ | 闇系（ルーミア推奨） |
| WHITE | 8 | 白 | 汎用、神聖系 |

### 輪弾の色

| 色名 | ID | 説明 | 推奨キャラ/シーン |
|------|-----|------|------------------|
| RED | 9 | 赤 | 霊夢、炎系 |
| YELLOW | 10 | 黄 | 雷、光系 |
| LIME | 11 | 黄緑 | 自然系 |
| GREEN | 12 | 緑 | 自然、毒系 |
| CYAN | 13 | 水色 | 氷、水系 |
| MAGENTA | 14 | マゼンタ | 闘符系 |
| PURPLE | 15 | 紫 | 闇系（ルーミア推奨） |
| BLUE | 16 | 青 | 水、氷系 |

### 大玉の色

| 色名 | ID | 説明 | 推奨キャラ/シーン |
|------|-----|------|------------------|
| RED | 17 | 赤 | 霊夢、炎系 |
| ORANGE | 18 | 橙 | 炎、夕焼け系 |
| YELLOW | 19 | 黄 | 雷、光系 |
| GREEN | 20 | 緑 | 自然、毒系 |
| CYAN | 21 | 水色 | 氷、水系 |
| BLUE | 22 | 青 | 水、氷系 |
| MAGENTA | 23 | マゼンタ | 闇系（ルーミア推奨） |
| WHITE | 24 | 白 | 汎用、神聖系 |

## 当たり判定について

当たり判定は**画像サイズより小さく**設定されています。
これは「見た目では当たっていないのに当たってしまう」という理不尽を防ぐためです。

| タイプ | 定数名 | 画像サイズ | 当たり判定 | 当たり判定半径 |
|--------|--------|-----------|---------|---------------|
| 黒縁中玉 | MEDIUM_BALL | 512x512px | 440x440px | 220px |
| 輪弾 | RINDAN | 278x278px | 275x275px | 137.5px |
| 大玉 | LARGE_BALL | 512x512px | 440x440px | 220px |

## テクスチャの読み込み

弾幕テクスチャは `BootScene` で読み込まれます。

### 黒縁中玉（スプライトシート）

```typescript
// BootScene.ts での読み込み
this.load.image('kshot_medium_ball', 'img/bullets/kshot_medium_ball.png');

// フレーム生成
for (let col = 0; col < 8; col++) {
  const x = col * 512;
  const frameId = col + 1; // ID 1-8
  mediumBallTexture.add(`kshot_${frameId}`, 0, x, 0, 512, 512);
}
```

### 輪弾（個別ファイル）

```typescript
// BootScene.ts での読み込み
this.load.image('rindan_9', 'img/bullets/rindan_red.png');
this.load.image('rindan_10', 'img/bullets/rindan_yellow.png');
this.load.image('rindan_11', 'img/bullets/rindan_lime.png');
this.load.image('rindan_12', 'img/bullets/rindan_green.png');
this.load.image('rindan_13', 'img/bullets/rindan_cyan.png');
this.load.image('rindan_14', 'img/bullets/rindan_magenta.png');
this.load.image('rindan_15', 'img/bullets/rindan_purple.png');
this.load.image('rindan_16', 'img/bullets/rindan_blue.png');
```

### 大玉（スプライトシート）

```typescript
// BootScene.ts での読み込み
this.load.image('kshot_large_ball', 'img/bullets/kshot_large_ball.png');

// フレーム生成
for (let col = 0; col < 8; col++) {
  const x = col * 512;
  const frameId = col + 17; // ID 17-24
  largeBallTexture.add(`kshot_${frameId}`, 0, x, 0, 512, 512);
}
```

## ルーミアの弾幕設定

### 通常フェーズ

| スキル | 弾タイプ | 色 |
|--------|---------|-----|
| Q（8way弾幕） | MEDIUM_BALL | MAGENTA |
| E（拡大リング） | MEDIUM_BALL | MAGENTA |
| R（混合弾） | MEDIUM_BALL | MAGENTA |

### スペルカードフェーズ

| スキル | 弾タイプ | 色 |
|--------|---------|-----|
| Q（12方向弾） | MEDIUM_BALL | MAGENTA |
| W（トリプルバースト） | MEDIUM_BALL | MAGENTA |
| E（8方向スパイラル） | MEDIUM_BALL | MAGENTA |

## 素材クレジット

- 弾幕素材: かずぎつね

## 今後の拡張予定

- [x] 大玉の実装（ID 17-24）
- [ ] 追加弾種の実装（小玉、レーザー等）
- [ ] 加算合成レンダリング対応
- [ ] 回転エフェクト対応
