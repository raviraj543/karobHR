
'use client';

import type { ReactNode } from 'react';
import { createContext, useState, useEffect }
from 'react';
import type { User, UserRole, Advance } from '@/lib/types';
import { v4 as uuidv4 } from 'uuid'; // For generating unique IDs for advances

// Mock user profiles (without passwords) - In a real app, this would come from a database.
const mockUserProfiles: Record<string, User> = {
  'admin001': { 
    id: 'user_admin_001', 
    employeeId: 'admin001', 
    name: 'Jane Admin', 
    email: 'admin@bizflow.com', 
    role: 'admin', 
    profilePictureUrl: 'https://placehold.co/100x100.png?text=JA',
    baseSalary: 70000,
    advances: [],
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
    contactInfo: { phone: '555-1234' },
    baseSalary: 50000,
    advances: [
      { id: uuidv4(), employeeId: 'emp101', amount: 200, reason: 'Urgent need', dateRequested: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), status: 'approved', dateProcessed: new Date().toISOString()},
      { id: uuidv4(), employeeId: 'emp101', amount: 100, reason: 'Medical bill', dateRequested: new Date().toISOString(), status: 'pending' },
    ],
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
    contactInfo: { phone: '555-5678' },
    baseSalary: 52000,
    advances: [],
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
    contactInfo: { phone: '555-8765' },
    baseSalary: 60000,
    advances: [],
  },
  'emp001': { id: 'usr_emp1', employeeId: 'emp001', name: 'Alice Johnson', email: 'alice.j@bizflow.com', role: 'employee', profilePictureUrl: 'https://placehold.co/40x40.png?text=AJ', department: 'Engineering', joiningDate: '2023-01-15', baseSalary: 48000, advances: [] },
  'emp002': { id: 'usr_emp2', employeeId: 'emp002', name: 'Bob Williams', email: 'bob.w@bizflow.com', role: 'employee', profilePictureUrl: 'https://placehold.co/40x40.png?text=BW', department: 'Design', joiningDate: '2023-02-20', baseSalary: 49000, advances: [] },
  'emp003': { id: 'usr_emp3', employeeId: 'emp003', name: 'Carol Davis', email: 'carol.d@bizflow.com', role: 'employee', profilePictureUrl: 'https://placehold.co/40x40.png?text=CD', department: 'Management', joiningDate: '2022-11-05', baseSalary: 55000, advances: [] },
  'emp004': { id: 'usr_emp4', employeeId: 'emp004', name: 'David Brown', email: 'david.b@bizflow.com', role: 'employee', profilePictureUrl: 'https://placehold.co/40x40.png?text=DB', department: 'Engineering', joiningDate: '2023-05-01', baseSalary: 51000, advances: [] },
};

const mockCredentials: Record<string, string> = {
  'admin001': 'adminpass',
  'emp101': 'employeepass',
  'emp102': 'alicespass',
  'man101': 'managerpass',
  'emp001': 'password123',
  'emp002': 'password456',
  'emp003': 'password789',
  'emp004': 'password000',
};

export interface AuthContextType {
  user: User | null;
  allUsers: User[]; // For admin to see all users for payroll/advances
  role: UserRole;
  loading: boolean;
  login: (employeeId: string, pass: string, rememberMe?: boolean) => Promise<void>;
  logout: () => Promise<void>;
  setMockUser: (user: User | null) => void;
  requestAdvance: (employeeId: string, amount: number, reason: string) => Promise<void>;
  processAdvance: (targetEmployeeId: string, advanceId: string, newStatus: 'approved' | 'rejected') => Promise<void>;
  updateUserInContext: (updatedUser: User) => void; // Helper to update a user's details
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<User | null>(null);
  const [allUsersState, setAllUsersState] = useState<User[]>(Object.values(mockUserProfiles));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Load all users from localStorage if available (simulates DB)
    const storedAllUsers = localStorage.getItem('mockAllUsers');
    if (storedAllUsers) {
      try {
        const parsedAllUsers = JSON.parse(storedAllUsers) as User[];
        setAllUsersState(parsedAllUsers);
        // If a user was logged in, find their latest profile from this list
        const storedUser = localStorage.getItem('mockUser');
        if (storedUser) {
          const parsedLoginUser = JSON.parse(storedUser) as User;
          const currentUserProfile = parsedAllUsers.find(u => u.employeeId === parsedLoginUser.employeeId);
          if (currentUserProfile) {
            setUser(currentUserProfile);
          } else {
             localStorage.removeItem('mockUser'); // Stale logged-in user
          }
        }
      } catch (e) {
        console.error("Failed to parse stored allUsers:", e);
        localStorage.removeItem('mockAllUsers');
        setAllUsersState(Object.values(mockUserProfiles)); // Reset to default if corrupted
      }
    } else {
      // Initialize localStorage with default mock users if not present
      localStorage.setItem('mockAllUsers', JSON.stringify(Object.values(mockUserProfiles)));
    }
    
