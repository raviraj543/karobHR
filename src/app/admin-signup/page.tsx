
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
import { ShieldPlus, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import type { NewEmployeeData } from '@/lib/authContext';
import type { UserRole } from '@/lib/types';
import { v4 as uuidv4 } from 'uuid';
import { getFirebaseInstances } from '@/lib/firebase/firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';


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
  const { addNewEmployee, loading: authLoading } = useAuth();
  const [adminAccountExists, setAdminAccountExists] = useState<boolean | null>(null); // Changed default to null


  useEffect(() => {
    document.title = 'Create Admin Account - KarobHR';
    const checkAdminExistence = async () => {
        if (authLoading) return;
        const { db } = getFirebaseInstances();
        try {
            const q = query(collection(db, "userDirectory"), where("role", "==", "admin"));
            const adminSnapshot = await getDocs(q);
            if (!adminSnapshot.empty) {
                // Temporarily allow proceeding even if admin exists for debugging
                console.warn(">>> KAROBHR TRACE: Admin account(s) exist, but admin-signup page is temporarily allowing new signups for debugging.");
                toast({
                    title: "Admin Account(s) Exist (Debug Mode)",
                    description: "Admin-signup is temporarily enabled even if admins exist. Use with caution or delete old admin data in Firebase for a clean setup.",
                    variant: "default",
                    duration: 9000,
                });
                // setAdminAccountExists(true); // Original line that disables form
                setAdminAccountExists(false); // TEMPORARY: Allow form to be active
            } else {
                setAdminAccountExists(false);
            }
        } catch (error) {
            console.error("Error checking for existing admins:", error);
            toast({ title: "Error", description: "Could not verify admin status. Please try again.", variant: "destructive"});
            setAdminAccountExists(null);
        }
    };
    checkAdminExistence();
  }, [authLoading, router, toast]);


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
      joiningDate: new Date().toISOString().split('T')[0],
      baseSalary: 0,
    };

    try {
      // Optional: Re-check admin existence before submission, though initial check should cover most cases.
      // if (adminAccountExists && !confirm("An admin account seems to exist. Are you sure you want to create another one? This is for debug only.")) {
      //     toast({
      //         title: "Admin Creation Cancelled",
      //         description: "Admin setup was cancelled.",
      //         variant: "default",
      //     });
      //     setIsLoading(false);
      //     return;
      // }

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
            description: (error as Error).message || "Could not create admin account. The Employee ID or Email might already be in use.",
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

  if (authLoading || adminAccountExists === null) { // Wait if check is in progress
    return <div className="flex items-center justify-center min-h-screen">Loading setup information...</div>;
  }


  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-background to-muted p-4">
      <Card className="w-full max-w-lg shadow-xl">
        <CardHeader>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center">
              <ShieldPlus className="mr-2 h-8 w-8 text-primary" />
              <CardTitle className="text-2xl font-bold">Setup Company & Admin Account</CardTitle>
            </div>
             <Button variant="outline" size="sm" asChild>
               <Link href="/login">
                 <ArrowLeft className="mr-1 h-4 w-4" /> Back to Login
               </Link>
             </Button>
          </div>
          <CardDescription>
            Register your company and create the first administrator account for KarobHR.
            {adminAccountExists === true && <span className="block text-destructive font-semibold mt-1">Warning: Admin account(s) detected. New signup temporarily enabled for debugging.</span>}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="companyName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Company Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Acme Innovations Ltd." {...field} />
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
                      <Input placeholder="e.g., Jane Doe" {...field} />
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
                        <Input placeholder="e.g., jane.admin" {...field} />
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
                      <FormDescription>If blank, one will be auto-generated.</FormDescription>
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

              <Button type="submit" className="w-full md:w-auto" disabled={isLoading || authLoading}>
                {isLoading ? 'Creating Account...' : 'Create Company & Admin Account'}
              </Button>
               {/* Removed the "admin setup is already complete" message when form is enabled */}
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
