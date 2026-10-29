import React from "react";
import { Text, View } from "react-native";
import type { TechJobDetail } from "@workspace/api-client-react";
import { useTranslation } from "react-i18next";
import { useColors } from "@/hooks/useColors";
import { SchedulePicker, type ScheduleValue } from "@/components/tech/SchedulePicker";
import { Button, Section, fmtDate, ui } from "@/components/tech/ui";

// ── Set or change the service date ────────────────────────────────────────────
export function JobScheduleSection({
  job, hasSchedule, pickerOpen, schedule, onChange, onSave, onCancel, onOpenPicker, saving, busy,
}: {
  job: TechJobDetail; hasSchedule: boolean; pickerOpen: boolean; schedule: ScheduleValue;
  onChange: (v: ScheduleValue) => void; onSave: () => void; onCancel: () => void; onOpenPicker: () => void;
  saving: boolean; busy: boolean;
}) {
  const { t } = useTranslation();
  const colors = useColors();
  return (
    <Section icon="calendar" title={t("tech.scheduleSection.title")}>
      <Text style={[ui.muted, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
        {hasSchedule
          ? t("tech.scheduleSection.scheduled", { date: fmtDate(job.scheduledAt, t("tech.dateFormats.weekdayFull")) })
          : t("tech.scheduleSection.confirm")}
      </Text>
      {pickerOpen ? (
        <>
          <SchedulePicker value={schedule} onChange={onChange} />
          <View style={{ flexDirection: "row", gap: 10 }}>
            {hasSchedule && (
              <Button
                label={t("common.cancel")}
                variant="outline"
                onPress={onCancel}
                style={{ flex: 1 }}
              />
            )}
            <Button
              label={saving ? t("common.saving") : hasSchedule ? t("tech.scheduleSection.update") : t("tech.scheduleSection.set")}
              icon="calendar"
              onPress={onSave}
              loading={saving}
              disabled={!schedule || busy}
              style={{ flex: 1.4 }}
            />
          </View>
        </>
      ) : (
        <Button label={t("tech.scheduleSection.change")} icon="edit-2" variant="outline" onPress={onOpenPicker} disabled={busy} />
      )}
    </Section>
  );
}
