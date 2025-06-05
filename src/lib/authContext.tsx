
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
import { getStorage, ref, uploadString, getDownloadURL, deleteObject } from "firebase/storage";
import { v4 as uuidv4 } from 'uuid';


console.log(">>> KAROBHR TRACE: Attempting to load src/lib/authContext.tsx module...");

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
  addNewEmployee: (employeeData: NewEmployeeData, password?: string, isFirstAdmin?: boolean) => Promise<FirebaseUser | null>;
  allUsers: User[];
  tasks: Task[];
  addTask: (task: Task) => Promise<void>;
  updateTask: (task: Task) => Promise<void>;
  deleteTask?: (taskId: string) => Promise<void>;
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
  const [tasks, setTasks] = useState<Task[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [attendanceLog, setAttendanceLog] = useState<AttendanceEvent[]>([]);
  
  const firebaseInstances = useMemo(() => {
    try {
      console.log(">>> KAROBHR TRACE: AuthProvider trying to get Firebase instances...");
      const instances = getFirebaseInstances();
      console.log(">>> KAROBHR TRACE: AuthProvider successfully got Firebase instances. Auth ready:", !!instances.auth);
      setFirebaseError(null); 
      return instances;
    } catch (error: any) {
      console.error(">>> KAROBHR TRACE: CRITICAL ERROR getting Firebase instances in AuthProvider:", error.message || error);
      setFirebaseError(error); 
      setLoading(false); 
      return null;
    }
  }, []); 

  const authInstance = firebaseInstances?.auth;
  const dbInstance = firebaseInstances?.db;
  const storageInstance = firebaseInstances?.storage;

  const fetchUserData = useCallback(async (firebaseUser: FirebaseUser, currentDb: typeof dbInstance, expectedCompanyId?: string | null) => {
    if (!currentDb) {
      console.error(">>> KAROBHR TRACE: fetchUserData - Firestore instance not available.");
      if (!firebaseError) setFirebaseError(new Error("Firestore not available for fetching user data."));
      return null;
    }
    const uidToFetch = firebaseUser.uid;
    console.log(`>>> KAROBHR TRACE: fetchUserData - Attempting to fetch profile for UID: ${uidToFetch} with expectedCompanyId: ${expectedCompanyId || 'N/A'}`);
    
    try {
      const userDocRef = doc(currentDb, `users/${uidToFetch}`);
      const userDocSnap = await getDoc(userDocRef);

      console.log(`>>> KAROBHR TRACE: fetchUserData - Document snapshot for users/${uidToFetch} exists: ${userDocSnap.exists()}`);
      if (userDocSnap.exists()) {
        const userDataFromDb = userDocSnap.data();
        console.log(`>>> KAROBHR TRACE: fetchUserData - Raw data from Firestore for UID ${uidToFetch}:`, userDataFromDb);

        if (expectedCompanyId && userDataFromDb.companyId !== expectedCompanyId) {
            console.error(`>>> KAROBHR TRACE: fetchUserData - CRITICAL MISMATCH! Profile companyId (${userDataFromDb.companyId}) vs expectedCompanyId from userDirectory (${expectedCompanyId}) for UID ${uidToFetch}. This indicates data inconsistency.`);
            if (authInstance) await firebaseSignOut(authInstance);
            setUser(null); setRole(null); setCompanyId(null);
            throw new Error("User data inconsistency (company ID mismatch). Please contact support.");
        }
        
        const completeUserData: User = {
            id: uidToFetch, // Ensure the ID from Auth is used
            employeeId: userDataFromDb.employeeId,
            email: userDataFromDb.email,
            name: userDataFromDb.name,
            role: userDataFromDb.role,
            companyId: userDataFromDb.companyId,
            department: userDataFromDb.department,
            joiningDate: userDataFromDb.joiningDate,
            baseSalary: userDataFromDb.baseSalary,
            profilePictureUrl: userDataFromDb.profilePictureUrl || null,
            advances: userDataFromDb.advances || [],
            // Convert leave application timestamps if they are Firestore Timestamps
            leaves: (userDataFromDb.leaves || []).map((leave: any) => ({
              ...leave,
              appliedAt: leave.appliedAt && typeof leave.appliedAt.toDate === 'function' ? leave.appliedAt.toDate().toISOString() : leave.appliedAt,
              processedAt: leave.processedAt && typeof leave.processedAt.toDate === 'function' ? leave.processedAt.toDate().toISOString() : leave.processedAt,
            })),
            mockAttendanceFactor: userDataFromDb.mockAttendanceFactor !== undefined ? userDataFromDb.mockAttendanceFactor : 1.0,
        };
        console.log(`>>> KAROBHR TRACE: fetchUserData - SUCCESS - User document found for UID: ${uidToFetch}. Employee ID: ${completeUserData.employeeId}, Role: ${completeUserData.role}, Company ID: ${completeUserData.companyId}`);
        
        setUser(completeUserData);
        setRole(completeUserData.role);
        setCompanyId(completeUserData.companyId); 
        return completeUserData;
      } else {
        console.warn(`>>> KAROBHR TRACE: fetchUserData - WARNING - No user document found in Firestore 'users/${uidToFetch}'. Auth UID: ${uidToFetch}.`);
        if (expectedCompanyId) setCompanyId(expectedCompanyId); 
        else setCompanyId(null); 
        setUser(null); 
        setRole(null);
        return null;
      }
    } catch (error) {
      console.error(`>>> KAROBHR TRACE: fetchUserData - ERROR fetching user data from Firestore for UID ${uidToFetch}:`, error);
      if (!firebaseError) setFirebaseError(new Error("Failed to fetch user data."));
      return null;
    }
  }, [firebaseError, authInstance]);


  useEffect(() => {
    console.log(">>> KAROBHR TRACE: AuthProvider useEffect for onAuthStateChanged running. Auth instance available:", !!authInstance);
    if (!authInstance) {
      if (!firebaseError) { 
         console.error(">>> KAROBHR TRACE: onAuthStateChanged - Firebase Authentication service is not available. This is critical.");
         setFirebaseError(new Error("Firebase Authentication service is not available. Check Firebase configuration."));
      }
      setLoading(false); 
      setUser(null); setRole(null); setCompanyId(null);
      return; 
    }

    const unsubscribe = onAuthStateChanged(authInstance, async (currentFirebaseUser) => {
      console.log(">>> KAROBHR TRACE: onAuthStateChanged triggered. Firebase user UID:", currentFirebaseUser ? currentFirebaseUser.uid : 'null');
      setLoading(true); 
      if (currentFirebaseUser) {
        const fetchedUser = await fetchUserData(currentFirebaseUser, dbInstance); 
        if (!fetchedUser) {
            console.warn(`>>> KAROBHR TRACE: onAuthStateChanged - User ${currentFirebaseUser.uid} authenticated, but profile data not found/loaded. Setting app user to null.`);
            setUser(null); setRole(null); setCompanyId(null);
             setLoading(false); // Set loading false if profile fetch fails
        }
        // If fetchedUser is successful, other data listeners might set loading to false, or it will be set if no other listeners are active.
        // A general setLoading(false) might be needed after all dependent data is attempted to load.
      } else {
        setUser(null); setRole(null); setCompanyId(null);
        setAllUsers([]); setTasks([]); setAnnouncements([]); setAttendanceLog([]);
        setLoading(false); 
        console.log(">>> KAROBHR TRACE: onAuthStateChanged - No Firebase user. Cleared app state, loading set to false.");
      }
    });
    return () => {
      console.log(">>> KAROBHR TRACE: Unsubscribing from onAuthStateChanged.");
      unsubscribe();
    };
  }, [authInstance, dbInstance, fetchUserData, firebaseError]);

  useEffect(() => {
    if (loading && firebaseError) {
      console.log(">>> KAROBHR TRACE: AuthProvider: Firebase error occurred WHILE loading, stopping loading state.");
      setLoading(false);
    }
  }, [firebaseError, loading]);

  // Effect to manage overall loading state based on user and other data states
  useEffect(() => {
    if (!authInstance) return; // Don't manage loading if auth isn't ready

    if (user) { // If user is loaded
        // Check if all essential dependent data for the current role is also loaded
        // This is a simplified check; more granular checks might be needed
        let allEssentialDataLoaded = true;
        if (role === 'admin') {
            if (allUsers.length === 0 && !firebaseError) allEssentialDataLoaded = false; // Example: admin needs allUsers
            if (attendanceLog.length === 0 && !firebaseError) allEssentialDataLoaded = false; // Admin needs attendance
        }
        if (role === 'employee' || role === 'manager') {
            if (tasks.length === 0 && !firebaseError) { /* could consider tasks loading too */ }
        }

        if (allEssentialDataLoaded && loading) {
             // console.log(">>> KAROBHR TRACE: All essential data for user seems loaded, setting loading to false.");
             // setLoading(false); // This might be too aggressive if listeners are still pending
        }
    } else if (!authInstance?.currentUser && !loading) { // No user, and not already loading
        // This case is handled by onAuthStateChanged
    }
  }, [user, role, allUsers, tasks, attendanceLog, announcements, loading, firebaseError, authInstance]);


  useEffect(() => {
    if (!dbInstance || !user || !companyId || role !== 'admin') {
      setAllUsers([]); 
      if (role === 'admin' && loading && (!companyId || !user)) setLoading(false);
      return;
    }
    console.log(`>>> KAROBHR TRACE: Setting up allUsers listener for companyId: ${companyId}`);
    const usersQuery = query(collection(dbInstance, 'users'), where('companyId', '==', companyId));
    const unsubscribe = onSnapshot(usersQuery, (snapshot) => {
      const usersList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User));
      setAllUsers(usersList);
      console.log(">>> KAROBHR TRACE: Fetched/Updated all users for admin:", usersList.length);
      if (loading && role === 'admin') { /* Consider other data like attendance */ }
    }, (error) => {
      console.error(">>> KAROBHR TRACE: Error fetching all users:", error);
      if (!firebaseError) setFirebaseError(new Error("Failed to fetch company users."));
      if (loading) setLoading(false);
    });
    return () => unsubscribe();
  }, [dbInstance, user, companyId, role, firebaseError, loading]);

   useEffect(() => {
    if (!dbInstance || !user || !companyId) {
      setTasks([]);
      if ((role === 'employee' || role === 'manager') && loading && (!user || !companyId)) setLoading(false);
      return;
    }

    let tasksQuery;
    if (role === 'admin' || role === 'manager') {
      console.log(`>>> KAROBHR TRACE: Setting up ADMIN/MANAGER tasks listener for companyId: ${companyId}`);
      tasksQuery = query(collection(dbInstance, `companies/${companyId}/tasks`));
    } else { 
      console.log(`>>> KAROBHR TRACE: Setting up USER tasks listener for employeeId: ${user.employeeId} in companyId: ${companyId}`);
      tasksQuery = query(collection(dbInstance, `companies/${companyId}/tasks`), where('assigneeId', '==', user.employeeId));
    }

    const unsubscribe = onSnapshot(tasksQuery, (snapshot) => {
      const tasksList = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Task));
      setTasks(tasksList);
      console.log(`>>> KAROBHR TRACE: Tasks updated for ${role} (${user.employeeId}):`, tasksList.length);
      if (loading && (role === 'employee' || role === 'manager')) { /* Consider other data */ }
    }, (error) => {
      console.error(">>> KAROBHR TRACE: Error fetching tasks:", error);
      if (!firebaseError) setFirebaseError(new Error("Failed to fetch tasks."));
      if (loading) setLoading(false);
    });

    return () => unsubscribe();
  }, [dbInstance, user, companyId, role, firebaseError, loading]);

  useEffect(() => {
    if (!dbInstance || !companyId) {
      setAnnouncements([]);
      return;
    }
    console.log(`>>> KAROBHR TRACE: Setting up announcements listener for companyId: ${companyId}`);
    const announcementsQuery = query(collection(dbInstance, `companies/${companyId}/announcements`));
    const unsubscribe = onSnapshot(announcementsQuery, (snapshot) => {
      const announcementsList = snapshot.docs.map(docSnapshot => {
        const data = docSnapshot.data();
        return {
          ...data,
          id: docSnapshot.id,
          postedAt: data.postedAt && typeof (data.postedAt as any).toDate === 'function' 
                      ? (data.postedAt as any).toDate().toISOString() 
                      : data.postedAt, // Assuming it might already be a string or needs default
        } as Announcement;
      }).sort((a, b) => new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime());
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
        if (role === 'admin' && loading && (!companyId)) setLoading(false);
        return;
    }
    console.log(`>>> KAROBHR TRACE: Setting up attendanceLog listener for companyId: ${companyId} (Role: ${role})`);
    const attendanceQuery = query(collection(dbInstance, `companies/${companyId}/attendanceLog`));
    const unsubscribe = onSnapshot(attendanceQuery, (snapshot) => {
        const logList = snapshot.docs.map(docSnapshot => {
            const data = docSnapshot.data();
            const eventTimestamp = data.timestamp;
            let isoTimestamp: string;

            if (eventTimestamp && typeof (eventTimestamp as any).toDate === 'function') {
                isoTimestamp = (eventTimestamp as any).toDate().toISOString();
            } else if (typeof eventTimestamp === 'string') {
                isoTimestamp = eventTimestamp;
            } else {
                console.warn(`>>> KAROBHR TRACE: Attendance event ${docSnapshot.id} has invalid or missing timestamp:`, eventTimestamp);
                isoTimestamp = new Date(0).toISOString(); // Default to epoch
            }
            return {
                id: docSnapshot.id,
                employeeId: data.employeeId,
                userId: data.userId,
                userName: data.userName,
                type: data.type,
                timestamp: isoTimestamp,
                photoUrl: data.photoUrl || null,
                location: data.location || null,
                isWithinGeofence: data.isWithinGeofence === undefined ? null : data.isWithinGeofence,
            } as AttendanceEvent;
        });
        setAttendanceLog(logList);
        console.log(">>> KAROBHR TRACE: Attendance log updated:", logList.length);
        if (loading && (role === 'admin' || role === 'manager')) { // Check if this is the last piece of data for admin/manager
            // A more comprehensive check for all required data being loaded would be better
            setLoading(false); // Potentially set loading to false here
        }
    }, (error) => {
        console.error(">>> KAROBHR TRACE: Error fetching attendance log:", error);
        if(!firebaseError) setFirebaseError(new Error("Failed to fetch attendance log."));
        if (loading) setLoading(false); 
    });
    return () => unsubscribe();
  }, [dbInstance, companyId, role, firebaseError, loading]);


  const login = useCallback(async (employeeIdInput: string, passwordInput: string): Promise<User | null> => {
    if (!authInstance || !dbInstance) {
      console.error(">>> KAROBHR TRACE: Login failed - Firebase authInstance or dbInstance not available.");
      if (!firebaseError) setFirebaseError(new Error("Firebase services not available for login."));
      throw new Error("Authentication service not ready. Check Firebase config.");
    }
    
    console.log(`>>> KAROBHR TRACE: login - Attempting login for employeeId: ${employeeIdInput}`);
    try {
      console.log(`>>> KAROBHR TRACE: login - Querying userDirectory for employeeId: ${employeeIdInput}`);
      const userDirectoryQuery = query(collection(dbInstance, 'userDirectory'), where('employeeId', '==', employeeIdInput));
      const directorySnapshot = await getDocs(userDirectoryQuery);
      
      console.log(`>>> KAROBHR TRACE: login - userDirectory snapshot empty? ${directorySnapshot.empty}`);

      if (directorySnapshot.empty) {
        console.warn(`>>> KAROBHR TRACE: login - No user found in userDirectory for employeeId: ${employeeIdInput}.`);
        throw new Error("Invalid User ID or Password.");
      }
      
      const userDirEntry = directorySnapshot.docs[0].data() as UserDirectoryEntry;
      const userEmail = userDirEntry.email; 
      const userCompanyIdFromDirectory = userDirEntry.companyId;
      const userIdFromDirectory = userDirEntry.userId;

      console.log(`>>> KAROBHR TRACE: login - User found in directory. Email: ${userEmail}, CompanyID from Dir: ${userCompanyIdFromDirectory}, UserID from Dir: ${userIdFromDirectory}.`);

      if (!userEmail) {
        console.error(`>>> KAROBHR TRACE: login - User directory entry for ${employeeIdInput} is missing an email.`);
        throw new Error("User configuration error. Please contact support.");
      }
      if (!userIdFromDirectory) {
        console.error(`>>> KAROBHR TRACE: login - User directory entry for ${employeeIdInput} is missing a userId (Auth UID).`);
        throw new Error("User configuration error (missing UID link). Please contact support.");
      }

      console.log(`>>> KAROBHR TRACE: login - Attempting Firebase signInWithEmailAndPassword with email: ${userEmail}`);
      const userCredential = await signInWithEmailAndPassword(authInstance, userEmail, passwordInput);
      const firebaseUser = userCredential.user;
      console.log(`>>> KAROBHR TRACE: login - Firebase Auth successful for UID: ${firebaseUser.uid}, Email: ${firebaseUser.email}`);

      if (firebaseUser.uid !== userIdFromDirectory) {
          console.error(`>>> KAROBHR TRACE: login - UID MISMATCH! Auth UID (${firebaseUser.uid}) vs Directory UID (${userIdFromDirectory}) for ${employeeIdInput}. This is a critical data integrity issue.`);
          await firebaseSignOut(authInstance);
          throw new Error("User data integrity error. Please contact support.");
      }
      
      const loggedInUser = await fetchUserData(firebaseUser, dbInstance, userCompanyIdFromDirectory);
      
      if (loggedInUser) {
        console.log(`>>> KAROBHR TRACE: login - Successfully fetched profile for ${loggedInUser.name} (${loggedInUser.employeeId}). Login complete.`);
        return loggedInUser;
      } else {
        console.error(`>>> KAROBHR TRACE: login - Firebase Auth successful for UID: ${firebaseUser.uid}, but Firestore profile NOT FOUND or fetchUserData failed. This is a critical issue.`);
        await firebaseSignOut(authInstance);
        throw new Error("Login succeeded but user profile could not be loaded.");
      }
    } catch (error: any) {
      console.error(">>> KAROBHR TRACE: login - Error during login process:", error.message || error);
      let detailedErrorMessage = "Invalid User ID or Password.";
      if (error.code) {
        detailedErrorMessage = `Invalid User ID or Password. (Auth code: ${error.code})`;
        console.error(`>>> KAROBHR TRACE: login - Firebase Auth FAILED. Original Error Code: ${error.code}, Message: ${error.message}`);
      }
      if (!firebaseError && !error.message?.includes("Firebase services not available")) { 
        setFirebaseError(error);
      }
      throw new Error(detailedErrorMessage);
    }
  }, [authInstance, dbInstance, fetchUserData, firebaseError]);

  const logout = useCallback(async () => {
    if (!authInstance) {
      console.error(">>> KAROBHR TRACE: Logout failed - Firebase Auth not available.");
      if(!firebaseError) setFirebaseError(new Error("Firebase Auth not available for logout."));
      return;
    }
    console.log(">>> KAROBHR TRACE: Logging out user...");
    try {
      await firebaseSignOut(authInstance);
      console.log(">>> KAROBHR TRACE: User logged out successfully. onAuthStateChanged will clear app state.");
    } catch (error) {
      console.error(">>> KAROBHR TRACE: Logout error:", error);
      if(!firebaseError) setFirebaseError(new Error("Logout failed."));
    }
  }, [authInstance, firebaseError]);

 const addNewEmployee = useCallback(async (employeeData: NewEmployeeData, passwordInput?: string, isFirstAdminExplicit: boolean = false): Promise<FirebaseUser | null> => {
    if (!authInstance || !dbInstance) {
        console.error(">>> KAROBHR TRACE: addNewEmployee failed - Firebase services not available.");
        if (!firebaseError) setFirebaseError(new Error("Firebase services not available for adding employee."));
        throw new Error("Firebase services not ready. Check Firebase configuration.");
    }
    if (!passwordInput) {
        console.error(">>> KAROBHR TRACE: Password is required for new accounts.");
        throw new Error("Password is required for new accounts.");
    }
     if (!employeeData.companyId || typeof employeeData.companyId !== 'string' || employeeData.companyId.trim() === '') {
        console.error(">>> KAROBHR TRACE: addNewEmployee - CRITICAL - companyId is missing or invalid in employeeData:", employeeData.companyId);
        throw new Error("Internal error: Company context is missing for new employee creation.");
    }

    const finalEmail = employeeData.email || `${employeeData.employeeId.toLowerCase().replace(/[^a-z0-9]/gi, '')}@${employeeData.companyId.split('-')[0]}.karobhr.local`;
    const isActuallyFirstAdmin = isFirstAdminExplicit; // Rely on the explicit flag passed

    console.log(`>>> KAROBHR TRACE: addNewEmployee - START - Adding new ${employeeData.role}: ${employeeData.employeeId} for company ${employeeData.companyId} with email ${finalEmail}. Is First Admin (explicitly): ${isActuallyFirstAdmin}`);

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
        const userCredential = await createUserWithEmailAndPassword(authInstance, finalEmail, passwordInput);
        newFirebaseUser = userCredential.user;
        console.log(`>>> KAROBHR TRACE: addNewEmployee - Firebase Auth user created successfully. UID: ${newFirebaseUser.uid}`);

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
        const userDirectoryDocRef = doc(dbInstance, `userDirectory/${newFirebaseUser.uid}`);

        console.log(`>>> KAROBHR TRACE: addNewEmployee - Preparing batch write for UID: ${newFirebaseUser.uid}. UserDoc path: users/${newFirebaseUser.uid}, DirDoc path: userDirectory/${newFirebaseUser.uid}`);
        const batch = writeBatch(dbInstance);

        batch.set(userDocRef, newUserDocument);
        console.log(`>>> KAROBHR TRACE: addNewEmployee - Added set(userDocRef) to batch for ${newUserDocument.employeeId}`);

        batch.set(userDirectoryDocRef, {
            userId: newFirebaseUser.uid,
            employeeId: newUserDocument.employeeId,
            email: newUserDocument.email,
            companyId: newUserDocument.companyId,
            role: newUserDocument.role,
            name: newUserDocument.name,
        } as UserDirectoryEntry);
        console.log(`>>> KAROBHR TRACE: addNewEmployee - Added set(userDirectoryDocRef) to batch for ${newUserDocument.employeeId}`);

        if (isActuallyFirstAdmin) {
            const companyDocRef = doc(dbInstance, `companies/${employeeData.companyId}`);
            batch.set(companyDocRef, {
                companyId: employeeData.companyId,
                companyName: employeeData.name, // Or use company name from signup form
                createdAt: serverTimestamp(),
                adminUid: newFirebaseUser.uid,
            });
            console.log(`>>> KAROBHR TRACE: addNewEmployee - Added set(companyDocRef) to batch for new company: ${employeeData.companyId}`);
        }

        await batch.commit();
        console.log(`>>> KAROBHR TRACE: addNewEmployee - SUCCESS - Batch commit successful. User profile and directory entry created for ${newUserDocument.employeeId} (UID: ${newFirebaseUser.uid}).`);

        if (user && user.role === 'admin' && user.companyId === newUserDocument.companyId && user.id !== newFirebaseUser.uid) {
            setAllUsers(prev => [...prev, newUserDocument].sort((a, b) => (a.name || "").localeCompare(b.name || "")));
            console.log(`>>> KAROBHR TRACE: addNewEmployee - Admin added new user, updated local allUsers state.`);
        } else if (isActuallyFirstAdmin) {
            console.log(">>> KAROBHR TRACE: addNewEmployee - First admin created. Auth state change will handle login context.");
        }
        return newFirebaseUser;

    } catch (error: any) {
        console.error(`>>> KAROBHR TRACE: addNewEmployee - ERROR during user creation for ${employeeData.employeeId}:`, error.code, error.message, error);
        if (newFirebaseUser && error.code !== 'auth/email-already-in-use') {
            console.warn(`>>> KAROBHR TRACE: addNewEmployee - Firebase Auth user ${newFirebaseUser.uid} was created, but Firestore operations failed. Manual cleanup of Auth user might be needed.`);
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
    try {
        const taskCollectionRef = collection(dbInstance, `companies/${companyId}/tasks`);
        const taskWithTimestamps = {
            ...newTaskData,
            createdAt: serverTimestamp() as unknown as string, 
            updatedAt: serverTimestamp() as unknown as string,
        };
        const taskRef = await addDoc(taskCollectionRef, taskWithTimestamps);
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
        const { id, createdAt, ...dataToUpdate } = updatedTaskData; 
        const updatePayload = { ...dataToUpdate, updatedAt: serverTimestamp() };
        await updateDoc(taskRef, updatePayload);
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
        appliedAt: new Date().toISOString(), // Will be replaced by serverTimestamp
    };
    try {
        const userDocRef = doc(dbInstance, `users/${user.id}`);
        const leaveWithIdAndTimestamp = { 
            ...newLeave, 
            id: uuidv4(),
            appliedAt: serverTimestamp() // Use serverTimestamp here
        }; 
        await updateDoc(userDocRef, {
            leaves: arrayUnion(leaveWithIdAndTimestamp)
        });
        console.log(">>> KAROBHR TRACE: Leave application added for user:", user.employeeId);
        // Optimistic update for UI, actual timestamp conversion will happen on read or via listener
        setUser(prevUser => {
            if (!prevUser) return null;
            const localLeaveToAdd = {
                ...leaveWithIdAndTimestamp, 
                // For immediate UI, use local time. Listener will get precise server time.
                appliedAt: new Date().toISOString() 
            };
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
            processedAt: serverTimestamp() as unknown as string, // Use serverTimestamp
        };
        await updateDoc(employeeDocRef, { leaves: updatedLeaves });
        console.log(">>> KAROBHR TRACE: Leave application processed successfully.");
        // Listener will update allUsers, no need for manual setAllUsers here if listener is efficient
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
    const newAnnouncementData: Omit<Announcement, 'id' | 'postedAt'> = { 
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
        setUser(prevUser => ({...prevUser, ...updatedUser})); 
        console.log(">>> KAROBHR TRACE: Current user updated in context.");
     }
     setAllUsers(prevAllUsers => prevAllUsers.map(u => u.id === updatedUser.id ? {...u, ...updatedUser} : u).sort((a, b) => (a.name || "").localeCompare(b.name || "")));
     console.log(">>> KAROBHR TRACE: User updated in allUsers list (if present).");
     
     if (dbInstance) { 
        const userDocRef = doc(dbInstance, `users/${updatedUser.id}`);
        const { id, ...dataToSync } = updatedUser; 
        
        const finalDataToSync: any = { ...dataToSync };
        // Convert Date objects back to Timestamps or handle serverTimestamps appropriately if needed for update
        // This part is tricky if User type contains actual Date objects from client-side modifications.
        // For now, we assume direct sync is fine if User type primarily uses strings for dates from Firestore.
        // If User.leaves contains complex objects with Dates, they need careful handling or serverTimestamp updates.
        
        // Example: If `leaves` could contain local Date objects not yet persisted as Timestamps:
        if (finalDataToSync.leaves) {
            finalDataToSync.leaves = finalDataToSync.leaves.map((leave: LeaveApplication) => ({
                ...leave,
                // Ensure dates are in a format Firestore expects if they were modified client-side
                // This example assumes they are already ISO strings or serverTimestamp placeholders
                appliedAt: leave.appliedAt, // Or convert to serverTimestamp if it's a new uncommitted leave
                processedAt: leave.processedAt,
            }));
        }


        updateDoc(userDocRef, finalDataToSync) 
            .then(() => console.log(`>>> KAROBHR TRACE: User ${updatedUser.employeeId} successfully synced to Firestore.`))
            .catch(err => console.error(`>>> KAROBHR TRACE: Failed to sync user update to Firestore for ${updatedUser.employeeId}:`, err));
        
        const dirDocRef = doc(dbInstance, `userDirectory/${updatedUser.id}`);
        const dirDataToUpdate: Partial<UserDirectoryEntry> = {};
        if (updatedUser.name !== undefined) dirDataToUpdate.name = updatedUser.name;
        if (updatedUser.email !== undefined) dirDataToUpdate.email = updatedUser.email;
        if (updatedUser.role !== undefined) dirDataToUpdate.role = updatedUser.role;

        if(Object.keys(dirDataToUpdate).length > 0) {
            updateDoc(dirDocRef, dirDataToUpdate)
            .then(() => console.log(`>>> KAROBHR TRACE: UserDirectory for ${updatedUser.employeeId} successfully synced to Firestore.`))
            .catch(err => console.error(`>>> KAROBHR TRACE: Failed to sync UserDirectory update for ${updatedUser.employeeId}:`, err));
        }
     } else {
        console.warn(">>> KAROBHR TRACE: DB instance not available, cannot sync user update to Firestore for:", updatedUser.employeeId);
     }
  }, [user, dbInstance]); 

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
        const photoRefStorage = ref(storageInstance, `companies/${companyId}/attendancePhotos/${user.id}/${photoFileName}`);
        try {
            const base64String = eventData.photoDataUrl.split(',')[1];
            if (!base64String) throw new Error("Invalid photo data URL format for base64 extraction.");
            const snapshot = await uploadString(photoRefStorage, base64String, 'base64', { contentType: 'image/jpeg' });
            photoFinalUrl = await getDownloadURL(snapshot.ref);
            console.log(">>> KAROBHR TRACE: Photo uploaded successfully:", photoFinalUrl);
        } catch (uploadError) {
            console.error(">>> KAROBHR TRACE: Error uploading attendance photo:", uploadError);
        }
    }

    const newAttendanceEventData: Omit<AttendanceEvent, 'id' | 'timestamp'> = { 
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
        dateRequested: new Date().toISOString(), // Client-side timestamp, could be serverTimestamp on write too
        status: 'pending',
    };
    try {
        const userDocRef = doc(dbInstance, `users/${user.id}`);
        // For arrayUnion, ensure dateRequested is a consistent type (string or Firestore Timestamp)
        // If using serverTimestamp for dateRequested, the newAdvance object would need to reflect that
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
            dateProcessed: new Date().toISOString(), // Client-side timestamp, consider serverTimestamp
        };
        await updateDoc(employeeDocRef, { advances: updatedAdvances });
        console.log(">>> KAROBHR TRACE: Advance processed successfully.");
        // Listener will update allUsers
    } catch (error) {
        console.error(">>> KAROBHR TRACE: Error processing advance:", error);
        throw new Error("Failed to process advance.");
    }
  },[dbInstance, user]);


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
    
