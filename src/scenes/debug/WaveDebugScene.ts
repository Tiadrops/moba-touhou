import Phaser from 'phaser';
import { SCENES, GAME_CONFIG } from '@/config/GameConfig';
import { GameMode, CharacterType, Difficulty, GameStartData, WaveId, PracticeTarget, PracticeOptions } from '@/types';

/**
 * Wave選択データ
 */
interface WaveOption {
  id: string;
  label: string;
  waveId: WaveId;
  description: string;
}

/**
 * WaveDebugScene - Wave単位デバッグシーン
 * 特定のWaveから道中シーンを開始できるデバッグ用シーン
 */
export class WaveDebugScene extends Phaser.Scene {
  private menuItems: Phaser.GameObjects.Text[] = [];
  private selectedIndex: number = 0;
  private waveOptions: WaveOption[] = [];
  private descriptionText!: Phaser.GameObjects.Text;

  constructor() {
    super({ key: SCENES.WAVE_DEBUG });
  }

  create(): void {
    this.cameras.main.fadeIn(300);

    // 状態リセット
    this.menuItems = [];
    this.selectedIndex = 0;

    const centerX = GAME_CONFIG.WIDTH / 2;

    // 背景
    this.createBackground();

    // タイトル
    this.add.text(centerX, 80, 'WAVE DEBUG', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '48px',
      color: '#00ff88',
      stroke: '#000000',
      strokeThickness: 4,
    }).setOrigin(0.5);

