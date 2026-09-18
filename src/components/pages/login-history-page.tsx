'use client';
import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { formatDate, EmptyState } from '@/components/ui-shared';
import { GeneratedAvatar } from '@/components/generated-avatar';
import { Clock, AlertTriangle } from 'lucide-react';

export function LoginHistoryPage() {
  const { isSuperAdmin } = useAuth();
  const [rows, setRows] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [deleting, setDeleting] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get<{ history: any[] }>('/users/login-history/all');
      let list = r.history || [];
      if (search) list = list.filter((h: any) => (h.user_name || '').toLowerCase().includes(search.toLowerCase()) || (h.user_email || h.email || '').toLowerCase().includes(search.toLowerCase()));
      setRows(list);
      setSelectedIds((current) => current.filter((id) => list.some((row) => row.id === id)));
    } catch (e: any) { setError(e.message); } finally { setLoading(false); }
  }, [search]);
  async function deleteSelected() {
    if (!selectedIds.length || deleting) return;
    setDeleting(true);
    const ids = [...selectedIds];
    try {
      await api.delete('/users/login-history/all', { ids });
      setRows((current) => current.filter((row) => !ids.includes(row.id)));
      setSelectedIds([]);
    } catch (e: any) {
      setError(e.message || 'Unable to delete login history');
    } finally {
      setDeleting(false);
    }
  }
  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  if (!isSuperAdmin()) return <div className="p-8 text-center text-muted-foreground">Access denied</div>;
  if (error) return <div className="p-8 text-center"><AlertTriangle className="mx-auto h-8 w-8 text-red-500 mb-2" /><p>{error}</p></div>;

  const actionBadge = (a: string) => {
    const map: Record<string, string> = { login: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200', logout: 'bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-200', otp_login: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200', failed: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200', failed_bad_otp: 'bg-red-100 text-red-800', failed_no_user: 'bg-red-100 text-red-800', failed_recycled: 'bg-orange-100 text-orange-800', failed_inactive: 'bg-orange-100 text-orange-800', user_created: 'bg-blue-100 text-blue-800', user_recycled: 'bg-orange-100 text-orange-800', user_restored: 'bg-green-100 text-green-800' };
    return <span className={`px-2 py-0.5 rounded text-xs font-medium ${map[a] || 'bg-muted text-muted-foreground'}`}>{a}</span>;
  };
  function parseUA(ua?: string) {
    if (!ua) return '—';
    let browser = 'Unknown';
    if (/chrome|crios/i.test(ua)) browser = 'Chrome';
    else if (/firefox|fxios/i.test(ua)) browser = 'Firefox';
    else if (/safari/i.test(ua) && !/chrome/i.test(ua)) browser = 'Safari';
    else if (/edg/i.test(ua)) browser = 'Edge';
    let os = '';
    if (/windows/i.test(ua)) os = 'Windows';
    else if (/android/i.test(ua)) os = 'Android';
    else if (/iphone|ipad|ios/i.test(ua)) os = 'iOS';
    else if (/mac/i.test(ua)) os = 'macOS';
    else if (/linux/i.test(ua)) os = 'Linux';
    return browser + (os ? ' · ' + os : '');
  }

  return (
    <div className="space-y-4">
      <div><h2 className="text-2xl font-bold">Login History</h2><p className="text-sm text-muted-foreground">Recent sign-in activity (last 200 records)</p></div>
      <Card><CardContent className="p-3"><Input placeholder="Search by email or name…" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-md" /></CardContent></Card>
      <Card>
        <CardContent className="p-0">
          {selectedIds.length > 0 && <div className="flex items-center justify-between gap-3 border-b px-3 py-2"><span className="text-sm font-medium">{selectedIds.length} selected</span><Button variant="destructive" size="sm" disabled={deleting} onClick={() => setDeleteOpen(true)}>Delete selected</Button></div>}
          {loading ? <div className="p-8 text-center text-muted-foreground animate-pulse">Loading…</div> :
           rows.length === 0 ? <EmptyState icon={Clock} title="No records" message="No login activity recorded yet" /> :
           <div className="overflow-x-auto"><table className="mx-auto min-w-[1000px] w-full text-sm"><thead className="border-b text-muted-foreground"><tr><th className="w-10 px-3 py-2"><Checkbox aria-label="Select all login records" checked={rows.length > 0 && selectedIds.length === rows.length} onCheckedChange={(checked) => setSelectedIds(checked ? rows.map((row) => row.id) : [])} /></th><th className="w-14 px-3 py-2">Photo</th><th className="px-3 py-2 text-left">When</th><th className="px-3 py-2 text-left">User</th><th className="px-3 py-2 text-left">Email</th><th className="px-3 py-2 text-left">Action</th><th className="px-3 py-2 text-left">IP Address</th><th className="px-3 py-2 text-left">Device / Browser</th></tr></thead><tbody>
             {rows.map((r: any) => <tr key={r.id} className="border-b last:border-b-0 hover:bg-muted/50"><td className="px-3 py-2"><Checkbox aria-label={`Select login record ${r.id}`} checked={selectedIds.includes(r.id)} onCheckedChange={(checked) => setSelectedIds((current) => checked ? [...current, r.id] : current.filter((id) => id !== r.id))} /></td><td className="px-3 py-2"><div className="h-9 w-9 overflow-hidden rounded-full border border-border bg-muted">{r.avatar_data ? <img src={r.avatar_data} alt={`${r.user_name || r.email || 'User'} profile`} className="block h-full w-full rounded-full object-cover object-center" /> : <GeneratedAvatar seed={`${r.user_id || 'unknown'}:${r.user_email || r.email || ''}`} name={r.user_name || r.email || 'Unknown'} size={36} />}</div></td><td className="px-3 py-2 text-xs">{formatDate(r.created_at, true)}</td><td className="px-3 py-2 font-medium">{r.user_name || '—'}</td><td className="px-3 py-2 text-muted-foreground">{r.user_email || r.email || '—'}</td><td className="px-3 py-2">{actionBadge(r.action)}</td><td className="px-3 py-2 font-mono text-xs text-muted-foreground">{r.ip ? String(r.ip).split(',')[0].trim() : '—'}</td><td className="px-3 py-2 text-xs text-muted-foreground">{parseUA(r.user_agent)}</td></tr>)}
           </tbody></table></div>}
        </CardContent>
      </Card>
      <ConfirmDialog open={deleteOpen} onOpenChange={setDeleteOpen} title={`Delete ${selectedIds.length} login records?`} description="This permanently removes the selected login history records." confirmLabel="Delete records" destructive onConfirm={deleteSelected} />
    </div>
  );
}
