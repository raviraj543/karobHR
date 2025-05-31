
export type UserRole = 'admin' | 'manager' | 'employee' | null;

export interface Advance {
  id: string;
  employeeId: string; // To know who this advance belongs to, useful for admin view
  amount: number;
  reason: string;
  dateRequested: string; // ISO Date string
  status: 'pending' | 'approved' | 'rejected';
  dateProcessed?: string; // ISO Date string
}

export interface User {
  id: string; // Unique user record ID (e.g., from Firebase Auth or DB)
  employeeId: string; // The ID used for login, set by admin
  email?: string | null;
  name?: string | null;
  role: UserRole;
  profilePictureUrl?: string | null;
  department?: string | null;
  joiningDate?: string | null; // Represent as string for simplicity, or Date
  contactInfo?: {
    phone?: string | null;
  };
  baseSalary?: number;
  advances?: Advance[];
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
