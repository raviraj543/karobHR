
'use client';

import { useAuth } from '@/hooks/useAuth';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Edit3, Mail, Phone, Briefcase, User as UserIcon, ShieldCheck, UserCog, DollarSign } from 'lucide-react';
import { useEffect } from 'react';

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

  const getRoleDisplayName = (role: typeof user.role) => {
    if (role === 'admin') return 'Administrator';
    if (role === 'manager') return 'Manager';
    if (role === 'employee') return 'Employee';
    return 'User';
  };
  
  const RoleIcon = user.role === 'admin' ? ShieldCheck : user.role === 'manager' ? UserCog : UserIcon;


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
          <div className="flex flex-col sm:flex-row items-center space-y-4 sm:space-y-0 sm:space-x-4">
            <Avatar className="h-20 w-20 border-2 border-primary">
              <AvatarImage src={user.profilePictureUrl || undefined} alt={user.name || 'User Avatar'} data-ai-hint="profile person" />
              <AvatarFallback className="text-3xl">{initials}</AvatarFallback>
            </Avatar>
            <div className="text-center sm:text-left">
              <CardTitle className="text-2xl">{user.name || 'User Name'}</CardTitle>
              <CardDescription className="text-md flex items-center justify-center sm:justify-start">
                 <RoleIcon className="mr-1.5 h-4 w-4 text-muted-foreground" />
                {getRoleDisplayName(user.role)}
              </CardDescription>
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
                <Input id="email" value={user.email || 'Not set'} readOnly disabled className="bg-muted/20"/>
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
              <div className="space-y-1">
                <Label htmlFor="baseSalary" className="flex items-center text-muted-foreground">
                  <DollarSign className="mr-2 h-4 w-4" /> Base Monthly Salary
                </Label>
                <Input id="baseSalary" value={user.baseSalary ? `$${user.baseSalary.toLocaleString()}` : 'Not set'} readOnly disabled className="bg-muted/20"/>
              </div>
            </div>
          </div>
          
        </CardContent>
      </Card>
    </div>
  );
}
