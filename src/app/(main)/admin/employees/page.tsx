
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { PlusCircle, Search, Users, Edit2, Trash2, Mail, Phone, UserCog, Briefcase as RoleIcon } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Manage Employees - Admin - BizFlow',
  description: 'Add, view, and manage employee accounts.',
};

// Placeholder employee data - In a real app, this would come from a data store
const employees = [
  { id: 'emp001', name: 'Alice Johnson', email: 'alice.j@bizflow.com', role: 'Employee', department: 'Engineering', status: 'Active', avatar: 'https://placehold.co/40x40.png?text=AJ' },
  { id: 'emp002', name: 'Bob Williams', email: 'bob.w@bizflow.com', role: 'Employee', department: 'Design', status: 'Active', avatar: 'https://placehold.co/40x40.png?text=BW' },
  { id: 'man101', name: 'Mike Manager', email: 'mike.manager@bizflow.com', role: 'Manager', department: 'Operations', status: 'Active', avatar: 'https://placehold.co/40x40.png?text=MM' },
  { id: 'emp003', name: 'Carol Davis', email: 'carol.d@bizflow.com', role: 'Employee', department: 'Management', status: 'On Leave', avatar: 'https://placehold.co/40x40.png?text=CD' },
  { id: 'emp004', name: 'David Brown', email: 'david.b@bizflow.com', role: 'Employee', department: 'QA Engineering', status: 'Inactive', avatar: 'https://placehold.co/40x40.png?text=DB' },
  { id: 'admin001', name: 'Jane Admin', email: 'admin@bizflow.com', role: 'Administrator', department: 'System', status: 'Active', avatar: 'https://placehold.co/40x40.png?text=JA' },
];

const getStatusBadgeVariant = (status: string) => {
  switch (status.toLowerCase()) {
    case 'active': return 'default'; 
    case 'on leave': return 'secondary'; 
    case 'inactive': return 'outline'; 
    default: return 'default';
  }
};

const getRoleBadgeVariant = (role: string) => {
  switch (role.toLowerCase()) {
    case 'administrator': return 'destructive'; 
    case 'manager': return 'secondary'; // Using 'secondary' which typically has a distinct style
    case 'employee': return 'outline'; 
    default: return 'default';
  }
}

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
          <CardDescription>View, edit, and manage employee details and access. Note: This list is static. Newly "created" employees won't appear here without backend integration.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead className="hidden sm:table-cell"><UserCog className="inline-block mr-1 h-4 w-4"/>Employee ID</TableHead>
                <TableHead className="hidden md:table-cell"><Mail className="inline-block mr-1 h-4 w-4"/>Email</TableHead>
                <TableHead><RoleIcon className="inline-block mr-1 h-4 w-4"/>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {employees.map(employee => (
                <TableRow key={employee.id}>
                  <TableCell>
                    <Link href={`/admin/employees/${employee.id}`}>
                      <div className="flex items-center space-x-3">
                        <Avatar className="h-8 w-8" data-ai-hint="avatar person">
                          <AvatarImage src={employee.avatar} alt={employee.name} />
                          <AvatarFallback>{employee.name.split(' ').map(n=>n[0]).join('')}</AvatarFallback>
                        </Avatar>
                        <span className="font-medium hover:text-primary transition-colors">{employee.name}</span>
                      </div>
                    </Link>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell font-mono text-xs">{employee.id}</TableCell>
                  <TableCell className="hidden md:table-cell">{employee.email}</TableCell>
                  <TableCell>
                     <Badge variant={getRoleBadgeVariant(employee.role)}>{employee.role}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={getStatusBadgeVariant(employee.status)}>{employee.status}</Badge>
                  </TableCell>
                  <TableCell className="space-x-1">
                     <Button variant="outline" size="sm" asChild className="h-8">
                        <Link href={`/admin/employees/${employee.id}`}>View</Link>
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" title="Edit Employee (Mock Action)"><Edit2 className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" title="Delete Employee (Mock Action)"><Trash2 className="h-4 w-4" /></Button>
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
