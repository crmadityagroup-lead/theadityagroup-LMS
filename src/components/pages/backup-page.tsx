'use client';

import { useRef, useState } from 'react';
import { Download, DatabaseBackup, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { api } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';

export function BackupPage() {
  const { isSuperAdmin } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  if (!isSuperAdmin()) return <div className="p-8 text-center text-muted-foreground">Access denied - Super Admin only</div>;

  async function downloadBackup() {
    setBusy(true);
    try {
      await api.download('/system/backup', `aditya-crm-backup-${new Date().toISOString().slice(0, 10)}.json`);
      toast.success('Backup downloaded');
    } catch (error: any) { toast.error(error.message || 'Backup failed'); }
    finally { setBusy(false); }
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

  return <div className="mx-auto max-w-3xl space-y-6">
    <div><h2 className="flex items-center gap-2 text-2xl font-bold"><DatabaseBackup className="h-6 w-6" /> Backup &amp; Restore</h2><p className="mt-1 text-sm text-muted-foreground">Super Admin database protection tools.</p></div>
    <Card>
      <CardHeader><CardTitle className="text-base">Create backup</CardTitle></CardHeader>
      <CardContent className="space-y-3"><p className="text-sm text-muted-foreground">Downloads a protected JSON copy of CRM master data, users, leads, activities, follow-ups, and audit history.</p><Button onClick={downloadBackup} disabled={busy}><Download className="h-4 w-4" /> Download Backup</Button></CardContent>
    </Card>
    <Card>
      <CardHeader><CardTitle className="text-base">Restore backup</CardTitle></CardHeader>
      <CardContent className="space-y-3"><p className="text-sm text-muted-foreground">Restoring preserves existing records and skips matching IDs. Always keep the original backup file.</p><input ref={fileRef} type="file" accept="application/json,.json" className="block w-full text-sm" onChange={(event) => { const file = event.target.files?.[0]; if (file) void restoreBackup(file); }} disabled={busy} /><Button variant="outline" disabled={busy} onClick={() => fileRef.current?.click()}><Upload className="h-4 w-4" /> Select Backup File</Button></CardContent>
    </Card>
  </div>;
}


