
'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Building2, Clock, Palette, BellDot, MapPin, CalendarCheck2, Loader2 } from 'lucide-react';
import type { Metadata } from 'next';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import type { CompanySettings } from '@/lib/types';

// export const metadata: Metadata = { // Cannot be used in client component
//   title: 'Company Settings - Admin - KarobHR',
//   description: 'Configure company-wide settings for KarobHR.',
// };

export default function AdminSettingsPage() {
  const { companySettings, updateCompanySettings, companyId, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const [officeName, setOfficeName] = useState('');
  const [officeLat, setOfficeLat] = useState('');
  const [officeLon, setOfficeLon] = useState('');
  const [officeRadius, setOfficeRadius] = useState('');
  const [isSavingGeofence, setIsSavingGeofence] = useState(false);

  useEffect(() => {
    document.title = 'Company Settings - Admin - KarobHR';
    if (companySettings?.officeLocation) {
      setOfficeName(companySettings.officeLocation.name || 'Main Office');
      setOfficeLat(String(companySettings.officeLocation.latitude));
      setOfficeLon(String(companySettings.officeLocation.longitude));
      setOfficeRadius(String(companySettings.officeLocation.radius));
    } else if (!authLoading && companyId && !companySettings) {
      // If companyId exists but no settings yet, initialize with defaults
      setOfficeName('Main Office');
      setOfficeLat('0');
      setOfficeLon('0');
      setOfficeRadius('100');
    }
  }, [companySettings, authLoading, companyId]);

  const handleSaveGeofence = async () => {
    const lat = parseFloat(officeLat);
    const lon = parseFloat(officeLon);
    const radius = parseInt(officeRadius, 10);

    if (isNaN(lat) || isNaN(lon) || isNaN(radius) || radius <= 0) {
      toast({ title: "Invalid Input", description: "Please enter valid numbers for latitude, longitude, and a positive radius.", variant: "destructive" });
      return;
    }
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
        toast({ title: "Invalid Coordinates", description: "Latitude must be between -90 and 90. Longitude must be between -180 and 180.", variant: "destructive"});
        return;
    }

    setIsSavingGeofence(true);
    try {
      await updateCompanySettings({
        name: officeName.trim() || "Main Office",
        latitude: lat,
        longitude: lon,
        radius: radius,
      });
      toast({ title: "Geofence Settings Saved", description: "Office location and radius have been updated." });
    } catch (error) {
      toast({ title: "Error Saving Geofence", description: (error as Error).message || "Could not save settings.", variant: "destructive" });
    } finally {
      setIsSavingGeofence(false);
    }
  };


  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Company Settings</h1>
        <p className="text-muted-foreground">Manage general settings for your organization.</p>
      </div>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center"><Building2 className="mr-2 h-5 w-5 text-primary" />Organization Details</CardTitle>
          <CardDescription>Basic information about your company.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="companyName">Company Name</Label>
            <Input id="companyName" defaultValue={companySettings?.companyName || "KarobHR Solutions Inc."} disabled />
            <p className="text-xs text-muted-foreground">Company name is set during initial admin setup.</p>
          </div>
          <div className="space-y-1">
            <Label htmlFor="companyAddress">Company Address (Mock)</Label>
            <Input id="companyAddress" defaultValue="123 Biz Street, Flowville, CA 90210" />
          </div>
          <Button disabled>Save Organization Details (Mock)</Button>
        </CardContent>
      </Card>

      <Separator />

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center"><MapPin className="mr-2 h-5 w-5 text-primary" /> Primary Office Geofence</CardTitle>
          <CardDescription>
            Define the main office location and attendance radius. This will be used for geofenced attendance.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
           <div className="space-y-1">
            <Label htmlFor="officeName">Office Location Name</Label>
            <Input id="officeName" value={officeName} onChange={(e) => setOfficeName(e.target.value)} placeholder="e.g., Headquarters, Downtown Branch"/>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label htmlFor="officeLat">Office Latitude</Label>
              <Input id="officeLat" type="number" value={officeLat} onChange={(e) => setOfficeLat(e.target.value)} placeholder="e.g., 37.7749"/>
            </div>
            <div className="space-y-1">
              <Label htmlFor="officeLon">Office Longitude</Label>
              <Input id="officeLon" type="number" value={officeLon} onChange={(e) => setOfficeLon(e.target.value)} placeholder="e.g., -122.4194"/>
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="geofenceRadius">Geofence Radius (meters)</Label>
            <Input id="geofenceRadius" type="number" value={officeRadius} onChange={(e) => setOfficeRadius(e.target.value)} placeholder="e.g., 100"/>
          </div>
          <Button onClick={handleSaveGeofence} disabled={isSavingGeofence || authLoading}>
            {isSavingGeofence && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Office Geofence
          </Button>
           <p className="text-xs text-muted-foreground">
            Employees attempting to check in/out outside this radius (and not within a valid remote location, if set) will have their attendance flagged.
          </p>
        </CardContent>
      </Card>

      <Separator />

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center"><Clock className="mr-2 h-5 w-5 text-primary" />Working Hours & Timezone (Mock)</CardTitle>
          <CardDescription>Define standard working hours and company timezone.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label htmlFor="workStartTime">Default Work Start Time</Label>
              <Input id="workStartTime" type="time" defaultValue="09:00" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="workEndTime">Default Work End Time</Label>
              <Input id="workEndTime" type="time" defaultValue="17:00" />
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="timezone">Timezone</Label>
            <Input id="timezone" defaultValue="America/Los_Angeles (PST)" />
          </div>
          <Button disabled>Save Work Schedule (Mock)</Button>
        </CardContent>
      </Card>

      <Separator />

       <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center"><CalendarCheck2 className="mr-2 h-5 w-5 text-primary" />Leave Policy Settings (Mock)</CardTitle>
          <CardDescription>
            Define default leave allowances for employees.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label htmlFor="monthlyLeave">Default Monthly Leave Allowance (days)</Label>
              <Input id="monthlyLeave" type="number" defaultValue="4" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="yearlyLeave">Default Yearly Leave Allowance (days)</Label>
              <Input id="yearlyLeave" type="number" defaultValue="48" />
            </div>
          </div>
          <Button disabled>Save Leave Policy (Mock)</Button>
        </CardContent>
      </Card>

      <Separator />

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center"><Palette className="mr-2 h-5 w-5 text-primary" />Branding & Appearance (Mock)</CardTitle>
          <CardDescription>Customize the look and feel of the application.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="logoUpload">Company Logo</Label>
            <Input id="logoUpload" type="file" />
            <p className="text-xs text-muted-foreground">Upload a PNG or JPG file (max 2MB).</p>
          </div>
           <div className="flex items-center space-x-2">
            <Switch id="darkModeToggleAdmin" />
            <Label htmlFor="darkModeToggleAdmin">Enable Dark Mode by default for new users</Label>
          </div>
          <Button disabled>Save Appearance Settings (Mock)</Button>
        </CardContent>
      </Card>

      <Separator />
      
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center"><BellDot className="mr-2 h-5 w-5 text-primary" />Notification Settings (Mock)</CardTitle>
          <CardDescription>Configure system-wide notification preferences.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-3 bg-muted/30 rounded-md">
            <Label htmlFor="leaveNotifications">Email notifications for leave requests</Label>
            <Switch id="leaveNotifications" defaultChecked />
          </div>
          <div className="flex items-center justify-between p-3 bg-muted/30 rounded-md">
            <Label htmlFor="taskNotifications">Email notifications for new task assignments</Label>
            <Switch id="taskNotifications" defaultChecked/>
          </div>
          <Button disabled>Save Notification Settings (Mock)</Button>
        </CardContent>
      </Card>

    </div>
  );
}
