
export type UserRole = 'admin' | 'employee' | null;

export interface User {
  id: string;
  email?: string | null;
  name?: string | null;
  role: UserRole;
  profilePictureUrl?: string | null;
  employeeId?: string | null;
}

// Task structure expected by the AI flow
export interface AiTask {
  title: string;
  description: string;
  status: 'In Progress' | 'Completed' | 'Blocked';
}

// Client-side task structure, potentially with an ID
export interface ClientTask extends AiTask {
  id: string; 
}

export interface Holiday {
  id: string;
  name: string;
  date: Date;
  description?: string;
}

export interface LeaveApplication {
  id: string;
  userId: string;
  leaveType: string;
  startDate: Date;
  endDate: Date;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  supportingDocumentUrl?: string;
}
