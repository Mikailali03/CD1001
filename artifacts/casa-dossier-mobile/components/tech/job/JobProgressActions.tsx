import React from "react";
import { StyleSheet, Text, View } from "react-native";
import type { CompleteJobBody, TechJobDetail } from "@workspace/api-client-react";
import { useTranslation } from "react-i18next";
import { useColors } from "@/hooks/useColors";
import { CompletionForm } from "@/components/tech/CompletionForm";
import { Button, Section, fmtDate } from "@/components/tech/ui";

// ── On the way → arrived → log completed work ─────────────────────────────────
export function JobProgressActions({
  job, status, appointmentToday, showCompletion, onShowCompletion,
  onEnRoute, onArrived, onComplete, enRoutePending, arrivedPending, completePending, busy,
}: {
  job: TechJobDetail; status: string; appointmentToday: boolean;
  showCompletion: boolean; onShowCompletion: (show: boolean) => void;
  onEnRoute: () => void; onArrived: () => void; onComplete: (body: CompleteJobBody) => void;
  enRoutePending: boolean; arrivedPending: boolean; completePending: boolean; busy: boolean;
}) {
  const { t } = useTranslation();
  const colors = useColors();
  return (
    <View style={{ gap: 8 }}>
      {status === "claimed" && (
        <>
          <Button
            label={enRoutePending ? t("tech.progress.updating") : t("tech.progress.onTheWay")}
            icon="navigation"
            onPress={onEnRoute}
            loading={enRoutePending}
            disabled={!appointmentToday || busy}
            accessibilityHint={appointmentToday ? t("tech.progress.notifiesHomeowner") : t("tech.progress.availableDayOf")}
          />
          {!appointmentToday && (
            <Text style={[styles.centerHint, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              {t("tech.progress.availableOn", { date: fmtDate(job.scheduledAt, t("tech.dateFormats.weekdayShort")) })}
            </Text>
          )}
        </>
      )}
      {status === "en_route" && (
        <Button
          label={arrivedPending ? t("tech.progress.updating") : t("tech.progress.arrived")}
          icon="map-pin"
          onPress={onArrived}
          loading={arrivedPending}
          disabled={busy}
        />
      )}
      {status === "arrived" &&
        (showCompletion ? (
          <Section>
            <CompletionForm
              submitting={completePending}
              onCancel={() => onShowCompletion(false)}
              onSubmit={onComplete}
            />
          </Section>
        ) : (
          <Button label={t("tech.complete.title")} icon="clipboard" onPress={() => onShowCompletion(true)} disabled={busy} />
        ))}
    </View>
  );
}

const styles = StyleSheet.create({
  centerHint: { fontSize: 12, textAlign: "center" },
});
