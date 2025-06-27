
'use client';

import { useEffect } from 'react';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';
import { useAuth } from '@/hooks/useAuth';
import { firebaseApp, db } from '@/lib/firebase/firebase'; // Changed: Import firebaseApp and db directly
import { doc, updateDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';

export default function NotificationPermissionHandler() {
    const { user } = useAuth();
    const { toast } = useToast();

    useEffect(() => {
        if (typeof window !== 'undefined' && 'serviceWorker' in navigator && user) {
            // const { firebaseApp, db } = getFirebaseInstances(); // Removed this line
            const messaging = getMessaging(firebaseApp);
            const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;

            if (!vapidKey) {
                console.error('Firebase VAPID key is not set in environment variables.');
                return;
            }

            const requestPermission = async () => {
                try {
                    const permission = await Notification.requestPermission();
                    if (permission === 'granted') {
                        console.log('Notification permission granted.');
                        
                        // Get token
                        const currentToken = await getToken(messaging, { vapidKey: vapidKey });
                        
                        if (currentToken) {
                            console.log('FCM Token:', currentToken);
                            // Save the token to the user's profile in Firestore
                            const userRef = doc(db, 'users', user.id);
                            await updateDoc(userRef, {
                                fcmToken: currentToken,
                            });
                        } else {
                            console.log('No registration token available. Request permission to generate one.');
                        }
                    } else {
                        console.log('Unable to get permission to notify.');
                    }
                } catch (error) {
                    console.error('An error occurred while requesting permission or getting token. ', error);
                }
            };

            requestPermission();
            
            // Handle foreground messages
            onMessage(messaging, (payload) => {
                console.log('Message received. ', payload);
                toast({
                    title: payload.notification?.title || 'New Notification',
                    description: payload.notification?.body || '',
                });
            });
        }
    }, [user, toast]);

    return null; // This component does not render anything
}
