'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { NotificationsBell } from '@/components/notifications-bell';
import { UniversalSearch } from '@/components/universal-search';
import { Logo } from '@/components/logo';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { DashboardPage } from '@/components/pages/dashboard-page';
import { LeadsPage } from '@/components/pages/leads-page';
import { LeadDetailPage } from '@/components/pages/lead-detail-page';
import { AddLeadPage } from '@/components/pages/add-lead-page';
import { UsersPage } from '@/components/pages/users-page';
import { ModelsPage } from '@/components/pages/models-page';
import { ReportsPage } from '@/components/pages/reports-page';
import { PerformancePage } from '@/components/pages/performance-page';
import { LoginHistoryPage } from '@/components/pages/login-history-page';
import { RecycleBinPage } from '@/components/pages/recycle-bin-page';
import { ThemePage } from '@/components/pages/theme-page';
import { BackupPage } from '@/components/pages/backup-page';
import { SupportTicketsPage } from '@/components/pages/support-tickets-page';
import { DatabaseHealthPage } from '@/components/pages/database-health-page';
import { ProfilePage } from '@/components/pages/profile-page';
import { LeadEscalationPage } from '@/components/pages/lead-escalation-page';
import { GoogleFormResponsesPage } from '@/components/pages/google-form-responses-page';
import { HelpCenter } from '@/components/help-center';
import { ProfileAvatar } from '@/components/profile-avatar';
import { ClearAppCacheButton } from '@/components/clear-app-cache-button';
import { RefreshAppButton } from '@/components/refresh-app-button';
import { api } from '@/lib/api-client';
import {
  LayoutDashboard, ClipboardList, Plus, Users, Car, BarChart3, TrendingUp, Clock, Recycle, Palette, DatabaseBackup, HelpCircle, LogOut, Menu, X, Building, PanelLeftClose, PanelLeftOpen, Server, BellRing, FileText,
} from 'lucide-react';

interface NavItem {
  key: string;
  label: string;
  icon: any;
  roles: string[];
}

const PAGES: NavItem[] = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['super_admin', 'admin', 'admin_2', 'data_operator_1', 'data_operator_2', 'department_user'] },
  { key: 'leads', label: 'Leads', icon: ClipboardList, roles: ['super_admin', 'admin', 'admin_2', 'data_operator_1', 'data_operator_2', 'department_user'] },
  { key: 'leads-new', label: 'Add Entry', icon: Plus, roles: ['data_operator_1', 'data_operator_2'] },
  { key: 'google-form-responses', label: 'Google Form Responses', icon: FileText, roles: ['super_admin', 'admin', 'admin_2', 'data_operator_1', 'data_operator_2'] },
  { key: 'models', label: 'Models', icon: Car, roles: ['super_admin'] },
  { key: 'users', label: 'Users', icon: Users, roles: ['super_admin'] },
  { key: 'reports', label: 'Reports', icon: BarChart3, roles: ['super_admin', 'admin', 'admin_2', 'data_operator_1', 'data_operator_2'] },
  { key: 'performance', label: 'Performance', icon: TrendingUp, roles: ['super_admin', 'admin', 'admin_2'] },
  { key: 'login-history', label: 'Login History', icon: Clock, roles: ['super_admin'] },
  { key: 'recycle-bin', label: 'Recycle Bin', icon: Recycle, roles: ['super_admin', 'admin', 'admin_2'] },
  { key: 'theme', label: 'Theme', icon: Palette, roles: ['super_admin'] },
  { key: 'backup', label: 'Backup & Restore', icon: DatabaseBackup, roles: ['super_admin'] },
  { key: 'support-tickets', label: 'Help Requests', icon: HelpCircle, roles: ['super_admin'] },
  { key: 'database-health', label: 'Database Health', icon: Server, roles: ['super_admin', 'admin'] },
  { key: 'lead-escalation', label: 'Lead Escalation', icon: BellRing, roles: ['super_admin'] },
];

const ROLE_TABS: Record<string, string[]> = {
  super_admin: ['dashboard', 'leads', 'google-form-responses', 'models', 'users', 'reports', 'performance', 'login-history', 'recycle-bin', 'theme', 'backup', 'support-tickets', 'database-health', 'lead-escalation'],
  admin: ['dashboard', 'leads', 'google-form-responses', 'reports', 'performance', 'recycle-bin', 'database-health'],
  admin_2: ['dashboard', 'leads', 'google-form-responses', 'reports', 'performance', 'recycle-bin'],
  data_operator_1: ['dashboard', 'leads', 'leads-new', 'google-form-responses', 'reports'],
  data_operator_2: ['dashboard', 'leads', 'leads-new', 'google-form-responses', 'reports'],
  department_user: ['dashboard', 'leads'],
};
const DEALER_LABELS: Record<number, string> = { 1: 'Aditya Motors', 2: 'Aditya Hyundai', 3: 'HighWay Honda' };

