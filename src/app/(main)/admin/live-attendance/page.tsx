
'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import type { User, AttendanceEvent } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Wifi, WifiOff, Clock, UserCheck, UserX, Users, Loader2, AlertTriangle, RefreshCw, FileText } from 'lucide-react';
import { formatDistanceToNow, differenceInMilliseconds, format, isToday, parseISO } from 'date-fns';
import { formatDuration } from '@/lib/dateUtils';

interface EmployeeAttendanceStatus {
  user: User;
  status: 'Checked In' | 'Checked Out' | 'Away';
  lastActivityTime?: string;
  isWithinGeofence?: boolean | null;
  location?: { latitude: number; longitude: number; accuracy?: number } | null;
  workingHoursToday: string;
  liveCheckInTime?: string;
  workReport?: string | null; // Added work report field
}

const LiveDuration = ({ checkInTime }: { checkInTime: string }) => {
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    try {
      const checkInDate = parseISO(checkInTime);
      const interval = setInterval(() => {
        setDuration(differenceInMilliseconds(new Date(), checkInDate));
      }, 1000);
      return () => clearInterval(interval);
    } catch (e) {
      return;
    }
  }, [checkInTime]);

  if (duration < 0) return <span>-</span>;

  const h = Math.floor(duration / (1000 * 60 * 60));
  const m = Math.floor((duration % (1000 * 60 * 60)) / (1000 * 60));
  const s = Math.floor((duration % (1000 * 60)) / 1000);

  return <span className="font-mono">{`${h}h ${m}m ${s}s`}</span>;
};

