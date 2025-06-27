"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.autoCheckout = void 0;
const functions = require("firebase-functions");
const admin = require("firebase-admin");
const date_fns_1 = require("date-fns");
// Initialize Firebase Admin SDK
try {
    admin.initializeApp();
}
catch (e) {
    // You may see this warning in the logs if the app is already initialized
    // console.log('Firebase admin SDK already initialized.');
}
const db = admin.firestore();
exports.autoCheckout = functions.pubsub.schedule('every 24 hours').onRun(async (context) => {
    const yesterday = (0, date_fns_1.startOfYesterday)();
    const startOfYesterdayTimestamp = admin.firestore.Timestamp.fromDate(yesterday);
    const endOfYesterdayTimestamp = admin.firestore.Timestamp.fromDate((0, date_fns_1.endOfYesterday)());
    const companiesSnapshot = await db.collection('companies').get();
    for (const companyDoc of companiesSnapshot.docs) {
        const companyId = companyDoc.id;
        const companyData = companyDoc.data();
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
            const userDocRef = db.collection('users').where('employeeId', '==', employeeId).limit(1);
            const userSnapshot = await userDocRef.get();
            if (userSnapshot.empty) {
                console.warn(`Could not find user for employeeId: ${employeeId}`);
                continue;
            }
            const userData = userSnapshot.docs[0].data();
            const standardDailyHours = userData.standardDailyHours || 8;
            const checkInTime = checkInData.checkInTime.toDate();
            const checkOutTime = new Date(checkInTime.getTime() + standardDailyHours * 60 * 60 * 1000);
            batch.update(doc.ref, {
                status: 'Checked Out',
                checkOutTime: admin.firestore.Timestamp.fromDate(checkOutTime),
                totalHours: standardDailyHours,
                workReport: 'Employee did not perform checkout.',
            });
        }
        await batch.commit();
    }
    return null;
});
//# sourceMappingURL=auto-checkout.js.map