
'use client';

import { useParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useState, useEffect, useMemo } from 'react';
import type { User, AttendanceEvent, Task, MonthlyPayrollReport, Holiday } from '@/lib/types';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Loader2, User as UserIcon, Mail, Clock, DollarSign, BarChart2, BrainCircuit, MapPin, FileText, IndianRupee, CalendarOff, CalendarCheck } from 'lucide-react';
import { format, differenceInMinutes, differenceInSeconds, parseISO, formatDistanceToNow, isToday, startOfMonth, endOfMonth, eachDayOfInterval, isSunday, isSameMonth } from 'date-fns';
import { Label } from '@/components/ui/label';
import { Timestamp } from 'firebase/firestore';
import { TruncatedText } from '@/components/ui/truncated-text';
import { ScrollArea } from '@/components/ui/scroll-area';

const safeParseISO = (dateString: string | Date | Timestamp | undefined | null): Date | null => {
  if (!dateString) return null;
  if (dateString instanceof Timestamp) {
    return dateString.toDate();
  }
  if (dateString instanceof Date) {
    return dateString;
  }
  try {
    const date = parseISO(dateString);
    if (isNaN(date.getTime())) {
      return null;
    }
    return date;
  } catch (error) {
    console.error("Could not parse date string:", dateString, error);
    return null;
  }
};

interface EmployeeDetailsClientProps {
  initialEmployeeData: {
    employee: User;
    employeeAttendance: AttendanceEvent[];
    employeeTasks: Task[];
  } | null;
  initialHolidays: Holiday[];
  initialCompanySettings: any; // Define a more specific type if possible
}

