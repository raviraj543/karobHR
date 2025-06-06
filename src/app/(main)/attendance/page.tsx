
'use client';

import { useState, useEffect, useRef, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import type { LocationInfo as Location, AttendanceEvent } from '@/lib/types';
import { Camera, MapPin, CheckCircle, LogOut, Loader2, AlertTriangle, WifiOff, BadgeAlert, Wifi } from 'lucide-react';
import Image from 'next/image';
import { calculateDistance } from '@/lib/locationUtils';


interface CheckInOutDisplayRecord {
  type: 'check-in' | 'check-out';
  photoUrl: string | null;
  location: Location | null;
  timestamp: Date;
  isWithinGeofence: boolean | null;
  matchedGeofenceType?: 'office' | 'remote' | null;
}


export default function AttendancePage() {
  const { user, addAttendanceEvent, attendanceLog, companyId, companySettings } = useAuth();
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastDisplayRecord, setLastDisplayRecord] = useState<CheckInOutDisplayRecord | null>(null);
  const [checkInStatus, setCheckInStatus] = useState<'checked-out' | 'checked-in'>('checked-out');
  const [error, setError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    const getCameraPermission = async () => {
      setError(null);
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        streamRef.current = stream;
        setHasCameraPermission(true);
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err) {
        console.error('Error accessing camera:', err);
        setHasCameraPermission(false);
        setError('Camera permission denied. Please enable camera access in your browser settings.');
        toast({
          variant: 'destructive',
          title: 'Camera Access Denied',
          description: 'Please enable camera permissions to use this feature.',
        });
      }
    };
    getCameraPermission();
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (videoRef.current) videoRef.current.srcObject = null;
      streamRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    document.title = 'Attendance - KarobHR';
    if (user && attendanceLog.length > 0) {
      const today = new Date().toISOString().split('T')[0];
      const userEventsToday = attendanceLog
        .filter(event => event.userId === user.id && event.timestamp.startsWith(today))
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      if (userEventsToday.length > 0) {
         const latestEvent = userEventsToday[0];
        if (latestEvent.type === 'check-in') {
          setCheckInStatus('checked-in');
        } else {
          setCheckInStatus('checked-out');
        }
        setLastDisplayRecord({
          type: latestEvent.type,
          photoUrl: latestEvent.photoUrl || null,
          location: latestEvent.location,
          timestamp: new Date(latestEvent.timestamp),
          isWithinGeofence: latestEvent.isWithinGeofence,
          matchedGeofenceType: latestEvent.matchedGeofenceType,
        });
      } else {
        setCheckInStatus('checked-out');
        setLastDisplayRecord(null);
      }
    } else if (user) {
        setCheckInStatus('checked-out');
        setLastDisplayRecord(null);
    }
  }, [user, attendanceLog]);

  const capturePhoto = (): string | null => {
    if (!videoRef.current || !canvasRef.current || !hasCameraPermission) {
      setError('Cannot capture photo. Camera not ready or permission denied.');
      toast({ variant: 'destructive', title: 'Photo Capture Failed', description: 'Camera not available.' });
      return null;
    }
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext('2d');
    if (!context) {
        setError('Could not get canvas context for photo capture.');
        return null;
    }
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.8);
  };

  const getGeolocation = (): Promise<Location | null> => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        setError('Geolocation is not supported by your browser.');
        resolve(null);
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setError(null);
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
          });
        },
        (err) => {
          console.error('Error getting geolocation:', err);
          setError(`Geolocation error: ${err.message}. Please ensure location services are enabled.`);
          resolve(null);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    });
  };

  const handleCheckInOrOut = async (type: 'check-in' | 'check-out') => {
    if (!user || !companyId) {
      setError('User not identified or company context missing. Cannot record attendance.');
      toast({ variant: 'destructive', title: 'User Error', description: 'Could not identify user or company.' });
      return;
    }
    setIsSubmitting(true);

    if (hasCameraPermission !== true) {
      setError('Camera permission is required to proceed.');
      toast({ variant: 'destructive', title: 'Permission Denied', description: 'Camera access is required.' });
      setIsSubmitting(false);
      return;
    }

    const photoDataUrlString = capturePhoto();
    const location = await getGeolocation();

    // Geofence check is now primarily handled in AuthContext's addAttendanceEvent
    // But we can still form a preliminary toast message here

    let toastTitle = `Successfully ${type === 'check-in' ? 'Checked In' : 'Checked Out'}!`;
    let toastDescSuffix = "";

    if (location) {
        let inOffice = false;
        let inRemote = false;
        let officeDistStr = "";
        let remoteDistStr = "";

        if (companySettings?.officeLocation) {
            const dist = calculateDistance(location.latitude, location.longitude, companySettings.officeLocation.latitude, companySettings.officeLocation.longitude);
            officeDistStr = ` (Office: ${dist.toFixed(0)}m)`;
            if (dist <= companySettings.officeLocation.radius) {
                inOffice = true;
            }
        }
        if (user.remoteWorkLocation) {
            const dist = calculateDistance(location.latitude, location.longitude, user.remoteWorkLocation.latitude, user.remoteWorkLocation.longitude);
            remoteDistStr = ` (Remote: ${dist.toFixed(0)}m)`;
            if (dist <= user.remoteWorkLocation.radius) {
                inRemote = true;
            }
        }

        if (inOffice) {
            toastDescSuffix = "You are within the OFFICE geofence.";
        } else if (inRemote) {
            toastDescSuffix = "You are within your REMOTE work geofence.";
        } else {
            toastTitle += " (Outside Geofence)";
            toastDescSuffix = `You are OUTSIDE any valid geofence.${officeDistStr}${remoteDistStr}`;
        }
    } else {
        toastDescSuffix = "(Location not available, geofence status cannot be determined).";
    }

    try {
        // addAttendanceEvent now handles photo upload and comprehensive geofence check
        await addAttendanceEvent({
            type,
            photoDataUrl: photoDataUrlString,
            location,
            // isWithinGeofence and matchedGeofenceType will be determined by addAttendanceEvent
        });

        setCheckInStatus(type === 'check-in' ? 'checked-in' : 'checked-out');
        // The actual photoUrl and geofence status from storage will be set in AuthContext after upload
        // and will update lastDisplayRecord via useEffect

        toast({
            title: toastTitle,
            description: `${type === 'check-in' ? 'Welcome!' : 'Goodbye!'} Recorded at ${new Date().toLocaleTimeString()}. ${toastDescSuffix}`,
            variant: (toastTitle.includes("Outside Geofence") ? 'destructive' : 'default'),
            duration: (toastTitle.includes("Outside Geofence") ? 9000 : 5000),
        });
    } catch (submissionError) {
        console.error("Error submitting attendance:", submissionError);
        setError((submissionError as Error).message || "Failed to record attendance.");
        toast({ variant: "destructive", title: "Submission Failed", description: (submissionError as Error).message });
    } finally {
        setIsSubmitting(false);
    }
  };

  const officeRadiusDisplay = companySettings?.officeLocation?.radius || "N/A";

  return (
    <div className="space-y-6">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center text-2xl">
            <Camera className="mr-2 h-6 w-6 text-primary" /> Live Attendance
          </CardTitle>
          <CardDescription>
            Use your camera and location to check in or check out. Attendance is verified against company office (Radius: {officeRadiusDisplay}m)
            {user?.remoteWorkLocation && `, or your registered remote location (Radius: ${user.remoteWorkLocation.radius}m).`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Card>
            <CardHeader><CardTitle className="text-lg">Camera Feed</CardTitle></CardHeader>
            <CardContent>
              <div className="relative aspect-video w-full max-w-md mx-auto bg-muted rounded-md overflow-hidden border">
                <video ref={videoRef} className="w-full h-full object-cover" autoPlay muted playsInline />
                {hasCameraPermission === false && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 text-white p-4">
                    <AlertTriangle className="h-12 w-12 mb-2 text-destructive" />
                    <p className="text-center font-semibold">Camera permission denied.</p>
                    <p className="text-center text-sm">Please enable camera access.</p>
                  </div>
                )}
                 {hasCameraPermission === null && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 text-white p-4">
                    <Loader2 className="h-12 w-12 mb-2 animate-spin" />
                    <p className="text-center font-semibold">Requesting camera access...</p>
                  </div>
                )}
              </div>
              <canvas ref={canvasRef} className="hidden" />
            </CardContent>
          </Card>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            {checkInStatus === 'checked-out' ? (
              <Button size="lg" onClick={() => handleCheckInOrOut('check-in')} disabled={isSubmitting || hasCameraPermission !== true} className="w-full sm:w-auto">
                {isSubmitting ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <CheckCircle className="mr-2 h-5 w-5" />} Check In
              </Button>
            ) : (
              <Button size="lg" variant="destructive" onClick={() => handleCheckInOrOut('check-out')} disabled={isSubmitting || hasCameraPermission !== true} className="w-full sm:w-auto">
                {isSubmitting ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <LogOut className="mr-2 h-5 w-5" />} Check Out
              </Button>
            )}
          </div>

          {lastDisplayRecord && (
            <Card className={`mt-6 ${lastDisplayRecord.isWithinGeofence === false ? 'border-destructive bg-destructive/10' : 'bg-muted/30'}`}>
              <CardHeader>
                <CardTitle className="text-lg flex items-center">
                  {lastDisplayRecord.type === 'check-in' ? 'Last Check-In' : 'Last Check-Out'} Details
                  {lastDisplayRecord.isWithinGeofence === false && <BadgeAlert className="ml-2 h-5 w-5 text-destructive" title="Outside any valid geofence" />}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-col sm:flex-row items-start gap-4">
                  {lastDisplayRecord.photoUrl && (
                    <div className="w-full sm:w-1/3">
                      <p className="font-semibold mb-1">Photo:</p>
                      <Image
                        src={lastDisplayRecord.photoUrl}
                        alt={`Captured photo for ${lastDisplayRecord.type}`}
                        width={200}
                        height={150}
                        className="rounded-md border shadow-sm aspect-video object-cover"
                        data-ai-hint="person face"
                      />
                    </div>
                  )}
                  <div className={`w-full ${lastDisplayRecord.photoUrl ? 'sm:w-2/3' : ''} space-y-2`}>
                    <div><p className="font-semibold">Time:</p><p>{lastDisplayRecord.timestamp.toLocaleString()}</p></div>
                    <div>
                      <p className="font-semibold flex items-center"><MapPin className="mr-1 h-4 w-4 text-primary" />Location:</p>
                      {lastDisplayRecord.location ? (
                        <p>Lat: {lastDisplayRecord.location.latitude.toFixed(5)}, Lon: {lastDisplayRecord.location.longitude.toFixed(5)}
                           {lastDisplayRecord.location.accuracy && ` (Accuracy: ${lastDisplayRecord.location.accuracy.toFixed(0)}m)`}</p>
                      ) : (<p className="text-muted-foreground">Location data not available.</p>)}
                    </div>
                     <div>
                      <p className="font-semibold flex items-center">
                        {lastDisplayRecord.isWithinGeofence === false ? <WifiOff className="mr-1 h-4 w-4 text-destructive" /> : <Wifi className="mr-1 h-4 w-4 text-green-600" />} Geofence Status:
                      </p>
                      {lastDisplayRecord.location === null ? (<p className="text-muted-foreground">Could not determine.</p>)
                       : lastDisplayRecord.isWithinGeofence ? (<p className="text-green-600 font-medium">Within {lastDisplayRecord.matchedGeofenceType || 'valid'} geofence.</p>)
                       : (<p className="text-destructive font-medium">Outside any valid geofence.</p>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
