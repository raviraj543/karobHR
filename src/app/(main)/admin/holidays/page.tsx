
'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar } from '@/components/ui/calendar';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PlusCircle, Edit2, Trash2, CalendarDays as CalendarDaysIcon, CheckCircle, Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import type { Holiday } from '@/lib/types';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';

export default function AdminHolidaysPage() {
  const { companySettings, updateHolidayStatus, loading: authLoading } = useAuth();
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const { toast } = useToast();
  
  // This would ideally come from your AuthContext or a separate data fetching hook
  // For now, we'll simulate fetching them.
  useEffect(() => {
    document.title = 'Manage Holidays - Admin - KarobHR';
    // In a real app, you would fetch this data from your backend/context
    // For demonstration, we'll use a simulated fetch from a placeholder array
    const companyHolidays = (companySettings as any)?.holidays || [];
    setHolidays(companyHolidays);
  }, [companySettings]);

  const handleApproveHoliday = async (holidayId: string) => {
    try {
      await updateHolidayStatus(holidayId, 'approved');
      toast({
        title: 'Holiday Approved',
        description: 'The selected holiday has been approved for payroll.',
      });
    } catch (error) {
      toast({
        title: 'Error Approving Holiday',
        description: (error as Error).message,
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Holiday Management</h1>
          <p className="text-muted-foreground">Define and manage the company holiday calendar.</p>
        </div>
        <Button>
          <PlusCircle className="mr-2 h-4 w-4" /> Add New Holiday
        </Button>
      </div>

      <div className="grid grid-cols-1">
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center"><CalendarDaysIcon className="mr-2 h-5 w-5 text-primary" />Upcoming Holidays</CardTitle>
            <CardDescription>List of scheduled holidays. Approve them to include them as paid days in payroll.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Holiday Name</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {holidays.map(holiday => (
                  <TableRow key={holiday.id}>
                    <TableCell className="font-medium">{holiday.name}</TableCell>
                    <TableCell>{format(new Date(holiday.date), 'PPP')}</TableCell>
                    <TableCell>
                      <Badge variant={holiday.status === 'approved' ? 'default' : 'secondary'}>
                        {holiday.status.charAt(0).toUpperCase() + holiday.status.slice(1)}
                      </Badge>
                    </TableCell>
                    <TableCell className="space-x-1">
                      {holiday.status === 'scheduled' && (
                        <Button variant="outline" size="sm" onClick={() => handleApproveHoliday(holiday.id)} disabled={authLoading}>
                          <CheckCircle className="mr-2 h-4 w-4" />
                          Approve for Pay
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" className="h-8 w-8"><Edit2 className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive"><Trash2 className="h-4 w-4" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {holidays.length === 0 && !authLoading && (
              <p className="text-muted-foreground text-center py-8">No holidays defined yet.</p>
            )}
            {authLoading && (
                <div className="flex justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
