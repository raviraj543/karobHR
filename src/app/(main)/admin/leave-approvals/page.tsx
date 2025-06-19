
'use client';

import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Loader2 } from 'lucide-react';
import { format } from 'date-fns';

export default function LeaveApprovalsPage() {
  const { allUsers, loading, approveLeaveApplication, rejectLeaveApplication } = useAuth();

  const pendingApplications = allUsers
    .flatMap(user => (user.leaves || []).map(leave => ({ ...leave, userName: user.name, userEmployeeId: user.employeeId })))
    .filter(leave => leave.status === 'pending');

  if (loading) {
    return <div className="flex justify-center items-center h-48"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Leave Approvals</h1>
      <Card>
        <CardHeader>
          <CardTitle>Pending Leave Applications</CardTitle>
          <CardDescription>Review and approve or reject leave requests from employees.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Leave Type</TableHead>
                <TableHead>Dates</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pendingApplications.length > 0 ? (
                pendingApplications.map(app => (
                  <TableRow key={app.id}>
                    <TableCell>{app.userName} ({app.userEmployeeId})</TableCell>
                    <TableCell>{app.leaveType}</TableCell>
                    <TableCell>{format(new Date(app.startDate), 'PPP')} - {format(new Date(app.endDate), 'PPP')}</TableCell>
                    <TableCell>{app.reason}</TableCell>
                    <TableCell className="space-x-2">
                      <Button size="sm" onClick={() => approveLeaveApplication(app.userId, app.id)}>Approve</Button>
                      <Button size="sm" variant="destructive" onClick={() => rejectLeaveApplication(app.userId, app.id)}>Reject</Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="text-center">No pending leave applications.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
