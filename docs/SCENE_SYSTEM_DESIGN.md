# 画面・シーン遷移システム設計書

## 1. 概要

本ドキュメントでは、MOBA東方プロジェクトのシーン管理システムと画面遷移フローを定義する。

---

## 2. シーン一覧

### 2.1 シーン構成図

```
┌─────────────────────────────────────────────────────────────────┐
│                        BootScene                                 │
│                    (アセット読み込み)                            │
└───────────────────────────┬─────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│                        TitleScene                                │
│                      (タイトル画面)                              │
│         [ゲームスタート] [オプション] [クレジット]              │
└──────────┬────────────────────────────────┬─────────────────────┘
           ↓                                ↓
┌──────────────────────┐          ┌────────────────────┐
│    OptionScene       │          │   CreditScene      │
│   (オプション画面)   │          │  (クレジット画面)  │
└──────────────────────┘          └────────────────────┘
           ↓
┌─────────────────────────────────────────────────────────────────┐
│                     ModeSelectScene                              │
│                     (モード選択画面)                             │
│              [アーケードモード] [練習モード]                     │
└──────────┬──────────────────────────────────┬───────────────────┘
           ↓                                  ↓
┌──────────────────────────────┐    ┌─────────────────────────────┐
│   ArcadeSetupScene           │    │    PracticeSetupScene       │
│  (アーケード設定画面)        │    │    (練習モード設定画面)     │
│  - キャラクター選択          │    │  - キャラクター選択         │
│  - 難易度選択                │    │  - 難易度選択               │
└──────────┬───────────────────┘    │  - ステージ選択             │
           ↓                        │  - 道中ON/OFF               │
           ↓                        │  - 練習オプション           │
           ↓                        └──────────┬──────────────────┘
           ↓                                   ↓
           └─────────────┬─────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────────┐
│                   StageIntroScene                                │
│                (ステージ開始前画面)                              │
│  - ステージ情報表示（ボス名、ステージ番号）                     │
│  - D/Fスキル選択（ステージ攻略の鍵）                            │
│  - [出撃] ボタン                                                │
└───────────────────────────┬─────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│                        GameScene                                 │
│                      (ゲームプレイ)                              │
│                        道中 → ボス                              │
└──────────┬──────────────────────────────────┬───────────────────┘
           ↓                                  ↓
┌──────────────────────────────┐    ┌─────────────────────────────┐
│     PauseScene (overlay)     │    │     GameOverScene           │
│    (一時停止メニュー)        │    │    (ゲームオーバー画面)     │
│  - 再開                      │    │  - リトライ                 │
│  - リスタート                │    │  - モード選択に戻る         │
│  - オプション                │    │  - タイトルに戻る           │
│  - タイトルに戻る            │    └─────────────────────────────┘
└──────────────────────────────┘
           ↓ (ステージクリア時)
┌─────────────────────────────────────────────────────────────────┐
│                      ResultScene                                 │
│                     (リザルト画面)                               │
│  - スコア表示  - ランク評価  - 統計情報                         │
│  [次のステージへ] [リトライ] [モード選択へ] [タイトルへ]        │
│        ↓                                                        │
│   次ステージへ進む場合 → StageIntroScene へ（D/F再選択可能）    │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 シーン詳細

| シーン名 | ファイル名 | 説明 | 遷移元 | 遷移先 |
|----------|-----------|------|--------|--------|
| BootScene | BootScene.ts | アセット読み込み | - | TitleScene |
| TitleScene | TitleScene.ts | タイトル画面 | BootScene, ResultScene, GameOverScene | ModeSelectScene, OptionScene, CreditScene |
| OptionScene | OptionScene.ts | オプション設定 | TitleScene, PauseScene | 遷移元に戻る |
| CreditScene | CreditScene.ts | クレジット表示 | TitleScene | TitleScene |
| ModeSelectScene | ModeSelectScene.ts | モード選択 | TitleScene | ArcadeSetupScene, PracticeSetupScene |
| ArcadeSetupScene | ArcadeSetupScene.ts | アーケード設定（キャラ・難易度） | ModeSelectScene | StageIntroScene |
| PracticeSetupScene | PracticeSetupScene.ts | 練習モード設定（キャラ・難易度・ステージ・オプション） | ModeSelectScene | StageIntroScene |
| **StageIntroScene** | StageIntroScene.ts | **ステージ開始前（D/Fスキル選択）** | ArcadeSetupScene, PracticeSetupScene, ResultScene | GameScene |
| GameScene | GameScene.ts | ゲームプレイ（道中→ボス） | StageIntroScene | ResultScene, GameOverScene, PauseScene |
| PauseScene | PauseScene.ts | 一時停止（オーバーレイ） | GameScene | GameScene, TitleScene, OptionScene |
| ResultScene | ResultScene.ts | リザルト表示 | GameScene | StageIntroScene (次ステージ), TitleScene, ModeSelectScene |
| GameOverScene | GameOverScene.ts | ゲームオーバー | GameScene | StageIntroScene (リトライ), TitleScene, ModeSelectScene |

---

## 3. ゲームモード定義

### 3.1 アーケードモード

通常のゲームプレイモード。ステージ1から順番にクリアしていく。

```typescript
interface ArcadeModeConfig {
  mode: 'arcade';
  character: CharacterType;
  difficulty: DifficultyLevel;
  currentStage: number;       // 現在のステージ番号
  lives: 3;                   // 初期残機
}

