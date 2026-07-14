import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Returns from '../pages/Returns.jsx';

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
}));

vi.mock('../services/apiClient.js', () => ({
  api: { get: mocks.get, post: mocks.post },
}));

vi.mock('../services/printService.js', () => ({
  printReturnApprovalCardInFrame: vi.fn(() => Promise.resolve({ printed: true })),
}));

function renderReturns(entry) {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/returns" element={<Returns />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('Admin returns center', () => {
  beforeEach(() => {
    mocks.get.mockImplementation((path) => {
      if (path === '/api/admin/return-approval-cards') {
        return Promise.resolve({
          data: [
            {
              id: 4,
              cardNumber: 'RAC-4',
              label: 'كارت المدير',
              ownerAdminName: 'Admin',
              status: 'ACTIVE',
              printCount: 2,
              lastPrintedAt: '2026-07-15T10:00:00.000Z',
              lastUsedAt: null,
            },
          ],
        });
      }
      if (path.startsWith('/api/admin/returns?')) {
        return Promise.resolve({
          data: {
            returns: [
              {
                id: 3,
                returnNumber: 'RTN-9',
                invoiceNumber: 'INV-2',
                cashierName: 'Cashier',
                shiftId: 12,
                totalRefunded: 1000,
                approvalCardNumber: 'RAC-4',
                createdAt: '2026-07-15T09:00:00.000Z',
              },
            ],
            total: 1,
            pagination: { limit: 25, offset: 0 },
          },
        });
      }
      return Promise.reject(new Error(`Unexpected GET ${path}`));
    });
  });

  it('opens the cards tab from the legacy redirect query', async () => {
    renderReturns('/returns?tab=cards');
    expect(await screen.findByRole('tab', { name: 'كروت الاعتماد' })).toHaveAttribute(
      'aria-selected',
      'true'
    );
    await waitFor(() => expect(mocks.get).toHaveBeenCalledWith('/api/admin/return-approval-cards'));
    expect(screen.getAllByText('كارت المدير').length).toBeGreaterThan(0);
    expect(screen.getAllByText('RAC-4').length).toBeGreaterThan(0);
  });

  it('maps a dashboard return search to the exact backend filter and offset pagination', async () => {
    renderReturns('/returns?search=RTN-9');
    await waitFor(() => {
      const call = mocks.get.mock.calls.find(([path]) => path.startsWith('/api/admin/returns?'));
      expect(call).toBeTruthy();
      const query = new URL(call[0], 'http://localhost').searchParams;
      expect(query.get('returnNumber')).toBe('RTN-9');
      expect(query.get('invoiceNumber')).toBeNull();
      expect(query.get('limit')).toBe('25');
      expect(query.get('offset')).toBe('0');
    });
    expect((await screen.findAllByText('RTN-9')).length).toBeGreaterThan(0);
  });
});
