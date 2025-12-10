import Phaser from 'phaser';
import { SCENES, GAME_CONFIG, STAGE_INFO } from '@/config/GameConfig';
import { CharacterType, Difficulty, GameMode, PracticeTarget, PracticeOptions, PracticeModeConfig, StageIntroData } from '@/types';

/**
 * PracticeSetupScene - 練習モード設定画面
 */
export class PracticeSetupScene extends Phaser.Scene {
  private selectedCharacter: CharacterType = CharacterType.REIMU;
  private selectedDifficulty: Difficulty = Difficulty.NORMAL;
  private selectedStage: number = 1;
  private selectedTarget: PracticeTarget = PracticeTarget.FULL;
  private practiceOptions: PracticeOptions = {
    infiniteLives: true,
    invincible: false,
    slowMode: false,
    showHitbox: false,
  };

  private characterCards: Phaser.GameObjects.Container[] = [];
  private difficultyButtons: Phaser.GameObjects.Container[] = [];
  private stageCards: Phaser.GameObjects.Container[] = [];
  private targetButtons: Phaser.GameObjects.Container[] = [];
  private optionCheckboxes: Map<string, Phaser.GameObjects.Container> = new Map();

  constructor() {
    super({ key: SCENES.PRACTICE_SETUP });
  }

  create(): void {
    this.cameras.main.fadeIn(300);

    // 背景
    this.add.rectangle(0, 0, GAME_CONFIG.WIDTH, GAME_CONFIG.HEIGHT, 0x1a1a2e)
      .setOrigin(0);

    // タイトル
    this.add.text(GAME_CONFIG.WIDTH / 2, 40, '練習モード設定', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '36px',
      color: '#ffffff',
    }).setOrigin(0.5);

    // 戻るボタン
    this.createBackButton();

    // 左側: キャラクター選択 + 難易度選択
    this.createCharacterSelection();
    this.createDifficultySelection();

    // 右側: ステージ選択
    this.createStageSelection();

    // 練習対象
    this.createTargetSelection();

    // 練習オプション
    this.createPracticeOptions();

    // 次へボタン
    this.createNextButton();

