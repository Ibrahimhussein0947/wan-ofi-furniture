import { describe, expect, test, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import EntityPicker from '../components/ui/EntityPicker';
import { renderWithProviders, makeUser } from './utils';

describe('EntityPicker', () => {
  test('offers to create a record that is not found, using what was typed', async () => {
    const onCreate = vi.fn();
    renderWithProviders(
      <EntityPicker label="Customer" value={null} onChange={() => {}} queryKey="customers" fetcher={async () => []} getLabel={(c) => c.name} onCreate={onCreate} createLabel="Create customer" />,
      { user: makeUser('OWNER') },
    );
    await userEvent.click(screen.getByRole('button', { name: /search/i }));
    await userEvent.type(await screen.findByLabelText('Search'), 'Kedir');
    await userEvent.click(await screen.findByRole('button', { name: /create customer .*kedir/i }));
    expect(onCreate).toHaveBeenCalledWith('Kedir');
  });

  test('renders its list outside the card so it cannot be clipped', async () => {
    renderWithProviders(
      <div style={{ overflow: 'hidden' }} data-testid="card">
        <EntityPicker label="Product" value={null} onChange={() => {}} queryKey="products" fetcher={async () => [{ _id: 'p1', name: 'Sofa' }]} getLabel={(p) => p.name} />
      </div>,
      { user: makeUser('OWNER') },
    );
    await userEvent.click(screen.getByRole('button', { name: /search/i }));
    const option = await screen.findByRole('option', { name: /sofa/i });
    expect(screen.getByTestId('card')).not.toContainElement(option);
  });
});
