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
const session: MarketDto = {
  id: 'f1',
  type: 'fancy',
  name: '6 over runs',
  status: 'open',
  runners: [],
  fancy: { line: 48, overs: 6, back: '19500', lay: '21000' },
};

describe('MarketCard', () => {
  it('shows runner odds and selects a back bet on click', () => {
    const onSelect = vi.fn();
    render(<MarketCard market={matchOdds} selection={null} onSelect={onSelect} />);
    expect(screen.getByText('1.90')).toBeInTheDocument(); // India back @ 1.90
    expect(screen.getByText('2.10')).toBeInTheDocument(); // Australia back @ 2.10
    fireEvent.click(screen.getByText('1.90'));
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ kind: 'runner', side: 'back', runnerId: 'rA', price: '19000' }));
  });

  it('shows a session line with No/Yes and selects Yes as a back at the struck line', () => {
    const onSelect = vi.fn();
    render(<MarketCard market={session} selection={null} onSelect={onSelect} />);
    expect(screen.getByText(/line 48/)).toBeInTheDocument();
    fireEvent.click(screen.getByText(/Yes · 1.95/));
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ kind: 'fancy', side: 'back', lineValue: 48, price: '19500' }));
  });

  it('locks a suspended market — cells disabled, status badged', () => {
    render(<MarketCard market={{ ...matchOdds, status: 'suspended' }} selection={null} onSelect={vi.fn()} />);
    expect(screen.getByText('1.90').closest('button')).toBeDisabled();
    expect(screen.getByText('suspended')).toBeInTheDocument();
  });
});
