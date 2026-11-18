'use client';

import { useEffect, useState } from 'react';
import { Bell, X } from 'lucide-react';
import { PushNotifications } from '@capacitor/push-notifications';
import { isNativeApp } from './native-bridge';

// Push notifications in the iPhone app: register the device with Apple once the member has said
// yes, send the token to the server, and open the right tab when a notification is tapped.

const TOKEN_KEY = 'gmp-push-token';
const DISMISSED_KEY = 'gmp-push-prompt-dismissed';
let listenersAdded = false;

function storage() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

async function sendToken(token: string) {
  storage()?.setItem(TOKEN_KEY, token);
  await fetch('/api/push/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, platform: 'ios' }) }).catch(() => {});
}

function addListeners(onOpenTab: (tab: string) => void) {
  if (listenersAdded) return;
  listenersAdded = true;
  void PushNotifications.addListener('registration', (t) => void sendToken(t.value));
  void PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
    const tab = (action.notification.data as { tab?: string } | undefined)?.tab;
    if (tab) onOpenTab(tab);
  });
}

// Signed in, in the app: if notifications are already allowed, (re)register so the server has
// this device's current token.
export function usePushRegistration(signedInUserId: string | null, onOpenTab: (tab: string) => void) {
  useEffect(() => {
    if (!isNativeApp || !signedInUserId) return;
    addListeners(onOpenTab);
    void PushNotifications.checkPermissions()
      .then((status) => (status.receive === 'granted' ? PushNotifications.register() : undefined))
      .catch(() => {});
    // onOpenTab is a stable page setter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signedInUserId]);
}

// On sign-out: this device stops getting the signed-out member's notifications.
export async function unregisterPushToken() {
  if (!isNativeApp) return;
  const token = storage()?.getItem(TOKEN_KEY);
  if (!token) return;
  await fetch('/api/push/register', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }) }).catch(() => {});
}

// A small card asking to turn notifications on (Apple's permission prompt shows only after a tap
// here, so the member knows what it's for). Hidden once answered or dismissed.
export function PushPrompt({ compact, marginTop, onOpenTab }: { compact: boolean; marginTop: number; onOpenTab: (tab: string) => void }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (!isNativeApp || storage()?.getItem(DISMISSED_KEY)) return;
    let cancelled = false;
    void PushNotifications.checkPermissions()
      .then((status) => {
        if (!cancelled && (status.receive === 'prompt' || status.receive === 'prompt-with-rationale')) setShow(true);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);
  if (!show) return null;

  const dismiss = () => {
    storage()?.setItem(DISMISSED_KEY, '1');
    setShow(false);
  };
  const turnOn = async () => {
    addListeners(onOpenTab);
    try {
      const status = await PushNotifications.requestPermissions();
      if (status.receive === 'granted') await PushNotifications.register();
    } catch {
      // Not available on this build.
    }
    dismiss();
  };

  return (
    <div style={{ marginTop, borderRadius: 16, background: '#fff', border: '1px solid #dce6ee', boxShadow: '0 10px 24px rgba(9,34,51,0.06)', padding: compact ? '11px 12px' : '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{ width: 36, height: 36, borderRadius: 10, background: '#173b63', color: '#fff', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
        <Bell size={18} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14.5, fontWeight: 900, color: '#0f1720' }}>Turn on notifications</div>
        <div style={{ fontSize: 12.5, color: '#5b6b79', lineHeight: 1.4 }}>Know when picks open and lock, when your golfer takes the lead, and when you get paid.</div>
      </div>
      <button type="button" onClick={() => void turnOn()} style={{ border: 'none', borderRadius: 10, padding: '8px 12px', background: '#173b63', color: '#fff', fontWeight: 800, fontSize: 13, cursor: 'pointer', flexShrink: 0 }}>Turn on</button>
      <button type="button" aria-label="Not now" onClick={dismiss} style={{ border: 'none', background: 'none', padding: 4, cursor: 'pointer', color: '#8a99a6', flexShrink: 0 }}><X size={16} /></button>
    </div>
  );
}
