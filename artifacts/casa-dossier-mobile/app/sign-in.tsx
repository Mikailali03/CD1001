import { useSignIn, useSignUp, useSSO } from "@clerk/expo";
import * as WebBrowser from "expo-web-browser";
import * as AuthSession from "expo-auth-session";
import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import * as Haptics from "expo-haptics";

WebBrowser.maybeCompleteAuthSession();

function useWarmUpBrowser() {
  useEffect(() => {
    if (Platform.OS !== "android") return;
    void WebBrowser.warmUpAsync();
    return () => {
      void WebBrowser.coolDownAsync();
    };
  }, []);
}

export default function SignInScreen() {
  useWarmUpBrowser();

  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [ssoLoading, setSsoLoading] = useState<"google" | "apple" | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const { signIn, setActive: setSignInActive, isLoaded: signInLoaded } = useSignIn();
  const { signUp, setActive: setSignUpActive, isLoaded: signUpLoaded } = useSignUp();
  const { startSSOFlow } = useSSO();

  const handleSSOSignIn = useCallback(
    async (strategy: "oauth_google" | "oauth_apple") => {
      setError("");
      setSsoLoading(strategy === "oauth_google" ? "google" : "apple");
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      try {
        const { createdSessionId, setActive } = await startSSOFlow({
          strategy,
          redirectUrl: AuthSession.makeRedirectUri(),
        });
        if (createdSessionId && setActive) {
          await setActive({ session: createdSessionId });
        }
      } catch (err: unknown) {
        const clerkErr = err as { errors?: { message: string }[] };
        const msg = clerkErr.errors?.[0]?.message ?? "Sign in failed. Please try again.";
        setError(msg);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      } finally {
        setSsoLoading(null);
      }
    },
    [startSSOFlow],
  );

  const handleAuth = async () => {
    if (!signInLoaded || !signUpLoaded) return;
    setError("");
    setLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      if (mode === "signin") {
        const result = await signIn.create({ identifier: email.trim(), password });
        if (result.status === "complete") {
          await setSignInActive({ session: result.createdSessionId });
        } else {
          setError("Sign in incomplete. Please check your credentials.");
        }
      } else {
        const result = await signUp.create({
          emailAddress: email.trim(),
          password,
          firstName: firstName.trim() || undefined,
          lastName: lastName.trim() || undefined,
        });
        if (result.status === "complete") {
          await setSignUpActive({ session: result.createdSessionId });
        } else if (result.status === "missing_requirements") {
          await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
          setError("Check your email for a verification code.");
        }
      }
    } catch (err: unknown) {
      const clerkErr = err as { errors?: { message: string }[] };
      setError(clerkErr.errors?.[0]?.message ?? "Something went wrong. Please try again.");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoading(false);
    }
  };

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const anyLoading = loading || !!ssoLoading;

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: topPad + 40, paddingBottom: insets.bottom + 40 },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Brand */}
        <View style={styles.brandRow}>
          <View style={[styles.logoCircle, { backgroundColor: colors.primary }]}>
            <Feather name="home" size={24} color={colors.primaryForeground} />
          </View>
        </View>
        <Text style={[styles.appName, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
          Casa Dossier
        </Text>
        <Text
          style={[styles.tagline, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}
        >
          Your Home's Complete History
        </Text>

        {/* SSO Buttons */}
        <View style={[styles.ssoGroup, { width: "100%", maxWidth: 400 }]}>
          <TouchableOpacity
            style={[
              styles.ssoBtn,
              { backgroundColor: colors.card, borderColor: colors.border },
              anyLoading && { opacity: 0.65 },
            ]}
            onPress={() => handleSSOSignIn("oauth_google")}
            disabled={anyLoading}
            activeOpacity={0.75}
          >
            {ssoLoading === "google" ? (
              <ActivityIndicator color={colors.foreground} size="small" />
            ) : (
              <GoogleIcon />
            )}
            <Text
              style={[
                styles.ssoBtnText,
                { color: colors.foreground, fontFamily: "Inter_500Medium" },
              ]}
            >
              Continue with Google
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.ssoBtn,
              { backgroundColor: colors.primary, borderColor: colors.primary },
              anyLoading && { opacity: 0.65 },
            ]}
            onPress={() => handleSSOSignIn("oauth_apple")}
            disabled={anyLoading}
            activeOpacity={0.75}
          >
            {ssoLoading === "apple" ? (
              <ActivityIndicator color={colors.primaryForeground} size="small" />
            ) : (
              <AppleIcon color={colors.primaryForeground} />
            )}
            <Text
              style={[
                styles.ssoBtnText,
                { color: colors.primaryForeground, fontFamily: "Inter_500Medium" },
              ]}
            >
              Continue with Apple
            </Text>
          </TouchableOpacity>
        </View>

        {/* Divider */}
        <View style={styles.dividerRow}>
          <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
          <Text
            style={[
              styles.dividerText,
              { color: colors.mutedForeground, fontFamily: "Inter_400Regular" },
            ]}
          >
            or
          </Text>
          <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
        </View>

        {/* Email/password form card */}
        <View
          style={[
            styles.card,
            { backgroundColor: colors.card, borderColor: colors.border, width: "100%", maxWidth: 400 },
          ]}
        >
          <Text
            style={[styles.cardTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}
          >
            {mode === "signin" ? "Sign in with email" : "Create account"}
          </Text>

          {mode === "signup" && (
            <View style={styles.nameRow}>
              <TextInput
                style={[
                  styles.input,
                  styles.halfInput,
                  {
                    backgroundColor: colors.background,
                    borderColor: colors.border,
                    color: colors.foreground,
                    fontFamily: "Inter_400Regular",
                  },
                ]}
                placeholder="First name"
                placeholderTextColor={colors.mutedForeground}
                value={firstName}
                onChangeText={setFirstName}
                autoCapitalize="words"
              />
              <TextInput
                style={[
                  styles.input,
                  styles.halfInput,
                  {
                    backgroundColor: colors.background,
                    borderColor: colors.border,
                    color: colors.foreground,
                    fontFamily: "Inter_400Regular",
                  },
                ]}
                placeholder="Last name"
                placeholderTextColor={colors.mutedForeground}
                value={lastName}
                onChangeText={setLastName}
                autoCapitalize="words"
              />
            </View>
          )}

          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: colors.background,
                borderColor: colors.border,
                color: colors.foreground,
                fontFamily: "Inter_400Regular",
              },
            ]}
            placeholder="Email address"
            placeholderTextColor={colors.mutedForeground}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />

          <View style={styles.passwordWrap}>
            <TextInput
              style={[
                styles.input,
                styles.passwordInput,
                {
                  backgroundColor: colors.background,
                  borderColor: colors.border,
                  color: colors.foreground,
                  fontFamily: "Inter_400Regular",
                },
              ]}
              placeholder="Password"
              placeholderTextColor={colors.mutedForeground}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
            />
            <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowPassword((v) => !v)}>
              <Feather
                name={showPassword ? "eye-off" : "eye"}
                size={18}
                color={colors.mutedForeground}
              />
            </TouchableOpacity>
          </View>

          {error !== "" && (
            <View style={[styles.errorBadge, { backgroundColor: colors.destructive + "18" }]}>
              <Feather name="alert-circle" size={14} color={colors.destructive} />
              <Text
                style={[
                  styles.errorText,
                  { color: colors.destructive, fontFamily: "Inter_400Regular" },
                ]}
              >
                {error}
              </Text>
            </View>
          )}

          <TouchableOpacity
            style={[
              styles.submitBtn,
              { backgroundColor: colors.primary },
              anyLoading && { opacity: 0.7 },
            ]}
            onPress={handleAuth}
            disabled={anyLoading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color={colors.primaryForeground} />
            ) : (
              <Text
                style={[
                  styles.submitText,
                  { color: colors.primaryForeground, fontFamily: "Inter_600SemiBold" },
                ]}
              >
                {mode === "signin" ? "Sign In" : "Create Account"}
              </Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Toggle */}
        <View style={styles.toggleRow}>
          <Text
            style={[
              styles.toggleText,
              { color: colors.mutedForeground, fontFamily: "Inter_400Regular" },
            ]}
          >
            {mode === "signin" ? "Don't have an account?" : "Already have an account?"}
          </Text>
          <TouchableOpacity
            onPress={() => {
              setMode((m) => (m === "signin" ? "signup" : "signin"));
              setError("");
            }}
          >
            <Text
              style={[
                styles.toggleLink,
                { color: colors.primary, fontFamily: "Inter_600SemiBold" },
              ]}
            >
              {mode === "signin" ? "Sign Up" : "Sign In"}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function GoogleIcon() {
  return (
    <View style={iconStyles.wrap}>
      <Text style={iconStyles.g}>G</Text>
    </View>
  );
}

