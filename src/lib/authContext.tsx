"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { auth, db } from '@/lib/firebase/firebase';
import { onAuthStateChanged, User, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import * as firestore from 'firebase/firestore'; // Corrected: Used 'as' keyword
import type { CompanySettings, Employee, Task, AttendanceEvent, Announcement, LeaveRequest, AdvanceRequest } from '@/lib/types';

export interface NewEmployeeData {
    name: string;
    employeeId: string;
    email?: string;
    department: string;
    role: string;
    companyId: string;
    companyName: string;
    joiningDate: string;
    baseSalary: number;
}

interface AuthContextProps {
    user: User | null | undefined;
    loading: boolean;
    login: (loginId: string, password: string) => Promise<void>;
    addNewEmployee: (employeeData: NewEmployeeData, password: string) => Promise<void>;
    role: string | null;
    announcements: Announcement[] | null;
    attendanceLog: AttendanceEvent[] | null;
    tasks: Task[] | null;
    companySettings: CompanySettings | null;
    karobUser: Employee | null; 
}

export const AuthContext = createContext<AuthContextProps>({
    user: undefined,
    loading: true,
    login: async () => {},
    addNewEmployee: async () => {}, 
    role: null,
    announcements: null,
    attendanceLog: null,
    tasks: null,
    companySettings: null,
    karobUser: null,
});

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [userRole, setUserRole] = useState<string | null>(null);
    const [announcements, setAnnouncements] = useState<Announcement[] | null>(null);
    const [attendanceLog, setAttendanceLog] = useState<AttendanceEvent[] | null>(null);
    const [tasks, setTasks] = useState<Task[] | null>(null);
    const [companySettings, setCompanySettings] = useState<CompanySettings | null>(null);
    const [karobUser, setKarobUser] = useState<Employee | null>(null);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
            setLoading(true); 
            if (firebaseUser) {
                const userDocRef = firestore.doc(db, 'users', firebaseUser.uid);
                const userDoc = await firestore.getDoc(userDocRef);

                if (userDoc.exists()) {
                    const userData = userDoc.data() as Employee; 
                    setUser(firebaseUser);
                    setKarobUser(userData);
                    setUserRole(userData.role || null);

                    if (userData.companyId) {
                        const settingsRef = firestore.doc(db, 'companies', userData.companyId);
                        const settingsDoc = await firestore.getDoc(settingsRef);
                        if (settingsDoc.exists()) {
                            setCompanySettings(settingsDoc.data() as CompanySettings);
                        }

                        const announcementsRef = firestore.collection(db, 'companies', userData.companyId, 'announcements');
                        const annSnapshot = await firestore.getDocs(firestore.query(announcementsRef, firestore.orderBy('postedAt', 'desc')));
                        setAnnouncements(annSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Announcement[]);
                    }
                    
                    const attendanceRef = firestore.collection(db, 'attendanceLog');
                    const attSnapshot = await firestore.getDocs(firestore.query(attendanceRef, firestore.where('userId', '==', firebaseUser.uid), firestore.orderBy('timestamp', 'desc')));
                    setAttendanceLog(attSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as AttendanceEvent[]);

                    const tasksRef = firestore.collection(db, 'tasks');
                    const tasksSnapshot = await firestore.getDocs(firestore.query(tasksRef, firestore.where('assigneeId', '==', userData.employeeId), firestore.orderBy('createdAt', 'desc')));
                    setTasks(tasksSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Task[]);

                } else {
                    setUser(firebaseUser);
                    setKarobUser(null);
                    setUserRole(null);
                    console.warn("User exists in Auth but corresponding Firestore document not found immediately.");
                }
            } else {
                setUser(null);
                setKarobUser(null);
                setUserRole(null);
                setAnnouncements(null);
                setAttendanceLog(null);
                setTasks(null);
                setCompanySettings(null);
            }
            setLoading(false); 
        });

        return () => unsubscribe();
    }, []);

    const login = async (loginId: string, password: string) => {
        const usersRef = firestore.collection(db, "users");
        const q = firestore.query(usersRef, firestore.where("employeeId", "==", loginId));
        const querySnapshot = await firestore.getDocs(q);

        if (querySnapshot.empty) {
            console.error("No user found with that Login ID.");
            throw new Error("No user found with that Login ID.");
        }

        const userDoc = querySnapshot.docs[0];
        const userData = userDoc.data();
        const email = userData.email;

        if (!email) {
            console.error("User document does not contain an email address.");
            throw new Error("User document does not contain an email address.");
        }

        await signInWithEmailAndPassword(auth, email, password);
    };

    const addNewEmployee = async (employeeData: NewEmployeeData, password: string) => {
        if (employeeData.role === 'admin') {
            console.log("Client: Attempting to call /api/admin-signup...");
            const response = await fetch('/api/admin-signup', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ employeeData, password }),
            });
            
            console.log("Client: Received response status:", response.status);
            const result = await response.json();
            console.log("Client: Received response body:", result);

            if (!response.ok) {
                console.error("Server-side error details:", result);
                throw new Error(result.details || 'Failed to create admin account via API.');
            }
            return; 
        }

        const userCredential = await createUserWithEmailAndPassword(
            auth,
            employeeData.email || `${employeeData.employeeId}@${employeeData.companyId}.karobhr.com`, 
            password
        );

        const newUser = userCredential.user;

        if (newUser) {
            await firestore.setDoc(firestore.doc(db, 'users', newUser.uid), {
                uid: newUser.uid,
                email: employeeData.email || `${employeeData.employeeId}@${employeeData.companyId}.karobhr.com`,
                name: employeeData.name,
                employeeId: employeeData.employeeId,
                department: employeeData.department,
                role: employeeData.role,
                companyId: employeeData.companyId,
                companyName: employeeData.companyName,
                joiningDate: employeeData.joiningDate,
                baseSalary: employeeData.baseSalary,
                createdAt: new Date().toISOString(),
            });
        }
    };

    const value: AuthContextProps = {
      user, 
      loading, 
      login, 
      addNewEmployee, 
      role: userRole,
      announcements, 
      attendanceLog, 
      tasks, 
      companySettings,
      karobUser,
    };

    return (
        <AuthContext.Provider value={value}>
            {!loading && children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    return useContext(AuthContext);
}
