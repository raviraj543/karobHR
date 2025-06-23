
'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CheckSquare, DollarSign, UserCircle, Megaphone, CalendarDays, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { useEffect, useMemo } from 'react';
import { format, startOfMonth, getDaysInMonth, isSameDay, parseISO } from 'date-fns';

export default function EmployeeDashboardPage() {
  const { user, announcements, attendanceLog, tasks, loading: authLoading, companySettings } = useAuth(); 

  useEffect(() => {
    document.title = user?.name ? `${user.name}'s Dashboard - KarobHR` : 'Dashboard - KarobHR';
  }, [user?.name]);

  const dashboardStats = useMemo(() => {
    if (!user || !attendanceLog || !tasks) {
      return {
        attendance: 'N/A',
        pendingTasks: 'N/A',
        leaveBalance: 'N/A',
        nextPayslip: 'N/A',
        todaysEarnings: 0,
      };
    }

    // Today's Earnings Calculation
    const today = new Date();
    const todaysAttendance = attendanceLog.find(e => isSameDay(parseISO(e.timestamp), today) && e.status === 'Checked In');
    let todaysEarnings = 0;

    if (todaysAttendance && user.baseSalary) {
      if (companySettings?.salaryCalculationMode === 'check_in_out') {
        todaysEarnings = user.baseSalary / 30;
      } else {
        const checkInTime = parseISO(todaysAttendance.checkInTime as string);
        const now = new Date();
        const hoursWorkedToday = (now.getTime() - checkInTime.getTime()) / (1000 * 60 * 60);

        const monthStartDate = startOfMonth(today);
        const allDaysInMonth = eachDayOfInterval({ start: monthStartDate, end: endOfMonth(today) });
        const sundaysInMonth = allDaysInMonth.filter(isSunday);
        // This should be updated to get holidays from context
        const approvedHolidayDates = new Set();
        const workingDaysInMonth = allDaysInMonth.length - sundaysInMonth.length - approvedHolidayDates.size;
        const totalStandardHoursForMonth = workingDaysInMonth * (user.standardDailyHours || 8);
        const perHourRate = user.baseSalary / totalStandardHoursForMonth;
        todaysEarnings = hoursWorkedToday * perHourRate;
      }
    }

    // Attendance Calculation
    const monthStart = startOfMonth(today);
    const totalDaysInMonth = getDaysInMonth(today);
    const uniqueDaysAttended = new Set(
      attendanceLog
        .filter(event => {
          const eventDate = parseISO(event.timestamp);
          return isSameDay(eventDate, today) || (eventDate >= monthStart && eventDate < today);
        })
        .map(event => format(parseISO(event.timestamp), 'yyyy-MM-dd'))
    ).size;
    const attendance = `${uniqueDaysAttended}/${totalDaysInMonth} Days`;

    // Pending Tasks Calculation
    const pendingTasksCount = tasks.filter(task => task.assigneeId === user.employeeId && task.status !== 'Completed').length;
    const pendingTasks = `${pendingTasksCount} Tasks`;

    // Leave Balance (assuming a standard entitlement for now)
    const annualLeaveEntitlement = 20; // This can be made configurable later
    const leavesTaken = user.leaves?.filter(l => l.status === 'approved').length || 0;
    const leaveBalance = `${annualLeaveEntitlement - leavesTaken} Days`;
    
    // Next Payslip Calculation
    const nextPayslipDate = format(today, 'MMMM do, yyyy');

    return {
      attendance,
      pendingTasks,
      leaveBalance,
      nextPayslip: nextPayslipDate,
      todaysEarnings,
    };
  }, [user, attendanceLog, tasks, companySettings]);
  
  if (authLoading || !user) {
    return (
        <div className="flex items-center justify-center h-full py-10">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="ml-2 text-muted-foreground">Loading Your Dashboard...</p>
        </div>
    );
  }

  const employeeName = user.name || "Employee";
  const quickStats = [
    { title: "Attendance This Month", value: dashboardStats.attendance, icon: CalendarDays, link: "/attendance" },
    { title: "Pending Tasks", value: dashboardStats.pendingTasks, icon: CheckSquare, link: "/tasks" },
    { title: "Leave Balance", value: dashboardStats.leaveBalance, icon: UserCircle, link: "/leave" },
    { title: "Next Payslip", value: dashboardStats.nextPayslip, icon: DollarSign, link: "/payroll" },
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
      
      <Card>
        <CardHeader>
          <CardTitle>Today's Estimated Earnings</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold">₹{dashboardStats.todaysEarnings.toFixed(2)}</p>
          <p className="text-xs text-muted-foreground">Based on hours worked today and monthly salary.</p>
        </CardContent>
      </Card>

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
    
