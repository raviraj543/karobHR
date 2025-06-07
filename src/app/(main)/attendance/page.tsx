
"use client";

import { useState, useEffect, useRef, useMemo } from 'react';
import { getFirebaseInstances } from '@/lib/firebase/firebase'; // Corrected import
import { collection, addDoc, query, where, getDocs, updateDoc, doc, Timestamp, GeoPoint, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { ref, uploadString, getDownloadURL } from 'firebase/storage';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Camera, MapPin, LogIn, LogOut, Briefcase, ListChecks, FileText, CheckSquare, Loader2, AlertCircle, Upload, Send, PlusCircle, XCircle } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { summarizeEmployeeTasks, type SummarizeEmployeeTasksInput } from '@/ai/flows/summarize-employee-tasks';
import type { Task as TaskType, AttendanceEvent, LocationInfo } from '@/lib/types';
import { calculateDistance } from '@/lib/locationUtils';
import { v4 as uuidv4 } from 'uuid';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { format, parseISO, isToday, formatDistanceToNow } from 'date-fns';


export default function AttendancePage() {
  const { user, loading: authLoading, companySettings, addAttendanceEvent, tasks: allContextTasks } = useAuth();
  const { toast } = useToast();

  const firebaseInstances = useMemo(() => {
    try {
      return getFirebaseInstances();
    } catch (error) {
      console.error(">>> KAROBHR TRACE: Error getting Firebase instances in AttendancePage:", error);
      toast({
        title: "Firebase Error",
        description: "Could not initialize Firebase services. Attendance functionality may be unavailable.",
        variant: "destructive",
      });
      return { auth: undefined, db: undefined, storage: undefined, error: error as Error };
    }
  }, [toast]);

  const db = firebaseInstances?.db;
  const storage = firebaseInstances?.storage;
  // auth from useAuth is usually preferred.

  const [checkInStatus, setCheckInStatus] = useState<'checked-in' | 'checked-out' | 'unknown'>('unknown');
  const [isSubmittingAttendance, setIsSubmittingAttendance] = useState<boolean>(false);
  const [isSubmittingTasks, setIsSubmittingTasks] = useState<boolean>(false);
  
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [dailyTasks, setDailyTasks] = useState<string[]>(['']);
  const [taskSummary, setTaskSummary] = useState<string | null>(null);
  const [tasksSubmittedForDay, setTasksSubmittedForDay] = useState(false);
  const checkInStatusRef = useRef(checkInStatus);

  const [myTodaysAttendanceEvents, setMyTodaysAttendanceEvents] = useState<AttendanceEvent[]>([]);

  useEffect(() => {
    checkInStatusRef.current = checkInStatus;
  }, [checkInStatus]);

  useEffect(() => {
    document.title = `My Attendance - BizFlow`;
  }, []);

  useEffect(() => {
    if (!db || !user || !user.companyId) {
      setMyTodaysAttendanceEvents([]);
      return;
    }
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const q = query(
      collection(db, `companies/${user.companyId}/attendanceLog`),
      where('userId', '==', user.id),
      where('timestamp', '>=', Timestamp.fromDate(todayStart)),
      where('timestamp', '<=', Timestamp.fromDate(todayEnd))
    );

    console.log(`>>> KAROBHR TRACE: AttendancePage - Setting up listener for today's events for user ${user.id} in company ${user.companyId}`);
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const events: AttendanceEvent[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        events.push({
          id: doc.id,
          ...data,
          timestamp: (data.timestamp as Timestamp).toDate().toISOString(),
        } as AttendanceEvent);
      });
      events.sort((a, b) => parseISO(a.timestamp).getTime() - parseISO(b.timestamp).getTime());
      setMyTodaysAttendanceEvents(events);
      console.log(">>> KAROBHR TRACE: AttendancePage - myTodaysAttendanceEvents updated:", events);
    }, (error) => {
      console.error(">>> KAROBHR TRACE: Error fetching today's attendance events:", error);
      toast({ title: "Error loading attendance", description: "Could not load today's attendance history.", variant: "destructive" });
    });
    return () => {
      console.log(">>> KAROBHR TRACE: AttendancePage - Unsubscribing from today's attendance events listener.");
      unsubscribe();
    };
  }, [db, user, toast]);

  useEffect(() => {
    console.log(">>> KAROBHR TRACE: AttendancePage Effect for checkInStatus running. User:", user?.employeeId, "myTodaysAttendanceEvents count:", myTodaysAttendanceEvents.length);
    if (!user) {
      setCheckInStatus('unknown');
      return;
    }
    const previousRenderStatus = checkInStatusRef.current;
    let newDerivedStatus: 'checked-in' | 'checked-out' = 'checked-out';

    if (myTodaysAttendanceEvents.length > 0) {
      const latestEvent = myTodaysAttendanceEvents[myTodaysAttendanceEvents.length - 1];
      if (latestEvent.type === 'check-in') {
        newDerivedStatus = 'checked-in';
      } else {
        newDerivedStatus = 'checked-out';
      }
    }
    console.log(`>>> KAROBHR TRACE: Derived status: ${newDerivedStatus}. Previous render status: ${previousRenderStatus}. Current state status: ${checkInStatus}`);

    if (newDerivedStatus !== checkInStatus) {
      setCheckInStatus(newDerivedStatus);
      console.log(`>>> KAROBHR TRACE: setCheckInStatus to ${newDerivedStatus}`);
    }

    if (previousRenderStatus === 'checked-in' && newDerivedStatus === 'checked-out') {
      console.log(">>> KAROBHR TRACE: User transitioned from checked-in to checked-out. Resetting tasks for the day.");
      setDailyTasks(['']);
      setTaskSummary(null);
      setTasksSubmittedForDay(false);
    }
    checkInStatusRef.current = newDerivedStatus;

  }, [user, myTodaysAttendanceEvents]); // Removed checkInStatus dependency

  useEffect(() => {
    const getCameraPermission = async () => {
      if (checkInStatus === 'checked-out' && typeof navigator !== "undefined" && navigator.mediaDevices) { // Only request if checked out
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: true });
          setHasCameraPermission(true);
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            streamRef.current = stream;
          }
        } catch (error) {
          console.error('Error accessing camera:', error);
          setHasCameraPermission(false);
          toast({
            variant: 'destructive',
            title: 'Camera Access Denied',
            description: 'Please enable camera permissions in your browser settings to perform check-in.',
          });
        }
      } else if (checkInStatus === 'checked-in') {
        stopCameraStream(); // Stop stream if already checked in
      } else if (typeof navigator === "undefined" || !navigator.mediaDevices) {
         setHasCameraPermission(false);
         // Consider if toast is needed here if camera is not supported system-wide
         // toast({ title: "Camera Not Supported", description: "Camera access is not supported on this device or browser.", variant: "destructive" });
      }
    };
    getCameraPermission();
    return () => {
      stopCameraStream();
    };
  }, [toast, checkInStatus]); // Add checkInStatus dependency

  const stopCameraStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
      if (videoRef.current) videoRef.current.srcObject = null;
      console.log(">>> KAROBHR TRACE: Camera stream stopped.");
    }
  };

  const verifyGeofence = async (locationType: 'office' | 'remote'): Promise<LocationInfo | null> => {
    console.log(">>> KAROBHR TRACE: Verifying geofence. Type:", locationType);
    if (!companySettings && locationType === 'office') {
      toast({ title: "Configuration Error", description: "Company office location not set by admin.", variant: "destructive" });
      return null;
    }
    if (!user?.remoteWorkLocation && locationType === 'remote') {
        return null;
    }

    const targetLocation = locationType === 'office' ? companySettings?.officeLocation : user?.remoteWorkLocation;

    if (!targetLocation || targetLocation.latitude === undefined || targetLocation.longitude === undefined || !targetLocation.radius) {
      toast({ title: "Location Not Configured", description: `The ${locationType} location details are not fully configured.`, variant: "destructive" });
      return null;
    }

    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        });
      });
      const { latitude, longitude, accuracy } = position.coords;
      const distance = calculateDistance(latitude, longitude, targetLocation.latitude, targetLocation.longitude);
      console.log(`>>> KAROBHR TRACE: Current location: ${latitude}, ${longitude}. Target ${locationType} (${targetLocation.name || 'N/A'}): ${targetLocation.latitude}, ${targetLocation.longitude}. Distance: ${distance.toFixed(0)}m. Radius: ${targetLocation.radius}m`);

      if (distance > targetLocation.radius) {
        toast({
          title: "Out of Geofence",
          description: `You are ${Math.round(distance)}m away from the ${targetLocation.name || locationType} location. Must be within ${targetLocation.radius}m.`,
          variant: "destructive",
        });
        return null;
      }
      return { latitude, longitude, accuracy };
    } catch (error: any) {
      console.error('>>> KAROBHR TRACE: Geolocation error:', error.message);
      toast({
        title: 'Location Error',
        description: `Could not get your location: ${error.message}. Please enable location services.`,
        variant: 'destructive',
      });
      return null;
    }
  };

  const handleActualCheckInOrOut = async (type: 'check-in' | 'check-out', reportText: string | null = null, photoDataUrlString: string | null = null) => {
    console.log(`>>> KAROBHR TRACE: handleActualCheckInOrOut called. Type: ${type}. Current checkInStatus (from state): ${checkInStatus}`);
    if (!user || !user.companyId) {
      toast({ title: "Error", description: "User or company information is missing.", variant: "destructive" });
      setIsSubmittingAttendance(false); 
      return;
    }
    setIsSubmittingAttendance(true);

    let verifiedLocation: LocationInfo | null = null;
    // This logic for geofence already exists in addAttendanceEvent in AuthContext based on provided location
    // We only need to get current location here to pass to addAttendanceEvent.

    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        });
      });
      verifiedLocation = { latitude: position.coords.latitude, longitude: position.coords.longitude, accuracy: position.coords.accuracy };
    } catch (error: any) {
      console.error('>>> KAROBHR TRACE: Geolocation error before calling addAttendanceEvent:', error.message);
      toast({
        title: 'Location Error',
        description: `Could not get your location: ${error.message}. Please enable location services.`,
        variant: 'destructive',
      });
      setIsSubmittingAttendance(false);
      return;
    }


    try {
      const eventDataForAuthContext: Omit<AttendanceEvent, 'id' | 'userId' | 'employeeId' | 'userName' | 'timestamp' | 'isWithinGeofence' | 'matchedGeofenceType'> & { photoDataUrl?: string | null } = {
        type: type,
        location: verifiedLocation, // Pass the obtained location
      };
      if (type === 'check-in' && photoDataUrlString) {
        eventDataForAuthContext.photoDataUrl = photoDataUrlString;
      }
      
      // addAttendanceEvent in AuthContext will handle geofence verification based on 'verifiedLocation'
      // and companySettings / user.remoteWorkLocation available in AuthContext.
      await addAttendanceEvent(eventDataForAuthContext);

      toast({ title: `${type === 'check-in' ? 'Check-In' : 'Check-Out'} Successful!`, description: `Your ${type} has been recorded.` });
      
      if (type === 'check-in') {
        stopCameraStream();
      }
    } catch (error) {
      // If addAttendanceEvent throws due to geofence or other issues, it will be caught here.
      // The toast from addAttendanceEvent might be more specific.
      console.error(`>>> KAROBHR TRACE: Error during ${type} (potentially from addAttendanceEvent):`, error);
      if (!(error as Error).message.includes("Out of Geofence")) { // Avoid double toast for geofence
        toast({ title: `${type === 'check-in' ? 'Check-In' : 'Check-Out'} Failed`, description: (error as Error).message || "Could not save your attendance.", variant: 'destructive' });
      }
    } finally {
      setIsSubmittingAttendance(false);
    }
  };

  const handleCheckInFlow = async () => {
    console.log(">>> KAROBHR TRACE: Check In button clicked. Current checkInStatus (from state variable):", checkInStatus);
    if (checkInStatus === 'checked-in') {
        toast({ title: "Already Checked In", description: "You have already checked in today." });
        return;
    }
    if (!hasCameraPermission || !canvasRef.current || !videoRef.current || !videoRef.current.srcObject) {
      toast({ title: "Camera Not Ready", description: "Camera is not available or permission denied.", variant: "destructive" });
      return;
    }

    const context = canvasRef.current.getContext('2d');
    if (!context) {
      toast({ title: "Error", description: "Could not initialize photo capture.", variant: "destructive" });
      return;
    }
    context.drawImage(videoRef.current, 0, 0, canvasRef.current.width, canvasRef.current.height);
    const photoDataUrl = canvasRef.current.toDataURL('image/jpeg', 0.8);
    
    await handleActualCheckInOrOut('check-in', null, photoDataUrl);
  };

  const handleAddTask = () => setDailyTasks([...dailyTasks, '']);
  const handleTaskChange = (index: number, value: string) => {
    const newTasks = [...dailyTasks];
    newTasks[index] = value;
    setDailyTasks(newTasks);
  };
  const handleRemoveTask = (index: number) => {
    if (dailyTasks.length > 1) {
      const newTasks = dailyTasks.filter((_, i) => i !== index);
      setDailyTasks(newTasks);
    } else {
      setDailyTasks(['']);
    }
  };

  const handleTaskReportAndCheckout = async () => {
    console.log(">>> KAROBHR TRACE: Check Out / Submit Report button clicked. Current checkInStatus (from state variable):", checkInStatus, "tasksSubmittedForDay:", tasksSubmittedForDay);
    if (checkInStatus === 'checked-out') {
        toast({ title: "Not Checked In", description: "You need to check in first." });
        return;
    }

    if (!tasksSubmittedForDay) {
      const tasksToSummarize = dailyTasks.filter(task => task.trim() !== '').map(task => ({
        title: "User-reported task",
        description: task,
        status: 'Completed' as 'Completed',
      }));

      if (tasksToSummarize.length === 0) {
        toast({ title: "No Tasks Entered", description: "Please enter at least one task.", variant: "destructive" });
        return;
      }
      setIsSubmittingTasks(true);
      try {
        const summaryInput: SummarizeEmployeeTasksInput = { tasks: tasksToSummarize };
        const result = await summarizeEmployeeTasks(summaryInput);
        setTaskSummary(result.summary);
        setTasksSubmittedForDay(true);
        toast({ title: "Task Report Submitted!", description: "Your daily task summary has been generated. Now proceeding to check out." });
        await handleActualCheckInOrOut('check-out', result.summary, null);

      } catch (err) {
        console.error(">>> KAROBHR TRACE: Error generating task summary:", err);
        toast({ title: "Task Summary Failed", description: (err as Error).message || "Could not generate task summary.", variant: "destructive" });
      } finally {
        setIsSubmittingTasks(false);
      }
    } else {
        await handleActualCheckInOrOut('check-out', taskSummary, null);
    }
  };

  console.log(">>> KAROBHR TRACE: AttendancePage RENDER - checkInStatus:", checkInStatus, "| myTodaysAttendanceEvents count:", myTodaysAttendanceEvents.length, "| tasksSubmittedForDay:", tasksSubmittedForDay, "| authLoading:", authLoading, "| hasCameraPermission:", hasCameraPermission);

  if (authLoading || checkInStatus === 'unknown') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground">Loading attendance status...</p>
      </div>
    );
  }
  
  return (
    <div className="space-y-6 p-4 md:p-6 max-w-3xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl flex items-center">
            <MapPin className="mr-3 h-6 w-6 text-primary" /> My Attendance
          </CardTitle>
          <CardDescription>
            {checkInStatus === 'checked-out' ? "Use the camera to capture your photo and check in for the day." : "You are currently checked in. Submit your daily report to check out."}
            Geofencing is active for both check-in and check-out.
          </CardDescription>
        </CardHeader>
      </Card>

      {checkInStatus === 'checked-out' && (
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center"><Camera className="mr-2 h-5 w-5 text-primary"/>Photo Check-In</CardTitle>
            <CardDescription>Align your face within the frame and click "Check In".</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="aspect-video w-full max-w-md mx-auto bg-muted rounded-lg overflow-hidden border shadow-inner">
              <video ref={videoRef} className="w-full h-full object-cover" autoPlay playsInline muted />
              <canvas ref={canvasRef} className="hidden" width="640" height="480"></canvas>
            </div>
            {hasCameraPermission === false && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Camera Permission Needed</AlertTitle>
                <AlertDescription>
                  Camera access is denied or unavailable. Please enable camera permissions in your browser settings.
                  You may need to refresh the page after granting permission.
                </AlertDescription>
              </Alert>
            )}
            <Button
              size="lg"
              className="w-full"
              onClick={handleCheckInFlow}
              disabled={isSubmittingAttendance || isSubmittingTasks || checkInStatus === 'checked-in' || hasCameraPermission !== true}
            >
              {(isSubmittingAttendance) && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
              <LogIn className="mr-2 h-5 w-5" /> Check In
            </Button>
          </CardContent>
        </Card>
      )}

      {checkInStatus === 'checked-in' && (
         <Card className="shadow-lg">
            <CardHeader>
                <CardTitle className="flex items-center">
                <ListChecks className="mr-2 h-5 w-5 text-primary" /> Daily Task Report & Check-Out
                </CardTitle>
                <CardDescription>
                List your completed tasks for today. This report will be submitted when you check out.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
            {!tasksSubmittedForDay ? (
              <div className="space-y-4">
                {dailyTasks.map((task, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <Textarea
                      placeholder={`Task ${index + 1} details...`}
                      value={task}
                      onChange={(e) => handleTaskChange(index, e.target.value)}
                      rows={2}
                      className="flex-grow bg-background"
                    />
                    {dailyTasks.length > 1 && (
                      <Button variant="ghost" size="icon" onClick={() => handleRemoveTask(index)} aria-label="Remove task">
                        <XCircle className="h-5 w-5 text-destructive" />
                      </Button>
                    )}
                  </div>
                ))}
                <div className="flex justify-between items-center">
                    <Button variant="outline" onClick={handleAddTask} disabled={isSubmittingTasks || isSubmittingAttendance}>
                        <PlusCircle className="mr-2 h-4 w-4" /> Add Task Item
                    </Button>
                </div>
              </div>
            ) : taskSummary && (
              <Card className="bg-muted/50 shadow-inner">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center"><CheckSquare className="mr-2 h-5 w-5 text-green-600"/>Report Submitted</CardTitle>
                  <CardDescription>Your task summary for the day:</CardDescription>
                </CardHeader>
                <CardContent>
                  <div
                    className="prose prose-sm max-w-none text-foreground whitespace-pre-wrap"
                    dangerouslySetInnerHTML={{ __html: taskSummary.replace(/\n\*(?!\*)/g, '<br />• ').replace(/\n/g, '<br />') }}
                  />
                </CardContent>
              </Card>
            )}

            <Button
                size="lg"
                variant={tasksSubmittedForDay ? "default" : "outline"} 
                className="w-full"
                onClick={handleTaskReportAndCheckout}
                disabled={isSubmittingAttendance || isSubmittingTasks || checkInStatus === 'checked-out'}
            >
                {(isSubmittingAttendance || isSubmittingTasks) && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
                <LogOut className="mr-2 h-5 w-5" />
                {tasksSubmittedForDay ? 'Proceed to Check Out' : 'Submit Report & Check Out'}
            </Button>
            </CardContent>
        </Card>
      )}

        {myTodaysAttendanceEvents.length > 0 && (
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg flex items-center"><FileText className="mr-2 h-5 w-5 text-primary"/>Today's Activity</CardTitle>
                </CardHeader>
                <CardContent>
                    <ul className="space-y-3">
                        {myTodaysAttendanceEvents.map(event => (
                            <li key={event.id} className="p-3 border rounded-md bg-muted/30 text-sm">
                                <div className="flex justify-between items-center">
                                    <span className={`font-semibold capitalize ${event.type === 'check-in' ? 'text-green-600' : 'text-orange-600'}`}>
                                        {event.type}
                                    </span>
                                    <span className="text-xs text-muted-foreground">{format(parseISO(event.timestamp), 'p')} ({formatDistanceToNow(parseISO(event.timestamp), { addSuffix: true })})</span>
                                </div>
                                {event.location && (
                                    <p className="text-xs text-muted-foreground">
                                        Location: {event.location.latitude.toFixed(4)}, {event.location.longitude.toFixed(4)}
                                        {event.location.accuracy && ` (±${event.location.accuracy.toFixed(0)}m)`}
                                        {event.isWithinGeofence === false && <span className="ml-1 text-red-500 font-bold">(Outside Geofence)</span>}
                                        {event.matchedGeofenceType && <span className="ml-1 text-blue-500">({event.matchedGeofenceType})</span>}
                                    </p>
                                )}
                                {event.photoUrl && <img src={event.photoUrl} alt="Attendance" className="mt-2 h-16 w-16 object-cover rounded-md border"/>}
                            </li>
                        ))}
                    </ul>
                </CardContent>
            </Card>
        )}
    </div>
  );
}


    