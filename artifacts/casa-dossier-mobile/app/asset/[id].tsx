import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Platform,
  ActivityIndicator,
  Modal,
  TextInput,
  Alert,
  KeyboardAvoidingView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetAsset,
  useListServiceRecords,
  useListMaintenanceTasks,
  useCreateServiceRecord,
  getListServiceRecordsQueryKey,
  getListMaintenanceTasksQueryKey,
  getGetAssetQueryKey,
} from "@workspace/api-client-react";
import { useAuth } from "@clerk/expo";
import { useColors } from "@/hooks/useColors";
import { CATEGORY_CONFIG, calcAssetScore, gradeFromScore } from "@/components/AssetCard";
import { format, differenceInCalendarDays } from "date-fns";
import * as Haptics from "expo-haptics";

// ── Types ──────────────────────────────────────────────────────────────────────
type Asset = {
  id: string;
  propertyId: string;
  name: string;
  category: string;
  brand?: string;
  model?: string;
  serialNumber?: string;
  installDate?: string;
  warrantyExpiry?: string;
  status: string;
  notes?: string;
  replacementCost?: number;
  createdAt: string;
};

type MaintenanceTask = {
  id: string;
  assetId: string;
  title: string;
  description?: string;
  intervalDays: number;
  nextDueDate: string;
  completedAt?: string;
  isDiy: boolean;
  estimatedCost?: number;
  createdAt: string;
};

type ServiceRecord = {
  id: string;
  assetId: string;
  date: string;
  technicianName?: string;
  companyName?: string;
  description: string;
  cost?: number;
  createdAt: string;
};

// ── Category normaliser ────────────────────────────────────────────────────────
function normCategory(cat: string): string {
  const map: Record<string, string> = {
    hvac: "HVAC", plumbing: "Plumbing", electrical: "Electrical",
    roof: "Roof", roofing: "Roof", appliance: "Appliance", appliances: "Appliance",
    structural: "Structural", other: "Other",
  };
  return map[cat?.toLowerCase()] ?? cat;
}

// ── Large Radial Gauge ─────────────────────────────────────────────────────────
function LargeRadialGauge({ score }: { score: number }) {
  const { grade, color } = gradeFromScore(score);
  const labels: Record<string, string> = { A: "Excellent", B: "Good", C: "Fair", D: "Poor", F: "Critical" };
  const radius = 52, strokeW = 7;
  const circ = 2 * Math.PI * radius;
  const dash = (score / 100) * circ;
  const { Svg, Circle } = require("react-native-svg");

  return (
    <View style={gaugeStyles.wrap}>
      <Svg width={122} height={122} style={{ transform: [{ rotate: "-90deg" }] }}>
        <Circle cx={61} cy={61} r={radius} fill="none" stroke={color + "25"} strokeWidth={strokeW} />
        <Circle cx={61} cy={61} r={radius} fill="none" stroke={color} strokeWidth={strokeW}
          strokeLinecap="round" strokeDasharray={`${dash} ${circ}`} />
      </Svg>
      <View style={[StyleSheet.absoluteFill, gaugeStyles.center]}>
        <Text style={[gaugeStyles.grade, { color, fontFamily: "Inter_700Bold" }]}>{grade}</Text>
        <Text style={[gaugeStyles.score, { color, fontFamily: "Inter_700Bold" }]}>{score}</Text>
        <Text style={[gaugeStyles.label, { color: "#9CA3AF", fontFamily: "Inter_400Regular" }]}>
          {labels[grade] ?? ""}
        </Text>
      </View>
    </View>
  );
}

const gaugeStyles = StyleSheet.create({
  wrap: { width: 122, height: 122, alignSelf: "center" },
  center: { alignItems: "center", justifyContent: "center", gap: 1 },
  grade: { fontSize: 28, lineHeight: 30 },
  score: { fontSize: 14, lineHeight: 16 },
  label: { fontSize: 10 },
});

