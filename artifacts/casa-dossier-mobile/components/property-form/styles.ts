import { StyleSheet } from "react-native";

// Shared by the property form modal and its fields
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
  saveText: { fontSize: 15 },
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
