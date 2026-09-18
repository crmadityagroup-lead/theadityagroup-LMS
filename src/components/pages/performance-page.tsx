'use client';

import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { StatCard, RoleBadge, EmptyState } from '@/components/ui-shared';
import { ClipboardList, CheckCircle2, Target, Repeat, AlertTriangle } from 'lucide-react';

export function PerformancePage() {
  const { user, isAdmin } = useAuth();
  const [dealers, setDealers] = useState<any[]>([]);
  const [dealer, setDealer] = useState('');
  const [role, setRole] = useState('');
  const [selectedUser, setSelectedUser] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get('/master/all-dealers').then((r: any) => setDealers(r.dealers || [])).catch(() => {});
    load();
  }, []);

  async function load(overrides: Partial<{ dealer: string; role: string; selectedUser: string; from: string; to: string }> = {}) {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      const currentDealer = overrides.dealer ?? dealer;
      const currentRole = overrides.role ?? role;
      const currentUser = overrides.selectedUser ?? selectedUser;
      const currentFrom = overrides.from ?? from;
      const currentTo = overrides.to ?? to;
      if (currentDealer) params.set('dealer_id', currentDealer);
      if (currentFrom) params.set('from_date', currentFrom);
      if (currentTo) params.set('to_date', currentTo);
      if (currentRole) params.set('role', currentRole);
      if (currentUser) params.set('assigned_user_id', currentUser);
      const r = await api.get(`/reports/summary?${params.toString()}`);
      setData(r);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  const isSuperAdmin = user?.role === 'super_admin';
  const statusArr = data?.by_status || [];
  const statusMap: Record<string, number> = {};
  statusArr.forEach((s: any) => {
    statusMap[s.status] = s.c;
  });
  const total = data?.total || 0;
  const converted = data?.converted || 0;
  const activePipeline = total - (statusMap.converted || 0) - (statusMap.closed || 0) - (statusMap.lost || 0) - (statusMap.recycled || 0);
  const performanceUsers = useMemo(() => (data?.user_workload || []).filter((row: any) => !role || row.role === role), [data, role]);

  if (!isAdmin()) return <div className="p-8 text-center text-muted-foreground">Access denied - Admin+ only</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold">Performance Report</h2>
          <p className="text-sm text-muted-foreground">User-wise lead performance - {isSuperAdmin ? 'all users' : 'users in your scope'}</p>
        </div>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Dealer</label>
              <Select value={dealer} onValueChange={setDealer}>
                <SelectTrigger className="h-9 w-full shadow-none">
                  <SelectValue placeholder="All dealers" />
                </SelectTrigger>
                <SelectContent>
                  {dealers.map((d) => <SelectItem key={d.id} value={String(d.id)}>{d.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Role</label>
              <Select value={role} onValueChange={(value) => { setRole(value); setSelectedUser(''); }}>
                <SelectTrigger className="h-9 w-full shadow-none">
                  <SelectValue placeholder="All roles" />
                </SelectTrigger>
                <SelectContent>
                  {isSuperAdmin && <SelectItem value="super_admin">Super Admin</SelectItem>}
                  <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="data_operator_1">Data Operator 1</SelectItem>
                        <SelectItem value="data_operator_2">Data Operator 2</SelectItem>
                  <SelectItem value="department_user">Department User</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">User</label>
              <Select value={selectedUser} onValueChange={setSelectedUser}>
                <SelectTrigger className="h-9 w-full shadow-none">
                  <SelectValue placeholder={role ? 'Select user' : 'All users'} />
                </SelectTrigger>
                <SelectContent>
                  {performanceUsers.filter((row: any) => row.user_id).map((row: any) => (
                    <SelectItem key={row.user_id} value={String(row.user_id)}>
                      {row.user_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">From date</label>
              <input type="date" className="h-9 w-full cursor-pointer rounded-md border border-input bg-background px-3 text-sm shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-ring" value={from} onChange={(e) => setFrom(e.target.value)} onClick={(event) => { try { event.currentTarget.showPicker?.(); } catch {} }} />
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">To date</label>
              <input type="date" className="h-9 w-full cursor-pointer rounded-md border border-input bg-background px-3 text-sm shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-ring" value={to} onChange={(e) => setTo(e.target.value)} onClick={(event) => { try { event.currentTarget.showPicker?.(); } catch {} }} />
            </div>
          </div>
          <div className="mt-3 flex flex-wrap justify-end gap-2">
            <Button size="sm" className="h-9 btn-gold" onClick={() => load()}>Apply</Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-9"
              onClick={() => {
                setDealer('');
                setRole('');
                setSelectedUser('');
                setFrom('');
                setTo('');
                load({ dealer: '', role: '', selectedUser: '', from: '', to: '' });
              }}
            >
              Reset
            </Button>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="py-12 text-center text-muted-foreground animate-pulse">Loading...</div>
      ) : error ? (
        <div className="py-12 text-center">
          <AlertTriangle className="mx-auto h-8 w-8 text-[var(--color-gold)] mb-2" />
          <p>{error}</p>
        </div>
      ) : data && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard label="TOTAL LEADS" value={total} icon={ClipboardList} accent="gold" />
            <StatCard label="CONVERTED" value={converted} icon={CheckCircle2} accent="green" />
            <StatCard label="CONVERSION RATE" value={`${data.conversion_rate || 0}%`} icon={Target} accent="blue" />
            <StatCard label="ACTIVE PIPELINE" value={activePipeline} icon={Repeat} accent="gold" />
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">User-wise Performance ({(data.user_workload || []).length} users)</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {(data.user_workload || []).length === 0 ? (
                <EmptyState icon={ClipboardList} title="No assignment data yet" />
              ) : (
                <div className="overflow-x-auto">
                  <table className="mx-auto min-w-[820px] w-full text-sm">
                    <thead className="border-b text-muted-foreground">
                      <tr>
                        <th className="text-left py-2 px-3">User</th>
                        <th className="text-left py-2 px-3">Role</th>
                        <th className="text-left py-2 px-3">Department</th>
                        <th className="text-left py-2 px-3">Dealer</th>
                        <th className="text-left py-2 px-3">Total</th>
                        <th className="text-left py-2 px-3">Active</th>
                        <th className="text-left py-2 px-3">Converted</th>
                        <th className="text-left py-2 px-3">Conv. %</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(data.user_workload || []).map((r: any) => (
                        <tr key={r.user_id || r.user_name} className="border-b last:border-b-0 hover:bg-muted/50">
                          <td className="py-2 px-3">
                            <div className="font-medium">{r.user_name || 'Unassigned'}</div>
                            {r.user_email && <div className="text-xs text-muted-foreground">{r.user_email}</div>}
                          </td>
                          <td className="py-2 px-3"><RoleBadge role={r.role} /></td>
                          <td className="py-2 px-3">{r.department || '-'}</td>
                          <td className="py-2 px-3">{r.dealer_name || '-'}</td>
                          <td className="py-2 px-3 font-bold">{r.c}</td>
                          <td className="py-2 px-3">{r.active_count}</td>
                          <td className="py-2 px-3">{r.converted_count}</td>
                          <td className="py-2 px-3">{r.c > 0 ? ((r.converted_count / r.c) * 100).toFixed(1) : '0.0'}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
