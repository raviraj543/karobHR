
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
import { getFirebaseInstances } from '@/lib/firebase/firebase';
import { collection, query, where, onSnapshot, orderBy, limit } from 'firebase/firestore';
import type { Firestore } from 'firebase/firestore';
import { calculateDistance } from '@/lib/locationUtils';

type AttendanceStatus = 'checked-out' | 'checked-in' | 'processing-check-in' | 'processing-check-out' | 'submitting-report' | 'unknown' | 'error';
type LocationStatus = 'idle' | 'fetching' | 'success' | 'error';

export default function AttendancePage() {
  const { user, companySettings, addAttendanceEvent, completeCheckout, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const [dbFs, setDbFs] = useState<Firestore | null>(null);

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
    try {
      const { db: firebaseDbInstance } = getFirebaseInstances();
      setDbFs(firebaseDbInstance);
    } catch (e: any) {
      setInitializationError("Failed to connect to database. " + e.message);
      setAttendanceStatus('error');
    }
  }, []);

  useEffect(() => {
    if (authLoading || !dbFs || !user?.id || !user?.companyId) {
      setAttendanceStatus('unknown');
      return;
    }

    const q = query(
      collection(dbFs, `companies/${user.companyId}/attendanceLog`),
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
    }, (errorObject) => {
      console.error("Firestore onSnapshot error:", errorObject);
      setAttendanceStatus('error');
      setInitializationError(`Database Error: ${errorObject.message}. Check console for details.`);
    });

    return () => unsubscribe();
  }, [dbFs, user?.id, user?.companyId, authLoading]);

  const handleFetchLocation = useCallback(async () => {
    if (!navigator.geolocation) {
      toast({ variant: "destructive", title: "Unsupported Browser", description: "Geolocation is not supported." });
      return;
    }

    setLocationStatus('fetching');
    toast({ title: "Getting your location..." });

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const userLocation = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        };
        setCurrentLocation(userLocation);
        setLocationStatus('success');

        let dist = null;
        let geofenceUsed = null;
        
        if (companySettings?.officeLocation) {
             dist = calculateDistance(userLocation.latitude, userLocation.longitude, companySettings.officeLocation.latitude, companySettings.officeLocation.longitude);
             geofenceUsed = 'office';
        } else if (user?.remoteWorkLocation) {
             dist = calculateDistance(userLocation.latitude, userLocation.longitude, user.remoteWorkLocation.latitude, user.remoteWorkLocation.longitude);
             geofenceUsed = 'remote';
        }
        
        if (dist !== null && geofenceUsed) {
            setDistance(dist);
            const friendlyDist = dist > 1000 ? `${(dist / 1000).toFixed(2)} km` : `${dist.toFixed(0)} m`;
            toast({
                title: "Location Updated",
                description: `You are approx. ${friendlyDist} from the ${geofenceUsed} geofence.`,
            });
        } else {
            toast({ variant: 'destructive', title: "No Geofence Configured", description: "Could not find a valid office or remote geofence to compare against." });
        }
      },
      (error) => {
        setLocationStatus('error');
        setCurrentLocation(null);
        setDistance(null);
        toast({ variant: "destructive", title: "Location Error", description: error.message });
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  }, [companySettings, user?.remoteWorkLocation, toast]);

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

  const renderLocationStatus = () => {
    switch(locationStatus) {
        case 'fetching':
            return <p className="text-sm text-center text-muted-foreground">Fetching location...</p>;
        case 'success':
            if (distance !== null) {
                const geofenceRadius = companySettings?.officeLocation?.radius ?? user?.remoteWorkLocation?.radius ?? 0;
                const isInside = distance <= geofenceRadius;
                const friendlyDist = distance > 1000 ? `${(distance / 1000).toFixed(2)} km` : `${distance.toFixed(0)} m`;

                return <Alert variant={isInside ? 'default' : 'destructive'} className="text-center">
                          <AlertTitle>{isInside ? 'You are within the Geofence' : 'You are outside the Geofence'}</AlertTitle>
                          <AlertDescription>
                            Approx. {friendlyDist} away from the required location.
                          </AlertDescription>
                       </Alert>;
            }
            return <p className="text-sm text-center text-muted-foreground">Location fetched, but no geofence to compare.</p>;
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
            <Button className="w-full" variant="secondary" onClick={handleFetchLocation} disabled={locationStatus === 'fetching'}>
                {locationStatus === 'fetching' ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <LocateFixed className="mr-2 h-4 w-4"/>}
                Refresh My Location
            </Button>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
          <Button size="lg" className="w-full py-6 text-lg" onClick={handleCheckIn} disabled={isProcessing || locationStatus !== 'success' || attendanceStatus === 'checked-in'}>
            {attendanceStatus === 'processing-check-in' && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
            <LogIn className="mr-2 h-5 w-5" /> Check In
          </Button>
          <Button size="lg" variant="outline" className="w-full py-6 text-lg" onClick={handleCheckOut} disabled={isProcessing || locationStatus !== 'success' || attendanceStatus === 'checked-out'}>
            {attendanceStatus === 'processing-check-out' && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
            <LogOut className="mr-2 h-5 w-5" /> Check Out
          </Button>
      </div>
      
      <Dialog open={isReportModalOpen} onOpenChange={setIsReportModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center"><FileText className="mr-2 h-5 w-5 text-primary"/>Daily Work Report</DialogTitle>
            <DialogDescription>
              Before checking out, please submit a brief report of the work you completed today.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-2">
            <label htmlFor="workReport" className="text-sm font-medium">Work Report</label>
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
