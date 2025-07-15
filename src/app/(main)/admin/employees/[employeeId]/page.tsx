// @ts-nocheck
'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { collection, query, where, getDocs, onSnapshot, orderBy, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase/firebase';
import { Employee, LeaveRequest, Advance, Task, AttendanceEvent, Holiday, CompanySettings } from '@/lib/app-types.ts';
import EmployeeDetailsClient from '@/components/employees/EmployeeDetailsClient';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { Loader2 } from 'lucide-react';

export default function EmployeeDetailPage() {
  const router = useRouter();
  const params = useParams();
  const { employeeId } = params;
  const { companyId } = useAuth();
  const { toast } = useToast();

  const [employee, setEmployee] = useState<Employee | null>(null);
  const [employeeTasks, setEmployeeTasks] = useState<Task[]>([]);
  const [employeeAttendance, setEmployeeAttendance] = useState<AttendanceEvent[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [companySettings, setCompanySettings] = useState<CompanySettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [unsubscribers, setUnsubscribers] = useState<(() => void)[]>([]);

  useEffect(() => {
    if (!employeeId || !companyId) {
      if (!employeeId) {
        toast({ title: 'Error', description: 'Employee ID is missing from the URL.', variant: 'destructive' });
        router.push('/admin/employees');
      }
      return;
    }

    const fetchInitialData = async () => {
      try {
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where("employeeId", "==", employeeId), where("companyId", "==", companyId));
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
          const docSnap = querySnapshot.docs[0];
          const employeeData = { id: docSnap.id, ...docSnap.data() } as Employee;
          setEmployee(employeeData);
          
          const subs: (() => void)[] = [];

          // Now set up listeners
          const tasksQuery = query(collection(db, `companies/${companyId}/tasks`), where('assigneeId', '==', employeeId), orderBy('dueDate', 'desc'));
          subs.push(onSnapshot(tasksQuery, (snapshot) => {
            setEmployeeTasks(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Task)));
          }));

          const attendanceQuery = query(collection(db, `companies/${companyId}/attendanceLog`), where('employeeId', '==', employeeData.employeeId), orderBy('timestamp', 'desc'));
           subs.push(onSnapshot(attendanceQuery, (snapshot) => {
            setEmployeeAttendance(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as AttendanceEvent)));
          }));

          const holidaysQuery = query(collection(db, `companies/${companyId}/holidays`));
          subs.push(onSnapshot(holidaysQuery, (snapshot) => {
            setHolidays(snapshot.docs.map(doc => ({...doc.data(), id: doc.id, date: doc.data().date.toDate() } as Holiday)));
          }));
          
          const companySettingsRef = doc(db, `companies/${companyId}`);
          subs.push(onSnapshot(companySettingsRef, (doc) => {
             setCompanySettings(doc.data() as CompanySettings);
          }));
          
          setUnsubscribers(subs);
          setLoading(false);

        } else {
          toast({ title: 'Error', description: 'Employee not found in the database.', variant: 'destructive' });
          router.push('/admin/employees');
          setLoading(false);
        }
      } catch (error) {
        console.error('Error fetching employee:', error);
        toast({ title: 'Error fetching data', description: 'Could not fetch employee details.', variant: 'destructive' });
        setLoading(false);
      }
    };

    fetchInitialData();

    return () => {
      unsubscribers.forEach(unsub => unsub());
    }
  }, [employeeId, companyId, router, toast]);

  if (loading) {
    return (
        <div className="flex flex-col items-center justify-center min-h-[calc(100vh-8rem)] p-4 text-center">
            <Loader2 className="h-8 w-8 text-primary animate-spin mb-4" />
            <p className="text-muted-foreground">Loading employee details...</p>
        </div>
    );
  }

  if (!employee) {
    return <div className="p-4 text-center text-destructive">Employee data could not be loaded. You may be redirected shortly.</div>;
  }
  
  const initialData = {
      employee: employee,
      employeeAttendance: employeeAttendance,
      employeeTasks: employeeTasks,
  };

  return (
    <div className="flex flex-col flex-1">
      <EmployeeDetailsClient
        initialEmployeeData={initialData}
        initialHolidays={holidays}
        initialCompanySettings={companySettings}
      />
    </div>
  );
}
