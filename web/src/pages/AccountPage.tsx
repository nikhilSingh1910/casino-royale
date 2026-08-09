import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { EmptyState, ErrorState, Loading } from '../components/States';
import { api, ApiError } from '../lib/api';
import { useAuth } from '../lib/auth';
import { formatMoney, formatOdds } from '../lib/format';
import type { BetHistoryDto } from '../lib/types';

type Tab = 'bets' | 'statement' | 'settings';

export function AccountPage() {
  const { token, signOut } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('bets');

  if (!token) return <Navigate to="/login" replace />;

  return (
    <div>
      <BalanceCard token={token} />
      <BonusCard token={token} />
      <div className="panel" style={{ marginBottom: 10 }}>
        <div className="panel__bar">My Account</div>
        <div className="tabs" style={{ padding: '8px 8px 0' }}>
          {(['bets', 'statement', 'settings'] as Tab[]).map((t) => (
            <div key={t} className={`tab${tab === t ? ' active' : ''}`} onClick={() => setTab(t)}>
              {t === 'bets' ? 'My Bets' : t === 'statement' ? 'Statement' : 'Settings'}
            </div>
          ))}
        </div>
      </div>
      {tab === 'bets' && <BetsTab token={token} />}
      {tab === 'statement' && <StatementTab token={token} />}
      {tab === 'settings' && <SettingsTab token={token} onLogout={() => { signOut(); navigate('/'); }} />}
    </div>
  );
}

function BalanceCard({ token }: { token: string }) {
  const q = useQuery({ queryKey: ['balance'], queryFn: () => api.balance(token), refetchInterval: 20000 });
  const b = q.data;
  const total = b ? (BigInt(b.available) + BigInt(b.reserved)).toString() : null; // integer add, no float (§3.1)
  return (
    <div className="bal-card">
      <div className="bal-card__cell"><span>Available</span><b>{b ? formatMoney(b.available) : '—'}</b></div>
      <div className="bal-card__cell"><span>In open bets</span><b>{b ? formatMoney(b.reserved) : '—'}</b></div>
      <div className="bal-card__cell bal-card__cell--total"><span>Total</span><b>{total ? formatMoney(total) : '—'}</b></div>
    </div>
  );
}

function BonusCard({ token }: { token: string }) {
  const qc = useQueryClient();
  const info = useQuery({ queryKey: ['bonusInfo'], queryFn: () => api.bonusInfo(token) });
  const amount = info.data ? formatMoney(info.data.amount) : null; // single source: backend DAILY_BONUS (N4)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const claim = useMutation({
    mutationFn: () => api.claimBonus(token),
    onSuccess: (r) => {
      if (r.claimed) {
        setMsg({ ok: true, text: `✓ ${amount ? `${amount} credits` : 'Your bonus'} added to your balance` });
        void qc.invalidateQueries({ queryKey: ['balance'] });
        void qc.invalidateQueries({ queryKey: ['statement'] });
        void qc.invalidateQueries({ queryKey: ['myBets'] });
      } else {
        setMsg({ ok: false, text: `Already claimed today — next bonus ${new Date(r.nextClaimAt).toLocaleString()}` });
      }
    },
  });
  const err = claim.error instanceof ApiError ? claim.error.message : claim.error ? 'Could not claim the bonus.' : null;
  const note = err ?? msg?.text;

  return (
    <div className="bonus-card">
      <div>
        <div className="bonus-card__title">Daily Bonus</div>
        <div className="bonus-card__sub">{amount ? `Claim ${amount} of free play credits` : 'Claim free play credits'} — once a day.</div>
      </div>
      <div className="bonus-card__action">
        <button className="btn btn--green" onClick={() => claim.mutate()} disabled={claim.isPending}>
          {claim.isPending ? '…' : amount ? `Claim ${amount}` : 'Claim bonus'}
        </button>
        {note && <div className={`bonus-card__msg ${err || (msg && !msg.ok) ? 'is-muted' : 'is-ok'}`}>{note}</div>}
      </div>
    </div>
  );
}

type BetFilter = 'all' | 'open' | 'settled';

