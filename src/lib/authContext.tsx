
'use client';

import type { ReactNode } from 'react';
import React, { createContext, useState, useEffect, useCallback } from 'react';
import { 
  onAuthStateChanged, 
  signOut as firebaseSignOut, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  type User as FirebaseUser 
} from 'firebase/auth';
import { doc, getDoc, setDoc, collection, addDoc, updateDoc, deleteDoc, query, where, getDocs, onSnapshot, serverTimestamp, writeBatch, Timestamp, arrayUnion, arrayRemove } from 'firebase/firestore';
import { getFirebaseInstances } from '@/lib/firebase/firebase';
import type { User, UserRole, Task, LeaveApplication, Announcement, UserDirectoryEntry, Advance, AttendanceEvent, LocationInfo } from '@/lib/types';
import { initialTasks } from '@/lib/taskData';
import { getStorage, ref, uploadString, getDownloadURL, deleteObject } from "firebase/storage";
import { v4 as uuidv4 } from 'uuid';


// Immediately log that this module is being loaded.
console.log("==================================================================================");
console.log(">>> KAROBHR TRACE: Attempting to load src/lib/authContext.tsx module...");
console.log("==================================================================================");

export interface NewEmployeeData {
  name: string;
  employeeId: string;
  email?: string | null;
  department: string;
  role: UserRole;
  companyId: string; 
  joiningDate?: string;
  baseSalary?: number;
  profilePictureUrl?: string | null;
}

