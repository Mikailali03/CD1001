import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Modal,
  TextInput,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/expo";
import { Feather } from "@expo/vector-icons";
import { differenceInCalendarDays } from "date-fns";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type InboxTask = {
  id: string;
  assetId: string;
  title: string;
  description: string | null;
  intervalDays: number;
  nextDueDate: string;
  isDiy: boolean;
  estimatedCost: string | null;
  assetName: string;
  assetCategory: string;
};

type InboxData = {
  overdue: InboxTask[];
  upcoming: InboxTask[];
  totalCount: number;
};

type CompletePayload = {
  notes?: string;
  isDiy: boolean;
  cost?: number;
  technicianName?: string;
  companyName?: string;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CATEGORY_ICONS: Record<string, string> = {
  HVAC: "❄️",
  Plumbing: "🔧",
  Electrical: "⚡",
  Roof: "🏠",
  Appliance: "🫙",
  Structural: "🏗️",
  Other: "📦",
};

function dueDateLabel(nextDueDate: string, isOverdue: boolean): string {
  const today = new Date();
  const due = new Date(nextDueDate + "T00:00:00");
  const diff = differenceInCalendarDays(due, today);
  const abs = Math.abs(diff);
  if (isOverdue) return `${abs} day${abs !== 1 ? "s" : ""} overdue · ${due.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
  if (diff === 0) return "Due today";
  if (diff === 1) return "Due tomorrow";
  return `Due in ${diff} days · ${due.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
}

// ---------------------------------------------------------------------------
// Complete task bottom sheet
// ---------------------------------------------------------------------------

interface CompleteSheetProps {
  task: InboxTask;
  visible: boolean;
  onClose: () => void;
  onConfirm: (payload: CompletePayload) => Promise<void>;
  colors: ReturnType<typeof useColors>;
  insetBottom: number;
}

function CompleteSheet({ task, visible, onClose, onConfirm, colors }: Omit<CompleteSheetProps, "insetBottom">) {
  const insets = useSafeAreaInsets();
  const [notes, setNotes] = useState("");
  const [cost, setCost] = useState(task.estimatedCost ? String(Number(task.estimatedCost)) : "");
  const [isDiy, setIsDiy] = useState(task.isDiy ?? true);
  const [techName, setTechName] = useState("");
  const [company, setCompany] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleConfirm() {
    setBusy(true);
    try {
      await onConfirm({
        notes: notes.trim() || undefined,
        isDiy,
        cost: cost ? parseFloat(cost) : undefined,
        technicianName: isDiy ? "Homeowner (DIY)" : (techName.trim() || undefined),
        companyName: isDiy ? undefined : (company.trim() || undefined),
      });
      setNotes(""); setCost(""); setTechName(""); setCompany("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal visible={visible} animationType="fade" transparent statusBarTranslucent onRequestClose={onClose}>
      <View style={[cs.fullScreen, { backgroundColor: colors.background }]}>
          {/* Header */}
          <View style={[cs.header, { borderBottomColor: colors.border, paddingTop: insets.top + 12 }]}>
            <View style={{ flex: 1 }}>
              <Text style={[cs.headerTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]} numberOfLines={1}>
                {task.title}
              </Text>
              <Text style={[cs.headerSub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                {task.assetName}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={[cs.closeBtn, { backgroundColor: colors.muted }]} activeOpacity={0.7}>
              <Feather name="x" size={16} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>

          <KeyboardAwareScrollViewCompat contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: insets.bottom + 24 }}>
            {/* Notes */}
            <View style={{ gap: 6 }}>
              <Text style={[cs.label, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>Notes (optional)</Text>
              <TextInput
                value={notes}
                onChangeText={setNotes}
                placeholder={`e.g. Completed ${task.title.toLowerCase()}. Everything looks good.`}
                placeholderTextColor={colors.mutedForeground}
                multiline
                numberOfLines={3}
                style={[cs.textarea, { color: colors.foreground, backgroundColor: colors.card, borderColor: colors.border, fontFamily: "Inter_400Regular" }]}
              />
            </View>

            {/* Cost */}
            <View style={{ gap: 6 }}>
              <Text style={[cs.label, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>Actual Cost</Text>
              <View style={[cs.inputRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[cs.currencyPrefix, { color: colors.mutedForeground }]}>$</Text>
                <TextInput
                  value={cost}
                  onChangeText={setCost}
                  placeholder="0.00"
                  placeholderTextColor={colors.mutedForeground}
                  keyboardType="decimal-pad"
                  style={[cs.textInput, { color: colors.foreground, fontFamily: "Inter_400Regular", flex: 1 }]}
                />
              </View>
            </View>

            {/* DIY / Pro toggle */}
            <View style={{ gap: 6 }}>
              <Text style={[cs.label, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>Who did the work?</Text>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <TouchableOpacity
                  onPress={() => setIsDiy(true)}
                  style={[cs.toggleBtn, { borderColor: isDiy ? colors.primary : colors.border, backgroundColor: isDiy ? colors.primary + "15" : colors.card }]}
                  activeOpacity={0.7}
                >
                  <Feather name="tool" size={14} color={isDiy ? colors.primary : colors.mutedForeground} />
                  <Text style={[cs.toggleText, { color: isDiy ? colors.primary : colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>
                    I did it (DIY)
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setIsDiy(false)}
                  style={[cs.toggleBtn, { borderColor: !isDiy ? colors.primary : colors.border, backgroundColor: !isDiy ? colors.primary + "15" : colors.card }]}
                  activeOpacity={0.7}
                >
                  <Feather name="user-check" size={14} color={!isDiy ? colors.primary : colors.mutedForeground} />
                  <Text style={[cs.toggleText, { color: !isDiy ? colors.primary : colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>
                    Hired a Pro
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Pro fields */}
            {!isDiy && (
              <View style={{ gap: 10 }}>
                <View style={{ gap: 6 }}>
                  <Text style={[cs.label, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>Technician Name</Text>
                  <TextInput
                    value={techName}
                    onChangeText={setTechName}
                    placeholder="Name"
                    placeholderTextColor={colors.mutedForeground}
                    style={[cs.inputField, { color: colors.foreground, backgroundColor: colors.card, borderColor: colors.border, fontFamily: "Inter_400Regular" }]}
                  />
                </View>
                <View style={{ gap: 6 }}>
                  <Text style={[cs.label, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>Company</Text>
                  <TextInput
                    value={company}
                    onChangeText={setCompany}
                    placeholder="Company name"
                    placeholderTextColor={colors.mutedForeground}
                    style={[cs.inputField, { color: colors.foreground, backgroundColor: colors.card, borderColor: colors.border, fontFamily: "Inter_400Regular" }]}
                  />
                </View>
              </View>
            )}

            {/* Confirm button */}
            <TouchableOpacity
              onPress={handleConfirm}
              disabled={busy}
              style={[cs.confirmBtn, { backgroundColor: colors.primary, opacity: busy ? 0.6 : 1 }]}
              activeOpacity={0.8}
            >
              {busy ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Feather name="check-circle" size={16} color="#fff" />
              )}
              <Text style={[cs.confirmText, { fontFamily: "Inter_600SemiBold" }]}>
                {busy ? "Saving…" : "Mark Complete"}
              </Text>
            </TouchableOpacity>
          </KeyboardAwareScrollViewCompat>
      </View>
    </Modal>
  );
}

const cs = StyleSheet.create({
  fullScreen: { flex: 1 },
  header: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: { fontSize: 15 },
  headerSub: { fontSize: 12, marginTop: 2 },
  closeBtn: { width: 30, height: 30, borderRadius: 99, alignItems: "center", justifyContent: "center" },
  label: { fontSize: 12 },
  textarea: {
    borderWidth: 1, borderRadius: 10, padding: 10,
    minHeight: 72, textAlignVertical: "top", fontSize: 13,
  },
  inputRow: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderRadius: 10, paddingHorizontal: 10 },
  currencyPrefix: { fontSize: 13, paddingRight: 4 },
  textInput: { fontSize: 13, paddingVertical: 10 },
  inputField: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, fontSize: 13 },
  toggleBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderWidth: 1, borderRadius: 10, paddingVertical: 9 },
  toggleText: { fontSize: 12 },
  confirmBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 12, paddingVertical: 14, marginTop: 4 },
  confirmText: { color: "#fff", fontSize: 14 },
});

// ---------------------------------------------------------------------------
// Task row
// ---------------------------------------------------------------------------

interface TaskRowProps {
  task: InboxTask;
  isOverdue: boolean;
  onDone: () => void;
  colors: ReturnType<typeof useColors>;
}

function TaskRow({ task, isOverdue, onDone, colors }: TaskRowProps) {
  const dateLabel = dueDateLabel(task.nextDueDate, isOverdue);
  const icon = CATEGORY_ICONS[task.assetCategory] ?? "📦";
  const dateColor = isOverdue ? "#ef4444" : differenceInCalendarDays(new Date(task.nextDueDate + "T00:00:00"), new Date()) <= 7 ? "#d97706" : colors.mutedForeground;

  return (
    <View style={[tr.row, { backgroundColor: isOverdue ? "#fef2f218" : colors.card, borderColor: isOverdue ? "#fca5a540" : colors.border }]}>
      <Text style={tr.emoji}>{icon}</Text>
      <View style={{ flex: 1, gap: 2 }}>
        <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 6 }}>
          <Text style={[tr.title, { color: colors.foreground, fontFamily: "Inter_600SemiBold", flex: 1 }]} numberOfLines={2}>
            {task.title}
          </Text>
          {task.isDiy && (
            <View style={[tr.diyBadge, { backgroundColor: colors.muted }]}>
              <Text style={[tr.diyText, { color: colors.mutedForeground, fontFamily: "Inter_700Bold" }]}>DIY</Text>
            </View>
          )}
        </View>
        <Text style={[tr.assetName, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]} numberOfLines={1}>
          {task.assetName}
        </Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 1 }}>
          <Feather name={isOverdue ? "alert-circle" : "calendar"} size={11} color={dateColor} />
          <Text style={[tr.dateLabel, { color: dateColor, fontFamily: "Inter_500Medium" }]}>
            {dateLabel}
          </Text>
          {task.estimatedCost && (
            <Text style={[tr.cost, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              · est. ${Number(task.estimatedCost).toLocaleString()}
            </Text>
          )}
        </View>
      </View>
      <TouchableOpacity
        onPress={onDone}
        style={[tr.doneBtn, { backgroundColor: colors.primary + "18" }]}
        activeOpacity={0.7}
      >
        <Feather name="check-circle" size={14} color={colors.primary} />
        <Text style={[tr.doneBtnText, { color: colors.primary, fontFamily: "Inter_600SemiBold" }]}>Done</Text>
      </TouchableOpacity>
    </View>
  );
}

const tr = StyleSheet.create({
  row: {
    flexDirection: "row", alignItems: "flex-start", gap: 10,
    borderRadius: 12, borderWidth: 1, padding: 12,
  },
  emoji: { fontSize: 18, marginTop: 1 },
  title: { fontSize: 13, lineHeight: 18 },
  assetName: { fontSize: 11 },
  dateLabel: { fontSize: 11 },
  cost: { fontSize: 11 },
  diyBadge: { paddingHorizontal: 5, paddingVertical: 2, borderRadius: 5 },
  diyText: { fontSize: 9, letterSpacing: 0.5 },
  doneBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 6, borderRadius: 8 },
  doneBtnText: { fontSize: 12 },
});

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface MaintenanceInboxProps {
  propertyId: string;
  insetBottom?: number;
}

export function MaintenanceInbox({ propertyId, insetBottom = 0 }: MaintenanceInboxProps) {
  const colors = useColors();
  const { getToken } = useAuth();
  const queryClient = useQueryClient();

  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  const base = domain ? `https://${domain}` : "";

  const [activeTask, setActiveTask] = useState<InboxTask | null>(null);
  const [collapsed, setCollapsed] = useState(false);

  const { data, isLoading } = useQuery<InboxData>({
    queryKey: ["maintenance-inbox", propertyId],
    queryFn: async () => {
      const token = await getToken();
      const res = await fetch(`${base}/api/properties/${propertyId}/inbox`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to load inbox");
      return res.json();
    },
    refetchInterval: 60_000,
    enabled: !!propertyId,
  });

  const markDone = useCallback(async (payload: CompletePayload) => {
    if (!activeTask) return;
    const token = await getToken();
    const res = await fetch(`${base}/api/maintenance/${activeTask.id}/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ ...payload, completedDate: new Date().toLocaleDateString("en-CA") }),
    });
    if (!res.ok) {
      Alert.alert("Error", "Could not mark task complete. Please try again.");
      throw new Error("Failed");
    }
    setActiveTask(null);
    await queryClient.invalidateQueries({ queryKey: ["maintenance-inbox", propertyId] });
    queryClient.invalidateQueries({
      predicate: (q) =>
        q.queryKey.some((k) => typeof k === "string" && (k.includes("summary") || k.includes("properties"))),
    });
  }, [activeTask, base, getToken, propertyId, queryClient]);

  const overdue = data?.overdue ?? [];
  const upcoming = data?.upcoming ?? [];
  const total = overdue.length + upcoming.length;
  const hasOverdue = overdue.length > 0;

  const badgeBg = hasOverdue ? "#ef444420" : "#d97706" + "20";
  const badgeText = hasOverdue ? "#ef4444" : "#d97706";

  return (
    <View style={[s.card, { backgroundColor: colors.card, borderColor: hasOverdue ? "#fca5a560" : colors.border }]}>
      {/* Header */}
      <TouchableOpacity
        onPress={() => { Haptics.selectionAsync(); setCollapsed((c) => !c); }}
        style={s.cardHeader}
        activeOpacity={0.7}
      >
        <View style={[s.iconWrap, { backgroundColor: hasOverdue ? "#ef444415" : colors.primary + "15" }]}>
          <Feather name="inbox" size={15} color={hasOverdue ? "#ef4444" : colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
            <Text style={[s.cardTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
              Maintenance Inbox
            </Text>
            {total > 0 && (
              <View style={[s.badge, { backgroundColor: badgeBg }]}>
                <Text style={[s.badgeText, { color: badgeText, fontFamily: "Inter_700Bold" }]}>{total}</Text>
              </View>
            )}
          </View>
          {!isLoading && (
            <Text style={[s.cardSub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              {hasOverdue
                ? `${overdue.length} overdue · ${upcoming.length} upcoming`
                : total > 0
                ? `${total} task${total !== 1 ? "s" : ""} due in the next 30 days`
                : "You're all caught up!"}
            </Text>
          )}
        </View>
        <Feather name={collapsed ? "chevron-down" : "chevron-up"} size={16} color={colors.mutedForeground} />
      </TouchableOpacity>

      {/* Body */}
      {!collapsed && (
        <View style={[s.body, { borderTopColor: colors.border }]}>
          {isLoading ? (
            <View style={{ padding: 16, alignItems: "center" }}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : total === 0 ? (
            <View style={s.emptyState}>
              <Feather name="check-circle" size={28} color="#10b981" style={{ opacity: 0.7 }} />
              <Text style={[s.emptyTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
                All caught up!
              </Text>
              <Text style={[s.emptySub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                No overdue or upcoming tasks in the next 30 days.
              </Text>
            </View>
          ) : (
            <View style={{ gap: 8 }}>
              {overdue.length > 0 && (
                <View style={{ gap: 6 }}>
                  <Text style={[s.groupLabel, { color: "#ef4444", fontFamily: "Inter_600SemiBold" }]}>
                    Overdue
                  </Text>
                  {overdue.map((task) => (
                    <TaskRow
                      key={task.id}
                      task={task}
                      isOverdue={true}
                      onDone={() => { Haptics.selectionAsync(); setActiveTask(task); }}
                      colors={colors}
                    />
                  ))}
                </View>
              )}
              {upcoming.length > 0 && (
                <View style={{ gap: 6, marginTop: overdue.length > 0 ? 4 : 0 }}>
                  <Text style={[s.groupLabel, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>
                    Upcoming (30 days)
                  </Text>
                  {upcoming.map((task) => (
                    <TaskRow
                      key={task.id}
                      task={task}
                      isOverdue={false}
                      onDone={() => { Haptics.selectionAsync(); setActiveTask(task); }}
                      colors={colors}
                    />
                  ))}
                </View>
              )}
            </View>
          )}
        </View>
      )}

      {/* Complete sheet */}
      {activeTask && (
        <CompleteSheet
          task={activeTask}
          visible={!!activeTask}
          onClose={() => setActiveTask(null)}
          onConfirm={markDone}
          colors={colors}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  card: { borderRadius: 14, borderWidth: 1, overflow: "hidden" },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 10, padding: 14 },
  iconWrap: { width: 32, height: 32, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  cardTitle: { fontSize: 14 },
  cardSub: { fontSize: 11, marginTop: 1 },
  badge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 99 },
  badgeText: { fontSize: 11 },
  body: { borderTopWidth: StyleSheet.hairlineWidth, padding: 12 },
  groupLabel: { fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5, paddingHorizontal: 2 },
  emptyState: { alignItems: "center", gap: 6, paddingVertical: 20 },
  emptyTitle: { fontSize: 14 },
  emptySub: { fontSize: 12, textAlign: "center", maxWidth: 240 },
});
