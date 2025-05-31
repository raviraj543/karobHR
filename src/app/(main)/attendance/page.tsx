
'use client';

import { useState, useEffect, useRef, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import type { LocationInfo as Location, AttendanceEvent } from '@/lib/types';
import { Camera, MapPin, CheckCircle, LogOut, Loader2, AlertTriangle, WifiOff, BadgeAlert } from 'lucide-react';
import Image from 'next/image';

// --- Geofence Settings ---
const OFFICE_LATITUDE = 37.7749;
const OFFICE_LONGITUDE = -122.4194;
const GEOFENCE_RADIUS_METERS = 100;
// --- End Geofence Settings ---

interface CheckInOutDisplayRecord { // For local display of the last action
  type: 'check-in' | 'check-out';
  photoDataUrl: string | null;
  location: Location | null;
  timestamp: Date;
  isWithinGeofence: boolean | null;
}

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3;
  const phi1 = lat1 * Math.PI / 180;
  const phi2 = lat2 * Math.PI / 180;
  const deltaPhi = (lat2 - lat1) * Math.PI / 180;
  const deltaLambda = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
            Math.cos(phi1) * Math.cos(phi2) *
            Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export default function AttendancePage() {
  const { user, addAttendanceEvent, attendanceLog } = useAuth();
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastDisplayRecord, setLastDisplayRecord] = useState<CheckInOutDisplayRecord | null>(null);
  const [checkInStatus, setCheckInStatus] = useState<'checked-out' | 'checked-in'>('checked-out');
  const [error, setError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { toast } = useToast();

  // Effect for Camera Permission (runs once on mount)
  useEffect(() => {
    const getCameraPermission = async () => {
      setError(null); // Clear previous camera-related errors when re-attempting
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
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
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty dependency array ensures this runs only once on mount

  // Effect for setting title and initial attendance status
  useEffect(() => {
    document.title = 'Attendance - KarobHR';

    if (user) {
      const userEvents = attendanceLog
        .filter(event => event.employeeId === user.employeeId)
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      if (userEvents.length > 0 && userEvents[0].type === 'check-in') {
        setCheckInStatus('checked-in');
        // For historical log entries, photoDataUrl will be null
        setLastDisplayRecord({
          type: userEvents[0].type,
          photoDataUrl: null, 
          location: userEvents[0].location,
          timestamp: new Date(userEvents[0].timestamp),
          isWithinGeofence: userEvents[0].isWithinGeofence,
        });
      } else {
        setCheckInStatus('checked-out');
        setLastDisplayRecord(null);
      }
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
    return canvas.toDataURL('image/jpeg');
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
          setError(null); // Clear previous location errors on success
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
    if (!user) {
      setError('User not identified. Cannot record attendance.');
      toast({ variant: 'destructive', title: 'User Error', description: 'Could not identify user.' });
      return;
    }
    setIsSubmitting(true);
    
    if (hasCameraPermission !== true) { // Stricter check
      setError('Camera permission is required to proceed.');
      toast({ variant: 'destructive', title: 'Permission Denied', description: 'Camera access is required.' });
      setIsSubmitting(false);
      return;
    }

    const photoDataUrl = capturePhoto();
    
    const location = await getGeolocation();
    let isWithinGeofence: boolean | null = null;
    let toastDescription = `${type === 'check-in' ? 'Welcome!' : 'Goodbye!'} Recorded at ${new Date().toLocaleTimeString()}`;

    if (location) {
      const distance = calculateDistance(
        location.latitude,
        location.longitude,
        OFFICE_LATITUDE,
        OFFICE_LONGITUDE
      );
      isWithinGeofence = distance <= GEOFENCE_RADIUS_METERS;
      toastDescription += ` from lat: ${location.latitude.toFixed(4)}, lon: ${location.longitude.toFixed(4)}.`;
      if (!isWithinGeofence) {
        toastDescription += ` You are outside the office geofence (Distance: ${distance.toFixed(0)}m).`;
      } else {
        toastDescription += ` You are within the office geofence.`;
      }
    } else {
      toastDescription += ' (Location not available). Geofence status cannot be determined.';
    }
    
    const displayRecord: CheckInOutDisplayRecord = {
      type,
      photoDataUrl: photoDataUrl, // This will be used for immediate display on this page
      location,
      timestamp: new Date(),
      isWithinGeofence,
    };
    setLastDisplayRecord(displayRecord);
    setCheckInStatus(type === 'check-in' ? 'checked-in' : 'checked-out');

    // The photoDataUrl passed here will be nulled out by addAttendanceEvent before storage
    await addAttendanceEvent({
        employeeId: user.employeeId,
        type,
        photoDataUrl, 
        location,
        isWithinGeofence
    });

    toast({
      title: `Successfully ${type === 'check-in' ? 'Checked In' : 'Checked Out'}! ${isWithinGeofence === false ? '(Outside Geofence)' : ''}`,
      description: toastDescription,
      variant: isWithinGeofence === false ? 'destructive' : 'default',
      duration: isWithinGeofence === false ? 9000 : 5000,
    });
    setIsSubmitting(false);
  };

  return (
    <div className="space-y-6">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center text-2xl">
            <Camera className="mr-2 h-6 w-6 text-primary" /> Live Attendance
          </CardTitle>
          <CardDescription>
            Use your camera and location to check in or check out. Attendance is verified against office geofence (Radius: {GEOFENCE_RADIUS_METERS}m).
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
            <CardHeader>
              <CardTitle className="text-lg">Camera Feed</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="relative aspect-video w-full max-w-md mx-auto bg-muted rounded-md overflow-hidden border">
                <video
                  ref={videoRef}
                  className="w-full h-full object-cover"
                  autoPlay
                  muted
                  playsInline
                />
                {hasCameraPermission === false && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 text-white p-4">
                    <AlertTriangle className="h-12 w-12 mb-2 text-destructive" />
                    <p className="text-center font-semibold">Camera permission denied.</p>
                    <p className="text-center text-sm">Please enable camera access in your browser settings.</p>
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
              <Button
                size="lg"
                onClick={() => handleCheckInOrOut('check-in')}
                disabled={isSubmitting || hasCameraPermission !== true}
                className="w-full sm:w-auto"
              >
                {isSubmitting ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <CheckCircle className="mr-2 h-5 w-5" />}
                Check In
              </Button>
            ) : (
              <Button
                size="lg"
                variant="destructive"
                onClick={() => handleCheckInOrOut('check-out')}
                disabled={isSubmitting || hasCameraPermission !== true}
                className="w-full sm:w-auto"
              >
                {isSubmitting ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <LogOut className="mr-2 h-5 w-5" />}
                Check Out
              </Button>
            )}
          </div>

          {lastDisplayRecord && (
            <Card className={`mt-6 ${lastDisplayRecord.isWithinGeofence === false ? 'border-destructive bg-destructive/10' : 'bg-muted/30'}`}>
              <CardHeader>
                <CardTitle className="text-lg flex items-center">
                  {lastDisplayRecord.type === 'check-in' ? 'Checked In' : 'Checked Out'} Details
                  {lastDisplayRecord.isWithinGeofence === false && <BadgeAlert className="ml-2 h-5 w-5 text-destructive" />}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-col sm:flex-row items-start gap-4">
                  {lastDisplayRecord.photoDataUrl && ( 
                    <div className="w-full sm:w-1/3">
                      <p className="font-semibold mb-1">
                        {lastDisplayRecord.type === 'check-out' ? 'Checkout Photo:' : 'Check-in Photo:'}
                      </p>
                      <Image
                        src={lastDisplayRecord.photoDataUrl}
                        alt={`Captured photo for ${lastDisplayRecord.type}`}
                        width={200}
                        height={150}
                        className="rounded-md border shadow-sm aspect-video object-cover"
                        data-ai-hint="person face"
                      />
                    </div>
                  )}
                  <div className={`w-full ${lastDisplayRecord.photoDataUrl ? 'sm:w-2/3' : ''} space-y-2`}>
                    <div>
                      <p className="font-semibold">
                        {lastDisplayRecord.type === 'check-out' ? 'Checkout Time:' : 'Check-in Time:'}
                      </p>
                      <p>{lastDisplayRecord.timestamp.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="font-semibold flex items-center">
                        <MapPin className="mr-1 h-4 w-4 text-primary" /> 
                        {lastDisplayRecord.type === 'check-out' ? 'Checkout Location:' : 'Check-in Location:'}
                      </p>
                      {lastDisplayRecord.location ? (
                        <p>
                          Lat: {lastDisplayRecord.location.latitude.toFixed(5)}, Lon: {lastDisplayRecord.location.longitude.toFixed(5)}
                          {lastDisplayRecord.location.accuracy && ` (Accuracy: ${lastDisplayRecord.location.accuracy.toFixed(0)}m)`}
                        </p>
                      ) : (
                        <p className="text-muted-foreground">Location data not available or permission denied.</p>
                      )}
                    </div>
                     <div>
                      <p className="font-semibold flex items-center">
                        {lastDisplayRecord.isWithinGeofence === false ? <WifiOff className="mr-1 h-4 w-4 text-destructive" /> : <CheckCircle className="mr-1 h-4 w-4 text-green-600" />}
                        Geofence Status:
                      </p>
                      {lastDisplayRecord.location === null ? (
                         <p className="text-muted-foreground">Could not determine (location unavailable).</p>
                      ): lastDisplayRecord.isWithinGeofence ? (
                        <p className="text-green-600 font-medium">Within office radius.</p>
                      ) : (
                        <p className="text-destructive font-medium">
                          Outside office radius. 
                          {lastDisplayRecord.location && ` (Approx. ${calculateDistance(lastDisplayRecord.location.latitude, lastDisplayRecord.location.longitude, OFFICE_LATITUDE, OFFICE_LONGITUDE).toFixed(0)}m away)`}
                        </p>
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
