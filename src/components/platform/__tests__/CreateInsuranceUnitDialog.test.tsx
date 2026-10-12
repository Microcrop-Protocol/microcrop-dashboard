/**
 * INSURANCE UNIT DIALOG, PER MARKET.
 *
 *   1. GHANA LIVESTOCK IS NOT OFFERED. Units carry only livestock terms and Ghana's livestock is
 *      hidden, so selecting Ghana says why and the form cannot be submitted.
 *   2. KENYAN DEFAULTS LEAVE WITH KENYA. Switching to Ghana empties the pre-filled KES figures;
 *      switching back restores them.
 *   3. NO TURKANA. The unit-code placeholder and the coordinate boxes carry no Kenyan place.
 *   4. KENYA'S SEASONS ARE NAMED with their months, and a valid Kenyan unit reaches onSubmit.
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { CreateInsuranceUnitDialog } from '@/components/platform/CreateInsuranceUnitDialog';

function open(onSubmit = vi.fn().mockResolvedValue(undefined)) {
  render(<CreateInsuranceUnitDialog onSubmit={onSubmit} />);
  fireEvent.click(screen.getByRole('button', { name: /add insurance unit/i }));
  return onSubmit;
}

async function chooseCountry(name: string) {
  fireEvent.click(screen.getByRole('combobox', { name: 'Country' }));
  fireEvent.click(await screen.findByRole('option', { name }));
}

const valueOf = (label: string) => (screen.getByLabelText(label) as HTMLInputElement).value;

describe('CreateInsuranceUnitDialog', () => {
  it("opens on Kenya with Kenya's seasons and defaults, and no Kenyan place in the placeholders", () => {
    open();
    expect(screen.getByText('LRLD — Long rains / long dry (Mar–Sep)')).toBeInTheDocument();
    expect(screen.getByText('SRSD — Short rains / short dry (Oct–Feb)')).toBeInTheDocument();
    expect(valueOf('Value per TLU (KES)')).toBe('15000');
    const code = screen.getByLabelText('Unit Code') as HTMLInputElement;
    expect(code.placeholder).toBe('KE-…');
    for (const input of screen.getAllByRole('spinbutton') as HTMLInputElement[]) {
      expect(input.placeholder).toBe('');
    }
    expect(document.body.textContent).not.toMatch(/turkana/i);
  });

  it('does not offer livestock terms in Ghana and cannot be submitted there', async () => {
    open();
    await chooseCountry('Ghana');
    expect(await screen.findByText(/Livestock cover is not offered in Ghana/)).toBeInTheDocument();
    expect(screen.getByText(/Ghana crop seasons: Main season \(north, unimodal\)/)).toBeInTheDocument();
    expect(screen.queryByText(/Value per TLU/)).not.toBeInTheDocument();
    expect(screen.queryByText(/LRLD/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create unit/i })).toBeDisabled();
  });

  it('hints the GH- prefix and uses Region/District for Ghana', async () => {
    open();
    await chooseCountry('Ghana');
    expect(await screen.findByText('Ghana unit codes must start with GH-')).toBeInTheDocument();
    expect((screen.getByLabelText('Unit Code') as HTMLInputElement).placeholder).toBe('GH-…');
    expect(screen.getByLabelText('Region')).toBeInTheDocument();
    expect(screen.getByLabelText('District (Optional)')).toBeInTheDocument();
  });

  it('clears the Kenyan defaults on the way to Ghana and restores them on the way back', async () => {
    open();
    fireEvent.change(screen.getByLabelText('Value per TLU (KES)'), { target: { value: '18000' } });
    await chooseCountry('Ghana');
    await screen.findByText(/Livestock cover is not offered in Ghana/);
    await chooseCountry('Kenya');
    // A typed figure is kept; untouched defaults come back.
    expect(await screen.findByLabelText('Value per TLU (KES)')).toHaveValue(18000);
    expect(screen.getAllByLabelText('Premium rate (KES/TLU)')[0]).toHaveValue(1500);
  });

  it('submits a Kenyan unit with its terms and bounding box', async () => {
    const onSubmit = open();
    fireEvent.change(screen.getByLabelText('Unit Code'), { target: { value: 'KE-30' } });
    fireEvent.change(screen.getByLabelText('County'), { target: { value: 'Baringo' } });
    fireEvent.change(screen.getByLabelText('Min Longitude'), { target: { value: '35.6' } });
    fireEvent.change(screen.getByLabelText('Min Latitude'), { target: { value: '0.2' } });
    fireEvent.change(screen.getByLabelText('Max Longitude'), { target: { value: '36.3' } });
    fireEvent.change(screen.getByLabelText('Max Latitude'), { target: { value: '1.6' } });
    fireEvent.click(screen.getByRole('button', { name: /create unit/i }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0]).toMatchObject({
      country: 'KE',
      unitCode: 'KE-30',
      county: 'Baringo',
      bbox: [35.6, 0.2, 36.3, 1.6],
      ndviBaselineLRLD: 0.45,
      strikeLevelSRSD: 0.35,
      premiumRateLRLD: 1500,
      valuePerTLU: 15000,
    });
  });

  it('omits a blank sub-county and an empty bounding box rather than sending them empty', async () => {
    // The backend validator takes subCounty as optional min(1): `subCounty: ''` is a 400.
    const onSubmit = open();
    fireEvent.change(screen.getByLabelText('Unit Code'), { target: { value: 'KE-31' } });
    fireEvent.change(screen.getByLabelText('County'), { target: { value: 'Baringo' } });
    fireEvent.change(screen.getByLabelText('Sub-County (Optional)'), { target: { value: '   ' } });
    fireEvent.click(screen.getByRole('button', { name: /create unit/i }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    const payload = onSubmit.mock.calls[0][0];
    expect(payload).not.toHaveProperty('subCounty');
    expect(payload).not.toHaveProperty('bbox');
    expect(payload).toMatchObject({ country: 'KE', unitCode: 'KE-31', county: 'Baringo' });
  });

  it('sends a sub-county that was filled in, trimmed', async () => {
    const onSubmit = open();
    fireEvent.change(screen.getByLabelText('Unit Code'), { target: { value: 'KE-32' } });
    fireEvent.change(screen.getByLabelText('County'), { target: { value: 'Baringo' } });
    fireEvent.change(screen.getByLabelText('Sub-County (Optional)'), { target: { value: ' Mogotio ' } });
    fireEvent.click(screen.getByRole('button', { name: /create unit/i }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0].subCounty).toBe('Mogotio');
  });

  it('refuses an incomplete bounding box', async () => {
    const onSubmit = open();
    fireEvent.change(screen.getByLabelText('Unit Code'), { target: { value: 'KE-30' } });
    fireEvent.change(screen.getByLabelText('County'), { target: { value: 'Baringo' } });
    fireEvent.change(screen.getByLabelText('Min Longitude'), { target: { value: '35.6' } });
    fireEvent.click(screen.getByRole('button', { name: /create unit/i }));
    expect(await screen.findAllByText('Required')).toHaveLength(3);
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
