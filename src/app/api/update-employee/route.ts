
import { NextResponse } from 'next/server';
import { authAdmin, firestoreAdmin } from '@/lib/firebase/firebaseAdmin';
import { getAuth } from 'firebase-admin/auth';

export async function POST(request: Request) {
  try {
    const { adminUid, employeeUid, newSalary, newPassword } = await request.json();

    if (!adminUid || !employeeUid) {
      return NextResponse.json({ error: 'Admin UID and Employee UID are required.' }, { status: 400 });
    }
    
    // In a real app, you'd get the token from the request headers and verify it
    const adminUser = await getAuth().getUser(adminUid);
    if (adminUser.customClaims?.role !== 'admin') {
      return NextResponse.json({ error: 'Permission denied. Not an administrator.' }, { status: 403 });
    }

    if (newPassword) {
      if (newPassword.length < 6) {
        return NextResponse.json({ error: 'Password must be at least 6 characters long.' }, { status: 400 });
      }
      await authAdmin.updateUser(employeeUid, { password: newPassword });
    }

    const updates: { [key: string]: any } = {};
    if (newSalary !== undefined) {
      const salary = Number(newSalary);
      if (isNaN(salary) || salary < 0) {
        return NextResponse.json({ error: 'Invalid salary amount.' }, { status: 400 });
      }
      updates.baseSalary = salary;
    }

    if (Object.keys(updates).length > 0) {
      const employeeDocRef = firestoreAdmin.collection('users').doc(employeeUid);
      await employeeDocRef.update(updates);
    }
    
    return NextResponse.json({ message: 'Employee details updated successfully!' }, { status: 200 });

  } catch (error: any) {
    console.error("Error updating employee details:", error);
    return NextResponse.json({ 
      error: 'An unknown error occurred on the server.',
      details: error.message,
    }, { status: 500 });
  }
}
