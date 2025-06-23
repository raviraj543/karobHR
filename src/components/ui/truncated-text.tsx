
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

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
          <Button variant="link" size="sm" className="p-0 h-auto">
            See More
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Full Text</DialogTitle>
          </DialogHeader>
          <div className="py-4 whitespace-pre-wrap">{text}</div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
