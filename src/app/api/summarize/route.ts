
import {NextResponse} from 'next/server';
import {
  summarizeEmployeePerformance,
  type SummarizeEmployeePerformanceInput,
} from '@/ai/flows/summarize-employee-performance';

export async function POST(req: Request) {
  try {
    const input: SummarizeEmployeePerformanceInput = await req.json();

    const requiredFields: (keyof SummarizeEmployeePerformanceInput)[] = [
      'employeeName',
      'tasks',
      'leaveApplications',
      'attendanceFactor',
    ];
    for (const field of requiredFields) {
      if (
        input[field] === null ||
        input[field] === undefined ||
        (Array.isArray(input[field]) &&
          (input[field] as any[]).length === 0)
      ) {
      }
    }

    const {summary} = await summarizeEmployeePerformance(input);
    return NextResponse.json({summary});
  } catch (e: any) {
    return NextResponse.json({message: e.message}, {status: 400});
  }
}
