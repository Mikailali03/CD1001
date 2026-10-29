import React, { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Linking, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useFocusEffect, useLocalSearchParams } from "expo-router";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useTranslation } from "react-i18next";
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from "expo-camera";
import {
  getGetTechnicianScannedAssetQueryKey,
  useGetTechnicianScannedAsset,
} from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { apiErrorMessage, apiErrorStatus } from "@/hooks/useRole";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { MONO, ScanResultView } from "@/components/tech/ScanResultView";
import { Button, Notice, Skeleton, TabHeader, ui, useRefetchRoleOn403, useTabBottomPad } from "@/components/tech/ui";

/**
 * Narrows whatever the camera or the user produced to the reference the API
 * takes. Label URLs (…/a/<uuid>) become the UUID; bare UUIDs, registry IDs
 * (CDA-XXXXXXXX) and CDA|uuid|registry strings pass through for the server.
 */
function toAssetRef(raw: string): string {
  const input = raw.trim();
  const fromUrl = input.match(/\/a\/([0-9a-f-]{36})(?:[/?#]|$)/i);
  if (fromUrl) return fromUrl[1]!;
  return input;
}

const RESCAN_COOLDOWN_MS = 2500;

type CameraIssue = "unavailable" | null;

export default function ScanScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  const bottomPad = useTabBottomPad();
  const { code: initialCode } = useLocalSearchParams<{ code?: string }>();

  const [permission, requestPermission] = useCameraPermissions();
  const [cameraOn, setCameraOn] = useState(false);
  const [focused, setFocused] = useState(true);
  const [cameraIssue, setCameraIssue] = useState<CameraIssue>(null);
  const [manual, setManual] = useState("");
  const [ref, setRef] = useState<string | null>(null);
  const lastScan = useRef<{ data: string; at: number } | null>(null);

  // Release the camera whenever the tab isn't visible.
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );

  // Web: check for a camera up front (native reports a missing camera via onMountError).
  useEffect(() => {
    if (Platform.OS !== "web") return;
    CameraView.isAvailableAsync()
      .then((ok) => !ok && setCameraIssue("unavailable"))
      .catch(() => setCameraIssue("unavailable"));
  }, []);

  // Arriving with ?code=… (e.g. from a label URL) looks it up straight away.
  useEffect(() => {
    if (initialCode) setRef(toAssetRef(initialCode));
  }, [initialCode]);

  const encoded = ref ? encodeURIComponent(ref) : "";
  const lookup = useGetTechnicianScannedAsset(encoded, {
    query: {
      queryKey: getGetTechnicianScannedAssetQueryKey(encoded),
      enabled: !!encoded,
      retry: false,
      staleTime: 0,
    },
  });
  useRefetchRoleOn403(lookup.error);

  const handleBarcode = useCallback(
    ({ data }: BarcodeScanningResult) => {
      if (!data) return;
      const now = Date.now();
      // The scanner fires many times a second; ignore repeats of the same code.
      if (lastScan.current && lastScan.current.data === data && now - lastScan.current.at < RESCAN_COOLDOWN_MS) return;
      lastScan.current = { data, at: now };
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setCameraOn(false);
      setRef(toAssetRef(data));
    },
    [],
  );

  function submitManual() {
    const value = manual.trim();
    if (!value) return;
    Haptics.selectionAsync();
    setCameraOn(false);
    if (toAssetRef(value) === ref) lookup.refetch();
    else setRef(toAssetRef(value));
  }

  async function startCamera() {
    setCameraIssue(null);
    let granted = permission?.granted ?? false;
    if (!granted && permission?.canAskAgain !== false) {
      granted = (await requestPermission()).granted;
    }
    if (granted) {
      Haptics.selectionAsync();
      lastScan.current = null;
      setRef(null);
      setCameraOn(true);
    }
  }

  function reset() {
    setRef(null);
    setManual("");
    lastScan.current = null;
  }

  const denied = !!permission && !permission.granted && !permission.canAskAgain;
  const cameraVisible = cameraOn && focused && !!permission?.granted && !cameraIssue;
  const errorStatus = apiErrorStatus(lookup.error);
  const errorText = lookup.isError
    ? errorStatus === 403
      ? t("tech.scan.accessRequired")
      : apiErrorMessage(lookup.error) ??
        (errorStatus === 404
          ? t("tech.scan.notFound")
          : errorStatus
            ? t("tech.scan.lookupFailed")
            : t("tech.scan.networkError"))
    : null;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <TabHeader icon="maximize" title={t("tech.scan.title")} subtitle={t("tech.scan.subtitle")} />
      <KeyboardAwareScrollViewCompat
        contentContainerStyle={{ padding: 20, paddingBottom: bottomPad, gap: 16 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Camera */}
        <View style={[styles.cameraCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {cameraVisible && (
            <View style={styles.cameraBox}>
              <CameraView
                style={StyleSheet.absoluteFill}
                facing="back"
                barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
                onBarcodeScanned={handleBarcode}
                onMountError={() => {
                  setCameraOn(false);
                  setCameraIssue("unavailable");
                }}
                accessibilityLabel={t("tech.scan.viewfinder")}
              />
              <View pointerEvents="none" style={styles.reticleWrap}>
                <View style={styles.reticle} />
              </View>
            </View>
          )}

          <View style={{ padding: 14, gap: 10 }}>
            {cameraIssue === "unavailable" && (
              <Notice tone="warning" message={t("tech.scan.noCamera")} />
            )}
            {denied && !cameraIssue && (
              <Notice
                tone="warning"
                title={t("tech.scan.cameraOffTitle")}
                message={t("tech.scan.cameraOffMessage")}
              />
            )}

            {!permission && Platform.OS !== "web" ? (
              <ActivityIndicator color={colors.primary} accessibilityLabel={t("tech.scan.checkingPermission")} />
            ) : cameraVisible ? (
              <Button label={t("tech.scan.stopCamera")} icon="camera-off" variant="outline" onPress={() => setCameraOn(false)} />
            ) : denied ? (
              <Button label={t("tech.scan.openSettings")} icon="settings" onPress={() => Linking.openSettings()} />
            ) : cameraIssue !== "unavailable" ? (
              <Button
                label={t("tech.scan.scanQr")}
                icon="camera"
                onPress={startCamera}
                disabled={lookup.isFetching}
              />
            ) : null}
          </View>
        </View>

        {/* Manual fallback */}
        <View style={{ gap: 6 }}>
          <Text style={[ui.label, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>{t("tech.scan.orEnterId")}</Text>
          <View style={styles.manualRow}>
            <TextInput
              accessibilityLabel={t("tech.scan.registryIdA11y")}
              value={manual}
              onChangeText={setManual}
              onSubmitEditing={submitManual}
              placeholder="CDA-1A2B3C4D"
              placeholderTextColor={colors.mutedForeground}
              autoCapitalize="characters"
              autoCorrect={false}
              autoComplete="off"
              spellCheck={false}
              returnKeyType="search"
              style={[ui.input, { flex: 1, color: colors.foreground, backgroundColor: colors.card, borderColor: colors.border, fontFamily: MONO }]}
            />
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={t("tech.scan.lookUpId")}
              accessibilityState={{ disabled: !manual.trim() || lookup.isFetching }}
              disabled={!manual.trim() || lookup.isFetching}
              onPress={submitManual}
              style={[styles.lookupBtn, { backgroundColor: colors.primary, opacity: !manual.trim() || lookup.isFetching ? 0.5 : 1 }]}
              activeOpacity={0.8}
            >
              <Feather name="search" size={18} color={colors.primaryForeground} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Result */}
        {!!encoded && lookup.isFetching && !lookup.data && (
          <View style={{ gap: 12 }} accessible accessibilityRole="progressbar" accessibilityLabel={t("tech.scan.lookingUp")}>
            <Skeleton height={64} radius={12} />
            <Skeleton height={120} radius={12} />
          </View>
        )}
        {!!encoded && errorText && !lookup.isFetching && <Notice tone="error" message={errorText} />}
        {!!encoded && lookup.data && !lookup.isError && <ScanResultView result={lookup.data} onReset={reset} />}
      </KeyboardAwareScrollViewCompat>
    </View>
  );
}

const styles = StyleSheet.create({
  cameraCard: { borderRadius: 14, borderWidth: 1, overflow: "hidden" },
  cameraBox: { aspectRatio: 4 / 3, backgroundColor: "#000" },
  reticleWrap: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center" },
  reticle: { width: 200, height: 200, borderRadius: 16, borderWidth: 2, borderColor: "rgba(255,255,255,0.85)" },
  manualRow: { flexDirection: "row", gap: 8 },
  lookupBtn: { width: 48, borderRadius: 12, alignItems: "center", justifyContent: "center" },
});
