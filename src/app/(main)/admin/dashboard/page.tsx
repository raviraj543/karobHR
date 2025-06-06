
'use client'; // Required for useState, useEffect, useAuth

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Users, ListChecks, CalendarOff, Settings, BarChart3, Activity, Megaphone, Send } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth'; // Import useAuth
import { useToast } from '@/hooks/use-toast'; // Import useToast
import type { Announcement } from '@/lib/types'; // Import Announcement type
import { ScrollArea } from '@/components/ui/scroll-area';


// Metadata cannot be exported from client components directly.
// export const metadata: Metadata = {
//   title: 'Admin Dashboard - KarobHR',
//   description: 'Manage your organization with KarobHR.',
// };

const adminStats = [
  { title: "Total Employees", value: "75", icon: Users, link: "/admin/employees" }, // Value will be dynamic
  { title: "Pending Leave Approvals", value: "5", icon: CalendarOff, link: "/admin/leave-approvals" },
  { title: "Tasks In Progress", value: "23", icon: ListChecks, link: "/admin/tasks" },
  { title: "System Health", value: "Optimal", icon: Activity, color: "text-green-500" },
];

export default function AdminDashboardPage() {
  const { allUsers, announcements, addAnnouncement, user } = useAuth(); // Get announcements and addAnnouncement
  const { toast } = useToast();
  const [announcementTitle, setAnnouncementTitle] = useState('');
  const [announcementContent, setAnnouncementContent] = useState('');
  const [isPostingAnnouncement, setIsPostingAnnouncement] = useState(false);

  useEffect(() => {
    document.title = 'Admin Dashboard - KarobHR';
  }, []);

  const totalEmployees = allUsers.filter(u => u.role === 'employee' || u.role === 'manager').length;
  adminStats[0].value = totalEmployees.toString(); // Update dynamic stat

  const handlePostAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!announcementTitle.trim() || !announcementContent.trim()) {
      toast({
        title: "Missing Information",
        description: "Please provide both a title and content for the announcement.",
        variant: "destructive",
      });
      return;
    }
    setIsPostingAnnouncement(true);
    try {
      await addAnnouncement(announcementTitle, announcementContent);
      toast({
        title: "Announcement Posted!",
        description: "Your announcement is now visible to all employees.",
      });
      setAnnouncementTitle('');
      setAnnouncementContent('');
    } catch (error) {
      toast({
        title: "Error Posting Announcement",
        description: (error as Error).message || "Could not post the announcement.",
        variant: "destructive",
      });
    } finally {
      setIsPostingAnnouncement(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Admin Dashboard</h1>
          <p className="text-muted-foreground">Overview of company operations and quick actions.</p>
        </div>
         <Link href="/admin/settings" passHref>
           <Button variant="outline">
             <Settings className="mr-2 h-4 w-4" />
             Company Settings
           </Button>
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {adminStats.map((stat) => (
          <Card key={stat.title} className="shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
              <stat.icon className={`h-5 w-5 text-muted-foreground ${stat.color || ''}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              {stat.link ? (
                <Link href={stat.link} className="text-xs text-muted-foreground hover:text-primary transition-colors">
                  Manage &rarr;
                </Link>
              ) : (
                 <span className="text-xs text-muted-foreground">&nbsp;</span>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>Recent Employee Activity</CardTitle>
            <CardDescription>Overview of recent check-ins, task updates, and leave requests.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">Employee activity data will be shown here.</p>
            <div className="mt-4 h-64 bg-muted rounded-md flex items-center justify-center border" data-ai-hint="bar chart employee activity">
                <BarChart3 className="h-16 w-16 text-muted-foreground/50"/>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>Quick Links</CardTitle>
            <CardDescription>Access common admin tasks quickly.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <Button variant="outline" asChild><Link href="/admin/employees/new">Add New Employee</Link></Button>
            <Button variant="outline" asChild><Link href="/admin/tasks">Assign New Task</Link></Button> {/* Changed from /admin/tasks/new */}
            <Button variant="outline" asChild><Link href="/admin/holidays">Manage Holidays</Link></Button>
            {/* <Button variant="outline" asChild><Link href="/admin/reports">Generate Reports</Link></Button> Removed this link */}
            <p className="text-sm text-muted-foreground col-span-2">Report generation coming soon.</p>

          </CardContent>
        </Card>
      </div>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center"><Megaphone className="mr-2 h-5 w-5 text-primary"/>Post Company Announcement</CardTitle>
          <CardDescription>Share important updates with all employees.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handlePostAnnouncement} className="space-y-4">
            <div>
              <Label htmlFor="announcementTitle">Title</Label>
              <Input
                id="announcementTitle"
                value={announcementTitle}
                onChange={(e) => setAnnouncementTitle(e.target.value)}
                placeholder="e.g., Upcoming Holiday Schedule"
                disabled={isPostingAnnouncement}
              />
            </div>
            <div>
              <Label htmlFor="announcementContent">Content</Label>
              <Textarea
                id="announcementContent"
                value={announcementContent}
                onChange={(e) => setAnnouncementContent(e.target.value)}
                placeholder="Enter the details of your announcement here..."
                rows={4}
                disabled={isPostingAnnouncement}
              />
            </div>
            <Button type="submit" disabled={isPostingAnnouncement}>
              {isPostingAnnouncement ? 'Posting...' : <><Send className="mr-2 h-4 w-4"/> Post Announcement</>}
            </Button>
          </form>
        </CardContent>
      </Card>
      
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>Recent Announcements</CardTitle>
          <CardDescription>A log of announcements you've posted.</CardDescription>
        </CardHeader>
        <CardContent>
          {announcements && announcements.length > 0 ? (
            <ScrollArea className="h-72 border rounded-md p-4 bg-background">
              <ul className="space-y-4">
                {announcements.map((ann) => (
                  <li key={ann.id} className="p-4 border rounded-md bg-muted/50 shadow-sm">
                    <h4 className="font-semibold text-foreground">{ann.title}</h4>
                    <p className="text-xs text-muted-foreground">
                      Posted by {ann.postedBy} on {new Date(ann.postedAt).toLocaleDateString()} at {new Date(ann.postedAt).toLocaleTimeString()}
                    </p>
                    <p className="mt-1 text-sm text-foreground whitespace-pre-wrap">{ann.content}</p>
                  </li>
                ))}
              </ul>
            </ScrollArea>
          ) : (
            <p className="text-muted-foreground">No announcements posted yet.</p>
          )}
        </CardContent>
      </Card>

       <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>Task Completion Overview</CardTitle>
            <CardDescription>Summary of task statuses across the organization.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">Task overview data will be shown here.</p>
             <div className="mt-4 h-64 bg-muted rounded-md flex items-center justify-center border" data-ai-hint="pie chart task status">
                 <BarChart3 className="h-16 w-16 text-muted-foreground/50"/>
            </div>
          </CardContent>
        </Card>
    </div>
  );
}
