'use client';

import { FormEvent, useState } from 'react';
import { HelpCircle, Loader2, Send, Ticket } from 'lucide-react';
import { api } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

export function HelpCenter() {
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [sending, setSending] = useState(false);
  const [token, setToken] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!description.trim() || sending) return;
    setSending(true);
    try {
      const result = await api.post<{ ticket: { token: string } }>('/notifications', { kind: 'support', subject, description, route: typeof window !== 'undefined' ? window.location.pathname : '/' });
      setToken(result.ticket.token); setSubject(''); setDescription('');
      toast.success('Issue submitted to Super Admin');
    } catch (error: any) { toast.error(error.message || 'Unable to submit issue'); }
    finally { setSending(false); }
  }

  function close() { setOpen(false); setToken(null); }

  return <><Button variant="outline" size="icon" className="relative h-9 w-9" title="Report an issue" aria-label="Report an issue" onClick={() => setOpen(true)}><HelpCircle className="h-4 w-4" /></Button><Dialog open={open} onOpenChange={(value) => value ? setOpen(true) : close()}><DialogContent><DialogHeader><DialogTitle>Report an issue</DialogTitle><DialogDescription>Tell Super Admin what went wrong. Your support token helps track this report.</DialogDescription></DialogHeader>{token ? <div className="space-y-4 rounded-lg border border-green-300 bg-green-50 p-4 text-green-950 dark:bg-green-950/30 dark:text-green-100"><div className="flex items-center gap-2 font-semibold"><Ticket className="h-4 w-4" /> Issue submitted</div><p className="text-sm">Keep this token for follow-up:</p><code className="block rounded bg-white/70 p-2 text-center font-bold tracking-wider dark:bg-black/20">{token}</code><Button className="w-full" onClick={close}>Close</Button></div> : <form className="space-y-4" onSubmit={submit}><div className="space-y-2"><Label htmlFor="support-subject">Subject</Label><Input id="support-subject" value={subject} onChange={(event) => setSubject(event.target.value)} placeholder="Short description" maxLength={160} /></div><div className="space-y-2"><Label htmlFor="support-description">What happened? *</Label><Textarea id="support-description" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Describe the error or problem..." required maxLength={5000} rows={6} /></div><DialogFooter><Button type="button" variant="outline" onClick={close}>Cancel</Button><Button type="submit" disabled={sending || !description.trim()}>{sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Submit issue</Button></DialogFooter></form>}</DialogContent></Dialog></>;
}
