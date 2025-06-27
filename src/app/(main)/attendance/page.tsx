
"use client";

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import type { AttendanceEvent, LocationInfo } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { LogIn, LogOut, FileText, Loader2, AlertCircle, MapPin, LocateFixed } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { db } from '@/lib/firebase/firebase'; // Corrected import
import { collection, query, where, onSnapshot, orderBy, limit } from 'firebase/firestore';
import type { Firestore } from 'firebase/firestore';
import { calculateDistance } from '@/lib/locationUtils';
import { Label } from '@/components/ui/label';

type AttendanceStatus = 'checked-out' | 'checked-in' | 'processing-check-in' | 'processing-check-out' | 'submitting-report' | 'unknown' | 'error';
type LocationStatus = 'idle' | 'fetching' | 'success' | 'error';

export default function AttendancePage() {
  const { user, companySettings, addAttendanceEvent, completeCheckout, loading: authLoading } = useAuth();
  const { toast } = useToast();

  // const [dbFs, setDbFs] = useState<Firestore | null>(null); // Removed this state as db is directly imported

  const [attendanceStatus, setAttendanceStatus] = useState<AttendanceStatus>('unknown');
  const [currentDayDocId, setCurrentDayDocId] = useState<string | null>(null);
  
  const [workReport, setWorkReport] = useState<string>('');
  const [isReportModalOpen, setIsReportModalOpen] = useState<boolean>(false);
  const [initializationError, setInitializationError] = useState<string | null>(null);

  const [locationStatus, setLocationStatus] = useState<LocationStatus>('idle');
  const [currentLocation, setCurrentLocation] = useState<LocationInfo | null>(null);
  const [distance, setDistance] = useState<number | null>(null);

  useEffect(() => {
    document.title = 'My Attendance - KarobHR';
    // No need to setDbFs here, as db is directly imported and available.
    // The try-catch block for getFirebaseInstances is also no longer needed.
  }, []);

  useEffect(() => {
    if (authLoading || !db || !user?.id || !user?.companyId) { // Changed dbFs to db
      setAttendanceStatus('unknown');
      return;
    }

    const q = query(
      collection(db, `companies/${user.companyId}/attendanceLog`), // Changed dbFs to db
      where('userId', '==', user.id),
      orderBy('timestamp', 'desc'),
      limit(1)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (snapshot.empty) {
        setAttendanceStatus('checked-out');
      } else {
        const latestDoc = snapshot.docs[0];
        const data = latestDoc.data() as AttendanceEvent;
        setCurrentDayDocId(latestDoc.id);
        setAttendanceStatus(data.status === 'Checked In' ? 'checked-in' : 'checked-out');
      }
    }, (errorObject: any) => {
      console.error("Firestore onSnapshot error:", errorObject);
      setInitializationError(`Database Error: ${errorObject.message}. Check console for details.`);
    });

    return () => unsubscribe();
  }, [db, user?.id, user?.companyId, authLoading]); // Changed dbFs to db

  const handleFetchLocation = useCallback(async (forceLowAccuracy = false) => {
    if (!navigator.geolocation) {
        toast({ variant: "destructive", title: "Unsupported Browser", description: "Geolocation is not supported." });
        return;
    }

    setLocationStatus('fetching');
    toast({ title: "Getting your location..." });

    const processPosition = (position: GeolocationPosition) => {
        console.log("Geolocation Success - Position:", position);
        const userLocation = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
        };
        setCurrentLocation(userLocation);
        setLocationStatus('success');

        const officeLocation = companySettings?.officeLocation;
        console.log("Company Settings for Geofence:", companySettings);
        console.log("Office Location for Geofence:", officeLocation);

        if (officeLocation?.latitude && officeLocation?.longitude) {
            const dist = calculateDistance(
                userLocation.latitude,
                userLocation.longitude,
                officeLocation.latitude,
                officeLocation.longitude
            );
            setDistance(dist);
            const friendlyDist = dist > 1000 ? `${(dist / 1000).toFixed(2)} km` : `${dist.toFixed(0)} m`;
            toast({
                title: "Location Updated",
                description: `You are approx. ${friendlyDist} from the office geofence.`,
            });
        } else {
            setDistance(null);
            toast({
                variant: 'destructive',
                title: "No Geofence Configured",
                description: "The company office location has not been set by the admin."
            });
        }
    };

    const handleError = (error: GeolocationPositionError, isHighAccuracyAttempt: boolean) => {
        console.error(`Geolocation Error (High Accuracy: ${isHighAccuracyAttempt}): Code ${error.code} - ${error.message}`);

        if (isHighAccuracyAttempt && error.code === error.TIMEOUT) {
            // If high accuracy times out, try low accuracy
            toast({ title: "Location accuracy timeout", description: "Trying to get location with lower accuracy..."});
            navigator.geolocation.getCurrentPosition(
                processPosition, 
                (err) => handleError(err, false), // Second attempt, now with isHighAccuracyAttempt = false
                { enableHighAccuracy: false, timeout: 15000, maximumAge: 0 }
            );
            return;
        }

        // Final error handling for both attempts
        setLocationStatus('error');
        setCurrentLocation(null);
        setDistance(null);
        let description = error.message;
        if (error.code === error.PERMISSION_DENIED) {
            description = "Location permission denied. Please enable it in your browser settings.";
        } else if (error.code === error.POSITION_UNAVAILABLE) {
            description = "Location information is unavailable (e.g., GPS off).";
        } else if (error.code === error.TIMEOUT) {
            description = "Could not get your location in time. Please try again or check your signal.";
        }
        toast({ variant: "destructive", title: "Location Error", description });
    };

    if (forceLowAccuracy) {
        navigator.geolocation.getCurrentPosition(
            processPosition,
            (err) => handleError(err, false),
            { enableHighAccuracy: false, timeout: 15000, maximumAge: 0 }
        );
    } else {
        // First attempt: High Accuracy (8 seconds timeout)
        navigator.geolocation.getCurrentPosition(
            processPosition,
            (err) => handleError(err, true),
            { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
        );
    }
  }, [companySettings, toast]);

  const handleCheckIn = async () => {
    if (!currentLocation) {
      toast({ title: "Location Needed", description: "Please fetch your location before checking in.", variant: "destructive" });
      return;
    }
    setAttendanceStatus('processing-check-in');
    try {
      const newDocId = await addAttendanceEvent(currentLocation);
      if (newDocId) {
        toast({ title: "Check-In Successful!", description: "Your check-in has been recorded." });
        setCurrentLocation(null); setDistance(null); setLocationStatus('idle');
      }
    } catch (error: any) {
      toast({ title: "Check-In Failed", description: error.message || "Could not record check-in.", variant: "destructive" });
      setAttendanceStatus('checked-out');
    }
  };
  
  const handleCheckOut = () => {
     if (!currentLocation) {
      toast({ title: "Location Needed", description: "Please fetch your location before checking out.", variant: "destructive" });
      return;
    }
    setIsReportModalOpen(true);
  };

  const submitReportAndCheckout = async () => {
    if (!currentDayDocId || !currentLocation || !workReport.trim()) {
      toast({ title: "Missing Information", description: "A location, active check-in, and work report are required.", variant: "destructive" });
      return;
    }
    
    setIsReportModalOpen(false);
    setAttendanceStatus('processing-check-out');

    try {
      await completeCheckout(currentDayDocId, workReport, currentLocation);
      toast({ title: "Check-Out Successful!", description: "Your work report and check-out have been recorded." });
      setWorkReport('');
      setCurrentLocation(null); setDistance(null); setLocationStatus('idle');
    } catch (error: any) {
      toast({ title: "Check-Out Failed", description: error.message || "Could not record check-out.", variant: "destructive" });
      setAttendanceStatus('checked-in');
    }
  };

  const isProcessing = ['processing-check-in', 'processing-check-out', 'submitting-report'].includes(attendanceStatus);
  const isCheckedIn = attendanceStatus === 'checked-in';
  
  const renderLocationStatus = () => {
    switch(locationStatus) {
        case 'fetching':
            return <p className="text-sm text-center text-muted-foreground">Fetching location...</p>;
        case 'success':
            if (distance !== null) {
                const officeLocation = companySettings?.officeLocation;

                if (!officeLocation) {
                    return (
                        <Alert variant="destructive" className="text-center">
                            <AlertDescription>Location fetched, but no geofence is configured for your account.</AlertDescription>
                        </Alert>
                    );
                }

                const geofenceRadius = officeLocation.radius ?? 0;
                const isInside = distance <= geofenceRadius;
                const friendlyDist = distance > 1000 ? `${(distance / 1000).toFixed(2)} km` : `${distance.toFixed(0)} m`;

                return (
                  <div>
                    <Alert variant={isInside ? 'default' : 'destructive'} className="text-center">
                        <AlertTitle>{isInside ? 'You are within the Geofence' : 'You are outside the Geofence'}</AlertTitle>
                        <AlertDescription>
                          Approx. {friendlyDist} away from the required location. (Max: {geofenceRadius}m)
                        </AlertDescription>
                    </Alert>
                    <div className="text-xs text-muted-foreground mt-2 text-center space-y-1">
                        <p><b>Your Location:</b> {currentLocation?.latitude.toFixed(5)}, {currentLocation?.longitude.toFixed(5)} (Accuracy: {currentLocation?.accuracy.toFixed(0)}m)</p>
                        <p><b>Company Office:</b> {officeLocation.latitude.toFixed(5)}, {officeLocation.longitude.toFixed(5)}</p>
                    </div>
                  </div>
                );
            }
             return <p className="text-sm text-center text-muted-foreground">Location fetched, but could not determine distance to geofence.</p>;
        case 'error':
             return <Alert variant="destructive" className="text-center">
                        <AlertDescription>Failed to get location. Please check browser permissions and try again.</AlertDescription>
                    </Alert>;
        case 'idle':
        default:
            return <p className="text-sm text-center text-muted-foreground">Click the button below to check your location status.</p>;
    }
  }

  if (authLoading || attendanceStatus === 'unknown') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-8rem)] p-4">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground">Loading attendance data...</p>
      </div>
    );
  }

  if (attendanceStatus === 'error') { 
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-8rem)] p-4 text-center">
        <AlertCircle className="h-12 w-12 text-destructive mb-4" />
        <h2 className="text-xl font-semibold mb-2">Attendance System Error</h2>
        <p className="text-muted-foreground max-w-md">{initializationError}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-3xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl flex items-center"><MapPin className="mr-3 h-6 w-6 text-primary" /> My Attendance</CardTitle>
          <CardDescription>First, fetch your location to verify you are within the geofence, then proceed to check in or out.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
            {renderLocationStatus()}
            <Button className="w-full" variant="secondary" onClick={() => handleFetchLocation()}>
                {locationStatus === 'fetching' ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <LocateFixed className="mr-2 h-4 w-4"/>}
                Refresh My Location
            </Button>
            <Button className="w-full" variant="outline" onClick={() => handleFetchLocation(true)}>
                {locationStatus === 'fetching' ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <LocateFixed className="mr-2 h-4 w-4"/>}
                Force Low Accuracy Refresh
            </Button>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
          <Button size="lg" className="w-full py-6 text-lg" onClick={handleCheckIn} disabled={isProcessing || locationStatus !== 'success' || isCheckedIn}>
            {attendanceStatus === 'processing-check-in' && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
            <LogIn className="mr-2 h-5 w-5" /> Check In
          </Button>
          <Button size="lg" variant="outline" className="w-full py-6 text-lg" onClick={handleCheckOut} disabled={isProcessing || locationStatus !== 'success' || !isCheckedIn}>
            {attendanceStatus === 'processing-check-out' && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
            <LogOut className="mr-2 h-5 w-5" /> Check Out
          </Button>
      </div>
      
      <Dialog open={isReportModalOpen} onOpenChange={setIsReportModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Daily Work Report</DialogTitle>
            <DialogDescription>
              Before checking out, please submit a brief report of the work you completed today.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-2">
            <Label htmlFor="workReport">Work Report</Label>
            <Textarea id="workReport" value={workReport} onChange={(e) => setWorkReport(e.target.value)} placeholder="Enter your work summary here..." rows={5}/>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">Cancel</Button>
            </DialogClose>
            <Button onClick={submitReportAndCheckout} disabled={isProcessing || !workReport.trim()}>
              {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Submit Report & Check Out
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
