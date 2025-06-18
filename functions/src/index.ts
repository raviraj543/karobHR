
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

admin.initializeApp();

const db = admin.firestore();

// Function to send notification on new announcement
export const onNewAnnouncement = functions.firestore
    .document('companies/{companyId}/announcements/{announcementId}')
    .onCreate(async (snap, context) => {
        const announcement = snap.data();
        if (!announcement) {
            console.log('No data associated with the event');
            return;
        }

        const { companyId } = context.params;
        const { title, content, postedByName } = announcement;

        const payload = {
            notification: {
                title: `New Announcement from ${postedByName}`,
                body: title,
                click_action: `/` 
            }
        };

        const usersSnapshot = await db.collection('users').where('companyId', '==', companyId).get();
        const tokens = usersSnapshot.docs.map(doc => doc.data().fcmToken).filter(token => token);

        if (tokens.length > 0) {
            return admin.messaging().sendToDevice(tokens, payload);
        }
        return;
    });

// Function to send notification when a task is assigned
export const onTaskAssigned = functions.firestore
    .document('companies/{companyId}/tasks/{taskId}')
    .onCreate(async (snap, context) => {
        const task = snap.data();
        if (!task) {
            console.log('No data associated with the event');
            return;
        }

        const { title, assigneeId } = task;
        if (!assigneeId) {
            return;
        }

        const payload = {
            notification: {
                title: 'New Task Assigned',
                body: `You have been assigned a new task: ${title}`,
                click_action: `/tasks`
            }
        };

        const userSnapshot = await db.collection('users').where('employeeId', '==', assigneeId).get();
        const tokens = userSnapshot.docs.map(doc => doc.data().fcmToken).filter(token => token);
        
        if (tokens.length > 0) {
            return admin.messaging().sendToDevice(tokens, payload);
        }
        return;
    });

// Function to send notification on new leave application
export const onNewLeaveApplication = functions.firestore
    .document('companies/{companyId}/leaveApplications/{leaveId}')
    .onCreate(async (snap, context) => {
        const leaveApp = snap.data();
        if (!leaveApp) {
            return;
        }

        const { companyId } = context.params;
        const { employeeId } = leaveApp;

        const payload = {
            notification: {
                title: 'New Leave Application',
                body: `A new leave application has been submitted by ${employeeId}.`,
                click_action: `/admin/leave-approvals`
            }
        };

        const adminsSnapshot = await db.collection('users').where('companyId', '==', companyId).where('role', '==', 'admin').get();
        const tokens = adminsSnapshot.docs.map(doc => doc.data().fcmToken).filter(token => token);
        
        if (tokens.length > 0) {
            return admin.messaging().sendToDevice(tokens, payload);
        }
        return;
    });
    
// Function to send notification on new advance application
export const onNewAdvanceApplication = functions.firestore
    .document('companies/{companyId}/advances/{advanceId}')
    .onCreate(async (snap, context) => {
        const advanceApp = snap.data();
        if (!advanceApp) {
            return;
        }
        
        const { companyId } = context.params;
        const { employeeId, amount } = advanceApp;

        const payload = {
            notification: {
                title: 'New Advance Application',
                body: `A new advance application for ₹${amount} has been submitted by ${employeeId}.`,
                click_action: `/admin/advances`
            }
        };

        const adminsSnapshot = await db.collection('users').where('companyId', '==', companyId).where('role', '==', 'admin').get();
        const tokens = adminsSnapshot.docs.map(doc => doc.data().fcmToken).filter(token => token);
        
        if (tokens.length > 0) {
            return admin.messaging().sendToDevice(tokens, payload);
        }
        return;
    });
