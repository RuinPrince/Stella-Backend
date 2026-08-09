const { initializeApp, cert } = require('firebase-admin/app');
const { getMessaging } = require('firebase-admin/messaging');
const fs = require('fs');
const path = require('path');

// Initialize Firebase Admin (Requires service account key from user)
const serviceAccountPath = path.join(__dirname, '../../firebase-service-account.json');
let isFirebaseInitialized = false;

if (fs.existsSync(serviceAccountPath)) {
  const serviceAccount = require(serviceAccountPath);
  initializeApp({
    credential: cert(serviceAccount)
  });
  isFirebaseInitialized = true;
  console.log('[FCM] Firebase Admin Initialized successfully.');
} else {
  console.log('[FCM WARNING] firebase-service-account.json not found! Push notifications will be mocked.');
}

async function sendPushNotification(title, body, data) {
  if (isFirebaseInitialized) {
    try {
      const message = {
        notification: { title, body },
        data: {
          ...data,
          // FCM data payloads only accept string values
          recruitmentId: data?.recruitmentId?.toString() ?? ''
        },
        topic: 'all_users' // For MVP, broadcast to all users
      };
      const response = await getMessaging().send(message);
      console.log('[FCM] Successfully sent message:', response);
    } catch (error) {
      console.error('[FCM ERROR] Error sending message:', error);
    }
  } else {
    // Fallback to mock logging
    console.log(`\n[MOCK FCM PUSH]`);
    console.log(`Title: ${title}`);
    console.log(`Body:  ${body}`);
    if (data) console.log(`Data:  ${JSON.stringify(data)}`);
    console.log('------------------------------------\n');
  }
}

function notifyNewOpportunity(recruitment) {
  sendPushNotification(
    '🚨 NEW OPPORTUNITY',
    `${recruitment.postName} at ${recruitment.organization.name}. Tap to view eligibility.`,
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
    `${recruitment.postName} closes in ${daysLeft} days. Application status: Not submitted.`,
    { recruitmentId: recruitment.id }
  );
}

module.exports = {
  sendPushNotification,
  notifyNewOpportunity,
  notifyImportantUpdate,
  notifyDeadline
};
