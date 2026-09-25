import { describe, expect, test, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders, makeUser } from './utils';

vi.mock('../api/endpoints', () => ({
  publicApi: { settings: vi.fn() },
  authApi: { forgotPassword: vi.fn(), resetPassword: vi.fn(), resendVerification: vi.fn() },
  paymentsApi: { mobile: vi.fn(), mobileStatus: vi.fn(), submit: vi.fn() },
  ordersApi: { create: vi.fn(), updateItems: vi.fn() },
  productsApi: { list: vi.fn() },
  branchesApi: { list: vi.fn() },
}));

import { authApi, paymentsApi, publicApi, branchesApi } from '../api/endpoints';
import ForgotPassword from '../pages/auth/ForgotPassword';
import ResetPassword from '../pages/auth/ResetPassword';
import PayModal from '../pages/account/PayModal';
import VerifyEmailBanner from '../components/VerifyEmailBanner';
import Checkout from '../pages/public/Checkout';
import { exportCSV } from '../utils/export';

beforeEach(() => {
  publicApi.settings.mockResolvedValue({ currency: 'TZS', taxRate: 18, depositPercent: 40, defaultDeliveryFee: 0, onlinePayments: true, mobileNetworks: ['MPESA', 'TIGO', 'AIRTEL'] });
  branchesApi.list.mockResolvedValue([]);
});

describe('password reset', () => {
  test('requesting a link shows a neutral confirmation', async () => {
    authApi.forgotPassword.mockResolvedValue({ message: 'If an account exists for that email, we have sent a link.' });
    renderWithProviders(<ForgotPassword />);
    await userEvent.type(screen.getByLabelText('Email'), 'amina@example.com');
    await userEvent.click(screen.getByRole('button', { name: /send reset link/i }));
    expect(await screen.findByText('Check your email')).toBeInTheDocument();
    expect(authApi.forgotPassword).toHaveBeenCalledWith('amina@example.com');
  });

  test('reset page rejects malformed links and mismatched passwords', async () => {
    const { unmount } = renderWithProviders(<ResetPassword />, { route: '/reset-password?token=abc' });
    expect(screen.getByText('Invalid reset link')).toBeInTheDocument();
    unmount();

    const token = 'a'.repeat(64);
    renderWithProviders(<ResetPassword />, { route: `/reset-password?token=${token}` });
    await userEvent.type(screen.getByLabelText('New password'), 'NewSecret1');
    await userEvent.type(screen.getByLabelText('Confirm new password'), 'Different1');
    await userEvent.click(screen.getByRole('button', { name: /update password/i }));
    expect(await screen.findByText('Passwords do not match')).toBeInTheDocument();
    expect(authApi.resetPassword).not.toHaveBeenCalled();

    authApi.resetPassword.mockResolvedValue({ message: 'ok' });
    await userEvent.clear(screen.getByLabelText('Confirm new password'));
    await userEvent.type(screen.getByLabelText('Confirm new password'), 'NewSecret1');
    await userEvent.click(screen.getByRole('button', { name: /update password/i }));
    await waitFor(() => expect(authApi.resetPassword).toHaveBeenCalledWith({ token, password: 'NewSecret1' }));
    expect(await screen.findByText('Password updated')).toBeInTheDocument();
  });
});

describe('email verification banner', () => {
  test('shows only for unverified customers and can resend the link', async () => {
    authApi.resendVerification.mockResolvedValue({ message: 'Sent' });
    const { unmount } = renderWithProviders(<VerifyEmailBanner />, { user: makeUser('CUSTOMER', { emailVerified: true }) });
    expect(screen.queryByText(/confirm your email/i)).not.toBeInTheDocument();
    unmount();
    renderWithProviders(<VerifyEmailBanner />, { user: makeUser('CUSTOMER', { emailVerified: false }) });
    await userEvent.click(screen.getByRole('button', { name: /resend/i }));
    expect(authApi.resendVerification).toHaveBeenCalled();
  });
});

describe('mobile money payment', () => {
  test('sends a prompt and shows success once the provider confirms', async () => {
    paymentsApi.mobile.mockResolvedValue({ reference: 'WOPABC123', status: 'PENDING', network: 'MPESA', phone: '+255754123456', amount: 40000 });
    paymentsApi.mobileStatus.mockResolvedValue({ reference: 'WOPABC123', status: 'SUCCEEDED', network: 'MPESA', phone: '+255754123456', amount: 40000 });
    renderWithProviders(<PayModal open onClose={() => {}} order={{ _id: 'o1', balance: 100000, depositRequired: 40000, amountPaid: 0, status: 'PENDING' }} />, { user: makeUser('CUSTOMER') });

    await screen.findByText('Mobile money');
    // The customer's saved number is pre-filled; they pay from a different phone here.
    expect(screen.getByLabelText(/mobile number/i)).toHaveValue('+255700000000');
    await userEvent.clear(screen.getByLabelText(/mobile number/i));
    await userEvent.type(screen.getByLabelText(/mobile number/i), '0754123456');
    await userEvent.click(screen.getByRole('button', { name: /send payment prompt/i }));
    await waitFor(() => expect(paymentsApi.mobile).toHaveBeenCalledWith({ order: 'o1', network: 'MPESA', phone: '0754123456', amount: 40000 }));
    expect(await screen.findByText('Check your phone')).toBeInTheDocument();
    expect(await screen.findByText(/received/, {}, { timeout: 5000 })).toBeInTheDocument();
  });
});

describe('tax at checkout', () => {
  test('VAT is shown and included in the total and deposit', async () => {
    localStorage.setItem('wanofi.cart', JSON.stringify([{ productId: 'p1', name: 'Bed', price: 100000, quantity: 1 }]));
    renderWithProviders(<Checkout />, { user: makeUser('CUSTOMER') });
    expect(await screen.findByText('VAT (18%)')).toBeInTheDocument();
    expect(screen.getByText('TZS 18,000')).toBeInTheDocument();
    expect(screen.getByText('TZS 118,000')).toBeInTheDocument();
    expect(screen.getByText('TZS 47,200')).toBeInTheDocument(); // 40% deposit of the VAT-inclusive total
  });
});

describe('CSV export', () => {
  test('neutralises spreadsheet formula injection', async () => {
    let written;
    const OriginalBlob = globalThis.Blob;
    globalThis.Blob = class {
      constructor(parts) {
        written = parts.join('');
      }
    };
    exportCSV('x', [{ key: 'name', header: 'Name' }], [{ name: '=HYPERLINK("http://evil")' }, { name: '-42' }]);
    globalThis.Blob = OriginalBlob;
    expect(written).toContain(`"'=HYPERLINK(""http://evil"")"`);
    expect(written).toContain('\r\n-42');
  });
});
