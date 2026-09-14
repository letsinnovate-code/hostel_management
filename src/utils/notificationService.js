const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

// Initialize Firebase Admin SDK
// Prioritizes environment variables (JSON or individual keys) with safe local fallback
try {
    if (!admin.apps.length) {
        let credential = null;

        // 1. Full JSON string in environment variable (ideal for cloud/serverless deployments)
        const envJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON || process.env.FIREBASE_SERVICE_ACCOUNT;
        if (envJson) {
            try {
                const parsed = JSON.parse(envJson);
                credential = admin.credential.cert(parsed);
            } catch (parseErr) {
                console.warn('[NotificationService] Invalid JSON in FIREBASE_SERVICE_ACCOUNT_JSON environment variable.');
            }
        }

        // 2. Individual environment variables (cloud PaaS standard)
        if (!credential && process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
            try {
                credential = admin.credential.cert({
                    projectId: process.env.FIREBASE_PROJECT_ID,
                    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
                });
            } catch (envErr) {
                console.warn('[NotificationService] Failed to load Firebase credentials from individual environment variables.');
            }
        }

        // 3. File path in GOOGLE_APPLICATION_CREDENTIALS (if exists on disk)
        if (!credential && process.env.GOOGLE_APPLICATION_CREDENTIALS) {
            const credPath = path.resolve(process.env.GOOGLE_APPLICATION_CREDENTIALS);
            if (fs.existsSync(credPath)) {
                try {
                    const fileContent = JSON.parse(fs.readFileSync(credPath, 'utf8'));
                    credential = admin.credential.cert(fileContent);
                } catch (readErr) {
                    console.warn('[NotificationService] Could not parse credentials file specified in GOOGLE_APPLICATION_CREDENTIALS.');
                }
            } else {
                console.warn('[NotificationService] Credentials file specified in GOOGLE_APPLICATION_CREDENTIALS does not exist.');
            }
        }

        // 4. Local development file fallback (checked safely without leaking paths or throwing)
        if (!credential && process.env.NODE_ENV !== 'production') {
            const localServiceAccountPath = path.join(__dirname, '../service-account.json');
            if (fs.existsSync(localServiceAccountPath)) {
                try {
                    const localAccount = JSON.parse(fs.readFileSync(localServiceAccountPath, 'utf8'));
                    credential = admin.credential.cert(localAccount);
                } catch (localErr) {
                    console.warn('[NotificationService] Found local service-account.json but failed to parse it.');
                }
            }
        }

        if (credential) {
            admin.initializeApp({ credential });
            console.log('[NotificationService] Firebase Admin SDK initialized successfully');
        } else {
            console.log('[NotificationService] Firebase Admin credentials not configured. Push notification delivery is disabled.');
        }
    }
} catch (error) {
    console.warn('[NotificationService] Firebase Admin SDK initialization error:', error.message);
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
 * Internal: Send a priority push notification to a single user.
 * Handles Expo-vs-FCM branching in one place.
 *
 * @param {Object} opts
 * @param {string} [opts.pushToken]     - FCM token
 * @param {string} [opts.expoPushToken] - Expo push token
 * @param {string} opts.title
 * @param {string} opts.body
 * @param {Object} [opts.data={}]
 * @param {string} [opts.channelId='default']
 * @param {string} [opts.logLabel='Push'] - Label for error logging
 */
async function sendPriorityPush({ pushToken, expoPushToken, title, body, data = {}, channelId = 'default', logLabel = 'Push' }) {
    if (!pushToken && !expoPushToken) return;

    const payload = { title, body, data, priority: 'high', channelId };

    if (expoPushToken && exports.isExpoPushToken(expoPushToken)) {
        await exports.sendExpoPushNotifications([{ ...payload, to: expoPushToken }])
            .catch((e) => console.warn(`${logLabel} Expo push failed:`, e.message));
    } else if (pushToken) {
        await exports.sendPushNotifications([{ ...payload, to: pushToken }])
            .catch((e) => console.warn(`${logLabel} FCM push failed:`, e.message));
    }
}

/**
 * Send a violation push to a student (card-style: high priority, violations channel).
 * @param {Object} opts { pushToken?, expoPushToken?, violationType: string, detectedAt: Date, violationId?: string }
 */
exports.sendViolationPushToStudent = async (opts) => {
    const { pushToken, expoPushToken, violationType, detectedAt, violationId } = opts;
    const timeStr = detectedAt instanceof Date
        ? detectedAt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
        : new Date(detectedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const label = VIOLATION_LABELS[violationType] || violationType || 'Violation';

    await sendPriorityPush({
        pushToken,
        expoPushToken,
        title: 'Violation detected',
        body: `${label} at ${timeStr}. Please follow hostel rules to avoid further violations.`,
        data: { type: 'violation', violationType: violationType || 'improper-checkout', violationId: violationId || '', screen: 'violations' },
        channelId: 'violations',
        logLabel: 'Violation',
    });
};

/**
 * Send check-in push to student.
 * @param {Object} opts { pushToken?, expoPushToken?, autoCheckIn: boolean, timeStr: string }
 */
exports.sendCheckInPushToStudent = async (opts) => {
    const { pushToken, expoPushToken, autoCheckIn, timeStr } = opts;
    const title = autoCheckIn ? 'Auto check-in' : 'Check-in';
    const body = autoCheckIn
        ? `You were automatically checked in at ${timeStr}.`
        : `You were checked in at ${timeStr}.`;

    await sendPriorityPush({
        pushToken,
        expoPushToken,
        title,
        body,
        data: { type: 'check_in', autoCheckIn: String(!!autoCheckIn), screen: 'dashboard' },
        logLabel: 'Check-in',
    });
};

/**
 * Send leave request approved/rejected push to student.
 * @param {Object} opts { pushToken?, expoPushToken?, approved: boolean, permissionType?: string, requestedDate?: string, rejectionReason?: string, permissionId?: string }
 */
exports.sendLeaveRequestUpdateToStudent = async (opts) => {
    const { pushToken, expoPushToken, approved, permissionType, requestedDate, rejectionReason, permissionId } = opts;
    const typeLabel = (permissionType || 'leave').replace(/-/g, ' ');
    const dateStr = requestedDate ? new Date(requestedDate + 'T12:00:00').toLocaleDateString(undefined, { dateStyle: 'medium' }) : '';
    const title = approved ? 'Leave request approved' : 'Leave request not approved';
    const body = approved
        ? `Your ${typeLabel} request${dateStr ? ` for ${dateStr}` : ''} has been approved.`
        : `Your ${typeLabel} request was not approved.${rejectionReason ? ` Reason: ${rejectionReason}` : ''}`;

    await sendPriorityPush({
        pushToken,
        expoPushToken,
        title,
        body,
        data: { type: approved ? 'leave_approved' : 'leave_rejected', permissionId: permissionId || '', screen: 'leave' },
        logLabel: 'Leave',
    });
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
