
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
import { format, parseISO, startOfDay, endOfDay, isToday } from 'date-fns';
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
      setAttendanceStatus('unknown');
      return;
    }

    if (initializationError) {
      setAttendanceStatus('error');
      return;
    }

    if (!dbFs || !user || !user.id || !user.companyId) {
      if (!initializationError) {
        console.error(`>>> KAROBHR TRACE: AttendancePage - Firestore listener prerequisites missing. DB: ${!!dbFs}, UserID: ${user?.id}, UserName: ${user?.name}, CompanyID: ${user?.companyId}. Waiting for these to be available.`);
      }
      setAttendanceStatus('unknown'); 
      return;
    }
    
    if (initializationError && initializationError.startsWith("Required user or company data is missing")) {
        setInitializationError(null);
    }


    console.log(`>>> KAROBHR TRACE: AttendancePage - Setting up Firestore listener for user ${user.id}, company ${user.companyId}`);

    const todayStart = startOfDay(new Date());
    const todayEnd = endOfDay(new Date());
    
    const todayStartTimestamp = Timestamp.fromDate(todayStart);
    const todayEndTimestamp = Timestamp.fromDate(todayEnd);

    const q = query(
      collection(dbFs, `companies/${user.companyId}/attendanceLog`),
      where('userId', '==', user.id),
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
        const data = latestDoc.data() as AttendanceEvent; 
        setCurrentDayDocId(latestDoc.id);
        
        if (data.status === 'Checked In') {
            setAttendanceStatus('checked-in');
        } else if (data.status === 'Checked Out') {
            setAttendanceStatus('checked-out');
        } else {
            setAttendanceStatus(data.type === 'check-in' ? 'checked-in' : 'checked-out');
            console.warn(`>>> KAROBHR TRACE: AttendancePage - Unexpected or missing 'status' field in Firestore doc ${latestDoc.id}. Inferred status from 'type'. Data:`, data);
        }

        setLastCheckInPhoto(data.photoUrl || null);
        
        const checkInTimestampField = data.checkInTime || data.timestamp;
        if (checkInTimestampField) {
             try {
                const dateObj = typeof (checkInTimestampField as any)?.toDate === 'function' 
                                ? (checkInTimestampField as Timestamp).toDate() 
                                : parseISO(checkInTimestampField as string);
                setLastCheckInTime(dateObj.toISOString());
            } catch (e) {
                console.warn(">>> KAROBHR TRACE: AttendancePage - Error parsing checkInTime/timestamp from Firestore:", checkInTimestampField, e);
                setLastCheckInTime(null);
            }
        } else {
            console.warn(">>> KAROBHR TRACE: AttendancePage - Missing checkInTime and timestamp from Firestore doc:", latestDoc.id);
            setLastCheckInTime(null);
        }
        console.log(`>>> KAROBHR TRACE: AttendancePage - Status set based on Firestore. Doc ID: ${latestDoc.id}. Firestore Status: ${data.status}, Type: ${data.type}`);
      }
      if (initializationError && initializationError.startsWith("Attendance Database Error")) {
        setInitializationError(null);
      }
    }, (errorObject) => { 
      console.error(">>> KAROBHR TRACE: AttendancePage - Error fetching today's attendance from Firestore (onSnapshot failed). This VERY LIKELY indicates a MISSING FIRESTORE INDEX or a PERMISSIONS ISSUE.");
      console.error(">>> KAROBHR TRACE: Firebase error code:", errorObject.code);
      console.error(">>> KAROBHR TRACE: Firebase error message:", errorObject.message);
      console.error(">>> KAROBHR TRACE: Full Firestore error object:", JSON.stringify(errorObject, Object.getOwnPropertyNames(errorObject)));
      setAttendanceStatus('error');
      setInitializationError(`Attendance Database Error: ${errorObject.message}. Check browser console for details (especially for a link to create missing indexes) and verify Firestore security rules and composite indexes (userId ASC/DESC, checkInTime DESC on 'attendanceLog' collection group).`);
    });

    return () => {
      console.log(">>> KAROBHR TRACE: AttendancePage - Unsubscribing from Firestore listener.");
      unsubscribe();
    };
  }, [dbFs, user?.id, user?.companyId, authLoading, initializationError]);


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
           toast({
              variant: 'destructive',
              title: 'Camera Access Denied',
              description: 'Please enable camera permissions in your browser settings for check-in.',
           });
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
  }, [attendanceStatus, authLoading, initializationError, toast]);

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
    if (!user || !user.id || !user.companyId) {
      toast({ title: "User Data Missing", description: "Cannot check in: User or company information is not fully loaded. Please try again or re-login.", variant: "destructive" });
      console.error(">>> KAROBHR TRACE: handleCheckIn - User, user.id, or user.companyId missing from context. User:", user);
      return;
    }
    if (!hasCameraPermission || !videoRef.current?.srcObject || !canvasRef.current) {
      toast({ title: "Camera Error", description: "Camera not ready or permission denied. Please ensure camera access is allowed.", variant: "destructive" });
      return;
    }
    if (!companySettings?.officeLocation && !user?.remoteWorkLocation) {
        toast({title: "Configuration Error", description: "No geofence location (office or remote) is configured for attendance. Contact admin.", variant: "destructive"});
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
      }
    } catch (error: any) {
      console.error(">>> KAROBHR TRACE: Check-in error:", error);
      toast({ title: "Check-In Failed", description: error.message || "Could not record check-in.", variant: "destructive" });
      setAttendanceStatus('checked-out');
    }
  };
  
  const handleCheckOut = async () => {
    if (!user || !user.id || !user.companyId) {
      toast({ title: "User Data Missing", description: "Cannot check out: User or company information is not fully loaded. Please try again or re-login.", variant: "destructive" });
      console.error(">>> KAROBHR TRACE: handleCheckOut - User, user.id or user.companyId missing from context. User:", user);
      return;
    }
     if (!companySettings?.officeLocation && !user?.remoteWorkLocation) {
        toast({title: "Configuration Error", description: "No geofence location (office or remote) is configured for check-out. Contact admin.", variant: "destructive"});
        return;
    }
    setIsReportModalOpen(true);
  };

  const submitReportAndCheckout = async () => {
    if (!user || !user.id || !user.companyId) {
        toast({ title: "Session Error", description: "User data became unavailable. Please re-login.", variant: "destructive" });
        setIsReportModalOpen(false);
        return;
    }
    if (!currentDayDocId) {
      toast({ title: "Error", description: "No active check-in found to check out from.", variant: "destructive" });
      setIsReportModalOpen(false);
      return;
    }
     if (!workReport.trim()) {
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
    } catch (error: any) {
      console.error(">>> KAROBHR TRACE: Check-out error:", error);
      toast({ title: "Check-Out Failed", description: error.message || "Could not record check-out.", variant: "destructive" });
      setAttendanceStatus('checked-in');
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

  if (initializationError && attendanceStatus === 'error') { 
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-8rem)] p-4 text-center">
        <AlertCircle className="h-12 w-12 text-destructive mb-4" />
        <h2 className="text-xl font-semibold mb-2">Attendance System Error</h2>
        <p className="text-muted-foreground max-w-md">{initializationError}</p>
        <p className="text-xs text-muted-foreground mt-2">Please try refreshing the page. If the problem persists, contact support. Check your browser's developer console for more specific error messages from Firebase, especially any links to create missing Firestore indexes.</p>
         {initializationError.includes("Database Error") && (
            <div className="mt-3 p-3 bg-muted/50 border border-dashed rounded-md text-xs text-left max-w-xl w-full">
                <p className="font-semibold">Admin Instructions (If Database Error):</p>
                <ol className="list-decimal list-inside space-y-1 mt-1">
                    <li>Ensure Firestore security rules allow reads for the authenticated user on the attendance log for their company.</li>
                    <li>
                        A composite index is VERY LIKELY required for the collection group <code className="mx-1 px-1 py-0.5 bg-background rounded text-xs font-mono">attendanceLog</code>. Index fields:
                        <ul className="list-disc list-inside ml-4">
                            <li><code className="mx-1 px-1 py-0.5 bg-background rounded text-xs font-mono">userId</code> (ASC or DESC)</li>
                            <li>AND <code className="mx-1 px-1 py-0.5 bg-background rounded text-xs font-mono">checkInTime</code> (DESC)</li>
                        </ul>
                    </li>
                    <li>Check the browser's developer console for a more specific error message from Firebase (often contains a direct link to create missing indexes).</li>
                </ol>
            </div>
        )}
      </div>
    );
  }
  
  if (attendanceStatus === 'unknown' && !initializationError) { 
     return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-8rem)] p-4">
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
            Use the buttons below to manage your daily attendance. Geofencing is active.
          </CardDescription>
        </CardHeader>
      </Card>

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
           { hasCameraPermission === false && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Camera Permission Needed</AlertTitle>
                <AlertDescription>
                  Camera access is denied or unavailable. Please enable permissions in your browser settings and refresh. Check-in is disabled.
                </AlertDescription>
              </Alert>
            )}
             { hasCameraPermission === null && !isProcessing && (
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

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
          <Button
            size="lg"
            className="w-full py-6 text-lg"
            onClick={handleCheckIn}
            disabled={isProcessing || hasCameraPermission !== true}
          >
            {attendanceStatus === 'processing-check-in' && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
            <LogIn className="mr-2 h-5 w-5" /> Check In
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="w-full py-6 text-lg"
            onClick={handleCheckOut}
            disabled={isProcessing}
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
            <Button onClick={submitReportAndCheckout} disabled={isProcessing || !workReport.trim()}>
              {isProcessing && (attendanceStatus === 'processing-check-out' || attendanceStatus === 'submitting-report') && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Submit Report & Check Out
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
