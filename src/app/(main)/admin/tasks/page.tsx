
'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { PlusCircle, Search, Briefcase, User, CalendarDays, AlertCircle, Loader2 } from 'lucide-react';
import type { Metadata } from 'next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import type { User as AuthUser } from '@/lib/types'; // Renamed to avoid conflict with Lucide User
import { v4 as uuidv4 } from 'uuid';

// export const metadata: Metadata = { // Metadata not used in client components
//   title: 'Manage Tasks - Admin - BizFlow',
//   description: 'Assign, track, and manage employee tasks.',
// };

interface Task {
  id: string;
  title: string;
  description: string;
  assigneeId: string;
  assigneeName: string;
  dueDate: string;
  priority: 'Low' | 'Medium' | 'High' | 'Critical';
  status: 'Pending' | 'In Progress' | 'Completed' | 'Blocked';
}

const initialTasks: Task[] = [
  { id: 'task_101', title: 'Develop new marketing campaign', description: 'Plan and execute Q4 marketing strategy.', assigneeId: 'emp101', assigneeName: 'John Doe', dueDate: '2024-11-10', priority: 'High', status: 'In Progress' },
  { id: 'task_102', title: 'Onboard new clients for Q4', description: 'Welcome and set up new clients.', assigneeId: 'emp102', assigneeName: 'Alice Smith', dueDate: '2024-11-15', priority: 'Medium', status: 'Pending' },
  { id: 'task_103', title: 'Finalize budget for 2025', description: 'Review all department budgets and finalize.', assigneeId: 'man101', assigneeName: 'Mike Manager', dueDate: '2024-10-30', priority: 'High', status: 'Completed' },
  { id: 'task_104', title: 'Update server infrastructure', description: 'Migrate to new cloud servers.', assigneeId: 'emp001', assigneeName: 'Alice Johnson', dueDate: '2024-12-01', priority: 'Critical', status: 'Blocked' },
];

const taskFormSchema = z.object({
  title: z.string().min(3, "Task title must be at least 3 characters."),
  description: z.string().min(10, "Description must be at least 10 characters.").max(500, "Description too long."),
  assigneeId: z.string().min(1, "Assignee is required."),
  dueDate: z.string().refine((date) => new Date(date).toString() !== 'Invalid Date', {
    message: "Due date is required and must be valid.",
  }),
  priority: z.enum(['Low', 'Medium', 'High', 'Critical']),
});

type TaskFormValues = z.infer<typeof taskFormSchema>;


const getPriorityBadgeVariant = (priority: Task['priority']) => {
  switch (priority.toLowerCase()) {
    case 'critical': return 'destructive';
    case 'high': return 'destructive'; // Or a different shade if needed
    case 'medium': return 'secondary';
    case 'low': return 'outline';
    default: return 'default';
  }
};
const getStatusBadgeVariant = (status: Task['status']) => {
  switch (status.toLowerCase()) {
    case 'completed': return 'default'; 
    case 'in progress': return 'secondary';
    case 'pending': return 'outline';
    case 'blocked': return 'destructive';
    default: return 'default';
  }
};


export default function AdminTasksPage() {
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [isAssignTaskDialogOpen, setIsAssignTaskDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const { toast } = useToast();
  const { allUsers, loading: authLoading } = useAuth();

  useEffect(() => {
    document.title = 'Manage Tasks - Admin - BizFlow';
  }, []);

  const assignableUsers = allUsers.filter(u => u.role === 'employee' || u.role === 'manager');

  const form = useForm<TaskFormValues>({
    resolver: zodResolver(taskFormSchema),
    defaultValues: {
      title: '',
      description: '',
      assigneeId: '',
      dueDate: '',
      priority: 'Medium',
    },
  });

  const onAssignTaskSubmit = (data: TaskFormValues) => {
    const selectedUser = assignableUsers.find(u => u.employeeId === data.assigneeId);
    if (!selectedUser) {
        toast({ title: "Error", description: "Selected assignee not found.", variant: "destructive"});
        return;
    }

    const newTask: Task = {
      id: uuidv4(),
      title: data.title,
      description: data.description,
      assigneeId: data.assigneeId,
      assigneeName: selectedUser.name || selectedUser.employeeId,
      dueDate: data.dueDate,
      priority: data.priority,
      status: 'Pending',
    };
    setTasks(prev => [newTask, ...prev]);
    toast({
      title: 'Task Assigned!',
      description: `Task "${data.title}" assigned to ${selectedUser.name || selectedUser.employeeId}.`,
    });
    setIsAssignTaskDialogOpen(false);
    form.reset();
  };

  const filteredTasks = tasks.filter(task => 
    task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    task.assigneeName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    task.status.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Task Management</h1>
          <p className="text-muted-foreground">Oversee and manage all employee tasks.</p>
        </div>
        <Dialog open={isAssignTaskDialogOpen} onOpenChange={setIsAssignTaskDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <PlusCircle className="mr-2 h-4 w-4" /> Assign New Task
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center"><Briefcase className="mr-2 h-5 w-5 text-primary"/>Assign New Task</DialogTitle>
              <DialogDescription>Fill in the details to assign a task to an employee or manager.</DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onAssignTaskSubmit)} className="space-y-4 py-2">
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Task Title</FormLabel>
                      <FormControl><Input placeholder="e.g., Prepare Q1 sales report" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl><Textarea placeholder="Detailed description of the task..." {...field} rows={3} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="assigneeId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Assign To</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger disabled={authLoading}>
                              <SelectValue placeholder={authLoading ? "Loading users..." : "Select employee/manager"} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {assignableUsers.map(user => (
                              <SelectItem key={user.id} value={user.employeeId}>
                                {user.name} ({user.employeeId}) - {user.role}
                              </SelectItem>
                            ))}
                            {assignableUsers.length === 0 && !authLoading && <p className="p-2 text-sm text-muted-foreground">No assignable users found.</p>}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="dueDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Due Date</FormLabel>
                        <FormControl><Input type="date" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="priority"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Priority</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select priority" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="Low">Low</SelectItem>
                          <SelectItem value="Medium">Medium</SelectItem>
                          <SelectItem value="High">High</SelectItem>
                          <SelectItem value="Critical">Critical</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DialogFooter className="pt-4">
                  <Button type="button" variant="outline" onClick={() => setIsAssignTaskDialogOpen(false)}>Cancel</Button>
                  <Button type="submit" disabled={form.formState.isSubmitting}>
                    {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Assign Task
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="shadow-sm">
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
            <CardTitle className="flex items-center"><Briefcase className="mr-2 h-5 w-5 text-primary" />All Tasks</CardTitle>
            <div className="relative w-full sm:w-auto">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input 
                  type="search" 
                  placeholder="Search tasks by title, assignee, status..." 
                  className="pl-8 sm:w-[350px]" 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
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
              {filteredTasks.map(task => (
                <TableRow key={task.id}>
                  <TableCell className="font-medium max-w-xs truncate" title={task.title}>{task.title}</TableCell>
                  <TableCell>{task.assigneeName}</TableCell>
                  <TableCell>{new Date(task.dueDate).toLocaleDateString()}</TableCell>
                  <TableCell>
                    <Badge variant={getPriorityBadgeVariant(task.priority)}>{task.priority}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={getStatusBadgeVariant(task.status)}>{task.status}</Badge>
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm">Edit</Button> {/* Mock action */}
                  </TableCell>
                </TableRow>
              ))}
              {filteredTasks.length === 0 && (
                 <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                        {tasks.length > 0 ? "No tasks match your search criteria." : "No tasks found. Start by assigning new tasks."}
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
