
'use client';

import { useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { useAuth } from '@/hooks/useAuth';

export default function AttendancePage() {
  const { user } = useAuth();

  useEffect(() => {
    document.title = `${user?.name ? user.name + ' - ' : ''}My Attendance - BizFlow`;
  }, [user?.name]);

  console.log(">>> KAROBHR TRACE: AttendancePage RENDER - Page has been reset to initial state.");

  return (
    <div className="space-y-6">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center text-2xl">
            My Attendance
          </CardTitle>
          <CardDescription>
            This page has been reset. Check-in and Check-out functionality will be implemented here.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            The attendance interface has been cleared.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
