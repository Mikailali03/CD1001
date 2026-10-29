import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";
import { s } from "./styles";

export function DoneStep({
  assetName, planBlocked, taskCount, onView, onAddAnother, onDone, colors,
}: {
  assetName: string; planBlocked: boolean; taskCount: number | null;
  onView: () => void; onAddAnother: () => void; onDone: () => void;
  colors: ReturnType<typeof useColors>;
}) {
  const { t } = useTranslation();
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32, gap: 20 }}>
      <View style={[s.genIconWrap, { backgroundColor: "#3d7a5f18" }]}>
        <Feather name="check-circle" size={44} color="#3d7a5f" />
      </View>
      <View style={{ alignItems: "center", gap: 8 }}>
        <Text style={[{ fontSize: 22, color: colors.foreground, fontFamily: "Inter_700Bold", textAlign: "center" }]}>
          {assetName ? t("addAsset.doneTitleNamed", { name: assetName }) : t("addAsset.addedHeader")}
        </Text>
        <Text style={[{ fontSize: 14, color: colors.mutedForeground, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 20 }]}>
          {planBlocked
            ? t("addAsset.doneDescBlocked")
            : (taskCount ?? 0) > 0
              ? t("addAsset.doneDescTasks", { count: taskCount ?? 0 })
              : t("addAsset.doneDescNoTasks")}
        </Text>
      </View>

      {planBlocked && (
        <View style={{ width: "100%", borderRadius: 14, borderWidth: 1, borderColor: "#fcd34d", backgroundColor: "#fffbeb", padding: 14, flexDirection: "row", alignItems: "center", gap: 10 }}>
          <Feather name="zap" size={18} color="#d97706" />
          <View style={{ flex: 1 }}>
            <Text style={[{ fontSize: 13, color: "#92400e", fontFamily: "Inter_600SemiBold" }]}>{t("addAsset.freePlanUsed")}</Text>
            <Text style={[{ fontSize: 12, color: "#b45309", fontFamily: "Inter_400Regular", marginTop: 2, lineHeight: 17 }]}>
              {t("addAsset.freePlanUsedDesc")}
            </Text>
          </View>
        </View>
      )}

      <View style={{ width: "100%", gap: 10, marginTop: 8 }}>
        <TouchableOpacity
          onPress={() => { Haptics.selectionAsync(); onView(); }}
          style={[s.saveBtn, { backgroundColor: "#3d7a5f" }]}
          activeOpacity={0.85}
        >
          <Feather name="eye" size={18} color="#fff" />
          <Text style={[s.saveBtnText, { fontFamily: "Inter_700Bold" }]}>{t("addAsset.viewAsset")}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => { Haptics.selectionAsync(); onAddAnother(); }}
          style={[s.outlineBtn, { borderColor: colors.border }]}
          activeOpacity={0.7}
        >
          <Feather name="plus" size={16} color={colors.foreground} />
          <Text style={[s.outlineBtnText, { color: colors.foreground, fontFamily: "Inter_500Medium" }]}>{t("addAsset.addAnother")}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onDone} activeOpacity={0.7}>
          <Text style={[{ textAlign: "center", fontSize: 13, color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
            {t("common.done")}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
