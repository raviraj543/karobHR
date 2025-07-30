
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { startOfYesterday, endOfYesterday } from 'date-fns';

// Initialize Firebase Admin SDK
try {
  admin.initializeApp();
} catch (e) {
  // You may see this warning in the logs if the app is already initialized
}

const db = admin.firestore();

export const autoCheckout = functions.pubsub.schedule('every 24 hours').onRun(async (context) => {
    const yesterday = startOfYesterday();
    const startOfYesterdayTimestamp = admin.firestore.Timestamp.fromDate(yesterday);
    const endOfYesterdayTimestamp = admin.firestore.Timestamp.fromDate(endOfYesterday());

    const companiesSnapshot = await db.collection('companies').get();

    for (const companyDoc of companiesSnapshot.docs) {
        const companyId = companyDoc.id;
        
        const attendanceLogRef = db.collection(`companies/${companyId}/attendanceLog`);

        const checkInsToProcess = await attendanceLogRef
            .where('status', '==', 'Checked In')
            .where('checkInTime', '>=', startOfYesterdayTimestamp)
            .where('checkInTime', '<=', endOfYesterdayTimestamp)
            .get();

        if (checkInsToProcess.empty) {
            console.log(`No overdue check-ins for company ${companyId}.`);
            continue;
        }

        const batch = db.batch();

        for (const doc of checkInsToProcess.docs) {
            const checkInData = doc.data();
            const employeeId = checkInData.employeeId;

            // Find the corresponding user to get their standard daily hours
            const userQuerySnapshot = await db.collection('users').where('employeeId', '==', employeeId).limit(1).get();
            
            if (userQuerySnapshot.empty) {
                console.warn(`Could not find user for employeeId: ${employeeId} in company ${companyId}. Skipping auto-checkout.`);
                continue;
            }
            
            const userData = userQuerySnapshot.docs[0].data();
            const standardDailyHours = userData.standardDailyHours || 8; // Default to 8 if not set

            const checkInTime = (checkInData.checkInTime as admin.firestore.Timestamp).toDate();
            
            // Calculate checkout time based on standard hours
            const checkOutTime = new Date(checkInTime.getTime() + standardDailyHours * 60 * 60 * 1000);

            batch.update(doc.ref, {
                status: 'Checked Out',
                checkOutTime: admin.firestore.Timestamp.fromDate(checkOutTime),
                totalHours: standardDailyHours,
                workReport: 'System auto-checkout: Employee did not perform checkout.',
            });
             console.log(`Scheduled auto-checkout for employee ${employeeId} in company ${companyId}.`);
        }
        await batch.commit();
        console.log(`Auto-checkout batch committed for company ${companyId}.`);
    }
    return null;
});
