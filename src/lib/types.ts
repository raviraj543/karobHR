
export type UserRole = 'admin' | 'employee' | null;

export interface User {
  id: string; // Unique user record ID (e.g., from Firebase Auth or DB)
  employeeId: string; // The ID used for login, set by admin
  email?: string | null;
  name?: string | null;
  role: UserRole;
  profilePictureUrl?: string | null;
  department?: string | null;
  joiningDate?: string | null; // Represent as string for simplicity, or Date
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
