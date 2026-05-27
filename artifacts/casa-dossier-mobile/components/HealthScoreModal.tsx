import React, { useState } from "react";
import {
  View,
  Text,
  Modal,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useAuth } from "@clerk/expo";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { format, addDays } from "date-fns";
import { useColors } from "@/hooks/useColors";
import { getSpecsForCategory, type MaintenanceSpec } from "@/lib/maintenance-specs";
import * as Haptics from "expo-haptics";

// ── Types ─────────────────────────────────────────────────────────────────────
type OverdueTask = {
  id: string;
  title: string;
  nextDueDate: string;
  isDiy?: boolean;
  assetId?: string;
  assetName?: string;
  estimatedCost?: string | null;
};

type AssetScore = {
  assetId: string;
  assetName: string;
  category: string;
  score: number;
  ageYears: number;
  lifespanYears: number;
};

type CompletePayload = {
  notes?: string;
  isDiy: boolean;
  cost?: number;
  technicianName?: string;
  completedDate: string;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  healthScore: number;
  healthGrade: string;
  overdueTaskCount: number;
  overdueTasks?: OverdueTask[];
  assetScores?: AssetScore[];
  propertyId: string;
};

// ── Grade colors ──────────────────────────────────────────────────────────────
const GRADE_COLOR: Record<string, string> = {
  A: "#3d7a5f",
  B: "#4b7fb5",
  C: "#c8853a",
  D: "#b85a2a",
  F: "#c0392b",
};

const PRIORITY_BG: Record<string, string> = {
  high: "#fef2f2",
  medium: "#fffbeb",
  low: "#f1f5f9",
};
const PRIORITY_COLOR: Record<string, string> = {
  high: "#b91c1c",
  medium: "#92400e",
  low: "#475569",
};

