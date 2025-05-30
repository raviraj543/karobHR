import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Users, ListChecks, CalendarOff, Settings, BarChart3, Activity } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Admin Dashboard - BizFlow',
  description: 'Manage your organization with BizFlow.',
};

const adminStats = [
  { title: "Total Employees", value: "75", icon: Users, link: "/admin/employees" },
  { title: "Pending Leave Approvals", value: "5", icon: CalendarOff, link: "/admin/leave-approvals" },
  { title: "Tasks In Progress", value: "23", icon: ListChecks, link: "/admin/tasks" },
  { title: "System Health", value: "Optimal", icon: Activity, color: "text-green-500" },
];

export default function AdminDashboardPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Admin Dashboard</h1>
          <p className="text-muted-foreground">Overview of company operations and quick actions.</p>
        </div>
         <Link href="/admin/settings" passHref>
           <Button variant="outline">
             <Settings className="mr-2 h-4 w-4" />
             Company Settings
           </Button>
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {adminStats.map((stat) => (
          <Card key={stat.title} className="shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
              <stat.icon className={`h-5 w-5 text-muted-foreground ${stat.color || ''}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
               <Link href={stat.link} className="text-xs text-muted-foreground hover:text-primary transition-colors">
                Manage &rarr;
              </Link>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>Recent Employee Activity</CardTitle>
            <CardDescription>Overview of recent check-ins, task updates, and leave requests.</CardDescription>
          </CardHeader>
          <CardContent>
            {/* Placeholder for activity feed or summary charts */}
            <p className="text-muted-foreground">Employee activity data will be shown here.</p>
            <div className="mt-4 h-64 bg-muted rounded-md flex items-center justify-center" data-ai-hint="bar chart employee activity">
                <BarChart3 className="h-16 w-16 text-muted-foreground/50"/>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>Quick Links</CardTitle>
            <CardDescription>Access common admin tasks quickly.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <Button variant="outline" asChild><Link href="/admin/employees/new">Add New Employee</Link></Button>
            <Button variant="outline" asChild><Link href="/admin/tasks/new">Assign New Task</Link></Button>
            <Button variant="outline" asChild><Link href="/admin/holidays">Manage Holidays</Link></Button>
            <Button variant="outline" asChild><Link href="/admin/reports">Generate Reports</Link></Button>
          </CardContent>
        </Card>
      </div>
       <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>Task Completion Overview</CardTitle>
            <CardDescription>Summary of task statuses across the organization.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">Task overview data will be shown here.</p>
            {/* Placeholder for task chart */}
             <div className="mt-4 h-64 bg-muted rounded-md flex items-center justify-center" data-ai-hint="pie chart task status">
                 <BarChart3 className="h-16 w-16 text-muted-foreground/50"/>
            </div>
          </CardContent>
        </Card>
    </div>
  );
}
