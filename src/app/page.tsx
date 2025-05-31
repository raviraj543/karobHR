
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { Skeleton } from '@/components/ui/skeleton';

export default function HomePage() {
  const { user, role, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (user) {
        if (role === 'admin') {
          router.replace('/admin/dashboard');
        } else if (role === 'manager' || role === 'employee') { // Manager and Employee go to the same dashboard
          router.replace('/dashboard');
        } else {
           router.replace('/login'); // Fallback if role is somehow null but user exists
        }
      } else {
        router.replace('/login');
      }
    }
  }, [user, role, loading, router]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-background">
        <div className="space-y-4 w-full max-w-md">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-8 w-1/2" />
        </div>
      </div>
    );
  }

  return null; // Or a loading spinner, but redirection should be fast
}
