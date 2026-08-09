import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { EmptyState, ErrorState, Loading } from '../components/States';
import { api, ApiError } from '../lib/api';
import { useAuth } from '../lib/auth';
import { formatMoney } from '../lib/format';
import type { MarketDto } from '../lib/types';

type Tab = 'pending' | 'matches' | 'audit';

export function AdminPage() {
  const { token } = useAuth();
  const meQ = useQuery({ queryKey: ['me'], queryFn: () => api.me(token as string), enabled: !!token });

  if (!token) return <Navigate to="/login" replace />;
  if (meQ.isLoading) return <div className="panel"><Loading /></div>;
  const role = meQ.data?.role;
  if (role !== 'trader' && role !== 'admin') {
    return <div className="panel"><EmptyState icon="🔒" title="Operator access only" hint="This console is limited to trader / admin accounts." /></div>;
  }
  return <Console token={token} />;
}

function Console({ token }: { token: string }) {
  const [tab, setTab] = useState<Tab>('pending');
  return (
    <div>
      <div className="panel" style={{ marginBottom: 10 }}>
        <div className="panel__bar">Operator Console</div>
        <div className="tabs" style={{ padding: '8px 8px 0' }}>
          {(['pending', 'matches', 'audit'] as Tab[]).map((t) => (
            <div key={t} className={`tab${tab === t ? ' active' : ''}`} onClick={() => setTab(t)}>
              {t === 'pending' ? 'Pending' : t === 'matches' ? 'Matches' : 'Audit'}
            </div>
          ))}
        </div>
      </div>
      {tab === 'pending' && <PendingTab token={token} />}
      {tab === 'matches' && <MatchesTab token={token} />}
      {tab === 'audit' && <AuditTab token={token} />}
    </div>
  );
}

