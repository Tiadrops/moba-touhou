/**
 * ダメージ計算ユーティリティ
 *
 * ダメージ計算式:
 * - AA: (攻撃力 × AAダメージ増幅 × クリティカル倍率) × 防御軽減
 * - スキル: (固定値 + 攻撃力 × 増幅率 × その他補正) × 防御軽減
 * - 防御軽減: 100 / (防御力 + 100)
 */

import { CombatStats, SkillDamageConfig, DamageResult } from '@/types';

/** クリティカルダメージ倍率 */
export const CRITICAL_MULTIPLIER = 1.5;

/** 最小ダメージ（防御力による軽減後の最低保証） */
export const MIN_DAMAGE = 1;

/**
 * ダメージ計算クラス
 */
export class DamageCalculator {
  /**
   * 通常攻撃（AA）ダメージを計算
   * @param attacker 攻撃者のステータス
   * @param defender 防御者のステータス
   * @returns ダメージ結果
   */
  static calculateAADamage(
    attacker: CombatStats,
    defender: CombatStats
  ): DamageResult {
    // クリティカル判定
    const isCritical = Math.random() < attacker.critChance;
    const critMultiplier = isCritical ? CRITICAL_MULTIPLIER : 1.0;

    // 基礎AAダメージ = 攻撃力 × AAダメージ増幅 × クリティカル倍率
    const rawDamage =
      attacker.attackPower * attacker.aaMultiplier * critMultiplier;

    // 防御力適用
    return this.applyDefenseAndCreateResult(rawDamage, defender.defense, isCritical);
  }

  /**
   * スキルダメージを計算
   * @param attacker 攻撃者のステータス
   * @param defender 防御者のステータス
   * @param skillConfig スキルダメージ設定
   * @returns ダメージ結果
   */
  static calculateSkillDamage(
    attacker: CombatStats,
    defender: CombatStats,
    skillConfig: SkillDamageConfig
  ): DamageResult {
    const additionalMultiplier = skillConfig.additionalMultiplier ?? 1.0;

    // スキルダメージ = 固定値 + (攻撃力 × 増幅率) × その他補正
    const rawDamage =
      skillConfig.baseDamage +
      attacker.attackPower * skillConfig.scalingRatio * additionalMultiplier;

    // 防御力適用（スキルはクリティカルなし）
    return this.applyDefenseAndCreateResult(rawDamage, defender.defense, false);
  }

  /**
   * 固定ダメージを計算（防御無視）
   * @param damage 固定ダメージ値
   * @returns ダメージ結果
   */
  static calculateTrueDamage(damage: number): DamageResult {
    return {
      rawDamage: damage,
      finalDamage: Math.max(damage, MIN_DAMAGE),
      isCritical: false,
      damageReduction: 0,
    };
  }

  /**
   * 防御力による軽減率を計算
   * @param defense 防御力
   * @returns 軽減率（0.0 - 1.0）
   */
  static calculateDamageReduction(defense: number): number {
    // 軽減率 = 100 / (防御力 + 100)
    // 防御力0 -> 100%, 防御力100 -> 50%, 防御力200 -> 33%
    return 100 / (defense + 100);
  }

  /**
   * 防御力を適用してダメージ結果を作成
   * @param rawDamage 防御適用前ダメージ
   * @param defense 防御力
   * @param isCritical クリティカル発動
   * @returns ダメージ結果
   */
  private static applyDefenseAndCreateResult(
    rawDamage: number,
    defense: number,
    isCritical: boolean
  ): DamageResult {
    const damageReduction = this.calculateDamageReduction(defense);
    const finalDamage = Math.max(
      Math.floor(rawDamage * damageReduction),
      MIN_DAMAGE
    );

    return {
      rawDamage,
      finalDamage,
      isCritical,
      damageReduction: 1 - damageReduction,
    };
  }

  /**
   * バフを適用したステータスを計算
   * @param baseStats 基礎ステータス
   * @param buffs バフ配列
   * @returns バフ適用後のステータス
   */
  static applyBuffsToStats(
    baseStats: CombatStats,
    buffs: { type: string; multiplier: number }[]
  ): CombatStats {
    const result = { ...baseStats };

    for (const buff of buffs) {
      switch (buff.type) {
        case 'attack_speed':
          result.attackSpeed *= buff.multiplier;
          break;
        case 'move_speed':
          result.moveSpeed *= buff.multiplier;
          break;
        case 'attack_power':
          result.attackPower *= buff.multiplier;
          break;
        case 'aa_multiplier':
          result.aaMultiplier *= buff.multiplier;
          break;
        case 'defense':
          result.defense *= buff.multiplier;
          break;
        case 'crit_chance':
          // クリティカル確率は加算（上限1.0）
          result.critChance = Math.min(
            result.critChance + (buff.multiplier - 1),
            1.0
          );
          break;
        case 'damage':
          // 旧DAMAGEバフは攻撃力に適用
          result.attackPower *= buff.multiplier;
          break;
      }
    }

    return result;
  }

  /**
   * 実効攻撃間隔を計算（ミリ秒）
   * @param attackSpeed 攻撃速度
   * @returns 攻撃間隔（ms）
   */
  static calculateAttackInterval(attackSpeed: number): number {
    return 1000 / attackSpeed;
  }
}
