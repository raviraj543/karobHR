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
    login: (loginId: string, password: string) => Promise<void>;
    addNewEmployee: (employeeData: NewEmployeeData, password: string) => Promise<void>;
    role: string | null; // Add role to the context props
}

export const AuthContext = createContext<AuthContextProps>({
    user: undefined,
    loading: true,
    login: async () => {},
    addNewEmployee: async () => {}, // Default empty function
    role: null, // Default role
});

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [userRole, setUserRole] = useState<string | null>(null); // New state for role

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
            if (firebaseUser) {
                const userDocRef = firestore.doc(db, 'users', firebaseUser.uid);
                const userDoc = await firestore.getDoc(userDocRef);

                if (userDoc.exists()) {
                    const userData = userDoc.data();
                    setUser(firebaseUser);
                    setUserRole(userData.role || null); // Set the role from Firestore
                } else {
                    setUser(firebaseUser);
                    setUserRole(null); // No Firestore doc, so no role or default to null
                    console.warn("User exists in Auth but corresponding Firestore document not found immediately.");
                }
            } else {
                setUser(null);
                setUserRole(null); // Clear role if no user
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
        // The onAuthStateChanged listener will handle setting user and role after successful sign-in
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
            return; // Exit after successful API call for admin
        }

        const userCredential = await createUserWithEmailAndPassword(
            auth,
            employeeData.email || `${employeeData.employeeId}@${employeeData.companyId}.karobhr.com`, // Use provided email or generate one
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

    const value: AuthContextProps = { user, loading, login, addNewEmployee, role: userRole }; // Pass userRole here

    return (
        <AuthContext.Provider value={value}>
            {!loading && children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    return useContext(AuthContext);
}
