import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, Easing, Platform, Alert, TouchableOpacity } from 'react-native';
import DatabaseManager from '../data/database';
import theme, { spacing, typography } from '../theme';

// Attempt to load Lottie dynamically. If not present, we fallback to RN animation.
let LottieView: any = null;
try {
  // Use a runtime require hidden from Metro so the bundler doesn't
  // statically resolve this optional native dependency when it's not installed.
  // eslint-disable-next-line no-eval
  const maybeRequire = eval('require');
  LottieView = maybeRequire('lottie-react-native');
} catch (e) {
  LottieView = null;
}
// Normalize LottieView to the actual component (handle CJS/ESM default)
if (LottieView && typeof LottieView === 'object' && (LottieView.default || LottieView.Component)) {
  LottieView = LottieView.default ?? LottieView.Component ?? LottieView;
}

type Props = { onContinue?: () => void };

export default function DatabaseLoading({ onContinue }: Props) {
  const [progress, setProgress] = useState<{ inserted: number; total: number } | null>(DatabaseManager.seedingProgress ?? null);
  const pulse = useRef(new Animated.Value(0)).current;
  const dots = [useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current];

  useEffect(() => {
    const listener = (p: { inserted: number; total: number } | null) => setProgress(p);
    DatabaseManager.addSeedingListener(listener);
    setProgress(DatabaseManager.seedingProgress ?? null);
    return () => DatabaseManager.removeSeedingListener(listener);
  }, []);

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ])
    ).start();

    const animations = dots.map((d, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 120),
          Animated.timing(d, { toValue: 1, duration: 420, easing: Easing.linear, useNativeDriver: true }),
          Animated.timing(d, { toValue: 0, duration: 420, easing: Easing.linear, useNativeDriver: true }),
          Animated.delay(240),
        ])
      )
    );
    animations.forEach(a => a.start());
  }, [pulse, dots]);

  const percent = progress && progress.total > 0 ? Math.min(1, progress.inserted / progress.total) : null;
  const lottieAvailable = !!LottieView && !!(LottieView.default || LottieView);

  const handleContinue = () => {
    if (typeof onContinue === 'function') return onContinue();
    Alert.alert('Continuer', 'La base de données est en cours d\'import. Vous pouvez continuer.');
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        {lottieAvailable ? (
          <View style={styles.lottieWrap}>
            {/* If a local JSON exists at assets/loaders/db-loader.json it will be used; otherwise fall back to a public Lottie URL. */}
            {/* @ts-ignore */}
            {(() => {
              try {
                const local = require('../../assets/loaders/db-loader.json');
                const Comp = LottieView;
                return Comp ? <Comp source={local} autoPlay loop style={styles.lottie} /> : null;
              } catch (e) {
                const remote = 'https://assets9.lottiefiles.com/packages/lf20_j1adxtyb.json';
                try {
                  const Comp = LottieView;
                  return Comp ? <Comp source={{ uri: remote }} autoPlay loop style={styles.lottie} /> : null;
                } catch (ee) {
                  return null;
                }
              }
            })()}
            <Text style={styles.title}>Chargement de la base de données</Text>
            <Text style={styles.subtitle}>{progress ? `${progress.inserted} / ${progress.total} importées` : 'Préparation des données…'}</Text>
          </View>
        ) : (
          <View style={styles.fallbackWrap}>
            <Animated.View
              style={[
                styles.logoCircle,
                { transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] }) }] },
              ]}
            />
            <Text style={styles.title}>Chargement de la base de données</Text>
            <Text style={styles.subtitle}>{progress ? `${progress.inserted} / ${progress.total} importées` : 'Préparation des données…'}</Text>

            <View style={styles.dotsRow}>
              {dots.map((d, i) => (
                <Animated.View
                  key={`dot-${i}`}
                  style={[
                    styles.dot,
                    {
                      opacity: d,
                      transform: [{ translateY: d.interpolate({ inputRange: [0, 1], outputRange: [0, -6] }) }],
                      backgroundColor: i === 0 ? theme.appColors.primary : i === 1 ? theme.appColors.accent : theme.appColors.secondary,
                    },
                  ]}
                />
              ))}
            </View>

            <View style={styles.progressOuter} accessible accessibilityLabel="progress-bar">
              <View style={[styles.progressInner, { width: percent != null ? `${Math.round((percent || 0) * 100)}%` : '8%' }]} />
            </View>
            <Text style={styles.progressText}>{progress ? `${progress.inserted} / ${progress.total} importées` : 'Préparation...'}</Text>
          </View>
        )}

        <TouchableOpacity style={styles.button} onPress={handleContinue}>
          <Text style={styles.buttonText}>Continuer</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
// ...existing code...
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.appColors.background, padding: 16 },
  card: {
    padding: 22,
    borderRadius: 16,
    width: '100%',
    maxWidth: 640,
    alignItems: 'center',
    backgroundColor: theme.appColors.surface,
    elevation: 4,
    shadowColor: theme.appColors.cardShadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.10,
    shadowRadius: 8,
    marginBottom: 18,
  },
  lottieWrap: { alignItems: 'center', width: '100%' },
  lottie: { width: 160, height: 160 },
  fallbackWrap: { alignItems: 'center', width: '100%' },
  logoCircle: { width: 88, height: 88, borderRadius: 44, backgroundColor: theme.appColors.primary, marginBottom: 14, opacity: 0.98 },
  title: { fontSize: 22, fontWeight: '800', color: theme.appColors.text, marginTop: 6, marginBottom: 8 },
  subtitle: { fontSize: typography.body, color: theme.appColors.subtext, marginTop: 6, textAlign: 'center' },
  dotsRow: { flexDirection: 'row', alignItems: 'center', marginTop: 16 },
  dot: { width: 10, height: 10, borderRadius: 6, marginHorizontal: 6 },
  progressOuter: { marginTop: 18, width: '84%', height: 10, backgroundColor: theme.appColors.muted, borderRadius: 6, overflow: 'hidden' },
  progressInner: { height: '100%', backgroundColor: theme.appColors.accent },
  progressText: { marginTop: 8, color: theme.appColors.subtext },
  button: {
    marginTop: 18,
    backgroundColor: theme.appColors.primary,
    borderRadius: 24,
    paddingVertical: 16,
    paddingHorizontal: 32,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 120,
    elevation: 2,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 18,
    letterSpacing: 1,
  },
});
