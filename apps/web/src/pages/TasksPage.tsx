import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { Gamepad2, Send, Share2, UserPlus } from "lucide-react";
import type { TaskKey } from "@battle/types";
import { PageHeader, Skeleton, TaskCard, useToast } from "@battle/ui";
import { useClaimTask, useTasks } from "../hooks/useTasks";
import { ApiError } from "../lib/apiClient";
import { hapticNotify } from "../lib/telegram";

const ICONS: Record<TaskKey, ReactNode> = {
  SUBSCRIBE_CHANNEL: <Send size={20} />,
  PLAY_DAILY: <Gamepad2 size={20} />,
  INVITE_FRIEND: <UserPlus size={20} />,
  SHARE_RESULT: <Share2 size={20} />,
};

export function TasksPage() {
  const navigate = useNavigate();
  const { data, isLoading } = useTasks();
  const claim = useClaimTask();
  const toast = useToast();

  async function handleTaskClick(key: TaskKey) {
    if (key === "INVITE_FRIEND") {
      navigate("/invite");
      return;
    }
    try {
      const result = await claim.mutateAsync(key);
      hapticNotify("success");
      if (result.attemptsGranted > 0) {
        toast.show(`+${result.attemptsGranted} попытка начислена!`, "success");
      }
    } catch (error) {
      toast.show(error instanceof ApiError ? error.message : "Не удалось выполнить задание", "error");
    }
  }

  return (
    <div className="flex flex-col gap-4 px-4 pt-6">
      <PageHeader title="Задания" subtitle="Выполняй и получай бонусные попытки" />

      <div className="flex flex-col gap-2.5">
        {isLoading &&
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[76px]" />)}

        {data?.tasks.map((task) => (
          <TaskCard
            key={task.key}
            icon={ICONS[task.key]}
            title={task.title}
            description={task.description}
            reward={task.rewardLabel}
            completed={task.claimed || (task.completed && !task.claimable && task.key !== "INVITE_FRIEND")}
            onClick={
              task.key === "INVITE_FRIEND" || task.claimable ? () => handleTaskClick(task.key) : undefined
            }
          />
        ))}
      </div>
    </div>
  );
}
