import Phaser from 'phaser';
import { SCENES, GAME_CONFIG, STAGE_INFO, SUMMONER_SKILLS } from '@/config/GameConfig';
import { StageIntroData, GameStartData, PlayerSkillType, SummonerSkillConfig } from '@/types';

/**
 * StageIntroScene - ステージ開始前画面（D/Fスキル選択）
 */
export class StageIntroScene extends Phaser.Scene {
  private stageData!: StageIntroData;
  private selectedSkillD: PlayerSkillType = PlayerSkillType.FLASH;
  private selectedSkillF: PlayerSkillType = PlayerSkillType.HEAL;
  private skillDButtons: Phaser.GameObjects.Container[] = [];
  private skillFButtons: Phaser.GameObjects.Container[] = [];
  private skillDescriptionText!: Phaser.GameObjects.Text;

  constructor() {
    super({ key: SCENES.STAGE_INTRO });
  }

  init(data: StageIntroData): void {
    this.stageData = data;
  }

  create(): void {
    // 状態をリセット
    this.selectedSkillD = PlayerSkillType.FLASH;
    this.selectedSkillF = PlayerSkillType.HEAL;
    this.skillDButtons = [];
    this.skillFButtons = [];

    // カメラのフェード状態をリセットしてからフェードイン
    this.cameras.main.resetFX();
    this.cameras.main.fadeIn(300);

    // 背景
    this.add.rectangle(0, 0, GAME_CONFIG.WIDTH, GAME_CONFIG.HEIGHT, 0x0a0a1e)
      .setOrigin(0);

    const centerX = GAME_CONFIG.WIDTH / 2;

    // ステージ情報
    this.createStageInfo(centerX);

    // D/Fスキル選択
    this.createSkillSelection(centerX);

    // スキル説明
    this.createSkillDescription(centerX);

    // ヒント
    this.createHint(centerX);

    // 出撃ボタン
    this.createStartButton(centerX);

    // キーボード入力
    this.setupKeyboardInput();
  }

  /**
   * ステージ情報を表示
   */
  private createStageInfo(centerX: number): void {
    const stageInfo = STAGE_INFO[this.stageData.stageNumber - 1];

    // ステージ番号
    this.add.text(centerX, 80, `STAGE ${this.stageData.stageNumber}`, {
      fontFamily: 'Arial, sans-serif',
      fontSize: '48px',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5);

    // ボス名枠
    const frameWidth = 400;
    const frameHeight = 120;
    const frameY = 180;

    this.add.rectangle(centerX, frameY, frameWidth, frameHeight, 0x1a1a3e, 1)
      .setStrokeStyle(3, 0x4a4a8a);

    // ボス名
    this.add.text(centerX, frameY - 15, stageInfo.bossName, {
      fontFamily: 'Arial, sans-serif',
      fontSize: '36px',
      color: '#ffffff',
    }).setOrigin(0.5);

    // ボスタイトル
    this.add.text(centerX, frameY + 25, `〜${stageInfo.bossTitle}〜`, {
      fontFamily: 'Arial, sans-serif',
      fontSize: '20px',
      color: '#aaaacc',
    }).setOrigin(0.5);
  }

  /**
   * D/Fスキル選択を作成
   */
  private createSkillSelection(centerX: number): void {
    const startY = 300;

    // セクションタイトル
    this.add.text(centerX, startY, '【サモナースキル選択】', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '24px',
      color: '#ffffff',
    }).setOrigin(0.5);

    // 区切り線
    this.add.rectangle(centerX, startY + 30, 600, 2, 0x4a4a6a);

    // Dスキル選択
    this.add.text(centerX - 200, startY + 60, 'D:', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '28px',
      color: '#ffcc00',
    }).setOrigin(0.5);

    this.createSkillButtons(centerX - 80, startY + 60, 'D');

