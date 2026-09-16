'use client';
import { useEffect, useState } from 'react';
import { AuthProvider, useAuth } from '@/lib/auth-context';
import { LoginPage } from '@/components/pages/login-page';
import { AppShell } from '@/components/app-shell';
import { Toaster } from '@/components/ui/toaster';

function Shell() {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Loading…</div>
      </div>
    );
  }
  if (!user) return <LoginPage />;
  return <AppShell />;
}

export default function Home() {
  return (
    <AuthProvider>
      <Shell />
      <Toaster />
    </AuthProvider>
  );
}
