'use client';
import { cn } from '@/lib/utils';

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    new: 'bg-[#d89b27] text-black', in_progress: 'bg-[#d89b27] text-black',
    follow_up: 'bg-[#d89b27] text-black', converted: 'bg-[#d89b27] text-black',
    closed: 'bg-black text-white', lost: 'bg-[#d89b27] text-black', recycled: 'bg-[#d89b27] text-black',
  };
  return <span className={cn('inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium capitalize', map[status] || 'bg-muted text-muted-foreground')}>{status.replace('_', ' ')}</span>;
}

export function PriorityBadge({ priority }: { priority: string }) {
  const map: Record<string, string> = {
    Low: 'bg-white text-black border border-black',
    Medium: 'bg-[#d89b27] text-black',
    High: 'bg-[#d89b27] text-black',
    Critical: 'bg-black text-white',
  };
  return <span className={cn('inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium', map[priority] || map.Medium)}>{priority}</span>;
}

export function RoleBadge({ role }: { role: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    super_admin: { label: 'Super Admin', cls: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' },
    admin: { label: 'Admin', cls: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200' },
    admin_2: { label: 'Dealer Admin', cls: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200' },
    data_operator_1: { label: 'Data Operator 1', cls: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' },
    data_operator_2: { label: 'Data Operator 2', cls: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' },
    department_user: { label: 'Dept User', cls: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200' },
  };
  const r = map[role] || { label: role, cls: 'bg-muted text-muted-foreground' };
  return <span className={cn('inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium', r.cls)}>{r.label}</span>;
}

export function StatCard({ label, value, icon: Icon, accent = 'default' }: { label: string; value: any; icon: any; accent?: 'default' | 'gold' | 'green' | 'red' | 'blue' }) {
  const accentMap = {
    default: 'border-border',
    gold: 'border-l-4 border-l-[var(--color-gold)]',
    green: 'border-l-4 border-l-[var(--color-gold)]',
    red: 'border-l-4 border-l-[var(--color-gold)]',
    blue: 'border-l-4 border-l-[var(--color-gold)]',
  };
  return (
    <div className={cn('neo-kpi bg-card border rounded-xl p-4 transition-colors hover:bg-accent', accentMap[accent])}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</span>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="text-2xl font-bold">{value ?? '—'}</div>
    </div>
  );
}

export function EmptyState({ icon: Icon, title, message, action }: { icon: any; title: string; message?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-3">
        <Icon className="h-6 w-6 text-muted-foreground" />
      </div>
      <h3 className="font-semibold text-lg mb-1">{title}</h3>
      {message && <p className="text-sm text-muted-foreground mb-4 max-w-sm">{message}</p>}
      {action}
    </div>
  );
}

export function timeAgo(d?: string | null) {
  if (!d) return '—';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return '—';
  const sec = Math.floor((Date.now() - dt.getTime()) / 1000);
  if (sec < 60) return 'just now';
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  if (sec < 604800) return `${Math.floor(sec / 86400)}d ago`;
  return dt.toLocaleDateString('en-IN');
}

export function formatDate(d?: string | null, withTime = false, withSeconds = false) {
  if (!d) return '—';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return '—';
  const opts: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'short', day: '2-digit' };
  if (withTime) {
    opts.hour = '2-digit';
    opts.minute = '2-digit';
    if (withSeconds) opts.second = '2-digit';
  }
  return dt.toLocaleString('en-IN', opts);
}
