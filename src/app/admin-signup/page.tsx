
'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { useToast } from '@/hooks/use-toast';
import { ShieldPlus, ArrowLeft, Loader2, AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import type { NewEmployeeData } from '@/lib/authContext';
import type { UserRole } from '@/lib/types';
import { v4 as uuidv4 } from 'uuid';
import { getFirebaseInstances } from '@/lib/firebase/firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { Alert, AlertDescription as AlertDescriptionComponent, AlertTitle as AlertTitleComponent } from '@/components/ui/alert';


const adminSignupSchema = z.object({
  companyName: z.string().min(2, {message: 'Company name must be at least 2 characters.'}),
  adminName: z.string().min(2, { message: 'Admin name must be at least 2 characters.' }),
  adminId: z.string().min(3, { message: 'Admin Login ID must be at least 3 characters.' })
    .regex(/^[a-zA-Z0-9_.-]*$/, { message: 'Admin Login ID can only contain letters, numbers, and _ . -' }),
  adminEmail: z.string().email({ message: 'Invalid email address.' }).optional().or(z.literal('')),
  password: z.string().min(6, { message: 'Password must be at least 6 characters.' }),
  confirmPassword: z.string().min(6, { message: 'Password must be at least 6 characters.' }),
}).refine(data => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type AdminSignupFormValues = z.infer<typeof adminSignupSchema>;

export default function AdminSignupPage() {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const router = useRouter();
  const { user, addNewEmployee, loading: authContextLoading } = useAuth();
  const [checkingAdminStatus, setCheckingAdminStatus] = useState<boolean>(true);
  const [showAdminExistsWarning, setShowAdminExistsWarning] = useState<boolean>(false);


  useEffect(() => {
    document.title = 'Create Admin Account - KarobHR';

    const checkAdminExistence = async () => {
      setCheckingAdminStatus(true);
      if (authContextLoading) {
        // Wait for auth context to potentially load a user
        return;
      }

      if (user) {
        toast({
            title: "Already Logged In",
            description: `You are logged in as ${user.name}. To create a new company & admin, please log out first.`,
            variant: "default",
            duration: 7000,
        });
        router.replace(user.role === 'admin' ? '/admin/dashboard' : '/dashboard');
        return; // Stop further execution in this effect
      }

      const { db } = getFirebaseInstances();
      try {
        const q = query(collection(db, "userDirectory"), where("role", "==", "admin"));
        const adminSnapshot = await getDocs(q);
        if (!adminSnapshot.empty) {
          setShowAdminExistsWarning(true);
          console.warn(">>> KAROBHR TRACE: Admin account(s) exist in the system. Admin signup page still allows new company/admin creation.");
          // Toast is optional here, the UI warning is more persistent
        } else {
          setShowAdminExistsWarning(false);
        }
      } catch (error) {
        console.error("Error checking for existing admins:", error);
        toast({ title: "System Error", description: "Could not verify system admin status. Please proceed with caution or try again later.", variant: "destructive"});
      } finally {
        setCheckingAdminStatus(false);
      }
    };

    checkAdminExistence();
  }, [authContextLoading, router, toast, user]);


  const onSubmit = async (data: AdminSignupFormValues) => {
    setIsLoading(true);
    
    const newCompanyId = uuidv4();

    const adminDataForContext: NewEmployeeData = {
      name: data.adminName,
      employeeId: data.adminId,
      email: data.adminEmail, 
      department: 'Administration',
      role: 'admin' as UserRole,
      companyId: newCompanyId,
      companyName: data.companyName,
      joiningDate: new Date().toISOString().split('T')[0],
      baseSalary: 0, 
    };

    try {
      await addNewEmployee(adminDataForContext, data.password);
      toast({
        title: "Admin Account & Company Registered!",
        description: `Admin '${data.adminId}' for company '${data.companyName}' created. You can now log in. Company ID: ${newCompanyId}`,
        duration: 9000,
      });
      form.reset();
      router.push('/login');
    } catch (error) {
        toast({
            title: "Error Creating Admin Account",
            description: (error as Error).message || "Could not create admin account. The Admin Login ID or Email might already be in use with another company, or another error occurred.",
            variant: "destructive",
            duration: 7000,
        });
    } finally {
        setIsLoading(false);
    }
  };

  const form = useForm<AdminSignupFormValues>({
    resolver: zodResolver(adminSignupSchema),
    defaultValues: {
      companyName: '',
      adminName: '',
      adminId: '',
      adminEmail: '',
      password: '',
      confirmPassword: '',
    },
  });

  if (authContextLoading || checkingAdminStatus) { 
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground">{authContextLoading ? 'Loading user session...' : 'Checking system status...'}</p>
      </div>
    );
  }


  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-background to-muted p-4">
      <Card className="w-full max-w-lg shadow-xl">
        <CardHeader>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center">
              <ShieldPlus className="mr-2 h-8 w-8 text-primary" />
              <CardTitle className="text-2xl font-bold">Setup New Company & Admin</CardTitle>
            </div>
             <Button variant="outline" size="sm" asChild>
               <Link href="/login">
                 <ArrowLeft className="mr-1 h-4 w-4" /> Back to Login
               </Link>
             </Button>
          </div>
          <CardDescription>
            Register a new company and create its first administrator account for KarobHR.
          </CardDescription>
          {showAdminExistsWarning && (
            <Alert variant="default" className="mt-3 bg-yellow-50 border-yellow-300 text-yellow-700">
              <AlertTriangle className="h-4 w-4 !text-yellow-600" />
              <AlertTitleComponent>Existing Admin Accounts Detected</AlertTitleComponent>
              <AlertDescriptionComponent>
                One or more admin accounts already exist in the system. This page allows you to create a new, independent company and its administrator.
              </AlertDescriptionComponent>
            </Alert>
          )}
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="companyName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>New Company Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Stark Industries, Wayne Enterprises" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
               <FormField
                control={form.control}
                name="adminName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Your Full Name (Administrator)</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Tony Stark, Bruce Wayne" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="adminId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Admin Login ID</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., tony.admin" {...field} />
                      </FormControl>
                       <FormDescription>Unique ID for login.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="adminEmail"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Admin Email (Optional)</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="e.g., admin@company.com" {...field} />
                      </FormControl>
                      <FormDescription>If blank, one may be auto-generated.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="••••••••" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="confirmPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Confirm Password</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="••••••••" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <Button type="submit" className="w-full md:w-auto" disabled={isLoading || authContextLoading || checkingAdminStatus}>
                {(isLoading || authContextLoading || checkingAdminStatus) ? 'Please wait...' : 'Create Company & Admin Account'}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}

