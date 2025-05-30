import { TaskSummarizer } from '@/components/tasks/TaskSummarizer';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { BarChart, CheckSquare, DollarSign, UserCircle } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = {
  title: 'Dashboard - BizFlow',
  description: 'Your personal dashboard for BizFlow.',
};

export default function EmployeeDashboardPage() {
  // Placeholder data - replace with actual data fetching
  const employeeName = "John Doe"; 
  const quickStats = [
    { title: "Attendance This Month", value: "20/22 Days", icon: CheckSquare, link: "/attendance" },
    { title: "Pending Tasks", value: "3 Tasks", icon: CheckSquare, link: "/tasks" },
    { title: "Leave Balance", value: "10 Days", icon: UserCircle, link: "/leave" },
    { title: "Next Payslip", value: "Oct 30, 2023", icon: DollarSign, link: "/payroll" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Welcome, {employeeName}!</h1>
          <p className="text-muted-foreground">Here's an overview of your activities.</p>
        </div>
        <Link href="/profile" passHref>
           <Button variant="outline">
             <UserCircle className="mr-2 h-4 w-4" />
             View Profile
           </Button>
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {quickStats.map((stat) => (
          <Card key={stat.title} className="shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
              <stat.icon className="h-5 w-5 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <Link href={stat.link} className="text-xs text-muted-foreground hover:text-primary transition-colors">
                View Details &rarr;
              </Link>
            </CardContent>
          </Card>
        ))}
      </div>
      
      <Separator />

      <TaskSummarizer />

      <div className="mt-8 grid gap-6 md:grid-cols-2">
         <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>A log of your recent actions.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">No recent activity to display yet.</p>
            {/* Placeholder for activity feed */}
          </CardContent>
        </Card>
         <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>Company Announcements</CardTitle>
            <CardDescription>Latest updates from the company.</CardDescription>
          </CardHeader>
          <CardContent>
             <p className="text-muted-foreground">No announcements at this time.</p>
            {/* Placeholder for announcements */}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
