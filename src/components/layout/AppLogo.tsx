
import { Briefcase } from 'lucide-react';

export function AppLogo({ collapsed }: { collapsed?: boolean }) {
  return (
    <div className="flex items-center gap-2 px-2" aria-label="KarobHR Home">
      <Briefcase className="h-7 w-7 text-primary" />
      {!collapsed && <h1 className="text-xl font-bold text-primary">KarobHR</h1>}
    </div>
  );
}
