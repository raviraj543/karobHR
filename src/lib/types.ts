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
  timestamp: string; // Main event timestamp, typically check-in for new records
  checkInTime?: string; // Explicit ISO Date string for check-in
  checkOutTime?: string | null; // Explicit ISO Date string for check-out
  photoUrl?: string | null; // URL from Firebase Storage for check-in photo
  checkInLocation?: LocationInfo | null;
  checkOutLocation?: LocationInfo | null;
  isWithinGeofence: boolean | null; // For check-in
  isWithinGeofenceCheckout?: boolean | null; // For check-out
  matchedGeofenceType?: 'office' | null; // For check-in
  matchedGeofenceTypeCheckout?: 'office' | null; // For check-out
  status: 'Checked In' | 'Checked Out';
  workReport?: string | null;
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

export interface User {
  id: string; // Firebase Auth UID
  employeeId: string; // Custom Employee ID for the company
  email: string | null;
  name?: string;
  role: UserRole;
  companyId: string;
  department?: string;
  joiningDate?: string; // ISO date string
  baseSalary?: number;
  standardDailyHours?: number; // Added standard daily hours
  contactInfo?: {
    phone?: string;
    address?: string;
  };
  profilePictureUrl?: string | null;
  remoteWorkLocation?: {
    latitude: number;
    longitude: number;
    radius: number;
  } | null;
  leaves?: LeaveApplication[];
  advances?: Advance[];
  mockAttendanceFactor?: number; // Temporary for payslip calculation
}
