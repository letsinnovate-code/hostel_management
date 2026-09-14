import React, { useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import { useRouter, usePathname } from 'expo-router';

const SWIPE_THRESHOLD = 50;
const EDGE_WIDTH = 28;

const MAIN_TABS = ['dashboard', 'map', 'mess', 'services', 'more'];

export default function TabSwipeHandler() {
  const router = useRouter();
  const pathname = usePathname();

  const screen = pathname?.split('/').filter(Boolean).pop() ?? '';
  const isMainTab = MAIN_TABS.includes(screen);

  const goBack = useCallback(() => {
    if (isMainTab) return;

    if (['leave', 'maintenance', 'fees'].includes(screen)) {
      if (router.canGoBack()) router.back();
      else router.navigate('/(student)/services');
    } else if (['permissions', 'visitors', 'violations', 'complaints', 'profile', 'support'].includes(screen)) {
      if (router.canGoBack()) router.back();
      else router.navigate('/(student)/more');
    } else if (screen === 'mess-feedback') {
      if (router.canGoBack()) router.back();
      else router.navigate('/(student)/mess');
    }
  }, [isMainTab, screen, router]);

  const leftEdgePan = Gesture.Pan()
    .activeOffsetX(10)
    .failOffsetY([-18, 18])
    .onEnd((e) => {
      if (e.translationX > SWIPE_THRESHOLD || e.velocityX > 250) {
        runOnJS(goBack)();
      }
    });

  // Do not intercept edge gestures on main tabs (dashboard, map, mess, services, more)
  // to avoid interfering with native device gestures and preventing unwanted dashboard redirects.
  if (isMainTab) return null;

  return (
    <View style={styles.container} pointerEvents="box-none">
      <GestureDetector gesture={leftEdgePan}>
        <View style={styles.edgeLeft} />
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
  },
  edgeLeft: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: EDGE_WIDTH,
  },
});
