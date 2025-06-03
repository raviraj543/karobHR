
'use client';

import type { ReactNode } from 'react';
import { createContext, useState, useEffect }
from 'react';
import type { User, UserRole, Advance, Announcement, LeaveApplication, AttendanceEvent, Task as TaskType } from '@/lib/types';
import { v4 as uuidv4 } from 'uuid';
import { getFirebaseInstances } from './firebase/firebase';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  type User as FirebaseUser // Renamed to avoid conflict with our User type
} from 'firebase/auth';
import { doc, setDoc, getDoc, collection, writeBatch, query, where, getDocs, updateDoc, deleteDoc, arrayUnion, arrayRemove } from 'firebase/firestore';


// --- Mock Data for Initial State (will be phased out for Firestore) ---
const MOCK_ADMIN_ID = 'admin';
const MOCK_MANAGER_ID = 'manager01';
const MOCK_EMPLOYEE_ID = 'emp001';
const MOCK_PASSWORD = 'password123'; // Used for quick login buttons if these users exist in Firebase

const initialMockUserProfiles: Record<string, User> = {
  // These profiles are primarily for seeding `allUsersState` if localStorage is empty
  // Actual user profiles will live in Firestore.
  [MOCK_ADMIN_ID]: {
    id: 'firebase-uid-placeholder-admin', // This will be Firebase UID
    employeeId: MOCK_ADMIN_ID,
    name: 'Mock Admin',
    email: `${MOCK_ADMIN_ID}@karobhr-temp.firebaseapp.com`, // Example Firebase Auth email
    role: 'admin',
    department: 'Administration',
    joiningDate: '2023-01-01',
    baseSalary: 0,
    mockAttendanceFactor: 1.0,
    advances: [],
    leaves: [],
    profilePictureUrl: `https://placehold.co/100x100.png?text=AD`,
    // companyId: 'default-company-id' // Company ID will be crucial
  },
  // ... other mock profiles for manager and employee if needed for quick testing
};
// --- End Mock Data ---

export interface NewEmployeeData {
  name: string;
  employeeId: string;
  email?: string; // Optional: if not provided, will be constructed
  department: string;
  role: UserRole;
  companyId: string; // Each employee must belong to a company
  joiningDate?: string;
  baseSalary?: number;
}

