// Firebase Admin is loaded lazily to avoid ESM/CJS crash on Vercel
// (jwks-rsa -> jose is ESM-only and breaks require())
let messaging = null;
let isFirebaseInitialized = false;

function initFirebase() {
  if (isFirebaseInitialized) return;
  isFirebaseInitialized = true; // only attempt once

  try {
    const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (!serviceAccountJson) {
      console.log('[FCM] No FIREBASE_SERVICE_ACCOUNT env var. Push notifications disabled.');
      return;
    }

    const serviceAccount = JSON.parse(serviceAccountJson);
    const { initializeApp, cert } = require('firebase-admin/app');
    const { getMessaging } = require('firebase-admin/messaging');

    initializeApp({ credential: cert(serviceAccount) });
    messaging = getMessaging();
    console.log('[FCM] Firebase Admin initialized successfully.');
  } catch (error) {
    console.log('[FCM] Firebase init failed (non-critical):', error.message);
    messaging = null;
  }
}

async function sendPushNotification(title, body, data) {
  initFirebase();

  if (messaging) {
    try {
      const message = {
        notification: { title, body },
        data: {
          ...data,
          recruitmentId: data?.recruitmentId?.toString() ?? ''
        },
        topic: 'all_users'
      };
      const response = await messaging.send(message);
      console.log('[FCM] Sent:', response);
    } catch (error) {
      console.error('[FCM] Send failed:', error.message);
    }
  } else {
    console.log(`[FCM Mock] ${title} — ${body}`);
  }
}

function notifyNewOpportunity(recruitment) {
  sendPushNotification(
    '🚨 NEW OPPORTUNITY',
    `${recruitment.postName} at ${recruitment.organization?.name || 'Unknown'}. Tap to view.`,
    { recruitmentId: recruitment.id }
  );
}

function notifyImportantUpdate(recruitment, changeMessage) {
  sendPushNotification(
    '⚠️ RECRUITMENT UPDATED',
    `${recruitment.postName}: ${changeMessage}`,
    { recruitmentId: recruitment.id }
  );
}

function notifyDeadline(recruitment, daysLeft) {
  sendPushNotification(
    '⏰ DEADLINE ALERT',
    `${recruitment.postName} closes in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}.`,
    { recruitmentId: recruitment.id }
  );
}

module.exports = {
  sendPushNotification,
  notifyNewOpportunity,
  notifyImportantUpdate,
  notifyDeadline
};
