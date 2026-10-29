import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQueryClient } from "@tanstack/react-query";
import {
  getGetMarketplaceJobDetailsQueryKey,
  getGetTechnicianScannedAssetQueryKey,
  getGetUserProfileQueryKey,
  getListAssignedJobsQueryKey,
  getListOpenMarketplaceJobsQueryKey,
} from "@workspace/api-client-react";
import { useTranslation } from "react-i18next";
import i18n from "@/i18n";
import { formatDate } from "@/lib/dates";
import { useColors } from "@/hooks/useColors";
import { apiErrorStatus } from "@/hooks/useRole";

export type Colors = ReturnType<typeof useColors>;
type FeatherIcon = keyof typeof Feather.glyphMap;

// ── Urgency & status ─────────────────────────────────────────────────────────
// Same palette as the homeowner job screen (app/job/[id].tsx); backgrounds use
// a translucent tint of the colour so they work in light and dark mode.
export const URGENCY: Record<string, { labelKey: string; color: string; icon: FeatherIcon }> = {
  emergency: { labelKey: "tech.urgency.emergency", color: "#dc2626", icon: "alert-circle" },
  high: { labelKey: "tech.urgency.high", color: "#ea580c", icon: "alert-circle" },
  medium: { labelKey: "tech.urgency.medium", color: "#d97706", icon: "clock" },
  low: { labelKey: "tech.urgency.low", color: "#6b7280", icon: "clock" },
};
/** Urgency display config; `label` is resolved in the active language at call (render) time. */
export function urgencyOf(u: string | undefined | null) {
  const cfg = URGENCY[u ?? "medium"] ?? URGENCY.medium!;
  return { ...cfg, label: i18n.t(cfg.labelKey) };
}

export const JOB_STATUS: Record<string, { labelKey: string; color: string; icon: FeatherIcon }> = {
  open: { labelKey: "tech.status.open", color: "#0369a1", icon: "search" },
  claimed: { labelKey: "tech.status.claimed", color: "#059669", icon: "check-circle" },
  en_route: { labelKey: "tech.status.en_route", color: "#2563eb", icon: "navigation" },
  arrived: { labelKey: "tech.status.arrived", color: "#059669", icon: "map-pin" },
  completed: { labelKey: "tech.status.completed", color: "#7c3aed", icon: "check-circle" },
};
/** Status display config; `label` is resolved in the active language at call (render) time. */
export function statusOf(s: string | undefined | null) {
  const cfg = JOB_STATUS[s ?? "open"];
  if (!cfg) return { labelKey: "", label: s ?? i18n.t("tech.status.unknown"), color: "#6b7280", icon: "circle" as FeatherIcon };
  return { ...cfg, label: i18n.t(cfg.labelKey) };
}

export const ACTIVE_STATUSES = new Set(["claimed", "en_route", "arrived"]);

// ── Formatting ──────────────────────────────────────────────────────────────
export function fmtDate(iso: string | null | undefined, pattern: string): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : formatDate(d, pattern);
}

export function fmtMoney(v: string | number | null | undefined): string | null {
  const n = Number(v);
  if (v == null || !Number.isFinite(n) || n <= 0) return null;
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

export function isSameLocalDay(iso: string | null | undefined, now = new Date()): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
}

export function joinParts(...parts: Array<string | null | undefined>): string {
  return parts.filter(Boolean).join(", ");
}

// ── Query helpers ───────────────────────────────────────────────────────────
// Every scan result's key starts with the generated key for an empty ref.
const SCANNED_ASSET_KEY_PREFIX = getGetTechnicianScannedAssetQueryKey("")[0];

/** Invalidates every list/detail a job status change can affect. */
export function useInvalidateTechJobs() {
  const qc = useQueryClient();
  return (jobId?: string) =>
    Promise.all([
      qc.invalidateQueries({ queryKey: getListOpenMarketplaceJobsQueryKey() }),
      qc.invalidateQueries({ queryKey: getListAssignedJobsQueryKey() }),
      jobId ? qc.invalidateQueries({ queryKey: getGetMarketplaceJobDetailsQueryKey(jobId) }) : Promise.resolve(),
      // Scan results embed job status too.
      // The ref (asset id or registry id) isn't known here, so match the generated key's prefix.
      qc.invalidateQueries({ predicate: (q) => String(q.queryKey[0] ?? "").startsWith(SCANNED_ASSET_KEY_PREFIX) }),
    ]);
}

/**
 * A 403 from a technician endpoint means the role was revoked server-side;
 * refetch the profile so the group guard moves the user out of the tech app.
 */
