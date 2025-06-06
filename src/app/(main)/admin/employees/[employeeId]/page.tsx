
'use client';

import { useEffect, useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import type { User, Task as TaskType, LeaveApplication as LeaveApplicationType, AttendanceEvent, MonthlyPayrollReport } from '@/lib/types';
import { summarizeEmployeePerformance } from '@/ai/flows/summarize-employee-performance';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { format, parseISO, isToday, formatDistanceToNow, differenceInMilliseconds, getYear, getMonth } from 'date-fns';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { ArrowLeft, Mail, Phone, Briefcase, User as UserIcon, Users, CalendarDays, IndianRupee, Percent, BarChart3, Loader2, AlertTriangle, MessageSquare, ListChecks, CalendarOff, Edit2, Camera as CameraIcon, Wifi, WifiOff, UserCheck, UserX, Clock, Clock4, FileSpreadsheet } from 'lucide-react';
import { formatDuration, isSunday } from '@/lib/dateUtils';

interface DailyWorkSummary {
  date: string;
  totalWorkMs: number;
  entries: AttendanceEvent[];
  isOngoing: boolean;
}

const currentYear = getYear(new Date());
const years = Array.from({ length: 5 }, (_, i) => currentYear - i);
const months = Array.from({ length: 12 }, (_, i) => ({
  value: i, // 0-11
  label: format(new Date(currentYear, i), 'MMMM'),
}));


export default function EmployeeDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { allUsers, loading: authLoading, updateUserInContext, attendanceLog, tasks: allContextTasks, calculateMonthlyPayrollDetails } = useAuth();
  const employeeId = params.employeeId as string;
  const { toast } = useToast();

  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [isSummaryLoading, setIsSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  const [isEditingSalary, setIsEditingSalary] = useState(false);
  const [editedSalary, setEditedSalary] = useState<string | number>('');
  const [isEditingHours, setIsEditingHours] = useState(false);
  const [editedHours, setEditedHours] = useState<string | number>('');

  const [reportYear, setReportYear] = useState<number>(currentYear);
  const [reportMonth, setReportMonth] = useState<number>(getMonth(new Date())); // Current month (0-11)
  const [monthlyPayrollReport, setMonthlyPayrollReport] = useState<MonthlyPayrollReport | null>(null);


  const employee = useMemo(() => {
    if (authLoading || !allUsers.length) return null;
    const foundEmployee = allUsers.find(u => u.employeeId === employeeId) || null;
    if (foundEmployee) {
      if (!isEditingSalary) {
        setEditedSalary(foundEmployee.baseSalary || '');
      }
      if (!isEditingHours) {
        setEditedHours(foundEmployee.standardDailyHours || '');
      }
    }
    return foundEmployee;
  }, [allUsers, employeeId, authLoading, isEditingSalary, isEditingHours]);

  const employeeAttendanceEvents = useMemo(() => {
    if (!employee || authLoading) return [];
    return attendanceLog
      .filter(event => event.employeeId === employee.employeeId)
      .sort((a, b) => {
        try {
          return parseISO(b.timestamp).getTime() - parseISO(a.timestamp).getTime();
        } catch (e) {
          console.warn("Error parsing timestamp in employeeAttendanceEvents sort", a.timestamp, b.timestamp, e);
          return 0;
        }
      });
  }, [employee, attendanceLog, authLoading]);

  useEffect(() => {
    if (employee?.name) {
      document.title = `Employee Details - ${employee.name} - BizFlow`;
    } else if (employeeId) {
      document.title = `Employee Details - ${employeeId} - BizFlow`;
    }
  }, [employee, employeeId]);


  const employeeTasks = useMemo(() => {
    if (!employee || !allContextTasks) return [];
    return allContextTasks.filter(task => task.assigneeId === employee.employeeId)
                           .sort((a,b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
  }, [employee, allContextTasks]);

  const employeeLeaves: LeaveApplicationType[] = useMemo(() => {
    if (!employee || !employee.leaves) return [];
    return employee.leaves || [];
  }, [employee]);


  const todaysAttendanceEvents = useMemo(() => {
    return employeeAttendanceEvents.filter(event => {
      try {
        return event.timestamp && isToday(parseISO(event.timestamp));
      } catch { return false; }
    }).sort((a,b) => {
      try {
        return parseISO(a.timestamp).getTime() - parseISO(b.timestamp).getTime();
      } catch { return 0; }
    });
  }, [employeeAttendanceEvents]);

  const dailyWorkSummaries = useMemo((): DailyWorkSummary[] => {
    if (!employeeAttendanceEvents.length) return [];

    const eventsByDate = employeeAttendanceEvents.reduce((acc, event) => {
      if(!event.timestamp) return acc;
      try {
        const dateStr = format(parseISO(event.timestamp), 'yyyy-MM-dd');
        if (!acc[dateStr]) {
          acc[dateStr] = [];
        }
        acc[dateStr].push(event);
      } catch (e) {
        console.warn("Error processing event timestamp for dailyWorkSummaries", event.timestamp, e);
      }
      return acc;
    }, {} as Record<string, AttendanceEvent[]>);

    const summaries = Object.entries(eventsByDate)
      .map(([dateStr, dailyEvents]) => {
        try {
          dailyEvents.sort((a, b) => parseISO(a.timestamp).getTime() - parseISO(b.timestamp).getTime());

          let totalWorkMs = 0;
          let lastCheckInTime: Date | null = null;
          let isOngoing = false;

          if (isSunday(dateStr)) {
            totalWorkMs = 0;
          } else {
              for (const event of dailyEvents) {
                if (event.type === 'check-in') {
                  lastCheckInTime = parseISO(event.timestamp);
                } else if (event.type === 'check-out' && lastCheckInTime) {
                  totalWorkMs += differenceInMilliseconds(parseISO(event.timestamp), lastCheckInTime);
                  lastCheckInTime = null;
                }
              }

              if (lastCheckInTime && isToday(parseISO(dateStr))) {
                const lastEventOfTheDay = dailyEvents[dailyEvents.length -1];
                if (lastEventOfTheDay.type === 'check-in' && parseISO(lastEventOfTheDay.timestamp).getTime() === lastCheckInTime.getTime()){
                  totalWorkMs += differenceInMilliseconds(new Date(), lastCheckInTime);
                  isOngoing = true;
                }
              }
          }

          return {
            date: dateStr,
            totalWorkMs,
            entries: dailyEvents,
            isOngoing: isSunday(dateStr) ? false : isOngoing,
          };
        } catch (e) {
          console.warn("Error creating daily summary for date", dateStr, e);
          return null;
        }
      })
      .filter(summary => summary !== null)
      .sort((a, b) => parseISO(b!.date).getTime() - parseISO(a!.date).getTime()) as DailyWorkSummary[];

    return summaries;
  }, [employeeAttendanceEvents]);

  useEffect(() => {
    if (employee && calculateMonthlyPayrollDetails) {
      const report = calculateMonthlyPayrollDetails(employee, reportYear, reportMonth, employeeAttendanceEvents);
      setMonthlyPayrollReport(report);
    }
  }, [employee, reportYear, reportMonth, employeeAttendanceEvents, calculateMonthlyPayrollDetails]);


  const handleGenerateSummary = async () => {
    if (!employee) return;
    setIsSummaryLoading(true);
    setAiSummary(null);
    setSummaryError(null);

    const tasksForSummary = employeeTasks.map(t => ({
        title: t.title,
        status: t.status,
        priority: t.priority,
        description: t.description,
        dueDate: t.dueDate
    }));


    try {
      const performanceInput = {
        employeeName: employee.name || employee.employeeId,
        tasks: tasksForSummary,
        leaveApplications: (employee.leaves || []).map(l => ({ leaveType: l.leaveType, status: l.status, startDate: l.startDate, endDate: l.endDate, reason: l.reason })),
        attendanceFactor: employee.mockAttendanceFactor !== undefined ? employee.mockAttendanceFactor : 1.0, // This might be deprecated with new payroll
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

  const handleSaveSalary = async () => {
    if (!employee) return;
    const newSalary = parseFloat(String(editedSalary));
    if (isNaN(newSalary) || newSalary < 0) {
      toast({ title: "Invalid Salary", description: "Please enter a valid positive number for salary.", variant: "destructive" });
      return;
    }
    const updatedEmployee = { ...employee, baseSalary: newSalary };
    updateUserInContext(updatedEmployee);
    setIsEditingSalary(false);
    toast({ title: "Salary Updated", description: `${employee.name || employee.employeeId}'s base salary updated to ₹${newSalary.toLocaleString('en-IN')}.` });
  };

  const handleSaveHours = async () => {
    if (!employee) return;
    const newHours = parseFloat(String(editedHours));
    if (isNaN(newHours) || newHours <= 0 || newHours > 24) {
      toast({ title: "Invalid Hours", description: "Please enter a valid number between 1 and 24 for standard daily hours.", variant: "destructive" });
      return;
    }
    const updatedEmployee = { ...employee, standardDailyHours: newHours };
    updateUserInContext(updatedEmployee);
    setIsEditingHours(false);
    toast({ title: "Standard Hours Updated", description: `${employee.name || employee.employeeId}'s standard daily hours updated to ${newHours}h.` });
  };


  if (authLoading && !employee) {
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
  const standardHours = employee.standardDailyHours || 8;
  // const attendanceFactor = employee.mockAttendanceFactor !== undefined ? employee.mockAttendanceFactor : 1.0; // Less relevant now
  // const salaryAfterAttendance = baseSalary * attendanceFactor; // Replaced by detailed calculation
  // const approvedAdvancesTotal = employee.advances?.filter(adv => adv.status === 'approved').reduce((sum, adv) => sum + adv.amount, 0) || 0;
  // const netPayable = salaryAfterAttendance - approvedAdvancesTotal; // Replaced by detailed calculation


  const getRoleDisplayName = (role: typeof employee.role) => {
    if (!role) return 'N/A';
    if (role === 'admin') return 'Administrator';
    if (role === 'manager') return 'Manager';
    if (role === 'employee') return 'Employee';
    return 'User';
  };

  const getPriorityBadgeVariant = (priority?: TaskType['priority']) => {
    if (!priority) return 'default';
    switch (priority.toLowerCase()) {
      case 'critical': return 'destructive';
      case 'high': return 'destructive';
      case 'medium': return 'secondary';
      case 'low': return 'outline';
      default: return 'default';
    }
  };

  const getStatusBadgeVariant = (status?: string) => {
    status = status || '';
    if (!status) return 'default';
    switch (status.toLowerCase()) {
      case 'completed': return 'default';
      case 'in progress': return 'secondary';
      case 'pending': return 'outline';
      case 'blocked': return 'destructive';
      case 'approved': return 'default';
      case 'rejected': return 'destructive';
      case 'check-in': return 'default';
      case 'check-out': return 'secondary';
      default: return 'default';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>
      </div>

      <Card className="shadow-lg">
        <CardHeader className="bg-muted/30 p-6 rounded-t-lg border-b">
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
            <InfoCard title="Std. Daily Hours" icon={Clock4} value={`${standardHours}h`} />
            {/* Mock Attendance Factor is now less relevant */}
            {/* <InfoCard title="Attendance Factor" icon={Percent} value={`${(attendanceFactor * 100).toFixed(0)}% (Mock)`} /> */}
          </div>

          <Separator />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="shadow-sm">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center text-xl">
                    <IndianRupee className="mr-2 h-5 w-5 text-primary" /> Base Salary
                  </CardTitle>
                  {!isEditingSalary ? (
                    <Button variant="ghost" size="sm" onClick={() => {
                      setEditedSalary(employee?.baseSalary || '');
                      setIsEditingSalary(true);
                    }}>
                      <Edit2 className="mr-1 h-4 w-4" /> Edit
                    </Button>
                  ) : null}
                </div>
              </CardHeader>
              <CardContent>
                {isEditingSalary ? (
                  <div className="space-y-2">
                    <Label htmlFor="editSalary">New Base Monthly Salary (₹)</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        id="editSalary"
                        type="number"
                        value={editedSalary}
                        onChange={(e) => setEditedSalary(e.target.value)}
                        placeholder="Enter base salary"
                        className="max-w-xs"
                      />
                      <Button size="sm" onClick={handleSaveSalary}>Save</Button>
                      <Button variant="outline" size="sm" onClick={() => {
                        setIsEditingSalary(false);
                        setEditedSalary(employee?.baseSalary || '');
                      }}>Cancel</Button>
                    </div>
                  </div>
                ) : (
                  <p className="text-2xl font-semibold">
                    ₹{(employee?.baseSalary || 0).toLocaleString('en-IN')}
                  </p>
                )}
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center text-xl">
                    <Clock4 className="mr-2 h-5 w-5 text-primary" /> Standard Daily Hours
                  </CardTitle>
                  {!isEditingHours ? (
                    <Button variant="ghost" size="sm" onClick={() => {
                      setEditedHours(employee?.standardDailyHours || '');
                      setIsEditingHours(true);
                    }}>
                      <Edit2 className="mr-1 h-4 w-4" /> Edit
                    </Button>
                  ) : null}
                </div>
              </CardHeader>
              <CardContent>
                {isEditingHours ? (
                   <div className="space-y-2">
                    <Label htmlFor="editHours">New Standard Daily Hours</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        id="editHours"
                        type="number"
                        value={editedHours}
                        onChange={(e) => setEditedHours(e.target.value)}
                        placeholder="e.g., 8"
                        className="max-w-xs"
                        min="1"
                        max="24"
                      />
                      <Button size="sm" onClick={handleSaveHours}>Save</Button>
                      <Button variant="outline" size="sm" onClick={() => {
                        setIsEditingHours(false);
                        setEditedHours(employee?.standardDailyHours || '');
                      }}>Cancel</Button>
                    </div>
                  </div>
                ) : (
                  <p className="text-2xl font-semibold">
                    {employee?.standardDailyHours || 8} hours/day
                  </p>
                )}
              </CardContent>
            </Card>
          </div>


          <Separator />

          <Card className="shadow-sm">
            <CardHeader>
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                <div>
                    <CardTitle className="flex items-center text-xl">
                        <FileSpreadsheet className="mr-2 h-5 w-5 text-primary" /> Monthly Payroll Report
                    </CardTitle>
                    <CardDescription className="text-xs text-muted-foreground">
                        Calculated based on attendance, standard hours, and base salary. Deductions applied for missed hours.
                    </CardDescription>
                </div>
                <div className="flex gap-2 items-center">
                    <Select value={String(reportMonth)} onValueChange={(val) => setReportMonth(Number(val))}>
                        <SelectTrigger className="w-[150px] h-9">
                            <SelectValue placeholder="Month" />
                        </SelectTrigger>
                        <SelectContent>
                            {months.map(m => <SelectItem key={m.value} value={String(m.value)}>{m.label}</SelectItem>)}
                        </SelectContent>
                    </Select>
                    <Select value={String(reportYear)} onValueChange={(val) => setReportYear(Number(val))}>
                         <SelectTrigger className="w-[100px] h-9">
                            <SelectValue placeholder="Year" />
                        </SelectTrigger>
                        <SelectContent>
                            {years.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-4 bg-muted/30 rounded-md">
                {monthlyPayrollReport ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                        <ReportItem label="Report For" value={`${months.find(m=>m.value === reportMonth)?.label} ${reportYear}`} />
                        <ReportItem label="Base Salary" value={`₹${monthlyPayrollReport.baseSalary.toLocaleString('en-IN')}`} />
                        <ReportItem label="Std. Daily Hours" value={`${monthlyPayrollReport.standardDailyHours}h`} />
                        <ReportItem label="Working Days in Month" value={`${monthlyPayrollReport.totalWorkingDaysInMonth} days`} />
                        <ReportItem label="Total Standard Hours" value={`${monthlyPayrollReport.totalStandardHoursForMonth.toFixed(2)}h`} />
                        <ReportItem label="Total Actual Hours Worked" value={`${monthlyPayrollReport.totalActualHoursWorked.toFixed(2)}h`} 
                            className={monthlyPayrollReport.totalActualHoursWorked < monthlyPayrollReport.totalStandardHoursForMonth ? 'text-orange-600' : 'text-green-600'}/>
                        <ReportItem label="Total Hours Missed" value={`${monthlyPayrollReport.totalHoursMissed.toFixed(2)}h`} 
                            className={monthlyPayrollReport.totalHoursMissed > 0 ? 'text-destructive' : ''} />
                        <ReportItem label="Effective Hourly Rate" value={`₹${monthlyPayrollReport.hourlyRate.toLocaleString('en-IN')}/h`} />
                        <ReportItem label="Calculated Deductions" value={`₹${monthlyPayrollReport.calculatedDeductions.toLocaleString('en-IN')}`} 
                             className={monthlyPayrollReport.calculatedDeductions > 0 ? 'text-destructive' : ''}/>
                        <ReportItem label="Salary After Deductions" value={`₹${monthlyPayrollReport.salaryAfterDeductions.toLocaleString('en-IN')}`} />
                        <ReportItem label="Approved Advances" value={`(₹${monthlyPayrollReport.totalApprovedAdvances.toLocaleString('en-IN')})`} className="text-red-600"/>
                        <ReportItem label="Final Net Payable" value={`₹${monthlyPayrollReport.finalNetPayable.toLocaleString('en-IN')}`} className="text-lg font-semibold text-primary" />
                    </div>
                ) : (
                     <p className="text-muted-foreground text-center py-4">Calculating payroll report...</p>
                )}
            </CardContent>
          </Card>


          <Separator />

           <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center text-xl"><Clock className="mr-2 h-5 w-5 text-primary" />Attendance Log & Work Hours</CardTitle>
              <CardDescription>Daily attendance records and calculated work hours for {employee.name || employee.employeeId}. Sundays are excluded from work hour calculations.</CardDescription>
            </CardHeader>
            <CardContent>
              {todaysAttendanceEvents.length > 0 && (
                <div className="mb-4 p-4 border rounded-md bg-primary/5">
                  <h4 className="font-semibold text-md text-primary mb-2">Today's Activity ({format(new Date(), 'PPP')})</h4>
                  <ul className="space-y-2 text-sm">
                    {todaysAttendanceEvents.map(event => (
                      <li key={`today-${event.id}`} className="flex items-center justify-between">
                        <div>
                          <Badge variant={getStatusBadgeVariant(event.type)} className="capitalize mr-2">
                            {event.type === 'check-in' ? <UserCheck className="mr-1 h-3 w-3"/> : <UserX className="mr-1 h-3 w-3"/>}
                            {event.type}
                          </Badge>
                           at {format(parseISO(event.timestamp), 'p')}
                        </div>
                        <span className="text-xs text-muted-foreground">({formatDistanceToNow(parseISO(event.timestamp), { addSuffix: true })})</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {dailyWorkSummaries.length > 0 ? (
                <ScrollArea className="h-[500px] border rounded-md p-1">
                  <Accordion type="multiple" className="w-full">
                    {dailyWorkSummaries.map((summary) => (
                      <AccordionItem value={summary.date} key={summary.date} className="border-b-0 mb-2 rounded-md bg-muted/20 overflow-hidden">
                        <AccordionTrigger className="px-4 py-3 hover:bg-muted/40 rounded-t-md">
                          <div className="flex justify-between items-center w-full">
                            <span className="font-semibold text-foreground">{format(parseISO(summary.date), 'PPP')} ({format(parseISO(summary.date), 'eeee')})
                             {isSunday(summary.date) && <Badge variant="outline" className="ml-2 text-xs">Sunday (0h)</Badge>}
                            </span>
                            <div className="flex items-center">
                              <Badge variant="secondary" className="text-sm">
                                <Clock className="mr-1.5 h-4 w-4" />
                                {formatDuration(summary.totalWorkMs)} worked
                              </Badge>
                              {summary.isOngoing && isToday(parseISO(summary.date)) && (
                                <Badge variant="outline" className="ml-2 bg-green-500/10 text-green-700 border-green-500/30">Ongoing</Badge>
                              )}
                            </div>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className="bg-background px-1 pb-1 rounded-b-md">
                          <Table className="mt-0">
                            <TableHeader>
                              <TableRow>
                                <TableHead>Time</TableHead>
                                <TableHead>Type</TableHead>
                                <TableHead>Geofence</TableHead>
                                <TableHead className="hidden md:table-cell">Location</TableHead>
                                <TableHead className="text-center">Photo</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {summary.entries.map(event => (
                                <TableRow key={event.id}>
                                  <TableCell>{event.timestamp ? format(parseISO(event.timestamp), 'p') : 'N/A'}</TableCell>
                                  <TableCell>
                                    <Badge variant={getStatusBadgeVariant(event.type)} className="capitalize">
                                     {event.type === 'check-in' ? <UserCheck className="mr-1 h-3 w-3"/> : <UserX className="mr-1 h-3 w-3"/>}
                                      {event.type}
                                    </Badge>
                                  </TableCell>
                                  <TableCell>
                                    {event.isWithinGeofence === undefined || event.isWithinGeofence === null ? <Badge variant="outline">N/A</Badge> :
                                     event.isWithinGeofence ?
                                     <Badge variant="default" className="bg-green-600 hover:bg-green-700"><Wifi className="mr-1 h-3 w-3"/> Within</Badge> :
                                     <Badge variant="destructive"><WifiOff className="mr-1 h-3 w-3"/> Outside</Badge>}
                                  </TableCell>
                                  <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
                                    {event.location ? `${event.location.latitude.toFixed(3)}, ${event.location.longitude.toFixed(3)}` : 'N/A'}
                                    {event.location?.accuracy && ` (±${event.location.accuracy.toFixed(0)}m)`}
                                  </TableCell>
                                  <TableCell className="text-center">
                                    {event.photoUrl ? (
                                        <Avatar className="h-9 w-9 border mx-auto" data-ai-hint="face scan">
                                            <AvatarImage src={event.photoUrl} alt="Attendance photo" />
                                            <AvatarFallback><CameraIcon className="h-4 w-4 text-muted-foreground" /></AvatarFallback>
                                        </Avatar>
                                    ) : (
                                        <div className="flex justify-center items-center h-9 w-9" title="Photo not available in log">
                                          <CameraIcon className="h-5 w-5 text-muted-foreground/70" />
                                        </div>
                                    )}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                </ScrollArea>
              ) : (
                <p className="text-muted-foreground text-center py-4">No attendance records found for this employee.</p>
              )}
            </CardContent>
          </Card>

          <Separator />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center text-xl"><ListChecks className="mr-2 h-5 w-5 text-primary" />Assigned Tasks</CardTitle>
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
                          <TableCell>{task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'N/A'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <p className="text-muted-foreground text-center py-4">No tasks assigned to this employee.</p>
                )}
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center text-xl"><CalendarOff className="mr-2 h-5 w-5 text-primary" />Leave Applications</CardTitle>
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

          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center text-xl"><BarChart3 className="mr-2 h-5 w-5 text-primary" />AI Performance Summary</CardTitle>
              <CardDescription>Generates a summary based on tasks, leaves, and attendance.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={handleGenerateSummary} disabled={isSummaryLoading}>
                {isSummaryLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <MessageSquare className="mr-2 h-4 w-4" />}
                Generate AI Performance Summary
              </Button>
              {isSummaryLoading && <p className="text-muted-foreground mt-2">Generating summary, please wait...</p>}
              {summaryError && <Alert variant="destructive" className="mt-4"><AlertTriangle className="h-4 w-4" /><AlertDescription>{summaryError}</AlertDescription></Alert>}
              {aiSummary && !isSummaryLoading && (
                <div className="mt-4 p-4 border rounded-md bg-muted/50 shadow-inner">
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

interface ReportItemProps {
    label: string;
    value: string | number;
    className?: string;
}
function ReportItem({ label, value, className }: ReportItemProps) {
    return (
        <div>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className={cn("font-medium text-foreground", className)}>{value}</p>
        </div>
    );
}
