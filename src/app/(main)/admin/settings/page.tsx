
'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Building2, Clock, Palette, BellDot, MapPin, CalendarCheck2, Loader2, LocateFixed, Wallet } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import type { CompanySettings, LocationInfo } from '@/lib/types';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { SalarySettingsForm } from '@/components/admin/SalarySettingsForm';

export default function AdminSettingsPage() {
  const { companySettings, updateCompanySettings, companyId, loading: authLoading, user } = useAuth();
  const { toast } = useToast();

  const [officeName, setOfficeName] = useState('');
  const [officeLat, setOfficeLat] = useState('');
  const [officeLon, setOfficeLon] = useState('');
  const [officeRadius, setOfficeRadius] = useState('');
  
  const [isSaving, setIsSaving] = useState(false);
  const [isFetchingLocation, setIsFetchingLocation] = useState(false);
  const [formInitialized, setFormInitialized] = useState(false);

  useEffect(() => {
    document.title = 'Company Settings - Admin - KarobHR';
  }, []);

  useEffect(() => {
    if (authLoading || companySettings === undefined) {
      setFormInitialized(false);
      return;
    }

    if (companyId) {
      if (companySettings) {
        const { officeLocation } = companySettings;
        if (officeLocation) {
          setOfficeName(officeLocation.name || 'Main Office');
          setOfficeLat(String(officeLocation.latitude));
          setOfficeLon(String(officeLocation.longitude));
          setOfficeRadius(String(officeLocation.radius));
        } else {
          setOfficeName('Main Office');
          setOfficeLat('0');
          setOfficeLon('0');
          setOfficeRadius('100');
        }
      } else {
        setOfficeName('Main Office');
        setOfficeLat('0');
        setOfficeLon('0');
        setOfficeRadius('100');
      }
    }
    setFormInitialized(true);
  }, [companySettings, authLoading, companyId]);

  const getCurrentLocationForGeofence = useCallback(async (): Promise<LocationInfo> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) reject(new Error("Geolocation is not supported."));
      navigator.geolocation.getCurrentPosition(
        (position) => resolve({ latitude: position.coords.latitude, longitude: position.coords.longitude, accuracy: position.coords.accuracy }),
        (error) => reject(new Error(`Geolocation error: ${error.message}`)),
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
      );
    });
  }, []);

  const handleFetchAndSetLocation = async () => {
    setIsFetchingLocation(true);
    toast({ title: "Fetching Your Location..." });
    try {
      const location = await getCurrentLocationForGeofence();
      setOfficeLat(String(location.latitude));
      setOfficeLon(String(location.longitude));
      toast({ title: "Location Set!", description: "Latitude and longitude have been updated. Please save." });
    } catch (error: any) {
      toast({ variant: 'destructive', title: "Failed to Fetch Location", description: error.message });
    } finally {
      setIsFetchingLocation(false);
    }
  };

  const handleSaveSettings = async () => {
    const lat = parseFloat(officeLat);
    const lon = parseFloat(officeLon);
    const radius = parseInt(officeRadius, 10);

    if (isNaN(lat) || isNaN(lon) || isNaN(radius) || radius <= 0) {
      toast({ title: "Invalid Input", description: "Please enter valid numbers for geofence.", variant: "destructive" });
      return;
    }
    if (!companyId) {
      toast({ title: "Error Saving", description: "Company context is missing.", variant: "destructive" });
      return;
    }

    setIsSaving(true);
    try {
      const settingsToSave: Partial<CompanySettings> = {
        officeLocation: {
          name: officeName.trim() || "Main Office",
          latitude: Number(lat),
          longitude: Number(lon),
          radius: Number(radius),
        },
      };
      await updateCompanySettings(settingsToSave);
      toast({ title: "Settings Saved", description: "Your company settings have been updated successfully." });
    } catch (error: any) {
      toast({ title: "Error Saving Settings", description: error.message, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const isActionDisabled = !formInitialized || isSaving || authLoading || !companyId || !user || user.role !== 'admin';

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
            <Input id="officeName" value={officeName} onChange={(e) => setOfficeName(e.target.value)} placeholder="e.g., Headquarters" disabled={isActionDisabled}/>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
            <div>
              <Label htmlFor="officeLat">Office Latitude</Label>
              <Input id="officeLat" type="number" value={officeLat} onChange={(e) => setOfficeLat(e.target.value)} placeholder="e.g., 37.7749" disabled={isActionDisabled}/>
            </div>
            <div>
              <Label htmlFor="officeLon">Office Longitude</Label>
              <Input id="officeLon" type="number" value={officeLon} onChange={(e) => setOfficeLon(e.target.value)} placeholder="e.g., -122.4194" disabled={isActionDisabled}/>
            </div>
            <Button variant="outline" className="w-full sm:w-auto" onClick={handleFetchAndSetLocation} disabled={isActionDisabled || isFetchingLocation}>
                {isFetchingLocation ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LocateFixed className="mr-2 h-4 w-4" />}
                Use My Current Location
            </Button>
          </div>
          <div className="space-y-1">
            <Label htmlFor="geofenceRadius">Geofence Radius (meters)</Label>
            <Input id="geofenceRadius" type="number" value={officeRadius} onChange={(e) => setOfficeRadius(e.target.value)} placeholder="e.g., 100" disabled={isActionDisabled}/>
          </div>
        </CardContent>
      </Card>
      
      <SalarySettingsForm />

      <div className="flex justify-end">
        <Button onClick={handleSaveSettings} disabled={isActionDisabled}>
          {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save All Settings
        </Button>
      </div>
    </div>
  );
}
