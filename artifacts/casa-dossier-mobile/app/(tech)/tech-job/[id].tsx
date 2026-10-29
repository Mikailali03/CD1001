import React, { useEffect, useState } from "react";
import { Alert, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { useTranslation } from "react-i18next";
import {
  getGetMarketplaceJobDetailsQueryKey,
  useAcceptMarketplaceJob,
  useCompleteMarketplaceJob,
  useGetMarketplaceJobDetails,
  useMarkJobArrived,
  useMarkJobEnRoute,
  useScheduleMarketplaceJob,
} from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { apiErrorMessage, apiErrorStatus, useRole } from "@/hooks/useRole";
import { EmptyState } from "@/components/EmptyState";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { JobInfoSections } from "@/components/tech/job/JobInfoSections";
import { JobProgressActions } from "@/components/tech/job/JobProgressActions";
import { JobScheduleSection } from "@/components/tech/job/JobScheduleSection";
import { JobStatusBanner } from "@/components/tech/job/JobStatusBanner";
import {
  scheduleValueFromIso,
  scheduleValueToDate,
  type ScheduleValue,
} from "@/components/tech/SchedulePicker";
import { TECH_HOME } from "@/components/tech/routes";
import {
  ACTIVE_STATUSES,
  Button,
  Chip,
  Notice,
  Section,
  ServiceHistoryList,
  Skeleton,
  fmtDate,
  isSameLocalDay,
  ui,
  urgencyOf,
  useFlash,
  useInvalidateTechJobs,
  useRefetchRoleOn403,
  useTopPad,
} from "@/components/tech/ui";

export default function TechJobScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPad = useTopPad();
  const qc = useQueryClient();
  const invalidate = useInvalidateTechJobs();
  const { id } = useLocalSearchParams<{ id: string }>();
  const jobId = typeof id === "string" ? id : "";
  const { profile, canUseTechApp } = useRole();
  const { flash, show: showFlash } = useFlash();

  const [actionError, setActionError] = useState<string | null>(null);
  const [schedule, setSchedule] = useState<ScheduleValue>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [showCompletion, setShowCompletion] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const detailsKey = getGetMarketplaceJobDetailsQueryKey(jobId);
  const detail = useGetMarketplaceJobDetails(jobId, {
    query: {
      queryKey: detailsKey,
      enabled: !!jobId,
      retry: (n, err) => {
        const s = apiErrorStatus(err);
        return s !== 403 && s !== 404 && n < 1;
      },
    },
  });
  useRefetchRoleOn403(detail.error);

  const job = detail.data;
  const status: string = job?.status ?? "open";
  const isMine = !!job?.technicianId && job.technicianId === profile?.userId;
  const isActiveMine = isMine && ACTIVE_STATUSES.has(status);
  const hasSchedule = !!job?.scheduledAt;
  const appointmentToday = isSameLocalDay(job?.scheduledAt);

  // Seed the picker from the saved date; open it straight away when none is set.
  useEffect(() => {
    if (!job) return;
    setSchedule(scheduleValueFromIso(job.scheduledAt));
    setPickerOpen(!job.scheduledAt);
  }, [job?.id, job?.scheduledAt]); // eslint-disable-line react-hooks/exhaustive-deps

  function onActionError(err: unknown, fallback: string) {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    setActionError(apiErrorMessage(err) ?? fallback);
  }

  const acceptMutation = useAcceptMarketplaceJob({
    mutation: {
      onSuccess: (data) => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        // The accept response already includes the revealed address and phone.
        qc.setQueryData(detailsKey, data);
        invalidate(jobId);
        showFlash(
          data.contactPhone
            ? t("tech.jobScreen.acceptedContact", { phone: data.contactPhone })
            : t("tech.jobScreen.acceptedNoPhone"),
          t("tech.jobScreen.acceptedTitle"),
        );
      },
      onError: (err) => {
        const s = apiErrorStatus(err);
        onActionError(err, t("tech.jobScreen.acceptError"));
        if (s === 404) invalidate(jobId);
      },
    },
  });

  const scheduleMutation = useScheduleMarketplaceJob({
    mutation: {
      onSuccess: (data) => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        invalidate(jobId);
        setPickerOpen(false);
        const friendly = fmtDate(data.scheduledAt, t("tech.dateFormats.dateTime")) ?? t("tech.jobScreen.confirmed");
        showFlash(t("tech.jobScreen.scheduledFlash", { date: friendly }), t("tech.jobScreen.scheduledTitle"));
      },
      onError: (err) => onActionError(err, t("tech.jobScreen.scheduleError")),
    },
  });

  const enRouteMutation = useMarkJobEnRoute({
    mutation: {
      onSuccess: () => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        invalidate(jobId);
        showFlash(t("tech.jobScreen.enRouteFlash"), t("tech.jobScreen.statusUpdated"));
      },
      onError: (err) => onActionError(err, t("tech.jobScreen.statusError")),
    },
  });

  const arrivedMutation = useMarkJobArrived({
    mutation: {
      onSuccess: () => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        invalidate(jobId);
        showFlash(t("tech.jobScreen.arrivedFlash"), t("tech.jobScreen.arrivedTitle"));
      },
      onError: (err) => onActionError(err, t("tech.jobScreen.statusError")),
    },
  });

  const completeMutation = useCompleteMarketplaceJob({
    mutation: {
      onSuccess: () => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        invalidate(jobId);
        setShowCompletion(false);
        Alert.alert(
          t("tech.jobScreen.completedTitle"),
          t("tech.jobScreen.completedBody"),
          [{ text: t("common.done"), onPress: () => (router.canGoBack() ? router.back() : router.replace(TECH_HOME)) }],
        );
      },
      onError: (err) => onActionError(err, t("tech.jobScreen.completeError")),
    },
  });

  const busy =
    acceptMutation.isPending ||
    scheduleMutation.isPending ||
    enRouteMutation.isPending ||
    arrivedMutation.isPending ||
    completeMutation.isPending;

  function confirmAccept() {
    setActionError(null);
    Alert.alert(
      t("tech.jobScreen.acceptConfirmTitle"),
      t("tech.jobScreen.acceptConfirmBody"),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("tech.jobScreen.acceptJob"),
          onPress: () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            acceptMutation.mutate({ jobId });
          },
        },
      ],
    );
  }

  function saveSchedule() {
    if (!schedule) return;
    setActionError(null);
    const when = scheduleValueToDate(schedule);
    const doSave = () => scheduleMutation.mutate({ jobId, data: { scheduledAt: when.toISOString() } });
    if (when < new Date()) {
      Alert.alert(t("tech.jobScreen.pastTitle"), t("tech.jobScreen.pastBody"), [
        { text: t("common.cancel"), style: "cancel" },
        { text: t("tech.jobScreen.scheduleAnyway"), onPress: doSave },
      ]);
    } else {
      doSave();
    }
  }

  function confirmEnRoute() {
    setActionError(null);
    Alert.alert(t("tech.jobScreen.headingOutTitle"), t("tech.jobScreen.headingOutBody"), [
      { text: t("common.cancel"), style: "cancel" },
      { text: t("tech.progress.onTheWay"), onPress: () => enRouteMutation.mutate({ jobId }) },
    ]);
  }

  function confirmArrived() {
    setActionError(null);
    Alert.alert(t("tech.jobScreen.arrivedConfirmTitle"), t("tech.jobScreen.arrivedConfirmBody"), [
      { text: t("common.cancel"), style: "cancel" },
      { text: t("tech.progress.arrived"), onPress: () => arrivedMutation.mutate({ jobId }) },
    ]);
  }

  async function onRefresh() {
    setRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await detail.refetch();
    setRefreshing(false);
  }

  const uc = urgencyOf(job?.urgency);
  const errStatus = apiErrorStatus(detail.error);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad, borderBottomColor: colors.border, backgroundColor: colors.background }]}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={t("common.goBack")}
          hitSlop={8}
          onPress={() => (router.canGoBack() ? router.back() : router.replace(TECH_HOME))}
          style={styles.backBtn}
          activeOpacity={0.7}
        >
          <Feather name="chevron-left" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <View style={{ flex: 1, gap: 1 }}>
          <Text accessibilityRole="header" numberOfLines={1} style={[styles.headerTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
            {job?.assetName ?? t("tech.jobScreen.serviceRequest")}
          </Text>
          {job && (
            <Text style={[styles.headerSub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              {t("tech.jobScreen.posted", { date: fmtDate(job.createdAt, "MMM d, yyyy") })}
            </Text>
          )}
        </View>
        {job && <Chip label={uc.label} color={uc.color} icon={uc.icon} />}
      </View>

      {detail.isPending && !!jobId ? (
        <View style={{ padding: 20, gap: 14 }} accessible accessibilityRole="progressbar" accessibilityLabel={t("tech.jobScreen.loading")}>
          <Skeleton height={70} radius={12} />
          <Skeleton height={90} radius={12} />
          <Skeleton height={130} radius={12} />
          <Skeleton height={60} radius={12} />
        </View>
      ) : !job ? (
        errStatus === 404 || !jobId ? (
          <EmptyState
            icon="slash"
            title={t("tech.jobScreen.unavailableTitle")}
            description={t("tech.jobScreen.unavailableDesc")}
            actionLabel={t("tech.jobScreen.browseOpen")}
            onAction={() => router.replace(TECH_HOME)}
          />
        ) : errStatus === 403 ? (
          <EmptyState
            icon="lock"
            title={t("tech.accessRequired.title")}
            description={t("tech.accessRequired.revoked")}
          />
        ) : (
          <EmptyState
            icon="alert-triangle"
            title={t("tech.jobScreen.loadError")}
            description={apiErrorMessage(detail.error) ?? t("common.checkConnection")}
            actionLabel={t("common.retry")}
            onAction={() => detail.refetch()}
          />
        )
      ) : (
        <KeyboardAwareScrollViewCompat
          contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 40, gap: 14 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        >
          <JobStatusBanner job={job} status={status} isMine={isMine} hasSchedule={hasSchedule} />

          <JobInfoSections job={job} isMine={isMine} />

          {/* Service history (newest first) */}
          {job.serviceHistory && job.serviceHistory.length > 0 && (
            <Section icon="clock" title={t("tech.jobScreen.serviceHistory", { count: job.serviceHistory.length })}>
              <ServiceHistoryList records={[...job.serviceHistory].reverse()} limit={isMine ? 4 : 3} />
            </Section>
          )}

          {job.acceptedAt && isMine ? (
            <Text style={[ui.muted, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              {t("tech.jobScreen.accepted", { date: fmtDate(job.acceptedAt, "MMM d, yyyy") })}
            </Text>
          ) : null}

          {flash && <Notice tone="success" title={flash.title} message={flash.message} />}
          {actionError && <Notice tone="error" message={actionError} />}

          {/* ── Actions ── */}
          {status === "open" && !isMine && (
            canUseTechApp ? (
              <Button
                label={acceptMutation.isPending ? t("tech.jobScreen.accepting") : t("tech.jobScreen.acceptThis")}
                icon="check-circle"
                onPress={confirmAccept}
                loading={acceptMutation.isPending}
                disabled={busy}
              />
            ) : (
              <Notice tone="info" message={t("tech.jobScreen.accessToAccept")} />
            )
          )}

          {isActiveMine && (
            <JobScheduleSection
              job={job}
              hasSchedule={hasSchedule}
              pickerOpen={pickerOpen}
              schedule={schedule}
              onChange={setSchedule}
              onSave={saveSchedule}
              onCancel={() => {
                setSchedule(scheduleValueFromIso(job.scheduledAt));
                setPickerOpen(false);
              }}
              onOpenPicker={() => setPickerOpen(true)}
              saving={scheduleMutation.isPending}
              busy={busy}
            />
          )}

          {isActiveMine && hasSchedule && (
            <JobProgressActions
              job={job}
              status={status}
              appointmentToday={appointmentToday}
              showCompletion={showCompletion}
              onShowCompletion={setShowCompletion}
              onEnRoute={confirmEnRoute}
              onArrived={confirmArrived}
              onComplete={(body) => {
                setActionError(null);
                completeMutation.mutate({ jobId, data: body });
              }}
              enRoutePending={enRouteMutation.isPending}
              arrivedPending={arrivedMutation.isPending}
              completePending={completeMutation.isPending}
              busy={busy}
            />
          )}

          {isMine && status === "completed" && (
            <Notice tone="success" message={t("tech.jobScreen.youCompleted")} />
          )}
        </KeyboardAwareScrollViewCompat>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, gap: 10 },
  backBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 17 },
  headerSub: { fontSize: 11 },
});
