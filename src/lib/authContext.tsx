
'use client';

import type { ReactNode } from 'react';
import React, { createContext, useState, useEffect, useCallback, useMemo } from 'react';
import {
  onAuthStateChanged,
  signOut as firebaseSignOut,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  type User as FirebaseUser
} from 'firebase/auth';
import { doc, getDoc, setDoc, collection, addDoc, updateDoc, query, where, getDocs, onSnapshot, serverTimestamp, writeBatch, Timestamp, arrayUnion, deleteDoc } from 'firebase/firestore';
import type { User, UserRole, Task, LeaveApplication, Announcement, UserDirectoryEntry, Advance, AttendanceEvent, LocationInfo, MonthlyPayrollReport, Holiday, CompanySettings, SalaryCalculationMode } from '@/lib/types';
import { getFirebaseInstances } from '@/lib/firebase/firebase';
import { getWorkingDaysInMonth, formatDuration } from '@/lib/dateUtils';
import { calculateDistance } from '@/lib/locationUtils';
import { differenceInMilliseconds, parseISO, getYear, getMonth, startOfMonth, endOfMonth, eachDayOfInterval, isSunday, isSameDay, format, startOfToday, getDaysInMonth, isBefore } from 'date-fns';
import { v4 as uuidv4 } from 'uuid';


const safeParseISO = (dateString: string | Date | Timestamp | undefined | null): Date | null => {
    if (!dateString) return null;
    if (dateString instanceof Timestamp) {
      return dateString.toDate();
    }
    if (dateString instanceof Date) {
      return dateString;
    }
    try {
      const date = parseISO(dateString);
      if (isNaN(date.getTime())) {
        return null;
      }
      return date;
    } catch (error) {
      console.warn("Could not parse date string:", dateString, error);
      return null;
    }
  };

// Define the shape of the context data
export interface AuthContextType {
  user: User | null;
  role: UserRole;
  loading: boolean;
  companyId: string | null;
  companySettings: CompanySettings | null;
  allUsers: User[];
  tasks: Task[];
  holidays: Holiday[];
  attendanceLog: AttendanceEvent[];
  announcements: Announcement[];
  login: (employeeId: string, password: string) => Promise<User | null>;
  logout: () => Promise<void>;
  addNewEmployee: (employeeData: Omit<User, 'id'>, password?: string) => Promise<FirebaseUser | null>;
  updateCompanySettings: (settingsUpdate: Partial<CompanySettings>) => Promise<void>;
  addHoliday: (holidayData: Omit<Holiday, 'id' | 'status' | 'isDefault'>) => Promise<void>;
  updateHoliday: (holidayId: string, holidayData: Partial<Holiday>) => Promise<void>;
  deleteHoliday: (holidayId: string) => Promise<void>;
  addTask: (task: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  updateTask: (task: Task) => Promise<void>;
  addAttendanceEvent: (locationInfo: LocationInfo) => Promise<string>;
  completeCheckout: (docId: string, workReport: string, locationInfo: LocationInfo) => Promise<void>;
  calculateMonthlyPayrollDetails: (employee: User, forYear: number, forMonth: number) => MonthlyPayrollReport | null;
  addLeaveApplication: (leaveData: Omit<LeaveApplication, 'id' | 'userId' | 'employeeId' | 'status' | 'appliedAt'>) => Promise<void>;
  approveLeaveApplication: (userId: string, leaveId: string) => Promise<void>;
  rejectLeaveApplication: (userId: string, leaveId: string) => Promise<void>;
  requestAdvance: (employeeId: string, amount: number, reason: string) => Promise<void>;
  approveAdvance: (advanceId: string) => Promise<void>;
  rejectAdvance: (advanceId: string) => Promise<void>;
}

// Create the context
export const AuthContext = createContext<AuthContextType | undefined>(undefined);

// The provider component
export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<UserRole>(null);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // App-wide state
  const [companySettings, setCompanySettings] = useState<CompanySettings | null>(null);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [attendanceLog, setAttendanceLog] = useState<AttendanceEvent[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);

