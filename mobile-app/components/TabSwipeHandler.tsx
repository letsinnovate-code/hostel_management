import React, { useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import { useRouter, usePathname } from 'expo-router';

const TAB_ROUTES = [
  '/(student)/dashboard',
  '/(student)/map',
  '/(student)/mess',
  '/(student)/services',
  '/(student)/more',
] as const;

const SWIPE_THRESHOLD = 50;
const EDGE_WIDTH = 28;

export default function TabSwipeHandler() {
  const router = useRouter();
  const pathname = usePathname();

  const screen = pathname?.split('/').filter(Boolean).pop() ?? '';
  const currentIndex = TAB_ROUTES.findIndex((r) => pathname === r || r.endsWith('/' + screen));
  const index = currentIndex < 0 ? 0 : currentIndex;

  const goPrev = useCallback(() => {
    if (index <= 0) return;
    router.replace(TAB_ROUTES[index - 1]);
  }, [index, router]);

  const goNext = useCallback(() => {
    if (index >= TAB_ROUTES.length - 1) return;
    router.replace(TAB_ROUTES[index + 1]);
  }, [index, router]);

  const leftEdgePan = Gesture.Pan()
    .activeOffsetX(10)
    .failOffsetY([-18, 18])
    .onEnd((e) => {
      if (e.translationX > SWIPE_THRESHOLD || e.velocityX > 250) runOnJS(goPrev)();
    });

  const rightEdgePan = Gesture.Pan()
    .activeOffsetX(-10)
    .failOffsetY([-18, 18])
    .onEnd((e) => {
      if (e.translationX < -SWIPE_THRESHOLD || e.velocityX < -250) runOnJS(goNext)();
    });

  return (
    <View style={styles.container} pointerEvents="box-none">
      <GestureDetector gesture={leftEdgePan}>
        <View style={styles.edgeLeft} />
      </GestureDetector>
      <GestureDetector gesture={rightEdgePan}>
        <View style={styles.edgeRight} />
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
  edgeRight: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: EDGE_WIDTH,
  },
});