export default function EmployeeDetailsClient({ initialEmployeeData, initialHolidays, initialCompanySettings }: EmployeeDetailsClientProps) {
  const params = useParams();
  // We'll still use useAuth for real-time updates and other global data if needed
  // But initial data will come from props
  const { allUsers, attendanceLog, tasks, holidays, calculateMonthlyPayrollDetails, companySettings, loading: authLoading } = useAuth();
  const employeeId = params.employeeId as string;

  // Use initial data from props, and then potentially update with real-time data from useAuth
  const employeeData = useMemo(() => {
    if (initialEmployeeData && initialEmployeeData.employee.employeeId === employeeId) {
      return initialEmployeeData;
    }
    // Fallback to useAuth data if initial data doesn't match or isn't provided
    if (!employeeId || allUsers.length === 0) {
      return null;
    }
    const employee = allUsers.find(u => u.employeeId === employeeId) || null;
    if (!employee) return null;

    const employeeAttendance = attendanceLog.filter(a => a.userId === employee.id);
    const employeeTasks = tasks.filter(t => t.assigneeId === employee.employeeId);

    return { employee, employeeAttendance, employeeTasks };
  }, [employeeId, allUsers, attendanceLog, tasks, initialEmployeeData]);

  const { employee, employeeAttendance, employeeTasks } = employeeData || {};
  
  const monthlyAttendance = useMemo(() => {
      const now = new Date();
      return employeeAttendance?.filter(e => e.timestamp && isSameMonth(safeParseISO(e.timestamp)!, now))
        .sort((a,b) => safeParseISO(b.timestamp)!.getTime() - safeParseISO(a.timestamp)!.getTime()) || [];
  }, [employeeAttendance]);

  const payrollReport = useMemo(() => {
    // Use initialCompanySettings if companySettings from useAuth is not yet loaded
    const currentCompanySettings = companySettings || initialCompanySettings;

    if (employee && employeeAttendance && currentCompanySettings) {
      const now = new Date();
      return calculateMonthlyPayrollDetails(employee, now.getFullYear(), now.getMonth(), employeeAttendance, holidays || initialHolidays);
    }
    return null;
  }, [employee, employeeAttendance, companySettings, calculateMonthlyPayrollDetails, holidays, initialCompanySettings, initialHolidays]);

  const geofenceStats = useMemo(() => {
    const stats = { checkInInside: 0, checkOutInside: 0, checkInOutside: 0, checkOutOutside: 0 };

    if (!employeeAttendance) return stats;

    employeeAttendance.forEach(event => {
        if (event.type === 'check-in') {
            if (event.isWithinGeofence === true) {
                stats.checkInInside++;
            } else {
                stats.checkInOutside++;
            }
        } else if (event.type === 'check-out') {
            if (event.isWithinGeofenceCheckout === true) {
                stats.checkOutInside++;
            } else {
                stats.checkOutOutside++;
            }
        }
    });
    return stats;
  }, [employeeAttendance]);
  
  const liveAttendanceEvent = useMemo(() => 
    employeeAttendance?.find(e => e.status === 'Checked In' && e.timestamp && isToday(safeParseISO(e.timestamp)!)),
  [employeeAttendance]);

  const [liveDuration, setLiveDuration] = useState<number>(0);
  useEffect(() => {
    if (!liveAttendanceEvent) {
        setLiveDuration(0);
        return;
    }
    const checkInTime = safeParseISO(liveAttendanceEvent.checkInTime || liveAttendanceEvent.timestamp);
    if (!checkInTime) {
        setLiveDuration(0);
        return;
    }

    setLiveDuration(differenceInSeconds(new Date(), checkInTime));
    const interval = setInterval(() => {
      setLiveDuration(differenceInSeconds(new Date(), checkInTime));
    }, 1000);
    
    return () => clearInterval(interval);
  }, [liveAttendanceEvent]);

  const todayWorkMinutes = useMemo(() => {
    const todaysCompletedMinutes = employeeAttendance?.filter(e => {
        const eventDate = safeParseISO(e.timestamp);
        return eventDate && isToday(eventDate) && e.status === 'Checked Out';
    }).reduce((total, event) => total + (event.totalHours ? event.totalHours * 60 : 0), 0) || 0;

    return todaysCompletedMinutes + Math.floor(liveDuration / 60);
  }, [employeeAttendance, liveDuration]);

  const dailyEarnings = useMemo(() => {
    const currentCompanySettings = companySettings || initialCompanySettings;

    if (!employee?.baseSalary || !currentCompanySettings || !employee.standardDailyHours) {
        return 0;
    }

    const isCheckedIn = liveAttendanceEvent != null;
    const hasWorkedToday = isCheckedIn || (employeeAttendance?.some(e => isToday(safeParseISO(e.timestamp)!) && e.status === 'Checked Out'));

    if (currentCompanySettings.salaryCalculationMode === 'check_in_out') {
        return hasWorkedToday ? employee.baseSalary / 30 : 0;
    } else {
        const perMinuteRate = employee.baseSalary / (30 * employee.standardDailyHours * 60);
        return todayWorkMinutes * perMinuteRate;
    }
  }, [employee, todayWorkMinutes, companySettings, liveAttendanceEvent, employeeAttendance, initialCompanySettings]);


  const [aiSummary, setAiSummary] = useState<string>('');
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  
  const handleGenerateSummary = async () => {
    if (!employee) return;
    setIsGeneratingSummary(true);
    setAiSummary('');

    try {
        const response = await fetch('/api/summarize', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                employeeName: employee.name,
                tasks: employeeTasks?.map(t => ({ title: t.title, status: t.status, priority: t.priority, dueDate: t.dueDate, description: t.description })),
                leaveApplications: employee.leaves,
                attendanceFactor: employee.mockAttendanceFactor || 1.0,
                baseSalary: employee.baseSalary
            }),
        });
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Failed to generate summary');
        }
        const data = await response.json();
        setAiSummary(data.summary);
    } catch (error: any) {
        setAiSummary(`Error: ${error.message}`);
    } finally {
        setIsGeneratingSummary(false);
    }
  };

  if (authLoading && !initialEmployeeData) { // Only show loading if no initial data is provided and auth is still loading
    return (
      <div className="flex items-center justify-center h-full py-10">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-2 text-muted-foreground">Loading Employee Data...</p>
      </div>
    );
  }
  
  if (!employee) {
    return <div className="text-center py-10">Employee not found.</div>;
  }
  
  const formatDurationFromMinutes = (minutes: number) => {
    const h = Math.floor(minutes / 60);
    const m = Math.floor(minutes % 60);
    return `${h}h ${m}m`;
  };

  const formatDurationFromSeconds = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return `${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
  };

  const liveCheckInTime = liveAttendanceEvent ? safeParseISO(liveAttendanceEvent.checkInTime || liveAttendanceEvent.timestamp) : null;

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center space-x-4">
        <Avatar className="h-20 w-20 border-2 border-primary">
          <AvatarImage src={employee.profilePictureUrl || undefined} alt={employee.name || 'avatar'} />
          <AvatarFallback className="text-3xl">{employee.name ? employee.name.split(' ').map(n=>n[0]).join('') : 'U'}</AvatarFallback>
        </Avatar>
        <div>
          <h1 className="text-3xl font-bold">{employee.name}</h1>
          <p className="text-muted-foreground">{employee.department}</p>
          <Badge variant={employee.role === 'admin' ? 'destructive' : 'secondary'}>{employee.role}</Badge>
        </div>
      </div>

      <Separator />
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column */}
        <div className="lg:col-span-2 space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center"><Clock className="mr-2"/>Live Status & Today's Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    {liveAttendanceEvent ? (
                        <div className="p-4 bg-green-100 dark:bg-green-900/30 rounded-lg text-center">
                            <p className="text-lg font-semibold text-green-800 dark:text-green-300">Currently Checked In</p>
                            <p className="text-3xl font-mono tracking-wider">{formatDurationFromSeconds(liveDuration)}</p>
                            {liveCheckInTime && <p className="text-xs text-muted-foreground">Checked in {formatDistanceToNow(liveCheckInTime, { addSuffix: true })}</p>}
                        </div>
                    ) : (
                        <div className="p-4 bg-gray-100 dark:bg-gray-800/50 rounded-lg text-center">
                             <p className="text-lg font-semibold text-gray-700 dark:text-gray-300">Currently Checked Out</p>
                        </div>
                    )}
                    <Separator />
                     <div>
                        <Label>Total Work Hours Today ({format(new Date(), 'MMM do')})</Label>
                        <p className="text-2xl font-bold">{formatDurationFromMinutes(todayWorkMinutes)}</p>
                        <Progress value={(todayWorkMinutes / ((employee.standardDailyHours || 8) * 60)) * 100} className="mt-2 h-2"/>
                        <p className="text-xs text-muted-foreground text-right">Goal: {employee.standardDailyHours || 8} hours</p>
                     </div>
                </CardContent>
            </Card>
            <Card>
                <CardHeader><CardTitle className="flex items-center"><CalendarCheck className="mr-2"/>Full Monthly Attendance</CardTitle></CardHeader>
                <CardContent>
                     <ScrollArea className="h-72">
                         <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Date</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Check-in</TableHead>
                                    <TableHead>Check-out</TableHead>
                                    <TableHead>Total Hours</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {monthlyAttendance.map(event => (
                                    <TableRow key={event.id}>
                                        <TableCell>{safeParseISO(event.timestamp) ? format(safeParseISO(event.timestamp) as Date, 'PP') : 'N/A'}</TableCell>
                                        <TableCell><Badge variant={event.status === 'Checked In' ? 'destructive' : 'default'}>{event.status}</Badge></TableCell>
                                        <TableCell>{event.checkInTime ? format(safeParseISO(event.checkInTime)!, 'p') : 'N/A'}</TableCell>
                                        <TableCell>{event.checkOutTime ? format(safeParseISO(event.checkOutTime)!, 'p') : 'N/A'}</TableCell>
                                        <TableCell>{event.totalHours ? event.totalHours.toFixed(2) + 'h' : 'N/A'}</TableCell>
                                    </TableRow>
                                ))}
                                {monthlyAttendance.length === 0 && <TableRow><TableCell colSpan={5} className="text-center">No attendance records this month.</TableCell></TableRow>}
                            </TableBody>
                         </Table>
                     </ScrollArea>
                </CardContent>
            </Card>
            <Card>
                 <CardHeader><CardTitle className="flex items-center"><BrainCircuit className="mr-2"/>AI Performance Summary</CardTitle></CardHeader>
                 <CardContent>
                    <Button onClick={handleGenerateSummary} disabled={isGeneratingSummary}>
                        {isGeneratingSummary && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                        Generate AI Summary
                    </Button>
                    {aiSummary && (
                        <div className="mt-4 p-4 border bg-muted/50 rounded-lg whitespace-pre-wrap font-sans text-sm">
                            {aiSummary}
                        </div>
                    )}
                 </CardContent>
            </Card>

             <Card>
                <CardHeader><CardTitle className="flex items-center"><BarChart2 className="mr-2"/>Recent Tasks</CardTitle></CardHeader>
                <CardContent>
                     <Table>
                        <TableHeader>
                            <TableRow><TableHead>Task</TableHead><TableHead>Status</TableHead><TableHead>Priority</TableHead></TableRow>
                        </TableHeader>
                        <TableBody>
                            {employeeTasks?.slice(0, 5).map(task => (
                                <TableRow key={task.id}><TableCell>{task.title}</TableCell><TableCell><Badge>{task.status}</Badge></TableCell><TableCell>{task.priority}</TableCell></TableRow>
                            ))}
                             {employeeTasks?.length === 0 && <TableRow><TableCell colSpan={3} className="text-center">No tasks assigned.</TableCell></TableRow>}
                        </TableBody>
                     </Table>
                </CardContent>
            </Card>
            
            <Card>
                <CardHeader><CardTitle className="flex items-center"><CalendarOff className="mr-2"/>Leave History</CardTitle></CardHeader>
                <CardContent>
                     <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Leave Type</TableHead>
                                <TableHead>Start Date</TableHead>
                                <TableHead>End Date</TableHead>
                                <TableHead>Reason</TableHead>
                                <TableHead>Status</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {employee?.leaves?.map(leave => (
                                <TableRow key={leave.id}>
                                    <TableCell>{format(parseISO(leave.startDate), 'PP')}</TableCell>
                                    <TableCell>{format(parseISO(leave.endDate), 'PP')}</TableCell>
                                    <TableCell>
                                        <TruncatedText text={leave.reason} />
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant={leave.status === 'approved' ? 'default' : leave.status === 'rejected' ? 'destructive' : 'secondary'}>
                                            {leave.status}
                                        </Badge>
                                    </TableCell>
                                </TableRow>
                            ))}
                             {(employee?.leaves?.length || 0) === 0 && <TableRow><TableCell colSpan={5} className="text-center">No leave history found.</TableCell></TableRow>}
                        </TableBody>
                     </Table>
                </CardContent>
            </Card>
        </div>

        {/* Right Column */}
        <div className="space-y-6">
             <Card>
                <CardHeader><CardTitle className="flex items-center"><UserIcon className="mr-2"/>Contact & Info</CardTitle></CardHeader>
                <CardContent className="space-y-2 text-sm">
                    <p><strong className="w-24 inline-block">Employee ID:</strong> <span className="font-mono text-xs">{employee.employeeId}</span></p>
                    <p><strong className="w-24 inline-block">Email:</strong> {employee.email}</p>
                </CardContent>
            </Card>
            <Card>
                <CardHeader><CardTitle className="flex items-center"><IndianRupee className="mr-2" />Today's Estimated Earnings</CardTitle></CardHeader>
                <CardContent>
                    <p className="text-2xl font-bold">₹{dailyEarnings.toFixed(2)}</p>
                    <p className="text-xs text-muted-foreground">Based on hours worked today and monthly salary.</p>
                </CardContent>
            </Card>
            <Card>
                <CardHeader><CardTitle className="flex items-center"><MapPin className="mr-2" />Geofence Compliance</CardTitle></CardHeader>
                <CardContent className="space-y-2 text-sm">
                    <div className="flex justify-between items-center">
                        <span>Check-ins Inside Geofence:</span>
                        <Badge variant="default" className="text-lg">{geofenceStats.checkInInside}</Badge>
                    </div>
                    <div className="flex justify-between items-center">
                        <span>Check-outs Inside Geofence:</span>
                        <Badge variant="default" className="text-lg">{geofenceStats.checkOutInside}</Badge>
                    </div>
                    <div className="flex justify-between items-center">
                        <span>Check-ins Outside Geofence:</span>
                        <Badge variant="destructive" className="text-lg">{geofenceStats.checkInOutside}</Badge>
                    </div>
                    <div className="flex justify-between items-center">
                        <span>Check-outs Outside Geofence:</span>
                        <Badge variant="destructive" className="text-lg">{geofenceStats.checkOutOutside}</Badge>
                    </div>
                </CardContent>
            </Card>
            <Card>
                <CardHeader><CardTitle className="flex items-center"><DollarSign className="mr-2"/>Payroll (This Month)</CardTitle></CardHeader>
                <CardContent className="space-y-2 text-sm">
                    {payrollReport ? (
                        <>
                            <p><strong>Base Salary:</strong> ₹{payrollReport.baseSalary.toFixed(2)}</p>
                            <p><strong>Hours Worked:</strong> {payrollReport.totalActualHoursWorked.toFixed(2)} / {payrollReport.totalStandardHoursForMonth.toFixed(2)}</p>
                            <p><strong>Deductions:</strong> <span className="text-red-500">-₹{payrollReport.calculatedDeductions.toFixed(2)}</span></p>
                            <p><strong>Advances:</strong> <span className="text-red-500">-₹{payrollReport.totalApprovedAdvances.toFixed(2)}</span></p>
                            <Separator className="my-2"/>
                            <p className="font-bold text-base"><strong>Net Payable:</strong> ₹{payrollReport.finalNetPayable.toFixed(2)}</p>
                        </>
                    ) : (
                        <p className="text-muted-foreground">No payroll data to calculate.</p>
                    )}
                </CardContent>
            </Card>
            <Card>
                <CardHeader><CardTitle>Advances</CardTitle></CardHeader>
                 <CardContent>
                     <Table>
                        <TableHeader>
                            <TableRow><TableHead>Amount</TableHead><TableHead>Status</TableHead></TableRow>
                        </TableHeader>
                        <TableBody>
                            {employee.advances?.map(adv => (
                                <TableRow key={adv.id}><TableCell>₹{adv.amount}</TableCell><TableCell><Badge>{adv.status}</Badge></TableCell></TableRow>
                            ))}
                            {!employee.advances?.length && <TableRow><TableCell colSpan={2} className="text-center">No advances taken.</TableCell></TableRow>}
                        </TableBody>
                     </Table>
                </CardContent>
            </Card>
        </div>
      </div>
    </div>
  );
}
