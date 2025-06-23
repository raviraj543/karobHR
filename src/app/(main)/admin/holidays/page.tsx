
'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import type { Holiday } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { PlusCircle, Trash2, Edit, Loader2 } from 'lucide-react';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { collection, onSnapshot, query, Timestamp, addDoc } from 'firebase/firestore';
import { getFirebaseInstances } from '@/lib/firebase/firebase';
import { format, startOfYear, endOfYear, eachDayOfInterval, isSunday } from 'date-fns';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";


const holidaySchema = z.object({
  name: z.string().min(3, "Name must be at least 3 characters."),
  date: z.string().refine(d => !isNaN(Date.parse(d)), "Invalid date"),
});

type HolidayFormValues = z.infer<typeof holidaySchema>;

export default function HolidaysPage() {
  const { companyId, deleteHoliday, loading } = useAuth();
  const { toast } = useToast();
  const [customHolidays, setCustomHolidays] = useState<Holiday[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  const form = useForm<HolidayFormValues>({
    resolver: zodResolver(holidaySchema),
    defaultValues: { name: '', date: '' }
  });

  useEffect(() => {
    if (!companyId) return;

    const { db } = getFirebaseInstances();
    const q = query(collection(db, `companies/${companyId}/holidays`));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedHolidays: Holiday[] = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          name: data.name,
          date: (data.date as Timestamp).toDate(),
          status: data.status || 'approved',
          isDefault: data.isDefault || false
        };
      });
      setCustomHolidays(fetchedHolidays);
    });

    return () => unsubscribe();
  }, [companyId]);
  
  const allHolidays = useMemo(() => {
    const year = new Date().getFullYear();
    const yearStart = startOfYear(new Date(year, 0, 1));
    const yearEnd = endOfYear(new Date(year, 0, 1));
    const days = eachDayOfInterval({ start: yearStart, end: yearEnd });
    
    const sundays: Holiday[] = days
      .filter(day => isSunday(day))
      .map((sunday, index) => ({
        id: `sunday-${year}-${index}`,
        name: 'Sunday',
        date: sunday,
        status: 'approved',
        isDefault: true,
      }));

    // Combine and remove duplicates, giving precedence to custom holidays
    const all = [...customHolidays, ...sundays];
    const uniqueHolidays = all.reduce<Record<string, Holiday>>((acc, holiday) => {
        const dateString = format(holiday.date, 'yyyy-MM-dd');
        if (!acc[dateString] || !holiday.isDefault) {
            acc[dateString] = holiday;
        }
        return acc;
    }, {});

    return Object.values(uniqueHolidays).sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [customHolidays]);


  const handleDelete = async (holiday: Holiday) => {
     if (holiday.isDefault) {
       toast({
         title: "Cannot Delete Default Holiday",
         description: "Default holidays like Sundays are automatic and cannot be deleted.",
         variant: "default"
       });
       return;
     }
    try {
      await deleteHoliday(holiday.id);
      toast({ title: "Holiday Deleted", description: `Successfully deleted ${holiday.name}.` });
    } catch (error) {
      toast({ title: "Error", description: "Could not delete holiday.", variant: "destructive" });
    }
  };

  const onSubmit: SubmitHandler<HolidayFormValues> = async (data) => {
    if (!companyId) return;
    setIsSubmitting(true);
    try {
      const { db } = getFirebaseInstances();
      await addDoc(collection(db, `companies/${companyId}/holidays`), {
        name: data.name,
        date: Timestamp.fromDate(new Date(data.date)),
        status: 'approved',
        isDefault: false,
      });
      toast({ title: 'Holiday Added', description: `${data.name} has been added.` });
      setIsModalOpen(false);
      form.reset();
    } catch (error) {
      toast({ title: 'Error', description: 'Could not save holiday.', variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Holiday Management</h1>
        <Button onClick={() => setIsModalOpen(true)}><PlusCircle className="mr-2 h-4 w-4"/>Add New Holiday</Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Upcoming Holidays</CardTitle>
          <CardDescription>List of scheduled holidays. All holidays added are automatically approved as paid. Sundays are included by default.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Holiday Name</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={3} className="text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto"/></TableCell></TableRow>
              ) : allHolidays.length > 0 ? (
                allHolidays.map((holiday) => (
                  <TableRow key={holiday.id} className={holiday.isDefault ? 'bg-muted/50' : ''}>
                    <TableCell className="font-medium">{holiday.name}</TableCell>
                    <TableCell>{format(holiday.date, 'PPP')}</TableCell>
                    <TableCell className="text-right space-x-2">
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                           <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive-foreground" disabled={holiday.isDefault}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This action cannot be undone. This will permanently delete the holiday
                              <strong className="mx-1">{holiday.name}</strong>.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDelete(holiday)}>Delete</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow><TableCell colSpan={3} className="text-center">No holidays found.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Holiday</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
               <FormField control={form.control} name="name" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Holiday Name</FormLabel>
                    <FormControl><Input {...field} placeholder="e.g., New Year's Day" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}/>
                 <FormField control={form.control} name="date" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date</FormLabel>
                    <FormControl><Input type="date" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}/>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                  Add Holiday
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
