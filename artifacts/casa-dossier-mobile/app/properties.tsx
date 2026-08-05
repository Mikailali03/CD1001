import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Platform,
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  TextInput,
  KeyboardAvoidingView,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import * as ImagePicker from "expo-image-picker";
import { useAuth } from "@clerk/expo";
import {
  useListProperties,
  useGetPropertySummary,
  useCreateProperty,
  useUpdateProperty,
  getGetPropertySummaryQueryKey,
  getListPropertiesQueryKey,
  getGetPropertyQueryKey,
  type Property,
  type UpdatePropertyBody,
} from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import Svg, { Circle, Text as SvgText } from "react-native-svg";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function toISODate(d: Date): string {
  return d.toISOString().split("T")[0]!;
}

function formatDate(s: string): string {
  return new Date(s + "T00:00:00").toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
}

function scoreColor(score: number): string {
  if (score >= 90) return "#10b981";
  if (score >= 75) return "#3b82f6";
  if (score >= 60) return "#f59e0b";
  if (score >= 45) return "#f97316";
  return "#ef4444";
}

function scoreBg(score: number): string {
  if (score >= 90) return "#10b98118";
  if (score >= 75) return "#3b82f618";
  if (score >= 60) return "#f59e0b18";
  if (score >= 45) return "#f9731618";
  return "#ef444418";
}

function scoreBorder(score: number): string {
  if (score >= 90) return "#10b98140";
  if (score >= 75) return "#3b82f640";
  if (score >= 60) return "#f59e0b40";
  if (score >= 45) return "#f9731640";
  return "#ef444440";
}

function scoreLabel(score: number): string {
  if (score >= 90) return "Excellent";
  if (score >= 75) return "Good";
  if (score >= 60) return "Fair";
  if (score >= 45) return "Poor";
  return "Critical";
}

// ---------------------------------------------------------------------------
// Health score ring (SVG)
// ---------------------------------------------------------------------------

const RING_R = 28;
const RING_STROKE = 5;
const RING_SIZE = (RING_R + RING_STROKE) * 2;
const CIRCUMFERENCE = 2 * Math.PI * RING_R;

interface RingProps { propertyId: string; onPress: () => void; colors: ReturnType<typeof useColors> }

function HealthScoreRing({ propertyId, onPress, colors }: RingProps) {
  const { data: summary, isLoading } = useGetPropertySummary(propertyId, {
    query: { queryKey: getGetPropertySummaryQueryKey(propertyId) },
  });
  const [animated, setAnimated] = useState(0);

  useEffect(() => {
    if (summary?.healthScore == null) return;
    const t = setTimeout(() => setAnimated(summary.healthScore), 80);
    return () => clearTimeout(t);
  }, [summary?.healthScore]);

  if (isLoading) {
    return (
      <View style={[rStyles.loadingRing, { borderColor: colors.border }]}>
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    );
  }
  if (!summary) return null;

  const { healthScore, healthGrade } = summary;
  const color = scoreColor(healthScore);
  const cx = RING_SIZE / 2;
  const offset = CIRCUMFERENCE - CIRCUMFERENCE * (animated / 100);

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.75} style={rStyles.ringBtn}>
      <Svg width={RING_SIZE} height={RING_SIZE} viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}>
        {/* track */}
        <Circle cx={cx} cy={cx} r={RING_R} fill="none" stroke="#e5e7eb" strokeWidth={RING_STROKE} />
        {/* arc */}
        <Circle
          cx={cx} cy={cx} r={RING_R}
          fill="none" stroke={color} strokeWidth={RING_STROKE}
          strokeDasharray={CIRCUMFERENCE} strokeDashoffset={offset}
          strokeLinecap="round"
          rotation={-90} origin={`${cx}, ${cx}`}
        />
        {/* score */}
        <SvgText x={cx} y={cx - 5} textAnchor="middle" fontSize="13" fontWeight="700" fill={color}>
          {healthScore}
        </SvgText>
        {/* grade */}
        <SvgText x={cx} y={cx + 9} textAnchor="middle" fontSize="10" fontWeight="600" fill={color} opacity={0.75}>
          {healthGrade}
        </SvgText>
      </Svg>
    </TouchableOpacity>
  );
}

const rStyles = StyleSheet.create({
  ringBtn: {},
  loadingRing: {
    width: RING_SIZE, height: RING_SIZE, borderRadius: RING_SIZE / 2,
    borderWidth: 2, alignItems: "center", justifyContent: "center",
  },
});

// ---------------------------------------------------------------------------
// Property health modal
// ---------------------------------------------------------------------------

interface HealthModalProps {
  propertyId: string;
  propertyName: string;
  visible: boolean;
  onClose: () => void;
  colors: ReturnType<typeof useColors>;
  insets: { bottom: number };
}

