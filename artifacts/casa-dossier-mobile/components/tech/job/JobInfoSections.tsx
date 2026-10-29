import React from "react";
import { Alert, Linking, Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import type { TechJobDetail } from "@workspace/api-client-react";
import { useTranslation } from "react-i18next";
import i18n from "@/i18n";
import { useColors } from "@/hooks/useColors";
import { Button, InfoRow, Section, joinParts, ui } from "@/components/tech/ui";

function openInMaps(address: string) {
  const q = encodeURIComponent(address);
  const url =
    Platform.OS === "ios"
      ? `http://maps.apple.com/?daddr=${q}`
      : Platform.OS === "android"
        ? `geo:0,0?q=${q}`
        : `https://www.google.com/maps/search/?api=1&query=${q}`;
  Linking.openURL(url).catch(() => Alert.alert(i18n.t("tech.job.mapsError"), address));
}

function callPhone(phone: string) {
  Linking.openURL(`tel:${phone.replace(/[^\d+]/g, "")}`).catch(() => Alert.alert(i18n.t("tech.job.callError"), phone));
}

// ── Description, equipment, and location/contact for a job ────────────────────
export function JobInfoSections({ job, isMine }: { job: TechJobDetail; isMine: boolean }) {
  const { t } = useTranslation();
  const colors = useColors();
  return (
    <>
    {/* Description */}
    <Section icon="file-text" title={t("tech.job.description")}>
      <Text style={[ui.body, { color: colors.foreground, fontFamily: "Inter_400Regular" }]}>{job.description}</Text>
    </Section>

    {/* Asset */}
    <Section icon="tool" title={t("tech.job.equipment")}>
      <Text style={[styles.assetName, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>{job.assetName}</Text>
      <Text style={[ui.muted, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
        {[job.assetBrand, job.assetModel, t(`categories.${job.assetCategory}`, { defaultValue: job.assetCategory })].filter(Boolean).join(" · ")}
      </Text>
      {job.assetSerialNumber ? <Meta text={t("tech.asset.serial", { value: job.assetSerialNumber })} /> : null}
      {job.assetInstallDate ? <Meta text={t("tech.asset.installed", { value: job.assetInstallDate })} /> : null}
      {job.assetWarrantyExpiry ? <Meta text={t("tech.asset.warranty", { value: job.assetWarrantyExpiry })} /> : null}
      {job.assetNotes ? (
        <Text style={[ui.muted, { color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontStyle: "italic" }]}>
          {job.assetNotes}
        </Text>
      ) : null}
    </Section>

    {/* Location & contact */}
    <Section icon="map-pin" title={t("tech.job.location")}>
      {isMine && job.propertyAddress ? (
        <>
          <InfoRow icon="home" colors={colors}>
            <Text selectable style={[ui.body, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
              {job.propertyAddress}
            </Text>
            <Meta text={joinParts(job.propertyCity, job.propertyState, job.propertyZipCode)} />
            {job.propertyYearBuilt ? <Meta text={t("tech.job.built", { year: job.propertyYearBuilt })} /> : null}
          </InfoRow>
          <Button
            label={t("tech.job.directions")}
            icon="navigation"
            variant="outline"
            onPress={() => openInMaps(joinParts(job.propertyAddress, job.propertyCity, job.propertyState, job.propertyZipCode))}
            accessibilityHint={t("tech.job.directionsHint")}
          />
        </>
      ) : (
        <InfoRow icon="map" colors={colors}>
          <Text style={[ui.body, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
            {joinParts(job.propertyCity, job.propertyState) || t("tech.locationPending")}
          </Text>
          {job.propertyYearBuilt ? <Meta text={t("tech.job.built", { year: job.propertyYearBuilt })} /> : null}
          {!isMine && <Meta text={t("tech.addressAfterAccept")} />}
        </InfoRow>
      )}
      {isMine && job.contactPhone ? (
        <View style={[styles.contactRow, { borderTopColor: colors.border }]}>
          <View style={{ flex: 1 }}>
            <Text style={[ui.small, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>{t("tech.job.homeownerContact")}</Text>
            <Text selectable style={[ui.body, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
              {job.contactPhone}
            </Text>
          </View>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={t("tech.callHomeownerA11y", { phone: job.contactPhone })}
            onPress={() => callPhone(job.contactPhone!)}
            style={[styles.callBtn, { backgroundColor: colors.primary }]}
            activeOpacity={0.8}
          >
            <Feather name="phone" size={14} color={colors.primaryForeground} />
            <Text style={[styles.callText, { color: colors.primaryForeground, fontFamily: "Inter_600SemiBold" }]}>{t("tech.job.call")}</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </Section>
    </>
  );
}

function Meta({ text }: { text: string }) {
  const colors = useColors();
  if (!text) return null;
  return <Text style={[ui.muted, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>{text}</Text>;
}

const styles = StyleSheet.create({
  assetName: { fontSize: 15 },
  contactRow: { flexDirection: "row", alignItems: "center", gap: 10, borderTopWidth: 1, paddingTop: 10 },
  callBtn: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 99 },
  callText: { fontSize: 13 },
});
