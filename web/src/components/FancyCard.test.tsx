import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FancyCard } from './FancyCard';
import type { MarketDto } from '../lib/types';

const line: MarketDto = {
  id: 'f1',
  type: 'fancy',
  name: '6 over runs',
  status: 'open',
  runners: [],
  fancy: { line: 48, overs: 6, back: '19500', lay: '21000' },
};

describe('FancyCard (No / Rate / Yes / Rate)', () => {
  it('shows the line, rates, and selects Yes as a back at the struck line', () => {
    const onSelect = vi.fn();
    render(<FancyCard markets={[line]} selection={null} onSelect={onSelect} />);
    expect(screen.getByText('No')).toBeInTheDocument();
    expect(screen.getByText('Yes')).toBeInTheDocument();
    expect(screen.getByText('6 over runs')).toBeInTheDocument();
    expect(screen.getByText('95')).toBeInTheDocument(); // Yes (back 1.95) rate → 95
    expect(screen.getByText('110')).toBeInTheDocument(); // No (lay 2.10) rate → 110

    const lineCells = screen.getAllByText('48'); // both No and Yes show the line
    expect(lineCells).toHaveLength(2);
    const yesCell = lineCells[1];
    if (!yesCell) throw new Error('missing Yes cell');
    fireEvent.click(yesCell);
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ kind: 'fancy', side: 'back', lineValue: 48, price: '19500' }));
  });

  it('shows SUSPENDED for a locked session line', () => {
    render(<FancyCard markets={[{ ...line, status: 'suspended' }]} selection={null} onSelect={vi.fn()} />);
    expect(screen.getByText('SUSPENDED')).toBeInTheDocument();
  });

  it('renders nothing when there are no fancy markets', () => {
    const { container } = render(<FancyCard markets={[]} selection={null} onSelect={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });
});
