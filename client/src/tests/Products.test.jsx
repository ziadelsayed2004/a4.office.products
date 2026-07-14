import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Products from '../pages/Products.jsx';

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
  delete: vi.fn(),
  printLabels: vi.fn(() => Promise.resolve({ printed: true })),
}));

vi.mock('../services/apiClient.js', () => ({
  api: {
    get: mocks.get,
    post: mocks.post,
    patch: mocks.patch,
    delete: mocks.delete,
  },
}));

vi.mock('../services/printService.js', () => ({
  printProductLabelsInFrame: mocks.printLabels,
}));

describe('Products barcode labels', () => {
  beforeEach(() => {
    mocks.get.mockImplementation((path) => {
      if (path === '/api/categories?activeOnly=false')
        return Promise.resolve({ data: [{ id: 2, name: 'أقلام' }] });
      if (path === '/api/admin/price-tiers?activeOnly=false')
        return Promise.resolve({ data: [{ id: 1, name: 'قطاعي', is_active: 1 }] });
      if (path === '/api/admin/printer-settings') return Promise.resolve({ data: {} });
      if (path.startsWith('/api/products?')) return Promise.resolve({ data: [] });
      return Promise.reject(new Error(`Unexpected GET ${path}`));
    });
    mocks.post.mockImplementation((path) => {
      if (path === '/api/admin/products') {
        return Promise.resolve({
          data: {
            id: 8,
            name: 'قلم أسود',
            sku: 'PEN-8',
            barcode: 'PEN-8',
          },
        });
      }
      if (path === '/api/admin/products/8/barcode-labels') {
        return Promise.resolve({
          data: {
            product: { id: 8, name: 'قلم أسود', sku: 'PEN-8' },
            barcode: 'PEN-8',
            quantity: 1,
            label_size: 'medium',
          },
        });
      }
      return Promise.reject(new Error(`Unexpected POST ${path}`));
    });
  });

  it('opens the barcode print prompt after create and uses the canonical endpoint', async () => {
    render(<Products />);
    await waitFor(() =>
      expect(mocks.get).toHaveBeenCalledWith('/api/admin/price-tiers?activeOnly=false')
    );
    fireEvent.click(screen.getByRole('button', { name: 'منتج جديد' }));
    fireEvent.change(screen.getByLabelText(/اسم المنتج/), { target: { value: 'قلم أسود' } });
    fireEvent.change(screen.getByLabelText(/رمز SKU/), { target: { value: 'PEN-8' } });
    fireEvent.change(screen.getByLabelText(/قطاعي/), { target: { value: '15.00' } });
    fireEvent.click(screen.getByRole('button', { name: 'حفظ' }));

    expect(await screen.findByText('طباعة ملصقات الباركود الآن')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'طباعة الباركود' }));
    await waitFor(() =>
      expect(mocks.post).toHaveBeenCalledWith(
        '/api/admin/products/8/barcode-labels',
        expect.objectContaining({ quantity: 1, label_size: 'medium' })
      )
    );
    expect(mocks.printLabels).toHaveBeenCalledWith(
      expect.objectContaining({ productId: 8, barcode: 'PEN-8' })
    );
  });
});
