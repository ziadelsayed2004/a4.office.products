import db from '../../db/index.js';
import { previewPersistentSequence } from '../../utils/financial.js';
import { AppError } from '../../utils/errors.js';

const suffix = (value) => String(value).padStart(8, '0');

export async function getNumberPreview({ type, categoryId, role }, connection = db) {
  if (type === 'product') {
    if (role !== 'Admin') {
      throw new AppError(
        'Product identity previews are restricted to administrators.',
        403,
        'FORBIDDEN'
      );
    }
    const category = await connection.get('SELECT id, code FROM categories WHERE id = ?;', [
      categoryId,
    ]);
    if (!category) throw new AppError('Category not found.', 404, 'CATEGORY_NOT_FOUND');
    const sequence = await previewPersistentSequence(connection, 'product', category.id);
    const sku = `${category.code}-${String(sequence).padStart(6, '0')}`;
    return { type, sku, barcode: sku, isPreview: true };
  }

  if (type === 'sale') {
    const sequence = await previewPersistentSequence(connection, 'sale');
    return {
      type,
      invoiceNumber: `INV-${suffix(sequence)}`,
      receiptNumber: `REC-${suffix(sequence)}`,
      isPreview: true,
    };
  }
  if (type === 'preorder') {
    const sequence = await previewPersistentSequence(connection, 'preorder');
    return {
      type,
      preorderNumber: `PR-${suffix(sequence)}`,
      receiptNumber: `REC-PR-${suffix(sequence)}`,
      isPreview: true,
    };
  }
  if (type === 'return') {
    const sequence = await previewPersistentSequence(connection, 'return');
    return {
      type,
      returnNumber: `RTN-${suffix(sequence)}`,
      receiptNumber: `REC-RTN-${suffix(sequence)}`,
      isPreview: true,
    };
  }
  throw new AppError('Unsupported number preview type.', 400, 'INVALID_PREVIEW_TYPE');
}
