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
import { Feather } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import * as ImagePicker from "expo-image-picker";
import { useAuth } from "@clerk/expo";
import {
  useCreateProperty,
  useUpdateProperty,
  getListPropertiesQueryKey,
  getGetPropertyQueryKey,
  type Property,
  type UpdatePropertyBody,
} from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";

// ---------------------------------------------------------------------------
// Types
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

interface Suggestion {
  address: string;
  city: string | null;
  state: string | null;
  zipCode: string | null;
}

export interface PropertyFormModalProps {
  mode: "add" | "edit";
  property?: Property | null;
  visible: boolean;
  onClose: () => void;
  colors: ReturnType<typeof useColors>;
  insets: { bottom: number };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PropertyFormModal({ mode, property, visible, onClose, colors, insets }: PropertyFormModalProps) {
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

  // Autocomplete suggestions
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const autocompleteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
      setSuggestions([]);
      setShowSuggestions(false);
      setSuggestionsLoading(false);
    }
  }, [visible, mode, property?.id]);

  // Debounced autocomplete: fire 350ms after the user stops typing (3+ chars)
  useEffect(() => {
    if (autocompleteTimer.current) clearTimeout(autocompleteTimer.current);

    const q = searchQuery.trim();
    if (q.length < 3) {
      setSuggestions([]);
      setShowSuggestions(false);
      setSuggestionsLoading(false);
      return;
    }

    setSuggestionsLoading(true);
    autocompleteTimer.current = setTimeout(async () => {
      try {
        const token = await getToken();
        const res = await fetch(
          `${baseUrl}/api/properties/autocomplete?query=${encodeURIComponent(q)}&limit=6`,
          { headers: token ? { Authorization: `Bearer ${token}` } : {} }
        );
        if (res.ok) {
          const data = await res.json() as { suggestions: Suggestion[] };
          setSuggestions(data.suggestions ?? []);
          setShowSuggestions((data.suggestions ?? []).length > 0);
        } else {
          setSuggestions([]);
          setShowSuggestions(false);
        }
      } catch {
        // Network error — gracefully degrade, keep search button functional
        setSuggestions([]);
        setShowSuggestions(false);
      } finally {
        setSuggestionsLoading(false);
      }
    }, 350);

    return () => {
      if (autocompleteTimer.current) clearTimeout(autocompleteTimer.current);
    };
  }, [searchQuery]);

  async function handleLookup(overrideAddress?: string) {
    const q = (overrideAddress ?? searchQuery).trim();
    if (!q) return;
    // Dismiss suggestions before starting full lookup
    setSuggestions([]);
    setShowSuggestions(false);
    if (overrideAddress) setSearchQuery(overrideAddress);
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
      const yearBuiltNum = form.yearBuilt ? parseInt(form.yearBuilt, 10) : NaN;
      const sqftNum = form.sqft ? parseInt(form.sqft, 10) : NaN;

      if (mode === "add") {
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
        const updateData = {
          name: form.name.trim(),
          address: form.address.trim(),
          city: form.city.trim() || null,
          state: form.state.trim() || null,
          zipCode: form.zipCode.trim() || null,
          yearBuilt: !isNaN(yearBuiltNum) && yearBuiltNum > 0 ? yearBuiltNum : null,
          sqft: !isNaN(sqftNum) && sqftNum > 0 ? sqftNum : null,
          photoUrl: photoUrl ?? null,
        } as unknown as UpdatePropertyBody;
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
                    onChangeText={(v) => {
                      setSearchQuery(v);
                      setLookupFilled(false);
                    }}
                    placeholder="e.g. 123 Main St, Austin, TX"
                    placeholderTextColor={colors.mutedForeground}
                    returnKeyType="search"
                    onSubmitEditing={() => handleLookup()}
                    editable={!lookupLoading}
                    onBlur={() => {
                      setTimeout(() => setShowSuggestions(false), 150);
                    }}
                    onFocus={() => {
                      if (suggestions.length > 0) setShowSuggestions(true);
                    }}
                  />
                  <TouchableOpacity
                    onPress={() => handleLookup()}
                    style={[fStyles.searchBtn, { backgroundColor: colors.primary, opacity: lookupLoading || !searchQuery.trim() ? 0.6 : 1 }]}
                    activeOpacity={0.8}
                    disabled={lookupLoading || !searchQuery.trim()}
                  >
                    {lookupLoading || suggestionsLoading ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Feather name="search" size={17} color="#fff" />
                    )}
                  </TouchableOpacity>
                </View>

                {/* Suggestions dropdown */}
                {showSuggestions && suggestions.length > 0 && (
                  <View style={[fStyles.suggestionsContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    {suggestions.map((s, i) => (
                      <TouchableOpacity
                        key={`${s.address}-${i}`}
                        style={[
                          fStyles.suggestionRow,
                          i < suggestions.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
                        ]}
                        activeOpacity={0.7}
                        onPress={() => handleLookup(s.address)}
                      >
                        <Feather name="map-pin" size={13} color={colors.mutedForeground} style={{ marginTop: 1 }} />
                        <View style={{ flex: 1 }}>
                          <Text style={[fStyles.suggestionAddress, { color: colors.foreground, fontFamily: "Inter_500Medium" }]} numberOfLines={1}>
                            {s.address}
                          </Text>
                          {(s.city || s.state) && (
                            <Text style={[fStyles.suggestionMeta, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]} numberOfLines={1}>
                              {[s.city, s.state, s.zipCode].filter(Boolean).join(", ")}
                            </Text>
                          )}
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}

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

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

export const fStyles = StyleSheet.create({
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
  suggestionsContainer: {
    borderWidth: 1, borderRadius: 10, marginTop: 4,
    overflow: "hidden",
    shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 8, shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  suggestionRow: {
    flexDirection: "row", alignItems: "flex-start", gap: 8,
    paddingHorizontal: 12, paddingVertical: 10,
  },
  suggestionAddress: { fontSize: 14, lineHeight: 18 },
  suggestionMeta: { fontSize: 12, marginTop: 1 },
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
