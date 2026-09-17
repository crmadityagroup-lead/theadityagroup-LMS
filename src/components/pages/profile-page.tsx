'use client';

import { ChangeEvent, useRef, useState } from 'react';
import { ArrowLeft, Camera, Mail, Phone, Trash2, UserRound } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { GeneratedAvatar } from '@/components/generated-avatar';
import { useAuth } from '@/lib/auth-context';

async function cropAvatar(file: File) {
  const source = await createImageBitmap(file);
  try {
    const cropSize = Math.min(source.width, source.height);
    const sourceX = (source.width - cropSize) / 2;
    const sourceY = (source.height - cropSize) / 2;
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Image processing is not available.');
    context.drawImage(source, sourceX, sourceY, cropSize, cropSize, 0, 0, 512, 512);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9));
    if (!blob) throw new Error('Could not prepare the image.');
    return new File([blob], 'profile-photo.jpg', { type: 'image/jpeg' });
  } finally {
    source.close();
  }
}

export function ProfilePage({ navigate }: { navigate: (route: string) => void }) {
  const { user, setUserDirect } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  if (!user) return null;
  const currentUser = user;

  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 2 * 1024 * 1024) {
      toast.error('Choose a JPG, PNG, or WebP image smaller than 2 MB.');
      return;
    }
    setUploading(true);
    try {
      const croppedFile = await cropAvatar(file);
      const formData = new FormData();
      formData.append('avatar', croppedFile);
      const response = await fetch('/api/profile/avatar', { method: 'POST', body: formData, credentials: 'include' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Upload failed');
      setUserDirect({ ...currentUser, avatar_data: data.avatar_data });
      toast.success('Profile photo updated.');
    } catch (error: any) { toast.error(error.message || 'Could not upload profile photo.'); }
    finally { setUploading(false); }
  }

  async function remove() {
    setUploading(true);
    try {
      const response = await fetch('/api/profile/avatar', { method: 'DELETE', credentials: 'include' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Remove failed');
      setUserDirect({ ...currentUser, avatar_data: data.avatar_data });
      toast.success('Profile photo removed.');
    } catch (error: any) { toast.error(error.message || 'Could not remove profile photo.'); }
    finally { setUploading(false); }
  }

  return <div className="mx-auto w-full max-w-xl space-y-4">
    <Button variant="ghost" className="-ml-2" onClick={() => navigate('dashboard')}><ArrowLeft className="mr-2 h-4 w-4" /> Back to dashboard</Button>
    <Card>
      <CardHeader><CardTitle>My Profile</CardTitle></CardHeader>
      <CardContent className="space-y-6">
        <div className="flex flex-col items-center gap-3 sm:flex-row sm:text-left">
          <div className="aspect-square h-28 w-28 shrink-0 overflow-hidden rounded-full border-4 border-muted shadow-sm">
            {user.avatar_data ? <img src={user.avatar_data} alt={`${user.name} profile`} className="block aspect-square h-full w-full rounded-full object-cover object-center" /> : <GeneratedAvatar seed={`${user.id}:${user.email}`} name={user.name} size={112} />}
          </div>
          <div className="text-center sm:text-left"><h2 className="text-xl font-bold">{user.name}</h2><p className="mt-1 text-sm text-muted-foreground">{user.role.replaceAll('_', ' ')}</p></div>
        </div>
        <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={upload} />
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button className="btn-gold" disabled={uploading} onClick={() => inputRef.current?.click()}><Camera className="mr-2 h-4 w-4" /> {uploading ? 'Uploading...' : 'Upload profile photo'}</Button>
          {user.avatar_data && <Button variant="outline" disabled={uploading} onClick={() => void remove()}><Trash2 className="mr-2 h-4 w-4" /> Remove photo</Button>}
        </div>
        <p className="text-xs text-muted-foreground">JPG, PNG, or WebP. Maximum file size: 2 MB.</p>
        <div className="grid grid-cols-1 gap-5 border-t pt-5 sm:grid-cols-2">
          <div className="space-y-4">
            <div className="flex items-center gap-3"><UserRound className="h-5 w-5 text-muted-foreground" /><div><p className="text-xs text-muted-foreground">Name</p><p className="font-medium break-words">{user.name}</p></div></div>
            <div className="flex items-center gap-3"><Mail className="h-5 w-5 text-muted-foreground" /><div className="min-w-0"><p className="text-xs text-muted-foreground">Email</p><p className="font-medium break-all">{user.email}</p></div></div>
          </div>
          <div className="flex items-start gap-3"><Phone className="h-5 w-5 text-muted-foreground" /><div><p className="text-xs text-muted-foreground">Mobile number</p><p className="font-medium">{user.phone || 'Not provided'}</p></div></div>
        </div>
      </CardContent>
    </Card>
  </div>;
}
