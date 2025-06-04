
'use client';

import type { ReactNode } from 'react';
import { createContext, useState, useEffect, useCallback } from 'react';
import type { User, UserRole, Advance, Announcement, LeaveApplication, AttendanceEvent, Task as TaskType, UserDirectoryEntry } from '@/lib/types';
import { v4 as uuidv4 } from 'uuid';
import { getFirebaseInstances } from './firebase/firebase';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  type User as FirebaseUser,
} from 'firebase/auth';
import {
  doc,
  setDoc,
  getDoc,
  collection,
  writeBatch,
  query,
  where,
  getDocs,
  updateDoc,
  arrayUnion,
  Timestamp,
  orderBy,
  limit,
  serverTimestamp,
  addDoc,
  deleteDoc,
} from 'firebase/firestore';
import { ref, uploadString, getDownloadURL, deleteObject } from 'firebase/storage';

console.log(">>> KAROBHR TRACE: AuthProvider module loaded"); // Trace log

// --- Helper: Firebase Email Convention ---
const TEMP_AUTH_DOMAIN = "karobhr-temp.firebaseapp.com"; // Make this consistent
const createFirebaseEmail = (employeeId: string): string => {
  // Sanitize employeeId: allow alphanumeric, underscore, dot, hyphen.
  // This is important to ensure the ID used for creating the Firebase Auth email
  // is the same as the one used for logging in.
  const safeEmployeeId = employeeId.replace(/[^a-zA-Z0-9_.-]/g, '');
  return `${safeEmployeeId}@${TEMP_AUTH_DOMAIN}`;
};
// --- End Helper ---

export interface NewEmployeeData {
  name: string;
  employeeId: string;
  email?: string | null;
  department?: string | null;
  role: UserRole;
  companyId: string;
  joiningDate?: string | null;
  baseSalary?: number;
}

export interface AuthContextType {
  user: User | null;
  firebaseUser: FirebaseUser | null;
  companyId: string | null;
  allUsers: User[];
  role: UserRole | null;
  loading: boolean;
  announcements: Announcement[];
  attendanceLog: AttendanceEvent[];
  tasks: TaskType[];
  login: (employeeId: string, pass: string) => Promise<User | null>;
  logout: () => Promise<void>;
  addNewEmployee: (employeeData: NewEmployeeData, passwordToSet: string) => Promise<void>;
  requestAdvance: (employeeIdToUse: string, amount: number, reason: string) => Promise<void>;
  processAdvance: (targetEmployeeUid: string, advanceId: string, newStatus: 'approved' | 'rejected') => Promise<void>;
  updateUserInContext: (updatedUser: Partial<User> & { id: string }) => Promise<void>;
  addAnnouncement: (title: string, content: string) => Promise<void>;
  addAttendanceEvent: (eventData: Omit<AttendanceEvent, 'id' | 'timestamp' | 'userName' | 'userId' | 'employeeId'> & { photoDataUrl?: string | null }) => Promise<void>;
  addTask: (taskData: Omit<TaskType, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  updateTask: (updatedTask: Partial<TaskType> & { id: string }) => Promise<void>;
  addLeaveApplication: (leaveData: Omit<LeaveApplication, 'id' | 'userId' | 'employeeId' | 'status' | 'appliedAt'>) => Promise<void>;
  processLeaveApplication: (targetEmployeeUid: string, leaveId: string, newStatus: 'approved' | 'rejected') => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  console.log(">>> KAROBHR TRACE: AuthProvider component rendering/executing"); // Trace log
  const [user, setUser] = useState<User | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);

  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [attendanceLog, setAttendanceLog] = useState<AttendanceEvent[]>([]);
  const [tasks, setTasks] = useState<TaskType[]>([]);