    // キーボード入力
    this.setupKeyboardInput();
  }

  /**
   * 戻るボタン
   */
  private createBackButton(): void {
    const backButton = this.add.text(50, 40, '← 戻る', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '24px',
      color: '#aaaaaa',
    }).setInteractive({ useHandCursor: true });

    backButton.on('pointerover', () => backButton.setColor('#ffffff'));
    backButton.on('pointerout', () => backButton.setColor('#aaaaaa'));
    backButton.on('pointerdown', () => this.goBack());
  }

  /**
   * キャラクター選択を作成
   */
  private createCharacterSelection(): void {
    const startX = 80;
    const startY = 100;

    this.add.text(startX, startY, '【キャラクター選択】', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '20px',
      color: '#ffffff',
    });

    const characters = [
      { type: CharacterType.REIMU, name: '霊夢', unlocked: true },
      { type: CharacterType.MARISA, name: '魔理沙', unlocked: false },
      { type: CharacterType.SAKUYA, name: '咲夜', unlocked: false },
      { type: CharacterType.YOUMU, name: '妖夢', unlocked: false },
    ];

    const cardSize = 80;

    characters.forEach((char, index) => {
      const x = startX + 50 + index * (cardSize + 10);
      const y = startY + 70;
      const card = this.createSmallCharacterCard(x, y, cardSize, char);
      this.characterCards.push(card);
    });

    this.updateCharacterSelection();
  }

  /**
   * 小さいキャラクターカードを作成
   */
  private createSmallCharacterCard(
    x: number,
    y: number,
    size: number,
    char: { type: CharacterType; name: string; unlocked: boolean }
  ): Phaser.GameObjects.Container {
    const container = this.add.container(x, y);

    const bgColor = char.unlocked ? 0x2a2a4e : 0x1a1a2e;
    const bg = this.add.rectangle(0, 0, size, size, bgColor, 1)
      .setStrokeStyle(2, 0x4a4a6a);
    container.add(bg);

    const nameText = this.add.text(0, 0, char.name, {
      fontFamily: 'Arial, sans-serif',
      fontSize: '16px',
      color: char.unlocked ? '#ffffff' : '#666666',
    }).setOrigin(0.5);
    container.add(nameText);

    if (char.unlocked) {
      bg.setInteractive({ useHandCursor: true });
      bg.on('pointerdown', () => {
        this.selectedCharacter = char.type;
        this.updateCharacterSelection();
      });
    }

    container.setData('type', char.type);
    container.setData('unlocked', char.unlocked);
    container.setData('bg', bg);

    return container;
  }

  /**
   * キャラクター選択の表示を更新
   */
  private updateCharacterSelection(): void {
    this.characterCards.forEach(card => {
      const bg = card.getData('bg') as Phaser.GameObjects.Rectangle;
      const type = card.getData('type') as CharacterType;
      const unlocked = card.getData('unlocked') as boolean;

      if (type === this.selectedCharacter && unlocked) {
        bg.setStrokeStyle(3, 0xffff00);
      } else {
        bg.setStrokeStyle(2, 0x4a4a6a);
      }
    });
  }

  /**
   * 難易度選択を作成
   */
  private createDifficultySelection(): void {
    const startX = 500;
    const startY = 100;

    this.add.text(startX, startY, '【難易度選択】', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '20px',
      color: '#ffffff',
    });

    const difficulties = [
      { type: Difficulty.EASY, name: 'Easy', color: '#00ff00' },
      { type: Difficulty.NORMAL, name: 'Normal', color: '#ffff00' },
      { type: Difficulty.HARD, name: 'Hard', color: '#ff4444' },
    ];

    difficulties.forEach((diff, index) => {
      const x = startX + 20;
      const y = startY + 40 + index * 35;
      const button = this.createRadioButton(x, y, diff.name, diff.color, () => {
        this.selectedDifficulty = diff.type;
        this.updateDifficultySelection();
      });
      button.setData('type', diff.type);
      this.difficultyButtons.push(button);
    });

    this.updateDifficultySelection();
  }

  /**
   * ラジオボタンを作成
   */
  private createRadioButton(
    x: number,
    y: number,
    label: string,
    color: string,
    onClick: () => void
  ): Phaser.GameObjects.Container {
    const container = this.add.container(x, y);

    const circle = this.add.circle(0, 0, 10, 0x333333, 1)
      .setStrokeStyle(2, 0x888888);
    container.add(circle);

    const indicator = this.add.circle(0, 0, 5, 0xffffff, 0);
    container.add(indicator);

    const text = this.add.text(20, 0, label, {
      fontFamily: 'Arial, sans-serif',
      fontSize: '18px',
      color: color,
    }).setOrigin(0, 0.5);
    container.add(text);

    const hitArea = this.add.rectangle(40, 0, 100, 30, 0x000000, 0)
      .setInteractive({ useHandCursor: true });
    container.add(hitArea);

    hitArea.on('pointerdown', onClick);

    container.setData('indicator', indicator);

    return container;
  }

  /**
   * 難易度選択の表示を更新
   */
  private updateDifficultySelection(): void {
    this.difficultyButtons.forEach(button => {
      const indicator = button.getData('indicator') as Phaser.GameObjects.Arc;
      const type = button.getData('type') as Difficulty;
      indicator.setFillStyle(0xffffff, type === this.selectedDifficulty ? 1 : 0);
    });
  }

  /**
   * ステージ選択を作成
   */
  private createStageSelection(): void {
    const startX = 80;
    const startY = 220;

    this.add.text(startX, startY, '【ステージ選択】', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '20px',
      color: '#ffffff',
    });

    const cardWidth = 100;
    const cardHeight = 80;

    STAGE_INFO.forEach((stage, index) => {
      const x = startX + 60 + (index % 6) * (cardWidth + 15);
      const y = startY + 60 + Math.floor(index / 6) * (cardHeight + 15);
      const card = this.createStageCard(x, y, cardWidth, cardHeight, stage);
      this.stageCards.push(card);
    });

    this.updateStageSelection();
  }

  /**
   * ステージカードを作成
   */
  private createStageCard(
    x: number,
    y: number,
    width: number,
    height: number,
    stage: typeof STAGE_INFO[number]
  ): Phaser.GameObjects.Container {
    const container = this.add.container(x, y);

    const bgColor = stage.isUnlocked ? 0x2a2a4e : 0x1a1a2e;
    const bg = this.add.rectangle(0, 0, width, height, bgColor, 1)
      .setStrokeStyle(2, 0x4a4a6a);
    container.add(bg);

    const stageText = this.add.text(0, -15, `ST${stage.number}`, {
      fontFamily: 'Arial, sans-serif',
      fontSize: '18px',
      color: stage.isUnlocked ? '#ffffff' : '#666666',
    }).setOrigin(0.5);
    container.add(stageText);

    const bossText = this.add.text(0, 10, stage.bossName, {
      fontFamily: 'Arial, sans-serif',
      fontSize: '14px',
      color: stage.isUnlocked ? '#aaaaaa' : '#444444',
    }).setOrigin(0.5);
    container.add(bossText);

    if (stage.isUnlocked) {
      bg.setInteractive({ useHandCursor: true });
      bg.on('pointerdown', () => {
        this.selectedStage = stage.number;
        this.updateStageSelection();
      });
    }

    container.setData('number', stage.number);
    container.setData('unlocked', stage.isUnlocked);
    container.setData('bg', bg);

    return container;
  }

  /**
   * ステージ選択の表示を更新
   */
  private updateStageSelection(): void {
    this.stageCards.forEach(card => {
      const bg = card.getData('bg') as Phaser.GameObjects.Rectangle;
      const number = card.getData('number') as number;
      const unlocked = card.getData('unlocked') as boolean;

      if (number === this.selectedStage && unlocked) {
        bg.setStrokeStyle(3, 0xffff00);
      } else {
        bg.setStrokeStyle(2, 0x4a4a6a);
      }
    });
  }

  /**
   * 練習対象選択を作成
   */
  private createTargetSelection(): void {
    const startX = 80;
    const startY = 400;

    this.add.text(startX, startY, '【練習対象】', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '20px',
      color: '#ffffff',
    });

    const targets = [
      { type: PracticeTarget.FULL, name: 'ステージ全体' },
      { type: PracticeTarget.ROUTE, name: '道中のみ' },
      { type: PracticeTarget.BOSS, name: 'ボスのみ' },
    ];

    targets.forEach((target, index) => {
      const x = startX + 20 + index * 160;
      const y = startY + 45;
      const button = this.createRadioButton(x, y, target.name, '#ffffff', () => {
        this.selectedTarget = target.type;
        this.updateTargetSelection();
      });
      button.setData('type', target.type);
      this.targetButtons.push(button);
    });

    this.updateTargetSelection();
  }

  /**
   * 練習対象選択の表示を更新
   */
  private updateTargetSelection(): void {
    this.targetButtons.forEach(button => {
      const indicator = button.getData('indicator') as Phaser.GameObjects.Arc;
      const type = button.getData('type') as PracticeTarget;
      indicator.setFillStyle(0xffffff, type === this.selectedTarget ? 1 : 0);
    });
  }

  /**
   * 練習オプションを作成
   */
  private createPracticeOptions(): void {
    const startX = 80;
    const startY = 500;

    this.add.text(startX, startY, '【練習オプション】', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '20px',
      color: '#ffffff',
    });

    const options = [
      { key: 'infiniteLives', name: '残機無限', default: true },
      { key: 'invincible', name: '無敵モード', default: false },
      { key: 'showHitbox', name: '当たり判定表示', default: false },
      { key: 'slowMode', name: 'スローモード', default: false },
    ];

    options.forEach((option, index) => {
      const x = startX + 20 + (index % 2) * 220;
      const y = startY + 45 + Math.floor(index / 2) * 40;
      const checkbox = this.createCheckbox(x, y, option.name, option.default, (checked) => {
        (this.practiceOptions as any)[option.key] = checked;
      });
      this.optionCheckboxes.set(option.key, checkbox);
    });
  }

  /**
   * チェックボックスを作成
   */
  private createCheckbox(
    x: number,
    y: number,
    label: string,
    defaultValue: boolean,
    onChange: (checked: boolean) => void
  ): Phaser.GameObjects.Container {
    const container = this.add.container(x, y);

    const box = this.add.rectangle(0, 0, 20, 20, 0x333333, 1)
      .setStrokeStyle(2, 0x888888);
    container.add(box);

    const check = this.add.text(0, -2, '✓', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '16px',
      color: '#00ff00',
    }).setOrigin(0.5);
    check.setVisible(defaultValue);
    container.add(check);

    const text = this.add.text(20, 0, label, {
      fontFamily: 'Arial, sans-serif',
      fontSize: '18px',
      color: '#ffffff',
    }).setOrigin(0, 0.5);
    container.add(text);

    let isChecked = defaultValue;

    const hitArea = this.add.rectangle(60, 0, 180, 30, 0x000000, 0)
      .setInteractive({ useHandCursor: true });
    container.add(hitArea);

    hitArea.on('pointerdown', () => {
      isChecked = !isChecked;
      check.setVisible(isChecked);
      onChange(isChecked);
    });

    container.setData('check', check);
    container.setData('isChecked', isChecked);

    return container;
  }

  /**
   * 次へボタン
   */
  private createNextButton(): void {
    const buttonX = GAME_CONFIG.WIDTH - 200;
    const buttonY = GAME_CONFIG.HEIGHT - 80;

    const button = this.add.container(buttonX, buttonY);

    const bg = this.add.rectangle(0, 0, 160, 50, 0x4444aa, 1)
      .setStrokeStyle(2, 0x6666cc)
      .setInteractive({ useHandCursor: true });
    button.add(bg);

    const text = this.add.text(0, 0, '次へ →', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '24px',
      color: '#ffffff',
    }).setOrigin(0.5);
    button.add(text);

    bg.on('pointerover', () => bg.setFillStyle(0x5555bb));
    bg.on('pointerout', () => bg.setFillStyle(0x4444aa));
    bg.on('pointerdown', () => this.goToStageIntro());
  }

  /**
   * キーボード入力を設定
   */
  private setupKeyboardInput(): void {
    this.input.keyboard?.on('keydown-ESC', () => {
      this.goBack();
    });

    this.input.keyboard?.on('keydown-ENTER', () => {
      this.goToStageIntro();
    });
  }

  /**
   * ステージイントロへ遷移
   */
  private goToStageIntro(): void {
    const practiceConfig: PracticeModeConfig = {
      stageNumber: this.selectedStage,
      practiceTarget: this.selectedTarget,
      options: this.practiceOptions,
    };

    const data: StageIntroData = {
      mode: GameMode.PRACTICE,
      character: this.selectedCharacter,
      difficulty: this.selectedDifficulty,
      stageNumber: this.selectedStage,
      practiceConfig,
    };

    this.cameras.main.fadeOut(300, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start(SCENES.STAGE_INTRO, data);
    });
  }

  /**
   * 戻る
   */
  private goBack(): void {
    this.cameras.main.fadeOut(300, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start(SCENES.MODE_SELECT);
    });
  }
}
