'use client';

import { Palette } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ThemeColorPicker } from '@/components/theme-customizer';

export function ThemePage() {
  return (
    <div className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1440px] mx-auto w-full">
      <div className="space-y-6">
      <div>
        <h2 className="flex items-center gap-2 text-2xl font-bold"><Palette className="h-6 w-6" /> Theme</h2>
        <p className="mt-1 text-sm text-muted-foreground">Choose the appearance used across the CRM.</p>
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base">Dashboard color palette</CardTitle></CardHeader>
        <CardContent>
          <p className="mb-4 text-sm text-muted-foreground">Set the colors used by dashboard surfaces, text, buttons, borders, and the sidebar.</p>
          <ThemeColorPicker />
        </CardContent>
      </Card>
      </div>
    </div>
  );
}