// D/Fスキルはステージ毎にStageIntroSceneで選択
interface StageConfig {
  stageNumber: number;
  summonerSkills: {
    D: SummonerSkillType;
    F: SummonerSkillType;
  };
}
```

**ゲームフロー:**
```
ArcadeSetupScene（キャラクター・難易度選択）
    ↓
StageIntroScene（ステージ1情報 + D/Fスキル選択）
    ↓
GameScene（道中 → ボス戦）
    ↓
ResultScene（スコア・ランク表示）
    ↓
StageIntroScene（ステージ2情報 + D/Fスキル再選択可能）
    ↓
GameScene（道中 → ボス戦）
    ↓
  ... 繰り返し ...
    ↓
ステージ6クリア → 全体リザルト → タイトルへ
```

**ポイント:**
- 各ステージ開始前にD/Fスキルを選び直せる
- ステージのボスに合わせた戦略的なスキル選択が攻略の鍵

### 3.2 練習モード

特定のステージやボスを繰り返し練習できるモード。

```typescript
interface PracticeModeConfig {
  mode: 'practice';
  character: CharacterType;
  difficulty: DifficultyLevel;
  stageNumber: number;        // 練習するステージ
  includeStageRoute: boolean; // 道中を含むか
  practiceTarget: PracticeTarget; // 練習対象
  options: PracticeOptions;
}

// D/FスキルはStageIntroSceneで選択（ステージ選択後）
type PracticeTarget =
  | 'full'      // ステージ全体（道中 + ボス）
  | 'boss'      // ボスのみ
  | 'route';    // 道中のみ

interface PracticeOptions {
  infiniteLives: boolean;     // 残機無限
  invincible: boolean;        // 無敵モード
  slowMode: boolean;          // スローモーション
  showHitbox: boolean;        // 当たり判定表示
  startFromPhase?: number;    // 特定フェーズから開始（ボス練習時）
}
```

**ゲームフロー:**
```
PracticeSetupScene（キャラ・難易度・ステージ・オプション選択）
    ↓
StageIntroScene（ステージ情報 + D/Fスキル選択）
    ↓
GameScene（選択した範囲のみプレイ）
    ↓
クリア or 中断
    ↓
