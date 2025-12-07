# 戦闘システム設計書

## 概要

MOBA風東方弾幕ゲームの戦闘システム設計書。
LoL風のステータスシステムとダメージ計算式を採用。

## ステータスパラメータ

### 基本ステータス

| パラメータ | 英語名 | 説明 | デフォルト値（霊夢） |
|-----------|--------|------|---------------------|
| HP | maxHp | 最大体力 | 100 |
| 攻撃力 | attackPower | 基礎攻撃力 | 10 |
| AAダメージ増幅 | aaMultiplier | 通常攻撃の増幅率 | 1.0 (100%) |
| 防御力 | defense | ダメージ軽減に使用 | 0 |
| 攻撃速度 | attackSpeed | 秒間攻撃回数 | 2.0 |
| クリティカル確率 | critChance | クリティカル発生確率 | 0 (0%) |
| 移動速度 | moveSpeed | ピクセル/秒 | 300 |

### 派生ステータス（計算値）

| パラメータ | 計算式 |
|-----------|--------|
| 実効攻撃速度 | attackSpeed × バフ倍率 |
| 実効移動速度 | moveSpeed × バフ倍率 |
| 攻撃間隔(ms) | 1000 / 実効攻撃速度 |

## ダメージ計算式

### 1. 通常攻撃（AA）ダメージ

```
基礎AAダメージ = 攻撃力 × AAダメージ増幅
クリティカル判定 = random() < クリティカル確率
クリティカル倍率 = クリティカル発動時 1.5 : 1.0

最終攻撃力 = 基礎AAダメージ × クリティカル倍率
```

### 2. スキルダメージ

```
最終攻撃力 = スキル固定値 + (攻撃力 × スキル増幅率) × その他補正
```

#### スキル増幅率の例（霊夢）

| スキル | 固定値 | 増幅率 | 備考 |
|--------|--------|--------|------|
| Q: 霊符「夢想封印」 | 0 | 1.0 (100%) | 3発ホーミング弾 |
| W: 夢符「封魔陣」 | 5 | 0.8 (80%) | 7方向拡散 |
| E: 神技「八方龍殺陣」 | 0 | 0 | ダッシュ、ダメージなし |
| R: 夢想天生 | 20 | 0.5 (50%) | 範囲持続ダメージ |

### 3. 最終ダメージ計算（防御力適用）

```
防御軽減率 = 100 / (敵の防御力 + 100)
最終ダメージ = 最終攻撃力 × 防御軽減率
```

#### 防御力による軽減率の例

| 防御力 | 軽減率 | 実質ダメージ |
|--------|--------|-------------|
| 0 | 100% | 100% |
| 10 | 90.9% | 90.9% |
| 20 | 83.3% | 83.3% |
| 50 | 66.7% | 66.7% |
| 100 | 50% | 50% |
| 200 | 33.3% | 33.3% |

## クリティカルシステム

- **発動条件**: 通常攻撃（AA）のみ
- **クリティカル倍率**: 1.5倍（固定）
- **判定タイミング**: 弾発射時
- **将来拡張**: クリティカルダメージ増幅装備の追加可能

```typescript
// クリティカル判定
const isCritical = Math.random() < combatStats.critChance;
const critMultiplier = isCritical ? CRITICAL_MULTIPLIER : 1.0;
```

## 実装詳細

### CombatStats インターフェース

```typescript
interface CombatStats {
  // 基本ステータス
  maxHp: number;
  attackPower: number;
  aaMultiplier: number;
  defense: number;
  attackSpeed: number;
  critChance: number;
  moveSpeed: number;

  // ゲーム固有
  attackRange: number;
  hitboxRadius: number;
}
```

### ダメージ計算ユーティリティ

```typescript
// DamageCalculator.ts
export class DamageCalculator {
  // AA ダメージ計算
  static calculateAADamage(
    attacker: CombatStats,
    defender: CombatStats
  ): { damage: number; isCritical: boolean }

  // スキルダメージ計算
  static calculateSkillDamage(
    attacker: CombatStats,
    defender: CombatStats,
    skillConfig: SkillDamageConfig
  ): number

  // 防御力適用
  static applyDefense(rawDamage: number, defense: number): number
}
```

### Buff システムとの連携

既存のBuffシステムを拡張：

```typescript
enum BuffType {
  ATTACK_SPEED = 'attackSpeed',
  MOVE_SPEED = 'moveSpeed',
  DAMAGE = 'damage',
  // 新規追加
  ATTACK_POWER = 'attackPower',
  AA_MULTIPLIER = 'aaMultiplier',
  DEFENSE = 'defense',
  CRIT_CHANCE = 'critChance',
}
```

## キャラクター別ステータス

### 霊夢（バランス型）

```typescript
{
  maxHp: 100,
  attackPower: 10,
  aaMultiplier: 1.0,
  defense: 5,
  attackSpeed: 2.0,
  critChance: 0.05,  // 5%
  moveSpeed: 300,
  attackRange: 150,
  hitboxRadius: 8,
}
```

### 魔理沙（火力型）

```typescript
{
  maxHp: 80,
  attackPower: 15,
  aaMultiplier: 1.2,
  defense: 0,
  attackSpeed: 1.5,
  critChance: 0.10,  // 10%
  moveSpeed: 320,
  attackRange: 250,
  hitboxRadius: 8,
}
```

### 咲夜（速攻型）

```typescript
{
  maxHp: 90,
  attackPower: 12,
  aaMultiplier: 0.9,
  defense: 3,
  attackSpeed: 3.0,
  critChance: 0.15,  // 15%
  moveSpeed: 280,
  attackRange: 200,
  hitboxRadius: 8,
}
```

