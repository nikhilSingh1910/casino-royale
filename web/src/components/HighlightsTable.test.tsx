import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { HighlightsTable } from './HighlightsTable';
import type { MatchListDto } from '../lib/types';

const matches: MatchListDto[] = [
  {
    id: 'm1',
    name: 'India v Australia',
    competition: 'IPL',
    status: 'inplay',
    startsAt: '2026-08-08T08:00:00Z',
    odds: { home: { back: '19000', lay: '19200' }, draw: null, away: { back: '21000', lay: '21400' } },
  },
];

describe('HighlightsTable', () => {
  it('renders the match with 1/X/2 odds; a missing draw shows a dash', () => {
    render(
      <MemoryRouter>
        <HighlightsTable matches={matches} />
      </MemoryRouter>,
    );
    expect(screen.getByText('India v Australia')).toBeInTheDocument();
    expect(screen.getByText('In-Play')).toBeInTheDocument();
    expect(screen.getByText('1.90')).toBeInTheDocument(); // home back
    expect(screen.getByText('2.10')).toBeInTheDocument(); // away back
    expect(screen.getAllByText('-').length).toBeGreaterThanOrEqual(2); // no draw → dashes
  });
});