簡易リザルト → 再挑戦（StageIntroScene） or 設定変更（PracticeSetupScene） or 終了
```

**ポイント:**
- ステージ選択後にD/Fスキルを選ぶ（ボスに合わせた練習が可能）
- 練習オプションで難易度調整可能

---

## 4. 画面詳細設計

### 4.1 TitleScene（タイトル画面）

```
┌────────────────────────────────────────────────────────┐
│                                                        │
│                                                        │
│              ╔════════════════════════╗               │
│              ║   MOBA × 東方          ║               │
│              ║   〜弾幕幻想郷〜       ║               │
│              ╚════════════════════════╝               │
│                                                        │
│                                                        │
│                  ▶ ゲームスタート                     │
│                    オプション                          │
│                    クレジット                          │
│                                                        │
│                                                        │
│                        Press Any Key                   │
│                                                        │
│  Version 0.1.0                    © 2025             │
└────────────────────────────────────────────────────────┘
```

**要素:**
- ゲームタイトルロゴ
- メニュー項目（キーボード/マウス対応）
- バージョン表示
- 背景アニメーション（弾幕エフェクト等）

### 4.2 ModeSelectScene（モード選択画面）

```
┌────────────────────────────────────────────────────────┐
│  ← 戻る                                               │
│                                                        │
│                   モード選択                           │
│                                                        │
│   ┌─────────────────────┐  ┌─────────────────────┐   │
│   │                     │  │                     │   │
│   │   アーケード        │  │   練習モード        │   │
│   │      モード         │  │                     │   │
│   │                     │  │                     │   │
│   │  ステージ1から順に  │  │  好きなステージを   │   │
│   │  クリアを目指す     │  │  選んで練習         │   │
│   │                     │  │                     │   │
│   └─────────────────────┘  └─────────────────────┘   │
│                                                        │
│              Enter: 決定  Esc: 戻る                   │
└────────────────────────────────────────────────────────┘
```

### 4.3 ArcadeSetupScene（アーケード設定画面）

```
┌────────────────────────────────────────────────────────┐
│  ← 戻る                      アーケードモード設定     │
├────────────────────────────────────────────────────────┤
│                                                        │
│  【キャラクター選択】                                  │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐                │
│  │霊夢  │ │魔理沙│ │咲夜  │ │妖夢  │                │
│  │  ●  │ │(未)  │ │(未)  │ │(未)  │                │
│  └──────┘ └──────┘ └──────┘ └──────┘                │
│                                                        │
│  【難易度選択】                                        │
│    ○ Easy    ● Normal    ○ Hard                      │
│                                                        │
├────────────────────────────────────────────────────────┤
│  キャラクター情報:                                     │
│  HP: 150  ATK: 25  DEF: 10  SPD: 5.0                  │
│  Q: 追尾弾  W: 貫通弾  E: ダッシュ  R: 夢想封印       │
├────────────────────────────────────────────────────────┤
│                                   [次へ →]            │
└────────────────────────────────────────────────────────┘
```

**注意:** D/Fスキル選択はここでは行わない（StageIntroSceneで選択）

### 4.4 PracticeSetupScene（練習モード設定画面）

```
┌────────────────────────────────────────────────────────┐
│  ← 戻る                         練習モード設定        │
├────────────────────────────────────────────────────────┤
│                                                        │
│  【キャラクター選択】         【難易度選択】           │
│  ┌──────┐                      ○ Easy                 │
│  │霊夢  │                      ● Normal               │
│  │  ●  │                      ○ Hard                 │
│  └──────┘                                              │
│                                                        │
│  【ステージ選択】                                      │
│  ┌──────┬──────┬──────┬──────┬──────┬──────┐        │
│  │ ST1  │ ST2  │ ST3  │ ST4  │ ST5  │ ST6  │        │
│  │ルーミア│(未) │(未) │(未) │(未) │(未) │        │
│  │  ●  │      │      │      │      │      │        │
│  └──────┴──────┴──────┴──────┴──────┴──────┘        │
│                                                        │
│  【練習対象】                                          │
│    ● ステージ全体  ○ 道中のみ  ○ ボスのみ            │
│                                                        │
│  【練習オプション】                                    │
│    ☑ 残機無限  ☐ 無敵モード  ☐ 当たり判定表示        │
│    ☐ スローモード (50%)                               │
│                                                        │
├────────────────────────────────────────────────────────┤
│                                   [次へ →]            │
└────────────────────────────────────────────────────────┘
```

**注意:** D/Fスキル選択はここでは行わない（StageIntroSceneで選択）

### 4.5 StageIntroScene（ステージ開始前画面）【新規】

各ステージ開始前に表示される画面。D/Fスキル選択が攻略の鍵となる。

```
┌────────────────────────────────────────────────────────┐
│                                                        │
│                     STAGE 1                            │
│                                                        │
│              ╔══════════════════════╗                 │
│              ║                      ║                 │
│              ║      ルーミア        ║                 │
│              ║    〜宵闇の妖怪〜    ║                 │
│              ║                      ║                 │
│              ╚══════════════════════╝                 │
│                                                        │
│   ─────────────────────────────────────────────────   │
│                                                        │
│              【サモナースキル選択】                    │
│                                                        │
│    ┌────────────────┐      ┌────────────────┐        │
│    │ D: フラッシュ  │      │ F: ヒール      │        │
│    │    [変更 ▼]   │      │    [変更 ▼]   │        │
│    └────────────────┘      └────────────────┘        │
│                                                        │
│    スキル説明:                                         │
│    D - 短距離瞬間移動。緊急回避に最適。               │
│    F - HPを30%回復。持久戦に有効。                    │
│                                                        │
│   ─────────────────────────────────────────────────   │
│                                                        │
│    ヒント: ルーミアは闇の弾幕を多用します。           │
│           回避スキルがあると安心です。                 │
│                                                        │
│                      [出撃]                            │
│                                                        │
│                   Press Space to Start                 │
└────────────────────────────────────────────────────────┘
```

**要素:**
- ステージ番号とボス名の表示
- ボスのビジュアル/シルエット
- D/Fスキル選択（ドロップダウンまたはカルーセル）
- 選択中スキルの説明
- ステージ/ボスに関するヒント（初回プレイ時に有用）
- 出撃ボタン

### 4.6 PauseScene（一時停止画面 - オーバーレイ）

```
┌────────────────────────────────────────────────────────┐
│░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│
│░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│
│░░░░░░░░░░░░░┌─────────────────────┐░░░░░░░░░░░░░░░░░░│
│░░░░░░░░░░░░░│                     │░░░░░░░░░░░░░░░░░░│
│░░░░░░░░░░░░░│      PAUSE          │░░░░░░░░░░░░░░░░░░│
│░░░░░░░░░░░░░│                     │░░░░░░░░░░░░░░░░░░│
│░░░░░░░░░░░░░│   ▶ 再開           │░░░░░░░░░░░░░░░░░░│
│░░░░░░░░░░░░░│     リスタート      │░░░░░░░░░░░░░░░░░░│
│░░░░░░░░░░░░░│     オプション      │░░░░░░░░░░░░░░░░░░│
│░░░░░░░░░░░░░│     タイトルへ      │░░░░░░░░░░░░░░░░░░│
│░░░░░░░░░░░░░│                     │░░░░░░░░░░░░░░░░░░│
│░░░░░░░░░░░░░└─────────────────────┘░░░░░░░░░░░░░░░░░░│
│░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│
│░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│
└────────────────────────────────────────────────────────┘
```

**実装方針:** GameSceneを一時停止状態にし、上にオーバーレイとして表示

### 4.7 ResultScene（リザルト画面）

```
┌────────────────────────────────────────────────────────┐
│                                                        │
│                   STAGE 1 CLEAR!                       │
│                                                        │
│                      ╔═══╗                             │
│                      ║ S ║  ← ランク                  │
│                      ╚═══╝                             │
│                                                        │
│   ┌────────────────────────────────────────┐          │
│   │  スコア:           1,234,567           │          │
│   │  クリアタイム:     03:45.67            │          │
│   │  撃破数:           156                 │          │
│   │  被弾回数:         3                   │          │
│   │  残機:             2                   │          │
│   │  最大コンボ:       42                  │          │
│   └────────────────────────────────────────┘          │
│                                                        │
│   ハイスコア更新！  NEW RECORD!                        │
│                                                        │
│   [次のステージへ] [リトライ] [モード選択] [タイトル] │
└────────────────────────────────────────────────────────┘
```

### 4.8 GameOverScene（ゲームオーバー画面）

```
┌────────────────────────────────────────────────────────┐
│                                                        │
│                    GAME OVER                           │
│                                                        │
│                                                        │
│   ┌────────────────────────────────────────┐          │
│   │  到達ステージ:     Stage 1             │          │
│   │  スコア:           567,890             │          │
│   │  プレイ時間:       02:15.34            │          │
│   │  撃破数:           89                  │          │
│   └────────────────────────────────────────┘          │
│                                                        │
│                                                        │
│       [コンティニュー]  [リトライ]  [タイトルへ]      │
│                                                        │
│              ※コンティニューはスコアがリセットされます │
└────────────────────────────────────────────────────────┘
```

---

## 5. シーン遷移管理

### 5.1 SceneManager設計

```typescript
// src/managers/SceneManager.ts

