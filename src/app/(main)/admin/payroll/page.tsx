
'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import type { User, Advance, MonthlyPayrollReport } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { IndianRupee, CheckCircle, XCircle, ListFilter, UserCog, AlertTriangle, Percent, Loader2, CalendarClock } from 'lucide-react';
import { getMonth, getYear } from 'date-fns';

export default function AdminPayrollPage() {
  const { allUsers, processAdvance, loading: authLoading, attendanceLog, calculateMonthlyPayrollDetails } = useAuth();
  const [isProcessingAdvance, setIsProcessingAdvance] = useState(false);
  const { toast } = useToast();
  const [payrollData, setPayrollData] = useState<MonthlyPayrollReport[]>([]);
  const [isCalculatingPayroll, setIsCalculatingPayroll] = useState(true);

  useEffect(() => {
    document.title = 'Manage Payroll - Admin - KarobHR';
  }, []);

  const currentMonth = getMonth(new Date()); // 0-11
  const currentYear = getYear(new Date());

  useEffect(() => {
    if (!authLoading && allUsers.length > 0 && calculateMonthlyPayrollDetails && attendanceLog) {
      setIsCalculatingPayroll(true);
      const nonAdminUsers = allUsers.filter(u => u.role !== 'admin');
      const reports = nonAdminUsers.map(user => {
        // Filter attendance logs for the current user for the current month
        // This is a simplification; for many users, batching or more optimized fetching might be needed
        const userAttendanceForMonth = attendanceLog.filter(
          log => log.employeeId === user.employeeId
        );
        // TODO: Add holiday data if available and integrate into calculateMonthlyPayrollDetails
        return calculateMonthlyPayrollDetails(user, currentYear, currentMonth, userAttendanceForMonth, []);
      });
      setPayrollData(reports);
      setIsCalculatingPayroll(false);
    } else if (!authLoading && allUsers.length === 0) {
      setIsCalculatingPayroll(false);
      setPayrollData([]);
    }
  }, [allUsers, authLoading, calculateMonthlyPayrollDetails, attendanceLog, currentMonth, currentYear]);


  const pendingAdvances = useMemo(() => {
    if (authLoading) return [];
    return allUsers.flatMap(user =>
      (user.advances || []).filter(adv => adv.status === 'pending').map(adv => ({ ...adv, userName: user.name || user.employeeId, userUid: user.id }))
    );
  }, [allUsers, authLoading]);

  const handleProcessAdvance = async (employeeUid: string, advanceId: string, newStatus: 'approved' | 'rejected') => {
    setIsProcessingAdvance(true);
    try {
      await processAdvance(employeeUid, advanceId, newStatus);
      toast({
        title: `Advance ${newStatus}`,
        description: `The advance request has been ${newStatus}. Payroll data will refresh.`,
      });
      // Trigger re-calculation of payroll data as advances affect net payable
      if (calculateMonthlyPayrollDetails && attendanceLog) {
          const nonAdminUsers = allUsers.filter(u => u.role !== 'admin');
          const reports = nonAdminUsers.map(user => {
            const userAttendanceForMonth = attendanceLog.filter(log => log.employeeId === user.employeeId);
            return calculateMonthlyPayrollDetails(user, currentYear, currentMonth, userAttendanceForMonth, []);
          });
          setPayrollData(reports);
      }

    } catch (error) {
      console.error(`Error processing advance:`, error);
      toast({
        title: 'Error Processing Advance',
        description: (error as Error).message || 'Could not process the advance request.',
        variant: 'destructive',
      });
    } finally {
      setIsProcessingAdvance(false);
    }
  };


  if (authLoading || isCalculatingPayroll) {
    return (
        <div className="flex flex-col items-center justify-center h-full py-10 space-y-2">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-muted-foreground">
                {authLoading ? "Loading user data..." : "Calculating payroll for current month..."}
            </p>
        </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Payroll Management</h1>
          <p className="text-muted-foreground">Oversee employee salaries for the current month ({new Date(currentYear, currentMonth).toLocaleString('default', { month: 'long', year: 'numeric' })}) and process advance requests.</p>
        </div>
        {/* <Button variant="outline"><ListFilter className="mr-2 h-4 w-4" /> Filter Period (Mock)</Button> */}
      </div>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center"><IndianRupee className="mr-2 h-5 w-5 text-primary" />Employee Salary Overview (Current Month)</CardTitle>
          <CardDescription>
            Summary of employee salaries, including deductions for missed hours and approved advances.
            <span className="block text-xs text-muted-foreground/80 italic mt-1">
              Calculations based on attendance data for {new Date(currentYear, currentMonth).toLocaleString('default', { month: 'long', year: 'numeric' })}. Sundays are excluded from standard work hours.
            </span>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee Name</TableHead>
                <TableHead><UserCog className="inline-block mr-1 h-4 w-4"/>ID</TableHead>
                <TableHead>Base Salary</TableHead>
                <TableHead><CalendarClock className="inline-block mr-1 h-3 w-3"/>Std. Hours (Month)</TableHead>
                <TableHead><CalendarClock className="inline-block mr-1 h-3 w-3"/>Actual Hours (Month)</TableHead>
                <TableHead>Deductions</TableHead>
                <TableHead>Advances</TableHead>
                <TableHead>Net Payable</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payrollData.length > 0 ? payrollData.map(report => (
                  <TableRow key={report.employeeId}>
                    <TableCell className="font-medium">{report.employeeName}</TableCell>
                    <TableCell className="font-mono text-xs">{report.employeeId}</TableCell>
                    <TableCell>₹{report.baseSalary.toLocaleString('en-IN')}</TableCell>
                    <TableCell>{report.totalStandardHoursForMonth.toFixed(1)}h</TableCell>
                    <TableCell className={report.totalActualHoursWorked < report.totalStandardHoursForMonth ? 'text-orange-600' : 'text-green-600'}>
                        {report.totalActualHoursWorked.toFixed(1)}h
                    </TableCell>
                    <TableCell className={report.calculatedDeductions > 0 ? 'text-destructive' : ''}>
                        ₹{report.calculatedDeductions.toLocaleString('en-IN')}
                    </TableCell>
                    <TableCell className="text-red-600">
                      (₹{report.totalApprovedAdvances.toLocaleString('en-IN')})
                    </TableCell>
                    <TableCell className="font-semibold">₹{report.finalNetPayable.toLocaleString('en-IN')}</TableCell>
                  </TableRow>
                )) : (
                 <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-8">No employee data available to calculate payroll.</TableCell>
                 </TableRow>
                )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center"><AlertTriangle className="mr-2 h-5 w-5 text-primary" />Pending Advance Requests</CardTitle>
          <CardDescription>Review and process outstanding advance requests from employees.</CardDescription>
        </CardHeader>
        <CardContent>
          {pendingAdvances.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee Name</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Date Requested</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingAdvances.map(advance => (
                  <TableRow key={advance.id}>
                    <TableCell className="font-medium">{advance.userName}</TableCell>
                    <TableCell>₹{advance.amount.toLocaleString('en-IN')}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{advance.reason}</TableCell>
                    <TableCell>{new Date(advance.dateRequested).toLocaleDateString()}</TableCell>
                    <TableCell className="space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleProcessAdvance(advance.userUid, advance.id, 'approved')}
                        disabled={isProcessingAdvance}
                        className="text-green-600 border-green-600 hover:bg-green-50 hover:text-green-700"
                      >
                        {isProcessingAdvance && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
                        <CheckCircle className="mr-1 h-4 w-4" /> Approve
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleProcessAdvance(advance.userUid, advance.id, 'rejected')}
                        disabled={isProcessingAdvance}
                        className="text-red-600 border-red-600 hover:bg-red-50 hover:text-red-700"
                      >
                         {isProcessingAdvance && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
                        <XCircle className="mr-1 h-4 w-4" /> Reject
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-muted-foreground text-center py-8">No pending advance requests.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
