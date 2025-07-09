// @ts-nocheck

import EmployeeDetailsClient from '@/components/employees/EmployeeDetailsClient';

// generateStaticParams has been definitively removed to resolve persistent build typing conflict.
// This page is now purely dynamic (SSR) and data fetching happens client-side.

// Main Page Component for the Employee Detail Page
export default function EmployeeDetailPage({ params }: { params: { employeeId: string } }) {
  const { employeeId } = params;

  // Initial data will be null/empty, and the client component will fetch it.
  const initialEmployeeData = null;
  const initialHolidays = [];
  const initialCompanySettings = null;

  return (
    <EmployeeDetailsClient 
      initialEmployeeData={initialEmployeeData} 
      initialHolidays={initialHolidays}
      initialCompanySettings={initialCompanySettings}
      employeeId={employeeId} // Pass employeeId to client component for fetching
    />
  );
} // Forced re-build marker: {{DATE_TIME}}
