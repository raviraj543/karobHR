
'use client';

import type { ReactNode } from 'react';
import { createContext, useState, useEffect }
from 'react';
import type { User, UserRole, Advance, Announcement, LeaveApplication, AttendanceEvent, LocationInfo, Task as TaskType } from '@/lib/types';
import { v4 as uuidv4 } from 'uuid';
import { getFirebaseInstances } from './firebase/firebase'; // Import Firebase
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut,
  onAuthStateChanged,
  type User as FirebaseUser
} from 'firebase/auth';
import { doc, setDoc, getDoc, collection, writeBatch, query, where, getDocs, updateDoc, deleteDoc, arrayUnion, arrayRemove } from 'firebase/firestore';


// --- Mock Data for Quick Login (will be used if localStorage is empty) ---
const MOCK_ADMIN_ID = 'admin';
const MOCK_MANAGER_ID = 'manager01';
const MOCK_EMPLOYEE_ID = 'emp001';
const MOCK_PASSWORD = 'password123';

const initialMockUserProfiles: Record<string, User> = {
  [MOCK_ADMIN_ID]: {
    id: 'mock-admin-uuid', // This ID will be replaced by Firebase UID upon actual creation
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

// Mock credentials only for initial seeding if localStorage is empty
const initialMockCredentials: Record<string, string> = {
  [MOCK_ADMIN_ID]: MOCK_PASSWORD,
  [MOCK_MANAGER_ID]: MOCK_PASSWORD,
  [MOCK_EMPLOYEE_ID]: MOCK_PASSWORD,
};
// --- End Mock Data ---

export interface NewEmployeeData {
  name: string;
  employeeId: string;
  email?: string; // Will be used for Firebase Auth
  department: string;
  role: UserRole;
  joiningDate?: string;
  baseSalary?: number;
  companyId: string; // Crucial for multi-tenancy
}

export interface AuthContextType {
  user: User | null; // KarobHR User Profile
  firebaseUser: FirebaseUser | null; // Firebase Auth User
  companyId: string | null; // Current user's companyId
  allUsers: User[]; // Users for the current company
  role: UserRole;
  loading: boolean;
  announcements: Announcement[];
  attendanceLog: AttendanceEvent[];
  tasks: TaskType[];
  login: (employeeId: string, pass: string, rememberMe?: boolean) => Promise<User | null>;
  logout: () => Promise<void>;
  setMockUser: (user: User | null) => void; // Kept for potential testing needs
  requestAdvance: (employeeId: string, amount: number, reason: string) => Promise<void>;
  processAdvance: (targetEmployeeId: string, advanceId: string, newStatus: 'approved' | 'rejected') => Promise<void>;
  updateUserInContext: (updatedUser: User) => Promise<void>; // Will update Firestore
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

// Helper to create a Firebase-compatible email from employeeId and companyId
const createFirebaseEmail = (employeeId: string, companyId: string): string => {
  // Replace characters not allowed in email local part, and ensure companyId is clean
  const safeEmployeeId = employeeId.replace(/[^a-zA-Z0-9_.-]/g, '');
  const safeCompanyId = companyId.replace(/[^a-zA-Z0-9-]/g, '').toLowerCase();
  return `${safeEmployeeId}@${safeCompanyId}.karobhr.app`; // Using a dummy domain
};


export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<User | null>(null); // KarobHR user profile
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null); // Firebase Auth user object
  const [companyId, setCompanyId] = useState<string | null>(null);
  
  // These states will eventually be fetched from Firestore based on companyId
  const [allUsersState, setAllUsersState] = useState<User[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [attendanceLog, setAttendanceLog] = useState<AttendanceEvent[]>([]);
  const [tasks, setTasks] = useState<TaskType[]>([]);
  
  const [loading, setLoading] = useState(true);

  // LocalStorage based mock credentials and user profiles state (for initial seeding/testing)
  const [mockCredentialsState, setMockCredentialsState] = useState<Record<string, string>>({});


  useEffect(() => {
    setLoading(true);
    const { auth: firebaseAuthService } = getFirebaseInstances();

    // TODO: Remove localStorage loading once Firestore is fully integrated
    // For now, it helps keep the app somewhat functional during transition
    const storedAllUsers = localStorage.getItem('mockAllUsers');
    if (storedAllUsers) {
      try { setAllUsersState(JSON.parse(storedAllUsers)); } catch (e) { console.error(e); }
    } else {
      localStorage.setItem('mockAllUsers', JSON.stringify(Object.values(initialMockUserProfiles)));
      setAllUsersState(Object.values(initialMockUserProfiles));
    }
    
    const storedCredentials = localStorage.getItem('mockCredentials');
    if (storedCredentials) {
      try { setMockCredentialsState(JSON.parse(storedCredentials)); } catch (e) { console.error(e); }
    } else {
      localStorage.setItem('mockCredentials', JSON.stringify(initialMockCredentials));
      setMockCredentialsState(initialMockCredentials);
    }

    const storedAnnouncements = localStorage.getItem('mockAnnouncements');
    if (storedAnnouncements) try {setAnnouncements(JSON.parse(storedAnnouncements));} catch(e) {console.error(e);}
    const storedAttendanceLog = localStorage.getItem('mockAttendanceLog');
    if (storedAttendanceLog) try {setAttendanceLog(JSON.parse(storedAttendanceLog));} catch(e) {console.error(e);}
    const storedTasks = localStorage.getItem('mockTasks');
    if (storedTasks) try {setTasks(JSON.parse(storedTasks));} catch(e) {console.error(e);}


    // Listen for Firebase Auth state changes
    const unsubscribe = onAuthStateChanged(firebaseAuthService, async (fbUser) => {
      setFirebaseUser(fbUser);
      if (fbUser) {
        // TODO: Fetch KarobHR user profile from Firestore using fbUser.uid
        // This profile will contain role, department, companyId, etc.
        // For now, try to find from localStorage mocks if it's a quick login.
        const mockProfile = allUsersState.find(u => u.email === fbUser.email); // Assuming email is used for mapping
        if (mockProfile) {
            setUser(mockProfile);
            // TODO: setCompanyId from the fetched Firestore profile
            // For now, if it's a mock admin, we can assume a mock companyId or handle admin differently.
             if (mockProfile.role === 'admin' && mockProfile.employeeId === MOCK_ADMIN_ID) {
                 setCompanyId('mock-karobhr-company'); // Placeholder for admin
             } else {
                 // Placeholder until actual companyId is in user profile
                 setCompanyId(mockProfile.email?.split('@')[1].split('.')[0] || null);
             }

        } else {
            // This means user is logged in with Firebase, but we don't have their KarobHR profile yet.
            // This scenario needs to be handled (e.g., redirect to profile setup or error).
            console.warn("Firebase user logged in, but no KarobHR profile found (this is expected during transition).");
            setUser(null);
            setCompanyId(null);
        }
      } else {
        setUser(null);
        setCompanyId(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run once on mount

  // TODO: Refactor all data persistence to use Firestore, scoped by companyId
  const updateUserInStorage = (usersArray: User[]) => {
    localStorage.setItem('mockAllUsers', JSON.stringify(usersArray));
    if (user) {
        const updatedLoggedInUser = usersArray.find(u => u.employeeId === user.employeeId);
        if (updatedLoggedInUser) {
            setUser(updatedLoggedInUser);
        } else {
            setUser(null);
        }
    }
  };
  const updateCredentialsInStorage = (credentialsMap: Record<string, string>) => {
    localStorage.setItem('mockCredentials', JSON.stringify(credentialsMap));
  };
  const updateAnnouncementsInStorage = (announcementsArray: Announcement[]) => localStorage.setItem('mockAnnouncements', JSON.stringify(announcementsArray));
  const updateAttendanceLogInStorage = (log: AttendanceEvent[]) => localStorage.setItem('mockAttendanceLog', JSON.stringify(log));
  const updateTasksInStorage = (tasksArray: TaskType[]) => localStorage.setItem('mockTasks', JSON.stringify(tasksArray));


  const login = async (employeeId: string, pass: string, _rememberMe?: boolean): Promise<User | null> => {
    setLoading(true);
    const { auth: firebaseAuthService, db: firestore } = getFirebaseInstances();

    // --- Fallback to Mock Login for quick testing (REMOVE FOR PRODUCTION) ---
    const mockProfileForLogin = allUsersState.find(u => u.employeeId === employeeId);
    const expectedMockPassword = mockCredentialsState[employeeId];
    if (mockProfileForLogin && expectedMockPassword === pass) {
        // This simulates finding the companyId and then logging in with a Firebase-conventional email.
        // In a real multi-tenant app, the company context might be known from a subdomain or a company code input.
        const tempCompanyId = mockProfileForLogin.email?.split('@')[1].split('.')[0] || 'mock-company';
        const firebaseEmail = createFirebaseEmail(employeeId, tempCompanyId);
        
        try {
            const userCredential = await signInWithEmailAndPassword(firebaseAuthService, firebaseEmail, pass);
            // Firebase onAuthStateChanged will handle setting firebaseUser and fetching KarobHR profile.
            // For quick login, we directly set the mock KarobHR profile if Firebase auth succeeds.
             if (userCredential.user) {
                setUser(mockProfileForLogin);
                setCompanyId(tempCompanyId); // Set companyId from mock profile context
                setFirebaseUser(userCredential.user); // Ensure firebaseUser is also set
                setLoading(false);
                return mockProfileForLogin;
            }
        } catch (error) {
            console.warn("Firebase login failed for mock user, proceeding with pure mock login:", error);
            // If Firebase login fails for a mock user (e.g. not yet created in Firebase),
            // still allow mock login for testing.
            setUser(mockProfileForLogin);
            setCompanyId(tempCompanyId);
            setFirebaseUser(null); // No actual Firebase user for pure mock
            setLoading(false);
            return mockProfileForLogin;
        }
    }
    // --- End Fallback to Mock Login ---

    // TODO: Implement proper Firebase login.
    // 1. Determine companyId (e.g., from a company code field on login page).
    // 2. Construct email: e.g., `${employeeId}@${companyId}.karobhr.app`.
    // 3. Call signInWithEmailAndPassword.
    // 4. onAuthStateChanged will fetch KarobHR profile from Firestore.
    console.error("Firebase login not fully implemented beyond mock fallback.");
    setLoading(false);
    return null; // Placeholder
  };

  const logout = async () => {
    setLoading(true);
    const { auth: firebaseAuthService } = getFirebaseInstances();
    try {
      await signOut(firebaseAuthService);
    } catch (error) {
      console.error("Error signing out from Firebase:", error);
    }
    // onAuthStateChanged will clear user, firebaseUser, companyId
    // Clear localStorage mocks
    localStorage.removeItem('mockUser'); 
    // Do not clear allUsersState or mockCredentialsState as they might be needed for quick login again.
    setLoading(false);
  };
  
  const addNewEmployee = async (employeeData: NewEmployeeData, passwordToSet: string) => {
    const { auth: firebaseAuthService, db: firestore } = getFirebaseInstances();
    const { companyId: empCompanyId, email: providedEmail, employeeId, name, role, department, joiningDate, baseSalary } = employeeData;

    if (!empCompanyId) {
        throw new Error("Company ID is required to add a new employee.");
    }

    const firebaseEmail = providedEmail || createFirebaseEmail(employeeId, empCompanyId);

    // TODO: Create user in Firebase Authentication
    let newFirebaseUser: FirebaseUser | null = null;
    try {
        const userCredential = await createUserWithEmailAndPassword(firebaseAuthService, firebaseEmail, passwordToSet);
        newFirebaseUser = userCredential.user;
    } catch (error: any) {
        console.error("Error creating employee in Firebase Auth:", error);
        throw new Error(`Failed to create Firebase Auth user: ${error.message}`);
    }

    if (!newFirebaseUser) {
        throw new Error("Firebase user creation failed silently.");
    }
    
    // TODO: Store KarobHR user profile in Firestore, namespaced by companyId
    // Example path: /companies/{companyId}/employees/{firebaseUser.uid}
    const newUserProfile: User = {
      id: newFirebaseUser.uid, // Use Firebase UID as the primary ID
      employeeId,
      name,
      email: newFirebaseUser.email || firebaseEmail, // Use email from FirebaseUser if available
      role,
      department: department || (role === 'admin' ? 'Administration' : 'N/A'),
      joiningDate: joiningDate || new Date().toISOString().split('T')[0],
      baseSalary: baseSalary || (role === 'admin' ? 0 : undefined),
      mockAttendanceFactor: 1.0,
      advances: [],
      leaves: [],
      profilePictureUrl: `https://placehold.co/100x100.png?text=${name.split(' ').map(n=>n[0]).join('').toUpperCase() || 'NA'}`,
      // companyId: empCompanyId, // Store companyId with the user profile
    };

    try {
        const userDocRef = doc(firestore, "companies", empCompanyId, "employees", newFirebaseUser.uid);
        await setDoc(userDocRef, newUserProfile);
        console.log("Employee profile stored in Firestore.");
    } catch (error) {
        console.error("Error storing employee profile in Firestore:", error);
        // TODO: Consider rolling back Firebase Auth user creation if Firestore write fails
        throw new Error("Failed to store employee profile in Firestore.");
    }


    // Update local mock state (will be removed once Firestore is the source of truth)
    const updatedAllUsers = [...allUsersState, newUserProfile];
    setAllUsersState(updatedAllUsers);
    updateUserInStorage(updatedAllUsers);
    const updatedCredentials = { ...mockCredentialsState, [employeeId]: passwordToSet };
    setMockCredentialsState(updatedCredentials);
    updateCredentialsInStorage(updatedCredentials);
  };

  // Placeholder for setMockUser, may not be needed with Firebase
  const setMockUser = (mockUser: User | null) => {
    setUser(mockUser);
    // This function's utility diminishes as Firebase becomes the source of truth.
  };
  
  // TODO: Refactor these functions to use Firestore, scoped by companyId
  const requestAdvance = async (employeeId: string, amount: number, reason: string) => {
    if (!user || !companyId) throw new Error("User or company context not found.");
    // Firestore logic to add advance to /companies/{companyId}/employees/{userId}/advances
    console.warn("requestAdvance: Firestore not implemented yet. Using localStorage mock.");
    const targetUserIndex = allUsersState.findIndex(u => u.employeeId === employeeId);
    if (targetUserIndex === -1) throw new Error("User not found for advance request.");
    const newAdvance: Advance = { id: uuidv4(), employeeId, amount, reason, dateRequested: new Date().toISOString(), status: 'pending' };
    const updatedAllUsers = [...allUsersState];
    updatedAllUsers[targetUserIndex].advances = [...(updatedAllUsers[targetUserIndex].advances || []), newAdvance];
    setAllUsersState(updatedAllUsers); updateUserInStorage(updatedAllUsers);
  };

  const processAdvance = async (targetEmployeeId: string, advanceId: string, newStatus: 'approved' | 'rejected') => {
     if (!user || !companyId) throw new Error("User or company context not found.");
    // Firestore logic to update advance in /companies/{companyId}/employees/{userId}/advances
    console.warn("processAdvance: Firestore not implemented yet. Using localStorage mock.");
    const targetUserIndex = allUsersState.findIndex(u => u.employeeId === targetEmployeeId);
    if (targetUserIndex === -1 || !allUsersState[targetUserIndex].advances) throw new Error("User or advances not found.");
    const advanceIndex = allUsersState[targetUserIndex].advances!.findIndex(adv => adv.id === advanceId);
    if (advanceIndex === -1) throw new Error("Advance ID not found.");
    const updatedAllUsers = [...allUsersState];
    updatedAllUsers[targetUserIndex].advances![advanceIndex] = { ...updatedAllUsers[targetUserIndex].advances![advanceIndex], status: newStatus, dateProcessed: new Date().toISOString() };
    setAllUsersState(updatedAllUsers); updateUserInStorage(updatedAllUsers);
  };
  
  const updateUserInContext = async (updatedProfileData: User) => {
    if (!firebaseUser || !companyId) throw new Error("No authenticated user or company context to update profile.");
    const { db: firestore } = getFirebaseInstances();
    try {
        const userDocRef = doc(firestore, "companies", companyId, "employees", firebaseUser.uid);
        await updateDoc(userDocRef, { ...updatedProfileData }); // Spread to update fields
        setUser(prevUser => ({ ...prevUser, ...updatedProfileData } as User)); // Update local state
        // Also update in allUsersState if it's used for admin views
        setAllUsersState(prevAll => prevAll.map(u => u.id === firebaseUser.uid ? ({...u, ...updatedProfileData}) : u));
    } catch (error) {
        console.error("Error updating user profile in Firestore:", error);
        throw new Error("Failed to update user profile.");
    }
  };

  const addAnnouncement = async (title: string, content: string) => {
    if (!user || user.role !== 'admin' || !companyId) throw new Error("Unauthorized or no company context.");
    // Firestore: Add to /companies/{companyId}/announcements
    console.warn("addAnnouncement: Firestore not implemented yet. Using localStorage mock.");
    const newAnnouncement: Announcement = { id: uuidv4(), title, content, postedAt: new Date().toISOString(), postedBy: user.name || user.employeeId };
    const updatedAnnouncements = [newAnnouncement, ...announcements];
    setAnnouncements(updatedAnnouncements); updateAnnouncementsInStorage(updatedAnnouncements);
  };

  const addAttendanceEvent = async (eventData: Omit<AttendanceEvent, 'id' | 'timestamp' | 'userName'>) => {
    if (!user || !companyId) throw new Error("User or company context not found.");
    // Firestore: Add to /companies/{companyId}/attendanceLog or /companies/{companyId}/employees/{userId}/attendance
    console.warn("addAttendanceEvent: Firestore not implemented yet. Using localStorage mock.");
    const fullEvent: AttendanceEvent = { ...eventData, id: uuidv4(), timestamp: new Date().toISOString(), userName: user.name || user.employeeId };
    const updatedLog = [fullEvent, ...attendanceLog];
    setAttendanceLog(updatedLog); updateAttendanceLogInStorage(updatedLog);
  };

  const addTask = async (task: TaskType) => {
    if (!user || !companyId) throw new Error("User or company context not found.");
    // Firestore: Add to /companies/{companyId}/tasks
    console.warn("addTask: Firestore not implemented yet. Using localStorage mock.");
    const newTasks = [task, ...tasks];
    setTasks(newTasks); updateTasksInStorage(newTasks);
  };

  const updateTask = async (updatedTask: TaskType) => {
    if (!user || !companyId) throw new Error("User or company context not found.");
    // Firestore: Update in /companies/{companyId}/tasks
    console.warn("updateTask: Firestore not implemented yet. Using localStorage mock.");
    const newTasks = tasks.map(t => t.id === updatedTask.id ? updatedTask : t);
    setTasks(newTasks); updateTasksInStorage(newTasks);
  };


  return (
    <AuthContext.Provider value={{
        user,
        firebaseUser,
        companyId,
        allUsers: allUsersState, // This will eventually be fetched from Firestore for the current company
        role: user?.role || null,
        loading,
        announcements, // Will be fetched from Firestore for the current company
        attendanceLog, // Will be fetched/managed via Firestore
        tasks, // Will be fetched/managed via Firestore
        login,
        logout,
        setMockUser, // Kept for testing, but real flow will use Firebase
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