interface SceneTransitionData {
  from: string;
  to: string;
  data?: any;
  transition?: TransitionType;
}

type TransitionType = 'fade' | 'slide' | 'none';

class SceneManager {
  private static instance: SceneManager;
  private currentScene: string;
  private sceneStack: string[] = [];

  // シーン遷移
  goTo(sceneName: string, data?: any, transition?: TransitionType): void;

  // オーバーレイシーン（PauseScene等）
  pushOverlay(sceneName: string, data?: any): void;
  popOverlay(): void;

  // 戻る（スタック使用）
  goBack(data?: any): void;

  // 特定シーンまで戻る
  goBackTo(sceneName: string, data?: any): void;
}
```

### 5.2 シーン間データ受け渡し

```typescript
// SetupScene → StageIntroScene へのデータ
interface StageIntroData {
  mode: GameMode;
  character: CharacterType;
  difficulty: DifficultyLevel;
  stageNumber: number;
  // アーケードモード継続時
  continueData?: {
    score: number;
    lives: number;
  };
  // 練習モード専用
  practiceConfig?: PracticeModeConfig;
}

// StageIntroScene → GameScene へのデータ
interface GameStartData {
  mode: GameMode;
  character: CharacterType;
  difficulty: DifficultyLevel;
  stageNumber: number;
  summonerSkills: SummonerSkillConfig;  // ここでD/Fスキルが決定
  // アーケードモード継続時
  continueData?: {
    score: number;
    lives: number;
  };
  // 練習モード専用
  practiceConfig?: PracticeModeConfig;
}

