
import { NextResponse } from 'next/server';
import { authAdmin, firestoreAdmin } from '@/lib/firebase/firebaseAdmin';

export async function POST(request: Request) {
  try {
    const { employeeUid, newSalary, newPassword } = await request.json();
    const idToken = request.headers.get('Authorization')?.split('Bearer ')[1];

    if (!idToken) {
      return NextResponse.json({ error: 'Authorization token not provided.' }, { status: 401 });
    }

    if (!employeeUid) {
      return NextResponse.json({ error: 'Employee UID is required.' }, { status: 400 });
    }
    
    // Verify the admin's token to ensure they are authenticated and have the correct role
    const decodedToken = await authAdmin.verifyIdToken(idToken);
    if (decodedToken.role !== 'admin') {
      return NextResponse.json({ error: 'Permission denied. Not an administrator.' }, { status: 403 });
    }

    // Now proceed with the updates
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
    if (error.code === 'auth/id-token-expired') {
        return NextResponse.json({ error: 'Authentication token has expired. Please log in again.' }, { status: 401 });
    }
    return NextResponse.json({ 
      error: 'An unknown error occurred on the server.',
      details: error.message,
    }, { status: 500 });
  }
}
