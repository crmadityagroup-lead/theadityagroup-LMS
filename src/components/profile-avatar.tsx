'use client';

import { Camera } from 'lucide-react';
import { GeneratedAvatar } from '@/components/generated-avatar';
import { useAuth } from '@/lib/auth-context';

export function ProfileAvatar({ onClick }: { onClick: () => void }) {
  const { user } = useAuth();
  if (!user) return null;

  return <button type="button" className="group relative h-9 w-9 shrink-0 cursor-pointer overflow-hidden rounded-full border border-border bg-muted p-0" style={{ borderRadius: '9999px', clipPath: 'circle(50%)' }} title="Open profile" onClick={onClick}>
      {user.avatar_data ? <img src={user.avatar_data} alt="Profile" className="block h-full w-full object-cover object-center" style={{ borderRadius: '50%' }} /> : <GeneratedAvatar seed={`${user.id}:${user.email}`} name={user.name} size={36} />}
      <span className="absolute inset-0 flex items-center justify-center bg-black/45 text-white opacity-0 transition-opacity group-hover:opacity-100"><Camera className="h-4 w-4" /></span>
    </button>;
}
