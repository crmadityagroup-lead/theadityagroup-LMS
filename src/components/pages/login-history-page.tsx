'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatDate, EmptyState } from '@/components/ui-shared';
import { GeneratedAvatar } from '@/components/generated-avatar';
import { Clock, Download, Radio, RefreshCw, Users } from 'lucide-react';

export function LoginHistoryPage() {
  const { isSuperAdmin } = useAuth();
  const [tab, setTab] = useState<'history' | 'live'>('history');
  const [search, setSearch] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [selectedUserId, setSelectedUserId] = useState('');
  const [history, setHistory] = useState<any[]>([]);
  const [userOptions, setUserOptions] = useState<any[]>([]);
  const [live, setLive] = useState<any[]>([]);
  const [summary, setSummary] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const matches = useCallback((item: any) => {
    const q = search.toLowerCase();
    return !q || [item.name, item.user_name, item.email, item.user_email, item.role, item.page_label, item.department, item.dealer_name].some((value) => String(value || '').toLowerCase().includes(q));
  }, [search]);
  const loadHistory = useCallback(async () => { setLoading(true); try { const p = new URLSearchParams(); if (from) p.set('from', from); if (to) p.set('to', to); if (selectedUserId) p.set('user_id', selectedUserId); const r = await api.get<{ history: any[]; users: any[] }>(`/users/login-history/all?${p}`); setHistory((r.history || []).filter(matches)); setUserOptions(r.users || []); } finally { setLoading(false); } }, [from, to, selectedUserId, matches]);
  const loadLive = useCallback(async () => { setLoading(true); try { const p = new URLSearchParams(); if (from) p.set('from', from); if (to) p.set('to', to); if (selectedUserId) p.set('user_id', selectedUserId); const r = await api.get<{ users: any[]; summaries: any[] }>(`/users/presence?${p}`); setLive((r.users || []).filter(matches)); setSummary((r.summaries || []).filter(matches)); } finally { setLoading(false); } }, [from, to, selectedUserId, matches]);
  useEffect(() => { if (tab === 'history') { void loadHistory(); return; } void loadLive(); const id = window.setInterval(() => void loadLive(), 15000); return () => window.clearInterval(id); }, [tab, loadHistory, loadLive]);
  const profile = (person: any) => <div className="h-9 w-9 overflow-hidden rounded-full border border-border bg-muted">{person.avatar_data ? <img src={person.avatar_data} alt={`${person.name || person.user_name} profile`} className="h-full w-full object-cover" /> : <GeneratedAvatar seed={`${person.user_id || 'user'}:${person.email || person.user_email || ''}`} name={person.name || person.user_name || person.email || 'User'} size={36} />}</div>;
  const hours = (seconds: number) => `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
  const exportExcel = () => void api.download(`/users/presence/export?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&user_id=${encodeURIComponent(selectedUserId)}`, `user-work-report-${Date.now()}.xlsx`);

  if (!isSuperAdmin()) return <div className="p-8 text-center text-muted-foreground">Access denied</div>;
  return <div className="space-y-4">
    <div><h2 className="text-2xl font-bold">Login History</h2><p className="text-sm text-muted-foreground">Sign-in records, live users, and tracked work time</p></div>
    <Card><CardContent className="flex flex-wrap items-center gap-2 p-3">
      <Button size="sm" variant={tab === 'history' ? 'secondary' : 'ghost'} onClick={() => setTab('history')}><Clock className="h-4 w-4" /> Login History</Button>
      <Button size="sm" variant={tab === 'live' ? 'secondary' : 'ghost'} onClick={() => setTab('live')}><Radio className="h-4 w-4 text-green-600" /> Live Users & Work</Button>
      <Input className="max-w-xs" placeholder="Search user, role, dealer, or page" value={search} onChange={(e) => setSearch(e.target.value)} />
      <Input type="date" className="w-40" value={from} onChange={(e) => setFrom(e.target.value)} /><Input type="date" className="w-40" value={to} onChange={(e) => setTo(e.target.value)} /><select className="h-9 min-w-56 rounded-md border bg-background px-3 text-sm" value={selectedUserId} onChange={(e) => setSelectedUserId(e.target.value)}><option value="">All users</option>{userOptions.map((item) => <option key={item.id} value={item.id}>{item.name} — {item.email}</option>)}</select><Button size="icon" variant="outline" onClick={() => void (tab === 'live' ? loadLive() : loadHistory())} title="Refresh"><RefreshCw className="h-4 w-4" /></Button><Button size="sm" variant="outline" onClick={exportExcel}><Download className="h-4 w-4" /> Excel</Button>
    </CardContent></Card>
    {tab === 'live' ? <><Card><CardContent className="flex flex-wrap items-center gap-2 p-3"><label htmlFor="live-user-filter" className="text-sm font-medium">User</label><select id="live-user-filter" className="h-9 min-w-56 rounded-md border bg-background px-3 text-sm" value={selectedUserId} onChange={(e) => setSelectedUserId(e.target.value)}><option value="">All users</option>{summary.map((item) => <option key={item.user_id} value={item.user_id}>{item.name} — {item.email}</option>)}</select><span className="text-xs text-muted-foreground">Choose one user to view and export only that user's data.</span></CardContent></Card>
      <Card><CardContent className="p-0"><div className="border-b p-3 text-sm font-medium">Work Summary — {summary.length} users</div>{loading ? <div className="p-6 text-center">Loading...</div> : summary.length === 0 ? <EmptyState icon={Users} title="No work data" message="Working time starts tracking after this update." /> : <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-sm"><thead className="border-b text-muted-foreground"><tr><th className="p-3 text-left">Profile</th><th className="p-3 text-left">User</th><th className="p-3 text-left">Role / Dealer</th><th className="p-3 text-left">Active Days</th><th className="p-3 text-left">Working Time</th><th className="p-3 text-left">Last Activity</th></tr></thead><tbody>{summary.map((item) => <tr key={item.user_id} className="border-b"><td className="p-3">{profile(item)}</td><td className="p-3 font-medium">{item.name}<div className="text-xs text-muted-foreground">{item.email}</div></td><td className="p-3 capitalize">{String(item.role).replaceAll('_', ' ')}<div className="text-xs text-muted-foreground">{item.dealer_name || 'All dealers'}</div></td><td className="p-3">{item.active_days}</td><td className="p-3 font-semibold">{hours(item.active_seconds)}</td><td className="p-3 text-xs">{formatDate(item.last_seen_at, true)}</td></tr>)}</tbody></table></div>}</CardContent></Card>
      <Card><CardContent className="p-0"><div className="border-b p-3 text-sm font-medium">Currently Live — {live.length} users</div>{live.length === 0 ? <EmptyState icon={Users} title="No live users" message="Users remain live for 90 seconds after their last heartbeat." /> : <div className="overflow-x-auto"><table className="w-full min-w-[850px] text-sm"><thead className="border-b text-muted-foreground"><tr><th className="p-3 text-left">Profile</th><th className="p-3 text-left">User</th><th className="p-3 text-left">Current Page</th><th className="p-3 text-left">Department</th><th className="p-3 text-left">Last Seen</th></tr></thead><tbody>{live.map((item) => <tr key={item.user_id} className="border-b"><td className="p-3">{profile(item)}</td><td className="p-3 font-medium">{item.name}<div className="text-xs text-muted-foreground">{item.email}</div></td><td className="p-3"><span className="mr-2 inline-block h-2 w-2 rounded-full bg-green-500" />{item.page_label}{item.route_arg ? ` #${item.route_arg}` : ''}</td><td className="p-3">{item.department || '—'}</td><td className="p-3 text-xs">{formatDate(item.last_seen_at, true)}</td></tr>)}</tbody></table></div>}</CardContent></Card>
    </> : <Card><CardContent className="p-0">{loading ? <div className="p-6 text-center">Loading...</div> : history.length === 0 ? <EmptyState icon={Clock} title="No records" message="No login activity recorded yet" /> : <div className="overflow-x-auto"><table className="w-full min-w-[750px] text-sm"><thead className="border-b text-muted-foreground"><tr><th className="p-3 text-left">Profile</th><th className="p-3 text-left">When</th><th className="p-3 text-left">User</th><th className="p-3 text-left">Action</th><th className="p-3 text-left">IP</th></tr></thead><tbody>{history.map((item) => <tr key={item.id} className="border-b"><td className="p-3">{profile(item)}</td><td className="p-3 text-xs">{formatDate(item.created_at, true)}</td><td className="p-3 font-medium">{item.user_name || '—'}<div className="text-xs text-muted-foreground">{item.user_email || item.email || ''}</div></td><td className="p-3">{item.action}</td><td className="p-3 text-xs">{item.ip || '—'}</td></tr>)}</tbody></table></div>}</CardContent></Card>}
  </div>;
}
