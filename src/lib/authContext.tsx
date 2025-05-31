
'use client';

import type { ReactNode } from 'react';
import { createContext, useState, useEffect }
from 'react';
import type { User, UserRole, Advance } from '@/lib/types';
import { v4 as uuidv4 } from 'uuid'; // For generating unique IDs for advances

// Mock user profiles (without passwords) - In a real app, this would come from a database.
const initialMockUserProfiles: Record<string, User> = {
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
     leaves: [
      { id: uuidv4(), userId: 'emp101', leaveType: 'Casual Leave', startDate: '2024-07-10', endDate: '2024-07-12', reason: 'Family event', status: 'approved' },
      { id: uuidv4(), userId: 'emp101', leaveType: 'Sick Leave', startDate: '2024-08-01', endDate: '2024-08-01', reason: 'Fever', status: 'pending' },
    ]
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
    leaves: []
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
    leaves: [
       { id: uuidv4(), userId: 'man101', leaveType: 'Vacation', startDate: '2024-09-01', endDate: '2024-09-07', reason: 'Annual leave', status: 'approved' }
    ]
  },
  'emp001': { id: 'usr_emp1', employeeId: 'emp001', name: 'Alice Johnson', email: 'alice.j@bizflow.com', role: 'employee', profilePictureUrl: 'https://placehold.co/40x40.png?text=AJ', department: 'Engineering', joiningDate: '2023-01-15', baseSalary: 48000, mockAttendanceFactor: 1.0, advances: [], leaves: [] },
  'emp002': { id: 'usr_emp2', employeeId: 'emp002', name: 'Bob Williams', email: 'bob.w@bizflow.com', role: 'employee', profilePictureUrl: 'https://placehold.co/40x40.png?text=BW', department: 'Design', joiningDate: '2023-02-20', baseSalary: 49000, mockAttendanceFactor: 0.85, advances: [], leaves: [] },
  'emp003': { id: 'usr_emp3', employeeId: 'emp003', name: 'Carol Davis', email: 'carol.d@bizflow.com', role: 'employee', profilePictureUrl: 'https://placehold.co/40x40.png?text=CD', department: 'Management', joiningDate: '2022-11-05', baseSalary: 55000, mockAttendanceFactor: 1.0, advances: [], leaves: [] },
  'emp004': { id: 'usr_emp4', employeeId: 'emp004', name: 'David Brown', email: 'david.b@bizflow.com', role: 'employee', profilePictureUrl: 'https://placehold.co/40x40.png?text=DB', department: 'Engineering', joiningDate: '2023-05-01', baseSalary: 51000, mockAttendanceFactor: 1.0, advances: [], leaves: [] },
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

