
'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import type { Advance } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { CreditCard, DollarSign, Send, History, Loader2 } from 'lucide-react';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import type { Metadata } from 'next'; // Metadata needs to be handled differently for client components

// export const metadata: Metadata = { // Cannot be used in client components
//   title: 'My Payslip - BizFlow',
//   description: 'View your salary details and manage advance requests.',
// };

const advanceRequestSchema = z.object({
  amount: z.preprocess(
    (val) => Number(String(val).trim()),
    z.number({ invalid_type_error: "Amount must be a number." }).positive({ message: "Amount must be positive." })
  ),
  reason: z.string().min(10, { message: "Reason must be at least 10 characters." }).max(200, { message: "Reason cannot exceed 200 characters."}),
});

type AdvanceRequestFormValues = z.infer<typeof advanceRequestSchema>;

export default function EmployeePayrollPage() {
  const { user, requestAdvance, loading: authLoading } = useAuth();
  const [isSubmittingAdvance, setIsSubmittingAdvance] = useState(false);
  const { toast } = useToast();

  const form = useForm<AdvanceRequestFormValues>({
    resolver: zodResolver(advanceRequestSchema),
    defaultValues: {
      amount: undefined,
      reason: '',
    },
  });
  
  useEffect(() => {
    document.title = 'My Payslip - BizFlow';
  }, []);

  const approvedAdvancesTotal = user?.advances?.filter(adv => adv.status === 'approved').reduce((sum, adv) => sum + adv.amount, 0) || 0;
  const netPayable = (user?.baseSalary || 0) - approvedAdvancesTotal;

  const onSubmitAdvance: SubmitHandler<AdvanceRequestFormValues> = async (data) => {
    if (!user) return;
    setIsSubmittingAdvance(true);
    try {
      await requestAdvance(user.employeeId, data.amount, data.reason);
      toast({
        title: 'Advance Requested',
        description: 'Your advance request has been submitted for approval.',
      });
      form.reset();
    } catch (error) {
      toast({
        title: 'Error Requesting Advance',
        description: (error as Error).message || 'Could not submit your advance request.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmittingAdvance(false);
    }
  };

  const getStatusBadgeVariant = (status: Advance['status']) => {
    switch (status) {
      case 'approved': return 'default'; // typically green or primary
      case 'pending': return 'secondary'; // typically yellow or gray
      case 'rejected': return 'destructive'; // typically red
      default: return 'outline';
    }
  };
  
  if (authLoading || !user) {
    return <div className="text-center py-10">Loading your payslip data...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">My Payslip & Advances</h1>
          <p className="text-muted-foreground">View your salary details and manage advance requests.</p>
        </div>
      </div>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center"><CreditCard className="mr-2 h-5 w-5 text-primary" />Payslip Summary (Mock)</CardTitle>
          <CardDescription>
            Your current salary breakdown. 
            <span className="block text-xs text-muted-foreground/80 italic mt-1">
             Note: This is a simplified mock. Actual earned salary based on attendance is not yet calculated.
            </span>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-muted/30 rounded-lg">
              <Label className="text-sm text-muted-foreground">Base Monthly Salary</Label>
              <p className="text-2xl font-semibold text-foreground">${(user.baseSalary || 0).toLocaleString()}</p>
            </div>
            <div className="p-4 bg-muted/30 rounded-lg">
              <Label className="text-sm text-muted-foreground">Approved Advances (Deductions)</Label>
              <p className="text-2xl font-semibold text-red-600">(${(approvedAdvancesTotal).toLocaleString()})</p>
            </div>
            <div className="p-4 bg-primary/10 rounded-lg">
              <Label className="text-sm text-primary/80">Net Payable Amount</Label>
              <p className="text-2xl font-bold text-primary">${netPayable.toLocaleString()}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center"><DollarSign className="mr-2 h-5 w-5 text-primary" />Request Salary Advance</CardTitle>
            <CardDescription>Need an advance? Fill out the form below.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={form.handleSubmit(onSubmitAdvance)} className="space-y-4">
              <div>
                <Label htmlFor="amount">Amount Requested</Label>
                <Input 
                  id="amount" 
                  type="number" 
                  placeholder="e.g., 500" 
                  {...form.register("amount")}
                  className={form.formState.errors.amount ? "border-destructive" : ""}
                />
                {form.formState.errors.amount && <p className="text-sm text-destructive mt-1">{form.formState.errors.amount.message}</p>}
              </div>
              <div>
                <Label htmlFor="reason">Reason for Advance</Label>
                <Textarea 
                  id="reason" 
                  placeholder="Briefly explain the reason for your request (min. 10 characters)" 
                  rows={3} 
                  {...form.register("reason")}
                  className={form.formState.errors.reason ? "border-destructive" : ""}
                />
                 {form.formState.errors.reason && <p className="text-sm text-destructive mt-1">{form.formState.errors.reason.message}</p>}
              </div>
              <Button type="submit" disabled={isSubmittingAdvance || authLoading} className="w-full sm:w-auto">
                {isSubmittingAdvance ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                Submit Advance Request
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center"><History className="mr-2 h-5 w-5 text-primary" />My Advance History</CardTitle>
            <CardDescription>Track the status of your advance requests.</CardDescription>
          </CardHeader>
          <CardContent>
            {(user.advances && user.advances.length > 0) ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Amount</TableHead>
                    <TableHead>Date Requested</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="hidden sm:table-cell">Reason</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {user.advances.slice().reverse().map(advance => ( // Show newest first
                    <TableRow key={advance.id}>
                      <TableCell className="font-medium">${advance.amount.toLocaleString()}</TableCell>
                      <TableCell>{new Date(advance.dateRequested).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <Badge variant={getStatusBadgeVariant(advance.status)} className="capitalize">{advance.status}</Badge>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-xs text-muted-foreground truncate max-w-[150px]" title={advance.reason}>{advance.reason}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-muted-foreground text-center py-8">You have not made any advance requests.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

