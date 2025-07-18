
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
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase/firebase';
import { Separator } from '@/components/ui/separator';

export default function EmployeePayrollPage() {
  const { 
      karobUser, 
      holidays, 
      loading: authLoading, 
      attendanceLog, 
      calculateMonthlyPayrollDetails, 
      companySettings, 
      companyId,
      leaveRequests,
      advanceRequests
  } = useAuth();
  const { toast } = useToast();
  const [payrollData, setPayrollData] = useState<MonthlyPayrollReport | null>(null);
  const [isCalculatingPayroll, setIsCalculatingPayroll] = useState(true);

  useEffect(() => {
    document.title = 'My Payslip - KarobHR';
  }, []);

  const currentMonth = getMonth(new Date()); // 0-11
  const currentYear = getYear(new Date());

  useEffect(() => {
    const calculatePayroll = () => {
        if (!authLoading && karobUser && calculateMonthlyPayrollDetails && attendanceLog) {
            setIsCalculatingPayroll(true);

            const approvedLeaves = leaveRequests.filter(l => l.status === 'approved');
            const approvedAdvances = advanceRequests.filter(a => a.status === 'approved');
            
            const report = calculateMonthlyPayrollDetails(karobUser, currentYear, currentMonth, attendanceLog, holidays, approvedLeaves, approvedAdvances);
            
            setPayrollData(report);
            setIsCalculatingPayroll(false);
        } else if (!authLoading && !karobUser) {
            setIsCalculatingPayroll(false);
            setPayrollData(null);
        }
    };
    
    calculatePayroll();

  }, [karobUser, authLoading, calculateMonthlyPayrollDetails, attendanceLog, holidays, currentMonth, currentYear, companyId, leaveRequests, advanceRequests]);

  if (authLoading || isCalculatingPayroll) {
    return (
        <div className="flex flex-col items-center justify-center h-full py-10 space-y-2">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-muted-foreground">
                {authLoading ? "Loading your data..." : "Generating your payslip for the current month..."}
            </p>
        </div>
    );
  }
  
  if(!payrollData){
      return (
          <div className="text-center py-10">
              <p className="text-lg text-muted-foreground">Could not generate your payslip at this time.</p>
          </div>
      )
  }

  const salaryMode = companySettings?.salaryCalculationMode || 'hourly_deduction';

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">My Payslip</h1>
          <p className="text-muted-foreground">Your detailed payslip for {new Date(currentYear, currentMonth).toLocaleString('default', { month: 'long', year: 'numeric' })}.</p>
        </div>
      </div>

      <Card className="shadow-lg">
        <CardHeader className="bg-muted/50">
          <CardTitle className="flex items-center text-2xl"><IndianRupee className="mr-2 h-6 w-6 text-primary" />Payslip Summary</CardTitle>
          <CardDescription>
            Calculation Mode: <Badge variant="secondary">{salaryMode === 'hourly_deduction' ? 'Hourly Deduction' : 'Check-in/Checkout Based'}</Badge>
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Earnings Section */}
                <div className="space-y-4">
                    <h3 className="font-semibold text-lg border-b pb-2">Earnings</h3>
                    <div className="flex justify-between">
                        <span>Base Salary</span>
                        <span>₹{payrollData.baseSalary.toLocaleString('en-IN')}</span>
                    </div>
                    {salaryMode === 'hourly_deduction' ? (
                       <div className="flex justify-between text-sm text-muted-foreground">
                            <span>Hours Worked ({payrollData.totalActualHoursWorked.toFixed(1)} / {payrollData.totalStandardHoursForMonth.toFixed(1)}h)</span>
                            <span>+ ₹{(payrollData.salaryAfterDeductions + payrollData.calculatedDeductions).toLocaleString('en-IN')}</span>
                        </div>
                    ):(
                        <div className="flex justify-between text-sm text-muted-foreground">
                             <span>Days Worked ({payrollData.totalDaysWorked} / {payrollData.totalDaysInMonth} days)</span>
                             <span>+ ₹{(payrollData.salaryAfterDeductions + payrollData.calculatedDeductions).toLocaleString('en-IN')}</span>
                        </div>
                    )}
                     <Separator />
                     <div className="flex justify-between font-semibold">
                        <span>Gross Earnings</span>
                        <span>₹{(payrollData.salaryAfterDeductions + payrollData.calculatedDeductions).toLocaleString('en-IN')}</span>
                    </div>
                </div>

                 {/* Deductions Section */}
                 <div className="space-y-4">
                    <h3 className="font-semibold text-lg border-b pb-2">Deductions</h3>
                    <div className="flex justify-between text-destructive">
                        <span>Absence/Shortfall</span>
                        <span>-₹{payrollData.calculatedDeductions.toLocaleString('en-IN')}</span>
                    </div>
                     <div className="flex justify-between text-destructive">
                        <span>Approved Advances</span>
                        <span>-₹{payrollData.totalApprovedAdvances.toLocaleString('en-IN')}</span>
                    </div>
                    <Separator />
                     <div className="flex justify-between font-semibold text-destructive">
                        <span>Total Deductions</span>
                        <span>-₹{(payrollData.calculatedDeductions + payrollData.totalApprovedAdvances).toLocaleString('en-IN')}</span>
                    </div>
                </div>
            </div>
             <Separator className="my-6" />
             <div className="flex justify-between items-center bg-green-100 dark:bg-green-900/30 p-4 rounded-lg">
                <h3 className="font-bold text-xl text-green-800 dark:text-green-200">Net Payable Salary</h3>
                <p className="font-bold text-2xl text-green-800 dark:text-green-200">₹{payrollData.finalNetPayable.toLocaleString('en-IN')}</p>
             </div>
        </CardContent>
      </Card>
    </div>
  );
}
