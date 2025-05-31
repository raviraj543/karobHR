
'use client';

import type { ReactNode } from 'react';
import { createContext, useState, useEffect } from 'react';
import type { User, UserRole } from '@/lib/types';

// Mock user profiles (without passwords) - In a real app, this would come from a database.
const mockUserProfiles: Record<string, User> = {
  'admin001': { 
    id: 'user_admin_001', 
    employeeId: 'admin001', 
    name: 'Jane Admin', 
    email: 'admin@bizflow.com', 
    role: 'admin', 
    profilePictureUrl: 'https://placehold.co/100x100.png?text=JA' 
  },
  'emp101': { 
    id: 'user_emp_101', 
    employeeId: 'emp101', 
    name: 'John Doe', 
    email: 'john.doe@bizflow.com', 
    role: 'employee', 
    profilePictureUrl: 'https://placehold.co/100x100.png?text=JD',
    department: 'Engineering',
    joiningDate: '2023-01-15',
    contactInfo: { phone: '555-1234' }
  },
   'emp102': { 
    id: 'user_emp_102', 
    employeeId: 'emp102', 
    name: 'Alice Smith', 
    email: 'alice.smith@bizflow.com', 
    role: 'employee', 
    profilePictureUrl: 'https://placehold.co/100x100.png?text=AS',
    department: 'Marketing',
    joiningDate: '2023-03-20',
    contactInfo: { phone: '555-5678' }
  },
  'man101': { 
    id: 'user_man_101', 
    employeeId: 'man101', 
    name: 'Mike Manager', 
    email: 'mike.manager@bizflow.com', 
    role: 'manager', 
    profilePictureUrl: 'https://placehold.co/100x100.png?text=MM',
    department: 'Operations',
    joiningDate: '2022-06-10',
    contactInfo: { phone: '555-8765' }
  },
  // Add more mock users as needed for testing the employee list
  'emp001': { id: 'usr_emp1', employeeId: 'emp001', name: 'Alice Johnson', email: 'alice.j@bizflow.com', role: 'employee', profilePictureUrl: 'https://placehold.co/40x40.png?text=AJ', department: 'Engineering', joiningDate: '2023-01-15' },
  'emp002': { id: 'usr_emp2', employeeId: 'emp002', name: 'Bob Williams', email: 'bob.w@bizflow.com', role: 'employee', profilePictureUrl: 'https://placehold.co/40x40.png?text=BW', department: 'Design', joiningDate: '2023-02-20' },
  'emp003': { id: 'usr_emp3', employeeId: 'emp003', name: 'Carol Davis', email: 'carol.d@bizflow.com', role: 'employee', profilePictureUrl: 'https://placehold.co/40x40.png?text=CD', department: 'Management', joiningDate: '2022-11-05' },
  'emp004': { id: 'usr_emp4', employeeId: 'emp004', name: 'David Brown', email: 'david.b@bizflow.com', role: 'employee', profilePictureUrl: 'https://placehold.co/40x40.png?text=DB', department: 'Engineering', joiningDate: '2023-05-01' },

};

// Mock credentials store - In a real app, passwords would be securely hashed and stored.
const mockCredentials: Record<string, string> = {
  'admin001': 'adminpass', // Admin ID and password
  'emp101': 'employeepass',   // Employee ID and password for John Doe
  'emp102': 'alicespass',  // Employee ID and password for Alice Smith
  'man101': 'managerpass', // Manager ID and password
  'emp001': 'password123',
  'emp002': 'password456',
  'emp003': 'password789',
  'emp004': 'password000',
};


export interface AuthContextType {
  user: User | null;
  role: UserRole;
  loading: boolean;
  login: (employeeId: string, pass: string, rememberMe?: boolean) => Promise<void>;
  logout: () => Promise<void>;
  // Mock functions for development - setMockUser might be useful for direct state manipulation in some dev scenarios
  setMockUser: (user: User | null) => void; 
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedMockUser = localStorage.getItem('mockUser');
    if (storedMockUser) {
      try {
        const parsedUser = JSON.parse(storedMockUser) as User;
        // Validate if the stored user still exists in our mock profiles (optional safety check)
        if (mockUserProfiles[parsedUser.employeeId]) {
             setUser(parsedUser);
        } else {
            localStorage.removeItem('mockUser'); // Stale user data
        }
      } catch (e) {
        console.error("Failed to parse stored user:", e);
        localStorage.removeItem('mockUser');
      }
    }
    setLoading(false);
  }, []);

  const login = async (employeeId: string, pass: string, _rememberMe?: boolean) => {
    setLoading(true);
    const expectedPassword = mockCredentials[employeeId];
    const userProfile = mockUserProfiles[employeeId];

    if (userProfile && expectedPassword && expectedPassword === pass) {
      setUser(userProfile);
      localStorage.setItem('mockUser', JSON.stringify(userProfile));
    } else {
      setUser(null); // Clear user state on failed login attempt
      localStorage.removeItem('mockUser');
      setLoading(false); // Ensure loading is set to false before throwing error
      throw new Error('Invalid Employee ID or Password.');
    }
    setLoading(false);
  };

  const logout = async () => {
    setLoading(true);
    setUser(null);
    localStorage.removeItem('mockUser');
    setLoading(false);
  };
  
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
