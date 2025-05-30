import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar } from '@/components/ui/calendar'; // ShadCN calendar
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PlusCircle, Edit2, Trash2, CalendarDays as CalendarDaysIcon } from 'lucide-react';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Manage Holidays - Admin - BizFlow',
  description: 'Set up and manage company holidays.',
};

// Placeholder holiday data
const holidays = [
  { id: '1', name: 'New Year\'s Day', date: '2024-01-01', type: 'National' },
  { id: '2', name: 'Good Friday', date: '2024-03-29', type: 'National' },
  { id: '3', name: 'Summer Picnic Day', date: '2024-07-15', type: 'Company Event' },
  { id: '4', name: 'Christmas Day', date: '2024-12-25', type: 'National' },
];

export default function AdminHolidaysPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Holiday Management</h1>
          <p className="text-muted-foreground">Define and manage the company holiday calendar.</p>
        </div>
        <Button>
          <PlusCircle className="mr-2 h-4 w-4" /> Add New Holiday
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center"><CalendarDaysIcon className="mr-2 h-5 w-5 text-primary" />Upcoming Holidays</CardTitle>
              <CardDescription>List of scheduled holidays. Employees will see these in their calendars.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Holiday Name</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {holidays.map(holiday => (
                    <TableRow key={holiday.id}>
                      <TableCell className="font-medium">{holiday.name}</TableCell>
                      <TableCell>{new Date(holiday.date).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}</TableCell>
                      <TableCell>{holiday.type}</TableCell>
                      <TableCell className="space-x-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8"><Edit2 className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive"><Trash2 className="h-4 w-4" /></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {holidays.length === 0 && (
                <p className="text-muted-foreground text-center py-8">No holidays defined yet.</p>
              )}
            </CardContent>
          </Card>
        </div>
        
        <div className="lg:col-span-1">
          <Card className="shadow-sm">
            <CardHeader>
                <CardTitle>Calendar View</CardTitle>
                <CardDescription>Visualize holidays on the calendar.</CardDescription>
            </CardHeader>
            <CardContent className="flex justify-center">
                 <Calendar
                    mode="multiple" // Or "single" if just for display, "multiple" to show selected holidays
                    selected={holidays.map(h => new Date(h.date))} // Example: pre-select holidays
                    className="rounded-md border p-0"
                    classNames={{
                        months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0 p-3",
                        month: "space-y-4",
                        caption_label: "text-sm font-medium text-primary",
                        day: "h-9 w-9 p-0 font-normal aria-selected:opacity-100 rounded-md",
                        day_selected: "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
                    }}
                    disabled // Make it non-interactive for viewing
                />
            </CardContent>
          </Card>
        </div>
      </div>

      <Card className="shadow-sm">
        <CardHeader>
            <CardTitle>Add/Edit Holiday Form</CardTitle>
            <CardDescription>Use this form to add a new holiday or edit an existing one.</CardDescription>
        </CardHeader>
        <CardContent>
            {/* Placeholder for Add/Edit Holiday Form Component */}
            <div className="h-48 bg-muted rounded-md flex items-center justify-center border border-dashed" data-ai-hint="form holiday management">
                 <p className="text-muted-foreground">Holiday form will be here.</p>
            </div>
        </CardContent>
      </Card>

    </div>
  );
}
