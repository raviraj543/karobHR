import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase/firebase'; // Adjust this import to your Firebase config

export async function generateStaticParams() {
  // In a real application, you would fetch all employee IDs from your database.
  // For example, if you store employees in a Firestore collection named 'users'
  // and each user document has an 'employeeId' field.
  
  const employeeIds: string[] = [];
  try {
    const usersCollection = collection(db, 'users'); // Assuming 'users' is your employee collection
    const querySnapshot = await getDocs(usersCollection);
    querySnapshot.forEach((doc) => {
      const userData = doc.data();
      if (userData.employeeId) {
        employeeIds.push(userData.employeeId);
      }
    });
  } catch (error) {
    console.error("Error fetching employee IDs for static params:", error);
    // Fallback or re-throw the error based on your build strategy
  }

  return employeeIds.map(id => ({ employeeId: id }));
}
