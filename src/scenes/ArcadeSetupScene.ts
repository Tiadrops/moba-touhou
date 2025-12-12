import Phaser from 'phaser';
import { SCENES, GAME_CONFIG } from '@/config/GameConfig';
import { CharacterType, Difficulty, GameMode, StageIntroData } from '@/types';
import { CHARACTER_DATA } from '@/config/CharacterData';

/**
 * ArcadeSetupScene - アーケードモード設定画面
 */
export class ArcadeSetupScene extends Phaser.Scene {
  private selectedCharacter: CharacterType = CharacterType.REIMU;
  private selectedDifficulty: Difficulty = Difficulty.NORMAL;
  private characterCards: Phaser.GameObjects.Container[] = [];
  private difficultyButtons: Phaser.GameObjects.Container[] = [];
  private characterInfoText!: Phaser.GameObjects.Text;

  constructor() {
    super({ key: SCENES.ARCADE_SETUP });
  }

  create(): void {
    // 状態をリセット
    this.selectedCharacter = CharacterType.REIMU;
    this.selectedDifficulty = Difficulty.NORMAL;
    this.characterCards = [];
    this.difficultyButtons = [];

    // カメラのフェード状態をリセットしてからフェードイン
    this.cameras.main.resetFX();
    this.cameras.main.fadeIn(300);

    // 背景
    this.add.rectangle(0, 0, GAME_CONFIG.WIDTH, GAME_CONFIG.HEIGHT, 0x1a1a2e)
      .setOrigin(0);

    // タイトル
    this.add.text(GAME_CONFIG.WIDTH / 2, 50, 'アーケードモード設定', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '36px',
      color: '#ffffff',
    }).setOrigin(0.5);

    // 戻るボタン
    this.createBackButton();

    // キャラクター選択
    this.createCharacterSelection();

    // 難易度選択
    this.createDifficultySelection();

    // キャラクター情報
    this.createCharacterInfo();

    // 次へボタン
    this.createNextButton();

    // キーボード入力
    this.setupKeyboardInput();
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
   * キャラクター選択を作成
   */
  private createCharacterSelection(): void {
    const startY = 150;

    this.add.text(100, startY, '【キャラクター選択】', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '24px',
      color: '#ffffff',
    });

    const characters = [
      { type: CharacterType.REIMU, name: '霊夢', unlocked: true },
      { type: CharacterType.MARISA, name: '魔理沙', unlocked: false },
      { type: CharacterType.SAKUYA, name: '咲夜', unlocked: false },
      { type: CharacterType.YOUMU, name: '妖夢', unlocked: false },
    ];

    const cardWidth = 120;
    const cardHeight = 150;
    const startX = 120;