  const loadCompanyData = useCallback(async (cid: string) => {
    if (!cid) return;
    console.log(`>>> KAROBHR TRACE: AuthProvider loadCompanyData called for companyId: ${cid}`); // Trace log
    setLoading(true); // Set loading true while fetching company data
    const { db } = getFirebaseInstances();

    try {
      // Fetch users
      const usersCollectionRef = collection(db, "companies", cid, "employees");
      const usersSnapshot = await getDocs(usersCollectionRef);
      const companyUsers = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User));
      setAllUsers(companyUsers);
      console.log(`>>> KAROBHR TRACE: Fetched ${companyUsers.length} users for company ${cid}`);

      // Fetch tasks
      const tasksCollectionRef = collection(db, "companies", cid, "tasks");
      const tasksQuery = query(tasksCollectionRef, orderBy("createdAt", "desc"));
      const tasksSnapshot = await getDocs(tasksQuery);
      const companyTasks = tasksSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          createdAt: (data.createdAt as Timestamp)?.toDate().toISOString() || new Date().toISOString(),
          updatedAt: (data.updatedAt as Timestamp)?.toDate().toISOString() || new Date().toISOString(),
        } as TaskType;
      });
      setTasks(companyTasks);
      console.log(`>>> KAROBHR TRACE: Fetched ${companyTasks.length} tasks for company ${cid}`);

      // Fetch announcements
      const announcementsCollectionRef = collection(db, "companies", cid, "announcements");
      const announcementsQuery = query(announcementsCollectionRef, orderBy("postedAt", "desc"), limit(20));
      const announcementsSnapshot = await getDocs(announcementsQuery);
      const companyAnnouncements = announcementsSnapshot.docs.map(docSnap => {
          const data = docSnap.data();
          return {
              id: docSnap.id,
              ...data,
              postedAt: (data.postedAt as Timestamp)?.toDate().toISOString() || new Date().toISOString(),
          } as Announcement;
      });
      setAnnouncements(companyAnnouncements);
      console.log(`>>> KAROBHR TRACE: Fetched ${companyAnnouncements.length} announcements for company ${cid}`);

      // Fetch attendance log
      const attendanceCollectionRef = collection(db, "companies", cid, "attendanceLog");
      const attendanceQuery = query(attendanceCollectionRef, orderBy("timestamp", "desc"), limit(250)); // Increased limit for better history view
      const attendanceSnapshot = await getDocs(attendanceQuery);
      const companyAttendanceLog = attendanceSnapshot.docs.map(docSnap => {
          const data = docSnap.data();
          return {
              id: docSnap.id,
              ...data,
              timestamp: (data.timestamp as Timestamp)?.toDate().toISOString() || new Date().toISOString(),
          } as AttendanceEvent;
      });
      setAttendanceLog(companyAttendanceLog);
      console.log(`>>> KAROBHR TRACE: Fetched ${companyAttendanceLog.length} attendance events for company ${cid}`);

    } catch (error) {
        console.error(">>> KAROBHR ERROR: Error loading company data:", error);
        // Reset states if loading fails to prevent stale data issues
        setAllUsers([]);
        setTasks([]);
        setAnnouncements([]);
        setAttendanceLog([]);
    } finally {
        setLoading(false); // Ensure loading is set to false in all cases
        console.log(`>>> KAROBHR TRACE: AuthProvider loadCompanyData finished for companyId: ${cid}. Loading state: false.`);
    }
  }, []);


  useEffect(() => {
    console.log(">>> KAROBHR TRACE: AuthProvider useEffect for onAuthStateChanged triggered.");
    setLoading(true);
    const { auth: firebaseAuthService, db: firestore } = getFirebaseInstances();
    if (!firebaseAuthService || !firestore) {
      console.error(">>> KAROBHR ERROR: Firebase services not initialized in AuthProvider listener.");
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(firebaseAuthService, async (fbUser) => {
      console.log(">>> KAROBHR TRACE: onAuthStateChanged callback. Firebase user:", fbUser ? fbUser.uid : 'null');
      setFirebaseUser(fbUser);
      if (fbUser) {
        try {
          const userDirRef = doc(firestore, "userDirectory", fbUser.uid);
          const userDirSnap = await getDoc(userDirRef);

          if (userDirSnap.exists()) {
            const userDirData = userDirSnap.data() as UserDirectoryEntry;
            console.log(">>> KAROBHR TRACE: User directory entry found:", userDirData);
            setCompanyId(userDirData.companyId); // Set companyId first
            setRole(userDirData.role);

            const userProfileRef = doc(firestore, "companies", userDirData.companyId, "employees", fbUser.uid);
            const userProfileSnap = await getDoc(userProfileRef);

            if (userProfileSnap.exists()) {
              const userProfileData = { id: userProfileSnap.id, ...userProfileSnap.data() } as User;
              console.log(">>> KAROBHR TRACE: User profile found:", userProfileData);
              setUser(userProfileData);
              await loadCompanyData(userDirData.companyId); // Load company data *after* companyId is set
            } else {
              console.warn(`>>> KAROBHR WARNING: KarobHR profile not found for UID: ${fbUser.uid} in company ${userDirData.companyId}. Logging out.`);
              await signOut(firebaseAuthService); // Log out if profile is missing
              setUser(null); setCompanyId(null); setRole(null); // Clear states
            }
          } else {
            console.warn(`>>> KAROBHR WARNING: User directory entry not found for UID: ${fbUser.uid}. Logging out.`);
            await signOut(firebaseAuthService); // Log out if directory entry is missing
            setUser(null); setCompanyId(null); setRole(null); // Clear states
          }
        } catch (error) {
          console.error(">>> KAROBHR ERROR: Error fetching user data post-auth:", error);
          await signOut(firebaseAuthService).catch(err => console.error(">>> KAROBHR ERROR: Error signing out after fetch error:", err));
          setUser(null); setCompanyId(null); setRole(null); // Clear states
        }
      } else {
        console.log(">>> KAROBHR TRACE: No Firebase user found in onAuthStateChanged. Clearing user state.");
        setUser(null);
        setCompanyId(null);
        setRole(null);
        setAllUsers([]);
        setTasks([]);
        setAnnouncements([]);
        setAttendanceLog([]);
        setLoading(false); // Explicitly set loading false if no user
      }
      // setLoading(false); // Moved to be inside conditions or finally block of loadCompanyData
    });
    return () => {
      console.log(">>> KAROBHR TRACE: AuthProvider onAuthStateChanged listener cleanup.");
      unsubscribe();
    }
  }, [loadCompanyData]); // loadCompanyData is now a dependency

  const login = async (employeeId: string, pass: string): Promise<User | null> => {
    setLoading(true);
    const { auth: firebaseAuthService } = getFirebaseInstances();
    console.log(`>>> KAROBHR TRACE: Login attempt with employeeId: "${employeeId}"`); // Added this diagnostic log
    const authEmail = createFirebaseEmail(employeeId);
    console.log(`>>> KAROBHR TRACE: Attempting Firebase login with email: ${authEmail}`); 

    try {
      const userCredential = await signInWithEmailAndPassword(firebaseAuthService, authEmail, pass);
      // onAuthStateChanged will handle setting user state and loading company data.
      // For the return value, we need to wait for onAuthStateChanged to resolve and set `user`.
      // This is a bit tricky. Let's assume onAuthStateChanged will be quick.
      // A better way would be for the component to rely solely on the context's user state.
      // For now, to fulfill the promise structure:
      return new Promise((resolve, reject) => {
        const unsubscribe = onAuthStateChanged(firebaseAuthService, async (fbUser) => {
          unsubscribe(); // Unsubscribe after first callback
          if (fbUser && fbUser.uid === userCredential.user.uid) {
            // Need to fetch profile data here again for immediate return if onAuthStateChanged hasn't populated context fully
            const { db } = getFirebaseInstances();
            const userDirRef = doc(db, "userDirectory", fbUser.uid);
            const userDirSnap = await getDoc(userDirRef);
            if (userDirSnap.exists()) {
                const userDirData = userDirSnap.data() as UserDirectoryEntry;
                const userProfileRef = doc(db, "companies", userDirData.companyId, "employees", fbUser.uid);
                const userProfileSnap = await getDoc(userProfileRef);
                if (userProfileSnap.exists()) {
                    console.log(">>> KAROBHR TRACE: Login successful, user profile fetched for immediate return.");
                    resolve({ id: userProfileSnap.id, ...userProfileSnap.data() } as User);
                } else {
                    console.error(">>> KAROBHR ERROR: User profile not found after login.");
                    reject(new Error("User profile not found after login."));
                }
            } else {
                 console.error(">>> KAROBHR ERROR: User directory entry not found after login.");
                 reject(new Error("User directory entry not found after login."));
            }
          } else if (!fbUser) {
             console.warn(">>> KAROBHR WARNING: User disappeared after login attempt during promise resolution.");
             reject(new Error("User disappeared after login attempt."));
          }
        });
         // Timeout to prevent hanging indefinitely if onAuthStateChanged doesn't fire as expected for this new login
        setTimeout(() => {
            unsubscribe(); // Clean up listener
            console.warn(">>> KAROBHR WARNING: Login timed out waiting for auth state update promise.");
            reject(new Error("Login timed out waiting for auth state update."));
        }, 7000); // Increased timeout slightly
      });
    } catch (error: any) {
      console.error(">>> KAROBHR ERROR: Firebase login error in login function:", error);
      setLoading(false);
      throw error; // Re-throw to be caught by the form
    }
    // setLoading(false) will be handled by onAuthStateChanged or the catch block.
  };

  const logout = async () => {
    console.log(">>> KAROBHR TRACE: Logout initiated.");
    setLoading(true);
    const { auth: firebaseAuthService } = getFirebaseInstances();
    try {
      await signOut(firebaseAuthService);
      console.log(">>> KAROBHR TRACE: Firebase signOut successful.");
      // onAuthStateChanged will clear user, companyId, role, and other data
    } catch (error) {
      console.error(">>> KAROBHR ERROR: Error signing out from Firebase:", error);
    }
    // setLoading(false) is handled by onAuthStateChanged
  };

  const addNewEmployee = async (employeeData: NewEmployeeData, passwordToSet: string) => {
    console.log(">>> KAROBHR TRACE: addNewEmployee called for:", employeeData.employeeId);
    const { auth: firebaseAuthService, db: firestore } = getFirebaseInstances();
    const { employeeId, name, role: newEmployeeRole, department, joiningDate, baseSalary, companyId: empCompanyId, email: providedEmail } = employeeData;

    if (!empCompanyId) {
      console.error(">>> KAROBHR ERROR: Company ID is required to add a new employee.");
      throw new Error("Company ID is required to add a new employee.");
    }

    const firebaseEmail = providedEmail || createFirebaseEmail(employeeId);
    let newFirebaseUser: FirebaseUser | null = null;

    // Check if employeeId already exists in the userDirectory for this company
    const employeeDirQuery = query(collection(firestore, "userDirectory"), 
        where("companyId", "==", empCompanyId), 
        where("employeeId", "==", employeeId)
    );
    const existingEmployeeSnap = await getDocs(employeeDirQuery);
    if (!existingEmployeeSnap.empty) {
        console.warn(`>>> KAROBHR WARNING: Employee ID "${employeeId}" already exists in company "${empCompanyId}".`);
        throw new Error(`Employee ID "${employeeId}" already exists in company "${empCompanyId}".`);
    }


    try {
      const userCredential = await createUserWithEmailAndPassword(firebaseAuthService, firebaseEmail, passwordToSet);
      newFirebaseUser = userCredential.user;
      console.log(">>> KAROBHR TRACE: Firebase Auth user created:", newFirebaseUser.uid);
    } catch (error: any) {
      console.error(">>> KAROBHR ERROR: Error creating employee in Firebase Auth:", error);
      if (error.code === 'auth/email-already-in-use') {
        throw new Error(`The email address ${firebaseEmail} is already in use by another account. Employee IDs must be unique for login.`);
      }
      throw new Error(`Failed to create Firebase Auth user: ${error.message}`);
    }

    if (!newFirebaseUser) throw new Error("Firebase user creation failed silently.");

    const userDirEntry: UserDirectoryEntry = {
      userId: newFirebaseUser.uid,
      employeeId,
      email: newFirebaseUser.email!, // Firebase Auth user will have an email
      companyId: empCompanyId,
      role: newEmployeeRole,
      name: name
    };

    const initials = name?.split(' ').map(n => n[0]).join('').toUpperCase() || 'NA';
    const newUserProfile: User = {
      id: newFirebaseUser.uid,
      employeeId,
      name,
      email: newFirebaseUser.email!,
      role: newEmployeeRole,
      companyId: empCompanyId,
      department: department || (newEmployeeRole === 'admin' ? 'Administration' : 'N/A'),
      joiningDate: joiningDate || new Date().toISOString().split('T')[0],
      baseSalary: baseSalary !== undefined ? baseSalary : (newEmployeeRole === 'admin' ? 0 : undefined), // Admin can have 0, others undefined if not set
      mockAttendanceFactor: 1.0,
      advances: [],
      leaves: [],
      profilePictureUrl: `https://placehold.co/100x100.png?text=${initials}`,
    };

    const batch = writeBatch(firestore);
    const userDirRef = doc(firestore, "userDirectory", newFirebaseUser.uid);
    batch.set(userDirRef, userDirEntry);
    const userProfileRef = doc(firestore, "companies", empCompanyId, "employees", newFirebaseUser.uid);
    batch.set(userProfileRef, newUserProfile);

    try {
      await batch.commit();
      console.log(">>> KAROBHR TRACE: New employee data committed to Firestore.");
      // If the current admin is adding an employee to their own company, update allUsers state
      if (user && user.companyId === empCompanyId) {
         setAllUsers(prev => [...prev, newUserProfile]);
      }
    } catch (error) {
      console.error(">>> KAROBHR ERROR: Error writing employee data to Firestore:", error);
      // Attempt to delete the Firebase Auth user if Firestore write fails (rollback)
      await newFirebaseUser.delete().catch(delErr => console.error(">>> KAROBHR ERROR: Failed to rollback Firebase Auth user:", delErr));
      throw new Error("Failed to store employee profile in Firestore. Auth user creation rolled back if possible.");
    }
  };
  
  const requestAdvance = async (employeeIdToUse: string, amount: number, reason: string) => {
    if (!user || !companyId) {
      console.error(">>> KAROBHR ERROR: User not logged in or companyId missing for requestAdvance.");
      throw new Error("User not logged in or companyId missing.");
    }
    const { db } = getFirebaseInstances();

    // Find the target user's UID from their employeeId within the current company
    const targetUserEntry = allUsers.find(u => u.employeeId === employeeIdToUse && u.companyId === companyId);
    if (!targetUserEntry) {
      console.error(">>> KAROBHR ERROR: Target employee for advance request not found in current company.");
      throw new Error("Target employee for advance request not found in current company.");
    }
    const targetUserUid = targetUserEntry.id; // This is the Firebase Auth UID

    const newAdvance: Advance = {
      id: uuidv4(),
      employeeId: employeeIdToUse, // Keep KarobHR employeeId for display/reference
      amount,
      reason,
      dateRequested: new Date().toISOString(), // Client time for immediate display
      status: 'pending'
    };
    const userProfileRef = doc(db, "companies", companyId, "employees", targetUserUid);
    // For Firestore, use serverTimestamp for dateRequested
    const advanceForFirestore = { ...newAdvance, dateRequested: serverTimestamp() };
    try {
      await updateDoc(userProfileRef, {
        advances: arrayUnion(advanceForFirestore)
      });
      console.log(">>> KAROBHR TRACE: Advance requested and updated in Firestore for", employeeIdToUse);
      // Update the specific user in allUsers state (using client time for display)
      setAllUsers(prevAllUsers => prevAllUsers.map(u => 
        u.id === targetUserUid ? { ...u, advances: [...(u.advances || []), newAdvance].sort((a,b) => new Date(b.dateRequested).getTime() - new Date(a.dateRequested).getTime()) } : u
      ));
      // If the advance is for the currently logged-in user, update their state directly
      if (user.id === targetUserUid) {
        setUser(prev => prev ? ({ ...prev, advances: [...(prev.advances || []), newAdvance].sort((a,b) => new Date(b.dateRequested).getTime() - new Date(a.dateRequested).getTime()) }) : null);
      }
    } catch (error) {
      console.error(">>> KAROBHR ERROR: Error requesting advance:", error);
      throw error;
    }
  };

  const processAdvance = async (targetEmployeeUid: string, advanceId: string, newStatus: 'approved' | 'rejected') => {
    if (!user || !companyId || user.role !== 'admin') {
      console.error(">>> KAROBHR ERROR: Unauthorized or missing company context for processAdvance.");
      throw new Error("Unauthorized or missing company context.");
    }
    const { db } = getFirebaseInstances();
    const targetUserProfileRef = doc(db, "companies", companyId, "employees", targetEmployeeUid);
    
    try {
        const targetUserDoc = await getDoc(targetUserProfileRef);
        if (!targetUserDoc.exists()) {
          console.error(">>> KAROBHR ERROR: Target employee profile not found for processAdvance.");
          throw new Error("Target employee profile not found.");
        }
        const targetUserData = targetUserDoc.data() as User;
        const advances = targetUserData.advances || [];
        const advanceIndex = advances.findIndex(adv => adv.id === advanceId);

        if (advanceIndex === -1) {
          console.error(">>> KAROBHR ERROR: Advance not found for target employee for processAdvance.");
          throw new Error("Advance not found for target employee.");
        }
        
        const updatedAdvances = [...advances];
        const processedAdvance = {
            ...updatedAdvances[advanceIndex],
            status: newStatus,
            dateProcessed: new Date().toISOString() // Client time for immediate display
        };
        updatedAdvances[advanceIndex] = processedAdvance;
        
        // For Firestore, use serverTimestamp for dateProcessed
        const advancesForFirestore = updatedAdvances.map((adv, index) => 
            index === advanceIndex ? { ...adv, dateProcessed: serverTimestamp() } : adv
        );

        await updateDoc(targetUserProfileRef, { advances: advancesForFirestore });
        console.log(">>> KAROBHR TRACE: Advance processed in Firestore for UID", targetEmployeeUid);
        
        const sortedAdvances = updatedAdvances.sort((a,b) => new Date(b.dateRequested).getTime() - new Date(a.dateRequested).getTime());
        setAllUsers(prevAllUsers => prevAllUsers.map(u => 
            u.id === targetEmployeeUid ? { ...u, advances: sortedAdvances } : u
        ));
        if (user.id === targetEmployeeUid) { // If admin is processing their own advance (unlikely but possible)
            setUser(prev => prev ? { ...prev, advances: sortedAdvances } : null);
        }

    } catch (error) {
        console.error(">>> KAROBHR ERROR: Error processing advance:", error);
        throw error;
    }
  };
  
  const updateUserInContext = async (updatedProfileData: Partial<User> & { id: string }) => {
    if (!firebaseUser || !companyId) {
      console.error(">>> KAROBHR ERROR: No authenticated user or company context to update profile.");
      throw new Error("No authenticated user or company context to update profile.");
    }
    const { db } = getFirebaseInstances();
    const { id: targetUserId, ...dataToUpdate } = updatedProfileData;

    const userProfileRef = doc(db, "companies", companyId, "employees", targetUserId);
    const userDirRef = doc(db, "userDirectory", targetUserId); // Also update name in directory if changed

    try {
        const batch = writeBatch(db);
        batch.update(userProfileRef, dataToUpdate);
        if (dataToUpdate.name) { // If name is being updated, update it in userDirectory too
            batch.update(userDirRef, { name: dataToUpdate.name });
        }
        await batch.commit();
        console.log(">>> KAROBHR TRACE: User profile updated in Firestore for UID", targetUserId);

        if (targetUserId === user?.id) {
            setUser(prev => prev ? ({ ...prev, ...dataToUpdate }) : null);
        }
        setAllUsers(prevAll => prevAll.map(u => u.id === targetUserId ? ({ ...u, ...dataToUpdate } as User) : u));
    } catch (error) {
        console.error(">>> KAROBHR ERROR: Error updating user profile in Firestore:", error);
        throw error;
    }
  };

  const addAnnouncement = async (title: string, content: string) => {
    if (!user || !companyId || user.role !== 'admin') {
      console.error(">>> KAROBHR ERROR: User not authorized or company context missing for addAnnouncement.");
      throw new Error("User not authorized or company context missing.");
    }
    const { db } = getFirebaseInstances();
    const newAnnouncementData: Omit<Announcement, 'id' | 'postedAt'> = {
      title,
      content,
      postedByUid: user.id,
      postedByName: user.name || user.employeeId,
    };
    try {
      const announcementsCollectionRef = collection(db, "companies", companyId, "announcements");
      const docRef = await addDoc(announcementsCollectionRef, {
        ...newAnnouncementData,
        postedAt: serverTimestamp() 
      });
      console.log(">>> KAROBHR TRACE: Announcement added to Firestore with ID", docRef.id);
      // For local state, use client time for immediate display, sort by this.
      const displayAnnouncement = { ...newAnnouncementData, id: docRef.id, postedAt: new Date().toISOString()};
      setAnnouncements(prev => [displayAnnouncement, ...prev].sort((a,b) => new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime()));
    } catch (error) {
      console.error(">>> KAROBHR ERROR: Error adding announcement:", error);
      throw error;
    }
  };

  const addAttendanceEvent = async (eventData: Omit<AttendanceEvent, 'id' | 'timestamp' | 'userName' | 'userId' | 'employeeId'> & { photoDataUrl?: string | null }) => {
    if (!user || !companyId) {
      console.error(">>> KAROBHR ERROR: User not logged in or companyId missing for addAttendanceEvent.");
      throw new Error("User not logged in or companyId missing.");
    }
    const { db, storage } = getFirebaseInstances();
    const { photoDataUrl, ...restOfEventData } = eventData;
    let photoFirebaseUrl: string | null = null;
    const eventId = uuidv4();

    if (photoDataUrl) {
        const photoRef = ref(storage, `companies/${companyId}/attendance_photos/${user.employeeId}/${eventId}.jpg`);
        try {
            await uploadString(photoRef, photoDataUrl, 'data_url');
            photoFirebaseUrl = await getDownloadURL(photoRef);
            console.log(">>> KAROBHR TRACE: Attendance photo uploaded to", photoFirebaseUrl);
        } catch (uploadError) {
            console.error(">>> KAROBHR ERROR: Error uploading attendance photo:", uploadError);
            // Decide if you want to proceed without photo or throw error
        }
    }

    const fullEventData: Omit<AttendanceEvent, 'id' | 'timestamp'> = {
      ...restOfEventData,
      userId: user.id,
      employeeId: user.employeeId,
      userName: user.name || user.employeeId,
      photoUrl: photoFirebaseUrl, // This will be the actual URL from Firebase Storage
    };

    try {
      // Use eventId for document ID
      const attendanceDocRef = doc(db, "companies", companyId, "attendanceLog", eventId);
      await setDoc(attendanceDocRef, {
          ...fullEventData,
          timestamp: serverTimestamp() 
      });
      console.log(">>> KAROBHR TRACE: Attendance event added to Firestore with ID", eventId);
      // For local state, use client time for immediate display
      const displayEvent = { ...fullEventData, id: eventId, timestamp: new Date().toISOString()};
      setAttendanceLog(prev => [displayEvent, ...prev].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
    } catch (error) {
      console.error(">>> KAROBHR ERROR: Error adding attendance event:", error);
      throw error;
    }
  };
  
  const addTask = async (taskData: Omit<TaskType, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (!user || !companyId) {
      console.error(">>> KAROBHR ERROR: User not logged in or companyId missing for addTask.");
      throw new Error("User not logged in or companyId missing.");
    }
    const { db } = getFirebaseInstances();
    const newTaskPayload = {
        ...taskData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
    };
    try {
        const tasksCollectionRef = collection(db, "companies", companyId, "tasks");
        const docRef = await addDoc(tasksCollectionRef, newTaskPayload);
        console.log(">>> KAROBHR TRACE: Task added to Firestore with ID", docRef.id);
        const displayTask = { 
            ...taskData, 
            id: docRef.id, 
            createdAt: new Date().toISOString(), // Client time for immediate display
            updatedAt: new Date().toISOString()  // Client time for immediate display
        };
        setTasks(prev => [displayTask, ...prev].sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    } catch (error) {
        console.error(">>> KAROBHR ERROR: Error adding task:", error);
        throw error;
    }
  };

  const updateTask = async (updatedTaskData: Partial<TaskType> & { id: string }) => {
    if (!user || !companyId) {
      console.error(">>> KAROBHR ERROR: User not logged in or companyId missing for updateTask.");
      throw new Error("User not logged in or companyId missing.");
    }
    const { db } = getFirebaseInstances();
    const { id: taskId, ...dataToUpdate } = updatedTaskData;
    const taskDocRef = doc(db, "companies", companyId, "tasks", taskId);
    try {
        await updateDoc(taskDocRef, {
            ...dataToUpdate,
            updatedAt: serverTimestamp()
        });
        console.log(">>> KAROBHR TRACE: Task updated in Firestore with ID", taskId);
        setTasks(prev => prev.map(t => t.id === taskId ? ({ ...t, ...dataToUpdate, updatedAt: new Date().toISOString() } as TaskType) : t)
                             .sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    } catch (error) {
        console.error(">>> KAROBHR ERROR: Error updating task:", error);
        throw error;
    }
  };

  const addLeaveApplication = async (leaveData: Omit<LeaveApplication, 'id' | 'userId' | 'employeeId' | 'status' | 'appliedAt'>) => {
    if (!user || !companyId) {
      console.error(">>> KAROBHR ERROR: User not logged in or companyId missing for addLeaveApplication.");
      throw new Error("User not logged in or companyId missing.");
    }
    const { db } = getFirebaseInstances();
    const newLeaveId = uuidv4();
    const newLeaveApp: LeaveApplication = { // This is for local state with client time
        ...leaveData,
        id: newLeaveId,
        userId: user.id,
        employeeId: user.employeeId,
        status: 'pending',
        appliedAt: new Date().toISOString(), 
    };
    
    const userProfileRef = doc(db, "companies", companyId, "employees", user.id);
    // For Firestore, store a version with serverTimestamp for appliedAt.
    const leaveAppForFirestore = { ...newLeaveApp, appliedAt: serverTimestamp() };

    try {
        await updateDoc(userProfileRef, {
            leaves: arrayUnion(leaveAppForFirestore)
        });
        console.log(">>> KAROBHR TRACE: Leave application added to Firestore for user", user.id);
        setUser(prev => prev ? ({ ...prev, leaves: [...(prev.leaves || []), newLeaveApp].sort((a,b) => new Date(b.appliedAt).getTime() - new Date(a.appliedAt).getTime()) }) : null);
         // Also update in allUsers state if current user is admin or looking at their own profile in a list
        setAllUsers(prevAllUsers => prevAllUsers.map(u => 
            u.id === user.id ? { ...u, leaves: [...(u.leaves || []), newLeaveApp].sort((a,b) => new Date(b.appliedAt).getTime() - new Date(a.appliedAt).getTime()) } : u
        ));
    } catch (error) {
        console.error(">>> KAROBHR ERROR: Error adding leave application:", error);
        throw error;
    }
  };

  const processLeaveApplication = async (targetEmployeeUid: string, leaveId: string, newStatus: 'approved' | 'rejected') => {
    if (!user || !companyId || user.role !== 'admin') {
      console.error(">>> KAROBHR ERROR: Unauthorized or missing company context for processLeaveApplication.");
      throw new Error("Unauthorized or missing company context.");
    }
    const { db } = getFirebaseInstances();
    const targetUserProfileRef = doc(db, "companies", companyId, "employees", targetEmployeeUid);

    try {
        const targetUserDoc = await getDoc(targetUserProfileRef);
        if (!targetUserDoc.exists()) {
          console.error(">>> KAROBHR ERROR: Target employee profile not found for processLeaveApplication.");
          throw new Error("Target employee profile not found.");
        }
        const targetUserData = targetUserDoc.data() as User;
        const leaves = targetUserData.leaves || [];
        const leaveIndex = leaves.findIndex(l => l.id === leaveId);

        if (leaveIndex === -1) {
          console.error(">>> KAROBHR ERROR: Leave application not found for target employee for processLeaveApplication.");
          throw new Error("Leave application not found for target employee.");
        }
        
        // Create the updated leave object for local state (with client time)
        const updatedLeavesLocal = [...leaves];
        updatedLeavesLocal[leaveIndex] = {
            ...updatedLeavesLocal[leaveIndex],
            status: newStatus,
            processedAt: new Date().toISOString(), 
        };
        
        // Create the version for Firestore with serverTimestamp
        const leavesForFirestore = leaves.map(l => 
            l.id === leaveId ? { ...l, status: newStatus, processedAt: serverTimestamp() } : l
        );

        await updateDoc(targetUserProfileRef, { leaves: leavesForFirestore });
        console.log(">>> KAROBHR TRACE: Leave application processed in Firestore for UID", targetEmployeeUid);
        
        const sortedLeavesLocal = updatedLeavesLocal.sort((a,b) => new Date(b.appliedAt).getTime() - new Date(a.appliedAt).getTime());
        setAllUsers(prevAllUsers => prevAllUsers.map(u => 
            u.id === targetEmployeeUid ? { ...u, leaves: sortedLeavesLocal } : u
        ));
        if (user.id === targetEmployeeUid) { // If admin is processing their own leave (unlikely)
            setUser(prev => prev ? { ...prev, leaves: sortedLeavesLocal } : null);
        }
    } catch (error) {
        console.error(">>> KAROBHR ERROR: Error processing leave application:", error);
        throw error;
    }
  };


  return (
    <AuthContext.Provider value={{
        user,
        firebaseUser,
        companyId,
        allUsers,
        role,
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
        addLeaveApplication,
        processLeaveApplication,
    }}>
      {children}
    </AuthContext.Provider>
  );
};
