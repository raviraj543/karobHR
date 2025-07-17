
'use client';

import { useEffect } from 'react';
import { getToken, onMessage } from 'firebase/messaging'; // Only import getToken and onMessage
import { useAuth } from '@/hooks/useAuth';
import { messaging, db } from '@/lib/firebase/firebase'; // Import initialized messaging and db
import { firebaseConfig } from '@/lib/firebase/config'; // Import firebaseConfig
import { doc, updateDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';

export default function NotificationPermissionHandler() {
    const { user } = useAuth();
    const { toast } = useToast();

    useEffect(() => {
        // Ensure we are in a browser environment and service worker is supported
        // And also ensure messaging is initialized
        if (typeof window !== 'undefined' && 'serviceWorker' in navigator && messaging && user) {
            const vapidKey = firebaseConfig.vapidKey; // Access vapidKey from imported config

            if (!vapidKey) {
                console.error('Firebase VAPID key is not set in firebaseConfig.ts');
                // Toast warning for user if notifications won't work
                toast({
                    title: "Notifications Disabled",
                    description: "Push notifications are not configured correctly. Please contact support.",
                    variant: "destructive",
                });
                return;
            }

            const requestPermission = async () => {
                try {
                    const permission = await Notification.requestPermission();
                    if (permission === 'granted') {
                        console.log('Notification permission granted.');
                        
                        // Get token using the imported messaging instance and vapidKey
                        // Add a check to ensure messaging is not null
                        if (messaging) {
                            const currentToken = await getToken(messaging, { vapidKey: vapidKey });
                            
                            if (currentToken) {
                                console.log('FCM Token:', currentToken);
                                // Save the token to the user's profile in Firestore
                                const userRef = doc(db, 'users', user.uid);
                                await updateDoc(userRef, {
                                    fcmToken: currentToken,
                                });
                            } else {
                                console.log('No registration token available. Request permission to generate one.');
                                toast({
                                    title: "Notification Error",
                                    description: "Could not get notification token. Please ensure your browser supports push notifications.",
                                    variant: "destructive",
                                });
                            }
                        } else {
                            console.error('Firebase Messaging is not initialized.');
                        }
                    } else {
                        console.log('Unable to get permission to notify.');
                        toast({
                            title: "Notifications Blocked",
                            description: "You have blocked notifications. Please enable them in browser settings.",
                            variant: "destructive",
                        });
                    }
                } catch (error) {
                    console.error('An error occurred while requesting permission or getting token. ', error);
                    toast({
                        title: "Notification Setup Error",
                        description: (error as Error).message || "An unexpected error occurred during notification setup.",
                        variant: "destructive",
                    });
                }
            };

            requestPermission();
            
            // Handle foreground messages
            // Add a check to ensure messaging is not null
            if (messaging) {
                onMessage(messaging, (payload) => {
                    console.log('Message received. ', payload);
                    toast({
                        title: payload.notification?.title || 'New Notification',
                        description: payload.notification?.body || '',
                    });
                });
            }
        }
    }, [user, toast]);

    return null; // This component does not render anything
}
