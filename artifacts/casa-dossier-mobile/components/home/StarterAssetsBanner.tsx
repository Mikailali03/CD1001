import React, { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Modal, ActivityIndicator, Alert, ScrollView } from "react-native";
import { Feather } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListAssets,
  getListAssetsQueryKey,
  useGetStarterAssets,
  getGetStarterAssetsQueryKey,
  addStarterAssets,
  getGetPropertySummaryQueryKey,
  type HomeType,
} from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";

const HOME_TYPES: HomeType[] = ["single_family", "townhouse", "condo"];
const dismissKey = (propertyId: string) => `casa:starterAssetsDismissed:${propertyId}`;

// Offers a one-tap checklist of common systems and appliances (based on the
// home's age and type) on a home with nothing tracked yet. Owners only.
export function StarterAssetsBanner({ propertyId, isOwner, colors }: {
  propertyId: string;
  isOwner: boolean;
  colors: ReturnType<typeof useColors>;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [dismissed, setDismissed] = useState<boolean | null>(null);
  const [open, setOpen] = useState(false);
  const [homeType, setHomeType] = useState<HomeType | undefined>(undefined);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    AsyncStorage.getItem(dismissKey(propertyId))
      .then((v) => live && setDismissed(v === "1"))
      .catch(() => live && setDismissed(false));
    return () => { live = false; };
  }, [propertyId]);

  const { data: assets } = useListAssets(propertyId, undefined, {
    query: { queryKey: getListAssetsQueryKey(propertyId), enabled: isOwner },
  });
  const isEmpty = !!assets && !assets.some((a) => a.category !== "Structural");
  const params = homeType ? { homeType } : undefined;
  const { data } = useGetStarterAssets(propertyId, params, {
    query: { queryKey: getGetStarterAssetsQueryKey(propertyId, params), enabled: isOwner && isEmpty && dismissed === false },
  });

  useEffect(() => {
    if (data) setSelected(new Set(data.suggestions.filter((s) => s.recommended).map((s) => s.key)));
  }, [data]);

  if (!isOwner || !isEmpty || dismissed !== false || !data || data.suggestions.length === 0) return null;

  const dismiss = () => {
    AsyncStorage.setItem(dismissKey(propertyId), "1").catch(() => {});
    setDismissed(true);
  };

  const toggle = (key: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  async function submit() {
    if (selected.size === 0) return;
    setBusy(true);
    try {
      const created = await addStarterAssets(propertyId, { keys: [...selected], homeType: data!.homeType });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: getListAssetsQueryKey(propertyId) }),
        queryClient.invalidateQueries({ queryKey: getGetPropertySummaryQueryKey(propertyId) }),
        queryClient.invalidateQueries({ queryKey: getGetStarterAssetsQueryKey(propertyId) }),
      ]);
      setOpen(false);
      Alert.alert(t("starterAssets.added", { count: created.length }));
    } catch {
      Alert.alert(t("starterAssets.addFailed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <View style={[styles.banner, { backgroundColor: colors.card, borderColor: colors.primary }]}>
        <Feather name="check-square" size={16} color={colors.primary} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: colors.foreground }]}>{t("starterAssets.cardTitle")}</Text>
          <Text style={[styles.body, { color: colors.mutedForeground }]}>{t("starterAssets.cardSubtitle")}</Text>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <TouchableOpacity onPress={() => setOpen(true)} style={[styles.cta, { flex: 1, backgroundColor: colors.primary }]} activeOpacity={0.85}>
              <Text style={[styles.ctaText, { color: colors.primaryForeground }]}>{t("starterAssets.cta")}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={dismiss} style={[styles.cta, { paddingHorizontal: 14 }]} activeOpacity={0.7}>
              <Text style={[styles.ctaText, { color: colors.mutedForeground }]}>{t("starterAssets.dismiss")}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <Modal visible={open} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => !busy && setOpen(false)}>
        <View style={[styles.sheet, { backgroundColor: colors.background }]}>
          <View style={styles.sheetHeader}>
            <Text style={[styles.sheetTitle, { color: colors.foreground }]}>{t("starterAssets.title")}</Text>
            <TouchableOpacity onPress={() => !busy && setOpen(false)} hitSlop={10} accessibilityLabel={t("common.cancel")}>
              <Feather name="x" size={22} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>
          <Text style={[styles.body, { color: colors.mutedForeground, marginBottom: 12 }]}>{t("starterAssets.subtitle")}</Text>

          <Text style={[styles.label, { color: colors.mutedForeground }]}>{t("starterAssets.homeType")}</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
            {HOME_TYPES.map((ht) => {
              const active = data.homeType === ht;
              return (
                <TouchableOpacity
                  key={ht}
                  onPress={() => setHomeType(ht)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active }}
                  style={[styles.chip, { borderColor: active ? colors.primary : colors.border }]}
                >
                  <Text style={[styles.chipText, { color: active ? colors.primary : colors.foreground }]}>
                    {t(`starterAssets.homeTypes.${ht}`)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ gap: 8 }}>
            {data.suggestions.map((s) => {
              const checked = selected.has(s.key);
              return (
                <TouchableOpacity
                  key={s.key}
                  onPress={() => toggle(s.key)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked }}
                  style={[styles.option, { borderColor: checked ? colors.primary : colors.border }]}
                  activeOpacity={0.7}
                >
                  <Feather name={checked ? "check-square" : "square"} size={18} color={checked ? colors.primary : colors.mutedForeground} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.title, { color: colors.foreground }]}>
                      {t(`starterAssets.items.${s.key}`, { defaultValue: s.name })}
                    </Text>
                    <Text style={[styles.body, { color: colors.mutedForeground }]}>
                      {s.estimatedInstallYear != null
                        ? t("starterAssets.estimatedYear", { year: s.estimatedInstallYear })
                        : t("starterAssets.unknownYear")}
                    </Text>
                    {s.reasonCode ? (
                      <Text style={[styles.body, { color: "#b45309" }]}>
                        {t(`starterAssets.reasons.${s.reasonCode}`, { defaultValue: s.reason ?? "" })}
                      </Text>
                    ) : null}
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <Text style={[styles.body, { color: colors.mutedForeground, marginVertical: 10 }]}>{t("starterAssets.confirmNote")}</Text>
          {busy ? (
            <ActivityIndicator color={colors.primary} />
          ) : (
            <TouchableOpacity
              onPress={submit}
              disabled={selected.size === 0}
              style={[styles.cta, { backgroundColor: colors.primary, opacity: selected.size === 0 ? 0.5 : 1 }]}
              activeOpacity={0.85}
            >
              <Text style={[styles.ctaText, { color: colors.primaryForeground }]}>
                {t("starterAssets.addSelected", { count: selected.size })}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  banner: { flexDirection: "row", gap: 10, borderWidth: 1, borderRadius: 14, padding: 14, marginBottom: 16 },
  title: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  body: { fontSize: 12, lineHeight: 17, fontFamily: "Inter_400Regular", marginTop: 2 },
  label: { fontSize: 12, fontFamily: "Inter_600SemiBold", marginBottom: 6 },
  cta: { borderRadius: 10, paddingVertical: 11, alignItems: "center", marginTop: 10 },
  ctaText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  sheet: { flex: 1, padding: 20 },
  sheetHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  sheetTitle: { fontSize: 18, fontFamily: "Inter_700Bold" },
  chip: { borderWidth: 1.5, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  chipText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  option: { flexDirection: "row", gap: 10, borderWidth: 1.5, borderRadius: 12, padding: 12 },
});
