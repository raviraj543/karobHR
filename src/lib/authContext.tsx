
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
import type { User, UserRole, Task, LeaveApplication, Announcement, UserDirectoryEntry, Advance, AttendanceEvent, LocationInfo, MonthlyPayrollReport, Holiday, CompanySettings } from '@/lib/types';
import { getStorage, ref, uploadString, getDownloadURL, deleteObject } from "firebase/storage";
import { v4 as uuidv4 } from 'uuid';
import { getWorkingDaysInMonth, isSunday, formatDuration } from '@/lib/dateUtils';
import { calculateDistance } from '@/lib/locationUtils'; // Import new utility
import { differenceInMilliseconds, parseISO, isToday, getMonth, getYear, format, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';


console.log(">>> KAROBHR TRACE: Attempting to load src/lib/authContext.tsx module...");

export interface NewEmployeeData {
  name: string;
  employeeId: string;
  email?: string | null;
  department: string;
  role: UserRole;
  companyId: string;
  companyName: string; // Added companyName
  joiningDate?: string;
  baseSalary?: number;
  standardDailyHours?: number;
  profilePictureUrl?: string | null;
  remoteWorkLocation?: User['remoteWorkLocation'];
}

export interface AuthContextType {
  user: User | null;
  role: UserRole;
  loading: boolean;
  companyId: string | null;
  companySettings: CompanySettings | null | undefined; // Can be undefined while loading
  firebaseError: Error | null;
  login: (employeeId: string, password: string) => Promise<User | null>;
  logout: () => Promise<void>;
  addNewEmployee: (employeeData: NewEmployeeData, password?: string) => Promise<FirebaseUser | null>;
  allUsers: User[];
  tasks: Task[];
  addTask: (task: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  updateTask: (task: Task) => Promise<void>;
  deleteTask?: (taskId: string) => Promise<void>;
  leaveApplications: LeaveApplication[];
  addLeaveApplication: (leaveData: Omit<LeaveApplication, 'id' | 'userId' | 'employeeId' | 'appliedAt' | 'status'>) => Promise<void>;
  processLeaveApplication: (employeeUid: string, leaveId: string, newStatus: 'approved' | 'rejected') => Promise<void>;
  announcements: Announcement[];
  addAnnouncement: (title: string, content: string) => Promise<void>;
  updateUserInContext: (updatedUser: User) => Promise<void>;
  updateCompanySettings: (settingsUpdate: Partial<CompanySettings['officeLocation']>) => Promise<void>;
  attendanceLog: AttendanceEvent[];
  addAttendanceEvent: (eventData: Omit<AttendanceEvent, 'id' | 'userId' | 'employeeId' | 'userName' | 'timestamp' | 'isWithinGeofence' | 'matchedGeofenceType'> & { photoDataUrl?: string | null }) => Promise<void>;
  requestAdvance: (employeeId: string, amount: number, reason: string) => Promise<void>;
  processAdvance: (employeeFirebaseUID: string, advanceId: string, status: 'approved' | 'rejected') => Promise<void>;
  calculateMonthlyPayrollDetails: (
    employee: User,
    forYear: number,
    forMonth: number, // 0-11
    employeeAttendanceEvents: AttendanceEvent[],
    companyHolidays?: Holiday[]
  ) => MonthlyPayrollReport;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  console.log(">>> KAROBHR TRACE: AuthProvider component rendering/re-rendering...");

  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<UserRole>(null);
  const [loading, setLoading] = useState(true); // Start as true
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [companySettings, setCompanySettings] = useState<CompanySettings | null | undefined>(undefined); // Start as undefined
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
        console.log(`>>> KAROBHR TRACE: fetchUserData - Raw data from Firestore for UID ${uidToFetch}:`, JSON.stringify(userDataFromDb));


        if (expectedCompanyId && userDataFromDb.companyId !== expectedCompanyId) {
            console.error(`>>> KAROBHR TRACE: fetchUserData - CRITICAL MISMATCH! Profile companyId (${userDataFromDb.companyId}) vs expectedCompanyId from userDirectory (${expectedCompanyId}) for UID ${uidToFetch}. This indicates data inconsistency.`);
            if (authInstance) await firebaseSignOut(authInstance);
            setUser(null); setRole(null); setCompanyId(null); setCompanySettings(undefined); // Reset companySettings
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
            baseSalary: userDataFromDb.baseSalary || 0,
            standardDailyHours: userDataFromDb.standardDailyHours || 8,
            profilePictureUrl: userDataFromDb.profilePictureUrl || null,
            advances: userDataFromDb.advances || [],
            leaves: (userDataFromDb.leaves || []).map((leave: any) => ({
              ...leave,
              appliedAt: leave.appliedAt && typeof leave.appliedAt.toDate === 'function' ? leave.appliedAt.toDate().toISOString() : (typeof leave.appliedAt === 'string' ? leave.appliedAt : new Date(0).toISOString()),
              processedAt: leave.processedAt && typeof leave.processedAt.toDate === 'function' ? leave.processedAt.toDate().toISOString() : (typeof leave.processedAt === 'string' ? leave.processedAt : undefined),
            })),
            mockAttendanceFactor: userDataFromDb.mockAttendanceFactor !== undefined ? userDataFromDb.mockAttendanceFactor : 1.0,
            remoteWorkLocation: userDataFromDb.remoteWorkLocation || undefined,
        };
        console.log(`>>> KAROBHR TRACE: fetchUserData - SUCCESS - User document found for UID: ${uidToFetch}. Employee ID: ${completeUserData.employeeId}, Role: ${completeUserData.role}, Company ID: ${completeUserData.companyId}`);

        setUser(completeUserData);
        setRole(completeUserData.role);
        setCompanyId(completeUserData.companyId);
        // companySettings will be fetched by its own listener now that companyId is set.
        // No need to setCompanySettings(undefined) here if companyId is valid, as listener will take over.
        if (!completeUserData.companyId) {
            setCompanySettings(undefined); // No company context for settings
        }
        return completeUserData;
      } else {
        console.warn(`>>> KAROBHR TRACE: fetchUserData - WARNING - No user document found in Firestore 'users/${uidToFetch}'. Auth UID: ${uidToFetch}.`);
        // If expectedCompanyId was passed (e.g. from login), set it so companySettings listener might run if it's an admin setup case
        if (expectedCompanyId) setCompanyId(expectedCompanyId);
        else setCompanyId(null);
        setUser(null); setRole(null); setCompanySettings(undefined); // Ensure companySettings is reset
        return null;
      }
    } catch (error) {
      console.error(`>>> KAROBHR TRACE: fetchUserData - ERROR fetching user data from Firestore for UID ${uidToFetch}:`, error);
      if (!firebaseError) setFirebaseError(new Error("Failed to fetch user data."));
      return null;
    }
  }, [firebaseError, authInstance]);


  // Main auth state listener
  useEffect(() => {
    console.log(">>> KAROBHR TRACE: AuthProvider useEffect for onAuthStateChanged running. Auth instance available:", !!authInstance);
    if (!authInstance) {
      if (!firebaseError) {
         console.error(">>> KAROBHR TRACE: onAuthStateChanged - Firebase Authentication service is not available. This is critical.");
         setFirebaseError(new Error("Firebase Authentication service is not available. Check Firebase configuration."));
      }
      setLoading(false);
      setUser(null); setRole(null); setCompanyId(null); setCompanySettings(undefined);
      return;
    }

    let isMounted = true;
    setLoading(true);
    console.log(">>> KAROBHR TRACE: onAuthStateChanged - Setting loading to TRUE at start of auth check.");


    const unsubscribe = onAuthStateChanged(authInstance, async (currentFirebaseUser) => {
      if (!isMounted) return;
      console.log(">>> KAROBHR TRACE: onAuthStateChanged triggered. Firebase user UID:", currentFirebaseUser ? currentFirebaseUser.uid : 'null');

      if (currentFirebaseUser) {
        const fetchedUser = await fetchUserData(currentFirebaseUser, dbInstance);
        if (!fetchedUser || !fetchedUser.companyId) {
          setUser(null); setRole(null); setCompanyId(null); setCompanySettings(undefined);
          setLoading(false);
          console.warn(`>>> KAROBHR TRACE: onAuthStateChanged - User ${currentFirebaseUser.uid} authenticated, but profile/companyId not loaded. Setting loading false.`);
        }
      } else {
        setUser(null); setRole(null); setCompanyId(null); setCompanySettings(undefined);
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


  // Listener for company settings if companyId is known
  useEffect(() => {
    let unsub: (() => void) | undefined;
    if (!dbInstance || !companyId) {
      console.log(">>> KAROBHR TRACE: Company settings listener - No DB or companyId. Setting companySettings to undefined.");
      setCompanySettings(undefined);
      return;
    }
    console.log(">>> KAROBHR TRACE: Subscribing to companySettings for company:", companyId);
    const companySettingsRef = doc(dbInstance, `companies/${companyId}`);
    unsub = onSnapshot(companySettingsRef, (docSnapshot) => {
      if (docSnapshot.exists()) {
        const settingsData = docSnapshot.data() as CompanySettings;
        setCompanySettings(settingsData);
        console.log(">>> KAROBHR TRACE: Company settings updated/loaded:", settingsData);
      } else {
        setCompanySettings(null);
        console.warn(">>> KAROBHR TRACE: Company settings document does not exist for company:", companyId);
      }
    }, (error) => {
      console.error(">>> KAROBHR TRACE: Error fetching company settings:", error);
      setCompanySettings(null);
    });
    return () => unsub && unsub();
  }, [dbInstance, companyId]);


  // Effect to finalize loading state based on user and companySettings resolution
  useEffect(() => {
    if (firebaseError || !authInstance) {
      if (loading) {
        setLoading(false);
        console.log(">>> KAROBHR TRACE: Final loading (false) due to firebaseError or no authInstance.");
      }
      return;
    }

    if (user) {
      if (companyId && companySettings !== undefined) {
        if (loading) {
          setLoading(false);
          console.log(`>>> KAROBHR TRACE: Final loading (false): User ${user.employeeId}, CompanySettings resolved (value: ${companySettings === null ? 'null' : 'exists'}).`);
        }
      }
    } else {
      if (loading) {
        setLoading(false);
        console.log(">>> KAROBHR TRACE: Final loading (false) due to no user (safeguard).");
      }
    }
  }, [user, companyId, companySettings, firebaseError, authInstance, loading]);



  useEffect(() => {
    let unsub: (() => void) | undefined;
    if (!dbInstance || !user || !companyId || role !== 'admin') {
      setAllUsers([]);
      return;
    }
    console.log(">>> KAROBHR TRACE: Admin user detected, subscribing to allUsers for company:", companyId);
    const usersQuery = query(collection(dbInstance, 'users'), where('companyId', '==', companyId));
    unsub = onSnapshot(usersQuery, (snapshot) => {
      const usersList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User));
      setAllUsers(usersList);
      console.log(">>> KAROBHR TRACE: allUsers updated for admin. Count:", usersList.length);
    }, (error) => {
      console.error(">>> KAROBHR TRACE: Error fetching all users:", error);
    });
    return () => unsub && unsub();
  }, [dbInstance, user, companyId, role]);

   useEffect(() => {
    let unsub: (() => void) | undefined;
    if (!dbInstance || !user || !companyId) {
      setTasks([]);
      return;
    }
    console.log(`>>> KAROBHR TRACE: User ${user.employeeId} (Role: ${role}) detected, subscribing to tasks for company: ${companyId}`);
    let tasksQuery;
    if (role === 'admin' || role === 'manager') {
      tasksQuery = query(collection(dbInstance, `companies/${companyId}/tasks`));
    } else { // employee
      tasksQuery = query(collection(dbInstance, `companies/${companyId}/tasks`), where('assigneeId', '==', user.employeeId));
    }
    unsub = onSnapshot(tasksQuery, (snapshot) => {
      const tasksList = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Task));
      setTasks(tasksList);
      console.log(">>> KAROBHR TRACE: Tasks updated. Count:", tasksList.length);
    }, (error) => {
      console.error(">>> KAROBHR TRACE: Error fetching tasks:", error);
    });
    return () => unsub && unsub();
  }, [dbInstance, user, companyId, role]);

  useEffect(() => {
    let unsub: (() => void) | undefined;
    if (!dbInstance || !companyId) {
      setAnnouncements([]);
      return;
    }
    console.log(">>> KAROBHR TRACE: Subscribing to announcements for company:", companyId);
    const announcementsQuery = query(collection(dbInstance, `companies/${companyId}/announcements`));
    unsub = onSnapshot(announcementsQuery, (snapshot) => {
      const announcementsList = snapshot.docs.map(docSnapshot => {
        const data = docSnapshot.data();
        return {
          ...data,
          id: docSnapshot.id,
          postedAt: data.postedAt && typeof (data.postedAt as any).toDate === 'function'
                      ? (data.postedAt as any).toDate().toISOString()
                      : (typeof data.postedAt === 'string' ? data.postedAt : new Date(0).toISOString()),
        } as Announcement;
      }).sort((a, b) => new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime());
      setAnnouncements(announcementsList);
      console.log(">>> KAROBHR TRACE: Announcements updated. Count:", announcementsList.length);
    }, (error) => {
      console.error(">>> KAROBHR TRACE: Error fetching announcements:", error);
    });
    return () => unsub && unsub();
  }, [dbInstance, companyId]);

  useEffect(() => {
    let unsub: (() => void) | undefined;
    if (!dbInstance || !companyId || (role !== 'admin' && role !== 'manager')) {
        setAttendanceLog([]);
        return;
    }
    console.log(`>>> KAROBHR TRACE: Role ${role} detected, subscribing to attendanceLog for company: ${companyId}`);
    const attendanceQuery = query(collection(dbInstance, `companies/${companyId}/attendanceLog`));
    unsub = onSnapshot(attendanceQuery, (snapshot) => {
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
                matchedGeofenceType: data.matchedGeofenceType || null,
            } as AttendanceEvent;
        });
        setAttendanceLog(logList);
        console.log(">>> KAROBHR TRACE: Attendance log updated. Count:", logList.length);
    }, (error) => {
        console.error(">>> KAROBHR TRACE: Error fetching attendance log:", error);
    });
    return () => unsub && unsub();
  }, [dbInstance, companyId, role, user ]);


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
        setLoading(false); 
        throw new Error("Invalid User ID or Password.");
      }

      const userDirEntry = directorySnapshot.docs[0].data() as UserDirectoryEntry;
      const userEmail = userDirEntry.email;
      const userCompanyIdFromDirectory = userDirEntry.companyId;
      const userIdFromDirectory = userDirEntry.userId;

      console.log(`>>> KAROBHR TRACE: login - User found in directory. Email: ${userEmail}, CompanyID from Dir: ${userCompanyIdFromDirectory}, UserID (Auth UID) from Dir: ${userIdFromDirectory}`);

      if (!userEmail) {
        console.error(`>>> KAROBHR TRACE: login - User directory entry for ${employeeIdInput} is missing an email.`);
        setLoading(false);
        throw new Error("User configuration error. Please contact support.");
      }
      if (!userIdFromDirectory) {
        console.error(`>>> KAROBHR TRACE: login - User directory entry for ${employeeIdInput} is missing a userId (Auth UID).`);
        setLoading(false);
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
        console.log(`>>> KAROBHR TRACE: login - Successfully fetched profile for ${loggedInUser.name} (${loggedInUser.employeeId}). Login complete. Role: ${loggedInUser.role}, Company: ${loggedInUser.companyId}`);
        return loggedInUser;
      } else {
        console.error(`>>> KAROBHR TRACE: login - Firebase Auth successful for UID: ${firebaseUser.uid}, but Firestore profile NOT FOUND or fetchUserData failed. This is a critical issue.`);
        await firebaseSignOut(authInstance); 
        throw new Error("Login succeeded but user profile could not be loaded.");
      }
    } catch (error: any) {
      console.error(">>> KAROBHR TRACE: login - Error during login process:", error.message || error);
      const originalFirebaseError = error.code ? ` (Code: ${error.code})` : '';
      console.error(`>>> KAROBHR TRACE: login - Firebase signInWithEmailAndPassword FAILED. Original Error Code: ${error.code || 'N/A'}, Message: ${error.message}`);

      let detailedErrorMessage = "Invalid User ID or Password.";
       if (error.code && (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential')) {
        // Keep generic message
      } else if (error.message && (error.message.startsWith("User data inconsistency") || error.message.startsWith("Login succeeded but user profile could not be loaded") || error.message.startsWith("User configuration error"))) {
        detailedErrorMessage = error.message;
      }
      setLoading(false); 
      if (!firebaseError && !error.message?.includes("Firebase services not available")) {
        setFirebaseError(new Error(detailedErrorMessage + originalFirebaseError));
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
      console.log(">>> KAROBHR TRACE: User logged out successfully. onAuthStateChanged will clear app state and set loading false.");
    } catch (error) {
      console.error(">>> KAROBHR TRACE: Logout error:", error);
      if(!firebaseError) setFirebaseError(new Error("Logout failed."));
      setLoading(false); 
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
        throw new Error(`Internal error: Company context is missing for new employee creation. CompanyId provided: '${employeeData.companyId}'`);
    }
    if (employeeData.role === 'admin' && (!employeeData.companyName || employeeData.companyName.trim() === '')) {
        console.error(">>> KAROBHR TRACE: addNewEmployee - CRITICAL - companyName is missing for admin role setup:", employeeData.companyName);
        throw new Error("Company Name is required when setting up an admin account.");
    }


    const finalEmail = employeeData.email || `${employeeData.employeeId.toLowerCase().replace(/[^a-z0-9]/gi, '')}@${employeeData.companyId.split('-')[0]}.karobhr.local`;
    const isFirstAdminSetup = employeeData.role === 'admin' && (!user || !allUsers.some(u => u.role === 'admin' && u.companyId === employeeData.companyId));

    console.log(`>>> KAROBHR TRACE: addNewEmployee - START - Adding new ${employeeData.role}: ${employeeData.employeeId} for company ${employeeData.companyId} with email ${finalEmail}. Is First Admin: ${isFirstAdminSetup}. Company Name for setup: ${employeeData.companyName}`);

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
            standardDailyHours: employeeData.standardDailyHours || 8,
            profilePictureUrl: employeeData.profilePictureUrl || null,
            advances: [],
            leaves: [],
            mockAttendanceFactor: 1.0,
            remoteWorkLocation: employeeData.remoteWorkLocation || undefined,
        };

        const userDocRef = doc(dbInstance, `users/${newFirebaseUser.uid}`);
        const userDirectoryDocRef = doc(dbInstance, `userDirectory/${newFirebaseUser.uid}`);

        console.log(`>>> KAROBHR TRACE: addNewEmployee - Preparing batch write for UID: ${newFirebaseUser.uid}. UserDoc path: users/${newFirebaseUser.uid}, DirDoc path: userDirectory/${newFirebaseUser.uid}`);
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

        if (isFirstAdminSetup) {
            const companyDocRef = doc(dbInstance, `companies/${employeeData.companyId}`);
            const initialCompanySettings: CompanySettings = {
                companyId: employeeData.companyId,
                companyName: employeeData.companyName, // Use companyName from employeeData
                adminUid: newFirebaseUser.uid,
                createdAt: serverTimestamp() as unknown as string, // Use serverTimestamp
                 officeLocation: { // Default office location
                    name: "Main Office",
                    latitude: 0, // Default value, admin should update
                    longitude: 0, // Default value, admin should update
                    radius: 100, // Default radius
                }
            };
            batch.set(companyDocRef, initialCompanySettings);
            console.log(`>>> KAROBHR TRACE: addNewEmployee - Added set(companyDocRef) to batch for new company: ${employeeData.companyId} with initial settings including default officeLocation.`);
            // Do not setCompanySettings here directly, let the listener pick it up
        }

        await batch.commit();
        console.log(`>>> KAROBHR TRACE: addNewEmployee - SUCCESS - Batch commit successful. User profile and directory entry created for ${newUserDocument.employeeId} (UID: ${newFirebaseUser.uid}).`);
        
        // If this was the first admin setup and the current logged-in context doesn't have a companyId yet,
        // trigger a reload of user data or set companyId to ensure settings listener runs.
        if (isFirstAdminSetup && (!companyId || companyId !== employeeData.companyId)) {
            setCompanyId(employeeData.companyId); // This will trigger the companySettings listener
        }

        return newFirebaseUser;

    } catch (error: any) {
        console.error(`>>> KAROBHR TRACE: addNewEmployee - ERROR during user creation for ${employeeData.employeeId}:`, error.code, error.message, error);
        if (newFirebaseUser && error.code !== 'auth/email-already-in-use') {
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
}, [authInstance, dbInstance, user, allUsers, companyId, firebaseError]);


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
            } as LeaveApplication;
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
      console.error(">>> KAROBHR TRACE: AuthContext - addAnnouncement - Pre-condition failed. DB:", !!dbInstance, "User:", !!user, "IsAdmin:", user?.role === 'admin', "CompanyID:", companyId);
      throw new Error("Operation not allowed or company context missing.");
    }
    const currentUserName = user.name || user.employeeId || 'System Admin'; // More robust fallback
    console.log(`>>> KAROBHR TRACE: AuthContext - addAnnouncement - Admin ${user.employeeId} (UID: ${user.id}, Name: ${currentUserName}) posting announcement in company ${companyId}: "${title}"`);

    const newAnnouncementData: Omit<Announcement, 'id' | 'postedAt'> = {
      title,
      content,
      postedByUid: user.id,
      postedByName: currentUserName,
    };

    try {
      await addDoc(collection(dbInstance, `companies/${companyId}/announcements`), {
        ...newAnnouncementData,
        postedAt: serverTimestamp()
      });
      console.log(">>> KAROBHR TRACE: AuthContext - addAnnouncement - Announcement posted successfully to Firestore.");
    } catch (error) {
      console.error(">>> KAROBHR TRACE: AuthContext - addAnnouncement - Error posting announcement to Firestore:", error);
      throw new Error("Failed to post announcement to Firestore.");
    }
  }, [dbInstance, user, companyId]);

  const updateUserInContext = useCallback(async (updatedUser: User): Promise<void> => {
     console.log(">>> KAROBHR TRACE: Attempting to update user in context:", updatedUser.employeeId, "with data:", updatedUser);
     if (user && user.id === updatedUser.id) {
        setUser(prevUser => ({...prevUser, ...updatedUser}));
        console.log(">>> KAROBHR TRACE: Current user updated in context (setUser).");
     }
     setAllUsers(prevAllUsers => prevAllUsers.map(u => u.id === updatedUser.id ? {...u, ...updatedUser} : u).sort((a, b) => (a.name || "").localeCompare(b.name || "")));
     console.log(">>> KAROBHR TRACE: User updated in allUsers list (if present).");

     if (dbInstance) {
        const userDocRef = doc(dbInstance, `users/${updatedUser.id}`);
        const { id, ...dataToSync } = updatedUser;

        const finalDataToSync: any = { ...dataToSync };
        if ('remoteWorkLocation' in finalDataToSync && (finalDataToSync.remoteWorkLocation === undefined || Object.keys(finalDataToSync.remoteWorkLocation).length === 0)) {
            finalDataToSync.remoteWorkLocation = null;
        }

        if (finalDataToSync.leaves) {
            finalDataToSync.leaves = finalDataToSync.leaves.map((leave: LeaveApplication) => ({
                ...leave,
            }));
        }
        try {
            await updateDoc(userDocRef, finalDataToSync);
            console.log(`>>> KAROBHR TRACE: User ${updatedUser.employeeId} (UID: ${updatedUser.id}) successfully synced to Firestore users/${updatedUser.id}. Data synced:`, finalDataToSync);

            const dirDocRef = doc(dbInstance, `userDirectory/${updatedUser.id}`);
            const dirDataToUpdate: Partial<UserDirectoryEntry> = {};
            if (updatedUser.name !== undefined) dirDataToUpdate.name = updatedUser.name;
            if (updatedUser.email !== undefined) dirDataToUpdate.email = updatedUser.email;
            if (updatedUser.role !== undefined) dirDataToUpdate.role = updatedUser.role;

            if(Object.keys(dirDataToUpdate).length > 0) {
                await updateDoc(dirDocRef, dirDataToUpdate);
                console.log(`>>> KAROBHR TRACE: UserDirectory for ${updatedUser.employeeId} (UID: ${updatedUser.id}) successfully synced.`);
            }
        } catch (err) {
            console.error(`>>> KAROBHR TRACE: Failed to sync user update to Firestore for ${updatedUser.employeeId}:`, err);
            throw err;
        }
     } else {
        console.warn(">>> KAROBHR TRACE: DB instance not available, cannot sync user update to Firestore for:", updatedUser.employeeId);
        throw new Error("Database not available for user update.");
     }
  }, [user, dbInstance]);

  const updateCompanySettings = useCallback(async (settingsUpdate: Partial<CompanySettings['officeLocation']>) => {
    if (!dbInstance || !companyId || !user || user.role !== 'admin') {
        console.error(">>> KAROBHR TRACE: Cannot update company settings - insufficient permissions or context. DB:", !!dbInstance, "CompanyId:", companyId, "User:", !!user, "AdminRole:", user?.role);
        throw new Error("Operation not allowed or company context missing.");
    }
    console.log(`>>> KAROBHR TRACE: Admin ${user.employeeId} updating company settings for ${companyId}:`, settingsUpdate);
    const companyDocRef = doc(dbInstance, `companies/${companyId}`);
    try {
        const updatePayload: Partial<CompanySettings> = {};
        
        const currentOfficeLocation = companySettings?.officeLocation || { name: "Main Office", latitude: 0, longitude: 0, radius: 100 };
        const newOfficeLocation = {
            name: settingsUpdate.name !== undefined ? settingsUpdate.name : currentOfficeLocation.name,
            latitude: settingsUpdate.latitude !== undefined ? settingsUpdate.latitude : currentOfficeLocation.latitude,
            longitude: settingsUpdate.longitude !== undefined ? settingsUpdate.longitude : currentOfficeLocation.longitude,
            radius: settingsUpdate.radius !== undefined ? settingsUpdate.radius : currentOfficeLocation.radius,
        };
        updatePayload.officeLocation = newOfficeLocation;


        if (Object.keys(updatePayload).length > 0 && updatePayload.officeLocation) {
            await updateDoc(companyDocRef, updatePayload);
            console.log(">>> KAROBHR TRACE: Company settings updated successfully in Firestore with payload:", updatePayload);
            setCompanySettings(prev => prev ? ({ ...prev, ...updatePayload }) : (updatePayload as CompanySettings));
        } else {
            console.log(">>> KAROBHR TRACE: No valid officeLocation data in settingsUpdate or updatePayload is empty, skipping Firestore update.");
        }
    } catch (error: any) {
        console.error(">>> KAROBHR TRACE: Error updating company settings:", error.message || error);
        throw new Error(`Failed to update company settings: ${error.message}`);
    }
  }, [dbInstance, companyId, user, companySettings]);

  const addAttendanceEvent = useCallback(async (eventData: Omit<AttendanceEvent, 'id' | 'userId' | 'employeeId' | 'userName' | 'timestamp' | 'isWithinGeofence' | 'matchedGeofenceType'> & { photoDataUrl?: string | null }) => {
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
            const base64String = eventData.photoDataUrl.includes(',') ? eventData.photoDataUrl.split(',')[1] : eventData.photoDataUrl;
            if (!base64String) throw new Error("Invalid photo data URL format for base64 extraction.");

            const snapshot = await uploadString(photoRefStorage, base64String, 'base64', { contentType: 'image/jpeg' });
            photoFinalUrl = await getDownloadURL(snapshot.ref);
            console.log(">>> KAROBHR TRACE: Photo uploaded successfully:", photoFinalUrl);
        } catch (uploadError) {
            console.error(">>> KAROBHR TRACE: Error uploading attendance photo:", uploadError);
        }
    }

    let isWithinAnyValidGeofence = false;
    let matchedType: AttendanceEvent['matchedGeofenceType'] = null;

    if (eventData.location) {
        if (companySettings?.officeLocation?.latitude !== undefined && companySettings.officeLocation.longitude !== undefined && companySettings.officeLocation.radius > 0) {
            const officeDist = calculateDistance(eventData.location.latitude, eventData.location.longitude, companySettings.officeLocation.latitude, companySettings.officeLocation.longitude);
            if (officeDist <= companySettings.officeLocation.radius) {
                isWithinAnyValidGeofence = true;
                matchedType = 'office';
                console.log(`>>> KAROBHR TRACE: Matched OFFICE geofence. Distance: ${officeDist.toFixed(0)}m`);
            }
        }

        if (!isWithinAnyValidGeofence && user.remoteWorkLocation?.latitude !== undefined && user.remoteWorkLocation.longitude !== undefined && user.remoteWorkLocation.radius > 0) {
            const remoteDist = calculateDistance(eventData.location.latitude, eventData.location.longitude, user.remoteWorkLocation.latitude, user.remoteWorkLocation.longitude);
            if (remoteDist <= user.remoteWorkLocation.radius) {
                isWithinAnyValidGeofence = true;
                matchedType = 'remote';
                console.log(`>>> KAROBHR TRACE: Matched REMOTE geofence. Distance: ${remoteDist.toFixed(0)}m`);
            }
        }
        if (!isWithinAnyValidGeofence) {
            console.log(`>>> KAROBHR TRACE: No valid geofence matched. Office settings:`, companySettings?.officeLocation, `User remote:`, user.remoteWorkLocation);
        }
    } else {
        console.log(">>> KAROBHR TRACE: No location data provided for attendance event, cannot check geofence.");
    }


    const newAttendanceEventData: Omit<AttendanceEvent, 'id' | 'timestamp'> = {
        userId: user.id,
        employeeId: user.employeeId,
        userName: user.name || user.employeeId,
        type: eventData.type,
        photoUrl: photoFinalUrl,
        location: eventData.location,
        isWithinGeofence: isWithinAnyValidGeofence,
        matchedGeofenceType: matchedType,
    };

    try {
        const eventRef = await addDoc(collection(dbInstance, `companies/${companyId}/attendanceLog`), {
            ...newAttendanceEventData,
            timestamp: serverTimestamp()
        });
        console.log(">>> KAROBHR TRACE: Attendance event recorded successfully with ID:", eventRef.id, "Data:", newAttendanceEventData);
    } catch (error) {
        console.error(">>> KAROBHR TRACE: Error recording attendance event to Firestore:", error);
        throw new Error("Failed to record attendance event.");
    }
  }, [dbInstance, user, companyId, storageInstance, companySettings]);

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

  const calculateMonthlyPayrollDetails = useCallback((
    employee: User,
    forYear: number,
    forMonth: number,
    employeeAttendanceEvents: AttendanceEvent[],
    companyHolidays: Holiday[] = []
  ): MonthlyPayrollReport => {
    console.log(`>>> KAROBHR TRACE: Calculating payroll for ${employee.employeeId} for ${forMonth + 1}/${forYear}`);

    const baseSalary = employee.baseSalary || 0;
    const standardDailyHours = employee.standardDailyHours || 0;

    const actualHolidaysForMonthDates: Date[] = (companyHolidays || [])
      .map(h => h.date instanceof Date ? h.date : parseISO(h.date as unknown as string))
      .filter(d => getYear(d) === forYear && getMonth(d) === forMonth);

    const totalWorkingDaysInMonth = getWorkingDaysInMonth(forYear, forMonth, actualHolidaysForMonthDates);
    const totalStandardHoursForMonth = standardDailyHours * totalWorkingDaysInMonth;

    let totalActualHoursWorkedMs = 0;
    const monthStartDate = startOfMonth(new Date(forYear, forMonth));
    const monthEndDate = endOfMonth(new Date(forYear, forMonth));

    const dailyWorkMsMap = new Map<string, number>();

    employeeAttendanceEvents.forEach(event => {
        try {
            const eventDate = parseISO(event.timestamp);
            if (!isWithinInterval(eventDate, { start: monthStartDate, end: monthEndDate })) {
                return;
            }
            const dateStr = format(eventDate, 'yyyy-MM-dd');
            if (!dailyWorkMsMap.has(dateStr)) {
                dailyWorkMsMap.set(dateStr, 0);
            }
        } catch (e) {
            console.warn("calculateMonthlyPayrollDetails: Invalid timestamp in attendance event", event.timestamp, e);
        }
    });

    const eventsByDate: Record<string, AttendanceEvent[]> = {};
    employeeAttendanceEvents.forEach(event => {
      try {
        const eventDate = parseISO(event.timestamp);
        if (!isWithinInterval(eventDate, { start: monthStartDate, end: monthEndDate })) {
            return;
        }
        const dateStr = format(eventDate, 'yyyy-MM-dd');
        if (!eventsByDate[dateStr]) {
          eventsByDate[dateStr] = [];
        }
        eventsByDate[dateStr].push(event);
      } catch (e) {
        console.warn("calculateMonthlyPayrollDetails: Invalid timestamp in attendance event for grouping", event.timestamp, e);
      }
    });

    for (const dateStr in eventsByDate) {
      if (isSunday(dateStr) || actualHolidaysForMonthDates.some(hDay => format(hDay, 'yyyy-MM-dd') === dateStr)) {
          continue;
      }

      const dailyEvents = eventsByDate[dateStr].sort((a,b) => parseISO(a.timestamp).getTime() - parseISO(b.timestamp).getTime());
      let dailyWorkMs = 0;
      let lastCheckInTime: Date | null = null;

      for (const event of dailyEvents) {
        try {
            const eventTime = parseISO(event.timestamp);
            if (event.type === 'check-in') {
              lastCheckInTime = eventTime;
            } else if (event.type === 'check-out' && lastCheckInTime) {
              dailyWorkMs += differenceInMilliseconds(eventTime, lastCheckInTime);
              lastCheckInTime = null;
            }
        } catch (e) {
            console.warn("calculateMonthlyPayrollDetails: Error processing daily event", event, e);
        }
      }
      dailyWorkMsMap.set(dateStr, (dailyWorkMsMap.get(dateStr) || 0) + dailyWorkMs);
    }

    dailyWorkMsMap.forEach(ms => totalActualHoursWorkedMs += ms);
    const totalActualHoursWorked = totalActualHoursWorkedMs / (1000 * 60 * 60);

    const totalHoursMissed = Math.max(0, totalStandardHoursForMonth - totalActualHoursWorked);
    const hourlyRate = totalStandardHoursForMonth > 0 ? baseSalary / totalStandardHoursForMonth : 0;
    const calculatedDeductions = hourlyRate * totalHoursMissed;
    const salaryAfterDeductions = Math.max(0, baseSalary - calculatedDeductions);

    const totalApprovedAdvances = (employee.advances || [])
      .filter(adv => adv.status === 'approved')
      .reduce((sum, adv) => sum + adv.amount, 0);

    const finalNetPayable = Math.max(0, salaryAfterDeductions - totalApprovedAdvances);

    return {
      employeeId: employee.employeeId,
      employeeName: employee.name || employee.employeeId,
      month: forMonth,
      year: forYear,
      baseSalary,
      standardDailyHours,
      totalWorkingDaysInMonth,
      totalStandardHoursForMonth: parseFloat(totalStandardHoursForMonth.toFixed(2)),
      totalActualHoursWorked: parseFloat(totalActualHoursWorked.toFixed(2)),
      totalHoursMissed: parseFloat(totalHoursMissed.toFixed(2)),
      hourlyRate: parseFloat(hourlyRate.toFixed(2)),
      calculatedDeductions: parseFloat(calculatedDeductions.toFixed(2)),
      salaryAfterDeductions: parseFloat(salaryAfterDeductions.toFixed(2)),
      totalApprovedAdvances,
      finalNetPayable: parseFloat(finalNetPayable.toFixed(2)),
    };
  }, []);


  const contextValue = useMemo(() => ({
    user,
    role,
    loading,
    companyId,
    companySettings,
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
    updateCompanySettings,
    attendanceLog,
    addAttendanceEvent,
    requestAdvance,
    processAdvance,
    calculateMonthlyPayrollDetails,
  }), [
    user, role, loading, companyId, companySettings, firebaseError, login, logout, addNewEmployee,
    allUsers, tasks, addTask, updateTask,
    addLeaveApplication, processLeaveApplication,
    announcements, addAnnouncement, updateUserInContext, updateCompanySettings, attendanceLog, addAttendanceEvent,
    requestAdvance, processAdvance, calculateMonthlyPayrollDetails
  ]);


  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthProvider;
