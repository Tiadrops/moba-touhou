# サモナースキルシステム

このドキュメントはD/Fスロットに装備するサモナースキルの仕様をまとめています。

## 概要

サモナースキルはLoLのサモナースペルに相当するシステムです。
プレイヤーはゲーム開始前にD/Fスロットにそれぞれ1つずつスキルを選択します。

## 実装ファイル

| ファイル | 説明 |
|---------|------|
| `src/systems/SummonerSkillManager.ts` | スキル実行・クールダウン管理 |
| `src/config/GameConfig.ts` | スキル設定（SUMMONER_SKILLS） |
| `src/types/index.ts` | PlayerSkillType列挙型 |
| `src/ui/components/PlayerZone.ts` | D/FスキルのCD表示 |

## スキル一覧

### フラッシュ (flash)

| 項目 | 値 |
|------|-----|
| CD | 30秒 |
| 効果 | 3m以内のカーソル位置に即座にワープ |
| SE | `se_flash` (H_reimu_006.mp3) |
| エフェクト | なし |

**動作仕様:**
- カーソルが3m以内: カーソル位置へワープ
- カーソルが3m以上: カーソル方向に3mワープ
- プレイエリア外にはワープ不可（自動クランプ）
- ワープ後は移動停止

---

### 霊撃(α) (spirit)

| 項目 | 値 |
|------|-----|
| CD | 10秒 |
| 効果 | 5.5m範囲の敵に0.1秒スタン |
| SE | `se_spirit` (nc159380.mp3) |
| エフェクト | シアン色の円形範囲表示（300msフェードアウト） |

**動作仕様:**
- 自身を中心に5.5m（302.5px）範囲
- 範囲内の全敵に100msスタン付与
- 敵が`setStunned`メソッドを持つ場合のみスタン適用

---

### ガード反撃 (guard)

| 項目 | 値 |
|------|-----|
| CD | 12秒（成功時6秒） |
| 効果 | 0.75秒防御態勢 → 台形範囲攻撃 |
| SE発動 | `se_guard_start` (on_tuba04.mp3) 音量1.5 |
| SE成功 | `se_guard_success` (on_saber.mp3) 音量1.5 |
| エフェクト | 黄色の台形範囲表示（攻撃成功時のみ） |

**動作仕様:**
1. 発動時にカーソル方向を記録
2. 0.75秒間防御態勢（無敵+移動不可）
3. 防御態勢中に攻撃を受けると`blockedAttack = true`
4. 防御態勢終了時:
   - 攻撃を防いでいた場合: 台形範囲攻撃を実行、CD50%減少
   - 防いでいない場合: 攻撃なし、CD減少なし

**台形攻撃範囲:**
| 項目 | 値 |
|------|-----|
| 下底（プレイヤー側） | 3m (165px) |
| 上底（先端側） | 0.8m (44px) |
| 高さ | 6m (330px) |
| ダメージ | 攻撃力の100% |

---

### 制御棒 (control)

| 項目 | 値 |
|------|-----|
| CD | 20秒 |
| 効果 | 5秒間射程+1.5m、攻撃力+10% |
| SE | `se_control` (nc229363.mp3) |
| エフェクト | なし |

**動作仕様:**
- 発動と同時にバフ付与
- 射程ボーナス: 1.5m (82.5px)
- 攻撃力バフ: BuffType.ATTACK_POWER × 1.10
- 5秒後にバフ自動終了

---

### 霊撃(β) (tengu)

| 項目 | 値 |
|------|-----|
| CD | 15秒 |
| 効果 | 5.5m以内の敵弾を消去 |
| SE | `se_spirit` (nc159380.mp3) ※霊撃(α)と同じ |
| エフェクト | マゼンタ色の円形範囲表示（300msフェードアウト） |

**動作仕様:**
- 自身を中心に5.5m（302.5px）範囲
- 範囲内の全敵弾を即座に破壊
- `setEnemyBullets()`で事前に敵弾リストを設定する必要あり

---

### ブースト (boost) ※未実装

| 項目 | 値 |
|------|-----|
| CD | 60秒 |
| 効果 | 検討中 |
| 選択可否 | 不可 |

---

## 使用方法

### シーンでの初期化

```typescript
// SummonerSkillManagerの作成
const config: SummonerSkillConfig = {
  D: PlayerSkillType.FLASH,
  F: PlayerSkillType.SPIRIT_STRIKE,
};
this.summonerSkillManager = new SummonerSkillManager(this, this.player, config);

// 敵・敵弾リストの設定（霊撃/天狗団扇用）
this.summonerSkillManager.setEnemies(this.enemies);
this.summonerSkillManager.setEnemyBullets(this.enemyBullets);

// プレイヤーにマネージャーを設定（ガード反撃用）
this.player.setSummonerSkillManager(this.summonerSkillManager);
```

### 更新処理

```typescript
update(time: number, delta: number): void {
  this.summonerSkillManager.update(time, delta);

  // 制御棒の射程ボーナスをプレイヤーに反映
  this.player.setRangeBonus(this.summonerSkillManager.getRangeBonus());
}
```

### スキル使用

```typescript
// Dキーでスキル使用
if (this.inputManager.isKeyJustPressed('D')) {
  const cursorPos = this.inputManager.getCursorPosition();
  this.summonerSkillManager.useSkill(SkillSlot.D, time, cursorPos.x, cursorPos.y);
}
```

---

## 円形範囲エフェクト

`showCircleEffect(range: number, color: number)` メソッドで表示。

| スキル | 色 | 説明 |
|-------|-----|------|
| 霊撃(α) | 0x00ffff (シアン) | スタン範囲 |
| 霊撃(β) | 0xff00ff (マゼンタ) | 弾消し範囲 |

**仕様:**
- 塗りつぶし: 30%透明度
- 枠線: 80%透明度、3px
- 深度: DEPTH.EFFECTS
- 300msでフェードアウト後に破棄

---

## 台形範囲エフェクト

`showTrapezoidEffect()` メソッドで表示（ガード反撃専用）。

**仕様:**
- 色: 黄色 (0xffff00)
- 塗りつぶし: 40%透明度
- 枠線: 80%透明度、3px
- 深度: DEPTH.EFFECTS
- 300msでフェードアウト後に破棄
- ガード成功時のみ表示
