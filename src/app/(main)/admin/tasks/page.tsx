
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
import { PlusCircle, Search, Briefcase, User, CalendarDays, AlertCircle, Loader2, Edit2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import type { User as AuthUser } from '@/lib/types';
import { v4 as uuidv4 } from 'uuid';
import type { Task as TaskType } from '@/lib/types';

const taskFormSchema = z.object({
  title: z.string().min(3, "Task title must be at least 3 characters."),
  description: z.string().min(10, "Description must be at least 10 characters.").max(500, "Description too long."),
  assigneeId: z.string().min(1, "Assignee is required."),
  dueDate: z.string().refine((date) => {
    try {
      const d = new Date(date);
      return !isNaN(d.getTime());
    } catch {
      return false;
    }
  }, {
    message: "Due date is required and must be valid.",
  }),
  priority: z.enum(['Low', 'Medium', 'High', 'Critical']),
});

type TaskFormValues = z.infer<typeof taskFormSchema>;

const editTaskFormSchema = taskFormSchema.extend({
  status: z.enum(['Pending', 'In Progress', 'Completed', 'Blocked']),
});
type EditTaskFormValues = z.infer<typeof editTaskFormSchema>;


const getPriorityBadgeVariant = (priority: TaskType['priority']) => {
  if (!priority) return 'default';
  switch (priority.toLowerCase()) {
    case 'critical': return 'destructive';
    case 'high': return 'destructive';
    case 'medium': return 'secondary';
    case 'low': return 'outline';
    default: return 'default';
  }
};
const getStatusBadgeVariant = (status: TaskType['status']) => {
  if (!status) return 'default';
  switch (status.toLowerCase()) {
    case 'completed': return 'default';
    case 'in progress': return 'secondary';
    case 'pending': return 'outline';
    case 'blocked': return 'destructive';
    default: return 'default';
  }
};


export default function AdminTasksPage() {
  const { toast } = useToast();
  const { allUsers, loading: authLoading, tasks, addTask, updateTask } = useAuth();
  const [isAssignTaskDialogOpen, setIsAssignTaskDialogOpen] = useState(false);
  const [isEditTaskDialogOpen, setIsEditTaskDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<TaskType | null>(null);
  const [searchTerm, setSearchTerm] = useState('');


  useEffect(() => {
    document.title = 'Manage Tasks - Admin - Floattend';
  }, []);

  const assignableUsers = allUsers.filter(u => u.role === 'employee' || u.role === 'manager');

  const assignForm = useForm<TaskFormValues>({
    resolver: zodResolver(taskFormSchema),
    defaultValues: {
      title: '',
      description: '',
      assigneeId: '',
      dueDate: '',
      priority: 'Medium',
    },
  });

  const editForm = useForm<EditTaskFormValues>({
    resolver: zodResolver(editTaskFormSchema),
    defaultValues: {
      title: '',
      description: '',
      assigneeId: '',
      dueDate: '',
      priority: 'Medium',
      status: 'Pending',
    },
  });

  const onAssignTaskSubmit = async (data: TaskFormValues) => {
    const selectedUser = assignableUsers.find(u => u.employeeId === data.assigneeId);
    if (!selectedUser) {
        toast({ title: "Error", description: "Selected assignee not found.", variant: "destructive"});
        return;
    }

    const newTask: TaskType = {
      id: uuidv4(),
      title: data.title,
      description: data.description,
      assigneeId: data.assigneeId,
      assigneeName: selectedUser.name || selectedUser.employeeId,
      dueDate: data.dueDate,
      priority: data.priority,
      status: 'Pending',
    };
    await addTask(newTask);
    
    toast({
      title: 'Task Assigned!',
      description: `Task "${data.title}" assigned to ${selectedUser.name || selectedUser.employeeId}.`,
    });
    toast({
        title: 'Mock Employee Notification',
        description: `You (as ${selectedUser.name || selectedUser.employeeId}) have been assigned a new task: "${data.title}".`,
        variant: 'default',
        duration: 7000,
    });
    setIsAssignTaskDialogOpen(false);
    assignForm.reset();
  };

  const handleEditTask = (task: TaskType) => {
    setEditingTask(task);
    editForm.reset({
        title: task.title,
        description: task.description,
        assigneeId: task.assigneeId,
        dueDate: task.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : '',
        priority: task.priority,
        status: task.status,
    });
    setIsEditTaskDialogOpen(true);
  };

  const onEditTaskSubmit = async (data: EditTaskFormValues) => {
    if (!editingTask) return;
    const selectedUser = assignableUsers.find(u => u.employeeId === data.assigneeId);
     if (!selectedUser) {
        toast({ title: "Error", description: "Selected assignee not found.", variant: "destructive"});
        return;
    }

    const updatedTaskData: TaskType = {
        ...editingTask,
        ...data,
        assigneeName: selectedUser.name || selectedUser.employeeId,
    };
    await updateTask(updatedTaskData);
    toast({
      title: 'Task Updated!',
      description: `Task "${data.title}" has been updated.`,
    });
    setIsEditTaskDialogOpen(false);
    setEditingTask(null);
  };


  const filteredTasks = tasks.filter(task =>
    task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (task.assigneeName && task.assigneeName.toLowerCase().includes(searchTerm.toLowerCase())) ||
    task.status.toLowerCase().includes(searchTerm.toLowerCase())
  ).sort((a,b) => new Date(b.dueDate).getTime() - new Date(a.dueDate).getTime());


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
            <Form {...assignForm}>
              <form onSubmit={assignForm.handleSubmit(onAssignTaskSubmit)} className="space-y-4 py-2">
                <FormField
                  control={assignForm.control}
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
                  control={assignForm.control}
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
                    control={assignForm.control}
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
                    control={assignForm.control}
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
                  control={assignForm.control}
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
                  <Button type="submit" disabled={assignForm.formState.isSubmitting}>
                    {assignForm.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Assign Task
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Edit Task Dialog */}
      <Dialog open={isEditTaskDialogOpen} onOpenChange={setIsEditTaskDialogOpen}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center"><Edit2 className="mr-2 h-5 w-5 text-primary"/>Edit Task</DialogTitle>
              <DialogDescription>Update the details of this task.</DialogDescription>
            </DialogHeader>
            <Form {...editForm}>
              <form onSubmit={editForm.handleSubmit(onEditTaskSubmit)} className="space-y-4 py-2">
                <FormField
                  control={editForm.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Task Title</FormLabel>
                      <FormControl><Input {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editForm.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl><Textarea {...field} rows={3} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField
                        control={editForm.control}
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
                            </SelectContent>
                            </Select>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                    <FormField
                        control={editForm.control}
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
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField
                        control={editForm.control}
                        name="priority"
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel>Priority</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                                <SelectTrigger><SelectValue placeholder="Select priority" /></SelectTrigger>
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
                    <FormField
                        control={editForm.control}
                        name="status"
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel>Status</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                                <SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger>
                            </FormControl>
                            <SelectContent>
                                <SelectItem value="Pending">Pending</SelectItem>
                                <SelectItem value="In Progress">In Progress</SelectItem>
                                <SelectItem value="Completed">Completed</SelectItem>
                                <SelectItem value="Blocked">Blocked</SelectItem>
                            </SelectContent>
                            </Select>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                </div>
                <DialogFooter className="pt-4">
                  <Button type="button" variant="outline" onClick={() => setIsEditTaskDialogOpen(false)}>Cancel</Button>
                  <Button type="submit" disabled={editForm.formState.isSubmitting}>
                    {editForm.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Update Task
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>


      <Card className="shadow-sm">
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
            <CardTitle className="flex items-center"><Briefcase className="mr-2 h-5 w-5 text-primary" />All Tasks</CardTitle>
            <div className="relative w-full sm:w-auto">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Search tasks by title, assignee, status..."
                  className="pl-8 sm:w-[350px]"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>
          </div>
          <CardDescription>View, edit, and track the status of all assigned tasks. Newly assigned tasks are added to this view.</CardDescription>
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
                <TableRow key={task.id} className="hover:bg-muted/50 transition-colors">
                  <TableCell className="font-medium max-w-xs truncate" title={task.title}>{task.title}</TableCell>
                  <TableCell className="text-muted-foreground">{task.assigneeName || 'N/A'}</TableCell>
                  <TableCell className="text-muted-foreground">{task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'N/A'}</TableCell>
                  <TableCell>
                    <Badge variant={getPriorityBadgeVariant(task.priority)}>{task.priority}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={getStatusBadgeVariant(task.status)}>{task.status}</Badge>
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" className="h-8 w-8" title="Edit Task" onClick={() => handleEditTask(task)}>
                        <Edit2 className="h-4 w-4" />
                    </Button>
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
    
    
