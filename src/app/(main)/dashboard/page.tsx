
'use client'; // Required for useAuth hook

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CheckSquare, DollarSign, UserCircle, Megaphone, FileText, LogOut } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth'; // Import useAuth
import { useEffect } from 'react';

export default function EmployeeDashboardPage() {
  const { user, announcements } = useAuth(); 

  useEffect(() => {
    document.title = user?.name ? `${user.name}'s Dashboard - KarobHR` : 'Dashboard - KarobHR';
  }, [user?.name]);


  const employeeName = user?.name || "Employee";
  const quickStats = [
    { title: "Attendance This Month", value: "20/22 Days", icon: CheckSquare, link: "/attendance" }, // Mock
    { title: "Pending Tasks", value: "3 Tasks", icon: CheckSquare, link: "/tasks" }, // Mock
    { title: "Leave Balance", value: "10 Days", icon: UserCircle, link: "/leave" }, // Mock
    { title: "Next Payslip", value: "Oct 30, 2023", icon: DollarSign, link: "/payroll" }, // Mock
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

      <Card className="w-full shadow-sm">
        <CardHeader>
          <CardTitle className="text-2xl font-semibold flex items-center">
            <FileText className="mr-3 h-6 w-6 text-primary" />
            Daily Task Report & Checkout
          </CardTitle>
          <CardDescription>
            Submit your daily task report and complete your checkout process on the My Attendance page.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground mb-4">
            When you're ready to end your workday, head over to the "My Attendance" page. You'll be able to list your completed tasks and then check out with geofencing.
          </p>
          <Button asChild size="lg">
            <Link href="/attendance">
              <LogOut className="mr-2 h-5 w-5" /> Go to My Attendance (Report & Checkout)
            </Link>
          </Button>
        </CardContent>
      </Card>


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
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center"><Megaphone className="mr-2 h-5 w-5 text-primary" />Company Announcements</CardTitle>
              <CardDescription>Latest updates from the company.</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            {announcements && announcements.length > 0 ? (
              <ScrollArea className="h-64 border rounded-md p-4 bg-background"> 
                <ul className="space-y-4">
                  {announcements.slice(0, 5).map((ann) => ( 
                    <li key={ann.id} className="p-3 border-l-4 border-primary bg-primary/5 rounded-r-md shadow-sm">
                      <h4 className="font-semibold text-foreground">{ann.title}</h4>
                      <p className="text-xs text-muted-foreground">
                        Posted by {ann.postedByName} on {new Date(ann.postedAt).toLocaleDateString()}
                      </p>
                      <p className="mt-1 text-sm text-foreground whitespace-pre-wrap text-ellipsis overflow-hidden line-clamp-3">
                        {ann.content}
                      </p>
                    </li>
                  ))}
                </ul>
              </ScrollArea>
            ) : (
              <p className="text-muted-foreground text-center py-4">No announcements at this time.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