    // Fスキル選択
    this.add.text(centerX - 200, startY + 130, 'F:', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '28px',
      color: '#00ccff',
    }).setOrigin(0.5);

    this.createSkillButtons(centerX - 80, startY + 130, 'F');
  }

  /**
   * スキルボタンを作成
   */
  private createSkillButtons(startX: number, y: number, slot: 'D' | 'F'): void {
    const skills = Object.values(SUMMONER_SKILLS);
    const buttonWidth = 110;
    const buttonHeight = 45;
    const gap = 10;

    skills.forEach((skill, index) => {
      const x = startX + index * (buttonWidth + gap);
      const container = this.add.container(x, y);

      const bg = this.add.rectangle(0, 0, buttonWidth, buttonHeight, 0x2a2a4e, 1)
        .setStrokeStyle(2, 0x4a4a6a);
      container.add(bg);

      const text = this.add.text(0, 0, skill.name, {
        fontFamily: 'Arial, sans-serif',
        fontSize: '16px',
        color: '#ffffff',
      }).setOrigin(0.5);
      container.add(text);

      bg.setInteractive({ useHandCursor: true });
      bg.on('pointerdown', () => {
        if (slot === 'D') {
          this.selectedSkillD = skill.id as PlayerSkillType;
          this.updateSkillSelection('D');
        } else {
          this.selectedSkillF = skill.id as PlayerSkillType;
          this.updateSkillSelection('F');
        }
        this.updateSkillDescription();
      });

      bg.on('pointerover', () => {
        this.showSkillTooltip(skill);
      });

      container.setData('skillId', skill.id);
      container.setData('bg', bg);

      if (slot === 'D') {
        this.skillDButtons.push(container);
      } else {
        this.skillFButtons.push(container);
      }
    });

    this.updateSkillSelection(slot);
  }

  /**
   * スキル選択の表示を更新
   */
  private updateSkillSelection(slot: 'D' | 'F'): void {
    const buttons = slot === 'D' ? this.skillDButtons : this.skillFButtons;
    const selectedSkill = slot === 'D' ? this.selectedSkillD : this.selectedSkillF;

    buttons.forEach(button => {
      const bg = button.getData('bg') as Phaser.GameObjects.Rectangle;
      const skillId = button.getData('skillId') as string;

      if (skillId === selectedSkill) {
        bg.setStrokeStyle(3, slot === 'D' ? 0xffcc00 : 0x00ccff);
        bg.setFillStyle(0x3a3a6e);
      } else {
        bg.setStrokeStyle(2, 0x4a4a6a);
        bg.setFillStyle(0x2a2a4e);
      }
    });
  }

  /**
   * スキル説明を作成
   */
  private createSkillDescription(centerX: number): void {
    const y = 520;

    this.add.text(centerX, y, 'スキル説明:', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '18px',
      color: '#aaaaaa',
    }).setOrigin(0.5);

    this.skillDescriptionText = this.add.text(centerX, y + 35, '', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '16px',
      color: '#ffffff',
      align: 'center',
    }).setOrigin(0.5);

    this.updateSkillDescription();
  }

  /**
   * スキル説明を更新
   */
  private updateSkillDescription(): void {
    const skillD = SUMMONER_SKILLS[this.selectedSkillD as keyof typeof SUMMONER_SKILLS];
    const skillF = SUMMONER_SKILLS[this.selectedSkillF as keyof typeof SUMMONER_SKILLS];

    if (skillD && skillF) {
      this.skillDescriptionText.setText(
        `D - ${skillD.description}\nF - ${skillF.description}`
      );
    }
  }

  /**
   * スキルツールチップを表示
   */
  private showSkillTooltip(_skill: typeof SUMMONER_SKILLS[keyof typeof SUMMONER_SKILLS]): void {
    // 簡易実装: 説明テキストに一時的に表示
    // 本格実装では別のUIコンポーネントを使用
  }

  /**
   * ヒントを作成
   */
  private createHint(centerX: number): void {
    const stageInfo = STAGE_INFO[this.stageData.stageNumber - 1];
    const y = 620;

    // 区切り線
    this.add.rectangle(centerX, y - 20, 600, 2, 0x4a4a6a);

    this.add.text(centerX, y + 10, `ヒント: ${stageInfo.hint}`, {
      fontFamily: 'Arial, sans-serif',
      fontSize: '18px',
      color: '#88aacc',
      wordWrap: { width: 700 },
      align: 'center',
    }).setOrigin(0.5);
  }

  /**
   * 出撃ボタンを作成
   */
  private createStartButton(centerX: number): void {
    const buttonY = GAME_CONFIG.HEIGHT - 120;

    const button = this.add.container(centerX, buttonY);

    const bg = this.add.rectangle(0, 0, 200, 60, 0x4444aa, 1)
      .setStrokeStyle(3, 0x6666cc)
      .setInteractive({ useHandCursor: true });
    button.add(bg);

    const text = this.add.text(0, 0, '出撃', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '32px',
      color: '#ffffff',
    }).setOrigin(0.5);
    button.add(text);

    bg.on('pointerover', () => {
      bg.setFillStyle(0x5555bb);
      button.setScale(1.05);
    });
    bg.on('pointerout', () => {
      bg.setFillStyle(0x4444aa);
      button.setScale(1);
    });
    bg.on('pointerdown', () => this.startGame());

    // Press Space テキスト
    this.add.text(centerX, buttonY + 50, 'Press Space to Start', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '16px',
      color: '#666688',
    }).setOrigin(0.5);
  }

  /**
   * キーボード入力を設定
   */
  private setupKeyboardInput(): void {
    this.input.keyboard?.on('keydown-SPACE', () => {
      this.startGame();
    });

    this.input.keyboard?.on('keydown-ENTER', () => {
      this.startGame();
    });

    this.input.keyboard?.on('keydown-ESC', () => {
      this.goBack();
    });
  }

  /**
   * ゲームを開始
   */
  private startGame(): void {
    const summonerSkills: SummonerSkillConfig = {
      D: this.selectedSkillD,
      F: this.selectedSkillF,
    };

    const gameData: GameStartData = {
      mode: this.stageData.mode,
      character: this.stageData.character,
      difficulty: this.stageData.difficulty,
      stageNumber: this.stageData.stageNumber,
      summonerSkills,
      continueData: this.stageData.continueData,
      practiceConfig: this.stageData.practiceConfig,
    };

    // 練習モードでボスのみの場合はGameSceneへ直接遷移
    // それ以外は道中シーン（MidStageScene）へ遷移
    const targetScene = this.stageData.practiceConfig?.practiceTarget === 'boss'
      ? SCENES.GAME
      : SCENES.MID_STAGE;

    this.cameras.main.fadeOut(300, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start(targetScene, gameData);
    });
  }

  /**
   * 戻る
   */
  private goBack(): void {
    const targetScene = this.stageData.mode === 'arcade'
      ? SCENES.ARCADE_SETUP
      : SCENES.PRACTICE_SETUP;

    this.cameras.main.fadeOut(300, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start(targetScene);
    });
  }
}