    characters.forEach((char, index) => {
      const x = startX + index * (cardWidth + 20);
      const y = startY + 110;
      const card = this.createCharacterCard(x, y, cardWidth, cardHeight, char);
      this.characterCards.push(card);
    });
  }

  /**
   * キャラクターカードを作成
   */
  private createCharacterCard(
    x: number,
    y: number,
    width: number,
    height: number,
    char: { type: CharacterType; name: string; unlocked: boolean }
  ): Phaser.GameObjects.Container {
    const container = this.add.container(x, y);

    // 背景
    const bgColor = char.unlocked ? 0x2a2a4e : 0x1a1a2e;
    const bg = this.add.rectangle(0, 0, width, height, bgColor, 1)
      .setStrokeStyle(2, 0x4a4a6a);
    container.add(bg);

    // キャラクター名
    const nameText = this.add.text(0, -20, char.name, {
      fontFamily: 'Arial, sans-serif',
      fontSize: '20px',
      color: char.unlocked ? '#ffffff' : '#666666',
    }).setOrigin(0.5);
    container.add(nameText);

    // 未解放表示
    if (!char.unlocked) {
      const lockText = this.add.text(0, 20, '(未)', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '16px',
        color: '#666666',
      }).setOrigin(0.5);
      container.add(lockText);
    }

    // インタラクティブ
    if (char.unlocked) {
      bg.setInteractive({ useHandCursor: true });
      bg.on('pointerdown', () => {
        this.selectCharacter(char.type);
      });
    }

    container.setData('type', char.type);
    container.setData('unlocked', char.unlocked);
    container.setData('bg', bg);

    return container;
  }

  /**
   * キャラクターを選択
   */
  private selectCharacter(type: CharacterType): void {
    this.selectedCharacter = type;
    this.updateCharacterSelection();
    this.updateCharacterInfo();
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
    const startY = 380;

    this.add.text(100, startY, '【難易度選択】', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '24px',
      color: '#ffffff',
    });

    const difficulties = [
      { type: Difficulty.EASY, name: 'Easy', color: '#00ff00' },
      { type: Difficulty.NORMAL, name: 'Normal', color: '#ffff00' },
      { type: Difficulty.HARD, name: 'Hard', color: '#ff4444' },
    ];

    const startX = 120;

    difficulties.forEach((diff, index) => {
      const x = startX + index * 150;
      const y = startY + 60;
      const button = this.createDifficultyButton(x, y, diff);
      this.difficultyButtons.push(button);
    });

    this.updateDifficultySelection();
  }

  /**
   * 難易度ボタンを作成
   */
  private createDifficultyButton(
    x: number,
    y: number,
    diff: { type: Difficulty; name: string; color: string }
  ): Phaser.GameObjects.Container {
    const container = this.add.container(x, y);

    // ラジオボタン風の円
    const circle = this.add.circle(0, 0, 12, 0x333333, 1)
      .setStrokeStyle(2, 0x888888);
    container.add(circle);

    // 選択インジケーター
    const indicator = this.add.circle(0, 0, 6, 0xffffff, 0);
    container.add(indicator);

    // テキスト
    const text = this.add.text(25, 0, diff.name, {
      fontFamily: 'Arial, sans-serif',
      fontSize: '22px',
      color: diff.color,
    }).setOrigin(0, 0.5);
    container.add(text);

    // インタラクティブ
    const hitArea = this.add.rectangle(50, 0, 120, 40, 0x000000, 0)
      .setInteractive({ useHandCursor: true });
    container.add(hitArea);

    hitArea.on('pointerdown', () => {
      this.selectedDifficulty = diff.type;
      this.updateDifficultySelection();
    });

    container.setData('type', diff.type);
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

      if (type === this.selectedDifficulty) {
        indicator.setFillStyle(0xffffff, 1);
      } else {
        indicator.setFillStyle(0xffffff, 0);
      }
    });
  }

  /**
   * キャラクター情報を作成
   */
  private createCharacterInfo(): void {
    const startY = 520;

    this.add.rectangle(100, startY, GAME_CONFIG.WIDTH - 200, 180, 0x2a2a4e, 1)
      .setOrigin(0)
      .setStrokeStyle(2, 0x4a4a6a);

    this.add.text(120, startY + 15, 'キャラクター情報:', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '20px',
      color: '#aaaaaa',
    });

    this.characterInfoText = this.add.text(120, startY + 50, '', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '18px',
      color: '#ffffff',
      lineSpacing: 8,
    });

    this.updateCharacterInfo();
  }

  /**
   * キャラクター情報を更新
   */
  private updateCharacterInfo(): void {
    const charData = CHARACTER_DATA[this.selectedCharacter];
    if (!charData) return;

    const stats = charData.stats;
    const info = `HP: ${stats.maxHp}  ATK: ${stats.attackPower}  DEF: ${stats.defense}  SPD: ${(stats.moveSpeed / 55).toFixed(1)}m/s
Q: ${charData.skills.Q.name}  W: ${charData.skills.W.name}  E: ${charData.skills.E.name}  R: ${charData.skills.R.name}`;

    this.characterInfoText.setText(info);
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
    const data: StageIntroData = {
      mode: GameMode.ARCADE,
      character: this.selectedCharacter,
      difficulty: this.selectedDifficulty,
      stageNumber: 1,
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
