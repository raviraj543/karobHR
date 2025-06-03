
'use client';

import type { ReactNode } from 'react';
import { createContext, useState, useEffect, useCallback } from 'react';
import type { User, UserRole, Advance, Announcement, LeaveApplication, AttendanceEvent, Task as TaskType, UserDirectoryEntry, NewEmployeeData as OldNewEmployeeData } from '@/lib/types';
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
  deleteDoc,
  arrayUnion,
  arrayRemove,
  Timestamp,
  orderBy,
  limit,
  serverTimestamp,
  addDoc,
  deleteField,
} from 'firebase/firestore';
import { ref, uploadString, getDownloadURL, deleteObject } from 'firebase/storage';

// --- Helper: Firebase Email Convention ---
const TEMP_AUTH_DOMAIN = "karobhr-temp.firebaseapp.com"; // Keep consistent for now
const createFirebaseEmail = (employeeId: string): string => {
  const safeEmployeeId = employeeId.replace(/[^a-zA-Z0-9_.-]/g, '');
  return `${safeEmployeeId}@${TEMP_AUTH_DOMAIN}`;
};
// --- End Helper ---

// Redefine NewEmployeeData to ensure companyId is always present
export interface NewEmployeeData extends OldNewEmployeeData {
  companyId: string; // Ensure companyId is part of the data for a new employee
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
  requestAdvance: (amount: number, reason: string) => Promise<void>;
  processAdvance: (targetEmployeeUid: string, advanceId: string, newStatus: 'approved' | 'rejected') => Promise<void>;
  updateUserInContext: (updatedUser: Partial<User> & { id: string }) => Promise<void>;
  addAnnouncement: (title: string, content: string) => Promise<void>;
  addAttendanceEvent: (eventData: Omit<AttendanceEvent, 'id' | 'timestamp' | 'userName' | 'userId'> & { photoDataUrl?: string | null }) => Promise<void>;
  addTask: (taskData: Omit<TaskType, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  updateTask: (updatedTask: Partial<TaskType> & { id: string }) => Promise<void>;
  // New:
  addLeaveApplication: (leaveData: Omit<LeaveApplication, 'id' | 'userId' | 'employeeId' | 'status' | 'appliedAt'>) => Promise<void>;
  processLeaveApplication: (targetEmployeeUid: string, leaveId: string, newStatus: 'approved' | 'rejected') => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<User | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);

  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [attendanceLog, setAttendanceLog] = useState<AttendanceEvent[]>([]);
  const [tasks, setTasks] = useState<TaskType[]>([]);

  const loadCompanyData = useCallback(async (cid: string, currentFbUser: FirebaseUser) => {
    if (!cid) return;
    const { db } = getFirebaseInstances();

    // Fetch all users for the company
    const usersCollectionRef = collection(db, "companies", cid, "employees");
    const usersSnapshot = await getDocs(usersCollectionRef);
    const companyUsers = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User));
    setAllUsers(companyUsers);

