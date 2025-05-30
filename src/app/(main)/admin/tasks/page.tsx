import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { PlusCircle, Search, Briefcase, User, CalendarDays, AlertCircle } from 'lucide-react';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Manage Tasks - Admin - BizFlow',
  description: 'Assign, track, and manage employee tasks.',
};

// Placeholder task data
const allTasks = [
  { id: '101', title: 'Develop new marketing campaign', assignee: 'Alice Johnson', dueDate: '2023-11-10', priority: 'High', status: 'In Progress' },
  { id: '102', title: 'Onboard new clients for Q4', assignee: 'Bob Williams', dueDate: '2023-11-15', priority: 'Medium', status: 'Pending' },
  { id: '103', title: 'Finalize budget for 2024', assignee: 'Carol Davis', dueDate: '2023-10-30', priority: 'High', status: 'Completed' },
  { id: '104', title: 'Update server infrastructure', assignee: 'David Brown', dueDate: '2023-12-01', priority: 'Critical', status: 'Blocked' },
];

const getPriorityBadgeVariant = (priority: string) => {
  switch (priority.toLowerCase()) {
    case 'critical':
    case 'high': return 'destructive';
    case 'medium': return 'secondary';
    case 'low': return 'outline';
    default: return 'default';
  }
};
const getStatusBadgeVariant = (status: string) => {
  switch (status.toLowerCase()) {
    case 'completed': return 'default'; 
    case 'in progress': return 'secondary';
    case 'pending': return 'outline';
    case 'blocked': return 'destructive';
    default: return 'default';
  }
};


export default function AdminTasksPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Task Management</h1>
          <p className="text-muted-foreground">Oversee and manage all employee tasks.</p>
        </div>
        <Button>
          <PlusCircle className="mr-2 h-4 w-4" /> Assign New Task
        </Button>
      </div>

      <Card className="shadow-sm">
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
            <CardTitle className="flex items-center"><Briefcase className="mr-2 h-5 w-5 text-primary" />All Tasks</CardTitle>
            <div className="relative w-full sm:w-auto">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input type="search" placeholder="Search tasks..." className="pl-8 sm:w-[300px]" />
            </div>
          </div>
          <CardDescription>View, edit, and track the status of all assigned tasks.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Task Title</TableHead>
                <TableHead><User className="inline-block mr-1 h-4 w-4"/>Assignee</TableHead>
                <TableHead><CalendarDays className="inline-block mr-1 h-4 w-4"/>Due Date</TableHead>
                <TableHead><AlertCircle className="inline-block mr-1 h-4 w-4"/>Priority</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {allTasks.map(task => (
                <TableRow key={task.id}>
                  <TableCell className="font-medium">{task.title}</TableCell>
                  <TableCell>{task.assignee}</TableCell>
                  <TableCell>{task.dueDate}</TableCell>
                  <TableCell>
                    <Badge variant={getPriorityBadgeVariant(task.priority)}>{task.priority}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={getStatusBadgeVariant(task.status)}>{task.status}</Badge>
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm">Edit</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {allTasks.length === 0 && (
             <p className="text-muted-foreground text-center py-8">No tasks found. Start by assigning new tasks.</p>
          )}
        </CardContent>
      </Card>
      
       <Card className="shadow-sm">
        <CardHeader>
            <CardTitle>Task Assignment Form</CardTitle>
            <CardDescription>Fill in the details below to assign a new task to an employee.</CardDescription>
        </CardHeader>
        <CardContent>
            {/* Placeholder for Task Assignment Form Component */}
            <div className="h-48 bg-muted rounded-md flex items-center justify-center border border-dashed" data-ai-hint="form task assignment">
                 <p className="text-muted-foreground">Task assignment form will be here.</p>
            </div>
        </CardContent>
      </Card>

    </div>
  );
}
