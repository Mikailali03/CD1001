import React from "react";
import { Linking, Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import type { TechnicianScanResult } from "@workspace/api-client-react";
import { useTranslation } from "react-i18next";
import { useColors } from "@/hooks/useColors";
import { techJobHref } from "./routes";
import { Button, Chip, Section, ServiceHistoryList, fmtDate, joinParts, statusOf, ui, urgencyOf } from "./ui";

export const MONO = Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" });

/** Scan result, laid out like the web portal: your jobs, open jobs, equipment, history. */
export function ScanResultView({ result, onReset }: { result: TechnicianScanResult; onReset: () => void }) {
  const { t } = useTranslation();
  const colors = useColors();
  const category = t(`categories.${result.category}`, { defaultValue: result.category });
  const router = useRouter();
  const noJobs = result.myJobs.length === 0 && result.openJobs.length === 0;

  function openJob(id: string) {
    Haptics.selectionAsync();
    router.push(techJobHref(id));
  }

  return (
    <View style={{ gap: 14 }}>
      {/* Registry header */}
      <View style={[styles.headerCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={[styles.qrIcon, { backgroundColor: colors.primary + "15" }]}>
          <Feather name="grid" size={20} color={colors.primary} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text selectable style={[styles.registry, { color: colors.foreground, fontFamily: MONO }]}>
            {result.registryId}
          </Text>
          <Text numberOfLines={1} style={[ui.small, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
            {result.asset ? t("tech.scanResult.nameCategory", { name: result.asset.name, category }) : category}
          </Text>
        </View>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={t("tech.scanResult.scanAnotherA11y")}
          onPress={onReset}
          style={[styles.resetBtn, { borderColor: colors.border }]}
          activeOpacity={0.7}
        >
          <Feather name="rotate-ccw" size={14} color={colors.primary} />
          <Text style={[ui.small, { color: colors.primary, fontFamily: "Inter_600SemiBold" }]}>{t("tech.scanResult.scanAnother")}</Text>
        </TouchableOpacity>
      </View>

      {noJobs && (
        <View style={[styles.empty, { borderColor: colors.border, backgroundColor: colors.muted + "60" }]}>
          <Feather name="clipboard" size={28} color={colors.mutedForeground} />
          <Text style={[ui.label, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>{t("tech.scanResult.noJobs")}</Text>
          <Text style={[ui.muted, { color: colors.mutedForeground, fontFamily: "Inter_400Regular", textAlign: "center" }]}>
            {t("tech.scanResult.noJobsDesc")}
          </Text>
        </View>
      )}

      {result.myJobs.length > 0 && (
        <View style={{ gap: 8 }}>
          <Text style={[styles.groupLabel, { color: colors.mutedForeground, fontFamily: "Inter_700Bold" }]}>{t("tech.scanResult.yourJobs")}</Text>
          {result.myJobs.map((job) => {
            const sc = statusOf(job.status);
            const address = joinParts(job.propertyAddress, job.propertyCity, job.propertyState);
            return (
              <Section key={job.id}>
                <View style={styles.rowBetween}>
                  <Chip label={sc.label} color={sc.color} icon={sc.icon} />
                  {job.scheduledAt ? (
                    <View style={styles.inline}>
                      <Feather name="calendar" size={12} color="#059669" />
                      <Text style={[ui.small, { color: "#059669", fontFamily: "Inter_500Medium" }]}>
                        {fmtDate(job.scheduledAt, "MMM d, h:mm a")}
                      </Text>
                    </View>
                  ) : null}
                </View>
                <Text style={[ui.body, { color: colors.foreground, fontFamily: "Inter_400Regular" }]}>{job.description}</Text>
                {address ? (
                  <View style={styles.inline}>
                    <Feather name="map-pin" size={12} color={colors.mutedForeground} />
                    <Text style={[ui.small, { color: colors.mutedForeground, fontFamily: "Inter_400Regular", flexShrink: 1 }]}>{address}</Text>
                  </View>
                ) : null}
                {job.contactPhone ? (
                  <TouchableOpacity
                    accessibilityRole="link"
                    accessibilityLabel={t("tech.callHomeownerA11y", { phone: job.contactPhone })}
                    onPress={() => Linking.openURL(`tel:${job.contactPhone!.replace(/[^\d+]/g, "")}`)}
                    style={styles.inline}
                  >
                    <Feather name="phone" size={12} color={colors.primary} />
                    <Text style={[ui.small, { color: colors.primary, fontFamily: "Inter_600SemiBold" }]}>{job.contactPhone}</Text>
                  </TouchableOpacity>
                ) : null}
                {job.status !== "completed" && (
                  <Button label={t("tech.scanResult.openInMyJobs")} variant="outline" icon="briefcase" onPress={() => openJob(job.id)} />
                )}
              </Section>
            );
          })}
        </View>
      )}

      {result.openJobs.length > 0 && (
        <View style={{ gap: 8 }}>
          <Text style={[styles.groupLabel, { color: colors.mutedForeground, fontFamily: "Inter_700Bold" }]}>{t("tech.scanResult.openJobs")}</Text>
          {result.openJobs.map((job) => {
            const uc = urgencyOf(job.urgency);
            return (
              <Section key={job.id}>
                <View style={styles.rowBetween}>
                  <Chip label={uc.label} color={uc.color} icon={uc.icon} />
                  <View style={styles.inline}>
                    <Feather name="map-pin" size={12} color={colors.mutedForeground} />
                    <Text style={[ui.small, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                      {joinParts(job.city, job.state)}
                    </Text>
                  </View>
                </View>
                <Text style={[ui.body, { color: colors.foreground, fontFamily: "Inter_400Regular" }]}>{job.description}</Text>
                <Text style={[ui.small, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                  {t("tech.addressAfterAccept")}
                </Text>
                <Button label={t("tech.scanResult.viewAccept")} icon="check-circle" onPress={() => openJob(job.id)} />
              </Section>
            );
          })}
        </View>
      )}

      {result.asset && (
        <View style={{ gap: 8 }}>
          <Text style={[styles.groupLabel, { color: colors.mutedForeground, fontFamily: "Inter_700Bold" }]}>{t("tech.scanResult.equipment")}</Text>
          <Section>
            <Text style={[ui.body, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>{result.asset.name}</Text>
            <Text style={[ui.muted, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              {[result.asset.brand, result.asset.model, t(`categories.${result.asset.category}`, { defaultValue: result.asset.category })].filter(Boolean).join(" · ")}
            </Text>
            {result.asset.serialNumber ? <Small text={t("tech.asset.serial", { value: result.asset.serialNumber })} /> : null}
            {result.asset.installDate ? <Small text={t("tech.asset.installed", { value: result.asset.installDate })} /> : null}
            {result.asset.warrantyExpiry ? <Small text={t("tech.asset.warranty", { value: result.asset.warrantyExpiry })} /> : null}
            {result.asset.retiredAt ? <Small text={t("tech.asset.retired", { value: result.asset.retiredAt.slice(0, 10) })} /> : null}
            {result.asset.notes ? (
              <Text style={[ui.muted, { color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontStyle: "italic" }]}>
                {result.asset.notes}
              </Text>
            ) : null}
          </Section>
        </View>
      )}

      {result.serviceHistory && (
        <View style={{ gap: 8 }}>
          <Text style={[styles.groupLabel, { color: colors.mutedForeground, fontFamily: "Inter_700Bold" }]}>{t("tech.scanResult.serviceHistory")}</Text>
          {result.serviceHistory.length === 0 ? (
            <Small text={t("tech.scanResult.noRecords")} />
          ) : (
            <Section>
              <ServiceHistoryList records={result.serviceHistory} />
            </Section>
          )}
        </View>
      )}
    </View>
  );
}

function Small({ text }: { text: string }) {
  const colors = useColors();
  return <Text style={[ui.muted, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>{text}</Text>;
}

const styles = StyleSheet.create({
  headerCard: { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 12, borderWidth: 1, padding: 14 },
  qrIcon: { width: 40, height: 40, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  registry: { fontSize: 15, fontWeight: "700" },
  resetBtn: { flexDirection: "row", alignItems: "center", gap: 5, borderWidth: 1, borderRadius: 99, paddingHorizontal: 10, paddingVertical: 6 },
  empty: { alignItems: "center", gap: 6, borderWidth: 1, borderStyle: "dashed", borderRadius: 12, paddingVertical: 28, paddingHorizontal: 20 },
  groupLabel: { fontSize: 11, letterSpacing: 0.8 },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  inline: { flexDirection: "row", alignItems: "center", gap: 4 },
});