  const { auth: authInstance, db: dbInstance } = useMemo(() => {
    try {
      return getFirebaseInstances();
    } catch (e) {
      console.error("Failed to initialize Firebase", e);
      return { auth: null, db: null };
    }
  }, []);

  // Main data fetching and authentication effect
  useEffect(() => {
    if (!authInstance || !dbInstance) {
      setLoading(false);
      return;
    }

    const authUnsubscribe = onAuthStateChanged(authInstance, async (firebaseUser) => {
      setLoading(true);
      if (firebaseUser) {
        const userDocRef = doc(dbInstance, 'users', firebaseUser.uid);
        const userDocSnap = await getDoc(userDocRef);

        if (userDocSnap.exists()) {
          const currentUser = { id: userDocSnap.id, ...userDocSnap.data() } as User;
          setUser(currentUser);
          setRole(currentUser.role);
          setCompanyId(currentUser.companyId);
        } else {
          await firebaseSignOut(authInstance);
          setUser(null);
          setRole(null);
          setCompanyId(null);
        }
      } else {
        setUser(null);
        setRole(null);
        setCompanyId(null);
      }
      setLoading(false);
    });

    return () => authUnsubscribe();
  }, [authInstance, dbInstance]);

  // Effect to manage live data subscriptions based on user role and companyId
  useEffect(() => {
    if (!dbInstance || !companyId) {
      setAllUsers([]);
      setTasks([]);
      setHolidays([]);
      setAttendanceLog([]);
      setAnnouncements([]);
      setCompanySettings(null);
      return;
    }
  
    const subscriptions: (() => void)[] = [];
  
    const settingsRef = doc(dbInstance, 'companies', companyId);
    subscriptions.push(onSnapshot(settingsRef, (doc) => setCompanySettings(doc.exists() ? doc.data() as CompanySettings : null)));
  
    const tasksQuery = query(collection(dbInstance, `companies/${companyId}/tasks`));
    subscriptions.push(onSnapshot(tasksQuery, (snapshot) => setTasks(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Task)))));
  
