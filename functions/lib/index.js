"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.autoCheckout = void 0;
const admin = require("firebase-admin");
admin.initializeApp();
// Export the auto-checkout function
var auto_checkout_1 = require("./auto-checkout");
Object.defineProperty(exports, "autoCheckout", { enumerable: true, get: function () { return auto_checkout_1.autoCheckout; } });
//# sourceMappingURL=index.js.map