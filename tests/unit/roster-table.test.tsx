import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { RosterTable } from '../../components/players/RosterTable';
import type { RosterEntry } from '../../lib/data/players-hub';

// E13 replaced the roster card grid with a table. The sandbox fixtures
// carry no roster, so the E2E suite cannot reach this component locally —
// these assertions are the only thing holding its contract.
//
// What matters: the `roster-card-<gsisId>` test id the E2E suite targets
// survives the move from card to row, and special teams stays inert with
// an accessible explanation rather than becoming a dead link.

function entry(over: Partial<RosterEntry> = {}): RosterEntry {
  return {
    gsisId: '00-0039851',
    displayName: 'Drake Maye',
    position: 'QB',
    jerseyNumber: 10,
    headshotUrl: null,
    role: 'qb',
    category: 'QB',
    ...over,
  } as RosterEntry;
}

describe('components/players/RosterTable', () => {
  it('should_keep_the_roster_card_test_id_on_the_row_link', () => {
    const html = renderToStaticMarkup(<RosterTable roster={[entry()]} />);
    assert.match(html, /data-testid="roster-card-00-0039851"/);
  });

  it('should_render_the_player_name_and_jersey_number', () => {
    const html = renderToStaticMarkup(<RosterTable roster={[entry()]} />);
    assert.match(html, /Drake Maye/);
    assert.match(html, />10</);
  });

  it('should_render_an_em_dash_when_the_jersey_number_is_missing', () => {
    const html = renderToStaticMarkup(
      <RosterTable roster={[entry({ jerseyNumber: null })]} />,
    );
    assert.match(html, /—/);
  });

  it('should_render_a_link_for_a_player_with_a_destination', () => {
    const html = renderToStaticMarkup(<RosterTable roster={[entry()]} />);
    assert.match(html, /<a[^>]+data-testid="roster-card-00-0039851"/);
  });

  it('should_render_special_teams_as_an_inert_row_not_a_link', () => {
    const html = renderToStaticMarkup(
      <RosterTable
        roster={[
          entry({
            gsisId: '00-0000001',
            displayName: 'Bryce Baringer',
            position: 'P',
            category: 'ST',
            role: 'special',
          }),
        ]}
      />,
    );
    assert.match(html, /aria-disabled="true"/);
    assert.doesNotMatch(html, /<a[^>]+data-testid="roster-card-00-0000001"/);
  });

  it('should_describe_the_inert_special_teams_row_for_screen_readers', () => {
    const html = renderToStaticMarkup(
      <RosterTable
        roster={[entry({ gsisId: '00-0000001', category: 'ST', role: 'special' })]}
      />,
    );
    assert.match(html, /aria-describedby=/);
    assert.match(html, /Page coming soon/);
  });

  it('should_render_one_row_per_player', () => {
    const html = renderToStaticMarkup(
      <RosterTable
        roster={[entry(), entry({ gsisId: '00-0000002', displayName: 'A.J. Brown' })]}
      />,
    );
    assert.match(html, /roster-card-00-0039851/);
    assert.match(html, /roster-card-00-0000002/);
  });
});
