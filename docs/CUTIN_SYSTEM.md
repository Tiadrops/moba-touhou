# スペルカードカットイン演出システム

## 概要

ボスがスペルカードを宣言する際に表示されるカットイン演出システム。
東方Project風の演出を実現している。

## ファイル構成

| ファイル | 役割 |
|---------|------|
| `src/ui/components/SpellCardCutIn.ts` | カットイン演出のメインクラス |
| `src/scenes/GameScene.ts` | カットイン呼び出し処理 |
| `src/scenes/BootScene.ts` | 立ち絵の読み込み |
| `index.html` | カスタムフォントの定義 |

## 演出の流れ

```
1. 暗転（0.2秒）
   └─ 画面全体が85%の黒で暗くなる

2. 立ち絵登場（0.4秒）
   └─ 中央で少しズームしながらフェードイン
   └─ 最終透明度: 75%

3. テキスト登場（0.4〜0.5秒）
   └─ 右側からスライドイン
   └─ ボス名 → スペル名の順

4. 表示維持（1.2秒）
   └─ 演出が静止状態で表示

5. フェードアウト（0.3秒）
   └─ 立ち絵・テキスト・暗転が同時にフェードアウト

6. コールバック実行
   └─ 次のフェーズ開始などの処理
```

**総演出時間: 約2.1秒**

## レイアウト

```
┌────────────────────────────────────────┐
│                                        │
│                                        │
│         ┌──────────────────┐           │
│         │                  │           │
│         │    立ち絵        │           │
│         │  (中央配置)      │           │
│         │                  │           │
│         └──────────────────┘           │
│                        - ルーミア -    │
│              闇符「ダークサイドオブザムーン」│
│                                        │
└────────────────────────────────────────┘
```

- **立ち絵**: 画面中央（やや上、Y方向-80px）
- **ボス名**: 画像の右下（スペル名の上）
- **スペル名**: 画像の右下に重なる位置

## パラメータ設定

### アニメーション設定

```typescript
DARKEN_DURATION = 200;      // 暗転時間(ms)
ENTER_DURATION = 400;       // 登場アニメーション時間(ms)
DISPLAY_DURATION = 1200;    // 表示時間(ms)
EXIT_DURATION = 300;        // 退場アニメーション時間(ms)
```

### レイアウト設定

```typescript
PORTRAIT_SCALE = 1.0;       // 立ち絵のスケール（1920px幅で画面にぴったり）
PORTRAIT_ALPHA = 0.75;      // 立ち絵の透明度（75%）
OVERLAY_ALPHA = 0.85;       // 暗転の濃さ（85%）
PORTRAIT_OFFSET_Y = -80;    // 立ち絵のY方向オフセット
```

### テキストスタイル

**スペル名:**
- フォント: SawarabiMincho（さわらび明朝）
- サイズ: 48px
- 色: 白 (#ffffff)
- 縁取り: 暗赤 (#880000)、太さ5px
- 影: 黒、ぼかし6px

**ボス名:**
- フォント: Yu Gothic（游ゴシック）
- サイズ: 20px
- 色: 薄ピンク (#ffcccc)
- 影: 黒、ぼかし4px

## 立ち絵素材

### ルーミア

| キー | ファイルパス | サイズ |
|-----|-------------|--------|
| `cutin_rumia` | `img/Rumia/rumia_3.png` | 1920x810px |

### 新しいキャラクターを追加する場合

1. `src/scenes/BootScene.ts` で画像を読み込む:
```typescript
this.load.image('cutin_キャラ名', 'img/キャラ名/画像ファイル.png');
```

2. カットイン呼び出し時にキーを指定:
```typescript
this.spellCardCutIn.show(
  'スペル名',
  'ボス名',
  () => { /* コールバック */ },
  'cutin_キャラ名'  // 立ち絵のテクスチャキー
);
```

## 使用方法

### 基本的な呼び出し

```typescript
// GameScene内
this.spellCardCutIn.show(
  '闇符「ダークサイドオブザムーン」',  // スペル名
  'ルーミア',                          // ボス名
  () => {                              // 演出完了後のコールバック
    boss.startNextPhase();
  }
);
```

### フェーズ移行時の呼び出し例

```typescript
private onBossPhaseComplete(data: { boss: Boss; nextPhaseIndex: number }): void {
  const nextPhase = data.boss.getNextPhase();

  if (nextPhase?.type === BossPhaseType.SPELL_CARD) {
    // 敵弾を全消去
    this.bulletPool.deactivateEnemyBullets();

    // カットイン演出
    this.spellCardCutIn.show(nextPhase.name, 'ルーミア', () => {
      data.boss.startNextPhase();
    });
  }
}
```

## カスタムフォント

`index.html` で `@font-face` を定義:

```css
@font-face {
  font-family: 'SawarabiMincho';
  src: url('/fonts/SawarabiMincho-Regular.ttf') format('truetype');
  font-weight: normal;
  font-style: normal;
}
```

フォントファイル: `fonts/SawarabiMincho-Regular.ttf`

## 調整ガイド

### 演出時間を変更したい

`SpellCardCutIn.ts` の定数を変更:
```typescript
private static readonly DISPLAY_DURATION = 1500;  // 1.5秒に変更
```

### 立ち絵の透明度を変更したい

```typescript
private static readonly PORTRAIT_ALPHA = 0.8;  // 80%に変更
```

### 暗転を濃くしたい

```typescript
private static readonly OVERLAY_ALPHA = 0.9;  // 90%に変更
```

### テキスト位置を調整したい

コンストラクタ内のテキスト生成部分を変更:
```typescript
// portraitBottomY は画像の下端Y座標
this.spellNameText = scene.add.text(WIDTH - 40, portraitBottomY - 20, '', { ... });
this.bossNameText = scene.add.text(WIDTH - 40, portraitBottomY - 60, '', { ... });
```

## SE（効果音）

カットイン発動時に `se_spellcard` が再生される。

- ファイル: `sound/se/spellcard.mp3`
- 読み込み: `src/scenes/BootScene.ts`
- 再生タイミング: `show()` メソッド呼び出し直後

## 技術的な注意点

1. **状態管理**: `CutInState` enum で演出状態を管理（IDLE, ENTERING, DISPLAYING, EXITING）
2. **重複防止**: 演出中は新しい演出を開始できない
3. **クリーンアップ**: `hide()` メソッドで即座に演出を中断可能
4. **メモリ管理**: 立ち絵は演出終了時に `destroy()` される
