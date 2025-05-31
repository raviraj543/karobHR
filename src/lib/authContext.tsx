
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
    mockAttendanceFactor: 1.0,
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
    mockAttendanceFactor: 0.9, // Example: 90% attendance
    advances: [
      { id: uuidv4(), employeeId: 'emp101', amount: 2000, reason: 'Urgent need', dateRequested: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), status: 'approved', dateProcessed: new Date().toISOString()},
      { id: uuidv4(), employeeId: 'emp101', amount: 1000, reason: 'Medical bill', dateRequested: new Date().toISOString(), status: 'pending' },
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
    mockAttendanceFactor: 1.0, // Full attendance
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
    mockAttendanceFactor: 0.95, // Example: 95% attendance
    advances: [],
  },
  'emp001': { id: 'usr_emp1', employeeId: 'emp001', name: 'Alice Johnson', email: 'alice.j@bizflow.com', role: 'employee', profilePictureUrl: 'https://placehold.co/40x40.png?text=AJ', department: 'Engineering', joiningDate: '2023-01-15', baseSalary: 48000, mockAttendanceFactor: 1.0, advances: [] },
  'emp002': { id: 'usr_emp2', employeeId: 'emp002', name: 'Bob Williams', email: 'bob.w@bizflow.com', role: 'employee', profilePictureUrl: 'https://placehold.co/40x40.png?text=BW', department: 'Design', joiningDate: '2023-02-20', baseSalary: 49000, mockAttendanceFactor: 0.85, advances: [] }, // Example: 85% attendance
  'emp003': { id: 'usr_emp3', employeeId: 'emp003', name: 'Carol Davis', email: 'carol.d@bizflow.com', role: 'employee', profilePictureUrl: 'https://placehold.co/40x40.png?text=CD', department: 'Management', joiningDate: '2022-11-05', baseSalary: 55000, mockAttendanceFactor: 1.0, advances: [] },
  'emp004': { id: 'usr_emp4', employeeId: 'emp004', name: 'David Brown', email: 'david.b@bizflow.com', role: 'employee', profilePictureUrl: 'https://placehold.co/40x40.png?text=DB', department: 'Engineering', joiningDate: '2023-05-01', baseSalary: 51000, mockAttendanceFactor: 1.0, advances: [] },
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
  login: (employeeId: string, pass: string, rememberMe?: boolean) => Promise<User | null>;
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
    const storedAllUsers = localStorage.getItem('mockAllUsers');
    if (storedAllUsers) {
      try {
        const parsedAllUsers = JSON.parse(storedAllUsers) as User[];
        setAllUsersState(parsedAllUsers);
        const storedUser = localStorage.getItem('mockUser');
        if (storedUser) {
          const parsedLoginUser = JSON.parse(storedUser) as User;
          const currentUserProfile = parsedAllUsers.find(u => u.employeeId === parsedLoginUser.employeeId);
          if (currentUserProfile) {
            setUser(currentUserProfile);
          } else {
             localStorage.removeItem('mockUser');
          }
        }
      } catch (e) {
        console.error("Failed to parse stored allUsers:", e);
        localStorage.removeItem('mockAllUsers');
        // Initialize with defaults if parsing fails
        const defaultUsers = Object.values(mockUserProfiles);
        localStorage.setItem('mockAllUsers', JSON.stringify(defaultUsers));
        setAllUsersState(defaultUsers);
      }
    } else {
      const defaultUsers = Object.values(mockUserProfiles);
      localStorage.setItem('mockAllUsers', JSON.stringify(defaultUsers));
      setAllUsersState(defaultUsers);
    }

    const storedUser = localStorage.getItem('mockUser');
    if (storedUser && !user) {
      try {
        const parsedUser = JSON.parse(storedUser) as User;
        // Ensure the user loaded from 'mockUser' is consistent with 'allUsersState'
        const currentUserProfile = allUsersState.find(u => u.employeeId === parsedUser.employeeId);
         if (currentUserProfile) {
             setUser(currentUserProfile);
        } else {
            // If the user in 'mockUser' is not in the 'allUsersState' (e.g., stale data), clear it.
            localStorage.removeItem('mockUser');
        }
      } catch (e) {
        console.error("Failed to parse stored user:", e);
        localStorage.removeItem('mockUser');
      }
    }
    setLoading(false);
  }, []);


  const updateUserInStorage = (usersArray: User[]) => {
    localStorage.setItem('mockAllUsers', JSON.stringify(usersArray));
    if (user) {
        const updatedLoggedInUser = usersArray.find(u => u.employeeId === user.employeeId);
        if (updatedLoggedInUser) {
            setUser(updatedLoggedInUser); // Update context for current user
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
  };


  const login = async (employeeId: string, pass: string, _rememberMe?: boolean): Promise<User | null> => {
    setLoading(true);
    // It's crucial to use allUsersState here, as it's the most up-to-date version
    // especially after potential updates from localStorage.
    const userProfile = allUsersState.find(u => u.employeeId === employeeId);
    const expectedPassword = mockCredentials[employeeId];

    // Simulate network delay for realism if needed
    // await new Promise(resolve => setTimeout(resolve, 500));

    if (userProfile && expectedPassword && expectedPassword === pass) {
      setUser(userProfile);
      localStorage.setItem('mockUser', JSON.stringify(userProfile));
      setLoading(false);
      return userProfile;
    } else {
      setUser(null);
      localStorage.removeItem('mockUser');
      setLoading(false);
      return null; // Indicate failed login
    }
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
      const exists = allUsersState.some(u => u.employeeId === mockUser.employeeId);
      if (!exists) {
        const newAllUsers = [...allUsersState, mockUser];
        setAllUsersState(newAllUsers);
        updateUserInStorage(newAllUsers);
      } else {
        updateUserInContext(mockUser);
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
