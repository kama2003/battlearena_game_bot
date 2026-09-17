import { prisma } from "../../lib/prisma";
import { dailyPeriodKey, startOfUtcDay, endOfUtcDay } from "../../lib/dates";
import { TASK_DEFINITIONS, type TaskDefinition } from "./definitions";
import type { ClaimTaskResponse, TaskDto, TaskKey, TasksResponse } from "@battle/types";

export class TaskError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode = 400,
  ) {
    super(message);
  }
}

async function ensureTaskRow(definition: TaskDefinition) {
  return prisma.task.upsert({
    where: { key: definition.key },
    create: {
      key: definition.key,
      title: definition.title,
      description: definition.description,
      rewardAttempts: definition.rewardAttempts,
    },
    update: {
      title: definition.title,
      description: definition.description,
      rewardAttempts: definition.rewardAttempts,
    },
  });
}

function periodKeyFor(key: TaskKey): string {
  if (key === "PLAY_DAILY" || key === "SHARE_RESULT") return dailyPeriodKey();
  return "once";
}

async function isCompleted(userId: string, key: TaskKey): Promise<boolean> {
  switch (key) {
    case "SUBSCRIBE_CHANNEL": {
      const latest = await prisma.subscriptionCheck.findFirst({
        where: { userId },
        orderBy: { checkedAt: "desc" },
      });
      return latest?.subscribed ?? false;
    }
    case "PLAY_DAILY": {
      const count = await prisma.gameResult.count({
        where: { userId, createdAt: { gte: startOfUtcDay(), lt: endOfUtcDay() } },
      });
      return count > 0;
    }
    case "INVITE_FRIEND": {
      const count = await prisma.referral.count({ where: { referrerId: userId, status: "CONFIRMED" } });
      return count > 0;
    }
    case "SHARE_RESULT":
      // Self-reported: completing == claiming, there is no independent signal.
      return false;
  }
}

export async function getTasksForUser(userId: string): Promise<TasksResponse> {
  const tasks: TaskDto[] = await Promise.all(
    TASK_DEFINITIONS.map(async (def) => {
      const task = await ensureTaskRow(def);
      const periodKey = periodKeyFor(def.key);
      const [completed, userTask] = await Promise.all([
        isCompleted(userId, def.key),
        prisma.userTask.findUnique({
          where: { userId_taskId_periodKey: { userId, taskId: task.id, periodKey } },
        }),
      ]);

      const claimed = Boolean(userTask?.claimedAt);
      const claimable = def.claimable && !claimed && (def.selfReported || completed);

      return {
        key: def.key,
        title: def.title,
        description: def.description,
        rewardLabel: def.rewardLabel,
        rewardAttempts: def.rewardAttempts,
        completed: completed || claimed,
        claimed,
        claimable,
      };
    }),
  );

  return { tasks };
}

export async function claimTask(userId: string, key: TaskKey): Promise<ClaimTaskResponse> {
  const definition = TASK_DEFINITIONS.find((t) => t.key === key);
  if (!definition) {
    throw new TaskError("Unknown task", "TASK_NOT_FOUND", 404);
  }
  if (!definition.claimable) {
    throw new TaskError("This task cannot be claimed directly", "TASK_NOT_CLAIMABLE", 400);
  }

  const task = await ensureTaskRow(definition);
  const periodKey = periodKeyFor(key);

  // Self-reported tasks (claiming *is* completing them) skip the check; the
  // rest require the completion signal to already be true.
  const alreadyCompleted = definition.selfReported || (await isCompleted(userId, key));
  if (!alreadyCompleted) {
    throw new TaskError("Task is not completed yet", "TASK_NOT_COMPLETED", 400);
  }

  const result = await prisma.$transaction(async (tx) => {
    const existing = await tx.userTask.findUnique({
      where: { userId_taskId_periodKey: { userId, taskId: task.id, periodKey } },
    });
    if (existing?.claimedAt) {
      throw new TaskError("Task already claimed", "TASK_ALREADY_CLAIMED", 409);
    }

    const now = new Date();
    await tx.userTask.upsert({
      where: { userId_taskId_periodKey: { userId, taskId: task.id, periodKey } },
      create: { userId, taskId: task.id, periodKey, completedAt: now, claimedAt: now },
      update: { completedAt: now, claimedAt: now },
    });

    if (definition.rewardAttempts > 0) {
      await tx.user.update({
        where: { id: userId },
        data: { bonusAttempts: { increment: definition.rewardAttempts } },
      });
    }

    return definition.rewardAttempts;
  });

  const tasks = await getTasksForUser(userId);
  const task2 = tasks.tasks.find((t) => t.key === key)!;

  return { task: task2, attemptsGranted: result };
}
