
'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import type { User, Advance } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { IndianRupee, CheckCircle, XCircle, ListFilter, UserCog, AlertTriangle } from 'lucide-react';
import type { Metadata } from 'next'; // Metadata needs to be handled differently for client components

// export const metadata: Metadata = { // Cannot be used in client components
//   title: 'Manage Payroll - Admin - BizFlow',
//   description: 'Oversee employee salaries and manage advance requests.',
// };


export default function AdminPayrollPage() {
  const { allUsers, processAdvance, loading: authLoading } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    document.title = 'Manage Payroll - Admin - BizFlow';
  }, []);

  const pendingAdvances = useMemo(() => {
    if (authLoading) return [];
    return allUsers.flatMap(user => 
      (user.advances || []).filter(adv => adv.status === 'pending').map(adv => ({ ...adv, userName: user.name || user.employeeId }))
    );
  }, [allUsers, authLoading]);

  const handleProcessAdvance = async (employeeId: string, advanceId: string, newStatus: 'approved' | 'rejected') => {
    setIsLoading(true);
    try {
      await processAdvance(employeeId, advanceId, newStatus);
      toast({
        title: `Advance ${newStatus}`,
        description: `The advance request has been ${newStatus}.`,
      });
    } catch (error) {
      console.error(`Error processing advance:`, error);
      toast({
        title: 'Error Processing Advance',
        description: (error as Error).message || 'Could not process the advance request.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const calculateNetPayable = (user: User) => {
    const baseSalary = user.baseSalary || 0;
    const approvedAdvances = (user.advances || [])
      .filter(adv => adv.status === 'approved')
      .reduce((sum, adv) => sum + adv.amount, 0);
    return baseSalary - approvedAdvances;
  };

  if (authLoading) {
    return <div className="text-center py-10">Loading payroll data...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Payroll Management</h1>
          <p className="text-muted-foreground">Oversee employee salaries and process advance requests.</p>
        </div>
        <Button variant="outline"><ListFilter className="mr-2 h-4 w-4" /> Filter Period (Mock)</Button>
      </div>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center"><IndianRupee className="mr-2 h-5 w-5 text-primary" />Employee Salary Overview</CardTitle>
          <CardDescription>
            Summary of employee salaries and deductions.
            <span className="block text-xs text-muted-foreground/80 italic mt-1">
              Note: Salary calculation is simplified for this mock (Net = Base - Approved Advances). Actual days worked are not factored in yet.
            </span>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee Name</TableHead>
                <TableHead><UserCog className="inline-block mr-1 h-4 w-4"/>Employee ID</TableHead>
                <TableHead>Base Salary</TableHead>
                <TableHead>Approved Advances</TableHead>
                <TableHead>Net Payable</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {allUsers.filter(u => u.role !== 'admin').map(user => ( // Exclude admins from payroll view for now
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.name || user.employeeId}</TableCell>
                  <TableCell className="font-mono text-xs">{user.employeeId}</TableCell>
                  <TableCell>₹{(user.baseSalary || 0).toLocaleString('en-IN')}</TableCell>
                  <TableCell className="text-red-600">
                    (₹{(user.advances || []).filter(adv => adv.status === 'approved').reduce((sum, adv) => sum + adv.amount, 0).toLocaleString('en-IN')})
                  </TableCell>
                  <TableCell className="font-semibold">₹{calculateNetPayable(user).toLocaleString('en-IN')}</TableCell>
                </TableRow>
              ))}
              {allUsers.filter(u => u.role !== 'admin').length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">No employee data available.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center"><AlertTriangle className="mr-2 h-5 w-5 text-primary" />Pending Advance Requests</CardTitle>
          <CardDescription>Review and process outstanding advance requests from employees.</CardDescription>
        </CardHeader>
        <CardContent>
          {pendingAdvances.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee Name</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Date Requested</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingAdvances.map(advance => (
                  <TableRow key={advance.id}>
                    <TableCell className="font-medium">{advance.userName}</TableCell>
                    <TableCell>₹{advance.amount.toLocaleString('en-IN')}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{advance.reason}</TableCell>
                    <TableCell>{new Date(advance.dateRequested).toLocaleDateString()}</TableCell>
                    <TableCell className="space-x-2">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => handleProcessAdvance(advance.employeeId, advance.id, 'approved')}
                        disabled={isLoading}
                        className="text-green-600 border-green-600 hover:bg-green-50 hover:text-green-700"
                      >
                        <CheckCircle className="mr-1 h-4 w-4" /> Approve
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => handleProcessAdvance(advance.employeeId, advance.id, 'rejected')}
                        disabled={isLoading}
                        className="text-red-600 border-red-600 hover:bg-red-50 hover:text-red-700"
                      >
                        <XCircle className="mr-1 h-4 w-4" /> Reject
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-muted-foreground text-center py-8">No pending advance requests.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
