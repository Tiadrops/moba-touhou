import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * 音量設定の型定義
 */
export interface VolumeSettings {
  master: number;   // マスター音量 (0-100)
  bgm: number;      // BGM音量 (0-100)
  se: number;       // SE音量 (0-100)
}

/**
 * 設定ストアの状態
 */
interface SettingsState {
  volume: VolumeSettings;

  // アクション
  setMasterVolume: (value: number) => void;
  setBgmVolume: (value: number) => void;
  setSeVolume: (value: number) => void;
  resetToDefaults: () => void;
}

/**
 * デフォルト音量設定
 * マスター: 100%, BGM/SE: 20%
 */
const DEFAULT_VOLUME: VolumeSettings = {
  master: 100,
  bgm: 20,
  se: 20,
};

/**
 * 設定ストア（localStorageに永続化）
 */
export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      volume: { ...DEFAULT_VOLUME },

      setMasterVolume: (value: number) =>
        set((state) => ({
          volume: { ...state.volume, master: Math.max(0, Math.min(100, value)) },
        })),

      setBgmVolume: (value: number) =>
        set((state) => ({
          volume: { ...state.volume, bgm: Math.max(0, Math.min(100, value)) },
        })),

      setSeVolume: (value: number) =>
        set((state) => ({
          volume: { ...state.volume, se: Math.max(0, Math.min(100, value)) },
        })),

      resetToDefaults: () =>
        set({ volume: { ...DEFAULT_VOLUME } }),
    }),
    {
      name: 'moba-touhou-settings',
    }
  )
);

/**
 * ストアから直接値を取得するヘルパー関数
 * （Phaser内など、Reactコンポーネント外で使用）
 */
export const getVolumeSettings = (): VolumeSettings => {
  return useSettingsStore.getState().volume;
};

/**
 * 実効音量を計算（マスター × 個別音量）
 */
export const getEffectiveVolume = (type: 'bgm' | 'se'): number => {
  const { master, bgm, se } = useSettingsStore.getState().volume;
  const individual = type === 'bgm' ? bgm : se;
  return (master / 100) * (individual / 100);
};
