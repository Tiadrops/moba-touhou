import Phaser from 'phaser';
import { SCENES, GAME_CONFIG } from '@/config/GameConfig';
import { VolumeSlider } from '@/ui/components/VolumeSlider';
import { useSettingsStore } from '@/stores/settingsStore';
import { AudioManager } from '@/systems/AudioManager';

/**
 * OptionScene - オプション画面
 * 音量設定などのゲーム設定を管理
 */
export class OptionScene extends Phaser.Scene {
  private sliders: VolumeSlider[] = [];
  private selectedIndex: number = 0;

  constructor() {
    super({ key: SCENES.OPTION });
  }

  create(): void {
    this.cameras.main.fadeIn(300);

    const centerX = GAME_CONFIG.WIDTH / 2;

    // 背景
    this.add.rectangle(0, 0, GAME_CONFIG.WIDTH, GAME_CONFIG.HEIGHT, 0x1a1a2e)
      .setOrigin(0);

    // タイトル
    this.add.text(centerX, 100, 'オプション', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '48px',
      color: '#ffffff',
    }).setOrigin(0.5);

    // サウンド設定セクション
    this.add.text(centerX, 200, '― サウンド設定 ―', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '28px',
      color: '#888888',
    }).setOrigin(0.5);

    // 現在の音量設定を取得
    const { volume } = useSettingsStore.getState();
    const store = useSettingsStore.getState();

    // マスター音量スライダー
    const masterSlider = new VolumeSlider(this, {
      x: centerX + 80,
      y: 300,
      width: 300,
      label: 'マスター',
      initialValue: volume.master,
      onChange: (value) => {
        store.setMasterVolume(value);
      },
    });
    this.sliders.push(masterSlider);

    // BGM音量スライダー
    const bgmSlider = new VolumeSlider(this, {
      x: centerX + 80,
      y: 380,
      width: 300,
      label: 'BGM',
      initialValue: volume.bgm,
      onChange: (value) => {
        store.setBgmVolume(value);
      },
    });
    this.sliders.push(bgmSlider);

    // SE音量スライダー
    const seSlider = new VolumeSlider(this, {
      x: centerX + 80,
      y: 460,
      width: 300,
      label: 'SE',
      initialValue: volume.se,
      onChange: (value) => {
        store.setSeVolume(value);
      },
    });
    this.sliders.push(seSlider);

    // 初期値に戻すボタン
    this.createResetButton(centerX, 560);

    // 戻るボタン
    this.createBackButton();

    // キーボード入力
    this.setupKeyboardInput();

    // 注意書き
    this.add.text(centerX, GAME_CONFIG.HEIGHT - 150, '設定は自動的に保存されます', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '18px',
      color: '#666666',
    }).setOrigin(0.5);

    // 操作説明
    this.add.text(centerX, GAME_CONFIG.HEIGHT - 100, 'ESC: 戻る', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '16px',
      color: '#555555',
    }).setOrigin(0.5);
  }

  /**
   * 初期値に戻すボタン
   */
  private createResetButton(x: number, y: number): void {
    const resetButton = this.add.text(x, y, '初期値に戻す', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '24px',
      color: '#888888',
      backgroundColor: '#2a2a4e',
      padding: { x: 20, y: 10 },
    }).setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    resetButton.on('pointerover', () => {
      resetButton.setColor('#ffffff');
      resetButton.setBackgroundColor('#3a3a5e');
    });

    resetButton.on('pointerout', () => {
      resetButton.setColor('#888888');
      resetButton.setBackgroundColor('#2a2a4e');
    });

    resetButton.on('pointerdown', () => {
      this.resetToDefaults();
    });
  }

  /**
   * 設定を初期値に戻す
   */
  private resetToDefaults(): void {
    const store = useSettingsStore.getState();
    store.resetToDefaults();

    // スライダーの表示を更新
    const { volume } = useSettingsStore.getState();
    this.sliders[0]?.setValue(volume.master);
    this.sliders[1]?.setValue(volume.bgm);
    this.sliders[2]?.setValue(volume.se);

    // フィードバック表示
    const feedbackText = this.add.text(
      GAME_CONFIG.WIDTH / 2,
      620,
      '初期値に戻しました',
      {
        fontFamily: 'Arial, sans-serif',
        fontSize: '20px',
        color: '#00ff88',
      }
    ).setOrigin(0.5);

    this.tweens.add({
      targets: feedbackText,
      alpha: 0,
      duration: 1500,
      onComplete: () => feedbackText.destroy(),
    });
  }

  /**
   * 戻るボタン
   */
  private createBackButton(): void {
    const backButton = this.add.text(50, 50, '← 戻る', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '24px',
      color: '#aaaaaa',
    }).setInteractive({ useHandCursor: true });

    backButton.on('pointerover', () => backButton.setColor('#ffffff'));
    backButton.on('pointerout', () => backButton.setColor('#aaaaaa'));
    backButton.on('pointerdown', () => this.goBack());
  }

  /**
   * キーボード入力設定
   */
  private setupKeyboardInput(): void {
    this.input.keyboard?.on('keydown-ESC', () => {
      this.goBack();
    });

    // 左右キーでスライダー値を調整
    this.input.keyboard?.on('keydown-LEFT', () => {
      this.adjustSelectedSlider(-5);
    });

    this.input.keyboard?.on('keydown-RIGHT', () => {
      this.adjustSelectedSlider(5);
    });

    // 上下キーでスライダー選択
    this.input.keyboard?.on('keydown-UP', () => {
      this.selectedIndex = Math.max(0, this.selectedIndex - 1);
    });

    this.input.keyboard?.on('keydown-DOWN', () => {
      this.selectedIndex = Math.min(this.sliders.length - 1, this.selectedIndex + 1);
    });
  }

  /**
   * 選択中のスライダーの値を調整
   */
  private adjustSelectedSlider(delta: number): void {
    const slider = this.sliders[this.selectedIndex];
    if (slider) {
      const newValue = Math.max(0, Math.min(100, slider.getValue() + delta));
      slider.setValue(newValue);

      // ストアも更新
      const store = useSettingsStore.getState();
      switch (this.selectedIndex) {
        case 0:
          store.setMasterVolume(newValue);
          break;
        case 1:
          store.setBgmVolume(newValue);
          break;
        case 2:
          store.setSeVolume(newValue);
          break;
      }
    }
  }

  /**
   * タイトルに戻る
   */
  private goBack(): void {
    // キャンセルSEを再生
    AudioManager.getInstance().playSe('se_cancel');

    // カーソルをデフォルトに戻す
    this.input.setDefaultCursor('default');

    this.cameras.main.fadeOut(300, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start(SCENES.TITLE);
    });
  }

  /**
   * クリーンアップ
   */
  shutdown(): void {
    this.sliders.forEach(slider => slider.destroy());
    this.sliders = [];
  }
}
