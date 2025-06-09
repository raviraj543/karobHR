
'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AppLogo } from './AppLogo';
import { UserNav } from './UserNav';
import { useAuth } from '@/hooks/useAuth';
import {
  LayoutDashboard,
  UserCircle,
  CalendarOff,
  ListChecks,
  Users,
  Settings as SettingsIcon,
  CalendarDays,
  LogOut,
  Fingerprint,
  Briefcase,
  ShieldCheck,
  IndianRupee,
  CreditCard,
  Clock,
  Menu,
} from 'lucide-react';
import { useMobile } from '@/hooks/use-mobile'; // Import the new hook

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  allowedRoles: ('admin' | 'manager' | 'employee')[];
  isBottom?: boolean;
}

const navItems: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, allowedRoles: ['employee', 'manager'] },
  { href: '/admin/dashboard', label: 'Admin Dashboard', icon: ShieldCheck, allowedRoles: ['admin'] },
  { href: '/profile', label: 'Profile', icon: UserCircle, allowedRoles: ['admin', 'manager', 'employee'] },
  { href: '/attendance', label: 'My Attendance', icon: Fingerprint, allowedRoles: ['employee', 'manager', 'admin'] },
  { href: '/tasks', label: 'My Tasks', icon: ListChecks, allowedRoles: ['employee', 'manager'] },
  { href: '/leave', label: 'Leave', icon: CalendarOff, allowedRoles: ['employee', 'admin', 'manager'] },
  { href: '/payroll', label: 'My Payslip', icon: CreditCard, allowedRoles: ['employee', 'manager'] },
  { href: '/settings', label: 'Settings', icon: SettingsIcon, allowedRoles: ['employee', 'manager'] },
  // Admin specific
  { href: '/admin/employees', label: 'Employees', icon: Users, allowedRoles: ['admin'] },
  { href: '/admin/tasks', label: 'Manage Tasks', icon: Briefcase, allowedRoles: ['admin'] },
  { href: '/admin/live-attendance', label: 'Live Attendance', icon: Clock, allowedRoles: ['admin'] },
  { href: '/admin/payroll', label: 'Payroll', icon: IndianRupee, allowedRoles: ['admin'] },
  { href: '/admin/holidays', label: 'Holidays', icon: CalendarDays, allowedRoles: ['admin'] },
  { href: '/admin/settings', label: 'Company Settings', icon: SettingsIcon, allowedRoles: ['admin'], isBottom: true },
];

const SidebarContent = ({ onLinkClick }: { onLinkClick?: () => void }) => {
  const { role, logout } = useAuth();
  const pathname = usePathname();

  const filteredNavItems = navItems.filter(item => role && item.allowedRoles.includes(role));
  const topNavItems = filteredNavItems.filter(item => !item.isBottom);
  const bottomNavItems = filteredNavItems.filter(item => item.isBottom);

  const renderNavItems = (items: NavItem[]) => {
    return items.map((item) => (
      <Link
        key={item.label + item.href}
        href={item.href}
        onClick={onLinkClick}
        className={`flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary ${
          pathname === item.href ? 'bg-muted text-primary' : ''
        }`}
      >
        <item.icon className="h-4 w-4" />
        {item.label}
      </Link>
    ));
  };

  return (
    <div className="flex h-full max-h-screen flex-col gap-2">
      <div className="flex h-14 items-center border-b px-4 lg:h-[60px] lg:px-6">
        <Link href="/" className="flex items-center gap-2 font-semibold" onClick={onLinkClick}>
          <AppLogo />
          <span className="">BizFlow</span>
        </Link>
      </div>
      <div className="flex-1">
        <ScrollArea className="h-[calc(100vh-160px)]">
          <nav className="grid items-start px-2 text-sm font-medium lg:px-4">
            {renderNavItems(topNavItems)}
          </nav>
        </ScrollArea>
      </div>
      <div className="mt-auto p-4 border-t">
        <nav className="grid items-start text-sm font-medium">
          {renderNavItems(bottomNavItems)}
          <button
            onClick={() => {
              if (onLinkClick) onLinkClick();
              logout();
            }}
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary"
          >
            <LogOut className="h-4 w-4" />
            Logout
          </button>
        </nav>
      </div>
    </div>
  );
};

export function AppShell({ children }: { children: ReactNode }) {
  const isMobile = useMobile();
  const [isSheetOpen, setIsSheetOpen] = React.useState(false);

  const handleLinkClick = () => {
    if (isMobile) {
      setIsSheetOpen(false);
    }
  };

  return (
    <div className="grid min-h-screen w-full md:grid-cols-[220px_1fr] lg:grid-cols-[280px_1fr]">
      <div className="hidden border-r bg-muted/40 md:block">
        <SidebarContent />
      </div>
      <div className="flex flex-col">
        <header className="flex h-14 items-center gap-4 border-b bg-muted/40 px-4 lg:h-[60px] lg:px-6">
          <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
            <SheetTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="shrink-0 md:hidden"
                onClick={() => setIsSheetOpen(true)}
              >
                <Menu className="h-5 w-5" />
                <span className="sr-only">Toggle navigation menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="flex flex-col p-0">
              <SidebarContent onLinkClick={handleLinkClick} />
            </SheetContent>
          </Sheet>
          <div className="w-full flex-1" />
          <UserNav />
        </header>
        <main className="flex flex-1 flex-col gap-4 p-4 lg:gap-6 lg:p-6 bg-background">
          {children}
        </main>
      </div>
    </div>
  );
}
