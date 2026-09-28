'use client';

import { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function RefreshAppButton() {
  const [refreshing, setRefreshing] = useState(false);

  function refreshApp() {
    if (refreshing) return;
    setRefreshing(true);
    window.dispatchEvent(new CustomEvent('crm:refresh'));
    window.setTimeout(() => setRefreshing(false), 650);
  }

  return (
    <Button
      type="button"
      size="icon"
      variant="ghost"
      className="relative h-9 w-9 !bg-transparent hover:!bg-transparent hover:!text-current focus-visible:!bg-transparent active:!bg-transparent"
      onClick={refreshApp}
      title="Refresh app"
      aria-label="Refresh app"
    >
      <RefreshCw className={`h-4 w-4 transition-colors ${refreshing ? 'animate-spin' : ''}`} />
    </Button>
  );
}
