// @ts-nocheck
'use client';

import React, { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { collection, query, where, getDocs, doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/firebase';
import { Employee, LeaveRequest, AdvanceRequest } from '@/lib/types';
import EmployeeDetailsClient from '@/components/employees/EmployeeDetailsClient';
import { toast } from '@/hooks/use-toast';

interface EmployeeDetailPageProps {
  params: {
    employeeId: string;
  };
}

const EmployeeDetailPage: React.FC<EmployeeDetailPageProps> = ({ params }) => {
  const router = useRouter();
  const resolvedParams = use(params);
  const { employeeId } = resolvedParams;
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [advanceRequests, setAdvanceRequests] = useState<AdvanceRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchEmployeeData = async () => {
      if (!employeeId) return;

      try {
        // Query the 'users' collection to find the document with the matching 'employeeId'
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where("employeeId", "==", employeeId));
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
          // Assuming employeeId is unique, so we take the first result
          const docSnap = querySnapshot.docs[0];
          const employeeData = { id: docSnap.id, ...docSnap.data() } as Employee;
          setEmployee(employeeData);

        } else {
          toast({
            title: 'Error',
            description: 'Employee not found in the database.',
            variant: 'destructive',
          });
          router.push('/admin/employees');
        }
      } catch (error) {
        console.error('Error fetching employee:', error);
        toast({
          title: 'Error fetching data',
          description: 'There was a problem fetching the employee details. Check console for more info.',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };

    fetchEmployeeData();
  }, [employeeId, router]);

  if (loading) {
    return <div className="p-4 animate-pulse text-center text-muted-foreground">Loading employee details...</div>;
  }

  if (!employee) {
    return <div className="p-4 text-center text-destructive">Employee data could not be loaded. You may be redirected shortly.</div>;
  }

  return (
    <div className="flex flex-col flex-1 p-4 md:p-8">
      <h1 className="text-2xl font-bold mb-4">Employee Details</h1>
      <EmployeeDetailsClient
        employee={employee}
        leaveRequests={leaveRequests}
        advanceRequests={advanceRequests}
      />
    </div>
  );
};

export default EmployeeDetailPage;
