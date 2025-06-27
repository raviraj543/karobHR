
"use client";

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase/firebase'; // Corrected import
import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
  query,
  where,
  writeBatch,
  // Firestore, // No longer needed
} from 'firebase/firestore';
import { useAuth } from '@/hooks/useAuth';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Category, Link as LinkType } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { X, Globe, Link as LinkIcon, Trash2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';

const LinksPage = () => {
  // const [db, setDb] = useState<Firestore | null>(null); // Removed this state
  const { user, loading } = useAuth();
  const [links, setLinks] = useState<LinkType[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [newLink, setNewLink] = useState({ url: '', title: '', description: '', categoryId: '' });
  const [newCategory, setNewCategory] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  
  // Removed the useEffect that was calling getFirebaseInstances and setting db state
  
  useEffect(() => {
    if (user && user.id && db) {
      fetchCategories();
      fetchLinks();
    }
  }, [user, selectedCategory]); // Removed db from dependency array as it's directly imported

  const fetchCategories = async () => {
    if (!user || !user.id || !db) return;
    const q = query(collection(db, 'categories'), where('userId', '==', user.id));
    const querySnapshot = await getDocs(q);
    const userCategories = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Category));
    setCategories(userCategories);
  };

  const fetchLinks = async () => {
    if (!user || !user.id || !db) return;
    let linksQuery = query(collection(db, 'links'), where('userId', '==', user.id));
    if (selectedCategory) {
      linksQuery = query(linksQuery, where('categoryId', '==', selectedCategory));
    }
    const querySnapshot = await getDocs(linksQuery);
    const userLinks = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as LinkType));
    setLinks(userLinks);
  };

  const handleAddCategory = async () => {
    if (!user || !user.id || !newCategory.trim() || !db) {
      console.error("Pre-condition failed for adding category.");
      return;
    }
  
    try {
      await addDoc(collection(db, 'categories'), { name: newCategory, userId: user.id });
      setNewCategory('');
      fetchCategories();
    } catch (error) {
      console.error("Error adding category: ", error);
    }
  };

  const handleDeleteCategory = async (categoryId: string) => {
    if (!db || !user || !user.id) return;

    try {
        const batch = writeBatch(db);

        const linksQuery = query(collection(db, 'links'), where('userId', '==', user.id), where('categoryId', '==', categoryId));
        const linksSnapshot = await getDocs(linksQuery);
        linksSnapshot.forEach(doc => {
            batch.delete(doc.ref);
        });

        const categoryRef = doc(db, 'categories', categoryId);
        batch.delete(categoryRef);

        await batch.commit();

        if (selectedCategory === categoryId) {
            setSelectedCategory(null);
        }
        
        fetchCategories();
        fetchLinks();

    } catch (error) {
        console.error("Error deleting category and its links: ", error);
    }
  };

  const handleAddLink = async () => {
    if (!user || !user.id || !newLink.url.trim() || !newLink.title.trim() || !newLink.categoryId || !db) return;
    await addDoc(collection(db, 'links'), { ...newLink, userId: user.id });
    setNewLink({ url: '', title: '', description: '', categoryId: '' });
    fetchLinks();
  };

  const handleDeleteLink = async (linkId: string) => {
    if(!db) return
    await deleteDoc(doc(db, 'links', linkId));
    fetchLinks();
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
    return <div className="p-4">Please log in to manage your links.</div>;
  }

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Link Management</h1>

      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-2">Categories</h2>
        <div className="flex gap-2 mb-2">
          <Input
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
            placeholder="New category name"
          />
          <Button onClick={handleAddCategory}>Add Category</Button>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant={!selectedCategory ? 'default' : 'outline'} onClick={() => setSelectedCategory(null)}>All</Button>
          {categories.map((category) => (
            <div key={category.id} className="flex items-center gap-1 rounded-md border bg-secondary">
                <Button
                    variant='ghost'
                    className={`rounded-r-none ${selectedCategory === category.id ? 'bg-primary text-primary-foreground' : ''}`}
                    onClick={() => setSelectedCategory(category.id)}
                >
                    {category.name}
                </Button>
                <AlertDialog>
                    <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className='rounded-l-none'>
                            <X className='h-4 w-4'/>
                        </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will permanently delete the category and all links within it. This action cannot be undone.
                        </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleDeleteCategory(category.id)}>Delete</AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h2 className="text-xl font-semibold mb-2">Links</h2>
        <Dialog>
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
              <Select onValueChange={(value) => setNewLink({ ...newLink, categoryId: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={handleAddLink}>Add Link</Button>
            </div>
          </DialogContent>
        </Dialog>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
          {links.map((link) => (
            <Card key={link.id} className="flex flex-col">
              <CardHeader>
                  <CardTitle className="flex items-center gap-2">
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
    </div>
  );
};

export default LinksPage;
