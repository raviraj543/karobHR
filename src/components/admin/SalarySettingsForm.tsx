
'use client';

import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useToast } from '@/hooks/use-toast';
import { Settings } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { SalaryCalculationMode } from '@/lib/types';

export function SalarySettingsForm() {
    const { companySettings, updateCompanySettings, loading: authLoading } = useAuth();
    const { toast } = useToast();
    const [selectedMode, setSelectedMode] = useState<SalaryCalculationMode | undefined>(companySettings?.salaryCalculationMode);

    useEffect(() => {
        // Update local state when companySettings from context changes
        setSelectedMode(companySettings?.salaryCalculationMode);
    }, [companySettings?.salaryCalculationMode]);

    const handleModeChange = async (value: string) => {
        const newMode = value as SalaryCalculationMode;
        setSelectedMode(newMode); // Optimistic update
        try {
            await updateCompanySettings({ salaryCalculationMode: newMode });
            toast({
                title: "Salary Calculation Mode Updated",
                description: `Payroll will now be calculated using the ${newMode.replace('_', ' ')} method.`,
            });
        } catch (error: any) {
            toast({
                title: "Failed to Update Setting",
                description: error.message || "Could not save payroll calculation mode.",
                variant: "destructive",
            });
             // Revert optimistic update on error
            setSelectedMode(companySettings?.salaryCalculationMode);
        }
    };

    // Show loading or a message if settings are not loaded yet
    if (authLoading || companySettings === null) {
        return (
             <Card className="shadow-lg">
                <CardHeader>
                    <CardTitle className="flex items-center"><Settings className="mr-2 h-5 w-5 text-primary" />Salary Calculation</CardTitle>
                    <CardDescription>Configure how employee salaries are calculated.</CardDescription>
                </CardHeader>
                <CardContent>
                   <p className="text-muted-foreground">Loading salary settings...</p>
                </CardContent>
             </Card>
        );
    }

    return (
         <Card className="shadow-lg">
            <CardHeader>
                <CardTitle className="flex items-center"><Settings className="mr-2 h-5 w-5 text-primary" />Salary Calculation</CardTitle>
                <CardDescription>Configure how employee salaries are calculated.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <Label className="text-base">Select Calculation Mode:</Label>
                <RadioGroup
                    value={selectedMode}
                    onValueChange={handleModeChange}
                    disabled={authLoading} // Disable while updating
                >
                    <div className="flex items-center space-x-2">
                        <RadioGroupItem value="hourly_deduction" id="hourly_deduction" />
                        <Label htmlFor="hourly_deduction">Hourly Deduction (Based on actual hours worked vs standard hours)</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                        <RadioGroupItem value="check_in_out" id="check_in_out" />
                        <Label htmlFor="check_in_out">Check-in/Checkout Based Full-Day (Full day pay if checked in and out)</Label>
                    </div>
                </RadioGroup>
            </CardContent>
        </Card>
    );
}
