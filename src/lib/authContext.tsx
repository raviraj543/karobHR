
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
import { initialTasks } from '@/lib/taskData'; // Example data, can be removed if not used
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
      const instances = getFirebaseInstances(); // This will throw if config is bad
      console.log(">>> KAROBHR TRACE: AuthProvider successfully got Firebase instances. Auth ready:", !!instances.auth);
      return instances;
    } catch (error: any) {
      console.error(">>> KAROBHR TRACE: CRITICAL ERROR getting Firebase instances in AuthProvider, LIKELY DUE TO CONFIGURATION ISSUES IN config.ts:", error);
      setFirebaseError(error); 
      setLoading(false); // Stop loading if Firebase cannot even be initialized
      return null;
    }
  }, []); 

  const authInstance = firebaseInstances?.auth;
  const dbInstance = firebaseInstances?.db;
  const storageInstance = firebaseInstances?.storage;


  const fetchUserData = useCallback(async (firebaseUser: FirebaseUser, currentDb: typeof dbInstance, currentCompanyIdFromAuth?: string) => {
    if (!currentDb) {
      console.error(">>> KAROBHR TRACE: fetchUserData - Firestore instance not available. FirebaseError exists:", !!firebaseError);
      if (!firebaseError) setFirebaseError(new Error("Firestore not available for fetching user data."));
      setLoading(false);
      return null;
    }
    console.log(`>>> KAROBHR TRACE: fetchUserData - Attempting to fetch profile for UID: ${firebaseUser.uid}`);
    try {
      const userDocRef = doc(currentDb, `users/${firebaseUser.uid}`);
      const userDocSnap = await getDoc(userDocRef);

      if (userDocSnap.exists()) {
        const userData = userDocSnap.data() as User;
        console.log(`>>> KAROBHR TRACE: fetchUserData - SUCCESS - User document found for UID: ${firebaseUser.uid}. Employee ID: ${userData.employeeId}, Role: ${userData.role}, Company ID: ${userData.companyId}`);
        setUser(userData);
        setRole(userData.role);
        setCompanyId(userData.companyId); // Set companyId from user's profile
        return userData;
      } else {
        console.warn(`>>> KAROBHR TRACE: fetchUserData - WARNING - No user document found in Firestore 'users/${firebaseUser.uid}'. This user can authenticate but has no profile data (role, etc.).`);
        // If a companyId was passed (e.g., from login directory lookup), set it, otherwise it might be null.
        if (currentCompanyIdFromAuth) setCompanyId(currentCompanyIdFromAuth);
        // This is the point where "profile could not be loaded" originates.
        // We should not set user/role if profile is not found.
        setUser(null); 
        setRole(null);
        return null;
      }
    } catch (error) {
      console.error(`>>> KAROBHR TRACE: fetchUserData - ERROR fetching user data from Firestore for UID ${firebaseUser.uid}:`, error);
      if (!firebaseError) setFirebaseError(new Error("Failed to fetch user data."));
      return null;
    }
  }, [firebaseError]); 


  useEffect(() => {
    console.log(">>> KAROBHR TRACE: AuthProvider useEffect for onAuthStateChanged running. Auth instance available:", !!authInstance);
    if (!authInstance) {
      if (!firebaseError) { 
         console.error(">>> KAROBHR TRACE: onAuthStateChanged - Firebase Authentication service is not available. This is critical.");
         setFirebaseError(new Error("Firebase Authentication service is not available. Check Firebase configuration in config.ts."));
      }
      setLoading(false); 
      setUser(null);
      setRole(null);
      setCompanyId(null);
      return; 
    }

    const unsubscribe = onAuthStateChanged(authInstance, async (currentFirebaseUser) => {
      console.log(">>> KAROBHR TRACE: onAuthStateChanged triggered. Firebase user UID:", currentFirebaseUser ? currentFirebaseUser.uid : 'null');
      if (currentFirebaseUser) {
        if (!loading) setLoading(true); 
        const fetchedUser = await fetchUserData(currentFirebaseUser, dbInstance);
        if (!fetchedUser) {
            // If fetchUserData returns null (profile not found), we should effectively log them out of the app's context
            // or handle this as a state where auth is okay but profile is missing.
            console.warn(`>>> KAROBHR TRACE: onAuthStateChanged - User ${currentFirebaseUser.uid} authenticated, but profile data not found. Setting app user to null.`);
            setUser(null);
            setRole(null);
            // companyId might have been set by fetchUserData from a directory lookup if that path was taken.
            // Keep it if set, or null if not.
        }
        // setLoading(false) will be handled by data fetching listeners or if fetchUserData fails/succeeds
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
        console.log(">>> KAROBHR TRACE: onAuthStateChanged - No Firebase user. Cleared app state.");
      }
    });
    return () => {
      console.log(">>> KAROBHR TRACE: Unsubscribing from onAuthStateChanged.");
      unsubscribe();
    };
  }, [authInstance, fetchUserData, dbInstance, firebaseError, loading]);


  // Listener for all users in the company (for Admin views)
  useEffect(() => {
    if (!dbInstance || !user || !companyId || role !== 'admin') {
      setAllUsers([]); 
      return;
    }
    console.log(`>>> KAROBHR TRACE: Setting up allUsers listener for companyId: ${companyId}`);
    const usersQuery = query(collection(dbInstance, 'users'), where('companyId', '==', companyId));
    const unsubscribe = onSnapshot(usersQuery, (snapshot) => {
      const usersList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User));
      setAllUsers(usersList);
      console.log(">>> KAROBHR TRACE: Fetched/Updated all users for admin:", usersList.length);
    }, (error) => {
      console.error(">>> KAROBHR TRACE: Error fetching all users:", error);
      if (!firebaseError) setFirebaseError(new Error("Failed to fetch company users."));
    });
    return () => unsubscribe();
  }, [dbInstance, user, companyId, role, firebaseError]);


   useEffect(() => {
    if (!dbInstance || !user || !companyId) {
      setTasks([]);
      // If loading was true and we don't have a user/companyId, and no Firebase error yet,
      // this might be the initial state for a non-logged-in user.
      if (loading && !user && !companyId && !firebaseError) {
        // console.log(">>> KAROBHR TRACE: Tasks listener - no user/companyId, setting loading to false.");
        // setLoading(false); // Let onAuthStateChanged handle this for cleaner logic
      }
      return;
    }

    let tasksQuery;
    if (role === 'admin' || role === 'manager') { // Managers might also see all tasks or tasks for their team
      console.log(`>>> KAROBHR TRACE: Setting up ADMIN/MANAGER tasks listener for companyId: ${companyId}`);
      tasksQuery = query(collection(dbInstance, `companies/${companyId}/tasks`));
    } else { // Employee
      console.log(`>>> KAROBHR TRACE: Setting up USER tasks listener for employeeId: ${user.employeeId} in companyId: ${companyId}`);
      tasksQuery = query(collection(dbInstance, `companies/${companyId}/tasks`), where('assigneeId', '==', user.employeeId));
    }

    const unsubscribe = onSnapshot(tasksQuery, (snapshot) => {
      const tasksList = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Task));
      setTasks(tasksList);
      console.log(`>>> KAROBHR TRACE: Tasks updated for ${role} (${user.employeeId}):`, tasksList.length);
      if (loading) setLoading(false); 
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
    const announcementsQuery = query(collection(dbInstance, `companies/${companyId}/announcements`)); // Corrected path
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
      console.error(">>> KAROBHR TRACE: Login failed - Firebase authInstance or dbInstance not available.");
      if (!firebaseError) setFirebaseError(new Error("Firebase services not available for login."));
      throw new Error("Authentication service not ready. Check Firebase config in config.ts.");
    }
    if (!loading) setLoading(true);
    console.log(`>>> KAROBHR TRACE: login - Attempting for employeeId: ${employeeIdInput}`);
    try {
      // Query userDirectory to get email and actual companyId associated with this employeeId
      // IMPORTANT: For multi-tenancy, employeeId might not be globally unique.
      // A robust system might require companyId input at login or use a custom claim.
      // For now, assuming employeeId is unique enough for this lookup or this app is single-company first.
      const userDirectoryQuery = query(collection(dbInstance, 'userDirectory'), where('employeeId', '==', employeeIdInput));
      const directorySnapshot = await getDocs(userDirectoryQuery);

      if (directorySnapshot.empty) {
        console.warn(`>>> KAROBHR TRACE: login - No user found in userDirectory for employeeId: ${employeeIdInput}.`);
        throw new Error("Invalid User ID or Password.");
      }
      
      // Assuming employeeId is unique across all companies for now, or only one company exists.
      // If multiple, this takes the first one found, which could be an issue.
      const userDirEntry = directorySnapshot.docs[0].data() as UserDirectoryEntry;
      const userEmail = userDirEntry.email; 
      const userCompanyIdFromDirectory = userDirEntry.companyId; // Get companyId from directory

      if (!userEmail) {
        console.error(`>>> KAROBHR TRACE: login - User directory entry for ${employeeIdInput} is missing an email.`);
        throw new Error("User configuration error. Please contact support.");
      }
      console.log(`>>> KAROBHR TRACE: login - User found in directory. Email: ${userEmail}, CompanyID from Dir: ${userCompanyIdFromDirectory}. Authenticating with Firebase Auth...`);

      const userCredential = await signInWithEmailAndPassword(authInstance, userEmail, passwordInput);
      const firebaseUser = userCredential.user;
      console.log(`>>> KAROBHR TRACE: login - Firebase Auth successful for UID: ${firebaseUser.uid}, Email: ${firebaseUser.email}`);

      // Now fetch user data using this UID, and pass the companyId found from the directory
      const loggedInUser = await fetchUserData(firebaseUser, dbInstance, userCompanyIdFromDirectory);
      
      if (loggedInUser) {
         if (loggedInUser.companyId !== userCompanyIdFromDirectory) {
            console.error(`>>> KAROBHR TRACE: login - CRITICAL MISMATCH! User doc companyId (${loggedInUser.companyId}) vs Dir entry companyId (${userCompanyIdFromDirectory}) for UID ${firebaseUser.uid}. Logging out.`);
            await firebaseSignOut(authInstance); // Sign out to prevent inconsistent state
            throw new Error("User data inconsistency. Please contact support.");
         }
        console.log(`>>> KAROBHR TRACE: login - Successfully fetched profile for ${loggedInUser.name} (${loggedInUser.employeeId}). Login complete.`);
        return loggedInUser;
      } else {
        console.error(`>>> KAROBHR TRACE: login - Firebase Auth successful for UID: ${firebaseUser.uid}, but Firestore profile NOT FOUND. This is a critical issue.`);
        // onAuthStateChanged might have already set user to null if fetchUserData returned null.
        // To be safe, explicitly sign out from Firebase Auth if profile is missing post-login attempt.
        await firebaseSignOut(authInstance);
        throw new Error("Login succeeded but user profile could not be loaded.");
      }
    } catch (error: any) {
      console.error(">>> KAROBHR TRACE: login - Error during login process:", error.message || error);
      // setLoading(false); // Let onAuthStateChanged manage this
      if (!firebaseError && !error.message?.includes("Firebase services not available")) { 
        setFirebaseError(error);
      }
      if (error.code?.startsWith('auth/')) { // Firebase Auth specific errors
        throw new Error("Invalid User ID or Password.");
      }
      throw error; // Re-throw other errors (like the "profile not loaded" one)
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
      console.log(">>> KAROBHR TRACE: User logged out successfully via firebaseSignOut(). onAuthStateChanged will clear app state.");
    } catch (error) {
      console.error(">>> KAROBHR TRACE: Logout error:", error);
      if(!firebaseError) setFirebaseError(new Error("Logout failed."));
      // setLoading(false); // onAuthStateChanged will set loading to false
    }
  }, [authInstance, firebaseError, loading]);

  const addNewEmployee = useCallback(async (employeeData: NewEmployeeData, passwordInput?: string): Promise<FirebaseUser | null> => {
    if (!authInstance || !dbInstance) {
      console.error(">>> KAROBHR TRACE: addNewEmployee failed - Firebase services not available.");
      if(!firebaseError) setFirebaseError(new Error("Firebase services not available for adding employee."));
      throw new Error("Firebase services not ready. Check Firebase configuration in config.ts.");
    }
    if (!passwordInput && employeeData.role !== 'admin') { // Admins might be created without password initially IF they set it themselves
        // For this app, admin signup implies password is set.
        // Regular employees/managers MUST have a password set by admin.
        console.error(">>> KAROBHR TRACE: Password is required for new employee/manager accounts.");
        throw new Error("Password is required for new employee/manager accounts.");
    }
    
    const finalPassword = passwordInput; // If admin, password must come from adminSignup form
    const finalEmail = employeeData.email || `${employeeData.employeeId.toLowerCase().replace(/[^a-z0-9]/gi, '')}@${employeeData.companyId.split('-')[0]}.karobhr.local`;

    console.log(`>>> KAROBHR TRACE: addNewEmployee - START - Adding new ${employeeData.role}: ${employeeData.employeeId} for company ${employeeData.companyId} with email ${finalEmail}`);

    // Check if employeeId already exists in userDirectory for THIS company
    const directoryCheckQuery = query(
        collection(dbInstance, 'userDirectory'), 
        where('employeeId', '==', employeeData.employeeId), 
        where('companyId', '==', employeeData.companyId)
    );
    const directoryCheckSnap = await getDocs(directoryCheckQuery);
    if (!directoryCheckSnap.empty) {
        console.error(`>>> KAROBHR TRACE: addNewEmployee - ERROR - Employee ID ${employeeData.employeeId} already exists in company ${employeeData.companyId}.`);
        throw new Error(`Employee ID ${employeeData.employeeId} already exists in this company.`);
    }
    
    let newFirebaseUser: FirebaseUser | null = null;
    try {
      console.log(`>>> KAROBHR TRACE: addNewEmployee - Creating Firebase Auth user with email: ${finalEmail}`);
      const userCredential = await createUserWithEmailAndPassword(authInstance, finalEmail, finalPassword!); // Password must be provided
      newFirebaseUser = userCredential.user;
      console.log(`>>> KAROBHR TRACE: addNewEmployee - Firebase Auth user created successfully. UID: ${newFirebaseUser.uid}`);

      const newUserDocument: User = {
        id: newFirebaseUser.uid, // CRUCIAL: Use Firebase Auth UID as Firestore document ID
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
        mockAttendanceFactor: 1.0, // Default value
        // createdAt: serverTimestamp() as any, // Add if needed
        // updatedAt: serverTimestamp() as any, // Add if needed
      };

      // Document reference for the main user profile in 'users' collection
      const userDocRef = doc(dbInstance, `users/${newFirebaseUser.uid}`);
      
      // Document reference for the 'userDirectory' entry, also using UID as doc ID for consistency
      const userDirectoryDocRef = doc(dbInstance, `userDirectory/${newFirebaseUser.uid}`); 

      console.log(`>>> KAROBHR TRACE: addNewEmployee - Preparing batch write for UID: ${newFirebaseUser.uid}. UserDoc path: users/${newFirebaseUser.uid}, DirDoc path: userDirectory/${newFirebaseUser.uid}`);
      const batch = writeBatch(dbInstance);
      
      batch.set(userDocRef, newUserDocument);
      console.log(`>>> KAROBHR TRACE: addNewEmployee - Added set(userDocRef) to batch for ${newUserDocument.employeeId}`);
      
      batch.set(userDirectoryDocRef, {
        userId: newFirebaseUser.uid, // This is the Firebase Auth UID
        employeeId: newUserDocument.employeeId,
        email: newUserDocument.email,
        companyId: newUserDocument.companyId,
        role: newUserDocument.role,
        name: newUserDocument.name,
      } as UserDirectoryEntry);
      console.log(`>>> KAROBHR TRACE: addNewEmployee - Added set(userDirectoryDocRef) to batch for ${newUserDocument.employeeId}`);
      
      await batch.commit();
      console.log(`>>> KAROBHR TRACE: addNewEmployee - SUCCESS - Batch commit successful. User profile and directory entry created for ${newUserDocument.employeeId} (UID: ${newFirebaseUser.uid}).`);
      
      // If an admin is adding another user within the same company, update local 'allUsers' state
      if (user && user.role === 'admin' && user.companyId === newUserDocument.companyId) {
        setAllUsers(prev => [...prev, newUserDocument]);
        console.log(`>>> KAROBHR TRACE: addNewEmployee - Admin added new user, updated local allUsers state.`);
      }
      return newFirebaseUser;

    } catch (error: any) {
      console.error(`>>> KAROBHR TRACE: addNewEmployee - ERROR during user creation for ${employeeData.employeeId}:`, error.code, error.message, error);
      if (newFirebaseUser && error.code !== 'auth/email-already-in-use') { 
        // This is complex client-side. Ideally, a Cloud Function would handle atomicity or cleanup.
        console.warn(`>>> KAROBHR TRACE: addNewEmployee - Firebase Auth user ${newFirebaseUser.uid} was created, but Firestore operations failed. Manual cleanup of Auth user might be needed if this was not an 'email-already-in-use' error.`);
      }
      if (error.code === 'auth/email-already-in-use') {
        throw new Error(`The email address '${finalEmail}' is already in use by another account.`);
      } else if (error.code === 'auth/weak-password') {
        throw new Error('The password is too weak. It must be at least 6 characters.');
      }
      throw new Error(error.message || "Could not add new employee due to an unexpected error.");
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
        createdAt: new Date().toISOString(), // Use ISO string for consistency if not using serverTimestamp
        updatedAt: new Date().toISOString(),
    };
    try {
        // Note: If using serverTimestamp, ensure fields are correctly typed for it.
        const taskCollectionRef = collection(dbInstance, `companies/${companyId}/tasks`);
        const taskRef = await addDoc(taskCollectionRef, {
            ...newTaskData,
            createdAt: serverTimestamp(), // Use server timestamp for actual storage
            updatedAt: serverTimestamp(),
        });
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
        // Exclude id from the data being updated, and use serverTimestamp
        const { id, ...dataToUpdate } = updatedTaskData;
        await updateDoc(taskRef, { ...dataToUpdate, updatedAt: serverTimestamp() });
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
        appliedAt: new Date().toISOString(), // Client-side timestamp for immediate display if needed
    };
    try {
        const userDocRef = doc(dbInstance, `users/${user.id}`);
        const leaveWithIdAndTimestamp = { 
            ...newLeave, 
            id: uuidv4(),
            appliedAt: Timestamp.now() // Use Firestore Timestamp for sorting/querying
        }; 
        await updateDoc(userDocRef, {
            leaves: arrayUnion(leaveWithIdAndTimestamp)
        });
        console.log(">>> KAROBHR TRACE: Leave application added for user:", user.employeeId);
        // Update local state correctly
        setUser(prevUser => {
            if (!prevUser) return null;
            // Ensure appliedAt is a string for local state if needed by UI, or handle Timestamp object
            const localLeaveToAdd = {...leaveWithIdAndTimestamp, appliedAt: leaveWithIdAndTimestamp.appliedAt.toDate().toISOString()};
            return { ...prevUser, leaves: [...(prevUser.leaves || []), localLeaveToAdd]};
        });
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
            processedAt: new Date().toISOString(), // Client-side timestamp
            // For Firestore, better to use serverTimestamp if this update happens via a backend/function
            // For client-side only:
            // processedAtTimestamp: Timestamp.now() // if you want to store as Timestamp
        };
        await updateDoc(employeeDocRef, { leaves: updatedLeaves });
        console.log(">>> KAROBHR TRACE: Leave application processed successfully.");
        // Update local state for allUsers if admin is viewing
        setAllUsers(prevAllUsers => prevAllUsers.map(u => 
            u.id === employeeFirebaseUID 
            ? {...u, leaves: updatedLeaves.map(l => ({...l, appliedAt: typeof l.appliedAt === 'string' ? l.appliedAt : (l.appliedAt as unknown as Timestamp).toDate().toISOString()})) } 
            : u
        ));

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
    const newAnnouncementData: Omit<Announcement, 'id' | 'postedAt'> = { // postedAt will be serverTimestamp
      title,
      content,
      postedByUid: user.id,
      postedByName: user.name || user.employeeId,
    };
    try {
      await addDoc(collection(dbInstance, `companies/${companyId}/announcements`), {
        ...newAnnouncementData,
        postedAt: serverTimestamp() 
      });
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
     // Ensure allUsers list is updated too, which will trigger re-renders if admin is viewing employee list
     setAllUsers(prevAllUsers => prevAllUsers.map(u => u.id === updatedUser.id ? updatedUser : u));
     console.log(">>> KAROBHR TRACE: User updated in allUsers list (if present).");
     
     // Persist change to Firestore
     if (dbInstance && companyId) { // companyId check might be redundant if we always have it when dbInstance is present
        const userDocRef = doc(dbInstance, `users/${updatedUser.id}`);
        // Ensure we don't send undefined fields that Firestore might reject if not explicitly handled by rules/converters
        const dataToUpdate = { ...updatedUser }; 
        // delete dataToUpdate.id; // ID is path, not data

        updateDoc(userDocRef, dataToUpdate)
            .then(() => console.log(`>>> KAROBHR TRACE: User ${updatedUser.employeeId} successfully synced to Firestore.`))
            .catch(err => console.error(`>>> KAROBHR TRACE: Failed to sync user update to Firestore for ${updatedUser.employeeId}:`, err));
        
        // Also update userDirectory if relevant fields changed (name, email, role)
        const dirDocRef = doc(dbInstance, `userDirectory/${updatedUser.id}`);
        const dirDataToUpdate: Partial<UserDirectoryEntry> = {};
        if (updatedUser.name && updatedUser.name !== allUsers.find(u=>u.id === updatedUser.id)?.name) dirDataToUpdate.name = updatedUser.name;
        if (updatedUser.email && updatedUser.email !== allUsers.find(u=>u.id === updatedUser.id)?.email) dirDataToUpdate.email = updatedUser.email;
        if (updatedUser.role && updatedUser.role !== allUsers.find(u=>u.id === updatedUser.id)?.role) dirDataToUpdate.role = updatedUser.role;

        if(Object.keys(dirDataToUpdate).length > 0) {
            updateDoc(dirDocRef, dirDataToUpdate)
            .then(() => console.log(`>>> KAROBHR TRACE: UserDirectory for ${updatedUser.employeeId} successfully synced to Firestore.`))
            .catch(err => console.error(`>>> KAROBHR TRACE: Failed to sync UserDirectory update for ${updatedUser.employeeId}:`, err));
        }

     } else {
        console.warn(">>> KAROBHR TRACE: DB instance or companyId not available, cannot sync user update to Firestore for:", updatedUser.employeeId);
     }
  }, [user, dbInstance, companyId, allUsers]); // Added allUsers dependency

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
            // Decide if you want to proceed without photo or throw error
        }
    }

    const newAttendanceEventData: Omit<AttendanceEvent, 'id' | 'timestamp'> = { // timestamp will be serverTimestamp
        userId: user.id,
        employeeId: user.employeeId,
        userName: user.name || user.employeeId,
        type: eventData.type,
        photoUrl: photoFinalUrl, 
        location: eventData.location,
        isWithinGeofence: eventData.isWithinGeofence,
    };

    try {
        const eventRef = await addDoc(collection(dbInstance, `companies/${companyId}/attendanceLog`), {
            ...newAttendanceEventData,
            timestamp: serverTimestamp() 
        });
        console.log(">>> KAROBHR TRACE: Attendance event recorded successfully with ID:", eventRef.id);
        // Optimistically update local state - use client timestamp for immediate display consistency
        const optimisticEvent: AttendanceEvent = {
            ...newAttendanceEventData,
            id: eventRef.id, // Firestore generated ID
            timestamp: new Date().toISOString() // Client time for immediate display
        };
        setAttendanceLog(prev => [...prev, optimisticEvent].sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));

    } catch (error) {
        console.error(">>> KAROBHR TRACE: Error recording attendance event to Firestore:", error);
        throw new Error("Failed to record attendance event.");
    }
  }, [dbInstance, user, companyId, storageInstance]);

  const requestAdvance = useCallback(async (employeeId: string, amount: number, reason: string) => {
    if (!dbInstance || !user ) {
        console.error(">>> KAROBHR TRACE: User context or DB not available to request advance.");
        throw new Error("User context not available to request advance.");
    }
    if (user.employeeId !== employeeId) {
        console.error(">>> KAROBHR TRACE: Mismatch: Auth user trying to request advance for different employeeId.");
        throw new Error("Unauthorized advance request.");
    }
    console.log(`>>> KAROBHR TRACE: User ${employeeId} requesting advance: ${amount}`);
    const newAdvance: Advance = {
        id: uuidv4(), 
        employeeId: user.employeeId,
        amount,
        reason,
        dateRequested: new Date().toISOString(), // Client time, will be stored as string
        status: 'pending',
    };
    try {
        const userDocRef = doc(dbInstance, `users/${user.id}`);
        // For storing as Firestore Timestamp if preferred:
        // const newAdvanceForFirestore = {...newAdvance, dateRequested: Timestamp.now() };
        // await updateDoc(userDocRef, { advances: arrayUnion(newAdvanceForFirestore) });
        await updateDoc(userDocRef, { advances: arrayUnion(newAdvance) });
        
        setUser(prevUser => prevUser ? ({ ...prevUser, advances: [...(prevUser.advances || []), newAdvance]}) : null);
        console.log(">>> KAROBHR TRACE: Advance requested successfully by " + employeeId);
    } catch (error) {
        console.error(">>> KAROBHR TRACE: Error requesting advance:", error);
        throw new Error("Failed to request advance.");
    }
  }, [dbInstance, user]);

  const processAdvance = useCallback(async (employeeFirebaseUID: string, advanceId: string, newStatus: 'approved' | 'rejected') => {
    if (!dbInstance || !user || user.role !== 'admin') {
        console.error(">>> KAROBHR TRACE: Unauthorized or DB not available for processAdvance.");
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
            dateProcessed: new Date().toISOString(), // Client time
            // dateProcessedTimestamp: Timestamp.now() // if storing as Timestamp
        };
        await updateDoc(employeeDocRef, { advances: updatedAdvances });
        console.log(">>> KAROBHR TRACE: Advance processed successfully.");
        // Update local allUsers state
        setAllUsers(prevAllUsers => prevAllUsers.map(u => u.id === employeeFirebaseUID ? {...u, advances: updatedAdvances} : u));
    } catch (error) {
        console.error(">>> KAROBHR TRACE: Error processing advance:", error);
        throw new Error("Failed to process advance.");
    }
  },[dbInstance, user]);


  useEffect(() => {
    if (loading && firebaseError) {
      console.log(">>> KAROBHR TRACE: AuthProvider: Firebase error occurred, stopping loading state.");
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
    leaveApplications: user?.leaves || [], // Always provide from current user state
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

    