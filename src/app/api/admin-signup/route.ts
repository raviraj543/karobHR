import { NextResponse } from 'next/server';
import { authAdmin, firestoreAdmin } from '@/lib/firebase/firebaseAdmin';
import type { NewEmployeeData } from '@/lib/authContext';

export async function POST(request: Request) {
  try {
    console.log("API Route: /api/admin-signup received request.");
    console.log("Environment Variables check:");
    console.log("FIREBASE_PROJECT_ID:", process.env.FIREBASE_PROJECT_ID ? 'Loaded' : 'NOT LOADED');
    console.log("FIREBASE_CLIENT_EMAIL:", process.env.FIREBASE_CLIENT_EMAIL ? 'Loaded' : 'NOT LOADED');
    console.log("FIREBASE_PRIVATE_KEY length:", process.env.FIREBASE_PRIVATE_KEY?.length || 0);
    
    const { employeeData, password }: { employeeData: NewEmployeeData; password?: string } = await request.json();

    console.log("Received employeeData:", employeeData);

    if (!employeeData.employeeId || !password) {
      console.error("Validation Error: Admin Login ID or password missing.");
      return NextResponse.json({ error: 'Admin Login ID and password are required.' }, { status: 400 });
    }

    // Create user in Firebase Authentication
    const userRecord = await authAdmin.createUser({
      email: employeeData.email,
      password: password,
      displayName: employeeData.name,
    });

    // Store employee data in Firestore
    await firestoreAdmin.collection('users').doc(userRecord.uid).set({
      uid: userRecord.uid,
      email: employeeData.email,
      name: employeeData.name,
      employeeId: employeeData.employeeId,
      department: employeeData.department,
      role: employeeData.role,
      companyId: employeeData.companyId,
      companyName: employeeData.companyName,
      joiningDate: employeeData.joiningDate,
      baseSalary: employeeData.baseSalary,
      createdAt: new Date().toISOString(),
    });

    // Set custom claims
    await authAdmin.setCustomUserClaims(userRecord.uid, { role: employeeData.role });

    return NextResponse.json({ message: 'Admin account created successfully!' }, { status: 200 });
  } catch (error: any) {
    console.error("!!! UNHANDLED ERROR IN API ROUTE !!!:", error);
    // DEBUGGING: Send detailed error to client
    return NextResponse.json({ 
      error: 'An unknown error occurred on the server.',
      details: error.message,
      stack: error.stack,
    }, { status: 500 });
  }
}
