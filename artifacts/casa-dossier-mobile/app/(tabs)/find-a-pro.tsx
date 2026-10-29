import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Platform,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams } from "expo-router";
import { Feather } from "@expo/vector-icons";
import {
  useListProperties,
  useListAssets,
  getListAssetsQueryKey,
  useCreateMarketplaceJob,
  getListMarketplaceJobsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useColors } from "@/hooks/useColors";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import * as Haptics from "expo-haptics";
import { useTranslation } from "react-i18next";

const URGENCY_OPTIONS = [
  // Label: findPro.urgency.<value>, description: findPro.urgencySub.<value>
  { value: "low",       color: "#94a3b8" },
  { value: "medium",    color: "#d97706" },
  { value: "high",      color: "#ea580c" },
  { value: "emergency", color: "#dc2626" },
] as const;

const ATLANTA_PREFIXES = ["300", "301", "302", "303"];
function inAtlantaArea(state?: string | null, zip?: string | null): boolean {
  const s = state?.trim().toUpperCase();
  if (!s) return true;
  if (s !== "GA" && s !== "GEORGIA") return false;
  if (!zip?.trim()) return true;
  return ATLANTA_PREFIXES.includes(zip.trim().slice(0, 3));
}

export default function FindAProTab() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const qc = useQueryClient();
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ propertyId?: string; assetId?: string }>();

  const { data: properties = [] } = useListProperties();
  const [propertyId, setPropertyId] = useState(params.propertyId ?? "");
  const [assetId, setAssetId] = useState(params.assetId ?? "");
  const [urgency, setUrgency] = useState<"low" | "medium" | "high" | "emergency">("medium");
  const [description, setDescription] = useState("");
  const [phone, setPhone] = useState("");
  const [propertyOpen, setPropertyOpen] = useState(false);
  const [assetOpen, setAssetOpen] = useState(false);

  useEffect(() => {
    if (params.propertyId) setPropertyId(params.propertyId);
    if (params.assetId) setAssetId(params.assetId);
  }, [params.propertyId, params.assetId]);

  const { data: assets = [] } = useListAssets(propertyId, undefined, {
    query: { enabled: !!propertyId, queryKey: getListAssetsQueryKey(propertyId) },
  });

  const createJob = useCreateMarketplaceJob();

  const selectedProp = properties.find((p) => p.id === propertyId);
  const selectedAsset = assets.find((a) => a.id === assetId);
  const inArea = selectedProp ? inAtlantaArea(selectedProp.state, selectedProp.zipCode) : true;

  function resetForm() {
    setPropertyId("");
    setAssetId("");
    setUrgency("medium");
    setDescription("");
    setPhone("");
    setPropertyOpen(false);
    setAssetOpen(false);
  }

  function handleSubmit() {
    if (!assetId || !description.trim()) {
      Alert.alert(t("findPro.missingInfo"), t("findPro.missingInfoDesc"));
      return;
    }
    createJob.mutate(
      { data: { assetId, description: description.trim(), urgency, contactPhone: phone.trim() || undefined } },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: getListMarketplaceJobsQueryKey() });
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          Alert.alert(t("findPro.posted"), t("findPro.postedDesc"), [
            { text: t("common.ok"), onPress: resetForm },
          ]);
        },
        onError: () => {
          Alert.alert(t("common.error"), t("findPro.postFailed"));
        },
      }
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header */}
      <View style={[s.header, { paddingTop: topPad + 8, borderBottomColor: colors.border, backgroundColor: colors.background }]}>
        <View style={[s.headerIcon, { backgroundColor: colors.primary + "15" }]}>
          <Feather name="user-check" size={16} color={colors.primary} />
        </View>
        <View>
          <Text style={[s.headerTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
            {t("findPro.title")}
          </Text>
          <Text style={[s.headerSub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
            {t("findPro.subtitle")}
          </Text>
        </View>
      </View>

      <KeyboardAwareScrollViewCompat
        contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 48, gap: 20 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Property picker */}
        <View style={{ gap: 8 }}>
          <Text style={[s.label, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>{t("findPro.propertyLabel")}</Text>
          <TouchableOpacity
            onPress={() => { Haptics.selectionAsync(); setPropertyOpen((o) => !o); setAssetOpen(false); }}
            style={[s.picker, { backgroundColor: colors.card, borderColor: colors.border }]}
            activeOpacity={0.7}
          >
            <Text style={[s.pickerText, { color: selectedProp ? colors.foreground : colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              {selectedProp ? selectedProp.name || selectedProp.address || t("common.myHome") : t("findPro.chooseProperty")}
            </Text>
            <Feather name={propertyOpen ? "chevron-up" : "chevron-down"} size={16} color={colors.mutedForeground} />
          </TouchableOpacity>
          {propertyOpen && (
            <View style={[s.dropdown, { backgroundColor: colors.card, borderColor: colors.border }]}>
              {properties.map((p) => (
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityState={{ selected: p.id === propertyId }}
                  key={p.id}
                  onPress={() => { Haptics.selectionAsync(); setPropertyId(p.id); setAssetId(""); setPropertyOpen(false); }}
                  style={[s.dropdownItem, { borderBottomColor: colors.border, backgroundColor: p.id === propertyId ? colors.primary + "12" : "transparent" }]}
                  activeOpacity={0.7}
                >
                  <Text style={[s.dropdownText, { color: colors.foreground, fontFamily: p.id === propertyId ? "Inter_600SemiBold" : "Inter_400Regular" }]}>
                    {p.name || p.address || t("common.myHome")}
                  </Text>
                  {p.id === propertyId && <Feather name="check" size={14} color={colors.primary} />}
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Asset picker */}
        <View style={{ gap: 8 }}>
          <Text style={[s.label, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>{t("findPro.assetLabel")}</Text>
          <TouchableOpacity
            onPress={() => {
              if (!propertyId) { Alert.alert(t("findPro.selectPropertyFirst")); return; }
              Haptics.selectionAsync(); setAssetOpen((o) => !o); setPropertyOpen(false);
            }}
            style={[s.picker, { backgroundColor: colors.card, borderColor: colors.border, opacity: !propertyId ? 0.5 : 1 }]}
            activeOpacity={0.7}
          >
            <Text style={[s.pickerText, { color: selectedAsset ? colors.foreground : colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              {selectedAsset
                ? `${selectedAsset.name}${selectedAsset.brand ? ` — ${selectedAsset.brand}` : ""}`
                : propertyId ? t("findPro.chooseAsset") : t("findPro.selectPropertyFirst")}
            </Text>
            <Feather name={assetOpen ? "chevron-up" : "chevron-down"} size={16} color={colors.mutedForeground} />
          </TouchableOpacity>
          {assetOpen && assets.length > 0 && (
            <View style={[s.dropdown, { backgroundColor: colors.card, borderColor: colors.border }]}>
              {assets.map((a) => (
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityState={{ selected: a.id === assetId }}
                  key={a.id}
                  onPress={() => { Haptics.selectionAsync(); setAssetId(a.id); setAssetOpen(false); }}
                  style={[s.dropdownItem, { borderBottomColor: colors.border, backgroundColor: a.id === assetId ? colors.primary + "12" : "transparent" }]}
                  activeOpacity={0.7}
                >
                  <Text style={[s.dropdownText, { color: colors.foreground, fontFamily: a.id === assetId ? "Inter_600SemiBold" : "Inter_400Regular" }]}>
                    {a.name}{a.brand ? ` — ${a.brand}` : ""}
                  </Text>
                  {a.id === assetId && <Feather name="check" size={14} color={colors.primary} />}
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Service area warning */}
        {selectedProp && !inArea && (
          <View style={[s.warningBox, { backgroundColor: "#fffbeb", borderColor: "#fde68a" }]}>
            <Feather name="alert-triangle" size={15} color="#d97706" style={{ marginTop: 1 }} />
            <View style={{ flex: 1 }}>
              <Text style={[s.warningTitle, { fontFamily: "Inter_600SemiBold" }]}>{t("findPro.outsideAreaTitle")}</Text>
              <Text style={[s.warningText, { fontFamily: "Inter_400Regular" }]}>
                {t("findPro.outsideAreaBody")}
              </Text>
            </View>
          </View>
        )}

        {/* Urgency */}
        <View style={{ gap: 8 }}>
          <Text style={[s.label, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>{t("findPro.urgencyLabel")}</Text>
          <View style={{ gap: 6 }}>
            {URGENCY_OPTIONS.map((opt) => (
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityState={{ selected: urgency === opt.value }}
                key={opt.value}
                onPress={() => { Haptics.selectionAsync(); setUrgency(opt.value); }}
                style={[s.urgencyRow, {
                  backgroundColor: urgency === opt.value ? opt.color + "12" : colors.card,
                  borderColor: urgency === opt.value ? opt.color + "60" : colors.border,
                }]}
                activeOpacity={0.7}
              >
                <View style={[s.urgencyDot, { backgroundColor: opt.color }]} />
                <View style={{ flex: 1 }}>
                  <Text style={[s.urgencyLabel, { color: urgency === opt.value ? opt.color : colors.foreground, fontFamily: urgency === opt.value ? "Inter_600SemiBold" : "Inter_500Medium" }]}>
                    {t(`findPro.urgency.${opt.value}`)}
                  </Text>
                  <Text style={[s.urgencySub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>{t(`findPro.urgencySub.${opt.value}`)}</Text>
                </View>
                {urgency === opt.value && <Feather name="check-circle" size={16} color={opt.color} />}
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Phone */}
        <View style={{ gap: 8 }}>
          <Text style={[s.label, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
            {t("findPro.phoneLabel")} <Text style={{ fontWeight: "400", color: colors.mutedForeground }}>{t("findPro.phoneHint")}</Text>
          </Text>
          <TextInput
            value={phone}
            onChangeText={setPhone}
            placeholder={t("findPro.phonePlaceholder")}
            placeholderTextColor={colors.mutedForeground}
            keyboardType="phone-pad"
            style={[s.input, { color: colors.foreground, backgroundColor: colors.card, borderColor: colors.border, fontFamily: "Inter_400Regular" }]}
          />
        </View>

        {/* Description */}
        <View style={{ gap: 8 }}>
          <Text style={[s.label, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>{t("findPro.descriptionLabel")}</Text>
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder={t("findPro.descriptionPlaceholder")}
            placeholderTextColor={colors.mutedForeground}
            multiline
            numberOfLines={4}
            style={[s.textarea, { color: colors.foreground, backgroundColor: colors.card, borderColor: colors.border, fontFamily: "Inter_400Regular" }]}
          />
        </View>

        {/* Submit */}
        <TouchableOpacity
          onPress={handleSubmit}
          disabled={!assetId || !description.trim() || createJob.isPending || !inArea}
          style={[s.submitBtn, { backgroundColor: colors.primary, opacity: (!assetId || !description.trim() || createJob.isPending || !inArea) ? 0.5 : 1 }]}
          activeOpacity={0.8}
        >
          {createJob.isPending ? (
            <ActivityIndicator color={colors.primaryForeground} size="small" />
          ) : (
            <Feather name="send" size={16} color={colors.primaryForeground} />
          )}
          <Text style={[s.submitText, { color: colors.primaryForeground, fontFamily: "Inter_600SemiBold" }]}>
            {createJob.isPending ? t("findPro.posting") : t("findPro.postRequest")}
          </Text>
        </TouchableOpacity>
      </KeyboardAwareScrollViewCompat>
    </View>
  );
}

const s = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingBottom: 14, borderBottomWidth: 1, gap: 12 },
  headerIcon: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 20 },
  headerSub: { fontSize: 11, marginTop: 1 },
  label: { fontSize: 13 },
  picker: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12 },
  pickerText: { fontSize: 14, flex: 1 },
  dropdown: { borderRadius: 12, borderWidth: 1, overflow: "hidden" },
  dropdownItem: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  dropdownText: { fontSize: 14, flex: 1 },
  warningBox: { flexDirection: "row", gap: 10, borderRadius: 12, borderWidth: 1, padding: 12 },
  warningTitle: { fontSize: 13, color: "#92400e" },
  warningText: { fontSize: 12, color: "#92400e", marginTop: 2, lineHeight: 17 },
  urgencyRow: { flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 12, borderWidth: 1, padding: 12 },
  urgencyDot: { width: 8, height: 8, borderRadius: 99 },
  urgencyLabel: { fontSize: 13 },
  urgencySub: { fontSize: 11, marginTop: 1 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14 },
  textarea: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, minHeight: 100, textAlignVertical: "top" },
  submitBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 14, paddingVertical: 15 },
  submitText: { fontSize: 15 },
});