function PendingTab({ token }: { token: string }) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['pending'], queryFn: () => api.pendingActions(token), refetchInterval: 6000 });
  const [msg, setMsg] = useState<string | null>(null);
  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ['pending'] });
    void qc.invalidateQueries({ queryKey: ['audit'] });
  };
  const approve = useMutation({
    mutationFn: (id: string) => api.approveAction(token, id),
    onSuccess: () => { setMsg('✓ Approved & executed'); invalidate(); },
    onError: (e) => setMsg(e instanceof ApiError ? e.message : 'Failed'),
  });
  const reject = useMutation({
    mutationFn: (id: string) => api.rejectAction(token, id, 'rejected by operator'),
    onSuccess: () => { setMsg('Rejected'); invalidate(); },
    onError: (e) => setMsg(e instanceof ApiError ? e.message : 'Failed'),
  });

  if (q.isLoading) return <div className="panel"><Loading /></div>;
  if (q.isError) return <div className="panel"><ErrorState message="Couldn’t load the queue." onRetry={() => void q.refetch()} /></div>;
  const rows = q.data ?? [];

  return (
    <div className="panel">
      {msg && <div className="admin-msg">{msg}</div>}
      {rows.length === 0 ? (
        <EmptyState title="No pending actions" hint="Proposed void / result actions await a second operator here (four-eyes)." />
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="acct-table">
            <thead><tr><th>Kind</th><th>Market</th><th>Proposed by</th><th>When</th><th /></tr></thead>
            <tbody>
              {rows.map((a) => (
                <tr key={a.id}>
                  <td><span className="sbadge sbadge--open">{a.kind}</span></td>
                  <td className="acct-sub mono">{a.marketId.slice(0, 8)}</td>
                  <td>{a.proposedBy}</td>
                  <td className="acct-sub">{new Date(a.createdAt).toLocaleString()}</td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <button className="chip on" onClick={() => approve.mutate(a.id)}>Approve</button>{' '}
                    <button className="chip" onClick={() => reject.mutate(a.id)}>Reject</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function MatchesTab({ token }: { token: string }) {
  const qc = useQueryClient();
  const matchesQ = useQuery({ queryKey: ['matches'], queryFn: api.matches });
  const [sel, setSel] = useState<string>('');
  const matchQ = useQuery({ queryKey: ['match', sel], queryFn: () => api.match(sel), enabled: !!sel });
  const expQ = useQuery({ queryKey: ['exposure', sel], queryFn: () => api.exposureMatch(token, sel), enabled: !!sel });
  const [msg, setMsg] = useState<string | null>(null);

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ['match', sel] });
    void qc.invalidateQueries({ queryKey: ['exposure', sel] });
    void qc.invalidateQueries({ queryKey: ['pending'] });
    void qc.invalidateQueries({ queryKey: ['audit'] });
  };
  const act = (p: Promise<unknown>, ok: string) =>
    void p.then(() => { setMsg(ok); invalidate(); }, (e: unknown) => setMsg(e instanceof ApiError ? e.message : 'Failed'));

  const match = matchQ.data;
  const mo = match?.markets.find((m) => m.type === 'match_odds');

  return (
    <div className="panel" style={{ padding: 12 }}>
      <select className="input" value={sel} onChange={(e) => setSel(e.target.value)} style={{ maxWidth: 340 }} aria-label="Select match">
        <option value="">Select a match…</option>
        {(matchesQ.data ?? []).map((m) => <option key={m.id} value={m.id}>{m.name} — {m.status}</option>)}
      </select>
      {msg && <div className="admin-msg">{msg}</div>}

      {matchQ.isLoading && sel && <Loading />}
      {match && (
        <>
          <div className="admin-exp">Book liability (match): <b>{expQ.data ? formatMoney(expQ.data.liability) : '—'}</b></div>
          <div style={{ overflowX: 'auto' }}>
            <table className="acct-table" style={{ marginTop: 8 }}>
              <thead><tr><th>Market</th><th>Status</th><th /></tr></thead>
              <tbody>
                {match.markets.map((m: MarketDto) => (
                  <tr key={m.id}>
                    <td>{m.name}<div className="acct-sub mono">{m.type} · {m.id.slice(0, 8)}</div></td>
                    <td><span className={`sbadge sbadge--${m.status === 'settled' ? 'won' : m.status === 'suspended' ? 'lost' : 'open'}`}>{m.status}</span></td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      {m.status === 'open' && <button className="chip" onClick={() => act(api.suspendMarket(token, m.id), 'Suspended')}>Suspend</button>}
                      {m.status === 'suspended' && <button className="chip" onClick={() => act(api.reopenMarket(token, m.id), 'Reopened')}>Reopen</button>}{' '}
                      {m.status !== 'settled' && (
                        <button className="chip" onClick={() => act(api.proposeAction(token, { kind: 'void', marketId: m.id, reason: 'operator void' }), 'Void proposed — needs a 2nd operator')}>
                          Void…
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {mo && <DeclareResult token={token} matchId={match.id} runners={mo.runners} onDone={(text) => { setMsg(text); invalidate(); }} />}
        </>
      )}
    </div>
  );
}

function DeclareResult({ token, matchId, runners, onDone }: { token: string; matchId: string; runners: { id: string; name: string }[]; onDone: (t: string) => void }) {
  const [winner, setWinner] = useState('');
  const declare = useMutation({
    mutationFn: () => api.declareResult(token, matchId, { winner, reason: 'declared result' }),
    onSuccess: () => { onDone('Result proposed — a second operator must approve it'); setWinner(''); },
    onError: (e) => onDone(e instanceof ApiError ? e.message : 'Failed'),
  });
  return (
    <div className="admin-declare">
      <b>Declare match result</b>
      <div className="admin-declare__row">
        <select className="input" value={winner} onChange={(e) => setWinner(e.target.value)} aria-label="Winner">
          <option value="">Winner…</option>
          {runners.map((r) => <option key={r.id} value={r.name}>{r.name}</option>)}
        </select>
        <button className="btn btn--green" disabled={!winner || declare.isPending} onClick={() => declare.mutate()}>Propose result</button>
      </div>
    </div>
  );
}

function AuditTab({ token }: { token: string }) {
  const q = useQuery({ queryKey: ['audit'], queryFn: () => api.auditLog(token), refetchInterval: 8000 });
  if (q.isLoading) return <div className="panel"><Loading /></div>;
  if (q.isError) return <div className="panel"><ErrorState message="Couldn’t load the audit log." onRetry={() => void q.refetch()} /></div>;
  const rows = q.data ?? [];
  return (
    <div className="panel">
      {rows.length === 0 ? (
        <EmptyState title="No audit entries yet" hint="Every operator action is recorded here, attributable and immutable." />
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="acct-table">
            <thead><tr><th>When</th><th>Actor</th><th>Action</th><th>Subject</th></tr></thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>
                  <td className="acct-sub">{new Date(r.at).toLocaleString()}</td>
                  <td>{r.actor}</td>
                  <td className="mono">{r.action}</td>
                  <td className="acct-sub mono">{r.subject ? r.subject.slice(0, 8) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
