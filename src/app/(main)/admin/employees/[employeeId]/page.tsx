// @ts-nocheck
'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/firebase';
import { Employee, LeaveRequest, AdvanceRequest } from '@/lib/types';
import EmployeeDetailsClient from '@/components/employees/EmployeeDetailsClient';
import { toast } from '@/components/ui/use-toast';

interface EmployeeDetailPageProps {
  params: {
    employeeId: string;
  };
}

const EmployeeDetailPage: React.FC<EmployeeDetailPageProps> = ({ params }) => {
  const router = useRouter();
  const { employeeId } = params;
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [advanceRequests, setAdvanceRequests] = useState<AdvanceRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchEmployeeData = async () => {
      if (!employeeId) return;

      try {
        const employeeRef = doc(db, 'employees', employeeId);
        const docSnap = await getDoc(employeeRef);

        if (docSnap.exists()) {
          const employeeData = { id: docSnap.id, ...docSnap.data() } as Employee;
          setEmployee(employeeData);

          // Fetch leave requests for this employee
          // This would typically involve a query on the 'leaveRequests' collection
          // For now, mocking or assuming it's part of employee data or fetched separately
          // setLeaveRequests(employeeData.leaveRequests || []);

          // Fetch advance requests for this employee
          // setAdvanceRequests(employeeData.advanceRequests || []);
        } else {
          toast({
            title: 'Error',
            description: 'Employee not found.',
            variant: 'destructive',
          });
          router.push('/admin/employees'); // Redirect if employee not found
        }
      } catch (error) {
        console.error('Error fetching employee:', error);
        toast({
          title: 'Error',
          description: 'Failed to fetch employee data.',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };

    fetchEmployeeData();
  }, [employeeId, router]);

  if (loading) {
    return <div className="p-4">Loading employee details...</div>;
  }

  if (!employee) {
    return <div className="p-4">Employee data could not be loaded.</div>;
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
