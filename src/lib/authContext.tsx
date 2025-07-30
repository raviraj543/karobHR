
"use client";

import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { auth, db } from '@/lib/firebase/firebase';
import { onAuthStateChanged, User as FirebaseUser, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, collection, query, where, getDocs, orderBy, onSnapshot, addDoc, writeBatch } from 'firebase/firestore';
import type { CompanySettings, User, Task, AttendanceEvent, Announcement, LeaveApplication, Advance, LocationInfo, MonthlyPayrollReport, Holiday, SalaryCalculationMode } from '@/lib/app-types';
import { v4 as uuidv4 } from 'uuid';
import { getWorkingDaysInMonth, isSunday, formatHoursAndMinutes, formatDuration } from '@/lib/dateUtils';
import { calculateDistance } from './locationUtils';
import { isToday, differenceInSeconds } from 'date-fns';


// Redefined NewEmployeeData to be more specific for clarity
export interface NewEmployeePayload { // Added export here
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
    updateEmployeeDetails: (payload: { employeeUid: string, newSalary?: number, newPassword?: string }) => Promise<void>;
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
    // Admin-specific data
    allUsers: User[];
    attendanceLog: AttendanceEvent[]; 
    allTasks: Task[]; // Renamed for clarity, all tasks for admin
    userTasks: Task[]; // Tasks specific to the logged-in user
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

    // App-wide data slices
    const [announcements, setAnnouncements] = useState<Announcement[]>([]);
    const [holidays, setHolidays] = useState<Holiday[]>([]);
    const [userTasks, setUserTasks] = useState<Task[]>([]);
    const [userLeaveRequests, setUserLeaveRequests] = useState<LeaveApplication[]>([]);
    const [userAdvances, setUserAdvances] = useState<Advance[]>([]);
    const [userAttendance, setUserAttendance] = useState<AttendanceEvent[]>([]);
    
    // Admin-specific data slices
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

    // Effect to fetch company-wide and role-specific data *after* karobUser is set
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

        // --- GLOBAL LISTENERS (for all roles) ---
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

        // --- ROLE-BASED LISTENERS ---
        if (karobUser.role === 'admin') {
            const usersRef = collection(db, 'users');
            unsubscribers.push(onSnapshot(query(usersRef, where('companyId', '==', companyId)), (snap) => setAllUsers(snap.docs.map(d => ({ ...d.data(), id: d.id } as User)))));
            unsubscribers.push(onSnapshot(query(attendanceRef, orderBy('timestamp', 'desc')), (snap) => setAllAttendance(snap.docs.map(d => ({ ...d.data(), id: d.id } as AttendanceEvent)))));
            unsubscribers.push(onSnapshot(query(tasksRef, orderBy('createdAt', 'desc')), (snap) => setAllTasks(snap.docs.map(d => ({ ...d.data(), id: d.id } as Task)))));
            unsubscribers.push(onSnapshot(query(advancesRef, orderBy('dateRequested', 'desc')), (snap) => setAllAdvanceRequests(snap.docs.map(d => ({...d.data(), id: d.id } as Advance)))));
            unsubscribers.push(onSnapshot(query(leaveRequestsRef, orderBy('appliedAt', 'desc')), (snap) => setAllLeaveRequests(snap.docs.map(d => ({...d.data(), id: d.id } as LeaveApplication)))));
            
            // Clear user-specific data for admin
            setUserTasks([]); 
            setUserLeaveRequests([]);
            setUserAdvances([]);
            setUserAttendance([]);

        } else { // For 'employee' and 'manager'
            const userTasksQuery = query(tasksRef, where('assigneeId', '==', karobUser.employeeId || ''), orderBy('createdAt', 'desc'));
            unsubscribers.push(onSnapshot(userTasksQuery, (snap) => setUserTasks(snap.docs.map(d => ({ ...d.data(), id: d.id } as Task)))));

            const userLeaveRequestsQuery = query(leaveRequestsRef, where('userId', '==', karobUser.id), orderBy('appliedAt', 'desc'));
            unsubscribers.push(onSnapshot(userLeaveRequestsQuery, (snap) => setUserLeaveRequests(snap.docs.map(d => ({...d.data(), id: d.id} as LeaveApplication)))));
            
            const userAdvancesQuery = query(advancesRef, where('employeeId', '==', karobUser.employeeId || ''), orderBy('dateRequested', 'desc'));
            unsubscribers.push(onSnapshot(userAdvancesQuery, (snap) => setUserAdvances(snap.docs.map(d => ({...d.data(), id: d.id } as Advance)))));

            const userAttendanceQuery = query(attendanceRef, where('userId', '==', karobUser.id), orderBy('timestamp', 'desc'));
            unsubscribers.push(onSnapshot(userAttendanceQuery, (snap) => setUserAttendance(snap.docs.map(d => ({...d.data(), id: d.id } as AttendanceEvent)))));

             // Clear admin-specific states for non-admins
             setAllUsers([]);
             setAllAttendance([]);
             setAllLeaveRequests([]);
             setAllAdvanceRequests([]);
             setAllTasks([]);
        }