// GameScene → ResultScene へのデータ
interface ResultData {
  mode: GameMode;
  stage: number;
  score: number;
  time: number;
  kills: number;
  damage: number;
  lives: number;
  maxCombo: number;
  rank: RankType;
  isHighScore: boolean;
  // 次ステージ用（ResultScene → StageIntroScene）
  nextStageData?: StageIntroData;
}
```

---

## 6. 状態管理（Zustand）

### 6.1 GameStore拡張

```typescript
// src/stores/gameStore.ts

interface GameState {
  // 現在のモード
  currentMode: GameMode | null;

  // 選択状態
  selectedCharacter: CharacterType;
  selectedDifficulty: DifficultyLevel;
  selectedStage: number;
  summonerSkills: SummonerSkillConfig;

  // ゲームプレイ状態
  currentStage: number;
  score: number;
  lives: number;
  playTime: number;

  // 練習モード状態
  practiceOptions: PracticeOptions;

  // 統計
  statistics: GameStatistics;

  // アクション
  setGameMode: (mode: GameMode) => void;
  setCharacter: (char: CharacterType) => void;
  setDifficulty: (diff: DifficultyLevel) => void;
  setSummonerSkills: (skills: SummonerSkillConfig) => void;
  startGame: (config: GameStartData) => void;
  updateScore: (score: number) => void;
  loseLife: () => void;
  clearStage: () => void;
  gameOver: () => void;
  reset: () => void;
}

