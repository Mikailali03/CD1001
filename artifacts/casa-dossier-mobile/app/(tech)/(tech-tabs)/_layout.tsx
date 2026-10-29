import { BlurView } from "expo-blur";
import { isLiquidGlassAvailable } from "expo-glass-effect";
import { Tabs } from "expo-router";
import { Icon, Label, NativeTabs } from "expo-router/unstable-native-tabs";
import { SymbolView } from "expo-symbols";
import { Feather } from "@expo/vector-icons";
import React from "react";
import { useTranslation } from "react-i18next";
import { Platform, StyleSheet, View, useColorScheme } from "react-native";
import { getListAssignedJobsQueryKey, useListAssignedJobs } from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";

// Mirrors app/(tabs)/_layout.tsx: Liquid Glass native tabs when available,
// classic blurred tab bar otherwise.

function useAssignedCount() {
  const { data } = useListAssignedJobs({ query: { queryKey: getListAssignedJobsQueryKey(), staleTime: 30_000 } });
  return data?.length ?? 0;
}

function NativeTabLayout() {
  const { t } = useTranslation();
  const assigned = useAssignedCount();
  return (
    <NativeTabs>
      <NativeTabs.Trigger name="open-jobs">
        <Icon sf={{ default: "map", selected: "map.fill" }} />
        <Label>{t("tech.tabs.openJobs")}</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="my-jobs" options={assigned > 0 ? { badgeValue: String(assigned) } : undefined}>
        <Icon sf={{ default: "briefcase", selected: "briefcase.fill" }} />
        <Label>{t("tech.tabs.myJobs")}</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="scan">
        <Icon sf="qrcode.viewfinder" />
        <Label>{t("tech.tabs.scan")}</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="profile">
        <Icon sf={{ default: "person.crop.circle", selected: "person.crop.circle.fill" }} />
        <Label>{t("tech.tabs.profile")}</Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}

function ClassicTabLayout() {
  const { t } = useTranslation();
  const colors = useColors();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const isIOS = Platform.OS === "ios";
  const isWeb = Platform.OS === "web";
  const assigned = useAssignedCount();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.mutedForeground,
        headerShown: false,
        tabBarStyle: {
          position: "absolute",
          backgroundColor: isIOS ? "transparent" : colors.background,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          elevation: 0,
          ...(isWeb ? { height: 84 } : {}),
        },
        tabBarBackground: () =>
          isIOS ? (
            <BlurView intensity={100} tint={isDark ? "dark" : "light"} style={StyleSheet.absoluteFill} />
          ) : isWeb ? (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.background }]} />
          ) : null,
      }}
    >
      <Tabs.Screen
        name="open-jobs"
        options={{
          title: t("tech.tabs.openJobs"),
          tabBarIcon: ({ color }) =>
            isIOS ? <SymbolView name="map" tintColor={color} size={24} /> : <Feather name="map" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="my-jobs"
        options={{
          title: t("tech.tabs.myJobs"),
          tabBarBadge: assigned > 0 ? assigned : undefined,
          tabBarIcon: ({ color }) =>
            isIOS ? <SymbolView name="briefcase" tintColor={color} size={24} /> : <Feather name="briefcase" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="scan"
        options={{
          title: t("tech.tabs.scan"),
          tabBarIcon: ({ color }) =>
            isIOS ? <SymbolView name="qrcode.viewfinder" tintColor={color} size={24} /> : <Feather name="maximize" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t("tech.tabs.profile"),
          tabBarIcon: ({ color }) =>
            isIOS ? <SymbolView name="person.crop.circle" tintColor={color} size={24} /> : <Feather name="user" size={22} color={color} />,
        }}
      />
    </Tabs>
  );
}

export default function TechTabLayout() {
  if (isLiquidGlassAvailable()) {
    return <NativeTabLayout />;
  }
  return <ClassicTabLayout />;
}
