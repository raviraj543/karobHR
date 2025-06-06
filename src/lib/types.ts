export type UserRole = 'admin' | 'manager' | 'employee' | null;

export interface Advance {
  id: string;
  employeeId: string; 
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
  id: string; // Firestore document ID
  employeeId: string; // KarobHR employee ID
  userId: string; // Firebase Auth UID of the employee
  userName: string; 
  type: 'check-in' | 'check-out';
  timestamp: string; // ISO Date string (server timestamp preferred for Firestore)
  photoUrl?: string | null; // URL from Firebase Storage
  location: LocationInfo | null;
  isWithinGeofence: boolean | null;
}

export interface User {
  id: string; // Firebase Auth UID
  employeeId: string; 
  email?: string | null;
  name?: string | null;
  role: UserRole;
  companyId: string; // Crucial for multi-tenancy
  profilePictureUrl?: string | null;
  department?: string | null;
  joiningDate?: string | null; 
  contactInfo?: {
    phone?: string | null;
  };
  baseSalary?: number;
  mockAttendanceFactor?: number; 
  advances?: Advance[];
  leaves?: LeaveApplication[];
}

// For the top-level user directory lookup
export interface UserDirectoryEntry {
    userId: string; // Firebase Auth UID
    employeeId: string;
    email: string;
    companyId: string;
    role: UserRole;
    name?: string; // For easier identification if needed
}


export interface AiTask {
  title: string;
  description: string;
  status: 'In Progress' | 'Completed' | 'Blocked';
}


export interface ClientTask extends AiTask {
  id: string;
}

export interface Task {
  id: string; // Firestore document ID
  title: string;
  description: string;
  assigneeId: string; // KarobHR employee ID of assignee
  assigneeName: string;
  assigneeUid?: string; // Firebase Auth UID of assignee (optional, for easier querying)
  dueDate: string; // ISO Date string
  priority: 'Low' | 'Medium' | 'High' | 'Critical';
  status: 'Pending' | 'In Progress' | 'Completed' | 'Blocked';
  createdAt: string; // ISO Date string (server timestamp)
  updatedAt: string; // ISO Date string (server timestamp)
}


export interface Holiday {
  id:string;
  name: string;
  date: Date; // Stored as Timestamp in Firestore
  description?: string;
}

export interface LeaveApplication {
  id: string; // Firestore document ID (or sub-collection ID if part of user doc)
  userId: string; // Firebase Auth UID of the applicant
  employeeId: string; // KarobHR employee ID of applicant
  leaveType: string;
  startDate: string; 
  endDate: string;   
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  appliedAt: string; // ISO Date string (server timestamp)
  processedAt?: string; // ISO Date string (server timestamp)
  supportingDocumentUrl?: string; 
  color?: string; 
}

export interface Announcement {
  id: string; // Firestore document ID
  title: string;
  content: string;
  postedAt: string; // ISO Date string (server timestamp)
  postedByUid: string; // Firebase Auth UID of admin
  postedByName: string; // Admin's name
}