function normalizeRole(role: string) {
  const normalized = role.trim().toLowerCase().replace(/[\s-]+/g, '_');
  return normalized.replace(/^data_operator([12])$/, 'data_operator_$1');
}

export function AppShell() {
  const { user, logout } = useAuth();
  const [route, setRoute] = useState('dashboard');
  const [routeArg, setRouteArg] = useState<any>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [refreshVersion, setRefreshVersion] = useState(0);

  function navigate(r: string, arg: any = null) {
    setRoute(r);
    setRouteArg(arg);
    setSidebarOpen(false);
    if (typeof window !== 'undefined') window.scrollTo({ top: 0 });
  }

  useEffect(() => {
    (window as any).App = { navigate, currentRoute: route };
  }, [route]);

  useEffect(() => {
    const refreshCurrentPage = () => setRefreshVersion((version) => version + 1);
    window.addEventListener('crm:refresh', refreshCurrentPage);
    return () => window.removeEventListener('crm:refresh', refreshCurrentPage);
  }, []);

  useEffect(() => {
    if (!user) return;
    const reportPresence = () => {
      if (document.visibilityState === 'visible') void api.post('/users/presence', { page: route, route_arg: routeArg }).catch(() => {});
    };
    reportPresence();
    const timer = window.setInterval(reportPresence, 30000);
    document.addEventListener('visibilitychange', reportPresence);
    return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', reportPresence); };
  }, [user, route, routeArg]);

  if (!user) return null;

  const allowedTabs = ROLE_TABS[normalizeRole(user.role)] || [];
  const navItems = PAGES.filter((p) => allowedTabs.includes(p.key));
  const canClearCache = ['super_admin', 'admin', 'admin_2'].includes(normalizeRole(user.role));

  function renderPage() {
    switch (route) {
      case 'dashboard': return <DashboardPage navigate={navigate} />;
      case 'leads': return <LeadsPage navigate={navigate} highlightId={routeArg} />;
      case 'leads-new': return <AddLeadPage navigate={navigate} />;
      case 'google-form-responses': return <GoogleFormResponsesPage />;
      case 'lead-detail': return <LeadDetailPage leadId={routeArg} navigate={navigate} />;
      case 'models': return <ModelsPage />;
      case 'users': return <UsersPage />;
      case 'reports': return normalizeRole(user?.role || '') === 'department_user' ? <LeadsPage navigate={navigate} /> : <ReportsPage />;
      case 'performance': return <PerformancePage />;
      case 'login-history': return normalizeRole(user?.role || '') === 'super_admin' ? <LoginHistoryPage /> : <DashboardPage navigate={navigate} />;
      case 'recycle-bin': return <RecycleBinPage />;
      case 'theme': return normalizeRole(user?.role || '') === 'super_admin' ? <ThemePage /> : <DashboardPage navigate={navigate} />;
      case 'backup': return normalizeRole(user?.role || '') === 'super_admin' ? <BackupPage /> : <DashboardPage navigate={navigate} />;
      case 'support-tickets': return normalizeRole(user?.role || '') === 'super_admin' ? <SupportTicketsPage /> : <DashboardPage navigate={navigate} />;
      case 'database-health': return ['super_admin', 'admin'].includes(normalizeRole(user?.role || '')) ? <DatabaseHealthPage /> : <DashboardPage navigate={navigate} />;
      case 'lead-escalation': return normalizeRole(user?.role || '') === 'super_admin' ? <LeadEscalationPage /> : <DashboardPage navigate={navigate} />;
      case 'profile': return <ProfilePage navigate={navigate} />;
      default: return <DashboardPage navigate={navigate} />;
    }
  }

  return (
    <div className="app-shell bg-background text-foreground">
      <aside
        className={`neo-sidebar fixed inset-y-0 left-0 z-40 h-screen shrink-0 overflow-hidden bg-sidebar border-r-2 border-sidebar-border flex flex-col transition-[width,transform] duration-500 ease-in-out will-change-[width,transform] ${
          sidebarCollapsed ? 'lg:w-20' : 'lg:w-72'
        } ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
      >
        <div className={`neo-sidebar-brand flex items-center gap-3 px-4 py-4 border-b-2 border-sidebar-border ${sidebarCollapsed ? 'justify-center' : 'justify-between'}`}>
          <div className={`flex items-center gap-3 min-w-0 ${sidebarCollapsed ? 'justify-center' : ''}`}>
            <Button
              variant="ghost"
              size="icon"
              className="hidden lg:inline-flex h-9 w-9 rounded-xl text-[#25253b] hover:bg-muted hover:text-[#25253b] dark:text-white dark:hover:bg-white/10 dark:hover:text-white"
              onClick={() => setSidebarCollapsed((value) => !value)}
              title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {sidebarCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
            </Button>
            {!sidebarCollapsed && (
              <div className="min-w-0">
                <div className="font-semibold text-base leading-tight text-sidebar-foreground uppercase whitespace-nowrap">Aditya Group Portal</div>
                <div className="mt-0.5 text-[11px] uppercase tracking-[0.18em] text-sidebar-foreground/60 whitespace-nowrap">CRM Workspace</div>
              </div>
            )}
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="ml-auto lg:hidden h-8 w-8" onClick={() => setSidebarOpen(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <nav className={`neo-sidebar-nav min-h-0 flex-1 overflow-y-auto p-3 space-y-2 border-b-2 border-sidebar-border ${sidebarCollapsed ? 'px-2' : ''}`}>
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = route === item.key;
            return (
              <button
                key={item.key}
                onClick={() => navigate(item.key)}
                title={item.label}
                className={`neo-sidebar-item w-full flex items-center gap-3 px-3 py-2.5 rounded-sm text-sm font-bold transition-colors ${
                  sidebarCollapsed ? 'justify-center px-2' : 'justify-start'
                } ${active ? 'is-active bg-sidebar-accent text-sidebar-accent-foreground' : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'}`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className={`${sidebarCollapsed ? 'sr-only' : 'inline'} whitespace-nowrap`}>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="shrink-0 flex items-end justify-center p-5">
          {sidebarCollapsed ? (
            <Logo variant="icon" size={42} className="transition-transform duration-300" />
          ) : (
            <div className="neo-sidebar-brand-mark text-center">
              <Logo variant="full" size={64} className="origin-center max-lg:scale-125" />
              {user.dealer_id && DEALER_LABELS[user.dealer_id] && <div className="mt-2 text-xs font-black uppercase tracking-wide text-sidebar-foreground">{DEALER_LABELS[user.dealer_id]}</div>}
            </div>
          )}
        </div>
      </aside>

      {sidebarOpen && <div className="fixed inset-0 z-30 bg-black/80 lg:hidden" onClick={() => setSidebarOpen(false)} />}

      <div className={`flex-1 flex flex-col min-w-0 transition-[margin] duration-500 ease-in-out ${sidebarCollapsed ? 'lg:ml-20' : 'lg:ml-72'}`}>
        <header className="sticky top-0 z-20 bg-background border-b border-border px-4 sm:px-6 py-[1.1rem] flex items-center gap-3">
          <Button variant="ghost" size="icon" className="lg:hidden h-9 w-9" onClick={() => setSidebarOpen(true)}>
            <Menu className="h-5 w-5" />
          </Button>
          <div className="hidden flex-1 items-center lg:flex">
            <h2 className="text-xl font-bold">Welcome back, {user.name}</h2>
          </div>
          {user.department && (
            <span className="hidden sm:inline-flex items-center gap-1 text-xs text-muted-foreground px-2 py-1 rounded-md bg-muted">
              <Building className="h-3 w-3" /> {user.department}
            </span>
          )}
          <div className="ml-auto flex items-center gap-2">
            <RefreshAppButton />
            <NotificationsBell />
            <HelpCenter />
            <UniversalSearch navigate={navigate} />
          </div>
          <div className="flex items-center gap-2 pl-3 border-l border-border">
            <ProfileAvatar onClick={() => navigate('profile')} />
            <div className="hidden text-left sm:block">
              <div className="text-sm font-medium leading-tight">{user.name}</div>
              <div className="text-xs text-muted-foreground leading-tight">{user.email}</div>
            </div>
            <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => setLogoutOpen(true)} title="Sign out">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1440px] mx-auto w-full"><div key={`${route}-${routeArg ?? ''}-${refreshVersion}`}>{renderPage()}</div></main>
        <footer className="px-4 py-3 text-center text-xs text-muted-foreground border-t border-border">
          &copy; 2026 Aditya Group. All Rights Reserved.
        </footer>
      </div>

      <ClearAppCacheButton canClear={canClearCache} />

      <AlertDialog open={logoutOpen} onOpenChange={setLogoutOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Log out of your account?</AlertDialogTitle>
            <AlertDialogDescription>You will need a new one-time code to sign in again.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="btn-gold" onClick={logout}>Log out</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
