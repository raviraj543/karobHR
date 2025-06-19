
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { UserPlus, ArrowLeft, IndianRupee, AlertTriangle, Clock4 } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import type { NewEmployeeData } from '@/lib/authContext';
import type { UserRole } from '@/lib/types';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';

const newEmployeeSchema = z.object({
  name: z.string().min(2, { message: 'Name must be at least 2 characters.' }),
  employeeId: z.string().min(3, { message: 'Employee ID must be at least 3 characters.' })
    .regex(/^[a-zA-Z0-9_.-]*$/, { message: 'Employee ID can only contain letters, numbers, and _ . -' }),
  email: z.string().email({ message: 'Invalid email address.' }).optional().or(z.literal('')),
  password: z.string().min(6, { message: 'Password must be at least 6 characters.' }),
  confirmPassword: z.string().min(6, { message: 'Password must be at least 6 characters.' }),
  department: z.string().min(2, { message: 'Department is required.' }),
  role: z.enum(['employee', 'manager']).default('employee'),
  joiningDate: z.string().optional(),
  baseSalary: z.preprocess(
    (val) => (val === "" ? undefined : Number(val)),
    z.number({ invalid_type_error: 'Base salary must be a number.' }).positive({ message: 'Base salary must be positive.' }).optional()
  ),
  standardDailyHours: z.preprocess(
    (val) => (val === "" ? undefined : Number(val)),
    z.number({ invalid_type_error: 'Standard hours must be a number.' }).min(1, "Must be at least 1 hour").max(24, "Cannot exceed 24 hours").optional()
  ),
}).refine(data => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type NewEmployeeFormValues = z.infer<typeof newEmployeeSchema>;

export default function AddNewEmployeePage() {
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const { toast } = useToast();
  const { addNewEmployee, companyId: adminCompanyId, loading: authLoading, companySettings } = useAuth();

  const form = useForm<NewEmployeeFormValues>({
    resolver: zodResolver(newEmployeeSchema),
    defaultValues: {
      name: '',
      employeeId: '',
      email: '',
      password: '',
      confirmPassword: '',
      department: '',
      role: 'employee',
      joiningDate: new Date().toISOString().split('T')[0],
      baseSalary: undefined,
      standardDailyHours: 8, // Default standard hours
    },
  });

  const onSubmit = async (data: NewEmployeeFormValues) => {
    setIsLoading(true);

    if (!adminCompanyId) {
      toast({
        title: "Error: Admin Context Missing",
        description: "The administrator's company information is not available. Cannot add employee.",
        variant: "destructive",
      });
      setIsLoading(false);
      return;
    }

    if (!companySettings) {
        toast({
            title: "Error: Company Settings Missing",
            description: "Could not load company settings, which are required to add an employee.",
            variant: "destructive",
        });
        setIsLoading(false);
        return;
    }

    const employeeDataForContext: NewEmployeeData = {
      name: data.name,
      employeeId: data.employeeId,
      email: data.email,
      department: data.department,
      role: data.role as UserRole,
      companyId: adminCompanyId,
      companyName: companySettings.companyName,
      joiningDate: data.joiningDate,
      baseSalary: data.baseSalary,
      standardDailyHours: data.standardDailyHours,
    };

    try {
      const newEmployee = await addNewEmployee(employeeDataForContext, data.password);
      if (newEmployee) {
        toast({
          title: "Employee Account Added",
          description: `Account for ${data.name} (${data.employeeId}) has been added successfully.`,
          duration: 7000,
        });
        form.reset();
      }
    } catch (error) {
        toast({
            title: "Error Adding Employee",
            description: (error as Error).message || "Could not add employee.",
            variant: "destructive",
        });
    } finally {
        setIsLoading(false);
    }
  };

  useEffect(() => {
    document.title = 'Add New Employee - Admin - KarobHR';
  }, []);

  const isSubmitDisabled = isLoading || authLoading || !adminCompanyId;

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Add New Employee</h1>
          <p className="text-muted-foreground">Fill in the details to create a new employee account for your company.</p>
        </div>
         <Button variant="outline" asChild>
          <Link href="/admin/employees">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Employees
          </Link>
        </Button>
      </div>

      {!authLoading && !adminCompanyId && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Admin Company Context Missing</AlertTitle>
          <AlertDescription>
            The system could not identify the administrator's company. Please ensure you are properly logged in as an admin with company details.
          </AlertDescription>
        </Alert>
      )}

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center"><UserPlus className="mr-2 h-5 w-5 text-primary" />Employee Details</CardTitle>
          <CardDescription>The Employee ID and Password will be used for login.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Full Name</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., John Doe" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="employeeId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Employee ID (for Login)</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., emp123" {...field} />
                      </FormControl>
                      <FormDescription>Unique ID for login.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email Address (Optional)</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="e.g., john.doe@example.com" {...field} />
                    </FormControl>
                     <FormDescription>If blank, one will be auto-generated based on Employee ID and Company.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

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

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="department"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Department</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Engineering" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                 <FormField
                  control={form.control}
                  name="joiningDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Joining Date (Optional)</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="role"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Role</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a role" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="employee">Employee</SelectItem>
                          <SelectItem value="manager">Manager</SelectItem>
                          {/* Admin cannot create another admin from this page */}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                 <FormField
                  control={form.control}
                  name="baseSalary"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center">
                        <IndianRupee className="mr-1 h-4 w-4 text-muted-foreground" /> Base Monthly Salary (Optional)
                      </FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="e.g., 50000" {...field} onChange={e => field.onChange(e.target.value === '' ? undefined : Number(e.target.value))} value={field.value ?? ''} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
               <FormField
                  control={form.control}
                  name="standardDailyHours"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center">
                        <Clock4 className="mr-1 h-4 w-4 text-muted-foreground" /> Standard Daily Hours (Optional)
                      </FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="e.g., 8" {...field} onChange={e => field.onChange(e.target.value === '' ? undefined : Number(e.target.value))} value={field.value ?? ''} />
                      </FormControl>
                       <FormDescription>Default is 8 hours if not specified.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

              <Button type="submit" className="w-full md:w-auto" disabled={isSubmitDisabled}>
                {isLoading ? 'Adding Account...' : 'Add Employee Account'}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
