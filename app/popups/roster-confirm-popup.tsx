'use client';

import { VenmoMark } from '../venmo-mark';
import { formatMoney, formatVenmo } from '@/app/lib/venmo';
import { totalParFor, TOURNAMENT_TAB_LOGOS, KNOCKOUT_TAB_LOGOS } from '../pool-data';
import type { PoolPage } from '../pool-page-state';

// Moved out of app/page.tsx unchanged. `p` is the page's state (usePoolPage()).
export function RosterConfirmPopup({ p }: { p: PoolPage }) {
  const {
    tieBreakInput,
    setShowRosterConfirm,
    setShowSubmitToast,
    entriesTournamentId,
    entriesTournament,
    hasSubmittedRoster,
    entryFee,
    entryFeeVenmo,
    paysEntryFeeInApp,
    openEntryFeePayment,
    orderedRosterPlayers,
    salaryUsed,
    salaryRemaining,
    handleSave,
    entriesTournamentBg,
    showRosterConfirm,
  } = p;
  // Shown only when this is true (checked in app/page.tsx too).
  if (!(showRosterConfirm)) return null;
  return (
    <div
            onClick={() => setShowRosterConfirm(false)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(9,34,51,0.5)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{ background: entriesTournamentId === 'open' ? '#F4BC41' : '#fff', borderRadius: 20, width: '100%', maxWidth: 380, boxShadow: '0 18px 48px rgba(9,34,51,0.25)', overflow: 'hidden', maxHeight: 'calc(100vh - 40px - var(--safe-y))', display: 'flex', flexDirection: 'column' }}
            >
              {/* Coloured header */}
              <div style={{ background: entriesTournamentBg, padding: '16px 20px 14px', flexShrink: 0, display: 'flex', justifyContent: 'space-between', alignItems: hasSubmittedRoster ? 'center' : 'flex-start', gap: 12 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 18, fontWeight: 900, color: '#fff' }}>Confirm Your Roster</div>
                  {!hasSubmittedRoster && entryFee > 0 && (
                    <div style={{ marginTop: 5, fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.88)', letterSpacing: '0.01em' }}>Pool Entry Fee: {formatMoney(entryFee)}</div>
                  )}
                </div>
                {TOURNAMENT_TAB_LOGOS[entriesTournamentId] && (
                  <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <img src={KNOCKOUT_TAB_LOGOS[entriesTournamentId] ?? TOURNAMENT_TAB_LOGOS[entriesTournamentId]} alt={entriesTournament.name} style={{ height: entriesTournamentId === 'pga' ? 60 : entriesTournamentId === 'players' ? 52 : entriesTournamentId === 'open' ? 40 : entriesTournamentId === 'masters' ? undefined : 36, width: entriesTournamentId === 'masters' ? 120 : undefined, margin: entriesTournamentId === 'pga' ? '-12px 0' : entriesTournamentId === 'players' ? '-8px 0' : undefined, maxWidth: 120, objectFit: 'contain', display: 'block', flexShrink: 0 }} />
                  </div>
                )}
              </div>

              {/* Body */}
              <div style={{ padding: '14px 18px 18px', overflowY: 'auto' }}>
                {/* Roster list */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginBottom: 12 }}>
                  {orderedRosterPlayers.map((player) => (
                    <div key={player.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 14 }}>
                      <span style={{ fontWeight: 700, color: '#0f1720' }}>{player.name}</span>
                      <span style={{ fontWeight: 600, color: entriesTournamentId === 'open' ? entriesTournamentBg : '#5b6b79', fontVariantNumeric: 'tabular-nums' }}>${player.salary.toLocaleString()}</span>
                    </div>
                  ))}
                </div>

                <div style={{ borderTop: entriesTournamentId === 'open' ? '1px solid #8a8f96' : '1px solid #e8edf2', marginBottom: 10 }} />

                {/* Salary summary */}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 5 }}>
                  <span style={{ color: entriesTournamentId === 'open' ? entriesTournamentBg : '#5b6b79' }}>Salary used</span>
                  <span style={{ fontWeight: 700, color: '#0f1720', fontVariantNumeric: 'tabular-nums' }}>${salaryUsed.toLocaleString()}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 12 }}>
                  <span style={{ color: entriesTournamentId === 'open' ? entriesTournamentBg : '#5b6b79' }}>Remaining</span>
                  <span style={{ fontWeight: 700, color: salaryRemaining < 0 ? '#dc2626' : '#0f1720', fontVariantNumeric: 'tabular-nums' }}>${salaryRemaining.toLocaleString()}</span>
                </div>

                <div style={{ borderTop: entriesTournamentId === 'open' ? '1px solid #8a8f96' : '1px solid #e8edf2', marginBottom: 10 }} />

                {/* Tiebreaker */}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 16 }}>
                  <span style={{ color: entriesTournamentId === 'open' ? entriesTournamentBg : '#5b6b79' }}>Your tiebreaker</span>
                  <span style={{ fontWeight: 700, color: '#0f1720' }}>{tieBreakInput} <span style={{ fontWeight: 400, color: entriesTournamentId === 'open' ? entriesTournamentBg : '#8a99a6' }}>(par {totalParFor(entriesTournamentId) ?? '—'})</span></span>
                </div>

                {/* Explanation for the Submit & Pay flow */}
                {!hasSubmittedRoster && paysEntryFeeInApp && (
                  <div style={{ fontSize: 11.5, color: entriesTournamentId === 'open' ? entriesTournamentBg : '#5b6b79', lineHeight: 1.5, marginBottom: 10 }}>
                    *Hitting <b>Submit &amp; Pay</b>{' '}submits your roster and automatically opens <VenmoMark tone="blue" /> to {formatVenmo(entryFeeVenmo!.handle)} to pay the pool entry fee. The {formatMoney(entryFee)}{' '}amount and what it&apos;s for are auto-populated for you.
                  </div>
                )}
                {!hasSubmittedRoster && entryFee > 0 && !entryFeeVenmo && (
                  <div style={{ fontSize: 11.5, color: entriesTournamentId === 'open' ? entriesTournamentBg : '#5b6b79', lineHeight: 1.5, marginBottom: 10 }}>
                    *Your commissioner hasn&apos;t added their <VenmoMark tone="blue" /> yet, so pay the {formatMoney(entryFee)} entry fee to them directly.
                  </div>
                )}

                {/* Buttons */}
                <div style={{ display: 'flex', gap: 10 }}>
                  {!hasSubmittedRoster ? (
                    <>
                      <button
                        onClick={async () => {
                          // Venmo opens ONLY after the roster save is confirmed — a failed save
                          // (expired session, network blip) must never send someone off to pay.
                          const saved = await handleSave();
                          setShowRosterConfirm(false);
                          if (!saved) return; // saveMessage shows the error on the pick sheet
                          setShowSubmitToast(true);
                          setTimeout(() => {
                            setShowSubmitToast(false);
                            if (paysEntryFeeInApp) openEntryFeePayment();
                          }, paysEntryFeeInApp ? 2000 : 1600);
                        }}
                        style={{ flex: 1, border: 'none', borderRadius: 12, padding: '13px 0', background: entriesTournamentBg, color: '#fff', fontSize: 15, fontWeight: 900, cursor: 'pointer' }}
                      >
                        {paysEntryFeeInApp ? <>Submit &amp; Pay</> : 'Submit'}
                      </button>
                      <button
                        onClick={() => setShowRosterConfirm(false)}
                        style={{ flex: 1, border: entriesTournamentId === 'open' ? 'none' : '2px solid #dfe5eb', borderRadius: 12, padding: '13px 0', background: entriesTournamentId === 'open' ? '#dce6f5' : '#fff', color: entriesTournamentId === 'open' ? '#173b63' : '#374151', fontSize: 15, fontWeight: entriesTournamentId === 'open' ? 800 : 700, cursor: 'pointer' }}
                      >
                        Edit
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => { setShowRosterConfirm(false); void handleSave(); }}
                        style={{ flex: 1, border: 'none', borderRadius: 12, padding: '13px 0', background: entriesTournamentBg, color: '#fff', fontSize: 15, fontWeight: 900, cursor: 'pointer' }}
                      >
                        Submit
                      </button>
                      <button
                        onClick={() => setShowRosterConfirm(false)}
                        style={{ flex: 1, border: entriesTournamentId === 'open' ? 'none' : '2px solid #dfe5eb', borderRadius: 12, padding: '13px 0', background: entriesTournamentId === 'open' ? '#dce6f5' : '#fff', color: entriesTournamentId === 'open' ? '#173b63' : '#374151', fontSize: 15, fontWeight: entriesTournamentId === 'open' ? 800 : 700, cursor: 'pointer' }}
                      >
                        Edit
                      </button>
                    </>
                  )}
                </div>
                {hasSubmittedRoster && paysEntryFeeInApp ? (
                  <button
                    type="button"
                    onClick={() => openEntryFeePayment()}
                    style={{ marginTop: 12, width: '100%', background: 'none', border: 'none', padding: 4, fontSize: 13, fontWeight: 800, color: entriesTournamentId === 'open' ? entriesTournamentBg : '#008CFF', cursor: 'pointer' }}
                  >
                    Still need to pay? Pay your {formatMoney(entryFee)} entry fee on <VenmoMark tone="blue" />
                  </button>
                ) : null}
              </div>
            </div>
          </div>
  );
}
