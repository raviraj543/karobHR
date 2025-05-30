import { Briefcase } from 'lucide-react';
import Link from 'next/link';

export function AppLogo({ collapsed }: { collapsed?: boolean }) {
  return (
    <Link href="/" className="flex items-center gap-2 px-2" aria-label="BizFlow Home">
      <Briefcase className="h-7 w-7 text-primary" />
      {!collapsed && <h1 className="text-xl font-bold text-primary">BizFlow</h1>}
    </Link>
  );
}
