
'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Languages, Palette, Bell } from 'lucide-react';
import type { Metadata } from 'next';

// export const metadata: Metadata = { // Not used in client component
//   title: 'My Settings - KarobHR',
//   description: 'Manage your application settings.',
// };

export default function UserSettingsPage() {
  const [selectedLanguage, setSelectedLanguage] = useState<string>('en');
  const { toast } = useToast();

  useEffect(() => {
    document.title = 'My Settings - KarobHR';
    // In a real app, you might load the user's saved language preference here
    const savedLang = localStorage.getItem('karobhr-lang-pref');
    if (savedLang) {
      setSelectedLanguage(savedLang);
    }
  }, []);

  const handleLanguageChange = (lang: string) => {
    setSelectedLanguage(lang);
    localStorage.setItem('karobhr-lang-pref', lang);
    toast({
      title: 'Language Preference Updated (Mock)',
      description: `Language set to ${lang === 'en' ? 'English' : 'Hindi (हिन्दी)'}. Full UI translation is not implemented in this prototype.`,
    });
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">My Settings</h1>
        <p className="text-muted-foreground">Manage your application preferences.</p>
      </div>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center"><Languages className="mr-2 h-5 w-5 text-primary" />Language</CardTitle>
          <CardDescription>Choose your preferred language for the application.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="language-select">Select Language</Label>
            <Select value={selectedLanguage} onValueChange={handleLanguageChange}>
              <SelectTrigger id="language-select" className="w-full sm:w-[280px]">
                <SelectValue placeholder="Select language" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="hi">Hindi - हिन्दी (Mock)</SelectItem>
              </SelectContent>
            </Select>
          </div>
           <p className="text-xs text-muted-foreground">
            Note: This is a mock setting. The application UI will not actually change language in this prototype.
          </p>
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center"><Palette className="mr-2 h-5 w-5 text-primary" />Appearance</CardTitle>
          <CardDescription>Customize the look and feel (currently unavailable).</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Theme customization options will be available here in a future update.</p>
        </CardContent>
      </Card>
      
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center"><Bell className="mr-2 h-5 w-5 text-primary" />Notifications</CardTitle>
          <CardDescription>Manage your notification preferences (currently unavailable).</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Notification settings will be available here in a future update.</p>
        </CardContent>
      </Card>
    </div>
  );
}