export interface AuthContextType {
  user: User | null; // KarobHR User Profile
  firebaseUser: FirebaseUser | null; // Firebase Auth User object
  companyId: string | null; // Current user's company ID (derived from User profile)
  allUsers: User[]; // All users (for admin view, eventually from Firestore)
  role: UserRole | null; // Derived from KarobHR User profile
  loading: boolean;
  announcements: Announcement[];
  attendanceLog: AttendanceEvent[];
  tasks: TaskType[];
  login: (employeeId: string, pass: string, companyIdentifier?: string) => Promise<User | null>; // companyIdentifier might be needed for email construction
  logout: () => Promise<void>;
  addNewEmployee: (employeeData: NewEmployeeData, passwordToSet: string) => Promise<void>;
  // TODO: Update these to use Firestore
  requestAdvance: (employeeId: string, amount: number, reason: string) => Promise<void>;
  processAdvance: (targetEmployeeId: string, advanceId: string, newStatus: 'approved' | 'rejected') => Promise<void>;
  updateUserInContext: (updatedUser: User) => Promise<void>;
  addAnnouncement: (title: string, content: string) => Promise<void>;
  addAttendanceEvent: (eventData: Omit<AttendanceEvent, 'id' | 'timestamp' | 'userName'>) => Promise<void>;
  addTask: (task: TaskType) => Promise<void>;
  updateTask: (updatedTask: TaskType) => Promise<void>;
  setMockUser: (user: User | null) => void; // For testing, may be removed later
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

// Helper to create a Firebase-compatible email
// For now, we'll use a temporary domain. A real app might use company-specific subdomains or a passed company ID.
const TEMP_AUTH_DOMAIN = "karobhr-temp.firebaseapp.com";
const createFirebaseEmail = (employeeId: string): string => {
  const safeEmployeeId = employeeId.replace(/[^a-zA-Z0-9_.-]/g, '');
  return `${safeEmployeeId}@${TEMP_AUTH_DOMAIN}`;
};


export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<User | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // States for other app data - will be migrated to Firestore
  const [allUsersState, setAllUsersState] = useState<User[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [attendanceLog, setAttendanceLog] = useState<AttendanceEvent[]>([]);
  const [tasks, setTasks] = useState<TaskType[]>([]);

  // Load mock data from localStorage (will be replaced by Firestore calls)
  useEffect(() => {
    const storedAllUsers = localStorage.getItem('mockAllUsers');
    if (storedAllUsers) try { setAllUsersState(JSON.parse(storedAllUsers)); } catch (e) { console.error(e); }
    else {
        setAllUsersState(Object.values(initialMockUserProfiles));
        localStorage.setItem('mockAllUsers', JSON.stringify(Object.values(initialMockUserProfiles)));
    }

    const storedAnnouncements = localStorage.getItem('mockAnnouncements');
    if (storedAnnouncements) try {setAnnouncements(JSON.parse(storedAnnouncements));} catch(e) {console.error(e);}
    const storedAttendanceLog = localStorage.getItem('mockAttendanceLog');
    if (storedAttendanceLog) try {setAttendanceLog(JSON.parse(storedAttendanceLog));} catch(e) {console.error(e);}
    const storedTasks = localStorage.getItem('mockTasks');
    if (storedTasks) try {setTasks(JSON.parse(storedTasks));} catch(e) {console.error(e);}
  }, []);

  // Firebase Auth state listener
  useEffect(() => {
    setLoading(true);
    const { auth: firebaseAuthService, db: firestore } = getFirebaseInstances();
    if (!firebaseAuthService || !firestore) {
        console.error("Firebase services not available in AuthProvider listener.");
        setLoading(false);
        return;
    }

    const unsubscribe = onAuthStateChanged(firebaseAuthService, async (fbUser) => {
      setFirebaseUser(fbUser);
      if (fbUser) {
        // User is signed in with Firebase. Fetch their KarobHR profile from Firestore.
        // For now, we simulate this by trying to find them in allUsersState.
        // This part needs to be replaced with a Firestore query.
        // Example: const userDocRef = doc(firestore, "users", fbUser.uid);
        //          const userDocSnap = await getDoc(userDocRef);
        //          if (userDocSnap.exists()) setUser(userDocSnap.data() as User);

        // TEMPORARY: Try to find user in allUsersState by matching employeeId from email.
        const employeeIdFromEmail = fbUser.email?.split('@')[0];
        const karobUserProfile = allUsersState.find(u => u.employeeId === employeeIdFromEmail);

        if (karobUserProfile) {
          setUser(karobUserProfile);
          // @ts-ignore // TODO: karobUserProfile needs companyId property
          setCompanyId(karobUserProfile.companyId || 'unknown-company'); // Placeholder
        } else {
          console.warn(`No KarobHR profile found for Firebase user: ${fbUser.email}. User might need to complete profile setup.`);
          setUser(null); // Or handle incomplete profile state
          setCompanyId(null);
        }
      } else {
        // User is signed out
        setUser(null);
        setCompanyId(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allUsersState]); // Re-run if allUsersState changes (relevant for mock data)


  const login = async (employeeId: string, pass: string, companyIdentifier?: string): Promise<User | null> => {
    setLoading(true);
    const { auth: firebaseAuthService } = getFirebaseInstances();
    if (!firebaseAuthService) throw new Error("Firebase Auth service not available.");

    // Construct email based on employeeId (and companyIdentifier if provided later)
    const authEmail = createFirebaseEmail(employeeId);

    try {
      const userCredential = await signInWithEmailAndPassword(firebaseAuthService, authEmail, pass);
      // onAuthStateChanged will handle setting firebaseUser and fetching KarobHR profile.
      // For now, we directly return the profile found by onAuthStateChanged (if any) or null.
      // This is a bit indirect, will be cleaner with Firestore.
      const profile = allUsersState.find(u => u.employeeId === employeeId); // Temporary
      setUser(profile || null);
      setLoading(false);
      return profile || null;
    } catch (error: any) {
      console.error("Firebase login error:", error);
      setLoading(false);
      throw error; // Re-throw to be caught by the form
    }
  };

  const logout = async () => {
    setLoading(true);
    const { auth: firebaseAuthService } = getFirebaseInstances();
     if (!firebaseAuthService) {
        console.warn("Firebase Auth service not available for logout. Clearing local state.");
        setUser(null);
        setFirebaseUser(null);
        setCompanyId(null);
        setLoading(false);
        return;
    }
    try {
      await signOut(firebaseAuthService);
      // onAuthStateChanged will clear user, firebaseUser, companyId
    } catch (error) {
      console.error("Error signing out from Firebase:", error);
    } finally {
      setLoading(false);
    }
  };

  const addNewEmployee = async (employeeData: NewEmployeeData, passwordToSet: string) => {
    const { auth: firebaseAuthService, db: firestore } = getFirebaseInstances();
    if (!firebaseAuthService || !firestore) throw new Error("Firebase services not available.");

    const { employeeId, name, role, department, joiningDate, baseSalary, companyId: empCompanyId } = employeeData;
    const firebaseEmail = employeeData.email || createFirebaseEmail(employeeId);

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

    const newUserProfile: User = {
      id: newFirebaseUser.uid, // Use Firebase UID as the primary ID for KarobHR profile
      employeeId,
      name,
      email: newFirebaseUser.email || firebaseEmail,
      role,
      department: department || (role === 'admin' ? 'Administration' : 'N/A'),
      joiningDate: joiningDate || new Date().toISOString().split('T')[0],
      baseSalary: baseSalary || (role === 'admin' ? 0 : undefined),
      mockAttendanceFactor: 1.0, // Default
      advances: [],
      leaves: [],
      profilePictureUrl: `https://placehold.co/100x100.png?text=${name.split(' ').map(n=>n[0]).join('').toUpperCase() || 'NA'}`,
      // @ts-ignore // Add companyId to User type definition
      companyId: empCompanyId,
    };

    try {
      // Store KarobHR profile in Firestore, namespaced by companyId
      // Path: /companies/{companyId}/employees/{firebaseUser.uid}
      const userDocRef = doc(firestore, "companies", empCompanyId, "employees", newFirebaseUser.uid);
      await setDoc(userDocRef, newUserProfile);
      console.log("Employee profile stored in Firestore:", newUserProfile);
    } catch (error) {
      console.error("Error storing employee profile in Firestore:", error);
      // TODO: Consider rolling back Firebase Auth user creation if Firestore write fails
      throw new Error("Failed to store employee profile in Firestore.");
    }

    // Update local mock state (will be removed once Firestore is the source of truth for allUsers)
    const updatedAllUsers = [...allUsersState, newUserProfile];
    setAllUsersState(updatedAllUsers);
    localStorage.setItem('mockAllUsers', JSON.stringify(updatedAllUsers));
  };

  // Mock/Placeholder functions - to be refactored with Firestore
  const updateUserInStorage = (usersArray: User[]) => {
    localStorage.setItem('mockAllUsers', JSON.stringify(usersArray));
    if (user) {
        const updatedLoggedInUser = usersArray.find(u => u.id === user.id); // Match by main ID
        if (updatedLoggedInUser) setUser(updatedLoggedInUser); else setUser(null);
    }
  };
  const requestAdvance = async (employeeId: string, amount: number, reason: string) => {
    console.warn("requestAdvance: Using localStorage mock.");
    const targetUserIndex = allUsersState.findIndex(u => u.employeeId === employeeId);
    if (targetUserIndex === -1) throw new Error("User not found.");
    const newAdvance: Advance = { id: uuidv4(), employeeId, amount, reason, dateRequested: new Date().toISOString(), status: 'pending' };
    const updatedAllUsers = [...allUsersState];
    updatedAllUsers[targetUserIndex].advances = [...(updatedAllUsers[targetUserIndex].advances || []), newAdvance];
    setAllUsersState(updatedAllUsers); updateUserInStorage(updatedAllUsers);
  };
  const processAdvance = async (targetEmployeeId: string, advanceId: string, newStatus: 'approved' | 'rejected') => {
    console.warn("processAdvance: Using localStorage mock.");
    const targetUserIndex = allUsersState.findIndex(u => u.employeeId === targetEmployeeId);
    if (targetUserIndex === -1 || !allUsersState[targetUserIndex].advances) throw new Error("User or advances not found.");
    const advanceIndex = allUsersState[targetUserIndex].advances!.findIndex(adv => adv.id === advanceId);
    if (advanceIndex === -1) throw new Error("Advance ID not found.");
    const updatedAllUsers = [...allUsersState];
    updatedAllUsers[targetUserIndex].advances![advanceIndex] = { ...updatedAllUsers[targetUserIndex].advances![advanceIndex], status: newStatus, dateProcessed: new Date().toISOString() };
    setAllUsersState(updatedAllUsers); updateUserInStorage(updatedAllUsers);
  };
  const updateUserInContext = async (updatedProfileData: User) => {
    console.warn("updateUserInContext: Using localStorage mock. Needs Firestore update.");
     if (!firebaseUser || !companyId) throw new Error("No authenticated user or company context to update profile.");
    // TODO: Firestore update: const userDocRef = doc(firestore, "companies", companyId, "employees", firebaseUser.uid);
    // await updateDoc(userDocRef, { ...updatedProfileData });
    setUser(prevUser => ({ ...prevUser, ...updatedProfileData } as User));
    setAllUsersState(prevAll => prevAll.map(u => u.id === updatedProfileData.id ? updatedProfileData : u));
    updateUserInStorage(allUsersState.map(u => u.id === updatedProfileData.id ? updatedProfileData : u));
  };
  const addAnnouncement = async (title: string, content: string) => {
    console.warn("addAnnouncement: Using localStorage mock.");
    if (!user || user.role !== 'admin') throw new Error("Unauthorized.");
    const newAnnouncement: Announcement = { id: uuidv4(), title, content, postedAt: new Date().toISOString(), postedBy: user.name || user.employeeId };
    const updatedAnnouncements = [newAnnouncement, ...announcements];
    setAnnouncements(updatedAnnouncements); localStorage.setItem('mockAnnouncements', JSON.stringify(updatedAnnouncements));
  };
  const addAttendanceEvent = async (eventData: Omit<AttendanceEvent, 'id' | 'timestamp' | 'userName'>) => {
    console.warn("addAttendanceEvent: Using localStorage mock.");
    if (!user) throw new Error("User not found.");
    const fullEvent: AttendanceEvent = { ...eventData, id: uuidv4(), timestamp: new Date().toISOString(), userName: user.name || user.employeeId };
    const updatedLog = [fullEvent, ...attendanceLog];
    setAttendanceLog(updatedLog); localStorage.setItem('mockAttendanceLog', JSON.stringify(updatedLog));
  };
  const addTask = async (task: TaskType) => {
    console.warn("addTask: Using localStorage mock.");
    const newTasks = [task, ...tasks];
    setTasks(newTasks); localStorage.setItem('mockTasks', JSON.stringify(newTasks));
  };
  const updateTask = async (updatedTask: TaskType) => {
    console.warn("updateTask: Using localStorage mock.");
    const newTasks = tasks.map(t => t.id === updatedTask.id ? updatedTask : t);
    setTasks(newTasks); localStorage.setItem('mockTasks', JSON.stringify(newTasks));
  };
  const setMockUser = (mu: User | null) => { /* Kept for legacy, but Firebase drives user state now */ setUser(mu); };


  return (
    <AuthContext.Provider value={{
        user,
        firebaseUser,
        companyId,
        allUsers: allUsersState,
        role: user?.role || null,
        loading,
        announcements,
        attendanceLog,
        tasks,
        login,
        logout,
        addNewEmployee,
        requestAdvance,
        processAdvance,
        updateUserInContext,
        addAnnouncement,
        addAttendanceEvent,
        addTask,
        updateTask,
        setMockUser
    }}>
      {children}
    </AuthContext.Provider>
  );
};
