
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

export interface LocationInfo {
  latitude: number;
  longitude: number;
  accuracy?: number;
}

export interface AttendanceEvent {
  id: string;
  employeeId: string;
  userName: string; // For easier display in admin log
  type: 'check-in' | 'check-out';
  timestamp: string; // ISO Date string
  photoDataUrl: string | null; // Can be null if photo capture fails but still logs event
  location: LocationInfo | null;
  isWithinGeofence: boolean | null;
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
  mockAttendanceFactor?: number; // Represents proportion of salary based on attendance (0.0 to 1.0). Defaults to 1.0 if undefined.
  advances?: Advance[];
  leaves?: LeaveApplication[];
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

export interface Task {
  id: string;
  title: string;
  description: string;
  assigneeId: string;
  assigneeName: string;
  dueDate: string;
  priority: 'Low' | 'Medium' | 'High' | 'Critical';
  status: 'Pending' | 'In Progress' | 'Completed' | 'Blocked';
}


export interface Holiday {
  id:string;
  name: string;
  date: Date;
  description?: string;
}

export interface LeaveApplication {
  id: string;
  userId: string; // Could be employeeId or user.id
  leaveType: string;
  startDate: string; // Using string for form simplicity, could be Date
  endDate: string;   // Using string for form simplicity, could be Date
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  supportingDocumentUrl?: string; // Optional
  color?: string; // For UI display, not part of core data model necessarily
}

export interface Announcement {
  id: string;
  title: string;
  content: string;
  postedAt: string; // ISO date string
  postedBy: string; // Admin's name or ID
}

