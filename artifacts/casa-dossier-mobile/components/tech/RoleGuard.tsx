import React, { useEffect } from "react";
import { ActivityIndicator, AppState, StyleSheet, Text, View } from "react-native";
import { Redirect, useRouter, useSegments } from "expo-router";
import { useAuth } from "@clerk/expo";
import { useQueryClient } from "@tanstack/react-query";
import { getGetUserProfileQueryKey } from "@workspace/api-client-react";
import { useTranslation } from "react-i18next";
import { useColors } from "@/hooks/useColors";
import { useRole } from "@/hooks/useRole";
import { HOMEOWNER_HOME, HOMEOWNER_TABS_GROUP, TECH_GROUP, TECH_HOME } from "./routes";

/** Full-screen spinner shown while the user's role is being resolved. */
export function RoleLoading() {
  const { t } = useTranslation();
  const colors = useColors();
  return (
    <View
      style={[StyleSheet.absoluteFill, styles.center, { backgroundColor: colors.background }]}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={t("roleGuard.loadingA11y")}
    >
      <ActivityIndicator color={colors.primary} size="large" />
      <Text style={[styles.loadingText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
        {t("roleGuard.loading")}
      </Text>
    </View>
  );
}

/**
 * Group-level guard used by a route group's `_layout.tsx`. Because it lives in
 * the layout, every screen in the group (including deep links) is covered.
 *
 * - `app="tech"`: technicians and admins only; everyone else goes to the homeowner app.
 * - `app="homeowner"`: everyone except technicians; technicians go to the tech app.
 *   Admins may use both and switch from More / Profile.
 */
export function RoleGuard({ app, children }: { app: "tech" | "homeowner"; children: React.ReactNode }) {
  const { role, canUseTechApp, isLoading } = useRole();
  if (isLoading) return <RoleLoading />;
  if (app === "tech" && !canUseTechApp) return <Redirect href={HOMEOWNER_HOME} />;
  if (app === "homeowner" && role === "technician") return <Redirect href={TECH_HOME} />;
  return <>{children}</>;
}

/**
 * Root-level role routing, wrapped around the root Stack.
 *
 * - Refetches the profile whenever the app returns to the foreground, so an
 *   admin granting or revoking the technician role takes effect on next focus
 *   (the group guards above then move the user).
 * - Covers homeowner screens that live outside a group (asset/[id], job/[id],
 *   settings, …): a technician landing on one is sent to the tech app.
 * - Hides the screen behind a spinner while the role resolves or a redirect is
 *   pending, so the wrong app never flashes.
 */
export function RoleRoutingGate({ children }: { children: React.ReactNode }) {
  const { isSignedIn } = useAuth();
  const { role, isLoading } = useRole();
  const segments = useSegments();
  const router = useRouter();
  const queryClient = useQueryClient();

  const top = segments[0] as string | undefined;
  const onRootLevelScreen =
    !!top && top !== "sign-in" && top !== TECH_GROUP && top !== HOMEOWNER_TABS_GROUP;
  const techOnHomeownerScreen = !!isSignedIn && !isLoading && role === "technician" && onRootLevelScreen;

  useEffect(() => {
    if (techOnHomeownerScreen) router.replace(TECH_HOME);
  }, [techOnHomeownerScreen]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!isSignedIn) return;
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        queryClient.invalidateQueries({ queryKey: getGetUserProfileQueryKey() });
      }
    });
    return () => sub.remove();
  }, [isSignedIn, queryClient]);

  const blocking = !!isSignedIn && top !== "sign-in" && (isLoading || techOnHomeownerScreen);

  return (
    <View style={{ flex: 1 }}>
      {children}
      {blocking && <RoleLoading />}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: "center", justifyContent: "center", gap: 12 },
  loadingText: { fontSize: 13 },
});
