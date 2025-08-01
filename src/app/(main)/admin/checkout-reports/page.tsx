
'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import type { AttendanceEvent } from '@/lib/app-types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format, isSameMonth } from 'date-fns'; // Removed parseISO
import { TruncatedText } from '@/components/ui/truncated-text';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, FileCheck } from 'lucide-react';
import { safeParseISO } from '@/lib/dateUtils'; // Import safeParseISO

export default function CheckoutReportsPage() {
    const { allUsers, attendanceLog, loading } = useAuth();
    
    const monthlyCheckouts = useMemo(() => {
        const now = new Date();
        return attendanceLog
            .filter(event => {
                const eventDate = event.timestamp && (event.timestamp as any).toDate ? safeParseISO((event.timestamp as any).toDate().toISOString()) : safeParseISO(event.timestamp);
                return event.status === 'Checked Out' && eventDate && isSameMonth(eventDate, now);
            })
            .sort((a, b) => {
                const dateA = a.timestamp && (a.timestamp as any).toDate ? safeParseISO((a.timestamp as any).toDate().toISOString()) : safeParseISO(a.timestamp);
                const dateB = b.timestamp && (b.timestamp as any).toDate ? safeParseISO((b.timestamp as any).toDate().toISOString()) : safeParseISO(b.timestamp);
                if (!dateA || !dateB) return 0; // Handle cases where date parsing fails
                return dateB.getTime() - dateA.getTime();
            });
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
                                monthlyCheckouts.map(event => {
                                    const eventTimestamp = event.timestamp && (event.timestamp as any).toDate ? (event.timestamp as any).toDate().toISOString() : event.timestamp;
                                    const checkInTimestamp = event.checkInTime && (event.checkInTime as any).toDate ? (event.checkInTime as any).toDate().toISOString() : event.checkInTime;
                                    const checkOutTimestamp = event.checkOutTime && (event.checkOutTime as any).toDate ? (event.checkOutTime as any).toDate().toISOString() : event.checkOutTime;

                                    const formattedEventDate = eventTimestamp ? format(safeParseISO(eventTimestamp)!, 'PP') : 'N/A';
                                    const formattedCheckInTime = checkInTimestamp ? format(safeParseISO(checkInTimestamp)!, 'p') : 'N/A';
                                    const formattedCheckOutTime = checkOutTimestamp ? format(safeParseISO(checkOutTimestamp)!, 'p') : 'N/A';

                                    return (
                                        <TableRow key={event.id}>
                                            <TableCell>{getUserName(event.employeeId)}</TableCell>
                                            <TableCell>{formattedEventDate}</TableCell>
                                            <TableCell>{formattedCheckInTime}</TableCell>
                                            <TableCell>{formattedCheckOutTime}</TableCell>
                                            <TableCell>{event.totalHours ? event.totalHours.toFixed(2) + 'h' : 'N/A'}</TableCell>
                                            <TableCell>
                                                {event.workReport ? <TruncatedText text={event.workReport} /> : <span className="text-muted-foreground">No report</span>}
                                            </TableCell>
                                        </TableRow>
                                    );
                                })
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
