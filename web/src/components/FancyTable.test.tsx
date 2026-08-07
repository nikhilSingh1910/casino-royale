import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { FancyTable } from './FancyTable';
import { SelectionProvider } from '../lib/selection';
import type { MarketDto } from '../lib/types';

const line: MarketDto = {
  id: 'f1',
  type: 'fancy',
  name: '6 over runs',
  status: 'open',
  runners: [],
  fancy: { line: 48, overs: 6, back: '19500', lay: '21000' },
};

describe('FancyTable', () => {
  it('shows No/Yes with the line + rate, and selects on click', () => {
    render(
      <SelectionProvider>
        <FancyTable markets={[line]} />
      </SelectionProvider>,
    );
    expect(screen.getByText('No')).toBeInTheDocument();
    expect(screen.getByText('Yes')).toBeInTheDocument();
    expect(screen.getByText('95')).toBeInTheDocument(); // Yes/back rate
    expect(screen.getByText('110')).toBeInTheDocument(); // No/lay rate
    const cells = screen.getAllByText('48');
    expect(cells).toHaveLength(2);
    fireEvent.click(cells[1] as HTMLElement); // Yes cell
    expect((screen.getAllByText('48')[1] as HTMLElement).className).toContain('sel');
  });

  it('shows SUSPENDED when locked', () => {
    render(
      <SelectionProvider>
        <FancyTable markets={[{ ...line, status: 'suspended' }]} />
      </SelectionProvider>,
    );
    expect(screen.getByText('SUSPENDED')).toBeInTheDocument();
  });
});
