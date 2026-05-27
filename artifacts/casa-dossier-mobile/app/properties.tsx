import React, { useState, useEffect } from "react";
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
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import {
  useListProperties,
  useGetPropertySummary,
  getGetPropertySummaryQueryKey,
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
// Main screen
// ---------------------------------------------------------------------------

export default function PropertiesScreen() {
  const router = useRouter();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const { data: properties = [], isLoading } = useListProperties();
  const [healthModalId, setHealthModalId] = useState<string | null>(null);

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
        <View style={[styles.countChip, { backgroundColor: colors.muted }]}>
          <Text style={[styles.countText, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>
            {properties.length}
          </Text>
        </View>
      </View>

      {isLoading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : properties.length === 0 ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 12, paddingHorizontal: 32 }}>
          <View style={[styles.emptyIcon, { backgroundColor: colors.muted }]}>
            <Feather name="home" size={36} color={colors.mutedForeground} style={{ opacity: 0.5 }} />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
            No properties yet
          </Text>
          <Text style={[styles.emptySub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
            Add your home in the web app to start tracking assets and maintenance.
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 32, gap: 12 }}
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

                {/* Specs row */}
                {specs.length > 0 && (
                  <View style={[styles.specsRow, { borderTopColor: colors.border }]}>
                    {specs.map((spec, i) => (
                      <React.Fragment key={spec}>
                        {i > 0 && <View style={[styles.specDot, { backgroundColor: colors.mutedForeground }]} />}
                        <Text style={[styles.specText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                          {spec}
                        </Text>
                      </React.Fragment>
                    ))}
                  </View>
                )}
              </View>
            );
          })}

          <Text style={[styles.hint, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
            To add or edit properties, visit the web app.
          </Text>
        </ScrollView>
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
  emptyIcon: { width: 80, height: 80, borderRadius: 24, alignItems: "center", justifyContent: "center" },
  emptyTitle: { fontSize: 18 },
  emptySub: { fontSize: 13, textAlign: "center", lineHeight: 19 },
  card: { borderRadius: 14, borderWidth: 1, overflow: "hidden" },
  cardTop: { flexDirection: "row", alignItems: "center", gap: 12, padding: 16 },
  cardPhoto: { width: 52, height: 52, borderRadius: 12 },
  cardIcon: { width: 52, height: 52, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  cardName: { fontSize: 16 },
  addrRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  addrText: { fontSize: 12, flex: 1 },
  specsRow: {
    flexDirection: "row", alignItems: "center", flexWrap: "wrap",
    gap: 6, paddingHorizontal: 16, paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth,
  },
  specDot: { width: 3, height: 3, borderRadius: 99, opacity: 0.4 },
  specText: { fontSize: 12 },
  hint: { textAlign: "center", fontSize: 12, marginTop: 4 },
});
