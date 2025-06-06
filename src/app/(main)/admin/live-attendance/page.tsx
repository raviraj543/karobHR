
'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import type { User, AttendanceEvent } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Wifi, WifiOff, Clock, UserCheck, UserX, Users, Loader2, CalendarCheck, AlertTriangle, RefreshCw, Camera as CameraIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatDistanceToNow, differenceInMilliseconds, format, isToday, parseISO } from 'date-fns';
import { formatDuration, isSunday } from '@/lib/dateUtils';


interface EmployeeAttendanceStatus {
  user: User;
  status: 'Checked In' | 'Checked Out' | 'Away';
  lastActivityTime?: string; // ISO string
  lastActivityPhoto?: string | null;
  isWithinGeofence?: boolean | null;
  location?: { latitude: number; longitude: number; accuracy?: number } | null;
  workingHoursToday: string; // Formatted string e.g., "3h 15m" or "Not started"
}


export default function AdminLiveAttendancePage() {
  const { allUsers, attendanceLog, loading: authLoading } = useAuth();
  const [lastRefreshed, setLastRefreshed] = useState(new Date());

  useEffect(() => {
    document.title = 'Live Employee Attendance - Admin - KarobHR';
  }, []);

  const handleRefresh = () => {
    setLastRefreshed(new Date());
  };

  const employeeAttendanceData = useMemo(() => {
    if (authLoading) return [];

    const displayableUsers = allUsers.filter(u => u.role === 'employee' || u.role === 'manager');
    
    const todayDate = new Date(); 
    const todayIsSunday = isSunday(todayDate);

    const todayAttendanceLog = attendanceLog.filter(event => {
      if (event && typeof event.timestamp === 'string' && event.timestamp.length > 0) {
        try {
          const dateObj = parseISO(event.timestamp);
          return isToday(dateObj);
        } catch (e) {
          console.warn(`AdminLiveAttendancePage: Invalid timestamp string for event ${event.id}: ${event.timestamp}`, e);
          return false;
        }
      }
      return false;
    });

    return displayableUsers.map(user => {
      const userEventsToday = todayAttendanceLog
        .filter(event => event.employeeId === user.employeeId)
        .sort((a, b) => {
            try {
                return parseISO(a.timestamp).getTime() - parseISO(b.timestamp).getTime();
            } catch {
                return 0; 
            }
        });

      let status: EmployeeAttendanceStatus['status'] = 'Away';
      let lastActivityTime: string | undefined;
      let lastActivityPhoto: string | null | undefined;
      let isWithinGeofence: boolean | null | undefined;
      let location: EmployeeAttendanceStatus['location'];
      let workingHoursTodayMs = 0;

      if (userEventsToday.length > 0) {
        const latestEvent = userEventsToday[userEventsToday.length -1];
        status = latestEvent.type === 'check-in' ? 'Checked In' : 'Checked Out';
        lastActivityTime = latestEvent.timestamp;
        lastActivityPhoto = latestEvent.photoUrl;
        isWithinGeofence = latestEvent.isWithinGeofence;
        location = latestEvent.location;

        if (todayIsSunday) {
          workingHoursTodayMs = 0;
        } else {
            let lastCheckInTime: Date | null = null;
            for (const event of userEventsToday) {
              try {
                if (event.type === 'check-in') {
                  lastCheckInTime = parseISO(event.timestamp);
                } else if (event.type === 'check-out' && lastCheckInTime) {
                  workingHoursTodayMs += differenceInMilliseconds(parseISO(event.timestamp), lastCheckInTime);
                  lastCheckInTime = null; 
                }
              } catch (e) {
                console.warn(`Error processing timestamp for work hours calculation for event ${event.id}: ${event.timestamp}`);
              }
            }
            if (status === 'Checked In' && lastCheckInTime) {
              workingHoursTodayMs += differenceInMilliseconds(todayDate, lastCheckInTime);
            }
        }
      }
      
      return {
        user,
        status,
        lastActivityTime,
        lastActivityPhoto,
        isWithinGeofence,
        location,
        workingHoursToday: formatDuration(workingHoursTodayMs),
      };
    }).sort((a,b) => (a.user.name || "").localeCompare(b.user.name || ""));
  }, [allUsers, attendanceLog, authLoading, lastRefreshed]);


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
          <p className="text-muted-foreground">Real-time overview of employee check-in/out status and working hours for today. Sundays are excluded from work hour calculations.</p>
        </div>
         <Button onClick={handleRefresh} variant="outline">
           <RefreshCw className="mr-2 h-4 w-4" /> Refresh Data
        </Button>
      </div>
        <p className="text-xs text-muted-foreground">
            Last refreshed: {format(lastRefreshed, "PPpp")}
        </p>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center"><Users className="mr-2 h-5 w-5 text-primary" />Employee Status</CardTitle>
          <CardDescription>
            Current attendance status and activity for all employees and managers. Working hours are calculated for today's entries (Sundays excluded).
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
                <TableHead>Working Hours (Today)</TableHead>
                <TableHead className="hidden md:table-cell">Location (Lat, Lon)</TableHead>
                <TableHead className="text-center hidden sm:table-cell">Photo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {employeeAttendanceData.map(({ user: empUser, status, lastActivityTime, lastActivityPhoto, isWithinGeofence, location, workingHoursToday }) => (
                <TableRow key={empUser.id} className="hover:bg-muted/50 transition-colors">
                  <TableCell>
                    <div className="flex items-center space-x-3">
                      <Avatar className="h-9 w-9 border" data-ai-hint="avatar person">
                        <AvatarImage src={empUser.profilePictureUrl || undefined} alt={empUser.name || 'User'} />
                        <AvatarFallback>{empUser.name ? empUser.name.split(' ').map(n=>n[0]).join('') : 'U'}</AvatarFallback>
                      </Avatar>
                      <div>
                        <span className="font-medium">{empUser.name || 'N/A'}</span>
                        <p className="text-xs text-muted-foreground font-mono">{empUser.employeeId}</p>
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
                    {lastActivityTime ? 
                        (() => {
                            try {
                                return (
                                    <>
                                        {format(parseISO(lastActivityTime), 'p')}
                                        <span className="text-xs block">({formatDistanceToNow(parseISO(lastActivityTime), { addSuffix: true })})</span>
                                    </>
                                );
                            } catch {
                                return 'Invalid date';
                            }
                        })()
                         : 'N/A'}
                  </TableCell>
                  <TableCell>
                    {isWithinGeofence === undefined || isWithinGeofence === null ? <Badge variant="outline">N/A</Badge> :
                     isWithinGeofence ? 
                     <Badge variant="default" className="bg-green-600 hover:bg-green-700"><Wifi className="mr-1 h-3 w-3"/> Within</Badge> : 
                     <Badge variant="destructive"><WifiOff className="mr-1 h-3 w-3"/> Outside</Badge>}
                  </TableCell>
                  <TableCell className="font-medium">
                    <Clock className="inline-block mr-1.5 h-4 w-4 text-primary/80" />
                    {workingHoursToday}
                  </TableCell>
                   <TableCell className="text-xs text-muted-foreground hidden md:table-cell">
                    {location ? `${location.latitude.toFixed(3)}, ${location.longitude.toFixed(3)}` : 'N/A'}
                    {location?.accuracy && ` (±${location.accuracy.toFixed(0)}m)`}
                  </TableCell>
                  <TableCell className="text-center hidden sm:table-cell">
                    {lastActivityPhoto ? (
                        <Avatar className="h-9 w-9 border mx-auto" data-ai-hint="face scan">
                            <AvatarImage src={lastActivityPhoto} alt="Activity photo" />
                            <AvatarFallback><CameraIcon className="h-4 w-4 text-muted-foreground" /></AvatarFallback>
                        </Avatar>
                    ) : <span className="text-xs text-muted-foreground">-</span>}
                  </TableCell>
                </TableRow>
              ))}
              {employeeAttendanceData.length === 0 && !authLoading && (
                 <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
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
