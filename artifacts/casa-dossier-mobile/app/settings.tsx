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
import { useUser, useAuth, useClerk } from "@clerk/expo";
import * as Notifications from "expo-notifications";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";

function SectionLabel({ label, colors }: { label: string; colors: ReturnType<typeof useColors> }) {
  return (
    <Text style={[styles.sectionLabel, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
      {label}
    </Text>
  );
}

function SettingsCard({ children, colors }: { children: React.ReactNode; colors: ReturnType<typeof useColors> }) {
  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      {children}
    </View>
  );
}

function FieldRow({
  label,
  colors,
  children,
  last,
}: {
  label: string;
  colors: ReturnType<typeof useColors>;
  children: React.ReactNode;
  last?: boolean;
}) {
  return (
    <View style={[styles.fieldRow, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }]}>
      <Text style={[styles.fieldLabel, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>{label}</Text>
      {children}
    </View>
  );
}

function ActionRow({
  icon,
  label,
  sublabel,
  onPress,
  danger,
  colors,
  last,
  rightEl,
}: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  sublabel?: string;
  onPress?: () => void;
  danger?: boolean;
  colors: ReturnType<typeof useColors>;
  last?: boolean;
  rightEl?: React.ReactNode;
}) {
  return (
    <TouchableOpacity
      style={[
        styles.actionRow,
        !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
      ]}
      onPress={onPress}
      activeOpacity={onPress ? 0.6 : 1}
    >
      <View style={[styles.rowIcon, { backgroundColor: danger ? colors.destructive + "15" : colors.muted }]}>
        <Feather name={icon} size={17} color={danger ? colors.destructive : colors.foreground} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.actionLabel, { color: danger ? colors.destructive : colors.foreground, fontFamily: "Inter_500Medium" }]}>
          {label}
        </Text>
        {sublabel && (
          <Text style={[styles.actionSub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
            {sublabel}
          </Text>
        )}
      </View>
      {rightEl ?? (onPress && <Feather name="chevron-right" size={15} color={colors.mutedForeground} />)}
    </TouchableOpacity>
  );
}

export default function SettingsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useUser();
  const { getToken } = useAuth();
  const { signOut } = useClerk();
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
      Alert.alert("Error", "Could not save profile. Please try again.");
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
    type Perm = { granted: boolean; canAskAgain: boolean };
    const { granted, canAskAgain } = (await Notifications.requestPermissionsAsync()) as unknown as Perm;
    setNotifStatus(granted ? "granted" : canAskAgain ? "undetermined" : "denied");
    if (granted) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };

  const performAccountDeletion = async () => {
    setDeletingAccount(true);
    try {
      const token = await getToken();
      const domain = process.env.EXPO_PUBLIC_DOMAIN;
      const baseUrl = domain ? `https://${domain}` : "";
      const res = await fetch(`${baseUrl}/api/user`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? `Server error ${res.status}`);
      }
      await signOut();
      router.replace("/");
    } catch (err: any) {
      setDeletingAccount(false);
      Alert.alert("Error", err?.message ?? "Could not delete your account. Please try again.");
    }
  };

  const handleDeleteAccount = () => {
    if (deletingAccount) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    Alert.alert(
      "Delete Account",
      "This will permanently delete your account and ALL property data — assets, documents, service records, and subscriptions. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete My Account",
          style: "destructive",
          onPress: () => {
            // Second confirmation
            Alert.alert(
              "Are you absolutely sure?",
              "Your account and all associated data will be permanently erased. You will not be able to recover it.",
              [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Yes, Delete Everything",
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
      ? { label: "Enabled", color: colors.success }
      : notifStatus === "denied"
      ? { label: "Disabled", color: colors.destructive }
      : { label: "Not set", color: colors.warning };

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 8, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={12}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>Settings</Text>
        {profileDirty ? (
          <TouchableOpacity onPress={handleSaveProfile} style={styles.saveBtn} disabled={savingProfile}>
            {savingProfile ? (
              <ActivityIndicator size="small" color={colors.primaryForeground} />
            ) : (
              <Text style={[styles.saveBtnText, { color: colors.primaryForeground, fontFamily: "Inter_600SemiBold" }]}>Save</Text>
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
          <SectionLabel label="PROFILE" colors={colors} />
        </View>
        <SettingsCard colors={colors}>
          <FieldRow label="First name" colors={colors}>
            <TextInput
              value={firstName}
              onChangeText={handleFirstNameChange}
              style={[styles.input, { color: colors.foreground, fontFamily: "Inter_400Regular" }]}
              placeholderTextColor={colors.mutedForeground}
              placeholder="First name"
              returnKeyType="next"
            />
          </FieldRow>
          <FieldRow label="Last name" colors={colors}>
            <TextInput
              value={lastName}
              onChangeText={handleLastNameChange}
              style={[styles.input, { color: colors.foreground, fontFamily: "Inter_400Regular" }]}
              placeholderTextColor={colors.mutedForeground}
              placeholder="Last name"
              returnKeyType="done"
              onSubmitEditing={handleSaveProfile}
            />
          </FieldRow>
          <FieldRow label="Email" colors={colors} last>
            <Text style={[styles.input, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              {user?.primaryEmailAddress?.emailAddress ?? "—"}
            </Text>
          </FieldRow>
        </SettingsCard>

        {/* Notifications */}
        <View style={{ paddingHorizontal: 20, marginTop: 20, marginBottom: 8 }}>
          <SectionLabel label="NOTIFICATIONS" colors={colors} />
        </View>
        <SettingsCard colors={colors}>
          <ActionRow
            icon="bell"
            label="Push Notifications"
            sublabel="Maintenance reminders & job updates"
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
            label="Open Device Settings"
            sublabel="Manage all notification permissions"
            colors={colors}
            onPress={openNotifSettings}
            last
          />
        </SettingsCard>

        {/* About */}
        <View style={{ paddingHorizontal: 20, marginTop: 20, marginBottom: 8 }}>
          <SectionLabel label="ABOUT" colors={colors} />
        </View>
        <SettingsCard colors={colors}>
          <ActionRow
            icon="file-text"
            label="Privacy Policy"
            colors={colors}
            onPress={() => Linking.openURL("https://casadossier.com/privacy")}
          />
          <ActionRow
            icon="info"
            label="Terms of Service"
            colors={colors}
            onPress={() => Linking.openURL("https://casadossier.com/terms")}
          />
          <ActionRow
            icon="tag"
            label="App Version"
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
          <SectionLabel label="DANGER ZONE" colors={colors} />
        </View>
        <SettingsCard colors={colors}>
          <ActionRow
            icon="trash-2"
            label="Delete Account"
            sublabel="Permanently remove all your data"
            danger
            colors={colors}
            onPress={handleDeleteAccount}
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
  sectionLabel: { fontSize: 11, letterSpacing: 0.8, marginBottom: 4 },
  card: {
    marginHorizontal: 20,
    borderRadius: 14,
    borderWidth: 1,
    overflow: "hidden",
  },
  fieldRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 13,
    paddingHorizontal: 16,
    gap: 12,
  },
  fieldLabel: { fontSize: 13, width: 82 },
  input: { flex: 1, fontSize: 15, textAlign: "right" },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 13,
    paddingHorizontal: 16,
    gap: 12,
  },
  rowIcon: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  actionLabel: { fontSize: 15 },
  actionSub: { fontSize: 12, marginTop: 1 },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeText: { fontSize: 12 },
  versionText: { fontSize: 14 },
});
