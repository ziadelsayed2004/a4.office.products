import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MainLayout } from '../layouts/MainLayout.jsx';
import Categories from '../pages/Categories.jsx';

const mocks = vi.hoisted(() => ({
  delete: vi.fn(),
  get: vi.fn(),
  logout: vi.fn(),
  patch: vi.fn(),
  post: vi.fn(),
  toggleColorMode: vi.fn(),
}));

vi.mock('../services/apiClient.js', () => ({
  api: {
    delete: mocks.delete,
    get: mocks.get,
    patch: mocks.patch,
    post: mocks.post,
  },
}));

vi.mock('../app/AuthContext.jsx', () => ({
  useAuth: () => ({
    user: { id: 1, name: 'مدير النظام', username: 'admin', role: 'Admin' },
    isAdmin: true,
    currentShift: { id: 14, status: 'OPEN' },
    logout: mocks.logout,
  }),
}));

vi.mock('../theme/ThemeConfig.jsx', () => ({
  useColorMode: () => ({ mode: 'dark', toggleColorMode: mocks.toggleColorMode }),
}));

const removableCategory = {
  id: 10,
  name: 'أقلام مؤقتة',
  is_active: 1,
  can_delete: true,
  dependency_counts: { products: 0 },
};

const linkedCategory = {
  id: 11,
  name: 'دفاتر مرتبطة',
  is_active: 1,
  can_delete: false,
  dependency_counts: { products: 2 },
};

function renderCategories() {
  return render(<Categories />);
}

function desktopRowFor(name) {
  const table = screen.getByRole('table', { name: 'جدول البيانات' });
  return within(table).getByText(name).closest('tr');
}

function assertDrawerOrder(paper) {
  const drawer = paper.querySelector('.main-layout__drawer-container');
  expect(drawer).not.toBeNull();

  const directChildren = [...drawer.children];
  expect(directChildren[0]).toHaveClass('sidebar-header');
  expect(directChildren[1]).toHaveClass('sidebar-profile-wrap');
  expect(directChildren[2]).toHaveClass('sidebar-divider');
  expect(directChildren[3]).toHaveClass('sidebar-menu-wrapper');
  expect(directChildren[4]).toHaveClass('sidebar-toggle-container');
  expect(directChildren[3]).not.toContainElement(directChildren[1]);
}

describe('Categories safe-delete UI', () => {
  beforeEach(() => {
    mocks.delete.mockReset();
    mocks.get.mockReset();
    mocks.patch.mockReset();
    mocks.post.mockReset();
  });

  it('requires explicit confirmation, deletes an unused category, and keeps linked categories protected', async () => {
    mocks.get
      .mockResolvedValueOnce({ data: [removableCategory, linkedCategory] })
      .mockResolvedValueOnce({ data: [linkedCategory] });
    mocks.delete.mockResolvedValue({
      status: 'success',
      message: 'deleted',
      data: { id: removableCategory.id },
    });

    renderCategories();
    await screen.findByRole('table', { name: 'جدول البيانات' });

    const linkedDeleteButton = within(desktopRowFor(linkedCategory.name)).getByRole('button', {
      name: 'انقل المنتجات المرتبطة قبل الحذف',
    });
    expect(linkedDeleteButton).toBeDisabled();

    fireEvent.click(
      within(desktopRowFor(removableCategory.name)).getByRole('button', {
        name: 'حذف نهائي',
      })
    );

    const dialog = await screen.findByRole('dialog', { name: 'حذف التصنيف نهائيًا' });
    expect(dialog).toHaveTextContent(removableCategory.name);
    expect(dialog).toHaveTextContent('دون إمكانية استرجاعه');
    expect(mocks.delete).not.toHaveBeenCalled();

    fireEvent.click(within(dialog).getByRole('button', { name: 'حذف التصنيف' }));

    await waitFor(() =>
      expect(mocks.delete).toHaveBeenCalledWith(`/api/admin/categories/${removableCategory.id}`)
    );
    await waitFor(() => expect(mocks.get).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.queryByText(removableCategory.name)).not.toBeInTheDocument());

    expect(screen.getAllByText(linkedCategory.name).length).toBeGreaterThan(0);
    expect(linkedDeleteButton).toBeDisabled();
    expect(mocks.delete).toHaveBeenCalledTimes(1);
  });

  it('surfaces a server-side dependency conflict and leaves the confirmation open', async () => {
    const conflict = Object.assign(new Error('Category is in use.'), {
      code: 'CATEGORY_IN_USE',
      details: { productCount: 3 },
    });
    mocks.get.mockResolvedValue({ data: [removableCategory] });
    mocks.delete.mockRejectedValue(conflict);

    renderCategories();
    await screen.findByRole('table', { name: 'جدول البيانات' });
    fireEvent.click(
      within(desktopRowFor(removableCategory.name)).getByRole('button', {
        name: 'حذف نهائي',
      })
    );
    const dialog = await screen.findByRole('dialog', { name: 'حذف التصنيف نهائيًا' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'حذف التصنيف' }));

    expect(
      await screen.findByText('لا يمكن حذف التصنيف لأنه مرتبط بـ3 منتج. انقل المنتجات أولًا.')
    ).toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'حذف التصنيف نهائيًا' })).toBeInTheDocument();
    expect(mocks.get).toHaveBeenCalledTimes(1);
  });
});

describe('MainLayout fixed identity area', () => {
  it('keeps logo and user card above the only scrolling menu on desktop and mobile', async () => {
    render(
      <MemoryRouter initialEntries={['/categories']}>
        <Routes>
          <Route element={<MainLayout />}>
            <Route path="/categories" element={<div>صفحة التصنيفات</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    const desktopPaper = document.querySelector('.main-layout__desktop-drawer-paper');
    expect(desktopPaper).not.toBeNull();
    assertDrawerOrder(desktopPaper);
    expect(within(desktopPaper).queryByText('نقطة البيع')).not.toBeInTheDocument();
    expect(within(desktopPaper).queryByText('شيفتي الحالية')).not.toBeInTheDocument();
    expect(within(desktopPaper).queryByText('الإيصالات')).not.toBeInTheDocument();
    expect(within(desktopPaper).getByText('المرتجعات')).toBeInTheDocument();
    expect(within(desktopPaper).queryByText(/دون شيفت/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'فتح القائمة' }));
    await waitFor(() =>
      expect(document.querySelector('.main-layout__mobile-drawer-paper')).not.toBeNull()
    );
    assertDrawerOrder(document.querySelector('.main-layout__mobile-drawer-paper'));

    const layoutCss = readFileSync(resolve(process.cwd(), 'src/styles/MainLayout.css'), 'utf8');
    const profileRule = layoutCss.match(/\.sidebar-profile-wrap\s*\{([^}]*)\}/)?.[1];
    const menuRule = layoutCss.match(/\.sidebar-menu-wrapper\s*\{([^}]*)\}/)?.[1];
    expect(profileRule).toMatch(/flex:\s*0 0 auto/);
    expect(menuRule).toMatch(/flex:\s*1/);
    expect(menuRule).toMatch(/overflow-y:\s*auto/);
  });
});
