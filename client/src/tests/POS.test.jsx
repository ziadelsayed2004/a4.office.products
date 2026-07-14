import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import POS from '../pages/POS.jsx';

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  loadShift: vi.fn(),
  printReceipt: vi.fn(() => Promise.resolve()),
}));

vi.mock('../services/apiClient.js', () => ({
  api: { get: mocks.get, post: mocks.post },
}));

vi.mock('../app/AuthContext.jsx', () => ({
  useAuth: () => ({
    user: { id: 7, name: 'Cashier', role: 'Cashier' },
    currentShift: { id: 12, status: 'OPEN' },
    loadShift: mocks.loadShift,
  }),
}));

vi.mock('../services/printService.js', () => ({
  printReceiptInFrame: mocks.printReceipt,
}));

vi.mock('../hooks/useScannerCapture.js', () => ({ useScannerCapture: vi.fn() }));

const product = {
  id: 1,
  name: 'قلم أزرق',
  sku: 'PEN-1',
  categoryId: 2,
  category_name: 'أقلام',
  stockOnHand: 5,
  canSellNow: true,
  canPreorderNow: false,
  availabilityPolicy: 'STOCK_ONLY',
  defaultPreorderDepositPct: 50,
  prices: [{ price_tier_id: 1, tier_name: 'قطاعي', price: 1000 }],
};

function renderPos() {
  return render(
    <MemoryRouter>
      <POS />
    </MemoryRouter>
  );
}