    this.add.text(centerX, 130, '任意のWaveから道中シーンを開始', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '20px',
      color: '#888888',
    }).setOrigin(0.5);

    // Wave選択肢を作成
    this.createWaveOptions();

    // メニュー作成
    this.createMenu();

    // 説明テキスト
    this.descriptionText = this.add.text(centerX, GAME_CONFIG.HEIGHT - 150, '', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '18px',
      color: '#aaaaaa',
      align: 'center',
      wordWrap: { width: 600 },
    }).setOrigin(0.5);

    this.updateDescription();

    // キーボード入力
    this.setupKeyboardInput();
  }

  /**
   * Wave選択肢を作成
   */
  private createWaveOptions(): void {
    this.waveOptions = [
      // Wave 1-1 サブウェーブ
      {
        id: '1-1-1',
        label: 'Wave 1-1 (SubWave 1)',
        waveId: { stage: 1, wave: 1, subWave: 1 },
        description: 'A-1×10 (左上から出現、右カーブ退場)',
      },
      {
        id: '1-1-2',
        label: 'Wave 1-1 (SubWave 2)',
        waveId: { stage: 1, wave: 1, subWave: 2 },
        description: 'A-1×10 (右上から出現、左カーブ退場)\nSubWave 1の6秒後に追加',
      },
      {
        id: '1-1-3',
        label: 'Wave 1-1 (SubWave 3)',
        waveId: { stage: 1, wave: 1, subWave: 3 },
        description: 'A-2×2 + B-1 (左寄り陣形)\n8秒毎/4秒毎の弾幕',
      },
      {
        id: '1-1-4',
        label: 'Wave 1-1 (SubWave 4)',
        waveId: { stage: 1, wave: 1, subWave: 4 },
        description: 'A-2×2 + B-2 (右寄り陣形)\nSubWave 3のB-1撃破後or35秒経過で開始',
      },
      {
        id: '1-1-5',
        label: 'Wave 1-1 (SubWave 5)',
        waveId: { stage: 1, wave: 1, subWave: 5 },
        description: 'A-1 + A-3を1秒毎に計20回スポーン\n下降→発射→上昇退場',
      },
      {
        id: '1-1-6',
        label: 'Wave 1-1 (SubWave 6) ★',
        waveId: { stage: 1, wave: 1, subWave: 6 },
        description: 'B1 + B2 + C (フラグ持ち)\nC撃破でWaveクリア',
      },
      // Wave 1-2 サブウェーブ
      {
        id: '1-2-1',
        label: 'Wave 1-2 (SubWave 1)',
        waveId: { stage: 1, wave: 2, subWave: 1 },
        description: 'A-6×10 (左→右に水平移動)\n3秒毎に弾幕発射',
      },
      {
        id: '1-2-2',
        label: 'Wave 1-2 (SubWave 2)',
        waveId: { stage: 1, wave: 2, subWave: 2 },
        description: 'A-5×10 (右→左に水平移動)\n1-2-1の6秒後 or 全滅後に開始',
      },
      {
        id: '1-2-3',
        label: 'Wave 1-2 (SubWave 3)',
        waveId: { stage: 1, wave: 2, subWave: 3 },
        description: '両サイドから1→2→3順で出現\nA-6, A-4, A-5が1秒ずつ遅延スポーン',
      },
      {
        id: '1-2-4',
        label: 'Wave 1-2 (SubWave 4)',
        waveId: { stage: 1, wave: 2, subWave: 4 },
        description: '△◯△△陣形 (A-4,5,6 + B-3)\n下降→ランダム移動',
      },
      {
        id: '1-2-5',
        label: 'Wave 1-2 (SubWave 5)',
        waveId: { stage: 1, wave: 2, subWave: 5 },
        description: '△◯△△陣形 (A-4,5,6 + B-4)\n下降→ランダム移動',
      },
      {
        id: '1-2-6',
        label: 'Wave 1-2 (SubWave 6) ★',
        waveId: { stage: 1, wave: 2, subWave: 6 },
        description: 'C-2 + B-3（開始時）、B-4（5秒後）\n妖精リスポーンなし\nC-2撃破でボス戦へ移行',
      },
    ];
  }

  /**
   * 背景を作成
   */
  private createBackground(): void {
    const graphics = this.add.graphics();
    graphics.fillGradientStyle(0x1a2a1a, 0x1a2a1a, 0x1a1a2a, 0x1a1a2a, 1);
    graphics.fillRect(0, 0, GAME_CONFIG.WIDTH, GAME_CONFIG.HEIGHT);

    // グリッドパターン
    graphics.lineStyle(1, 0x333333, 0.3);
    const gridSize = 40;
    for (let x = 0; x < GAME_CONFIG.WIDTH; x += gridSize) {
      graphics.moveTo(x, 0);
      graphics.lineTo(x, GAME_CONFIG.HEIGHT);
    }
    for (let y = 0; y < GAME_CONFIG.HEIGHT; y += gridSize) {
      graphics.moveTo(0, y);
      graphics.lineTo(GAME_CONFIG.WIDTH, y);
    }
    graphics.strokePath();
  }

  /**
   * メニューを作成
   */
  private createMenu(): void {
    const centerX = GAME_CONFIG.WIDTH / 2;
    const menuStartY = 180;
    const lineHeight = 32;

    // Wave選択肢
    this.waveOptions.forEach((option, index) => {
      // フラグ持ちサブウェーブ（1-1-6, 1-2-6）を黄色で表示
      const isFlag = option.id === '1-1-6' || option.id === '1-2-6';
      const color = isFlag ? '#ffcc00' : '#ffffff';

      const menuItem = this.add.text(centerX, menuStartY + index * lineHeight, option.label, {
        fontFamily: 'Arial, sans-serif',
        fontSize: '18px',
        color: index === 0 ? '#00ff88' : color,
      }).setOrigin(0.5);

      menuItem.setInteractive({ useHandCursor: true });

      menuItem.on('pointerover', () => {
        this.selectMenuItem(index);
      });

      menuItem.on('pointerdown', () => {
        this.confirmSelection();
      });

      this.menuItems.push(menuItem);
    });

    // 戻るボタン
    const backIndex = this.waveOptions.length;
    const backItem = this.add.text(centerX, menuStartY + backIndex * lineHeight + 20, '← 戻る', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '18px',
      color: '#888888',
    }).setOrigin(0.5);

    backItem.setInteractive({ useHandCursor: true });
    backItem.on('pointerover', () => {
      this.selectMenuItem(backIndex);
    });
    backItem.on('pointerdown', () => {
      this.goBack();
    });
    this.menuItems.push(backItem);

    // 操作説明
    this.add.text(centerX, GAME_CONFIG.HEIGHT - 60, '↑↓: 選択  Enter/Space: 開始  Esc: 戻る', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '18px',
      color: '#666666',
    }).setOrigin(0.5);
  }

  /**
   * キーボード入力を設定
   */
  private setupKeyboardInput(): void {
    this.input.keyboard?.on('keydown-UP', () => {
      this.selectMenuItem((this.selectedIndex - 1 + this.menuItems.length) % this.menuItems.length);
    });

    this.input.keyboard?.on('keydown-DOWN', () => {
      this.selectMenuItem((this.selectedIndex + 1) % this.menuItems.length);
    });

    this.input.keyboard?.on('keydown-ENTER', () => {
      this.confirmSelection();
    });

    this.input.keyboard?.on('keydown-SPACE', () => {
      this.confirmSelection();
    });

    this.input.keyboard?.on('keydown-ESC', () => {
      this.goBack();
    });
  }

  /**
   * メニュー項目を選択
   */
  private selectMenuItem(index: number): void {
    // 前の選択を解除
    const prevItem = this.menuItems[this.selectedIndex];
    if (prevItem) {
      if (this.selectedIndex < this.waveOptions.length) {
        const option = this.waveOptions[this.selectedIndex];
        // フラグ持ちサブウェーブ（1-1-6, 1-2-6）を黄色で表示
        const isFlag = option.id === '1-1-6' || option.id === '1-2-6';
        prevItem.setColor(isFlag ? '#ffcc00' : '#ffffff');
      } else {
        prevItem.setColor('#888888');
      }
    }

    // 新しい選択
    this.selectedIndex = index;
    const currentItem = this.menuItems[this.selectedIndex];
    if (currentItem) {
      currentItem.setColor('#00ff88');
    }

    this.updateDescription();
  }

  /**
   * 説明テキストを更新
   */
  private updateDescription(): void {
    if (this.selectedIndex < this.waveOptions.length) {
      const option = this.waveOptions[this.selectedIndex];
      this.descriptionText.setText(option.description);
    } else {
      this.descriptionText.setText('デバッグルームに戻る');
    }
  }

  /**
   * 選択を確定
   */
  private confirmSelection(): void {
    if (this.selectedIndex >= this.waveOptions.length) {
      this.goBack();
      return;
    }

    const option = this.waveOptions[this.selectedIndex];
    this.startWave(option.waveId);
  }

  /**
   * 指定Waveで道中シーンを開始
   */
  private startWave(waveId: WaveId): void {
    // デバッグ用のゲームデータを作成
    const defaultOptions: PracticeOptions = {
      infiniteLives: true,
      invincible: false,
      slowMode: false,
      showHitbox: false,
    };

    const gameData: GameStartData = {
      mode: GameMode.PRACTICE,
      character: CharacterType.REIMU,
      difficulty: Difficulty.NORMAL,
      stageNumber: waveId.stage,
      practiceConfig: {
        stageNumber: waveId.stage,
        practiceTarget: PracticeTarget.ROUTE,
        options: defaultOptions,
      },
      // デバッグ用: 開始Wave情報を追加
      debugWaveStart: waveId,
    };

    this.cameras.main.fadeOut(300, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start(SCENES.MID_STAGE, gameData);
    });
  }

  /**
   * 戻る
   */
  private goBack(): void {
    this.cameras.main.fadeOut(300, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start(SCENES.DEBUG_ROOM);
    });
  }
}
