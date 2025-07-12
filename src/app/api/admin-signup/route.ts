import { NextResponse } from 'next/server';
import { authAdmin, firestoreAdmin } from '@/lib/firebase/firebaseAdmin';
import type { NewEmployeeData } from '@/lib/authContext';

export async function POST(request: Request) {
  try {
    console.log("API Route: /api/admin-signup received request.");
    
    const { employeeData, password }: { employeeData: NewEmployeeData; password?: string } = await request.json();

    console.log("Signup - Received employeeData:", employeeData);

    if (!employeeData.employeeId || !password || !employeeData.email || !employeeData.companyId || !employeeData.companyName) {
      console.error("Signup - Validation Error: Missing required fields (employeeId, email, password, companyId, companyName).");
      return NextResponse.json({ error: 'Employee ID, email, password, Company ID, and Company Name are required.' }, { status: 400 });
    }

    // Check if user already exists in Auth
    try {
      await authAdmin.getUserByEmail(employeeData.email);
      console.warn(`Signup - User with email ${employeeData.email} already exists in Auth.`);
      return NextResponse.json({ error: 'User with this email already exists.' }, { status: 409 });
    } catch (authError: any) {
      if (authError.code !== 'auth/user-not-found') {
        console.error("Signup - Auth error during pre-check:", authError);
        throw authError; // Re-throw if it's not just user not found
      }
      console.log(`Signup - Email ${employeeData.email} not found in Auth, proceeding with creation.`);
    }

    const batch = firestoreAdmin.batch();

    // Create user in Firebase Authentication
    const userRecord = await authAdmin.createUser({
      email: employeeData.email,
      password: password,
      displayName: employeeData.name,
    });
    console.log("Signup - User created in Firebase Auth with UID:", userRecord.uid);

    const userDocRef = firestoreAdmin.collection('users').doc(userRecord.uid);
    const newUserDocumentData = {
      uid: userRecord.uid,
      email: employeeData.email,
      name: employeeData.name,
      employeeId: employeeData.employeeId,
      department: employeeData.department,
      role: employeeData.role,
      companyId: employeeData.companyId,
      companyName: employeeData.companyName,
      joiningDate: employeeData.joiningDate || new Date().toISOString(),
      baseSalary: employeeData.baseSalary || 0,
      createdAt: new Date().toISOString(),
      advances: [],
      leaves: [],
    };
    batch.set(userDocRef, newUserDocumentData);
    console.log("Signup - User document prepared for batch write. User UID:", newUserDocumentData.uid, ", Company ID:", newUserDocumentData.companyId);

    // --- IMPORTANT: Create Company Document if this is the first admin --- 
    if (employeeData.role === 'admin') {
      const companyDocRef = firestoreAdmin.collection('companies').doc(employeeData.companyId);
      console.log(`Signup - Checking for company document with ID: ${employeeData.companyId}`);
      const companyDocSnap = await companyDocRef.get();

      if (!companyDocSnap.exists()) {
        console.log(`Signup - Company document for ID ${employeeData.companyId} does NOT exist. Preparing to create it.`);
        const newCompanyData = {
          companyId: employeeData.companyId,
          companyName: employeeData.companyName,
          adminUid: userRecord.uid,
          createdAt: new Date().toISOString(),
          salaryCalculationMode: 'hourly_deduction', 
          officeLocation: { 
            latitude: 0,
            longitude: 0,
            radius: 0,
            name: "Main Office"
          }
        };
        batch.set(companyDocRef, newCompanyData);
        console.log("Signup - Company document prepared for batch write with data:", newCompanyData);
      } else {
        console.log(`Signup - Company document for ID ${employeeData.companyId} ALREADY EXISTS. Skipping creation.`);
      }
    }

    // Commit the batch write
    await batch.commit();
    console.log("Signup - Firestore batch committed: User and (if new) Company created.");

    // Set custom claims
    await authAdmin.setCustomUserClaims(userRecord.uid, { role: employeeData.role, companyId: employeeData.companyId });
    console.log("Signup - Custom claims set for user UID:", userRecord.uid);

    return NextResponse.json({ message: 'Admin account created successfully!' }, { status: 200 });
  } catch (error: any) {
    console.error("!!! UNHANDLED ERROR IN API ROUTE (/api/admin-signup) !!!:", error);
    // If user creation succeeded but Firestore failed, delete Auth user to prevent orphans
    if (error.code && error.code.startsWith('auth/') && request.json && (await request.json()).employeeData?.email) {
      try {
        const email = (await request.json()).employeeData.email;
        const userRecordToDelete = await authAdmin.getUserByEmail(email);
        await authAdmin.deleteUser(userRecordToDelete.uid);
        console.log(`Signup - Cleaned up Auth user ${userRecordToDelete.uid} due to Firestore error.`);
      } catch (cleanupError) {
        console.error("Signup - Failed to clean up Auth user:", cleanupError);
      }
    }
    return NextResponse.json({ 
      error: 'An unknown error occurred on the server.',
      details: error.message,
      stack: error.stack,
    }, { status: 500 });
  }
}
