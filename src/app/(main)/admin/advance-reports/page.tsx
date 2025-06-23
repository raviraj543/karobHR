
'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import type { Advance } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';

export default function AdvanceReportsPage() {
    const { allUsers, companyId, loading } = useAuth();
    const [advances, setAdvances] = useState<Advance[]>([]);

    // This would be improved by having a dedicated `advances` list in the AuthContext
    useEffect(() => {
        if (allUsers.length > 0) {
            const allAdvances = allUsers.flatMap(user => user.advances || []);
            setAdvances(allAdvances);
        }
    }, [allUsers]);

    const getUserName = (employeeId: string) => {
        const user = allUsers.find(u => u.employeeId === employeeId);
        return user?.name || employeeId;
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Advance Reports</CardTitle>
                <CardDescription>A log of all advance requests from employees.</CardDescription>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Employee</TableHead>
                            <TableHead>Amount</TableHead>
                            <TableHead>Reason</TableHead>
                            <TableHead>Date Requested</TableHead>
                            <TableHead>Status</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {advances.map(advance => (
                            <TableRow key={advance.id}>
                                <TableCell>{getUserName(advance.employeeId)}</TableCell>
                                <TableCell>₹{advance.amount.toFixed(2)}</TableCell>
                                <TableCell>{advance.reason}</TableCell>
                                <TableCell>{format(new Date(advance.dateRequested), 'PPP')}</TableCell>
                                <TableCell>
                                    <Badge variant={advance.status === 'approved' ? 'default' : advance.status === 'rejected' ? 'destructive' : 'secondary'}>
                                        {advance.status}
                                    </Badge>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}
