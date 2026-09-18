'use client';

import { useEffect, useState } from 'react';
import { Activity, Database, RefreshCw, Users } from 'lucide-react';
import { api } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatCard } from '@/components/ui-shared';

export function DatabaseHealthPage() {
  const { isAdmin } = useAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  async function load() { setLoading(true); setError(''); try { setData(await api.get('/system/database-health')); } catch (e: any) { setError(e.message || 'Unable to check database'); } finally { setLoading(false); } }
  useEffect(() => { void load(); const timer = window.setInterval(() => void load(), 30000); return () => window.clearInterval(timer); }, []);
  if (!isAdmin()) return <div className="p-8 text-center text-muted-foreground">Access denied - Admin+ only</div>;
  const online = data?.connected;
  const querySpeed = online ? `${data.latency_ms} ms` : '-';
  return <div className="space-y-4">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-2xl font-bold">Database Performance</h2><p className="text-sm text-muted-foreground">Live application-to-database health check. Refreshes every 30 seconds.</p></div><Button variant="outline" disabled={loading} onClick={() => void load()}><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh</Button></div>
    {error ? <Card><CardContent className="p-5 text-red-600">{error}</CardContent></Card> : data && <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard label="DATABASE STATUS" value={online ? 'Online' : 'Offline'} icon={Database} accent={online ? 'green' : 'red'} />
        <StatCard label="QUERY SPEED" value={querySpeed} icon={Activity} accent={data.latency_ms < 800 ? 'green' : 'gold'} />
        <StatCard label="TABLES" value={Object.keys(data.tables || {}).length} icon={Users} accent="blue" />
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base">Connection Details</CardTitle></CardHeader>
        <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
          <div><span className="text-muted-foreground">Performance status: </span><b>{data.status}</b></div>
          <div><span className="text-muted-foreground">Last checked: </span>{new Date(data.checked_at).toLocaleString('en-IN')}</div>
          <div><span className="text-muted-foreground">Database server time: </span>{new Date(data.database_time).toLocaleString('en-IN')}</div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-base">CRM Database Tables &amp; Records</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3 lg:grid-cols-4">
          {Object.entries(data.tables || {}).map(([name, count]) => <div key={name}>{name}<br /><b>{String(count)}</b></div>)}
        </CardContent>
      </Card>
    </>}
    {loading && !data && <div className="py-12 text-center text-muted-foreground animate-pulse">Checking database performance...</div>}
  </div>;
}
