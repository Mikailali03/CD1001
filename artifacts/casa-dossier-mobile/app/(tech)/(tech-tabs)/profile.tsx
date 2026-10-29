import React, { useEffect, useState } from "react";
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as Clipboard from "expo-clipboard";
import { Trans, useTranslation } from "react-i18next";
import { useUser } from "@clerk/expo";
import { useQueryClient } from "@tanstack/react-query";
import { getGetUserProfileQueryKey, useUpsertUserProfile } from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { apiErrorMessage, useRole } from "@/hooks/useRole";
import { useSignOut } from "@/hooks/useSignOut";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { LanguageToggle } from "@/components/LanguageToggle";
import { HOMEOWNER_HOME } from "@/components/tech/routes";
import { MONO } from "@/components/tech/ScanResultView";
import { Button, Chip, Notice, Section, Skeleton, TabHeader, ui, useFlash, useTabBottomPad } from "@/components/tech/ui";

export default function TechProfileScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  const router = useRouter();
  const bottomPad = useTabBottomPad();
  const qc = useQueryClient();
  const { user } = useUser();
  const signOut = useSignOut();
  const { profile, role, isAdmin, isLoading } = useRole();
  const upsert = useUpsertUserProfile();
  const { flash, show: showFlash } = useFlash();

  const [displayName, setDisplayName] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Seed the form from the saved profile, falling back to the Clerk account name.
  useEffect(() => {
    if (profile) {
      setDisplayName([profile.firstName, profile.lastName].filter(Boolean).join(" ") || (user?.fullName ?? ""));
      setPhone(profile.phone ?? "");
    } else if (user) {
      setDisplayName(user.fullName ?? "");
    }
  }, [profile?.userId, profile?.firstName, profile?.lastName, profile?.phone, user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const technicianNumber = profile?.technicianNumber;
  const email = user?.primaryEmailAddress?.emailAddress ?? profile?.email;

  function save() {
    setError(null);
    // The API stores first/last name separately. Never send `role` — it's admin-assigned.
    const [firstName = "", ...rest] = displayName.trim().split(/\s+/);
    if (!firstName) return setError(t("tech.profile.nameRequired"));
    upsert.mutate(
      { data: { firstName, lastName: rest.join(" "), email: email ?? undefined, phone: phone.trim() || undefined } },
      {
        onSuccess: (data) => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          qc.setQueryData(getGetUserProfileQueryKey(), data);
          qc.invalidateQueries({ queryKey: getGetUserProfileQueryKey() });
          showFlash(t("tech.profile.savedMessage"), t("tech.profile.savedTitle"));
        },
        onError: (err) => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          setError(apiErrorMessage(err) ?? t("tech.profile.saveError"));
        },
      },
    );
  }

  async function copyNumber() {
    if (!technicianNumber) return;
    await Clipboard.setStringAsync(technicianNumber);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function confirmSignOut() {
    Alert.alert(t("tech.profile.signOut"), t("tech.profile.signOutConfirm"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("tech.profile.signOut"),
        style: "destructive",
        onPress: async () => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          await signOut();
        },
      },
    ]);
  }

  const dirty =
    !!profile &&
    (displayName.trim() !== [profile.firstName, profile.lastName].filter(Boolean).join(" ") ||
      phone.trim() !== (profile.phone ?? ""));

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <TabHeader icon="user" title={t("tech.profile.title")} subtitle={email ?? undefined} />
      <KeyboardAwareScrollViewCompat
        contentContainerStyle={{ padding: 20, paddingBottom: bottomPad, gap: 16 }}
        showsVerticalScrollIndicator={false}
      >
        {isLoading ? (
          <View style={{ gap: 12 }} accessible accessibilityRole="progressbar" accessibilityLabel={t("tech.profile.loading")}>
            <Skeleton height={64} radius={12} />
            <Skeleton height={220} radius={12} />
          </View>
        ) : (
          <>
            {/* Technician ID badge */}
            {technicianNumber ? (
              <View style={[styles.badge, { backgroundColor: colors.primary + "0D", borderColor: colors.primary + "33" }]}>
                <Feather name="shield" size={18} color={colors.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={[ui.small, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>{t("tech.profile.yourId")}</Text>
                  <Text selectable style={[styles.techNo, { color: colors.foreground, fontFamily: MONO }]}>
                    {technicianNumber}
                  </Text>
                </View>
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel={copied ? t("tech.profile.idCopied") : t("tech.profile.copyId")}
                  onPress={copyNumber}
                  style={[styles.copyBtn, { borderColor: colors.border, backgroundColor: colors.card }]}
                  activeOpacity={0.7}
                >
                  <Feather name={copied ? "check" : "copy"} size={14} color={colors.primary} />
                  <Text style={[ui.small, { color: colors.primary, fontFamily: "Inter_600SemiBold" }]}>{copied ? t("tech.profile.copied") : t("tech.profile.copy")}</Text>
                </TouchableOpacity>
              </View>
            ) : null}

            {/* Profile form */}
            <Section icon="tool" title={t("tech.profile.details")}>
              <Text style={[ui.muted, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                {t("tech.profile.detailsHint")}
              </Text>
              <View style={{ gap: 6 }}>
                <Text style={[ui.label, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>{t("tech.profile.fullName")}</Text>
                <TextInput
                  accessibilityLabel={t("tech.profile.fullName")}
                  value={displayName}
                  onChangeText={setDisplayName}
                  placeholder={t("tech.profile.fullNamePlaceholder")}
                  placeholderTextColor={colors.mutedForeground}
                  autoComplete="name"
                  textContentType="name"
                  style={[ui.input, { color: colors.foreground, backgroundColor: colors.background, borderColor: colors.border, fontFamily: "Inter_400Regular" }]}
                />
              </View>
              <View style={{ gap: 6 }}>
                <Text style={[ui.label, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>{t("tech.profile.phone")}</Text>
                <TextInput
                  accessibilityLabel={t("tech.profile.phone")}
                  value={phone}
                  onChangeText={setPhone}
                  placeholder={t("tech.profile.phonePlaceholder")}
                  placeholderTextColor={colors.mutedForeground}
                  keyboardType="phone-pad"
                  autoComplete="tel"
                  textContentType="telephoneNumber"
                  style={[ui.input, { color: colors.foreground, backgroundColor: colors.background, borderColor: colors.border, fontFamily: "Inter_400Regular" }]}
                />
              </View>

              <View style={styles.statusRow}>
                {role === "technician" || role === "admin" ? (
                  <>
                    <Chip label={isAdmin ? t("tech.profile.admin") : t("tech.profile.verified")} color="#059669" icon="check-circle" />
                    <Chip label={t("tech.profile.active")} color="#059669" />
                  </>
                ) : (
                  <Chip label={t("tech.profile.awaitingApproval")} color="#d97706" icon="clock" />
                )}
              </View>

              {flash && <Notice tone="success" title={flash.title} message={flash.message} />}
              {error && <Notice tone="error" message={error} />}

              <Button
                label={upsert.isPending ? t("common.saving") : t("tech.profile.save")}
                icon="save"
                onPress={save}
                loading={upsert.isPending}
                disabled={!displayName.trim() || (!!profile && !dirty)}
              />
            </Section>

            {/* Language */}
            <Section icon="globe" title={t("language.label")}>
              <View style={styles.langRow}>
                <Text style={[ui.muted, { flex: 1, color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                  {t("language.description")}
                </Text>
                <LanguageToggle />
              </View>
            </Section>

            {/* About CasaService records */}
            <View style={[styles.infoCard, { borderColor: colors.border }]}>
              <Text style={[ui.muted, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                <Trans
                  i18nKey="tech.profile.casaServiceInfo"
                  components={{ b: <Text style={{ color: colors.foreground, fontFamily: "Inter_600SemiBold" }} /> }}
                />
              </Text>
            </View>

            {/* Account */}
            <Section>
              {isAdmin && (
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel={t("tech.profile.switchToHomeowner")}
                  onPress={() => {
                    Haptics.selectionAsync();
                    router.replace(HOMEOWNER_HOME);
                  }}
                  style={[styles.row, { borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth }]}
                  activeOpacity={0.6}
                >
                  <View style={[styles.rowIcon, { backgroundColor: colors.muted }]}>
                    <Feather name="home" size={18} color={colors.foreground} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.rowLabel, { color: colors.foreground, fontFamily: "Inter_500Medium" }]}>{t("tech.profile.switchToHomeowner")}</Text>
                    <Text style={[ui.small, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                      {t("tech.profile.adminsBoth")}
                    </Text>
                  </View>
                  <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
                </TouchableOpacity>
              )}
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel={t("tech.profile.signOut")}
                onPress={confirmSignOut}
                style={styles.row}
                activeOpacity={0.6}
              >
                <View style={[styles.rowIcon, { backgroundColor: colors.destructive + "15" }]}>
                  <Feather name="log-out" size={18} color={colors.destructive} />
                </View>
                <Text style={[styles.rowLabel, { flex: 1, color: colors.destructive, fontFamily: "Inter_500Medium" }]}>{t("tech.profile.signOut")}</Text>
              </TouchableOpacity>
            </Section>
          </>
        )}
      </KeyboardAwareScrollViewCompat>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 12, borderWidth: 1, padding: 14 },
  techNo: { fontSize: 16, fontWeight: "700" },
  copyBtn: { flexDirection: "row", alignItems: "center", gap: 5, borderWidth: 1, borderRadius: 99, paddingHorizontal: 12, paddingVertical: 7 },
  statusRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  infoCard: { borderWidth: 1, borderStyle: "dashed", borderRadius: 12, padding: 14 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 8 },
  rowIcon: { width: 36, height: 36, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  rowLabel: { fontSize: 15 },
  langRow: { flexDirection: "row", alignItems: "center", gap: 12 },
});
