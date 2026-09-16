'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { StatCard, StatusBadge, PriorityBadge, timeAgo } from '@/components/ui-shared';
import { ClipboardList, Sparkles, CalendarDays, Clock, Zap, UserPlus, Pin, CheckCircle2, AlertTriangle, Settings2 } from 'lucide-react';
import { Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { DEPARTMENTS } from '@/lib/department-constants';

interface NavigateFn { (route: string, arg?: any): void; }
interface DashboardData {
  total: number; new_unworked: number; followups_due_today: number; overdue_followups: number;
  high_critical: number; recently_assigned: number; upcoming_followups: number;
  by_status: Record<string, number>; by_priority: Record<string, number>;
  by_department: any[]; by_dealer: any[];
  dealer_options: { id: number; name: string }[];
  recent_leads: any[];
}

interface DashboardFilters {
  dealer_id: string;
  department: string;
  status: string;
  priority: string;
  from_date: string;
  to_date: string;
}

const EMPTY_FILTERS: DashboardFilters = { dealer_id: '', department: '', status: '', priority: '', from_date: '', to_date: '' };
const STATUSES = ['new', 'in_progress', 'follow_up', 'converted', 'closed', 'lost', 'recycled'];
const PRIORITIES = ['Low', 'Medium', 'High', 'Critical'];

const STATUS_COLORS: Record<string, string> = {
  new: 'var(--chart-1)', in_progress: 'var(--chart-2)', follow_up: 'var(--chart-3)',
  converted: 'var(--chart-4)', recycled: 'var(--chart-5)', lost: 'var(--chart-3)', closed: 'var(--chart-1)',
};
const GOLD = 'var(--color-gold)';
const DEALER_LABELS: Record<number, string> = { 1: 'Aditya Motors', 2: 'Aditya Hyundai', 3: 'HighWay Honda' };
const DEALER_COLORS: Record<string, string> = {
  'Aditya Motors': 'var(--chart-1)',
  'Highway Honda': 'var(--chart-3)',
  'Aditya Hyundai': 'var(--chart-2)',
};
const DEPARTMENT_COLORS: Record<string, string> = {
  Sales: 'var(--chart-1)',
  Finance: 'var(--chart-4)',
  Service: 'var(--chart-3)',
  'Sale Commercial': 'var(--chart-2)',
  'Sales Commerce': 'var(--chart-2)',
  'Parts & Accessories': 'var(--chart-5)',
  'Customer Experience': 'var(--chart-3)',
};

export function DashboardPage({ navigate }: { navigate: NavigateFn }) {
  const { user, isAdmin } = useAuth();
  const [themeVersion, setThemeVersion] = useState(0);
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<DashboardFilters>(EMPTY_FILTERS);
  const [loading, setLoading] = useState(true);
  const [widgets, setWidgets] = useState<Record<string, boolean>>({ stats: true, 'dealer-chart': true, 'status-chart': true, 'department-chart': true, 'recent-leads': true });
  const [widgetMenuOpen, setWidgetMenuOpen] = useState(false);
  const isDealerLocked = !!user?.dealer_id && ['data_operator_2', 'department_user'].includes(user.role);
  const lockedDealerId = isDealerLocked && user?.dealer_id ? String(user.dealer_id) : '';
  const isDepartmentLocked = user?.role === 'department_user' && !!user.department;
  const lockedDepartment = isDepartmentLocked ? (user.department || '') : '';

  useEffect(() => {
    api.get<{ widgets: Record<string, boolean> }>('/system/dashboard-widgets').then((result) => setWidgets((current) => ({ ...current, ...result.widgets }))).catch(() => {});
  }, []);

  useEffect(() => {
    const refreshCharts = () => setThemeVersion((version) => version + 1);
    window.addEventListener('aditya-theme-colors-change', refreshCharts);
    return () => window.removeEventListener('aditya-theme-colors-change', refreshCharts);
  }, []);

  function toggleWidget(key: string) {
    const next = { ...widgets, [key]: !widgets[key] };
    setWidgets(next);
    if (isAdmin()) void api.patch('/system/dashboard-widgets', { widgets: next }).catch(() => {});
  }

  const loadDashboard = async (nextFilters: DashboardFilters) => {
    setLoading(true);
    setError(null);
    try {
      const effectiveFilters = {
        ...nextFilters,
        ...(isDealerLocked ? { dealer_id: lockedDealerId } : {}),
        ...(isDepartmentLocked && lockedDepartment ? { department: lockedDepartment } : {}),
      };
      const query = new URLSearchParams(Object.entries(effectiveFilters).filter(([, value]) => Boolean(value)) as string[][]).toString();
      setData(await api.get<DashboardData>(`/dashboard${query ? `?${query}` : ''}`));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const initialFilters = {
      ...EMPTY_FILTERS,
      ...(isDealerLocked ? { dealer_id: lockedDealerId } : {}),
      ...(isDepartmentLocked && lockedDepartment ? { department: lockedDepartment } : {}),
    };
    setFilters(initialFilters);
    void loadDashboard(initialFilters);
    const refreshDashboard = () => void loadDashboard(initialFilters);
    const interval = window.setInterval(refreshDashboard, 15000);
    window.addEventListener('crm:refresh', refreshDashboard);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('crm:refresh', refreshDashboard);
    };
  }, [isDealerLocked, lockedDealerId, isDepartmentLocked, lockedDepartment]);

  if (error) return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <AlertTriangle className="h-10 w-10 text-[var(--color-gold)] mb-3" />
      <h3 className="text-lg font-semibold mb-1">Failed to load</h3>
      <p className="text-sm text-muted-foreground">{error}</p>
      <Button variant="outline" size="sm" className="mt-4" onClick={() => void loadDashboard(filters)}>Retry</Button>
    </div>
  );
  if (!data) return <div className="py-16 text-center text-muted-foreground animate-pulse">Loading dashboard...</div>;

  // Prepare chart data
  const dealerChartData = data.by_dealer.map((d: any) => ({ name: d.name, leads: d.c }));
  const statusChartData = Object.entries(data.by_status || {}).map(([status, count]: [string, any]) => ({
    name: status.replace('_', ' '), value: count, status,
  }));
  const deptChartData = data.by_department.map((d: any) => ({ department: d.department || 'None', name: d.department || 'None', leads: d.c }));
  const showRecentLeads = ['super_admin', 'admin'].includes(user?.role || '');

  return (
    <div key={themeVersion} className="space-y-6">
      {isAdmin() && <div className="flex justify-end"><div className="relative"><Button variant="outline" size="sm" onClick={() => setWidgetMenuOpen((open) => !open)}><Settings2 className="h-4 w-4" /> Widgets</Button>{widgetMenuOpen && <div className="absolute right-0 top-full z-30 mt-2 w-56 rounded-md border bg-popover p-3 shadow-lg"><p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Dashboard widgets</p>{['stats', 'dealer-chart', 'status-chart', 'department-chart', 'recent-leads'].map((key) => <label key={key} className="flex cursor-pointer items-center gap-2 py-1 text-sm"><input type="checkbox" checked={widgets[key]} onChange={() => toggleWidget(key)} />{key.replaceAll('-', ' ')}</label>)}</div>}</div></div>}
      {/* Stats */}
      {widgets.stats && <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Total Leads" value={data.total} icon={ClipboardList} accent="gold" />
        <StatCard label="New / Unworked" value={data.new_unworked} icon={Sparkles} accent="blue" />
        <StatCard label="Follow-ups Due Today" value={data.followups_due_today} icon={CalendarDays} accent="gold" />
        <StatCard label="Overdue Follow-ups" value={data.overdue_followups} icon={Clock} accent="red" />
        <StatCard label="High / Critical Priority" value={data.high_critical} icon={Zap} accent="red" />
        <StatCard label="Recently Assigned (7d)" value={data.recently_assigned} icon={UserPlus} accent="blue" />
        <StatCard label="Upcoming Follow-ups (7d)" value={data.upcoming_followups} icon={Pin} accent="gold" />
        <StatCard label="Converted" value={data.by_status.converted || 0} icon={CheckCircle2} accent="green" />
      </div>}

      {(widgets['dealer-chart'] || widgets['status-chart'] || widgets['department-chart']) && <Card className="analytics-section">
        <CardHeader>
          <CardTitle className="text-base">Analytics</CardTitle>
          <p className="text-xs text-muted-foreground">Apply one filter set to all dashboard charts and metrics.</p>
        </CardHeader>
        <CardContent className="relative space-y-5">
          {loading && <div className="absolute inset-0 z-10 flex items-start justify-center rounded-b-lg bg-background/45 pt-24 backdrop-blur-[1px]"><span className="rounded-full border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground shadow-sm">Updating graphs...</span></div>}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
            <Select disabled={isDealerLocked} value={isDealerLocked ? lockedDealerId : (filters.dealer_id || 'all')} onValueChange={value => setFilters(current => ({ ...current, dealer_id: value === 'all' ? '' : value }))}>
              <SelectTrigger className="w-full"><SelectValue placeholder="All dealers" /></SelectTrigger>
              <SelectContent><SelectItem value="all">All dealers</SelectItem>{data.dealer_options.map(dealer => <SelectItem key={dealer.id} value={String(dealer.id)}>{dealer.name}</SelectItem>)}</SelectContent>
            </Select>
            <Select disabled={isDepartmentLocked} value={isDepartmentLocked ? lockedDepartment : (filters.department || 'all')} onValueChange={value => setFilters(current => ({ ...current, department: value === 'all' ? '' : value }))}>
              <SelectTrigger className="w-full"><SelectValue placeholder="All departments" /></SelectTrigger>
              <SelectContent><SelectItem value="all">All departments</SelectItem>{DEPARTMENTS.map(value => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={filters.status || 'all'} onValueChange={value => setFilters(current => ({ ...current, status: value === 'all' ? '' : value }))}>
              <SelectTrigger className="w-full"><SelectValue placeholder="All statuses" /></SelectTrigger>
              <SelectContent><SelectItem value="all">All statuses</SelectItem>{STATUSES.map(value => <SelectItem key={value} value={value}>{value.replace('_', ' ')}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={filters.priority || 'all'} onValueChange={value => setFilters(current => ({ ...current, priority: value === 'all' ? '' : value }))}>
              <SelectTrigger className="w-full"><SelectValue placeholder="All priorities" /></SelectTrigger>
              <SelectContent><SelectItem value="all">All priorities</SelectItem>{PRIORITIES.map(value => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent>
            </Select>
            <input type="date" aria-label="From date" value={filters.from_date} onChange={event => setFilters(current => ({ ...current, from_date: event.target.value }))} className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm" />
            <input type="date" aria-label="To date" value={filters.to_date} onChange={event => setFilters(current => ({ ...current, to_date: event.target.value }))} className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm" />
            <div className="flex gap-2 sm:col-span-2 lg:col-span-4 xl:col-span-1">
              <button type="button" disabled={loading} className="h-9 flex-1 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:cursor-wait disabled:opacity-60" onClick={() => void loadDashboard(filters)}>{loading ? 'Updating...' : 'Apply'}</button>
              <button type="button" className="h-9 rounded-md border border-input px-3 text-sm font-medium hover:bg-muted" onClick={() => { const resetFilters = { ...EMPTY_FILTERS, ...(isDealerLocked ? { dealer_id: lockedDealerId } : {}), ...(isDepartmentLocked && lockedDepartment ? { department: lockedDepartment } : {}) }; setFilters(resetFilters); void loadDashboard(resetFilters); }}>Reset</button>
            </div>
          </div>

          <div className="grid min-w-0 grid-cols-1 gap-4 xl:grid-cols-3">
            {widgets['dealer-chart'] && <div className="min-w-0 rounded-lg border border-border p-3"><h3 className="mb-2 text-sm font-semibold">Leads by Dealer</h3>{dealerChartData.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">No data</p> : <ResponsiveContainer width="100%" height={240}><PieChart><Pie data={dealerChartData} cx="50%" cy="50%" outerRadius={82} innerRadius={42} paddingAngle={2} dataKey="leads" nameKey="name">{dealerChartData.map(entry => <Cell key={`dealer-${entry.name}`} fill={DEALER_COLORS[entry.name] || '#64748B'} />)}</Pie><Tooltip contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }} /><Legend wrapperStyle={{ fontSize: '11px' }} /></PieChart></ResponsiveContainer>}</div>}
            {widgets['status-chart'] && <div className="min-w-0 rounded-lg border border-border p-3"><h3 className="mb-2 text-sm font-semibold">Leads by Status</h3>{statusChartData.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">No data</p> : <ResponsiveContainer width="100%" height={240}><PieChart><Pie data={statusChartData} cx="50%" cy="50%" outerRadius={78} innerRadius={44} paddingAngle={2} dataKey="value" nameKey="name">{statusChartData.map((entry, index) => <Cell key={`cell-${index}`} fill={STATUS_COLORS[entry.status] || GOLD} />)}</Pie><Tooltip contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }} /><Legend wrapperStyle={{ fontSize: '11px' }} /></PieChart></ResponsiveContainer>}</div>}
            {widgets['department-chart'] && <div className="min-w-0 rounded-lg border border-border p-3"><h3 className="mb-2 text-sm font-semibold">Leads by Department</h3>{deptChartData.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">No data</p> : <ResponsiveContainer width="100%" height={240}><PieChart><Pie data={deptChartData} cx="50%" cy="50%" outerRadius={82} innerRadius={42} paddingAngle={2} dataKey="leads" nameKey="name">{deptChartData.map(entry => <Cell key={`department-${entry.department}`} fill={DEPARTMENT_COLORS[entry.department] || '#64748B'} />)}</Pie><Tooltip contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }} /><Legend wrapperStyle={{ fontSize: '11px' }} /></PieChart></ResponsiveContainer>}</div>}
          </div>
        </CardContent>
      </Card>}

      {showRecentLeads && widgets['recent-leads'] && <Card>
        <CardHeader className="flex w-full flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Recent Leads</CardTitle>
          <Button variant="outline" size="sm" className="h-8 gap-1 px-2 text-xs" onClick={() => navigate('leads')}>View all <span aria-hidden="true">-&gt;</span></Button>
        </CardHeader>
        <CardContent>
          {data.recent_leads.length === 0 ? <p className="py-6 text-center text-sm text-muted-foreground">No leads yet.</p> :
            <div className="overflow-x-auto">
              <table className="mx-auto min-w-[760px] w-full text-sm">
                <thead className="border-b text-muted-foreground"><tr><th className="text-left py-2 px-2 font-medium">Code</th><th className="text-left py-2 px-2 font-medium">Customer</th><th className="text-left py-2 px-2 font-medium">Dealer / Vehicle</th><th className="text-left py-2 px-2 font-medium">Priority</th><th className="text-left py-2 px-2 font-medium">Status</th><th className="text-left py-2 px-2 font-medium">Created</th></tr></thead>
                <tbody>{data.recent_leads.map((l: any) => <tr key={l.id} className="cursor-pointer border-b last:border-b-0 hover:bg-muted/50" onClick={() => navigate('lead-detail', l.id)}><td className="py-2 px-2 font-medium">{l.lead_code}</td><td className="py-2 px-2">{l.customer_name}<br /><span className="text-xs text-muted-foreground">{l.mobile}</span></td><td className="py-2 px-2">{l.dealer_name}<br /><span className="text-xs text-muted-foreground">{l.brand_name} {l.model_name}</span></td><td className="py-2 px-2"><PriorityBadge priority={l.priority} /></td><td className="py-2 px-2"><StatusBadge status={l.status} /></td><td className="py-2 px-2 text-xs text-muted-foreground">{timeAgo(l.created_at)}</td></tr>)}</tbody>
              </table>
            </div>}
        </CardContent>
      </Card>}
    </div>
  );
}
