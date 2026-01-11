import React, { useEffect, useMemo, useRef } from 'react';
import { View, StyleSheet, Animated, ViewStyle } from 'react-native';
import { useAppTheme } from '../ThemeProvider';
import type { Theme } from '../theme';

type SkeletonWidth = number | `${number}%` | 'auto';

interface SkeletonProps {
  width?: SkeletonWidth;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  width = '100%' as `${number}%`,
  height = 20,
  borderRadius,
  style,
}) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const opacity = useRef(new Animated.Value(0.3)).current;
  const resolvedRadius = borderRadius ?? theme.radii.sm;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        styles.skeleton,
        {
          width,
          height,
          borderRadius: resolvedRadius,
        },
        { opacity },
        style,
      ]}
    />
  );
};

export const ParcelCardSkeleton: React.FC = () => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  return (
    <View style={[styles.card, theme.shadows.sm]}>
      <View style={styles.cardHeader}>
        <Skeleton width={80} height={24} borderRadius={theme.radii.full} />
        <Skeleton width={60} height={20} borderRadius={theme.radii.full} />
      </View>
      <Skeleton width="100%" height={16} style={{ marginBottom: theme.spacing(1) }} />
      <Skeleton width="80%" height={14} style={{ marginBottom: theme.spacing(1) }} />
      <Skeleton width="60%" height={14} />
    </View>
  );
};

export const ListSkeleton: React.FC<{ count?: number }> = ({ count = 5 }) => {
  return (
    <>
      {Array.from({ length: count }).map((_, index) => (
        <ParcelCardSkeleton key={index} />
      ))}
    </>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    skeleton: {
      backgroundColor: theme.colors.backgroundDark,
    },
    card: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radii.lg,
      padding: theme.spacing(2),
      marginBottom: theme.spacing(2),
    },
    cardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: theme.spacing(2),
    },
  });
