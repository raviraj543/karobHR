
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
import type { User, UserRole, Task, LeaveApplication, Announcement, UserDirectoryEntry, Advance, AttendanceEvent, LocationInfo, MonthlyPayrollReport, Holiday, CompanySettings } from '@/lib/types';
import { getFirebaseInstances } from '@/lib/firebase/firebase';
import { getWorkingDaysInMonth } from '@/lib/dateUtils';
import { calculateDistance } from '@/lib/locationUtils';
import { differenceInMilliseconds, parseISO, getYear, getMonth, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';
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
        return { ...data, id: doc.id, timestamp: isoTimestamp, checkInTime: data.checkInTime ? (data.checkInTime instanceof Timestamp ? data.checkInTime.toDate().toISOString() : data.checkInTime) : undefined, checkOutTime: data.checkOutTime ? (data.checkOutTime instanceof Timestamp ? data.checkOutTime.toDate().toISOString() : data.checkOutTime): undefined } as AttendanceEvent;
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
    
    const userCredential = await createUserWithEmailAndPassword(authInstance, finalEmail, password);
    const newFirebaseUser = userCredential.user;

    const newUserDocument: User = {
      id: newFirebaseUser.uid,
      ...employeeData
    };

    const batch = writeBatch(dbInstance);
    batch.set(doc(dbInstance, `users/${newFirebaseUser.uid}`), newUserDocument);
    batch.set(doc(dbInstance, `userDirectory/${newFirebaseUser.uid}`), {
      userId: newFirebaseUser.uid,
      employeeId: newUserDocument.employeeId,
      email: finalEmail,
      companyId: newUserDocument.companyId,
      name: newUserDocument.name,
      role: newUserDocument.role,
    });
    
    // If this is the very first admin, create the company document
    const companyDocRef = doc(dbInstance, "companies", newUserDocument.companyId);
    const companyDocSnap = await getDoc(companyDocRef);
    if (!companyDocSnap.exists() && newUserDocument.role === 'admin') {
      batch.set(companyDocRef, {
        companyId: newUserDocument.companyId,
        companyName: (employeeData as any).companyName || 'My Company', // companyName is not on User type
        adminUid: newFirebaseUser.uid,
        createdAt: serverTimestamp(),
        salaryCalculationMethod: 'standard_hours',
        officeLocation: { name: "Main Office", latitude: 0, longitude: 0, radius: 100 },
      });
    }

    await batch.commit();
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
    // CRITICAL FIX: Use 'timestamp' which is a Firestore Timestamp object, not 'checkInTime'.
    const checkinTime = (checkinData.timestamp as Timestamp).toDate(); 
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
    // Basic validation
    if (!employee || !employee.baseSalary || !employee.standardDailyHours) {
        throw new Error("Employee data for payroll calculation is incomplete.");
    }

    const { baseSalary, standardDailyHours } = employee;

    // Date and calendar calculations
    const reportMonthDate = new Date(forYear, forMonth);
    const workingDaysInMonth = getWorkingDaysInMonth(forYear, forMonth, companyHolidays.map(h => h.date));
    const totalStandardHoursForMonth = workingDaysInMonth * standardDailyHours;

    // Calculate total hours worked from attendance logs
    const monthInterval = { start: startOfMonth(reportMonthDate), end: endOfMonth(reportMonthDate) };
    const totalActualHoursWorked = employeeAttendanceEvents.reduce((acc, event) => {
        if (event.status === 'Checked Out' && event.checkInTime && event.checkOutTime) {
            const checkInDate = safeParseISO(event.checkInTime);
            if (checkInDate && isWithinInterval(checkInDate, monthInterval)) {
                // Ensure checkOutTime is valid before parsing
                const checkOutDate = safeParseISO(event.checkOutTime);
                if (checkOutDate) {
                    const durationInHours = differenceInMilliseconds(checkOutDate, checkInDate) / (1000 * 60 * 60);
                    return acc + durationInHours;
                }
            }
        }
        return acc;
    }, 0);
    
    const totalHoursMissed = Math.max(0, totalStandardHoursForMonth - totalActualHoursWorked);
    const hourlyRate = baseSalary / totalStandardHoursForMonth;
    const calculatedDeductions = totalHoursMissed * hourlyRate;
    const salaryAfterDeductions = baseSalary - calculatedDeductions;
    
    // Sum up approved advances for the month
    const totalApprovedAdvances = employee.advances
        ?.filter(adv => adv.status === 'approved' && getYear(parseISO(adv.dateProcessed!)) === forYear && getMonth(parseISO(adv.dateProcessed!)) === forMonth)
        .reduce((sum, adv) => sum + adv.amount, 0) ?? 0;

    const finalNetPayable = salaryAfterDeductions - totalApprovedAdvances;
    
    // Construct and return the report
    const payrollReport: MonthlyPayrollReport = {
        employeeId: employee.employeeId,
        employeeName: employee.name || 'N/A',
        month: forMonth,
        year: forYear,
        baseSalary,
        standardDailyHours,
        totalWorkingDaysInMonth: workingDaysInMonth,
        totalStandardHoursForMonth,
        totalActualHoursWorked,
        totalHoursMissed,
        hourlyRate,
        calculatedDeductions,
        salaryAfterDeductions,
        totalApprovedAdvances,
        finalNetPayable
    };

    return payrollReport;
}, []);

  // Memoize the context value
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
    addTask,
    updateTask,
    addAttendanceEvent,
    completeCheckout,
    calculateMonthlyPayrollDetails
  }), [
    user, role, loading, companyId, companySettings, allUsers, tasks, attendanceLog, announcements,
    login, logout, addNewEmployee, updateCompanySettings, addTask, updateTask, addAttendanceEvent, completeCheckout, calculateMonthlyPayrollDetails
  ]);

  return (
    <AuthContext.Provider value={contextValue as AuthContextType}>
      {children}
    </AuthContext.Provider>
  );
};
