
import { collection, doc, getDoc, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase/firebase';
import type { User, AttendanceEvent, Task, MonthlyPayrollReport, Holiday, CompanySettings } from '@/lib/types';
import EmployeeDetailsClient from '@/components/employees/EmployeeDetailsClient';

// This function is required for Next.js static export of dynamic routes
// It should return an array of all possible `employeeId` values that should be pre-rendered.
export async function generateStaticParams() {
  const employeeIds: string[] = [];
  try {
    const usersCollection = collection(db, 'users');
    const querySnapshot = await getDocs(usersCollection);
    querySnapshot.forEach((doc) => {
      const userData = doc.data();
      if (userData.employeeId) {
        employeeIds.push(userData.employeeId);
      }
    });
  } catch (error) {
    console.error("Error fetching employee IDs for static params:", error);
    // In a production app, you might want to handle this more gracefully, e.g., re-throw or log to a monitoring service.
  }

  return employeeIds.map(id => ({ employeeId: id }));
}

// Main Server Component for the Employee Detail Page
export default async function EmployeeDetailPage({ params }: { params: { employeeId: string } }) {
  const { employeeId } = params;

  let initialEmployeeData = null;
  let initialHolidays: Holiday[] = [];
  let initialCompanySettings: any = null; // Replace 'any' with your actual CompanySettings type if available

  try {
    // Fetch employee data
    const userDocRef = doc(db, 'users', employeeId); // Assuming employeeId is also the document ID
    const userDocSnap = await getDoc(userDocRef);

    if (userDocSnap.exists()) {
      const employee = { id: userDocSnap.id, ...userDocSnap.data() } as User;

      // Fetch attendance log for the employee
      const attendanceCollectionRef = collection(db, 'attendance');
      const attendanceQuerySnapshot = await getDocs(attendanceCollectionRef);
      const employeeAttendance = attendanceQuerySnapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(event => (event as AttendanceEvent).userId === employee.id) as AttendanceEvent[];

      // Fetch tasks for the employee
      const tasksCollectionRef = collection(db, 'tasks');
      const tasksQuerySnapshot = await getDocs(tasksCollectionRef);
      const employeeTasks = tasksQuerySnapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(task => (task as Task).assigneeId === employee.employeeId) as Task[];

      initialEmployeeData = { employee, employeeAttendance, employeeTasks };
    }

    // Fetch holidays (assuming these are global or fetched once)
    const holidaysCollectionRef = collection(db, 'holidays');
    const holidaysQuerySnapshot = await getDocs(holidaysCollectionRef);
    initialHolidays = holidaysQuerySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Holiday[];

    // Fetch company settings (assuming these are global or fetched once)
    const settingsDocRef = doc(db, 'settings', 'companySettings'); // Assuming a single document for company settings
    const settingsDocSnap = await getDoc(settingsDocRef);
    if (settingsDocSnap.exists()) {
        initialCompanySettings = settingsDocSnap.data();
    }

  } catch (error) {
    console.error("Error fetching initial employee data for server component:", error);
    // Handle error gracefully, e.g., return a generic error page or null data
  }

  return (
    <EmployeeDetailsClient 
      initialEmployeeData={initialEmployeeData} 
      initialHolidays={initialHolidays}
      initialCompanySettings={initialCompanySettings}
    />
  );
}
