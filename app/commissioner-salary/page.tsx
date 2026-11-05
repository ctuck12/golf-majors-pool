'use client';

// Inside the iPhone app, sends this page's /api calls to the live site (no-op on the web).
import '../native-bridge';

import { useEffect, useRef, useState } from 'react';
import { getHeaderTournament, TOURNAMENT_OPTIONS, KNOCKOUT_TAB_LOGOS } from '@/app/lib/tournament-logo';

type Status = { active: boolean; count: number; updatedAt: string | null };
type SaveResp = {
  ok?: boolean; error?: string; count?: number; updatedAt?: string;
  matchedCount?: number; worldRankCount?: number; unmatchedCount?: number;
  autoAddedCount?: number; newlyAddedCount?: number; newlyAdded?: string[];
  amateurCount?: number; clubProCount?: number;
  unmatched?: { name: string; salary: number }[];
  skipped?: string[];
  preview?: { id: number; name: string; salary: number; worldRank: number | null }[];
};

const wrap: React.CSSProperties = { minHeight: '100vh', background: '#eef2f6', padding: '24px 16px', fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif' };
const card: React.CSSProperties = { maxWidth: 640, margin: '0 auto', background: '#fff', borderRadius: 16, border: '1px solid #e2e8ef', overflow: 'hidden', boxShadow: '0 8px 30px rgba(9,34,51,0.08)' };
const header: React.CSSProperties = { background: '#0f1720', padding: '18px 20px' };
const body: React.CSSProperties = { padding: 20, display: 'grid', gap: 16 };
const btn = (bg: string): React.CSSProperties => ({ background: bg, color: '#fff', border: 'none', borderRadius: 8, padding: '10px 16px', fontSize: 14, fontWeight: 700, cursor: 'pointer' });

// ── Dependency-free .xlsx reader (ZIP + inline/shared-string XML) ─────────────────────────────────
async function inflateRaw(bytes: Uint8Array): Promise<Uint8Array> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ds = new (window as any).DecompressionStream('deflate-raw');
  const stream = new Response(new Blob([bytes as BlobPart]).stream().pipeThrough(ds));
  return new Uint8Array(await stream.arrayBuffer());
}
const unesc = (s: string) => s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_m, d) => String.fromCharCode(+d));
function colIdx(ref: string): number { const m = /^([A-Z]+)/.exec(ref); if (!m) return 0; let n = 0; for (const ch of m[1]) n = n * 26 + (ch.charCodeAt(0) - 64); return n - 1; }

