
'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { CalendarPlus, History, BarChartHorizontalBig, Info, CalendarDays as CalendarIcon } from 'lucide-react';
import type { Metadata } from 'next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useToast } from '@/hooks/use-toast';
import type { LeaveApplication } from '@/lib/types';
import { useAuth } from '@/hooks/useAuth';

// export const metadata: Metadata = { // Metadata not used in client components
//   title: 'Leave Management - BizFlow',
//   description: 'Apply for leave and track your leave balance.',
// };

const leaveApplicationSchema = z.object({
  leaveType: z.string().min(1, "Leave type is required"),
  startDate: z.string().refine((date) => new Date(date).toString() !== 'Invalid Date', {
    message: "Start date is required and must be valid.",
  }),
  endDate: z.string().refine((date) => new Date(date).toString() !== 'Invalid Date', {
    message: "End date is required and must be valid.",
  }),
  reason: z.string().min(10, "Reason must be at least 10 characters.").max(200, "Reason must not exceed 200 characters."),
}).refine(data => new Date(data.startDate) <= new Date(data.endDate), {
  message: "End date cannot be before start date",
  path: ["endDate"],
});

type LeaveFormValues = z.infer<typeof leaveApplicationSchema>;

const initialRecentApplications: LeaveApplication[] = [
    { id: '1', userId: 'mockUser', leaveType: 'Casual Leave', startDate: '2023-10-20', endDate: '2023-10-22', reason: 'Family function', status: 'Approved', color: 'bg-green-100 text-green-700 border-green-300' },
    { id: '2', userId: 'mockUser', leaveType: 'Sick Leave', startDate: '2023-11-05', endDate: '2023-11-05', reason: 'Feeling unwell', status: 'Pending', color: 'bg-yellow-100 text-yellow-700 border-yellow-300' },
];

export default function LeavePage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [recentApplications, setRecentApplications] = useState<LeaveApplication[]>(initialRecentApplications);
  
  useEffect(() => {
    document.title = 'Leave Management - BizFlow';
  }, []);

  const form = useForm<LeaveFormValues>({
    resolver: zodResolver(leaveApplicationSchema),
    defaultValues: {
      leaveType: '',
      startDate: '',
      endDate: '',
      reason: '',
    },
  });

  const onSubmit = (data: LeaveFormValues) => {
    const newApplication: LeaveApplication = {
      id: Date.now().toString(),
      userId: user?.employeeId || 'unknownUser',
      leaveType: data.leaveType,
      startDate: data.startDate,
      endDate: data.endDate,
      reason: data.reason,
      status: 'pending',
      color: 'bg-yellow-100 text-yellow-700 border-yellow-300', // Default for pending
    };
    setRecentApplications(prev => [newApplication, ...prev]);
    toast({
      title: 'Leave Application Submitted',
      description: `Your request for ${data.leaveType} from ${new Date(data.startDate).toLocaleDateString()} to ${new Date(data.endDate).toLocaleDateString()} is pending.`,
    });
    setIsDialogOpen(false);
    form.reset();
  };

  const configuredMonthlyAllowance = 4; 
  const configuredYearlyAllowance = 48; 
  const currentLeaveBalanceMock = 10;


  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Leave Management</h1>
          <p className="text-muted-foreground">Apply for leave and view your history.</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <CalendarPlus className="mr-2 h-4 w-4" /> Apply for Leave
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[480px]">
            <DialogHeader>
              <DialogTitle className="flex items-center"><CalendarPlus className="mr-2 h-5 w-5 text-primary" />Apply for Leave</DialogTitle>
              <DialogDescription>
                Fill in the details below to submit your leave application.
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
                <FormField
                  control={form.control}
                  name="leaveType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Leave Type</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select leave type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="Casual Leave">Casual Leave</SelectItem>
                          <SelectItem value="Sick Leave">Sick Leave</SelectItem>
                          <SelectItem value="Earned Leave">Earned Leave</SelectItem>
                          <SelectItem value="Unpaid Leave">Unpaid Leave</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="startDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Start Date</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="endDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>End Date</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="reason"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Reason</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Briefly state the reason for your leave (min. 10 characters)" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => {setIsDialogOpen(false); form.reset();}}>Cancel</Button>
                  <Button type="submit">Submit Application</Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center"><BarChartHorizontalBig className="mr-2 h-5 w-5 text-primary" />Leave Balance Overview</CardTitle>
          <CardDescription>Your current leave allowances and balance.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="p-4 bg-muted/30 rounded-lg shadow-inner space-y-2 border">
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
           <div className="p-4 bg-primary/10 rounded-lg shadow text-center border border-primary/30">
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
                <li key={app.id} className="flex justify-between items-center p-3 bg-muted/30 rounded-md shadow-sm border">
                  <div>
                    <p className="font-semibold">{app.leaveType}</p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(app.startDate).toLocaleDateString()} - {new Date(app.endDate).toLocaleDateString()}
                    </p>
                    <p className="text-xs text-muted-foreground italic mt-0.5">Reason: {app.reason}</p>
                  </div>
                  <span className={`text-sm font-medium px-3 py-1 rounded-full border ${app.color || 'bg-yellow-100 text-yellow-700 border-yellow-300'}`}>{app.status}</span>
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
            <CardTitle className="flex items-center"><CalendarIcon className="mr-2 h-5 w-5 text-primary" />Company Holiday Calendar</CardTitle>
            <CardDescription>Upcoming company holidays for this year.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-64 bg-muted rounded-md flex items-center justify-center border" data-ai-hint="calendar schedule">
             <p className="text-muted-foreground">Holiday calendar will be displayed here.</p>
          </div>
        </CardContent>
      </Card>

    </div>
  );
}