function AppleIcon({ color }: { color: string }) {
  return (
    <View style={iconStyles.wrap}>
      <Text style={[iconStyles.apple, { color }]}></Text>
    </View>
  );
}

const iconStyles = StyleSheet.create({
  wrap: { width: 20, height: 20, alignItems: "center", justifyContent: "center" },
  g: { fontSize: 15, fontWeight: "700", color: "#4285F4", fontFamily: "System" },
  apple: { fontSize: 17, lineHeight: 20, fontFamily: "System" },
});

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { paddingHorizontal: 24, alignItems: "center" },
  brandRow: { marginBottom: 12 },
  logoCircle: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  appName: { fontSize: 28, marginBottom: 4 },
  tagline: { fontSize: 14, marginBottom: 28 },
  ssoGroup: { gap: 10 },
  ssoBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    height: 50,
    borderRadius: 12,
    borderWidth: 1,
  },
  ssoBtnText: { fontSize: 15 },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    maxWidth: 400,
    marginVertical: 20,
    gap: 12,
  },
  dividerLine: { flex: 1, height: 1 },
  dividerText: { fontSize: 13 },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
    gap: 12,
  },
  cardTitle: { fontSize: 16, marginBottom: 2 },
  nameRow: { flexDirection: "row", gap: 10 },
  halfInput: { flex: 1 },
  input: {
    height: 48,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 15,
  },
  passwordWrap: { position: "relative" },
  passwordInput: { paddingRight: 44 },
  eyeBtn: {
    position: "absolute",
    right: 14,
    top: 0,
    bottom: 0,
    justifyContent: "center",
  },
  errorBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 8,
    padding: 10,
  },
  errorText: { fontSize: 13, flex: 1 },
  submitBtn: {
    height: 50,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  submitText: { fontSize: 16 },
  toggleRow: {
    flexDirection: "row",
    gap: 6,
    marginTop: 20,
    alignItems: "center",
  },
  toggleText: { fontSize: 14 },
  toggleLink: { fontSize: 14 },
});
