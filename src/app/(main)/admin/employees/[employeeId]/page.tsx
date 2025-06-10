
'use client';

import { useParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useState, useEffect, useMemo } from 'react';
import type { User, AttendanceEvent, Task, MonthlyPayrollReport } from '@/lib/types';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Loader2, User as UserIcon, Mail, Clock, DollarSign, BarChart2, BrainCircuit, MapPin } from 'lucide-react';
import { format, differenceInMinutes, differenceInSeconds, parseISO, formatDistanceToNow } from 'date-fns';
import { Label } from '@/components/ui/label';
import { Timestamp } from 'firebase/firestore';


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
    // Check if the date is valid
    if (isNaN(date.getTime())) {
      return null;
    }
    return date;
  } catch (error) {
    console.warn("Could not parse date string:", dateString, error);
    return null;
  }
};


// Helper to calculate total work duration for a set of events
const calculateTotalWorkMinutes = (events: AttendanceEvent[]) => {
  return events.reduce((acc, event) => {
    if (event.status === 'Checked Out' && event.checkInTime && event.checkOutTime) {
      const checkIn = safeParseISO(event.checkInTime);
      const checkOut = safeParseISO(event.checkOutTime);
      if (checkIn && checkOut) {
        return acc + differenceInMinutes(checkOut, checkIn);
      }
    }
    return acc;
  }, 0);
};

export default function EmployeeDetailPage() {
  const params = useParams();
  const { allUsers, attendanceLog, tasks, calculateMonthlyPayrollDetails, companySettings, loading: authLoading } = useAuth();

  const employeeId = params.employeeId as string;

  const [employee, setEmployee] = useState<User | null>(null);
  const [employeeTasks, setEmployeeTasks] = useState<Task[]>([]);
  const [employeeAttendance, setEmployeeAttendance] = useState<AttendanceEvent[]>([]);
  const [liveDuration, setLiveDuration] = useState<number>(0);
  const [payrollReport, setPayrollReport] = useState<MonthlyPayrollReport | null>(null);
  const [aiSummary, setAiSummary] = useState<string>('');
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [geofenceStats, setGeofenceStats] = useState({ inside: 0, outside: 0 });

  // Find the employee and their data from context
  useEffect(() => {
    if (allUsers.length > 0) {
      const foundEmployee = allUsers.find(u => u.employeeId === employeeId) || null;
      setEmployee(foundEmployee);
      
      if (foundEmployee) {
        setEmployeeTasks(tasks.filter(t => t.assigneeId === foundEmployee.employeeId));
        const attendance = attendanceLog.filter(a => a.userId === foundEmployee.id);
        setEmployeeAttendance(attendance);

        // Calculate geofence stats
        const stats = attendance.reduce((acc, event) => {
            if (event.type === 'check-in') {
                if (event.isWithinGeofence) {
                    acc.inside++;
                } else {
                    acc.outside++;
                }
            }
            return acc;
        }, { inside: 0, outside: 0 });
        setGeofenceStats(stats);
      }
    }
  }, [allUsers, tasks, attendanceLog, employeeId]);

  // Live status and duration calculation
  const liveAttendanceEvent = useMemo(() => 
    employeeAttendance.find(e => e.status === 'Checked In'),
  [employeeAttendance]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    const checkInTime = safeParseISO(liveAttendanceEvent?.checkInTime);
    if (checkInTime) {
      interval = setInterval(() => {
        setLiveDuration(differenceInSeconds(new Date(), checkInTime));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [liveAttendanceEvent]);

  // Payroll Calculation
  useEffect(() => {
    if (employee && employeeAttendance.length > 0 && companySettings) {
      const now = new Date();
      const report = calculateMonthlyPayrollDetails(employee, now.getFullYear(), now.getMonth(), employeeAttendance, []);
      setPayrollReport(report);
    }
  }, [employee, employeeAttendance, companySettings, calculateMonthlyPayrollDetails]);
  
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
                tasks: employeeTasks.map(t => ({ title: t.title, status: t.status, priority: t.priority, dueDate: t.dueDate, description: t.description })),
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

  if (authLoading || !employee) {
    return (
      <div className="flex items-center justify-center h-full py-10">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-2 text-muted-foreground">Loading Employee Data...</p>
      </div>
    );
  }

  const formatDurationFromSeconds = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return `${h}h ${m}m ${s}s`;
  };

  const today = new Date();
  const todaysEvents = employeeAttendance.filter(e => {
    const checkInDate = safeParseISO(e.checkInTime);
    return checkInDate && format(checkInDate, 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd');
  });
  const todayWorkMinutes = calculateTotalWorkMinutes(todaysEvents);
  
  const liveCheckInTime = safeParseISO(liveAttendanceEvent?.checkInTime);


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
                    {liveCheckInTime ? (
                        <div className="p-4 bg-green-100 dark:bg-green-900/30 rounded-lg text-center">
                            <p className="text-lg font-semibold text-green-800 dark:text-green-300">Currently Checked In</p>
                            <p className="text-3xl font-mono tracking-wider">{formatDurationFromSeconds(liveDuration)}</p>
                            <p className="text-xs text-muted-foreground">Checked in {formatDistanceToNow(liveCheckInTime, { addSuffix: true })}</p>
                        </div>
                    ) : (
                        <div className="p-4 bg-gray-100 dark:bg-gray-800/50 rounded-lg text-center">
                             <p className="text-lg font-semibold text-gray-700 dark:text-gray-300">Currently Checked Out</p>
                        </div>
                    )}
                    <Separator />
                     <div>
                        <Label>Total Work Hours Today ({format(today, 'MMM do')})</Label>
                        <p className="text-2xl font-bold">{Math.floor(todayWorkMinutes / 60)}h {todayWorkMinutes % 60}m</p>
                        <Progress value={(todayWorkMinutes / ((employee.standardDailyHours || 8) * 60)) * 100} className="mt-2 h-2"/>
                        <p className="text-xs text-muted-foreground text-right">Goal: {employee.standardDailyHours || 8} hours</p>
                     </div>
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
                            {employeeTasks.slice(0, 5).map(task => (
                                <TableRow key={task.id}><TableCell>{task.title}</TableCell><TableCell><Badge>{task.status}</Badge></TableCell><TableCell>{task.priority}</TableCell></TableRow>
                            ))}
                             {employeeTasks.length === 0 && <TableRow><TableCell colSpan={3} className="text-center">No tasks assigned.</TableCell></TableRow>}
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
                <CardHeader><CardTitle className="flex items-center"><MapPin className="mr-2" />Geofence Compliance</CardTitle></CardHeader>
                <CardContent className="space-y-2 text-sm">
                    <div className="flex justify-between items-center">
                        <span>Check-ins Inside Geofence:</span>
                        <Badge variant="default" className="text-lg">{geofenceStats.inside}</Badge>
                    </div>
                    <div className="flex justify-between items-center">
                        <span>Check-ins Outside Geofence:</span>
                        <Badge variant="destructive" className="text-lg">{geofenceStats.outside}</Badge>
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
