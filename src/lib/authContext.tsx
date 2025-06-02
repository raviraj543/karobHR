
'use client';

import type { ReactNode } from 'react';
import { createContext, useState, useEffect }
from 'react';
import type { User, UserRole, Advance, Announcement, LeaveApplication, AttendanceEvent, LocationInfo, Task as TaskType } from '@/lib/types';
import { v4 as uuidv4 } from 'uuid';

// --- Mock Data for Quick Login ---
const MOCK_ADMIN_ID = 'admin';
const MOCK_MANAGER_ID = 'manager01';
const MOCK_EMPLOYEE_ID = 'emp001';
const MOCK_PASSWORD = 'password123';

// Initial mock user profiles - Re-added for quick login testing
const initialMockUserProfiles: Record<string, User> = {
  [MOCK_ADMIN_ID]: {
    id: 'mock-admin-uuid',
    employeeId: MOCK_ADMIN_ID,
    name: 'Mock Admin',
    email: 'admin@karobhr.com',
    role: 'admin',
    department: 'Administration',
    joiningDate: '2023-01-01',
    baseSalary: 0,
    mockAttendanceFactor: 1.0,
    advances: [],
    leaves: [],
    profilePictureUrl: `https://placehold.co/100x100.png?text=AD`,
  },
  [MOCK_MANAGER_ID]: {
    id: 'mock-manager-uuid',
    employeeId: MOCK_MANAGER_ID,
    name: 'Mock Manager',
    email: 'manager@karobhr.com',
    role: 'manager',
    department: 'Operations',
    joiningDate: '2023-01-15',
    baseSalary: 75000,
    mockAttendanceFactor: 1.0,
    advances: [],
    leaves: [],
    profilePictureUrl: `https://placehold.co/100x100.png?text=MM`,
  },
  [MOCK_EMPLOYEE_ID]: {
    id: 'mock-employee-uuid',
    employeeId: MOCK_EMPLOYEE_ID,
    name: 'Mock Employee',
    email: 'employee@karobhr.com',
    role: 'employee',
    department: 'Development',
    joiningDate: '2023-02-01',
    baseSalary: 50000,
    mockAttendanceFactor: 1.0,
    advances: [],
    leaves: [],
    profilePictureUrl: `https://placehold.co/100x100.png?text=ME`,
  },
};

// Initial mock credentials - Re-added for quick login testing
const initialMockCredentials: Record<string, string> = {
  [MOCK_ADMIN_ID]: MOCK_PASSWORD,
  [MOCK_MANAGER_ID]: MOCK_PASSWORD,
  [MOCK_EMPLOYEE_ID]: MOCK_PASSWORD,
};
// --- End Mock Data ---

export interface NewEmployeeData {
  name: string;
  employeeId: string;
  email?: string;
  department: string;
  role: UserRole;
  joiningDate?: string;
  baseSalary?: number;
}

