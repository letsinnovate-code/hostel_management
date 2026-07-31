import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import api from './api';

const LOCATION_TASK_NAME = 'background-location-task';

// Define the background task – network often fails when app is backgrounded (e.g. iOS Simulator); retry once and log as warn
async function sendBackgroundLocationUpdate(lat: number, lng: number, accuracy?: number, retry = true): Promise<void> {
    try {
        await api.updateLocation(
            { latitude: lat, longitude: lng },
            accuracy
        );
    } catch (err: any) {
        const isNetwork = err?.message?.includes('Network') || err?.message?.includes('connection') || err?.message?.includes('timeout');
        if (isNetwork && retry) {
            await new Promise((r) => setTimeout(r, 2000));
            return sendBackgroundLocationUpdate(lat, lng, accuracy, false);
        }
        if (__DEV__) {
            console.warn('Background location update skipped:', isNetwork ? 'no network (common when backgrounded)' : err?.message || err);
        }
    }
}

TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }: any) => {
    if (error) {
        if (__DEV__) console.warn('Background location task error:', error);
        return;
    }
    if (data?.locations?.length > 0) {
        const location = data.locations[0];
        await sendBackgroundLocationUpdate(
            location.coords.latitude,
            location.coords.longitude,
            location.coords.accuracy
        );
    }
});

export class LocationService {
    static async requestPermissions() {
        try {
            const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
            if (foregroundStatus !== 'granted') {
                console.warn('Foreground location permission denied');
                return { status: 'denied', error: 'Foreground location permission denied' };
            }

            const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();
            if (backgroundStatus !== 'granted') {
                console.warn('Background location permission denied');
                return { status: 'denied', error: 'Background location permission denied' };
            }

            return { status: 'granted' };
        } catch (error) {
            console.error('Error requesting location permissions:', error);
            return { status: 'denied', error: `Error requesting permissions: ${error}` };
        }
    }

    static async startTracking(): Promise<void> {
        try {
            const hasStarted = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
            if (hasStarted) return;

            await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
                accuracy: Location.Accuracy.Balanced,
                timeInterval: 2 * 60 * 1000, // 2 minutes – must fire even when not moving (auto check-in without opening app)
                distanceInterval: 0, // 0 = time-based only so we get updates every 2 min without movement
                foregroundService: {
                    notificationTitle: 'Hostel Attendance',
                    notificationBody: 'Automatic attendance tracking is active',
                },
            });
        } catch (error) {
            console.warn('LocationService.startTracking error:', error);
            // Don't throw – app should work without background tracking
        }
    }

    static async stopTracking(): Promise<void> {
        try {
            const hasStarted = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
            if (hasStarted) {
                await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
            }
        } catch (_) {
            // Ignore – task may not be running
        }
    }

    static async updateCurrentLocation() {
        try {
            const location = await Location.getCurrentPositionAsync({
                accuracy: Location.Accuracy.Balanced,
            });

            await api.updateLocation(
                {
                    latitude: location.coords.latitude,
                    longitude: location.coords.longitude,
                },
                location.coords.accuracy ?? undefined
            );

            return {
                latitude: location.coords.latitude,
                longitude: location.coords.longitude,
                accuracy: location.coords.accuracy ?? undefined,
            };
        } catch (error) {
            console.error('Error getting current location:', error);
            throw error;
        }
    }

    static async checkStatus(): Promise<{
        foregroundPermission: string;
        backgroundPermission: string;
        isTracking: boolean;
    }> {
        try {
            const { status: foregroundStatus } = await Location.getForegroundPermissionsAsync();
            let backgroundStatus: string = 'undetermined';
            let isTracking = false;
            try {
                const bg = await Location.getBackgroundPermissionsAsync();
                backgroundStatus = bg?.status ?? 'undetermined';
            } catch (_) {
                // getBackgroundPermissionsAsync may not exist or throw on some platforms
            }
            try {
                isTracking = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
            } catch (_) {
                // can throw if task not registered or on unsupported platform
            }
            return {
                foregroundPermission: foregroundStatus ?? 'undetermined',
                backgroundPermission: backgroundStatus,
                isTracking,
            };
        } catch (error) {
            console.warn('LocationService.checkStatus error:', error);
            return {
                foregroundPermission: 'undetermined',
                backgroundPermission: 'undetermined',
                isTracking: false,
            };
        }
    }

    /**
     * Start watching position while app is in foreground. Callback is invoked on each update.
     * Use when student is "inside" so exit-without-checkout is detected as soon as they leave the boundary.
     * @returns cleanup function to stop watching
     */
    static startForegroundWatch(
        onLocation: (coords: { latitude: number; longitude: number }, accuracy?: number) => void | Promise<void>
    ): () => void {
        let cancelled = false;
        let subscription: { remove: () => void } | null = null;

        const safeStart = () => {
            Location.watchPositionAsync(
                {
                    accuracy: Location.Accuracy.Balanced,
                    timeInterval: 60 * 1000, // at least every 1 min
                    distanceInterval: 25, // or when they move 25m – catch exit quickly
                },
                (loc) => {
                    if (cancelled || !loc?.coords) return;
                    try {
                        const coords = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
                        const acc = loc.coords.accuracy ?? undefined;
                        Promise.resolve(onLocation(coords, acc)).catch((err) =>
                            console.warn('Foreground watch onLocation error:', err)
                        );
                    } catch (_) {}
                }
            )
                .then((sub) => {
                    if (!cancelled && sub) subscription = sub;
                    else if (sub?.remove) sub.remove();
                })
                .catch((err) => console.warn('startForegroundWatch failed:', err));
        };
        try {
            safeStart();
        } catch (_) {
            console.warn('startForegroundWatch sync error');
        }

        return () => {
            cancelled = true;
            try {
                if (subscription?.remove) subscription.remove();
            } catch (_) {}
            subscription = null;
        };
    }
}

export default LocationService;
