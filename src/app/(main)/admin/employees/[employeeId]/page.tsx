
'use client';

import { useEffect, useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import type { User, Task as TaskType, LeaveApplication as LeaveApplicationType } from '@/lib/types';
import { initialTasks } from '@/lib/taskData'; // Updated import
import { summarizeEmployeePerformance } from '@/ai/flows/summarize-employee-performance';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowLeft, Mail, Phone, Briefcase, User as UserIcon, Users, CalendarDays, IndianRupee, Percent, BarChart3, Loader2, AlertTriangle, MessageSquare, ListChecks, CalendarOff } from 'lucide-react';

export default function EmployeeDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { allUsers, loading: authLoading } = useAuth();
  const employeeId = params.employeeId as string;

  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [isSummaryLoading, setIsSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  useEffect(() => {
    document.title = `Employee Details - ${employeeId} - BizFlow`;
  }, [employeeId]);

  const employee = useMemo(() => {
    if (authLoading || !allUsers.length) return null;
    return allUsers.find(u => u.employeeId === employeeId) || null;
  }, [allUsers, employeeId, authLoading]);

  const employeeTasks = useMemo(() => {
    if (!employee) return [];
    return initialTasks.filter(task => task.assigneeId === employee.employeeId);
  }, [employee]);

  const employeeLeaves: LeaveApplicationType[] = useMemo(() => {
    if (!employee || !employee.advances) return []; // Using advances as a proxy for where leaves might be, adjust if actual leave structure is different
    // This is a placeholder. Actual leave applications should be part of the User object.
    // For now, let's return some mock leaves if employee.leaves exists or an empty array
    return employee.leaves || [];
  }, [employee]);


  const handleGenerateSummary = async () => {
    if (!employee) return;
    setIsSummaryLoading(true);
    setAiSummary(null);
    setSummaryError(null);

    try {
      const performanceInput = {
        employeeName: employee.name || employee.employeeId,
        tasks: employeeTasks.map(t => ({ title: t.title, status: t.status, priority: t.priority, description: t.description, dueDate: t.dueDate })),
        leaveApplications: (employee.leaves || []).map(l => ({ type: l.leaveType, status: l.status, startDate: l.startDate, endDate: l.endDate, reason: l.reason })),
        attendanceFactor: employee.mockAttendanceFactor !== undefined ? employee.mockAttendanceFactor : 1.0,
        baseSalary: employee.baseSalary || 0,
      };
      const result = await summarizeEmployeePerformance(performanceInput);
      setAiSummary(result.summary);
    } catch (err) {
      console.error("Error generating performance summary:", err);
      setSummaryError((err as Error).message || "Failed to generate summary.");
    } finally {
      setIsSummaryLoading(false);
    }
  };

  if (authLoading) {
    return <div className="text-center py-10"><Loader2 className="mx-auto h-8 w-8 animate-spin" /> Loading employee details...</div>;
  }

  if (!employee) {
    return (
      <div className="text-center py-10">
        <AlertTriangle className="mx-auto h-12 w-12 text-destructive mb-4" />
        <h1 className="text-2xl font-semibold">Employee Not Found</h1>
        <p className="text-muted-foreground">The employee with ID '{employeeId}' could not be found.</p>
        <Button asChild className="mt-6">
          <Link href="/admin/employees"><ArrowLeft className="mr-2 h-4 w-4" /> Back to Employee List</Link>
        </Button>
      </div>
    );
  }

  const initials = employee.name ? employee.name.split(' ').map((n) => n[0]).join('').toUpperCase() : employee.employeeId[0].toUpperCase();
  const baseSalary = employee.baseSalary || 0;
  const attendanceFactor = employee.mockAttendanceFactor !== undefined ? employee.mockAttendanceFactor : 1.0;
  const salaryAfterAttendance = baseSalary * attendanceFactor;
  const approvedAdvancesTotal = employee.advances?.filter(adv => adv.status === 'approved').reduce((sum, adv) => sum + adv.amount, 0) || 0;
  const netPayable = salaryAfterAttendance - approvedAdvancesTotal;

  const getRoleDisplayName = (role: typeof employee.role) => {
    if (role === 'admin') return 'Administrator';
    if (role === 'manager') return 'Manager';
    if (role === 'employee') return 'Employee';
    return 'User';
  };

  const getPriorityBadgeVariant = (priority: TaskType['priority']) => {
    switch (priority?.toLowerCase()) {
      case 'critical': return 'destructive';
      case 'high': return 'destructive';
      case 'medium': return 'secondary';
      case 'low': return 'outline';
      default: return 'default';
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'completed': return 'default';
      case 'in progress': return 'secondary';
      case 'pending': return 'outline';
      case 'blocked': return 'destructive';
      case 'approved': return 'default';
      case 'rejected': return 'destructive';
      default: return 'default';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Employees
        </Button>
        {/* Add Edit/Delete buttons here if needed */}
      </div>

      <Card className="shadow-lg">
        <CardHeader className="bg-muted/30 p-6 rounded-t-lg">
          <div className="flex flex-col sm:flex-row items-center space-y-4 sm:space-y-0 sm:space-x-6">
            <Avatar className="h-24 w-24 border-2 border-primary">
              <AvatarImage src={employee.profilePictureUrl || undefined} alt={employee.name || 'User Avatar'} data-ai-hint="profile person" />
              <AvatarFallback className="text-4xl">{initials}</AvatarFallback>
            </Avatar>
            <div className="text-center sm:text-left">
              <CardTitle className="text-3xl">{employee.name || 'N/A'}</CardTitle>
              <CardDescription className="text-lg text-muted-foreground">
                {getRoleDisplayName(employee.role)}
              </CardDescription>
              <p className="text-sm text-muted-foreground">Employee ID: {employee.employeeId}</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <InfoCard title="Email" icon={Mail} value={employee.email || 'N/A'} />
            <InfoCard title="Phone" icon={Phone} value={employee.contactInfo?.phone || 'N/A'} />
            <InfoCard title="Department" icon={Briefcase} value={employee.department || 'N/A'} />
            <InfoCard title="Joining Date" icon={CalendarDays} value={employee.joiningDate ? new Date(employee.joiningDate).toLocaleDateString() : 'N/A'} />
            <InfoCard title="Base Salary" icon={IndianRupee} value={`₹${(employee.baseSalary || 0).toLocaleString('en-IN')}`} />
             <InfoCard title="Attendance Factor" icon={Percent} value={`${(attendanceFactor * 100).toFixed(0)}% (Mock)`} />
          </div>
          
          <Separator />

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center"><IndianRupee className="mr-2 h-5 w-5 text-primary"/>Payout Summary (Till Date - Mock)</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div><span className="font-medium">Salary (Post-Attendance):</span> ₹{salaryAfterAttendance.toLocaleString('en-IN')}</div>
                <div><span className="font-medium">Approved Advances:</span> ₹{approvedAdvancesTotal.toLocaleString('en-IN')}</div>
                <div className="font-semibold text-lg"><span className="font-medium">Net Payable:</span> ₹{netPayable.toLocaleString('en-IN')}</div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center"><ListChecks className="mr-2 h-5 w-5 text-primary"/>Assigned Tasks</CardTitle>
              </CardHeader>
              <CardContent>
                {employeeTasks.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Title</TableHead>
                        <TableHead>Priority</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Due</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {employeeTasks.map(task => (
                        <TableRow key={task.id}>
                          <TableCell className="font-medium max-w-xs truncate" title={task.title}>{task.title}</TableCell>
                          <TableCell><Badge variant={getPriorityBadgeVariant(task.priority)}>{task.priority}</Badge></TableCell>
                          <TableCell><Badge variant={getStatusBadgeVariant(task.status)}>{task.status}</Badge></TableCell>
                          <TableCell>{new Date(task.dueDate).toLocaleDateString()}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <p className="text-muted-foreground text-center py-4">No tasks assigned to this employee.</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center"><CalendarOff className="mr-2 h-5 w-5 text-primary"/>Leave Applications</CardTitle>
              </CardHeader>
              <CardContent>
                {(employee.leaves && employee.leaves.length > 0) ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Type</TableHead>
                        <TableHead>Dates</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {employee.leaves.map(leave => (
                        <TableRow key={leave.id}>
                          <TableCell>{leave.leaveType}</TableCell>
                          <TableCell>{new Date(leave.startDate).toLocaleDateString()} - {new Date(leave.endDate).toLocaleDateString()}</TableCell>
                          <TableCell><Badge variant={getStatusBadgeVariant(leave.status)}>{leave.status}</Badge></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <p className="text-muted-foreground text-center py-4">No leave applications found.</p>
                )}
              </CardContent>
            </Card>
          </div>
          
          <Separator />

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center"><BarChart3 className="mr-2 h-5 w-5 text-primary"/>AI Performance Summary</CardTitle>
              <CardDescription>Generates a summary based on tasks, leaves, and attendance.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={handleGenerateSummary} disabled={isSummaryLoading}>
                {isSummaryLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <MessageSquare className="mr-2 h-4 w-4" />}
                Generate AI Performance Summary
              </Button>
              {isSummaryLoading && <p className="text-muted-foreground mt-2">Generating summary, please wait...</p>}
              {summaryError && <Alert variant="destructive" className="mt-4"><AlertTriangle className="h-4 w-4"/><AlertDescription>{summaryError}</AlertDescription></Alert>}
              {aiSummary && !isSummaryLoading && (
                <div className="mt-4 p-4 border rounded-md bg-muted/50">
                  <h4 className="font-semibold mb-2 text-foreground">Summary:</h4>
                  <div
                    className="prose prose-sm max-w-none text-foreground whitespace-pre-wrap"
                    dangerouslySetInnerHTML={{ __html: aiSummary.replace(/\n\*(?!\*)/g, '<br />• ').replace(/\n/g, '<br />') }}
                  />
                </div>
              )}
            </CardContent>
          </Card>

        </CardContent>
      </Card>
    </div>
  );
}

interface InfoCardProps {
  title: string;
  value: string | number;
  icon: React.ElementType;
}

function InfoCard({ title, value, icon: Icon }: InfoCardProps) {
  return (
    <div className="p-4 bg-background border rounded-lg shadow-sm">
      <div className="flex items-center text-sm text-muted-foreground mb-1">
        <Icon className="h-4 w-4 mr-2" />
        {title}
      </div>
      <p className="text-md font-semibold text-foreground truncate" title={String(value)}>{value}</p>
    </div>
  );
}
