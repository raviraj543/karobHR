
'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MapPin, Loader2, LocateFixed, Settings } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import type { CompanySettings, LocationInfo, SalaryCalculationMode } from '@/lib/app-types.ts';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

export default function AdminSettingsPage() {
  const { karobUser, companySettings, updateCompanySettings, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const [formState, setFormState] = useState<Partial<CompanySettings>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isFetchingLocation, setIsFetchingLocation] = useState(false);

  useEffect(() => {
    document.title = 'Company Settings - Admin - KarobHR';
  }, []);

  useEffect(() => {
    if (companySettings) {
      setFormState(companySettings);
    }
  }, [companySettings]);

  const handleInputChange = (field: keyof LocationInfo, value: string) => {
    setFormState(prevState => ({
        ...prevState,
        officeLocation: {
            latitude: prevState.officeLocation?.latitude || 0,
            longitude: prevState.officeLocation?.longitude || 0,
            radius: prevState.officeLocation?.radius || 100,
            name: prevState.officeLocation?.name || "Main Office",
            [field]: value,
        },
    }));
  };

  const handleSalaryModeChange = (value: SalaryCalculationMode) => {
     setFormState(prevState => ({
        ...prevState,
        salaryCalculationMode: value,
    }));
  }

  const getCurrentLocationForGeofence = useCallback((): Promise<GeolocationCoordinates> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("Geolocation is not supported."));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (position) => resolve(position.coords),
        (error) => reject(new Error(`Geolocation error: ${error.message}`)),
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
      );
    });
  }, []);

  const handleFetchAndSetLocation = async () => {
    setIsFetchingLocation(true);
    toast({ title: "Fetching Your Location..." });
    try {
      const coords = await getCurrentLocationForGeofence();
      setFormState(prevState => ({
        ...prevState,
        officeLocation: {
            ...prevState.officeLocation,
            latitude: coords.latitude,
            longitude: coords.longitude,
            radius: prevState.officeLocation?.radius || 100,
            name: prevState.officeLocation?.name || "Main Office",
        }
      }));
      toast({ title: "Location Set!", description: "Latitude and longitude have been updated. Please save." });
    } catch (error: any) {
      toast({ variant: 'destructive', title: "Failed to Fetch Location", description: error.message });
    } finally {
      setIsFetchingLocation(false);
    }
  };

  const handleSaveSettings = async () => {
    if (!karobUser?.companyId) {
      toast({ title: "Error Saving", description: "Company context is missing.", variant: "destructive" });
      return;
    }

    const lat = Number(formState.officeLocation?.latitude);
    const lon = Number(formState.officeLocation?.longitude);
    const radius = Number(formState.officeLocation?.radius);

    if (isNaN(lat) || isNaN(lon) || isNaN(radius) || radius <= 0) {
      toast({ title: "Invalid Input", description: "Please enter valid numbers for geofence.", variant: "destructive" });
      return;
    }

    setIsSaving(true);
    try {
       const settingsToSave: Partial<CompanySettings> = {
        officeLocation: {
          name: formState.officeLocation?.name?.trim() || "Main Office",
          latitude: lat,
          longitude: lon,
          radius: radius,
        },
        salaryCalculationMode: formState.salaryCalculationMode,
      };
      await updateCompanySettings(settingsToSave, karobUser.companyId);
      toast({ title: "Settings Saved", description: "Your company settings have been updated successfully." });
    } catch (error: any) {
      toast({ title: "Error Saving Settings", description: error.message, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const isActionDisabled = isSaving || authLoading || isFetchingLocation;

  if (authLoading && !companySettings) {
    return (
         <div className="space-y-8 max-w-3xl mx-auto">
            <div>
                <h1 className="text-3xl font-bold tracking-tight text-foreground">Company Settings</h1>
                <p className="text-muted-foreground">Manage general settings for your organization.</p>
            </div>
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center"><MapPin className="mr-2 h-5 w-5 text-primary" /> Primary Office Geofence</CardTitle>
                </CardHeader>
                <CardContent>
                    <Loader2 className="animate-spin" /> Loading geofence settings...
                </CardContent>
            </Card>
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center"><Settings className="mr-2 h-5 w-5 text-primary" />Salary Calculation</CardTitle>
                </CardHeader>
                <CardContent>
                    <Loader2 className="animate-spin" /> Loading salary settings...
                </CardContent>
            </Card>
        </div>
    )
  }

  return (
    <div className="space-y-8 max-w-3xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Company Settings</h1>
        <p className="text-muted-foreground">Manage general settings for your organization.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center"><MapPin className="mr-2 h-5 w-5 text-primary" /> Primary Office Geofence</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
           <div className="space-y-1">
            <Label htmlFor="officeName">Office Location Name</Label>
            <Input id="officeName" value={formState.officeLocation?.name || ''} onChange={(e) => handleInputChange('name', e.target.value)} placeholder="e.g., Headquarters" disabled={isActionDisabled}/>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
            <div>
              <Label htmlFor="officeLat">Office Latitude</Label>
              <Input id="officeLat" type="number" value={formState.officeLocation?.latitude || ''} onChange={(e) => handleInputChange('latitude', e.target.value)} placeholder="e.g., 37.7749" disabled={isActionDisabled}/>
            </div>
            <div>
              <Label htmlFor="officeLon">Office Longitude</Label>
              <Input id="officeLon" type="number" value={formState.officeLocation?.longitude || ''} onChange={(e) => handleInputChange('longitude', e.target.value)} placeholder="e.g., -122.4194" disabled={isActionDisabled}/>
            </div>
            <Button variant="outline" className="w-full sm:w-auto" onClick={handleFetchAndSetLocation} disabled={isActionDisabled}>
                {isFetchingLocation ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LocateFixed className="mr-2 h-4 w-4" />}
                Use My Current Location
            </Button>
          </div>
          <div className="space-y-1">
            <Label htmlFor="geofenceRadius">Geofence Radius (meters)</Label>
            <Input id="geofenceRadius" type="number" value={formState.officeLocation?.radius || ''} onChange={(e) => handleInputChange('radius', e.target.value)} placeholder="e.g., 100" disabled={isActionDisabled}/>
          </div>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
            <CardTitle className="flex items-center"><Settings className="mr-2 h-5 w-5 text-primary" />Salary Calculation</CardTitle>
            <CardDescription>Configure how employee salaries are calculated.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
            <Label className="text-base">Select Calculation Mode:</Label>
            <RadioGroup
                value={formState.salaryCalculationMode}
                onValueChange={(v) => handleSalaryModeChange(v as SalaryCalculationMode)}
                disabled={isActionDisabled}
            >
                <div className="flex items-center space-x-2">
                    <RadioGroupItem value="hourly_deduction" id="hourly_deduction" />
                    <Label htmlFor="hourly_deduction">Hourly Deduction (Based on actual hours worked vs standard hours)</Label>
                </div>
                <div className="flex items-center space-x-2">
                    <RadioGroupItem value="check_in_out" id="check_in_out" />
                    <Label htmlFor="check_in_out">Check-in/Checkout Based Full-Day (Full day pay if checked in and out)</Label>
                </div>
            </RadioGroup>
        </CardContent>
    </Card>

      <div className="flex justify-end">
        <Button onClick={handleSaveSettings} disabled={isActionDisabled}>
          {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save All Settings
        </Button>
      </div>
    </div>
  );
}