        setLoading(false);

        return () => {
            unsubscribers.forEach(unsub => unsub());
        };

    }, [karobUser, loading]); // Added loading to dependency array to re-run effect when loading state changes

    const login = async (loginId: string, password: string): Promise<User> => {
        const usersRef = collection(db, "users");
        const q = query(usersRef, where("employeeId", "==", loginId));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            throw new Error("No user found with that Login ID.");
        }
        const userDoc = querySnapshot.docs[0];
        const userData = userDoc.data() as User;

        if (!userData.email) {
            throw new Error("User document does not contain an email address.");
        }
        await signInWithEmailAndPassword(auth, userData.email, password);
        return { ...userData, id: userDoc.id };
    };
    
    const logout = async () => {
        await signOut(auth);
    };

    const addNewEmployee = async (employeeData: NewEmployeePayload, password: string): Promise<User | null> => {
        const { email, employeeId, companyId, role } = employeeData;
        
        let finalCompanyName = employeeData.companyName;
        if (!finalCompanyName && companyId) {
            const companyDocRef = doc(db, "companies", companyId);
            const companyDocSnap = await getDoc(companyDocRef);
            if (companyDocSnap.exists()) {
                finalCompanyName = companyDocSnap.data().companyName;
            } else if (role !== 'admin') {
                 throw new Error("Cannot add employee: Company does not exist.");
            }
        }

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
                    companyName: finalCompanyName,
                    adminUid: newUser.uid,
                    createdAt: new Date().toISOString(),
                    officeHours: { openingTime: '09:00', closingTime: '18:00'},
                    salaryCalculationMode: 'hourly_deduction',
                    annualLeaveEntitlement: 20,
                });
            }
    
            await batch.commit();
            
            // Manually update state to prevent race condition on signup
            setUser(newUser);
            setKarobUser(newUserDocument);
            
            return newUserDocument;
        }
        return null;
    };
    
    const updateEmployeeDetails = async (payload: { employeeUid: string, newSalary?: number, newPassword?: string }) => {
        if (!auth.currentUser) {
            throw new Error("Admin not authenticated.");
        }
        const token = await auth.currentUser.getIdToken(true);

        const response = await fetch('/api/update-employee', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to update employee details.');
        }
    };

    const addAnnouncement = async (title: string, content: string) => {
        if (!karobUser || !karobUser.companyId) throw new Error("User or company not found.");
        const announcement: Omit<Announcement, 'id'> = {
            title,
            content,
            postedByUid: karobUser.id,
            postedByName: karobUser.name || karobUser.employeeId,
            postedAt: new Date().toISOString(),
        };
        await addDoc(collection(db, `companies/${karobUser.companyId}/announcements`), announcement);
    };

    const addAttendanceEvent = async (location: LocationInfo) => {
        if (!karobUser || !karobUser.companyId || !companySettings) return null;
        
        let isWithin = null;
        if(companySettings.officeLocation && companySettings.officeLocation.latitude && companySettings.officeLocation.longitude) {
            const dist = calculateDistance(
                location.latitude,
                location.longitude,
                companySettings.officeLocation.latitude,
                companySettings.officeLocation.longitude
            );
            isWithin = dist <= (companySettings.officeLocation.radius || 100);
        }

        const newEvent: Omit<AttendanceEvent, 'id'> = {
            userId: karobUser.id,
            employeeId: karobUser.employeeId,
            userName: karobUser.name || karobUser.employeeId,
            type: 'check-in',
            status: 'Checked In',
            timestamp: new Date().toISOString(),
            checkInTime: new Date().toISOString(),
            checkInLocation: location,
            isWithinGeofence: isWithin,
            checkOutTime: null,
            checkOutLocation: null,
            workReport: null,
            totalHours: 0,
        };
        const docRef = await addDoc(collection(db, `companies/${karobUser.companyId}/attendanceLog`), newEvent);
        return docRef.id;
    };

    const completeCheckout = async (docId: string, workReport: string, location: LocationInfo) => {
        if (!karobUser || !karobUser.companyId || !companySettings) return;

        const eventRef = doc(db, `companies/${karobUser.companyId}/attendanceLog`, docId);
        const eventSnap = await getDoc(eventRef);
        if (!eventSnap.exists()) throw new Error("Check-in record not found.");

        const checkInData = eventSnap.data() as AttendanceEvent;
        const checkInTime = new Date(checkInData.checkInTime!);
        const checkOutTime = new Date();
        const totalHours = (checkOutTime.getTime() - checkInTime.getTime()) / (1000 * 60 * 60);

        let isWithin = null;
        if (companySettings.officeLocation && companySettings.officeLocation.latitude && companySettings.officeLocation.longitude) {
             const dist = calculateDistance(
                location.latitude,
                location.longitude,
                companySettings.officeLocation.latitude,
                companySettings.officeLocation.longitude
            );
            isWithin = dist <= (companySettings.officeLocation.radius || 100);
        }
        
        await updateDoc(eventRef, {
            type: 'check-out',
            status: 'Checked Out',
            checkOutTime: checkOutTime.toISOString(),
            checkOutLocation: location,
            isWithinGeofenceCheckout: isWithin,
            workReport,
            totalHours,
        });
    };

    const updateCompanySettings = async (settings: Partial<CompanySettings>, companyId: string) => {
        if (!companyId) throw new Error("No company ID provided to update settings.");
        const companyRef = doc(db, 'companies', companyId);
        await setDoc(companyRef, settings, { merge: true });
    };

    const addTask = async (taskData: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>) => {
        if (!karobUser?.companyId) throw new Error("No company associated with user.");
        const task: Omit<Task, 'id'> = {
            ...taskData,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };
        await addDoc(collection(db, `companies/${karobUser.companyId}/tasks`), task);
    };

    const updateTask = async (task: Task) => {
        if (!karobUser?.companyId) throw new Error("No company associated with user.");
        const taskRef = doc(db, `companies/${karobUser.companyId}/tasks`, task.id);
        await updateDoc(taskRef, { ...task, updatedAt: new Date().toISOString() });
    };
    
    const addLeaveApplication = async (leaveData: Omit<LeaveApplication, 'id' | 'userId' | 'employeeId' | 'status' | 'appliedAt'>) => {
        if (!karobUser || !karobUser.companyId) throw new Error("User or company not found.");
        const newLeave: Omit<LeaveApplication, 'id'> = {
            ...leaveData,
            userId: karobUser.id,
            employeeId: karobUser.employeeId,
            status: 'pending',
            appliedAt: new Date().toISOString(),
        };
        await addDoc(collection(db, `companies/${karobUser.companyId}/leaveApplications`), newLeave);
    };

    const approveLeaveApplication = async (applicantUid: string, leaveId: string) => {
        if (!karobUser?.companyId) throw new Error("No company associated with user.");
        const leaveRef = doc(db, `companies/${karobUser.companyId}/leaveApplications`, leaveId);
        await updateDoc(leaveRef, { status: 'approved' });
    };
    
    const rejectLeaveApplication = async (applicantUid: string, leaveId: string) => {
        if (!karobUser?.companyId) throw new Error("No company associated with user.");
        const leaveRef = doc(db, `companies/${karobUser.companyId}/leaveApplications`, leaveId);
        await updateDoc(leaveRef, { status: 'rejected' });
    };

    const requestAdvance = async (employeeId: string, amount: number, reason: string) => {
        if (!karobUser || !karobUser.companyId) throw new Error("User or company not found.");
        const newAdvance: Omit<Advance, 'id'> = {
            employeeId: karobUser.employeeId,
            amount,
            reason,
            dateRequested: new Date().toISOString(),
            status: 'pending',
        };
        await addDoc(collection(db, `companies/${karobUser.companyId}/advances`), newAdvance);
    };
    
    const approveAdvance = async (advanceId: string) => {
        if (!karobUser?.companyId) throw new Error("No company associated with user.");
        const advanceRef = doc(db, `companies/${karobUser.companyId}/advances`, advanceId);
        await updateDoc(advanceRef, { status: 'approved', dateProcessed: new Date().toISOString() });
    };

    const rejectAdvance = async (advanceId: string) => {
        if (!karobUser?.companyId) throw new Error("No company associated with user.");
        const advanceRef = doc(db, `companies/${karobUser.companyId}/advances`, advanceId);
        await updateDoc(advanceRef, { status: 'rejected', dateProcessed: new Date().toISOString() });
    };

    const addHoliday = async (holidayData: Omit<Holiday, 'id' | 'status'>) => {
        if (!karobUser?.companyId) throw new Error("No company associated with user.");
        const holiday: Omit<Holiday, 'id'> = {
            ...holidayData,
            status: 'approved',
        };
        await addDoc(collection(db, `companies/${karobUser.companyId}/holidays`), holiday);
    };

    const calculateMonthlyPayrollDetails = useCallback((
        employee: User,
        year: number,
        month: number, // 0-11
        employeeAttendanceForMonth: AttendanceEvent[],
        holidaysForMonth: Holiday[],
        approvedLeavesForMonth: LeaveApplication[] = [],
        approvedAdvancesForMonth: Advance[] = []
    ): MonthlyPayrollReport => {
    
        const calculationMode = companySettings?.salaryCalculationMode || 'hourly_deduction';
        const baseSalary = employee.baseSalary || 0;
        const standardDailyHours = employee.standardDailyHours || 8;
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        
        const today = new Date();
        today.setHours(0, 0, 0, 0);
    
        const allHolidayDates = new Set<number>();
        holidaysForMonth
            .filter(h => h.date.getFullYear() === year && h.date.getMonth() === month)
            .forEach(h => allHolidayDates.add(h.date.getDate()));
    
        for (let day = 1; day <= daysInMonth; day++) {
            const currentDate = new Date(year, month, day);
            if (isSunday(currentDate)) {
                allHolidayDates.add(day);
            }
        }
    
        const attendanceByDay = new Map<number, { minutes: number; checkedInAndOut: boolean }>();
        employeeAttendanceForMonth.forEach(log => {
            if (log.checkInTime && log.checkOutTime) {
                const checkInDate = new Date(log.checkInTime);
                if (checkInDate.getFullYear() === year && checkInDate.getMonth() === month) {
                    const dayOfMonth = checkInDate.getDate();
                    if (allHolidayDates.has(dayOfMonth)) return;
                    
                    const minutesWorked = (new Date(log.checkOutTime).getTime() - checkInDate.getTime()) / (1000 * 60);
                    const existingEntry = attendanceByDay.get(dayOfMonth) || { minutes: 0, checkedInAndOut: false };
                    attendanceByDay.set(dayOfMonth, {
                        minutes: existingEntry.minutes + minutesWorked,
                        checkedInAndOut: true,
                    });
                }
            }
        });
    
        let calculatedSalary = 0;
        let totalWorkedMinutes = 0;
        let holidayHoursCredit = 0;
        let pastHolidaysCount = 0;
        let totalDaysWorked = 0;
    
        allHolidayDates.forEach(day => {
            const holidayDate = new Date(year, month, day);
            if (holidayDate.getTime() < today.getTime()) {
                pastHolidaysCount++;
                holidayHoursCredit += standardDailyHours;
            }
        });
    
        if (calculationMode === 'hourly_deduction') {
            const workingDaysInMonth = daysInMonth - allHolidayDates.size;
            const monthlyWorkHoursGoal = workingDaysInMonth * standardDailyHours;
            const perMinuteSalary = monthlyWorkHoursGoal > 0 ? baseSalary / (monthlyWorkHoursGoal * 60) : 0;
    
            attendanceByDay.forEach(entry => {
                totalWorkedMinutes += entry.minutes;
            });
            
            const workedSalary = totalWorkedMinutes * perMinuteSalary;
            const holidaySalary = (holidayHoursCredit * 60) * perMinuteSalary;
            calculatedSalary = workedSalary + holidaySalary;
    
        } else { // 'check_in_out' mode
            const dailyRate = baseSalary / daysInMonth;
            let checkedInAndOutDays = 0;
            attendanceByDay.forEach(entry => {
                if(entry.checkedInAndOut) {
                    checkedInAndOutDays++;
                }
                totalWorkedMinutes += entry.minutes;
            });
            
            totalDaysWorked = checkedInAndOutDays + pastHolidaysCount;
            const unpaidLeaveDays = approvedLeavesForMonth.length;
            const deductions = unpaidLeaveDays * dailyRate;
            
            const workedSalary = checkedInAndOutDays * dailyRate;
            const holidaySalary = pastHolidaysCount * dailyRate;
            calculatedSalary = (workedSalary + holidaySalary) - deductions;
        }
    
        const totalActualHoursWorked = (totalWorkedMinutes / 60) + holidayHoursCredit;
        const totalWorkingDaysInMonth = daysInMonth - allHolidayDates.size;
        const totalStandardHoursForMonth = totalWorkingDaysInMonth * standardDailyHours;
    
        const salaryAfterDeductions = Math.min(calculatedSalary, baseSalary);
    
        const totalApprovedAdvances = approvedAdvancesForMonth.reduce((sum, adv) => sum + adv.amount, 0);
    
        const finalNetPayable = salaryAfterDeductions - totalApprovedAdvances;
    
        return {
            employeeId: employee.employeeId,
            employeeName: employee.name || 'N/A',
            month,
            year,
            baseSalary,
            standardDailyHours,
            totalWorkingDaysInMonth,
            totalStandardHoursForMonth,
            totalActualHoursWorked,
            totalHoursMissed: Math.max(0, totalStandardHoursForMonth - totalActualHoursWorked),
            hourlyRate: totalStandardHoursForMonth > 0 ? baseSalary / totalStandardHoursForMonth : 0,
            calculatedDeductions: baseSalary - salaryAfterDeductions,
            salaryAfterDeductions,
            totalApprovedAdvances,
            finalNetPayable: Math.max(0, finalNetPayable),
            totalDaysWorked,
            totalDaysInMonth: daysInMonth,
        };
    
    }, [companySettings]);

    const calculateTodayEstimatedEarning = useCallback((
        employee: User,
        todaysAttendance: AttendanceEvent[],
        liveAttendanceEvent: AttendanceEvent | null,
        companySettings: CompanySettings | null
      ): number => {
        if (!employee?.baseSalary || !companySettings || !employee.standardDailyHours) {
          return 0;
        }
      
        const { salaryCalculationMode, annualLeaveEntitlement } = companySettings;
        const baseSalary = employee.baseSalary;
        const standardDailyHours = employee.standardDailyHours;
      
        const hasCheckedInOrOutToday = liveAttendanceEvent != null || todaysAttendance.some(e => e.status === 'Checked Out');
      
        if (salaryCalculationMode === 'check_in_out') {
          return hasCheckedInOrOutToday ? baseSalary / 30 : 0;
        } else { // hourly_deduction
          const liveDurationSeconds = liveAttendanceEvent
            ? differenceInSeconds(new Date(), new Date(liveAttendanceEvent.checkInTime!))
            : 0;
      
          const completedMinutesToday = todaysAttendance
            .filter(e => e.status === 'Checked Out' && e.totalHours)
            .reduce((total, event) => total + (event.totalHours! * 60), 0);
      
          const totalMinutesWorkedToday = completedMinutesToday + (liveDurationSeconds / 60);
          const perMinuteRate = baseSalary / (30 * standardDailyHours * 60);
          
          return totalMinutesWorkedToday * perMinuteRate;
        }
      }, []);


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
        updateEmployeeDetails,
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
