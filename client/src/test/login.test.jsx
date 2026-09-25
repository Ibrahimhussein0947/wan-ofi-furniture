import { describe, expect, test, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route } from 'react-router-dom';
import Login from '../pages/auth/Login';
import { ProtectedRoute, RequirePermission } from '../routes/guards';
import { renderWithProviders, makeUser } from './utils';

describe('Login', () => {
  test('validates input before calling the API', async () => {
    const login = vi.fn();
    renderWithProviders(<Login />, { route: '/login', path: '/login', auth: { login } });
    await userEvent.click(screen.getByRole('button', { name: /log in/i }));
    expect(await screen.findByText('Enter a valid email address')).toBeInTheDocument();
    expect(screen.getByText('Enter your password')).toBeInTheDocument();
    expect(login).not.toHaveBeenCalled();
  });

  test('shows the server error for invalid credentials', async () => {
    const login = vi.fn().mockRejectedValue({ response: { data: { message: 'Invalid login credentials.' } } });
    renderWithProviders(<Login />, { route: '/login', path: '/login', auth: { login } });
    await userEvent.type(screen.getByLabelText('Email'), 'owner@wanofi.com');
    await userEvent.type(screen.getByLabelText('Password'), 'wrong-password1');
    await userEvent.click(screen.getByRole('button', { name: /log in/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid login credentials.');
  });

  test('sends staff to the dashboard and customers to their account', async () => {
    const login = vi.fn().mockResolvedValue(makeUser('ACCOUNTANT'));
    renderWithProviders(<Login />, {
      route: '/login',
      path: '/login',
      auth: { login },
      extraRoutes: [<Route key="app" path="/app" element={<p>Staff dashboard</p>} />],
    });
    await userEvent.type(screen.getByLabelText('Email'), 'accountant@wanofi.com');
    await userEvent.type(screen.getByLabelText('Password'), 'Password123!');
    await userEvent.click(screen.getByRole('button', { name: /log in/i }));
    await waitFor(() => expect(screen.getByText('Staff dashboard')).toBeInTheDocument());
    expect(login).toHaveBeenCalledWith({ email: 'accountant@wanofi.com', password: 'Password123!' });
  });
});

describe('route guards', () => {
  test('anonymous users are redirected to login', () => {
    renderWithProviders(<ProtectedRoute />, {
      route: '/app',
      path: '/app',
      extraRoutes: [<Route key="login" path="/login" element={<p>Login page</p>} />],
    });
    expect(screen.getByText('Login page')).toBeInTheDocument();
  });

  test('customers cannot open staff pages', () => {
    renderWithProviders(<ProtectedRoute roles={['OWNER', 'ACCOUNTANT', 'WORKER']} />, {
      route: '/app',
      path: '/app',
      user: makeUser('CUSTOMER'),
      extraRoutes: [<Route key="account" path="/account" element={<p>Customer account</p>} />],
    });
    expect(screen.getByText('Customer account')).toBeInTheDocument();
  });

  test('pages requiring a permission explain why access is denied', () => {
    renderWithProviders(
      <RequirePermission perms={['settings:manage']}>
        <p>Settings</p>
      </RequirePermission>,
      { user: makeUser('ACCOUNTANT') }
    );
    expect(screen.queryByText('Settings')).not.toBeInTheDocument();
    expect(screen.getByText(/do not have permission/i)).toBeInTheDocument();
  });
});
