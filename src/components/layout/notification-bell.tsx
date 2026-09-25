"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BellIcon } from "lucide-react";

import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/app/actions/notifications";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { createBrowserSupabaseClient } from "@/infrastructure/supabase/browser-client";
import { formatElapsed } from "@/lib/format-date";
import { cn } from "@/lib/utils";
import type { NotificationRow } from "@/infrastructure/supabase/types";

export function NotificationBell() {
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [open, setOpen] = useState(false);
  const unreadCount = notifications.filter((n) => !n.read_at).length;

  useEffect(() => {
    let cancelled = false;
    listNotifications()
      .then((rows) => {
        if (!cancelled) setNotifications(rows);
      })
      .catch(() => {
        // Best-effort: the bell simply stays empty if this fails.
      });

    const supabase = createBrowserSupabaseClient();
    let channel: ReturnType<typeof supabase.channel> | undefined;

    (async () => {
      // Same session-hydration gotcha documented in run-workspace.tsx: the
      // realtime auth must be set from the resolved session before
      // subscribing, or every broadcast is silently dropped by RLS.
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (cancelled || !session) return;
      supabase.realtime.setAuth(session.access_token);

      channel = supabase
        .channel(`notifications-${session.user.id}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "notifications",
            filter: `user_id=eq.${session.user.id}`,
          },
          (payload) => {
            setNotifications((current) => [
              payload.new as NotificationRow,
              ...current,
            ]);
          },
        )
        .subscribe();
    })();

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      // Cheap extra safety net for a tab left open long enough that the
      // realtime socket silently dropped — refetch whenever the popover
      // opens rather than relying on a fallback poll timer.
      listNotifications()
        .then(setNotifications)
        .catch(() => {});
    }
  }

  function handleItemClick(id: string) {
    setNotifications((current) =>
      current.map((n) =>
        n.id === id ? { ...n, read_at: n.read_at ?? new Date().toISOString() } : n,
      ),
    );
    markNotificationRead(id).catch(() => {});
  }

  function handleMarkAllRead() {
    setNotifications((current) =>
      current.map((n) => ({ ...n, read_at: n.read_at ?? new Date().toISOString() })),
    );
    markAllNotificationsRead().catch(() => {});
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger
        render={
          <Button variant="ghost" size="icon-sm" aria-label="Notifications">
            <span className="relative inline-flex">
              <BellIcon />
              {unreadCount > 0 && (
                <Badge
                  variant="destructive"
                  className="absolute -top-2 -right-2 h-4 min-w-4 justify-center px-1 text-[10px]"
                >
                  {unreadCount > 9 ? "9+" : unreadCount}
                </Badge>
              )}
            </span>
          </Button>
        }
      />
      <PopoverContent>
        <div className="flex items-center justify-between border-b px-3 py-2">
          <p className="text-sm font-medium">Notifications</p>
          <Button
            variant="ghost"
            size="xs"
            disabled={unreadCount === 0}
            onClick={handleMarkAllRead}
          >
            Mark all read
          </Button>
        </div>
        <div className="max-h-96 overflow-y-auto">
          {notifications.length === 0 ? (
            <p className="text-muted-foreground px-3 py-6 text-center text-sm">
              No notifications yet.
            </p>
          ) : (
            notifications.map((n) => {
              const item = (
                <div
                  className={cn(
                    "hover:bg-accent/50 block cursor-pointer border-b px-3 py-2.5 text-sm last:border-b-0",
                    !n.read_at && "bg-accent/30",
                  )}
                  onClick={() => handleItemClick(n.id)}
                >
                  <p className="font-medium">{n.title}</p>
                  <p className="text-muted-foreground line-clamp-2">
                    {n.message}
                  </p>
                  <p className="text-muted-foreground text-metadata mt-1">
                    {formatElapsed(n.created_at)} ago
                  </p>
                </div>
              );
              return n.run_id ? (
                <Link key={n.id} href={`/runs/${n.run_id}`}>
                  {item}
                </Link>
              ) : (
                <div key={n.id}>{item}</div>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
