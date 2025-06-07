
"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import type { AttendanceEvent, LocationInfo } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Camera as CameraIcon, LogIn, LogOut, FileText, Loader2, AlertCircle, MapPin } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { format, parseISO, startOfDay, endOfDay } from 'date-fns';
import { getFirebaseInstances } from '@/lib/firebase/firebase';
import { collection, query, where, onSnapshot, Timestamp, GeoPoint, orderBy, limit, doc } from 'firebase/firestore';
import type { Firestore } from 'firebase/firestore';

type AttendanceStatus = 'checked-out' | 'checked-in' | 'processing-check-in' | 'processing-check-out' | 'submitting-report' | 'unknown' | 'error';

export default function AttendancePage() {
  const { user, companySettings, addAttendanceEvent, completeCheckout, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const [dbFs, setDbFs] = useState<Firestore | null>(null);

  const [attendanceStatus, setAttendanceStatus] = useState<AttendanceStatus>('unknown');
  const [currentDayDocId, setCurrentDayDocId] = useState<string | null>(null);
  
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [workReport, setWorkReport] = useState<string>('');
  const [isReportModalOpen, setIsReportModalOpen] = useState<boolean>(false);
  const [lastCheckInPhoto, setLastCheckInPhoto] = useState<string | null>(null);
  const [lastCheckInTime, setLastCheckInTime] = useState<string | null>(null);
  const [initializationError, setInitializationError] = useState<string | null>(null);


  useEffect(() => {
    document.title = 'My Attendance - BizFlow';
    try {
      const { db: firebaseDbInstance } = getFirebaseInstances();
      setDbFs(firebaseDbInstance);
    } catch (e: any) {
      console.error(">>> KAROBHR TRACE: AttendancePage - Failed to get Firebase instances:", e);
      setInitializationError("Failed to connect to database services. Attendance system will not function. Message: " + e.message);
      setAttendanceStatus('error');
    }
  }, []);

  useEffect(() => {
    if (authLoading) {
      setAttendanceStatus('unknown'); // Reflect loading state
      return;
    }

    if (initializationError) { // If dbFs failed to initialize, or other critical init error
        setAttendanceStatus('error');
        return;
    }
    
    if (!dbFs || !user?.id || !user?.companyId) {
      if (!initializationError) { // Only set if not already an init error
        console.error(">>> KAROBHR TRACE: AttendancePage - Listener prerequisites missing AFTER authLoading. DB:", !!dbFs, "UserID:", user?.id, "CompanyID:", user?.companyId);
        setInitializationError("Required user or company data is missing for attendance. Please re-login or contact support.");
      }
      setAttendanceStatus('error');
      return;
    }
    
    // Clear any previous non-critical initialization error if we are ready to proceed
    if (initializationError && !initializationError.includes("Required user or company data is missing")) {
        setInitializationError(null);
    }

    console.log(`>>> KAROBHR TRACE: AttendancePage - Setting up Firestore listener for user ${user.id}, company ${user.companyId}`);

    const todayStart = Timestamp.fromDate(startOfDay(new Date()));
    const todayEnd = Timestamp.fromDate(endOfDay(new Date()));

    const q = query(
      collection(dbFs, `companies/${user.companyId}/attendanceLog`),
      where('userId', '==', user.id),
      where('checkInTime', '>=', todayStart),
      where('checkInTime', '<=', todayEnd),
      orderBy('checkInTime', 'desc'),
      limit(1)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      console.log(`>>> KAROBHR TRACE: AttendancePage - Firestore snapshot received. Empty: ${snapshot.empty}`);
      if (snapshot.empty) {
        setAttendanceStatus('checked-out');
        setCurrentDayDocId(null);
        setLastCheckInPhoto(null);
        setLastCheckInTime(null);
      } else {
        const latestDoc = snapshot.docs[0];
        const data = latestDoc.data() as AttendanceEvent; // Assuming data matches AttendanceEvent
        setCurrentDayDocId(latestDoc.id);
        setAttendanceStatus(data.status === 'Checked In' ? 'checked-in' : 'checked-out');
        setLastCheckInPhoto(data.photoUrl || null);
        
        // Handle timestamp conversion robustly
        const checkInTimestamp = data.checkInTime || data.timestamp; // Prioritize checkInTime
        if (checkInTimestamp) {
          if (typeof (checkInTimestamp as any)?.toDate === 'function') {
            setLastCheckInTime((checkInTimestamp as Timestamp).toDate().toISOString());
          } else if (typeof checkInTimestamp === 'string') {
            setLastCheckInTime(checkInTimestamp);
          } else {
            console.warn(">>> KAROBHR TRACE: AttendancePage - checkInTime from Firestore is not a valid Timestamp or string:", checkInTimestamp);
            setLastCheckInTime(null);
          }
        } else {
            setLastCheckInTime(null);
        }
        console.log(`>>> KAROBHR TRACE: AttendancePage - Status set to ${data.status === 'Checked In' ? 'checked-in' : 'checked-out'}. Doc ID: ${latestDoc.id}`);
      }
    }, (error) => { 
      console.error(">>> KAROBHR TRACE: AttendancePage - Error fetching today's attendance from Firestore (onSnapshot failed). This VERY LIKELY indicates a MISSING FIRESTORE INDEX or a PERMISSIONS ISSUE.");
      console.error(">>> KAROBHR TRACE: Firebase error code:", error.code);
      console.error(">>> KAROBHR TRACE: Firebase error message:", error.message);
      console.error(">>> KAROBHR TRACE: Full Firestore error object:", JSON.stringify(error, Object.getOwnPropertyNames(error)));
      // No toast here, the main UI will show the error.
      setAttendanceStatus('error');
    });

    return () => {
      console.log(">>> KAROBHR TRACE: AttendancePage - Unsubscribing from Firestore listener.");
      unsubscribe();
    };
  }, [dbFs, user?.id, user?.companyId, authLoading, initializationError]); // Removed toast from dependencies


  useEffect(() => {
    const getCameraPermission = async () => {
      if (typeof navigator !== "undefined" && navigator.mediaDevices) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: true });
          setHasCameraPermission(true);
          streamRef.current = stream;
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
          }
        } catch (error) {
          console.error('>>> KAROBHR TRACE: Error accessing camera:', error);
          setHasCameraPermission(false);
        }
      } else {
        setHasCameraPermission(false);
      }
    };

    if (attendanceStatus === 'checked-out' && !authLoading && !initializationError) {
      getCameraPermission();
    } else {
      stopCameraStream();
    }
    
    return () => {
      stopCameraStream();
    };
  }, [attendanceStatus, authLoading, initializationError]);

  const stopCameraStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
      if (videoRef.current) videoRef.current.srcObject = null;
    }
  };

  const getCurrentLocation = useCallback(async (): Promise<LocationInfo> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("Geolocation is not supported by your browser."));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (position) => resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        }),
        (error) => reject(new Error(`Geolocation error: ${error.message}`)),
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    });
  }, []);

  const handleCheckIn = async () => {
    if (attendanceStatus === 'checked-in') {
      toast({ title: "Already Checked In", description: "You have already checked in today." });
      return;
    }
    if (!hasCameraPermission || !videoRef.current?.srcObject || !canvasRef.current) {
      toast({ title: "Camera Error", description: "Camera not ready or permission denied. Please ensure camera access is allowed.", variant: "destructive" });
      return;
    }
    if (!companySettings?.officeLocation && !user?.remoteWorkLocation) {
        toast({title: "Configuration Error", description: "No geofence location (office or remote) is configured for attendance.", variant: "destructive"});
        return;
    }

    setAttendanceStatus('processing-check-in');
    try {
      const location = await getCurrentLocation();
      
      const context = canvasRef.current.getContext('2d');
      if (!context || !videoRef.current) throw new Error("Could not get canvas/video context.");
      canvasRef.current.width = videoRef.current.videoWidth;
      canvasRef.current.height = videoRef.current.videoHeight;
      context.drawImage(videoRef.current, 0, 0, canvasRef.current.width, canvasRef.current.height);
      const photoDataUrl = canvasRef.current.toDataURL('image/jpeg', 0.8);

      const newDocId = await addAttendanceEvent({ type: 'check-in', location, photoDataUrl });
      if (newDocId) {
        toast({ title: "Check-In Successful!", description: "Your check-in has been recorded." });
        // Status will be updated by the Firestore listener
      }
    } catch (error: any) {
      console.error(">>> KAROBHR TRACE: Check-in error:", error);
      toast({ title: "Check-In Failed", description: error.message || "Could not record check-in.", variant: "destructive" });
      setAttendanceStatus('checked-out'); 
    }
  };
  
  const handleCheckOut = async () => {
    if (attendanceStatus === 'checked-out' || !currentDayDocId) {
      toast({ title: "Not Checked In", description: "You must check in before you can check out." });
      return;
    }
     if (!companySettings?.officeLocation && !user?.remoteWorkLocation) {
        toast({title: "Configuration Error", description: "No geofence location (office or remote) is configured for attendance.", variant: "destructive"});
        return;
    }
    setIsReportModalOpen(true);
  };

  const submitReportAndCheckout = async () => {
    if (!currentDayDocId || !workReport.trim()) {
      toast({ title: "Missing Report", description: "Please enter your work report.", variant: "destructive" });
      return;
    }
    setIsReportModalOpen(false);
    setAttendanceStatus('processing-check-out');

    try {
      const location = await getCurrentLocation();
      await completeCheckout(currentDayDocId, workReport, location);
      toast({ title: "Check-Out Successful!", description: "Your work report and check-out have been recorded." });
      setWorkReport('');
      // Status will be updated by the Firestore listener
    } catch (error: any) {
      console.error(">>> KAROBHR TRACE: Check-out error:", error);
      toast({ title: "Check-Out Failed", description: error.message || "Could not record check-out.", variant: "destructive" });
      setAttendanceStatus('checked-in'); // Revert to checked-in on failure
    }
  };

  const isProcessing = attendanceStatus === 'processing-check-in' || attendanceStatus === 'processing-check-out' || attendanceStatus === 'submitting-report';

  if (authLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-8rem)] p-4">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground">Authenticating...</p>
      </div>
    );
  }

  if (initializationError && attendanceStatus === 'error') { // Show initialization error if it's the primary cause
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-8rem)] p-4 text-center">
        <AlertCircle className="h-12 w-12 text-destructive mb-4" />
        <h2 className="text-xl font-semibold mb-2">Attendance Initialization Error</h2>
        <p className="text-muted-foreground">{initializationError}</p>
        <p className="text-xs text-muted-foreground mt-2">Please try refreshing the page. If the problem persists, contact support.</p>
      </div>
    );
  }
  
  if (attendanceStatus === 'unknown' && !initializationError) { // Show this if not an init error, but status is still unknown
     return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-8rem)] p-4">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground">Loading attendance status...</p>
      </div>
    );
  }

  if (attendanceStatus === 'error' && !initializationError) { // This is for Firestore query errors specifically
     return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-8rem)] p-4 text-center">
        <AlertCircle className="h-12 w-12 text-destructive mb-4" />
        <h2 className="text-xl font-semibold mb-2">Attendance Database Error</h2>
        <p className="text-muted-foreground px-4">Could not load attendance status from the database. This might be due to a network issue, incorrect permissions, or a missing database index. Please check your internet connection and try again. If the problem persists, contact support.</p>
        <div className="mt-3 p-3 bg-muted/50 border border-dashed rounded-md text-xs text-left max-w-xl w-full">
            <p className="font-semibold">Admin Instructions:</p>
            <ol className="list-decimal list-inside space-y-1 mt-1">
                <li>Ensure Firestore security rules allow reads for the authenticated user on the attendance log.</li>
                <li>
                    A composite index is VERY LIKELY required. For the collection group <code className="mx-1 px-1 py-0.5 bg-background rounded text-xs font-mono">attendanceLog</code>, an index on:
                    <ul className="list-disc list-inside ml-4">
                        <li><code className="mx-1 px-1 py-0.5 bg-background rounded text-xs font-mono">userId</code> (ASC or DESC)</li>
                        <li>AND <code className="mx-1 px-1 py-0.5 bg-background rounded text-xs font-mono">checkInTime</code> (DESC)</li>
                    </ul>
                    is typically needed for the current query.
                </li>
                <li>Check the browser's developer console for a more specific error message from Firebase, which might include a direct link to create the missing index.</li>
            </ol>
        </div>

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
            Use the buttons below to manage your daily attendance. Geofencing is active.
            Current Status: <span className={`font-semibold ${attendanceStatus === 'checked-in' ? 'text-green-600' : attendanceStatus === 'checked-out' ? 'text-orange-600' : 'text-muted-foreground'}`}>{attendanceStatus.replace('-', ' ').toUpperCase()}</span>
          </CardDescription>
        </CardHeader>
      </Card>

      {attendanceStatus === 'checked-out' && (
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center"><CameraIcon className="mr-2 h-5 w-5 text-primary"/>Live Photo Capture</CardTitle>
            <CardDescription>Align your face for check-in. Geofence will be verified.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="aspect-video w-full max-w-md mx-auto bg-muted rounded-lg overflow-hidden border shadow-inner">
              <video ref={videoRef} className="w-full h-full object-cover" autoPlay playsInline muted data-ai-hint="camera feed person"/>
              <canvas ref={canvasRef} className="hidden"></canvas>
            </div>
            {hasCameraPermission === false && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Camera Permission Needed</AlertTitle>
                <AlertDescription>
                  Camera access is denied or unavailable. Please enable permissions in your browser settings and refresh.
                </AlertDescription>
              </Alert>
            )}
             {hasCameraPermission === null && (
                <Alert variant="default">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <AlertTitle>Camera Check</AlertTitle>
                    <AlertDescription>
                    Checking camera permissions...
                    </AlertDescription>
                </Alert>
            )}
          </CardContent>
        </Card>
      )}

      {attendanceStatus === 'checked-in' && lastCheckInPhoto && (
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center"><FileText className="mr-2 h-5 w-5 text-primary"/>Current Check-In Details</CardTitle>
             <CardDescription>
                You are currently checked in since {lastCheckInTime ? format(parseISO(lastCheckInTime), 'p, MMM d') : 'N/A'}.
             </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center">
            <img src={lastCheckInPhoto} alt="Check-in" className="rounded-md border shadow-md h-40 w-auto object-cover" data-ai-hint="face scan"/>
          </CardContent>
        </Card>
      )}


      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
          <Button
            size="lg"
            className="w-full py-6 text-lg"
            onClick={handleCheckIn}
            disabled={isProcessing || attendanceStatus === 'checked-in' || attendanceStatus === 'error' || hasCameraPermission !== true}
          >
            {attendanceStatus === 'processing-check-in' && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
            <LogIn className="mr-2 h-5 w-5" /> Check In
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="w-full py-6 text-lg"
            onClick={handleCheckOut}
            disabled={isProcessing || attendanceStatus === 'checked-out' || attendanceStatus === 'error'}
          >
            {attendanceStatus === 'processing-check-out' && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
            <LogOut className="mr-2 h-5 w-5" /> Check Out
          </Button>
      </div>
      
      <Dialog open={isReportModalOpen} onOpenChange={setIsReportModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center"><FileText className="mr-2 h-5 w-5 text-primary"/>Daily Work Report</DialogTitle>
            <DialogDescription>
              Before checking out, please submit a brief report of the work you completed today. Geofence will be verified.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-2">
            <label htmlFor="workReport" className="text-sm font-medium">Work Report</label>
            <Textarea
              id="workReport"
              value={workReport}
              onChange={(e) => setWorkReport(e.target.value)}
              placeholder="Enter your work summary here..."
              rows={5}
            />
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" onClick={() => {
                setIsReportModalOpen(false); 
                if (attendanceStatus === 'processing-check-out' || attendanceStatus === 'submitting-report') setAttendanceStatus('checked-in');
              }}>Cancel</Button>
            </DialogClose>
            <Button onClick={submitReportAndCheckout} disabled={attendanceStatus === 'submitting-report' || attendanceStatus === 'processing-check-out' || !workReport.trim()}>
              {(attendanceStatus === 'submitting-report' || attendanceStatus === 'processing-check-out') && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Submit Report & Check Out
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
