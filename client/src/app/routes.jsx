/**
 * Unified routing definitions for A4 POS tabs navigation.
 */
export const ROUTES = {
  ADMIN: {
    DASHBOARD: 'adminDashboard',
    USERS: 'users',
    CATEGORIES: 'categories',
    PRICE_TIERS: 'priceTiers',
    PRODUCTS: 'products',
    INVENTORY: 'inventory',
    PAYMENTS: 'payments',
    CUSTOMERS: 'customers',
    POS: 'pos',
    RECEIPTS: 'receipts',
    PREORDERS: 'adminPreorders',
    SHIFTS: 'adminShifts',
    REPORTS: 'adminReports',
    LOGS: 'logs'
  },
  CASHIER: {
    POS: 'pos',
    RECEIPTS: 'receipts',
    SHIFT_SUMMARY: 'shiftSummary'
  }
};

export default ROUTES;