    // Determine logged-in user (as before, but now potentially from updated allUsersState)
    const storedUser = localStorage.getItem('mockUser');
    if (storedUser && !user) { // Check !user to avoid re-setting if already set by above block
      try {
        const parsedUser = JSON.parse(storedUser) as User;
        const currentUserProfile = allUsersState.find(u => u.employeeId === parsedUser.employeeId);
         if (currentUserProfile) {
             setUser(currentUserProfile);
        } else {
            localStorage.removeItem('mockUser');
        }
      } catch (e) {
        console.error("Failed to parse stored user:", e);
        localStorage.removeItem('mockUser');
      }
    }
    setLoading(false);
  }, []); // Run once on mount


  const updateUserInStorage = (usersArray: User[]) => {
    localStorage.setItem('mockAllUsers', JSON.stringify(usersArray));
    // If the currently logged-in user is being updated, also update their specific 'mockUser' storage
    if (user) {
        const updatedLoggedInUser = usersArray.find(u => u.employeeId === user.employeeId);
        if (updatedLoggedInUser) {
            setUser(updatedLoggedInUser);
            localStorage.setItem('mockUser', JSON.stringify(updatedLoggedInUser));
        }
    }
  };
  
  const updateUserInContext = (updatedUser: User) => {
    setAllUsersState(prevAllUsers => {
        const newAllUsers = prevAllUsers.map(u => u.employeeId === updatedUser.employeeId ? updatedUser : u);
        updateUserInStorage(newAllUsers);
        return newAllUsers;
    });
    if (user && user.employeeId === updatedUser.employeeId) {
        setUser(updatedUser);
    }
  };


  const login = async (employeeId: string, pass: string, _rememberMe?: boolean) => {
    setLoading(true);
    const expectedPassword = mockCredentials[employeeId];
    const userProfile = allUsersState.find(u => u.employeeId === employeeId);

    if (userProfile && expectedPassword && expectedPassword === pass) {
      setUser(userProfile);
      localStorage.setItem('mockUser', JSON.stringify(userProfile));
    } else {
      setUser(null);
      localStorage.removeItem('mockUser');
      setLoading(false);
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
      // Also update in allUsersState if it's a "new" mock user being set
      const exists = allUsersState.some(u => u.employeeId === mockUser.employeeId);
      if (!exists) {
        const newAllUsers = [...allUsersState, mockUser];
        setAllUsersState(newAllUsers);
        updateUserInStorage(newAllUsers);
      } else {
        updateUserInContext(mockUser); // if exists, ensure it's updated
      }
    } else {
      localStorage.removeItem('mockUser');
    }
  };

  const requestAdvance = async (employeeId: string, amount: number, reason: string) => {
    const targetUser = allUsersState.find(u => u.employeeId === employeeId);
    if (!targetUser) throw new Error("User not found for advance request.");

    const newAdvance: Advance = {
      id: uuidv4(),
      employeeId,
      amount,
      reason,
      dateRequested: new Date().toISOString(),
      status: 'pending',
    };
    
    const updatedUser = {
        ...targetUser,
        advances: [...(targetUser.advances || []), newAdvance],
    };
    updateUserInContext(updatedUser);
  };

  const processAdvance = async (targetEmployeeId: string, advanceId: string, newStatus: 'approved' | 'rejected') => {
    const targetUser = allUsersState.find(u => u.employeeId === targetEmployeeId);
    if (!targetUser || !targetUser.advances) throw new Error("User or advances not found for processing.");

    const advanceExists = targetUser.advances.some(adv => adv.id === advanceId);
    if (!advanceExists) throw new Error("Advance ID not found for this user.");
    
    const updatedAdvances = targetUser.advances.map(adv => 
        adv.id === advanceId ? { ...adv, status: newStatus, dateProcessed: new Date().toISOString() } : adv
    );
    
    const updatedUser = {
        ...targetUser,
        advances: updatedAdvances,
    };
    updateUserInContext(updatedUser);
  };

  return (
    <AuthContext.Provider value={{ 
        user, 
        allUsers: allUsersState, 
        role: user?.role || null, 
        loading, 
        login, 
        logout, 
        setMockUser, 
        requestAdvance, 
        processAdvance,
        updateUserInContext
    }}>
      {children}
    </AuthContext.Provider>
  );
};
