
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CalendarPlus, History, BarChartHorizontalBig, Info } from 'lucide-react';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Leave Management - BizFlow',
  description: 'Apply for leave and track your leave balance.',
};

export default function LeavePage() {
  // Placeholder data - in a real app, this would come from user data and admin settings
  const configuredMonthlyAllowance = 4; // Example: As set by admin
  const configuredYearlyAllowance = 48; // Example: As set by admin
  const currentLeaveBalanceMock = 10; // Example: Employee's actual remaining balance

  const recentApplications = [
    { id: '1', type: 'Casual Leave', dates: 'Oct 20 - Oct 22, 2023', status: 'Approved', color: 'text-green-500' },
    { id: '2', type: 'Sick Leave', dates: 'Nov 05, 2023', status: 'Pending', color: 'text-yellow-500' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Leave Management</h1>
          <p className="text-muted-foreground">Apply for leave and view your history.</p>
        </div>
        <Button>
          <CalendarPlus className="mr-2 h-4 w-4" /> Apply for Leave
        </Button>
      </div>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center"><BarChartHorizontalBig className="mr-2 h-5 w-5 text-primary" />Leave Balance Overview</CardTitle>
          <CardDescription>Your current leave allowances and balance.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="p-4 bg-muted/30 rounded-lg shadow space-y-2">
            <h3 className="text-md font-semibold text-foreground">Configured Allowances</h3>
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">Default Monthly Allowance:</span>
              <span className="font-medium text-primary">{configuredMonthlyAllowance} days</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">Default Yearly Allowance:</span>
              <span className="font-medium text-primary">{configuredYearlyAllowance} days</span>
            </div>
            <p className="text-xs text-muted-foreground/80 italic pt-1">
              <Info className="inline-block mr-1 h-3 w-3" /> These are the default allowances set by the company admin. Your actual accrual might vary.
            </p>
          </div>
           <div className="p-4 bg-primary/10 rounded-lg shadow text-center">
              <p className="text-sm font-medium capitalize text-muted-foreground">Your Remaining Leave (Mock)</p>
              <p className="text-4xl font-bold text-primary">{currentLeaveBalanceMock}</p>
              <p className="text-xs text-muted-foreground">days available</p>
            </div>
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center"><History className="mr-2 h-5 w-5 text-primary" />Recent Applications</CardTitle>
          <CardDescription>Status of your recent leave requests.</CardDescription>
        </CardHeader>
        <CardContent>
          {recentApplications.length > 0 ? (
            <ul className="space-y-3">
              {recentApplications.map(app => (
                <li key={app.id} className="flex justify-between items-center p-3 bg-muted/30 rounded-md shadow-sm">
                  <div>
                    <p className="font-semibold">{app.type}</p>
                    <p className="text-sm text-muted-foreground">{app.dates}</p>
                  </div>
                  <span className={`text-sm font-medium px-2 py-1 rounded-full ${app.color} bg-opacity-10`}>{app.status}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground text-center py-4">No recent leave applications.</p>
          )}
        </CardContent>
      </Card>
      
       <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>Company Holiday Calendar</CardTitle>
          <CardDescription>Upcoming company holidays for this year.</CardDescription>
        </CardHeader>
        <CardContent>
          {/* Placeholder for holiday calendar view */}
          <div className="h-64 bg-muted rounded-md flex items-center justify-center" data-ai-hint="calendar schedule">
             <p className="text-muted-foreground">Holiday calendar will be displayed here.</p>
          </div>
        </CardContent>
      </Card>

    </div>
  );
}