function BetsTab({ token }: { token: string }) {
  const [filter, setFilter] = useState<BetFilter>('all');
  const q = useQuery({ queryKey: ['myBets'], queryFn: () => api.myBets(token), refetchInterval: 8000 });

  if (q.isLoading) return <div className="panel"><Loading /></div>;
  if (q.isError) return <div className="panel"><ErrorState message="Couldn’t load your bets." onRetry={() => void q.refetch()} /></div>;

  const all = q.data ?? [];
  const bets = all.filter((b) => (filter === 'all' ? true : filter === 'open' ? b.status === 'open' : b.status !== 'open'));

  return (
    <div className="panel">
      <div className="acct-filter">
        {(['all', 'open', 'settled'] as BetFilter[]).map((f) => (
          <button key={f} className={`chip${filter === f ? ' on' : ''}`} onClick={() => setFilter(f)}>
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>
      {bets.length === 0 ? (
        <EmptyState icon="🎟️" title="No bets yet" hint="Tap a price on a match to place one." />
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="acct-table">
            <thead>
              <tr><th>Match</th><th>Selection</th><th>Stake</th><th>Odds</th><th>Status</th><th>P&amp;L</th></tr>
            </thead>
            <tbody>{bets.map((b) => <BetRow key={b.id} b={b} />)}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function BetRow({ b }: { b: BetHistoryDto }) {
  const pnl = b.pnl === null ? null : BigInt(b.pnl);
  const cls = pnl === null || pnl === 0n ? '' : pnl > 0n ? 'pnl-pos' : 'pnl-neg';
  const text = pnl === null ? '—' : (pnl > 0n ? '+' : '') + formatMoney(b.pnl as string);
  return (
    <tr>
      <td>{b.match}<div className="acct-sub">{b.market}</div></td>
      <td><span className={`tag tag--${b.side === 'back' ? 'back' : 'lay'}`}>{b.side === 'back' ? 'Back' : 'Lay'}</span> {b.selection}</td>
      <td className="num">{formatMoney(b.stake)}</td>
      <td className="num">{formatOdds(b.price)}</td>
      <td><span className={`sbadge sbadge--${b.status}`}>{b.status}</span></td>
      <td className={`num ${cls}`}>{text}</td>
    </tr>
  );
}

function StatementTab({ token }: { token: string }) {
  const q = useQuery({ queryKey: ['statement'], queryFn: () => api.statement(token) });
  if (q.isLoading) return <div className="panel"><Loading /></div>;
  if (q.isError) return <div className="panel"><ErrorState message="Couldn’t load your statement." onRetry={() => void q.refetch()} /></div>;
  const rows = q.data ?? [];
  return (
    <div className="panel">
      {rows.length === 0 ? (
        <EmptyState title="No credit movements yet" hint="Top-ups, bets and settlements appear here." />
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="acct-table">
            <thead><tr><th>Type</th><th>Account</th><th>Amount</th><th>When</th></tr></thead>
            <tbody>
              {rows.map((r, i) => {
                const amt = BigInt(r.amount);
                return (
                  <tr key={i}>
                    <td>{r.kind}</td>
                    <td className="acct-sub">{r.account.includes('reserved') ? 'Reserved' : 'Credits'}</td>
                    <td className={`num ${amt === 0n ? '' : amt > 0n ? 'pnl-pos' : 'pnl-neg'}`}>{(amt > 0n ? '+' : '') + formatMoney(r.amount)}</td>
                    <td className="acct-sub">{new Date(r.at).toLocaleString()}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function SettingsTab({ token, onLogout }: { token: string; onLogout: () => void }) {
  const meQ = useQuery({ queryKey: ['me'], queryFn: () => api.me(token) });
  const [cur, setCur] = useState('');
  const [nw, setNw] = useState('');
  const [ok, setOk] = useState(false);
  const change = useMutation({
    mutationFn: () => api.changePassword(token, cur, nw),
    onSuccess: () => { setOk(true); setCur(''); setNw(''); },
  });
  const err = change.error instanceof ApiError ? change.error.message : change.error ? 'Could not change password' : null;

  return (
    <div className="panel" style={{ padding: 16 }}>
      <div className="acct-me">
        <div><b>Email</b><div className="acct-sub">{meQ.data?.email ?? '—'}</div></div>
        <div><b>Status</b><div className="acct-sub">{meQ.data?.status ?? '—'}</div></div>
      </div>
      <h3 className="acct-h">Change password</h3>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (cur && nw.length >= 8) change.mutate();
        }}
        style={{ maxWidth: 360 }}
      >
        <input className="input" type="password" placeholder="Current password" autoComplete="current-password" value={cur} onChange={(e) => { setCur(e.target.value); setOk(false); }} />
        <input className="input" type="password" placeholder="New password (min 8)" autoComplete="new-password" value={nw} onChange={(e) => { setNw(e.target.value); setOk(false); }} style={{ marginTop: 8 }} />
        <button className="btn btn--green" style={{ marginTop: 10 }} disabled={!cur || nw.length < 8 || change.isPending}>
          {change.isPending ? '…' : 'Update password'}
        </button>
        {ok && <div className="msg msg--ok">✓ Password changed</div>}
        {err && <div className="msg msg--err">{err}</div>}
      </form>
      <button className="btn-link" style={{ marginTop: 18, display: 'block' }} onClick={onLogout}>Log out</button>
    </div>
  );
}
