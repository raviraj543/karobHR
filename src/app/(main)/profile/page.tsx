'use client';

import { useAuth } from '@/hooks/useAuth';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Edit3, Mail, Phone, Briefcase, User as UserIcon } from 'lucide-react';
import type { Metadata } from 'next'; // Cannot be used in client component directly for dynamic titles
import { useEffect } from 'react';

// export const metadata: Metadata = { // This needs to be handled differently for client components
//   title: 'My Profile - BizFlow',
// };

export default function ProfilePage() {
  const { user } = useAuth();

  useEffect(() => {
    if (user?.name) {
      document.title = `${user.name}'s Profile - BizFlow`;
    } else {
      document.title = 'My Profile - BizFlow';
    }
  }, [user?.name]);


  if (!user) {
    return <p className="text-center text-muted-foreground">Loading profile...</p>;
  }

  const initials = user.name
    ? user.name.split(' ').map((n) => n[0]).join('').toUpperCase()
    : user.email?.[0].toUpperCase() || 'U';

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">My Profile</h1>
          <p className="text-muted-foreground">View and manage your personal information.</p>
        </div>
        <Button variant="outline">
          <Edit3 className="mr-2 h-4 w-4" /> Edit Profile
        </Button>
      </div>
      
      <Card className="shadow-lg">
        <CardHeader className="bg-muted/30 p-6 rounded-t-lg">
          <div className="flex items-center space-x-4">
            <Avatar className="h-20 w-20 border-2 border-primary">
              <AvatarImage src={user.profilePictureUrl || undefined} alt={user.name || 'User Avatar'} data-ai-hint="profile person" />
              <AvatarFallback className="text-3xl">{initials}</AvatarFallback>
            </Avatar>
            <div>
              <CardTitle className="text-2xl">{user.name || 'User Name'}</CardTitle>
              <CardDescription className="text-md">{user.role === 'admin' ? 'Administrator' : 'Employee'}</CardDescription>
              <p className="text-sm text-muted-foreground">{user.employeeId ? `Employee ID: ${user.employeeId}`: 'Employee ID: N/A'}</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6 space-y-6">
          <div>
            <h3 className="text-lg font-semibold mb-2 text-primary">Contact Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="email" className="flex items-center text-muted-foreground">
                  <Mail className="mr-2 h-4 w-4" /> Email Address
                </Label>
                <Input id="email" value={user.email || ''} readOnly disabled className="bg-muted/20"/>
              </div>
              <div className="space-y-1">
                <Label htmlFor="phone" className="flex items-center text-muted-foreground">
                  <Phone className="mr-2 h-4 w-4" /> Phone Number
                </Label>
                <Input id="phone" value={user.contactInfo?.phone || 'Not set'} readOnly disabled className="bg-muted/20"/>
              </div>
            </div>
          </div>

          <Separator />

          <div>
            <h3 className="text-lg font-semibold mb-2 text-primary">Employment Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="department" className="flex items-center text-muted-foreground">
                  <Briefcase className="mr-2 h-4 w-4" /> Department
                </Label>
                <Input id="department" value={user.department || 'Not specified'} readOnly disabled className="bg-muted/20"/>
              </div>
              <div className="space-y-1">
                <Label htmlFor="joiningDate" className="flex items-center text-muted-foreground">
                  <UserIcon className="mr-2 h-4 w-4" /> Joining Date
                </Label>
                <Input id="joiningDate" value={user.joiningDate || 'Not specified'} readOnly disabled className="bg-muted/20"/>
              </div>
            </div>
          </div>
          
          {/* Placeholder for future sections like address, emergency contact, etc. */}
        </CardContent>
      </Card>
    </div>
  );
}
