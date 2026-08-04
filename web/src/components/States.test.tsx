import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { EmptyState, ErrorState, LoadingCards } from './States';

describe('States', () => {
  it('EmptyState shows the title and hint', () => {
    render(<EmptyState title="No matches yet" hint="Check back soon" />);
    expect(screen.getByText('No matches yet')).toBeInTheDocument();
    expect(screen.getByText('Check back soon')).toBeInTheDocument();
  });

  it('ErrorState retry fires the callback', () => {
    const onRetry = vi.fn();
    render(<ErrorState message="Boom" onRetry={onRetry} />);
    fireEvent.click(screen.getByText('Try again'));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('LoadingCards renders a busy region', () => {
    render(<LoadingCards rows={2} />);
    expect(screen.getByLabelText('Loading')).toHaveAttribute('aria-busy', 'true');
  });
});
