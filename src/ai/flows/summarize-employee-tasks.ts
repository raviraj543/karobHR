'use server';

/**
 * @fileOverview Summarizes an employee's completed tasks into a concise bullet-point list.
 *
 * - summarizeEmployeeTasks - A function that handles the task summarization process.
 * - SummarizeEmployeeTasksInput - The input type for the summarizeEmployeeTasks function.
 * - SummarizeEmployeeTasksOutput - The return type for the summarizeEmployeeTasks function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SummarizeEmployeeTasksInputSchema = z.object({
  tasks: z
    .array(
      z.object({
        title: z.string().describe('The title of the task.'),
        description: z.string().describe('A brief description of the task.'),
        status: z
          .enum(['In Progress', 'Completed', 'Blocked'])
          .describe('The status of the task.'),
      })
    )
    .describe('An array of tasks assigned to the employee.'),
});
export type SummarizeEmployeeTasksInput = z.infer<typeof SummarizeEmployeeTasksInputSchema>;

const SummarizeEmployeeTasksOutputSchema = z.object({
  summary: z
    .string()
    .describe(
      'A concise bullet-point list summarizing the completed tasks, including a brief description/status update for each task.'
    ),
});
export type SummarizeEmployeeTasksOutput = z.infer<typeof SummarizeEmployeeTasksOutputSchema>;

export async function summarizeEmployeeTasks(
  input: SummarizeEmployeeTasksInput
): Promise<SummarizeEmployeeTasksOutput> {
  return summarizeEmployeeTasksFlow(input);
}

const prompt = ai.definePrompt({
  name: 'summarizeEmployeeTasksPrompt',
  input: {schema: SummarizeEmployeeTasksInputSchema},
  output: {schema: SummarizeEmployeeTasksOutputSchema},
  prompt: `You are a helpful assistant that summarizes completed tasks for an employee's daily report.\n\nGiven the following tasks, create a concise bullet-point list summarizing the completed tasks. Include a brief description/status update for each task.\n\nTasks:\n{{#each tasks}}\n- Title: {{this.title}}\n  Description: {{this.description}}\n  Status: {{this.status}}\n{{/each}}\n\nSummary of Completed Tasks:`,
});

const summarizeEmployeeTasksFlow = ai.defineFlow(
  {
    name: 'summarizeEmployeeTasksFlow',
    inputSchema: SummarizeEmployeeTasksInputSchema,
    outputSchema: SummarizeEmployeeTasksOutputSchema,
  },
  async input => {
    const completedTasks = input.tasks.filter(task => task.status === 'Completed');
    const {output} = await prompt({...input, tasks: completedTasks});
    return output!;
  }
);
