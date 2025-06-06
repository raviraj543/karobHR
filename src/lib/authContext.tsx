
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
  standardDailyHours?: number; // Added standard daily working hours
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
            id: uidToFetch,
            employeeId: userDataFromDb.employeeId,
            email: userDataFromDb.email,
            name: userDataFromDb.name,
            role: userDataFromDb.role,
            companyId: userDataFromDb.companyId,
            department: userDataFromDb.department,
            joiningDate: userDataFromDb.joiningDate,
            baseSalary: userDataFromDb.baseSalary,
            standardDailyHours: userDataFromDb.standardDailyHours, // Added standardDailyHours
            profilePictureUrl: userDataFromDb.profilePictureUrl || null,
            advances: userDataFromDb.advances || [],
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

    let isMounted = true;
    const unsubscribe = onAuthStateChanged(authInstance, async (currentFirebaseUser) => {
      if (!isMounted) return;
      console.log(">>> KAROBHR TRACE: onAuthStateChanged triggered. Firebase user UID:", currentFirebaseUser ? currentFirebaseUser.uid : 'null');
      setLoading(true);
      if (currentFirebaseUser) {
        const fetchedUser = await fetchUserData(currentFirebaseUser, dbInstance);
        if (fetchedUser) {
          // setLoading will be handled by data listeners or if no listeners are active
        } else {
          console.warn(`>>> KAROBHR TRACE: onAuthStateChanged - User ${currentFirebaseUser.uid} authenticated, but profile data not found/loaded. Setting app user to null.`);
          setUser(null); setRole(null); setCompanyId(null);
          setLoading(false);
        }
      } else {
        setUser(null); setRole(null); setCompanyId(null);
        setAllUsers([]); setTasks([]); setAnnouncements([]); setAttendanceLog([]);
        setLoading(false);
        console.log(">>> KAROBHR TRACE: onAuthStateChanged - No Firebase user. Cleared app state, loading set to false.");
      }
    });
    return () => {
      isMounted = false;
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

  // Data listeners
  useEffect(() => {
    if (!dbInstance || !user || !companyId || role !== 'admin') {
      setAllUsers([]);
      return;
    }
    const usersQuery = query(collection(dbInstance, 'users'), where('companyId', '==', companyId));
    const unsubscribe = onSnapshot(usersQuery, (snapshot) => {
      const usersList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User));
      setAllUsers(usersList);
    }, (error) => {
      console.error(">>> KAROBHR TRACE: Error fetching all users:", error);
    });
    return () => unsubscribe();
  }, [dbInstance, user, companyId, role]);

   useEffect(() => {
    if (!dbInstance || !user || !companyId) {
      setTasks([]);
      return;
    }
    let tasksQuery;
    if (role === 'admin' || role === 'manager') {
      tasksQuery = query(collection(dbInstance, `companies/${companyId}/tasks`));
    } else {
      tasksQuery = query(collection(dbInstance, `companies/${companyId}/tasks`), where('assigneeId', '==', user.employeeId));
    }
    const unsubscribe = onSnapshot(tasksQuery, (snapshot) => {
      const tasksList = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Task));
      setTasks(tasksList);
    }, (error) => {
      console.error(">>> KAROBHR TRACE: Error fetching tasks:", error);
    });
    return () => unsubscribe();
  }, [dbInstance, user, companyId, role]);

  useEffect(() => {
    if (!dbInstance || !companyId) {
      setAnnouncements([]);
      return;
    }
    const announcementsQuery = query(collection(dbInstance, `companies/${companyId}/announcements`));
    const unsubscribe = onSnapshot(announcementsQuery, (snapshot) => {
      const announcementsList = snapshot.docs.map(docSnapshot => {
        const data = docSnapshot.data();
        return {
          ...data,
          id: docSnapshot.id,
          postedAt: data.postedAt && typeof (data.postedAt as any).toDate === 'function'
                      ? (data.postedAt as any).toDate().toISOString()
                      : data.postedAt,
        } as Announcement;
      }).sort((a, b) => new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime());
      setAnnouncements(announcementsList);
    }, (error) => {
      console.error(">>> KAROBHR TRACE: Error fetching announcements:", error);
    });
    return () => unsubscribe();
  }, [dbInstance, companyId]);

  useEffect(() => {
    if (!dbInstance || !companyId || (role !== 'admin' && role !== 'manager')) {
        setAttendanceLog([]);
        return;
    }
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
                isoTimestamp = new Date(0).toISOString();
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
        // Set loading to false here only if this is the last piece of data to load for this role
        if (loading && (role === 'admin' || role === 'manager')) {
          // This is a simplified loading complete check. A more robust solution might track multiple loading states.
          // Assuming if admin/manager is logged in and attendance log is fetched, they are "loaded" for basic ops.
          // setLoading(false); // Be cautious with this, ensure other essential data is loaded too
        }
    }, (error) => {
        console.error(">>> KAROBHR TRACE: Error fetching attendance log:", error);
        if (loading) setLoading(false);
    });
    return () => unsubscribe();
  }, [dbInstance, companyId, role, loading]); // Added loading to dep array for the setLoading(false)

  // Effect to manage overall loading state after all data listeners attempt to run
  useEffect(() => {
      // If there's no authenticated user, and we're not already trying to log in (auth is not loading), then app isn't loading.
      if (!authInstance?.currentUser && !loading && !user) {
          if (loading) setLoading(false); // Ensure loading is false if no user and not auth-loading
          return;
      }

      // If user is loaded, determine if all essential data for their role is also loaded
      if (user && loading) {
          let allDataConsideredLoaded = false;
          if (role === 'admin') {
              // Admin needs allUsers and attendanceLog (and tasks, announcements are company-wide so less critical for "user is loaded" feel)
              // This is a simple check, could be more refined
              if (allUsers.length > 0 || attendanceLog.length > 0) { // or use specific flags for each data load
                  allDataConsideredLoaded = true;
              }
          } else if (role === 'manager') {
              // Manager might need tasks and attendanceLog
              if (tasks.length > 0 || attendanceLog.length > 0) {
                  allDataConsideredLoaded = true;
              }
          } else if (role === 'employee') {
              // Employee might primarily need their tasks
              if (tasks.length > 0 || (user.leaves !== undefined && user.advances !== undefined)) { // Check if user sub-collections are at least initialized
                allDataConsideredLoaded = true;
              }
          }

          // Fallback: if user exists but role-specific data checks don't pass after a timeout, stop loading
          const timer = setTimeout(() => {
            if (loading && user) {
                console.warn(">>> KAROBHR TRACE: Loading timeout for user data, setting loading to false.");
                setLoading(false);
            }
          }, 5000); // 5 second timeout

          if (allDataConsideredLoaded) {
              clearTimeout(timer);
              setLoading(false);
              console.log(`>>> KAROBHR TRACE: All essential data for user ${user.employeeId} (role: ${role}) seems loaded. Loading finished.`);
          }
          return () => clearTimeout(timer);
      }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, role, allUsers, tasks, attendanceLog, companyId, authInstance, loading]); // Added loading here

  const login = useCallback(async (employeeIdInput: string, passwordInput: string): Promise<User | null> => {
    if (!authInstance || !dbInstance) {
      console.error(">>> KAROBHR TRACE: Login failed - Firebase authInstance or dbInstance not available.");
      if (!firebaseError) setFirebaseError(new Error("Firebase services not available for login."));
      throw new Error("Authentication service not ready. Check Firebase config.");
    }
    setLoading(true);
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
       if (error.code && (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential')) {
        detailedErrorMessage = "Invalid User ID or Password."; // Keep it generic for security
        console.error(`>>> KAROBHR TRACE: login - Firebase Auth FAILED. Original Error Code: ${error.code}, Message: ${error.message}`);
      } else if (error.message && error.message.startsWith("User data inconsistency")) {
        detailedErrorMessage = error.message;
      } else if (error.message && error.message.startsWith("Login succeeded but user profile could not be loaded")) {
        detailedErrorMessage = error.message;
      }
      // setLoading(false); // Let onAuthStateChanged handle overall loading state
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
    setLoading(true);
    try {
      await firebaseSignOut(authInstance);
      console.log(">>> KAROBHR TRACE: User logged out successfully. onAuthStateChanged will clear app state.");
    } catch (error) {
      console.error(">>> KAROBHR TRACE: Logout error:", error);
      if(!firebaseError) setFirebaseError(new Error("Logout failed."));
    } finally {
      // setLoading(false); // onAuthStateChanged will set user to null, which sets loading to false
    }
  }, [authInstance, firebaseError]);

 const addNewEmployee = useCallback(async (employeeData: NewEmployeeData, passwordInput?: string): Promise<FirebaseUser | null> => {
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
        throw new Error("Internal error: Company context is missing for new employee creation. CompanyId provided: " + employeeData.companyId);
    }

    const finalEmail = employeeData.email || `${employeeData.employeeId.toLowerCase().replace(/[^a-z0-9]/gi, '')}@${employeeData.companyId.split('-')[0]}.karobhr.local`;
    const isCreatingFirstAdmin = employeeData.role === 'admin' && (!user || user.role !== 'admin'); // Simplified: if creating admin AND no current admin or current user isn't admin. More robust logic might be needed.

    console.log(`>>> KAROBHR TRACE: addNewEmployee - START - Adding new ${employeeData.role}: ${employeeData.employeeId} for company ${employeeData.companyId} with email ${finalEmail}. Is First Admin (logic): ${isCreatingFirstAdmin}`);

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
            id: newFirebaseUser.uid, // Use Auth UID as document ID
            employeeId: employeeData.employeeId,
            email: finalEmail,
            name: employeeData.name,
            role: employeeData.role,
            companyId: employeeData.companyId,
            department: employeeData.department,
            joiningDate: employeeData.joiningDate || new Date().toISOString().split('T')[0],
            baseSalary: employeeData.baseSalary || 0,
            standardDailyHours: employeeData.standardDailyHours || 8, // Default to 8 if not provided
            profilePictureUrl: employeeData.profilePictureUrl || null,
            advances: [],
            leaves: [],
            mockAttendanceFactor: 1.0,
        };

        const userDocRef = doc(dbInstance, `users/${newFirebaseUser.uid}`); // UID as doc ID
        const userDirectoryDocRef = doc(dbInstance, `userDirectory/${newFirebaseUser.uid}`); // UID as doc ID

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

        if (isCreatingFirstAdmin) {
            const companyDocRef = doc(dbInstance, `companies/${employeeData.companyId}`);
            batch.set(companyDocRef, {
                companyId: employeeData.companyId,
                companyName: employeeData.name, // Assuming admin name for company for simplicity, adjust as needed
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
        } else if (isCreatingFirstAdmin) {
            console.log(">>> KAROBHR TRACE: addNewEmployee - First admin created. Auth state change will handle login context.");
        }
        return newFirebaseUser;

    } catch (error: any) {
        console.error(`>>> KAROBHR TRACE: addNewEmployee - ERROR during user creation for ${employeeData.employeeId}:`, error.code, error.message, error);
        if (newFirebaseUser && error.code !== 'auth/email-already-in-use') {
            // Attempt to delete the Auth user if Firestore operations failed to keep things clean
            // This is a best-effort, might fail if user re-authenticates quickly etc.
            console.warn(`>>> KAROBHR TRACE: addNewEmployee - Firebase Auth user ${newFirebaseUser.uid} was created, but Firestore operations failed. Attempting to delete Auth user.`);
            try {
              await newFirebaseUser.delete();
              console.log(`>>> KAROBHR TRACE: addNewEmployee - Successfully deleted orphaned Auth user ${newFirebaseUser.uid}.`);
            } catch (deleteError) {
              console.error(`>>> KAROBHR TRACE: addNewEmployee - Failed to delete orphaned Auth user ${newFirebaseUser.uid}. Manual cleanup might be needed.`, deleteError);
            }
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
        appliedAt: new Date().toISOString(),
    };
    try {
        const userDocRef = doc(dbInstance, `users/${user.id}`);
        const leaveWithIdAndTimestamp = {
            ...newLeave,
            id: uuidv4(),
            appliedAt: serverTimestamp()
        };
        await updateDoc(userDocRef, {
            leaves: arrayUnion(leaveWithIdAndTimestamp)
        });
        console.log(">>> KAROBHR TRACE: Leave application added for user:", user.employeeId);
        setUser(prevUser => {
            if (!prevUser) return null;
            const localLeaveToAdd = {
                ...leaveWithIdAndTimestamp,
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
            processedAt: serverTimestamp() as unknown as string,
        };
        await updateDoc(employeeDocRef, { leaves: updatedLeaves });
        console.log(">>> KAROBHR TRACE: Leave application processed successfully.");
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
        if (finalDataToSync.leaves) {
            finalDataToSync.leaves = finalDataToSync.leaves.map((leave: LeaveApplication) => ({
                ...leave,
                appliedAt: leave.appliedAt,
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
        // Ensure standardDailyHours is synced if it changes
        if (updatedUser.standardDailyHours !== undefined) (dirDataToUpdate as any).standardDailyHours = updatedUser.standardDailyHours;


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
            // Decide if you want to throw error or continue without photo
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
        dateRequested: new Date().toISOString(),
        status: 'pending',
    };
    try {
        const userDocRef = doc(dbInstance, `users/${user.id}`);
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
            dateProcessed: new Date().toISOString(),
        };
        await updateDoc(employeeDocRef, { advances: updatedAdvances });
        console.log(">>> KAROBHR TRACE: Advance processed successfully.");
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
