import type { TaskKey } from "@battle/types";
import { GAME_BALANCE } from "@battle/config";

export interface TaskDefinition {
  key: TaskKey;
  title: string;
  description: string;
  rewardLabel: string;
  rewardAttempts: number;
  /** Whether completing this task can be claimed for a bonus via the API. */
  claimable: boolean;
  /**
   * True when there's no independent signal to check — claiming the task
   * *is* what completes it (e.g. "share your result" can't be verified
   * server-side). Such tasks are claimable any time they haven't been
   * claimed yet, rather than needing `completed` to already be true.
   */
  selfReported?: boolean;
}

export const TASK_DEFINITIONS: TaskDefinition[] = [
  {
    key: "SUBSCRIBE_CHANNEL",
    title: "Подпишись на канал",
    description: "Обязательное условие для участия",
    rewardLabel: "обязательно",
    rewardAttempts: 0,
    claimable: false,
  },
  {
    key: "PLAY_DAILY",
    title: "Ежедневная игра",
    description: "Сыграй 1 раз сегодня",
    rewardLabel: `+${GAME_BALANCE.taskBonusAttempts} попытка`,
    rewardAttempts: GAME_BALANCE.taskBonusAttempts,
    claimable: true,
  },
  {
    key: "INVITE_FRIEND",
    title: "Пригласи друга",
    description: "Друг подтвердит подписку — вы оба в плюсе",
    rewardLabel: `+${GAME_BALANCE.referralBonusAttempts} попытка`,
    rewardAttempts: 0,
    claimable: false,
  },
  {
    key: "SHARE_RESULT",
    title: "Поделись результатом",
    description: "Расскажи друзьям о своём счёте",
    rewardLabel: "бонус",
    rewardAttempts: GAME_BALANCE.taskBonusAttempts,
    claimable: true,
    selfReported: true,
  },
];
