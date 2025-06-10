
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, FileText, MapPin, Send } from 'lucide-react';
import type { LocationInfo } from '@/lib/types';

export default function CheckoutReportPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { completeCheckout, user } = useAuth();
  const { toast } = useToast();
  
  const [workReport, setWorkReport] = useState('');
  const [location, setLocation] = useState<LocationInfo | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attendanceDocId, setAttendanceDocId] = useState<string | null>(null);

  useEffect(() => {
    document.title = `Checkout & Report - KarobHR`;
    const docId = searchParams.get('docId');
    if (!docId) {
      setError("Check-in record ID is missing. Please go back and try again.");
      toast({
        title: "Error",
        description: "Check-in record ID not found in URL. Cannot proceed with checkout.",
        variant: "destructive",
      });
      router.push('/dashboard');
    } else {
      setAttendanceDocId(docId);
    }
  }, [searchParams, router, toast]);

  const getLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by your browser.");
      toast({ title: "Geolocation Error", description: "Your browser does not support geolocation.", variant: "destructive" });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        });
        setError(null);
      },
      (err) => {
        setError(`Failed to get location: ${err.message}`);
        toast({ title: "Location Error", description: `Could not retrieve your location. Error: ${err.message}`, variant: "destructive" });
      }
    );
  }, [toast]);

  useEffect(() => {
    getLocation();
  }, [getLocation]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!attendanceDocId) {
      toast({ title: "Error", description: "Cannot submit without a valid Check-in ID.", variant: "destructive" });
      return;
    }
    if (!workReport) {
      toast({ title: "Validation Error", description: "Please provide a summary of your work.", variant: "destructive" });
      return;
    }
    if (!location) {
      toast({ title: "Location Error", description: "Location data is required for checkout. Please enable location services.", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    try {
      await completeCheckout(attendanceDocId, workReport, location);
      toast({
        title: "Checkout Successful!",
        description: "Your work report has been submitted.",
      });
      router.push('/dashboard');
    } catch (err: any) {
      console.error("Checkout failed:", err);
      setError(err.message);
      toast({
        title: "Checkout Failed",
        description: err.message || "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background p-4">
      <Card className="w-full max-w-lg shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl font-semibold flex items-center">
            <FileText className="mr-3 h-6 w-6 text-primary" />
            Submit Work Report & Checkout
          </CardTitle>
          <CardDescription>
            Summarize your work for the day before you checkout.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="workReport">Work Summary</Label>
              <Textarea
                id="workReport"
                placeholder="Briefly describe the tasks you completed today..."
                value={workReport}
                onChange={(e) => setWorkReport(e.target.value)}
                required
                className="min-h-[150px]"
              />
            </div>

            <div className="p-3 bg-muted/50 rounded-lg border">
                <div className="flex items-center justify-between">
                    <Label className="flex items-center">
                        <MapPin className="mr-2 h-4 w-4" /> Checkout Location
                    </Label>
                    <Button type="button" variant="ghost" size="sm" onClick={getLocation}>
                        Refresh
                    </Button>
                </div>
                {location ? (
                    <p className="text-xs text-muted-foreground mt-2">
                        Lat: {location.latitude.toFixed(5)}, Lon: {location.longitude.toFixed(5)} (Accuracy: {location.accuracy.toFixed(1)}m)
                    </p>
                ) : (
                    <p className="text-xs text-destructive mt-2">{error || 'Fetching location...'}</p>
                )}
            </div>
            
            <Button type="submit" className="w-full" disabled={isSubmitting || !location || !workReport}>
              {isSubmitting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Send className="mr-2 h-4 w-4" />
              )}
              Submit Report and Checkout
            </Button>

             {error && !location && <p className="text-sm text-center text-destructive">{error}</p>}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
