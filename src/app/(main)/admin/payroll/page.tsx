
'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import type { User, Advance, MonthlyPayrollReport, Holiday, LeaveApplication } from '@/lib/app-types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { IndianRupee, CheckCircle, XCircle, ListFilter, UserCog, AlertTriangle, Percent, Loader2, CalendarClock, CalendarDays } from 'lucide-react';
import { getMonth, getYear, startOfMonth, endOfMonth } from 'date-fns';
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase/firebase';

export default function AdminPayrollPage() {
  const { allUsers, holidays, loading: authLoading, attendanceLog, calculateMonthlyPayrollDetails, approveAdvance, rejectAdvance, companySettings, companyId, advanceRequests } = useAuth();
  const [isProcessingAdvance, setIsProcessingAdvance] = useState(false);
  const { toast } = useToast();
  const [payrollData, setPayrollData] = useState<MonthlyPayrollReport[]>([]);
  const [isCalculatingPayroll, setIsCalculatingPayroll] = useState(true);

  useEffect(() => {
    document.title = 'Manage Payroll - Admin - KarobHR';
  }, []);

  const currentMonth = getMonth(new Date());
  const currentYear = getYear(new Date());

  useEffect(() => {
    const calculateAllPayrolls = async () => {
        if (authLoading || !companyId || allUsers.length === 0) {
            if(!authLoading) setIsCalculatingPayroll(false);
            return;
        };

        setIsCalculatingPayroll(true);

        try {
            const start = startOfMonth(new Date(currentYear, currentMonth));
            const end = endOfMonth(new Date(currentYear, currentMonth));

            // 1. Fetch all company-wide leaves and advances for the month in two efficient queries
            const leavesQuery = query(
                collection(db, `companies/${companyId}/leaveApplications`),
                where('status', '==', 'approved'),
                where('startDate', '>=', Timestamp.fromDate(start)),
                where('startDate', '<=', Timestamp.fromDate(end))
            );
            // Fetch ALL approved advances, not just from the current month
            const advancesQuery = query(
                collection(db, `companies/${companyId}/advances`),
                where('status', '==', 'approved')
            );

            const [leavesSnapshot, advancesSnapshot] = await Promise.all([
                getDocs(leavesQuery),
                getDocs(advancesQuery)
            ]);

            const allApprovedLeaves = leavesSnapshot.docs.map(doc => doc.data() as LeaveApplication);
            const allApprovedAdvances = advancesSnapshot.docs.map(doc => doc.data() as Advance);
            
            // 2. Map over users and calculate payroll using the pre-fetched data
            const nonAdminUsers = allUsers.filter(u => u.role !== 'admin');
            const reports = nonAdminUsers.map(user => {
                const userAttendanceForMonth = attendanceLog.filter(log => log.employeeId === user.employeeId);
                const userApprovedLeaves = allApprovedLeaves.filter(l => l.employeeId === user.employeeId);
                const userApprovedAdvances = allApprovedAdvances.filter(a => a.employeeId === user.employeeId);
                
                return calculateMonthlyPayrollDetails(user, currentYear, currentMonth, userAttendanceForMonth, holidays, userApprovedLeaves, userApprovedAdvances);
            });

            setPayrollData(reports);
        } catch (error) {
            console.error("Error calculating payroll:", error);
            toast({ title: "Payroll Calculation Failed", description: "Could not fetch all necessary data to calculate payroll.", variant: "destructive"});
        } finally {
            setIsCalculatingPayroll(false);
        }
    };
    
    calculateAllPayrolls();

  }, [allUsers, authLoading, calculateMonthlyPayrollDetails, attendanceLog, holidays, currentMonth, currentYear, companyId, advanceRequests]);


  const pendingAdvances = useMemo(() => {
    return advanceRequests.filter(adv => adv.status === 'pending').map(advance => {
        const user = allUsers.find(u => u.employeeId === advance.employeeId);
        return {
            ...advance, 
            userName: user?.name || advance.employeeId, 
        }
    });
  }, [advanceRequests, allUsers]);

  const handleProcessAdvance = async (advanceId: string, newStatus: 'approved' | 'rejected') => {
    setIsProcessingAdvance(true);
    try {
      if (newStatus === 'approved') {
        await approveAdvance(advanceId);
      } else {
        await rejectAdvance(advanceId);
      }
      toast({
        title: `Advance ${newStatus}`,
        description: `The advance request has been ${newStatus}. Payroll data will refresh automatically.`,
      });
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

  const salaryMode = companySettings?.salaryCalculationMode || 'hourly_deduction';

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Payroll Management</h1>
          <p className="text-muted-foreground">Oversee employee salaries for {new Date(currentYear, currentMonth).toLocaleString('default', { month: 'long', year: 'numeric' })}.</p>
        </div>
      </div>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center"><IndianRupee className="mr-2 h-5 w-5 text-primary" />Employee Salary Overview</CardTitle>
          <CardDescription>
            Summary of employee salaries, including deductions and approved advances.
            <span className="block text-xs text-muted-foreground/80 italic mt-1">
              Calculation Mode: <Badge variant="secondary">{salaryMode === 'hourly_deduction' ? 'Hourly Deduction' : 'Check-in/Checkout Based'}</Badge>
            </span>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Base Salary</TableHead>
                {salaryMode === 'hourly_deduction' ? (
                    <>
                        <TableHead><CalendarClock className="inline-block mr-1 h-3 w-3"/>Std. Hours</TableHead>
                        <TableHead><CalendarClock className="inline-block mr-1 h-3 w-3"/>Actual Hours</TableHead>
                    </>
                ) : (
                    <>
                        <TableHead><CalendarDays className="inline-block mr-1 h-3 w-3"/>Work Days</TableHead>
                        <TableHead><CalendarDays className="inline-block mr-1 h-3 w-3"/>Total Days</TableHead>
                    </>
                )}
                <TableHead>Deductions</TableHead>
                <TableHead>Advances</TableHead>
                <TableHead>Net Payable</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payrollData.length > 0 ? payrollData.map(report => (
                  <TableRow key={report.employeeId}>
                    <TableCell>
                        <div className="font-medium">{report.employeeName}</div>
                        <div className="font-mono text-xs text-muted-foreground">{report.employeeId}</div>
                    </TableCell>
                    <TableCell>₹{report.baseSalary.toLocaleString('en-IN')}</TableCell>
                    {salaryMode === 'hourly_deduction' ? (
                        <>
                            <TableCell>{report.totalStandardHoursForMonth.toFixed(1)}h</TableCell>
                            <TableCell className={report.totalActualHoursWorked < report.totalStandardHoursForMonth ? 'text-orange-600' : 'text-green-600'}>
                                {report.totalActualHoursWorked.toFixed(1)}h
                            </TableCell>
                        </>
                    ) : (
                        <>
                            <TableCell>{report.totalDaysWorked}</TableCell>
                            <TableCell>{report.totalDaysInMonth}</TableCell>
                        </>
                    )}
                    <TableCell className={report.calculatedDeductions > 0 ? 'text-destructive' : ''}>
                        ₹{report.calculatedDeductions.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                    </TableCell>
                    <TableCell className="text-red-600">
                      -₹{report.totalApprovedAdvances.toLocaleString('en-IN')}
                    </TableCell>
                    <TableCell className="font-semibold">₹{report.finalNetPayable.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</TableCell>
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
              {pendingAdvances.length > 0 ? (
                pendingAdvances.map(advance => (
                  <TableRow key={advance.id}>
                    <TableCell className="font-medium">{advance.userName}</TableCell>
                    <TableCell>₹{advance.amount.toLocaleString('en-IN')}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{advance.reason}</TableCell>
                    <TableCell>{new Date(advance.dateRequested).toLocaleDateString()}</TableCell>
                    <TableCell className="space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleProcessAdvance(advance.id, 'approved')}
                        disabled={isProcessingAdvance}
                        className="text-green-600 border-green-600 hover:bg-green-50 hover:text-green-700"
                      >
                        {isProcessingAdvance && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
                        Approve
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleProcessAdvance(advance.id, 'rejected')}
                        disabled={isProcessingAdvance}
                        className="text-red-600 border-red-600 hover:bg-red-50 hover:text-red-700"
                      >
                         {isProcessingAdvance && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
                        Reject
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8">No pending advance requests.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
