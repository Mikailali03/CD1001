import React, { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { PropertyFormModal } from "@/components/PropertyFormModal";
import {
  View,
  Text,
  ScrollView,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import {
  useGetPropertySummary,
  getGetInboxQueryKey,
  getGetPropertyMaintenanceInboxQueryKey,
  getGetPropertySummaryQueryKey,
  getListPropertiesQueryKey,
  getListMarketplaceJobsQueryKey,
} from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { MaintenanceInbox } from "@/components/MaintenanceInbox";
import { HealthScoreModal } from "@/components/HealthScoreModal";
import { PendingInvitesSheet, type Inbox } from "@/components/PendingInvitesSheet";
import { EmptyState } from "@/components/EmptyState";
import { ActiveServiceRequests } from "@/components/home/ActiveServiceRequests";
import { ActivityRow } from "@/components/home/ActivityRow";
import { HealthScoreWidget, type Grade } from "@/components/home/HealthScoreWidget";
import { InviteBanner } from "@/components/home/InviteBanner";
import { LedgerCard } from "@/components/home/LedgerCard";
import { NoPropertyView } from "@/components/home/NoPropertyView";
import { PropertyHeader } from "@/components/home/PropertyHeader";
import { SectionHeader } from "@/components/home/SectionHeader";
import { Skeleton } from "@/components/home/Skeleton";
import { StatCard, statStyles } from "@/components/home/StatCard";
import { useInbox } from "@/context/InboxContext";
import { useSelectedProperty } from "@/context/PropertyContext";
import * as Haptics from "expo-haptics";
import { useTranslation } from "react-i18next";

// ── Main Dashboard ─────────────────────────────────────────────────────────────
export default function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const [refreshing, setRefreshing] = useState(false);
  const [healthModalOpen, setHealthModalOpen] = useState(false);
  const [invitesSheetOpen, setInvitesSheetOpen] = useState(false);
  const [addPropertyOpen, setAddPropertyOpen] = useState(false);

  // Pending invites (shared query from InboxContext)
  const inbox = useInbox();

  // After an accept/decline: show the change immediately, then re-sync with the server
  const handleInboxChange = (updated: Inbox) => {
    queryClient.setQueryData(getGetInboxQueryKey(), updated);
    queryClient.invalidateQueries({ queryKey: getGetInboxQueryKey() });
    if (updated.transfers.length + updated.collaboratorInvites.length === 0) {
      setInvitesSheetOpen(false);
    }
  };

  const {
    properties,
    selectedProperty,
    setSelectedPropertyId,
    isLoading: propsLoading,
    isError: propsError,
    refetch: refetchProperties,
  } = useSelectedProperty();

  const { data: summary, isLoading: summaryLoading } = useGetPropertySummary(
    selectedProperty?.id ?? "",
    { query: { enabled: !!selectedProperty?.id, queryKey: getGetPropertySummaryQueryKey(selectedProperty?.id ?? "") } }
  );

  const onRefresh = async () => {
    setRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const propertyId = selectedProperty?.id;
    await Promise.all([
      // Only what the dashboard shows: properties, summary, inbox, maintenance and jobs
      queryClient.invalidateQueries({ queryKey: getListPropertiesQueryKey() }),
      ...(propertyId
        ? [
            queryClient.invalidateQueries({ queryKey: getGetPropertySummaryQueryKey(propertyId) }),
            queryClient.invalidateQueries({ queryKey: getGetPropertyMaintenanceInboxQueryKey(propertyId) }),
          ]
        : []),
      queryClient.invalidateQueries({ queryKey: getGetInboxQueryKey() }),
      queryClient.invalidateQueries({ queryKey: getListMarketplaceJobsQueryKey() }),
      new Promise((r) => setTimeout(r, 600)),
    ]);
    setRefreshing(false);
  };

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const isLoading = propsLoading;

  // Extract data
  const s = summary;
  const healthScore = s?.healthScore ?? 0;
  const healthGrade: Grade = s?.healthGrade ?? "C";
  const totalAssets = s?.totalAssets ?? 0;
  const verifiedAssets = s?.verifiedAssets ?? 0;
  const overdueCount = s?.overdueTaskCount ?? 0;
  const assetsByCategory = s?.assetsByCategory ?? [];
  const recentRecords = s?.recentRecords ?? [];
  const overdueTasks = s?.overdueTasks ?? [];
  const assetScores = s?.assetScores ?? [];

  if (isLoading) {
    return (
      <View style={[{ flex: 1, backgroundColor: colors.background, paddingTop: topPad + 20, paddingHorizontal: 20, gap: 16 }]}>
        <Skeleton height={28} width="60%" colors={colors} />
        <Skeleton height={90} borderRadius={12} colors={colors} />
        <View style={{ flexDirection: "row", gap: 10 }}>
          <Skeleton height={80} width="31%" borderRadius={12} colors={colors} />
          <Skeleton height={80} width="31%" borderRadius={12} colors={colors} />
          <Skeleton height={80} width="31%" borderRadius={12} colors={colors} />
        </View>
        <Skeleton height={100} borderRadius={12} colors={colors} />
      </View>
    );
  }

  // A failed load isn't the same as having no properties — offer a retry instead of "No property yet"
  if (propsError && properties.length === 0) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: topPad }}>
        <EmptyState
          icon="wifi-off"
          title={t("home.loadFailed")}
          description={t("common.checkConnection")}
          actionLabel={t("common.retry")}
          onAction={() => { Haptics.selectionAsync(); refetchProperties(); }}
        />
      </View>
    );
  }

  if (properties.length === 0) {
    const emptyPendingCount = inbox.transfers.length + inbox.collaboratorInvites.length;
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <PendingInvitesSheet
          visible={invitesSheetOpen}
          inbox={inbox}
          onClose={() => setInvitesSheetOpen(false)}
          onInboxChange={handleInboxChange}
        />
        <NoPropertyView
          pendingCount={emptyPendingCount}
          onOpenInvites={() => setInvitesSheetOpen(true)}
          onAddProperty={() => setAddPropertyOpen(true)}
          colors={colors}
        />
        <PropertyFormModal
          mode="add"
          visible={addPropertyOpen}
          onClose={() => setAddPropertyOpen(false)}
          colors={colors}
          insets={insets}
        />
      </View>
    );
  }

  const pendingInviteCount = inbox.transfers.length + inbox.collaboratorInvites.length;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
    <HealthScoreModal
      visible={healthModalOpen}
      onClose={() => setHealthModalOpen(false)}
      healthScore={healthScore}
      healthGrade={healthGrade}
      overdueTaskCount={overdueCount}
      overdueTasks={overdueTasks}
      assetScores={assetScores}
      propertyId={selectedProperty?.id ?? ""}
    />
    <PendingInvitesSheet
      visible={invitesSheetOpen}
      inbox={inbox}
      onClose={() => setInvitesSheetOpen(false)}
      onInboxChange={handleInboxChange}
    />
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      showsVerticalScrollIndicator={false}
    >
      <View style={{ paddingTop: topPad + 8, paddingHorizontal: 20 }}>

        {/* Property selector chips */}
        {properties.length > 1 && (
          <FlatList
            horizontal
            data={properties}
            extraData={selectedProperty?.id}
            keyExtractor={(p) => p.id}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8, paddingBottom: 14 }}
            renderItem={({ item }) => {
              const isSelected = item.id === selectedProperty?.id;
              return (
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                  style={[chipStyles.chip, {
                    backgroundColor: isSelected ? colors.primary : colors.card,
                    borderColor: isSelected ? colors.primary : colors.border,
                  }]}
                  onPress={() => { setSelectedPropertyId(item.id); Haptics.selectionAsync(); }}
                >
                  <Feather name="home" size={12} color={isSelected ? colors.primaryForeground : colors.mutedForeground} />
                  <Text style={[chipStyles.chipText, {
                    color: isSelected ? colors.primaryForeground : colors.foreground,
                    fontFamily: "Inter_500Medium",
                  }]} numberOfLines={1}>
                    {item.name || item.address || t("home.propertyFallback")}
                  </Text>
                </TouchableOpacity>
              );
            }}
          />
        )}

        {/* Pending invites banner */}
        {pendingInviteCount > 0 && (
          <InviteBanner count={pendingInviteCount} onPress={() => setInvitesSheetOpen(true)} colors={colors} />
        )}

        {/* Property header */}
        {selectedProperty && (
          <PropertyHeader
            property={selectedProperty}
            colors={colors}
            onViewAll={() => { Haptics.selectionAsync(); router.push("/properties"); }}
          />
        )}

        {/* Active service requests */}
        <ActiveServiceRequests
          colors={colors}
          onJobPress={(id) => router.push(`/job/${id}`)}
          propertyId={selectedProperty?.id}
        />

        {/* Maintenance inbox */}
        {selectedProperty && (
          <View style={{ marginBottom: 16 }}>
            <MaintenanceInbox
              propertyId={selectedProperty.id}
              insetBottom={insets.bottom}
            />
          </View>
        )}

        {/* Health score widget */}
        {summaryLoading ? (
          <Skeleton height={86} borderRadius={12} colors={colors} />
        ) : (
          <TouchableOpacity
            onPress={() => { Haptics.selectionAsync(); setHealthModalOpen(true); }}
            activeOpacity={0.88}
          >
            <HealthScoreWidget score={healthScore} grade={healthGrade} overdueCount={overdueCount} />
          </TouchableOpacity>
        )}

        {/* 3 stat cards */}
        <View style={{ flexDirection: "row", gap: 10, marginBottom: 12 }}>
          <StatCard
            title={t("home.stats.trackedAssets")}
            value={totalAssets}
            icon="package"
            sub={t("home.stats.verifiedOf", { verified: verifiedAssets, total: totalAssets })}
            colors={colors}
          />
          <StatCard
            title={t("home.stats.overdueTasks")}
            value={overdueCount}
            icon="alert-circle"
            valueColor={overdueCount > 0 ? colors.destructive : colors.foreground}
            sub={overdueCount > 0 ? t("home.seeImprovementPlan") : t("home.stats.allClear")}
            colors={colors}
          />
          <View style={[statStyles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={statStyles.header}>
              <Text style={[statStyles.title, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
                {t("home.stats.bySystem")}
              </Text>
            </View>
            {assetsByCategory.slice(0, 2).map((cat) => (
              <View key={cat.category} style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 3 }}>
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.primary }} />
                <Text style={{ fontSize: 10, color: colors.mutedForeground, fontFamily: "Inter_400Regular" }} numberOfLines={1}>
                  {t(`categories.${cat.category}`, { defaultValue: cat.category })} {cat.count}
                </Text>
              </View>
            ))}
            {assetsByCategory.length === 0 && (
              <Text style={{ fontSize: 10, color: colors.mutedForeground, fontFamily: "Inter_400Regular" }}>
                —
              </Text>
            )}
          </View>
        </View>

        {/* Investment Ledger card */}
        <View style={{ marginBottom: 20 }}>
          <LedgerCard
            colors={colors}
            onPress={() => {
              Haptics.selectionAsync();
              router.push("/investment-ledger");
            }}
          />
        </View>

        {/* Recent Service Activity */}
        {recentRecords.length > 0 && (
          <View style={[sectionStyles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <SectionHeader title={t("home.recentActivity")} colors={colors} />
            {recentRecords.slice(0, 5).map((record) => (
              <ActivityRow
                key={record.id}
                description={record.description}
                assetName={record.assetName}
                companyName={record.companyName ?? record.technicianName}
                date={record.date}
                colors={colors}
              />
            ))}
          </View>
        )}

        {/* No activity empty state */}
        {!summaryLoading && recentRecords.length === 0 && (
          <View style={[sectionStyles.card, { backgroundColor: colors.card, borderColor: colors.border, alignItems: "center", paddingVertical: 32 }]}>
            <Feather name="file-text" size={36} color={colors.mutedForeground} style={{ opacity: 0.25, marginBottom: 10 }} />
            <Text style={{ fontSize: 13, color: colors.foreground, fontFamily: "Inter_500Medium" }}>
              {t("home.noRecords")}
            </Text>
            <Text style={{ fontSize: 11, color: colors.mutedForeground, fontFamily: "Inter_400Regular", textAlign: "center", marginTop: 4, maxWidth: 220 }}>
              {t("home.noRecordsDesc")}
            </Text>
          </View>
        )}
      </View>
    </ScrollView>
    </View>
  );
}

const chipStyles = StyleSheet.create({
  chip: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1 },
  chipText: { fontSize: 13 },
});

const sectionStyles = StyleSheet.create({
  card: { borderRadius: 12, borderWidth: 1, padding: 16, marginBottom: 16 },
});
