import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";
import { s } from "./styles";
import type { ScanResult, Step } from "./types";

// ── Header: back/close, title per step, step dots ─────────────────────────────
export function AddAssetHeader({
  step, scanResult, fieldsFilled, taskCount, topPad, onBack, colors,
}: {
  step: Step; scanResult: ScanResult | null; fieldsFilled: number; taskCount: number | null;
  topPad: number; onBack: () => void; colors: ReturnType<typeof useColors>;
}) {
  const { t } = useTranslation();
  return (
    <View style={[s.header, { paddingTop: topPad, borderBottomColor: colors.border, backgroundColor: colors.background }]}>
      {step !== "generating" && step !== "done" ? (
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={step === "method" ? t("common.close") : t("common.goBack")}
          hitSlop={8}
          onPress={() => { Haptics.selectionAsync(); onBack(); }}
          style={s.backBtn} activeOpacity={0.7}
        >
          <Feather name={step === "method" ? "x" : "chevron-left"} size={22} color={colors.foreground} />
        </TouchableOpacity>
      ) : (
        <View style={s.backBtn} />
      )}

      <View style={s.headerCenter}>
        <View style={[s.headerIcon, {
          backgroundColor: step === "done" ? "#3d7a5f18"
            : step === "review" && scanResult ? "#3d7a5f18"
            : colors.primary + "15",
        }]}>
          <Feather
            name={
              step === "done" ? "check-circle"
                : step === "generating" ? "cpu"
                : step === "review" ? "edit-2"
                : step === "lens" ? "camera"
                : "plus-circle"
            }
            size={16}
            color={step === "done" || (step === "review" && scanResult) ? "#3d7a5f" : colors.primary}
          />
        </View>
        <View>
          <Text style={[s.headerTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
            {step === "method" ? t("addAsset.title")
              : step === "lens" ? t("addAsset.aiLens")
              : step === "review" ? (scanResult ? t("addAsset.reviewTitle") : t("addAsset.detailsTitle"))
              : step === "generating" ? t("addAsset.generatingHeader")
              : t("addAsset.addedHeader")}
          </Text>
          <Text style={[s.headerSub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
            {step === "method" ? t("addAsset.methodSubtitle")
              : step === "lens" ? t("addAsset.lensSubtitle")
              : step === "review" ? (scanResult ? t("addAsset.reviewSubtitle", { count: fieldsFilled }) : t("addAsset.detailsSubtitle"))
              : step === "generating" ? t("addAsset.generatingSubtitle")
              : t("addAsset.tasksScheduled", { count: taskCount ?? 0 })}
          </Text>
        </View>
      </View>

      {/* Step dots */}
      <View style={s.stepDots}>
        {(["method", "lens", "review"] as Step[]).map((st, i) => (
          <View
            key={st}
            style={[s.dot, {
              backgroundColor: st === step || (step === "generating" || step === "done")
                ? colors.primary
                : colors.muted,
              width: st === step ? 16 : 6,
            }]}
          />
        ))}
      </View>
    </View>
  );
}
