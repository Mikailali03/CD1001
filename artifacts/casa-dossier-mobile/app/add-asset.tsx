import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Platform,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
} from "react-native";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useAuth } from "@clerk/expo";
import { useQueryClient } from "@tanstack/react-query";
import { useColors } from "@/hooks/useColors";
import * as Haptics from "expo-haptics";

const CATEGORIES = ["HVAC", "Plumbing", "Electrical", "Roof", "Appliance", "Structural", "Other"] as const;
type Category = typeof CATEGORIES[number];

const CATEGORY_EMOJIS: Record<Category, string> = {
  HVAC: "❄️", Plumbing: "🔧", Electrical: "⚡",
  Roof: "🏠", Appliance: "🫙", Structural: "🏗️", Other: "📦",
};

type ScanResult = {
  brand: string | null;
  model: string | null;
  serialNumber: string | null;
  manufactureDate: string | null;
  estimatedReplacementCost: number | null;
  category: Category | null;
  suggestedName: string | null;
};

type Step = "method" | "lens" | "review" | "generating" | "done";

export default function AddAssetScreen() {
  const router = useRouter();
  const { propertyId } = useLocalSearchParams<{ propertyId: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { getToken } = useAuth();
  const qc = useQueryClient();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  const base = domain ? `https://${domain}` : "";

  const [step, setStep] = useState<Step>("method");
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [scanBusy, setScanBusy] = useState(false);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [category, setCategory] = useState<Category>("HVAC");
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [serialNumber, setSerialNumber] = useState("");
  const [installDate, setInstallDate] = useState("");
  const [replacementCost, setReplacementCost] = useState("");
  const [warrantyExpiry, setWarrantyExpiry] = useState("");

  const [saveBusy, setSaveBusy] = useState(false);
  const [taskCount, setTaskCount] = useState<number | null>(null);
  const [createdAssetId, setCreatedAssetId] = useState<string | null>(null);
  const [generatingStatus, setGeneratingStatus] = useState("Creating asset…");
  const [planBlocked, setPlanBlocked] = useState(false);
  const [categoryOpen, setCategoryOpen] = useState(false);

  function reset() {
    setStep("method"); setImageUri(null); setImageBase64(null);
    setScanBusy(false); setScanResult(null); setScanError(null); setPlanBlocked(false);
    setName(""); setCategory("HVAC"); setBrand(""); setModel("");
    setSerialNumber(""); setInstallDate(""); setReplacementCost(""); setWarrantyExpiry("");
    setSaveBusy(false); setTaskCount(null); setCreatedAssetId(null);
    setGeneratingStatus("Creating asset…");
  }

  async function pickFromCamera() {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Permission needed", "Camera access is needed to take a photo.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: "images", base64: true, quality: 0.82, allowsEditing: false,
    });
    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri);
      setImageBase64(result.assets[0].base64 ?? null);
      setScanError(null); setScanResult(null);
    }
  }

  async function pickFromGallery() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Permission needed", "Photo library access is needed to pick a photo.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: "images", base64: true, quality: 0.82,
    });
    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri);
      setImageBase64(result.assets[0].base64 ?? null);
      setScanError(null); setScanResult(null);
    }
  }

  async function handleScan() {
    if (!imageBase64) return;
    setScanBusy(true); setScanError(null);
    try {
      const token = await getToken();
      const res = await fetch(`${base}/api/assets/scan`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ imageBase64, mimeType: "image/jpeg" }),
      });
      if (!res.ok) {
        setScanError("Scan failed — please try a clearer photo or enter details manually.");
        return;
      }
      const data: ScanResult = await res.json();
      setScanResult(data);
      if (data.suggestedName) setName(data.suggestedName);
      else if (data.brand && data.model) setName(`${data.brand} ${data.model}`);
      else if (data.brand) setName(data.brand);
      if (data.category) setCategory(data.category);
      if (data.brand) setBrand(data.brand);
      if (data.model) setModel(data.model);
      if (data.serialNumber) setSerialNumber(data.serialNumber);
      if (data.manufactureDate) setInstallDate(data.manufactureDate.substring(0, 7));
      if (data.estimatedReplacementCost) setReplacementCost(String(data.estimatedReplacementCost));
      setStep("review");
    } catch {
      setScanError("Could not reach the scan service. Please try again.");
    } finally {
      setScanBusy(false);
    }
  }

  async function handleSave() {
    if (!name.trim()) { Alert.alert("Name required", "Please enter an asset name."); return; }
    if (!propertyId) { Alert.alert("Error", "No property selected."); return; }
    setSaveBusy(true);
    setStep("generating");
    setGeneratingStatus("Creating asset…");

    try {
      const token = await getToken();
      const res = await fetch(`${base}/api/properties/${propertyId}/assets`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          name: name.trim(),
          category,
          brand: brand.trim() || undefined,
          model: model.trim() || undefined,
          serialNumber: serialNumber.trim() || undefined,
          installDate: installDate ? `${installDate}-01` : undefined,
          replacementCost: replacementCost ? parseFloat(replacementCost) : undefined,
          warrantyExpiry: warrantyExpiry ? `${warrantyExpiry}-01` : undefined,
        }),
      });

      if (!res.ok) {
        Alert.alert("Error", "Could not save asset. Please try again.");
        setStep("review");
        return;
      }

      const asset = await res.json();
      setCreatedAssetId(asset.id);

      await qc.invalidateQueries({
        predicate: (q) => q.queryKey.some((k) => typeof k === "string" && (k.includes("assets") || k.includes("properties"))),
      });

      setGeneratingStatus("AI is building your maintenance plan…");

      try {
        const taskRes = await fetch(`${base}/api/assets/${asset.id}/generate-tasks`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        });
        if (taskRes.ok) {
          const td = await taskRes.json();
          setTaskCount(td.taskCount ?? 0);
        } else if (taskRes.status === 403) {
          setPlanBlocked(true);
          setTaskCount(0);
        } else {
          setTaskCount(0);
        }
      } catch {
        setTaskCount(0);
      }

      await qc.invalidateQueries({
        predicate: (q) =>
          q.queryKey.some((k) =>
            typeof k === "string" && (k.includes("assets") || k.includes("properties") || k.includes("maintenance") || k.includes("summary"))
          ),
      });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setStep("done");
    } catch {
      Alert.alert("Error", "Something went wrong. Please try again.");
      setStep("review");
    } finally {
      setSaveBusy(false);
    }
  }

  const fieldsFilled = [brand, model, serialNumber].filter(Boolean).length;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={{ flex: 1, backgroundColor: colors.background }}
    >
      {/* ── Header ── */}
      <View style={[s.header, { paddingTop: topPad, borderBottomColor: colors.border, backgroundColor: colors.background }]}>
        {step !== "generating" && step !== "done" ? (
          <TouchableOpacity
            onPress={() => {
              Haptics.selectionAsync();
              if (step === "method") { router.back(); }
              else if (step === "lens") setStep("method");
              else if (step === "review") setStep(imageUri ? "lens" : "method");
            }}
            style={s.backBtn} activeOpacity={0.7}
          >
            <Feather name={step === "method" ? "x" : "chevron-left"} size={22} color={colors.foreground} />
          </TouchableOpacity>
        ) : (
          <View style={s.backBtn} />
        )}

        <View style={s.headerCenter}>
          <View style={[s.headerIcon, {
            backgroundColor: step === "done" ? "#3d7a5f18"
              : step === "review" && scanResult ? "#3d7a5f18"
              : colors.primary + "15",
          }]}>
            <Feather
              name={
                step === "done" ? "check-circle"
                  : step === "generating" ? "cpu"
                  : step === "review" ? "edit-2"
                  : step === "lens" ? "camera"
                  : "plus-circle"
              }
              size={16}
              color={step === "done" || (step === "review" && scanResult) ? "#3d7a5f" : colors.primary}
            />
          </View>
          <View>
            <Text style={[s.headerTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
              {step === "method" ? "Add an Asset"
                : step === "lens" ? "AI Lens"
                : step === "review" ? (scanResult ? "Review Details" : "Asset Details")
                : step === "generating" ? "Building Your Plan"
                : "Asset Added!"}
            </Text>
            <Text style={[s.headerSub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              {step === "method" ? "Home system or appliance"
                : step === "lens" ? "Photo of the spec plate or label"
                : step === "review" ? (scanResult ? `${fieldsFilled} of 3 fields extracted — edit anything off` : "Fill in the details")
                : step === "generating" ? "AI research agent at work"
                : `${taskCount ?? 0} maintenance task${taskCount !== 1 ? "s" : ""} scheduled`}
            </Text>
          </View>
        </View>

        {/* Step dots */}
        <View style={s.stepDots}>
          {(["method", "lens", "review"] as Step[]).map((st, i) => (
            <View
              key={st}
              style={[s.dot, {
                backgroundColor: st === step || (step === "generating" || step === "done")
                  ? colors.primary
                  : colors.muted,
                width: st === step ? 16 : 6,
              }]}
            />
          ))}
        </View>
      </View>

      {/* ── Step: Choose Method ── */}
      {step === "method" && (
        <ScrollView contentContainerStyle={{ padding: 20, gap: 12 }} showsVerticalScrollIndicator={false}>
          {/* AI Lens card */}
          <TouchableOpacity
            onPress={() => { Haptics.selectionAsync(); setStep("lens"); }}
            style={[s.methodCard, { backgroundColor: colors.primary + "08", borderColor: colors.primary + "35", borderWidth: 2 }]}
            activeOpacity={0.8}
          >
            <View style={[s.methodIcon, { backgroundColor: colors.primary + "18" }]}>
              <Feather name="camera" size={24} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <Text style={[s.methodTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>AI Lens</Text>
                <View style={[s.recBadge, { backgroundColor: colors.primary + "18" }]}>
                  <Text style={[s.recBadgeText, { color: colors.primary, fontFamily: "Inter_700Bold" }]}>RECOMMENDED</Text>
                </View>
              </View>
              <Text style={[s.methodDesc, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                Take a photo of the spec plate or label. AI extracts brand, model, serial number, and manufacture date instantly.
              </Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 10 }}>
                {["Auto-fills all fields", "Works on any label", "Estimates replacement cost"].map((t) => (
                  <View key={t} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                    <Feather name="check-circle" size={11} color={colors.primary} />
                    <Text style={[s.featureTip, { color: colors.primary, fontFamily: "Inter_500Medium" }]}>{t}</Text>
                  </View>
                ))}
              </View>
            </View>
            <Feather name="chevron-right" size={18} color={colors.primary} />
          </TouchableOpacity>

          {/* Manual entry card */}
          <TouchableOpacity
            onPress={() => { Haptics.selectionAsync(); setStep("review"); }}
            style={[s.methodCard, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }]}
            activeOpacity={0.8}
          >
            <View style={[s.methodIcon, { backgroundColor: colors.muted }]}>
              <Feather name="edit-2" size={24} color={colors.mutedForeground} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[s.methodTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold", marginBottom: 4 }]}>Enter Manually</Text>
              <Text style={[s.methodDesc, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                Type in the details yourself — brand, model, serial number, etc.
              </Text>
            </View>
            <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
          </TouchableOpacity>

          <Text style={[s.footNote, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
            Assets track your home's major systems and appliances — HVAC, plumbing, appliances, and more.
          </Text>
        </ScrollView>
      )}

      {/* ── Step: AI Lens ── */}
      {step === "lens" && (
        <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {!imageUri ? (
            <>
              {/* Pick method buttons */}
              <TouchableOpacity onPress={pickFromCamera} style={[s.photoBtn, { backgroundColor: colors.primary, opacity: scanBusy ? 0.6 : 1 }]} activeOpacity={0.85} disabled={scanBusy}>
                <Feather name="camera" size={20} color="#fff" />
                <Text style={[s.photoBtnText, { fontFamily: "Inter_600SemiBold" }]}>Take a Photo</Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={pickFromGallery} style={[s.photoBtn, { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, opacity: scanBusy ? 0.6 : 1 }]} activeOpacity={0.85} disabled={scanBusy}>
                <Feather name="image" size={20} color={colors.foreground} />
                <Text style={[s.photoBtnText, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>Choose from Library</Text>
              </TouchableOpacity>

              <View style={[s.tipBox, { backgroundColor: colors.muted, borderColor: colors.border }]}>
                <Feather name="info" size={14} color={colors.mutedForeground} />
                <Text style={[s.tipText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                  Best results: spec plates, energy labels, model/serial stickers — the small metal or paper tag on the unit.
                </Text>
              </View>

              <TouchableOpacity onPress={() => { Haptics.selectionAsync(); setStep("review"); }} activeOpacity={0.7}>
                <Text style={[{ textAlign: "center", fontSize: 13, color: colors.mutedForeground, fontFamily: "Inter_400Regular", textDecorationLine: "underline" }]}>
                  Skip — Enter Manually
                </Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              {/* Image preview */}
              <View style={[s.imagePreview, { borderColor: colors.border }]}>
                <Image source={{ uri: imageUri }} style={{ width: "100%", height: 220 }} contentFit="contain" />
                {!scanBusy && (
                  <TouchableOpacity
                    onPress={() => { setImageUri(null); setImageBase64(null); setScanResult(null); setScanError(null); }}
                    style={[s.clearBtn, { backgroundColor: colors.background + "ee" }]}
                    activeOpacity={0.8}
                  >
                    <Feather name="x" size={14} color={colors.foreground} />
                  </TouchableOpacity>
                )}
                {scanBusy && (
                  <View style={s.scanOverlay}>
                    <ActivityIndicator color={colors.primary} size="large" />
                    <Text style={[{ color: colors.primary, fontFamily: "Inter_600SemiBold", fontSize: 14 }]}>Reading spec plate…</Text>
                  </View>
                )}
              </View>

              {/* Scan error */}
              {scanError && (
                <View style={[s.errorBox, { backgroundColor: colors.destructive + "12", borderColor: colors.destructive + "30" }]}>
                  <Feather name="alert-circle" size={14} color={colors.destructive} />
                  <Text style={[s.errorText, { color: colors.destructive, fontFamily: "Inter_400Regular" }]}>{scanError}</Text>
                </View>
              )}

              {/* Actions */}
              {!scanBusy && !scanError && (
                <TouchableOpacity onPress={handleScan} style={[s.photoBtn, { backgroundColor: colors.primary }]} activeOpacity={0.85}>
                  <Feather name="zap" size={18} color="#fff" />
                  <Text style={[s.photoBtnText, { fontFamily: "Inter_600SemiBold" }]}>Scan with AI</Text>
                </TouchableOpacity>
              )}

              {scanError && (
                <View style={{ flexDirection: "row", gap: 10 }}>
                  <TouchableOpacity
                    onPress={() => { setImageUri(null); setImageBase64(null); setScanError(null); }}
                    style={[s.halfBtn, { borderColor: colors.border, backgroundColor: colors.card }]}
                    activeOpacity={0.7}
                  >
                    <Text style={[s.halfBtnText, { color: colors.foreground, fontFamily: "Inter_500Medium" }]}>Retake Photo</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => { Haptics.selectionAsync(); setStep("review"); }}
                    style={[s.halfBtn, { backgroundColor: colors.primary }]}
                    activeOpacity={0.7}
                  >
                    <Text style={[s.halfBtnText, { color: "#fff", fontFamily: "Inter_600SemiBold" }]}>Enter Manually</Text>
                  </TouchableOpacity>
                </View>
              )}
            </>
          )}
        </ScrollView>
      )}

      {/* ── Step: Review / Edit Fields ── */}
      {step === "review" && (
        <>
          {/* AI success banner */}
          {scanResult && (
            <View style={[s.aiBanner, { backgroundColor: "#f0fdf4", borderColor: "#bbf7d0" }]}>
              <Feather name="zap" size={14} color="#16a34a" />
              <View style={{ flex: 1 }}>
                <Text style={[s.aiBannerTitle, { color: "#15803d", fontFamily: "Inter_600SemiBold" }]}>
                  AI Lens extracted {fieldsFilled + (scanResult.manufactureDate ? 1 : 0) + (scanResult.estimatedReplacementCost ? 1 : 0)} fields
                </Text>
                <Text style={[s.aiBannerSub, { color: "#16a34a", fontFamily: "Inter_400Regular" }]}>
                  Review and correct anything below before saving.
                </Text>
              </View>
            </View>
          )}

          <ScrollView
            contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 100, gap: 14 }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Name */}
            <View style={{ gap: 6 }}>
              <Text style={[s.label, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
                Asset Name <Text style={{ color: colors.destructive }}>*</Text>
              </Text>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="e.g. Carrier Central AC Unit"
                placeholderTextColor={colors.mutedForeground}
                style={[s.input, { color: colors.foreground, backgroundColor: colors.card, borderColor: colors.border, fontFamily: "Inter_400Regular" }]}
                autoFocus
              />
            </View>

            {/* Category picker */}
            <View style={{ gap: 6 }}>
              <Text style={[s.label, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>Category</Text>
              <TouchableOpacity
                onPress={() => { Haptics.selectionAsync(); setCategoryOpen((o) => !o); }}
                style={[s.input, s.pickerRow, { backgroundColor: colors.card, borderColor: colors.border }]}
                activeOpacity={0.7}
              >
                <Text style={[{ fontSize: 15 }]}>{CATEGORY_EMOJIS[category]}</Text>
                <Text style={[s.pickerText, { color: colors.foreground, fontFamily: "Inter_400Regular" }]}>{category}</Text>
                <Feather name={categoryOpen ? "chevron-up" : "chevron-down"} size={16} color={colors.mutedForeground} />
              </TouchableOpacity>
              {categoryOpen && (
                <View style={[s.dropdown, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  {CATEGORIES.map((c) => (
                    <TouchableOpacity
                      key={c}
                      onPress={() => { Haptics.selectionAsync(); setCategory(c); setCategoryOpen(false); }}
                      style={[s.dropdownItem, { borderBottomColor: colors.border, backgroundColor: c === category ? colors.primary + "12" : "transparent" }]}
                      activeOpacity={0.7}
                    >
                      <Text style={{ fontSize: 16 }}>{CATEGORY_EMOJIS[c]}</Text>
                      <Text style={[s.dropdownText, { color: colors.foreground, fontFamily: c === category ? "Inter_600SemiBold" : "Inter_400Regular" }]}>{c}</Text>
                      {c === category && <Feather name="check" size={14} color={colors.primary} />}
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            {/* Brand + Model */}
            <View style={{ flexDirection: "row", gap: 12 }}>
              <View style={{ flex: 1, gap: 6 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Text style={[s.label, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>Brand</Text>
                  {scanResult?.brand && <Text style={[s.aiTag, { color: "#16a34a", fontFamily: "Inter_600SemiBold" }]}>✓ AI</Text>}
                </View>
                <TextInput
                  value={brand}
                  onChangeText={setBrand}
                  placeholder="e.g. Carrier"
                  placeholderTextColor={colors.mutedForeground}
                  style={[s.input, { color: colors.foreground, backgroundColor: colors.card, borderColor: scanResult?.brand ? "#bbf7d0" : colors.border, fontFamily: "Inter_400Regular" }]}
                />
              </View>
              <View style={{ flex: 1, gap: 6 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Text style={[s.label, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>Model</Text>
                  {scanResult?.model && <Text style={[s.aiTag, { color: "#16a34a", fontFamily: "Inter_600SemiBold" }]}>✓ AI</Text>}
                </View>
                <TextInput
                  value={model}
                  onChangeText={setModel}
                  placeholder="e.g. 24ACC636A"
                  placeholderTextColor={colors.mutedForeground}
                  style={[s.input, { color: colors.foreground, backgroundColor: colors.card, borderColor: scanResult?.model ? "#bbf7d0" : colors.border, fontFamily: "Inter_400Regular" }]}
                />
              </View>
            </View>

            {/* Serial number */}
            <View style={{ gap: 6 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Text style={[s.label, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>Serial Number</Text>
                {scanResult?.serialNumber && <Text style={[s.aiTag, { color: "#16a34a", fontFamily: "Inter_600SemiBold" }]}>✓ AI</Text>}
              </View>
              <TextInput
                value={serialNumber}
                onChangeText={setSerialNumber}
                placeholder="e.g. 4319A12345"
                placeholderTextColor={colors.mutedForeground}
                style={[s.input, { color: colors.foreground, backgroundColor: colors.card, borderColor: scanResult?.serialNumber ? "#bbf7d0" : colors.border, fontFamily: "Inter_400Regular" }]}
              />
            </View>

            {/* Install date + Replacement cost */}
            <View style={{ flexDirection: "row", gap: 12 }}>
              <View style={{ flex: 1, gap: 6 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Text style={[s.label, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>Install Date</Text>
                  {scanResult?.manufactureDate && <Text style={[s.aiTag, { color: "#16a34a", fontFamily: "Inter_600SemiBold" }]}>✓ AI</Text>}
                </View>
                <TextInput
                  value={installDate}
                  onChangeText={setInstallDate}
                  placeholder="YYYY-MM"
                  placeholderTextColor={colors.mutedForeground}
                  keyboardType="numbers-and-punctuation"
                  style={[s.input, { color: colors.foreground, backgroundColor: colors.card, borderColor: scanResult?.manufactureDate ? "#bbf7d0" : colors.border, fontFamily: "Inter_400Regular" }]}
                />
              </View>
              <View style={{ flex: 1, gap: 6 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Text style={[s.label, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>Replacement $</Text>
                  {scanResult?.estimatedReplacementCost != null && <Text style={[s.aiTag, { color: "#16a34a", fontFamily: "Inter_600SemiBold" }]}>✓ AI</Text>}
                </View>
                <TextInput
                  value={replacementCost}
                  onChangeText={setReplacementCost}
                  placeholder="e.g. 4500"
                  placeholderTextColor={colors.mutedForeground}
                  keyboardType="decimal-pad"
                  style={[s.input, { color: colors.foreground, backgroundColor: colors.card, borderColor: scanResult?.estimatedReplacementCost != null ? "#bbf7d0" : colors.border, fontFamily: "Inter_400Regular" }]}
                />
              </View>
            </View>

            {/* Warranty expiry */}
            <View style={{ gap: 6 }}>
              <Text style={[s.label, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>Warranty Expiry</Text>
              <TextInput
                value={warrantyExpiry}
                onChangeText={setWarrantyExpiry}
                placeholder="YYYY-MM (optional)"
                placeholderTextColor={colors.mutedForeground}
                keyboardType="numbers-and-punctuation"
                style={[s.input, { color: colors.foreground, backgroundColor: colors.card, borderColor: colors.border, fontFamily: "Inter_400Regular" }]}
              />
            </View>
          </ScrollView>

          {/* Save button fixed at bottom */}
          <View style={[s.saveBar, { borderTopColor: colors.border, backgroundColor: colors.background, paddingBottom: insets.bottom + 12 }]}>
            <TouchableOpacity
              onPress={handleSave}
              disabled={!name.trim() || saveBusy}
              style={[s.saveBtn, { backgroundColor: colors.primary, opacity: (!name.trim() || saveBusy) ? 0.5 : 1 }]}
              activeOpacity={0.85}
            >
              <Feather name="zap" size={18} color="#fff" />
              <Text style={[s.saveBtnText, { fontFamily: "Inter_700Bold" }]}>Save & Generate Plan</Text>
            </TouchableOpacity>
          </View>
        </>
      )}

      {/* ── Step: Generating ── */}
      {step === "generating" && (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32, gap: 24 }}>
          <View style={[s.genIconWrap, { backgroundColor: colors.primary + "15" }]}>
            <ActivityIndicator color={colors.primary} size="large" />
          </View>
          <View style={{ alignItems: "center", gap: 8 }}>
            <Text style={[{ fontSize: 18, color: colors.foreground, fontFamily: "Inter_700Bold", textAlign: "center" }]}>
              {generatingStatus}
            </Text>
            <Text style={[{ fontSize: 13, color: colors.mutedForeground, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 19 }]}>
              We're researching manufacturer specs and building a custom maintenance schedule for your {name || "asset"}.
            </Text>
          </View>
          <View style={[s.genBullets, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {[
              { icon: "check-circle" as const, text: "Asset saved to your property" },
              { icon: "cpu" as const, text: "Analyzing manufacturer specs" },
              { icon: "calendar" as const, text: "Scheduling maintenance tasks" },
            ].map(({ icon, text }) => (
              <View key={text} style={s.genBulletRow}>
                <Feather name={icon} size={14} color={colors.primary} />
                <Text style={[{ fontSize: 13, color: colors.foreground, fontFamily: "Inter_400Regular" }]}>{text}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* ── Step: Done ── */}
      {step === "done" && (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32, gap: 20 }}>
          <View style={[s.genIconWrap, { backgroundColor: "#3d7a5f18" }]}>
            <Feather name="check-circle" size={44} color="#3d7a5f" />
          </View>
          <View style={{ alignItems: "center", gap: 8 }}>
            <Text style={[{ fontSize: 22, color: colors.foreground, fontFamily: "Inter_700Bold", textAlign: "center" }]}>
              {name || "Asset"} Added!
            </Text>
            <Text style={[{ fontSize: 14, color: colors.mutedForeground, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 20 }]}>
              {planBlocked
                ? "Asset saved. Upgrade to Basic to unlock AI maintenance plans for all your assets."
                : (taskCount ?? 0) > 0
                  ? `${taskCount} maintenance task${taskCount !== 1 ? "s" : ""} have been scheduled based on manufacturer specs.`
                  : "Your asset is now tracked. Maintenance tasks will appear in your inbox."}
            </Text>
          </View>

          {planBlocked && (
            <View style={{ width: "100%", borderRadius: 14, borderWidth: 1, borderColor: "#fcd34d", backgroundColor: "#fffbeb", padding: 14, flexDirection: "row", alignItems: "center", gap: 10 }}>
              <Feather name="zap" size={18} color="#d97706" />
              <View style={{ flex: 1 }}>
                <Text style={[{ fontSize: 13, color: "#92400e", fontFamily: "Inter_600SemiBold" }]}>Free AI plan used</Text>
                <Text style={[{ fontSize: 12, color: "#b45309", fontFamily: "Inter_400Regular", marginTop: 2, lineHeight: 17 }]}>
                  Upgrade to Basic for unlimited AI maintenance plans on all assets.
                </Text>
              </View>
            </View>
          )}

          <View style={{ width: "100%", gap: 10, marginTop: 8 }}>
            <TouchableOpacity
              onPress={() => {
                Haptics.selectionAsync();
                if (createdAssetId) router.replace(`/asset/${createdAssetId}`);
                else router.back();
              }}
              style={[s.saveBtn, { backgroundColor: "#3d7a5f" }]}
              activeOpacity={0.85}
            >
              <Feather name="eye" size={18} color="#fff" />
              <Text style={[s.saveBtnText, { fontFamily: "Inter_700Bold" }]}>View Asset</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => { Haptics.selectionAsync(); reset(); }}
              style={[s.outlineBtn, { borderColor: colors.border }]}
              activeOpacity={0.7}
            >
              <Feather name="plus" size={16} color={colors.foreground} />
              <Text style={[s.outlineBtnText, { color: colors.foreground, fontFamily: "Inter_500Medium" }]}>Add Another Asset</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
              <Text style={[{ textAlign: "center", fontSize: 13, color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                Done
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, gap: 10 },
  backBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  headerCenter: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10 },
  headerIcon: { width: 32, height: 32, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 17 },
  headerSub: { fontSize: 11, marginTop: 1 },
  stepDots: { flexDirection: "row", gap: 4, alignItems: "center" },
  dot: { height: 6, borderRadius: 3 },
  methodCard: { flexDirection: "row", alignItems: "flex-start", gap: 14, borderRadius: 16, padding: 16 },
  methodIcon: { width: 52, height: 52, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  methodTitle: { fontSize: 15 },
  methodDesc: { fontSize: 12, lineHeight: 18 },
  recBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 99 },
  recBadgeText: { fontSize: 9 },
  featureTip: { fontSize: 11 },
  footNote: { fontSize: 12, textAlign: "center", lineHeight: 18, marginTop: 4 },
  photoBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, borderRadius: 14, paddingVertical: 15 },
  photoBtnText: { color: "#fff", fontSize: 15 },
  tipBox: { flexDirection: "row", alignItems: "flex-start", gap: 10, borderRadius: 12, borderWidth: 1, padding: 12 },
  tipText: { fontSize: 12, flex: 1, lineHeight: 17 },
  imagePreview: { borderRadius: 14, borderWidth: 1, overflow: "hidden", position: "relative", backgroundColor: "#f8f8f8" },
  clearBtn: { position: "absolute", top: 8, right: 8, width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#e5e7eb" },
  scanOverlay: { position: "absolute", inset: 0, backgroundColor: "rgba(255,255,255,0.75)", alignItems: "center", justifyContent: "center", gap: 10 },
  errorBox: { flexDirection: "row", alignItems: "flex-start", gap: 8, borderRadius: 10, borderWidth: 1, padding: 10 },
  errorText: { fontSize: 13, flex: 1, lineHeight: 18 },
  halfBtn: { flex: 1, alignItems: "center", justifyContent: "center", borderRadius: 12, borderWidth: 1, paddingVertical: 13 },
  halfBtnText: { fontSize: 14 },
  aiBanner: { flexDirection: "row", alignItems: "flex-start", gap: 10, borderBottomWidth: 1, paddingHorizontal: 20, paddingVertical: 12 },
  aiBannerTitle: { fontSize: 13 },
  aiBannerSub: { fontSize: 11, marginTop: 1 },
  label: { fontSize: 12 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11, fontSize: 14 },
  pickerRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  pickerText: { flex: 1, fontSize: 14 },
  dropdown: { borderRadius: 12, borderWidth: 1, overflow: "hidden" },
  dropdownItem: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  dropdownText: { flex: 1, fontSize: 14 },
  aiTag: { fontSize: 10 },
  saveBar: { borderTopWidth: 1, paddingHorizontal: 20, paddingTop: 12 },
  saveBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, borderRadius: 14, paddingVertical: 15 },
  saveBtnText: { color: "#fff", fontSize: 15 },
  outlineBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 14, borderWidth: 1, paddingVertical: 13 },
  outlineBtnText: { fontSize: 14 },
  genIconWrap: { width: 88, height: 88, borderRadius: 44, alignItems: "center", justifyContent: "center" },
  genBullets: { borderRadius: 14, borderWidth: 1, padding: 16, gap: 12, width: "100%" },
  genBulletRow: { flexDirection: "row", alignItems: "center", gap: 10 },
});
