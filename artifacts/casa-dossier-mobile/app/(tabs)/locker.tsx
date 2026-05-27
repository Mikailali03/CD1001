import React, { useState } from "react";
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
import {
  useListLockerFiles,
  useListLockerFolders,
  useCreateLockerFile,
} from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import * as Haptics from "expo-haptics";

const SCREEN_WIDTH = Dimensions.get("window").width;
const NUM_COLS = 3;
const PHOTO_SIZE = (SCREEN_WIDTH - 32 - (NUM_COLS - 1) * 4) / NUM_COLS;

// LockerFile shape from API
type LockerFile = {
  id: string;
  userId?: string;
  folderId?: string | null;
  name: string;
  objectPath: string;
  contentType: string;
  size?: number | null;
  createdAt: string;
};

type LockerFolder = { id: string; name: string; createdAt: string };

type FolderTabId = "all" | "unorganized" | string;

export default function LockerScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { getToken } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [viewingPhoto, setViewingPhoto] = useState<LockerFile | null>(null);
  const [activeFolderId, setActiveFolderId] = useState<FolderTabId>("all");

  const { data: rawFolders = [], refetch: refetchFolders } = useListLockerFolders({ query: {} });
  const folders = rawFolders as LockerFolder[];

  // Pass folderId param only when filtering by a specific folder
  const filesParams = activeFolderId !== "all" && activeFolderId !== "unorganized"
    ? { folderId: activeFolderId }
    : {};

  const { data: rawFiles = [], isLoading, refetch } = useListLockerFiles(
    filesParams,
    { query: {} }
  );

  // Filter client-side for "unorganized" (no folder assigned)
  const allFiles = rawFiles as LockerFile[];
  const photoFiles = allFiles
    .filter((f) => f.contentType.startsWith("image/"))
    .filter((f) =>
      activeFolderId === "unorganized"
        ? f.folderId == null
        : true
    );

  const { mutateAsync: createFile } = useCreateLockerFile();

  const onRefresh = async () => {
    setRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await Promise.all([refetch(), refetchFolders()]);
    setRefreshing(false);
  };

  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  const baseUrl = domain ? `https://${domain}` : "";

  function photoUrl(f: LockerFile) {
    // objectPath is like "/objects/uuid.jpg"
    return `${baseUrl}/api/storage${f.objectPath}`;
  }

  const pickAndUpload = async (useCamera: boolean) => {
    try {
      let result: ImagePicker.ImagePickerResult;

      if (useCamera) {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) {
          Alert.alert("Permission Required", "Camera access is needed to take photos.");
          return;
        }
        result = await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.85 });
      } else {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) {
          Alert.alert("Permission Required", "Photo library access is needed.");
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

      const token = await getToken();

      for (let i = 0; i < result.assets.length; i++) {
        const asset = result.assets[i];
        setUploadProgress(Math.round((i / result.assets.length) * 80));

        const name = asset.fileName ?? `photo_${Date.now()}.jpg`;
        const contentType = asset.mimeType ?? "image/jpeg";
        const size = asset.fileSize ?? 0;

        // 1. Get presigned URL
        const urlRes = await fetch(`${baseUrl}/api/storage/uploads/request-url`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ name, size, contentType }),
        });
        if (!urlRes.ok) throw new Error("Failed to get upload URL");
        const { uploadURL, objectPath } = await urlRes.json() as { uploadURL: string; objectPath: string };

        // 2. Upload to storage
        const blob = await (await fetch(asset.uri)).blob();
        await fetch(uploadURL, { method: "PUT", headers: { "Content-Type": contentType }, body: blob });

        // 3. Save metadata
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

      await Promise.all([refetch(), refetchFolders()]);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      Alert.alert("Upload Failed", "Something went wrong. Please try again.");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const showAddOptions = () => {
    Alert.alert("Add Photos", "Choose a source", [
      { text: "Take Photo", onPress: () => pickAndUpload(true) },
      { text: "Photo Library", onPress: () => pickAndUpload(false) },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  // Folder tabs
  const folderTabs: { id: FolderTabId; label: string; icon: keyof typeof Feather.glyphMap }[] = [
    { id: "all", label: "All Photos", icon: "image" },
    { id: "unorganized", label: "Unorganized", icon: "folder" },
    ...folders.map((f) => ({ id: f.id, label: f.name, icon: "folder" as const })),
  ];

  const activeTabLabel =
    activeFolderId === "all"
      ? "All Photos"
      : activeFolderId === "unorganized"
      ? "Unorganized"
      : folders.find((f) => f.id === activeFolderId)?.name ?? "Folder";

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad, borderBottomColor: colors.border, backgroundColor: colors.background }]}>
        <View style={styles.headerTop}>
          <View>
            <Text style={[styles.title, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
              Digital Locker
            </Text>
            {!isLoading && (
              <Text style={[styles.sub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                {activeTabLabel} · {photoFiles.length} photo{photoFiles.length !== 1 ? "s" : ""}
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
                <Feather name="upload" size={14} color={colors.primaryForeground} />
                <Text style={[styles.uploadText, { color: colors.primaryForeground, fontFamily: "Inter_600SemiBold" }]}>
                  Upload
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
            No photos yet
          </Text>
          <Text style={[styles.emptyDesc, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
            {activeFolderId === "all"
              ? "Upload photos to keep a visual record of your home"
              : `No photos in ${activeTabLabel}`}
          </Text>
          <TouchableOpacity
            style={[styles.emptyBtn, { borderColor: colors.border, backgroundColor: colors.card }]}
            onPress={showAddOptions}
          >
            <Feather name="plus" size={14} color={colors.foreground} />
            <Text style={[styles.emptyBtnText, { color: colors.foreground, fontFamily: "Inter_500Medium" }]}>
              Upload a photo
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
                source={{ uri: photoUrl(item) }}
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
          <TouchableOpacity style={styles.lightboxClose} onPress={() => setViewingPhoto(null)}>
            <Feather name="x" size={24} color="#fff" />
          </TouchableOpacity>
          {viewingPhoto && (
            <Image
              source={{ uri: photoUrl(viewingPhoto) }}
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
  headerTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    paddingTop: 8,
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
