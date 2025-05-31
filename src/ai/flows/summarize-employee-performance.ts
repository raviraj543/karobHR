
'use server';
/**
 * @fileOverview AI agent for summarizing employee performance.
 *
 * - summarizeEmployeePerformance - A function that handles the performance summarization.
 * - SummarizeEmployeePerformanceInput - Input type for the function.
 * - SummarizeEmployeePerformanceOutput - Output type for the function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'zod'; // Ensure this is 'zod'
import type {
  Task as TaskType, // These types are for reference, not directly used by Zod schemas here
  LeaveApplication as LeaveApplicationType,
} from '@/lib/types';

const SummarizeEmployeePerformanceInputSchema = z.object({
  employeeName: z.string().describe('The name of the employee.'),
  tasks: z
    .array(
      z.object({
        title: z.string(),
        status: z.enum(['Pending', 'In Progress', 'Completed', 'Blocked']),
        priority: z.enum(['Low', 'Medium', 'High', 'Critical']),
        description: z.string().optional(),
        dueDate: z.string().optional(),
      })
    )
    .describe('List of tasks assigned to the employee.'),
  leaveApplications: z
    .array(
      z.object({
        leaveType: z.string(), // Changed from 'type' to 'leaveType' for consistency
        status: z.enum(['pending', 'approved', 'rejected']),
        startDate: z.string(),
        endDate: z.string(),
        reason: z.string().optional(),
      })
    )
    .describe('List of leave applications by the employee.'),
  attendanceFactor: z
    .number()
    .min(0)
    .max(1)
    .describe(
      'Mock attendance factor (0.0 to 1.0, where 1.0 is 100% attendance).'
    ),
  baseSalary: z.number().optional().describe('Employee\'s base salary.'),
});
export type SummarizeEmployeePerformanceInput = z.infer<
  typeof SummarizeEmployeePerformanceInputSchema
>;

const SummarizeEmployeePerformanceOutputSchema = z.object({
  summary: z
    .string()
    .describe(
      'A concise summary of the employee\'s performance based on tasks, leaves, and attendance.'
    ),
});
export type SummarizeEmployeePerformanceOutput = z.infer<
  typeof SummarizeEmployeePerformanceOutputSchema
>;

export async function summarizeEmployeePerformance(
  input: SummarizeEmployeePerformanceInput
): Promise<SummarizeEmployeePerformanceOutput> {
  return summarizeEmployeePerformanceFlow(input);
}

const prompt = ai.definePrompt({
  name: 'summarizeEmployeePerformancePrompt',
  input: {schema: SummarizeEmployeePerformanceInputSchema},
  output: {schema: SummarizeEmployeePerformanceOutputSchema},
  prompt: `You are an HR Analyst. Summarize the performance of employee {{employeeName}}.
Consider their completed tasks ({{tasks.length}} total tasks), task priorities, and overall task status distribution.
Also, consider their leave patterns ({{leaveApplications.length}} leave applications) including types and statuses.
Their mock attendance factor is {{attendanceFactor}} (where 1.0 is 100%).
Their base salary is {{#if baseSalary}}₹{{baseSalary}}{{else}}N/A{{/if}}.

Provide a brief overview of their work patterns, reliability, and areas of note based on this data.
Focus on facts derived from the data.

Tasks:
{{#each tasks}}
- Title: {{this.title}} (Priority: {{this.priority}}, Status: {{this.status}}, Due: {{this.dueDate}})
  Description: {{this.description}}
{{/each}}

Leave Applications:
{{#each leaveApplications}}
- Type: {{this.leaveType}} (Status: {{this.status}}, From: {{this.startDate}} To: {{this.endDate}})
  Reason: {{this.reason}}
{{/each}}
`,
});

const summarizeEmployeePerformanceFlow = ai.defineFlow(
  {
    name: 'summarizeEmployeePerformanceFlow',
    inputSchema: SummarizeEmployeePerformanceInputSchema,
    outputSchema: SummarizeEmployeePerformanceOutputSchema,
  },
  async (input) => {
    const {output} = await prompt(input);
    if (!output) {
      throw new Error('No output from summarizeEmployeePerformancePrompt');
    }
    return output;
  }
);
