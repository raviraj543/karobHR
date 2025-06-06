
export type UserRole = 'admin' | 'manager' | 'employee' | null;

export interface CompanySettings {
  companyId: string;
  companyName: string;
  adminUid: string;
  createdAt: string; // ISO string or Firestore Timestamp
  officeLocation?: {
    name?: string; // e.g., "Main Office", "Headquarters"
    latitude: number;
    longitude: number;
    radius: number; // in meters
  };
  // other company-wide settings can go here
}

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
  isWithinGeofence: boolean | null; // True if within ANY valid geofence
  matchedGeofenceType?: 'office' | 'remote' | null; // Which type of geofence was matched
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
  standardDailyHours?: number;
  mockAttendanceFactor?: number;
  advances?: Advance[];
  leaves?: LeaveApplication[];
  remoteWorkLocation?: { // For employee's specific remote/home location
    name?: string; // e.g., "Home Office"
    latitude: number;
    longitude: number;
    radius: number; // in meters
  };
}

// For the top-level user directory lookup
export interface UserDirectoryEntry {
    userId: string; // Firebase Auth UID
    employeeId: string;
    email: string;
    companyId: string;
    role: UserRole;
    name?: string;
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
  assigneeId: string;
  assigneeName: string;
  assigneeUid?: string;
  dueDate: string; // ISO Date string
  priority: 'Low' | 'Medium' | 'High' | 'Critical';
  status: 'Pending' | 'In Progress' | 'Completed' | 'Blocked';
  createdAt: string; // ISO Date string
  updatedAt: string; // ISO Date string
}


export interface Holiday {
  id:string;
  name: string;
  date: Date; // Stored as Timestamp in Firestore
  description?: string;
}

export interface LeaveApplication {
  id: string;
  userId: string;
  employeeId: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  appliedAt: string; // ISO Date string
  processedAt?: string; // ISO Date string
  supportingDocumentUrl?: string;
  color?: string;
}

export interface Announcement {
  id: string; // Firestore document ID
  title: string;
  content: string;
  postedAt: string; // ISO Date string
  postedByUid: string;
  postedByName: string;
}

export interface MonthlyPayrollReport {
  employeeId: string;
  employeeName: string;
  month: number; // 0-11 for Jan-Dec
  year: number;
  baseSalary: number;
  standardDailyHours: number;
  totalWorkingDaysInMonth: number;
  totalStandardHoursForMonth: number;
  totalActualHoursWorked: number;
  totalHoursMissed: number;
  hourlyRate: number;
  calculatedDeductions: number;
  salaryAfterDeductions: number;
  totalApprovedAdvances: number;
  finalNetPayable: number;
}