export interface AuthContextType {
  user: User | null;
  allUsers: User[];
  role: UserRole;
  loading: boolean;
  announcements: Announcement[];
  attendanceLog: AttendanceEvent[];
  tasks: TaskType[];
  login: (employeeId: string, pass: string, rememberMe?: boolean) => Promise<User | null>;
  logout: () => Promise<void>;
  setMockUser: (user: User | null) => void;
  requestAdvance: (employeeId: string, amount: number, reason: string) => Promise<void>;
  processAdvance: (targetEmployeeId: string, advanceId: string, newStatus: 'approved' | 'rejected') => Promise<void>;
  updateUserInContext: (updatedUser: User) => void;
  addNewEmployee: (employeeData: NewEmployeeData, passwordToSet: string) => Promise<void>;
  addAnnouncement: (title: string, content: string) => Promise<void>;
  addAttendanceEvent: (eventData: Omit<AttendanceEvent, 'id' | 'timestamp' | 'userName'>) => Promise<void>;
  addTask: (task: TaskType) => Promise<void>;
  updateTask: (updatedTask: TaskType) => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<User | null>(null);
  const [allUsersState, setAllUsersState] = useState<User[]>([]);
  const [mockCredentialsState, setMockCredentialsState] = useState<Record<string, string>>({});
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [attendanceLog, setAttendanceLog] = useState<AttendanceEvent[]>([]);
  const [tasks, setTasks] = useState<TaskType[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    // Load All Users
    let loadedUsersFromStorage = false;
    const storedAllUsers = localStorage.getItem('mockAllUsers');
    if (storedAllUsers) {
      try {
        const parsedAllUsers = JSON.parse(storedAllUsers) as User[];
        if (parsedAllUsers.length > 0) { // Only use if not empty
            setAllUsersState(parsedAllUsers);
            loadedUsersFromStorage = true;
        }
        const storedUser = localStorage.getItem('mockUser'); // For remembering logged-in user
        if (storedUser) {
          const parsedLoginUser = JSON.parse(storedUser) as User;
          const currentUserProfile = (parsedAllUsers.length > 0 ? parsedAllUsers : Object.values(initialMockUserProfiles)).find(u => u.employeeId === parsedLoginUser.employeeId);
          setUser(currentUserProfile || null);
        }
      } catch (e) {
        console.error("Failed to parse stored allUsers:", e);
        localStorage.removeItem('mockAllUsers');
      }
    }
    
    if (!loadedUsersFromStorage) {
      const defaultUsers = Object.values(initialMockUserProfiles);
      localStorage.setItem('mockAllUsers', JSON.stringify(defaultUsers));
      setAllUsersState(defaultUsers);
    }


    // Load Credentials
    let loadedCredentialsFromStorage = false;
    const storedCredentials = localStorage.getItem('mockCredentials');
    if (storedCredentials) {
      try {
        const parsedCredentials = JSON.parse(storedCredentials) as Record<string, string>;
        if (Object.keys(parsedCredentials).length > 0) { // Only use if not empty
            setMockCredentialsState(parsedCredentials);
            loadedCredentialsFromStorage = true;
        }
      } catch (e) {
        console.error("Failed to parse stored credentials:", e);
        localStorage.removeItem('mockCredentials');
      }
    }
    
    if (!loadedCredentialsFromStorage) {
        localStorage.setItem('mockCredentials', JSON.stringify(initialMockCredentials));
        setMockCredentialsState(initialMockCredentials);
    }

    // Load Announcements
    const storedAnnouncements = localStorage.getItem('mockAnnouncements');
    if (storedAnnouncements) {
      try {
        setAnnouncements(JSON.parse(storedAnnouncements));
      } catch (e) { console.error("Failed to parse stored announcements:", e); localStorage.removeItem('mockAnnouncements'); setAnnouncements([]); }
    } else {
       localStorage.setItem('mockAnnouncements', JSON.stringify([])); setAnnouncements([]);
    }

    // Load Attendance Log
    const storedAttendanceLog = localStorage.getItem('mockAttendanceLog');
    if (storedAttendanceLog) {
        try { setAttendanceLog(JSON.parse(storedAttendanceLog)); }
        catch (e) { console.error("Failed to parse stored attendance log:", e); localStorage.removeItem('mockAttendanceLog'); setAttendanceLog([]); }
    } else {
        localStorage.setItem('mockAttendanceLog', JSON.stringify([])); setAttendanceLog([]);
    }

    // Load Tasks
    const storedTasks = localStorage.getItem('mockTasks');
    if (storedTasks) {
        try { setTasks(JSON.parse(storedTasks)); }
        catch (e) { console.error("Failed to parse stored tasks:", e); localStorage.removeItem('mockTasks'); setTasks([]); }
    } else {
        localStorage.setItem('mockTasks', JSON.stringify([])); setTasks([]);
    }

    setLoading(false);
  }, []);

  const updateUserInStorage = (usersArray: User[]) => {
    localStorage.setItem('mockAllUsers', JSON.stringify(usersArray));
    if (user) {
        const updatedLoggedInUser = usersArray.find(u => u.employeeId === user.employeeId);
        if (updatedLoggedInUser) {
            setUser(updatedLoggedInUser);
            localStorage.setItem('mockUser', JSON.stringify(updatedLoggedInUser));
        } else {
            setUser(null);
            localStorage.removeItem('mockUser');
        }
    }
  };

  const updateCredentialsInStorage = (credentialsMap: Record<string, string>) => {
    localStorage.setItem('mockCredentials', JSON.stringify(credentialsMap));
  };

  const updateAnnouncementsInStorage = (announcementsArray: Announcement[]) => {
    localStorage.setItem('mockAnnouncements', JSON.stringify(announcementsArray));
  };

  const updateAttendanceLogInStorage = (log: AttendanceEvent[]) => {
    localStorage.setItem('mockAttendanceLog', JSON.stringify(log));
  };

  const updateTasksInStorage = (tasksArray: TaskType[]) => {
    localStorage.setItem('mockTasks', JSON.stringify(tasksArray));
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
    const expectedPassword = mockCredentialsState[employeeId];

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
    const newUser: User = {
      id: uuidv4(),
      employeeId: employeeData.employeeId,
      name: employeeData.name,
      email: employeeData.email || '',
      role: employeeData.role as 'employee' | 'admin' | 'manager',
      department: employeeData.department || (employeeData.role === 'admin' ? 'Administration' : 'N/A'),
      joiningDate: employeeData.joiningDate || new Date().toISOString().split('T')[0],
      baseSalary: employeeData.baseSalary || (employeeData.role === 'admin' ? 0 : undefined),
      mockAttendanceFactor: 1.0,
      advances: [],
      leaves: [],
      profilePictureUrl: `https://placehold.co/100x100.png?text=${employeeData.name.split(' ').map(n=>n[0]).join('').toUpperCase() || 'N/A'}`,
    };

    // Check if employeeId already exists in the current state or initial mock profiles
    const employeeIdExists = allUsersState.some(u => u.employeeId === newUser.employeeId) ||
                             (initialMockUserProfiles[newUser.employeeId] && !allUsersState.some(u => u.employeeId === newUser.employeeId));

    if (employeeIdExists && newUser.employeeId !== MOCK_ADMIN_ID && newUser.employeeId !== MOCK_MANAGER_ID && newUser.employeeId !== MOCK_EMPLOYEE_ID) {
        // Allow overwriting mock users if they are being "officially" added
        if (initialMockUserProfiles[newUser.employeeId]) {
            // If it's one of the initial mock IDs, we proceed to update/replace it
        } else {
            throw new Error(`User ID "${newUser.employeeId}" already exists.`);
        }
    }


    let updatedAllUsers;
    const existingUserIndex = allUsersState.findIndex(u => u.employeeId === newUser.employeeId);
    if (existingUserIndex !== -1) { // User exists, update them (e.g. if it was a mock user being formally added)
        updatedAllUsers = [...allUsersState];
        updatedAllUsers[existingUserIndex] = newUser;
    } else { // New user
        updatedAllUsers = [...allUsersState, newUser];
    }

    setAllUsersState(updatedAllUsers);
    updateUserInStorage(updatedAllUsers);

    const updatedCredentials = { ...mockCredentialsState, [newUser.employeeId]: passwordToSet };
    setMockCredentialsState(updatedCredentials);
    updateCredentialsInStorage(updatedCredentials);
  };


  const addAnnouncement = async (title: string, content: string) => {
    if (!user || user.role !== 'admin') {
      throw new Error("Only admins can post announcements.");
    }
    const newAnnouncement: Announcement = {
      id: uuidv4(),
      title,
      content,
      postedAt: new Date().toISOString(),
      postedBy: user.name || user.employeeId,
    };
    const updatedAnnouncements = [newAnnouncement, ...announcements];
    setAnnouncements(updatedAnnouncements);
    updateAnnouncementsInStorage(updatedAnnouncements);
  };

  const addAttendanceEvent = async (eventData: Omit<AttendanceEvent, 'id' | 'timestamp' | 'userName'>) => {
    if (!user) throw new Error("User not found for logging attendance.");
    
    const fullEvent: AttendanceEvent = {
      ...eventData,
      id: uuidv4(),
      timestamp: new Date().toISOString(),
      userName: user.name || user.employeeId,
      photoDataUrl: eventData.photoDataUrl, // Make sure photoDataUrl is passed through
      location: eventData.location,
      isWithinGeofence: eventData.isWithinGeofence,
    };

    const updatedLog = [fullEvent, ...attendanceLog];
    setAttendanceLog(updatedLog);
    updateAttendanceLogInStorage(updatedLog);
  };

  const addTask = async (task: TaskType) => {
    const newTasks = [task, ...tasks];
    setTasks(newTasks);
    updateTasksInStorage(newTasks);
  };

  const updateTask = async (updatedTask: TaskType) => {
    const newTasks = tasks.map(task => task.id === updatedTask.id ? updatedTask : task);
    setTasks(newTasks);
    updateTasksInStorage(newTasks);
  };

  return (
    <AuthContext.Provider value={{
        user,
        allUsers: allUsersState,
        role: user?.role || null,
        loading,
        announcements,
        attendanceLog,
        tasks,
        login,
        logout,
        setMockUser,
        requestAdvance,
        processAdvance,
        updateUserInContext,
        addNewEmployee,
        addAnnouncement,
        addAttendanceEvent,
        addTask,
        updateTask
    }}>
      {children}
    </AuthContext.Provider>
  );
};
