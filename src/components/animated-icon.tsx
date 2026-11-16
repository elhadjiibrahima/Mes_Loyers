import { Image } from 'expo-image';
import * as SplashScreen from 'expo-splash-screen';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, Keyframe } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

const DURATION = 600;

/** Prolonge l'écran de démarrage natif (vert, icône) puis le fait disparaître en fondu. */
export function AnimatedSplashOverlay() {
  const [animate, setAnimate] = useState(false);
  const [visible, setVisible] = useState(true);

  if (!visible) return null;

  const fondu = new Keyframe({
    0: { opacity: 1, transform: [{ scale: 1 }] },
    30: { opacity: 1 },
    100: { opacity: 0, transform: [{ scale: 1.08 }], easing: Easing.out(Easing.quad) },
  });

  const image = <Image style={styles.image} source={require('@/assets/images/splash-icon.png')} />;

  return animate ? (
    <Animated.View
      entering={fondu.duration(DURATION).withCallback((finished) => {
        'worklet';
        if (finished) scheduleOnRN(setVisible, false);
      })}
      style={styles.overlay}>
      {image}
    </Animated.View>
  ) : (
    <View onLayout={() => SplashScreen.hideAsync().finally(() => setAnimate(true))} style={styles.overlay}>
      {image}
    </View>
  );
}

const styles = StyleSheet.create({
  image: { width: 140, height: 140 },
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#0F7B5F',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
});
