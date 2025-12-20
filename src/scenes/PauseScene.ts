import Phaser from 'phaser';
import { SCENES, GAME_CONFIG, BOSS_CONFIG } from '@/config/GameConfig';
import { StageIntroData } from '@/types';
import { AudioManager } from '@/systems/AudioManager';
import { Player } from '@/entities/Player';
import { Boss } from '@/entities/Boss';

/**
 * PauseScene用のデータ
 */
export interface PauseData {
  retryData: StageIntroData;
  player?: Player;
  boss?: Boss | null;
}

/**
 * ポーズメニューの表示モード
 */
enum PauseMenuMode {
  MAIN = 'main',
  PLAYER_INFO = 'player_info',
  BOSS_INFO = 'boss_info',
  BOSS_PHASE_SELECT = 'boss_phase_select',
  BOSS_PHASE_DETAIL = 'boss_phase_detail',
  CONFIRM_DIALOG = 'confirm_dialog',
}

/**
 * 確認ダイアログ用のアクションタイプ
 */
enum ConfirmAction {
  RESTART_STAGE = 'restart_stage',
  CHANGE_SUMMONER = 'change_summoner',
  GO_TO_TITLE = 'go_to_title',
}

/**
 * ルーミアのスキル説明データ
 * ※ GameConfig.BOSS_CONFIG.RUMIA の値と同期すること
 */
const RUMIA_SKILL_DESCRIPTIONS = {
  phase0: {
    name: 'ノーマル',
    skills: [
      {
        slot: 'Q',
        name: '通常弾幕1',
        castTime: 1400,
        cooldown: 5000,
        breakable: true,
        breakTiming: '詠唱中',
        description: '7本の予告線が順に現れ、各線に沿って弾幕が発射される。弾は「八の字」に広がる。',
        tips: '[Tips!] 予告線が見えたら早めに回避位置を決めよう',
      },
      {
        slot: 'W',
        name: '通常弾幕2',
        castTime: 500,
        cooldown: 6000,
        breakable: true,
        breakTiming: '詠唱中',
        description: '3重のリング弾幕を同時発射。外側ほど速い（5/10/15m/s）。',
        tips: '[Tips!] 内側に留まるのが安全',
      },
      {
        slot: 'E',
        name: '通常弾幕3',
        castTime: 500,
        cooldown: 6000,
        breakable: true,
        breakTiming: '詠唱中〜スキル終了',
        description: '1秒かけてランダム移動しながら2列の弾幕を配置。弾速は山型パターン。',
        tips: '[Tips!] Breakさせて弾幕を中断させよう',
      },
    ],
  },
  phase1: {
    name: '闇符「ダークサイドオブザムーン」',
    skills: [
      {
        slot: 'Q',
        name: 'オーブオブディセプション',
        castTime: 250,
        cooldown: 5000,
        breakable: true,
        breakTiming: '詠唱中',
        description: '360度均等に9発の大玉を発射し、射程9m到達後にルーミアへ戻ってくる。',
        tips: '[Tips!] 行きと帰りの両方に当たり判定あり',
      },
      {
        slot: 'W',
        name: 'アレンジドフォックスファイア',
        castTime: 100,
        cooldown: 8000,
        breakable: true,
        breakTiming: '詠唱中〜フィールド中',
        description: '黄色(0.6秒)→赤(1.4秒)のフィールドを展開。赤エリア侵入で追尾弾3発。追尾は3秒間。',
        tips: '[Tips!] 黄色・赤フェーズ中はBreak可能。MSバフ+40%も付与される',
      },
      {
        slot: 'E',
        name: 'カーチスクロス',
        castTime: 400,
        cooldown: 6000,
        breakable: true,
        breakTiming: '詠唱中',
        description: '十字架状の弾幕を纏い、プレイヤー方向へ7m突進(14m/s)。弾幕は突進後も直進。',
        tips: '[Tips!] 突進方向を予測して横に避けよう',
      },
      {
        slot: 'R',
        name: '闇符「ダークサイドオブザムーン」',
        castTime: 600,
        cooldown: 8000,
        breakable: true,
        breakTiming: '詠唱中',
        description: '黒球に変化し3秒間無敵+CC無効。プレイヤーを追尾しながら輪弾と中玉を撒く。終了時リング弾。',
        tips: '[Tips!] 無敵中は攻撃せず回避に専念',
      },
    ],
  },
};

