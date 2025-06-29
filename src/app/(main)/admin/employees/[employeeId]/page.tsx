
import EmployeeDetailsClient from '@/components/employees/EmployeeDetailsClient';

// This function is required for Next.js static export of dynamic routes.
// For static export (output: 'export'), we'll return a dummy path.
// This ensures the build process doesn't complain about missing static params.
// Data fetching for specific employee details should happen client-side after the page mounts.
export async function generateStaticParams() {
  return [{ employeeId: 'dummy-employee-id' }];
}

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
}