function PropertyHealthModal({ propertyId, propertyName, visible, onClose, colors, insets }: HealthModalProps) {
  const { data: summary, isLoading } = useGetPropertySummary(propertyId, {
    query: { queryKey: getGetPropertySummaryQueryKey(propertyId), enabled: visible },
  });

  const today = new Date();
  const todayStr = toISODate(today);
  const in30Days = toISODate(addDays(today, 30));
  const ago60Days = toISODate(addDays(today, -60));

  const next30Tasks = (summary?.upcomingTasks ?? []).filter(
    (t) => t.nextDueDate >= todayStr && t.nextDueDate <= in30Days,
  );
  const overdueTasks = (summary as any)?.overdueTasks ?? [];
  const lowAssets = (summary?.assetScores ?? [])
    .filter((s) => s.score < 75)
    .sort((a, b) => a.score - b.score);
  const recentRecords = (summary?.recentRecords ?? []).filter((r) => r.date >= ago60Days);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={[mStyles.backdrop]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[mStyles.sheet, { backgroundColor: colors.background, paddingBottom: insets.bottom + 16 }]}>
          {/* Handle */}
          <View style={[mStyles.handle, { backgroundColor: colors.border }]} />

          {/* Header */}
          <View style={[mStyles.sheetHeader, { borderBottomColor: colors.border }]}>
            <View style={{ flex: 1 }}>
              <Text style={[mStyles.sheetTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]} numberOfLines={1}>
                {propertyName}
              </Text>
              <Text style={[mStyles.sheetSub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                Home Improvement Plan
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={[mStyles.closeBtn, { backgroundColor: colors.muted }]} activeOpacity={0.7}>
              <Feather name="x" size={16} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>

          {isLoading ? (
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
              <ActivityIndicator color={colors.primary} size="large" />
            </View>
          ) : !summary ? (
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
              <Text style={[{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 13 }]}>
                Unable to load property data.
              </Text>
            </View>
          ) : (
            <ScrollView
              contentContainerStyle={{ padding: 20, gap: 20 }}
              showsVerticalScrollIndicator={false}
            >
              {/* Score banner */}
              <View style={[mStyles.scoreBanner, { backgroundColor: scoreBg(summary.healthScore), borderColor: scoreBorder(summary.healthScore) }]}>
                <View style={mStyles.scoreLeft}>
                  <Text style={[mStyles.scoreNum, { color: scoreColor(summary.healthScore), fontFamily: "Inter_700Bold" }]}>
                    {summary.healthScore}
                  </Text>
                  <Text style={[mStyles.scoreDenom, { color: scoreColor(summary.healthScore), fontFamily: "Inter_400Regular" }]}>
                    / 100
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[mStyles.scoreLabel, { color: scoreColor(summary.healthScore), fontFamily: "Inter_600SemiBold" }]}>
                    {scoreLabel(summary.healthScore)} ({summary.healthGrade})
                  </Text>
                  <Text style={[mStyles.scoreMeta, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                    {summary.totalAssets} asset{summary.totalAssets !== 1 ? "s" : ""} tracked
                    {summary.overdueTaskCount > 0 ? ` · ${summary.overdueTaskCount} overdue` : ""}
                  </Text>
                </View>
              </View>

              {/* Assets needing attention */}
              <View style={mStyles.section}>
                <View style={mStyles.sectionHeader}>
                  <Feather name="shield" size={14} color={colors.mutedForeground} />
                  <Text style={[mStyles.sectionTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
                    Assets Needing Attention
                  </Text>
                  <View style={[mStyles.badge, { backgroundColor: colors.muted }]}>
                    <Text style={[mStyles.badgeText, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>
                      {lowAssets.length}
                    </Text>
                  </View>
                </View>
                {lowAssets.length === 0 ? (
                  <Text style={[mStyles.emptyNote, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                    All assets are at 75% or above — great shape!
                  </Text>
                ) : (
                  <View style={{ gap: 6 }}>
                    {lowAssets.map((asset) => (
                      <View key={asset.assetId} style={[mStyles.assetRow, { backgroundColor: scoreBg(asset.score), borderColor: scoreBorder(asset.score) }]}>
                        <View style={{ flex: 1 }}>
                          <Text style={[mStyles.assetName, { color: colors.foreground, fontFamily: "Inter_500Medium" }]} numberOfLines={1}>
                            {asset.assetName}
                          </Text>
                          <Text style={[mStyles.assetMeta, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                            {asset.category} · {asset.ageYears}y old of {asset.lifespanYears}y lifespan
                          </Text>
                        </View>
                        <Text style={[mStyles.assetScore, { color: scoreColor(asset.score), fontFamily: "Inter_700Bold" }]}>
                          {asset.score}%
                        </Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>

              {/* Maintenance next 30 days */}
              <View style={mStyles.section}>
                <View style={mStyles.sectionHeader}>
                  <Feather name="calendar" size={14} color={colors.mutedForeground} />
                  <Text style={[mStyles.sectionTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
                    Maintenance in the Next 30 Days
                  </Text>
                  <View style={[mStyles.badge, { backgroundColor: colors.muted }]}>
                    <Text style={[mStyles.badgeText, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>
                      {overdueTasks.length + next30Tasks.length}
                    </Text>
                  </View>
                </View>
                {overdueTasks.length === 0 && next30Tasks.length === 0 ? (
                  <Text style={[mStyles.emptyNote, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                    Nothing due in the next 30 days.
                  </Text>
                ) : (
                  <View style={{ gap: 6 }}>
                    {overdueTasks.map((task: any) => (
                      <View key={task.id} style={[mStyles.taskRow, { backgroundColor: "#fef2f2", borderColor: "#fecaca" }]}>
                        <Feather name="alert-triangle" size={13} color="#ef4444" style={{ marginTop: 1 }} />
                        <View style={{ flex: 1 }}>
                          <Text style={[mStyles.taskTitle, { color: colors.foreground, fontFamily: "Inter_500Medium" }]}>{task.title}</Text>
                          {task.assetName ? <Text style={[mStyles.taskMeta, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>{task.assetName}</Text> : null}
                        </View>
                        <Text style={[mStyles.taskDate, { color: "#ef4444", fontFamily: "Inter_500Medium" }]}>Overdue</Text>
                      </View>
                    ))}
                    {next30Tasks.map((task) => (
                      <View key={task.id} style={[mStyles.taskRow, { backgroundColor: colors.muted + "60", borderColor: colors.border }]}>
                        <Feather name="tool" size={13} color={colors.mutedForeground} style={{ marginTop: 1 }} />
                        <View style={{ flex: 1 }}>
                          <Text style={[mStyles.taskTitle, { color: colors.foreground, fontFamily: "Inter_500Medium" }]}>{task.title}</Text>
                          {(task as any).assetName ? <Text style={[mStyles.taskMeta, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>{(task as any).assetName}</Text> : null}
                        </View>
                        <Text style={[mStyles.taskDate, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                          {formatDate(task.nextDueDate)}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>

              {/* Recently completed */}
              <View style={mStyles.section}>
                <View style={mStyles.sectionHeader}>
                  <Feather name="check-circle" size={14} color={colors.mutedForeground} />
                  <Text style={[mStyles.sectionTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
                    Recently Completed (last 60 days)
                  </Text>
                  <View style={[mStyles.badge, { backgroundColor: colors.muted }]}>
                    <Text style={[mStyles.badgeText, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>
                      {recentRecords.length}
                    </Text>
                  </View>
                </View>
                {recentRecords.length === 0 ? (
                  <Text style={[mStyles.emptyNote, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                    No maintenance logged in the past 60 days.
                  </Text>
                ) : (
                  <View style={{ gap: 6 }}>
                    {recentRecords.map((record) => (
                      <View key={record.id} style={[mStyles.taskRow, { backgroundColor: "#f0fdf4", borderColor: "#bbf7d0" }]}>
                        <Feather name="check-circle" size={13} color="#10b981" style={{ marginTop: 1 }} />
                        <View style={{ flex: 1 }}>
                          <Text style={[mStyles.taskTitle, { color: colors.foreground, fontFamily: "Inter_500Medium" }]}>{record.description}</Text>
                          {(record as any).assetName ? <Text style={[mStyles.taskMeta, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>{(record as any).assetName}</Text> : null}
                        </View>
                        <View style={{ alignItems: "flex-end" }}>
                          <Text style={[mStyles.taskDate, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>{formatDate(record.date)}</Text>
                          {record.cost != null && (
                            <Text style={[mStyles.taskDate, { color: "#10b981", fontFamily: "Inter_500Medium" }]}>
                              ${record.cost.toLocaleString()}
                            </Text>
                          )}
                        </View>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

const mStyles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.45)" },
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: "88%", minHeight: "50%" },
  handle: { width: 40, height: 4, borderRadius: 2, alignSelf: "center", marginTop: 10, marginBottom: 4 },
  sheetHeader: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  sheetTitle: { fontSize: 16 },
  sheetSub: { fontSize: 12, marginTop: 1 },
  closeBtn: { width: 30, height: 30, borderRadius: 99, alignItems: "center", justifyContent: "center" },
  scoreBanner: {
    flexDirection: "row", alignItems: "center", gap: 16,
    borderRadius: 14, borderWidth: 1, padding: 14,
  },
  scoreLeft: { alignItems: "center", minWidth: 48 },
  scoreNum: { fontSize: 32, lineHeight: 36 },
  scoreDenom: { fontSize: 11, marginTop: 1 },
  scoreLabel: { fontSize: 14 },
  scoreMeta: { fontSize: 12, marginTop: 2 },
  section: { gap: 8 },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 6 },
  sectionTitle: { fontSize: 13, flex: 1 },
  badge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 99 },
  badgeText: { fontSize: 11 },
  emptyNote: { fontSize: 12, fontStyle: "italic", paddingLeft: 4 },
  assetRow: { flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 10, borderWidth: 1, padding: 10 },
  assetName: { fontSize: 13 },
  assetMeta: { fontSize: 11, marginTop: 1 },
  assetScore: { fontSize: 17 },
  taskRow: { flexDirection: "row", alignItems: "flex-start", gap: 8, borderRadius: 10, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 8 },
  taskTitle: { fontSize: 13, lineHeight: 18 },
  taskMeta: { fontSize: 11, marginTop: 1 },
  taskDate: { fontSize: 11, marginTop: 1 },
});

// ---------------------------------------------------------------------------
// Property form modal (add + edit)
// ---------------------------------------------------------------------------

interface FormState {
  name: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  yearBuilt: string;
  sqft: string;
}

const BLANK_FORM: FormState = {
  name: "", address: "", city: "", state: "", zipCode: "", yearBuilt: "", sqft: "",
};

interface LookupResult {
  address: string;
  city: string | null;
  state: string | null;
  zipCode: string | null;
  yearBuilt: number | null;
  sqft: number | null;
}

interface PropertyFormModalProps {
  mode: "add" | "edit";
  property?: Property | null;
  visible: boolean;
  onClose: () => void;
  colors: ReturnType<typeof useColors>;
  insets: { bottom: number };
}

function PropertyFormModal({ mode, property, visible, onClose, colors, insets }: PropertyFormModalProps) {
  const queryClient = useQueryClient();
  const createProperty = useCreateProperty();
  const updateProperty = useUpdateProperty();
  const { getToken } = useAuth();

  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  const baseUrl = domain ? `https://${domain}` : "";

  const [form, setForm] = useState<FormState>(BLANK_FORM);
  const [saving, setSaving] = useState(false);

  // Address lookup state
  const [searchQuery, setSearchQuery] = useState("");
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupFilled, setLookupFilled] = useState(false);

  // Photo state
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoUploading, setPhotoUploading] = useState(false);

  // Populate form when opening for edit
  useEffect(() => {
    if (visible) {
      if (mode === "edit" && property) {
        const p = property as any;
        setForm({
          name: p.name ?? "",
          address: p.address ?? "",
          city: p.city ?? "",
          state: p.state ?? "",
          zipCode: p.zipCode ?? "",
          yearBuilt: p.yearBuilt != null ? String(p.yearBuilt) : "",
          sqft: p.sqft != null ? String(p.sqft) : "",
        });
        setPhotoUri(p.photoUrl ?? null);
        setPhotoUrl(p.photoUrl ?? null);
      } else {
        setForm(BLANK_FORM);
        setPhotoUri(null);
        setPhotoUrl(null);
      }
      setSaving(false);
      setPhotoUploading(false);
      setSearchQuery("");
      setLookupLoading(false);
      setLookupFilled(false);
    }
  }, [visible, mode, property?.id]);

  async function handleLookup() {
    const q = searchQuery.trim();
    if (!q) return;
    setLookupLoading(true);
    setLookupFilled(false);
    try {
      const token = await getToken();
      const res = await fetch(
        `${baseUrl}/api/properties/lookup?address=${encodeURIComponent(q)}`,
        {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        }
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as any;
        const msg =
          res.status === 404
            ? "No property found for that address. You can still fill in the details manually."
            : (body?.detail ?? "Could not look up the address. Please try again.");
        Alert.alert("Address not found", msg);
        return;
      }
      const data = (await res.json()) as LookupResult;
      setForm((prev) => ({
        name: prev.name || data.address,
        address: data.address,
        city: data.city ?? prev.city,
        state: data.state ?? prev.state,
        zipCode: data.zipCode ?? prev.zipCode,
        yearBuilt: data.yearBuilt != null ? String(data.yearBuilt) : prev.yearBuilt,
        sqft: data.sqft != null ? String(data.sqft) : prev.sqft,
      }));
      setLookupFilled(true);
    } catch {
      Alert.alert("Error", "Could not reach the server. Please check your connection.");
    } finally {
      setLookupLoading(false);
    }
  }

  async function uploadPickedAsset(asset: ImagePicker.ImagePickerAsset) {
    setPhotoUri(asset.uri);
    setPhotoUrl(null);
    setPhotoUploading(true);

    try {
      const token = await getToken();
      const fileName = asset.uri.split("/").pop() ?? "photo.jpg";
      const contentType = asset.mimeType ?? "image/jpeg";

      const urlRes = await fetch(`${baseUrl}/api/storage/uploads/request-url`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ name: fileName, size: asset.fileSize ?? 0, contentType }),
      });
      if (!urlRes.ok) throw new Error("Failed to get upload URL");
      const { uploadURL, objectPath } = await urlRes.json() as { uploadURL: string; objectPath: string };

      const blob = await (await fetch(asset.uri)).blob();
      await fetch(uploadURL, { method: "PUT", headers: { "Content-Type": contentType }, body: blob });

      setPhotoUrl(`${baseUrl}/api/storage${objectPath}`);
    } catch {
      Alert.alert("Upload failed", "Could not upload the photo. Please try again.");
      setPhotoUri(null);
      setPhotoUrl(null);
    } finally {
      setPhotoUploading(false);
    }
  }

  async function pickFromLibrary() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission required", "Please allow access to your photo library to add a property photo.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });
    if (result.canceled || !result.assets[0]) return;
    await uploadPickedAsset(result.assets[0]);
  }

  async function takePhoto() {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission required", "Please allow camera access to take a property photo.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });
    if (result.canceled || !result.assets[0]) return;
    await uploadPickedAsset(result.assets[0]);
  }

  function pickPhoto() {
    Alert.alert(
      "Add Property Photo",
      "Choose how you'd like to add a photo.",
      [
        { text: "Choose from Library", onPress: pickFromLibrary },
        { text: "Take Photo", onPress: takePhoto },
        { text: "Cancel", style: "cancel" },
      ],
    );
  }

  function removePhoto() {
    setPhotoUri(null);
    setPhotoUrl(null);
  }

  function set(key: keyof FormState, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    if (!form.name.trim() || !form.address.trim()) {
      Alert.alert("Required fields", "Please fill in the property name and address.");
      return;
    }
    if (photoUploading) {
      Alert.alert("Please wait", "Photo is still uploading. Please wait a moment.");
      return;
    }
    setSaving(true);
    try {
      // Build payload omitting blank optional fields — the API schema uses
      // optional (not nullable), so sending null fails Zod validation.
      const yearBuiltNum = form.yearBuilt ? parseInt(form.yearBuilt, 10) : NaN;
      const sqftNum = form.sqft ? parseInt(form.sqft, 10) : NaN;

      if (mode === "add") {
        // For create: omit blank optionals (API schema uses optional, not nullable)
        const createData = {
          name: form.name.trim(),
          address: form.address.trim(),
          ...(form.city.trim() ? { city: form.city.trim() } : {}),
          ...(form.state.trim() ? { state: form.state.trim() } : {}),
          ...(form.zipCode.trim() ? { zipCode: form.zipCode.trim() } : {}),
          ...(!isNaN(yearBuiltNum) && yearBuiltNum > 0 ? { yearBuilt: yearBuiltNum } : {}),
          ...(!isNaN(sqftNum) && sqftNum > 0 ? { sqft: sqftNum } : {}),
          ...(photoUrl ? { photoUrl } : {}),
        };
        await createProperty.mutateAsync({ data: createData });
        await queryClient.invalidateQueries({ queryKey: getListPropertiesQueryKey() });
      } else if (mode === "edit" && property?.id) {
        // For edit: send explicit null for blank optional fields so existing values are cleared
        const updateData: UpdatePropertyBody = {
          name: form.name.trim(),
          address: form.address.trim(),
          city: form.city.trim() || null,
          state: form.state.trim() || null,
          zipCode: form.zipCode.trim() || null,
          yearBuilt: !isNaN(yearBuiltNum) && yearBuiltNum > 0 ? yearBuiltNum : null,
          sqft: !isNaN(sqftNum) && sqftNum > 0 ? sqftNum : null,
          photoUrl: photoUrl ?? null,
        };
        await updateProperty.mutateAsync({ propertyId: property.id, data: updateData });
        await queryClient.invalidateQueries({ queryKey: getListPropertiesQueryKey() });
        await queryClient.invalidateQueries({ queryKey: getGetPropertyQueryKey(property.id) });
      }
      onClose();
    } catch {
      Alert.alert("Error", mode === "add" ? "Could not save property. Please try again." : "Could not update property. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  const inputStyle = [
    fStyles.input,
    { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground, fontFamily: "Inter_400Regular" },
  ];
  const labelStyle = [fStyles.label, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }];

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={fStyles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={fStyles.kvContainer}
        >
          <View style={[fStyles.sheet, { backgroundColor: colors.background, paddingBottom: insets.bottom + 8 }]}>
            {/* Handle */}
            <View style={[fStyles.handle, { backgroundColor: colors.border }]} />

            {/* Header */}
            <View style={[fStyles.header, { borderBottomColor: colors.border }]}>
              <View style={[fStyles.headerIcon, { backgroundColor: colors.primary + "18" }]}>
                <Feather name="home" size={16} color={colors.primary} />
              </View>
              <Text style={[fStyles.headerTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
                {mode === "add" ? "Add Property" : "Edit Property"}
              </Text>
              <TouchableOpacity onPress={onClose} style={[fStyles.closeBtn, { backgroundColor: colors.muted }]} activeOpacity={0.7}>
                <Feather name="x" size={16} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>

            {/* Form */}
            <ScrollView
              contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: 24 }}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {/* Address Search */}
              <View style={fStyles.field}>
                  <Text style={[fStyles.label, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>
                    Search Address
                  </Text>
                  <View style={fStyles.searchRow}>
                    <TextInput
                      style={[
                        fStyles.searchInput,
                        { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground, fontFamily: "Inter_400Regular" },
                      ]}
                      value={searchQuery}
                      onChangeText={setSearchQuery}
                      placeholder="e.g. 123 Main St, Austin, TX"
                      placeholderTextColor={colors.mutedForeground}
                      returnKeyType="search"
                      onSubmitEditing={handleLookup}
                      editable={!lookupLoading}
                    />
                    <TouchableOpacity
                      onPress={handleLookup}
                      style={[fStyles.searchBtn, { backgroundColor: colors.primary, opacity: lookupLoading || !searchQuery.trim() ? 0.6 : 1 }]}
                      activeOpacity={0.8}
                      disabled={lookupLoading || !searchQuery.trim()}
                    >
                      {lookupLoading ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <Feather name="search" size={17} color="#fff" />
                      )}
                    </TouchableOpacity>
                  </View>
                  {lookupFilled && (
                    <View style={[fStyles.filledBanner, { backgroundColor: colors.primary + "12", borderColor: colors.primary + "35" }]}>
                      <Feather name="check-circle" size={13} color={colors.primary} />
                      <Text style={[fStyles.filledText, { color: colors.primary, fontFamily: "Inter_500Medium" }]}>
                        Fields filled from public records — feel free to edit any of them.
                      </Text>
                    </View>
                  )}
                </View>

              {/* Name */}
              <View style={fStyles.field}>
                <Text style={labelStyle}>Property Name *</Text>
                <TextInput
                  style={inputStyle}
                  value={form.name}
                  onChangeText={(v) => set("name", v)}
                  placeholder="e.g. The Johnson Family Home"
                  placeholderTextColor={colors.mutedForeground}
                  returnKeyType="next"
                />
              </View>

              {/* Address */}
              <View style={fStyles.field}>
                <Text style={labelStyle}>Street Address *</Text>
                <TextInput
                  style={inputStyle}
                  value={form.address}
                  onChangeText={(v) => set("address", v)}
                  placeholder="123 Main St"
                  placeholderTextColor={colors.mutedForeground}
                  returnKeyType="next"
                />
              </View>

              {/* City + State */}
              <View style={fStyles.row}>
                <View style={[fStyles.field, { flex: 2 }]}>
                  <Text style={labelStyle}>City</Text>
                  <TextInput
                    style={inputStyle}
                    value={form.city}
                    onChangeText={(v) => set("city", v)}
                    placeholder="Austin"
                    placeholderTextColor={colors.mutedForeground}
                    returnKeyType="next"
                  />
                </View>
                <View style={[fStyles.field, { flex: 1 }]}>
                  <Text style={labelStyle}>State</Text>
                  <TextInput
                    style={inputStyle}
                    value={form.state}
                    onChangeText={(v) => set("state", v.toUpperCase())}
                    placeholder="TX"
                    placeholderTextColor={colors.mutedForeground}
                    maxLength={2}
                    autoCapitalize="characters"
                    returnKeyType="next"
                  />
                </View>
              </View>

              {/* ZIP */}
              <View style={fStyles.field}>
                <Text style={labelStyle}>ZIP Code</Text>
                <TextInput
                  style={inputStyle}
                  value={form.zipCode}
                  onChangeText={(v) => set("zipCode", v)}
                  placeholder="78701"
                  placeholderTextColor={colors.mutedForeground}
                  keyboardType="numeric"
                  maxLength={10}
                  returnKeyType="next"
                />
              </View>

              {/* Year Built + Sq Ft */}
              <View style={fStyles.row}>
                <View style={[fStyles.field, { flex: 1 }]}>
                  <Text style={labelStyle}>Year Built</Text>
                  <TextInput
                    style={inputStyle}
                    value={form.yearBuilt}
                    onChangeText={(v) => set("yearBuilt", v)}
                    placeholder="1990"
                    placeholderTextColor={colors.mutedForeground}
                    keyboardType="number-pad"
                    maxLength={4}
                    returnKeyType="next"
                  />
                </View>
                <View style={[fStyles.field, { flex: 1 }]}>
                  <Text style={labelStyle}>Sq Ft</Text>
                  <TextInput
                    style={inputStyle}
                    value={form.sqft}
                    onChangeText={(v) => set("sqft", v)}
                    placeholder="2000"
                    placeholderTextColor={colors.mutedForeground}
                    keyboardType="number-pad"
                    returnKeyType="done"
                  />
                </View>
              </View>

              {/* Photo */}
              <View style={fStyles.field}>
                <Text style={labelStyle}>Property Photo</Text>
                {photoUri ? (
                  <View style={fStyles.photoPreviewContainer}>
                    <Image
                      source={{ uri: photoUri }}
                      style={fStyles.photoPreview}
                      resizeMode="cover"
                    />
                    {photoUploading && (
                      <View style={fStyles.photoOverlay}>
                        <ActivityIndicator color="#fff" size="small" />
                        <Text style={fStyles.photoOverlayText}>Uploading…</Text>
                      </View>
                    )}
                    {!photoUploading && (
                      <View style={fStyles.photoActions}>
                        <TouchableOpacity
                          onPress={pickPhoto}
                          style={fStyles.photoActionBtn}
                          activeOpacity={0.8}
                        >
                          <Feather name="camera" size={13} color={colors.foreground} />
                          <Text style={[fStyles.photoActionText, { color: colors.foreground, fontFamily: "Inter_500Medium" }]}>Change</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={removePhoto}
                          style={[fStyles.photoActionBtn, { backgroundColor: "#fee2e2" }]}
                          activeOpacity={0.8}
                        >
                          <Feather name="trash-2" size={13} color="#ef4444" />
                          <Text style={[fStyles.photoActionText, { color: "#ef4444", fontFamily: "Inter_500Medium" }]}>Remove</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                ) : (
                  <TouchableOpacity
                    onPress={pickPhoto}
                    style={[fStyles.photoPlaceholder, { borderColor: colors.border, backgroundColor: colors.muted + "40" }]}
                    activeOpacity={0.7}
                  >
                    <Feather name="image" size={24} color={colors.mutedForeground} style={{ opacity: 0.6 }} />
                    <Text style={[fStyles.photoPlaceholderText, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
                      Tap to add a photo
                    </Text>
                    <Text style={[fStyles.photoPlaceholderSub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                      Optional — from your photo library
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </ScrollView>

            {/* Footer */}
            <View style={[fStyles.footer, { borderTopColor: colors.border }]}>
              <TouchableOpacity
                onPress={onClose}
                style={[fStyles.cancelBtn, { backgroundColor: colors.muted }]}
                activeOpacity={0.7}
                disabled={saving}
              >
                <Text style={[fStyles.cancelText, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSave}
                style={[fStyles.saveBtn, { backgroundColor: colors.primary, opacity: saving ? 0.7 : 1 }]}
                activeOpacity={0.8}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={[fStyles.saveText, { fontFamily: "Inter_600SemiBold" }]}>
                    {mode === "add" ? "Add Property" : "Save Changes"}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const fStyles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.45)" },
  kvContainer: { justifyContent: "flex-end" },
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: "92%" },
  handle: { width: 40, height: 4, borderRadius: 2, alignSelf: "center", marginTop: 10, marginBottom: 4 },
  header: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerIcon: { width: 32, height: 32, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 17, flex: 1 },
  closeBtn: { width: 30, height: 30, borderRadius: 99, alignItems: "center", justifyContent: "center" },
  field: { gap: 6 },
  row: { flexDirection: "row", gap: 10 },
  label: { fontSize: 11, letterSpacing: 0.5, textTransform: "uppercase" },
  input: {
    height: 44, borderWidth: 1, borderRadius: 10,
    paddingHorizontal: 12, fontSize: 15,
  },
  footer: {
    flexDirection: "row", gap: 10,
    paddingHorizontal: 20, paddingTop: 12, paddingBottom: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  cancelBtn: { flex: 1, height: 46, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  cancelText: { fontSize: 15 },
  saveBtn: { flex: 2, height: 46, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  saveText: { fontSize: 15, color: "#fff" },
  searchRow: { flexDirection: "row", gap: 8 },
  searchInput: {
    flex: 1, height: 44, borderWidth: 1, borderRadius: 10,
    paddingHorizontal: 12, fontSize: 15,
  },
  searchBtn: {
    width: 44, height: 44, borderRadius: 10,
    alignItems: "center", justifyContent: "center",
  },
  filledBanner: {
    flexDirection: "row", alignItems: "flex-start", gap: 6,
    borderRadius: 8, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 8, marginTop: 2,
  },
  filledText: { fontSize: 12, flex: 1, lineHeight: 16 },
  photoPlaceholder: {
    height: 110, borderRadius: 12, borderWidth: 1.5, borderStyle: "dashed",
    alignItems: "center", justifyContent: "center", gap: 6,
  },
  photoPlaceholderText: { fontSize: 14 },
  photoPlaceholderSub: { fontSize: 11, opacity: 0.7 },
  photoPreviewContainer: { borderRadius: 12, overflow: "hidden", height: 140 },
  photoPreview: { width: "100%", height: "100%" },
  photoOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center", justifyContent: "center", gap: 6,
  },
  photoOverlayText: { color: "#fff", fontSize: 12, fontFamily: "Inter_500Medium" },
  photoActions: {
    position: "absolute", bottom: 8, right: 8,
    flexDirection: "row", gap: 6,
  },
  photoActionBtn: {
    flexDirection: "row", alignItems: "center", gap: 5,
    backgroundColor: "#fff",
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 8,
  },
  photoActionText: { fontSize: 12 },
});

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

export default function PropertiesScreen() {
  const router = useRouter();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const { data: properties = [], isLoading } = useListProperties();
  const [healthModalId, setHealthModalId] = useState<string | null>(null);

  // Form modal state
  const [formMode, setFormMode] = useState<"add" | "edit">("add");
  const [formVisible, setFormVisible] = useState(false);
  const [editingProperty, setEditingProperty] = useState<Property | null>(null);

  function openAdd() {
    setFormMode("add");
    setEditingProperty(null);
    setFormVisible(true);
  }

  function openEdit(property: Property) {
    setFormMode("edit");
    setEditingProperty(property);
    setFormVisible(true);
  }

  const selectedProperty = healthModalId ? properties.find((p) => p.id === healthModalId) : null;
  const selectedName = selectedProperty
    ? ((selectedProperty as any).name ?? (selectedProperty as any).address ?? "My Home")
    : "";

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad, borderBottomColor: colors.border, backgroundColor: colors.background }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <Feather name="chevron-left" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <View style={[styles.headerIcon, { backgroundColor: colors.primary + "15" }]}>
            <Feather name="home" size={16} color={colors.primary} />
          </View>
          <Text style={[styles.headerTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
            My Properties
          </Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <View style={[styles.countChip, { backgroundColor: colors.muted }]}>
            <Text style={[styles.countText, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>
              {properties.length}
            </Text>
          </View>
          <TouchableOpacity
            onPress={openAdd}
            style={[styles.addHeaderBtn, { backgroundColor: colors.primary + "18" }]}
            activeOpacity={0.7}
          >
            <Feather name="plus" size={18} color={colors.primary} />
          </TouchableOpacity>
        </View>
      </View>

      {isLoading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : properties.length === 0 ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 16, paddingHorizontal: 32 }}>
          <View style={[styles.emptyIcon, { backgroundColor: colors.muted }]}>
            <Feather name="home" size={36} color={colors.mutedForeground} style={{ opacity: 0.5 }} />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
            No properties yet
          </Text>
          <Text style={[styles.emptySub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
            Add your first home to start tracking assets and maintenance.
          </Text>
          <TouchableOpacity
            onPress={openAdd}
            style={[styles.emptyAddBtn, { backgroundColor: colors.primary }]}
            activeOpacity={0.8}
          >
            <Feather name="plus" size={16} color="#fff" />
            <Text style={[styles.emptyAddText, { fontFamily: "Inter_600SemiBold" }]}>Add Property</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 100, gap: 12 }}
          showsVerticalScrollIndicator={false}
        >
          {properties.map((property) => {
            const sp = property as any;
            const name = sp.name ?? sp.address ?? "My Home";
            const addressLine = [sp.address, sp.city, sp.state].filter(Boolean).join(", ");
            const specs: string[] = [];
            if (sp.yearBuilt) specs.push(`Built ${sp.yearBuilt}`);
            if (sp.sqft) specs.push(`${Number(sp.sqft).toLocaleString()} sqft`);
            if (sp.bedrooms) specs.push(`${sp.bedrooms} bd`);
            if (sp.bathrooms) specs.push(`${sp.bathrooms} ba`);
            const photoUrl: string | undefined = sp.photoUrl;

            return (
              <View key={property.id} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                {/* Card top */}
                <View style={styles.cardTop}>
                  {/* Photo or icon */}
                  {photoUrl ? (
                    <Image
                      source={{ uri: photoUrl }}
                      style={styles.cardPhoto}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={[styles.cardIcon, { backgroundColor: colors.primary + "15" }]}>
                      <Feather name="home" size={20} color={colors.primary} />
                    </View>
                  )}

                  {/* Name + address */}
                  <View style={{ flex: 1, gap: 3 }}>
                    <Text style={[styles.cardName, { color: colors.foreground, fontFamily: "Inter_700Bold" }]} numberOfLines={1}>
                      {name}
                    </Text>
                    {addressLine ? (
                      <View style={styles.addrRow}>
                        <Feather name="map-pin" size={11} color={colors.mutedForeground} />
                        <Text style={[styles.addrText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]} numberOfLines={1}>
                          {addressLine}
                        </Text>
                      </View>
                    ) : null}
                  </View>

                  {/* Health score ring */}
                  <HealthScoreRing
                    propertyId={property.id}
                    onPress={() => setHealthModalId(property.id)}
                    colors={colors}
                  />
                </View>

                {/* Specs row + Edit button */}
                <View style={[styles.cardFooter, { borderTopColor: colors.border }]}>
                  <View style={styles.specsRow}>
                    {specs.map((spec, i) => (
                      <React.Fragment key={spec}>
                        {i > 0 && <View style={[styles.specDot, { backgroundColor: colors.mutedForeground }]} />}
                        <Text style={[styles.specText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                          {spec}
                        </Text>
                      </React.Fragment>
                    ))}
                  </View>
                  <TouchableOpacity
                    onPress={() => openEdit(property)}
                    style={[styles.editBtn, { backgroundColor: colors.muted }]}
                    activeOpacity={0.7}
                  >
                    <Feather name="edit-2" size={12} color={colors.mutedForeground} />
                    <Text style={[styles.editText, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
                      Edit
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}

      {/* FAB — Add Property */}
      {properties.length > 0 && (
        <TouchableOpacity
          onPress={openAdd}
          style={[styles.fab, { backgroundColor: colors.primary, bottom: insets.bottom + 24 }]}
          activeOpacity={0.85}
        >
          <Feather name="plus" size={22} color="#fff" />
          <Text style={[styles.fabText, { fontFamily: "Inter_600SemiBold" }]}>Add Property</Text>
        </TouchableOpacity>
      )}

      {/* Health modal */}
      {healthModalId && selectedProperty && (
        <PropertyHealthModal
          propertyId={healthModalId}
          propertyName={selectedName}
          visible={!!healthModalId}
          onClose={() => setHealthModalId(null)}
          colors={colors}
          insets={insets}
        />
      )}

      {/* Add / Edit form modal */}
      <PropertyFormModal
        mode={formMode}
        property={editingProperty}
        visible={formVisible}
        onClose={() => setFormVisible(false)}
        colors={colors}
        insets={insets}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 16, paddingBottom: 12,
    borderBottomWidth: 1, gap: 10,
  },
  backBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  headerCenter: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8 },
  headerIcon: { width: 30, height: 30, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 18 },
  countChip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 99 },
  countText: { fontSize: 13 },
  addHeaderBtn: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  emptyIcon: { width: 80, height: 80, borderRadius: 24, alignItems: "center", justifyContent: "center" },
  emptyTitle: { fontSize: 18 },
  emptySub: { fontSize: 13, textAlign: "center", lineHeight: 19 },
  emptyAddBtn: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12 },
  emptyAddText: { fontSize: 15, color: "#fff" },
  card: { borderRadius: 14, borderWidth: 1, overflow: "hidden" },
  cardTop: { flexDirection: "row", alignItems: "center", gap: 12, padding: 16 },
  cardPhoto: { width: 52, height: 52, borderRadius: 12 },
  cardIcon: { width: 52, height: 52, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  cardName: { fontSize: 16 },
  addrRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  addrText: { fontSize: 12, flex: 1 },
  cardFooter: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 16, paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  specsRow: {
    flex: 1,
    flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 6,
  },
  specDot: { width: 3, height: 3, borderRadius: 99, opacity: 0.4 },
  specText: { fontSize: 12 },
  editBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  editText: { fontSize: 12 },
  fab: {
    position: "absolute",
    right: 20,
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingHorizontal: 20, paddingVertical: 14,
    borderRadius: 30,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 6,
  },
  fabText: { fontSize: 15, color: "#fff" },
});
