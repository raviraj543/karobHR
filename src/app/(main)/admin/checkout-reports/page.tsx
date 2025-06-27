
'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import type { AttendanceEvent } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format, isSameMonth, parseISO } from 'date-fns';
import { TruncatedText } from '@/components/ui/truncated-text';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, FileCheck } from 'lucide-react';

export default function CheckoutReportsPage() {
    const { allUsers, attendanceLog, loading } = useAuth();
    
    const monthlyCheckouts = useMemo(() => {
        const now = new Date();
        return attendanceLog
            .filter(event => event.status === 'Checked Out' && event.timestamp && isSameMonth(parseISO(event.timestamp), now))
            .sort((a, b) => parseISO(b.timestamp).getTime() - parseISO(a.timestamp).getTime());
    }, [attendanceLog]);

    const getUserName = (employeeId: string) => {
        const user = allUsers.find(u => u.employeeId === employeeId);
        return user?.name || employeeId;
    };
    
    if (loading) {
        return (
            <div className="flex items-center justify-center h-full py-10">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="ml-2 text-muted-foreground">Loading Reports...</p>
            </div>
        );
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <FileCheck className="h-6 w-6 text-primary"/>
                    Monthly Checkout Reports
                </CardTitle>
                <CardDescription>A detailed log of all employee checkouts for the current month.</CardDescription>
            </CardHeader>
            <CardContent>
                <ScrollArea className="h-[60vh]">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Employee</TableHead>
                                <TableHead>Date</TableHead>
                                <TableHead>Check-in</TableHead>
                                <TableHead>Check-out</TableHead>
                                <TableHead>Total Hours</TableHead>
                                <TableHead>Work Report</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {monthlyCheckouts.length > 0 ? (
                                monthlyCheckouts.map(event => (
                                    <TableRow key={event.id}>
                                        <TableCell>{getUserName(event.employeeId)}</TableCell>
                                        <TableCell>{format(parseISO(event.timestamp), 'PP')}</TableCell>
                                        <TableCell>{event.checkInTime ? format(parseISO(event.checkInTime), 'p') : 'N/A'}</TableCell>
                                        <TableCell>{event.checkOutTime ? format(parseISO(event.checkOutTime), 'p') : 'N/A'}</TableCell>
                                        <TableCell>{event.totalHours ? event.totalHours.toFixed(2) + 'h' : 'N/A'}</TableCell>
                                        <TableCell>
                                            {event.workReport ? <TruncatedText text={event.workReport} /> : <span className="text-muted-foreground">No report</span>}
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center h-24">
                                        No checkout records for the current month.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </ScrollArea>
            </CardContent>
        </Card>
    );
}