export default function AdminLiveAttendancePage() {
  const { allUsers, attendanceLog, loading: authLoading } = useAuth();
  const [lastRefreshed, setLastRefreshed] = useState(new Date());

  useEffect(() => {
    document.title = 'Live Employee Attendance - Admin - KarobHR';
    const timer = setInterval(() => {
      setLastRefreshed(new Date());
    }, 10000); // Auto-refresh every 10 seconds

    return () => clearInterval(timer);
  }, []);

  const employeeAttendanceData: EmployeeAttendanceStatus[] = useMemo(() => {
    if (authLoading) return [];

    const displayableUsers = allUsers.filter(u => u.role === 'employee' || u.role === 'manager');
    const todayDate = new Date();

    return displayableUsers.map(user => {
      const userEvents = attendanceLog
        .filter(event => event.userId === user.id && event.timestamp)
        .sort((a, b) => parseISO(b.timestamp).getTime() - parseISO(a.timestamp).getTime());

      const latestEvent = userEvents[0];
      const userEventsToday = userEvents.filter(event => event.timestamp && isToday(parseISO(event.timestamp)));

      let status: EmployeeAttendanceStatus['status'] = 'Away';
      let lastActivityTime: string | undefined;
      let isWithinGeofence: boolean | null | undefined;
      let location: EmployeeAttendanceStatus['location'];
      let liveCheckInTime: string | undefined;
      let totalHoursToday = 0;  // Track in total hours
      let dailyWorkReport: string | null | undefined; // Variable for the report

       // Add up totalHours from 'Checked Out' events and calculate live duration
       userEventsToday.forEach(event => {
          if (event.status === 'Checked Out' && event.totalHours !== undefined && event.totalHours !== null) {
             totalHoursToday += event.totalHours;
          }
       });

       // Handle live check-in
       const liveEvent = userEventsToday.find(event => event.type === 'check-in' && event.status === 'Checked In');
       if (liveEvent && liveEvent.timestamp) {
          const checkInDate = parseISO(liveEvent.timestamp);
           if (isToday(checkInDate)) {
               const currentSessionDurationMs = todayDate.getTime() - checkInDate.getTime();
               const currentSessionDurationHours = currentSessionDurationMs / (1000 * 60 * 60); // Convert to hours
               totalHoursToday += currentSessionDurationHours; // Add live session duration
               liveCheckInTime = liveEvent.timestamp; // Set for LiveDuration component
           }
       }

      // Find the latest checked-out event today to get the report
      const latestCheckoutEventToday = userEventsToday.find(event => event.type === 'check-out' && event.workReport);
      if(latestCheckoutEventToday) {
          dailyWorkReport = latestCheckoutEventToday.workReport; // Extract the report
      }


      if (latestEvent) {
        status = latestEvent.type === 'check-in' ? 'Checked In' : 'Checked Out';
        lastActivityTime = latestEvent.timestamp;
        isWithinGeofence = latestEvent.isWithinGeofence;
        location = latestEvent.checkInLocation;
        // Note: liveCheckInTime and dailyWorkReport are already set above
      }

      return {
        user,
        status,
        lastActivityTime,
        isWithinGeofence,
        location,
        liveCheckInTime,
        workingHoursToday: formatDuration(totalHoursToday * 60 * 60 * 1000), // Format total hours into a duration
        workReport: dailyWorkReport, // Include the work report in the status object
      };
    }).sort((a,b) => (a.user.name || "").localeCompare(b.user.name || ""));
  }, [allUsers, attendanceLog, authLoading, lastRefreshed]); // Add attendanceLog as dependency


  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-full py-10">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-2 text-muted-foreground">Loading attendance data...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Live Employee Attendance</h1>
          <p className="text-muted-foreground">Real-time overview of employee check-in/out status. This page updates automatically.</p>
        </div>
      </div>
        <p className="text-xs text-muted-foreground flex items-center">
            <RefreshCw className="mr-2 h-3 w-3 animate-spin" style={{ animationDuration: '10s' }}/>
            Last updated: {format(lastRefreshed, "PPpp")}
        </p>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center"><Users className="mr-2 h-5 w-5 text-primary" />Employee Status</CardTitle>
          <CardDescription>
            Current attendance status and activity for all employees and managers.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last Activity</TableHead>
                <TableHead>Geofence</TableHead>
                <TableHead>Live Session Duration</TableHead>
                <TableHead>Total Hours (Today)</TableHead>
                <TableHead>Daily Report</TableHead>{/* Added new table header */}
              </TableRow>
            </TableHeader>
            <TableBody>
              {employeeAttendanceData.map(({ user, status, lastActivityTime, isWithinGeofence, liveCheckInTime, workingHoursToday, workReport }) => ( // Destructure workReport
                <TableRow key={user.id} className="hover:bg-muted/50 transition-colors">
                  <TableCell>
                    <div className="flex items-center space-x-3">
                      <Avatar className="h-9 w-9 border">
                        <AvatarImage src={user.profilePictureUrl || undefined} alt={user.name || 'User'} />
                        <AvatarFallback>{user.name ? user.name.split(' ').map(n=>n[0]).join('') : 'U'}</AvatarFallback>
                      </Avatar>
                      <div>
                        <span className="font-medium">{user.name || 'N/A'}</span>
                        <p className="text-xs text-muted-foreground font-mono">{user.employeeId}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={status === 'Checked In' ? 'default' : status === 'Checked Out' ? 'secondary' : 'outline'} className="capitalize">
                      {status === 'Checked In' && <UserCheck className="mr-1.5 h-3.5 w-3.5" />}
                      {status === 'Checked Out' && <UserX className="mr-1.5 h-3.5 w-3.5" />}
                       {status === 'Away' && <AlertTriangle className="mr-1.5 h-3.5 w-3.5" />}
                      {status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {lastActivityTime ? formatDistanceToNow(parseISO(lastActivityTime), { addSuffix: true }) : 'N/A'}
                  </TableCell>
                  <TableCell>
                    {isWithinGeofence === undefined || isWithinGeofence === null ? <Badge variant="outline">N/A</Badge> :
                     isWithinGeofence ? 
                     <Badge variant="default" className="bg-green-600 hover:bg-green-700"><Wifi className="mr-1 h-3 w-3"/> Within</Badge> : 
                     <Badge variant="destructive"><WifiOff className="mr-1 h-3 w-3"/> Outside</Badge>}
                  </TableCell>
                  <TableCell>
                    {status === 'Checked In' && liveCheckInTime ? <LiveDuration checkInTime={liveCheckInTime} /> : <span className="text-xs text-muted-foreground">-</span>}
                  </TableCell>
                  <TableCell className="font-medium">
                     <Clock className="inline-block mr-1.5 h-4 w-4 text-primary/80" />
                     {workingHoursToday}
                  </TableCell>
                   <TableCell className="text-sm">
                      {workReport ? (
                          <div className="flex items-center"><FileText className="mr-1.5 h-3.5 w-3.5 text-muted-foreground" /> {workReport}</div>
                      ) : (
                          <span className="text-muted-foreground text-xs">No report filed today.</span>
                      )}
                   </TableCell>{/* Added new table cell */}
                </TableRow>
              ))}
              {employeeAttendanceData.length === 0 && !authLoading && (
                 <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8"> {/* Updated colspan */}
                      No employee attendance data available for today.
                    </TableCell>
                 </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
