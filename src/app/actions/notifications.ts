"use server";

import { NotificationService } from "@/application/notifications/notification-service";
import type { NotificationRow } from "@/infrastructure/supabase/types";
import { requireCurrentUserId } from "@/lib/auth/current-user";

const notifications = new NotificationService();

export async function listNotifications(): Promise<NotificationRow[]> {
  const userId = await requireCurrentUserId();
  return notifications.listRecent(userId);
}

export async function markNotificationRead(id: string): Promise<void> {
  const userId = await requireCurrentUserId();
  await notifications.markRead(id, userId);
}

export async function markAllNotificationsRead(): Promise<void> {
  const userId = await requireCurrentUserId();
  await notifications.markAllRead(userId);
}
