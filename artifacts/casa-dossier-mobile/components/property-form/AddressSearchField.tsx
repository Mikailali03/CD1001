import React, { useEffect, useRef, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, TextInput, Alert } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import {
  autocompletePropertyAddress,
  lookupProperty,
  type AddressSuggestion,
  type PropertyLookupResult,
} from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { isApiError } from "@/lib/api-errors";
import { fStyles } from "./styles";

type Suggestion = AddressSuggestion;

// ── Address search: debounced autocomplete + public-records lookup ────────────
export function AddressSearchField({
  onFilled, colors,
}: {
  onFilled: (data: PropertyLookupResult) => void;
  colors: ReturnType<typeof useColors>;
}) {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState("");
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupFilled, setLookupFilled] = useState(false);

  // Autocomplete suggestions
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const autocompleteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
        const data = await autocompletePropertyAddress({ query: q, limit: 6 });
        setSuggestions(data.suggestions ?? []);
        setShowSuggestions((data.suggestions ?? []).length > 0);
      } catch {
        // Server or network error — gracefully degrade, keep search button functional
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
      let data;
      try {
        data = await lookupProperty({ address: q });
      } catch (err) {
        if (!isApiError(err)) throw err;
        const detail = (err.data as { detail?: unknown } | null)?.detail;
        const msg =
          err.status === 404
            ? t("propertyForm.lookupNotFound")
            : (typeof detail === "string" ? detail : t("propertyForm.lookupFailed"));
        Alert.alert(t("propertyForm.addressNotFound"), msg);
        return;
      }
      onFilled(data);
      setLookupFilled(true);
    } catch {
      Alert.alert(t("common.error"), t("propertyForm.serverUnreachable"));
    } finally {
      setLookupLoading(false);
    }
  }

  return (
    <View style={fStyles.field}>
      <Text style={[fStyles.label, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>
        {t("propertyForm.searchAddress")}
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
          placeholder={t("propertyForm.searchPlaceholder")}
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
          accessibilityRole="button"
          accessibilityLabel={t("propertyForm.lookUpAddress")}
          onPress={() => handleLookup()}
          style={[fStyles.searchBtn, { backgroundColor: colors.primary, opacity: lookupLoading || !searchQuery.trim() ? 0.6 : 1 }]}
          activeOpacity={0.8}
          disabled={lookupLoading || !searchQuery.trim()}
        >
          {lookupLoading || suggestionsLoading ? (
            <ActivityIndicator size="small" color={colors.primaryForeground} />
          ) : (
            <Feather name="search" size={17} color={colors.primaryForeground} />
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
            {t("propertyForm.filledFromRecords")}
          </Text>
        </View>
      )}
    </View>
  );
}
