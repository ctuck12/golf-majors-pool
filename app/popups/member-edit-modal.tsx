'use client';

import { Mail } from 'lucide-react';
import { fieldStyle } from '../pool-data';
import type { PoolPage } from '../pool-page-state';

// Moved out of app/page.tsx unchanged. `p` is the page's state (usePoolPage()).
export function MemberEditModal({ p }: { p: PoolPage }) {
  const {
    pool,
    commissionerBusy,
    setCommissionerMemberModalOpen,
    commissionerMemberModalView,
    setCommissionerMemberModalView,
    memberEditForm,
    setMemberEditForm,
    isAppAdmin,
    openCommissionerMemberPicks,
    handleSaveCommissionerMember,
    handleDeleteCommissionerMember,
    confirmHandOverId,
    setConfirmHandOverId,
    handleHandOverCommissioner,
    handleClearCommissionerMemberPicks,
    selectedCommissionerMember,
    entriesTournamentBg,
    commissionerMemberModalOpen,
  } = p;
  // Shown only when this is true (checked in app/page.tsx too).
  if (!(commissionerMemberModalOpen && selectedCommissionerMember)) return null;
  return (
    <div
            onClick={() => setCommissionerMemberModalOpen(false)}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(9,20,34,0.62)',
              backdropFilter: 'blur(7px)',
              WebkitBackdropFilter: 'blur(7px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 20,
              zIndex: 60,
            }}
          >
            <div
              onClick={(event) => event.stopPropagation()}
              style={{
                width: 'min(520px, 100%)',
                background: '#fff',
                borderRadius: 24,
                padding: 24,
                boxShadow: '0 24px 60px rgba(9, 34, 51, 0.2)',
                display: 'grid',
                gap: 18,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 800, textTransform: 'uppercase', color: '#5b6b79' }}>Member options</div>
                  <div style={{ marginTop: 6, fontSize: 28, fontWeight: 900, color: '#0f1720' }}>
                    {selectedCommissionerMember.displayName}
                  </div>
                  <div style={{ marginTop: 6, fontSize: 15, color: '#607282' }}>{selectedCommissionerMember.email}</div>
                </div>
                <button
                  onClick={() => setCommissionerMemberModalOpen(false)}
                  style={{
                    border: '1px solid #d7e0e8',
                    borderRadius: 999,
                    background: '#fff',
                    width: 40,
                    height: 40,
                    fontSize: 20,
                    cursor: 'pointer',
                  }}
                >
                  ×
                </button>
              </div>

              {commissionerMemberModalView === 'menu' ? (
                <div style={{ display: 'grid', gap: 12 }}>
                  <button
                    onClick={() => setCommissionerMemberModalView('displayName')}
                    style={{
                      border: '1px solid #d7e0e8',
                      borderRadius: 16,
                      background: '#fff',
                      padding: '16px 18px',
                      textAlign: 'left',
                      fontWeight: 800,
                      cursor: 'pointer',
                    }}
                  >
                    Edit Display Name
                  </button>
                  {/* A member's sign-in email is theirs; only the app admin can change it here. */}
                  {isAppAdmin ? (
                  <button
                    onClick={() => setCommissionerMemberModalView('email')}
                    style={{
                      border: '1px solid #d7e0e8',
                      borderRadius: 16,
                      background: '#fff',
                      padding: '16px 18px',
                      textAlign: 'left',
                      fontWeight: 800,
                      cursor: 'pointer',
                    }}
                  >
                    Edit Email
                  </button>
                  ) : null}
                  {(() => {
                    // One commissioner per league: they can hand the role to another member.
                    const memberIsCommissioner = (pool?.commissioners ?? []).some((c) => c.id === selectedCommissionerMember.id);
                    if (memberIsCommissioner || pool?.role !== 'commissioner') return null;
                    const confirming = confirmHandOverId === selectedCommissionerMember.id;
                    return (
                      <button
                        onClick={() => {
                          if (!confirming) { setConfirmHandOverId(selectedCommissionerMember.id); return; }
                          void handleHandOverCommissioner(selectedCommissionerMember.id, selectedCommissionerMember.displayName);
                        }}
                        disabled={commissionerBusy}
                        style={{
                          border: confirming ? '1.5px solid #b45309' : '1px solid #d7e0e8',
                          borderRadius: 16,
                          background: confirming ? '#fff7ed' : '#fff',
                          padding: '16px 18px',
                          textAlign: 'left',
                          fontWeight: 800,
                          cursor: commissionerBusy ? 'wait' : 'pointer',
                        }}
                      >
                        {confirming
                          ? `Tap again to make ${selectedCommissionerMember.displayName} the commissioner. You'll become a member and lose the commissioner tools.`
                          : 'Make Commissioner (hand over the role)'}
                      </button>
                    );
                  })()}
                  <button
                    onClick={() => openCommissionerMemberPicks(selectedCommissionerMember.id)}
                    style={{
                      border: '1px solid #d7e0e8',
                      borderRadius: 16,
                      background: '#eef8fb',
                      padding: '16px 18px',
                      textAlign: 'left',
                      fontWeight: 800,
                      cursor: 'pointer',
                    }}
                  >
                    Manage or Submit Picks
                  </button>
                  <button
                    onClick={() => setCommissionerMemberModalView('confirmClearPicks')}
                    disabled={commissionerBusy}
                    style={{
                      border: '1px solid #fcd9a0',
                      borderRadius: 16,
                      background: '#fff8ee',
                      padding: '16px 18px',
                      textAlign: 'left',
                      color: '#a06000',
                      fontWeight: 800,
                      cursor: commissionerBusy ? 'wait' : 'pointer',
                    }}
                  >
                    Clear Picks
                  </button>
                  <button
                    onClick={() => setCommissionerMemberModalView('confirmDelete')}
                    disabled={commissionerBusy}
                    style={{
                      border: '1px solid #fecaca',
                      borderRadius: 16,
                      background: '#fff5f5',
                      padding: '16px 18px',
                      textAlign: 'left',
                      color: '#a61b1b',
                      fontWeight: 800,
                      cursor: commissionerBusy ? 'wait' : 'pointer',
                    }}
                  >
                    Delete Member
                  </button>
                </div>
              ) : commissionerMemberModalView === 'displayName' ? (
                <div style={{ display: 'grid', gap: 12 }}>
                  <input
                    value={memberEditForm.displayName}
                    onChange={(event) => setMemberEditForm({ ...memberEditForm, displayName: event.target.value })}
                    placeholder="Display name"
                    style={fieldStyle()}
                  />
                  <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                    <button
                      onClick={() => setCommissionerMemberModalView('menu')}
                      style={{ border: '1px solid #d7e0e8', borderRadius: 14, background: '#fff', padding: '12px 16px', fontWeight: 800, cursor: 'pointer' }}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSaveCommissionerMember}
                      disabled={commissionerBusy}
                      style={{
                        border: 'none',
                        borderRadius: 14,
                        padding: '12px 16px',
                        background: entriesTournamentBg,
                        color: '#fff',
                        fontWeight: 900,
                        cursor: commissionerBusy ? 'wait' : 'pointer',
                      }}
                    >
                      Save Display Name
                    </button>
                  </div>
                </div>
              ) : commissionerMemberModalView === 'confirmClearPicks' ? (
                <div style={{ display: 'grid', gap: 16 }}>
                  <div style={{ fontSize: 15, color: '#0f1720' }}>
                    Are you sure you want to clear picks for <strong>{selectedCommissionerMember?.displayName}</strong>? Their submitted roster will be removed for this tournament.
                  </div>
                  <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                    <button
                      onClick={() => setCommissionerMemberModalView('menu')}
                      style={{ border: '1px solid #d7e0e8', borderRadius: 14, background: '#fff', padding: '12px 16px', fontWeight: 800, cursor: 'pointer' }}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleClearCommissionerMemberPicks}
                      disabled={commissionerBusy}
                      style={{
                        border: 'none',
                        borderRadius: 14,
                        padding: '12px 16px',
                        background: '#a06000',
                        color: '#fff',
                        fontWeight: 900,
                        cursor: commissionerBusy ? 'wait' : 'pointer',
                      }}
                    >
                      Confirm Clear
                    </button>
                  </div>
                </div>
              ) : commissionerMemberModalView === 'confirmDelete' ? (
                <div style={{ display: 'grid', gap: 16 }}>
                  <div style={{ fontSize: 15, color: '#0f1720' }}>
                    Are you sure you want to delete <strong>{selectedCommissionerMember?.displayName}</strong>? This cannot be undone.
                  </div>
                  <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                    <button
                      onClick={() => setCommissionerMemberModalView('menu')}
                      style={{ border: '1px solid #d7e0e8', borderRadius: 14, background: '#fff', padding: '12px 16px', fontWeight: 800, cursor: 'pointer' }}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleDeleteCommissionerMember}
                      disabled={commissionerBusy}
                      style={{
                        border: 'none',
                        borderRadius: 14,
                        padding: '12px 16px',
                        background: '#a61b1b',
                        color: '#fff',
                        fontWeight: 900,
                        cursor: commissionerBusy ? 'wait' : 'pointer',
                      }}
                    >
                      Confirm Delete
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'grid', gap: 12 }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      border: '1px solid #d7e0e8',
                      borderRadius: 16,
                      background: '#fff',
                      padding: '0 14px',
                    }}
                  >
                    <Mail size={18} color="#607282" />
                    <input
                      value={memberEditForm.email}
                      onChange={(event) => setMemberEditForm({ ...memberEditForm, email: event.target.value })}
                      placeholder="Email"
                      style={{ ...fieldStyle(), border: 'none', paddingLeft: 0, paddingRight: 0 }}
                    />
                  </div>
                  <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                    <button
                      onClick={() => setCommissionerMemberModalView('menu')}
                      style={{ border: '1px solid #d7e0e8', borderRadius: 14, background: '#fff', padding: '12px 16px', fontWeight: 800, cursor: 'pointer' }}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSaveCommissionerMember}
                      disabled={commissionerBusy}
                      style={{
                        border: 'none',
                        borderRadius: 14,
                        padding: '12px 16px',
                        background: entriesTournamentBg,
                        color: '#fff',
                        fontWeight: 900,
                        cursor: commissionerBusy ? 'wait' : 'pointer',
                      }}
                    >
                      Save Email
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
  );
}