// ── Life-used bar ──────────────────────────────────────────────────────────────
function LifeBar({ installDate, category, colors }: { installDate?: string | null; category: string; colors: ReturnType<typeof useColors> }) {
  if (!installDate) return null;
  const cat = normCategory(category);
  const cfg = CATEGORY_CONFIG[cat] ?? CATEGORY_CONFIG.Other!;
  const ageYears = (Date.now() - new Date(installDate).getTime()) / (365.25 * 24 * 3600 * 1000);
  const pct = Math.min(Math.round((ageYears / cfg.lifespan) * 100), 100);
  const barColor = pct >= 80 ? "#ef4444" : pct >= 60 ? "#f59e0b" : "#22c55e";

  return (
    <View style={lifeStyles.wrap}>
      <View style={lifeStyles.row}>
        <Text style={[lifeStyles.label, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>Life used</Text>
        <Text style={[lifeStyles.pct, { color: barColor, fontFamily: "Inter_700Bold" }]}>{pct}%</Text>
      </View>
      <View style={[lifeStyles.track, { backgroundColor: colors.muted }]}>
        <View style={[lifeStyles.fill, { width: `${pct}%`, backgroundColor: barColor }]} />
      </View>
      <Text style={[lifeStyles.sub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
        ~{Math.round(ageYears)} yr old · {cfg.lifespan} yr expected lifespan
      </Text>
    </View>
  );
}

const lifeStyles = StyleSheet.create({
  wrap: { gap: 5 },
  row: { flexDirection: "row", justifyContent: "space-between" },
  label: { fontSize: 12 },
  pct: { fontSize: 12 },
  track: { height: 6, borderRadius: 3, overflow: "hidden" },
  fill: { height: 6, borderRadius: 3 },
  sub: { fontSize: 10 },
});

// ── Section header ─────────────────────────────────────────────────────────────
function SectionHeader({ title, icon, colors }: { title: string; icon: keyof typeof Feather.glyphMap; colors: ReturnType<typeof useColors> }) {
  return (
    <View style={secStyles.row}>
      <Feather name={icon} size={13} color={colors.mutedForeground} />
      <Text style={[secStyles.title, { color: colors.mutedForeground, fontFamily: "Inter_700Bold" }]}>
        {title.toUpperCase()}
      </Text>
    </View>
  );
}
const secStyles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 12 },
  title: { fontSize: 11, letterSpacing: 0.8 },
});

// ── Spec row ──────────────────────────────────────────────────────────────────
function SpecRow({ label, value, mono, colors }: { label: string; value: string; mono?: boolean; colors: ReturnType<typeof useColors> }) {
  return (
    <View style={[specStyles.row, { borderBottomColor: colors.border }]}>
      <Text style={[specStyles.label, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>{label}</Text>
      <Text style={[specStyles.value, { color: colors.foreground, fontFamily: mono ? "Inter_400Regular" : "Inter_500Medium", fontVariant: mono ? ["tabular-nums"] : undefined }]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}
const specStyles = StyleSheet.create({
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, gap: 12 },
  label: { fontSize: 13 },
  value: { fontSize: 13, flexShrink: 1, textAlign: "right" },
});

// ── Task row ──────────────────────────────────────────────────────────────────
function TaskRow({ task, assetId, colors, onMarkDone }: { task: MaintenanceTask; assetId: string; colors: ReturnType<typeof useColors>; onMarkDone: (task: MaintenanceTask) => void }) {
  const diff = differenceInCalendarDays(new Date(task.nextDueDate), new Date());
  const isOverdue = diff < 0;
  const isSoon = diff >= 0 && diff <= 14;

  const dueLabelColor = isOverdue ? colors.destructive : isSoon ? "#d97706" : colors.mutedForeground;
  const dueLabel = isOverdue
    ? `${Math.abs(diff)}d overdue`
    : diff === 0 ? "Due today"
    : diff === 1 ? "Due tomorrow"
    : `Due ${format(new Date(task.nextDueDate), "MMM d, yyyy")}`;

  return (
    <View style={[
      taskStyles.wrap,
      {
        borderColor: isOverdue ? colors.destructive + "33" : colors.border,
        backgroundColor: isOverdue ? colors.destructive + "06" : colors.card,
      },
    ]}>
      <View style={taskStyles.left}>
        <Text style={[taskStyles.title, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]} numberOfLines={1}>
          {task.title}
        </Text>
        {task.description ? (
          <Text style={[taskStyles.desc, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]} numberOfLines={2}>
            {task.description}
          </Text>
        ) : null}
        <View style={taskStyles.metaRow}>
          <Feather name={isOverdue ? "alert-circle" : "clock"} size={11} color={dueLabelColor} />
          <Text style={[taskStyles.due, { color: dueLabelColor, fontFamily: "Inter_500Medium" }]}>{dueLabel}</Text>
          {task.intervalDays ? (
            <Text style={[taskStyles.interval, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              · every {task.intervalDays}d
            </Text>
          ) : null}
          {task.isDiy ? (
            <View style={[taskStyles.badge, { backgroundColor: colors.muted }]}>
              <Text style={[taskStyles.badgeText, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>DIY</Text>
            </View>
          ) : null}
        </View>
      </View>
      <TouchableOpacity
        style={taskStyles.doneBtn}
        onPress={() => onMarkDone(task)}
        activeOpacity={0.7}
      >
        <Feather name="check-circle" size={13} color="#059669" />
        <Text style={[taskStyles.doneBtnText, { fontFamily: "Inter_600SemiBold" }]}>Mark Done</Text>
      </TouchableOpacity>
    </View>
  );
}

const taskStyles = StyleSheet.create({
  wrap: { borderRadius: 10, borderWidth: 1, padding: 12, marginBottom: 8, gap: 6 },
  left: { gap: 3 },
  title: { fontSize: 13, lineHeight: 18 },
  desc: { fontSize: 12, lineHeight: 16 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 4, flexWrap: "wrap", marginTop: 2 },
  due: { fontSize: 11 },
  interval: { fontSize: 11 },
  badge: { borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 },
  badgeText: { fontSize: 9 },
  doneBtn: {
    flexDirection: "row", alignItems: "center", gap: 5, alignSelf: "flex-end",
    backgroundColor: "#d1fae5", borderWidth: 1, borderColor: "#6ee7b7",
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8,
  },
  doneBtnText: { fontSize: 12, color: "#059669" },
});

// ── Service record row ─────────────────────────────────────────────────────────
function RecordRow({ record, colors }: { record: ServiceRecord; colors: ReturnType<typeof useColors> }) {
  return (
    <View style={[recordStyles.wrap, { borderLeftColor: colors.primary + "33" }]}>
      <View style={recordStyles.dot} />
      <View style={recordStyles.content}>
        <Text style={[recordStyles.desc, { color: colors.foreground, fontFamily: "Inter_500Medium" }]} numberOfLines={3}>
          {record.description}
        </Text>
        <View style={recordStyles.meta}>
          <Text style={[recordStyles.date, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
            {format(new Date(record.date), "MMM d, yyyy")}
          </Text>
          {record.technicianName && (
            <Text style={[recordStyles.tech, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              · {record.technicianName}
            </Text>
          )}
          {record.companyName && (
            <Text style={[recordStyles.tech, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              {record.technicianName ? ` (${record.companyName})` : `· ${record.companyName}`}
            </Text>
          )}
          {record.cost != null && record.cost > 0 && (
            <Text style={[recordStyles.cost, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>
              · ${record.cost.toLocaleString()}
            </Text>
          )}
        </View>
      </View>
    </View>
  );
}

const recordStyles = StyleSheet.create({
  wrap: { flexDirection: "row", gap: 12, paddingVertical: 10, borderLeftWidth: 2, paddingLeft: 12, marginBottom: 2 },
  dot: { position: "absolute", left: -5, top: 14, width: 8, height: 8, borderRadius: 4, backgroundColor: "#0F1629" },
  content: { flex: 1, gap: 4 },
  desc: { fontSize: 13, lineHeight: 18 },
  meta: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 2 },
  date: { fontSize: 11 },
  tech: { fontSize: 11 },
  cost: { fontSize: 11 },
});

// ── Mark Complete Modal ────────────────────────────────────────────────────────
function MarkCompleteModal({
  task, assetId, visible, onClose, onSuccess, colors,
}: {
  task: MaintenanceTask | null; assetId: string; visible: boolean;
  onClose: () => void; onSuccess: () => void; colors: ReturnType<typeof useColors>;
}) {
  const { getToken } = useAuth();
  const [notes, setNotes] = useState("");
  const [cost, setCost] = useState(task?.estimatedCost ? String(Number(task.estimatedCost)) : "");
  const [isDiy, setIsDiy] = useState(task?.isDiy ?? true);
  const [techName, setTechName] = useState(task?.isDiy !== false ? "Homeowner (DIY)" : "");
  const [company, setCompany] = useState("");
  const [busy, setBusy] = useState(false);

  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  const baseUrl = domain ? `https://${domain}` : "";

  async function handleComplete() {
    if (!task) return;
    setBusy(true);
    try {
      const token = await getToken();
      const res = await fetch(`${baseUrl}/api/maintenance/${task.id}/complete`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          notes: notes.trim() || undefined,
          isDiy,
          cost: cost ? parseFloat(cost) : undefined,
          technicianName: techName.trim() || undefined,
          companyName: company.trim() || undefined,
          completedDate: new Date().toLocaleDateString("en-CA"),
        }),
      });
      if (!res.ok) throw new Error("Failed");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onSuccess();
      onClose();
    } catch {
      Alert.alert("Error", "Could not complete task. Please try again.");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setBusy(false);
    }
  }

  if (!task) return null;

  const diff = differenceInCalendarDays(new Date(task.nextDueDate), new Date());
  const isOverdue = diff < 0;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={[modalStyles.root, { backgroundColor: colors.background }]}>
          {/* Header */}
          <View style={[modalStyles.header, { borderBottomColor: colors.border }]}>
            <View style={{ flex: 1, gap: 4 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <View style={[modalStyles.urgencyBadge, {
                  backgroundColor: isOverdue ? colors.destructive + "15" : "#fef3c7",
                }]}>
                  <Feather name={isOverdue ? "alert-circle" : "clock"} size={11} color={isOverdue ? colors.destructive : "#d97706"} />
                  <Text style={[modalStyles.urgencyText, { color: isOverdue ? colors.destructive : "#d97706", fontFamily: "Inter_600SemiBold" }]}>
                    {isOverdue ? `${Math.abs(diff)}d overdue` : diff === 0 ? "Due today" : `Due ${format(new Date(task.nextDueDate), "MMM d")}`}
                  </Text>
                </View>
                {task.isDiy && (
                  <View style={[modalStyles.urgencyBadge, { backgroundColor: colors.muted }]}>
                    <Text style={[modalStyles.urgencyText, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>DIY</Text>
                  </View>
                )}
              </View>
              <Text style={[modalStyles.taskTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
                {task.title}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={modalStyles.closeBtn}>
              <Feather name="x" size={20} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>

          {/* Body */}
          <ScrollView style={{ flex: 1 }} contentContainerStyle={modalStyles.body} keyboardShouldPersistTaps="handled">
            {/* Task description / steps */}
            {task.description ? (
              <View style={{ marginBottom: 20 }}>
                <Text style={[modalStyles.sectionLabel, { color: colors.mutedForeground, fontFamily: "Inter_700Bold" }]}>
                  HOW TO DO IT
                </Text>
                <Text style={[modalStyles.stepsText, { color: colors.foreground, fontFamily: "Inter_400Regular" }]}>
                  {task.description}
                </Text>
              </View>
            ) : null}

            <View style={[modalStyles.divider, { backgroundColor: colors.border }]} />

            {/* Completion form */}
            <Text style={[modalStyles.sectionLabel, { color: colors.mutedForeground, fontFamily: "Inter_700Bold", marginTop: 20 }]}>
              MARK AS COMPLETE
            </Text>

            {/* Notes */}
            <Text style={[modalStyles.fieldLabel, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>Notes (optional)</Text>
            <TextInput
              style={[modalStyles.textArea, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.card, fontFamily: "Inter_400Regular" }]}
              value={notes}
              onChangeText={setNotes}
              placeholder={`e.g. Completed ${task.title.toLowerCase()}. All good.`}
              placeholderTextColor={colors.mutedForeground}
              multiline
              numberOfLines={3}
            />

            {/* Cost */}
            <Text style={[modalStyles.fieldLabel, { color: colors.foreground, fontFamily: "Inter_600SemiBold", marginTop: 14 }]}>Actual Cost (optional)</Text>
            <TextInput
              style={[modalStyles.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.card, fontFamily: "Inter_400Regular" }]}
              value={cost}
              onChangeText={setCost}
              placeholder="0.00"
              placeholderTextColor={colors.mutedForeground}
              keyboardType="decimal-pad"
            />

            {/* DIY / Pro toggle */}
            <Text style={[modalStyles.fieldLabel, { color: colors.foreground, fontFamily: "Inter_600SemiBold", marginTop: 14 }]}>Who did the work?</Text>
            <View style={modalStyles.toggleRow}>
              <TouchableOpacity
                style={[modalStyles.toggle, isDiy ? { backgroundColor: colors.primary } : { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }]}
                onPress={() => { setIsDiy(true); setTechName("Homeowner (DIY)"); }}
              >
                <Feather name="tool" size={14} color={isDiy ? colors.primaryForeground : colors.foreground} />
                <Text style={[modalStyles.toggleText, { color: isDiy ? colors.primaryForeground : colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
                  I did it myself
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[modalStyles.toggle, !isDiy ? { backgroundColor: colors.primary } : { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }]}
                onPress={() => { setIsDiy(false); setTechName(""); }}
              >
                <Feather name="user-check" size={14} color={!isDiy ? colors.primaryForeground : colors.foreground} />
                <Text style={[modalStyles.toggleText, { color: !isDiy ? colors.primaryForeground : colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
                  Hired a pro
                </Text>
              </TouchableOpacity>
            </View>

            {/* Pro fields */}
            {!isDiy && (
              <View style={{ gap: 10, marginTop: 10 }}>
                <View>
                  <Text style={[modalStyles.fieldLabel, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>Technician Name</Text>
                  <TextInput
                    style={[modalStyles.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.card, fontFamily: "Inter_400Regular" }]}
                    value={techName} onChangeText={setTechName}
                    placeholder="Name" placeholderTextColor={colors.mutedForeground}
                  />
                </View>
                <View>
                  <Text style={[modalStyles.fieldLabel, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>Company</Text>
                  <TextInput
                    style={[modalStyles.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.card, fontFamily: "Inter_400Regular" }]}
                    value={company} onChangeText={setCompany}
                    placeholder="Company name" placeholderTextColor={colors.mutedForeground}
                  />
                </View>
              </View>
            )}
          </ScrollView>

          {/* Footer */}
          <View style={[modalStyles.footer, { borderTopColor: colors.border, backgroundColor: colors.background }]}>
            <TouchableOpacity
              style={[modalStyles.cancelBtn, { borderColor: colors.border }]}
              onPress={onClose} disabled={busy}
            >
              <Text style={[{ fontSize: 14, fontFamily: "Inter_600SemiBold" }, { color: colors.foreground }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[modalStyles.completeBtn, { opacity: busy ? 0.6 : 1 }]}
              onPress={handleComplete} disabled={busy} activeOpacity={0.8}
            >
              {busy
                ? <ActivityIndicator size="small" color="#fff" />
                : <><Feather name="check-circle" size={15} color="#fff" />
                  <Text style={[{ fontSize: 14, color: "#fff", fontFamily: "Inter_600SemiBold" }]}>Mark Complete</Text></>
              }
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const modalStyles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: "row", alignItems: "flex-start", gap: 12, padding: 20, borderBottomWidth: 1 },
  urgencyBadge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 99 },
  urgencyText: { fontSize: 11 },
  taskTitle: { fontSize: 17, lineHeight: 22 },
  closeBtn: { padding: 4, marginTop: 2 },
  body: { padding: 20, paddingBottom: 8 },
  sectionLabel: { fontSize: 11, letterSpacing: 0.8, marginBottom: 10 },
  stepsText: { fontSize: 14, lineHeight: 22 },
  divider: { height: 1 },
  fieldLabel: { fontSize: 13, marginBottom: 6 },
  textArea: {
    borderWidth: 1, borderRadius: 10, padding: 12,
    fontSize: 14, minHeight: 80, textAlignVertical: "top",
  },
  input: { borderWidth: 1, borderRadius: 10, padding: 12, fontSize: 14, height: 44 },
  toggleRow: { flexDirection: "row", gap: 10 },
  toggle: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 11, borderRadius: 10 },
  toggleText: { fontSize: 13 },
  footer: { flexDirection: "row", gap: 10, padding: 16, paddingBottom: 32, borderTopWidth: 1 },
  cancelBtn: { flex: 1, alignItems: "center", justifyContent: "center", height: 46, borderRadius: 12, borderWidth: 1 },
  completeBtn: { flex: 2, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, height: 46, borderRadius: 12, backgroundColor: "#059669" },
});

// ── Log Service Record form ────────────────────────────────────────────────────
function LogServiceForm({ assetId, colors, onSuccess }: { assetId: string; colors: ReturnType<typeof useColors>; onSuccess: () => void }) {
  const [open, setOpen] = useState(false);
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(new Date().toLocaleDateString("en-CA"));
  const [isDiy, setIsDiy] = useState(true);
  const [techName, setTechName] = useState("Homeowner (DIY)");
  const [company, setCompany] = useState("");
  const [cost, setCost] = useState("");

  const { mutate, isPending } = useCreateServiceRecord();

  function reset() {
    setDescription(""); setDate(new Date().toLocaleDateString("en-CA"));
    setIsDiy(true); setTechName("Homeowner (DIY)"); setCompany(""); setCost("");
  }

  function submit() {
    if (!description.trim()) {
      Alert.alert("Required", "Please describe what was done.");
      return;
    }
    mutate({
      assetId,
      data: {
        description: description.trim(),
        date,
        technicianName: techName.trim() || undefined,
        companyName: company.trim() || undefined,
        cost: cost ? parseFloat(cost) : undefined,
      },
    }, {
      onSuccess: () => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        reset(); setOpen(false); onSuccess();
      },
      onError: () => Alert.alert("Error", "Could not save record."),
    });
  }

  if (!open) {
    return (
      <TouchableOpacity
        style={[logStyles.trigger, { borderColor: colors.primary + "50", backgroundColor: colors.card }]}
        onPress={() => setOpen(true)}
      >
        <View style={[logStyles.triggerIcon, { borderColor: colors.primary + "50" }]}>
          <Feather name="plus" size={14} color={colors.primary} />
        </View>
        <Text style={[logStyles.triggerText, { color: colors.primary, fontFamily: "Inter_600SemiBold" }]}>
          Log Service Record
        </Text>
      </TouchableOpacity>
    );
  }

  return (
    <View style={[logStyles.form, { borderColor: colors.primary + "30", backgroundColor: colors.card }]}>
      <View style={[logStyles.formHeader, { borderBottomColor: colors.primary + "20", backgroundColor: colors.primary + "08" }]}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Feather name="file-text" size={14} color={colors.primary} />
          <Text style={[logStyles.formTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>New Service Record</Text>
        </View>
        <TouchableOpacity onPress={() => { setOpen(false); reset(); }}>
          <Feather name="x" size={16} color={colors.mutedForeground} />
        </TouchableOpacity>
      </View>
      <View style={logStyles.formBody}>
        <Text style={[logStyles.label, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
          What was done? <Text style={{ color: colors.destructive }}>*</Text>
        </Text>
        <TextInput
          style={[logStyles.textArea, { borderColor: colors.border, color: colors.foreground, fontFamily: "Inter_400Regular", backgroundColor: colors.background }]}
          value={description} onChangeText={setDescription}
          placeholder="e.g. Annual HVAC tune-up. Cleaned coils, replaced filter."
          placeholderTextColor={colors.mutedForeground}
          multiline numberOfLines={3}
        />

        <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
          <View style={{ flex: 1 }}>
            <Text style={[logStyles.label, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>Date</Text>
            <TextInput
              style={[logStyles.input, { borderColor: colors.border, color: colors.foreground, fontFamily: "Inter_400Regular", backgroundColor: colors.background }]}
              value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" placeholderTextColor={colors.mutedForeground}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[logStyles.label, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>Cost ($)</Text>
            <TextInput
              style={[logStyles.input, { borderColor: colors.border, color: colors.foreground, fontFamily: "Inter_400Regular", backgroundColor: colors.background }]}
              value={cost} onChangeText={setCost} placeholder="0.00"
              placeholderTextColor={colors.mutedForeground} keyboardType="decimal-pad"
            />
          </View>
        </View>

        {/* DIY / Pro toggle */}
        <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
          {[true, false].map((diy) => (
            <TouchableOpacity
              key={String(diy)}
              style={[
                logStyles.toggle,
                isDiy === diy
                  ? { backgroundColor: colors.primary }
                  : { borderColor: colors.border, borderWidth: 1, backgroundColor: colors.background },
              ]}
              onPress={() => { setIsDiy(diy); setTechName(diy ? "Homeowner (DIY)" : ""); }}
            >
              <Feather name={diy ? "tool" : "user-check"} size={12} color={isDiy === diy ? colors.primaryForeground : colors.foreground} />
              <Text style={[{ fontSize: 12, fontFamily: "Inter_600SemiBold" }, { color: isDiy === diy ? colors.primaryForeground : colors.foreground }]}>
                {diy ? "DIY" : "Hire a Pro"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {!isDiy && (
          <View style={{ flexDirection: "row", gap: 10, marginTop: 10 }}>
            <TextInput
              style={[logStyles.input, { flex: 1, borderColor: colors.border, color: colors.foreground, fontFamily: "Inter_400Regular", backgroundColor: colors.background }]}
              value={techName} onChangeText={setTechName} placeholder="Technician" placeholderTextColor={colors.mutedForeground}
            />
            <TextInput
              style={[logStyles.input, { flex: 1, borderColor: colors.border, color: colors.foreground, fontFamily: "Inter_400Regular", backgroundColor: colors.background }]}
              value={company} onChangeText={setCompany} placeholder="Company" placeholderTextColor={colors.mutedForeground}
            />
          </View>
        )}

        <View style={{ flexDirection: "row", gap: 8, marginTop: 14 }}>
          <TouchableOpacity
            style={[logStyles.cancelBtn, { borderColor: colors.border }]}
            onPress={() => { setOpen(false); reset(); }} disabled={isPending}
          >
            <Text style={[{ fontSize: 13, fontFamily: "Inter_600SemiBold" }, { color: colors.foreground }]}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[logStyles.saveBtn, { backgroundColor: colors.primary, opacity: isPending ? 0.7 : 1 }]}
            onPress={submit} disabled={isPending} activeOpacity={0.8}
          >
            {isPending
              ? <ActivityIndicator size="small" color={colors.primaryForeground} />
              : <Text style={[{ fontSize: 13, fontFamily: "Inter_600SemiBold" }, { color: colors.primaryForeground }]}>Save Record</Text>
            }
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const logStyles = StyleSheet.create({
  trigger: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 12, borderRadius: 10, borderWidth: 1.5, borderStyle: "dashed", paddingHorizontal: 14 },
  triggerIcon: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderStyle: "dashed", alignItems: "center", justifyContent: "center" },
  triggerText: { fontSize: 14 },
  form: { borderRadius: 12, borderWidth: 1.5, overflow: "hidden" },
  formHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1 },
  formTitle: { fontSize: 14 },
  formBody: { padding: 14 },
  label: { fontSize: 12, marginBottom: 6 },
  textArea: { borderWidth: 1, borderRadius: 8, padding: 10, fontSize: 13, minHeight: 70, textAlignVertical: "top" },
  input: { borderWidth: 1, borderRadius: 8, padding: 10, fontSize: 13, height: 40 },
  toggle: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, paddingVertical: 8, borderRadius: 8 },
  cancelBtn: { flex: 1, alignItems: "center", paddingVertical: 10, borderRadius: 8, borderWidth: 1 },
  saveBtn: { flex: 2, alignItems: "center", paddingVertical: 10, borderRadius: 8 },
});

// ── Edit Asset Modal ────────────────────────────────────────────────────────────
const EDIT_CATEGORIES = ["HVAC", "Plumbing", "Electrical", "Roof", "Appliance", "Structural", "Other"] as const;
type EditCategory = typeof EDIT_CATEGORIES[number];
const EDIT_CATEGORY_EMOJIS: Record<EditCategory, string> = {
  HVAC: "❄️", Plumbing: "🔧", Electrical: "⚡",
  Roof: "🏠", Appliance: "🫙", Structural: "🏗️", Other: "📦",
};

function EditAssetModal({
  asset, visible, onClose, onSaved, colors,
}: {
  asset: Asset | null;
  visible: boolean;
  onClose: () => void;
  onSaved: () => void;
  colors: ReturnType<typeof useColors>;
}) {
  const { getToken } = useAuth();
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  const baseUrl = domain ? `https://${domain}` : "";

  const [name, setName] = useState("");
  const [category, setCategory] = useState<EditCategory>("HVAC");
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [serialNumber, setSerialNumber] = useState("");
  const [installDate, setInstallDate] = useState("");
  const [replacementCost, setReplacementCost] = useState("");
  const [warrantyExpiry, setWarrantyExpiry] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [retireConfirm, setRetireConfirm] = useState(false);

  const isRetired = !!(asset as any)?.retiredAt;

  // Populate form whenever asset changes
  React.useEffect(() => {
    if (!asset) return;
    setName(asset.name ?? "");
    setCategory((asset.category as EditCategory) ?? "HVAC");
    setBrand(asset.brand ?? "");
    setModel(asset.model ?? "");
    setSerialNumber(asset.serialNumber ?? "");
    setInstallDate(asset.installDate ? asset.installDate.substring(0, 7) : "");
    setReplacementCost(asset.replacementCost != null ? String(Number(asset.replacementCost)) : "");
    setWarrantyExpiry(asset.warrantyExpiry ? asset.warrantyExpiry.substring(0, 7) : "");
    setNotes((asset as any).notes ?? "");
  }, [asset?.id, visible]);

  async function patch(body: object) {
    if (!asset) return false;
    setBusy(true);
    try {
      const token = await getToken();
      const res = await fetch(`${baseUrl}/api/assets/${asset.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Failed");
      return true;
    } catch {
      Alert.alert("Error", "Could not save changes. Please try again.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function handleSave() {
    if (!name.trim()) { Alert.alert("Name required", "Please enter an asset name."); return; }
    const ok = await patch({
      name: name.trim(),
      category,
      brand: brand.trim() || null,
      model: model.trim() || null,
      serialNumber: serialNumber.trim() || null,
      installDate: installDate ? `${installDate}-01` : null,
      replacementCost: replacementCost ? parseFloat(replacementCost) : null,
      warrantyExpiry: warrantyExpiry ? `${warrantyExpiry}-01` : null,
      notes: notes.trim() || null,
    });
    if (ok) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onSaved();
      onClose();
    }
  }

  async function handleRetire() {
    const ok = await patch({ retiredAt: new Date().toISOString() });
    if (ok) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onSaved();
      onClose();
    }
  }

  async function handleRestore() {
    const ok = await patch({ retiredAt: null });
    if (ok) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onSaved();
      onClose();
    }
  }

  if (!asset) return null;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={[editStyles.root, { backgroundColor: colors.background }]}>
          {/* Header */}
          <View style={[editStyles.header, { borderBottomColor: colors.border }]}>
            <View style={{ flex: 1 }}>
              <Text style={[editStyles.title, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
                {EDIT_CATEGORY_EMOJIS[category]} {isRetired ? "Retired Asset" : "Edit Asset"}
              </Text>
              <Text style={[editStyles.sub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                {isRetired
                  ? "Restore to active list or update details."
                  : "Changes are saved when you tap Save."}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={editStyles.closeBtn} activeOpacity={0.7}>
              <Feather name="x" size={20} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>

          {/* Retired banner */}
          {isRetired && (
            <View style={[editStyles.retiredBanner, { backgroundColor: "#fffbeb", borderColor: "#fde68a" }]}>
              <Feather name="archive" size={14} color="#d97706" />
              <Text style={[editStyles.retiredText, { color: "#92400e", fontFamily: "Inter_400Regular" }]}>
                Retired — removed from active inventory but service history is preserved.
              </Text>
            </View>
          )}

          {/* Form */}
          <ScrollView
            contentContainerStyle={[editStyles.body, { paddingBottom: 120 }]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Name */}
            <View style={editStyles.field}>
              <Text style={[editStyles.label, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
                Asset Name <Text style={{ color: colors.destructive }}>*</Text>
              </Text>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="e.g. Carrier Central AC Unit"
                placeholderTextColor={colors.mutedForeground}
                style={[editStyles.input, { color: colors.foreground, backgroundColor: colors.card, borderColor: colors.border, fontFamily: "Inter_400Regular" }]}
              />
            </View>

            {/* Category */}
            <View style={editStyles.field}>
              <Text style={[editStyles.label, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>Category</Text>
              <TouchableOpacity
                onPress={() => { Haptics.selectionAsync(); setCategoryOpen((o) => !o); }}
                style={[editStyles.input, editStyles.pickerRow, { backgroundColor: colors.card, borderColor: colors.border }]}
                activeOpacity={0.7}
              >
                <Text style={{ fontSize: 15 }}>{EDIT_CATEGORY_EMOJIS[category]}</Text>
                <Text style={[editStyles.pickerText, { color: colors.foreground, fontFamily: "Inter_400Regular" }]}>{category}</Text>
                <Feather name={categoryOpen ? "chevron-up" : "chevron-down"} size={16} color={colors.mutedForeground} />
              </TouchableOpacity>
              {categoryOpen && (
                <View style={[editStyles.dropdown, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  {EDIT_CATEGORIES.map((c) => (
                    <TouchableOpacity
                      key={c}
                      onPress={() => { Haptics.selectionAsync(); setCategory(c); setCategoryOpen(false); }}
                      style={[editStyles.dropdownItem, { borderBottomColor: colors.border, backgroundColor: c === category ? colors.primary + "12" : "transparent" }]}
                      activeOpacity={0.7}
                    >
                      <Text style={{ fontSize: 16 }}>{EDIT_CATEGORY_EMOJIS[c]}</Text>
                      <Text style={[editStyles.dropdownText, { color: colors.foreground, fontFamily: c === category ? "Inter_600SemiBold" : "Inter_400Regular" }]}>{c}</Text>
                      {c === category && <Feather name="check" size={14} color={colors.primary} />}
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            {/* Brand + Model */}
            <View style={{ flexDirection: "row", gap: 12 }}>
              <View style={[editStyles.field, { flex: 1 }]}>
                <Text style={[editStyles.label, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>Brand / Make</Text>
                <TextInput
                  value={brand}
                  onChangeText={setBrand}
                  placeholder="e.g. Carrier"
                  placeholderTextColor={colors.mutedForeground}
                  style={[editStyles.input, { color: colors.foreground, backgroundColor: colors.card, borderColor: colors.border, fontFamily: "Inter_400Regular" }]}
                />
              </View>
              <View style={[editStyles.field, { flex: 1 }]}>
                <Text style={[editStyles.label, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>Model</Text>
                <TextInput
                  value={model}
                  onChangeText={setModel}
                  placeholder="e.g. 24ACC636A"
                  placeholderTextColor={colors.mutedForeground}
                  style={[editStyles.input, { color: colors.foreground, backgroundColor: colors.card, borderColor: colors.border, fontFamily: "Inter_400Regular" }]}
                />
              </View>
            </View>

            {/* Serial Number */}
            <View style={editStyles.field}>
              <Text style={[editStyles.label, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>Serial Number</Text>
              <TextInput
                value={serialNumber}
                onChangeText={setSerialNumber}
                placeholder="Found on the unit's label"
                placeholderTextColor={colors.mutedForeground}
                style={[editStyles.input, { color: colors.foreground, backgroundColor: colors.card, borderColor: colors.border, fontFamily: "Inter_400Regular" }]}
              />
            </View>

            {/* Install Date + Replacement Cost */}
            <View style={{ flexDirection: "row", gap: 12 }}>
              <View style={[editStyles.field, { flex: 1 }]}>
                <Text style={[editStyles.label, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>Install Date</Text>
                <TextInput
                  value={installDate}
                  onChangeText={setInstallDate}
                  placeholder="YYYY-MM"
                  placeholderTextColor={colors.mutedForeground}
                  keyboardType="numbers-and-punctuation"
                  style={[editStyles.input, { color: colors.foreground, backgroundColor: colors.card, borderColor: colors.border, fontFamily: "Inter_400Regular" }]}
                />
              </View>
              <View style={[editStyles.field, { flex: 1 }]}>
                <Text style={[editStyles.label, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>Replacement $</Text>
                <TextInput
                  value={replacementCost}
                  onChangeText={setReplacementCost}
                  placeholder="e.g. 4500"
                  placeholderTextColor={colors.mutedForeground}
                  keyboardType="decimal-pad"
                  style={[editStyles.input, { color: colors.foreground, backgroundColor: colors.card, borderColor: colors.border, fontFamily: "Inter_400Regular" }]}
                />
              </View>
            </View>

            {/* Warranty */}
            <View style={editStyles.field}>
              <Text style={[editStyles.label, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>Warranty Expiry (optional)</Text>
              <TextInput
                value={warrantyExpiry}
                onChangeText={setWarrantyExpiry}
                placeholder="YYYY-MM"
                placeholderTextColor={colors.mutedForeground}
                keyboardType="numbers-and-punctuation"
                style={[editStyles.input, { color: colors.foreground, backgroundColor: colors.card, borderColor: colors.border, fontFamily: "Inter_400Regular" }]}
              />
            </View>

            {/* Notes */}
            <View style={editStyles.field}>
              <Text style={[editStyles.label, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>Notes</Text>
              <TextInput
                value={notes}
                onChangeText={setNotes}
                placeholder="Any additional notes about this asset…"
                placeholderTextColor={colors.mutedForeground}
                multiline
                numberOfLines={3}
                style={[editStyles.input, editStyles.textArea, { color: colors.foreground, backgroundColor: colors.card, borderColor: colors.border, fontFamily: "Inter_400Regular" }]}
              />
            </View>
          </ScrollView>

          {/* Footer actions */}
          <View style={[editStyles.footer, { borderTopColor: colors.border, backgroundColor: colors.background }]}>
            {/* Save button */}
            <TouchableOpacity
              onPress={handleSave}
              disabled={!name.trim() || busy}
              style={[editStyles.saveBtn, { backgroundColor: colors.primary, opacity: (!name.trim() || busy) ? 0.5 : 1 }]}
              activeOpacity={0.85}
            >
              {busy
                ? <ActivityIndicator size="small" color="#fff" />
                : <><Feather name="save" size={16} color="#fff" /><Text style={[editStyles.saveBtnText, { fontFamily: "Inter_700Bold" }]}>Save Changes</Text></>
              }
            </TouchableOpacity>

            {/* Retire / Restore */}
            {!retireConfirm ? (
              isRetired ? (
                <TouchableOpacity
                  onPress={handleRestore}
                  disabled={busy}
                  style={[editStyles.retireBtn, { borderColor: "#3d7a5f50", backgroundColor: "#f0fdf4" }]}
                  activeOpacity={0.7}
                >
                  <Feather name="refresh-cw" size={14} color="#3d7a5f" />
                  <Text style={[editStyles.retireBtnText, { color: "#3d7a5f", fontFamily: "Inter_500Medium" }]}>Restore to Active Assets</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  onPress={() => setRetireConfirm(true)}
                  disabled={busy}
                  style={[editStyles.retireBtn, { borderColor: colors.border, backgroundColor: "transparent" }]}
                  activeOpacity={0.7}
                >
                  <Feather name="archive" size={14} color={colors.mutedForeground} />
                  <Text style={[editStyles.retireBtnText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>Retire this Asset</Text>
                </TouchableOpacity>
              )
            ) : (
              <View style={[editStyles.confirmBox, { backgroundColor: "#fffbeb", borderColor: "#fde68a" }]}>
                <Text style={[{ fontSize: 13, color: "#92400e", fontFamily: "Inter_600SemiBold", marginBottom: 4 }]}>
                  Retire "{asset.name}"?
                </Text>
                <Text style={[{ fontSize: 12, color: "#92400e", fontFamily: "Inter_400Regular", lineHeight: 17, marginBottom: 10 }]}>
                  It'll be removed from active inventory. All history is preserved — you can restore it anytime.
                </Text>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <TouchableOpacity
                    onPress={() => setRetireConfirm(false)}
                    style={[editStyles.confirmCancel, { borderColor: "#fde68a" }]}
                    activeOpacity={0.7}
                  >
                    <Text style={[{ fontSize: 13, color: "#92400e", fontFamily: "Inter_500Medium" }]}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={handleRetire}
                    disabled={busy}
                    style={editStyles.confirmRetire}
                    activeOpacity={0.85}
                  >
                    <Feather name="archive" size={13} color="#fff" />
                    <Text style={[{ fontSize: 13, color: "#fff", fontFamily: "Inter_600SemiBold" }]}>Yes, Retire</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const editStyles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: "row", alignItems: "flex-start", gap: 12, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 14, borderBottomWidth: 1 },
  title: { fontSize: 17 },
  sub: { fontSize: 12, marginTop: 2 },
  closeBtn: { padding: 4, marginTop: 2 },
  retiredBanner: { flexDirection: "row", alignItems: "flex-start", gap: 8, paddingHorizontal: 20, paddingVertical: 10, borderBottomWidth: 1 },
  retiredText: { fontSize: 12, flex: 1, lineHeight: 17 },
  body: { padding: 20 },
  field: { marginBottom: 14 },
  label: { fontSize: 12, marginBottom: 6 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11, fontSize: 14 },
  textArea: { minHeight: 80, textAlignVertical: "top" },
  pickerRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  pickerText: { flex: 1, fontSize: 14 },
  dropdown: { borderRadius: 12, borderWidth: 1, overflow: "hidden", marginTop: 4 },
  dropdownItem: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  dropdownText: { flex: 1, fontSize: 14 },
  footer: { borderTopWidth: 1, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 32, gap: 10 },
  saveBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 14, paddingVertical: 14 },
  saveBtnText: { color: "#fff", fontSize: 15 },
  retireBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 12, borderWidth: 1, paddingVertical: 11 },
  retireBtnText: { fontSize: 13 },
  confirmBox: { borderRadius: 12, borderWidth: 1, padding: 14 },
  confirmCancel: { flex: 1, alignItems: "center", paddingVertical: 9, borderRadius: 8, borderWidth: 1 },
  confirmRetire: { flex: 2, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 9, borderRadius: 8, backgroundColor: "#d97706" },
});

// ── Main asset detail screen ───────────────────────────────────────────────────
export default function AssetDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const [activeTask, setActiveTask] = useState<MaintenanceTask | null>(null);
  const [editOpen, setEditOpen] = useState(false);

  const { data: asset, isLoading: assetLoading } = useGetAsset(id!);
  const { data: tasks = [], refetch: refetchTasks } = useListMaintenanceTasks(id!);
  const { data: records = [], refetch: refetchRecords } = useListServiceRecords(id!);

  const a = asset as Asset | undefined;
  const taskList = tasks as MaintenanceTask[];
  const recordList = records as ServiceRecord[];

  const pendingTasks = taskList.filter((t) => !t.completedAt);
  const completedTasks = taskList.filter((t) => t.completedAt);

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  if (assetLoading || !a) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: topPad }}>
        {/* Header skeleton */}
        <View style={[detailStyles.header, { borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => router.back()} style={detailStyles.backBtn}>
            <Feather name="chevron-left" size={24} color={colors.foreground} />
          </TouchableOpacity>
        </View>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      </View>
    );
  }

  const cat = normCategory(a.category);
  const cfg = CATEGORY_CONFIG[cat] ?? CATEGORY_CONFIG.Other!;
  const score = calcAssetScore({ installDate: a.installDate, warrantyExpiry: a.warrantyExpiry, status: a.status, category: cat });
  const { color: gradeColor } = gradeFromScore(score);
  const underWarranty = a.warrantyExpiry ? new Date(a.warrantyExpiry) > new Date() : false;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* ── Sticky header ── */}
      <View style={[detailStyles.header, { paddingTop: topPad, borderBottomColor: colors.border, backgroundColor: colors.background }]}>
        <TouchableOpacity onPress={() => router.back()} style={detailStyles.backBtn} activeOpacity={0.7}>
          <Feather name="chevron-left" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <View style={detailStyles.headerCenter}>
          <View style={[detailStyles.categoryBadge, { backgroundColor: cfg.bg }]}>
            <Text style={detailStyles.categoryEmoji}>{cfg.emoji}</Text>
          </View>
          <Text style={[detailStyles.headerTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]} numberOfLines={1}>
            {a.name}
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => { Haptics.selectionAsync(); setEditOpen(true); }}
          style={detailStyles.backBtn}
          activeOpacity={0.7}
        >
          <Feather name="edit-2" size={18} color={colors.foreground} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 32 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Hero card: gauge + meta ── */}
        <View style={[detailStyles.heroCard, { backgroundColor: colors.card, borderColor: cfg.color + "30" }]}>
          <LargeRadialGauge score={score} />
          <View style={{ marginTop: 12, gap: 8, alignItems: "center" }}>
            {/* Status badges */}
            <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap", justifyContent: "center" }}>
              {a.status === "verified" && (
                <View style={[detailStyles.pill, { backgroundColor: "#d1fae5", borderColor: "#6ee7b7" }]}>
                  <Feather name="shield" size={10} color="#059669" />
                  <Text style={[detailStyles.pillText, { color: "#059669", fontFamily: "Inter_700Bold" }]}>Verified</Text>
                </View>
              )}
              {a.status === "needs_attention" && (
                <View style={[detailStyles.pill, { backgroundColor: "#fee2e2", borderColor: "#fca5a5" }]}>
                  <Feather name="alert-circle" size={10} color="#dc2626" />
                  <Text style={[detailStyles.pillText, { color: "#dc2626", fontFamily: "Inter_700Bold" }]}>Needs Attention</Text>
                </View>
              )}
              {underWarranty && (
                <View style={[detailStyles.pill, { backgroundColor: "#eff6ff", borderColor: "#bfdbfe" }]}>
                  <Feather name="shield" size={10} color="#2563eb" />
                  <Text style={[detailStyles.pillText, { color: "#2563eb", fontFamily: "Inter_700Bold" }]}>Under Warranty</Text>
                </View>
              )}
            </View>
            <Text style={[detailStyles.categoryLabel, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              {cfg.emoji} {cat}
            </Text>
          </View>

          {/* Life-used bar */}
          {a.installDate && (
            <View style={{ width: "100%", marginTop: 16, paddingTop: 14, borderTopWidth: 1, borderTopColor: colors.border }}>
              <LifeBar installDate={a.installDate} category={cat} colors={colors} />
            </View>
          )}
        </View>

        {/* ── Specifications ── */}
        <View style={[detailStyles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <SectionHeader title="Specifications" icon="info" colors={colors} />
          {a.brand && <SpecRow label="Brand" value={a.brand} colors={colors} />}
          {a.model && <SpecRow label="Model" value={a.model} colors={colors} />}
          {a.serialNumber && <SpecRow label="Serial Number" value={a.serialNumber} mono colors={colors} />}
          {a.installDate && (
            <SpecRow label="Installed" value={format(new Date(a.installDate), "MMM d, yyyy")} colors={colors} />
          )}
          {a.warrantyExpiry && (
            <SpecRow
              label="Warranty Expires"
              value={`${format(new Date(a.warrantyExpiry), "MMM d, yyyy")}${underWarranty ? " ✓" : " (expired)"}`}
              colors={colors}
            />
          )}
          {a.replacementCost != null && a.replacementCost > 0 && (
            <SpecRow label="Replacement Cost" value={`$${Number(a.replacementCost).toLocaleString()}`} colors={colors} />
          )}
          {!a.brand && !a.model && !a.serialNumber && !a.installDate && !a.warrantyExpiry && (
            <Text style={[{ fontSize: 13, color: colors.mutedForeground, fontFamily: "Inter_400Regular", paddingVertical: 8 }]}>
              No specifications recorded yet.
            </Text>
          )}
        </View>

        {/* ── Maintenance Tasks ── */}
        <View style={[detailStyles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <SectionHeader title="Maintenance Tasks" icon="tool" colors={colors} />
          {pendingTasks.length === 0 ? (
            <View style={[detailStyles.emptyState, { backgroundColor: colors.accent, borderColor: colors.border }]}>
              <Feather name="check-circle" size={18} color={colors.accentForeground} />
              <Text style={[{ fontSize: 13, color: colors.accentForeground, fontFamily: "Inter_500Medium" }]}>
                No pending tasks — all clear!
              </Text>
            </View>
          ) : (
            pendingTasks.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                assetId={a.id}
                colors={colors}
                onMarkDone={(t) => { setActiveTask(t); Haptics.selectionAsync(); }}
              />
            ))
          )}

          {/* Completed tasks */}
          {completedTasks.length > 0 && (
            <View style={{ marginTop: 8 }}>
              <Text style={[{ fontSize: 11, color: colors.mutedForeground, fontFamily: "Inter_500Medium", marginBottom: 6 }]}>
                COMPLETED ({completedTasks.length})
              </Text>
              {completedTasks.slice(0, 3).map((task) => (
                <View key={task.id} style={[detailStyles.completedRow, { borderBottomColor: colors.border }]}>
                  <Feather name="check-circle" size={13} color="#059669" />
                  <Text style={[{ flex: 1, fontSize: 13, color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]} numberOfLines={1}>
                    {task.title}
                  </Text>
                  {task.completedAt && (
                    <Text style={[{ fontSize: 11, color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                      {format(new Date(task.completedAt), "MMM d")}
                    </Text>
                  )}
                </View>
              ))}
            </View>
          )}
        </View>

        {/* ── Service History ── */}
        <View style={[detailStyles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <SectionHeader title="Service History" icon="file-text" colors={colors} />
          {recordList.length === 0 ? (
            <Text style={[{ fontSize: 13, color: colors.mutedForeground, fontFamily: "Inter_400Regular", paddingVertical: 4 }]}>
              No service records yet.
            </Text>
          ) : (
            <View style={{ paddingLeft: 4 }}>
              {recordList.map((record) => (
                <RecordRow key={record.id} record={record} colors={colors} />
              ))}
            </View>
          )}

          {/* Log service record form */}
          <View style={{ marginTop: 16 }}>
            <LogServiceForm
              assetId={a.id}
              colors={colors}
              onSuccess={() => {
                refetchRecords();
                queryClient.invalidateQueries({ queryKey: getListServiceRecordsQueryKey(a.id) });
              }}
            />
          </View>
        </View>

        {/* Notes */}
        {a.notes && (
          <View style={[detailStyles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <SectionHeader title="Notes" icon="align-left" colors={colors} />
            <Text style={[{ fontSize: 13, color: colors.foreground, fontFamily: "Inter_400Regular", lineHeight: 20 }]}>
              {a.notes}
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Mark Complete Modal */}
      <MarkCompleteModal
        task={activeTask}
        assetId={a.id}
        visible={!!activeTask}
        onClose={() => setActiveTask(null)}
        colors={colors}
        onSuccess={() => {
          refetchTasks();
          refetchRecords();
          queryClient.invalidateQueries({ queryKey: getListMaintenanceTasksQueryKey(a.id) });
          queryClient.invalidateQueries({ queryKey: getListServiceRecordsQueryKey(a.id) });
        }}
      />

      {/* Edit Asset Modal */}
      <EditAssetModal
        asset={a}
        visible={editOpen}
        onClose={() => setEditOpen(false)}
        colors={colors}
        onSaved={() => {
          queryClient.invalidateQueries({ queryKey: getGetAssetQueryKey(a.id) });
          queryClient.invalidateQueries({
            predicate: (q) =>
              q.queryKey.some((k) => typeof k === "string" && (k.includes("assets") || k.includes("summary"))),
          });
        }}
      />
    </View>
  );
}

const detailStyles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    gap: 10,
  },
  backBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center", borderRadius: 10 },
  headerCenter: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8, minWidth: 0 },
  categoryBadge: { width: 30, height: 30, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  categoryEmoji: { fontSize: 16 },
  headerTitle: { flex: 1, fontSize: 16, lineHeight: 20 },
  heroCard: {
    borderRadius: 16, borderWidth: 1.5, padding: 20,
    alignItems: "center", marginBottom: 16,
  },
  pill: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 99, borderWidth: 1,
  },
  pillText: { fontSize: 11 },
  categoryLabel: { fontSize: 13, marginTop: 2 },
  section: {
    borderRadius: 12, borderWidth: 1, padding: 16, marginBottom: 16,
  },
  emptyState: {
    flexDirection: "row", alignItems: "center", gap: 8,
    padding: 14, borderRadius: 10, borderWidth: 1,
  },
  completedRow: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
