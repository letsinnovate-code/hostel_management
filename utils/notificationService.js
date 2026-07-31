const admin = require('firebase-admin');
const path = require('path');

// Initialize Firebase Admin SDK
// Expects service-account.json in the project root or configured via env
try {
    let serviceAccount;
    // Check for environment variable first
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
        serviceAccount = require(process.env.GOOGLE_APPLICATION_CREDENTIALS);
    } else {
        // Default to looking for service-account.json in backend root
        const serviceAccountPath = path.join(__dirname, '../service-account.json');
        try {
            serviceAccount = require(serviceAccountPath);
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount)
            });
            console.log('Firebase Admin SDK initialized successfully');
        } catch (err) {
            console.warn('Could not load service-account.json from root. Push notifications will fail.');
            // Initialize without credential if expected to be running in GCP/Firebase environment (optional fallback)
            // admin.initializeApp(); 
        }
    }
} catch (error) {
    console.warn('Firebase Admin SDK initialization failed:', error.message);
}

/**
 * Send push notifications to users using FCM HTTP v1 API (via Admin SDK)
 * @param {Array} notifications Array of notification objects { to: pushToken, title, body, data }
 */
exports.sendPushNotifications = async (notifications) => {
    if (!admin.apps.length) {
        console.error('Firebase Admin not initialized. Cannot send notifications.');
        return [];
    }

    const messages = [];
    const results = [];

    // Filter valid tokens and map to FCM message format
    for (const notif of notifications) {
        if (!notif.to) continue;
        const channelId = notif.channelId || 'default';
        messages.push({
            token: notif.to,
            notification: {
                title: notif.title,
                body: notif.body,
            },
            data: notif.data || {},
            android: {
                priority: 'high',
                notification: {
                    sound: 'default',
                    channelId,
                }
            },
            apns: {
                payload: {
                    aps: {
                        sound: 'default',
                    }
                }
            }
        });
    }

    if (messages.length === 0) return [];

    const invalidTokens = [];
    const INVALID_TOKEN_CODES = [
        'messaging/registration-token-not-registered',
        'messaging/invalid-registration-token',
    ];

    // Send in batches (FCM limit is 500 per batch)
    const batchSize = 500;
    for (let i = 0; i < messages.length; i += batchSize) {
        const batch = messages.slice(i, i + batchSize);
        try {
            const batchResponse = await admin.messaging().sendEach(batch);
            console.log(`FCM Batch ${i / batchSize + 1} sent:`, batchResponse.successCount, 'success,', batchResponse.failureCount, 'failure');

            if (batchResponse.failureCount > 0) {
                batchResponse.responses.forEach((resp, idx) => {
                    if (!resp.success) {
                        const code = resp.error?.errorInfo?.code;
                        const token = batch[idx]?.token;
                        if (token && INVALID_TOKEN_CODES.includes(code)) {
                            invalidTokens.push(token);
                            console.warn(`FCM invalid token (will be removed from DB): ${code}`);
                        } else {
                            console.error(`Failure sending to ${token || 'unknown'}:`, resp.error?.message || resp.error);
                        }
                    }
                });
            }

            results.push(batchResponse);
        } catch (error) {
            console.error('Error sending FCM batch:', error);
            results.push({ error: error.message });
        }
    }

    results.invalidTokens = invalidTokens;
    return results;
};

/**
 * Send a single push notification
 * @param {String} pushToken 
 * @param {String} title 
 * @param {String} body 
 * @param {Object} data 
 */
exports.sendSingleNotification = async (pushToken, title, body, data = {}) => {
    if (!pushToken) return null;
    return await this.sendPushNotifications([{ to: pushToken, title, body, data }]);
};

// --- Expo Push API (for receipt-based status: ok | error | DeviceNotRegistered | MessageTooBig) ---
const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const EXPO_GET_RECEIPTS_URL = 'https://exp.host/--/api/v2/push/getReceipts';

/**
 * Check if a token is an Expo push token (ExponentPushToken[...])
 */
exports.isExpoPushToken = function isExpoPushToken(token) {
    return typeof token === 'string' && (token.startsWith('ExponentPushToken[') || token.startsWith('ExpoPushToken['));
};

/**
 * Send push notifications via Expo Push API. Returns receipt IDs for status checking.
 * @param {Array} notifications Array of { to: ExponentPushToken, title, body, data }
 * @returns {Promise<{ receiptIds: string[], responses: object[] }>}
 */
exports.sendExpoPushNotifications = async (notifications) => {
    const valid = notifications.filter(n => n.to && exports.isExpoPushToken(n.to));
    if (valid.length === 0) return { receiptIds: [], responses: [] };

    const messages = valid.map(n => ({
        to: n.to,
        title: n.title || '',
        body: n.body || '',
        data: n.data || {},
        sound: 'default',
        ...(n.priority && { priority: n.priority }),
        ...(n.channelId && { channelId: n.channelId }),
    }));

    const receiptIds = [];
    const responses = [];

    // Expo accepts up to 100 messages per request
    const batchSize = 100;
    for (let i = 0; i < messages.length; i += batchSize) {
        const batch = messages.slice(i, i + batchSize);
        try {
            const res = await fetch(EXPO_PUSH_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(batch.length === 1 ? batch[0] : batch),
            });
            const json = await res.json();
            const data = json.data || (Array.isArray(json) ? json : [json]);
            const list = Array.isArray(data) ? data : [data];
            list.forEach((item, idx) => {
                responses.push(item);
                if (item.id) receiptIds.push(item.id);
            });
        } catch (err) {
            console.error('Expo push send error:', err);
            batch.forEach(() => responses.push({ status: 'error', message: err.message }));
        }
    }

    return { receiptIds, responses };
};

