import React, { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Platform,
  Dimensions,
  RefreshControl,
  ActivityIndicator,
  Modal,
  ScrollView,
} from "react-native";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useAuth } from "@clerk/expo";
import { useRouter } from "expo-router";
import {
  useListLockerFiles,
  useListLockerFolders,
  useCreateLockerFile,
  getListLockerFilesQueryKey,
  getListLockerFoldersQueryKey,
  type LockerFile,
} from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { useSubscription } from "@/hooks/useSubscription";
import * as Haptics from "expo-haptics";
import { useTranslation } from "react-i18next";
import { resolveStorageUrl, storageUrlForObjectPath } from "@/lib/config";
import { isUpgradeRequiredError } from "@/lib/api-errors";
import { UploadRejectedError, uploadFailureMessage, uploadPickedFile } from "@/hooks/useImageUpload";

const SCREEN_WIDTH = Dimensions.get("window").width;
const NUM_COLS = 3;
const PHOTO_SIZE = (SCREEN_WIDTH - 32 - (NUM_COLS - 1) * 4) / NUM_COLS;

type FolderTabId = "all" | "unorganized" | string;

export default function LockerScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { getToken } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [viewingPhoto, setViewingPhoto] = useState<LockerFile | null>(null);
  const [activeFolderId, setActiveFolderId] = useState<FolderTabId>("all");

  const { data: folders = [] } = useListLockerFolders({
    query: { queryKey: getListLockerFoldersQueryKey() },
  });

  const filesParams = activeFolderId !== "all" && activeFolderId !== "unorganized"
    ? { folderId: activeFolderId }
    : {};

  const { data: allFiles = [], isLoading } = useListLockerFiles(
    filesParams,
    { query: { queryKey: getListLockerFilesQueryKey(filesParams) } }
  );

  const photoFiles = allFiles
    .filter((f) => f.contentType.startsWith("image/"))
    .filter((f) =>
      activeFolderId === "unorganized" ? f.folderId == null : true
    );

  const { mutateAsync: createFile } = useCreateLockerFile();

  // Uploading is a paid feature (server returns 403 upgrade_required); viewing stays open
  const { isFreeTier } = useSubscription();

  const onRefresh = async () => {
    setRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await Promise.all([
      // Only this screen's data — files (every folder filter) and folders
      queryClient.invalidateQueries({ queryKey: getListLockerFilesQueryKey() }),
      queryClient.invalidateQueries({ queryKey: getListLockerFoldersQueryKey() }),
      new Promise((r) => setTimeout(r, 600)),
    ]);
    setRefreshing(false);
  };

  // Locker documents are private on the server, so image requests must carry
  // the session token. Clerk tokens are short-lived, so keep a fresh one.
  const [authToken, setAuthToken] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    const refresh = () =>
      getToken()
        .then((t) => { if (alive) setAuthToken(t); })
        .catch(() => {});
    refresh();
    const id = setInterval(refresh, 45_000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [getToken]);

  function photoSource(f: LockerFile) {
    return {
      uri: resolveStorageUrl(storageUrlForObjectPath(f.objectPath)),
      headers: authToken ? { Authorization: `Bearer ${authToken}` } : undefined,
    };
  }

  const pickAndUpload = async (useCamera: boolean) => {
    try {
      let result: ImagePicker.ImagePickerResult;

      if (useCamera) {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) {
          Alert.alert(t("locker.permissionTitle"), t("locker.cameraPermission"));
          return;
        }
        result = await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.85 });
      } else {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) {
          Alert.alert(t("locker.permissionTitle"), t("locker.libraryPermission"));
          return;
        }
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ["images"],
          allowsMultipleSelection: true,
          quality: 0.85,
        });
      }

      if (result.canceled || !result.assets?.length) return;

      setUploading(true);
      setUploadProgress(0);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      for (let i = 0; i < result.assets.length; i++) {
        const asset = result.assets[i];
        setUploadProgress(Math.round((i / result.assets.length) * 80));

        const { name, objectPath, contentType, size } = await uploadPickedFile({
          ...asset,
          fileName: asset.fileName ?? `photo_${Date.now()}.jpg`,
        });

        await createFile({
          data: {
            name,
            objectPath,
            contentType,
            size,
            folderId:
              activeFolderId !== "all" && activeFolderId !== "unorganized"
                ? activeFolderId
                : undefined,
          },
        });

        setUploadProgress(Math.round(((i + 1) / result.assets.length) * 100));
      }

      await queryClient.invalidateQueries({ queryKey: getListLockerFilesQueryKey() });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err: unknown) {
      if (isUpgradeRequiredError(err)) {
        router.push("/upgrade");
        return;
      }
      Alert.alert(
        t("locker.uploadFailed"),
        err instanceof UploadRejectedError ? uploadFailureMessage(err) : t("common.somethingWentWrong"),
      );
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const showAddOptions = () => {
    if (isFreeTier) {
      Haptics.selectionAsync();
      router.push("/upgrade");
      return;
    }
    Alert.alert(t("locker.addPhotos"), t("locker.chooseSource"), [
      { text: t("common.takePhoto"), onPress: () => pickAndUpload(true) },
      { text: t("locker.photoLibrary"), onPress: () => pickAndUpload(false) },
      { text: t("common.cancel"), style: "cancel" },
    ]);
  };

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const folderTabs: { id: FolderTabId; label: string; icon: keyof typeof Feather.glyphMap }[] = [
    { id: "all", label: t("locker.allPhotos"), icon: "image" },
    { id: "unorganized", label: t("locker.unorganized"), icon: "folder" },
    ...folders.map((f) => ({ id: f.id, label: f.name, icon: "folder" as const })),
  ];

  const activeTabLabel =
    activeFolderId === "all"
      ? t("locker.allPhotos")
      : activeFolderId === "unorganized"
      ? t("locker.unorganized")
      : folders.find((f) => f.id === activeFolderId)?.name ?? t("locker.folder");

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad, borderBottomColor: colors.border, backgroundColor: colors.background }]}>
        <View style={styles.headerNav}>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel={t("common.goBack")} hitSlop={8} onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
            <Feather name="chevron-left" size={24} color={colors.foreground} />
          </TouchableOpacity>
        </View>
        <View style={styles.headerTop}>
          <View>
            <Text style={[styles.title, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
              {t("locker.title")}
            </Text>
            {!isLoading && (
              <Text style={[styles.sub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                {t("locker.subtitle", { folder: activeTabLabel, count: photoFiles.length })}
              </Text>
            )}
          </View>
          <TouchableOpacity
            style={[styles.uploadBtn, { backgroundColor: colors.primary, opacity: uploading ? 0.7 : 1 }]}
            onPress={showAddOptions}
            disabled={uploading}
            activeOpacity={0.8}
          >
            {uploading ? (
              <ActivityIndicator size="small" color={colors.primaryForeground} />
            ) : (
              <>
                <Feather name={isFreeTier ? "lock" : "upload"} size={14} color={colors.primaryForeground} />
                <Text style={[styles.uploadText, { color: colors.primaryForeground, fontFamily: "Inter_600SemiBold" }]}>
                  {t("locker.upload")}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Folder/tab scroll */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabs}
        >
          {folderTabs.map((tab) => {
            const isActive = activeFolderId === tab.id;
            return (
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityState={{ selected: isActive }}
                key={String(tab.id)}
                style={[
                  styles.tab,
                  isActive
                    ? { backgroundColor: colors.primary }
                    : { backgroundColor: colors.muted, borderColor: colors.border, borderWidth: 1 },
                ]}
                onPress={() => {
                  setActiveFolderId(tab.id);
                  Haptics.selectionAsync();
                }}
              >
                <Feather
                  name={tab.icon}
                  size={12}
                  color={isActive ? colors.primaryForeground : colors.mutedForeground}
                />
                <Text
                  style={[
                    styles.tabText,
                    { color: isActive ? colors.primaryForeground : colors.foreground, fontFamily: "Inter_500Medium" },
                  ]}
                  numberOfLines={1}
                >
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Upload progress bar */}
      {uploading && (
        <View style={[styles.progressBar, { backgroundColor: colors.border }]}>
          <View
            style={[
              styles.progressFill,
              { backgroundColor: colors.primary, width: `${uploadProgress}%` as `${number}%` },
            ]}
          />
        </View>
      )}

      {/* Content */}
      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : photoFiles.length === 0 ? (
        <View style={styles.empty}>
          <View style={[styles.emptyIcon, { backgroundColor: colors.muted }]}>
            <Feather name="image" size={36} color={colors.mutedForeground} style={{ opacity: 0.35 }} />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
            {t("locker.emptyTitle")}
          </Text>
          <Text style={[styles.emptyDesc, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
            {activeFolderId === "all"
              ? t("locker.emptyDesc")
              : t("locker.emptyInFolder", { folder: activeTabLabel })}
          </Text>
          <TouchableOpacity
            style={[styles.emptyBtn, { borderColor: colors.border, backgroundColor: colors.card }]}
            onPress={showAddOptions}
          >
            <Feather name="plus" size={14} color={colors.foreground} />
            <Text style={[styles.emptyBtnText, { color: colors.foreground, fontFamily: "Inter_500Medium" }]}>
              {t("locker.uploadAPhoto")}
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={photoFiles}
          keyExtractor={(f) => f.id}
          numColumns={NUM_COLS}
          contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 20, gap: 4 }}
          columnWrapperStyle={{ gap: 4 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.photo, { width: PHOTO_SIZE, height: PHOTO_SIZE }]}
              onPress={() => {
                setViewingPhoto(item);
                Haptics.selectionAsync();
              }}
              activeOpacity={0.85}
            >
              <Image
                source={photoSource(item)}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
                transition={200}
              />
            </TouchableOpacity>
          )}
        />
      )}

      {/* Lightbox */}
      <Modal
        visible={!!viewingPhoto}
        transparent
        animationType="fade"
        onRequestClose={() => setViewingPhoto(null)}
      >
        <View style={styles.lightbox}>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel={t("locker.closePhoto")} hitSlop={8} style={styles.lightboxClose} onPress={() => setViewingPhoto(null)}>
            <Feather name="x" size={24} color="#fff" />
          </TouchableOpacity>
          {viewingPhoto && (
            <Image
              source={photoSource(viewingPhoto)}
              style={styles.lightboxImage}
              contentFit="contain"
            />
          )}
          {viewingPhoto && (
            <Text style={[styles.lightboxCaption, { fontFamily: "Inter_400Regular" }]}>
              {viewingPhoto.name}
            </Text>
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingHorizontal: 20, borderBottomWidth: 1 },
  headerNav: { paddingTop: 4, marginLeft: -6, marginBottom: 2 },
  backBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  headerTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    paddingBottom: 10,
  },
  title: { fontSize: 28 },
  sub: { fontSize: 12, marginTop: 2 },
  uploadBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 10,
    marginTop: 4,
  },
  uploadText: { fontSize: 13 },
  tabs: { gap: 8, paddingBottom: 12 },
  tab: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    maxWidth: 160,
  },
  tabText: { fontSize: 13 },
  progressBar: { height: 3 },
  progressFill: { height: 3, borderRadius: 2 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10, paddingHorizontal: 32 },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  emptyTitle: { fontSize: 16 },
  emptyDesc: { fontSize: 13, textAlign: "center" },
  emptyBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 4,
  },
  emptyBtnText: { fontSize: 14 },
  photo: { borderRadius: 8, overflow: "hidden", backgroundColor: "#e0e0e0" },
  lightbox: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.95)",
    alignItems: "center",
    justifyContent: "center",
  },
  lightboxClose: { position: "absolute", top: 60, right: 20, zIndex: 10, padding: 8 },
  lightboxImage: { width: "100%", height: "75%" },
  lightboxCaption: {
    color: "#fff",
    fontSize: 12,
    opacity: 0.7,
    marginTop: 12,
    paddingHorizontal: 20,
    textAlign: "center",
  },
});
