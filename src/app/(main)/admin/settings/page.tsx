import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Building2, Clock, Palette, BellDot } from 'lucide-react';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Company Settings - Admin - BizFlow',
  description: 'Configure company-wide settings for BizFlow.',
};

export default function AdminSettingsPage() {
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
            <Input id="companyName" defaultValue="BizFlow Solutions Inc." />
          </div>
          <div className="space-y-1">
            <Label htmlFor="companyAddress">Company Address</Label>
            <Input id="companyAddress" defaultValue="123 Biz Street, Flowville, CA 90210" />
          </div>
          <Button>Save Organization Details</Button>
        </CardContent>
      </Card>

      <Separator />

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center"><Clock className="mr-2 h-5 w-5 text-primary" />Working Hours & Timezone</CardTitle>
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
            {/* In a real app, this would be a Select component */}
            <Input id="timezone" defaultValue="America/Los_Angeles (PST)" />
          </div>
          <Button>Save Work Schedule</Button>
        </CardContent>
      </Card>
      
      <Separator />

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center"><Palette className="mr-2 h-5 w-5 text-primary" />Branding & Appearance</CardTitle>
          <CardDescription>Customize the look and feel of the application (limited scope).</CardDescription>
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
          <Button>Save Appearance Settings</Button>
        </CardContent>
      </Card>

      <Separator />
      
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center"><BellDot className="mr-2 h-5 w-5 text-primary" />Notification Settings</CardTitle>
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
          <Button>Save Notification Settings</Button>
        </CardContent>
      </Card>

    </div>
  );
}