/**
 * PauseScene - 一時停止画面（オーバーレイ）
 */
export class PauseScene extends Phaser.Scene {
  private pauseData!: PauseData;
  private selectedIndex: number = 0;
  private menuItems: Phaser.GameObjects.Text[] = [];
  private menuMode: PauseMenuMode = PauseMenuMode.MAIN;
  private infoContainer: Phaser.GameObjects.Container | null = null;
  private selectedPhaseIndex: number = 0;
  private confirmContainer: Phaser.GameObjects.Container | null = null;
  private confirmAction: ConfirmAction | null = null;
  private confirmSelectedIndex: number = 0; // 0=はい, 1=いいえ

  constructor() {
    super({ key: SCENES.PAUSE });
  }

  init(data: PauseData): void {
    this.pauseData = data;
  }

  create(): void {
    // 状態をリセット
    this.selectedIndex = 0;
    this.menuItems = [];
    this.menuMode = PauseMenuMode.MAIN;
    this.infoContainer = null;
    this.confirmContainer = null;
    this.confirmAction = null;
    this.confirmSelectedIndex = 0;
    this.selectedPhaseIndex = 0;

    const centerX = GAME_CONFIG.WIDTH / 2;
    const centerY = GAME_CONFIG.HEIGHT / 2;

    // 半透明の背景オーバーレイ
    this.add.rectangle(0, 0, GAME_CONFIG.WIDTH, GAME_CONFIG.HEIGHT, 0x000000, 0.7)
      .setOrigin(0);

    // ポーズメニューボックス
    const boxWidth = 450;
    const boxHeight = 500;
    this.add.rectangle(centerX, centerY, boxWidth, boxHeight, 0x1a1a2e, 1)
      .setStrokeStyle(3, 0x4a4a6a);

    // PAUSEテキスト
    this.add.text(centerX, centerY - 170, 'PAUSE', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '42px',
      color: '#ffffff',
    }).setOrigin(0.5);

    // メニュー項目
    this.createMenuItems(centerX, centerY);

    // キーボード入力
    this.setupKeyboardInput();

