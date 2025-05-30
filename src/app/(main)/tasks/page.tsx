import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { ListChecks, Filter, PlusCircle } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'My Tasks - BizFlow',
  description: 'View and manage your assigned tasks.',
};

// Placeholder task data
const tasks = [
  { id: '1', title: 'Complete Q4 Report Analysis', dueDate: '2023-10-25', priority: 'High', status: 'In Progress' },
  { id: '2', title: 'Prepare Presentation for Client Meeting', dueDate: '2023-10-28', priority: 'Medium', status: 'Pending' },
  { id: '3', title: 'Update Project Documentation', dueDate: '2023-11-05', priority: 'Low', status: 'Completed' },
  { id: '4', title: 'Team Brainstorming Session', dueDate: '2023-10-20', priority: 'Medium', status: 'Blocked' },
];

const getPriorityBadgeVariant = (priority: string) => {
  switch (priority.toLowerCase()) {
    case 'high': return 'destructive';
    case 'medium': return 'secondary'; // Consider a warning/yellowish variant
    case 'low': return 'outline';
    default: return 'default';
  }
};
const getStatusBadgeVariant = (status: string) => {
  switch (status.toLowerCase()) {
    case 'completed': return 'default'; // Consider a success/greenish variant
    case 'in progress': return 'secondary';
    case 'pending': return 'outline';
    case 'blocked': return 'destructive';
    default: return 'default';
  }
};


export default function MyTasksPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">My Tasks</h1>
          <p className="text-muted-foreground">Stay organized and track your progress.</p>
        </div>
        <div className="flex gap-2">
            <Button variant="outline">
                <Filter className="mr-2 h-4 w-4" /> Filter Tasks
            </Button>
            {/* Employees typically don't add tasks themselves, but admins do. This could be context-dependent. */}
            {/* <Button>
                <PlusCircle className="mr-2 h-4 w-4" /> Add New Task
            </Button> */}
        </div>
      </div>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center"><ListChecks className="mr-2 h-5 w-5 text-primary" />Assigned Tasks</CardTitle>
          <CardDescription>All tasks assigned to you. Check them off as you complete them.</CardDescription>
        </CardHeader>
        <CardContent>
          {tasks.length > 0 ? (
            <div className="space-y-4">
              {tasks.map(task => (
                <div key={task.id} className="flex items-start space-x-3 p-4 bg-muted/30 rounded-lg shadow-sm hover:shadow-md transition-shadow">
                  <Checkbox id={`task-${task.id}`} className="mt-1" defaultChecked={task.status === 'Completed'} />
                  <div className="flex-1">
                    <label htmlFor={`task-${task.id}`} className="font-semibold text-foreground cursor-pointer hover:text-primary">
                      {task.title}
                    </label>
                    <p className="text-sm text-muted-foreground">Due: {task.dueDate}</p>
                    <div className="mt-1 flex items-center gap-2">
                        <Badge variant={getPriorityBadgeVariant(task.priority)}>{task.priority}</Badge>
                        <Badge variant={getStatusBadgeVariant(task.status)}>{task.status}</Badge>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm">Details</Button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-8">You have no tasks assigned. Great job, or check with your manager!</p>
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
