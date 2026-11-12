import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ActivityIndicator,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import {
  emailPropertyReport,
  useListReportSends,
  getListReportSendsQueryKey,
} from "@workspace/api-client-react";
import { apiErrorMessage } from "@/hooks/useRole";
import { formatDate } from "@/lib/dates";
import { useColors } from "@/hooks/useColors";

const MAX_RECIPIENTS = 5;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Emails the report PDF straight from Casa Dossier on the user's behalf, so the
// recipient knows it hasn't been changed.
export function EmailReportSheet({ propertyId, visible, onClose, colors }: {
  propertyId: string;
  visible: boolean;
  onClose: () => void;
  colors: ReturnType<typeof useColors>;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [recipients, setRecipients] = useState("");
  const [message, setMessage] = useState("");
  const [includeCosts, setIncludeCosts] = useState(true);
  const [sending, setSending] = useState(false);
  const { data: sends = [] } = useListReportSends(propertyId, {
    query: { queryKey: getListReportSendsQueryKey(propertyId), enabled: visible },
  });

  async function send() {
    const list = [...new Set(recipients.split(/[\s,;]+/).map((r) => r.trim().toLowerCase()).filter(Boolean))];
    if (list.length === 0) return Alert.alert(t("reportShare.recipientsRequired"));
    if (list.length > MAX_RECIPIENTS) return Alert.alert(t("reportShare.tooMany", { max: MAX_RECIPIENTS }));
    const bad = list.find((r) => !EMAIL_RE.test(r));
    if (bad) return Alert.alert(t("reportShare.invalidEmail", { email: bad }));

    setSending(true);
    try {
      const result = await emailPropertyReport(propertyId, { recipients: list, message: message.trim() || undefined, includeCosts });
      queryClient.invalidateQueries({ queryKey: getListReportSendsQueryKey(propertyId) });
      Alert.alert(
        t("reportShare.sent"),
        result.failedRecipients.length ? t("reportShare.partlyFailed", { emails: result.failedRecipients.join(", ") }) : undefined,
      );
      setRecipients("");
      setMessage("");
      onClose();
    } catch (err) {
      Alert.alert(t("reportShare.sendFailed"), apiErrorMessage(err) ?? undefined);
    } finally {
      setSending(false);
    }
  }

  const inputStyle = [styles.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.card }];

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => !sending && onClose()}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.foreground }]}>{t("reportShare.title")}</Text>
            <TouchableOpacity onPress={() => !sending && onClose()} hitSlop={10} accessibilityLabel={t("common.cancel")}>
              <Feather name="x" size={22} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>
          <Text style={[styles.hint, { color: colors.mutedForeground }]}>{t("reportShare.description")}</Text>

          <Text style={[styles.label, { color: colors.foreground }]}>{t("reportShare.recipients")}</Text>
          <TextInput
            style={inputStyle}
            value={recipients}
            onChangeText={setRecipients}
            placeholder={t("reportShare.recipientsPlaceholder")}
            placeholderTextColor={colors.mutedForeground}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />

          <Text style={[styles.label, { color: colors.foreground }]}>{t("reportShare.message")}</Text>
          <TextInput
            style={[inputStyle, { minHeight: 80, textAlignVertical: "top" }]}
            value={message}
            onChangeText={setMessage}
            placeholder={t("reportShare.messagePlaceholder")}
            placeholderTextColor={colors.mutedForeground}
            multiline
            maxLength={1000}
          />

          <TouchableOpacity
            onPress={() => setIncludeCosts((v) => !v)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: includeCosts }}
            style={styles.checkRow}
          >
            <Feather name={includeCosts ? "check-square" : "square"} size={18} color={colors.primary} />
            <Text style={{ color: colors.foreground, fontFamily: "Inter_500Medium", fontSize: 14 }}>{t("reportShare.includeCosts")}</Text>
          </TouchableOpacity>
          <Text style={[styles.hint, { color: colors.mutedForeground, marginTop: 4 }]}>{t("reportShare.receiptsNote")}</Text>

          <TouchableOpacity
            onPress={send}
            disabled={sending}
            style={[styles.send, { backgroundColor: colors.primary, opacity: sending ? 0.7 : 1 }]}
            activeOpacity={0.85}
          >
            {sending
              ? <ActivityIndicator color={colors.primaryForeground} />
              : <Text style={{ color: colors.primaryForeground, fontFamily: "Inter_600SemiBold", fontSize: 15 }}>{t("reportShare.send")}</Text>}
          </TouchableOpacity>

          {sends.length > 0 && (
            <View style={{ marginTop: 24 }}>
              <Text style={[styles.label, { color: colors.foreground }]}>{t("reportShare.history")}</Text>
              {sends.map((s) => (
                <Text key={s.id} style={[styles.hint, { color: colors.mutedForeground }]}>
                  {formatDate(s.createdAt, "MMM d, yyyy")} · {s.recipients.join(", ")}
                </Text>
              ))}
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  body: { padding: 20, paddingBottom: 48 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  title: { fontSize: 18, fontFamily: "Inter_700Bold" },
  hint: { fontSize: 12, lineHeight: 17, fontFamily: "Inter_400Regular" },
  label: { fontSize: 13, fontFamily: "Inter_600SemiBold", marginTop: 18, marginBottom: 6 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11, fontSize: 14, fontFamily: "Inter_400Regular" },
  checkRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 18 },
  send: { borderRadius: 12, paddingVertical: 14, alignItems: "center", marginTop: 24 },
});
