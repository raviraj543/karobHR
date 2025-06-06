
'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation'; // Import useRouter
import { summarizeEmployeeTasks } from '@/ai/flows/summarize-employee-tasks';
import type { ClientTask, AiTask } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { PlusCircle, Trash2, Loader2, CheckCircle, FileText } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth'; // Import useAuth

export function TaskSummarizer() {
  const [tasks, setTasks] = useState<ClientTask[]>([
    { id: Date.now().toString(), title: '', description: '', status: 'Completed' },
  ]);
  const [summary, setSummary] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();
  const router = useRouter(); // Initialize useRouter

  const handleTaskChange = (id: string, field: keyof AiTask, value: string) => {
    setTasks(tasks.map(task => task.id === id ? { ...task, [field]: value } : task));
  };

  const addTask = () => {
    setTasks([...tasks, { id: Date.now().toString(), title: '', description: '', status: 'Completed' }]);
  };

  const removeTask = (id: string) => {
    setTasks(tasks.filter(task => task.id !== id));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setSummary(null);

    const tasksToSummarize: AiTask[] = tasks.map(({ id, ...rest }) => rest);

    if (tasksToSummarize.every(task => task.status !== 'Completed')) {
        toast({
            title: "No Completed Tasks",
            description: "Please mark at least one task as 'Completed' to generate a summary.",
            variant: "destructive",
        });
        setIsLoading(false);
        return;
    }

    try {
      const result = await summarizeEmployeeTasks({ tasks: tasksToSummarize });
      setSummary(result.summary);
      toast({
        title: "Summary Generated & Report Submitted!",
        description: "Your task summary has been successfully created. Please proceed to checkout.",
        duration: 7000,
      });
      // Mock notification to admin
      toast({
        title: "Mock Admin Notification",
        description: `${user?.name || 'An employee'} has submitted their daily task report.`,
        variant: "default",
        duration: 7000,
      });

      // Redirect to attendance page
      router.push('/attendance');

    } catch (error) {
      console.error('Error summarizing tasks:', error);
      toast({
        title: "Error",
        description: "Failed to generate task summary. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto shadow-sm">
      <CardHeader>
        <CardTitle className="text-2xl font-semibold flex items-center"><FileText className="mr-2 h-6 w-6 text-primary"/>Daily Task Report & Checkout</CardTitle>
        <CardDescription>List your tasks for the day. Completed tasks will be summarized and submitted. You will then be redirected to the attendance page to checkout.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {tasks.map((task, index) => (
            <div key={task.id} className="space-y-3 p-4 border rounded-md shadow-sm bg-card relative hover:shadow-md transition-shadow">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label htmlFor={`task-title-${task.id}`}>Task Title</Label>
                  <Input
                    id={`task-title-${task.id}`}
                    value={task.title}
                    onChange={(e) => handleTaskChange(task.id, 'title', e.target.value)}
                    placeholder="e.g., Design landing page"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor={`task-status-${task.id}`}>Status</Label>
                  <Select
                    value={task.status}
                    onValueChange={(value) => handleTaskChange(task.id, 'status', value as AiTask['status'])}
                  >
                    <SelectTrigger id={`task-status-${task.id}`}>
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Completed">Completed</SelectItem>
                      <SelectItem value="In Progress">In Progress</SelectItem>
                      <SelectItem value="Blocked">Blocked</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1">
                <Label htmlFor={`task-desc-${task.id}`}>Description/Update</Label>
                <Textarea
                  id={`task-desc-${task.id}`}
                  value={task.description}
                  onChange={(e) => handleTaskChange(task.id, 'description', e.target.value)}
                  placeholder="Brief description or status update"
                  rows={2}
                />
              </div>
              {tasks.length > 1 && (
                 <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeTask(task.id)}
                    className="absolute top-2 right-2 text-muted-foreground hover:text-destructive"
                    aria-label="Remove task"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
              )}
            </div>
          ))}

          <div className="flex flex-col sm:flex-row justify-between items-center gap-3 pt-2">
            <Button type="button" variant="outline" onClick={addTask} className="text-sm w-full sm:w-auto">
              <PlusCircle className="mr-2 h-4 w-4" /> Add Another Task
            </Button>
            <Button type="submit" disabled={isLoading} className="min-w-[180px] w-full sm:w-auto">
              {isLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle className="mr-2 h-4 w-4" />
              )}
              {isLoading ? 'Generating...' : 'Summarize & Submit Report'}
            </Button>
          </div>
        </form>

        {summary && (
          <div className="mt-8 p-4 border-2 border-dashed border-primary/30 rounded-lg bg-primary/5 shadow-inner">
            <h3 className="text-lg font-semibold text-primary mb-2">Completed Tasks Summary (Submitted):</h3>
            <div className="prose prose-sm max-w-none text-foreground whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: summary.replace(/\n/g, '<br />') }}>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
