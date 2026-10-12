/**
 * The catalogue picker: the market's own items, PILOT badged, COMING_SOON disabled with the
 * reason, and a closed trigger that reads as the label alone.
 */
import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Select, SelectContent, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  CatalogueItemDetails,
  CatalogueSelectItems,
} from '@/components/catalogue/CatalogueOptions';
import { GH_CATALOGUE, KE_CATALOGUE } from '@/test/catalogue-fixtures';
import type { CatalogueItem } from '@/types/catalogue';

function Picker({
  items,
  countryName,
  purpose,
}: {
  items: CatalogueItem[];
  countryName: string;
  purpose?: 'sell' | 'register';
}) {
  const [value, setValue] = useState('');
  return (
    <Select value={value} onValueChange={setValue}>
      <SelectTrigger aria-label="Crop">
        <SelectValue placeholder="Select crop" />
      </SelectTrigger>
      <SelectContent>
        <CatalogueSelectItems items={items} countryName={countryName} emptyMessage="Nothing offered" purpose={purpose} />
      </SelectContent>
    </Select>
  );
}

describe('CatalogueSelectItems', () => {
  it("lists only the market's items", async () => {
    render(<Picker items={GH_CATALOGUE.lines.CROP} countryName="Ghana" />);
    fireEvent.click(screen.getByRole('combobox', { name: 'Crop' }));

    const options = await screen.findAllByRole('option');
    expect(options).toHaveLength(GH_CATALOGUE.lines.CROP.length);
    expect(screen.queryByRole('option', { name: /Green grams/ })).not.toBeInTheDocument();
  });

  it('badges a pilot item and keeps it selectable', async () => {
    render(<Picker items={KE_CATALOGUE.lines.CROP} countryName="Kenya" />);
    fireEvent.click(screen.getByRole('combobox', { name: 'Crop' }));

    const sorghum = await screen.findByRole('option', { name: /Sorghum/ });
    expect(sorghum).toHaveTextContent('Pilot');
    expect(sorghum).not.toHaveAttribute('aria-disabled', 'true');
  });

  it('shows a coming-soon item disabled, with the reason', async () => {
    render(<Picker items={KE_CATALOGUE.lines.CROP} countryName="Kenya" />);
    fireEvent.click(screen.getByRole('combobox', { name: 'Crop' }));

    const wheat = await screen.findByRole('option', { name: /Wheat/ });
    expect(wheat).toHaveAttribute('aria-disabled', 'true');
    expect(wheat).toHaveTextContent('Coming soon');
    expect(wheat).toHaveTextContent('Wheat cover is coming soon in Kenya');
  });

  it("disables a PILOT item the SERVER marks unsellable, with the server's reason", async () => {
    const items = KE_CATALOGUE.lines.CROP.map((c) =>
      c.code === 'SORGHUM' ? { ...c, sellable: false, reason: 'PRICING_NOT_CONFIGURED' } : c,
    );
    render(<Picker items={items} countryName="Kenya" />);
    fireEvent.click(screen.getByRole('combobox', { name: 'Crop' }));

    const sorghum = await screen.findByRole('option', { name: /Sorghum/ });
    expect(sorghum).toHaveAttribute('aria-disabled', 'true');
    expect(sorghum).toHaveTextContent('Pricing not configured yet');
    expect(sorghum).not.toHaveTextContent(/Not offered in Kenya/);
  });

  it('lets a coming-soon crop be chosen for a NEW PLOT, labelled as not insurable yet', async () => {
    render(<Picker items={KE_CATALOGUE.lines.CROP} countryName="Kenya" purpose="register" />);
    fireEvent.click(screen.getByRole('combobox', { name: 'Crop' }));

    const wheat = await screen.findByRole('option', { name: /Wheat/ });
    expect(wheat).not.toHaveAttribute('aria-disabled', 'true');
    expect(wheat).toHaveTextContent('Coming soon — cannot be insured yet');
    fireEvent.click(wheat);
    expect(screen.getByRole('combobox', { name: 'Crop' })).toHaveTextContent(/^Wheat$/);
  });

  it('shows only the label in the closed trigger once chosen', async () => {
    render(<Picker items={KE_CATALOGUE.lines.CROP} countryName="Kenya" />);
    fireEvent.click(screen.getByRole('combobox', { name: 'Crop' }));
    fireEvent.click(await screen.findByRole('option', { name: /Sorghum/ }));

    expect(screen.getByRole('combobox', { name: 'Crop' })).toHaveTextContent(/^Sorghum$/);
  });

  it('renders one disabled row for an empty line', async () => {
    render(<Picker items={[]} countryName="Ghana" />);
    fireEvent.click(screen.getByRole('combobox', { name: 'Crop' }));

    const row = await screen.findByRole('option', { name: 'Nothing offered' });
    expect(row).toHaveAttribute('aria-disabled', 'true');
  });
});

describe('CatalogueItemDetails', () => {
  it('states the peril and index, and the pilot note for a pilot item', () => {
    const sorghum = KE_CATALOGUE.lines.CROP.find((c) => c.code === 'SORGHUM') as CatalogueItem;
    render(<CatalogueItemDetails item={sorghum} countryName="Kenya" />);
    expect(screen.getByText('Drought')).toBeInTheDocument();
    expect(screen.getByText(/Sorghum is a pilot product in Kenya/)).toBeInTheDocument();
  });

  it('has no pilot note for an available item, and renders nothing without one', () => {
    const maize = KE_CATALOGUE.lines.CROP[0];
    const { container, rerender } = render(<CatalogueItemDetails item={maize} countryName="Kenya" />);
    expect(screen.queryByText(/pilot product/)).not.toBeInTheDocument();
    rerender(<CatalogueItemDetails item={null} countryName="Kenya" />);
    expect(container).toBeEmptyDOMElement();
  });
});
