
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
import { doc, getDoc, setDoc, collection, addDoc, updateDoc, query, where, getDocs, onSnapshot, serverTimestamp, writeBatch, Timestamp } from 'firebase/firestore';
import type { User, UserRole, Task, LeaveApplication, Announcement, UserDirectoryEntry, Advance, AttendanceEvent, LocationInfo, MonthlyPayrollReport, Holiday, CompanySettings, SalaryCalculationMode } from '@/lib/types';
import { getFirebaseInstances } from '@/lib/firebase/firebase';
import { getWorkingDaysInMonth, formatDuration } from '@/lib/dateUtils';
import { calculateDistance } from '@/lib/locationUtils';
import { differenceInMilliseconds, parseISO, getYear, getMonth, startOfMonth, endOfMonth, isWithinInterval, eachDayOfInterval, isSunday, isSameDay, format } from 'date-fns';
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
  attendanceLog: AttendanceEvent[];
  announcements: Announcement[];
  login: (employeeId: string, password: string) => Promise<User | null>;
  logout: () => Promise<void>;
  addNewEmployee: (employeeData: Omit<User, 'id'>, password?: string) => Promise<FirebaseUser | null>;
  updateCompanySettings: (settingsUpdate: Partial<CompanySettings>) => Promise<void>;
  updateHolidayStatus: (holidayId: string, status: 'scheduled' | 'approved') => Promise<void>;
  approveHolidayForPay: (holidayId: string) => Promise<void>;
  addTask: (task: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  updateTask: (task: Task) => Promise<void>;
  addAttendanceEvent: (locationInfo: LocationInfo) => Promise<string>;
  completeCheckout: (docId: string, workReport: string, locationInfo: LocationInfo) => Promise<void>;
  calculateMonthlyPayrollDetails: (employee: User, forYear: number, forMonth: number, employeeAttendanceEvents: AttendanceEvent[], companyHolidays?: Holiday[]) => MonthlyPayrollReport;
  // Add other function signatures here as needed
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
          // User exists in Auth but not in Firestore, sign them out.
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
    if (!dbInstance || !user || !companyId) {
      // Clear all data if not logged in or no company context
      setAllUsers([]);
      setTasks([]);
      setAttendanceLog([]);
      setAnnouncements([]);
      setCompanySettings(null);
      return;
    }

    const subscriptions: (() => void)[] = [];

    // Company Settings Subscription
    const settingsRef = doc(dbInstance, 'companies', companyId);
    subscriptions.push(onSnapshot(settingsRef, (doc) => {
      setCompanySettings(doc.exists() ? doc.data() as CompanySettings : null);
    }));
    
    // Tasks Subscription
    let tasksQuery;
    if (user.role === 'admin' || user.role === 'manager') {
        tasksQuery = query(collection(dbInstance, `companies/${companyId}/tasks`));
    } else {
        tasksQuery = query(collection(dbInstance, `companies/${companyId}/tasks`), where('assigneeId', '==', user.employeeId));
    }
    subscriptions.push(onSnapshot(tasksQuery, (snapshot) => {
        const tasksList = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Task));
        setTasks(tasksList);
    }));

    // Attendance Log Subscription
    let attendanceQuery;
     if (user.role === 'admin' || user.role === 'manager') {
        attendanceQuery = query(collection(dbInstance, `companies/${companyId}/attendanceLog`));
    } else {
        attendanceQuery = query(collection(dbInstance, `companies/${companyId}/attendanceLog`), where('userId', '==', user.id));
    }
    subscriptions.push(onSnapshot(attendanceQuery, (snapshot) => {
      const logList = snapshot.docs.map(doc => {
        const data = doc.data();
        const timestamp = data.timestamp;
        // Ensure timestamp is converted to an ISO string
        const isoTimestamp = timestamp instanceof Timestamp ? timestamp.toDate().toISOString() : (timestamp ? new Date(timestamp).toISOString() : new Date().toISOString());
        return { ...data, id: doc.id, timestamp: isoTimestamp, checkInTime: data.checkInTime ? (data.checkInTime instanceof Timestamp ? data.checkInTime.toDate().toISOString() : data.checkInTime) : undefined, checkOutTime: data.checkOutTime ? (data.checkOutTime instanceof Timestamp ? data.checkOutTime.toDate().toISOString() : data.checkOutTime): undefined, totalHours: data.totalHours } as AttendanceEvent;
      });
      setAttendanceLog(logList);
    }));

    // Announcements Subscription
    const announcementsQuery = query(collection(dbInstance, `companies/${companyId}/announcements`));
    subscriptions.push(onSnapshot(announcementsQuery, (snapshot) => {
      const announcementsList = snapshot.docs.map(doc => {
        const data = doc.data();
        const postedAt = data.postedAt;
        const isoPostedAt = postedAt instanceof Timestamp ? postedAt.toDate().toISOString() : (postedAt ? new Date(postedAt).toISOString() : new Date().toISOString());
        return { ...data, id: doc.id, postedAt: isoPostedAt } as Announcement
      });
      setAnnouncements(announcementsList);
    }));
    
    // All Users subscription (ONLY for admins)
    if (user.role === 'admin') {
      const allUsersQuery = query(collection(dbInstance, 'users'), where('companyId', '==', companyId));
      subscriptions.push(onSnapshot(allUsersQuery, (snapshot) => {
        const usersList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User));
        setAllUsers(usersList);
      }));
    } else {
      // If not an admin, 'allUsers' should just be the user themselves.
      setAllUsers(user ? [user] : []);
    }


    // Cleanup function to unsubscribe from all listeners on logout/unmount
    return () => {
      subscriptions.forEach(unsubscribe => unsubscribe());
    };
  }, [dbInstance, user, companyId]);


  const login = useCallback(async (employeeId: string, password: string): Promise<User | null> => {
    if (!authInstance || !dbInstance) throw new Error("Authentication service not ready.");
    
    const userDirectoryQuery = query(collection(dbInstance, 'userDirectory'), where('employeeId', '==', employeeId));
    const directorySnapshot = await getDocs(userDirectoryQuery);

    if (directorySnapshot.empty) {
      throw new Error("Invalid User ID or Password.");
    }
    
    const userEmail = directorySnapshot.docs[0].data().email;
    if (!userEmail) {
      throw new Error("User configuration error. Please contact support.");
    }

    await signInWithEmailAndPassword(authInstance, userEmail, password);
    // onAuthStateChanged will handle setting user state
    return null; // Let the effect handle the state update
  }, [authInstance, dbInstance]);

  const logout = useCallback(async () => {
    if (!authInstance) return;
    await firebaseSignOut(authInstance);
    // onAuthStateChanged will clear all user state
  }, [authInstance]);

  const addNewEmployee = useCallback(async (employeeData: Omit<User, 'id'>, password?: string): Promise<FirebaseUser | null> => {
    if (!authInstance || !dbInstance) throw new Error("Firebase services not ready.");
    if (!password) throw new Error("Password is required for new accounts.");
  
    const finalEmail = employeeData.email || `${employeeData.employeeId.toLowerCase().replace(/[^a-z0-9]/gi, '')}@${employeeData.companyId.split('-')[0]}.karobhr.local`;
    
    // Check if company already exists
    const companyDocRef = doc(dbInstance, "companies", employeeData.companyId);
    const companyDocSnap = await getDoc(companyDocRef);
  
    if (companyDocSnap.exists() && employeeData.role === 'admin') {
      // If company exists, new signups cannot be admins.
      // You might want to adjust this logic depending on your app's rules.
      // For now, we prevent creating a new admin for an existing company through this flow.
      throw new Error("An admin for this company already exists. New employees must have the 'employee' or 'manager' role.");
    }
  
    const userCredential = await createUserWithEmailAndPassword(authInstance, finalEmail, password);
    const newFirebaseUser = userCredential.user;
  
    const newUserDocument: User = {
      id: newFirebaseUser.uid,
      ...employeeData
    };
  
    const batch = writeBatch(dbInstance);
  
    // Set user document
    batch.set(doc(dbInstance, `users/${newFirebaseUser.uid}`), newUserDocument);
  
    // Set user directory document
    batch.set(doc(dbInstance, `userDirectory/${newFirebaseUser.uid}`), {
      userId: newFirebaseUser.uid,
      employeeId: newUserDocument.employeeId,
      email: finalEmail,
      companyId: newUserDocument.companyId,
      name: newUserDocument.name,
      role: newUserDocument.role,
    });
    
    // If the company does NOT exist and the new user is an admin, create the company document
    if (!companyDocSnap.exists() && newUserDocument.role === 'admin') {
      batch.set(companyDocRef, {
        companyId: newUserDocument.companyId,
        companyName: (employeeData as any).companyName || 'My Company', 
        adminUid: newFirebaseUser.uid,
        createdAt: serverTimestamp(),
        salaryCalculationMethod: 'standard_hours',
        officeLocation: { name: "Main Office", latitude: 0, longitude: 0, radius: 100 },
      });
    }
  
    await batch.commit();
  
    // If this was the first admin, you might want to sign them in automatically
    // or handle the UI flow to take them to the login page.
    // For now, returning the firebase user is sufficient.
    return newFirebaseUser;
  }, [authInstance, dbInstance]);

  const updateCompanySettings = useCallback(async (settingsUpdate: Partial<CompanySettings>) => {
    if (!dbInstance || !companyId) {
      console.error("Update failed: DbInstance or CompanyId not available.");
      throw new Error("User is not properly authenticated or company context is missing.");
    }
    const companyDocRef = doc(dbInstance, 'companies', companyId);
    await updateDoc(companyDocRef, settingsUpdate);
    // The onSnapshot listener will automatically update the state, no need to call setCompanySettings here.
  }, [dbInstance, companyId]);

  const updateHolidayStatus = useCallback(async (holidayId: string, status: 'scheduled' | 'approved') => {
    if (!dbInstance || !companyId) {
      console.error("Update failed: DbInstance or CompanyId not available.");
      throw new Error("User is not properly authenticated or company context is missing.");
    }
    const holidayDocRef = doc(dbInstance, `companies/${companyId}/holidays`, holidayId);
    await updateDoc(holidayDocRef, { status });
  }, [dbInstance, companyId]);

  const approveHolidayForPay = useCallback(async (holidayId: string) => {
    await updateHolidayStatus(holidayId, 'approved');
  }, [updateHolidayStatus]);

  const addTask = useCallback(async (taskData: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (!dbInstance || !companyId) throw new Error("User or company context not available.");
    await addDoc(collection(dbInstance, `companies/${companyId}/tasks`), {
      ...taskData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }, [dbInstance, companyId]);

  const updateTask = useCallback(async (task: Task) => {
    if (!dbInstance || !companyId) throw new Error("Database or company context not available.");
    const { id, ...dataToUpdate } = task;
    await updateDoc(doc(dbInstance, `companies/${companyId}/tasks/${id}`), {
      ...dataToUpdate,
      updatedAt: serverTimestamp(),
    });
  }, [dbInstance, companyId]);

  const addAttendanceEvent = useCallback(async (locationInfo: LocationInfo): Promise<string> => {
    if (!dbInstance || !user || !companyId || !companySettings?.officeLocation) throw new Error("Context not available");

    const { officeLocation } = companySettings;
    const distance = calculateDistance(
      locationInfo.latitude,
      locationInfo.longitude,
      officeLocation.latitude,
      officeLocation.longitude
    );

    const isWithinOfficeRadius = distance <= officeLocation.radius;

    const newEvent: Omit<AttendanceEvent, 'id' | 'timestamp'> & { timestamp: any } = {
      employeeId: user.employeeId,
      userId: user.id,
      userName: user.name || '',
      type: 'check-in',
      timestamp: serverTimestamp(), // Use serverTimestamp for accuracy
      checkInLocation: locationInfo,
      isWithinGeofence: isWithinOfficeRadius,
      status: 'Checked In',
    };
    const docRef = await addDoc(collection(dbInstance, `companies/${companyId}/attendanceLog`), newEvent);
    return docRef.id;
  }, [dbInstance, user, companyId, companySettings]);

  const completeCheckout = useCallback(async (docId: string, workReport: string, locationInfo: LocationInfo) => {
    if (!dbInstance || !user || !companyId) throw new Error("Context not available");

    const attendanceDocRef = doc(dbInstance, `companies/${companyId}/attendanceLog`, docId);
    const attendanceDocSnap = await getDoc(attendanceDocRef);

    if (!attendanceDocSnap.exists()) {
        throw new Error("Could not find the original check-in document to update.");
    }
    
    const checkinData = attendanceDocSnap.data();
    // Use the saved check-in timestamp, ensuring it's treated as a Date object.
    const checkinTime = safeParseISO(checkinData.timestamp);

    if (!checkinTime) {
        throw new Error("Could not parse check-in time for duration calculation.");
    }

    const checkoutTime = new Date();
    const totalHours = differenceInMilliseconds(checkoutTime, checkinTime) / (1000 * 60 * 60);

    await updateDoc(attendanceDocRef, {
      status: 'Checked Out',
      type: 'check-out', // Ensure the event type is updated
      checkOutTime: Timestamp.fromDate(checkoutTime),
      checkOutLocation: locationInfo,
      workReport: workReport,
      totalHours: totalHours
    });

  }, [dbInstance, user, companyId]);


  const calculateMonthlyPayrollDetails = useCallback((employee: User, forYear: number, forMonth: number, employeeAttendanceEvents: AttendanceEvent[], companyHolidays: Holiday[] = []): MonthlyPayrollReport => {
    if (!employee || !employee.baseSalary) {
        throw new Error("Employee data for payroll calculation is incomplete. Base salary is missing.");
    }

    const { baseSalary } = employee;
    const standardDailyHours = employee.standardDailyHours || 8; // Default to 8 if not set

    // Payroll calculation based on company settings
    const salaryCalculationMode = companySettings?.salaryCalculationMode || 'hourly_deduction'; // Default to hourly

    let totalActualHoursWorked = 0;
    let totalDeduction = 0;
    let totalHoursMissed = 0;
    let perMinuteSalary = 0;
    let totalPaidDays = 0; // For check_in_out mode

    const monthStartDate = startOfMonth(new Date(forYear, forMonth));
    const monthEndDate = endOfMonth(new Date(forYear, forMonth));
    const allDaysInMonth = eachDayOfInterval({ start: monthStartDate, end: monthEndDate });

    const approvedHolidayDates = new Set(companyHolidays.filter(h => h.status === 'approved').map(h => format(h.date, 'yyyy-MM-dd')));

    if (salaryCalculationMode === 'hourly_deduction') {
        // Per-minute salary calculation based on your specs for hourly deduction
        const totalMinutesInMonth = 30 * standardDailyHours * 60; // Assuming 30 standard days for base calculation
        perMinuteSalary = baseSalary / totalMinutesInMonth;

        allDaysInMonth.forEach(day => {
            const dayStr = format(day, 'yyyy-MM-dd');
            const isSundayDay = isSunday(day);
            const isHoliday = approvedHolidayDates.has(dayStr);
            
            // Skip Sundays and declared holidays - they are paid
            if (isSundayDay || isHoliday) {
                totalActualHoursWorked += standardDailyHours; // Assume full day for paid holidays
                return;
            }

            // Find attendance for this specific day
            const attendanceForDay = employeeAttendanceEvents.filter(e => e.timestamp && isSameDay(safeParseISO(e.timestamp) as Date, day));
            
            let workedMinutesThisDay = 0;
            attendanceForDay.forEach(event => {
                if (event.status === 'Checked Out' && event.totalHours !== undefined && event.totalHours !== null) {
                    workedMinutesThisDay += event.totalHours * 60;
                }
            });
            
            totalActualHoursWorked += (workedMinutesThisDay / 60);

            // If no check-in/out record on a working day, deduct the full day
            if (workedMinutesThisDay === 0) {
                totalDeduction += (standardDailyHours * 60 * perMinuteSalary);
            } else {
                // If they worked, but less than standard hours, deduct the shortfall
                const shortfallMinutes = (standardDailyHours * 60) - workedMinutesThisDay;
                if (shortfallMinutes > 0) {
                    totalDeduction += shortfallMinutes * perMinuteSalary;
                }
            }
        });
        totalHoursMissed = (totalDeduction / (perMinuteSalary * 60)); // Convert deduction back to hours
    } else if (salaryCalculationMode === 'check_in_out') {
        // Check-in/Checkout Based Full-Day Salary Logic
        const dailySalary = baseSalary / 30; // Based on 30 standard days

        allDaysInMonth.forEach(day => {
            const dayStr = format(day, 'yyyy-MM-dd');
            const isSundayDay = isSunday(day);
            const isHoliday = approvedHolidayDates.has(dayStr);

            // Sundays and declared holidays are always paid full day
            if (isSundayDay || isHoliday) {
                totalPaidDays++;
                totalActualHoursWorked += standardDailyHours; // Assume full standard hours for reporting paid days
                return;
            }

            // For working days, check for a completed check-in/checkout pair
            const hasCompletedCheckoutToday = employeeAttendanceEvents.some(event => 
                event.status === 'Checked Out' && event.timestamp && isSameDay(safeParseISO(event.timestamp) as Date, day)
            );

            if (hasCompletedCheckoutToday) {
                totalPaidDays++; // Count as a full paid day
                // For reporting total hours, sum the actual hours worked on these days
                 const attendanceForDay = employeeAttendanceEvents.filter(e => e.timestamp && isSameDay(safeParseISO(e.timestamp) as Date, day));
                 attendanceForDay.forEach(event => {
                     if (event.status === 'Checked Out' && event.totalHours !== undefined && event.totalHours !== null) {
                        totalActualHoursWorked += event.totalHours;
                     }
                 });
            } else {
                 // If no completed checkout on a working day, deduct a full day's pay
                 totalDeduction += dailySalary; // Deduct one full day's salary
            }
        });

         // Adjust totalHoursMissed/calculatedDeductions for reporting clarity in check_in_out mode
         const totalUnpaidWorkingDays = allDaysInMonth.length - allDaysInMonth.filter(isSunday).length - approvedHolidayDates.size - totalPaidDays;
         totalDeduction = totalUnpaidWorkingDays * (baseSalary / 30);
         totalHoursMissed = totalUnpaidWorkingDays * standardDailyHours;
    }

    // Sum up approved advances for the month
    const totalApprovedAdvances = employee.advances
        ?.filter(adv => adv.status === 'approved' && adv.dateProcessed && getYear(safeParseISO(adv.dateProcessed)) === forYear && getMonth(safeParseISO(adv.dateProcessed)) === forMonth)
        .reduce((sum, adv) => sum + adv.amount, 0) ?? 0;
    
    const salaryAfterDeductions = baseSalary - totalDeduction;
    const finalNetPayable = salaryAfterDeductions - totalApprovedAdvances;

    return {
        employeeId: employee.employeeId,
        employeeName: employee.name || 'N/A',
        month: forMonth,
        year: forYear,
        baseSalary,
        standardDailyHours,
        totalWorkingDaysInMonth: allDaysInMonth.length,
        totalStandardHoursForMonth: allDaysInMonth.length * standardDailyHours, 
        totalActualHoursWorked: totalActualHoursWorked,
        totalHoursMissed: totalHoursMissed,
        hourlyRate: perMinuteSalary !== 0 ? perMinuteSalary * 60 : baseSalary / (30 * standardDailyHours),
        calculatedDeductions: totalDeduction,
        salaryAfterDeductions: salaryAfterDeductions,
        totalApprovedAdvances,
        finalNetPayable: Math.max(0, finalNetPayable), // Ensure salary isn't negative
    };
}, [companySettings?.salaryCalculationMode]);

  const contextValue = useMemo(() => ({
    user,
    role,
    loading,
    companyId,
    companySettings,
    allUsers,
    tasks,
    attendanceLog,
    announcements,
    login,
    logout,
    addNewEmployee,
    updateCompanySettings,
    updateHolidayStatus,
    approveHolidayForPay,
    addTask,
    updateTask,
    addAttendanceEvent,
    completeCheckout,
    calculateMonthlyPayrollDetails
  }), [
    user, role, loading, companyId, companySettings, allUsers, tasks, attendanceLog, announcements,
    login, logout, addNewEmployee, updateCompanySettings, updateHolidayStatus, approveHolidayForPay, addTask, updateTask, addAttendanceEvent, completeCheckout, calculateMonthlyPayrollDetails
  ]);

  return (
    <AuthContext.Provider value={contextValue as AuthContextType}>
      {children}
    </AuthContext.Provider>
  );
};
