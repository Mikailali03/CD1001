import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Platform,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useUser, useClerk } from "@clerk/expo";
import { useColors } from "@/hooks/useColors";
import * as Haptics from "expo-haptics";

type RowItem = {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  sublabel?: string;
  onPress: () => void;
  danger?: boolean;
};

function NavRow({ item, colors }: { item: RowItem; colors: ReturnType<typeof useColors> }) {
  return (
    <TouchableOpacity
      style={[styles.row, { borderBottomColor: colors.border }]}
      onPress={item.onPress}
      activeOpacity={0.6}
    >
      <View style={[styles.rowIcon, { backgroundColor: item.danger ? colors.destructive + "15" : colors.muted }]}>
        <Feather
          name={item.icon}
          size={18}
          color={item.danger ? colors.destructive : colors.foreground}
        />
      </View>
      <View style={styles.rowContent}>
        <Text
          style={[
            styles.rowLabel,
            { color: item.danger ? colors.destructive : colors.foreground, fontFamily: "Inter_500Medium" },
          ]}
        >
          {item.label}
        </Text>
        {item.sublabel && (
          <Text style={[styles.rowSub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
            {item.sublabel}
          </Text>
        )}
      </View>
      <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
    </TouchableOpacity>
  );
}

export default function MoreScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useUser();
  const { signOut } = useClerk();

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const handleSignOut = () => {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: async () => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          await signOut();
        },
      },
    ]);
  };

  const navItems: RowItem[] = [
    {
      icon: "book-open",
      label: "DIY Guides",
      sublabel: "Step-by-step home maintenance",
      onPress: () => {},
    },
    {
      icon: "search",
      label: "Find a Pro",
      sublabel: "Hire trusted local technicians",
      onPress: () => {},
    },
    {
      icon: "trending-up",
      label: "Capital Outlook",
      sublabel: "10-year replacement cost projections",
      onPress: () => {
        Haptics.selectionAsync();
        router.push("/capital-outlook");
      },
    },
    {
      icon: "settings",
      label: "Settings",
      sublabel: "Notifications, preferences",
      onPress: () => {},
    },
    {
      icon: "star",
      label: "Upgrade Plan",
      sublabel: "Unlock all features",
      onPress: () => {},
    },
  ];

  const displayName = user?.fullName ?? user?.firstName ?? user?.primaryEmailAddress?.emailAddress ?? "Homeowner";
  const initials = (user?.firstName?.[0] ?? "") + (user?.lastName?.[0] ?? "");

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={{ paddingBottom: insets.bottom + 32 + (Platform.OS === "web" ? 34 : 0) }}
      showsVerticalScrollIndicator={false}
    >
      <View style={{ paddingTop: topPad + 8, paddingHorizontal: 20, paddingBottom: 8 }}>
        <Text style={[styles.pageTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
          More
        </Text>
      </View>

      {/* Profile card */}
      <View style={{ paddingHorizontal: 20, marginBottom: 24 }}>
        <View style={[styles.profileCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
            <Text style={[styles.avatarText, { color: colors.primaryForeground, fontFamily: "Inter_700Bold" }]}>
              {initials.toUpperCase() || "?"}
            </Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={[styles.profileName, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
              {displayName}
            </Text>
            <Text style={[styles.profileEmail, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              {user?.primaryEmailAddress?.emailAddress ?? ""}
            </Text>
          </View>
          <Feather name="edit-2" size={16} color={colors.mutedForeground} />
        </View>
      </View>

      {/* Nav sections */}
      <View style={{ paddingHorizontal: 20, marginBottom: 8 }}>
        <Text style={[styles.sectionLabel, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
          TOOLS
        </Text>
      </View>
      <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {navItems.slice(0, 3).map((item) => (
          <NavRow key={item.label} item={item} colors={colors} />
        ))}
      </View>

      <View style={{ paddingHorizontal: 20, marginTop: 24, marginBottom: 8 }}>
        <Text style={[styles.sectionLabel, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
          ACCOUNT
        </Text>
      </View>
      <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {navItems.slice(3).map((item) => (
          <NavRow key={item.label} item={item} colors={colors} />
        ))}
        <NavRow
          item={{
            icon: "log-out",
            label: "Sign Out",
            danger: true,
            onPress: handleSignOut,
          }}
          colors={colors}
        />
      </View>

      {/* App version */}
      <Text style={[styles.version, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
        Casa Dossier · v1.0.0
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  pageTitle: { fontSize: 28 },
  profileCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    gap: 12,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontSize: 18 },
  profileInfo: { flex: 1 },
  profileName: { fontSize: 16 },
  profileEmail: { fontSize: 13, marginTop: 2 },
  sectionLabel: { fontSize: 11, letterSpacing: 0.8, marginBottom: 4 },
  section: {
    marginHorizontal: 20,
    borderRadius: 14,
    borderWidth: 1,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  rowContent: { flex: 1 },
  rowLabel: { fontSize: 15 },
  rowSub: { fontSize: 12, marginTop: 1 },
  version: { textAlign: "center", fontSize: 12, marginTop: 28 },
});
