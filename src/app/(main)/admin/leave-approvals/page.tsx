
'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import type { User, LeaveApplication } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { CheckCircle, XCircle, CalendarClock, Users, Loader2, AlertTriangle } from 'lucide-react';
import Link from 'next/link';

interface LeaveRequestWithUserInfo extends LeaveApplication {
  userName: string;
  userDepartment?: string;
  userProfilePictureUrl?: string;
}

export default function AdminLeaveApprovalsPage() {
  const { allUsers, processLeaveApplication, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState<Record<string, boolean>>({}); // Tracks processing state per leave ID

  useEffect(() => {
    document.title = 'Leave Approvals - Admin - KarobHR';
  }, []);

  const pendingLeaveRequests = useMemo((): LeaveRequestWithUserInfo[] => {
    if (authLoading) return [];
    return allUsers
      .filter(user => user.role === 'employee' || user.role === 'manager') // Admins typically don't request leave this way
      .flatMap(user =>
        (user.leaves || [])
          .filter(leave => leave.status === 'pending')
          .map(leave => ({
            ...leave,
            userName: user.name || user.employeeId,
            userDepartment: user.department,
            userProfilePictureUrl: user.profilePictureUrl,
          }))
      )
      .sort((a, b) => new Date(a.appliedAt).getTime() - new Date(b.appliedAt).getTime()); // Oldest first
  }, [allUsers, authLoading]);

  const handleProcessLeave = async (employeeUid: string, leaveId: string, newStatus: 'approved' | 'rejected') => {
    setIsProcessing(prev => ({ ...prev, [leaveId]: true }));
    try {
      await processLeaveApplication(employeeUid, leaveId, newStatus);
      toast({
        title: `Leave Application ${newStatus === 'approved' ? 'Approved' : 'Rejected'}`,
        description: `The leave request has been successfully ${newStatus}.`,
      });
    } catch (error) {
      toast({
        title: 'Error Processing Leave',
        description: (error as Error).message || 'Could not process the leave request.',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(prev => ({ ...prev, [leaveId]: false }));
    }
  };

  const getStatusColor = (status: LeaveApplication['status']) => {
    switch (status) {
        case 'approved': return 'bg-green-100 text-green-700 border-green-300';
        case 'rejected': return 'bg-red-100 text-red-700 border-red-300';
        case 'pending':
        default: return 'bg-yellow-100 text-yellow-700 border-yellow-300';
    }
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-full py-10">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-2 text-muted-foreground">Loading leave requests...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Leave Approvals</h1>
          <p className="text-muted-foreground">Review and process pending leave requests from employees.</p>
        </div>
        {/* Optional: Link to view all leave history or policies */}
      </div>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center"><CalendarClock className="mr-2 h-5 w-5 text-primary" />Pending Leave Requests</CardTitle>
          <CardDescription>
            Approve or reject leave applications submitted by employees and managers.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {pendingLeaveRequests.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead className="hidden md:table-cell">Department</TableHead>
                  <TableHead>Leave Type</TableHead>
                  <TableHead>Dates</TableHead>
                  <TableHead className="hidden lg:table-cell">Reason</TableHead>
                  <TableHead>Applied On</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingLeaveRequests.map(request => (
                  <TableRow key={request.id} className="hover:bg-muted/50 transition-colors">
                    <TableCell>
                      <Link href={`/admin/employees/${request.employeeId}`} className="font-medium hover:text-primary transition-colors">
                        {request.userName}
                      </Link>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-muted-foreground">{request.userDepartment || 'N/A'}</TableCell>
                    <TableCell>{request.leaveType}</TableCell>
                    <TableCell className="text-sm">
                      {new Date(request.startDate).toLocaleDateString()} - {new Date(request.endDate).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-xs text-muted-foreground max-w-xs truncate" title={request.reason}>
                      {request.reason}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{new Date(request.appliedAt).toLocaleDateString()}</TableCell>
                    <TableCell className="space-x-2 whitespace-nowrap">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleProcessLeave(request.userId, request.id, 'approved')}
                        disabled={isProcessing[request.id]}
                        className="text-green-600 border-green-600 hover:bg-green-50 hover:text-green-700"
                      >
                        {isProcessing[request.id] && <Loader2 className="mr-1 h-3 w-3 animate-spin"/>}
                        <CheckCircle className="mr-1 h-3.5 w-3.5" /> Approve
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleProcessLeave(request.userId, request.id, 'rejected')}
                        disabled={isProcessing[request.id]}
                        className="text-red-600 border-red-600 hover:bg-red-50 hover:text-red-700"
                      >
                         {isProcessing[request.id] && <Loader2 className="mr-1 h-3 w-3 animate-spin"/>}
                        <XCircle className="mr-1 h-3.5 w-3.5" /> Reject
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <CheckCircle className="mx-auto h-12 w-12 text-green-500 mb-3" />
              No pending leave requests at this time. Great!
            </div>
          )}
        </CardContent>
      </Card>

       <Card className="shadow-sm mt-8">
        <CardHeader>
          <CardTitle className="flex items-center"><Users className="mr-2 h-5 w-5 text-primary" />Leave History (All Employees)</CardTitle>
          <CardDescription>
            View all processed leave applications. (Feature pending full implementation)
          </CardDescription>
        </CardHeader>
        <CardContent>
            <p className="text-muted-foreground text-center py-4">A comprehensive table of all approved and rejected leaves will be shown here.</p>
            {/* TODO: Implement a table similar to pending requests but showing all non-pending leaves */}
        </CardContent>
      </Card>
    </div>
  );
}
