
'use client';

import type { ReactNode } from 'react';
import React, { createContext, useState, useEffect, useCallback, useMemo } from 'react';
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
  const [tasks, setTasks] = useState<Task[]>([]); // Initialize empty, listener will populate
  const [leaveApplications, setLeaveApplications] = useState<LeaveApplication[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [attendanceLog, setAttendanceLog] = useState<AttendanceEvent[]>([]);

  const firebaseInstances = useMemo(() => {
    try {
      console.log(">>> KAROBHR TRACE: AuthProvider trying to get Firebase instances...");
      const instances = getFirebaseInstances();
      if (instances.error) {
        console.error(">>> KAROBHR TRACE: Firebase initialization error detected by AuthProvider from getFirebaseInstances:", instances.error);
        setFirebaseError(instances.error); // Set error state
        return null;
      }
      console.log(">>> KAROBHR TRACE: AuthProvider successfully got Firebase instances. Auth ready:", !!instances.auth);
      return instances;
    } catch (error: any) {
      console.error(">>> KAROBHR TRACE: CRITICAL ERROR getting Firebase instances in AuthProvider:", error);
      setFirebaseError(error); // Set error state
      return null;
    }
  }, []); // Empty dependency array: get instances once

  const authInstance = firebaseInstances?.auth;
  const dbInstance = firebaseInstances?.db;
  const storageInstance = firebaseInstances?.storage;


  const fetchUserData = useCallback(async (firebaseUser: FirebaseUser, currentDb: typeof dbInstance, currentCompanyId?: string) => {
    if (!currentDb) {
      console.error(">>> KAROBHR TRACE: fetchUserData - Firestore instance not available.");
      // Do not set firebaseError here again if it was already set by getFirebaseInstances
      if (!firebaseError) setFirebaseError(new Error("Firestore not available for fetching user data."));
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
        setCompanyId(userData.companyId);
        return userData;
      } else {
        console.warn(`>>> KAROBHR TRACE: No user document found in Firestore for UID: ${firebaseUser.uid}.`);
        if (currentCompanyId) setCompanyId(currentCompanyId);
        // If user doc doesn't exist, treat as logged out for app state purposes, but firebase user still exists.
        // This is important for new admin signups where doc is created *after* auth.
        // Consider if setting user to null here is always correct or if we should wait for doc creation.
        // For now, let's assume the calling context (onAuthStateChanged) will handle overall loading state.
        return null;
      }
    } catch (error) {
      console.error(">>> KAROBHR TRACE: Error fetching user data from Firestore:", error);
      if (!firebaseError) setFirebaseError(new Error("Failed to fetch user data."));
      return null;
    }
  }, [firebaseError]); // Include firebaseError in case it influences logic


  useEffect(() => {
    console.log(">>> KAROBHR TRACE: AuthProvider useEffect for onAuthStateChanged running. Auth instance available:", !!authInstance);
    if (!authInstance) {
      if (!firebaseError) { 
         setFirebaseError(new Error("Firebase Authentication service is not available. Check Firebase configuration."));
      }
      setLoading(false); 
      setUser(null);
      setRole(null);
      setCompanyId(null);
      return; 
    }

    const unsubscribe = onAuthStateChanged(authInstance, async (currentFirebaseUser) => {
      console.log(">>> KAROBHR TRACE: onAuthStateChanged triggered. Firebase user:", currentFirebaseUser ? currentFirebaseUser.uid : 'null');
      if (currentFirebaseUser) {
        if (!loading) setLoading(true); // Set loading true while fetching user data
        await fetchUserData(currentFirebaseUser, dbInstance);
        // setLoading(false) will be handled by data fetching listeners or if fetchUserData fails
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
  }, [authInstance, fetchUserData, dbInstance, firebaseError, loading]);


  // Listener for all users in the company (for Admin views)
  useEffect(() => {
    if (!dbInstance || !user || !companyId || role !== 'admin') {
      setAllUsers([]); // Clear if conditions not met
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
      if (!firebaseError) setFirebaseError(new Error("Failed to fetch company users."));
    });
    return () => unsubscribe();
  }, [dbInstance, user, companyId, role, firebaseError]);


   useEffect(() => {
    if (!dbInstance || !user || !companyId) {
      setTasks([]);
      if (loading && !firebaseError && !user) { /* For initial load with no user, stop loading if not already errored */ }
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
      if (loading) setLoading(false); // Consider main data loaded
    }, (error) => {
      console.error(">>> KAROBHR TRACE: Error fetching tasks:", error);
      if (!firebaseError) setFirebaseError(new Error("Failed to fetch tasks."));
      if (loading) setLoading(false);
    });

    return () => unsubscribe();
  }, [dbInstance, user, companyId, role, loading, firebaseError]);

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
      if(!firebaseError) setFirebaseError(new Error("Failed to fetch announcements."));
    });
    return () => unsubscribe();
  }, [dbInstance, companyId, firebaseError]);

  useEffect(() => {
    if (!dbInstance || !companyId || (role !== 'admin' && role !== 'manager')) {
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
        if(!firebaseError) setFirebaseError(new Error("Failed to fetch attendance log."));
    });
    return () => unsubscribe();
  }, [dbInstance, companyId, role, firebaseError]);

  const login = useCallback(async (employeeIdInput: string, passwordInput: string): Promise<User | null> => {
    if (!authInstance || !dbInstance) {
      console.error(">>> KAROBHR TRACE: Login failed - Firebase services not available.");
      if (!firebaseError) setFirebaseError(new Error("Firebase services not available for login."));
      throw new Error("Authentication service not ready. Check Firebase config.");
    }
    if (!loading) setLoading(true);
    try {
      console.log(`>>> KAROBHR TRACE: Attempting login for employeeId: ${employeeIdInput}`);
      const userDirectoryQuery = query(collection(dbInstance, 'userDirectory'), where('employeeId', '==', employeeIdInput));
      const directorySnapshot = await getDocs(userDirectoryQuery);

      if (directorySnapshot.empty) {
        console.warn(`>>> KAROBHR TRACE: Login - No user found in directory for employeeId: ${employeeIdInput}`);
        throw new Error("Invalid User ID or Password.");
      }
      
      const userDirEntry = directorySnapshot.docs[0].data() as UserDirectoryEntry;
      const userEmail = userDirEntry.email; 
      const userCompanyId = userDirEntry.companyId;

      console.log(`>>> KAROBHR TRACE: Login - User found in directory. Email: ${userEmail}, CompanyID: ${userCompanyId}`);

      const userCredential = await signInWithEmailAndPassword(authInstance, userEmail, passwordInput);
      const firebaseUser = userCredential.user;
      console.log(`>>> KAROBHR TRACE: Login - Firebase Auth successful for UID: ${firebaseUser.uid}`);

      // fetchUserData will set user, role, companyId, and loading states
      const loggedInUser = await fetchUserData(firebaseUser, dbInstance);
      if (loggedInUser) {
         if (loggedInUser.companyId !== userCompanyId) {
            console.error(`>>> KAROBHR TRACE: Login - Mismatch! User doc companyId (${loggedInUser.companyId}) vs Dir entry companyId (${userCompanyId})`);
            await firebaseSignOut(authInstance);
            throw new Error("User data inconsistency. Please contact support.");
         }
        console.log(`>>> KAROBHR TRACE: Login successful for ${loggedInUser.name} (${loggedInUser.employeeId})`);
        return loggedInUser;
      } else {
        console.error(`>>> KAROBHR TRACE: Login - Auth successful but user document not found for UID: ${firebaseUser.uid}. This is an error.`);
        await firebaseSignOut(authInstance);
        throw new Error("Login succeeded but user profile could not be loaded.");
      }
    } catch (error: any) {
      console.error(">>> KAROBHR TRACE: Login error:", error.message || error);
      if (!firebaseError && !error.message?.includes("Firebase services not available")) { // Avoid overwriting initial config error
        setFirebaseError(error);
      }
      if (error.code?.startsWith('auth/')) {
        throw new Error("Invalid User ID or Password.");
      }
      throw error;
    } finally {
      // setLoading(false); // fetchUserData or onAuthStateChanged handles this
    }
  }, [authInstance, dbInstance, fetchUserData, firebaseError, loading]);

  const logout = useCallback(async () => {
    if (!authInstance) {
      console.error(">>> KAROBHR TRACE: Logout failed - Firebase Auth not available.");
      if(!firebaseError) setFirebaseError(new Error("Firebase Auth not available for logout."));
      return;
    }
    console.log(">>> KAROBHR TRACE: Logging out user...");
    if (!loading) setLoading(true);
    try {
      await firebaseSignOut(authInstance);
      // onAuthStateChanged will handle resetting user, role, companyId, and other states.
      console.log(">>> KAROBHR TRACE: User logged out successfully (onAuthStateChanged will clear state).");
    } catch (error) {
      console.error(">>> KAROBHR TRACE: Logout error:", error);
      if(!firebaseError) setFirebaseError(new Error("Logout failed."));
    } finally {
      // setLoading(false); // onAuthStateChanged handles this
    }
  }, [authInstance, firebaseError, loading]);

  const addNewEmployee = useCallback(async (employeeData: NewEmployeeData, passwordInput?: string): Promise<FirebaseUser | null> => {
    if (!authInstance || !dbInstance) {
      console.error(">>> KAROBHR TRACE: addNewEmployee failed - Firebase services not available.");
      if(!firebaseError) setFirebaseError(new Error("Firebase services not available for adding employee."));
      throw new Error("Firebase services not ready.");
    }
    if (!passwordInput) {
        console.error(">>> KAROBHR TRACE: Password is required for new employee/manager accounts.");
        throw new Error("Password is required for new employee/manager accounts.");
    }
    
    const finalPassword = passwordInput;
    const finalEmail = employeeData.email || `${employeeData.employeeId.toLowerCase().replace(/[^a-z0-9]/gi, '')}@${employeeData.companyId.split('-')[0]}.karobhr.local`;

    console.log(`>>> KAROBHR TRACE: Attempting to add new employee/admin: ${employeeData.employeeId} for company ${employeeData.companyId}`);

    const directoryCheckQuery = query(collection(dbInstance, 'userDirectory'), where('employeeId', '==', employeeData.employeeId), where('companyId', '==', employeeData.companyId));
    const directoryCheckSnap = await getDocs(directoryCheckQuery);
    if (!directoryCheckSnap.empty) {
        console.error(`>>> KAROBHR TRACE: Employee ID ${employeeData.employeeId} already exists in company ${employeeData.companyId}.`);
        throw new Error(`Employee ID ${employeeData.employeeId} already exists in this company.`);
    }
    
    let newFirebaseUser: FirebaseUser | null = null;
    try {
      console.log(`>>> KAROBHR TRACE: Creating Firebase Auth user with email: ${finalEmail}`);
      const userCredential = await createUserWithEmailAndPassword(authInstance, finalEmail, finalPassword);
      newFirebaseUser = userCredential.user;
      console.log(`>>> KAROBHR TRACE: Firebase Auth user created successfully: ${newFirebaseUser.uid}`);

      const newUserDocument: User = {
        id: newFirebaseUser.uid, 
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
        mockAttendanceFactor: 1.0,
      };

      const userDocRef = doc(dbInstance, `users/${newFirebaseUser.uid}`);
      const userDirectoryDocRef = doc(collection(dbInstance, 'userDirectory')); 

      const batch = writeBatch(dbInstance);
      batch.set(userDocRef, newUserDocument);
      batch.set(userDirectoryDocRef, {
        userId: newFirebaseUser.uid,
        employeeId: newUserDocument.employeeId,
        email: newUserDocument.email,
        companyId: newUserDocument.companyId,
        role: newUserDocument.role,
        name: newUserDocument.name,
      } as UserDirectoryEntry);
      
      await batch.commit();
      console.log(`>>> KAROBHR TRACE: User document and directory entry created for ${newUserDocument.employeeId}`);
      
      if (user && user.role === 'admin' && user.companyId === newUserDocument.companyId) {
        setAllUsers(prev => [...prev, newUserDocument]);
      }
      return newFirebaseUser;

    } catch (error: any) {
      console.error(">>> KAROBHR TRACE: Error adding new employee:", error);
      if (newFirebaseUser && error.code !== 'auth/email-already-in-use') { 
        // Complex to delete Firebase user client-side safely. Flagging.
        console.warn(`>>> KAROBHR TRACE: Firebase Auth user ${newFirebaseUser.uid} created but Firestore failed. Manual cleanup might be needed.`);
      }
      if (error.code === 'auth/email-already-in-use') {
        throw new Error('This email address is already in use by another account.');
      } else if (error.code === 'auth/weak-password') {
        throw new Error('The password is too weak.');
      }
      throw new Error(error.message || "Could not add new employee.");
    }
  }, [authInstance, dbInstance, user, firebaseError]);

  const addTask = useCallback(async (newTaskData: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (!dbInstance || !user || !companyId) {
        console.error(">>> KAROBHR TRACE: Cannot add task - DB, user or companyId not available.");
        throw new Error("User or company context not available to add task.");
    }
    console.log(`>>> KAROBHR TRACE: Adding task "${newTaskData.title}" for ${newTaskData.assigneeName} in company ${companyId}`);
    const taskWithTimestamps: Omit<Task, 'id'> = {
        ...newTaskData,
        createdAt: serverTimestamp() as any, 
        updatedAt: serverTimestamp() as any,
    };
    try {
        const taskRef = await addDoc(collection(dbInstance, `companies/${companyId}/tasks`), taskWithTimestamps);
        console.log(">>> KAROBHR TRACE: Task added successfully with ID:", taskRef.id);
    } catch (error) {
        console.error(">>> KAROBHR TRACE: Error adding task:", error);
        throw new Error("Failed to add task.");
    }
  }, [dbInstance, user, companyId]);

  const updateTask = useCallback(async (updatedTaskData: Task) => {
    if (!dbInstance || !companyId) {
        console.error(">>> KAROBHR TRACE: Cannot update task - DB or companyId not available.");
        throw new Error("Database or company context not available to update task.");
    }
    console.log(`>>> KAROBHR TRACE: Updating task ID ${updatedTaskData.id} in company ${companyId}`);
    const taskRef = doc(dbInstance, `companies/${companyId}/tasks/${updatedTaskData.id}`);
    try {
        await updateDoc(taskRef, { ...updatedTaskData, updatedAt: serverTimestamp() });
        console.log(">>> KAROBHR TRACE: Task updated successfully.");
    } catch (error) {
        console.error(">>> KAROBHR TRACE: Error updating task:", error);
        throw new Error("Failed to update task.");
    }
  }, [dbInstance, companyId]);

  const addLeaveApplication = useCallback(async (leaveData: Omit<LeaveApplication, 'id' | 'userId' | 'employeeId' | 'appliedAt' | 'status'>) => {
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
        appliedAt: new Date().toISOString(),
    };
    try {
        const userDocRef = doc(dbInstance, `users/${user.id}`);
        const leaveWithId = { ...newLeave, id: uuidv4() }; 
        await updateDoc(userDocRef, {
            leaves: arrayUnion(leaveWithId)
        });
        console.log(">>> KAROBHR TRACE: Leave application added for user:", user.employeeId);
        setUser(prevUser => prevUser ? ({ ...prevUser, leaves: [...(prevUser.leaves || []), leaveWithId]}) : null);
    } catch (error) {
        console.error(">>> KAROBHR TRACE: Error adding leave application:", error);
        throw new Error("Failed to submit leave application.");
    }
  }, [dbInstance, user]);

  const processLeaveApplication = useCallback(async (employeeFirebaseUID: string, leaveId: string, newStatus: 'approved' | 'rejected') => {
    if (!dbInstance || !user || user.role !== 'admin') {
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
        setAllUsers(prevAllUsers => prevAllUsers.map(u => u.id === employeeFirebaseUID ? {...u, leaves: updatedLeaves} : u));

    } catch (error) {
        console.error(">>> KAROBHR TRACE: Error processing leave application:", error);
        throw new Error("Failed to process leave application.");
    }
  }, [dbInstance, user]);

  const addAnnouncement = useCallback(async (title: string, content: string) => {
    if (!dbInstance || !user || user.role !== 'admin' || !companyId) {
      console.error(">>> KAROBHR TRACE: Unauthorized or context missing for addAnnouncement.");
      throw new Error("Operation not allowed or company context missing.");
    }
    console.log(`>>> KAROBHR TRACE: Admin ${user.employeeId} posting announcement in company ${companyId}: ${title}`);
    const newAnnouncement: Omit<Announcement, 'id'> = {
      title,
      content,
      postedAt: serverTimestamp() as any,
      postedByUid: user.id,
      postedByName: user.name || user.employeeId,
    };
    try {
      await addDoc(collection(dbInstance, `companies/${companyId}/announcements`), newAnnouncement);
      console.log(">>> KAROBHR TRACE: Announcement posted successfully.");
    } catch (error) {
      console.error(">>> KAROBHR TRACE: Error posting announcement:", error);
      throw new Error("Failed to post announcement.");
    }
  }, [dbInstance, user, companyId]);
  
  const updateUserInContext = useCallback((updatedUser: User) => {
     console.log(">>> KAROBHR TRACE: Attempting to update user in context:", updatedUser.employeeId);
     if (user && user.id === updatedUser.id) {
        setUser(updatedUser);
        console.log(">>> KAROBHR TRACE: Current user updated in context.");
     }
     setAllUsers(prevAllUsers => prevAllUsers.map(u => u.id === updatedUser.id ? updatedUser : u));
     console.log(">>> KAROBHR TRACE: User updated in allUsers list (if present).");
     if (dbInstance && companyId) {
        const userDocRef = doc(dbInstance, `users/${updatedUser.id}`);
        updateDoc(userDocRef, updatedUser).catch(err => console.error(">>> KAROBHR TRACE: Failed to sync user update to Firestore:", err));
     }
  }, [user, dbInstance, companyId]);

  const addAttendanceEvent = useCallback(async (eventData: Omit<AttendanceEvent, 'id' | 'userId' | 'employeeId' | 'userName' | 'timestamp'> & { photoDataUrl?: string | null }) => {
    if (!dbInstance || !user || !companyId || !storageInstance) {
        console.error(">>> KAROBHR TRACE: Missing context for addAttendanceEvent (db, user, companyId, or storage).");
        throw new Error("Cannot record attendance: missing user, company, or storage context.");
    }
    console.log(`>>> KAROBHR TRACE: User ${user.employeeId} performing ${eventData.type} in company ${companyId}`);

    let photoFinalUrl: string | null = null;
    if (eventData.photoDataUrl) {
        console.log(">>> KAROBHR TRACE: Photo data URL provided, attempting to upload to storage...");
        const photoFileName = `${user.employeeId}-${new Date().getTime()}-${uuidv4()}.jpg`;
        const photoRef = ref(storageInstance, `companies/${companyId}/attendancePhotos/${user.id}/${photoFileName}`);
        try {
            const base64String = eventData.photoDataUrl.split(',')[1];
            if (!base64String) throw new Error("Invalid photo data URL format for base64 extraction.");
            const snapshot = await uploadString(photoRef, base64String, 'base64', { contentType: 'image/jpeg' });
            photoFinalUrl = await getDownloadURL(snapshot.ref);
            console.log(">>> KAROBHR TRACE: Photo uploaded successfully:", photoFinalUrl);
        } catch (uploadError) {
            console.error(">>> KAROBHR TRACE: Error uploading attendance photo:", uploadError);
        }
    }

    const newAttendanceEvent: Omit<AttendanceEvent, 'id'> = {
        userId: user.id,
        employeeId: user.employeeId,
        userName: user.name || user.employeeId,
        type: eventData.type,
        timestamp: new Date().toISOString(), 
        photoUrl: photoFinalUrl, 
        location: eventData.location,
        isWithinGeofence: eventData.isWithinGeofence,
    };

    try {
        const eventRef = await addDoc(collection(dbInstance, `companies/${companyId}/attendanceLog`), {
            ...newAttendanceEvent,
            timestamp: serverTimestamp() // Use server timestamp for the actual record
        });
        console.log(">>> KAROBHR TRACE: Attendance event recorded successfully with ID:", eventRef.id);
        setAttendanceLog(prev => [...prev, {...newAttendanceEvent, id: eventRef.id, timestamp: new Date().toISOString()}]);
    } catch (error) {
        console.error(">>> KAROBHR TRACE: Error recording attendance event to Firestore:", error);
        throw new Error("Failed to record attendance event.");
    }
  }, [dbInstance, user, companyId, storageInstance]);

  const requestAdvance = useCallback(async (employeeId: string, amount: number, reason: string) => {
    if (!dbInstance || !user ) {
        throw new Error("User context not available to request advance.");
    }
    console.log(`>>> KAROBHR TRACE: User ${employeeId} requesting advance: ${amount}`);
    const newAdvance: Advance = {
        id: uuidv4(), 
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
  }, [dbInstance, user]);

  const processAdvance = useCallback(async (employeeFirebaseUID: string, advanceId: string, newStatus: 'approved' | 'rejected') => {
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
  },[dbInstance, user]);


  useEffect(() => {
    if (loading && firebaseError) {
      console.log(">>> KAROBHR TRACE: AuthProvider: Firebase error occurred during initial setup, stopping loading.");
      setLoading(false);
    }
  }, [loading, firebaseError]);

  const contextValue = useMemo(() => ({
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
    leaveApplications: user?.leaves || [],
    addLeaveApplication,
    processLeaveApplication,
    announcements,
    addAnnouncement,
    updateUserInContext,
    attendanceLog,
    addAttendanceEvent,
    requestAdvance,
    processAdvance,
  }), [
    user, role, loading, companyId, firebaseError, login, logout, addNewEmployee,
    allUsers, tasks, addTask, updateTask, addLeaveApplication, processLeaveApplication,
    announcements, addAnnouncement, updateUserInContext, attendanceLog, addAttendanceEvent,
    requestAdvance, processAdvance
  ]);


  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthProvider;

    