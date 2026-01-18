# SE一覧

このドキュメントはゲーム内で使用されているSE（効果音）の一覧です。
SEを追加した場合はこのファイルに追記してください。

## UI系SE

| SEキー | ファイル | 行 | 用途 | 音量倍率 |
|--------|----------|-----|------|---------|
| `se_select` | TitleScene.ts | 194 | メニュー選択 | 1.0 |
| `se_select` | PauseScene.ts | 242, 345, 483, 501, 540, 852 | メニュー選択 | 1.0 |
| `se_select` | ModeSelectScene.ts | 169 | メニュー選択 | 1.0 |
| `se_decision` | TitleScene.ts | 214 | 決定 | 1.0 |
| `se_decision` | PauseScene.ts | 226, 353, 548, 604 | 決定 | 1.0 |
| `se_decision` | ModeSelectScene.ts | 221 | 決定 | 1.0 |
| `se_cancel` | PauseScene.ts | 327, 362, 575 | キャンセル | 1.0 |
| `se_cancel` | ModeSelectScene.ts | 235 | キャンセル | 1.0 |
| `se_cancel` | OptionScene.ts | 242 | キャンセル | 1.0 |
| `se_cancel` | CreditScene.ts | 88 | キャンセル | 1.0 |
| `se_pause` | GameScene.ts | 434 | ポーズ | 1.0 |
| `se_pause` | MidStageScene.ts | 2440 | ポーズ | 1.0 |

## 戦闘系SE（プレイヤー）

| SEキー | ファイル | 行 | 用途 | 音量倍率 |
|--------|----------|-----|------|---------|
| `se_hit_arrow` | MidStageScene.ts | 2487, 2557 | プレイヤー攻撃ヒット | 1.0 |
| `se_hit_arrow` | Player.ts | 749 | Eスキルヒット | 1.0 |
| `se_hit_arrow` | SkillProjectile.ts | 332 | スキル弾ヒット | 1.0 |
| `se_hit_player` | Player.ts | 1059 | プレイヤー被弾 | 1.0 |

## 戦闘系SE（雑魚敵）

| SEキー | ファイル | 行 | 用途 | 音量倍率 |
|--------|----------|-----|------|---------|
| `se_enep00` | MobEnemy.ts | 1328 | 雑魚撃破 | 1.0 |
| `se_tan00` | MobGroupA.ts | 334 | A-1弾幕発射 | 0.6 |
| `se_tan00` | MobGroupA.ts | 387 | A-2弾幕発射 | 0.6 |
| `se_tan00` | MobGroupA.ts | 444 | A-3弾幕発射 | 0.6 |
| `se_tan00` | MobGroupA.ts | 489 | A-4弾幕発射 | 0.6 |
| `se_tan00` | MobGroupA.ts | 532 | A-5弾幕発射 | 0.6 |
| `se_tan00` | MobGroupA.ts | 604 | A-6弾幕発射 | 0.6 |
| `se_tan00` | MobGroupB.ts | 411 | B-1オーブ弾発射 | 0.6 |
| `se_gun00` | MobGroupB.ts | 577 | B-2レーザー発射 | 0.6 |

## 戦闘系SE（B-3スキル）

| SEキー | ファイル | 行 | 用途 | 音量倍率 |
|--------|----------|-----|------|---------|
| `se_rupture` | MobGroupB.ts | 841 | ラプチャー発動 | 1.0 |
| `se_scream` | MobGroupB.ts | 1076 | スクリーム発動 | 1.0 |

## 戦闘系SE（B-4スキル）

| SEキー | ファイル | 行 | 用途 | 音量倍率 |
|--------|----------|-----|------|---------|
| `se_fixed_shot` | MobGroupB.ts | 1351 | 固定射撃（1発ごと） | 0.75 |
| `se_moving` | MobGroupB.ts | 1393 | ムービング発動 | 1.0 |
| `se_fear` | MobGroupB.ts | 1575 | 恐怖弾発動 | 1.0 |

## 戦闘系SE（C-1スキル）

| SEキー | ファイル | 行 | 用途 | 音量倍率 |
|--------|----------|-----|------|---------|
| `se_obliterate` | MobGroupC.ts | 441 | オブリテレイト発動 | 1.5 |
| `se_death_grasp` | MobGroupC.ts | 461 | デスグラスプ発動 | 1.5 |

## 戦闘系SE（C-2 Hisuiスキル）

