import React, { useEffect, useRef } from "react";
import { Animated, View, Text, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

export function CasaServiceBadge() {
  const shimmer = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.timing(shimmer, {
        toValue: 1,
        duration: 2200,
        useNativeDriver: true,
      })
    ).start();
  }, [shimmer]);

  const translateX = shimmer.interpolate({
    inputRange: [0, 1],
    outputRange: [-60, 60],
  });

  return (
    <View style={styles.outer}>
      <View style={styles.inner}>
        <Text style={styles.label}>✦ CasaService</Text>
        <Animated.View
          style={[styles.shimmerLayer, { transform: [{ translateX }] }]}
          pointerEvents="none"
        >
          <LinearGradient
            colors={["transparent", "rgba(255,255,255,0.55)", "transparent"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#fde68a",
    overflow: "hidden",
    alignSelf: "center",
    marginRight: 2,
  },
  inner: {
    backgroundColor: "#fffbeb",
    paddingHorizontal: 5,
    paddingVertical: 2,
    overflow: "hidden",
  },
  label: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    color: "#92400e",
    letterSpacing: 0.4,
  },
  shimmerLayer: {
    ...StyleSheet.absoluteFillObject,
    width: 40,
  },
});
