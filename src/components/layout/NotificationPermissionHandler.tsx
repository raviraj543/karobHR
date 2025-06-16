
'use client';

import { useEffect } from 'react';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';
import { useAuth } from '@/hooks/useAuth';
import { getFirebaseInstances } from '@/lib/firebase/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';

export default function NotificationPermissionHandler() {
    const { user } = useAuth();
    const { toast } = useToast();

    useEffect(() => {
        if (typeof window !== 'undefined' && 'serviceWorker' in navigator && user) {
            const { firebaseApp, db } = getFirebaseInstances();
            const messaging = getMessaging(firebaseApp);

            const requestPermission = async () => {
                try {
                    const permission = await Notification.requestPermission();
                    if (permission === 'granted') {
                        console.log('Notification permission granted.');
                        
                        // Get token
                        const currentToken = await getToken(messaging, { vapidKey: "BAlb_eL5M1DSEVnJgC_S9Z2lq3OqO8gH1e9v6v2n2Y3m3jT8b8yL9jXpC5Zl3bYkHw8SgJ3jG_xJ2vYwGvCj4Y" });
                        
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
