
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

const adminSignupSchema = z.object({
  name: z.string().min(2, { message: 'Name must be at least 2 characters.' }),
  adminId: z.string().min(3, { message: 'Admin ID must be at least 3 characters.' })
    .regex(/^[a-zA-Z0-9_.-]*$/, { message: 'Admin ID can only contain letters, numbers, and _ . -' }),
  email: z.string().email({ message: 'Invalid email address.' }).optional().or(z.literal('')),
  password: z.string().min(6, { message: 'Password must be at least 6 characters.' }),
  confirmPassword: z.string().min(6, { message: 'Password must be at least 6 characters.' }),
  department: z.string().optional(), // Admin might not need a department, or it's fixed
}).refine(data => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type AdminSignupFormValues = z.infer<typeof adminSignupSchema>;

export default function AdminSignupPage() {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const router = useRouter();
  const { addNewEmployee, allUsers } = useAuth(); // Use addNewEmployee from context

  const form = useForm<AdminSignupFormValues>({
    resolver: zodResolver(adminSignupSchema),
    defaultValues: {
      name: '',
      adminId: '',
      email: '',
      password: '',
      confirmPassword: '',
      department: 'Administration', // Default for admin
    },
  });

  // Check if an admin already exists. If so, redirect.
  // This is a simple check; for production, backend validation is critical.
  useEffect(() => {
    const adminExists = allUsers.some(user => user.role === 'admin');
    if (adminExists && allUsers.length > 0) { // Check allUsers.length to ensure initial load is complete
      toast({
        title: "Admin Account Exists",
        description: "An admin account has already been set up. Please log in.",
        variant: "destructive",
        duration: 7000,
      });
      router.replace('/login');
    }
  }, [allUsers, router, toast]);


  const onSubmit = async (data: AdminSignupFormValues) => {
    setIsLoading(true);

    const adminDataForContext: NewEmployeeData = {
      name: data.name,
      employeeId: data.adminId,
      email: data.email,
      department: data.department || 'Administration', // Default if empty
      role: 'admin' as UserRole, // Explicitly set role to admin
      // Joining date and base salary can be omitted or set to defaults for admin
      joiningDate: new Date().toISOString().split('T')[0],
      baseSalary: 0, // Admins in this system might not have a typical salary structure
    };

    try {
      // Check again before submission, in case of race condition (unlikely in this client-side setup)
      const adminExists = allUsers.some(user => user.role === 'admin');
      if (adminExists) {
         toast({
          title: "Admin Account Exists",
          description: "An admin account has already been set up. Please log in.",
          variant: "destructive",
        });
        router.replace('/login');
        setIsLoading(false);
        return;
      }

      await addNewEmployee(adminDataForContext, data.password);
      toast({
        title: "Admin Account Created!",
        description: `Admin account for '${data.adminId}' successfully created. You can now log in.`,
        duration: 7000,
      });
      form.reset();
      router.push('/login'); // Redirect to login after successful admin creation
    } catch (error) {
        toast({
            title: "Error Creating Admin Account",
            description: (error as Error).message || "Could not create admin account.",
            variant: "destructive",
        });
    } finally {
        setIsLoading(false);
    }
  };
  
  useEffect(() => {
    document.title = 'Create Admin Account - KarobHR';
  }, []);

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-background to-muted p-4">
      <Card className="w-full max-w-lg shadow-xl">
        <CardHeader>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center">
              <ShieldPlus className="mr-2 h-8 w-8 text-primary" />
              <CardTitle className="text-2xl font-bold">Create Initial Admin Account</CardTitle>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link href="/login">
                <ArrowLeft className="mr-1 h-4 w-4" /> Back to Login
              </Link>
            </Button>
          </div>
          <CardDescription>
            Fill in the details to create the first administrator account for KarobHR.
            This page should only be accessible if no admin accounts exist.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Site Administrator" {...field} />
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
                      <FormLabel>Admin ID (for Login)</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., main_admin" {...field} />
                      </FormControl>
                       <FormDescription>Unique ID for login. No spaces or special chars other than _ . -</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email Address (Optional)</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="e.g., admin@example.com" {...field} />
                      </FormControl>
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
              
              <Button type="submit" className="w-full md:w-auto" disabled={isLoading}>
                {isLoading ? 'Creating Account...' : 'Create Admin Account'}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
