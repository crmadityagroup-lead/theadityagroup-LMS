'use client';
import { useEffect, useState, useRef } from 'react';
import { Bell, BellRing, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api-client';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';

interface Notification {
  id: string;
  type: string;
  lead_id?: number;
  lead_code?: string;
  customer_name?: string;
  mobile?: string;
  dealer_name?: string;
  brand_name?: string;
  model_name?: string;
  assigned_user_name?: string;
  assigned_by_name?: string;
  actor_name?: string;
  from_status?: string;
  to_status?: string;
  remark?: string;
  title?: string;
  message: string;
  created_at: string;
  read: boolean;
}

function vapidKeyToBytes(value: string) {
  const padding = '='.repeat((4 - value.length % 4) % 4);
  const raw = window.atob((value + padding).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from([...raw].map((character) => character.charCodeAt(0)));
}

export function NotificationsBell() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notification[]>([]);
  const [hasNew, setHasNew] = useState(false);
  const lastCheck = useRef('');
  const dismissedIds = useRef<Set<string>>(new Set());
  const knownIds = useRef<Set<string>>(new Set());
  const requestController = useRef<AbortController | null>(null);
  const initialized = useRef(false);
  const ref = useRef<HTMLDivElement>(null);
  const notificationChannel = useRef<BroadcastChannel | null>(null);
  const router = useRouter();
  const [pushEnabled, setPushEnabled] = useState(false);
  const storageKey = user ? `crm:dismissed-notifications:${user.id}` : 'crm:dismissed-notifications';
  const pushStorageKey = user ? `crm:push-enabled:${user.id}` : 'crm:push-enabled';

  useEffect(() => {
    try {
      const permission = 'Notification' in window ? Notification.permission : 'default';
      setPushEnabled(permission === 'granted' && localStorage.getItem(pushStorageKey) === 'true');
    } catch {
      setPushEnabled(false);
    }
  }, [pushStorageKey]);

  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || Notification.permission !== 'granted') return;
    navigator.serviceWorker.register('/sw.js').then(async (registration) => {
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) { setPushEnabled(true); await api.post('/push/subscribe', { subscription }); }
    }).catch(() => {});
  }, []);

  async function enablePush() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setPushEnabled(false);
        try { localStorage.removeItem(pushStorageKey); } catch {}
        return;
      }
      // Reflect the browser permission immediately; service-worker setup can
      // take a moment and should not leave the control stuck on Enable.
      setPushEnabled(true);
      try { localStorage.setItem(pushStorageKey, 'true'); } catch {}
      const registration = await navigator.serviceWorker.register('/sw.js');
      const subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: vapidKeyToBytes(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '') });
      await api.post('/push/subscribe', { subscription });
    } catch (error) { console.warn('[notifications] push setup failed', error); }
  }

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || '[]');
      dismissedIds.current = new Set(Array.isArray(saved) ? saved.map(String) : []);
    } catch {
      dismissedIds.current = new Set();
    }
    const resetTimer = window.setTimeout(() => setItems([]), 0);
    lastCheck.current = '';
    initialized.current = false;
    knownIds.current = new Set();
    const resetNewTimer = window.setTimeout(() => setHasNew(false), 0);
    return () => { window.clearTimeout(resetTimer); window.clearTimeout(resetNewTimer); };
  }, [storageKey]);

  async function showBrowserNotification(notification: Notification) {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    const title = notification.title || 'CRM Activity';
    const body = notification.message || 'You have a new CRM update.';
    try {
      const registration = await navigator.serviceWorker?.ready;
      if (registration) {
        await registration.showNotification(title, { body, icon: '/favicon.png', badge: '/favicon.png', data: { url: '/' } });
      } else {
        new window.Notification(title, { body, icon: '/favicon.png' });
      }
    } catch {
      try { new window.Notification(title, { body, icon: '/favicon.png' }); } catch {}
    }
  }

  useEffect(() => {
    if (!user || typeof BroadcastChannel === 'undefined') return;
    const channel = new BroadcastChannel(`crm:notifications:${user.id}`);
    notificationChannel.current = channel;
    channel.onmessage = (event) => {
      const notification = event.data?.notification as Notification | undefined;
      if (!notification || knownIds.current.has(notification.id)) return;
      knownIds.current.add(notification.id);
      setItems((current) => [notification, ...current.filter((item) => item.id !== notification.id)].slice(0, 30));
      setHasNew(true);
      void showBrowserNotification(notification);
    };
    return () => {
      channel.close();
      notificationChannel.current = null;
    };
  }, [user?.id]);

  function persistDismissed() {
    try {
      localStorage.setItem(storageKey, JSON.stringify([...dismissedIds.current].slice(-200)));
    } catch {}
  }

  // Fetch notifications (Realtime trigger + short polling fallback)
  async function fetchNotifications() {
    if (document.visibilityState === 'hidden') return;
    requestController.current?.abort();
    const controller = new AbortController();
    requestController.current = controller;
    try {
      const data = await api.get<{ notifications: Notification[]; server_time?: string }>(`/notifications?since=${encodeURIComponent(lastCheck.current)}`, controller.signal);
      if (data.notifications && data.notifications.length > 0) {
        if (initialized.current && notificationChannel.current) {
          data.notifications.forEach((notification) => {
            if (!knownIds.current.has(notification.id)) {
              notificationChannel.current?.postMessage({ notification });
            }
          });
        }
        window.dispatchEvent(new CustomEvent('crm:refresh', { detail: { notifications: data.notifications } }));
        const hasIncoming = data.notifications.some(item => !dismissedIds.current.has(String(item.id)) && !knownIds.current.has(item.id));
        if (initialized.current && hasIncoming) setHasNew(true);
        setItems(prev => {
          const merged = [...data.notifications, ...prev].filter(n => !dismissedIds.current.has(String(n.id)));
          // dedupe by id
          const seen = new Set<string>();
          const next = merged.filter(n => { if (seen.has(n.id)) return false; seen.add(n.id); return true; }).slice(0, 30);
          knownIds.current = new Set(next.map(n => n.id));
          return next;
        });
      }
      initialized.current = true;
      // The API cursor represents the beginning of its read window. Keeping it
      // unchanged across the response prevents events created during the query
      // from disappearing between polling cycles.
      lastCheck.current = data.server_time || lastCheck.current || new Date().toISOString();
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) return;
    } finally {
      if (requestController.current === controller) requestController.current = null;
    }
  }

  useEffect(() => {
    // Polling/realtime callbacks intentionally update notification state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    const startupTimer = window.setTimeout(() => { void fetchNotifications(); }, 1200);
    // Keep a short fallback interval for deployments without Realtime enabled.
    const interval = setInterval(fetchNotifications, 15000);

    // Supabase Realtime subscription (if env is set)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    let channel: any = null;
    if (supabaseUrl && supabaseKey && !supabaseKey.includes('dummy')) {
      try {
        const supabase = createClient(supabaseUrl, supabaseKey);
        channel = supabase
          .channel('crm-leads-changes')
          .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'crm_leads' }, (payload: any) => {
            // A new lead was inserted — refetch notifications
            fetchNotifications();
          })
          .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'crm_leads' }, (payload: any) => {
            // Assignment/status changed — refetch immediately.
            fetchNotifications();
          })
          .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'crm_lead_activities' }, (payload: any) => {
            // Assignment activity inserted — refetch immediately.
            fetchNotifications();
          })
          .subscribe();
      } catch (e) { console.warn('[notifications] Supabase realtime init failed, falling back to polling', e); }
    }

    return () => {
      window.clearTimeout(startupTimer);
      clearInterval(interval);
      requestController.current?.abort();
      requestController.current = null;
      if (channel) {
        try {
          const supabase = createClient(supabaseUrl!, supabaseKey!);
          supabase.removeChannel(channel);
        } catch {}
      }
    };
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  const unread = items.filter(n => !n.read).length;

  useEffect(() => {
    const baseTitle = 'Aditya Group CRM';
    document.title = unread > 0 ? `(${unread}) ${baseTitle}` : baseTitle;
    return () => { document.title = baseTitle; };
  }, [unread]);

  function dismiss(id: string) {
    dismissedIds.current.add(String(id));
    persistDismissed();
    setItems(prev => prev.filter(item => item.id !== id));
  }

  function clearNotifications() {
    items.forEach(item => dismissedIds.current.add(String(item.id)));
    persistDismissed();
    setItems([]);
  }

  function handleClick(n: Notification) {
    setHasNew(false);
    setOpen(false);
    // Opening a notification acknowledges it and removes it from the bell immediately.
    dismissedIds.current.add(String(n.id));
    persistDismissed();
    setItems(prev => prev.filter(item => item.id !== n.id));
    if (n.lead_id && (window as any).App) {
      (window as any).App.navigate('lead-detail', n.lead_id);
    }
  }

  function notificationMessage(n: Notification) {
    if (n.type === 'lead_assigned') return `${n.assigned_by_name || 'A user'} assigned this lead to ${n.assigned_user_name || 'you'}`;
    if (n.type === 'lead_status_changed') return `${n.customer_name || 'Customer'}'s lead status changed from ${(n.from_status || 'previous status').replaceAll('_', ' ')} to ${(n.to_status || 'updated status').replaceAll('_', ' ')} by ${n.actor_name || 'a user'}`;
    if (n.type === 'lead_remark_added') return `${n.actor_name || 'A user'} added a remark${n.remark ? `: ${n.remark}` : ''}`;
    return n.message;
  }

  return (
    <div className="relative" ref={ref}>
      <Button variant="ghost" size="icon" className="h-9 w-9 relative !bg-transparent hover:!bg-transparent hover:!text-current focus-visible:!bg-transparent active:!bg-transparent" onClick={() => { setOpen(!open); setHasNew(false); }}>
        <Bell className={`h-4 w-4 transition-colors ${hasNew ? 'text-red-500 animate-pulse' : ''}`} />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 rounded-full bg-red-600 text-white text-[10px] font-bold flex items-center justify-center shadow-sm">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </Button>
      {open && (
        <>
          <div className="fixed inset-0 z-40 bg-background/35 backdrop-blur-sm" onClick={() => setOpen(false)} aria-hidden="true" />
          <div className="fixed left-1/2 top-1/2 z-50 w-[min(20rem,calc(100vw-1rem))] max-w-[calc(100vw-1rem)] lg:w-[42rem] lg:max-w-[42rem] -translate-x-1/2 -translate-y-1/2 bg-popover border border-border rounded-lg shadow-lg">
            <div className="p-3 border-b border-border flex items-center justify-between">
              <span className="font-semibold text-sm">Notifications</span>
              <div className="flex items-center gap-1">
                {!pushEnabled && <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => void enablePush()} title="Enable mobile push notifications"><BellRing className="h-3 w-3" /> Enable</Button>}
                {items.length > 0 && <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={clearNotifications}>Clear</Button>}
              </div>
            </div>
            {items.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">No new notifications</div>
            ) : (
              <div className="max-h-[19rem] overflow-y-auto">
                {items.map(n => (
                  <div key={n.id} className="flex items-start border-b border-border last:border-b-0 hover:bg-muted/50 transition-colors">
                    <button onClick={() => handleClick(n)} className="flex-1 min-w-0 cursor-pointer text-left p-3">
                      <div className="text-sm font-semibold">{n.title || 'CRM Activity'}</div>
                      <div className="mt-1 text-sm">{notificationMessage(n)}</div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {n.customer_name || 'Lead'}{n.mobile ? ` - ${n.mobile}` : ''}{n.dealer_name ? ` - ${n.dealer_name}` : ''}
                        {n.brand_name || n.model_name ? ` - ${[n.brand_name, n.model_name].filter(Boolean).join(' / ')}` : ''}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">{new Date(n.created_at).toLocaleString('en-IN')}</div>
                    </button>
                    <button type="button" aria-label="Dismiss notification" onClick={() => dismiss(n.id)} className="cursor-pointer p-2 mt-1 mr-1 rounded hover:bg-muted text-muted-foreground">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
