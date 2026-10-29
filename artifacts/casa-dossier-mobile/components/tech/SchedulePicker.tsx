import React, { useMemo } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import * as Haptics from "expo-haptics";
import { addDays, format, startOfDay } from "date-fns";
import { useTranslation } from "react-i18next";
import { useColors } from "@/hooks/useColors";
import { formatDate } from "@/lib/dates";

// A simple, accessible date + time picker built from chips. Used instead of a
// native wheel because @react-native-community/datetimepicker isn't a
// dependency (the web portal uses <input type="datetime-local">).

const DAYS_AHEAD = 60;
const FIRST_SLOT = 7 * 60; // 7:00 AM
const LAST_SLOT = 19 * 60 + 30; // 7:30 PM
const SLOT_STEP = 30;

export type ScheduleValue = { day: Date; minutes: number } | null;

export function scheduleValueFromIso(iso: string | null | undefined): ScheduleValue {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return { day: startOfDay(d), minutes: d.getHours() * 60 + d.getMinutes() };
}

export function scheduleValueToDate(v: NonNullable<ScheduleValue>): Date {
  const d = new Date(v.day);
  d.setHours(Math.floor(v.minutes / 60), v.minutes % 60, 0, 0);
  return d;
}

function minutesLabel(m: number) {
  const d = new Date();
  d.setHours(Math.floor(m / 60), m % 60, 0, 0);
  return formatDate(d, "h:mm a");
}

export function SchedulePicker({ value, onChange }: { value: ScheduleValue; onChange: (v: ScheduleValue) => void }) {
  const { t } = useTranslation();
  const colors = useColors();
  const today = startOfDay(new Date());

  const days = useMemo(() => {
    const list = Array.from({ length: DAYS_AHEAD }, (_, i) => addDays(today, i));
    // Keep an already-scheduled past day selectable so the current value shows.
    if (value && value.day < today) list.unshift(value.day);
    return list;
  }, [today.getTime(), value?.day.getTime()]); // eslint-disable-line react-hooks/exhaustive-deps

  const slots = useMemo(() => {
    const list: number[] = [];
    for (let m = FIRST_SLOT; m <= LAST_SLOT; m += SLOT_STEP) list.push(m);
    if (value && !list.includes(value.minutes)) list.push(value.minutes);
    return list.sort((a, b) => a - b);
  }, [value?.minutes]); // eslint-disable-line react-hooks/exhaustive-deps

  const now = new Date();
  const selectedDayKey = value ? format(value.day, "yyyy-MM-dd") : null;

  return (
    <View style={{ gap: 12 }}>
      <View style={{ gap: 6 }}>
        <Text style={[styles.label, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>{t("tech.schedule.date")}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingRight: 8 }}>
          {days.map((d) => {
            const key = format(d, "yyyy-MM-dd");
            const selected = key === selectedDayKey;
            return (
              <TouchableOpacity
                key={key}
                accessibilityRole="button"
                accessibilityLabel={formatDate(d, t("tech.dateFormats.weekdayMonthDay"))}
                accessibilityState={{ selected }}
                onPress={() => {
                  Haptics.selectionAsync();
                  onChange({ day: d, minutes: value?.minutes ?? 9 * 60 });
                }}
                activeOpacity={0.7}
                style={[
                  styles.dayChip,
                  {
                    backgroundColor: selected ? colors.primary : colors.card,
                    borderColor: selected ? colors.primary : colors.border,
                  },
                ]}
              >
                <Text style={[styles.dayDow, { color: selected ? colors.primaryForeground : colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
                  {key === format(today, "yyyy-MM-dd") ? t("tech.today") : formatDate(d, "EEE")}
                </Text>
                <Text style={[styles.dayNum, { color: selected ? colors.primaryForeground : colors.foreground, fontFamily: "Inter_700Bold" }]}>
                  {format(d, "d")}
                </Text>
                <Text style={[styles.dayDow, { color: selected ? colors.primaryForeground : colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                  {formatDate(d, "MMM")}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <View style={{ gap: 6 }}>
        <Text style={[styles.label, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>{t("tech.schedule.time")}</Text>
        <View style={styles.slotGrid}>
          {slots.map((m) => {
            const selected = value?.minutes === m;
            const past = !!value && scheduleValueToDate({ day: value.day, minutes: m }) < now;
            return (
              <TouchableOpacity
                key={m}
                accessibilityRole="button"
                accessibilityLabel={minutesLabel(m)}
                accessibilityState={{ selected, disabled: !value }}
                disabled={!value}
                onPress={() => {
                  if (!value) return;
                  Haptics.selectionAsync();
                  onChange({ day: value.day, minutes: m });
                }}
                activeOpacity={0.7}
                style={[
                  styles.slot,
                  {
                    backgroundColor: selected ? colors.primary : colors.card,
                    borderColor: selected ? colors.primary : colors.border,
                    opacity: !value ? 0.4 : past && !selected ? 0.55 : 1,
                  },
                ]}
              >
                <Text style={[styles.slotText, { color: selected ? colors.primaryForeground : colors.foreground, fontFamily: selected ? "Inter_600SemiBold" : "Inter_400Regular" }]}>
                  {minutesLabel(m)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
        {!value && (
          <Text style={[styles.hint, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>{t("tech.schedule.pickDateFirst")}</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 11, letterSpacing: 0.8 },
  dayChip: { width: 58, alignItems: "center", paddingVertical: 8, borderRadius: 12, borderWidth: 1, gap: 1 },
  dayDow: { fontSize: 11 },
  dayNum: { fontSize: 18 },
  slotGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  slot: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10, borderWidth: 1, minWidth: 78, alignItems: "center" },
  slotText: { fontSize: 13 },
  hint: { fontSize: 12 },
});
