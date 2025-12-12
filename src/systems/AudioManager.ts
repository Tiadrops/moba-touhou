import Phaser from 'phaser';
import { useSettingsStore, getEffectiveVolume } from '@/stores/settingsStore';

/**
 * オーディオ管理システム
 * BGM・SEの再生と音量管理を一元化
 */
export class AudioManager {
  private static instance: AudioManager | null = null;

  private scene: Phaser.Scene | null = null;
  private currentBgm: Phaser.Sound.BaseSound | null = null;
  private currentBgmKey: string | null = null;

  // 音量変更の購読解除関数
  private unsubscribe: (() => void) | null = null;

  private constructor() {
    // シングルトン
  }

  /**
   * AudioManagerのインスタンスを取得
   */
  static getInstance(): AudioManager {
    if (!AudioManager.instance) {
      AudioManager.instance = new AudioManager();
    }
    return AudioManager.instance;
  }

  /**
   * シーンを設定し、音量変更を監視
   */
  initialize(scene: Phaser.Scene): void {
    this.scene = scene;

    // 前回の購読を解除
    if (this.unsubscribe) {
      this.unsubscribe();
    }

    // 音量設定の変更を監視
    this.unsubscribe = useSettingsStore.subscribe(() => {
      this.applyVolumeSettings();
    });

    // 初期音量を適用
    this.applyVolumeSettings();
  }

  /**
   * 現在のシーンを更新（シーン遷移時に呼び出し）
   */
  setScene(scene: Phaser.Scene): void {
    this.scene = scene;
    // AudioContextが停止している場合は再開を試みる
    this.tryResumeAudioContext();
  }

  /**
   * AudioContextの再開を試みる（ブラウザのAutoPlay Policy対策）
   */
  private tryResumeAudioContext(): void {
    if (!this.scene) return;

    const sound = this.scene.sound;
    if (sound && 'context' in sound) {
      const webAudioSound = sound as Phaser.Sound.WebAudioSoundManager;
      if (webAudioSound.context && webAudioSound.context.state === 'suspended') {
        webAudioSound.context.resume().then(() => {
          console.log('AudioContext resumed successfully');
        }).catch((err) => {
          console.warn('Failed to resume AudioContext:', err);
        });
      }
    }
  }

  /**
   * ユーザー操作時にAudioContextを再開（最初のクリック/タップで呼び出す）
   */
  resumeOnUserGesture(): void {
    this.tryResumeAudioContext();
  }

  /**
   * 音量設定を全てのサウンドに適用
   */
  private applyVolumeSettings(): void {
    // BGMの音量を更新
    if (this.currentBgm && 'setVolume' in this.currentBgm) {
      const bgmVolume = getEffectiveVolume('bgm');
      (this.currentBgm as Phaser.Sound.WebAudioSound).setVolume(bgmVolume);
    }
  }

  /**
   * BGMを再生
   * @param key オーディオキー
   * @param config 再生設定
   */
  playBgm(key: string, config?: Phaser.Types.Sound.SoundConfig): void {
    if (!this.scene) {
      console.warn('AudioManager: Scene not initialized');
      return;
    }

    // 同じBGMが既に再生中なら何もしない
    if (this.currentBgmKey === key && this.currentBgm?.isPlaying) {
      return;
    }

    // 現在のBGMを停止
    this.stopBgm();

    // 音量を計算
    const volume = getEffectiveVolume('bgm');

    // 新しいBGMを再生
    this.currentBgm = this.scene.sound.add(key, {
      loop: true,
      volume,
      ...config,
    });
    this.currentBgm.play();
    this.currentBgmKey = key;
  }

  /**
   * BGMを停止
   */
  stopBgm(): void {
    if (this.currentBgm) {
      this.currentBgm.stop();
      this.currentBgm.destroy();
      this.currentBgm = null;
      this.currentBgmKey = null;
    }
  }

  /**
   * BGMを一時停止
   */
  pauseBgm(): void {
    if (this.currentBgm && this.currentBgm.isPlaying) {
      this.currentBgm.pause();
    }
  }

  /**
   * BGMを再開
   */
  resumeBgm(): void {
    if (this.currentBgm && this.currentBgm.isPaused) {
      this.currentBgm.resume();
    }
  }

  /**
   * SEを再生
   * @param key オーディオキー
   * @param config 再生設定
   */
  playSe(key: string, config?: Phaser.Types.Sound.SoundConfig): void {
    if (!this.scene) {
      console.warn('AudioManager: Scene not initialized');
      return;
    }

    const volume = getEffectiveVolume('se');

    console.log(`[AudioManager] playSe('${key}'), volume=${volume}`);

    // 同じSEを短時間に複数回再生できるように、新しいサウンドインスタンスを作成
    const sound = this.scene.sound.add(key, {
      volume,
      ...config,
    });

    console.log(`[AudioManager] Sound created, playing...`);
    sound.play();

    // 再生完了後に自動的に破棄
    sound.once('complete', () => {
      sound.destroy();
    });
  }

  /**
   * プレビュー用SE再生（オプション画面で使用）
   */
  playPreviewSe(key: string): void {
    this.playSe(key);
  }

  /**
   * クリーンアップ
   */
  destroy(): void {
    this.stopBgm();
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
    this.scene = null;
    AudioManager.instance = null;
  }

  /**
   * 全サウンドをミュート/アンミュート
   */
  setMuted(muted: boolean): void {
    if (this.scene) {
      this.scene.sound.mute = muted;
    }
  }

  /**
   * ミュート状態を取得
   */
  isMuted(): boolean {
    return this.scene?.sound.mute ?? false;
  }
}
