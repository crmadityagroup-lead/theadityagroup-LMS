'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { StatCard } from '@/components/ui-shared';
import { ClipboardList, CheckCircle2, Target, Repeat, FileText, FileSpreadsheet } from 'lucide-react';
import { DEPARTMENTS } from '@/lib/department-constants';
import { toast } from 'sonner';

export function ReportsPage() {
  const { isOperator, user } = useAuth();
  const [dealers, setDealers] = useState<any[]>([]);
  const [filters, setFilters] = useState({ from_date: '', to_date: '', dealer_id: '', department: '', status: '' });
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);

  useEffect(() => {
    if (isOperator()) api.get('/master/dealers').then((r: any) => setDealers(r.dealers || []));
  }, [user]);
  useEffect(() => { load(); }, []);
  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([k, v]) => { if (v) params.set(k, v); });
      const r = await api.get(`/reports/summary?${params.toString()}`);
      setData(r);
    } catch {} finally { setLoading(false); }
  }
  function apply() { load(); }
  async function downloadReport(path: string, filename: string) {
    if (exporting) return;
    setExporting(true);
    setExportProgress(0);
    const timer = window.setInterval(() => {
      setExportProgress((current) => Math.min(current + 8, 90));
    }, 180);
    try {
      await api.download(path, filename);
      setExportProgress(100);
      toast.success('Report Ready for download');
      window.setTimeout(() => setExportProgress(0), 700);
    } catch (error: any) {
      toast.error('Report generation failed', { description: error.message });
      setExportProgress(0);
    } finally {
      window.clearInterval(timer);
      setExporting(false);
    }
  }
  function exportPath(endpoint: string) {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => value && params.set(key, value));
    return `${endpoint}?${params.toString()}`;
  }

  const statusArr = data?.by_status || [];
  const statusMap: Record<string, number> = {};
  statusArr.forEach((s: any) => { statusMap[s.status] = s.c; });
  const total = data?.total || 0;
  const converted = data?.converted || 0;
  const activePipeline = total - (statusMap.converted || 0) - (statusMap.closed || 0) - (statusMap.lost || 0) - (statusMap.recycled || 0);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center flex-wrap gap-2">
        <div><h2 className="text-2xl font-bold">Reports &amp; Analytics</h2><p className="text-sm text-muted-foreground">Lead volume, conversion, workload &amp; export</p></div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" disabled={exporting} onClick={() => void downloadReport(exportPath('/reports/export-excel'), `crm-report-${Date.now()}.xlsx`)}><FileSpreadsheet className="h-4 w-4" /> Excel</Button>
          <Button variant="outline" size="sm" disabled={exporting} onClick={() => void downloadReport(exportPath('/reports/export-pdf'), `crm-report-${Date.now()}.pdf`)}><FileText className="h-4 w-4" /> PDF</Button>
          <Button size="sm" className="btn-gold" disabled={exporting} onClick={apply}>Apply Filters</Button>
        </div>
      </div>

      {exporting || exportProgress > 0 ? <div className="rounded-md border border-border bg-muted/40 p-3" role="status" aria-live="polite">
        <div className="mb-1 flex items-center justify-between text-xs font-medium"><span>Generating report...</span><span>{exportProgress}%</span></div>
        <div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full bg-green-500 transition-[width] duration-150" style={{ width: `${exportProgress}%` }} /></div>
      </div> : null}

      <Card>
        <CardContent className="p-3 grid grid-cols-2 md:grid-cols-5 gap-3">
          <div><Label className="text-xs">From Date</Label><Input type="date" value={filters.from_date} onChange={(e) => setFilters({ ...filters, from_date: e.target.value })} /></div>
          <div><Label className="text-xs">To Date</Label><Input type="date" value={filters.to_date} onChange={(e) => setFilters({ ...filters, to_date: e.target.value })} /></div>
          {isOperator() && <div><Label className="text-xs">Dealer</Label><Select value={filters.dealer_id} onValueChange={(v) => setFilters({ ...filters, dealer_id: v })}><SelectTrigger><SelectValue placeholder="All" /></SelectTrigger><SelectContent>{dealers.map(d => <SelectItem key={d.id} value={String(d.id)}>{d.name}</SelectItem>)}</SelectContent></Select></div>}
          <div><Label className="text-xs">Department</Label><Select value={filters.department} onValueChange={(v) => setFilters({ ...filters, department: v })}><SelectTrigger><SelectValue placeholder="All" /></SelectTrigger><SelectContent>{DEPARTMENTS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent></Select></div>
          <div><Label className="text-xs">Status</Label><Select value={filters.status} onValueChange={(v) => setFilters({ ...filters, status: v })}><SelectTrigger><SelectValue placeholder="All" /></SelectTrigger><SelectContent>{['new','in_progress','follow_up','converted','closed','lost','recycled'].map(s => <SelectItem key={s} value={s}>{s.replace('_',' ')}</SelectItem>)}</SelectContent></Select></div>
        </CardContent>
      </Card>

      {loading ? <div className="py-12 text-center text-muted-foreground animate-pulse">Loading…</div> : data && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard label="Total Leads" value={total} icon={ClipboardList} accent="gold" />
            <StatCard label="Converted" value={converted} icon={CheckCircle2} accent="green" />
            <StatCard label="Conversion Rate" value={`${data.conversion_rate || 0}%`} icon={Target} accent="blue" />
            <StatCard label="Active Pipeline" value={activePipeline} icon={Repeat} accent="gold" />
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <Card><CardHeader><CardTitle className="text-base">Leads by Status</CardTitle></CardHeader><CardContent>
              <div className="space-y-2">{statusArr.map((s: any) => { const pct = total > 0 ? (s.c / total) * 100 : 0; return <div key={s.status}><div className="flex justify-between text-sm mb-1"><span className="capitalize">{s.status.replace('_',' ')}</span><span className="font-medium">{s.c}</span></div><div className="h-2 bg-muted rounded-full overflow-hidden"><div className="h-full bg-[var(--gold)]" style={{ width: `${pct}%` }} /></div></div>; })}</div>
            </CardContent></Card>
            <Card><CardHeader><CardTitle className="text-base">Leads by Dealer</CardTitle></CardHeader><CardContent>
              <div className="space-y-2">{(data.by_dealer || []).map((d: any) => { const pct = total > 0 ? (d.c / total) * 100 : 0; return <div key={d.name}><div className="flex justify-between text-sm mb-1"><span>{d.name}</span><span className="font-medium">{d.c}</span></div><div className="h-2 bg-muted rounded-full overflow-hidden"><div className="h-full bg-[var(--gold)]" style={{ width: `${pct}%` }} /></div></div>; })}</div>
            </CardContent></Card>
          </div>

          <Card>
            <CardHeader><CardTitle className="text-base">User-wise Workload</CardTitle></CardHeader>
            <CardContent className="p-0">
              {(data.user_workload || []).length === 0 ? <p className="p-6 text-center text-muted-foreground text-sm">No assignment data yet.</p> :
                <div className="overflow-x-auto"><table className="mx-auto min-w-[820px] w-full text-sm"><thead className="border-b text-muted-foreground"><tr><th className="text-left py-2 px-3">User</th><th className="text-left py-2 px-3">Department</th><th className="text-left py-2 px-3">Dealer</th><th className="text-left py-2 px-3">Total</th><th className="text-left py-2 px-3">Active</th><th className="text-left py-2 px-3">Converted</th><th className="text-left py-2 px-3">Conv. %</th></tr></thead>
                  <tbody>{(data.user_workload || []).map((r: any) => <tr key={r.user_id || r.user_name} className="border-b last:border-b-0"><td className="py-2 px-3 font-medium">{r.user_name || 'Unassigned'}</td><td className="py-2 px-3">{r.department || '—'}</td><td className="py-2 px-3">{r.dealer_name || '—'}</td><td className="py-2 px-3 font-bold">{r.c}</td><td className="py-2 px-3">{r.active_count}</td><td className="py-2 px-3">{r.converted_count}</td><td className="py-2 px-3">{r.c > 0 ? ((r.converted_count / r.c) * 100).toFixed(1) : '0.0'}%</td></tr>)}</tbody>
                </table></div>}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function Label({ children, className }: { children: React.ReactNode; className?: string }) {
  return <label className={`block text-sm font-medium mb-1 ${className || ''}`}>{children}</label>;
}
