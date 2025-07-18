
'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import type { User, Advance, MonthlyPayrollReport, Holiday, LeaveApplication } from '@/lib/app-types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { IndianRupee, HandCoins, Loader2, CalendarClock, CalendarDays } from 'lucide-react';
import { getMonth, getYear, format } from 'date-fns';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

const advanceRequestSchema = z.object({
    amount: z.preprocess(
      (val) => Number(String(val)),
      z.number().positive({ message: 'Amount must be a positive number.' })
    ),
    reason: z.string().min(10, "Reason must be at least 10 characters.").max(200, "Reason must not exceed 200 characters."),
});

type AdvanceRequestFormValues = z.infer<typeof advanceRequestSchema>;

export default function EmployeePayrollPage() {
  const { 
      karobUser, 
      holidays, 
      loading: authLoading, 
      attendanceLog, 
      calculateMonthlyPayrollDetails, 
      companySettings, 
      leaveRequests,
      advanceRequests,
      requestAdvance
  } = useAuth();
  const { toast } = useToast();
  const [payrollData, setPayrollData] = useState<MonthlyPayrollReport | null>(null);
  const [isCalculatingPayroll, setIsCalculatingPayroll] = useState(true);
  const [isAdvanceDialogOpen, setIsAdvanceDialogOpen] = useState(false);

  const form = useForm<AdvanceRequestFormValues>({
    resolver: zodResolver(advanceRequestSchema),
    defaultValues: {
      amount: undefined,
      reason: '',
    },
  });


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

  }, [karobUser, authLoading, calculateMonthlyPayrollDetails, attendanceLog, holidays, currentMonth, currentYear, leaveRequests, advanceRequests]);

  const onAdvanceRequestSubmit = async (data: AdvanceRequestFormValues) => {
    if (!karobUser) {
      toast({ title: "Error", description: "You must be logged in to request an advance.", variant: "destructive" });
      return;
    }
    try {
      await requestAdvance(karobUser.employeeId, data.amount, data.reason);
      toast({
        title: 'Advance Request Submitted',
        description: 'Your request for a salary advance is now pending approval.',
      });
      setIsAdvanceDialogOpen(false);
      form.reset();
    } catch (error) {
      toast({
        title: "Error Submitting Request",
        description: (error as Error).message,
        variant: "destructive",
      });
    }
  };

  const getStatusBadgeVariant = (status: Advance['status']) => {
    switch (status) {
        case 'approved': return 'default';
        case 'rejected': return 'destructive';
        case 'pending': return 'secondary';
        default: return 'outline';
    }
  }

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
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">My Payslip</h1>
        <p className="text-muted-foreground">Your detailed payslip for {new Date(currentYear, currentMonth).toLocaleString('default', { month: 'long', year: 'numeric' })}.</p>
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

      <Card>
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle className="flex items-center"><HandCoins className="mr-2 h-5 w-5 text-primary" />Salary Advance</CardTitle>
              <CardDescription>Request a salary advance or view your request history.</CardDescription>
            </div>
            <Dialog open={isAdvanceDialogOpen} onOpenChange={setIsAdvanceDialogOpen}>
              <DialogTrigger asChild>
                <Button>Request Advance</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Request a Salary Advance</DialogTitle>
                  <DialogDescription>
                    Your request will be sent to the admin for approval. Approved advances will be deducted from your next salary.
                  </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onAdvanceRequestSubmit)} className="space-y-4 py-4">
                    <FormField
                      control={form.control}
                      name="amount"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Amount (₹)</FormLabel>
                          <FormControl>
                            <Input type="number" placeholder="e.g., 5000" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="reason"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Reason</FormLabel>
                          <FormControl>
                            <Textarea placeholder="Briefly explain the reason for your advance request..." {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <DialogFooter>
                      <Button type="button" variant="outline" onClick={() => setIsAdvanceDialogOpen(false)}>Cancel</Button>
                      <Button type="submit" disabled={form.formState.isSubmitting}>
                        {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                        Submit Request
                      </Button>
                    </DialogFooter>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          <h4 className="text-sm font-semibold mb-2 text-muted-foreground">Your Advance History</h4>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Amount</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Date Requested</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {advanceRequests.length > 0 ? (
                advanceRequests.map(advance => (
                  <TableRow key={advance.id}>
                    <TableCell>₹{advance.amount.toLocaleString('en-IN')}</TableCell>
                    <TableCell>{advance.reason}</TableCell>
                    <TableCell>{format(new Date(advance.dateRequested), 'PPP')}</TableCell>
                    <TableCell>
                      <Badge variant={getStatusBadgeVariant(advance.status)}>{advance.status}</Badge>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8">No advance requests found.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
