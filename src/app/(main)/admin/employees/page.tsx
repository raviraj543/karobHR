
'use client'; // Required because we're using hooks (useAuth, useState, useEffect)

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import type { User } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { PlusCircle, Search, Users, Edit2, Trash2, Mail, Phone, UserCog, Briefcase as RoleIcon, Loader2, ArrowRight } from 'lucide-react';
import Link from 'next/link';


const getStatusBadgeVariant = (status?: string) => { 
  switch (status?.toLowerCase()) {
    case 'on leave': return 'secondary'; 
    case 'inactive': return 'outline'; 
    default: return 'default'; // 'Active'
  }
};

const getRoleBadgeVariant = (role: User['role']) => {
  if (!role) return 'default';
  switch (role.toLowerCase()) {
    case 'admin': return 'destructive'; 
    case 'manager': return 'secondary';
    case 'employee': return 'outline'; 
    default: return 'default';
  }
}

const getRoleDisplayName = (role: User['role']) => {
    if (!role) return 'N/A';
    switch (role) {
        case 'admin': return 'Administrator';
        case 'manager': return 'Manager';
        case 'employee': return 'Employee';
        default: return role.charAt(0).toUpperCase() + role.slice(1);
    }
}

export default function AdminEmployeesPage() {
  const { allUsers, loading: authLoading } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredEmployees, setFilteredEmployees] = useState<User[]>([]);

  useEffect(() => {
    document.title = 'Manage Employees - Admin - KarobHR';
  }, []);

  useEffect(() => {
    const displayableUsers = allUsers.filter(u => u.role !== 'admin'); 
    
    if (searchTerm.trim() === '') {
      setFilteredEmployees(displayableUsers);
    } else {
      setFilteredEmployees(
        displayableUsers.filter(employee =>
          employee.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          employee.employeeId.toLowerCase().includes(searchTerm.toLowerCase()) ||
          employee.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          employee.role?.toLowerCase().includes(searchTerm.toLowerCase())
        )
      );
    }
  }, [allUsers, searchTerm]);

  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-full py-10">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-2 text-muted-foreground">Loading employee data...</p>
      </div>
    );
  }

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
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                    type="search" 
                    placeholder="Search employees..." 
                    className="pl-8 sm:w-[300px]" 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>
          </div>
          <CardDescription>
            View, edit, and manage employee details. Newly added employees will appear here and can log in.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead className="hidden sm:table-cell"><UserCog className="inline-block mr-1 h-4 w-4"/>Employee ID</TableHead>
                <TableHead className="hidden md:table-cell"><Mail className="inline-block mr-1 h-4 w-4"/>Email</TableHead>
                <TableHead><RoleIcon className="inline-block mr-1 h-4 w-4"/>Role</TableHead>
                <TableHead>Status (Mock)</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredEmployees.map(employee => (
                <TableRow key={employee.id} className="hover:bg-muted/50 transition-colors">
                  <TableCell>
                    <Link href={`/admin/employees/${employee.employeeId}`} className="flex items-center space-x-3 group">
                      <Avatar className="h-9 w-9 border" data-ai-hint="avatar person">
                        <AvatarImage src={employee.profilePictureUrl || undefined} alt={employee.name || 'User'} />
                        <AvatarFallback>{employee.name ? employee.name.split(' ').map(n=>n[0]).join('') : 'U'}</AvatarFallback>
                      </Avatar>
                      <span className="font-medium group-hover:text-primary transition-colors">{employee.name || 'N/A'}</span>
                    </Link>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell font-mono text-xs text-muted-foreground">{employee.employeeId}</TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground">{employee.email || 'N/A'}</TableCell>
                  <TableCell>
                     <Badge variant={getRoleBadgeVariant(employee.role)}>{getRoleDisplayName(employee.role)}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={getStatusBadgeVariant('Active')}>Active</Badge>
                  </TableCell>
                  <TableCell className="space-x-1">
                     <Button variant="outline" size="sm" asChild className="h-8 group">
                        <Link href={`/admin/employees/${employee.employeeId}`}>
                            View <ArrowRight className="ml-1.5 h-3.5 w-3.5 opacity-70 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all"/>
                        </Link>
                    </Button>
                    {/* <Button variant="ghost" size="icon" className="h-8 w-8" title="Edit Employee (Mock Action)"><Edit2 className="h-4 w-4" /></Button> */}
                    {/* <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" title="Delete Employee (Mock Action)"><Trash2 className="h-4 w-4" /></Button> */}
                  </TableCell>
                </TableRow>
              ))}
              {filteredEmployees.length === 0 && !authLoading && (
                 <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      {searchTerm ? "No employees match your search." : "No employees found. Start by adding new employees."}
                    </TableCell>
                 </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
