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
} from "react-native";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useAuth } from "@clerk/expo";
import { useListLockerFiles, useCreateLockerFile } from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { EmptyState } from "@/components/EmptyState";
import * as Haptics from "expo-haptics";

const SCREEN_WIDTH = Dimensions.get("window").width;
const NUM_COLS = 3;
const PHOTO_SIZE = (SCREEN_WIDTH - 32 - (NUM_COLS - 1) * 3) / NUM_COLS;

type LockerFile = {
  id: string;
  fileName: string;
  publicUrl: string;
  contentType: string;
  fileSize: number;
  createdAt: string;
};

export default function LockerScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { getToken } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [viewingPhoto, setViewingPhoto] = useState<LockerFile | null>(null);

  const { data: files = [], isLoading, refetch } = useListLockerFiles(
    {},
    { query: {} }
  );

  const { mutateAsync: createFile } = useCreateLockerFile();

  const onRefresh = async () => {
    setRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await refetch();
    setRefreshing(false);
  };

  const pickAndUpload = async (useCamera: boolean) => {
    try {
      let result: ImagePicker.ImagePickerResult;

      if (useCamera) {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) {
          Alert.alert("Permission Required", "Camera access is needed to take photos.");
          return;
        }
        result = await ImagePicker.launchCameraAsync({
          mediaTypes: ["images"],
          quality: 0.85,
          allowsEditing: false,
        });
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
      const domain = process.env.EXPO_PUBLIC_DOMAIN;
      const baseUrl = domain ? `https://${domain}` : "";

      for (let i = 0; i < result.assets.length; i++) {
        const asset = result.assets[i];
        setUploadProgress(Math.round((i / result.assets.length) * 80));

        const filename = asset.fileName ?? `photo_${Date.now()}.jpg`;
        const contentType = asset.mimeType ?? "image/jpeg";

        // 1. Get presigned URL
        const urlRes = await fetch(`${baseUrl}/api/storage/uploads/request-url`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ fileName: filename, contentType, directory: "locker" }),
        });

        if (!urlRes.ok) throw new Error("Failed to get upload URL");
        const { uploadUrl, publicUrl, storagePath } = await urlRes.json();

        // 2. Upload to GCS
        const blob = await (await fetch(asset.uri)).blob();
        await fetch(uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": contentType },
          body: blob,
        });

        // 3. Save metadata
        await createFile({
          data: {
            fileName: filename,
            fileSize: asset.fileSize ?? blob.size,
            contentType,
            publicUrl,
            storagePath,
          },
        });

        setUploadProgress(Math.round(((i + 1) / result.assets.length) * 100));
      }

      await refetch();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      Alert.alert("Upload Failed", "Something went wrong. Please try again.");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const showAddOptions = () => {
    Alert.alert("Add Photo", "Choose a source", [
      { text: "Camera", onPress: () => pickAndUpload(true) },
      { text: "Photo Library", onPress: () => pickAndUpload(false) },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const photoFiles = (files as LockerFile[]).filter((f) =>
    f.contentType.startsWith("image/")
  );

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad, borderBottomColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
          Digital Locker
        </Text>
        <TouchableOpacity
          style={[styles.addBtn, { backgroundColor: colors.primary }]}
          onPress={showAddOptions}
          disabled={uploading}
          activeOpacity={0.8}
        >
          {uploading ? (
            <Text style={[styles.addBtnText, { color: colors.primaryForeground, fontFamily: "Inter_600SemiBold" }]}>
              {uploadProgress}%
            </Text>
          ) : (
            <Feather name="plus" size={20} color={colors.primaryForeground} />
          )}
        </TouchableOpacity>
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
        <EmptyState
          icon="image"
          title="No Photos Yet"
          description="Document your home with photos — renovations, appliances, damage, and more."
          actionLabel="Add Photo"
          onAction={showAddOptions}
        />
      ) : (
        <FlatList
          data={photoFiles}
          keyExtractor={(f) => f.id}
          numColumns={NUM_COLS}
          contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 20, gap: 3 }}
          columnWrapperStyle={{ gap: 3 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
            />
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
                source={{ uri: item.publicUrl }}
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
          <TouchableOpacity
            style={styles.lightboxClose}
            onPress={() => setViewingPhoto(null)}
          >
            <Feather name="x" size={24} color="#fff" />
          </TouchableOpacity>
          {viewingPhoto && (
            <Image
              source={{ uri: viewingPhoto.publicUrl }}
              style={styles.lightboxImage}
              contentFit="contain"
            />
          )}
          {viewingPhoto && (
            <Text style={[styles.lightboxCaption, { fontFamily: "Inter_400Regular" }]}>
              {viewingPhoto.fileName}
            </Text>
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 14,
    paddingTop: 8,
    borderBottomWidth: 1,
  },
  title: { fontSize: 28 },
  addBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  addBtnText: { fontSize: 12 },
  progressBar: { height: 3 },
  progressFill: { height: 3, borderRadius: 2 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  photo: { borderRadius: 4, overflow: "hidden", backgroundColor: "#e0e0e0" },
  lightbox: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.95)",
    alignItems: "center",
    justifyContent: "center",
  },
  lightboxClose: {
    position: "absolute",
    top: 60,
    right: 20,
    zIndex: 10,
    padding: 8,
  },
  lightboxImage: {
    width: "100%",
    height: "75%",
  },
  lightboxCaption: {
    color: "#fff",
    fontSize: 12,
    opacity: 0.7,
    marginTop: 12,
    paddingHorizontal: 20,
    textAlign: "center",
  },
});