| SEキー | ファイル | 行 | 用途 | 音量倍率 |
|--------|----------|-----|------|---------|
| `se_hisui_e` | MobGroupC.ts | 789 | Eスキル発動 | 1.0 |
| `se_hisui_w2` | MobGroupC.ts | 1054 | W2スキルヒット | 1.0 |
| `se_hisui_r1` | MobGroupC.ts | 1118 | Rスキル半円発動 | 1.0 |
| `se_hisui_r2` | MobGroupC.ts | 1086 | Rスキル矩形発動 | 1.0 |

## サモナースキルSE

| SEキー | ファイル | 行 | 用途 | 音量倍率 |
|--------|----------|-----|------|---------|
| `se_flash` | SummonerSkillManager.ts | 169 | フラッシュ発動 | 1.0 |
| `se_spirit` | SummonerSkillManager.ts | 212 | 霊撃(α)発動 | 1.0 |
| `se_spirit` | SummonerSkillManager.ts | 312 | 霊撃(β)発動 | 1.0 |
| `se_guard_start` | SummonerSkillManager.ts | 244 | ガード反撃発動 | 1.5 |
| `se_guard_success` | SummonerSkillManager.ts | 329 | ガード成功 | 1.5 |
| `se_hit_enemy` | SummonerSkillManager.ts | 418 | ガード反撃ヒット | 1.0 |
| `se_control` | SummonerSkillManager.ts | 274 | 制御棒発動 | 1.0 |

## ボス系SE

| SEキー | ファイル | 行 | 用途 | 音量倍率 |
|--------|----------|-----|------|---------|
| `se_hit_enemy` | Boss.ts | 431 | ボスへのヒット | 1.0 |
| `se_break` | Boss.ts | 214 | スペルカードブレイク | 1.0 |
| `se_break` | Rumia.ts | 408, 417 | ルーミアスペル終了 | 1.0 |
| `se_shot1` | Rumia.ts | 1346, 1712, 2190, 2772 | ルーミア弾発射 | 1.0 |
| `se_shot1_multi` | Rumia.ts | 1058, 3009 | ルーミア複数弾発射 | 1.0 |
| `se_spellcard` | SpellCardCutIn.ts | 123 | スペルカード宣言 | 1.0 |
| `se_spellcard` | SpellCardCutInV2.ts | 318 | スペルカード宣言 | 1.0 |
| `se_spellcard` | MidStageScene.ts | 2079 | カットイン演出 | 1.0 |
| `se_boss_defeat` | GameScene.ts | 838 | ボス撃破 | 1.0 |

## SEファイル一覧

| SEキー | ファイルパス |
|--------|-------------|
| `se_select` | sound/se/select.mp3 |
| `se_decision` | sound/se/decision.mp3 |
| `se_cancel` | sound/se/cancel.mp3 |
| `se_pause` | sound/se/pause.mp3 |
| `se_shot1` | sound/se/shot1.mp3 |
| `se_shot1_multi` | sound/se/shot1_multi.mp3 |
| `se_break` | sound/se/break.mp3 |
| `se_hit_player` | sound/se/hit_player.mp3 |
| `se_hit_enemy` | sound/se/hit_enemy.mp3 |
| `se_spellcard` | sound/se/spellcard.mp3 |
| `se_enep00` | sound/se/se_enep00.mp3 |
| `se_hit_arrow` | sound/se/se_hisou_orizin_009.mp3 |
| `se_tan00` | sound/se/se_tan00.wav |
| `se_gun00` | sound/se/se_gun00.wav |
| `se_death_grasp` | sound/se/koma_020.wav |
| `se_obliterate` | sound/se/ten_010.mp3 |
| `se_hisui_e` | sound/se/lab_suburi.mp3 |
| `se_hisui_w2` | sound/se/lab_kennuku.mp3 |
| `se_hisui_r1` | sound/se/lab_ken5_a.mp3 |
| `se_hisui_r2` | sound/se/lab_ken6_a.mp3 |
| `se_rupture` | sound/se/lab_kaizyuu.mp3 |
| `se_scream` | sound/se/lab_doragon.mp3 |
| `se_fixed_shot` | sound/se/shot1_plus20hz.mp3 |
| `se_moving` | sound/se/H_alice_002.mp3 |
| `se_fear` | sound/se/lab_kenzyu.mp3 |
| `se_boss_defeat` | sound/se/se_enep01.mp3 |
| `se_flash` | sound/se/H_reimu_006.mp3 |
| `se_spirit` | sound/se/nc159380.mp3 |
| `se_guard_start` | sound/se/on_tuba04.mp3 |
| `se_guard_success` | sound/se/on_saber.mp3 |
| `se_control` | sound/se/nc229363.mp3 |
