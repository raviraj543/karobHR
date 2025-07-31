
"use client";

import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { auth, db } from '@/lib/firebase/firebase';
import { onAuthStateChanged, User as FirebaseUser, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, updatePassword } from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, collection, query, where, getDocs, orderBy, onSnapshot, addDoc, writeBatch, deleteDoc, Timestamp } from 'firebase/firestore';
import type { CompanySettings, User, Task, AttendanceEvent, Announcement, LeaveApplication, Advance, LocationInfo, MonthlyPayrollReport, Holiday, SalaryCalculationMode } from '@/lib/app-types';
import { v4 as uuidv4 } from 'uuid';
import { getWorkingDaysInMonth, isSunday, formatHoursAndMinutes, formatDuration, safeParseISO } from '@/lib/dateUtils';
import { calculateDistance } from './locationUtils';
import { isToday, differenceInSeconds, subDays, startOfDay, endOfDay, setHours, eachDayOfInterval, startOfMonth, endOfMonth } from 'date-fns';

export interface NewEmployeePayload {
    name: string;
    employeeId: string;
    email?: string;
    department: string;
    role: 'admin' | 'manager' | 'employee';
    companyId: string;
    companyName: string;
    joiningDate?: string;
    baseSalary?: number;
    standardDailyHours?: number;
}

