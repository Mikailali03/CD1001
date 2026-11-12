import React from "react";
import { Alert, Switch } from "react-native";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetNotificationPreferences,
  getGetNotificationPreferencesQueryKey,
  updateNotificationPreferences,
  setReminderSubscription,
  type NotificationPreferences,
  type UpdateNotificationPreferencesBody,
} from "@workspace/api-client-react";
import { ActionRow } from "@/components/settings/ActionRow";
import { SettingsCard } from "@/components/settings/SettingsCard";
import { useColors } from "@/hooks/useColors";

// Which maintenance reminders this account gets, by email and push, plus
// opt-ins for homes shared with the user. Saved to the server, so they apply
// on every device and to the reminder emails.
export function ReminderSettingsCard({ colors }: { colors: ReturnType<typeof useColors> }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const queryKey = getGetNotificationPreferencesQueryKey();
  const { data: prefs } = useGetNotificationPreferences({ query: { queryKey } });

  async function save(change: () => Promise<NotificationPreferences>) {
    try {
      queryClient.setQueryData(queryKey, await change());
    } catch {
      Alert.alert(t("common.error"), t("settings.reminders.saveFailed"));
    }
  }

  const toggles: { key: keyof UpdateNotificationPreferencesBody; icon: "bell" | "mail" | "calendar"; label: string; sublabel: string }[] = [
    { key: "pushReminders", icon: "bell", label: t("settings.reminders.push"), sublabel: t("settings.reminders.pushDesc") },
    { key: "emailReminders", icon: "mail", label: t("settings.reminders.email"), sublabel: t("settings.reminders.emailDesc") },
    { key: "weeklySummary", icon: "calendar", label: t("settings.reminders.weekly"), sublabel: t("settings.reminders.weeklyDesc") },
  ];
  const shared = prefs?.sharedHomes ?? [];

  return (
    <SettingsCard colors={colors}>
      {toggles.map(({ key, icon, label, sublabel }, i) => {
        const value = prefs?.[key] ?? true;
        return (
          <ActionRow
            key={key}
            icon={icon}
            label={label}
            sublabel={sublabel}
            colors={colors}
            disabled={!prefs}
            onPress={() => save(() => updateNotificationPreferences({ [key]: !value }))}
            last={i === toggles.length - 1 && shared.length === 0}
            rightEl={
              <Switch
                value={value}
                disabled={!prefs}
                onValueChange={(next) => save(() => updateNotificationPreferences({ [key]: next }))}
              />
            }
          />
        );
      })}
      {shared.map((home, i) => (
        <ActionRow
          key={home.propertyId}
          icon="users"
          label={t("settings.reminders.sharedHome", { name: home.name })}
          sublabel={home.address}
          colors={colors}
          onPress={() => save(() => setReminderSubscription(home.propertyId, { enabled: !home.receiveReminders }))}
          last={i === shared.length - 1}
          rightEl={
            <Switch
              value={home.receiveReminders}
              onValueChange={(enabled) => save(() => setReminderSubscription(home.propertyId, { enabled }))}
            />
          }
        />
      ))}
    </SettingsCard>
  );
}