async function parseXlsx(buf: ArrayBuffer): Promise<string[][]> {
  const bytes = new Uint8Array(buf);
  const dv = new DataView(buf);
  const u16 = (o: number) => dv.getUint16(o, true);
  const u32 = (o: number) => dv.getUint32(o, true);
  let eocd = -1;
  for (let i = bytes.length - 22; i >= 0; i--) { if (u32(i) === 0x06054b50) { eocd = i; break; } }
  if (eocd < 0) throw new Error('That doesn’t look like a valid .xlsx file.');
  const cdOffset = u32(eocd + 16), cdCount = u16(eocd + 10);
  const dec = new TextDecoder();
  const files: Record<string, string> = {};
  let p = cdOffset;
  for (let n = 0; n < cdCount; n++) {
    if (u32(p) !== 0x02014b50) break;
    const method = u16(p + 10), compSize = u32(p + 20), nameLen = u16(p + 28), extraLen = u16(p + 30), commentLen = u16(p + 32), localOffset = u32(p + 42);
    const name = dec.decode(bytes.subarray(p + 46, p + 46 + nameLen));
    if (name === 'xl/worksheets/sheet1.xml' || name === 'xl/sharedStrings.xml') {
      const lhNameLen = u16(localOffset + 26), lhExtraLen = u16(localOffset + 28);
      const dataStart = localOffset + 30 + lhNameLen + lhExtraLen;
      const comp = bytes.subarray(dataStart, dataStart + compSize);
      const data = method === 0 ? comp : await inflateRaw(comp);
      files[name] = dec.decode(data);
    }
    p += 46 + nameLen + extraLen + commentLen;
  }
  const shared: string[] = [];
  const ss = files['xl/sharedStrings.xml'] || '';
  for (const m of ss.matchAll(/<(?:\w+:)?si>([\s\S]*?)<\/(?:\w+:)?si>/g)) {
    const txt = [...m[1].matchAll(/<(?:\w+:)?t[^>]*>([\s\S]*?)<\/(?:\w+:)?t>/g)].map((x) => x[1]).join('');
    shared.push(unesc(txt));
  }
  const sheet = files['xl/worksheets/sheet1.xml'] || '';
  const rows: string[][] = [];
  for (const rm of sheet.matchAll(/<(?:\w+:)?row\b[^>]*>([\s\S]*?)<\/(?:\w+:)?row>/g)) {
    const cells: string[] = [];
    for (const cm of rm[1].matchAll(/<(?:\w+:)?c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/(?:\w+:)?c>)/g)) {
      const attrs = cm[1] || '', inner = cm[2];
      const t = (/\bt="([^"]*)"/.exec(attrs) || [])[1];
      const r = (/\br="([^"]*)"/.exec(attrs) || [])[1];
      let val = '';
      if (inner) {
        const vm = /<(?:\w+:)?v>([\s\S]*?)<\/(?:\w+:)?v>/.exec(inner);
        const im = /<(?:\w+:)?is>[\s\S]*?<(?:\w+:)?t[^>]*>([\s\S]*?)<\/(?:\w+:)?t>/.exec(inner);
        if (vm) val = vm[1]; else if (im) val = im[1];
      }
      if (t === 's') val = shared[parseInt(val, 10)] || ''; else val = unesc(val);
      const ci = r ? colIdx(r) : cells.length;
      cells[ci] = val;
    }
    rows.push(cells);
  }
  return rows;
}

// Turn parsed spreadsheet rows into the tab-separated text our save endpoint parses.
function rowsToText(rows: string[][]): string {
  return rows
    .map((r) => r.map((c) => (c ?? '').toString().trim()).filter((c) => c !== '').join('\t'))
    .filter((line) => line.length > 0)
    .join('\n');
}

