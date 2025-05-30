'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Sidebar,
  SidebarProvider,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
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
  Settings,
  CalendarDays,
  LogOut,
  Briefcase,
  ShieldCheck,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  allowedRoles: ('admin' | 'employee')[];
  subItems?: NavItem[];
  isBottom?: boolean;
}

const navItems: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, allowedRoles: ['employee'] },
  { href: '/admin/dashboard', label: 'Admin Dashboard', icon: ShieldCheck, allowedRoles: ['admin'] },
  { href: '/profile', label: 'Profile', icon: UserCircle, allowedRoles: ['admin', 'employee'] },
  { href: '/tasks', label: 'My Tasks', icon: ListChecks, allowedRoles: ['employee'] },
  { href: '/leave', label: 'Leave', icon: CalendarOff, allowedRoles: ['employee', 'admin'] }, // Admin might view/approve
  { href: '/admin/employees', label: 'Employees', icon: Users, allowedRoles: ['admin'] },
  { href: '/admin/tasks', label: 'Manage Tasks', icon: Briefcase, allowedRoles: ['admin'] },
  { href: '/admin/holidays', label: 'Holidays', icon: CalendarDays, allowedRoles: ['admin', 'employee'] }, // Employee can view
  { href: '/admin/settings', label: 'Settings', icon: Settings, allowedRoles: ['admin'], isBottom: true },
];


export function AppShell({ children }: { children: ReactNode }) {
  const { role, logout } = useAuth();
  const pathname = usePathname();

  const filteredNavItems = navItems.filter(item => item.allowedRoles.includes(role!));
  const topNavItems = filteredNavItems.filter(item => !item.isBottom);
  const bottomNavItems = filteredNavItems.filter(item => item.isBottom);

  const renderNavItems = (items: NavItem[]) => {
    return items.map((item) => (
      <SidebarMenuItem key={item.label}>
        <Link href={item.href} passHref legacyBehavior>
          <SidebarMenuButton
            isActive={pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href))}
            className="w-full justify-start"
            tooltip={{ children: item.label, side: 'right', className: 'bg-card text-card-foreground border-border' }}
          >
            <item.icon className="h-5 w-5" />
            <span className="truncate group-data-[collapsible=icon]:hidden">{item.label}</span>
          </SidebarMenuButton>
        </Link>
      </SidebarMenuItem>
    ));
  };
  
  return (
    <SidebarProvider defaultOpen>
      <div className="flex h-screen bg-background">
        <Sidebar side="left" variant="sidebar" collapsible="icon" className="border-r bg-sidebar text-sidebar-foreground">
          <SidebarHeader className="p-2 h-16 flex items-center justify-between">
             <AppLogo />
             {/* Mobile trigger shown when sidebar is collapsed by icon */}
             <div className="md:hidden group-data-[collapsible=icon]:hidden"> 
               <SidebarTrigger />
             </div>
          </SidebarHeader>
          <SidebarContent className="flex-1 p-2">
            <ScrollArea className="h-full">
              <SidebarMenu>
                {renderNavItems(topNavItems)}
              </SidebarMenu>
            </ScrollArea>
          </SidebarContent>
          <SidebarFooter className="p-2">
            <SidebarMenu>
              {renderNavItems(bottomNavItems)}
              <SidebarMenuItem>
                <SidebarMenuButton onClick={logout} className="w-full justify-start" tooltip={{ children: "Logout", side: 'right', className: 'bg-card text-card-foreground border-border' }}>
                  <LogOut className="h-5 w-5" />
                   <span className="truncate group-data-[collapsible=icon]:hidden">Logout</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarFooter>
        </Sidebar>

        <div className="flex flex-1 flex-col overflow-hidden">
          <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b bg-background px-4 md:px-6 shadow-sm">
            <div className="flex items-center gap-2">
               {/* Desktop trigger */}
              <div className="hidden md:block">
                <SidebarTrigger/>
              </div>
               {/* Mobile trigger shown when sidebar is not collapsed by icon */}
              <div className="md:hidden group-data-[collapsible=icon]:block">
                 <SidebarTrigger />
              </div>
              <h1 className="text-lg font-semibold text-foreground">{/* Page Title Could Go Here */}</h1>
            </div>
            <UserNav />
          </header>
          <main className="flex-1 overflow-y-auto p-4 md:p-6 bg-background">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
