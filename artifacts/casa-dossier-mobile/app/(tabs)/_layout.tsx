import { BlurView } from "expo-blur";
import { isLiquidGlassAvailable } from "expo-glass-effect";
import { Tabs } from "expo-router";
import { Icon, Label, NativeTabs } from "expo-router/unstable-native-tabs";
import { SymbolView } from "expo-symbols";
import { Feather } from "@expo/vector-icons";
import React from "react";
import { Platform, StyleSheet, View, useColorScheme } from "react-native";
import { useColors } from "@/hooks/useColors";
import { InboxProvider, useInboxPendingCount } from "@/context/InboxContext";
import { RoleGuard } from "@/components/tech/RoleGuard";
import { useTranslation } from "react-i18next";

function NativeTabLayout() {
  const { t } = useTranslation();
  const pendingCount = useInboxPendingCount();
  return (
    <NativeTabs>
      <NativeTabs.Trigger
        name="index"
        options={pendingCount > 0 ? { badgeValue: String(pendingCount) } : undefined}
      >
        <Icon sf={{ default: "house", selected: "house.fill" }} />
        <Label>{t("tabs.home")}</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="assets">
        <Icon sf={{ default: "list.bullet.rectangle", selected: "list.bullet.rectangle.fill" }} />
        <Label>{t("tabs.assets")}</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="find-a-pro">
        <Icon sf={{ default: "person.badge.plus", selected: "person.badge.plus.fill" }} />
        <Label>{t("tabs.findPro")}</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="more">
        <Icon sf={{ default: "ellipsis.circle", selected: "ellipsis.circle.fill" }} />
        <Label>{t("tabs.more")}</Label>
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
  const pendingCount = useInboxPendingCount();

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
            <BlurView
              intensity={100}
              tint={isDark ? "dark" : "light"}
              style={StyleSheet.absoluteFill}
            />
          ) : isWeb ? (
            <View
              style={[StyleSheet.absoluteFill, { backgroundColor: colors.background }]}
            />
          ) : null,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t("tabs.home"),
          tabBarBadge: pendingCount > 0 ? pendingCount : undefined,
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name="house" tintColor={color} size={24} />
            ) : (
              <Feather name="home" size={22} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="assets"
        options={{
          title: t("tabs.assets"),
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name="list.bullet.rectangle" tintColor={color} size={24} />
            ) : (
              <Feather name="list" size={22} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="find-a-pro"
        options={{
          title: t("tabs.findPro"),
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name="person.badge.plus" tintColor={color} size={24} />
            ) : (
              <Feather name="user-check" size={22} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: t("tabs.more"),
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name="ellipsis.circle" tintColor={color} size={24} />
            ) : (
              <Feather name="more-horizontal" size={22} color={color} />
            ),
        }}
      />
    </Tabs>
  );
}

function TabLayoutInner() {
  if (isLiquidGlassAvailable()) {
    return <NativeTabLayout />;
  }
  return <ClassicTabLayout />;
}

export default function TabLayout() {
  // Technicians are redirected to the technician app (app/(tech)); see RoleGuard.
  return (
    <RoleGuard app="homeowner">
      <InboxProvider>
        <TabLayoutInner />
      </InboxProvider>
    </RoleGuard>
  );
}