    // Fetch tasks for the company
    const tasksCollectionRef = collection(db, "companies", cid, "tasks");
    const tasksQuery = query(tasksCollectionRef, orderBy("createdAt", "desc"));
    const tasksSnapshot = await getDocs(tasksQuery);
    const companyTasks = tasksSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TaskType));
    setTasks(companyTasks);

    // Fetch announcements for the company
    const announcementsCollectionRef = collection(db, "companies", cid, "announcements");
    const announcementsQuery = query(announcementsCollectionRef, orderBy("postedAt", "desc"), limit(20));
    const announcementsSnapshot = await getDocs(announcementsQuery);
    const companyAnnouncements = announcementsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Announcement));
    setAnnouncements(companyAnnouncements);

    // Fetch attendance log for the company (maybe limit this or filter by date range in a real app)
    const attendanceCollectionRef = collection(db, "companies", cid, "attendanceLog");
    const attendanceQuery = query(attendanceCollectionRef, orderBy("timestamp", "desc"), limit(100)); // Example limit
    const attendanceSnapshot = await getDocs(attendanceQuery);
    const companyAttendanceLog = attendanceSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AttendanceEvent));
    setAttendanceLog(companyAttendanceLog);

  }, []);


  useEffect(() => {
    setLoading(true);
    const { auth: firebaseAuthService, db: firestore } = getFirebaseInstances();
    if (!firebaseAuthService || !firestore) {
      console.error("Firebase services not initialized in AuthProvider listener.");
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(firebaseAuthService, async (fbUser) => {
      setFirebaseUser(fbUser);
      if (fbUser) {
        try {
          const userDirRef = doc(firestore, "userDirectory", fbUser.uid);
          const userDirSnap = await getDoc(userDirRef);

          if (userDirSnap.exists()) {
            const userDirData = userDirSnap.data() as UserDirectoryEntry;
            setCompanyId(userDirData.companyId);
            setRole(userDirData.role);

            const userProfileRef = doc(firestore, "companies", userDirData.companyId, "employees", fbUser.uid);
            const userProfileSnap = await getDoc(userProfileRef);

            if (userProfileSnap.exists()) {
              const userProfileData = { id: userProfileSnap.id, ...userProfileSnap.data() } as User;
              setUser(userProfileData);
              await loadCompanyData(userDirData.companyId, fbUser);
            } else {
              console.warn(`KarobHR profile not found for UID: ${fbUser.uid} in company ${userDirData.companyId}. User might need full profile setup.`);
              setUser(null); // Or a minimal user object from userDirData
            }
          } else {
            console.warn(`User directory entry not found for UID: ${fbUser.uid}. User may be new or setup is incomplete.`);
            // This case might happen if admin signup was interrupted.
            // Or if it's a user whose directory entry wasn't created properly.
            setUser(null);
            setCompanyId(null);
            setRole(null);
          }
        } catch (error) {
          console.error("Error fetching user data post-auth:", error);
          setUser(null);
          setCompanyId(null);
          setRole(null);
        }
      } else {
        setUser(null);
        setCompanyId(null);
        setRole(null);
        setAllUsers([]);
        setTasks([]);
        setAnnouncements([]);
        setAttendanceLog([]);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [loadCompanyData]);

  const login = async (employeeId: string, pass: string): Promise<User | null> => {
    setLoading(true);
    const { auth: firebaseAuthService } = getFirebaseInstances();
    const authEmail = createFirebaseEmail(employeeId);

    try {
      const userCredential = await signInWithEmailAndPassword(firebaseAuthService, authEmail, pass);
      // onAuthStateChanged will handle setting user state and loading company data.
      // For the return value, we need to wait for onAuthStateChanged to resolve and set `user`.
      // This is a bit tricky. Let's assume onAuthStateChanged will be quick.
      // A better approach might be to fetch user details directly here after login.
      // For now, let's rely on onAuthStateChanged.
      // This function will now effectively just trigger the auth state change.
      // The actual `User` object will come from the `user` state managed by `onAuthStateChanged`.
      // We can try to fetch and return here for immediate feedback to LoginForm.
      const { db } = getFirebaseInstances();
      const userDirRef = doc(db, "userDirectory", userCredential.user.uid);
      const userDirSnap = await getDoc(userDirRef);
      if (userDirSnap.exists()) {
        const userDirData = userDirSnap.data() as UserDirectoryEntry;
        const userProfileRef = doc(db, "companies", userDirData.companyId, "employees", userCredential.user.uid);
        const userProfileSnap = await getDoc(userProfileRef);
        if (userProfileSnap.exists()) {
          setLoading(false);
          return { id: userProfileSnap.id, ...userProfileSnap.data() } as User;
        }
      }
      setLoading(false);
      return null; // Fallback if profile not found immediately
    } catch (error: any) {
      console.error("Firebase login error:", error);
      setLoading(false);
      throw error;
    }
  };

  const logout = async () => {
    setLoading(true);
    const { auth: firebaseAuthService } = getFirebaseInstances();
    try {
      await signOut(firebaseAuthService);
      // onAuthStateChanged will clear all user-related states.
    } catch (error) {
      console.error("Error signing out from Firebase:", error);
    } finally {
      setLoading(false);
    }
  };

  const addNewEmployee = async (employeeData: NewEmployeeData, passwordToSet: string) => {
    const { auth: firebaseAuthService, db: firestore } = getFirebaseInstances();
    const { employeeId, name, role: newEmployeeRole, department, joiningDate, baseSalary, companyId: empCompanyId, email: providedEmail } = employeeData;

    if (!empCompanyId) throw new Error("Company ID is required to add a new employee.");

    const firebaseEmail = providedEmail || createFirebaseEmail(employeeId);
    let newFirebaseUser: FirebaseUser | null = null;

    try {
      // Check if employeeId already exists in the company's userDirectory lookups
      const q = query(collection(firestore, "userDirectory"), where("companyId", "==", empCompanyId), where("employeeId", "==", employeeId));
      const existingEmployeeSnap = await getDocs(q);
      if (!existingEmployeeSnap.empty) {
        throw new Error(`Employee ID "${employeeId}" already exists in company "${empCompanyId}".`);
      }
      
      const userCredential = await createUserWithEmailAndPassword(firebaseAuthService, firebaseEmail, passwordToSet);
      newFirebaseUser = userCredential.user;
    } catch (error: any) {
      console.error("Error creating employee in Firebase Auth:", error);
      throw new Error(`Failed to create Firebase Auth user: ${error.message}`);
    }

    if (!newFirebaseUser) throw new Error("Firebase user creation failed silently.");

    const userDirEntry: UserDirectoryEntry = {
      userId: newFirebaseUser.uid,
      employeeId,
      email: newFirebaseUser.email!, // email is guaranteed by Firebase Auth user
      companyId: empCompanyId,
      role: newEmployeeRole,
      name: name
    };

    const newUserProfile: User = {
      id: newFirebaseUser.uid,
      employeeId,
      name,
      email: newFirebaseUser.email!,
      role: newEmployeeRole,
      companyId: empCompanyId,
      department: department || (newEmployeeRole === 'admin' ? 'Administration' : 'N/A'),
      joiningDate: joiningDate || new Date().toISOString().split('T')[0],
      baseSalary: baseSalary !== undefined ? baseSalary : (newEmployeeRole === 'admin' ? 0 : undefined),
      mockAttendanceFactor: 1.0,
      advances: [],
      leaves: [],
      profilePictureUrl: `https://placehold.co/100x100.png?text=${name?.split(' ').map(n => n[0]).join('').toUpperCase() || 'NA'}`,
    };

    const batch = writeBatch(firestore);
    const userDirRef = doc(firestore, "userDirectory", newFirebaseUser.uid);
    batch.set(userDirRef, userDirEntry);
    const userProfileRef = doc(firestore, "companies", empCompanyId, "employees", newFirebaseUser.uid);
    batch.set(userProfileRef, newUserProfile);

    try {
      await batch.commit();
      console.log("Employee created in Auth, UserDirectory, and Company Employees collection.");
      // If current user is admin of the same company, refresh allUsers
      if (user && user.companyId === empCompanyId && user.role === 'admin') {
         setAllUsers(prev => [...prev, newUserProfile]);
      }
    } catch (error) {
      console.error("Error writing employee data to Firestore:", error);
      // TODO: Consider rolling back Firebase Auth user creation
      throw new Error("Failed to store employee profile in Firestore.");
    }
  };

  const requestAdvance = async (amount: number, reason: string) => {
    if (!user || !companyId) throw new Error("User not logged in or companyId missing.");
    const { db } = getFirebaseInstances();
    const newAdvance: Advance = {
      id: uuidv4(),
      employeeId: user.employeeId,
      amount,
      reason,
      dateRequested: new Date().toISOString(),
      status: 'pending'
    };
    const userProfileRef = doc(db, "companies", companyId, "employees", user.id);
    try {
      await updateDoc(userProfileRef, {
        advances: arrayUnion(newAdvance)
      });
      setUser(prev => prev ? ({ ...prev, advances: [...(prev.advances || []), newAdvance] }) : null);
    } catch (error) {
      console.error("Error requesting advance:", error);
      throw error;
    }
  };

  const processAdvance = async (targetEmployeeUid: string, advanceId: string, newStatus: 'approved' | 'rejected') => {
    if (!user || !companyId || user.role !== 'admin') throw new Error("Unauthorized or missing context.");
    const { db } = getFirebaseInstances();
    const targetUserProfileRef = doc(db, "companies", companyId, "employees", targetEmployeeUid);
    
    try {
        const targetUserDoc = await getDoc(targetUserProfileRef);
        if (!targetUserDoc.exists()) throw new Error("Target employee profile not found.");
        const targetUserData = targetUserDoc.data() as User;
        const advances = targetUserData.advances || [];
        const advanceIndex = advances.findIndex(adv => adv.id === advanceId);

        if (advanceIndex === -1) throw new Error("Advance not found for target employee.");
        
        const updatedAdvances = [...advances];
        updatedAdvances[advanceIndex] = {
            ...updatedAdvances[advanceIndex],
            status: newStatus,
            dateProcessed: new Date().toISOString()
        };

        await updateDoc(targetUserProfileRef, { advances: updatedAdvances });
        // Update local allUsers state
        setAllUsers(prevAllUsers => prevAllUsers.map(u => 
            u.id === targetEmployeeUid ? { ...u, advances: updatedAdvances } : u
        ));
         // If the processed advance belongs to the current user, update their state too
        if (user.id === targetEmployeeUid) {
            setUser(prev => prev ? { ...prev, advances: updatedAdvances } : null);
        }

    } catch (error) {
        console.error("Error processing advance:", error);
        throw error;
    }
  };
  
  const updateUserInContext = async (updatedProfileData: Partial<User> & { id: string }) => {
    if (!firebaseUser || !companyId) throw new Error("No authenticated user or company context to update profile.");
    const { db } = getFirebaseInstances();
    const { id: targetUserId, ...dataToUpdate } = updatedProfileData;

    const userProfileRef = doc(db, "companies", companyId, "employees", targetUserId);
    try {
      await updateDoc(userProfileRef, dataToUpdate);
      if (targetUserId === user?.id) {
        setUser(prev => prev ? ({ ...prev, ...dataToUpdate }) : null);
      }
      setAllUsers(prevAll => prevAll.map(u => u.id === targetUserId ? ({ ...u, ...dataToUpdate } as User) : u));
    } catch (error) {
      console.error("Error updating user profile in Firestore:", error);
      throw error;
    }
  };

  const addAnnouncement = async (title: string, content: string) => {
    if (!user || !companyId || user.role !== 'admin') throw new Error("Unauthorized.");
    const { db } = getFirebaseInstances();
    const newAnnouncement: Omit<Announcement, 'id'> = {
      title,
      content,
      postedAt: Timestamp.now().toDate().toISOString(),
      postedByUid: user.id,
      postedByName: user.name || user.employeeId,
    };
    try {
      const announcementsCollectionRef = collection(db, "companies", companyId, "announcements");
      const docRef = await addDoc(announcementsCollectionRef, {
        ...newAnnouncement,
        postedAt: serverTimestamp() // Use server timestamp for consistency
      });
      setAnnouncements(prev => [{ ...newAnnouncement, id: docRef.id, postedAt: new Date().toISOString() }, ...prev]);
    } catch (error) {
      console.error("Error adding announcement:", error);
      throw error;
    }
  };

  const addAttendanceEvent = async (eventData: Omit<AttendanceEvent, 'id' | 'timestamp' | 'userName' | 'userId'> & { photoDataUrl?: string | null }) => {
    if (!user || !companyId) throw new Error("User not logged in or companyId missing.");
    const { db, storage } = getFirebaseInstances();
    const { photoDataUrl, ...restOfEventData } = eventData;
    let photoFirebaseUrl: string | null = null;
    const eventId = uuidv4(); // Generate ID for Firestore and Storage

    if (photoDataUrl) {
        const photoRef = ref(storage, `companies/${companyId}/attendance_photos/${user.employeeId}/${eventId}.jpg`);
        try {
            await uploadString(photoRef, photoDataUrl, 'data_url');
            photoFirebaseUrl = await getDownloadURL(photoRef);
        } catch (uploadError) {
            console.error("Error uploading attendance photo:", uploadError);
            // Decide if you want to proceed without photo or throw error
        }
    }

    const fullEvent: Omit<AttendanceEvent, 'id'> = {
      ...restOfEventData,
      userId: user.id,
      employeeId: user.employeeId,
      userName: user.name || user.employeeId,
      timestamp: Timestamp.now().toDate().toISOString(), // client-side timestamp for immediate display, server preferred
      photoUrl: photoFirebaseUrl,
    };

    try {
      const attendanceDocRef = doc(db, "companies", companyId, "attendanceLog", eventId);
      await setDoc(attendanceDocRef, {
          ...fullEvent,
          timestamp: serverTimestamp() // Override with server timestamp
      });
      setAttendanceLog(prev => [{ ...fullEvent, id: eventId, timestamp: new Date().toISOString() }, ...prev]);
    } catch (error) {
      console.error("Error adding attendance event:", error);
      throw error;
    }
  };
  
  const addTask = async (taskData: Omit<TaskType, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (!user || !companyId) throw new Error("User not logged in or companyId missing.");
    const { db } = getFirebaseInstances();
    const newTaskPayload = {
        ...taskData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
    };
    try {
        const tasksCollectionRef = collection(db, "companies", companyId, "tasks");
        const docRef = await addDoc(tasksCollectionRef, newTaskPayload);
        setTasks(prev => [{ ...taskData, id: docRef.id, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }, ...prev]);
    } catch (error) {
        console.error("Error adding task:", error);
        throw error;
    }
  };

  const updateTask = async (updatedTaskData: Partial<TaskType> & { id: string }) => {
    if (!user || !companyId) throw new Error("User not logged in or companyId missing.");
    const { db } = getFirebaseInstances();
    const { id: taskId, ...dataToUpdate } = updatedTaskData;
    const taskDocRef = doc(db, "companies", companyId, "tasks", taskId);
    try {
        await updateDoc(taskDocRef, {
            ...dataToUpdate,
            updatedAt: serverTimestamp()
        });
        setTasks(prev => prev.map(t => t.id === taskId ? ({ ...t, ...dataToUpdate, updatedAt: new Date().toISOString() } as TaskType) : t));
    } catch (error) {
        console.error("Error updating task:", error);
        throw error;
    }
  };

  const addLeaveApplication = async (leaveData: Omit<LeaveApplication, 'id' | 'userId' | 'employeeId' | 'status' | 'appliedAt'>) => {
    if (!user || !companyId) throw new Error("User not logged in or companyId missing.");
    const { db } = getFirebaseInstances();
    const newLeaveId = uuidv4();
    const newLeaveApp: LeaveApplication = {
        ...leaveData,
        id: newLeaveId,
        userId: user.id,
        employeeId: user.employeeId,
        status: 'pending',
        appliedAt: Timestamp.now().toDate().toISOString(),
    };
    
    const userProfileRef = doc(db, "companies", companyId, "employees", user.id);
    try {
        await updateDoc(userProfileRef, {
            leaves: arrayUnion(newLeaveApp)
        });
        setUser(prev => prev ? ({ ...prev, leaves: [...(prev.leaves || []), newLeaveApp] }) : null);
    } catch (error) {
        console.error("Error adding leave application:", error);
        throw error;
    }
  };

  const processLeaveApplication = async (targetEmployeeUid: string, leaveId: string, newStatus: 'approved' | 'rejected') => {
    if (!user || !companyId || user.role !== 'admin') throw new Error("Unauthorized or missing context.");
    const { db } = getFirebaseInstances();
    const targetUserProfileRef = doc(db, "companies", companyId, "employees", targetEmployeeUid);

    try {
        const targetUserDoc = await getDoc(targetUserProfileRef);
        if (!targetUserDoc.exists()) throw new Error("Target employee profile not found.");
        const targetUserData = targetUserDoc.data() as User;
        const leaves = targetUserData.leaves || [];
        const leaveIndex = leaves.findIndex(l => l.id === leaveId);

        if (leaveIndex === -1) throw new Error("Leave application not found for target employee.");
        
        const updatedLeaves = [...leaves];
        updatedLeaves[leaveIndex] = {
            ...updatedLeaves[leaveIndex],
            status: newStatus,
            processedAt: new Date().toISOString()
        };

        await updateDoc(targetUserProfileRef, { leaves: updatedLeaves });
        // Update local allUsers state
        setAllUsers(prevAllUsers => prevAllUsers.map(u => 
            u.id === targetEmployeeUid ? { ...u, leaves: updatedLeaves } : u
        ));
        // If the processed leave belongs to the current user, update their state too
        if (user.id === targetEmployeeUid) {
            setUser(prev => prev ? { ...prev, leaves: updatedLeaves } : null);
        }
    } catch (error) {
        console.error("Error processing leave application:", error);
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
