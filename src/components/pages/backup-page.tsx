'use client';

import { useRef, useState } from 'react';
import { Download, DatabaseBackup, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { api } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';

const BACKUP_TABLES = [
  ['dealers', 'Dealers'], ['brands', 'Brands'], ['models', 'Models'], ['enquiry_categories', 'Enquiry Categories'], ['enquiry_types', 'Enquiry Types'],
  ['users', 'Users'], ['support_tickets', 'Support Tickets'], ['otp_codes', 'OTP Records'], ['user_enquiry_types', 'User Enquiry Types'],
  ['leads', 'Leads'], ['lead_activities', 'Lead Activities'], ['lead_followups', 'Lead Follow-ups'], ['department_updates', 'Department Updates'], ['login_history', 'Login History'],
] as const;

export function BackupPage() {
  const { isSuperAdmin } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [selectedTables, setSelectedTables] = useState<string[]>(BACKUP_TABLES.map(([key]) => key));
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [downloadingTable, setDownloadingTable] = useState('');

  if (!isSuperAdmin()) return <div className="p-8 text-center text-muted-foreground">Access denied - Super Admin only</div>;

  async function showProgressBeforeDownload(label: string) {
    setDownloadProgress(4);
    setDownloadingTable(label);
    await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
    return window.setInterval(() => {
      setDownloadProgress((current) => Math.min(current + 5, 90));
    }, 180);
  }

  async function finishDownloadProgress(timer: number) {
    window.clearInterval(timer);
    setDownloadProgress(100);
    await new Promise((resolve) => window.setTimeout(resolve, 700));
    setDownloadProgress(0);
    setDownloadingTable('');
  }

  async function downloadBackup() {
    setBusy(true);
    const progressTimer = await showProgressBeforeDownload('full JSON backup');
    try {
      await api.download('/system/backup', `aditya-crm-backup-${new Date().toISOString().slice(0, 10)}.json`);
      await finishDownloadProgress(progressTimer);
      toast.success('Backup downloaded');
    } catch (error: any) { window.clearInterval(progressTimer); setDownloadProgress(0); setDownloadingTable(''); toast.error(error.message || 'Backup failed'); }
    finally { setBusy(false); }
  }

  async function downloadTableBackups() {
    if (!selectedTables.length) { toast.error('Select at least one table to download'); return; }
    setBusy(true);
    const preparationTimer = await showProgressBeforeDownload('backup data');
    try {
      const response = await fetch('/api/system/backup', { credentials: 'include', cache: 'no-store' });
      const backup = await response.json();
      if (!response.ok) throw new Error(backup.error || 'Backup failed');
      window.clearInterval(preparationTimer);
      setDownloadProgress(50);
      const date = new Date().toISOString().slice(0, 10);
      const tables = Object.entries(backup.tables || {}).filter(([table]) => selectedTables.includes(table));
      if (!tables.length) throw new Error('No tables found in the backup');
      for (const [index, [table, rows]] of tables.entries()) {
        setDownloadingTable(BACKUP_TABLES.find(([key]) => key === table)?.[1] || table);
        const blob = new Blob([JSON.stringify(rows, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `aditya-crm-${table}-${date}.json`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
        setDownloadProgress(50 + Math.round(((index + 1) / tables.length) * 50));
        await new Promise((resolve) => window.setTimeout(resolve, 120));
      }
      await finishDownloadProgress(preparationTimer);
      toast.success('Table-wise JSON downloads started', { description: 'Allow multiple downloads in your browser if prompted.' });
    } catch (error: any) { toast.error(error.message || 'Table-wise backup failed'); setDownloadProgress(0); setDownloadingTable(''); }
    finally { window.clearInterval(preparationTimer); setBusy(false); }
  }

  async function restoreBackup(file: File) {
    if (!window.confirm('Restore this backup? Existing records will be preserved and matching IDs will be skipped.')) return;
    setBusy(true);
    try {
      const payload = JSON.parse(await file.text());
      const response = await fetch('/api/system/backup', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Restore failed');
      toast.success('Backup restored', { description: result.message });
    } catch (error: any) { toast.error(error.message || 'Invalid backup file'); }
    finally { setBusy(false); if (fileRef.current) fileRef.current.value = ''; }
  }

  return <div className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1440px] mx-auto w-full space-y-6">
    <div><h2 className="flex items-center gap-2 text-2xl font-bold"><DatabaseBackup className="h-6 w-6" /> Backup &amp; Restore</h2><p className="mt-1 text-sm text-muted-foreground">Super Admin database protection tools.</p></div>
    <Card>
      <CardHeader><CardTitle className="text-base">Create backup</CardTitle></CardHeader>
      <CardContent className="space-y-4"><p className="text-sm text-muted-foreground">Download one complete, restore-ready JSON backup of the CRM database, including master data, users, leads, support tickets, OTP records, activities, follow-ups, and audit history.</p><Button onClick={downloadBackup} disabled={busy}><Download className="h-4 w-4" /> Download Full JSON Backup</Button>{downloadProgress > 0 && <div className="rounded-md border border-border bg-muted/40 p-3" role="status" aria-live="polite"><div className="mb-1 flex items-center justify-between text-xs font-medium"><span>Downloading {downloadingTable}...</span><span>{downloadProgress}%</span></div><div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full bg-green-500 transition-[width] duration-200 ease-out" style={{ width: `${downloadProgress}%` }} /></div></div>}<div className="rounded-lg border p-3"><div className="mb-3 flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-medium">Table-wise JSON download</p><Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => setSelectedTables(selectedTables.length === BACKUP_TABLES.length ? [] : BACKUP_TABLES.map(([key]) => key))}>{selectedTables.length === BACKUP_TABLES.length ? 'Clear all' : 'Select all'}</Button></div><div className="grid grid-cols-1 gap-2 sm:grid-cols-2">{BACKUP_TABLES.map(([key, label]) => <label key={key} className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-sm hover:bg-muted"><Checkbox checked={selectedTables.includes(key)} disabled={busy} onCheckedChange={(checked) => setSelectedTables((current) => checked ? [...new Set([...current, key])] : current.filter((table) => table !== key))} />{label}</label>)}</div><Button className="mt-4 w-full sm:w-auto" variant="outline" onClick={downloadTableBackups} disabled={busy || !selectedTables.length}><Download className="h-4 w-4" /> Download Selected Tables</Button></div><p className="text-xs text-muted-foreground">Table-wise files are for viewing or storing individual tables. Use the full JSON backup when restoring the CRM.</p></CardContent>
    </Card>
    <Card>
      <CardHeader><CardTitle className="text-base">Restore backup</CardTitle></CardHeader>
      <CardContent className="space-y-3"><p className="text-sm text-muted-foreground">Restoring preserves existing records and skips matching IDs. Always keep the original backup file.</p><input ref={fileRef} type="file" accept="application/json,.json" className="block w-full text-sm" onChange={(event) => { const file = event.target.files?.[0]; if (file) void restoreBackup(file); }} disabled={busy} /><Button variant="outline" disabled={busy} onClick={() => fileRef.current?.click()}><Upload className="h-4 w-4" /> Select Backup File</Button></CardContent>
    </Card>
  </div>;
}
