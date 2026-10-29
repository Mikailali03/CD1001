import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Platform,
  Alert,
  Linking,
  ActivityIndicator,
  Switch,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useUser, useAuth } from "@clerk/expo";
import * as Notifications from "expo-notifications";
import * as Haptics from "expo-haptics";
import { useTranslation } from "react-i18next";
import { LanguageToggle } from "@/components/LanguageToggle";
import { useColors } from "@/hooks/useColors";
import { useSignOut } from "@/hooks/useSignOut";
import { deleteUserAccount } from "@workspace/api-client-react";
import { apiErrorMessage } from "@/hooks/useRole";
import { requestNotificationPermission, syncNotifications } from "@/lib/notifications";
import { ActionRow } from "@/components/settings/ActionRow";
import { FieldRow } from "@/components/settings/FieldRow";
import { SectionLabel } from "@/components/settings/SectionLabel";
import { SettingsCard } from "@/components/settings/SettingsCard";

export default function SettingsScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useUser();
  const { getToken, userId } = useAuth();
  const signOut = useSignOut();
  const [deletingAccount, setDeletingAccount] = useState(false);

  const [firstName, setFirstName] = useState(user?.firstName ?? "");
  const [lastName, setLastName] = useState(user?.lastName ?? "");
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileDirty, setProfileDirty] = useState(false);

  const [notifStatus, setNotifStatus] = useState<"granted" | "denied" | "undetermined">("undetermined");

  useEffect(() => {
    type Perm = { granted: boolean; canAskAgain: boolean };
    Notifications.getPermissionsAsync().then((r) => {
      const { granted, canAskAgain } = r as unknown as Perm;
      setNotifStatus(granted ? "granted" : canAskAgain ? "undetermined" : "denied");
    });
  }, []);

  const handleFirstNameChange = (v: string) => {
    setFirstName(v);
    setProfileDirty(true);
  };
  const handleLastNameChange = (v: string) => {
    setLastName(v);
    setProfileDirty(true);
  };

  const handleSaveProfile = async () => {
    if (!profileDirty) return;
    setSavingProfile(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await user?.update({ firstName: firstName.trim(), lastName: lastName.trim() });
      setProfileDirty(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      Alert.alert(t("common.error"), t("settings.profileSaveError"));
    } finally {
      setSavingProfile(false);
    }
  };

  const openNotifSettings = () => {
    Haptics.selectionAsync();
    if (Platform.OS === "ios") {
      Linking.openURL("app-settings:");
    } else {
      Linking.openSettings();
    }
  };

  const requestNotifPermission = async () => {
    Haptics.selectionAsync();
    const { granted, canAskAgain } = await requestNotificationPermission();
    setNotifStatus(granted ? "granted" : canAskAgain ? "undetermined" : "denied");
    if (granted) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      // Register the push token and schedule reminders right away
      if (userId) syncNotifications(getToken, userId, { force: true });
    }
  };

  const performAccountDeletion = async () => {
    setDeletingAccount(true);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30_000);
    try {
      await deleteUserAccount({ signal: controller.signal });
      await signOut();
      router.replace("/");
    } catch (err: unknown) {
      setDeletingAccount(false);
      const isTimeout = err instanceof Error && err.name === "AbortError";
      Alert.alert(
        t("settings.deleteFailedTitle"),
        isTimeout
          ? t("settings.deleteTimeout")
          : (apiErrorMessage(err) ?? t("settings.deleteFailed")),
        [{ text: t("common.ok") }]
      );
    } finally {
      clearTimeout(timeoutId);
    }
  };

  const handleDeleteAccount = () => {
    if (deletingAccount) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    Alert.alert(
      t("settings.deleteAccount"),
      t("settings.deleteConfirmBody"),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("settings.deleteMyAccount"),
          style: "destructive",
          onPress: () => {
            // Second confirmation
            Alert.alert(
              t("settings.deleteSureTitle"),
              t("settings.deleteSureBody"),
              [
                { text: t("common.cancel"), style: "cancel" },
                {
                  text: t("settings.deleteEverything"),
                  style: "destructive",
                  onPress: performAccountDeletion,
                },
              ]
            );
          },
        },
      ]
    );
  };

  const notifBadge =
    notifStatus === "granted"
      ? { label: t("settings.notifEnabled"), color: colors.success }
      : notifStatus === "denied"
      ? { label: t("settings.notifDisabled"), color: colors.destructive }
      : { label: t("settings.notifNotSet"), color: colors.warning };

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 8, borderBottomColor: colors.border }]}>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel={t("common.goBack")} onPress={() => router.back()} style={styles.backBtn} hitSlop={12}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>{t("settings.title")}</Text>
        {profileDirty ? (
          <TouchableOpacity onPress={handleSaveProfile} style={styles.saveBtn} disabled={savingProfile}>
            {savingProfile ? (
              <ActivityIndicator size="small" color={colors.primaryForeground} />
            ) : (
              <Text style={[styles.saveBtnText, { color: colors.primaryForeground, fontFamily: "Inter_600SemiBold" }]}>{t("common.save")}</Text>
            )}
          </TouchableOpacity>
        ) : (
          <View style={{ width: 60 }} />
        )}
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 40, paddingTop: 24, gap: 8 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile */}
        <View style={{ paddingHorizontal: 20, marginBottom: 8 }}>
          <SectionLabel label={t("settings.sections.profile")} colors={colors} />
        </View>
        <SettingsCard colors={colors}>
          <FieldRow label={t("settings.firstName")} colors={colors}>
            <TextInput
              value={firstName}
              onChangeText={handleFirstNameChange}
              style={[styles.input, { color: colors.foreground, fontFamily: "Inter_400Regular" }]}
              placeholderTextColor={colors.mutedForeground}
              placeholder={t("settings.firstName")}
              returnKeyType="next"
            />
          </FieldRow>
          <FieldRow label={t("settings.lastName")} colors={colors}>
            <TextInput
              value={lastName}
              onChangeText={handleLastNameChange}
              style={[styles.input, { color: colors.foreground, fontFamily: "Inter_400Regular" }]}
              placeholderTextColor={colors.mutedForeground}
              placeholder={t("settings.lastName")}
              returnKeyType="done"
              onSubmitEditing={handleSaveProfile}
            />
          </FieldRow>
          <FieldRow label={t("settings.email")} colors={colors} last>
            <Text style={[styles.input, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              {user?.primaryEmailAddress?.emailAddress ?? "—"}
            </Text>
          </FieldRow>
        </SettingsCard>

        {/* Notifications */}
        <View style={{ paddingHorizontal: 20, marginTop: 20, marginBottom: 8 }}>
          <SectionLabel label={t("settings.sections.notifications")} colors={colors} />
        </View>
        <SettingsCard colors={colors}>
          <ActionRow
            icon="bell"
            label={t("settings.push")}
            sublabel={t("settings.pushDesc")}
            colors={colors}
            onPress={notifStatus === "granted" ? openNotifSettings : requestNotifPermission}
            rightEl={
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <View style={[styles.badge, { backgroundColor: notifBadge.color + "20" }]}>
                  <Text style={[styles.badgeText, { color: notifBadge.color, fontFamily: "Inter_500Medium" }]}>
                    {notifBadge.label}
                  </Text>
                </View>
                <Feather name="chevron-right" size={15} color={colors.mutedForeground} />
              </View>
            }
          />
          <ActionRow
            icon="settings"
            label={t("settings.deviceSettings")}
            sublabel={t("settings.deviceSettingsDesc")}
            colors={colors}
            onPress={openNotifSettings}
            last
          />
        </SettingsCard>

        {/* Language */}
        <View style={{ paddingHorizontal: 20, marginTop: 20, marginBottom: 8 }}>
          <SectionLabel label={t("settings.sections.language")} colors={colors} />
        </View>
        <SettingsCard colors={colors}>
          <ActionRow
            icon="globe"
            label={t("language.label")}
            colors={colors}
            last
            rightEl={<LanguageToggle />}
          />
        </SettingsCard>

        {/* About */}
        <View style={{ paddingHorizontal: 20, marginTop: 20, marginBottom: 8 }}>
          <SectionLabel label={t("settings.sections.about")} colors={colors} />
        </View>
        <SettingsCard colors={colors}>
          <ActionRow
            icon="file-text"
            label={t("settings.privacy")}
            colors={colors}
            onPress={() => Linking.openURL("https://casadossier.com/privacy")}
          />
          <ActionRow
            icon="info"
            label={t("settings.terms")}
            colors={colors}
            onPress={() => Linking.openURL("https://casadossier.com/terms")}
          />
          <ActionRow
            icon="tag"
            label={t("settings.version")}
            colors={colors}
            last
            rightEl={
              <Text style={[styles.versionText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                v1.0.0
              </Text>
            }
          />
        </SettingsCard>

        {/* Danger zone */}
        <View style={{ paddingHorizontal: 20, marginTop: 20, marginBottom: 8 }}>
          <SectionLabel label={t("settings.sections.danger")} colors={colors} />
        </View>
        <SettingsCard colors={colors}>
          <ActionRow
            icon="trash-2"
            label={t("settings.deleteAccount")}
            sublabel={t("settings.deleteAccountDesc")}
            danger
            colors={colors}
            onPress={handleDeleteAccount}
            disabled={deletingAccount}
            last
            rightEl={
              deletingAccount ? (
                <ActivityIndicator size="small" color={colors.destructive} />
              ) : undefined
            }
          />
        </SettingsCard>
      </ScrollView>
    </View>
  );
}
const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: { width: 36, alignItems: "flex-start" },
  headerTitle: { fontSize: 17 },
  saveBtn: {
    width: 60,
    alignItems: "flex-end",
    backgroundColor: "#0F1629",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  saveBtnText: { fontSize: 14 },
  input: { flex: 1, fontSize: 15, textAlign: "right" },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeText: { fontSize: 12 },
  versionText: { fontSize: 14 },
});
