import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  Clock,
  Info,
  XCircle,
} from 'lucide-react';
import {
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '../../services/notification.service';
import { getAuthToken } from '../../utils/authUser';
import { cn } from '../../utils/cn';

const TYPE_META = {
  AUDIT_COMPLETED: {
    icon: CheckCircle2,
    className: 'text-emerald-600 dark:text-emerald-400',
  },
  AUDIT_FAILED: {
    icon: XCircle,
    className: 'text-red-600 dark:text-red-400',
  },
  HIGH_EXCEPTION_COUNT: {
    icon: AlertTriangle,
    className: 'text-amber-600 dark:text-amber-400',
  },
  SESSION_EXPIRING_SOON: {
    icon: Clock,
    className: 'text-sky-600 dark:text-sky-400',
  },
  MISSING_PREREQUISITE: {
    icon: Info,
    className: 'text-violet-600 dark:text-violet-400',
  },
};

function formatRelativeTime(iso) {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const diffMs = Date.now() - then;
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function NotificationBell({ buttonClassName, iconClassName, size = 'md' }) {
  const navigate = useNavigate();
  const rootRef = useRef(null);
  const buttonRef = useRef(null);
  const panelRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [panelStyle, setPanelStyle] = useState({ top: 0, left: 0, width: 352 });

  const load = useCallback(async () => {
    if (!getAuthToken()) {
      setItems([]);
      setUnreadCount(0);
      return;
    }

    setLoading(true);
    try {
      const data = await fetchNotifications({ limit: 25 });
      if (data) {
        setItems(data.items ?? []);
        setUnreadCount(data.unreadCount ?? 0);
      }
    } catch {
      // Keep existing list on transient errors.
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const interval = window.setInterval(load, 60_000);
    return () => window.clearInterval(interval);
  }, [load]);

  const updatePanelPosition = useCallback(() => {
    const button = buttonRef.current;
    if (!button) return;

    const rect = button.getBoundingClientRect();
    const width = Math.min(352, window.innerWidth - 16);
    const left = Math.max(8, Math.min(rect.right - width, window.innerWidth - width - 8));
    const top = rect.bottom + 8;

    setPanelStyle({ top, left, width });
  }, []);

  useEffect(() => {
    if (!open) return undefined;

    updatePanelPosition();
    window.addEventListener('resize', updatePanelPosition);
    window.addEventListener('scroll', updatePanelPosition, true);

    function onPointerDown(event) {
      const target = event.target;
      if (
        rootRef.current?.contains(target) ||
        panelRef.current?.contains(target)
      ) {
        return;
      }
      setOpen(false);
    }

    document.addEventListener('mousedown', onPointerDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('resize', updatePanelPosition);
      window.removeEventListener('scroll', updatePanelPosition, true);
    };
  }, [open, updatePanelPosition]);

  async function handleItemClick(item) {
    if (!item.isRead) {
      try {
        const result = await markNotificationRead(item.id);
        setUnreadCount(result?.unreadCount ?? Math.max(0, unreadCount - 1));
        setItems((prev) =>
          prev.map((row) =>
            row.id === item.id ? { ...row, isRead: true, readAt: new Date().toISOString() } : row
          )
        );
      } catch {
        // Still navigate if link exists.
      }
    }

    setOpen(false);
    if (item.actionUrl) {
      navigate(item.actionUrl);
    }
  }

  async function handleMarkAllRead() {
    try {
      await markAllNotificationsRead();
      setUnreadCount(0);
      setItems((prev) =>
        prev.map((row) => ({ ...row, isRead: true, readAt: row.readAt ?? new Date().toISOString() }))
      );
    } catch {
      // ignore
    }
  }

  const isLoggedIn = Boolean(getAuthToken());
  const badge = unreadCount > 99 ? '99+' : String(unreadCount);
  const isLarge = size === 'lg';

  const defaultButtonClass = isLarge
    ? 'relative flex h-14 w-14 items-center justify-center rounded-full border border-[var(--color-border-soft)] bg-[var(--color-surface-elevated)] text-[var(--color-text-muted)] transition hover:border-[var(--color-border-strong)] hover:bg-[var(--color-surface-subtle)] hover:text-[var(--color-text-primary)]'
    : 'relative flex h-12 w-12 items-center justify-center rounded-full border border-[var(--color-border-soft)] bg-[var(--color-surface-elevated)] text-[var(--color-text-muted)] transition hover:border-[var(--color-border-strong)] hover:bg-[var(--color-surface-subtle)] hover:text-[var(--color-text-primary)]';

  const panel = open
    ? createPortal(
        <div
          ref={panelRef}
          className="fixed z-[200] overflow-hidden rounded-2xl border border-[var(--color-border-soft)] bg-[var(--color-surface-elevated)] shadow-[var(--shadow-elevated)]"
          style={{ top: panelStyle.top, left: panelStyle.left, width: panelStyle.width }}
          role="dialog"
          aria-label="Notifications"
        >
          <div className="flex items-center justify-between border-b border-[var(--color-border-soft)] px-4 py-3">
            <p className="text-sm font-semibold text-[var(--color-text-primary)]">Notifications</p>
            {unreadCount > 0 ? (
              <button
                type="button"
                className="text-xs font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                onClick={handleMarkAllRead}
              >
                Mark all read
              </button>
            ) : null}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {!isLoggedIn ? (
              <p className="px-4 py-6 text-center text-sm text-[var(--color-text-muted)]">
                Sign in to see notifications.
              </p>
            ) : loading && items.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-[var(--color-text-muted)]">Loading…</p>
            ) : items.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-[var(--color-text-muted)]">
                No notifications yet.
              </p>
            ) : (
              <ul className="divide-y divide-[var(--color-border-soft)]">
                {items.map((item) => {
                  const meta = TYPE_META[item.type] ?? TYPE_META.MISSING_PREREQUISITE;
                  const Icon = meta.icon;
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        className={cn(
                          'flex w-full gap-3 px-4 py-3 text-left transition hover:bg-[var(--color-surface-subtle)]',
                          !item.isRead && 'bg-red-50/50 dark:bg-red-950/15'
                        )}
                        onClick={() => handleItemClick(item)}
                      >
                        <span className={cn('mt-0.5 shrink-0', meta.className)}>
                          <Icon className="h-4 w-4" strokeWidth={2} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-start justify-between gap-2">
                            <span className="text-sm font-semibold text-[var(--color-text-primary)]">
                              {item.title}
                            </span>
                            {!item.isRead ? (
                              <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-red-500" />
                            ) : null}
                          </span>
                          <span className="mt-0.5 block text-xs leading-relaxed text-[var(--color-text-muted)]">
                            {item.message}
                          </span>
                          <span className="mt-1 block text-[10px] font-medium uppercase tracking-wide text-[var(--color-text-muted)]">
                            {formatRelativeTime(item.createdAt)}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>,
        document.body
      )
    : null;

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        className={cn(
          defaultButtonClass,
          open && 'border-[var(--color-border-strong)] bg-[var(--color-surface-subtle)] text-[var(--color-text-primary)]',
          buttonClassName
        )}
        aria-label="Notifications"
        aria-expanded={open}
        onClick={() => {
          const nextOpen = !open;
          setOpen(nextOpen);
          if (nextOpen) {
            updatePanelPosition();
            load();
          }
        }}
      >
        <Bell className={cn(isLarge ? 'h-5 w-5' : 'h-5 w-5', iconClassName)} strokeWidth={1.5} />
        {isLoggedIn && unreadCount > 0 ? (
          <span className="absolute right-1 top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white ring-2 ring-[var(--color-surface-elevated)]">
            {badge}
          </span>
        ) : null}
      </button>

      {panel}
    </div>
  );
}