// Define the type for the data passed to addNewEmployee, based on NewEmployeeFormValues
// but ensuring all necessary User fields are constructed.
export interface NewEmployeeData {
  name: string;
  employeeId: string;
  email?: string;
  department: string;
  role: UserRole; // Make sure UserRole is 'employee', 'admin', 'manager'
  joiningDate?: string;
  baseSalary?: number;
  // password is used for setting credentials, not stored directly on User object in allUsersState
}


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
  updateUserInContext: (updatedUser: User) => void;
  addNewEmployee: (employeeData: NewEmployeeData, passwordToSet: string) => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<User | null>(null);
  const [allUsersState, setAllUsersState] = useState<User[]>(() => {
    // Initialize from localStorage or use initialMockUserProfiles
    if (typeof window !== 'undefined') {
      const storedAllUsers = localStorage.getItem('mockAllUsers');
      if (storedAllUsers) {
        try {
          return JSON.parse(storedAllUsers);
        } catch (e) {
          console.error("Failed to parse stored allUsers from localStorage:", e);
          // Fallback to initial mock data if parsing fails
          return Object.values(initialMockUserProfiles);
        }
      }
    }
    return Object.values(initialMockUserProfiles);
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // This effect ensures localStorage is only accessed on the client side
    // and populates the initial state.
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
        const defaultUsers = Object.values(initialMockUserProfiles);
        localStorage.setItem('mockAllUsers', JSON.stringify(defaultUsers));
        setAllUsersState(defaultUsers);
      }
    } else {
      // If nothing in localStorage, initialize it with the default mock profiles
      const defaultUsers = Object.values(initialMockUserProfiles);
      localStorage.setItem('mockAllUsers', JSON.stringify(defaultUsers));
      setAllUsersState(defaultUsers);
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
    const userProfile = allUsersState.find(u => u.employeeId === employeeId);
    // For prototype: check against static mockCredentials.
    // Newly added users via UI won't be loggable unless manually added to mockCredentials in code.
    const expectedPassword = mockCredentials[employeeId];

    if (userProfile && expectedPassword && expectedPassword === pass) {
      setUser(userProfile);
      localStorage.setItem('mockUser', JSON.stringify(userProfile));
      setLoading(false);
      return userProfile;
    } else {
      setUser(null);
      localStorage.removeItem('mockUser');
      setLoading(false);
      return null;
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
    const targetUserIndex = allUsersState.findIndex(u => u.employeeId === employeeId);
    if (targetUserIndex === -1) throw new Error("User not found for advance request.");

    const newAdvance: Advance = {
      id: uuidv4(),
      employeeId,
      amount,
      reason,
      dateRequested: new Date().toISOString(),
      status: 'pending',
    };
    
    const updatedAllUsers = [...allUsersState];
    const targetUser = updatedAllUsers[targetUserIndex];
    targetUser.advances = [...(targetUser.advances || []), newAdvance];
    
    setAllUsersState(updatedAllUsers);
    updateUserInStorage(updatedAllUsers);
  };

  const processAdvance = async (targetEmployeeId: string, advanceId: string, newStatus: 'approved' | 'rejected') => {
    const targetUserIndex = allUsersState.findIndex(u => u.employeeId === targetEmployeeId);
    if (targetUserIndex === -1) throw new Error("User or advances not found for processing.");

    const updatedAllUsers = [...allUsersState];
    const targetUser = updatedAllUsers[targetUserIndex];
    
    if (!targetUser.advances) throw new Error("Advances array not found for user.");

    const advanceIndex = targetUser.advances.findIndex(adv => adv.id === advanceId);
    if (advanceIndex === -1) throw new Error("Advance ID not found for this user.");

    targetUser.advances[advanceIndex] = {
        ...targetUser.advances[advanceIndex],
        status: newStatus,
        dateProcessed: new Date().toISOString()
    };
    
    setAllUsersState(updatedAllUsers);
    updateUserInStorage(updatedAllUsers);
  };

  const addNewEmployee = async (employeeData: NewEmployeeData, passwordToSet: string) => {
    // Note: passwordToSet is captured but not dynamically added to mockCredentials for login in this prototype.
    // Admin needs to manually add it to mockCredentials in the code for the new user to log in.
    const newUser: User = {
      id: uuidv4(), // Generate a unique ID for the user record
      employeeId: employeeData.employeeId,
      name: employeeData.name,
      email: employeeData.email || '',
      role: employeeData.role as 'employee' | 'admin' | 'manager', // Ensure role is correctly typed
      department: employeeData.department,
      joiningDate: employeeData.joiningDate || new Date().toISOString().split('T')[0],
      baseSalary: employeeData.baseSalary || 0,
      mockAttendanceFactor: 1.0, // Default to 100%
      advances: [],
      leaves: [],
      profilePictureUrl: `https://placehold.co/100x100.png?text=${employeeData.name.split(' ').map(n=>n[0]).join('').toUpperCase() || 'N/A'}`,
    };

    // Check if employeeId already exists
    if (allUsersState.some(u => u.employeeId === newUser.employeeId)) {
      throw new Error(`Employee ID "${newUser.employeeId}" already exists.`);
    }

    const updatedAllUsers = [...allUsersState, newUser];
    setAllUsersState(updatedAllUsers);
    updateUserInStorage(updatedAllUsers);
    
    // The 'passwordToSet' is what the admin entered.
    // For the prototype, we remind the admin of the manual step:
    console.log(`New employee ${newUser.name} created with Employee ID: ${newUser.employeeId} and Password: ${passwordToSet}. Add to mockCredentials to enable login.`);
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
        updateUserInContext,
        addNewEmployee
    }}>
      {children}
    </AuthContext.Provider>
  );
};

    