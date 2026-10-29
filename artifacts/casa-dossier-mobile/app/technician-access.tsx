import React, { useState } from "react";
import { Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import * as Clipboard from "expo-clipboard";
import { useTranslation } from "react-i18next";
import { useUser } from "@clerk/expo";
import { useColors } from "@/hooks/useColors";
import { useRole } from "@/hooks/useRole";
import { TECH_HOME } from "@/components/tech/routes";
import { Button, Chip, Notice, Section, ui } from "@/components/tech/ui";

/**
 * "Are you a technician?" — reached from the homeowner More tab.
 *
 * The technician role can only be granted by an admin (PUT /user/profile
 * ignores `role`), so this explains the process and gives the user their
 * account email to share. Once approved, the next profile refetch (on app
 * focus or pull-to-refresh here) moves them into the technician app.
 */
export default function TechnicianAccessScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const { user } = useUser();
  const { role, isAdmin, refetch } = useRole();
  const [copied, setCopied] = useState(false);
  const [checking, setChecking] = useState(false);
  const [checkedOnce, setCheckedOnce] = useState(false);

  const email = user?.primaryEmailAddress?.emailAddress;

  async function copyEmail() {
    if (!email) return;
    await Clipboard.setStringAsync(email);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function checkStatus() {
    setChecking(true);
    Haptics.selectionAsync();
    await refetch();
    setChecking(false);
    setCheckedOnce(true);
    // If approved, the homeowner group guard redirects to the tech app automatically.
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={[styles.header, { paddingTop: topPad, borderBottomColor: colors.border }]}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={t("common.goBack")}
          hitSlop={8}
          onPress={() => router.back()}
          style={styles.backBtn}
          activeOpacity={0.7}
        >
          <Feather name="chevron-left" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <Text accessibilityRole="header" style={[styles.headerTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
          {t("techAccess.title")}
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 32, gap: 16 }}>
        {isAdmin ? (
          <Section icon="shield" title={t("techAccess.admin")}>
            <Text style={[ui.body, { color: colors.foreground, fontFamily: "Inter_400Regular" }]}>
              {t("techAccess.adminBody")}
            </Text>
            <Button
              label={t("techAccess.switchToTech")}
              icon="tool"
              onPress={() => {
                Haptics.selectionAsync();
                router.replace(TECH_HOME);
              }}
            />
          </Section>
        ) : (
          <>
            <View style={[styles.hero, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={[styles.heroIcon, { backgroundColor: colors.primary + "15" }]}>
                <Feather name="tool" size={22} color={colors.primary} />
              </View>
              <Text style={[styles.heroTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
                {t("techAccess.heroTitle")}
              </Text>
              <Text style={[ui.body, { color: colors.mutedForeground, fontFamily: "Inter_400Regular", textAlign: "center" }]}>
                {t("techAccess.heroBody")}
              </Text>
              <Chip label={t("techAccess.notApproved")} color="#d97706" icon="clock" />
            </View>

            <Section icon="info" title={t("techAccess.howTo")}>
              <Step n={1} text={t("techAccess.step1")} />
              <Step n={2} text={t("techAccess.step2")} />
              <Step n={3} text={t("techAccess.step3")} />
            </Section>

            <Section icon="mail" title={t("techAccess.email")}>
              {email ? (
                <View style={styles.emailRow}>
                  <Text selectable style={[ui.body, { flex: 1, color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
                    {email}
                  </Text>
                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel={copied ? t("techAccess.emailCopied") : t("techAccess.copyEmail")}
                    onPress={copyEmail}
                    style={[styles.copyBtn, { borderColor: colors.border }]}
                    activeOpacity={0.7}
                  >
                    <Feather name={copied ? "check" : "copy"} size={14} color={colors.primary} />
                    <Text style={[ui.small, { color: colors.primary, fontFamily: "Inter_600SemiBold" }]}>{copied ? t("tech.profile.copied") : t("tech.profile.copy")}</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <Text style={[ui.muted, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                  {t("techAccess.noEmail")}
                </Text>
              )}
            </Section>

            {checkedOnce && !checking && role === "homeowner" && (
              <Notice tone="info" message={t("techAccess.notApprovedYet")} />
            )}
            <Button label={checking ? t("techAccess.checking") : t("techAccess.checkStatus")} icon="refresh-cw" variant="outline" onPress={checkStatus} loading={checking} />
          </>
        )}
      </ScrollView>
    </View>
  );
}

function Step({ n, text }: { n: number; text: string }) {
  const colors = useColors();
  return (
    <View style={styles.step}>
      <View style={[styles.stepNum, { backgroundColor: colors.primary }]}>
        <Text style={[ui.small, { color: colors.primaryForeground, fontFamily: "Inter_700Bold" }]}>{n}</Text>
      </View>
      <Text style={[ui.body, { flex: 1, color: colors.foreground, fontFamily: "Inter_400Regular" }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, gap: 10 },
  backBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 17 },
  hero: { alignItems: "center", gap: 10, borderRadius: 14, borderWidth: 1, padding: 20 },
  heroIcon: { width: 52, height: 52, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  heroTitle: { fontSize: 18, textAlign: "center" },
  step: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  stepNum: { width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center", marginTop: 1 },
  emailRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  copyBtn: { flexDirection: "row", alignItems: "center", gap: 5, borderWidth: 1, borderRadius: 99, paddingHorizontal: 12, paddingVertical: 7 },
});
