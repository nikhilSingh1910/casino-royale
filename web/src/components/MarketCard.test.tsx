import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MarketCard } from './MarketCard';
import type { MarketDto } from '../lib/types';

const matchOdds: MarketDto = {
  id: 'm1',
  type: 'match_odds',
  name: 'Match Odds',
  status: 'open',
  runners: [
    { id: 'rA', name: 'India', back: '19000', lay: '19200' },
    { id: 'rB', name: 'Australia', back: '21000', lay: '21400' },
  ],
  fancy: null,
};

describe('MarketCard (runner / LG-KH)', () => {
  it('shows LG/KH headers, runner odds, and selects a back (LG) bet', () => {
    const onSelect = vi.fn();
    render(<MarketCard market={matchOdds} selection={null} onSelect={onSelect} />);
    expect(screen.getByText('LG')).toBeInTheDocument();
    expect(screen.getByText('KH')).toBeInTheDocument();
    expect(screen.getByText('1.90')).toBeInTheDocument(); // India back
    expect(screen.getByText('2.10')).toBeInTheDocument(); // Australia back
    fireEvent.click(screen.getByText('1.90'));
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ kind: 'runner', side: 'back', runnerId: 'rA', price: '19000', label: 'India · LG' }));
  });

  it('locks a suspended market — cells disabled, status badged', () => {
    render(<MarketCard market={{ ...matchOdds, status: 'suspended' }} selection={null} onSelect={vi.fn()} />);
    expect(screen.getByText('1.90').closest('button')).toBeDisabled();
    expect(screen.getByText('suspended')).toBeInTheDocument();
  });
});
