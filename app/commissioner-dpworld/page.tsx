'use client';

// Inside the iPhone app, sends this page's /api calls to the live site (no-op on the web).
import '../native-bridge';

import { useEffect, useRef, useState } from 'react';
import { parseSpreadsheetFile, rowsToText } from '@/app/lib/spreadsheet-client';
import { getHeaderTournament, KNOCKOUT_TAB_LOGOS } from '@/app/lib/tournament-logo';

type Status = {
  active: boolean;
  count: number;
  updatedAt: string | null;
  preview: { rank: number; name: string }[];
};

const wrap: React.CSSProperties = { minHeight: '100vh', background: '#eef2f6', padding: '24px 16px', fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif' };
const card: React.CSSProperties = { maxWidth: 640, margin: '0 auto', background: '#fff', borderRadius: 16, border: '1px solid #e2e8ef', overflow: 'hidden', boxShadow: '0 8px 30px rgba(9,34,51,0.08)' };
const header: React.CSSProperties = { background: '#0f1720', padding: '18px 20px' };
const body: React.CSSProperties = { padding: 20, display: 'grid', gap: 16 };
const btn = (bg: string): React.CSSProperties => ({ background: bg, color: '#fff', border: 'none', borderRadius: 8, padding: '10px 16px', fontSize: 14, fontWeight: 700, cursor: 'pointer' });

export default function CommissionerDpWorldPage() {
  const [status, setStatus] = useState<Status | null>(null);
  const [gateError, setGateError] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [lastPreview, setLastPreview] = useState<{ rank: number; name: string }[] | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [fileName, setFileName] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const headerTournament = getHeaderTournament();

  const onFile = async (file: File) => {
    setMsg(null);
    try {
      const rows = await parseSpreadsheetFile(file);
      const asText = rowsToText(rows);
      if (!asText) { setMsg({ kind: 'err', text: 'Couldn’t read any rows from that file.' }); return; }
      setText(asText);
      setMsg({ kind: 'ok', text: `Loaded ${rows.length} rows from ${file.name}. Review below, then Save & Apply.` });
    } catch (e) {
      setMsg({ kind: 'err', text: e instanceof Error ? e.message : 'Could not read that file.' });
    }
  };

  const loadStatus = async () => {
    try {
      const res = await fetch('/api/commissioner/dpworld-rankings', { cache: 'no-store' });
      if (res.status === 401) { setGateError('Sign in to the pool as the commissioner (in the main app), then reload this page.'); return; }
      if (res.status === 403) { setGateError('This account is not the commissioner.'); return; }
      if (!res.ok) { setGateError('Could not load current rankings.'); return; }
      setGateError(null);
      setStatus(await res.json());
    } catch { setGateError('Network error loading current rankings.'); }
  };

  useEffect(() => { loadStatus(); }, []);

  const save = async () => {
    setBusy(true); setMsg(null); setLastPreview(null);
    try {
      const res = await fetch('/api/commissioner/dpworld-rankings', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg({ kind: 'err', text: data.error ?? 'Save failed.' });
        if (Array.isArray(data.skipped) && data.skipped.length) setMsg({ kind: 'err', text: `${data.error ?? 'Save failed.'} Unparsed lines: ${data.skipped.join(' | ')}` });
      } else {
        setMsg({ kind: 'ok', text: `Saved ${data.count} players.${data.skippedCount ? ` ${data.skippedCount} line(s) skipped.` : ''} The DP World bubble now uses this list.` });
        setLastPreview(data.preview ?? null);
        setText('');
        if (fileRef.current) fileRef.current.value = '';
        setFileName('');
        loadStatus();
      }
    } catch { setMsg({ kind: 'err', text: 'Network error while saving.' }); }
    setBusy(false);
  };

  const clear = async () => {
    if (!confirm('Clear the pasted list and revert to the built-in snapshot?')) return;
    setBusy(true); setMsg(null); setLastPreview(null);
    try {
      const res = await fetch('/api/commissioner/dpworld-rankings', { method: 'DELETE' });
      if (!res.ok) { const d = await res.json().catch(() => ({})); setMsg({ kind: 'err', text: d.error ?? 'Clear failed.' }); }
      else { setMsg({ kind: 'ok', text: 'Reverted to the built-in list.' }); loadStatus(); }
    } catch { setMsg({ kind: 'err', text: 'Network error while clearing.' }); }
    setBusy(false);
  };

  return (
    <div style={wrap}>
      <div style={card}>
        <div style={{ ...header, background: headerTournament.color, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
          <div>
            <button
              onClick={() => { window.location.href = '/?tab=commissioner'; }}
              style={{ display: 'inline-block', background: 'transparent', border: '1px solid #6b7b88', borderRadius: 9, color: '#8fa3b1', fontSize: 12, fontWeight: 700, cursor: 'pointer', padding: '5px 12px', marginBottom: 10 }}
            >
              ← Back to Commissioner Hub
            </button>
            <div style={{ color: '#fff', fontSize: 18, fontWeight: 900 }}>DP World Rankings</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
            <img src={KNOCKOUT_TAB_LOGOS[headerTournament.id] ?? headerTournament.logo} alt={headerTournament.name} style={{ height: headerTournament.id === 'pga' ? 60 : headerTournament.id === 'players' ? 52 : headerTournament.id === 'open' ? 40 : headerTournament.id === 'masters' ? undefined : 36, width: headerTournament.id === 'masters' ? 120 : undefined, margin: headerTournament.id === 'pga' ? '-8px 0' : headerTournament.id === 'players' ? '-4px 0' : undefined, maxWidth: 120, objectFit: 'contain', display: 'block' }} />
          </div>
        </div>

        {gateError ? (
          <div style={{ ...body }}>
            <div style={{ background: '#fef2f2', color: '#b42318', border: '1px solid #fecdca', borderRadius: 8, padding: '12px 14px', fontSize: 14 }}>{gateError}</div>
          </div>
        ) : (
          <div style={body}>
            {/* Instructions */}
            <div style={{ fontSize: 12.5, color: '#607282', lineHeight: 1.5 }}>
              Columns: <b>Rank</b>, <b>Player Name</b> (a header row is fine — it&apos;s skipped). Upload the
              <b> .xlsx</b>/<b>.csv</b> file, or paste the rows. Each line starts with the rank; names in
              <code style={{ background: '#f1f5f9', padding: '1px 5px', borderRadius: 4 }}>LASTNAME, First</code>{' '}
              form are reordered automatically, and trailing points columns are ignored.
            </div>

            {status?.active && status.updatedAt && (
              <div style={{ fontSize: 12.5, fontWeight: 700, color: '#475569' }}>
                Last updated: {new Date(status.updatedAt).toLocaleString()}{status.count ? ` · ${status.count} players` : ''}
              </div>
            )}

            {/* File upload */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.csv"
                onChange={(e) => { const f = e.target.files?.[0]; setFileName(f ? f.name : ''); if (f) onFile(f); }}
                style={{ display: 'none' }}
              />
              <button type="button" onClick={() => fileRef.current?.click()} style={{ fontSize: 13, fontWeight: 700, padding: '9px 16px', borderRadius: 9, border: '1px solid #cbd5e1', background: '#f8fafc', color: '#0f1720', cursor: 'pointer' }}>Choose File</button>
              <span style={{ fontSize: 14, color: '#64748b' }}>{fileName || 'No file selected'}</span>
            </div>

            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={'1 Rory McIlroy\n2 Tyrrell Hatton\n3 Aaron Rai\n...'}
              rows={12}
              style={{ width: '100%', boxSizing: 'border-box', border: '1px solid #cbd5e1', borderRadius: 8, padding: 12, fontSize: 13, fontFamily: 'ui-monospace,SFMono-Regular,Menlo,monospace', resize: 'vertical' }}
            />

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button onClick={() => setConfirmOpen(true)} disabled={busy || !text.trim()} style={{ ...btn('#2c6449'), opacity: busy || !text.trim() ? 0.5 : 1 }}>{busy ? 'Saving…' : 'Save & Apply'}</button>
              {status?.active && <button onClick={clear} disabled={busy} style={{ ...btn('#64748b'), opacity: busy ? 0.5 : 1 }}>Clear (use built-in list)</button>}
            </div>

            {msg && (
              <div style={{ background: msg.kind === 'ok' ? '#ecfdf3' : '#fef2f2', color: msg.kind === 'ok' ? '#027a48' : '#b42318', border: `1px solid ${msg.kind === 'ok' ? '#a6f4c5' : '#fecdca'}`, borderRadius: 8, padding: '10px 14px', fontSize: 13 }}>{msg.text}</div>
            )}

            {(lastPreview ?? status?.preview ?? []).length > 0 && (
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#607282', marginBottom: 6 }}>CURRENT LIST ({(lastPreview ?? status?.preview ?? []).length}) · SCROLL TO SEE ALL</div>
                <div style={{ border: '1px solid #e2e8ef', borderRadius: 8, overflow: 'hidden' }}>
                  <div style={{ maxHeight: 360, overflowY: 'auto' }}>
                    {(lastPreview ?? status?.preview ?? []).map((p, i) => (
                      <div key={`${p.rank}-${p.name}`} style={{ display: 'flex', gap: 10, padding: '6px 12px', fontSize: 13, background: i % 2 ? '#f8fafc' : '#fff', borderBottom: '1px solid #eef2f6' }}>
                        <span style={{ width: 28, color: '#94a3b8', fontWeight: 700 }}>{p.rank}</span>
                        <span style={{ color: '#0f1720', fontWeight: 600 }}>{p.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {confirmOpen && (
        <div
          onClick={() => setConfirmOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,32,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, zIndex: 1000 }}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ width: 'min(380px, calc(100vw - 32px))', background: '#fff', borderRadius: 16, padding: '24px 22px', boxShadow: '0 24px 60px rgba(9,34,51,0.3)', textAlign: 'center' }}>
            <div style={{ fontSize: 17, fontWeight: 800, color: '#0f1720', marginBottom: 10 }}>Save &amp; apply this list?</div>
            <div style={{ fontSize: 13, color: '#5b6b79', lineHeight: 1.55, marginBottom: 22 }}>This overrides the DP World (Race to Dubai) rankings the pool uses with the list above.</div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setConfirmOpen(false)} style={{ flex: 1, padding: '11px 0', borderRadius: 10, border: '1px solid #d1dae3', background: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer', color: '#374151' }}>Cancel</button>
              <button onClick={() => { setConfirmOpen(false); void save(); }} style={{ flex: 1, padding: '11px 0', borderRadius: 10, border: 'none', background: '#2c6449', color: '#fff', fontWeight: 800, fontSize: 14, cursor: 'pointer' }}>Save &amp; Apply</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