describe('POS cashier-first workflows', () => {
  beforeEach(() => {
    mocks.get.mockImplementation((path) => {
      if (path === '/api/payment-methods')
        return Promise.resolve({
          data: [
            {
              id: 1,
              code: 'Cash',
              name_ar: 'نقدي',
              is_active: 1,
              accepts_cash_received: 1,
            },
          ],
        });
      if (path === '/api/printer-settings') return Promise.resolve({ data: {} });
      if (path.startsWith('/api/categories'))
        return Promise.resolve({ data: [{ id: 2, name: 'أقلام' }] });
      if (path.startsWith('/api/pos/products/search')) return Promise.resolve({ data: [product] });
      return Promise.reject(new Error(`Unexpected GET ${path}`));
    });
    mocks.post.mockImplementation((path, body) => {
      if (path === '/api/pos/returns/prepare' && body.invoiceCode === 'invoice_card')
        return Promise.resolve({
          data: {
            order: {
              id: 9,
              invoiceNumber: 'INV-9',
              receiptNumber: 'REC-9',
            },
            items: [
              {
                orderItemId: 4,
                productId: 1,
                productName: 'قلم أزرق',
                sku: 'PEN-1',
                barcode: 'PEN-1',
                soldQuantity: 1,
                remainingQuantity: 1,
                unitPrice: 1000,
              },
            ],
          },
        });
      if (path === '/api/pos/returns/items/resolve' && body.code === 'PEN-1')
        return Promise.resolve({
          data: {
            orderId: 9,
            requiresSelection: false,
            matches: [
              {
                orderItemId: 4,
                productId: 1,
                productName: 'قلم أزرق',
                sku: 'PEN-1',
                remainingQuantity: 1,
                unitPrice: 1000,
              },
            ],
          },
        });
      if (path === '/api/pos/returns/quote')
        return Promise.resolve({
          data: {
            orderId: 9,
            invoiceNumber: 'INV-9',
            totalRefund: 1000,
            items: [{ id: 4, productName: 'قلم أزرق', quantity: 1, disposition: 'RESTOCK' }],
            allocations: [
              {
                id: 5,
                paymentMethodId: 1,
                methodName: 'نقدي',
                refundMode: 'CASH_DRAWER',
                amount: 1000,
              },
            ],
          },
        });
      if (path === '/api/pos/scan/resolve' && body.code === 'approval_card')
        return Promise.resolve({
          data: {
            type: 'return_approval_card',
            action: 'VALID',
            data: { id: 6, cardNumber: 'RAC-6', label: 'Main card', status: 'ACTIVE' },
          },
        });
      if (path === '/api/pos/returns/execute')
        return Promise.resolve({
          data: {
            returnId: 3,
            returnNumber: 'RTN-3',
            receiptId: 22,
            receiptNumber: 'REC-22',
          },
        });
      return Promise.reject(new Error(`Unexpected POST ${path}`));
    });
  });

  it('keeps an independent sale draft while switching modes', async () => {
    renderPos();
    fireEvent.click(await screen.findByRole('button', { name: /قلم أزرق/ }));
    expect(screen.getByLabelText('كمية قلم أزرق')).toHaveValue('1');

    fireEvent.click(screen.getByRole('tab', { name: 'حجز' }));
    expect(screen.queryByLabelText('كمية قلم أزرق')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: 'بيع مباشر' }));

    expect(screen.getByLabelText('كمية قلم أزرق')).toHaveValue('1');
    expect(sessionStorage.getItem('a4.pos.draft.7.12.sale')).toContain('قلم أزرق');
  });

  it('opens the mobile cart summary and uses quick full payment without a default method', async () => {
    renderPos();
    fireEvent.click(await screen.findByRole('button', { name: /قلم أزرق/ }));
    fireEvent.click(screen.getByRole('button', { name: /فتح السلة والدفع/ }));
    expect(document.querySelector('.pos-cart')).toHaveClass('is-open');

    fireEvent.click(screen.getByRole('button', { name: 'الدفع وإصدار الإيصال' }));
    expect(screen.getByText('لم يتم اختيار طريقة دفع تلقائيًا.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /نقدي/ }));
    expect(screen.getByLabelText('المبلغ المطبق')).toHaveValue('10.00');
    expect(screen.getByLabelText('النقد المستلم')).toHaveValue('10.00');
  });

  it('prepares a return and executes it only after scanning a reusable approval card', async () => {
    renderPos();
    fireEvent.click(await screen.findByRole('tab', { name: 'مرتجع' }));
    const invoiceScanner = await screen.findByLabelText(/QR أو رقم الفاتورة أو الإيصال/);
    fireEvent.change(invoiceScanner, { target: { value: 'invoice_card' } });
    fireEvent.keyDown(invoiceScanner, { key: 'Enter' });
    const itemScanner = await screen.findByLabelText(/باركود أو SKU للمنتج المرتجع/);
    fireEvent.change(itemScanner, { target: { value: 'PEN-1' } });
    fireEvent.keyDown(itemScanner, { key: 'Enter' });
    expect(await screen.findByLabelText('كمية مرتجع قلم أزرق')).toHaveValue('1');
    fireEvent.click(screen.getByRole('button', { name: 'حساب ومراجعة مبلغ الرد' }));
    await waitFor(() =>
      expect(mocks.post).toHaveBeenCalledWith('/api/pos/returns/quote', expect.any(Object))
    );

    const approvalScanner = await screen.findByLabelText(/بطاقة اعتماد الأدمن/);
    fireEvent.change(approvalScanner, { target: { value: 'approval_card' } });
    fireEvent.keyDown(approvalScanner, { key: 'Enter' });

    expect(await screen.findByText('تم الاعتماد')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'تأكيد استلام المنتجات ورد المبلغ' }));

    await waitFor(() =>
      expect(mocks.post).toHaveBeenCalledWith(
        '/api/pos/returns/execute',
        expect.objectContaining({ approvalCardToken: 'approval_card', refundReferences: [] }),
        expect.objectContaining({ headers: expect.any(Object) })
      )
    );
    expect(await screen.findByText('تم تنفيذ المرتجع')).toBeInTheDocument();
    expect(screen.getByText('RTN-3')).toBeInTheDocument();
    await waitFor(() =>
      expect(mocks.printReceipt).toHaveBeenCalledWith(
        expect.objectContaining({ receiptId: 22, isReprint: false })
      )
    );
  });
});