interface GameStatistics {
  totalKills: number;
  totalDamageDealt: number;
  totalDamageTaken: number;
  hitCount: number;
  maxCombo: number;
  bossDefeated: string[];
}
```

---

## 7. 実装優先順位

### Phase 1: 基本シーン構造
1. SceneManager実装
2. TitleScene実装
3. ModeSelectScene実装
4. 基本的なシーン遷移

### Phase 2: ゲーム設定画面
1. ArcadeSetupScene実装
2. キャラクター選択UI
3. 難易度選択UI
4. GameSceneへの連携

### Phase 3: ゲーム終了フロー
1. ResultScene実装
2. GameOverScene実装
3. PauseScene実装（オーバーレイ）
4. スコア・統計システム

### Phase 4: 練習モード
1. PracticeSetupScene実装
2. ステージ選択UI
3. 練習オプションシステム
4. 練習モード用GameScene調整

### Phase 5: 追加機能
1. OptionScene実装
2. CreditScene実装
3. トランジションエフェクト
4. BGM/SE連携

---

## 8. 技術的考慮事項

### 8.1 Phaserシーン管理

```typescript
// Phaserのシーン管理方法
this.scene.start('SceneName', data);  // シーン切り替え
this.scene.launch('OverlayScene');     // オーバーレイ起動
this.scene.pause('GameScene');         // 一時停止
this.scene.resume('GameScene');        // 再開
this.scene.stop('OverlayScene');       // オーバーレイ終了
```

### 8.2 シーン登録

```typescript
// src/main.ts
const config: Phaser.Types.Core.GameConfig = {
  // ...
  scene: [
    BootScene,
    TitleScene,
    ModeSelectScene,
    ArcadeSetupScene,
    PracticeSetupScene,
    StageIntroScene,    // 新規追加
    GameScene,
    PauseScene,
    ResultScene,
    GameOverScene,
    OptionScene,
    CreditScene
  ],
};
```

### 8.3 シーンのライフサイクル

```typescript
class ExampleScene extends Phaser.Scene {
  init(data: any) {
    // シーン開始時、データ受け取り
  }

  preload() {
    // シーン固有アセット読み込み
  }

  create() {
    // シーン構築
  }

  update(time: number, delta: number) {
    // 毎フレーム更新
  }

  shutdown() {
    // シーン終了時クリーンアップ
  }
}
```

---

## 9. ファイル構成

```
src/
├── scenes/
│   ├── BootScene.ts          (既存)
│   ├── TitleScene.ts         (新規)
│   ├── ModeSelectScene.ts    (新規)
│   ├── ArcadeSetupScene.ts   (新規)
│   ├── PracticeSetupScene.ts (新規)
│   ├── StageIntroScene.ts    (新規) ← D/Fスキル選択画面
│   ├── GameScene.ts          (既存・修正: 道中→ボスのシンプル構成)
│   ├── PauseScene.ts         (新規)
│   ├── ResultScene.ts        (新規)
│   ├── GameOverScene.ts      (新規)
│   ├── OptionScene.ts        (新規)
│   └── CreditScene.ts        (新規)
├── managers/
│   └── SceneManager.ts       (新規)
├── stores/
│   └── gameStore.ts          (新規)
├── ui/
│   └── components/
│       ├── menu/
│       │   ├── MenuButton.ts         (新規)
│       │   ├── CharacterCard.ts      (新規)
│       │   ├── DifficultySelector.ts (新規)
│       │   ├── StageSelector.ts      (新規)
│       │   └── SummonerSkillSelector.ts (新規) ← D/Fスキル選択UI
│       └── ...
└── types/
    └── index.ts              (既存・拡張)
```

---

## 10. 変更履歴

| 日付 | バージョン | 変更内容 |
|------|------------|----------|
| 2025-12-10 | 1.0 | 初版作成 |
| 2025-12-10 | 1.1 | StageIntroScene追加（D/Fスキルを各ステージ前に選択）、中ボス削除、GameSceneを道中→ボスにシンプル化 |