    const holidaysQuery = query(collection(dbInstance, `companies/${companyId}/holidays`));
    subscriptions.push(onSnapshot(holidaysQuery, (snapshot) => {
      const fetchedHolidays: Holiday[] = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id, date: (doc.data().date as Timestamp).toDate() } as Holiday));
      setHolidays(fetchedHolidays);
    }));
  
    const attendanceQuery = query(collection(dbInstance, `companies/${companyId}/attendanceLog`));
    subscriptions.push(onSnapshot(attendanceQuery, (snapshot) => {
        const logList = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id, timestamp: (doc.data().timestamp as Timestamp)?.toDate().toISOString() } as AttendanceEvent));
        setAttendanceLog(logList);
    }));
  
    const announcementsQuery = query(collection(dbInstance, `companies/${companyId}/announcements`));
    subscriptions.push(onSnapshot(announcementsQuery, (snapshot) => setAnnouncements(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Announcement)))));
    
    const allUsersQuery = query(collection(dbInstance, 'users'), where('companyId', '==', companyId));
    subscriptions.push(onSnapshot(allUsersQuery, (snapshot) => setAllUsers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User)))));
  
    return () => subscriptions.forEach(unsub => unsub());
  }, [dbInstance, companyId]);


  const login = useCallback(async (employeeId: string, password: string): Promise<User | null> => {
     if (!authInstance || !dbInstance) throw new Error("Authentication service not ready.");
    const userDirectoryQuery = query(collection(dbInstance, 'userDirectory'), where('employeeId', '==', employeeId));
    const directorySnapshot = await getDocs(userDirectoryQuery);
    if (directorySnapshot.empty) throw new Error("Invalid User ID or Password.");
    const userEmail = directorySnapshot.docs[0].data().email;
    if (!userEmail) throw new Error("User configuration error.");
    await signInWithEmailAndPassword(authInstance, userEmail, password);
    return null;
  }, [authInstance, dbInstance]);

  const logout = useCallback(async () => {
    if (!authInstance) return;
    await firebaseSignOut(authInstance);
  }, [authInstance]);

  const addNewEmployee = useCallback(async (employeeData: Omit<User, 'id'>, password?: string): Promise<FirebaseUser | null> => {
     if (!authInstance || !dbInstance) throw new Error("Firebase services not ready.");
    if (!password) throw new Error("Password is required.");
    const finalEmail = employeeData.email || `${employeeData.employeeId.toLowerCase().replace(/[^a-z0-9]/gi, '')}@${employeeData.companyId.split('-')[0]}.karobhr.local`;
    const companyDocRef = doc(dbInstance, "companies", employeeData.companyId);
    const companyDocSnap = await getDoc(companyDocRef);
    if (companyDocSnap.exists() && employeeData.role === 'admin') {
      throw new Error("An admin for this company already exists.");
    }
    const userCredential = await createUserWithEmailAndPassword(authInstance, finalEmail, password);
    const newFirebaseUser = userCredential.user;
    const newUserDocument: User = { id: newFirebaseUser.uid, ...employeeData };
    const batch = writeBatch(dbInstance);
    batch.set(doc(dbInstance, `users/${newFirebaseUser.uid}`), newUserDocument);
    batch.set(doc(dbInstance, `userDirectory/${newFirebaseUser.uid}`), {
      userId: newFirebaseUser.uid, employeeId: newUserDocument.employeeId, email: finalEmail,
      companyId: newUserDocument.companyId, name: newUserDocument.name, role: newUserDocument.role,
    });
    if (!companyDocSnap.exists() && newUserDocument.role === 'admin') {
      batch.set(companyDocRef, {
        companyId: newUserDocument.companyId, companyName: (employeeData as any).companyName || 'My Company', adminUid: newFirebaseUser.uid,
        createdAt: serverTimestamp(), salaryCalculationMethod: 'standard_hours',
        officeLocation: { name: "Main Office", latitude: 0, longitude: 0, radius: 100 },
      });
    }
    await batch.commit();
    return newFirebaseUser;
  }, [authInstance, dbInstance]);

  const updateCompanySettings = useCallback(async (settingsUpdate: Partial<CompanySettings>) => {
    if (!dbInstance || !companyId) throw new Error("Authentication context is missing.");
    const companyDocRef = doc(dbInstance, 'companies', companyId);
    await updateDoc(companyDocRef, settingsUpdate);
  }, [dbInstance, companyId]);

  const addHoliday = useCallback(async (holidayData: Omit<Holiday, 'id' | 'status' | 'isDefault'>) => {
    if (!dbInstance || !companyId) throw new Error("Authentication context not available.");
    await addDoc(collection(dbInstance, `companies/${companyId}/holidays`), {
      ...holidayData, date: Timestamp.fromDate(holidayData.date), status: 'approved', isDefault: false
    });
  }, [dbInstance, companyId]);

  const updateHoliday = useCallback(async (holidayId: string, holidayData: Partial<Holiday>) => {
    if (!dbInstance || !companyId) throw new Error("Authentication context not available.");
    const holidayRef = doc(dbInstance, `companies/${companyId}/holidays`, holidayId);
    await updateDoc(holidayRef, holidayData);
  }, [dbInstance, companyId]);

  const deleteHoliday = useCallback(async (holidayId: string) => {
    if (!dbInstance || !companyId) throw new Error("Authentication context not available.");
    const holidayDocRef = doc(dbInstance, `companies/${companyId}/holidays`, holidayId);
    await deleteDoc(holidayDocRef);
  }, [dbInstance, companyId]);

  const addAttendanceEvent = useCallback(async (locationInfo: LocationInfo): Promise<string> => {
    if (!dbInstance || !user || !companyId || !companySettings?.officeLocation) throw new Error("Context not available");
    const { officeLocation } = companySettings;
    const distance = calculateDistance(locationInfo.latitude, locationInfo.longitude, officeLocation.latitude, officeLocation.longitude);
    const newEvent: Omit<AttendanceEvent, 'id' | 'timestamp'> & { timestamp: any } = {
      employeeId: user.employeeId,
      userId: user.id,
      userName: user.name || '',
      type: 'check-in',
      timestamp: serverTimestamp(),
      checkInLocation: locationInfo,
      isWithinGeofence: distance <= officeLocation.radius,
      status: 'Checked In',
    };
    const docRef = await addDoc(collection(dbInstance, `companies/${companyId}/attendanceLog`), newEvent);
    return docRef.id;
  }, [dbInstance, user, companyId, companySettings]);

  const completeCheckout = useCallback(async (docId: string, workReport: string, locationInfo: LocationInfo) => {
    if (!dbInstance || !user || !companyId) throw new Error("Context not available");
    const attendanceDocRef = doc(dbInstance, `companies/${companyId}/attendanceLog`, docId);
    const attendanceDocSnap = await getDoc(attendanceDocRef);
    if (!attendanceDocSnap.exists()) throw new Error("Could not find the original check-in document.");
    const checkinTime = safeParseISO(attendanceDocSnap.data().timestamp);
    if (!checkinTime) throw new Error("Could not parse check-in time.");
    const totalHours = differenceInMilliseconds(new Date(), checkinTime) / (1000 * 60 * 60);
    await updateDoc(attendanceDocRef, {
      status: 'Checked Out', type: 'check-out', checkOutTime: Timestamp.fromDate(new Date()),
      checkOutLocation: locationInfo, workReport, totalHours
    });
  }, [dbInstance, user, companyId]);
  
  const calculateMonthlyPayrollDetails = useCallback((employee: User, forYear: number, forMonth: number): MonthlyPayrollReport | null => {
    if (!employee?.baseSalary || !employee.standardDailyHours || !companySettings) {
        return null;
    }

    const { baseSalary, standardDailyHours } = employee;
    const { salaryCalculationMode = 'hourly_deduction' } = companySettings;
    const today = startOfToday();

    // --- 1. Holiday Calculation ---
    const monthDate = new Date(forYear, forMonth);
    const allDaysInMonthArr = eachDayOfInterval({ start: startOfMonth(monthDate), end: endOfMonth(monthDate) });
    const totalDaysInPhysicalMonth = getDaysInMonth(monthDate);
    
    const holidayDates = new Set<string>();
    holidays.forEach(h => {
        if (h.status === 'approved' && getMonth(h.date) === forMonth && getYear(h.date) === forYear) {
            holidayDates.add(format(h.date, 'yyyy-MM-dd'));
        }
    });
    allDaysInMonthArr.forEach(day => {
        if (isSunday(day)) {
            holidayDates.add(format(day, 'yyyy-MM-dd'));
        }
    });

    // --- 2. Rate and Goal Calculation ---
    const monthlyWorkHoursGoal = standardDailyHours * 30;
    const perMinuteSalary = monthlyWorkHoursGoal > 0 ? baseSalary / (monthlyWorkHoursGoal * 60) : 0;
    const perDaySalary = totalDaysInPhysicalMonth > 0 ? baseSalary / totalDaysInPhysicalMonth : 0;

    // --- 3. Attendance Processing ---
    const employeeAttendanceThisMonth = attendanceLog.filter(a => 
        a.employeeId === employee.employeeId && 
        getMonth(safeParseISO(a.timestamp)!) === forMonth && 
        getYear(safeParseISO(a.timestamp)!) === forYear
    );

    let salaryFromWork = 0;
    let totalMinutesWorkedFromAttendance = 0;
    const workedDays = new Set<string>();

    employeeAttendanceThisMonth.forEach(event => {
        const eventDayStr = format(safeParseISO(event.timestamp)!, 'yyyy-MM-dd');
        if (event.status === 'Checked Out' && !holidayDates.has(eventDayStr)) {
            workedDays.add(eventDayStr);
            totalMinutesWorkedFromAttendance += (event.totalHours || 0) * 60;
        }
    });
    
    if (salaryCalculationMode === 'hourly_deduction') {
        salaryFromWork = totalMinutesWorkedFromAttendance * perMinuteSalary;
    } else { // 'check_in_out'
        salaryFromWork = workedDays.size * perDaySalary;
    }

    // --- 4. Holiday Pay Calculation (Past Holidays Only) ---
    let holidayPay = 0;
    let totalHolidayHours = 0;
    holidayDates.forEach(dateStr => {
        const holidayDate = new Date(dateStr);
        if (isBefore(holidayDate, today) || isSameDay(holidayDate, today)) {
            totalHolidayHours += standardDailyHours;
            if (salaryCalculationMode === 'hourly_deduction') {
                holidayPay += standardDailyHours * 60 * perMinuteSalary;
            } else {
                holidayPay += perDaySalary;
            }
        }
    });
    
    // --- 5. Final Aggregation ---
    const totalSalaryEarned = salaryFromWork + holidayPay;
    const totalActualHoursWorked = (totalMinutesWorkedFromAttendance / 60) + totalHolidayHours;
    
    const totalApprovedAdvances = employee.advances
        ?.filter(adv => adv.status === 'approved' && adv.dateProcessed && 
                       getYear(safeParseISO(adv.dateProcessed)!) === forYear && 
                       getMonth(safeParseISO(adv.dateProcessed)!) === forMonth)
        .reduce((sum, adv) => sum + adv.amount, 0) ?? 0;

    const finalNetPayable = totalSalaryEarned - totalApprovedAdvances;
    
    return {
        employeeId: employee.employeeId,
        employeeName: employee.name || 'N/A',
        month: forMonth,
        year: forYear,
        baseSalary,
        standardDailyHours,
        totalWorkingDaysInMonth: totalDaysInPhysicalMonth - holidayDates.size,
        totalStandardHoursForMonth: monthlyWorkHoursGoal,
        totalActualHoursWorked,
        totalHoursMissed: Math.max(0, monthlyWorkHoursGoal - totalActualHoursWorked),
        hourlyRate: perMinuteSalary * 60,
        calculatedDeductions: Math.max(0, baseSalary - totalSalaryEarned),
        salaryAfterDeductions: totalSalaryEarned,
        totalApprovedAdvances,
        finalNetPayable: Math.max(0, finalNetPayable),
    };
}, [holidays, attendanceLog, companySettings]);
  
  const addTask = useCallback(async (taskData: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>) => { }, [dbInstance, companyId]);
  const updateTask = useCallback(async (task: Task) => { }, [dbInstance, companyId]);
  const addLeaveApplication = useCallback(async (leaveData: Omit<LeaveApplication, 'id' | 'userId' | 'employeeId' | 'status' | 'appliedAt'>) => { }, [dbInstance, user, companyId]);
  const approveLeaveApplication = useCallback(async (userId: string, leaveId: string) => { }, [dbInstance, companyId]);
  const rejectLeaveApplication = useCallback(async (userId: string, leaveId: string) => { }, [dbInstance, companyId]);
  const requestAdvance = useCallback(async (employeeId: string, amount: number, reason: string) => { }, [dbInstance, user, companyId]);
  const approveAdvance = useCallback(async (advanceId: string) => { }, [dbInstance, companyId]);
  const rejectAdvance = useCallback(async (advanceId: string) => { }, [dbInstance, companyId]);


  const contextValue = useMemo(() => ({
    user, role, loading, companyId, companySettings, allUsers, tasks, holidays, attendanceLog, announcements,
    login, logout, addNewEmployee, updateCompanySettings, addHoliday, updateHoliday, deleteHoliday,
    addTask, updateTask, addAttendanceEvent, completeCheckout, calculateMonthlyPayrollDetails,
    addLeaveApplication, approveLeaveApplication, rejectLeaveApplication, requestAdvance, approveAdvance, rejectAdvance
  }), [
    user, role, loading, companyId, companySettings, allUsers, tasks, holidays, attendanceLog, announcements,
    login, logout, addNewEmployee, updateCompanySettings, addHoliday, updateHoliday, deleteHoliday,
    addTask, updateTask, addAttendanceEvent, completeCheckout, calculateMonthlyPayrollDetails, addLeaveApplication,
    approveLeaveApplication, rejectLeaveApplication, requestAdvance, approveAdvance, rejectAdvance
  ]);

  return (
    <AuthContext.Provider value={contextValue as AuthContextType}>
      {children}
    </AuthContext.Provider>
  );
};