    // 初期選択
    this.updateSelection();
  }

  /**
   * メニュー項目を作成
   */
  private createMenuItems(centerX: number, centerY: number): void {
    const menuOptions = [
      { text: 'ゲームに戻る', action: () => this.resume() },
      { text: 'ステージの最初からやり直す', action: () => this.showConfirmDialog(ConfirmAction.RESTART_STAGE) },
      { text: 'サモナースペルを変更してやり直す', action: () => this.showConfirmDialog(ConfirmAction.CHANGE_SUMMONER) },
      { text: 'スタートメニューに戻る', action: () => this.showConfirmDialog(ConfirmAction.GO_TO_TITLE) },
      { text: 'プレイヤーの情報', action: () => this.showPlayerInfo() },
      { text: 'ステージボスの情報', action: () => this.showBossPhaseSelect() },
    ];

    const startY = centerY - 110;
    const lineHeight = 45;

    menuOptions.forEach((option, index) => {
      const y = startY + index * lineHeight;

      const menuItem = this.add.text(centerX, y, option.text, {
        fontFamily: 'Arial, sans-serif',
        fontSize: '22px',
        color: '#ffffff',
      }).setOrigin(0.5);

      menuItem.setInteractive({ useHandCursor: true });

      menuItem.on('pointerover', () => {
        // メインメニュー表示中のみ選択音を鳴らす
        if (this.menuMode === PauseMenuMode.MAIN && this.selectedIndex !== index) {
          this.selectedIndex = index;
          this.updateSelection(true);
        }
      });

      menuItem.on('pointerdown', () => {
        // メインメニュー表示中のみ決定音を鳴らす
        if (this.menuMode === PauseMenuMode.MAIN) {
          AudioManager.getInstance().playSe('se_decision');
          option.action();
        }
      });

      menuItem.setData('action', option.action);
      this.menuItems.push(menuItem);
    });
  }

  /**
   * 選択状態を更新
   */
  private updateSelection(playSound: boolean = false): void {
    // メインメニュー表示中のみ選択音を鳴らす
    if (playSound && this.menuMode === PauseMenuMode.MAIN) {
      AudioManager.getInstance().playSe('se_select');
    }

    this.menuItems.forEach((item, index) => {
      if (index === this.selectedIndex) {
        item.setColor('#ffff00');
        item.setText('▶ ' + item.text.replace('▶ ', ''));
      } else {
        item.setColor('#ffffff');
        item.setText(item.text.replace('▶ ', ''));
      }
    });
  }

  /**
   * キーボード入力を設定
   */
  private setupKeyboardInput(): void {
    this.input.keyboard?.on('keydown-UP', () => {
      if (this.menuMode === PauseMenuMode.MAIN) {
        this.selectedIndex = (this.selectedIndex - 1 + this.menuItems.length) % this.menuItems.length;
        this.updateSelection(true);
      } else if (this.menuMode === PauseMenuMode.BOSS_PHASE_SELECT) {
        this.navigatePhaseSelect(-1);
      }
    });

    this.input.keyboard?.on('keydown-DOWN', () => {
      if (this.menuMode === PauseMenuMode.MAIN) {
        this.selectedIndex = (this.selectedIndex + 1) % this.menuItems.length;
        this.updateSelection(true);
      } else if (this.menuMode === PauseMenuMode.BOSS_PHASE_SELECT) {
        this.navigatePhaseSelect(1);
      }
    });

    this.input.keyboard?.on('keydown-LEFT', () => {
      if (this.menuMode === PauseMenuMode.CONFIRM_DIALOG) {
        this.navigateConfirmDialog(-1);
      }
    });

    this.input.keyboard?.on('keydown-RIGHT', () => {
      if (this.menuMode === PauseMenuMode.CONFIRM_DIALOG) {
        this.navigateConfirmDialog(1);
      }
    });

    this.input.keyboard?.on('keydown-ENTER', () => {
      if (this.menuMode === PauseMenuMode.MAIN) {
        this.confirmSelection();
      } else if (this.menuMode === PauseMenuMode.BOSS_PHASE_SELECT) {
        this.showBossPhaseDetail(this.selectedPhaseIndex);
      } else if (this.menuMode === PauseMenuMode.CONFIRM_DIALOG) {
        this.executeConfirmAction();
      } else {
        this.handleBackNavigation();
      }
    });

    this.input.keyboard?.on('keydown-SPACE', () => {
      if (this.menuMode === PauseMenuMode.MAIN) {
        this.resume();
      } else if (this.menuMode === PauseMenuMode.CONFIRM_DIALOG) {
        this.executeConfirmAction();
      } else {
        this.handleBackNavigation();
      }
    });

    this.input.keyboard?.on('keydown-ESC', () => {
      if (this.menuMode === PauseMenuMode.MAIN) {
        this.resume();
      } else if (this.menuMode === PauseMenuMode.CONFIRM_DIALOG) {
        this.closeConfirmDialog();
      } else {
        this.handleBackNavigation();
      }
    });
  }

  /**
   * 戻るナビゲーション処理
   */
  private handleBackNavigation(): void {
    AudioManager.getInstance().playSe('se_cancel');

    if (this.menuMode === PauseMenuMode.BOSS_PHASE_DETAIL) {
      // フェーズ詳細 → フェーズ選択に戻る
      this.closeInfoPanel();
      this.showBossPhaseSelect();
    } else {
      // その他 → メインメニューに戻る
      this.closeInfoPanel();
    }
  }

  /**
   * フェーズ選択のナビゲーション
   */
  private navigatePhaseSelect(direction: number): void {
    const phaseCount = BOSS_CONFIG.RUMIA.PHASES.length;
    this.selectedPhaseIndex = (this.selectedPhaseIndex + direction + phaseCount) % phaseCount;
    AudioManager.getInstance().playSe('se_select');
    this.updatePhaseSelectDisplay();
  }

  /**
   * 選択を確定
   */
  private confirmSelection(): void {
    AudioManager.getInstance().playSe('se_decision');
    const action = this.menuItems[this.selectedIndex].getData('action') as () => void;
    action();
  }

  /**
   * ゲームを再開
   */
  private resume(): void {
    AudioManager.getInstance().playSe('se_cancel');
    this.scene.stop();
    this.scene.resume(SCENES.GAME);
  }

  /**
   * ステージの最初からやり直す（GameSceneを直接再起動）
   */
  private restartStage(): void {
    // BGMを停止してからGameSceneを再起動（GameSceneでBGMが再生される）
    AudioManager.getInstance().stopBgm();
    this.scene.stop(SCENES.GAME);
    this.scene.stop();
    // GameSceneを直接再起動（サモナースペルは変更なし）
    this.scene.start(SCENES.GAME);
  }

  /**
   * サモナースペルを変更してやり直す（サモナースペル選択画面へ）
   */
  private goToSummonerSelect(): void {
    // メニューBGMに切り替え
    AudioManager.getInstance().playBgm('bgm_title');
    this.scene.stop(SCENES.GAME);
    this.scene.stop();

    const retryData: StageIntroData = {
      ...this.pauseData.retryData,
      continueData: undefined,
    };

    this.scene.start(SCENES.STAGE_INTRO, retryData);
  }

  /**
   * スタートメニュー（タイトル画面）に戻る
   */
  private goToTitle(): void {
    // メニューBGMに切り替え
    AudioManager.getInstance().playBgm('bgm_title');
    this.scene.stop(SCENES.GAME);
    this.scene.stop();
    this.scene.start(SCENES.TITLE);
  }

  /**
   * 確認ダイアログを表示
   */
  private showConfirmDialog(action: ConfirmAction): void {
    this.confirmAction = action;
    this.confirmSelectedIndex = 1; // デフォルトは「いいえ」
    this.menuMode = PauseMenuMode.CONFIRM_DIALOG;
    this.createConfirmDialog();
  }

  /**
   * 確認ダイアログを作成
   */
  private createConfirmDialog(): void {
    const centerX = GAME_CONFIG.WIDTH / 2;
    const centerY = GAME_CONFIG.HEIGHT / 2;

    this.confirmContainer = this.add.container(centerX, centerY);

    // 背景
    const bg = this.add.rectangle(0, 0, 400, 180, 0x2a2a4e, 0.98)
      .setStrokeStyle(3, 0xff6666);
    this.confirmContainer.add(bg);

    // 確認メッセージ
    let message = '';
    switch (this.confirmAction) {
      case ConfirmAction.RESTART_STAGE:
        message = 'ステージの最初からやり直しますか？';
        break;
      case ConfirmAction.CHANGE_SUMMONER:
        message = 'サモナースペル選択に戻りますか？\n（現在の進行状況は失われます）';
        break;
      case ConfirmAction.GO_TO_TITLE:
        message = 'タイトル画面に戻りますか？\n（現在の進行状況は失われます）';
        break;
    }

    const messageText = this.add.text(0, -40, message, {
      fontFamily: 'Arial, sans-serif',
      fontSize: '20px',
      color: '#ffffff',
      align: 'center',
    }).setOrigin(0.5);
    this.confirmContainer.add(messageText);

    // はい/いいえボタン
    const yesText = this.add.text(-60, 45, 'はい', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '24px',
      color: '#ffffff',
    }).setOrigin(0.5);
    yesText.setInteractive({ useHandCursor: true });
    yesText.on('pointerover', () => {
      this.confirmSelectedIndex = 0;
      this.updateConfirmDialogSelection();
      AudioManager.getInstance().playSe('se_select');
    });
    yesText.on('pointerdown', () => {
      this.confirmSelectedIndex = 0;
      this.executeConfirmAction();
    });
    this.confirmContainer.add(yesText);
    this.confirmContainer.setData('yesText', yesText);

    const noText = this.add.text(60, 45, 'いいえ', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '24px',
      color: '#ffffff',
    }).setOrigin(0.5);
    noText.setInteractive({ useHandCursor: true });
    noText.on('pointerover', () => {
      this.confirmSelectedIndex = 1;
      this.updateConfirmDialogSelection();
      AudioManager.getInstance().playSe('se_select');
    });
    noText.on('pointerdown', () => {
      this.confirmSelectedIndex = 1;
      this.executeConfirmAction();
    });
    this.confirmContainer.add(noText);
    this.confirmContainer.setData('noText', noText);

    this.updateConfirmDialogSelection();
  }

  /**
   * 確認ダイアログの選択表示を更新
   */
  private updateConfirmDialogSelection(): void {
    if (!this.confirmContainer) return;

    const yesText = this.confirmContainer.getData('yesText') as Phaser.GameObjects.Text;
    const noText = this.confirmContainer.getData('noText') as Phaser.GameObjects.Text;

    if (this.confirmSelectedIndex === 0) {
      yesText.setColor('#ffff00');
      yesText.setText('▶ はい');
      noText.setColor('#ffffff');
      noText.setText('いいえ');
    } else {
      yesText.setColor('#ffffff');
      yesText.setText('はい');
      noText.setColor('#ffff00');
      noText.setText('▶ いいえ');
    }
  }

  /**
   * 確認ダイアログのナビゲーション
   */
  private navigateConfirmDialog(direction: number): void {
    this.confirmSelectedIndex = (this.confirmSelectedIndex + direction + 2) % 2;
    AudioManager.getInstance().playSe('se_select');
    this.updateConfirmDialogSelection();
  }

  /**
   * 確認アクションを実行
   */
  private executeConfirmAction(): void {
    AudioManager.getInstance().playSe('se_decision');

    if (this.confirmSelectedIndex === 0) {
      // 「はい」を選択 - アクションを先に保存してからダイアログを閉じる
      const action = this.confirmAction;
      this.closeConfirmDialog();
      switch (action) {
        case ConfirmAction.RESTART_STAGE:
          this.restartStage();
          break;
        case ConfirmAction.CHANGE_SUMMONER:
          this.goToSummonerSelect();
          break;
        case ConfirmAction.GO_TO_TITLE:
          this.goToTitle();
          break;
      }
    } else {
      // 「いいえ」を選択
      this.closeConfirmDialog();
    }
  }

  /**
   * 確認ダイアログを閉じる
   */
  private closeConfirmDialog(): void {
    AudioManager.getInstance().playSe('se_cancel');
    if (this.confirmContainer) {
      this.confirmContainer.destroy();
      this.confirmContainer = null;
    }
    this.confirmAction = null;
    this.menuMode = PauseMenuMode.MAIN;
  }

  /**
   * プレイヤー情報を表示
   */
  private showPlayerInfo(): void {
    this.menuMode = PauseMenuMode.PLAYER_INFO;
    this.createPlayerInfoPanel();
  }

  /**
   * ボスフェーズ選択画面を表示
   */
  private showBossPhaseSelect(): void {
    this.menuMode = PauseMenuMode.BOSS_PHASE_SELECT;
    this.createBossPhaseSelectPanel();
  }

  /**
   * ボスフェーズ詳細を表示
   */
  private showBossPhaseDetail(phaseIndex: number): void {
    AudioManager.getInstance().playSe('se_decision');
    this.closeInfoPanel();
    this.menuMode = PauseMenuMode.BOSS_PHASE_DETAIL;
    this.createBossPhaseDetailPanel(phaseIndex);
  }

  /**
   * プレイヤー情報パネルを作成（左右分割レイアウト）
   */
  private createPlayerInfoPanel(): void {
    const centerX = GAME_CONFIG.WIDTH / 2;
    const centerY = GAME_CONFIG.HEIGHT / 2;

    this.infoContainer = this.add.container(centerX, centerY);

    // 背景（横幅を拡大）
    const bg = this.add.rectangle(0, 0, 850, 620, 0x1a1a2e, 0.95)
      .setStrokeStyle(3, 0x6666aa);
    this.infoContainer.add(bg);

    // タイトル
    const title = this.add.text(0, -275, '【プレイヤー情報】', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '28px',
      color: '#ffff00',
    }).setOrigin(0.5);
    this.infoContainer.add(title);

    const player = this.pauseData.player;
    if (player) {
      const config = player.getCharacterConfig();
      const stats = config.stats;

      // 左側: ステータス
      const leftX = -210;
      const statsTitle = this.add.text(leftX, -220, '【ステータス】', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '22px',
        color: '#88ccff',
      }).setOrigin(0.5);
      this.infoContainer.add(statsTitle);

      const statsLines = [
        `キャラクター: ${config.name}`,
        ``,
        `HP: ${player.getCurrentHp()} / ${player.getMaxHp()}`,
        `攻撃力: ${stats.attackPower}`,
        `防御力: ${stats.defense}`,
        `攻撃速度: ${stats.attackSpeed.toFixed(2)}回/秒`,
        `移動速度: ${(stats.moveSpeed / 55).toFixed(1)} m/s`,
        `攻撃射程: ${(stats.attackRange / 55).toFixed(1)} m`,
        `クリティカル率: ${(stats.critChance * 100).toFixed(0)}%`,
      ];

      const statsText = this.add.text(leftX, -70, statsLines.join('\n'), {
        fontFamily: 'Arial, sans-serif',
        fontSize: '18px',
        color: '#ffffff',
        lineSpacing: 8,
        align: 'center',
      }).setOrigin(0.5);
      this.infoContainer.add(statsText);

      // 針巫女スタック説明（左側下部）
      const stackTitle = this.add.text(leftX, 110, '【針巫女スタック】', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '18px',
        color: '#ff88cc',
      }).setOrigin(0.5);
      this.infoContainer.add(stackTitle);

      const stackDesc = this.add.text(leftX, 170,
        'Q命中で1スタック獲得(最大10)\n' +
        '1スタック: ATK+5, AS+0.1\n' +
        '5スタック毎: MS+10%\n' +
        '持続: 6秒(更新可)',
        {
          fontFamily: 'Arial, sans-serif',
          fontSize: '14px',
          color: '#cccccc',
          lineSpacing: 4,
          align: 'center',
        }).setOrigin(0.5);
      this.infoContainer.add(stackDesc);

      // 右側: スキル（幅を拡大）
      const rightX = 200;
      const skillsTitle = this.add.text(rightX, -220, '【スキル】', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '22px',
        color: '#ffcc88',
      }).setOrigin(0.5);
      this.infoContainer.add(skillsTitle);

      // スキル説明データ（改行対応）
      const skillDescriptions: Record<string, string[]> = {
        'Q': ['前方に札を投げる', '命中: CD75%解消+スロウ+スタック獲得'],
        'W': ['前方に針を投げ1秒スタン', 'Break成功: E CD50%解消+追加ダメージ'],
        'E': ['3mダッシュ', 'ダッシュ中90%ダメージカット'],
        'R': ['2秒間、周囲10m四方に継続ダメージ'],
      };

      const skillsData = [
        { slot: 'Q', skill: config.skills.Q },
        { slot: 'W', skill: config.skills.W },
        { slot: 'E', skill: config.skills.E },
        { slot: 'R', skill: config.skills.R },
      ];

      let skillY = -175;
      for (const { slot, skill } of skillsData) {
        const slotText = this.add.text(rightX - 180, skillY, `[${slot}]`, {
          fontFamily: 'Arial, sans-serif',
          fontSize: '18px',
          color: '#ffff00',
        }).setOrigin(0, 0.5);
        this.infoContainer.add(slotText);

        const nameText = this.add.text(rightX - 140, skillY, skill.name, {
          fontFamily: 'Arial, sans-serif',
          fontSize: '18px',
          color: '#ffffff',
        }).setOrigin(0, 0.5);
        this.infoContainer.add(nameText);

        const cdText = this.add.text(rightX + 180, skillY, `CD: ${(skill.cooldown / 1000).toFixed(0)}s`, {
          fontFamily: 'Arial, sans-serif',
          fontSize: '14px',
          color: '#888888',
        }).setOrigin(1, 0.5);
        this.infoContainer.add(cdText);

        // 改行対応の説明文
        const descLines = skillDescriptions[slot] || [skill.description];
        let descY = skillY + 20;
        for (const line of descLines) {
          const descText = this.add.text(rightX - 140, descY, line, {
            fontFamily: 'Arial, sans-serif',
            fontSize: '13px',
            color: '#aaaaaa',
          }).setOrigin(0, 0.5);
          this.infoContainer.add(descText);
          descY += 16;
        }

        skillY += 75 + (descLines.length - 1) * 10;
      }
    } else {
      const noDataText = this.add.text(0, 0, 'プレイヤー情報がありません', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '20px',
        color: '#aaaaaa',
      }).setOrigin(0.5);
      this.infoContainer.add(noDataText);
    }

    // 戻るヒント
    const hint = this.add.text(0, 280, '[Enter/Space/ESC] 戻る', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '18px',
      color: '#888888',
    }).setOrigin(0.5);
    this.infoContainer.add(hint);
  }

  /**
   * ボスフェーズ選択パネルを作成
   */
  private createBossPhaseSelectPanel(): void {
    const centerX = GAME_CONFIG.WIDTH / 2;
    const centerY = GAME_CONFIG.HEIGHT / 2;

    this.infoContainer = this.add.container(centerX, centerY);

    // 背景
    const bg = this.add.rectangle(0, 0, 600, 400, 0x1a1a2e, 0.95)
      .setStrokeStyle(3, 0xaa6666);
    this.infoContainer.add(bg);

    // タイトル
    const title = this.add.text(0, -160, '【ステージボス情報】', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '28px',
      color: '#ff6666',
    }).setOrigin(0.5);
    this.infoContainer.add(title);

    // ボス名
    const bossName = this.add.text(0, -110, 'ルーミア - 宵闇の妖怪', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '22px',
      color: '#ffffff',
    }).setOrigin(0.5);
    this.infoContainer.add(bossName);

    // フェーズ選択説明
    const selectHint = this.add.text(0, -60, 'フェーズを選択してスキル詳細を確認', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '18px',
      color: '#aaaaaa',
    }).setOrigin(0.5);
    this.infoContainer.add(selectHint);

    // フェーズリスト
    this.infoContainer.setData('phaseItems', []);
    this.updatePhaseSelectDisplay();

    // 操作ヒント
    const hint = this.add.text(0, 165, '[↑↓] 選択  [Enter] 決定  [ESC] 戻る', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '18px',
      color: '#888888',
    }).setOrigin(0.5);
    this.infoContainer.add(hint);
  }

  /**
   * フェーズ選択表示を更新
   */
  private updatePhaseSelectDisplay(): void {
    if (!this.infoContainer) return;

    // 既存のフェーズアイテムを削除
    const existingItems = this.infoContainer.getData('phaseItems') as Phaser.GameObjects.Text[] | undefined;
    if (existingItems) {
      existingItems.forEach(item => item.destroy());
    }

    const phases = BOSS_CONFIG.RUMIA.PHASES;
    const newItems: Phaser.GameObjects.Text[] = [];
    let y = -10;

    phases.forEach((phase, index) => {
      const isSelected = index === this.selectedPhaseIndex;
      const prefix = isSelected ? '▶ ' : '   ';
      const color = isSelected ? '#ffff00' : '#ffffff';

      const phaseText = this.add.text(0, y, `${prefix}Phase ${index + 1}: ${phase.NAME}`, {
        fontFamily: 'Arial, sans-serif',
        fontSize: '22px',
        color: color,
      }).setOrigin(0.5);

      phaseText.setInteractive({ useHandCursor: true });
      phaseText.on('pointerover', () => {
        if (this.selectedPhaseIndex !== index) {
          this.selectedPhaseIndex = index;
          this.updatePhaseSelectDisplay();
          AudioManager.getInstance().playSe('se_select');
        }
      });
      phaseText.on('pointerdown', () => {
        this.showBossPhaseDetail(index);
      });

      this.infoContainer!.add(phaseText);
      newItems.push(phaseText);

      // HP情報
      const hpText = this.add.text(0, y + 28, `HP: ${phase.HP}`, {
        fontFamily: 'Arial, sans-serif',
        fontSize: '16px',
        color: '#888888',
      }).setOrigin(0.5);
      this.infoContainer!.add(hpText);
      newItems.push(hpText);

      y += 70;
    });

    this.infoContainer.setData('phaseItems', newItems);
  }

  /**
   * ボスフェーズ詳細パネルを作成
   */
  private createBossPhaseDetailPanel(phaseIndex: number): void {
    const centerX = GAME_CONFIG.WIDTH / 2;
    const centerY = GAME_CONFIG.HEIGHT / 2;

    this.infoContainer = this.add.container(centerX, centerY);

    // 背景
    const bg = this.add.rectangle(0, 0, 800, 700, 0x1a1a2e, 0.95)
      .setStrokeStyle(3, 0xaa6666);
    this.infoContainer.add(bg);

    // フェーズ情報を取得
    const phaseKey = phaseIndex === 0 ? 'phase0' : 'phase1';
    const phaseData = RUMIA_SKILL_DESCRIPTIONS[phaseKey];
    const phaseConfig = BOSS_CONFIG.RUMIA.PHASES[phaseIndex];

    // タイトル
    const title = this.add.text(0, -310, `【Phase ${phaseIndex + 1}: ${phaseData.name}】`, {
      fontFamily: 'Arial, sans-serif',
      fontSize: '24px',
      color: '#ff6666',
    }).setOrigin(0.5);
    this.infoContainer.add(title);

    // HP表示
    const hpText = this.add.text(0, -275, `HP: ${phaseConfig.HP}`, {
      fontFamily: 'Arial, sans-serif',
      fontSize: '16px',
      color: '#aaaaaa',
    }).setOrigin(0.5);
    this.infoContainer.add(hpText);

    // スキル一覧
    let y = -230;
    for (const skill of phaseData.skills) {
      // スキルスロットと名前
      const slotText = this.add.text(-370, y, `[${skill.slot}]`, {
        fontFamily: 'Arial, sans-serif',
        fontSize: '20px',
        color: '#ffff00',
      }).setOrigin(0, 0.5);
      this.infoContainer.add(slotText);

      const nameText = this.add.text(-325, y, skill.name, {
        fontFamily: 'Arial, sans-serif',
        fontSize: '20px',
        color: '#ffffff',
      }).setOrigin(0, 0.5);
      this.infoContainer.add(nameText);

      // CD と詠唱時間
      const cdCastText = this.add.text(370, y, `CD: ${(skill.cooldown / 1000).toFixed(0)}s  詠唱: ${(skill.castTime / 1000).toFixed(1)}s`, {
        fontFamily: 'Arial, sans-serif',
        fontSize: '14px',
        color: '#888888',
      }).setOrigin(1, 0.5);
      this.infoContainer.add(cdCastText);

      // Break情報
      const breakColor = skill.breakable ? '#00ff88' : '#666666';
      const breakText = skill.breakable
        ? `Break可能 (${skill.breakTiming})`
        : 'Break不可';
      const breakLabel = this.add.text(-370, y + 22, breakText, {
        fontFamily: 'Arial, sans-serif',
        fontSize: '14px',
        color: breakColor,
      }).setOrigin(0, 0.5);
      this.infoContainer.add(breakLabel);

      // 説明文
      const descText = this.add.text(-370, y + 44, skill.description, {
        fontFamily: 'Arial, sans-serif',
        fontSize: '15px',
        color: '#cccccc',
        wordWrap: { width: 740 },
      }).setOrigin(0, 0);
      this.infoContainer.add(descText);

      // Tips
      const tipsText = this.add.text(-370, y + 68, skill.tips, {
        fontFamily: 'Arial, sans-serif',
        fontSize: '14px',
        color: '#ffcc00',
      }).setOrigin(0, 0);
      this.infoContainer.add(tipsText);

      y += 115;
    }

    // 操作ヒント
    const hint = this.add.text(0, 320, '[Enter/Space/ESC] フェーズ選択に戻る', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '18px',
      color: '#888888',
    }).setOrigin(0.5);
    this.infoContainer.add(hint);
  }

  /**
   * 情報パネルを閉じる
   */
  private closeInfoPanel(): void {
    if (this.infoContainer) {
      this.infoContainer.destroy();
      this.infoContainer = null;
    }
    this.menuMode = PauseMenuMode.MAIN;
  }
}