export default function CommissionerSalaryPage() {
  const [status, setStatus] = useState<Status | null>(null);
  const [gateError, setGateError] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [resp, setResp] = useState<SaveResp | null>(null);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [fileName, setFileName] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  // Full Tournament Field upload — registers every field player in the pool without giving them a
  // salary, so they exist in the pool DB but don't appear on the pick sheet.
  const [fieldText, setFieldText] = useState('');
  const [fieldBusy, setFieldBusy] = useState(false);
  const [fieldMsg, setFieldMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [fieldFileName, setFieldFileName] = useState('');
  const [fieldRegistered, setFieldRegistered] = useState<number | null>(null);
  const [fieldUpdatedAt, setFieldUpdatedAt] = useState<string | null>(null); // persists across reloads
  const [fieldAdded, setFieldAdded] = useState<string[]>([]); // brand-new names from the last field upload
  const fieldFileRef = useRef<HTMLInputElement>(null);
  // PGA Professionals upload (PGA Championship only) — a plain list of names that each get the PGA seal.
  const [proText, setProText] = useState('');
  const [proBusy, setProBusy] = useState(false);
  const [proMsg, setProMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [proFileName, setProFileName] = useState('');
  const [proNames, setProNames] = useState<string[]>([]); // names flagged by the last pro upload
  const [proCount, setProCount] = useState<number | null>(null); // total club pros currently flagged
  const proFileRef = useRef<HTMLInputElement>(null);
  const headerTournament = getHeaderTournament();
  const isPgaChampionship = headerTournament.id === 'pga';
  // Which tournament the Salary Pick List upload targets. Defaults to the current event, but the
  // commissioner can switch it to backfill a past tournament's salaries (each event is stored
  // separately now, so uploading one no longer wipes another).
  const [salaryTid, setSalaryTid] = useState(headerTournament.id);
  const salaryTournamentName = TOURNAMENT_OPTIONS.find((t) => t.id === salaryTid)?.name ?? headerTournament.name;

  const loadStatus = async () => {
    try {
      const res = await fetch(`/api/commissioner/salary-overrides?tournamentId=${salaryTid}`, { cache: 'no-store' });
      if (res.status === 401) { setGateError('Sign in to the pool as the commissioner (in the main app), then reload this page.'); return; }
      if (res.status === 403) { setGateError('This account is not the commissioner.'); return; }
      if (!res.ok) { setGateError('Could not load current salaries.'); return; }
      setGateError(null);
      setStatus(await res.json());
    } catch { setGateError('Network error loading current salaries.'); }
  };
  const loadFieldStatus = async () => {
    try {
      const res = await fetch('/api/commissioner/tournament-field', { cache: 'no-store' });
      if (res.ok) {
        const d = await res.json();
        setFieldRegistered(typeof d.registered === 'number' ? d.registered : null);
        setFieldUpdatedAt(typeof d.updatedAt === 'string' ? d.updatedAt : null);
      }
    } catch { /* ignore */ }
  };
  const loadProStatus = async () => {
    try {
      const res = await fetch('/api/commissioner/pga-professionals', { cache: 'no-store' });
      if (res.ok) { const d = await res.json(); setProCount(typeof d.clubProCount === 'number' ? d.clubProCount : null); }
    } catch { /* ignore */ }
  };
  useEffect(() => { loadStatus(); loadFieldStatus(); loadProStatus(); }, []);
  // Reload the salary status whenever the target tournament changes (so "Last updated" reflects it).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadStatus(); }, [salaryTid]);

  const readFileToText = async (file: File): Promise<string | null> => {
    let rows: string[][];
    if (/\.csv$/i.test(file.name)) {
      rows = (await file.text()).split(/\r?\n/).map((l) => l.split(','));
    } else if (/\.xlsx$/i.test(file.name)) {
      rows = await parseXlsx(await file.arrayBuffer());
    } else {
      return null;
    }
    return rowsToText(rows);
  };

  const onFieldFile = async (file: File) => {
    setFieldMsg(null);
    try {
      const asText = await readFileToText(file);
      if (asText === null) { setFieldMsg({ kind: 'err', text: 'Please choose a .xlsx or .csv file (or paste below).' }); return; }
      if (!asText) { setFieldMsg({ kind: 'err', text: 'Couldn’t read any rows from that file.' }); return; }
      setFieldText(asText);
      setFieldMsg({ kind: 'ok', text: `Loaded field from ${file.name}. Review below, then Register Field.` });
    } catch (e) {
      setFieldMsg({ kind: 'err', text: e instanceof Error ? e.message : 'Could not read that file.' });
    }
  };

  const saveField = async () => {
    setFieldBusy(true); setFieldMsg(null); setFieldAdded([]);
    try {
      const res = await fetch('/api/commissioner/tournament-field', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: fieldText }),
      });
      const data = await res.json();
      if (!res.ok) setFieldMsg({ kind: 'err', text: data.error ?? 'Register failed.' });
      else {
        setFieldMsg({ kind: 'ok', text: `Field: ${data.fieldCount} players — ${data.alreadyInPool} already in the pool, ${data.newlyAdded} newly added${typeof data.newlyAddedWithStats === 'number' ? ` (${data.newlyAddedWithStats} auto-linked to full PGA Tour stats)` : ''}.${data.amateurCount ? ` ${data.amateurCount} amateur(s) flagged.` : ''}${data.clubProCount ? ` ${data.clubProCount} club pro(s) flagged.` : ''} This does not affect the pick list.` });
        setFieldAdded(Array.isArray(data.addedNames) ? data.addedNames : []);
        setFieldText('');
        if (fieldFileRef.current) fieldFileRef.current.value = '';
        setFieldFileName('');
        loadFieldStatus();
      }
    } catch { setFieldMsg({ kind: 'err', text: 'Network error while registering the field.' }); }
    setFieldBusy(false);
  };

  const clearField = async () => {
    if (!confirm('Clear every registered field player? This removes all auto-added players (from field AND salary uploads) from the pool, reverting to just the built-in draft pool. Salaries on the pick sheet are not affected.')) return;
    setFieldBusy(true); setFieldMsg(null); setFieldAdded([]);
    try {
      const res = await fetch('/api/commissioner/tournament-field', { method: 'DELETE' });
      if (!res.ok) { const d = await res.json().catch(() => ({})); setFieldMsg({ kind: 'err', text: d.error ?? 'Clear failed.' }); }
      else { setFieldMsg({ kind: 'ok', text: 'Cleared all registered field players.' }); loadFieldStatus(); }
    } catch { setFieldMsg({ kind: 'err', text: 'Network error while clearing the field.' }); }
    setFieldBusy(false);
  };

  const onProFile = async (file: File) => {
    setProMsg(null);
    try {
      const asText = await readFileToText(file);
      if (asText === null) { setProMsg({ kind: 'err', text: 'Please choose a .xlsx or .csv file (or paste below).' }); return; }
      if (!asText) { setProMsg({ kind: 'err', text: 'Couldn’t read any names from that file.' }); return; }
      setProText(asText);
      setProMsg({ kind: 'ok', text: `Loaded names from ${file.name}. Review below, then Give PGA Seal.` });
    } catch (e) {
      setProMsg({ kind: 'err', text: e instanceof Error ? e.message : 'Could not read that file.' });
    }
  };

  const savePros = async () => {
    setProBusy(true); setProMsg(null); setProNames([]);
    try {
      const res = await fetch('/api/commissioner/pga-professionals', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: proText }),
      });
      const data = await res.json();
      if (!res.ok) setProMsg({ kind: 'err', text: data.error ?? 'Upload failed.' });
      else {
        setProMsg({ kind: 'ok', text: `${data.submitted} name(s) flagged as PGA Professionals — they now show the PGA seal in their bio. ${data.clubProCount} club pro(s) flagged in total.` });
        setProNames(Array.isArray(data.names) ? data.names : []);
        setProText('');
        if (proFileRef.current) proFileRef.current.value = '';
        setProFileName('');
        loadProStatus();
      }
    } catch { setProMsg({ kind: 'err', text: 'Network error while uploading.' }); }
    setProBusy(false);
  };

  const onFile = async (file: File) => {
    setMsg(null); setResp(null);
    try {
      let rows: string[][];
      if (/\.csv$/i.test(file.name)) {
        rows = (await file.text()).split(/\r?\n/).map((l) => l.split(','));
      } else if (/\.xlsx$/i.test(file.name)) {
        rows = await parseXlsx(await file.arrayBuffer());
      } else {
        setMsg({ kind: 'err', text: 'Please choose a .xlsx or .csv file (or paste below).' }); return;
      }
      const asText = rowsToText(rows);
      if (!asText) { setMsg({ kind: 'err', text: 'Couldn’t read any rows from that file.' }); return; }
      setText(asText);
      setMsg({ kind: 'ok', text: `Loaded ${rows.length} rows from ${file.name}. Review below, then Save & Apply.` });
    } catch (e) {
      setMsg({ kind: 'err', text: e instanceof Error ? e.message : 'Could not read that file.' });
    }
  };

  const save = async () => {
    setBusy(true); setMsg(null); setResp(null);
    try {
      const res = await fetch('/api/commissioner/salary-overrides', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text, tournamentId: salaryTid }),
      });
      const data = (await res.json()) as SaveResp;
      setResp(data);
      if (!res.ok) setMsg({ kind: 'err', text: data.error ?? 'Save failed.' });
      else {
        setMsg({ kind: 'ok', text: `Saved ${data.count} players — salaries${data.worldRankCount ? ` and ${data.worldRankCount} world ranks` : ''} applied to the pick sheet.${data.autoAddedCount ? ` ${data.autoAddedCount} new name(s) were auto-added to the pool.` : ''}${data.amateurCount ? ` ${data.amateurCount} amateur(s) flagged.` : ''}${data.clubProCount ? ` ${data.clubProCount} club pro(s) flagged.` : ''}` });
        setText('');
        if (fileRef.current) fileRef.current.value = '';
        setFileName('');
        loadStatus();
      }
    } catch { setMsg({ kind: 'err', text: 'Network error while saving.' }); }
    setBusy(false);
  };

  const clear = async () => {
    if (!confirm('Clear the uploaded salary list for this tournament? The pick sheet will have no players until a new list is uploaded.')) return;
    setBusy(true); setMsg(null); setResp(null);
    try {
      const res = await fetch(`/api/commissioner/salary-overrides?tournamentId=${salaryTid}`, { method: 'DELETE' });
      if (!res.ok) { const d = await res.json().catch(() => ({})); setMsg({ kind: 'err', text: d.error ?? 'Clear failed.' }); }
      else { setMsg({ kind: 'ok', text: 'Salary list cleared.' }); loadStatus(); }
    } catch { setMsg({ kind: 'err', text: 'Network error while clearing.' }); }
    setBusy(false);
  };

  const salaryNewlyAdded = resp?.newlyAdded ?? [];

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
            <div style={{ color: '#fff', fontSize: 18, fontWeight: 900 }}>Salary Pick List</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
            <img src={KNOCKOUT_TAB_LOGOS[headerTournament.id] ?? headerTournament.logo} alt={headerTournament.name} style={{ height: headerTournament.id === 'pga' ? 60 : headerTournament.id === 'players' ? 52 : headerTournament.id === 'open' ? 40 : headerTournament.id === 'masters' ? undefined : 36, width: headerTournament.id === 'masters' ? 120 : undefined, margin: headerTournament.id === 'pga' ? '-8px 0' : headerTournament.id === 'players' ? '-4px 0' : undefined, maxWidth: 120, objectFit: 'contain', display: 'block' }} />
          </div>
        </div>

        {gateError ? (
          <div style={body}>
            <div style={{ background: '#fef2f2', color: '#b42318', border: '1px solid #fecdca', borderRadius: 8, padding: '12px 14px', fontSize: 14 }}>{gateError}</div>
          </div>
        ) : (
          <div style={body}>
            {/* ── Full Tournament Field (registers everyone in the pool, no salaries) ── */}
            <div style={{ border: '1px solid #dbe3ec', borderRadius: 12, padding: 14, display: 'grid', gap: 10, background: '#f8fafc' }}>
              <div style={{ fontSize: 14, fontWeight: 900, color: '#0f1720' }}>Full Tournament Field</div>
              <div style={{ fontSize: 12.5, color: '#607282', lineHeight: 1.5 }}>
                Upload the <b>entire field</b> — one player name per line (a leading rank number is fine). This registers everyone in the pool so their photo/bio resolve, <b>without</b> giving them a salary, so it does <b>not</b> change the pick sheet.
                {' '}<b>Amateurs are flagged automatically</b> from the standard <b>(a)</b> marker most field lists already include — they get a red “AMATEUR” in their bio, no action needed.
                {fieldRegistered != null && fieldRegistered > 0 && <span> Currently <b>{fieldRegistered}</b> extra player(s) registered.</span>}
              </div>
              {fieldUpdatedAt && (
                <div style={{ fontSize: 12.5, fontWeight: 700, color: '#475569' }}>
                  Last updated: {new Date(fieldUpdatedAt).toLocaleString()}{fieldRegistered ? ` · ${fieldRegistered} registered` : ''}
                </div>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <input
                  ref={fieldFileRef}
                  type="file"
                  accept=".xlsx,.csv"
                  onChange={(e) => { const f = e.target.files?.[0]; setFieldFileName(f ? f.name : ''); if (f) onFieldFile(f); }}
                  style={{ display: 'none' }}
                />
                <button type="button" onClick={() => fieldFileRef.current?.click()} style={{ fontSize: 13, fontWeight: 700, padding: '9px 16px', borderRadius: 9, border: '1px solid #cbd5e1', background: '#fff', color: '#0f1720', cursor: 'pointer' }}>Choose File</button>
                <span style={{ fontSize: 14, color: '#64748b' }}>{fieldFileName || 'No file selected'}</span>
              </div>
              <textarea
                value={fieldText}
                onChange={(e) => setFieldText(e.target.value)}
                placeholder={'Scottie Scheffler\nRory McIlroy\nJon Rahm\n...'}
                rows={6}
                style={{ width: '100%', boxSizing: 'border-box', border: '1px solid #cbd5e1', borderRadius: 8, padding: 12, fontSize: 13, fontFamily: 'ui-monospace,SFMono-Regular,Menlo,monospace', resize: 'vertical' }}
              />
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button onClick={saveField} disabled={fieldBusy || !fieldText.trim()} style={{ ...btn('#173b63'), opacity: fieldBusy || !fieldText.trim() ? 0.5 : 1 }}>{fieldBusy ? 'Registering…' : 'Register Field'}</button>
                {fieldRegistered != null && fieldRegistered > 0 && <button onClick={clearField} disabled={fieldBusy} style={{ ...btn('#64748b'), opacity: fieldBusy ? 0.5 : 1 }}>Clear</button>}
              </div>
              {fieldMsg && (
                <div style={{ background: fieldMsg.kind === 'ok' ? '#ecfdf3' : '#fef2f2', color: fieldMsg.kind === 'ok' ? '#027a48' : '#b42318', border: `1px solid ${fieldMsg.kind === 'ok' ? '#a6f4c5' : '#fecdca'}`, borderRadius: 8, padding: '10px 14px', fontSize: 13 }}>{fieldMsg.text}</div>
              )}
              {fieldAdded.length > 0 && (
                <div style={{ border: '1px solid #dbe3ec', borderRadius: 8, overflow: 'hidden' }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: '#173b63', padding: '8px 12px', background: '#eef4fb' }}>NEWLY ADDED TO THE POOL ({fieldAdded.length})</div>
                  <div style={{ maxHeight: 220, overflowY: 'auto' }}>
                    {fieldAdded.map((n, i) => (
                      <div key={n} style={{ padding: '5px 12px', fontSize: 13, color: '#0f1720', background: i % 2 ? '#f8fafc' : '#fff', borderBottom: '1px solid #eef2f6' }}>{n}</div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* ── PGA Professionals (PGA Championship only) — plain name list, each gets the PGA seal ── */}
            {isPgaChampionship && (
              <div style={{ border: '1px solid #e6dcc2', borderRadius: 12, padding: 14, display: 'grid', gap: 10, background: '#fbf8f0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <img src="/pga-seal-gold.png" alt="PGA" style={{ height: 26, objectFit: 'contain', flexShrink: 0 }} />
                  <div style={{ fontSize: 14, fontWeight: 900, color: '#0f1720' }}>PGA Professionals</div>
                </div>
                <div style={{ fontSize: 12.5, color: '#6b5f43', lineHeight: 1.5 }}>
                  Upload just the <b>PGA Club Professionals</b> — one name per line (a leading number is fine). Each name gets the <b>PGA seal</b> in their bio header automatically, so you don&apos;t have to mark <code>(c)</code> in the field or salary uploads. Additive — re-uploading is safe.
                  {proCount != null && proCount > 0 && <span> Currently <b>{proCount}</b> club pro(s) flagged.</span>}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <input
                    ref={proFileRef}
                    type="file"
                    accept=".xlsx,.csv"
                    onChange={(e) => { const f = e.target.files?.[0]; setProFileName(f ? f.name : ''); if (f) onProFile(f); }}
                    style={{ display: 'none' }}
                  />
                  <button type="button" onClick={() => proFileRef.current?.click()} style={{ fontSize: 13, fontWeight: 700, padding: '9px 16px', borderRadius: 9, border: '1px solid #d8c99e', background: '#fff', color: '#0f1720', cursor: 'pointer' }}>Choose File</button>
                  <span style={{ fontSize: 14, color: '#8a7d5c' }}>{proFileName || 'No file selected'}</span>
                </div>
                <textarea
                  value={proText}
                  onChange={(e) => setProText(e.target.value)}
                  placeholder={'Michael Block\nBraden Shattuck\nJesse Droemer\n...'}
                  rows={6}
                  style={{ width: '100%', boxSizing: 'border-box', border: '1px solid #d8c99e', borderRadius: 8, padding: 12, fontSize: 13, fontFamily: 'ui-monospace,SFMono-Regular,Menlo,monospace', resize: 'vertical' }}
                />
                <div>
                  <button onClick={savePros} disabled={proBusy || !proText.trim()} style={{ ...btn('#B09963'), opacity: proBusy || !proText.trim() ? 0.5 : 1 }}>{proBusy ? 'Applying…' : 'Give PGA Seal'}</button>
                </div>
                {proMsg && (
                  <div style={{ background: proMsg.kind === 'ok' ? '#ecfdf3' : '#fef2f2', color: proMsg.kind === 'ok' ? '#027a48' : '#b42318', border: `1px solid ${proMsg.kind === 'ok' ? '#a6f4c5' : '#fecdca'}`, borderRadius: 8, padding: '10px 14px', fontSize: 13 }}>{proMsg.text}</div>
                )}
                {proNames.length > 0 && (
                  <div style={{ border: '1px solid #e6dcc2', borderRadius: 8, overflow: 'hidden' }}>
                    <div style={{ fontSize: 12, fontWeight: 800, color: '#7a6a3f', padding: '8px 12px', background: '#f5eeda' }}>GIVEN THE PGA SEAL ({proNames.length})</div>
                    <div style={{ maxHeight: 220, overflowY: 'auto' }}>
                      {proNames.map((n, i) => (
                        <div key={n} style={{ padding: '5px 12px', fontSize: 13, color: '#0f1720', background: i % 2 ? '#fbf8f0' : '#fff', borderBottom: '1px solid #f0e9d6' }}>{n}</div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── Salary Pick List ── */}
            <div style={{ fontSize: 14, fontWeight: 900, color: '#0f1720', marginTop: 4 }}>Salary Pick List — {salaryTournamentName}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <label htmlFor="salary-tid" style={{ fontSize: 12.5, fontWeight: 700, color: '#0f1720' }}>Tournament:</label>
              <select
                id="salary-tid"
                value={salaryTid}
                onChange={(e) => setSalaryTid(e.target.value)}
                style={{ fontSize: 13, fontWeight: 700, padding: '7px 10px', borderRadius: 8, border: '1px solid #cbd5e1', background: '#fff', color: '#0f1720', cursor: 'pointer' }}
              >
                {TOURNAMENT_OPTIONS.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}{t.id === headerTournament.id ? ' (current)' : ''}</option>
                ))}
              </select>
            </div>
            <div style={{ fontSize: 12.5, color: '#607282', lineHeight: 1.5 }}>
              This list is saved for <b>{salaryTournamentName}</b> only — each tournament is stored separately, so uploading one never overwrites another and past events keep the salaries golfers had at the time. To backfill a past tournament, pick it above and upload its list.
              {' '}Columns: <b>World Golf Rank</b>, <b>Player Name</b>, <b>Salary</b> (a header row is fine — it&apos;s skipped).
              Upload the <b>.xlsx</b>/<b>.csv</b> file, or paste the rows. Any name not already in the pool is auto-added.
              {' '}<b>Amateurs are flagged automatically</b> from the standard <b>(a)</b> marker most salary lists already include — they get a red “AMATEUR” in their bio, no action needed.
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
              placeholder={'1\tScottie Scheffler\t11900\n2\tRory McIlroy\t10200\n8\tJon Rahm\t9900\n...'}
              rows={12}
              style={{ width: '100%', boxSizing: 'border-box', border: '1px solid #cbd5e1', borderRadius: 8, padding: 12, fontSize: 13, fontFamily: 'ui-monospace,SFMono-Regular,Menlo,monospace', resize: 'vertical' }}
            />

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button onClick={() => setConfirmOpen(true)} disabled={busy || !text.trim()} style={{ ...btn(headerTournament.color), opacity: busy || !text.trim() ? 0.5 : 1 }}>{busy ? 'Saving…' : 'Save & Apply'}</button>
              {status?.active && <button onClick={clear} disabled={busy} style={{ ...btn('#64748b'), opacity: busy ? 0.5 : 1 }}>Clear</button>}
            </div>

            {msg && (
              <div style={{ background: msg.kind === 'ok' ? '#ecfdf3' : '#fef2f2', color: msg.kind === 'ok' ? '#027a48' : '#b42318', border: `1px solid ${msg.kind === 'ok' ? '#a6f4c5' : '#fecdca'}`, borderRadius: 8, padding: '10px 14px', fontSize: 13 }}>{msg.text}</div>
            )}

            {salaryNewlyAdded.length > 0 && (
              <div style={{ border: '1px solid #dbe3ec', borderRadius: 8, overflow: 'hidden' }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: '#173b63', padding: '8px 12px', background: '#eef4fb' }}>NEWLY ADDED TO THE POOL ({salaryNewlyAdded.length}) — review for spelling</div>
                <div style={{ maxHeight: 220, overflowY: 'auto' }}>
                  {salaryNewlyAdded.map((n, i) => (
                    <div key={n} style={{ padding: '5px 12px', fontSize: 13, color: '#0f1720', background: i % 2 ? '#f8fafc' : '#fff', borderBottom: '1px solid #eef2f6' }}>{n}</div>
                  ))}
                </div>
              </div>
            )}

            {resp?.preview && resp.preview.length > 0 && (
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#607282', marginBottom: 6 }}>SALARIES SAVED ({resp.preview.length}) · SCROLL TO SEE ALL</div>
                <div style={{ border: '1px solid #e2e8ef', borderRadius: 8, overflow: 'hidden' }}>
                  <div style={{ maxHeight: 360, overflowY: 'auto' }}>
                    {resp.preview.map((p, i) => (
                      <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '6px 12px', fontSize: 13, background: i % 2 ? '#f8fafc' : '#fff', borderBottom: '1px solid #eef2f6' }}>
                        <span style={{ color: '#0f1720', fontWeight: 600 }}>{p.worldRank != null && <span style={{ color: '#94a3b8', fontWeight: 700, marginRight: 8 }}>#{p.worldRank}</span>}{p.name}</span>
                        <span style={{ color: '#2c6449', fontWeight: 800 }}>${p.salary.toLocaleString()}</span>
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
            <div style={{ fontSize: 13, color: '#5b6b79', lineHeight: 1.55, marginBottom: 22 }}>This overrides the salary pick list (and any world ranks) the pool uses with the list above.</div>
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
