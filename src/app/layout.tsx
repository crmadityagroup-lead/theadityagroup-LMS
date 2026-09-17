import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import { ThemeColorApplier } from "@/components/theme-customizer";
import { RightClickGuard } from "@/components/right-click-guard";

export const metadata: Metadata = {
  title: "Aditya Group CRM Portal",
  description: "Lead Lifecycle & Department Dashboard — Aditya Group (Mahindra · Hyundai · Honda)",
  keywords: ["Aditya Group", "CRM", "Lead Management"],
  authors: [{ name: "Aditya Group" }],
  icons: {
    icon: "/favicon.png",
    apple: "/favicon.png",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning className="font-sans antialiased bg-background text-foreground">
        <RightClickGuard />
        <ThemeColorApplier />
        {children}
        <Toaster />
        <SonnerToaster richColors position="top-right" />
      </body>
    </html>
  );
}