const VIOLATION_LABELS = {
    'improper-checkout': 'Left without checking out',
    curfew: 'Curfew breach',
    'late-entry': 'Late entry',
    'unauthorized-visitor': 'Unauthorized visitor',
    noise: 'Noise',
    damage: 'Damage',
    other: 'Rule violation',
};

/**
 * Send a violation push to a student (card-style: high priority, violations channel).
 * Prefer Expo token if present, else FCM. Call from student/warden controller after creating a violation.
 * @param {Object} opts { pushToken?, expoPushToken?, violationType: string, detectedAt: Date, violationId?: string }
 */
exports.sendViolationPushToStudent = async (opts) => {
    const { pushToken, expoPushToken, violationType, detectedAt, violationId } = opts;
    if (!pushToken && !expoPushToken) return;

    const timeStr = detectedAt instanceof Date
        ? detectedAt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
        : new Date(detectedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const label = VIOLATION_LABELS[violationType] || violationType || 'Violation';
    const title = 'Violation detected';
    const body = `${label} at ${timeStr}. Please follow hostel rules to avoid further violations.`;
    const data = { type: 'violation', violationType: violationType || 'improper-checkout', violationId: violationId || '', screen: 'violations' };

    const expoPayload = { title, body, data, priority: 'high', channelId: 'violations' };
    const fcmPayload = { title, body, data, channelId: 'violations' };

    if (expoPushToken && exports.isExpoPushToken(expoPushToken)) {
        await exports.sendExpoPushNotifications([{ ...expoPayload, to: expoPushToken }]).catch((e) => console.warn('Violation Expo push failed:', e.message));
    } else if (pushToken) {
        await exports.sendPushNotifications([{ ...fcmPayload, to: pushToken }]).catch((e) => console.warn('Violation FCM push failed:', e.message));
    }
};

/**
 * Send check-in push to student (popup: "You were checked in at 10:30 AM" or "You were automatically checked in at 10:30 AM").
 * @param {Object} opts { pushToken?, expoPushToken?, autoCheckIn: boolean, timeStr: string }
 */
exports.sendCheckInPushToStudent = async (opts) => {
    const { pushToken, expoPushToken, autoCheckIn, timeStr } = opts;
    if (!pushToken && !expoPushToken) return;

    const title = autoCheckIn ? 'Auto check-in' : 'Check-in';
    const body = autoCheckIn
        ? `You were automatically checked in at ${timeStr}.`
        : `You were checked in at ${timeStr}.`;
    const data = { type: 'check_in', autoCheckIn: String(!!autoCheckIn), screen: 'dashboard' };

    const expoPayload = { title, body, data, priority: 'high', channelId: 'default' };
    const fcmPayload = { title, body, data, channelId: 'default' };

    if (expoPushToken && exports.isExpoPushToken(expoPushToken)) {
        await exports.sendExpoPushNotifications([{ ...expoPayload, to: expoPushToken }]).catch((e) => console.warn('Check-in Expo push failed:', e.message));
    } else if (pushToken) {
        await exports.sendPushNotifications([{ ...fcmPayload, to: pushToken }]).catch((e) => console.warn('Check-in FCM push failed:', e.message));
    }
};

/**
 * Send leave request approved/rejected push to student (high priority for popup).
 * @param {Object} opts { pushToken?, expoPushToken?, approved: boolean, permissionType?: string, requestedDate?: string, rejectionReason?: string, permissionId?: string }
 */
exports.sendLeaveRequestUpdateToStudent = async (opts) => {
    const { pushToken, expoPushToken, approved, permissionType, requestedDate, rejectionReason, permissionId } = opts;
    if (!pushToken && !expoPushToken) return;

    const typeLabel = (permissionType || 'leave').replace(/-/g, ' ');
    const dateStr = requestedDate ? new Date(requestedDate + 'T12:00:00').toLocaleDateString(undefined, { dateStyle: 'medium' }) : '';
    const title = approved ? 'Leave request approved' : 'Leave request not approved';
    const body = approved
        ? `Your ${typeLabel} request${dateStr ? ` for ${dateStr}` : ''} has been approved.`
        : `Your ${typeLabel} request was not approved.${rejectionReason ? ` Reason: ${rejectionReason}` : ''}`;
    const data = {
        type: approved ? 'leave_approved' : 'leave_rejected',
        permissionId: permissionId || '',
        screen: 'leave',
    };

    const expoPayload = { title, body, data, priority: 'high', channelId: 'default' };
    const fcmPayload = { title, body, data, channelId: 'default' };

    if (expoPushToken && exports.isExpoPushToken(expoPushToken)) {
        await exports.sendExpoPushNotifications([{ ...expoPayload, to: expoPushToken }]).catch((e) => console.warn('Leave push Expo failed:', e.message));
    } else if (pushToken) {
        await exports.sendPushNotifications([{ ...fcmPayload, to: pushToken }]).catch((e) => console.warn('Leave push FCM failed:', e.message));
    }
};

/**
 * Get status of Expo push notification receipts.
 * @param {string[]} ids Receipt IDs from send response
 * @returns {Promise<Object>} Map of receiptId -> { status: 'ok' | 'error' | 'DeviceNotRegistered' | 'MessageTooBig', message?, details? }
 */
exports.getExpoReceipts = async (ids) => {
    if (!ids || ids.length === 0) return {};
    const unique = [...new Set(ids)];
    try {
        const res = await fetch(EXPO_GET_RECEIPTS_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ids: unique }),
        });
        const json = await res.json();
        return json.data || {};
    } catch (err) {
        console.error('Expo getReceipts error:', err);
        return unique.reduce((acc, id) => {
            acc[id] = { status: 'error', message: err.message };
            return acc;
        }, {});
    }
};
