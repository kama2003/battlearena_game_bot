import type { RequiredChannel } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { env } from "../../config/env";
import { TelegramApiError, botUserId, getChatInfo, getMemberStatus } from "../telegram/client";

export class ChannelError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
  }
}

const MAX_EXTRA_CHANNELS = 5;

export function listRequiredChannels(): Promise<RequiredChannel[]> {
  return prisma.requiredChannel.findMany({ orderBy: { createdAt: "asc" } });
}

/** Accepts "@name", "name", "t.me/name" or "https://t.me/name"; private invite links have no usable username. */
export function parseChannelUsername(input: string): string | null {
  const raw = input.trim();
  if (/t\.me\/(\+|joinchat)/i.test(raw)) return null;
  const name = raw
    .replace(/^https?:\/\//i, "")
    .replace(/^(www\.)?t\.me\//i, "")
    .replace(/^@/, "")
    .split(/[/?#\s]/)[0];
  return name && /^[A-Za-z][A-Za-z0-9_]{4,31}$/.test(name) ? name : null;
}

/**
 * Adds a channel players must also be subscribed to. Only checked-and-usable
 * channels get in: public, actually a channel, and the bot already an admin
 * there (Telegram refuses getChatMember to a bot that isn't).
 */
export async function addRequiredChannel(input: string): Promise<RequiredChannel> {
  const username = parseChannelUsername(input);
  if (!username) {
    throw new ChannelError("Нужен публичный канал: пришли @ник или ссылку вида t.me/ник.", 400);
  }

  if ((await prisma.requiredChannel.count()) >= MAX_EXTRA_CHANNELS) {
    throw new ChannelError(`Больше ${MAX_EXTRA_CHANNELS} дополнительных каналов нельзя.`, 409);
  }

  let chat;
  try {
    chat = await getChatInfo(`@${username}`);
  } catch (error) {
    if (error instanceof TelegramApiError) {
      throw new ChannelError(`Канал @${username} не найден.`, 404);
    }
    throw error;
  }

  if (chat.type !== "channel") {
    throw new ChannelError(`@${username} — не канал, нужен именно канал.`, 400);
  }
  if (String(chat.id) === env.CHANNEL_ID) {
    throw new ChannelError("Это основной канал — на него подписка и так обязательна.", 409);
  }
  if (await prisma.requiredChannel.findUnique({ where: { chatId: String(chat.id) } })) {
    throw new ChannelError(`@${username} уже добавлен.`, 409);
  }

  const notAdmin = new ChannelError(
    `Сначала сделай бота @${env.BOT_USERNAME} администратором канала @${username}, потом повтори.`,
    400,
  );
  try {
    const status = await getMemberStatus(chat.id, botUserId());
    if (status !== "administrator" && status !== "creator") throw notAdmin;
  } catch (error) {
    if (error instanceof ChannelError) throw error;
    if (error instanceof TelegramApiError) throw notAdmin;
    throw error;
  }

  return prisma.requiredChannel.create({
    data: {
      chatId: String(chat.id),
      username: chat.username ?? username,
      title: chat.title ?? username,
    },
  });
}

export async function removeRequiredChannel(id: string): Promise<RequiredChannel> {
  const channel = await prisma.requiredChannel.findUnique({ where: { id } });
  if (!channel) throw new ChannelError("Такого канала в списке нет.", 404);
  await prisma.requiredChannel.delete({ where: { id } });
  return channel;
}
