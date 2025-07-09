import EmployeeDetailsClient from '@/components/employees/EmployeeDetailsClient';

// This page is now a purely dynamic (SSR) route.
// generateStaticParams has been definitively removed.
// All data fetching for employee details will happen client-side within EmployeeDetailsClient.

export default function EmployeeDetailPage({ params }: { params: { employeeId: string } }) {
  const { employeeId } = params;

  // Initial data is null/empty; client component fetches it.
  const initialEmployeeData = null;
  const initialHolidays = [];
  const initialCompanySettings = null;

  return (
    <EmployeeDetailsClient 
      initialEmployeeData={initialEmployeeData} 
      initialHolidays={initialHolidays}
      initialCompanySettings={initialCompanySettings}
      employeeId={employeeId}
    />
  );
}