export function useRefetchRoleOn403(...errors: unknown[]) {
  const qc = useQueryClient();
  const forbidden = errors.some((e) => apiErrorStatus(e) === 403);
  useEffect(() => {
    if (forbidden) qc.invalidateQueries({ queryKey: getGetUserProfileQueryKey() });
  }, [forbidden, qc]);
}

// ── Layout pieces ───────────────────────────────────────────────────────────
export function useTopPad() {
  const insets = useSafeAreaInsets();
  return Platform.OS === "web" ? 67 : insets.top;
}

/** Bottom padding that clears the (absolutely positioned) tab bar. */
export function useTabBottomPad() {
  const insets = useSafeAreaInsets();
  return insets.bottom + 96;
}

export function TabHeader({
  icon,
  title,
  subtitle,
  right,
}: {
  icon: FeatherIcon;
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}) {
  const colors = useColors();
  const topPad = useTopPad();
  return (
    <View style={[ui.header, { paddingTop: topPad + 8, borderBottomColor: colors.border, backgroundColor: colors.background }]}>
      <View style={[ui.headerIcon, { backgroundColor: colors.primary + "15" }]}>
        <Feather name={icon} size={16} color={colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text accessibilityRole="header" style={[ui.headerTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={[ui.headerSub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>{subtitle}</Text>
        ) : null}
      </View>
      {right}
    </View>
  );
}

export function Skeleton({
  height,
  width,
  radius,
  style,
}: {
  height: number;
  width?: number | `${number}%`;
  radius?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const colors = useColors();
  return (
    <View
      style={[{ height, width: width ?? "100%", borderRadius: radius ?? 8, backgroundColor: colors.muted }, style]}
    />
  );
}

export function ListSkeleton({ count = 4, height = 96 }: { count?: number; height?: number }) {
  const { t } = useTranslation();
  return (
    <View
      style={{ gap: 12, padding: 20 }}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={t("common.loading")}
    >
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} height={height} radius={12} />
      ))}
    </View>
  );
}

export function Chip({ label, color, icon }: { label: string; color: string; icon?: FeatherIcon }) {
  return (
    <View style={[ui.chip, { backgroundColor: color + "1F" }]}>
      {icon ? <Feather name={icon} size={11} color={color} /> : null}
      <Text style={[ui.chipText, { color, fontFamily: "Inter_700Bold" }]}>{label}</Text>
    </View>
  );
}

export function Section({
  icon,
  title,
  children,
  style,
}: {
  icon?: FeatherIcon;
  title?: string;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const colors = useColors();
  return (
    <View style={[ui.section, { backgroundColor: colors.card, borderColor: colors.border }, style]}>
      {title ? (
        <View style={ui.sectionHeader}>
          {icon ? <Feather name={icon} size={13} color={colors.mutedForeground} /> : null}
          <Text style={[ui.sectionTitle, { color: colors.mutedForeground, fontFamily: "Inter_700Bold" }]}>
            {title.toUpperCase()}
          </Text>
        </View>
      ) : null}
      {children}
    </View>
  );
}

export function InfoRow({
  icon,
  children,
  colors,
}: {
  icon: FeatherIcon;
  children: React.ReactNode;
  colors: Colors;
}) {
  return (
    <View style={ui.infoRow}>
      <Feather name={icon} size={14} color={colors.mutedForeground} style={{ marginTop: 2 }} />
      <View style={{ flex: 1, gap: 2 }}>{children}</View>
    </View>
  );
}

export function Button({
  label,
  icon,
  onPress,
  disabled,
  loading,
  variant = "primary",
  accessibilityHint,
  style,
}: {
  label: string;
  icon?: FeatherIcon;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: "primary" | "outline" | "ghost";
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const colors = useColors();
  const isPrimary = variant === "primary";
  const bg = isPrimary ? colors.primary : variant === "outline" ? colors.card : "transparent";
  const fg = isPrimary ? colors.primaryForeground : colors.primary;
  const off = disabled || loading;
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!off, busy: !!loading }}
      onPress={onPress}
      disabled={off}
      activeOpacity={0.8}
      style={[
        ui.btn,
        { backgroundColor: bg, opacity: off ? 0.5 : 1 },
        variant === "outline" && { borderWidth: 1, borderColor: colors.border },
        style,
      ]}
    >
      {loading ? <ActivityIndicator size="small" color={fg} /> : icon ? <Feather name={icon} size={16} color={fg} /> : null}
      <Text style={[ui.btnText, { color: fg, fontFamily: "Inter_600SemiBold" }]}>{label}</Text>
    </TouchableOpacity>
  );
}