export interface AuthContextType {
  user: User | null;
  role: UserRole;
  loading: boolean;
  companyId: string | null;
  firebaseError: Error | null;
  login: (employeeId: string, password: string) => Promise<User | null>;
  logout: () => Promise<void>;
  addNewEmployee: (employeeData: NewEmployeeData, password?: string) => Promise<FirebaseUser | null>;
  allUsers: User[];
  tasks: Task[];
  addTask: (task: Task) => Promise<void>;
  updateTask: (task: Task) => Promise<void>;
  deleteTask?: (taskId: string) => Promise<void>; // Optional for now
  leaveApplications: LeaveApplication[];
  addLeaveApplication: (leaveData: Omit<LeaveApplication, 'id' | 'userId' | 'employeeId' | 'appliedAt' | 'status'>) => Promise<void>;
  processLeaveApplication: (employeeUid: string, leaveId: string, newStatus: 'approved' | 'rejected') => Promise<void>;
  announcements: Announcement[];
  addAnnouncement: (title: string, content: string) => Promise<void>;
  updateUserInContext: (updatedUser: User) => void;
  attendanceLog: AttendanceEvent[];
  addAttendanceEvent: (eventData: Omit<AttendanceEvent, 'id' | 'userId' | 'employeeId' | 'userName' | 'timestamp'> & { photoDataUrl?: string | null }) => Promise<void>;
  requestAdvance: (employeeId: string, amount: number, reason: string) => Promise<void>;
  processAdvance: (employeeId: string, advanceId: string, status: 'approved' | 'rejected') => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  console.log(">>> KAROBHR TRACE: AuthProvider component rendering/re-rendering...");

  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<UserRole>(null);
  const [loading, setLoading] = useState(true);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [firebaseError, setFirebaseError] = useState<Error | null>(null);

  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [leaveApplications, setLeaveApplications] = useState<LeaveApplication[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [attendanceLog, setAttendanceLog] = useState<AttendanceEvent[]>([]);

  // Attempt to get Firebase instances early.
  // This might throw if config is bad, which is handled by getFirebaseInstances now.
  let authInstance: ReturnType<typeof getFirebaseInstances>['auth'] | null = null;
  let dbInstance: ReturnType<typeof getFirebaseInstances>['db'] | null = null;
  let storageInstance: ReturnType<typeof getFirebaseInstances>['storage'] | null = null;

  try {
    console.log(">>> KAROBHR TRACE: AuthProvider trying to get Firebase instances...");
    const instances = getFirebaseInstances();
    authInstance = instances.auth;
    dbInstance = instances.db;
    storageInstance = instances.storage;
    if (instances.error) {
      console.error(">>> KAROBHR TRACE: Firebase initialization error detected by AuthProvider from getFirebaseInstances:", instances.error);
      setFirebaseError(instances.error);
    } else {
       console.log(">>> KAROBHR TRACE: AuthProvider successfully got Firebase instances. Auth ready:", !!authInstance);
    }
  } catch (error: any) {
    console.error(">>> KAROBHR TRACE: CRITICAL ERROR getting Firebase instances in AuthProvider:", error);
    setFirebaseError(error);
  }


  const fetchUserData = useCallback(async (firebaseUser: FirebaseUser, currentDb: typeof dbInstance, currentCompanyId?: string) => {
    if (!currentDb) {
      console.error(">>> KAROBHR TRACE: fetchUserData - Firestore instance not available.");
      setFirebaseError(new Error("Firestore not available for fetching user data."));
      setLoading(false);
      return null;
    }
    console.log(`>>> KAROBHR TRACE: fetchUserData for UID: ${firebaseUser.uid}`);
    try {
      const userDocRef = doc(currentDb, `users/${firebaseUser.uid}`);
      const userDocSnap = await getDoc(userDocRef);
      if (userDocSnap.exists()) {
        const userData = userDocSnap.data() as User;
        console.log(">>> KAROBHR TRACE: User data fetched:", userData.employeeId, userData.role, userData.companyId);
        setUser(userData);
        setRole(userData.role);
        setCompanyId(userData.companyId); // Set companyId from user document
        return userData;
      } else {
        console.warn(`>>> KAROBHR TRACE: No user document found in Firestore for UID: ${firebaseUser.uid}. This might be an new admin signup flow or an error.`);
        // This case needs careful handling. If it's a new admin signup, userDoc might not exist yet.
        // For now, we assume if onAuthStateChanged gives a user, their doc *should* exist or be created shortly.
        // If a companyId was passed (e.g. during initial admin creation flow), use it.
        if (currentCompanyId) setCompanyId(currentCompanyId);
        return null;
      }
    } catch (error) {
      console.error(">>> KAROBHR TRACE: Error fetching user data from Firestore:", error);
      setFirebaseError(new Error("Failed to fetch user data."));
      return null;
    }
  }, []);


  useEffect(() => {
    console.log(">>> KAROBHR TRACE: AuthProvider useEffect for onAuthStateChanged running. Auth instance available:", !!authInstance);
    if (!authInstance) {
      console.error(">>> KAROBHR TRACE: Auth instance not available in onAuthStateChanged useEffect. Firebase might not be initialized.");
      if (!firebaseError) { // if firebaseError wasn't already set by the getInstances() catch block
         setFirebaseError(new Error("Firebase Authentication service is not available. Check Firebase configuration."));
      }
      setLoading(false); // Stop loading as auth cannot be checked
      setUser(null);
      setRole(null);
      setCompanyId(null);
      return; // Cannot proceed without auth
    }

    const unsubscribe = onAuthStateChanged(authInstance, async (firebaseUser) => {
      console.log(">>> KAROBHR TRACE: onAuthStateChanged triggered. Firebase user:", firebaseUser ? firebaseUser.uid : 'null');
      if (firebaseUser) {
        setLoading(true);
        await fetchUserData(firebaseUser, dbInstance);
        // setLoading(false) will be handled by data fetching listeners or fetchUserData if no listeners
      } else {
        setUser(null);
        setRole(null);
        setCompanyId(null);
        setAllUsers([]);
        setTasks([]);
        setLeaveApplications([]);
        setAnnouncements([]);
        setAttendanceLog([]);
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, [authInstance, fetchUserData, dbInstance, firebaseError]);


  // Listener for all users in the company (for Admin views)
  useEffect(() => {
    if (!dbInstance || !user || !companyId || role !== 'admin') {
      if (role === 'admin' && (!dbInstance || !companyId)) {
        console.warn(">>> KAROBHR TRACE: Admin user detected, but Firestore or companyId not ready for allUsers listener.");
      }
      setAllUsers([]);
      return;
    }
    console.log(`>>> KAROBHR TRACE: Setting up allUsers listener for companyId: ${companyId}`);
    const usersQuery = query(collection(dbInstance, 'users'), where('companyId', '==', companyId));
    const unsubscribe = onSnapshot(usersQuery, (snapshot) => {
      const usersList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User));
      setAllUsers(usersList);
      console.log(">>> KAROBHR TRACE: Fetched all users for admin:", usersList.length);
    }, (error) => {
      console.error(">>> KAROBHR TRACE: Error fetching all users:", error);
      setFirebaseError(new Error("Failed to fetch company users."));
    });
    return () => unsubscribe();
  }, [dbInstance, user, companyId, role]);


  // Listener for tasks (company-wide for admin, user-specific otherwise)
   useEffect(() => {
    if (!dbInstance || !user || !companyId) {
      setTasks([]);
      if (!user && !loading && !firebaseError){ /* console.log("Task listener: No user or companyId, clearing tasks") */ }
      else if (user && !companyId && !loading && !firebaseError) { console.warn("Task listener: User exists but no companyId, clearing tasks"); }
      return;
    }

    let tasksQuery;
    if (role === 'admin') {
      console.log(`>>> KAROBHR TRACE: Setting up ADMIN tasks listener for companyId: ${companyId}`);
      tasksQuery = query(collection(dbInstance, `companies/${companyId}/tasks`));
    } else {
      console.log(`>>> KAROBHR TRACE: Setting up USER tasks listener for employeeId: ${user.employeeId} in companyId: ${companyId}`);
      tasksQuery = query(collection(dbInstance, `companies/${companyId}/tasks`), where('assigneeId', '==', user.employeeId));
    }

    const unsubscribe = onSnapshot(tasksQuery, (snapshot) => {
      const tasksList = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Task));
      setTasks(tasksList);
      console.log(`>>> KAROBHR TRACE: Tasks updated for ${role === 'admin' ? 'admin' : user.employeeId}:`, tasksList.length);
      if (loading && user) setLoading(false); // Consider main data loaded
    }, (error) => {
      console.error(">>> KAROBHR TRACE: Error fetching tasks:", error);
      setFirebaseError(new Error("Failed to fetch tasks."));
      if (loading && user) setLoading(false);
    });

    return () => unsubscribe();
  }, [dbInstance, user, companyId, role, loading]);

  // Listener for announcements (company-wide)
  useEffect(() => {
    if (!dbInstance || !companyId) {
      setAnnouncements([]);
      return;
    }
    console.log(`>>> KAROBHR TRACE: Setting up announcements listener for companyId: ${companyId}`);
    const announcementsQuery = query(collection(dbInstance, `companies/${companyId}/announcements`));
    const unsubscribe = onSnapshot(announcementsQuery, (snapshot) => {
      const announcementsList = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Announcement))
        .sort((a, b) => new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime());
      setAnnouncements(announcementsList);
      console.log(">>> KAROBHR TRACE: Announcements updated:", announcementsList.length);
    }, (error) => {
      console.error(">>> KAROBHR TRACE: Error fetching announcements:", error);
      setFirebaseError(new Error("Failed to fetch announcements."));
    });
    return () => unsubscribe();
  }, [dbInstance, companyId]);

  // Listener for all attendance events in the company (for Admin views)
  useEffect(() => {
    if (!dbInstance || !companyId || (role !== 'admin' && role !== 'manager')) { // Allow manager to see this too
        setAttendanceLog([]);
        return;
    }
    console.log(`>>> KAROBHR TRACE: Setting up attendanceLog listener for companyId: ${companyId} (Role: ${role})`);
    const attendanceQuery = query(collection(dbInstance, `companies/${companyId}/attendanceLog`));
    const unsubscribe = onSnapshot(attendanceQuery, (snapshot) => {
        const logList = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as AttendanceEvent));
        setAttendanceLog(logList);
        console.log(">>> KAROBHR TRACE: Attendance log updated:", logList.length);
    }, (error) => {
        console.error(">>> KAROBHR TRACE: Error fetching attendance log:", error);
        setFirebaseError(new Error("Failed to fetch attendance log."));
    });
    return () => unsubscribe();
  }, [dbInstance, companyId, role]);


  const login = async (employeeIdInput: string, passwordInput: string): Promise<User | null> => {
    if (!authInstance || !dbInstance) {
      console.error(">>> KAROBHR TRACE: Login failed - Firebase services not available.");
      setFirebaseError(new Error("Firebase services not available for login."));
      throw new Error("Authentication service not ready. Check Firebase config.");
    }
    setLoading(true);
    try {
      console.log(`>>> KAROBHR TRACE: Attempting login for employeeId: ${employeeIdInput}`);
      // Step 1: Look up user in userDirectory by employeeId (case-sensitive for employeeId)
      const userDirectoryQuery = query(collection(dbInstance, 'userDirectory'), where('employeeId', '==', employeeIdInput));
      const directorySnapshot = await getDocs(userDirectoryQuery);

      if (directorySnapshot.empty) {
        console.warn(`>>> KAROBHR TRACE: Login - No user found in directory for employeeId: ${employeeIdInput}`);
        throw new Error("Invalid User ID or Password."); // User ID doesn't exist
      }
      
      // Assuming employeeId is unique globally for now, or unique per company if companyId was also queried
      const userDirEntry = directorySnapshot.docs[0].data() as UserDirectoryEntry;
      const userEmail = userDirEntry.email; // This email is used for Firebase Auth
      const userCompanyId = userDirEntry.companyId;

      console.log(`>>> KAROBHR TRACE: Login - User found in directory. Email: ${userEmail}, CompanyID: ${userCompanyId}`);

      // Step 2: Sign in with Firebase Auth using the retrieved email
      const userCredential = await signInWithEmailAndPassword(authInstance, userEmail, passwordInput);
      const firebaseUser = userCredential.user;
      console.log(`>>> KAROBHR TRACE: Login - Firebase Auth successful for UID: ${firebaseUser.uid}`);

      // Step 3: Fetch full user profile from 'users' collection
      const loggedInUser = await fetchUserData(firebaseUser, dbInstance);
      if (loggedInUser) {
         if (loggedInUser.companyId !== userCompanyId) {
            console.error(`>>> KAROBHR TRACE: Login - Mismatch! User doc companyId (${loggedInUser.companyId}) vs Dir entry companyId (${userCompanyId})`);
            // This is a serious data integrity issue. For now, sign out and throw.
            await firebaseSignOut(authInstance);
            throw new Error("User data inconsistency. Please contact support.");
         }
        console.log(`>>> KAROBHR TRACE: Login successful for ${loggedInUser.name} (${loggedInUser.employeeId})`);
        return loggedInUser;
      } else {
        // This case should ideally not happen if auth succeeded and directory lookup was fine.
        // It implies the user document in `users/{uid}` is missing.
        console.error(`>>> KAROBHR TRACE: Login - Auth successful but user document not found for UID: ${firebaseUser.uid}. This is an error.`);
        await firebaseSignOut(authInstance); // Sign out the potentially inconsistent user
        throw new Error("Login succeeded but user profile could not be loaded.");
      }
    } catch (error: any) {
      console.error(">>> KAROBHR TRACE: Login error:", error.message || error);
      // Map Firebase auth errors to a generic message for security
      if (error.code?.startsWith('auth/')) {
        throw new Error("Invalid User ID or Password.");
      }
      throw error; // Re-throw other errors
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    if (!authInstance) {
      console.error(">>> KAROBHR TRACE: Logout failed - Firebase Auth not available.");
      return;
    }
    console.log(">>> KAROBHR TRACE: Logging out user...");
    setLoading(true);
    try {
      await firebaseSignOut(authInstance);
      setUser(null);
      setRole(null);
      setCompanyId(null);
      setAllUsers([]);
      setTasks([]);
      setLeaveApplications([]);
      setAnnouncements([]);
      setAttendanceLog([]);
      console.log(">>> KAROBHR TRACE: User logged out successfully.");
    } catch (error) {
      console.error(">>> KAROBHR TRACE: Logout error:", error);
      setFirebaseError(new Error("Logout failed."));
    } finally {
      setLoading(false);
    }
  };

  const addNewEmployee = async (employeeData: NewEmployeeData, passwordInput?: string): Promise<FirebaseUser | null> => {
    if (!authInstance || !dbInstance) {
      console.error(">>> KAROBHR TRACE: addNewEmployee failed - Firebase services not available.");
      setFirebaseError(new Error("Firebase services not available for adding employee."));
      throw new Error("Firebase services not ready.");
    }
    if (!passwordInput && employeeData.role !== 'admin') { // Admin can be created without password if system handles it
        // For regular employees, password should be provided by admin or auto-generated securely
        console.error(">>> KAROBHR TRACE: Password is required for new employee/manager accounts.");
        throw new Error("Password is required for new employee/manager accounts.");
    }
    
    const finalPassword = passwordInput || `${employeeData.employeeId}DefaultPass!`; // Ensure password exists
    const finalEmail = employeeData.email || `${employeeData.employeeId.toLowerCase().replace(/[^a-z0-9]/gi, '')}@${employeeData.companyId.split('-')[0]}.karobhr.local`;


    console.log(`>>> KAROBHR TRACE: Attempting to add new employee/admin: ${employeeData.employeeId} for company ${employeeData.companyId}`);

    // Check if employeeId already exists in the userDirectory for the given company
    const directoryCheckQuery = query(collection(dbInstance, 'userDirectory'), where('employeeId', '==', employeeData.employeeId), where('companyId', '==', employeeData.companyId));
    const directoryCheckSnap = await getDocs(directoryCheckQuery);
    if (!directoryCheckSnap.empty) {
        console.error(`>>> KAROBHR TRACE: Employee ID ${employeeData.employeeId} already exists in company ${employeeData.companyId}.`);
        throw new Error(`Employee ID ${employeeData.employeeId} already exists in this company.`);
    }
    
    // Check if email already exists (Firebase Auth enforces email uniqueness globally)
    // This is a bit tricky without a specific Firebase function to check.
    // createUserWithEmailAndPassword will fail if email is taken.

    let firebaseUser: FirebaseUser | null = null;
    try {
      console.log(`>>> KAROBHR TRACE: Creating Firebase Auth user with email: ${finalEmail}`);
      const userCredential = await createUserWithEmailAndPassword(authInstance, finalEmail, finalPassword);
      firebaseUser = userCredential.user;
      console.log(`>>> KAROBHR TRACE: Firebase Auth user created successfully: ${firebaseUser.uid}`);

      const newUser: User = {
        id: firebaseUser.uid, // Firebase Auth UID
        employeeId: employeeData.employeeId,
        email: finalEmail,
        name: employeeData.name,
        role: employeeData.role,
        companyId: employeeData.companyId,
        department: employeeData.department,
        joiningDate: employeeData.joiningDate || new Date().toISOString().split('T')[0],
        baseSalary: employeeData.baseSalary || 0,
        profilePictureUrl: employeeData.profilePictureUrl || null,
        advances: [],
        leaves: [],
        mockAttendanceFactor: 1.0, // Default
      };

      const userDocRef = doc(dbInstance, `users/${firebaseUser.uid}`);
      const userDirectoryDocRef = doc(collection(dbInstance, 'userDirectory')); // Auto-generate ID

      const batch = writeBatch(dbInstance);
      batch.set(userDocRef, newUser);
      batch.set(userDirectoryDocRef, {
        userId: firebaseUser.uid,
        employeeId: newUser.employeeId,
        email: newUser.email,
        companyId: newUser.companyId,
        role: newUser.role,
        name: newUser.name,
      } as UserDirectoryEntry);
      
      await batch.commit();
      console.log(`>>> KAROBHR TRACE: User document and directory entry created for ${newUser.employeeId}`);
      
      // If the current user is an admin adding another user, we don't want to change the current user's state.
      // If it's an admin self-signup, onAuthStateChanged will handle setting the user state.
      // Manually update allUsers if current user is admin to reflect new user immediately
      if (user && user.role === 'admin' && user.companyId === newUser.companyId) {
        setAllUsers(prev => [...prev, newUser]);
      }

      return firebaseUser;

    } catch (error: any) {
      console.error(">>> KAROBHR TRACE: Error adding new employee:", error);
      // If Firebase user was created but Firestore failed, attempt to delete Firebase user for cleanup
      if (firebaseUser && error.code !== 'auth/email-already-in-use') { // Don't delete if the email was the issue for another user
        try {
          console.warn(`>>> KAROBHR TRACE: Attempting to delete Firebase Auth user ${firebaseUser.uid} due to Firestore error.`);
          // await firebaseUser.delete(); // This requires recent sign-in, might fail.
          // Deleting users programmatically is complex and often requires admin SDK.
          // For client-side, it's better to flag the account for manual review/deletion.
        } catch (deleteError) {
          console.error(">>> KAROBHR TRACE: Failed to clean up Firebase Auth user:", deleteError);
        }
      }
      if (error.code === 'auth/email-already-in-use') {
        throw new Error('This email address is already in use by another account.');
      } else if (error.code === 'auth/weak-password') {
        throw new Error('The password is too weak.');
      }
      throw new Error(error.message || "Could not add new employee.");
    }
  };

  const addTask = async (newTaskData: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (!dbInstance || !user || !companyId) {
        console.error(">>> KAROBHR TRACE: Cannot add task - DB, user or companyId not available.");
        throw new Error("User or company context not available to add task.");
    }
    console.log(`>>> KAROBHR TRACE: Adding task "${newTaskData.title}" for ${newTaskData.assigneeName} in company ${companyId}`);
    const taskWithTimestamps: Task = {
        ...newTaskData,
        id: '', // Firestore will generate
        createdAt: serverTimestamp() as unknown as string, // Placeholder for server timestamp
        updatedAt: serverTimestamp() as unknown as string,
    };
    try {
        const taskRef = await addDoc(collection(dbInstance, `companies/${companyId}/tasks`), taskWithTimestamps);
        console.log(">>> KAROBHR TRACE: Task added successfully with ID:", taskRef.id);
        // No need to setTasks, listener will pick it up.
    } catch (error) {
        console.error(">>> KAROBHR TRACE: Error adding task:", error);
        throw new Error("Failed to add task.");
    }
  };

  const updateTask = async (updatedTaskData: Task) => {
    if (!dbInstance || !companyId) {
        console.error(">>> KAROBHR TRACE: Cannot update task - DB or companyId not available.");
        throw new Error("Database or company context not available to update task.");
    }
    console.log(`>>> KAROBHR TRACE: Updating task ID ${updatedTaskData.id} in company ${companyId}`);
    const taskRef = doc(dbInstance, `companies/${companyId}/tasks/${updatedTaskData.id}`);
    try {
        await updateDoc(taskRef, { ...updatedTaskData, updatedAt: serverTimestamp() });
        console.log(">>> KAROBHR TRACE: Task updated successfully.");
        // No need to setTasks, listener will pick it up.
    } catch (error) {
        console.error(">>> KAROBHR TRACE: Error updating task:", error);
        throw new Error("Failed to update task.");
    }
  };

  const addLeaveApplication = async (leaveData: Omit<LeaveApplication, 'id' | 'userId' | 'employeeId' | 'appliedAt' | 'status'>) => {
    if (!dbInstance || !user) {
        console.error(">>> KAROBHR TRACE: Cannot add leave - DB or user not available.");
        throw new Error("User context not available to add leave application.");
    }
    console.log(`>>> KAROBHR TRACE: User ${user.employeeId} applying for leave: ${leaveData.leaveType}`);
    const newLeave: Omit<LeaveApplication, 'id'> = {
        ...leaveData,
        userId: user.id,
        employeeId: user.employeeId,
        status: 'pending',
        appliedAt: new Date().toISOString(), // Client-side timestamp for "appliedAt" is fine
    };
    try {
        const userDocRef = doc(dbInstance, `users/${user.id}`);
        // Store leave application as a subcollection or array within the user document.
        // Using arrayUnion to add to an array of leaves within the user document.
        // Ensure 'leaves' field is initialized as an array in Firestore user doc if it's the first leave.
        const leaveWithId = { ...newLeave, id: uuidv4() }; // Generate client-side ID for array storage
        await updateDoc(userDocRef, {
            leaves: arrayUnion(leaveWithId)
        });
        console.log(">>> KAROBHR TRACE: Leave application added for user:", user.employeeId);
        setUser(prevUser => prevUser ? ({ ...prevUser, leaves: [...(prevUser.leaves || []), leaveWithId]}) : null);
    } catch (error) {
        console.error(">>> KAROBHR TRACE: Error adding leave application:", error);
        throw new Error("Failed to submit leave application.");
    }
  };

  const processLeaveApplication = async (employeeFirebaseUID: string, leaveId: string, newStatus: 'approved' | 'rejected') => {
    if (!dbInstance || !user || user.role !== 'admin') { // Only admin can process
        console.error(">>> KAROBHR TRACE: Unauthorized or DB not available for processLeaveApplication.");
        throw new Error("Operation not allowed or DB not available.");
    }
    console.log(`>>> KAROBHR TRACE: Admin processing leave ID ${leaveId} for user UID ${employeeFirebaseUID} to status ${newStatus}`);
    const employeeDocRef = doc(dbInstance, `users/${employeeFirebaseUID}`);
    try {
        const employeeDocSnap = await getDoc(employeeDocRef);
        if (!employeeDocSnap.exists()) throw new Error("Employee document not found.");

        const employeeData = employeeDocSnap.data() as User;
        const leaves = employeeData.leaves || [];
        const leaveIndex = leaves.findIndex(l => l.id === leaveId);

        if (leaveIndex === -1) throw new Error("Leave application not found for this employee.");

        const updatedLeaves = [...leaves];
        updatedLeaves[leaveIndex] = {
            ...updatedLeaves[leaveIndex],
            status: newStatus,
            processedAt: new Date().toISOString(),
        };
        await updateDoc(employeeDocRef, { leaves: updatedLeaves });
        console.log(">>> KAROBHR TRACE: Leave application processed successfully.");
        // Update local allUsers state if the user being modified is in it
        setAllUsers(prevAllUsers => prevAllUsers.map(u => u.id === employeeFirebaseUID ? {...u, leaves: updatedLeaves} : u));

    } catch (error) {
        console.error(">>> KAROBHR TRACE: Error processing leave application:", error);
        throw new Error("Failed to process leave application.");
    }
  };

  const addAnnouncement = async (title: string, content: string) => {
    if (!dbInstance || !user || user.role !== 'admin' || !companyId) {
      console.error(">>> KAROBHR TRACE: Unauthorized or context missing for addAnnouncement.");
      throw new Error("Operation not allowed or company context missing.");
    }
    console.log(`>>> KAROBHR TRACE: Admin ${user.employeeId} posting announcement in company ${companyId}: ${title}`);
    const newAnnouncement: Omit<Announcement, 'id'> = {
      title,
      content,
      postedAt: serverTimestamp() as unknown as string, // Firestore server timestamp
      postedByUid: user.id,
      postedByName: user.name || user.employeeId,
    };
    try {
      await addDoc(collection(dbInstance, `companies/${companyId}/announcements`), newAnnouncement);
      console.log(">>> KAROBHR TRACE: Announcement posted successfully.");
      // Listener will update local state.
    } catch (error) {
      console.error(">>> KAROBHR TRACE: Error posting announcement:", error);
      throw new Error("Failed to post announcement.");
    }
  };
  
  const updateUserInContext = (updatedUser: User) => {
     console.log(">>> KAROBHR TRACE: Attempting to update user in context:", updatedUser.employeeId);
     if (user && user.id === updatedUser.id) {
        setUser(updatedUser);
        console.log(">>> KAROBHR TRACE: Current user updated in context.");
     }
     setAllUsers(prevAllUsers => prevAllUsers.map(u => u.id === updatedUser.id ? updatedUser : u));
     console.log(">>> KAROBHR TRACE: User updated in allUsers list (if present).");
     // Also update Firestore (this is a client-side update, admin might need more robust backend update)
     if (dbInstance && companyId) {
        const userDocRef = doc(dbInstance, `users/${updatedUser.id}`);
        updateDoc(userDocRef, updatedUser).catch(err => console.error(">>> KAROBHR TRACE: Failed to sync user update to Firestore:", err));
     }
  };

  const addAttendanceEvent = async (eventData: Omit<AttendanceEvent, 'id' | 'userId' | 'employeeId' | 'userName' | 'timestamp'> & { photoDataUrl?: string | null }) => {
    if (!dbInstance || !user || !companyId || !storageInstance) {
        console.error(">>> KAROBHR TRACE: Missing context for addAttendanceEvent (db, user, companyId, or storage).");
        throw new Error("Cannot record attendance: missing user, company, or storage context.");
    }
    console.log(`>>> KAROBHR TRACE: User ${user.employeeId} performing ${eventData.type} in company ${companyId}`);

    let photoFinalUrl: string | null = null;

    if (eventData.photoDataUrl) {
        console.log(">>> KAROBHR TRACE: Photo data URL provided, attempting to upload to storage...");
        const photoFileName = `${user.employeeId}-${new Date().getTime()}-${uuidv4()}.jpg`;
        // Path: companies/{companyId}/attendancePhotos/{userId}/{photoFileName}
        const photoRef = ref(storageInstance, `companies/${companyId}/attendancePhotos/${user.id}/${photoFileName}`);
        try {
            // photoDataUrl is base64 encoded: "data:image/jpeg;base64,/9j/4AA..."
            // We need to extract the base64 part for uploadString.
            const base64String = eventData.photoDataUrl.split(',')[1];
            if (!base64String) throw new Error("Invalid photo data URL format for base64 extraction.");

            const snapshot = await uploadString(photoRef, base64String, 'base64', { contentType: 'image/jpeg' });
            photoFinalUrl = await getDownloadURL(snapshot.ref);
            console.log(">>> KAROBHR TRACE: Photo uploaded successfully:", photoFinalUrl);
        } catch (uploadError) {
            console.error(">>> KAROBHR TRACE: Error uploading attendance photo:", uploadError);
            // Proceed without photo if upload fails, but log it. Don't throw, as attendance itself might be more critical.
            // Could also set an error state or specific field in the attendance event.
        }
    }


    const newAttendanceEvent: Omit<AttendanceEvent, 'id'> = {
        userId: user.id,
        employeeId: user.employeeId,
        userName: user.name || user.employeeId,
        type: eventData.type,
        timestamp: new Date().toISOString(), // Use current client time, can be replaced by serverTimestamp if written directly
        photoUrl: photoFinalUrl, // URL from Firebase Storage
        location: eventData.location,
        isWithinGeofence: eventData.isWithinGeofence,
    };

    try {
        const eventRef = await addDoc(collection(dbInstance, `companies/${companyId}/attendanceLog`), {
            ...newAttendanceEvent,
            timestamp: serverTimestamp() // Use server timestamp for the actual record
        });
        console.log(">>> KAROBHR TRACE: Attendance event recorded successfully with ID:", eventRef.id);
        // Listener should pick this up, but for immediate feedback to user, can add to local state if needed
        // However, for admin page (live attendance), listener is better.
        // For user's own page, they might want to see their local event reflected immediately
        setAttendanceLog(prev => [...prev, {...newAttendanceEvent, id: eventRef.id, timestamp: new Date().toISOString()}]); // optimistic update
    } catch (error) {
        console.error(">>> KAROBHR TRACE: Error recording attendance event to Firestore:", error);
        throw new Error("Failed to record attendance event.");
    }
  };

  const requestAdvance = async (employeeId: string, amount: number, reason: string) => {
    if (!dbInstance || !user ) {
        throw new Error("User context not available to request advance.");
    }
    console.log(`>>> KAROBHR TRACE: User ${employeeId} requesting advance: ${amount}`);
    const newAdvance: Advance = {
        id: uuidv4(), // Generate client-side ID
        employeeId: user.employeeId,
        amount,
        reason,
        dateRequested: new Date().toISOString(),
        status: 'pending',
    };
    try {
        const userDocRef = doc(dbInstance, `users/${user.id}`);
        await updateDoc(userDocRef, {
            advances: arrayUnion(newAdvance)
        });
        setUser(prevUser => prevUser ? ({ ...prevUser, advances: [...(prevUser.advances || []), newAdvance]}) : null);
        console.log(">>> KAROBHR TRACE: Advance requested successfully by " + employeeId);
    } catch (error) {
        console.error(">>> KAROBHR TRACE: Error requesting advance:", error);
        throw new Error("Failed to request advance.");
    }
  };

  const processAdvance = async (employeeFirebaseUID: string, advanceId: string, newStatus: 'approved' | 'rejected') => {
    if (!dbInstance || !user || user.role !== 'admin') {
        throw new Error("Operation not allowed or DB not available.");
    }
     console.log(`>>> KAROBHR TRACE: Admin processing advance ID ${advanceId} for user UID ${employeeFirebaseUID} to status ${newStatus}`);
    const employeeDocRef = doc(dbInstance, `users/${employeeFirebaseUID}`);
    try {
        const employeeDocSnap = await getDoc(employeeDocRef);
        if (!employeeDocSnap.exists()) throw new Error("Employee document not found.");

        const employeeData = employeeDocSnap.data() as User;
        const advances = employeeData.advances || [];
        const advanceIndex = advances.findIndex(adv => adv.id === advanceId);

        if (advanceIndex === -1) throw new Error("Advance request not found.");

        const updatedAdvances = [...advances];
        updatedAdvances[advanceIndex] = {
            ...updatedAdvances[advanceIndex],
            status: newStatus,
            dateProcessed: new Date().toISOString(),
        };
        await updateDoc(employeeDocRef, { advances: updatedAdvances });
        console.log(">>> KAROBHR TRACE: Advance processed successfully.");
        setAllUsers(prevAllUsers => prevAllUsers.map(u => u.id === employeeFirebaseUID ? {...u, advances: updatedAdvances} : u));
    } catch (error) {
        console.error(">>> KAROBHR TRACE: Error processing advance:", error);
        throw new Error("Failed to process advance.");
    }
  };


  // Final check to stop loading if no user and no firebase error after initial auth check
  useEffect(() => {
    if (!loading && !user && !firebaseError) {
      // This means onAuthStateChanged finished, found no user, and there was no major Firebase init error
      // console.log(">>> KAROBHR TRACE: AuthProvider initial load complete, no user, no Firebase error.");
    } else if (loading && firebaseError) {
      console.log(">>> KAROBHR TRACE: AuthProvider: Firebase error occurred, stopping loading.");
      setLoading(false);
    }
  }, [loading, user, firebaseError]);


  return (
    <AuthContext.Provider value={{ 
        user, 
        role, 
        loading, 
        companyId,
        firebaseError,
        login, 
        logout, 
        addNewEmployee, 
        allUsers, 
        tasks, 
        addTask, 
        updateTask,
        leaveApplications: user?.leaves || [], // Directly serve from user object for simplicity now
        addLeaveApplication,
        processLeaveApplication,
        announcements,
        addAnnouncement,
        updateUserInContext,
        attendanceLog,
        addAttendanceEvent,
        requestAdvance,
        processAdvance,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthProvider;
