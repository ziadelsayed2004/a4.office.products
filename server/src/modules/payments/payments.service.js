import db from '../../db/index.js';
import { writeAuditLog } from '../../utils/auditLogger.js';

const ALL_PAYMENT_METHODS = [
  { id: 'Cash', name_ar: 'نقدي (كاش)' },
  { id: 'Card', name_ar: 'بطاقة ائتمانية (فيزا)' },
  { id: 'InstaPay', name_ar: 'تطبيق إنستا باي (InstaPay)' },
  { id: 'Wallet', name_ar: 'محفظة إلكترونية (Wallet)' },
  { id: 'Transfer', name_ar: 'تحويل بنكي (Transfer)' }
];

/**
 * Retrieve all payment methods, indicating which ones are currently active.
 */
export async function getPaymentMethods() {
  const row = await db.get(
    "SELECT value FROM business_settings WHERE key = 'active_payment_methods';"
  );

  let activeIds = ['Cash', 'Card', 'InstaPay', 'Wallet', 'Transfer'];
  if (row) {
    try {
      activeIds = JSON.parse(row.value);
    } catch (e) {
      // Keep fallbacks if parsing fails
    }
  }

  return ALL_PAYMENT_METHODS.map(m => ({
    ...m,
    is_active: activeIds.includes(m.id)
  }));
}

/**
 * Update the list of active payment methods (Admin only).
 */
export async function updatePaymentMethods(activeIds, adminUserId) {
  if (!Array.isArray(activeIds)) {
    throw new Error('يجب توفير طرق الدفع كمصفوفة.');
  }

  // Validate that all activeIds are valid identifiers
  const validIds = ALL_PAYMENT_METHODS.map(m => m.id);
  const invalid = activeIds.filter(id => !validIds.includes(id));
  if (invalid.length > 0) {
    throw new Error(`طريقة دفع غير صالحة: ${invalid.join(', ')}`);
  }

  const jsonValue = JSON.stringify(activeIds);

  await db.run('BEGIN TRANSACTION;');
  try {
    // Insert or replace settings key
    await db.run(
      `INSERT INTO business_settings (key, value, updated_at)
       VALUES ('active_payment_methods', ?, CURRENT_TIMESTAMP)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP;`,
      [jsonValue]
    );

    // Fetch before/after values to log
    const beforeStr = JSON.stringify(validIds); // Fallback representations
    
    await writeAuditLog({
      userId: adminUserId,
      actionType: 'SETTINGS_UPDATE',
      entityType: 'settings',
      entityId: 0,
      notes: `تم تحديث طرق الدفع النشطة في النظام إلى: ${activeIds.join(', ')}`
    });

    await db.run('COMMIT;');

    return await getPaymentMethods();
  } catch (err) {
    await db.run('ROLLBACK;');
    throw err;
  }
}

/**
 * Validates a list of split payment items against an expected total sum.
 * Throws an Error if verification fails.
 */
export async function validateSplitPayments(paymentsList, expectedTotalAmount) {
  if (!Array.isArray(paymentsList) || paymentsList.length === 0) {
    throw new Error('يجب توفير عملية دفع واحدة على الأقل.');
  }

  const methods = await getPaymentMethods();
  const activeMethods = methods.filter(m => m.is_active).map(m => m.id);

  let sum = 0;
  for (const item of paymentsList) {
    if (!item.method || !activeMethods.includes(item.method)) {
      throw new Error(`طريقة الدفع (${item.method || 'فارغة'}) غير مفعلة أو غير صالحة.`);
    }

    const amt = parseInt(item.amount, 10);
    if (isNaN(amt) || amt <= 0) {
      throw new Error('مبلغ الدفع يجب أن يكون قيمة موجبة أكبر من الصفر.');
    }

    sum += amt;
  }

  if (sum !== expectedTotalAmount) {
    throw new Error(`مجموع الدفعات (${sum / 100} ج.م) لا يتطابق مع المبلغ الإجمالي المطلوب (${expectedTotalAmount / 100} ج.م).`);
  }

  return true;
}
