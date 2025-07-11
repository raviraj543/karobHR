
"use client";

import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { auth, db } from '@/lib/firebase/firebase';
import { onAuthStateChanged, User as FirebaseUser, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, collection, query, where, getDocs, orderBy, onSnapshot, addDoc, writeBatch } from 'firebase/firestore';
import type { CompanySettings, User, Task, AttendanceEvent, Announcement, LeaveApplication, Advance, NewEmployeeData, LocationInfo, MonthlyPayrollReport, Holiday, SalaryCalculationMode } from '@/lib/types';
import { v4 as uuidv4 } from 'uuid';
import { getWorkingDaysInMonth, isSunday, formatHoursAndMinutes, formatDuration } from '@/lib/dateUtils';


// Redefined NewEmployeeData to be more specific for clarity
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
    updateCompanySettings: (settings: Partial<CompanySettings>) => Promise<void>;
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
        holidaysForMonth: Holiday[]
    ) => MonthlyPayrollReport;
    // Admin-specific data
    allUsers: User[];
    attendanceLog: AttendanceEvent[]; // For admin view
    tasks: Task[]; // For admin view
    announcements: Announcement[];
    holidays: Holiday[];
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
    
    // Admin-specific data slices
    const [allUsers, setAllUsers] = useState<User[]>([]);
    const [allAttendance, setAllAttendance] = useState<AttendanceEvent[]>([]);
    const [allTasks, setAllTasks] = useState<Task[]>([]);

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

                    if (userData.companyId) {
                        const companyDocRef = doc(db, 'companies', userData.companyId);
                        
                        // Set up a listener for real-time updates on company settings.
                        // The onSnapshot will also provide the initial data.
                        const companyUnsubscribe = onSnapshot(companyDocRef, (companySnap) => {
                            const settings = companySnap.exists() ? (companySnap.data() as CompanySettings) : null;
                            setCompanySettings(settings);
                            // Set loading to false only after we get the first snapshot of company data
                            setLoading(false); 
                        });

                        const announcementsRef = collection(db, `companies/${userData.companyId}/announcements`);
                        onSnapshot(query(announcementsRef, orderBy('postedAt', 'desc')), (snap) => {
                            setAnnouncements(snap.docs.map(d => ({ ...d.data(), id: d.id } as Announcement)));
                        });
                        
                        const holidaysRef = collection(db, `companies/${userData.companyId}/holidays`);
                        onSnapshot(query(holidaysRef, orderBy('date', 'asc')), (snap) => {
                             setHolidays(snap.docs.map(d => ({ ...d.data(), id: d.id, date: (d.data().date as any).toDate() } as Holiday)));
                        });

                        if (userData.role === 'admin') {
                            const usersRef = collection(db, 'users');
                            onSnapshot(query(usersRef, where('companyId', '==', userData.companyId)), (snap) => {
                                setAllUsers(snap.docs.map(d => ({ ...d.data(), id: d.id } as User)));
                            });
                            
                            const attendanceRef = collection(db, `companies/${userData.companyId}/attendanceLog`);
                            onSnapshot(query(attendanceRef, orderBy('timestamp', 'desc')), (snap) => {
                                setAllAttendance(snap.docs.map(d => ({ ...d.data(), id: d.id } as AttendanceEvent)));
                            });
                            
                            const tasksRef = collection(db, `companies/${userData.companyId}/tasks`);
                            onSnapshot(query(tasksRef, orderBy('createdAt', 'desc')), (snap) => {
                                setAllTasks(snap.docs.map(d => ({ ...d.data(), id: d.id } as Task)));
                            });
                        }
                        
                        // Return a cleanup function for the company listener
                        return () => companyUnsubscribe();
                    } else {
                        setCompanySettings(null);
                        setLoading(false); // No companyId, so we can stop loading.
                    }
                } else {
                    await signOut(auth); // User in Auth but not Firestore, sign out.
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
                setLoading(false);
            }
        });
        return () => unsubscribe();
    }, []);

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
        const { email, employeeId, companyId, role, companyName } = employeeData;
        
        // Ensure we have the company name, fetching if necessary
        let finalCompanyName = companyName;
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
                leaves: [],
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
                    salaryCalculationMode: 'hourly_deduction',
                } as CompanySettings);
            }
    
            await batch.commit();
            return newUserDocument;
        }
        return null;
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
            const dist = Math.sqrt(
                Math.pow(location.latitude - companySettings.officeLocation.latitude, 2) +
                Math.pow(location.longitude - companySettings.officeLocation.longitude, 2)
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
             const dist = Math.sqrt(
                Math.pow(location.latitude - companySettings.officeLocation.latitude, 2) +
                Math.pow(location.longitude - companySettings.officeLocation.longitude, 2)
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

    const updateCompanySettings = async (settings: Partial<CompanySettings>) => {
        if (!karobUser?.companyId) throw new Error("No company associated with user.");
        const companyRef = doc(db, 'companies', karobUser.companyId);
        await updateDoc(companyRef, settings);
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
        if (!karobUser) throw new Error("User not found.");
        const userDocRef = doc(db, 'users', karobUser.id);
        const newLeave: Omit<LeaveApplication, 'id'> = {
            ...leaveData,
            userId: karobUser.id,
            employeeId: karobUser.employeeId,
            status: 'pending',
            appliedAt: new Date().toISOString(),
        };
        await updateDoc(userDocRef, {
            leaves: [...(karobUser.leaves || []), { ...newLeave, id: uuidv4() }]
        });
    };

    const approveLeaveApplication = async (applicantUid: string, leaveId: string) => {
        const userRef = doc(db, 'users', applicantUid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
            const applicant = userSnap.data() as User;
            const updatedLeaves = (applicant.leaves || []).map(l => l.id === leaveId ? { ...l, status: 'approved' } : l);
            await updateDoc(userRef, { leaves: updatedLeaves });
        }
    };
    
    const rejectLeaveApplication = async (applicantUid: string, leaveId: string) => {
        const userRef = doc(db, 'users', applicantUid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
            const applicant = userSnap.data() as User;
            const updatedLeaves = (applicant.leaves || []).map(l => l.id === leaveId ? { ...l, status: 'rejected' } : l);
            await updateDoc(userRef, { leaves: updatedLeaves });
        }
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
        holidaysForMonth: Holiday[]
    ): MonthlyPayrollReport => {
        
        const baseSalary = employee.baseSalary || 0;
        const standardDailyHours = employee.standardDailyHours || 8;
        
        const holidaysInThisMonth = holidaysForMonth
            .filter(h => h.date.getFullYear() === year && h.date.getMonth() === month)
            .map(h => h.date.getDate());
        
        const workingDaysInMonth = getWorkingDaysInMonth(year, month, holidaysForMonth);
        const totalStandardHoursForMonth = workingDaysInMonth * standardDailyHours;

        let totalActualHoursWorked = 0;
        employeeAttendanceForMonth.forEach(log => {
            if (log.checkOutTime && new Date(log.checkOutTime).getMonth() === month) {
                totalActualHoursWorked += log.totalHours || 0;
            }
        });

        const hourlyRate = totalStandardHoursForMonth > 0 ? baseSalary / totalStandardHoursForMonth : 0;
        const totalHoursMissed = Math.max(0, totalStandardHoursForMonth - totalActualHoursWorked);
        
        const calculatedDeductions = companySettings?.salaryCalculationMode === 'check_in_out' 
            ? 0 // Logic for check-in based should be handled differently, simplified for now
            : totalHoursMissed * hourlyRate;
            
        const salaryAfterDeductions = baseSalary - calculatedDeductions;

        const totalApprovedAdvances = (employee.advances || [])
            .filter(adv => adv.status === 'approved' && new Date(adv.dateProcessed!).getMonth() === month)
            .reduce((sum, adv) => sum + adv.amount, 0);
            
        const finalNetPayable = salaryAfterDeductions - totalApprovedAdvances;
        
        return {
            employeeId: employee.employeeId,
            employeeName: employee.name || 'N/A',
            month,
            year,
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
            finalNetPayable: Math.max(0, finalNetPayable)
        };

    }, [companySettings]);


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
        allUsers,
        announcements,
        holidays,
        attendanceLog: allAttendance,
        tasks: allTasks,
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
}

export const useAuth = (): AuthContextType => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};

