import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CalendarPlus, History, BarChartHorizontalBig } from 'lucide-react';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Leave Management - BizFlow',
  description: 'Apply for leave and track your leave balance.',
};

export default function LeavePage() {
  // Placeholder data
  const leaveBalance = {
    casual: 5,
    sick: 8,
    annual: 12,
  };
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
          <CardTitle className="flex items-center"><BarChartHorizontalBig className="mr-2 h-5 w-5 text-primary" />Leave Balance</CardTitle>
          <CardDescription>Your current available leave days.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {Object.entries(leaveBalance).map(([type, days]) => (
            <div key={type} className="p-4 bg-muted/30 rounded-lg text-center shadow">
              <p className="text-sm font-medium capitalize text-muted-foreground">{type} Leave</p>
              <p className="text-3xl font-bold text-primary">{days}</p>
              <p className="text-xs text-muted-foreground">days remaining</p>
            </div>
          ))}
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
