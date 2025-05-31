
'use client'; // Required for hooks

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { ListChecks, Filter } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth'; // Import useAuth
import type { Task as TaskType } from '@/lib/types'; // Import TaskType
import { useEffect, useState, useMemo } from 'react';
import { useToast } from '@/hooks/use-toast';

// Metadata cannot be exported directly from client component
// export const metadata: Metadata = {
//   title: 'My Tasks - BizFlow',
//   description: 'View and manage your assigned tasks.',
// };


const getPriorityBadgeVariant = (priority?: TaskType['priority']) => {
  if (!priority) return 'default';
  switch (priority.toLowerCase()) {
    case 'high': return 'destructive';
    case 'critical': return 'destructive';
    case 'medium': return 'secondary';
    case 'low': return 'outline';
    default: return 'default';
  }
};
const getStatusBadgeVariant = (status?: TaskType['status']) => {
  if(!status) return 'default';
  switch (status.toLowerCase()) {
    case 'completed': return 'default';
    case 'in progress': return 'secondary';
    case 'pending': return 'outline';
    case 'blocked': return 'destructive';
    default: return 'default';
  }
};


export default function MyTasksPage() {
  const { user, tasks: allTasks, updateTask } = useAuth(); // Get tasks and updateTask from context
  const { toast } = useToast();
  const [filter, setFilter] = useState<'all' | 'pending' | 'in progress' | 'completed'>('all');


  useEffect(() => {
    document.title = 'My Tasks - BizFlow';
  }, []);

  const myTasks = useMemo(() => {
    if (!user || !allTasks) return [];
    return allTasks.filter(task => task.assigneeId === user.employeeId);
  }, [user, allTasks]);

  const filteredTasks = useMemo(() => {
    if (filter === 'all') return myTasks;
    return myTasks.filter(task => task.status.toLowerCase().replace(' ', '') === filter.replace(' ', ''));
  }, [myTasks, filter]);

  const handleTaskStatusChange = async (taskId: string, currentStatus: TaskType['status']) => {
    const taskToUpdate = myTasks.find(t => t.id === taskId);
    if (!taskToUpdate) return;

    const newStatus: TaskType['status'] = currentStatus === 'Completed' ? 'In Progress' : 'Completed';
    try {
      await updateTask({ ...taskToUpdate, status: newStatus });
      toast({
        title: `Task ${newStatus === 'Completed' ? 'Completed' : 'Marked In Progress'}`,
        description: `Task "${taskToUpdate.title}" status updated.`,
      });
    } catch (error) {
      toast({
        title: "Error updating task",
        description: (error as Error).message,
        variant: "destructive",
      });
    }
  };


  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">My Tasks</h1>
          <p className="text-muted-foreground">Stay organized and track your progress.</p>
        </div>
        <div className="flex gap-2">
            <Button variant="outline" disabled>
                <Filter className="mr-2 h-4 w-4" /> Filter Tasks (WIP)
            </Button>
        </div>
      </div>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center"><ListChecks className="mr-2 h-5 w-5 text-primary" />Assigned Tasks</CardTitle>
          <CardDescription>All tasks assigned to you. Check them off as you complete them.</CardDescription>
        </CardHeader>
        <CardContent>
          {filteredTasks.length > 0 ? (
            <div className="space-y-4">
              {filteredTasks.map(task => (
                <div key={task.id} className="flex items-start space-x-3 p-4 bg-muted/30 rounded-lg shadow-sm hover:shadow-md transition-shadow">
                  <Checkbox
                    id={`task-${task.id}`}
                    className="mt-1"
                    checked={task.status === 'Completed'}
                    onCheckedChange={() => handleTaskStatusChange(task.id, task.status)}
                  />
                  <div className="flex-1">
                    <label htmlFor={`task-${task.id}`} className="font-semibold text-foreground cursor-pointer hover:text-primary">
                      {task.title}
                    </label>
                    <p className="text-sm text-muted-foreground">Due: {new Date(task.dueDate).toLocaleDateString()}</p>
                    <div className="mt-1 flex items-center gap-2">
                        <Badge variant={getPriorityBadgeVariant(task.priority)}>{task.priority}</Badge>
                        <Badge variant={getStatusBadgeVariant(task.status)}>{task.status}</Badge>
                    </div>
                  </div>
                  {/* <Button variant="ghost" size="sm">Details</Button> */}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-8">
                {myTasks.length === 0 ? "You have no tasks assigned. Great job, or check with your manager!" : "No tasks match the current filter."}
            </p>
          )}
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardHeader>
            <CardTitle>Daily Task Summary</CardTitle>
            <CardDescription>Use the dashboard to submit your daily task summary and checkout.</CardDescription>
        </CardHeader>
        <CardContent>
            <p className="text-muted-foreground">The task summarization tool is available on your <Button variant="link" asChild className="p-0 h-auto"><Link href="/dashboard">main dashboard</Link></Button>.</p>
        </CardContent>
      </Card>

    </div>
  );
}
    