export interface AuthContextType {
    user: FirebaseUser | null;
    karobUser: User | null;
    role: User['role'];
    companyId: string | null;
    companySettings: CompanySettings | null;
    loading: boolean;
    login: (loginId: string, password: string) => Promise<User>;
    logout: () => Promise<void>;
    addNewEmployee: (employeeData: NewEmployeePayload, password: string) => Promise<User | null>;
    addAnnouncement: (title: string, content: string) => Promise<void>;
    addAttendanceEvent: (location: LocationInfo) => Promise<string | null>;
    completeCheckout: (docId: string, workReport: string, location: LocationInfo) => Promise<void>;
    updateCompanySettings: (settings: Partial<CompanySettings>, companyId: string) => Promise<void>;
    addTask: (task: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
    updateTask: (task: Task) => Promise<void>;
    addLeaveApplication: (leaveData: Omit<LeaveApplication, 'id' | 'userId' | 'employeeId' | 'status' | 'appliedAt'>) => Promise<void>;
    approveLeaveApplication: (applicantUid: string, leaveId: string) => Promise<void>;
    rejectLeaveApplication: (applicantUid: string, leaveId: string) => Promise<void>;
    requestAdvance: (employeeId: string, amount: number, reason: string) => Promise<void>;
    approveAdvance: (advanceId: string) => Promise<void>;
    rejectAdvance: (advanceId: string) => Promise<void>;
    addHoliday: (holidayData: Omit<Holiday, 'id' | 'status'>) => Promise<void>;
    calculateMonthlyPayrollDetails: (
        employee: User,
        year: number,
        month: number,
        employeeAttendanceForMonth: AttendanceEvent[],
        holidaysForMonth: Holiday[],
        approvedLeavesForMonth: LeaveApplication[],
        approvedAdvancesForMonth: Advance[]
    ) => MonthlyPayrollReport;
    calculateTodayEstimatedEarning: (
        employee: User,
        todaysAttendance: AttendanceEvent[],
        liveAttendanceEvent: AttendanceEvent | null,
        companySettings: CompanySettings | null
      ) => number;
    runAutoCheckout: () => Promise<number>;
    updateEmployeeDetails: (userId: string, updates: Partial<User>) => Promise<void>;
    updateUserPassword: (userId: string, newPassword: string) => Promise<void>;
    // Admin-specific data
    allUsers: User[];
    attendanceLog: AttendanceEvent[]; 
    allTasks: Task[];
    userTasks: Task[];
    announcements: Announcement[];
    holidays: Holiday[];
    leaveRequests: LeaveApplication[];
    advanceRequests: Advance[];
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<FirebaseUser | null>(null);
    const [karobUser, setKarobUser] = useState<User | null>(null);
    const [companySettings, setCompanySettings] = useState<CompanySettings | null>(null);
    const [loading, setLoading] = useState(true);

    const [announcements, setAnnouncements] = useState<Announcement[]>([]);
    const [holidays, setHolidays] = useState<Holiday[]>([]);
    const [userTasks, setUserTasks] = useState<Task[]>([]);
    const [userLeaveRequests, setUserLeaveRequests] = useState<LeaveApplication[]>([]);
    const [userAdvances, setUserAdvances] = useState<Advance[]>([]);
    const [userAttendance, setUserAttendance] = useState<AttendanceEvent[]>([]);
    
    const [allUsers, setAllUsers] = useState<User[]>([]);
    const [allAttendance, setAllAttendance] = useState<AttendanceEvent[]>([]);
    const [allTasks, setAllTasks] = useState<Task[]>([]);
    const [allLeaveRequests, setAllLeaveRequests] = useState<LeaveApplication[]>([]);
    const [allAdvanceRequests, setAllAdvanceRequests] = useState<Advance[]>([]);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
            setLoading(true);
            if (firebaseUser) {
                const userDocRef = doc(db, 'users', firebaseUser.uid);
                const userDocSnap = await getDoc(userDocRef);

                if (userDocSnap.exists()) {
                    const userData = { id: userDocSnap.id, ...userDocSnap.data() } as User;
                    setUser(firebaseUser);
                    setKarobUser(userData);
                } else {
                    await signOut(auth); 
                    setUser(null);
                    setKarobUser(null);
                    setLoading(false);
                }
            } else {
                setUser(null);
                setKarobUser(null);
                setCompanySettings(null);
                setAnnouncements([]);
                setHolidays([]);
                setAllUsers([]);
                setAllAttendance([]);
                setAllTasks([]);
                setUserTasks([]);
                setAllLeaveRequests([]);
                setUserLeaveRequests([]);
                setAllAdvanceRequests([]);
                setUserAdvances([]);
                setUserAttendance([]);
                setLoading(false);
            }
        });
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        if (!karobUser || !karobUser.companyId) {
            if (!loading) {
                 setAllTasks([]);
                 setUserTasks([]);
                 setCompanySettings(null);
            }
            return;
        }
        
        setLoading(true);

        const companyId = karobUser.companyId;
        const unsubscribers: (() => void)[] = [];

        const companyDocRef = doc(db, 'companies', companyId);
        unsubscribers.push(onSnapshot(companyDocRef, (snap) => setCompanySettings(snap.exists() ? (snap.data() as CompanySettings) : null)));
        
        const announcementsRef = collection(db, `companies/${companyId}/announcements`);
        unsubscribers.push(onSnapshot(query(announcementsRef, orderBy('postedAt', 'desc')), (snap) => setAnnouncements(snap.docs.map(d => ({ ...d.data(), id: d.id } as Announcement)))));
        
        const holidaysRef = collection(db, `companies/${companyId}/holidays`);
        unsubscribers.push(onSnapshot(query(holidaysRef, orderBy('date', 'asc')), (snap) => setHolidays(snap.docs.map(d => ({ ...d.data(), id: d.id, date: (d.data().date as any).toDate() } as Holiday)))));
        
        const tasksRef = collection(db, `companies/${companyId}/tasks`);
        const leaveRequestsRef = collection(db, `companies/${companyId}/leaveApplications`);
        const advancesRef = collection(db, `companies/${companyId}/advances`);
        const attendanceRef = collection(db, `companies/${companyId}/attendanceLog`);

        if (karobUser.role === 'admin') {
            const usersRef = collection(db, 'users');
            unsubscribers.push(onSnapshot(query(usersRef, where('companyId', '==', companyId)), (snap) => setAllUsers(snap.docs.map(d => ({ ...d.data(), id: d.id } as User)))));
            unsubscribers.push(onSnapshot(query(attendanceRef, orderBy('timestamp', 'desc')), (snap) => setAllAttendance(snap.docs.map(d => ({ ...d.data(), id: d.id } as AttendanceEvent)))));
            unsubscribers.push(onSnapshot(query(tasksRef, orderBy('createdAt', 'desc')), (snap) => setAllTasks(snap.docs.map(d => ({ ...d.data(), id: d.id } as Task)))));
            unsubscribers.push(onSnapshot(query(advancesRef, orderBy('dateRequested', 'desc')), (snap) => setAllAdvanceRequests(snap.docs.map(d => ({...d.data(), id: d.id } as Advance)))));
            unsubscribers.push(onSnapshot(query(leaveRequestsRef, orderBy('appliedAt', 'desc')), (snap) => setAllLeaveRequests(snap.docs.map(d => ({...d.data(), id: d.id } as LeaveApplication)))));
            
            setUserTasks([]); 
            setUserLeaveRequests([]);
            setUserAdvances([]);
            setUserAttendance([]);
        } else {
            const userTasksQuery = query(tasksRef, where('assigneeId', '==', karobUser.employeeId || ''), orderBy('createdAt', 'desc'));
            unsubscribers.push(onSnapshot(userTasksQuery, (snap) => setUserTasks(snap.docs.map(d => ({ ...d.data(), id: d.id } as Task)))));
            const userLeaveRequestsQuery = query(leaveRequestsRef, where('userId', '==', karobUser.id), orderBy('appliedAt', 'desc'));
            unsubscribers.push(onSnapshot(userLeaveRequestsQuery, (snap) => setUserLeaveRequests(snap.docs.map(d => ({...d.data(), id: d.id} as LeaveApplication)))));
            const userAdvancesQuery = query(advancesRef, where('employeeId', '==', karobUser.employeeId || ''), orderBy('dateRequested', 'desc'));
            unsubscribers.push(onSnapshot(userAdvancesQuery, (snap) => setUserAdvances(snap.docs.map(d => ({...d.data(), id: d.id } as Advance)))));
            const userAttendanceQuery = query(attendanceRef, where('userId', '==', karobUser.id), orderBy('timestamp', 'desc'));
unsubscribers.push(onSnapshot(userAttendanceQuery, (snap) => setUserAttendance(snap.docs.map(d => ({...d.data(), id: d.id } as AttendanceEvent)))));

             setAllUsers([]);
             setAllAttendance([]);
             setAllLeaveRequests([]);
             setAllAdvanceRequests([]);
             setAllTasks([]);
        }

        setLoading(false);
        return () => unsubscribers.forEach(unsub => unsub());
    }, [karobUser, loading]);

    const login = async (loginId: string, password: string): Promise<User> => {
        const usersRef = collection(db, "users");
        const q = query(usersRef, where("employeeId", "==", loginId));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) throw new Error("No user found with that Login ID.");
        
        const userDoc = querySnapshot.docs[0];
        const userData = userDoc.data() as User;

        if (!userData.email) throw new Error("User document does not contain an email address.");
        
        await signInWithEmailAndPassword(auth, userData.email, password);
        return { ...userData, id: userDoc.id };
    };
    
    const logout = async () => {
        await signOut(auth);
    };

    const addNewEmployee = async (employeeData: NewEmployeePayload, password: string): Promise<User | null> => {
        const { email, employeeId, companyId, role, companyName } = employeeData;
        
        const finalEmail = email || `${employeeId}@${companyId}.karobhr.com`;
    
        const userCredential = await createUserWithEmailAndPassword(auth, finalEmail, password);
        const newUser = userCredential.user;
    
        if (newUser) {
            const newUserDocument: User = {
                id: newUser.uid,
                email: finalEmail,
                name: employeeData.name,
                employeeId: employeeData.employeeId,
                department: employeeData.department,
                role: employeeData.role,
                companyId: employeeData.companyId,
                joiningDate: employeeData.joiningDate || new Date().toISOString(),
                baseSalary: employeeData.baseSalary || 0,
                standardDailyHours: employeeData.standardDailyHours || 8,
                advances: [],
            };
    
            const batch = writeBatch(db);
            const userDocRef = doc(db, 'users', newUser.uid);
            batch.set(userDocRef, newUserDocument);
    
            const companyDocRef = doc(db, "companies", companyId);
            const companyDocSnap = await getDoc(companyDocRef);

            if (!companyDocSnap.exists() && role === 'admin') {
                batch.set(companyDocRef, {
                    companyId: companyId,
                    companyName: companyName,
                    adminUid: newUser.uid,
                    createdAt: new Date().toISOString(),
                    salaryCalculationMode: 'hourly_deduction',
                    annualLeaveEntitlement: 20,
                });
            }
    
            await batch.commit();
            
            setUser(newUser);
            setKarobUser(newUserDocument);
            
            return newUserDocument;
        }
        return null;
    };
    
    const addAnnouncement = async (title: string, content: string) => {
        if (!karobUser || karobUser.role !== 'admin' || !karobUser.companyId) {
            throw new Error("Unauthorized: Only admins can add announcements.");
        }
        const announcementsRef = collection(db, `companies/${karobUser.companyId}/announcements`);
        await addDoc(announcementsRef, {
            title,
            content,
            postedAt: Timestamp.now(),
            adminId: karobUser.id,
            adminName: karobUser.name,
        });
    };

    const addAttendanceEvent = async (location: LocationInfo): Promise<string | null> => {
        if (!karobUser || !karobUser.companyId) {
            throw new Error("User not authenticated or company not found.");
        }

        const attendanceRef = collection(db, `companies/${karobUser.companyId}/attendanceLog`);
        const q = query(attendanceRef, where('userId', '==', karobUser.id), where('status', '==', 'Checked In'));
        const querySnapshot = await getDocs(q);

        const isWithinGeofence = companySettings?.officeLocation && companySettings.officeLocation.radius
            ? calculateDistance(location.latitude, location.longitude, companySettings.officeLocation.latitude, companySettings.officeLocation.longitude) <= companySettings.officeLocation.radius
            : true; // If no geofence set, always true

        if (querySnapshot.empty) {
            // No active check-in, create a new one
            const newDocRef = await addDoc(attendanceRef, {
                userId: karobUser.id,
                employeeId: karobUser.employeeId,
                name: karobUser.name,
                type: 'check-in',
                timestamp: Timestamp.now(),
                checkInTime: new Date().toISOString(),
                status: 'Checked In',
                locationCheckIn: location,
                isWithinGeofence,
            });
            return newDocRef.id;
        } else {
            throw new Error("Already checked in.");
        }
    };

    const completeCheckout = async (docId: string, workReport: string, location: LocationInfo) => {
        if (!karobUser || !karobUser.companyId) {
            throw new Error("User not authenticated or company not found.");
        }
        const attendanceDocRef = doc(db, `companies/${karobUser.companyId}/attendanceLog`, docId);
        const attendanceDocSnap = await getDoc(attendanceDocRef);

        if (!attendanceDocSnap.exists() || attendanceDocSnap.data().status !== 'Checked In') {
            throw new Error("No active check-in found for this ID.");
        }

        const checkInTime = safeParseISO(attendanceDocSnap.data().checkInTime);
        if (!checkInTime) {
            throw new Error("Invalid check-in time recorded.");
        }
        const checkOutTime = new Date();
        const totalHours = (checkOutTime.getTime() - checkInTime.getTime()) / (1000 * 60 * 60);

        const isWithinGeofenceCheckout = companySettings?.officeLocation && companySettings.officeLocation.radius
            ? calculateDistance(location.latitude, location.longitude, companySettings.officeLocation.latitude, companySettings.officeLocation.longitude) <= companySettings.officeLocation.radius
            : true; // If no geofence set, always true

        await updateDoc(attendanceDocRef, {
            type: 'check-out',
            timestamp: Timestamp.now(),
            checkOutTime: checkOutTime.toISOString(),
            status: 'Checked Out',
            workReport,
            totalHours,
            locationCheckOut: location,
            isWithinGeofenceCheckout,
        });
    };

    const updateCompanySettings = async (settings: Partial<CompanySettings>, companyId: string) => {
        if (!karobUser || karobUser.role !== 'admin' || karobUser.companyId !== companyId) {
            throw new Error("Unauthorized to update company settings.");
        }
        const companyDocRef = doc(db, 'companies', companyId);
        await updateDoc(companyDocRef, settings);
    };

    const addTask = async (task: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>) => {
        if (!karobUser || karobUser.role !== 'admin' || !karobUser.companyId) {
            throw new Error("Unauthorized to add tasks.");
        }
        const tasksRef = collection(db, `companies/${karobUser.companyId}/tasks`);
        await addDoc(tasksRef, {
            ...task,
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now(),
        });
    };

    const updateTask = async (task: Task) => {
        if (!karobUser || karobUser.role !== 'admin' || !karobUser.companyId) {
            throw new Error("Unauthorized to update tasks.");
        }
        const taskDocRef = doc(db, `companies/${karobUser.companyId}/tasks`, task.id);
        await updateDoc(taskDocRef, {
            ...task,
            updatedAt: Timestamp.now(),
        });
    };

    const addLeaveApplication = async (leaveData: Omit<LeaveApplication, 'id' | 'userId' | 'employeeId' | 'status' | 'appliedAt'>) => {
        if (!karobUser || !karobUser.companyId) {
            throw new Error("User not authenticated or company not found.");
        }
        const leaveApplicationsRef = collection(db, `companies/${karobUser.companyId}/leaveApplications`);
        await addDoc(leaveApplicationsRef, {
            ...leaveData,
            userId: karobUser.id,
            employeeId: karobUser.employeeId,
            status: 'pending',
            appliedAt: Timestamp.now(),
        });
    };

    const approveLeaveApplication = async (applicantUid: string, leaveId: string) => {
        if (!karobUser || karobUser.role !== 'admin' || !karobUser.companyId) {
            throw new Error("Unauthorized: Only admins can approve leave applications.");
        }
        const leaveDocRef = doc(db, `companies/${karobUser.companyId}/leaveApplications`, leaveId);
        await updateDoc(leaveDocRef, { status: 'approved' });
    };

    const rejectLeaveApplication = async (applicantUid: string, leaveId: string) => {
        if (!karobUser || karobUser.role !== 'admin' || !karobUser.companyId) {
            throw new Error("Unauthorized: Only admins can reject leave applications.");
        }
        const leaveDocRef = doc(db, `companies/${karobUser.companyId}/leaveApplications`, leaveId);
        await updateDoc(leaveDocRef, { status: 'rejected' });
    };

    const requestAdvance = async (employeeId: string, amount: number, reason: string) => {
        if (!karobUser || !karobUser.companyId) {
            throw new Error("User not authenticated or company not found.");
        }
        const advancesRef = collection(db, `companies/${karobUser.companyId}/advances`);
        await addDoc(advancesRef, {
            employeeId,
            userId: karobUser.id,
            amount,
            reason,
            status: 'pending',
            dateRequested: Timestamp.now(),
        });
    };

    const approveAdvance = async (advanceId: string) => {
        if (!karobUser || karobUser.role !== 'admin' || !karobUser.companyId) {
            throw new Error("Unauthorized: Only admins can approve advances.");
        }
        const advanceDocRef = doc(db, `companies/${karobUser.companyId}/advances`, advanceId);
        await updateDoc(advanceDocRef, { status: 'approved' });
    };

    const rejectAdvance = async (advanceId: string) => {
        if (!karobUser || karobUser.role !== 'admin' || !karobUser.companyId) {
            throw new Error("Unauthorized: Only admins can reject advances.");
        }
        const advanceDocRef = doc(db, `companies/${karobUser.companyId}/advances`, advanceId);
        await updateDoc(advanceDocRef, { status: 'rejected' });
    };

    const addHoliday = async (holidayData: Omit<Holiday, 'id' | 'status'>) => {
        if (!karobUser || karobUser.role !== 'admin' || !karobUser.companyId) {
            throw new Error("Unauthorized: Only admins can add holidays.");
        }
        const holidaysRef = collection(db, `companies/${karobUser.companyId}/holidays`);
        await addDoc(holidaysRef, {
            ...holidayData,
            status: 'active', // Default status for new holidays
        });
    };

    const calculateMonthlyPayrollDetails = useCallback(
      (
        employee: User,
        year: number,
        month: number,
        employeeAttendanceForMonth: AttendanceEvent[],
        holidaysForMonth: Holiday[],
        approvedLeavesForMonth: LeaveApplication[],
        approvedAdvancesForMonth: Advance[],
      ): MonthlyPayrollReport => {
        const { baseSalary = 0, standardDailyHours = 8, employeeId, name = 'N/A' } = employee;
  
        const totalDaysInMonth = new Date(year, month + 1, 0).getDate();
        const daysInMonth = eachDayOfInterval({
          start: startOfMonth(new Date(year, month)),
          end: endOfMonth(new Date(year, month)),
        });
  
        let totalWorkingDaysInMonth = 0;
        daysInMonth.forEach((date) => {
          const isHoliday = holidaysForMonth.some(
            (h) => new Date(h.date).toDateString() === date.toDateString(),
          );
          if (!isSunday(date) && !isHoliday) {
            totalWorkingDaysInMonth++;
          }
        });
  
        const totalStandardHoursForMonth = totalWorkingDaysInMonth * standardDailyHours;
  
        const totalActualHoursWorked = employeeAttendanceForMonth
          .filter((event) => event.status === 'Checked Out' && event.totalHours)
          .reduce((sum, event) => sum + event.totalHours!, 0);
  
        const totalHoursMissed = Math.max(0, totalStandardHoursForMonth - totalActualHoursWorked);
  
        const hourlyRate =
          totalWorkingDaysInMonth > 0 ? baseSalary / totalWorkingDaysInMonth / standardDailyHours : 0;
  
        let calculatedDeductions = 0;
        if (companySettings?.salaryCalculationMode === 'hourly_deduction') {
          calculatedDeductions = totalHoursMissed * hourlyRate;
        }
  
        const salaryAfterDeductions = baseSalary - calculatedDeductions;
        const totalApprovedAdvances = approvedAdvancesForMonth.reduce(
          (sum, advance) => sum + advance.amount,
          0,
        );
        const finalNetPayable = salaryAfterDeductions - totalApprovedAdvances;
  
        return {
          employeeId,
          employeeName: name,
          month: month + 1,
          year,
          baseSalary,
          standardDailyHours,
          totalWorkingDaysInMonth,
          totalStandardHoursForMonth,
          totalActualHoursWorked,
          totalHoursMissed,
          hourlyRate,
          calculatedDeductions,
          salaryAfterDeductions,
          totalApprovedAdvances,
          finalNetPayable,
          totalDaysWorked: employeeAttendanceForMonth.filter(
            (e) => e.status === 'Checked Out' && e.totalHours && e.totalHours > 0,
          ).length,
          totalDaysInMonth,
        };
      },
      [companySettings?.salaryCalculationMode],
    );


    const calculateTodayEstimatedEarning = useCallback((
        employee: User,
        todaysAttendance: AttendanceEvent[],
        liveAttendanceEvent: AttendanceEvent | null,
        companySettings: CompanySettings | null
      ): number => {
        if (!employee.baseSalary || !companySettings || !employee.standardDailyHours) {
            return 0;
        }
    
        const isCheckedIn = liveAttendanceEvent != null;
        const hasWorkedToday = isCheckedIn || (todaysAttendance?.some(e => isToday(safeParseISO(e.timestamp)!) && e.status === 'Checked Out'));
    
        if (companySettings.salaryCalculationMode === 'check_in_out') {
            return hasWorkedToday ? employee.baseSalary / 30 : 0;
        } else {
            const totalMinutesWorkedToday = todaysAttendance.filter(e => e.status === 'Checked Out' && isToday(safeParseISO(e.timestamp)!))
                .reduce((total, event) => total + (event.totalHours ? event.totalHours * 60 : 0), 0);
            
            let liveMinutes = 0;
            if (liveAttendanceEvent) {
                const checkInTime = safeParseISO(liveAttendanceEvent.checkInTime || liveAttendanceEvent.timestamp);
                if (checkInTime) {
                    liveMinutes = differenceInSeconds(new Date(), checkInTime) / 60;
                }
            }
            const overallMinutesWorked = totalMinutesWorkedToday + liveMinutes;
            const perMinuteRate = employee.baseSalary / (30 * employee.standardDailyHours * 60);
            return overallMinutesWorked * perMinuteRate;
        }
      }, []);

    const runAutoCheckout = async (): Promise<number> => {
        if (!karobUser || karobUser.role !== 'admin' || !karobUser.companyId) {
            console.log("Auto-checkout condition not met (not an admin or no companyId).");
            return 0;
        }

        const yesterday = subDays(new Date(), 1);
        const startOfYesterday = startOfDay(yesterday);
        const endOfYesterday = endOfDay(yesterday);

        const attendanceRef = collection(db, `companies/${karobUser.companyId}/attendanceLog`);
        const q = query(
            attendanceRef,
            where('status', '==', 'Checked In'),
            where('timestamp', '>=', Timestamp.fromDate(startOfYesterday)),
            where('timestamp', '<=', Timestamp.fromDate(endOfYesterday))
        );

        const snapshot = await getDocs(q);
        if (snapshot.empty) {
            return 0;
        }

        const batch = writeBatch(db);
        snapshot.forEach(docSnap => {
            const event = docSnap.data() as AttendanceEvent;
            const employee = allUsers.find(u => u.id === event.userId);
            const standardHours = employee?.standardDailyHours || 8;
            
            let checkInTime = new Date(event.checkInTime!);
            let checkOutTime = setHours(checkInTime, checkInTime.getHours() + standardHours);
            // Cap checkout time at the end of the day
            if (checkOutTime > endOfYesterday) {
                checkOutTime = endOfYesterday;
            }

            const totalHours = (checkOutTime.getTime() - checkInTime.getTime()) / (1000 * 60 * 60);

            batch.update(docSnap.ref, {
                status: 'Checked Out',
                type: 'check-out',
                checkOutTime: checkOutTime.toISOString(),
                workReport: 'System: Automatically checked out.',
                totalHours: totalHours
            });
        });

        await batch.commit();
        return snapshot.size;
    };

    const updateEmployeeDetails = async (userId: string, updates: Partial<User>) => {
        if (!karobUser || karobUser.role !== 'admin' || !karobUser.companyId) {
            throw new Error("Unauthorized: Only admins can update employee details.");
        }
        const userDocRef = doc(db, 'users', userId);
        await updateDoc(userDocRef, updates);
        
        // If the updated user is the currently logged-in karobUser, update the state
        if (karobUser.id === userId) {
            setKarobUser((prevUser) => ({ ...prevUser!, ...updates }));
        }
    };

    const updateUserPassword = async (userId: string, newPassword: string) => {
        if (!karobUser || karobUser.role !== 'admin' || !karobUser.companyId) {
            throw new Error("Unauthorized: Only admins can update employee passwords.");
        }

        // Find the FirebaseUser object for the target userId
        // This is a simplification. In a real app, you'd likely use Cloud Functions
        // or re-authenticate the admin user with elevated privileges to update another user's password.
        // Direct client-side updatePassword only works for the currently authenticated user.
        // For demonstration, we'll assume the admin is trying to update their own password
        // or this function is called from a secure server environment.
        const targetUser = auth.currentUser; 

        if (targetUser && targetUser.uid === userId) {
            await updatePassword(targetUser, newPassword);
        } else {
            throw new Error("Cannot update another user's password directly from client-side. Please use appropriate re-authentication or server-side logic.");
        }
    };

    const value: AuthContextType = {
        user,
        karobUser,
        role: karobUser?.role || null,
        companyId: karobUser?.companyId || null,
        companySettings,
        loading,
        login,
        logout,
        addNewEmployee,
        addAnnouncement,
        addAttendanceEvent,
        completeCheckout,
        updateCompanySettings,
        addTask,
        updateTask,
        addLeaveApplication,
        approveLeaveApplication,
        rejectLeaveApplication,
        requestAdvance,
        approveAdvance,
        rejectAdvance,
        addHoliday,
        calculateMonthlyPayrollDetails,
        calculateTodayEstimatedEarning,
        runAutoCheckout,
        updateEmployeeDetails,
        updateUserPassword,
        allUsers,
        announcements,
        holidays,
        attendanceLog: karobUser?.role === 'admin' ? allAttendance : userAttendance,
        allTasks,
        userTasks,
        leaveRequests: karobUser?.role === 'admin' ? allLeaveRequests : userLeaveRequests,
        advanceRequests: karobUser?.role === 'admin' ? allAdvanceRequests : userAdvances,
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
}