### 妖夢（近接型）

```typescript
{
  maxHp: 110,
  attackPower: 8,
  aaMultiplier: 1.3,
  defense: 10,
  attackSpeed: 2.5,
  critChance: 0.20,  // 20%
  moveSpeed: 310,
  attackRange: 150,
  hitboxRadius: 8,
}
```

## 敵ステータス

### 雑魚敵（NORMAL）

```typescript
{
  maxHp: 30,
  attackPower: 10,
  aaMultiplier: 1.0,
  defense: 0,
  attackSpeed: 1.0,
  critChance: 0,
  moveSpeed: 100,
}
```

### 精鋭敵（ELITE）

```typescript
{
  maxHp: 100,
  attackPower: 20,
  aaMultiplier: 1.0,
  defense: 10,
  attackSpeed: 1.2,
  critChance: 0,
  moveSpeed: 80,
}
```

### 中ボス（MINI_BOSS）

```typescript
{
  maxHp: 500,
  attackPower: 30,
  aaMultiplier: 1.0,
  defense: 25,
  attackSpeed: 1.5,
  critChance: 0.05,
  moveSpeed: 50,
}
```

### ボス（BOSS）

```typescript
{
  maxHp: 2000,
  attackPower: 50,
  aaMultiplier: 1.2,
  defense: 50,
  attackSpeed: 2.0,
  critChance: 0.10,
  moveSpeed: 30,
}
```

## 将来の拡張

### 装備システム

```typescript
interface Equipment {
  id: string;
  name: string;
  stats: Partial<CombatStats>;  // ステータス加算
  passive?: PassiveEffect;       // パッシブ効果
  active?: ActiveSkill;          // アクティブスキル
}
```

### 成長システム

- 敵を倒すとゴールド獲得
- ゴールドで装備を購入
- 装備でステータス強化
- レベルアップによるステータス上昇（オプション）

### ダメージタイプ（将来）

```typescript
enum DamageType {
  PHYSICAL = 'physical',  // 物理（防御力で軽減）
  MAGICAL = 'magical',    // 魔法（魔法防御で軽減）
  TRUE = 'true',          // 確定（軽減不可）
}
```

## ダメージ計算フロー図

```
┌─────────────────────────────────────────────────────────────┐
│                    ダメージ計算フロー                        │
└─────────────────────────────────────────────────────────────┘

    ┌──────────┐
    │ 攻撃開始 │
    └────┬─────┘
         │
    ┌────▼─────┐
    │ AA/スキル │
    │  判定    │
    └────┬─────┘
         │
    ┌────┴────┐
    │         │
┌───▼───┐ ┌───▼───────┐
│  AA   │ │  スキル    │
└───┬───┘ └───┬───────┘
    │         │
┌───▼─────────┐│
│基礎ダメージ  ││
│=攻撃力×AA増幅││
└───┬─────────┘│
    │          │
┌───▼─────┐    │  ┌─────────────────────┐
│クリティカル│   │  │基礎ダメージ          │
│  判定    │    │  │=固定値+(攻撃力×増幅率)│
└───┬─────┘    │  │×その他補正           │
    │          │  └──────────┬──────────┘
┌───▼─────┐    │             │
│×1.5倍   │    │             │
│(発動時) │    │             │
└───┬─────┘    │             │
    │          │             │
    └────┬─────┴─────────────┘
         │
    ┌────▼──────────┐
    │  最終攻撃力    │
    └────┬──────────┘
         │
    ┌────▼──────────────────┐
    │  防御力計算            │
    │  軽減率=100/(防御+100) │
    └────┬──────────────────┘
         │
    ┌────▼──────────┐
    │  最終ダメージ  │
    │  =攻撃力×軽減率│
    └────┬──────────┘
         │
    ┌────▼─────┐
    │ HP減少   │
    └──────────┘
```

## 注意事項

1. **クリティカルはAAのみ**: スキルダメージにはクリティカルが適用されない
2. **防御力は全ダメージに適用**: AA・スキル両方に防御力が適用される
3. **バフは乗算**: 同種バフは乗算で計算される
4. **最小ダメージ**: 最終ダメージは最低1以上を保証

## 実装優先順位

1. ✅ 設計書作成
2. ✅ CombatStats 型定義
3. ✅ DamageCalculator 実装
4. ✅ Player/Enemy へのCombatStats統合
5. ✅ CharacterData更新
6. ✅ 既存のダメージ処理を新システムに移行

## 実装完了ファイル

- [types/index.ts](../src/types/index.ts) - CombatStats, EnemyStats, SkillDamageConfig, DamageResult 型追加
- [utils/DamageCalculator.ts](../src/utils/DamageCalculator.ts) - ダメージ計算ユーティリティ（新規）
- [config/CharacterData.ts](../src/config/CharacterData.ts) - キャラクター/敵ステータス更新
- [config/GameConfig.ts](../src/config/GameConfig.ts) - スキルダメージ設定追加
- [entities/Player.ts](../src/entities/Player.ts) - AA/スキルダメージ計算、クリティカル判定
- [entities/Enemy.ts](../src/entities/Enemy.ts) - EnemyStats統合
- [entities/Bullet.ts](../src/entities/Bullet.ts) - クリティカルフラグ追加
- [scenes/GameScene.ts](../src/scenes/GameScene.ts) - 防御力考慮のダメージ計算
- [ui/components/PlayerZone.ts](../src/ui/components/PlayerZone.ts) - UI表示更新（DEF, CRIT追加）
