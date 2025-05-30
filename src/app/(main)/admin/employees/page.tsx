import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { PlusCircle, Search, Users, Edit2, Trash2, Mail, Phone } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Manage Employees - Admin - BizFlow',
  description: 'Add, view, and manage employee accounts.',
};

// Placeholder employee data
const employees = [
  { id: 'emp001', name: 'Alice Johnson', email: 'alice.j@bizflow.com', role: 'Developer', department: 'Engineering', status: 'Active', avatar: 'https://placehold.co/40x40.png?text=AJ' },
  { id: 'emp002', name: 'Bob Williams', email: 'bob.w@bizflow.com', role: 'Designer', department: 'Design', status: 'Active', avatar: 'https://placehold.co/40x40.png?text=BW' },
  { id: 'emp003', name: 'Carol Davis', email: 'carol.d@bizflow.com', role: 'Project Manager', department: 'Management', status: 'On Leave', avatar: 'https://placehold.co/40x40.png?text=CD' },
  { id: 'emp004', name: 'David Brown', email: 'david.b@bizflow.com', role: 'QA Engineer', department: 'Engineering', status: 'Inactive', avatar: 'https://placehold.co/40x40.png?text=DB' },
];

const getStatusBadgeVariant = (status: string) => {
  switch (status.toLowerCase()) {
    case 'active': return 'default'; // Success
    case 'on leave': return 'secondary'; // Warning
    case 'inactive': return 'outline'; // Muted
    default: return 'default';
  }
};

export default function AdminEmployeesPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Employee Management</h1>
          <p className="text-muted-foreground">Administer all employee accounts and information.</p>
        </div>
        <Button asChild>
          <Link href="/admin/employees/new">
            <PlusCircle className="mr-2 h-4 w-4" /> Add New Employee
          </Link>
        </Button>
      </div>

      <Card className="shadow-sm">
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
            <CardTitle className="flex items-center"><Users className="mr-2 h-5 w-5 text-primary" />All Employees</CardTitle>
            <div className="relative w-full sm:w-auto">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input type="search" placeholder="Search employees..." className="pl-8 sm:w-[300px]" />
            </div>
          </div>
          <CardDescription>View, edit, and manage employee details and access.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead className="hidden md:table-cell"><Mail className="inline-block mr-1 h-4 w-4"/>Email</TableHead>
                <TableHead className="hidden lg:table-cell">Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {employees.map(employee => (
                <TableRow key={employee.id}>
                  <TableCell>
                    <div className="flex items-center space-x-3">
                      <Avatar className="h-8 w-8" data-ai-hint="avatar person">
                        <AvatarImage src={employee.avatar} alt={employee.name} />
                        <AvatarFallback>{employee.name.split(' ').map(n=>n[0]).join('')}</AvatarFallback>
                      </Avatar>
                      <span className="font-medium">{employee.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">{employee.email}</TableCell>
                  <TableCell className="hidden lg:table-cell">{employee.role}</TableCell>
                  <TableCell>
                    <Badge variant={getStatusBadgeVariant(employee.status)}>{employee.status}</Badge>
                  </TableCell>
                  <TableCell className="space-x-1">
                     <Button variant="outline" size="sm" asChild className="h-8">
                        <Link href={`/admin/employees/${employee.id}`}>View</Link>
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8"><Edit2 className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive"><Trash2 className="h-4 w-4" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {employees.length === 0 && (
             <p className="text-muted-foreground text-center py-8">No employees found. Start by adding new employees.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
