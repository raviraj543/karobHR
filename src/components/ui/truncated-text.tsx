
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose
} from '@/components/ui/dialog';
import { ScrollArea } from './scroll-area';

interface TruncatedTextProps {
  text: string;
  wordLimit?: number;
}

export function TruncatedText({ text, wordLimit = 4 }: TruncatedTextProps) {
  const words = text.split(' ');
  const isTruncated = words.length > wordLimit;
  const truncatedText = isTruncated ? words.slice(0, wordLimit).join(' ') + '...' : text;

  if (!isTruncated) {
    return <span>{text}</span>;
  }

  return (
    <div className="flex items-center gap-2">
      <span>{truncatedText}</span>
      <Dialog>
        <DialogTrigger asChild>
          <Button variant="link" size="sm" className="p-0 h-auto self-start">
            See More
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Full Text</DialogTitle>
          </DialogHeader>
          <ScrollArea className="h-48 my-4">
             <div className="whitespace-pre-wrap p-1">{text}</div>
          </ScrollArea>
           <DialogClose asChild>
             <Button type="button" variant="secondary">Close</Button>
           </DialogClose>
        </DialogContent>
      </Dialog>
    </div>
  );
}
