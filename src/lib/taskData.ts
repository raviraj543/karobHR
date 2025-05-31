
import type { Task as TaskType } from '@/lib/types';

// This data is now shared and can be imported by any component/page.
export const initialTasks: TaskType[] = [
  { id: 'task_101', title: 'Develop new marketing campaign', description: 'Plan and execute Q4 marketing strategy.', assigneeId: 'emp101', assigneeName: 'John Doe', dueDate: '2024-11-10', priority: 'High', status: 'In Progress' },
  { id: 'task_102', title: 'Onboard new clients for Q4', description: 'Welcome and set up new clients.', assigneeId: 'emp102', assigneeName: 'Alice Smith', dueDate: '2024-11-15', priority: 'Medium', status: 'Pending' },
  { id: 'task_103', title: 'Finalize budget for 2025', description: 'Review all department budgets and finalize.', assigneeId: 'man101', assigneeName: 'Mike Manager', dueDate: '2024-10-30', priority: 'High', status: 'Completed' },
  { id: 'task_104', title: 'Update server infrastructure', description: 'Migrate to new cloud servers.', assigneeId: 'emp001', assigneeName: 'Alice Johnson', dueDate: '2024-12-01', priority: 'Critical', status: 'Blocked' },
  // Add more tasks if needed, ensuring assigneeId matches an employeeId in mockUserProfiles
  { id: 'task_105', title: 'Review Q3 Performance Data', description: 'Analyze sales and support metrics.', assigneeId: 'man101', assigneeName: 'Mike Manager', dueDate: '2024-11-05', priority: 'Medium', status: 'In Progress' },
  { id: 'task_106', title: 'Prepare for holiday sale event', description: 'Coordinate with marketing and inventory.', assigneeId: 'emp102', assigneeName: 'Alice Smith', dueDate: '2024-11-20', priority: 'High', status: 'Pending' },
  { id: 'task_107', title: 'Employee Training Module Update', description: 'Incorporate new compliance guidelines.', assigneeId: 'admin001', assigneeName: 'Jane Admin', dueDate: '2024-11-25', priority: 'Medium', status: 'Pending' },
];
