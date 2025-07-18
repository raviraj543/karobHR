
'use client';

import { useState, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Loader2, Check, X, History } from 'lucide-react';
import { format } from 'date-fns';
import type { Advance } from '@/lib/app-types';

export default function AdvanceApprovalsPage() {
  const { advanceRequests, loading, approveAdvance, rejectAdvance } = useAuth();
  
  const pendingApplications = useMemo(() => 
    advanceRequests.filter(app => app.status === 'pending'), 
    [advanceRequests]
  );

  const processedApplications = useMemo(() => 
    advanceRequests.filter(app => app.status !== 'pending'),
    [advanceRequests]
  );

  const handleApprove = async (advanceId: string) => {
    await approveAdvance(advanceId);
  }

  const handleReject = async (advanceId: string) => {
    await rejectAdvance(advanceId);
  }

  const getStatusBadgeVariant = (status: Advance['status']) => {
    switch (status) {
      case 'approved':
        return 'default';
      case 'rejected':
        return 'destructive';
      default:
        return 'secondary';
    }
  };

  if (loading) {
    return <div className="flex justify-center items-center h-48"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Salary Advance Approvals</h1>
      <Card>
        <CardHeader>
          <CardTitle>Pending Advance Requests</CardTitle>
          <CardDescription>Review and approve or reject salary advance requests from employees.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee ID</TableHead>
                <TableHead>Amount (₹)</TableHead>
                <TableHead>Date Requested</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pendingApplications.length > 0 ? (
                pendingApplications.map(app => (
                  <TableRow key={app.id}>
                    <TableCell className="font-medium">{app.employeeId}</TableCell>
                    <TableCell>₹{app.amount.toLocaleString('en-IN')}</TableCell>
                    <TableCell>{format(new Date(app.dateRequested), 'PPP')}</TableCell>
                    <TableCell className="max-w-[300px] truncate">{app.reason}</TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button size="sm" variant="outline" className="text-green-600 border-green-600 hover:bg-green-100 hover:text-green-700" onClick={() => handleApprove(app.id)}>
                        <Check className="h-4 w-4 mr-1"/> Approve
                      </Button>
                      <Button size="sm" variant="outline" className="text-red-600 border-red-600 hover:bg-red-100 hover:text-red-700" onClick={() => handleReject(app.id)}>
                         <X className="h-4 w-4 mr-1"/> Reject
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-10">No pending advance requests.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center"><History className="mr-2 h-5 w-5 text-primary"/>Approval History</CardTitle>
          <CardDescription>A log of all processed advance requests.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee ID</TableHead>
                <TableHead>Amount (₹)</TableHead>
                <TableHead>Date Requested</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead className="text-right">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {processedApplications.length > 0 ? (
                processedApplications.map(app => (
                  <TableRow key={app.id}>
                    <TableCell className="font-medium">{app.employeeId}</TableCell>
                    <TableCell>₹{app.amount.toLocaleString('en-IN')}</TableCell>
                    <TableCell>{format(new Date(app.dateRequested), 'PPP')}</TableCell>
                    <TableCell className="max-w-[300px] truncate">{app.reason}</TableCell>
                    <TableCell className="text-right">
                      <Badge variant={getStatusBadgeVariant(app.status)} className="capitalize">
                        {app.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-10">No processed advance requests found.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
