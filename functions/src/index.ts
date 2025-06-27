
import * as admin from 'firebase-admin';

admin.initializeApp();

// Export the auto-checkout function
export { autoCheckout } from './auto-checkout';
