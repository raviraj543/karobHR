
"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { db as firestoreDb } from '@/lib/firebase/firebase';
import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
  query,
  where,
  writeBatch,
} from 'firebase/firestore';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
  } from "@/components/ui/alert-dialog"
import { Link as LinkType } from '@/lib/app-types';
import { Skeleton } from '@/components/ui/skeleton';
import { Globe, Link as LinkIcon, Trash2 } from 'lucide-react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';

const LinksPage = () => {
  const { user, loading, karobUser } = useAuth();
  const { toast } = useToast();
  const [links, setLinks] = useState<LinkType[]>([]);
  const [newLink, setNewLink] = useState({ url: '', title: '', description: '' });
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  
  useEffect(() => {
    if (user && user.uid) {
      fetchLinks();
    }
  }, [user]);

  const fetchLinks = async () => {
    if (!user || !user.uid) return;
    const linksQuery = query(collection(firestoreDb, 'links'), where('userId', '==', user.uid));
    const querySnapshot = await getDocs(linksQuery);
    const userLinks = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as LinkType));
    setLinks(userLinks);
  };

  const handleAddLink = async () => {
    if (!user || !karobUser ||!newLink.url.trim() || !newLink.title.trim()) {
        toast({
            title: "Cannot Add Link",
            description: "Please fill out the URL and Title fields.",
            variant: "destructive",
        });
        return;
    }

    if (karobUser.role === 'admin') {
        try {
            const usersQuery = query(collection(firestoreDb, 'users'), where('companyId', '==', karobUser.companyId));
            const usersSnapshot = await getDocs(usersQuery);
            const batch = writeBatch(firestoreDb);
            
            usersSnapshot.forEach(userDoc => {
                const newLinkRef = doc(collection(firestoreDb, 'links'));
                batch.set(newLinkRef, { ...newLink, userId: userDoc.id });
            });

            await batch.commit();
            toast({ title: "Links Distributed", description: "This link has been added for all users in the company." });

        } catch(error) {
            console.error("Error distributing link to all users:", error);
            toast({ title: "Distribution Failed", description: "Could not add the link for all users.", variant: "destructive"});
        }
    } else {
        await addDoc(collection(firestoreDb, 'links'), { ...newLink, userId: user.uid });
        toast({ title: "Link Added", description: "Your new link has been saved."});
    }

    setNewLink({ url: '', title: '', description: '' });
    fetchLinks();
    setIsDialogOpen(false);
  };

  const handleDeleteLink = async (linkId: string) => {
    await deleteDoc(doc(firestoreDb, 'links', linkId));
    fetchLinks();
    toast({ title: "Link Deleted", description: "The link has been removed."});
  };

  if (loading) {
    return (
      <div className="p-4 space-y-4">
        <Skeleton className="h-8 w-1/4" />
        <div className="space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="p-4 text-center">
        <h2 className="text-xl font-semibold mb-4">Please Log In</h2>
        <p className="mb-4 text-muted-foreground">You need to be logged in to manage your links.</p>
        <Link href="/login" passHref>
          <Button>Go to Login</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Link Management</h1>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
                <Button>Add New Link</Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                <DialogTitle>Add a New Link</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                <Input
                    placeholder="URL"
                    value={newLink.url}
                    onChange={(e) => setNewLink({ ...newLink, url: e.target.value })}
                />
                <Input
                    placeholder="Title"
                    value={newLink.title}
                    onChange={(e) => setNewLink({ ...newLink, title: e.target.value })}
                />
                <Input
                    placeholder="Description (optional)"
                    value={newLink.description}
                    onChange={(e) => setNewLink({ ...newLink, description: e.target.value })}
                />
                <Button onClick={handleAddLink}>Add Link</Button>
                </div>
            </DialogContent>
        </Dialog>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
        {links.map((link) => (
        <Card key={link.id} className="flex flex-col">
            <CardHeader>
                <CardTitle className="flex items-center gap.tsx
[filepath]src/lib/app-types.ts
export type UserRole = 'admin' | 'manager' | 'employee' | null;

export type SalaryCalculationMode = 'hourly_deduction' | 'check_in_out';

export interface CompanySettings {
  companyId: string;
  companyName: string;
  adminUid: string;
  createdAt: string; // ISO string or Firestore Timestamp
  officeLocation?: {
    name?: string; // e-2">
                    <Globe className="h-5 w-5 text-primary"/>
                    <span className="break-words">{link.title}</span>
                </CardTitle>
            </CardHeader>
            <CardContent className="flex-grow">
                <p className="text-sm text-muted-foreground break-words">{link.description}</p>
                <div className="mt-2 flex items-center gap-2">
                <LinkIcon className="h-4 w-4 text-muted-foreground"/>
                <a href={link.url} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-500 hover:underline break-all">
                    {link.url}
                </a>
                </div>
            </CardContent>
            <CardFooter>
                <AlertDialog>
                <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="sm" className="w-full">
                        <Trash2 className="h-4 w-4 mr-2"/>
                        Delete
                    </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                    <AlertDialogHeader>
                    <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                        This will permanently delete this link. This action cannot be undone.
                    </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => handleDeleteLink(link.id)}>Delete</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
            </CardFooter>
        </Card>
        ))}
      </div>
    </div>
  );
};

export default LinksPage;
