'use client';

import type { ReactNode } from 'react';
import { createContext, useState, useEffect } from 'react';
import type { User, UserRole } from '@/lib/types';
// import { auth } from '@/lib/firebase'; // Assuming firebase.ts initializes and exports auth
// import type { User as FirebaseUser } from 'firebase/auth';

export interface AuthContextType {
  user: User | null;
  role: UserRole;
  loading: boolean;
  login: (email: string, pass: string, rememberMe?: boolean) => Promise<void>; // Simplified
  logout: () => Promise<void>;
  // Mock functions for development
  setMockUser: (user: User | null) => void;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // This is a mock implementation. Replace with actual Firebase Auth.
  useEffect(() => {
    // Try to load mock user from localStorage for persistence during development
    const storedMockUser = localStorage.getItem('mockUser');
    if (storedMockUser) {
      const parsedUser = JSON.parse(storedMockUser) as User;
      setUser(parsedUser);
    }
    setLoading(false);
    // Example: onAuthStateChanged listener
    // const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
    //   if (firebaseUser) {
    //     // Fetch user role from Firestore or custom claims
    //     // const tokenResult = await firebaseUser.getIdTokenResult();
    //     // const role = tokenResult.claims.role || 'employee'; 
    //     // For now, mock role based on email
    //     const role: UserRole = firebaseUser.email?.includes('admin') ? 'admin' : 'employee';
    //     setUser({ 
    //       id: firebaseUser.uid, 
    //       email: firebaseUser.email, 
    //       name: firebaseUser.displayName, 
    //       role,
    //       profilePictureUrl: firebaseUser.photoURL
    //     });
    //   } else {
    //     setUser(null);
    //   }
    //   setLoading(false);
    // });
    // return () => unsubscribe();
  }, []);

  const login = async (email: string, _pass: string, _rememberMe?: boolean) => {
    setLoading(true);
    // Mock login: determine role based on email
    const role: UserRole = email.includes('admin') ? 'admin' : 'employee';
    const mockUser: User = {
      id: 'mock-' + Math.random().toString(36).substr(2, 9),
      email,
      name: email.split('@')[0],
      role,
      profilePictureUrl: `https://placehold.co/100x100.png?text=${email[0].toUpperCase()}`
    };
    setUser(mockUser);
    localStorage.setItem('mockUser', JSON.stringify(mockUser)); // Persist for dev
    setLoading(false);
  };

  const logout = async () => {
    setLoading(true);
    setUser(null);
    localStorage.removeItem('mockUser'); // Clear persisted dev user
    setLoading(false);
  };
  
  // Mock function for development to easily switch users/roles
  const setMockUser = (mockUser: User | null) => {
    setUser(mockUser);
    if (mockUser) {
      localStorage.setItem('mockUser', JSON.stringify(mockUser));
    } else {
      localStorage.removeItem('mockUser');
    }
  };


  return (
    <AuthContext.Provider value={{ user, role: user?.role || null, loading, login, logout, setMockUser }}>
      {children}
    </AuthContext.Provider>
  );
};
