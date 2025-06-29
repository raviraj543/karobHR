"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { auth, db } from '@/lib/firebase/firebase';
import { onAuthStateChanged, User, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import * as firestore from 'firebase/firestore'; // Import all firestore functions via alias

// Define NewEmployeeData interface here as it's imported from this file
export interface NewEmployeeData {
    name: string;
    employeeId: string;
    email?: string;
    department: string;
    role: string; // Assuming UserRole is string
    companyId: string;
    companyName: string;
    joiningDate: string;
    baseSalary: number;
}

interface AuthContextProps {
    user: User | null | undefined;
    loading: boolean;
    login: (email: string, password: string) => Promise<void>;
    addNewEmployee: (employeeData: NewEmployeeData, password: string) => Promise<void>;
}

export const AuthContext = createContext<AuthContextProps>({
    user: undefined,
    loading: true,
    login: async () => {},
    addNewEmployee: async () => {}, // Default empty function
});

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                // Use firestore.doc and firestore.getDoc with the aliased import
                const userDocRef = firestore.doc(db, 'users', user.uid);
                const userDoc = await firestore.getDoc(userDocRef);

                if (userDoc.exists()) {
                    setUser(user);
                } else {
                    setUser(user);
                }
            } else {
                setUser(null);
            }
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const login = async (email: string, password: string) => {
        await signInWithEmailAndPassword(auth, email, password);
    };

    const addNewEmployee = async (employeeData: NewEmployeeData, password: string) => {
        // Create user with Firebase Auth
        const userCredential = await createUserWithEmailAndPassword(
            auth,
            employeeData.email || `${employeeData.employeeId}@${employeeData.companyId}.karobhr.com`, // Use provided email or generate one
            password
        );

        const newUser = userCredential.user;

        // Store employee data in Firestore
        if (newUser) {
            // Use firestore.doc and firestore.setDoc with the aliased import
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

    const value: AuthContextProps = { user, loading, login, addNewEmployee };

    return (
        <AuthContext.Provider value={value}>
            {!loading && children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    return useContext(AuthContext);
}
