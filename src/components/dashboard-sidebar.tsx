'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api-client';
import { ClipboardList, Sparkles, CalendarDays, Clock, Zap, TrendingUp, CheckCircle2 } from 'lucide-react';

interface DashboardData {
  total: number; new_unworked: number; followups_due_today: number; overdue_followups: number;
  high_critical: number; recently_assigned: number; upcoming_followups: number;
  by_status: Record<string, number>;
  by_dealer: { name: string; c: number }[];
}

export function DashboardSidebar() {
  const [data, setData] = useState<DashboardData | null>(null);

  useEffect(() => {
    api.get<DashboardData>('/dashboard').then(setData).catch(() => {});
  }, []);

  if (!data) {
    return (
      <div className="p-3 space-y-2">
        <div className="h-3 w-20 bg-muted rounded animate-pulse" />
        <div className="h-12 bg-muted rounded animate-pulse" />
        <div className="h-12 bg-muted rounded animate-pulse" />
        <div className="h-12 bg-muted rounded animate-pulse" />
      </div>
    );
  }

  const stats = [
    { label: 'Total Leads', value: data.total, icon: ClipboardList, color: 'text-blue-600 dark:text-blue-400' },
    { label: 'New / Unworked', value: data.new_unworked, icon: Sparkles, color: 'text-purple-600 dark:text-purple-400' },
    { label: 'Follow-ups Today', value: data.followups_due_today, icon: CalendarDays, color: 'text-amber-600 dark:text-amber-400' },
    { label: 'Overdue', value: data.overdue_followups, icon: Clock, color: 'text-red-600 dark:text-red-400' },
    { label: 'High/Critical', value: data.high_critical, icon: Zap, color: 'text-red-600 dark:text-red-400' },
    { label: 'Upcoming (7d)', value: data.upcoming_followups, icon: TrendingUp, color: 'text-blue-600 dark:text-blue-400' },
    { label: 'Converted', value: data.by_status?.converted || 0, icon: CheckCircle2, color: 'text-green-600 dark:text-green-400' },
  ];

  return (
    <div className="p-3 space-y-3">
      <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-1">Overview</div>
      {/* Compact stat tiles */}
      <div className="space-y-1.5">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-muted/40 hover:bg-muted transition-colors">
              <Icon className={`h-3.5 w-3.5 ${s.color} shrink-0`} />
              <span className="text-xs text-muted-foreground flex-1 truncate">{s.label}</span>
              <span className="text-sm font-bold">{s.value}</span>
            </div>
          );
        })}
      </div>

      {/* By status */}
      <div className="space-y-1.5">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-1 pt-2">By Status</div>
        {Object.entries(data.by_status || {}).map(([status, count]: [string, any]) => {
          const pct = data.total > 0 ? (count / data.total) * 100 : 0;
          return (
            <div key={status} className="px-2">
              <div className="flex justify-between text-xs mb-0.5">
                <span className="capitalize">{status.replace('_', ' ')}</span>
                <span className="font-medium">{count}</span>
              </div>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-[var(--gold)] rounded-full" style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
      </div>

      {/* By dealer */}
      {data.by_dealer && data.by_dealer.length > 0 && (
        <div className="space-y-1.5">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-1 pt-2">By Dealer</div>
          {data.by_dealer.map((d: any) => {
            const pct = data.total > 0 ? (d.c / data.total) * 100 : 0;
            return (
              <div key={d.name} className="px-2">
                <div className="flex justify-between text-xs mb-0.5">
                  <span className="truncate">{d.name}</span>
                  <span className="font-medium">{d.c}</span>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
