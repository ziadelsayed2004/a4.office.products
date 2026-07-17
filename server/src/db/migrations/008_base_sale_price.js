import crypto from 'node:crypto';

export const version = '008';
export const name = 'base_sale_price';
export const checksum = crypto
  .createHash('sha256')
  .update(`${version}:${name}:2026-07-17-v1`)
  .digest('hex');

export async function up(db) {
  const columns = await db.all('PRAGMA table_info(products);');
  if (!columns.some((column) => column.name === 'base_sale_price')) {
    await db.run(
      'ALTER TABLE products ADD COLUMN base_sale_price INTEGER NOT NULL DEFAULT 0 CHECK(base_sale_price >= 0);'
    );
  }
}
