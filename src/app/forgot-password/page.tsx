'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';
import { Mail, ArrowLeft } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
// import { useAuth } from '@/hooks/useAuth'; // If using Firebase password reset

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const { toast } = useToast();
  // const { resetPassword } = useAuth(); // Assuming this exists in your AuthContext

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage('');
    try {
      // await resetPassword(email); // Firebase reset password call
      // Mock success for now
      setTimeout(() => {
        setMessage(`If an account exists for ${email}, a password reset link has been sent.`);
        toast({
            title: "Password Reset Email Sent",
            description: `Check your inbox at ${email} for instructions.`,
        });
        setIsLoading(false);
      }, 1500);
    } catch (error) {
      console.error('Password reset failed:', error);
      setMessage('Failed to send password reset email. Please try again.');
      toast({
        title: "Error",
        description: "Failed to send password reset email.",
        variant: "destructive",
      });
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-background to-muted p-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
             <Mail className="w-12 h-12 text-primary" />
            </div>
          <CardTitle className="text-3xl font-bold">Forgot Password?</CardTitle>
          <CardDescription>Enter your email address and we'll send you a link to reset your password.</CardDescription>
        </CardHeader>
        <CardContent>
          {message ? (
            <div className="p-4 text-center bg-green-100 border border-green-300 text-green-700 rounded-md">
              {message}
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? 'Sending...' : 'Send Reset Link'}
              </Button>
            </form>
          )}
          <div className="mt-6 text-center">
            <Link href="/login" legacyBehavior>
              <a className="text-sm text-primary hover:underline inline-flex items-center">
                <ArrowLeft className="mr-1 h-4 w-4" /> Back to Login
              </a>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