/** Inline banner for errors / success messages (the web portal's toasts). */
export function Notice({
  tone,
  message,
  title,
}: {
  tone: "error" | "success" | "warning" | "info";
  message: string;
  title?: string;
}) {
  const colors = useColors();
  const c =
    tone === "error" ? colors.destructive : tone === "success" ? "#059669" : tone === "warning" ? "#d97706" : colors.mutedForeground;
  const icon: FeatherIcon =
    tone === "error" ? "alert-circle" : tone === "success" ? "check-circle" : tone === "warning" ? "alert-triangle" : "info";
  return (
    <View
      accessibilityLiveRegion="polite"
      accessibilityRole={tone === "error" ? "alert" : undefined}
      style={[ui.notice, { backgroundColor: c + "14", borderColor: c + "40" }]}
    >
      <Feather name={icon} size={15} color={c} style={{ marginTop: 1 }} />
      <View style={{ flex: 1, gap: 2 }}>
        {title ? <Text style={[ui.noticeTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>{title}</Text> : null}
        <Text style={[ui.noticeText, { color: colors.foreground, fontFamily: "Inter_400Regular" }]}>{message}</Text>
      </View>
    </View>
  );
}

/** A transient success message that clears itself (stand-in for web toasts). */
export function useFlash(timeoutMs = 4000) {
  const [flash, setFlash] = useState<{ title?: string; message: string } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const show = (message: string, title?: string) => {
    if (timer.current) clearTimeout(timer.current);
    setFlash({ message, title });
    timer.current = setTimeout(() => setFlash(null), timeoutMs);
  };
  return { flash, show, clear: () => setFlash(null) };
}

// ── Service history ─────────────────────────────────────────────────────────
export type HistoryRecord = {
  id?: string;
  date?: string | null;
  description: string;
  companyName?: string | null;
  technicianName?: string | null;
  cost?: string | number | null;
  verified?: boolean | null;
};

export function ServiceHistoryList({ records, limit }: { records: HistoryRecord[]; limit?: number }) {
  const colors = useColors();
  const { t } = useTranslation();
  const shown = limit ? records.slice(0, limit) : records;
  return (
    <View>
      {shown.map((r, idx) => {
        const cost = fmtMoney(r.cost);
        const who = [r.companyName, r.technicianName].filter(Boolean).join(" · ");
        return (
          <View
            key={r.id ?? idx}
            style={[ui.historyRow, { borderBottomColor: colors.border }, idx === shown.length - 1 && { borderBottomWidth: 0 }]}
          >
            <View style={[ui.historyDot, { backgroundColor: colors.primary }]} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={[ui.historyDesc, { color: colors.foreground, fontFamily: "Inter_500Medium" }]}>{r.description}</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
                {r.date ? (
                  <Text style={[ui.small, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                    {r.date.slice(0, 10)}
                  </Text>
                ) : null}
                {who ? <Text style={[ui.small, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>{who}</Text> : null}
                {cost ? <Text style={[ui.small, { color: colors.primary, fontFamily: "Inter_600SemiBold" }]}>{cost}</Text> : null}
                {r.verified ? (
                  <Text style={[ui.small, { color: "#059669", fontFamily: "Inter_600SemiBold" }]}>{t("tech.history.verified")}</Text>
                ) : null}
              </View>
            </View>
          </View>
        );
      })}
    </View>
  );
}

export const ui = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingBottom: 14, borderBottomWidth: 1, gap: 12 },
  headerIcon: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 20 },
  headerSub: { fontSize: 11, marginTop: 1 },
  chip: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 99, alignSelf: "flex-start" },
  chipText: { fontSize: 11 },
  section: { borderRadius: 12, borderWidth: 1, padding: 14, gap: 10 },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 6 },
  sectionTitle: { fontSize: 11, letterSpacing: 0.8 },
  infoRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  btn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 12, paddingVertical: 13, paddingHorizontal: 16, minHeight: 46 },
  btnText: { fontSize: 15 },
  notice: { flexDirection: "row", gap: 10, borderRadius: 12, borderWidth: 1, padding: 12 },
  noticeTitle: { fontSize: 13 },
  noticeText: { fontSize: 13, lineHeight: 18 },
  historyRow: { flexDirection: "row", alignItems: "flex-start", gap: 10, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  historyDot: { width: 8, height: 8, borderRadius: 4, marginTop: 5 },
  historyDesc: { fontSize: 13, lineHeight: 18 },
  small: { fontSize: 11 },
  body: { fontSize: 14, lineHeight: 20 },
  muted: { fontSize: 12, lineHeight: 17 },
  label: { fontSize: 13 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14 },
});