// ── Inline completion form ────────────────────────────────────────────────────
function CompletionForm({
  isDiyDefault,
  estimatedCost,
  titleHint,
  onDone,
  onCancel,
  colors,
}: {
  isDiyDefault: boolean;
  estimatedCost?: string | null;
  titleHint: string;
  onDone: (payload: CompletePayload) => Promise<void>;
  onCancel: () => void;
  colors: ReturnType<typeof useColors>;
}) {
  const [notes, setNotes] = useState("");
  const [cost, setCost] = useState(estimatedCost ? String(Number(estimatedCost)) : "");
  const [isDiy, setIsDiy] = useState(isDiyDefault);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    try {
      await onDone({
        notes: notes.trim() || undefined,
        isDiy,
        cost: cost ? parseFloat(cost) : undefined,
        technicianName: isDiy ? "Homeowner (DIY)" : undefined,
        completedDate: new Date().toLocaleDateString("en-CA"),
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={[cf.wrap, { backgroundColor: colors.muted + "80", borderColor: colors.border }]}>
      {/* DIY toggle */}
      <View style={cf.toggleRow}>
        <TouchableOpacity
          onPress={() => { Haptics.selectionAsync(); setIsDiy(true); }}
          style={[cf.toggleBtn, { backgroundColor: isDiy ? "#3d7a5f18" : colors.card, borderColor: isDiy ? "#3d7a5f60" : colors.border }]}
          activeOpacity={0.7}
        >
          <Feather name="tool" size={13} color={isDiy ? "#3d7a5f" : colors.mutedForeground} />
          <Text style={[cf.toggleText, { color: isDiy ? "#3d7a5f" : colors.mutedForeground, fontFamily: isDiy ? "Inter_600SemiBold" : "Inter_400Regular" }]}>DIY</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => { Haptics.selectionAsync(); setIsDiy(false); }}
          style={[cf.toggleBtn, { backgroundColor: !isDiy ? colors.primary + "18" : colors.card, borderColor: !isDiy ? colors.primary + "60" : colors.border }]}
          activeOpacity={0.7}
        >
          <Feather name="user" size={13} color={!isDiy ? colors.primary : colors.mutedForeground} />
          <Text style={[cf.toggleText, { color: !isDiy ? colors.primary : colors.mutedForeground, fontFamily: !isDiy ? "Inter_600SemiBold" : "Inter_400Regular" }]}>Pro</Text>
        </TouchableOpacity>
      </View>

      {/* Notes */}
      <TextInput
        value={notes}
        onChangeText={setNotes}
        placeholder={`Notes for ${titleHint.toLowerCase()}…`}
        placeholderTextColor={colors.mutedForeground}
        multiline
        numberOfLines={2}
        style={[cf.input, cf.textarea, { color: colors.foreground, backgroundColor: colors.card, borderColor: colors.border, fontFamily: "Inter_400Regular" }]}
      />

      {/* Cost */}
      <TextInput
        value={cost}
        onChangeText={setCost}
        placeholder="Actual cost (optional)"
        placeholderTextColor={colors.mutedForeground}
        keyboardType="decimal-pad"
        style={[cf.input, { color: colors.foreground, backgroundColor: colors.card, borderColor: colors.border, fontFamily: "Inter_400Regular" }]}
      />

      {/* Buttons */}
      <View style={cf.btnRow}>
        <TouchableOpacity onPress={onCancel} style={[cf.cancelBtn, { borderColor: colors.border }]} activeOpacity={0.7}>
          <Text style={[cf.cancelText, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={submit}
          disabled={busy}
          style={[cf.submitBtn, { backgroundColor: "#3d7a5f", opacity: busy ? 0.6 : 1 }]}
          activeOpacity={0.8}
        >
          {busy ? <ActivityIndicator color="#fff" size="small" /> : <Feather name="check" size={14} color="#fff" />}
          <Text style={[cf.submitText, { fontFamily: "Inter_600SemiBold" }]}>{busy ? "Saving…" : "Mark Done"}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const cf = StyleSheet.create({
  wrap: { borderRadius: 10, borderWidth: 1, padding: 10, marginTop: 8, gap: 8 },
  toggleRow: { flexDirection: "row", gap: 8 },
  toggleBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, borderRadius: 8, borderWidth: 1, paddingVertical: 8 },
  toggleText: { fontSize: 13 },
  input: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 13 },
  textarea: { minHeight: 56, textAlignVertical: "top" },
  btnRow: { flexDirection: "row", gap: 8 },
  cancelBtn: { flex: 1, alignItems: "center", justifyContent: "center", borderRadius: 8, borderWidth: 1, paddingVertical: 9 },
  cancelText: { fontSize: 13 },
  submitBtn: { flex: 2, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderRadius: 8, paddingVertical: 9 },
  submitText: { color: "#fff", fontSize: 13 },
});

// ── Overdue task row ──────────────────────────────────────────────────────────
function OverdueTaskRow({
  task,
  done,
  onMarkDone,
  colors,
}: {
  task: OverdueTask;
  done: boolean;
  onMarkDone: (id: string, payload: CompletePayload) => Promise<void>;
  colors: ReturnType<typeof useColors>;
}) {
  const [expanded, setExpanded] = useState(false);
  const daysOverdue = Math.max(0, Math.floor((Date.now() - new Date(task.nextDueDate).getTime()) / 86400000));

  if (done) {
    return (
      <View style={[tr.donePill, { backgroundColor: "#f0fdf4", borderColor: "#bbf7d0" }]}>
        <Feather name="check-circle" size={14} color="#16a34a" />
        <Text style={[tr.doneText, { color: "#15803d", fontFamily: "Inter_500Medium" }]} numberOfLines={1}>
          {task.title}
        </Text>
        <Text style={[tr.doneBadge, { color: "#16a34a", fontFamily: "Inter_600SemiBold" }]}>Done ✓</Text>
      </View>
    );
  }

  return (
    <View style={[tr.card, { backgroundColor: "#fef2f2", borderColor: "#fecaca" }]}>
      <View style={tr.cardTop}>
        <Feather name="alert-circle" size={15} color="#dc2626" style={{ marginTop: 1 }} />
        <View style={{ flex: 1 }}>
          <Text style={[tr.title, { color: colors.foreground, fontFamily: "Inter_500Medium" }]}>{task.title}</Text>
          <Text style={[tr.meta, { color: "#dc2626", fontFamily: "Inter_400Regular" }]}>
            {task.assetName ? `${task.assetName} · ` : ""}{daysOverdue}d overdue · was due {format(new Date(task.nextDueDate), "MMM d, yyyy")}
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => { Haptics.selectionAsync(); setExpanded((e) => !e); }}
          style={[tr.doneBtn, { borderColor: "#86efac" }]}
          activeOpacity={0.7}
        >
          <Feather name="check" size={12} color="#16a34a" />
          <Text style={[tr.doneBtnText, { color: "#16a34a", fontFamily: "Inter_600SemiBold" }]}>Done</Text>
        </TouchableOpacity>
      </View>
      {expanded && (
        <CompletionForm
          isDiyDefault={task.isDiy ?? true}
          estimatedCost={task.estimatedCost}
          titleHint={task.title}
          onDone={(payload) => onMarkDone(task.id, payload)}
          onCancel={() => setExpanded(false)}
          colors={colors}
        />
      )}
    </View>
  );
}

const tr = StyleSheet.create({
  card: { borderRadius: 10, borderWidth: 1, padding: 10, gap: 0 },
  cardTop: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  title: { fontSize: 13, lineHeight: 18 },
  meta: { fontSize: 11, marginTop: 2 },
  doneBtn: { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 6, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 5 },
  doneBtnText: { fontSize: 11 },
  donePill: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 8, borderWidth: 1, padding: 10 },
  doneText: { flex: 1, fontSize: 13 },
  doneBadge: { fontSize: 10 },
});

// ── Spec row ──────────────────────────────────────────────────────────────────
function SpecRow({
  spec,
  assetId,
  assetName,
  done,
  onMarkDone,
  colors,
}: {
  spec: MaintenanceSpec;
  assetId: string;
  assetName: string;
  done: boolean;
  onMarkDone: (assetId: string, spec: MaintenanceSpec, payload: CompletePayload) => Promise<void>;
  colors: ReturnType<typeof useColors>;
}) {
  const [expanded, setExpanded] = useState(false);
  const [stepsOpen, setStepsOpen] = useState(false);
  const nextDueAfter = addDays(new Date(), spec.intervalDays);

  const intervalLabel =
    spec.intervalDays < 60
      ? `Every ${spec.intervalDays}d`
      : spec.intervalDays < 400
      ? `Every ${Math.round(spec.intervalDays / 30)}mo`
      : `Every ${Math.round(spec.intervalDays / 365)}yr`;

  if (done) {
    return (
      <View style={[sr.donePill, { backgroundColor: "#f0fdf4", borderColor: "#bbf7d0" }]}>
        <Feather name="check-circle" size={14} color="#16a34a" />
        <View style={{ flex: 1 }}>
          <Text style={[sr.doneTitle, { color: "#15803d", fontFamily: "Inter_500Medium" }]} numberOfLines={1}>{spec.title}</Text>
          <Text style={[sr.doneSub, { color: "#16a34a", fontFamily: "Inter_400Regular" }]}>
            Next due {format(nextDueAfter, "MMM d, yyyy")} · Now tracked
          </Text>
        </View>
        <Text style={[sr.doneBadge, { color: "#16a34a", fontFamily: "Inter_600SemiBold" }]}>Done ✓</Text>
      </View>
    );
  }

  return (
    <View style={[sr.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={sr.cardTop}>
        <Feather name={spec.isDiy ? "tool" : "user-check"} size={14} color={spec.isDiy ? colors.primary : colors.mutedForeground} style={{ marginTop: 1 }} />
        <View style={{ flex: 1 }}>
          <Text style={[sr.title, { color: colors.foreground, fontFamily: "Inter_500Medium" }]}>{spec.title}</Text>
          <Text style={[sr.meta, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
            {assetName} · {intervalLabel}{spec.estimatedMinutes ? ` · ~${spec.estimatedMinutes}m` : ""}
          </Text>
        </View>
        <View style={{ gap: 4, alignItems: "flex-end" }}>
          <View style={[sr.priorityBadge, { backgroundColor: PRIORITY_BG[spec.priority] }]}>
            <Text style={[sr.priorityText, { color: PRIORITY_COLOR[spec.priority], fontFamily: "Inter_600SemiBold" }]}>{spec.priority}</Text>
          </View>
          <View style={[sr.typeBadge, { backgroundColor: spec.isDiy ? colors.primary + "15" : colors.muted }]}>
            <Text style={[sr.typeText, { color: spec.isDiy ? colors.primary : colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>
              {spec.isDiy ? "DIY" : "Pro"}
            </Text>
          </View>
        </View>
      </View>

      {/* Due note */}
      <View style={[sr.dueRow, { backgroundColor: "#fffbeb", borderColor: "#fde68a" }]}>
        <Feather name="calendar" size={11} color="#d97706" />
        <Text style={[sr.dueMeta, { color: "#92400e", fontFamily: "Inter_400Regular" }]}>
          <Text style={{ fontFamily: "Inter_600SemiBold" }}>Recommended now</Text>
          {" · next due "}
          <Text style={{ fontFamily: "Inter_600SemiBold" }}>{format(nextDueAfter, "MMM d, yyyy")}</Text>
          {" after completion"}
        </Text>
      </View>

      <Text style={[sr.desc, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]} numberOfLines={2}>
        {spec.description}
      </Text>

      <View style={sr.actions}>
        {(spec.steps?.length ?? 0) > 0 && (
          <TouchableOpacity onPress={() => setStepsOpen((o) => !o)} style={sr.stepsLink} activeOpacity={0.7}>
            <Feather name={stepsOpen ? "chevron-down" : "chevron-right"} size={12} color={colors.primary} />
            <Text style={[sr.stepsText, { color: colors.primary, fontFamily: "Inter_500Medium" }]}>
              {stepsOpen ? "Hide steps" : `Show ${spec.steps!.length} steps`}
            </Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          onPress={() => { Haptics.selectionAsync(); setExpanded((e) => !e); }}
          style={[sr.doneBtn, { borderColor: "#86efac" }]}
          activeOpacity={0.7}
        >
          <Feather name="check" size={12} color="#16a34a" />
          <Text style={[sr.doneBtnText, { color: "#16a34a", fontFamily: "Inter_600SemiBold" }]}>Done</Text>
        </TouchableOpacity>
      </View>

      {stepsOpen && (spec.steps?.length ?? 0) > 0 && (
        <View style={{ gap: 4, marginTop: 4 }}>
          {spec.steps!.map((step, i) => (
            <View key={i} style={{ flexDirection: "row", gap: 6 }}>
              <Text style={[sr.stepNum, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>{i + 1}.</Text>
              <Text style={[sr.stepText, { color: colors.foreground, fontFamily: "Inter_400Regular" }]}>{step}</Text>
            </View>
          ))}
          {spec.toolsNeeded && (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 5, marginTop: 4 }}>
              <Text style={[sr.toolsLabel, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>Tools:</Text>
              {spec.toolsNeeded.map((t) => (
                <View key={t} style={[sr.toolChip, { backgroundColor: colors.muted }]}>
                  <Text style={[sr.toolText, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>{t}</Text>
                </View>
              ))}
            </View>
          )}
          {spec.safetyNotes && (
            <View style={[sr.safetyBox, { backgroundColor: "#fffbeb", borderColor: "#fde68a" }]}>
              <Text style={[sr.safetyText, { color: "#92400e", fontFamily: "Inter_400Regular" }]}>⚠️ {spec.safetyNotes}</Text>
            </View>
          )}
        </View>
      )}

      {expanded && (
        <CompletionForm
          isDiyDefault={spec.isDiy}
          titleHint={spec.title}
          onDone={(payload) => onMarkDone(assetId, spec, payload)}
          onCancel={() => setExpanded(false)}
          colors={colors}
        />
      )}
    </View>
  );
}

const sr = StyleSheet.create({
  card: { borderRadius: 10, borderWidth: 1, padding: 10, gap: 6 },
  cardTop: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  title: { fontSize: 13, lineHeight: 18 },
  meta: { fontSize: 11, marginTop: 2 },
  priorityBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 99 },
  priorityText: { fontSize: 9, textTransform: "uppercase" },
  typeBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 99 },
  typeText: { fontSize: 9 },
  dueRow: { flexDirection: "row", alignItems: "flex-start", gap: 5, borderRadius: 6, borderWidth: 1, paddingHorizontal: 7, paddingVertical: 5 },
  dueMeta: { fontSize: 11, flex: 1, lineHeight: 16 },
  desc: { fontSize: 12, lineHeight: 17 },
  actions: { flexDirection: "row", alignItems: "center", gap: 8 },
  stepsLink: { flexDirection: "row", alignItems: "center", gap: 3 },
  stepsText: { fontSize: 12 },
  doneBtn: { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 6, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 5, marginLeft: "auto" },
  doneBtnText: { fontSize: 11 },
  stepNum: { fontSize: 12, width: 14 },
  stepText: { fontSize: 12, lineHeight: 17, flex: 1 },
  toolsLabel: { fontSize: 10 },
  toolChip: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  toolText: { fontSize: 10 },
  safetyBox: { borderRadius: 6, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 6 },
  safetyText: { fontSize: 11, lineHeight: 16 },
  donePill: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 8, borderWidth: 1, padding: 10 },
  doneTitle: { fontSize: 13 },
  doneSub: { fontSize: 11, marginTop: 1 },
  doneBadge: { fontSize: 10 },
});

// ── Main Modal ────────────────────────────────────────────────────────────────
export function HealthScoreModal({
  visible,
  onClose,
  healthScore,
  healthGrade,
  overdueTaskCount,
  overdueTasks = [],
  assetScores = [],
  propertyId,
}: Props) {
  const colors = useColors();
  const router = useRouter();
  const { getToken } = useAuth();
  const qc = useQueryClient();

  const gradeColor = GRADE_COLOR[healthGrade] ?? "#c8853a";
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  const base = domain ? `https://${domain}` : "";

  // Check subscription to decide locked state
  const { data: subscription, isLoading: subLoading } = useQuery({
    queryKey: ["subscription"],
    queryFn: async () => {
      const token = await getToken();
      const res = await fetch(`${base}/api/subscription`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to load subscription");
      return res.json() as Promise<{ tier: string }>;
    },
    staleTime: 5 * 60 * 1000,
    enabled: visible,
  });

  const tierRank: Record<string, number> = { essential: 0, basic: 1, managed: 2, concierge: 3 };
  const locked = !subLoading && (tierRank[subscription?.tier ?? "essential"] ?? 0) < 1;

  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());
  const [completedSpecKeys, setCompletedSpecKeys] = useState<Set<string>>(new Set());

  const remainingOverdue = overdueTaskCount - completedIds.size;
  const potentialGain = Math.min(overdueTaskCount * 15, 100);
  const potentialScore = Math.min(healthScore + potentialGain, 100);

  function invalidateAll() {
    qc.invalidateQueries({ queryKey: ["property-summary", propertyId] });
    qc.invalidateQueries({ predicate: (q) => q.queryKey.includes(propertyId) });
    qc.invalidateQueries({
      predicate: (q) =>
        q.queryKey.some(
          (k) => typeof k === "string" && (k.includes("inbox") || k.includes("ledger") || k.includes("summary"))
        ),
    });
  }

  async function handleMarkDone(taskId: string, payload: CompletePayload) {
    const token = await getToken();
    const res = await fetch(`${base}/api/maintenance/${taskId}/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      Alert.alert("Error", "Could not mark task as done. Please try again.");
      return;
    }
    setCompletedIds((prev) => new Set([...prev, taskId]));
    invalidateAll();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }

  async function handleMarkSpecDone(assetId: string, spec: MaintenanceSpec, payload: CompletePayload) {
    const token = await getToken();
    // Step 1: create task
    const createRes = await fetch(`${base}/api/assets/${assetId}/maintenance`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        title: spec.title,
        description: spec.description,
        intervalDays: spec.intervalDays,
        isDiy: spec.isDiy,
        nextDueDate: new Date().toLocaleDateString("en-CA"),
      }),
    });
    if (!createRes.ok) {
      Alert.alert("Error", "Could not create task. Please try again.");
      return;
    }
    const task = await createRes.json();

    // Step 2: complete it
    const completeRes = await fetch(`${base}/api/maintenance/${task.id}/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload),
    });
    if (!completeRes.ok) {
      Alert.alert("Error", "Task created but could not be marked complete.");
      return;
    }
    setCompletedSpecKeys((prev) => new Set([...prev, `${assetId}:${spec.title}`]));
    invalidateAll();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }

  // Build spec recommendations from assetScores
  const recommendedByAsset = assetScores
    .slice()
    .sort((a, b) => a.score - b.score)
    .flatMap((asset) =>
      getSpecsForCategory(asset.category)
        .filter((s) => s.isDiy)
        .slice(0, 2)
        .map((spec) => ({ spec, asset }))
    )
    .slice(0, 10);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1, backgroundColor: colors.background }}>
        {/* ── Header ── */}
        <View style={[m.header, { borderBottomColor: colors.border, backgroundColor: colors.background }]}>
          <View style={m.headerTop}>
            <Text style={[m.title, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
              Your Home Improvement Plan
            </Text>
            <TouchableOpacity onPress={onClose} style={m.closeBtn} activeOpacity={0.7}>
              <Feather name="x" size={20} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>

          {/* Grade badge */}
          <View style={[m.gradeBadge, { backgroundColor: gradeColor + "18", borderColor: gradeColor + "40" }]}>
            <Feather name="trending-up" size={13} color={gradeColor} />
            <Text style={[m.gradeText, { color: gradeColor, fontFamily: "Inter_700Bold" }]}>
              Grade {healthGrade} · {healthScore}/100
            </Text>
          </View>

          {/* Potential score banner */}
          {overdueTaskCount > 0 && completedIds.size < overdueTaskCount && (
            <View style={[m.banner, { backgroundColor: colors.primary + "0f", borderColor: colors.primary + "30" }]}>
              <Feather name="trending-up" size={14} color={colors.primary} />
              <Text style={[m.bannerText, { color: colors.foreground, fontFamily: "Inter_400Regular" }]}>
                Fix {remainingOverdue} remaining task{remainingOverdue !== 1 ? "s" : ""} to reach{" "}
                <Text style={{ fontFamily: "Inter_700Bold", color: colors.primary }}>{potentialScore}/100</Text>
              </Text>
            </View>
          )}
          {completedIds.size > 0 && completedIds.size >= overdueTaskCount && (
            <View style={[m.banner, { backgroundColor: "#f0fdf4", borderColor: "#bbf7d0" }]}>
              <Feather name="check-circle" size={14} color="#16a34a" />
              <Text style={[m.bannerText, { color: "#15803d", fontFamily: "Inter_500Medium" }]}>
                All overdue tasks complete — great work! Your score is updating.
              </Text>
            </View>
          )}
        </View>

        {/* ── Body ── */}
        {subLoading ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <ActivityIndicator color={colors.primary} size="large" />
          </View>
        ) : locked ? (
          /* ── Locked state ── */
          <View style={{ flex: 1, justifyContent: "center", paddingHorizontal: 28 }}>
            {/* Blurred preview hint */}
            <View style={{ opacity: 0.18, marginBottom: 24, gap: 8, pointerEvents: "none" }}>
              {[1, 2, 3].map((i) => (
                <View key={i} style={[m.blurRow, { backgroundColor: "#dc2626", borderColor: "#fecaca" }]} />
              ))}
              <View style={[m.blurRow, { height: 60, backgroundColor: colors.card, borderColor: colors.border }]} />
              <View style={[m.blurRow, { height: 60, backgroundColor: colors.card, borderColor: colors.border }]} />
            </View>

            {/* Upgrade card */}
            <View style={[m.upgradeCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={[m.lockIconWrap, { backgroundColor: colors.primary + "15" }]}>
                <Feather name="lock" size={28} color={colors.primary} />
              </View>
              <Text style={[m.upgradeTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
                Unlock Your Home Improvement Plan
              </Text>
              <Text style={[m.upgradeDesc, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                See overdue tasks, manufacturer-recommended maintenance, and a personalized action plan to protect your home's value.
              </Text>

              <View style={m.featureRow}>
                {[
                  { icon: "clock" as const, label: "Overdue task alerts" },
                  { icon: "clipboard" as const, label: "Manufacturer specs" },
                  { icon: "shield" as const, label: "Score tips" },
                ].map(({ icon, label }) => (
                  <View key={label} style={[m.featureItem, { backgroundColor: colors.muted }]}>
                    <Feather name={icon} size={15} color={colors.primary} />
                    <Text style={[m.featureLabel, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>{label}</Text>
                  </View>
                ))}
              </View>

              <TouchableOpacity
                onPress={() => { onClose(); router.push("/upgrade"); }}
                style={[m.upgradeBtn, { backgroundColor: colors.primary }]}
                activeOpacity={0.8}
              >
                <Feather name="star" size={15} color="#fff" />
                <Text style={[m.upgradeBtnText, { fontFamily: "Inter_600SemiBold" }]}>Upgrade to Basic — $9.99/mo</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={onClose} activeOpacity={0.7} style={{ marginTop: 4 }}>
                <Text style={[m.maybeLater, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>Maybe later</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <>
            <ScrollView
              contentContainerStyle={{ padding: 16, paddingBottom: 8, gap: 20 }}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {/* Section 1: Overdue tasks */}
              {overdueTaskCount > 0 && (
                <View style={{ gap: 8 }}>
                  <View style={m.sectionHeader}>
                    <Feather name="clock" size={14} color="#dc2626" />
                    <Text style={[m.sectionTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>Fix First — Overdue Tasks</Text>
                    <View style={[m.countBadge, { backgroundColor: "#dc2626" }]}>
                      <Text style={[m.countText, { fontFamily: "Inter_700Bold" }]}>{remainingOverdue} remaining</Text>
                    </View>
                  </View>
                  {overdueTasks.map((t) => (
                    <OverdueTaskRow
                      key={t.id}
                      task={t}
                      done={completedIds.has(t.id)}
                      onMarkDone={handleMarkDone}
                      colors={colors}
                    />
                  ))}
                </View>
              )}

              {/* Divider */}
              {overdueTaskCount > 0 && recommendedByAsset.length > 0 && (
                <View style={[m.divider, { backgroundColor: colors.border }]} />
              )}

              {/* Section 2: Manufacturer spec recommendations */}
              {recommendedByAsset.length > 0 && (
                <View style={{ gap: 8 }}>
                  <View style={m.sectionHeader}>
                    <Feather name="tool" size={14} color={colors.primary} />
                    <Text style={[m.sectionTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>Recommended by Manufacturers</Text>
                    <View style={[m.diyBadge, { backgroundColor: colors.muted }]}>
                      <Text style={[m.diyText, { color: colors.mutedForeground, fontFamily: "Inter_700Bold" }]}>DIY First</Text>
                    </View>
                  </View>
                  <Text style={[m.sectionDesc, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                    These tasks come from manufacturer maintenance specs for your tracked assets. Completing them adds a service record and starts the recurring schedule.
                  </Text>
                  {recommendedByAsset.map(({ spec, asset }, i) => (
                    <SpecRow
                      key={`${asset.assetId}-${i}`}
                      spec={spec}
                      assetId={asset.assetId}
                      assetName={asset.assetName}
                      done={completedSpecKeys.has(`${asset.assetId}:${spec.title}`)}
                      onMarkDone={handleMarkSpecDone}
                      colors={colors}
                    />
                  ))}
                </View>
              )}

              {overdueTaskCount === 0 && recommendedByAsset.length === 0 && (
                <View style={{ alignItems: "center", paddingVertical: 48, gap: 10 }}>
                  <Feather name="check-circle" size={44} color="#16a34a" style={{ opacity: 0.6 }} />
                  <Text style={[{ color: colors.foreground, fontFamily: "Inter_600SemiBold", fontSize: 16 }]}>Great shape!</Text>
                  <Text style={[{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 13, textAlign: "center", lineHeight: 19 }]}>
                    No immediate action needed. Check back after adding more assets or maintenance schedules.
                  </Text>
                </View>
              )}
            </ScrollView>

            {/* Footer */}
            <View style={[m.footer, { borderTopColor: colors.border, backgroundColor: colors.muted + "50" }]}>
              <Text style={[m.footerText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                Completing tasks builds your home's documented history.
              </Text>
              <TouchableOpacity onPress={onClose} style={[m.closeFooterBtn, { borderColor: colors.border, backgroundColor: colors.card }]} activeOpacity={0.7}>
                <Text style={[m.closeFooterText, { color: colors.foreground, fontFamily: "Inter_500Medium" }]}>Close</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </KeyboardAvoidingView>
    </Modal>
  );
}

const m = StyleSheet.create({
  header: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 14, borderBottomWidth: StyleSheet.hairlineWidth, gap: 10 },
  headerTop: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" },
  title: { fontSize: 17, flex: 1, paddingRight: 8, lineHeight: 23 },
  closeBtn: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  gradeBadge: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", borderRadius: 99, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 5 },
  gradeText: { fontSize: 13 },
  banner: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 10, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 8 },
  bannerText: { fontSize: 13, flex: 1, lineHeight: 18 },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 7 },
  sectionTitle: { fontSize: 13, flex: 1 },
  countBadge: { borderRadius: 99, paddingHorizontal: 7, paddingVertical: 3 },
  countText: { color: "#fff", fontSize: 10 },
  diyBadge: { borderRadius: 99, paddingHorizontal: 7, paddingVertical: 3 },
  diyText: { fontSize: 10 },
  sectionDesc: { fontSize: 12, lineHeight: 17 },
  divider: { height: StyleSheet.hairlineWidth },
  footer: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, borderTopWidth: 1, paddingHorizontal: 16, paddingVertical: 12 },
  footerText: { fontSize: 12, flex: 1, lineHeight: 17 },
  closeFooterBtn: { borderRadius: 8, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 8 },
  closeFooterText: { fontSize: 13 },
  blurRow: { height: 40, borderRadius: 8, borderWidth: 1 },
  upgradeCard: { borderRadius: 18, borderWidth: 1, padding: 22, alignItems: "center", gap: 12 },
  lockIconWrap: { width: 64, height: 64, borderRadius: 32, alignItems: "center", justifyContent: "center" },
  upgradeTitle: { fontSize: 17, textAlign: "center" },
  upgradeDesc: { fontSize: 13, textAlign: "center", lineHeight: 19 },
  featureRow: { flexDirection: "row", gap: 8, width: "100%" },
  featureItem: { flex: 1, alignItems: "center", gap: 6, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 6 },
  featureLabel: { fontSize: 11, textAlign: "center", lineHeight: 15 },
  upgradeBtn: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 12, paddingVertical: 13, paddingHorizontal: 20, width: "100%", justifyContent: "center" },
  upgradeBtnText: { color: "#fff", fontSize: 15 },
  maybeLater: { fontSize: 13, textAlign: "center" },
});
