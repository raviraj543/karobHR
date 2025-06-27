
'use client';

import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar } from '@/components/ui/calendar';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { PlusCircle, Edit2, Trash2, CalendarDays as CalendarDaysIcon, CheckCircle, Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import type { Holiday } from '@/lib/types';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSunday, isPast } from 'date-fns';
import { Badge } from '@/components/ui/badge';

export default function AdminHolidaysPage() {
  const { holidays: fetchedHolidays, addHoliday, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newHolidayName, setNewHolidayName] = useState('');
  const [newHolidayDate, setNewHolidayDate] = useState<Date | undefined>(undefined);
  const [newHolidayDescription, setNewHolidayDescription] = useState('');

  const allHolidays = useMemo(() => {
    const today = new Date();
    const yearStart = startOfMonth(today); // Start from current month for Sundays
    const yearEnd = endOfMonth(today); // End of current month for Sundays
    const allDays = eachDayOfInterval({ start: yearStart, end: yearEnd });

    const sundays: Holiday[] = allDays
      .filter(day => isSunday(day))
      .map(sunday => ({
        id: `sunday-${format(sunday, 'yyyy-MM-dd')}`,
        name: 'Sunday',
        date: sunday,
        status: 'approved',
        description: 'Weekly day off',
      }));

    // Combine Sundays with fetched holidays, giving precedence to fetched holidays if dates clash
    const combined = [...sundays, ...fetchedHolidays];
    const uniqueHolidays = Array.from(new Map(combined.map(h => [format(h.date, 'yyyy-MM-dd'), h])).values());

    return uniqueHolidays.sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [fetchedHolidays]);
  
  const handleAddNewHoliday = async () => {
    if (!newHolidayName || !newHolidayDate) {
      toast({
        title: 'Missing Information',
        description: 'Please provide a name and a date for the holiday.',
        variant: 'destructive',
      });
      return;
    }

    try {
      await addHoliday({
        name: newHolidayName,
        date: newHolidayDate,
        description: newHolidayDescription,
      });
      toast({
        title: 'Holiday Added',
        description: `${newHolidayName} has been successfully added.`,
      });
      setNewHolidayName('');
      setNewHolidayDate(undefined);
      setNewHolidayDescription('');
      setIsDialogOpen(false);
    } catch (error) {
      toast({
        title: 'Error Adding Holiday',
        description: (error as Error).message,
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Holiday Management</h1>
          <p className="text-muted-foreground">Define and manage the company holiday calendar.</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <PlusCircle className="mr-2 h-4 w-4" /> Add New Holiday
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add a New Holiday</DialogTitle>
              <DialogDescription>
                This holiday will be marked as a paid day for all employees.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="name" className="text-right">Name</Label>
                <Input id="name" value={newHolidayName} onChange={(e) => setNewHolidayName(e.target.value)} className="col-span-3" placeholder="e.g., New Year's Day"/>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="date" className="text-right">Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="col-span-3 font-normal justify-start">
                      <CalendarDaysIcon className="mr-2 h-4 w-4" />
                      {newHolidayDate ? format(newHolidayDate, 'PPP') : <span>Pick a date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar mode="single" selected={newHolidayDate} onSelect={setNewHolidayDate} initialFocus/>
                  </PopoverContent>
                </Popover>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="description" className="text-right">Description</Label>
                <Textarea id="description" value={newHolidayDescription} onChange={(e) => setNewHolidayDescription(e.target.value)} className="col-span-3" placeholder="(Optional)"/>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleAddNewHoliday} disabled={authLoading}>
                {authLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Save Holiday
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1">
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center"><CalendarDaysIcon className="mr-2 h-5 w-5 text-primary" />Upcoming Holidays</CardTitle>
            <CardDescription>List of scheduled holidays. All holidays added are automatically approved as paid.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Holiday Name</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {allHolidays.map(holiday => {
                    const holidayIsPast = isPast(holiday.date, new Date());
                    const isDefaultSunday = holiday.id.startsWith('sunday-');

                    return (
                    <TableRow key={holiday.id} className={holidayIsPast ? 'opacity-50' : ''}>
                        <TableCell className="font-medium">{holiday.name}</TableCell>
                        <TableCell>{format(new Date(holiday.date), 'PPP')}</TableCell>
                        <TableCell>
                        <Badge variant={holiday.status === 'approved' ? 'default' : 'secondary'}>
                            {holiday.status.charAt(0).toUpperCase() + holiday.status.slice(1)}
                        </Badge>
                        </TableCell>
                        <TableCell className="space-x-1">
                            {isDefaultSunday || holidayIsPast ? (
                                <span className="text-xs text-muted-foreground">N/A</span>
                            ) : (
                                <>
                                    <Button variant="ghost" size="icon" className="h-8 w-8" disabled={holidayIsPast}>
                                        <Edit2 className="h-4 w-4" />
                                    </Button>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" disabled={holidayIsPast}>
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </>
                            )}
                        </TableCell>
                    </TableRow>
                    );
                })}
              </TableBody>
            </Table>
            {allHolidays.length === 0 && !authLoading && (
              <p className="text-muted-foreground text-center py-8">No holidays defined yet.</p>
            )}
            {authLoading && (
                <div className="flex justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
