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
import { useTranslation } from "react-i18next";

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

// Which card is showing. "form" is the email/password sign-in or sign-up form.
type Step =
  | "form"
  | "verifySignUp"
  | "secondFactor"
  | "resetRequest"
  | "resetCode"
  | "newPassword";

type SecondFactorStrategy = "totp" | "email_code" | "phone_code" | "backup_code";

// Clerk's signal API resolves with `{ error }` instead of throwing — rethrow so
// every flow can share one try/catch
async function run(promise: Promise<{ error: unknown }>) {
  const { error } = await promise;
  if (error) throw error;
}

// API errors carry `errors[]` with a human `longMessage`; runtime errors only have `message`
function errorMessage(err: unknown, fallback: string): string {
  const e = err as {
    errors?: { longMessage?: string; message?: string }[];
    longMessage?: string;
  } | null;
  return e?.errors?.[0]?.longMessage ?? e?.errors?.[0]?.message ?? e?.longMessage ?? fallback;
}

export default function SignInScreen() {
  useWarmUpBrowser();
  const { t } = useTranslation();

  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [step, setStep] = useState<Step>("form");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);
  const [ssoLoading, setSsoLoading] = useState<"google" | "apple" | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [code, setCode] = useState("");
  const [secondFactor, setSecondFactor] = useState<SecondFactorStrategy>("totp");
  // True when Clerk wants to confirm a new device rather than a configured MFA method
  const [isNewDevice, setIsNewDevice] = useState(false);

  const { signIn } = useSignIn();
  const { signUp } = useSignUp();
  const { startSSOFlow } = useSSO();

  const fail = (err: unknown, fallback: string) => {
    setError(errorMessage(err, fallback));
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
  };

  const goToStep = (next: Step) => {
    setStep(next);
    setCode("");
    setError("");
  };

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
        setError(errorMessage(err, t("signIn.errors.signInFailed")));
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      } finally {
        setSsoLoading(null);
      }
    },
    [startSSOFlow, t],
  );

  // Sends the code for the chosen second factor (TOTP and backup codes need no send)
  const sendSecondFactorCode = async (strategy: SecondFactorStrategy) => {
    if (strategy === "email_code") await run(signIn.mfa.sendEmailCode());
    if (strategy === "phone_code") await run(signIn.mfa.sendPhoneCode());
  };

  // Routes a sign-in to the next screen based on its status — shared by password
  // sign-in, second-factor verification and password reset
  const continueSignIn = async () => {
    switch (signIn.status) {
      case "complete":
        // AuthGate redirects to the tabs once the session is active
        await run(signIn.finalize());
        return;
      case "needs_second_factor":
      case "needs_client_trust": {
        const newDevice = signIn.status === "needs_client_trust";
        const available = (signIn.supportedSecondFactors ?? []).map((f) => f.strategy);
        // New-device checks are usually an emailed code; real MFA prefers the authenticator app
        const order: SecondFactorStrategy[] = newDevice
          ? ["email_code", "phone_code", "totp"]
          : ["totp", "email_code", "phone_code", "backup_code"];
        const strategy = order.find((s) => available.includes(s));
        if (!strategy) {
          setError(t("signIn.errors.unsupportedMfa"));
          return;
        }
        await sendSecondFactorCode(strategy);
        setIsNewDevice(newDevice);
        setSecondFactor(strategy);
        goToStep("secondFactor");
        return;
      }
      case "needs_new_password":
        setNewPassword("");
        goToStep("newPassword");
        return;
      case "needs_first_factor":
        setError(t("signIn.errors.noPassword"));
        return;
      default:
        setError(t("signIn.errors.signInIncomplete"));
    }
  };

  const handleAuth = async () => {
    setError("");
    setInfo("");
    setLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      if (mode === "signin") {
        await run(signIn.password({ identifier: email.trim(), password }));
        await continueSignIn();
      } else {
        await run(
          signUp.password({
            emailAddress: email.trim(),
            password,
            firstName: firstName.trim() || undefined,
            lastName: lastName.trim() || undefined,
          }),
        );
        if (signUp.status === "complete") {
          await run(signUp.finalize());
        } else if (signUp.unverifiedFields.includes("email_address")) {
          await run(signUp.verifications.sendEmailCode());
          goToStep("verifySignUp");
        } else {
          setError(t("signIn.errors.signUpIncomplete"));
        }
      }
    } catch (err: unknown) {
      fail(err, t("common.somethingWentWrong"));
    } finally {
      setLoading(false);
    }
  };

  const handleVerifySignUp = async () => {
    setError("");
    setLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await run(signUp.verifications.verifyEmailCode({ code: code.trim() }));
      if (signUp.status === "complete") {
        await run(signUp.finalize());
      } else {
        setError(t("signIn.errors.verificationIncomplete"));
      }
    } catch (err: unknown) {
      fail(err, t("signIn.errors.invalidCode"));
    } finally {
      setLoading(false);
    }
  };

  const handleVerifySecondFactor = async () => {
    setError("");
    setLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const c = code.trim();
      if (secondFactor === "totp") await run(signIn.mfa.verifyTOTP({ code: c }));
      if (secondFactor === "email_code") await run(signIn.mfa.verifyEmailCode({ code: c }));
      if (secondFactor === "phone_code") await run(signIn.mfa.verifyPhoneCode({ code: c }));
      if (secondFactor === "backup_code") await run(signIn.mfa.verifyBackupCode({ code: c }));
      await continueSignIn();
    } catch (err: unknown) {
      fail(err, t("signIn.errors.invalidCode"));
    } finally {
      setLoading(false);
    }
  };

  // Forgot password, step 1: start a sign-in for the email and send a reset code
  const handleSendResetCode = async () => {
    setError("");
    setLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await run(signIn.create({ identifier: email.trim() }));
      await run(signIn.resetPasswordEmailCode.sendCode());
      goToStep("resetCode");
    } catch (err: unknown) {
      fail(err, t("signIn.errors.resetSendFailed"));
    } finally {
      setLoading(false);
    }
  };

  // Step 2: the code moves the sign-in to needs_new_password
  const handleVerifyResetCode = async () => {
    setError("");
    setLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await run(signIn.resetPasswordEmailCode.verifyCode({ code: code.trim() }));
      await continueSignIn();
    } catch (err: unknown) {
      fail(err, t("signIn.errors.invalidCode"));
    } finally {
      setLoading(false);
    }
  };

  // Step 3: set the new password; MFA may still be required afterwards
  const handleSubmitNewPassword = async () => {
    setError("");
    setLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await run(signIn.resetPasswordEmailCode.submitPassword({ password: newPassword }));
      await continueSignIn();
    } catch (err: unknown) {
      fail(err, t("signIn.errors.passwordUpdateFailed"));
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    setError("");
    setInfo("");
    try {
      if (step === "verifySignUp") await run(signUp.verifications.sendEmailCode());
      if (step === "resetCode") await run(signIn.resetPasswordEmailCode.sendCode());
      if (step === "secondFactor") await sendSecondFactorCode(secondFactor);
      setInfo(t("signIn.codeResent"));
    } catch (err: unknown) {
      fail(err, t("signIn.errors.resendFailed"));
    }
  };

  const backToForm = () => {
    // Drop the half-finished attempt so the next submit starts clean
    void signIn.reset();
    goToStep("form");
    setInfo("");
  };

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const anyLoading = loading || !!ssoLoading;
  const onForm = step === "form";

  const inputStyle = [
    styles.input,
    {
      backgroundColor: colors.background,
      borderColor: colors.border,
      color: colors.foreground,
      fontFamily: "Inter_400Regular",
    },
  ];

  const errorBadge =
    error !== "" ? (
      <View
        style={[styles.errorBadge, { backgroundColor: colors.destructive + "18" }]}
        accessibilityRole="alert"
      >
        <Feather name="alert-circle" size={14} color={colors.destructive} />
        <Text style={[styles.errorText, { color: colors.destructive, fontFamily: "Inter_400Regular" }]}>
          {error}
        </Text>
      </View>
    ) : null;

  const infoBadge =
    info !== "" ? (
      <Text style={[styles.verifyHint, { color: colors.success, fontFamily: "Inter_500Medium" }]}>
        {info}
      </Text>
    ) : null;

  const renderSubmit = (label: string, onPress: () => void, disabled = false) => (
    <TouchableOpacity
      style={[
        styles.submitBtn,
        { backgroundColor: colors.primary },
        (anyLoading || disabled) && { opacity: 0.7 },
      ]}
      onPress={onPress}
      disabled={anyLoading || disabled}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: anyLoading || disabled, busy: loading }}
    >
      {loading ? (
        <ActivityIndicator color={colors.primaryForeground} />
      ) : (
        <Text style={[styles.submitText, { color: colors.primaryForeground, fontFamily: "Inter_600SemiBold" }]}>
          {label}
        </Text>
      )}
    </TouchableOpacity>
  );

  const renderLink = (label: string, onPress: () => void, color = colors.mutedForeground) => (
    <TouchableOpacity
      onPress={onPress}
      style={{ alignItems: "center", marginTop: 4 }}
      hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
      accessibilityRole="button"
    >
      <Text style={[styles.toggleLink, { color, fontFamily: "Inter_400Regular" }]}>{label}</Text>
    </TouchableOpacity>
  );

  // Shared one-time-code card for sign-up verification, MFA / new device, and password reset
  const renderCodeCard = (opts: {
    title: string;
    hint: string;
    submitLabel: string;
    onSubmit: () => void;
    backLabel: string;
    onBack: () => void;
    canResend: boolean;
    alphanumeric?: boolean;
    extra?: React.ReactNode;
  }) => {
    const minLength = opts.alphanumeric ? 8 : 6;
    return (
      <>
        <Text style={[styles.cardTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
          {opts.title}
        </Text>
        <Text style={[styles.verifyHint, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
          {opts.hint}
        </Text>
        <TextInput
          style={[...inputStyle, { letterSpacing: 4, textAlign: "center" }]}
          placeholder={opts.alphanumeric ? t("signIn.backupCode") : "------"}
          placeholderTextColor={colors.mutedForeground}
          value={code}
          onChangeText={setCode}
          keyboardType={opts.alphanumeric ? "default" : "number-pad"}
          autoCapitalize="none"
          autoCorrect={false}
          textContentType="oneTimeCode"
          autoComplete="one-time-code"
          maxLength={opts.alphanumeric ? 16 : 6}
          accessibilityLabel={t("signIn.verificationCode")}
          autoFocus
        />
        {errorBadge}
        {infoBadge}
        {renderSubmit(opts.submitLabel, opts.onSubmit, code.trim().length < minLength)}
        {opts.canResend && renderLink(t("signIn.resendCode"), handleResendCode, colors.primary)}
        {opts.extra}
        {renderLink(opts.backLabel, opts.onBack)}
      </>
    );
  };

  const secondFactorHint = (() => {
    const lead = isNewDevice ? t("signIn.mfa.newDevice") : t("signIn.mfa.enabled");
    const body = (() => {
      switch (secondFactor) {
        case "totp":
          return t("signIn.mfa.totp");
        case "email_code":
          return t("signIn.mfa.email", { email });
        case "phone_code":
          return t("signIn.mfa.phone");
        case "backup_code":
          return t("signIn.mfa.backup");
      }
    })();
    return t("signIn.mfa.hint", { lead, body });
  })();

  const hasBackupCode =
    step === "secondFactor" &&
    !isNewDevice &&
    (signIn.supportedSecondFactors ?? []).some((f) => f.strategy === "backup_code");

  const renderCard = () => {
    switch (step) {
      case "verifySignUp":
        return renderCodeCard({
          title: t("signIn.checkEmail"),
          hint: t("signIn.checkEmailHint", { email }),
          submitLabel: t("signIn.verifyEmail"),
          onSubmit: handleVerifySignUp,
          backLabel: t("signIn.backToSignUp"),
          onBack: () => goToStep("form"),
          canResend: true,
        });
      case "secondFactor":
        return renderCodeCard({
          title: isNewDevice ? t("signIn.confirmItsYou") : t("signIn.twoStep"),
          hint: secondFactorHint,
          submitLabel: t("signIn.verify"),
          onSubmit: handleVerifySecondFactor,
          backLabel: t("signIn.backToSignIn"),
          onBack: backToForm,
          canResend: secondFactor === "email_code" || secondFactor === "phone_code",
          alphanumeric: secondFactor === "backup_code",
          extra: hasBackupCode
            ? renderLink(
                secondFactor === "backup_code" ? t("signIn.useAuthenticator") : t("signIn.useBackup"),
                () => {
                  setSecondFactor((f) => (f === "backup_code" ? "totp" : "backup_code"));
                  setCode("");
                  setError("");
                },
                colors.primary,
              )
            : null,
        });
      case "resetCode":
        return renderCodeCard({
          title: t("signIn.resetTitle"),
          hint: t("signIn.resetHint", { email }),
          submitLabel: t("common.continue"),
          onSubmit: handleVerifyResetCode,
          backLabel: t("signIn.backToSignIn"),
          onBack: backToForm,
          canResend: true,
        });
      case "resetRequest":
        return (
          <>
            <Text style={[styles.cardTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
              {t("signIn.forgotPassword")}
            </Text>
            <Text style={[styles.verifyHint, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              {t("signIn.forgotHint")}
            </Text>
            <TextInput
              style={inputStyle}
              placeholder={t("signIn.email")}
              placeholderTextColor={colors.mutedForeground}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              accessibilityLabel={t("signIn.email")}
              autoFocus
            />
            {errorBadge}
            {renderSubmit(t("signIn.sendResetCode"), handleSendResetCode, email.trim() === "")}
            {renderLink(t("signIn.backToSignIn"), backToForm)}
          </>
        );
      case "newPassword":
        return (
          <>
            <Text style={[styles.cardTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
              {t("signIn.newPasswordTitle")}
            </Text>
            <View style={styles.passwordWrap}>
              <TextInput
                style={[...inputStyle, styles.passwordInput]}
                placeholder={t("signIn.newPassword")}
                placeholderTextColor={colors.mutedForeground}
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                textContentType="newPassword"
                accessibilityLabel={t("signIn.newPassword")}
                autoFocus
              />
              <TouchableOpacity
                style={styles.eyeBtn}
                onPress={() => setShowPassword((v) => !v)}
                hitSlop={{ top: 13, bottom: 13, left: 13, right: 13 }}
                accessibilityRole="button"
                accessibilityLabel={showPassword ? t("signIn.hidePassword") : t("signIn.showPassword")}
              >
                <Feather name={showPassword ? "eye-off" : "eye"} size={18} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>
            {errorBadge}
            {renderSubmit(t("signIn.updatePassword"), handleSubmitNewPassword, newPassword.length < 8)}
            {renderLink(t("signIn.backToSignIn"), backToForm)}
          </>
        );
      case "form":
        return (
          <>
            <Text style={[styles.cardTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
              {mode === "signin" ? t("signIn.signInWithEmail") : t("signIn.createAccountTitle")}
            </Text>

            {mode === "signup" && (
              <View style={styles.nameRow}>
                <TextInput
                  style={[...inputStyle, styles.halfInput]}
                  placeholder={t("signIn.firstName")}
                  placeholderTextColor={colors.mutedForeground}
                  value={firstName}
                  onChangeText={setFirstName}
                  autoCapitalize="words"
                  accessibilityLabel={t("signIn.firstName")}
                />
                <TextInput
                  style={[...inputStyle, styles.halfInput]}
                  placeholder={t("signIn.lastName")}
                  placeholderTextColor={colors.mutedForeground}
                  value={lastName}
                  onChangeText={setLastName}
                  autoCapitalize="words"
                  accessibilityLabel={t("signIn.lastName")}
                />
              </View>
            )}

            <TextInput
              style={inputStyle}
              placeholder={t("signIn.email")}
              placeholderTextColor={colors.mutedForeground}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              accessibilityLabel={t("signIn.email")}
            />

            <View style={styles.passwordWrap}>
              <TextInput
                style={[...inputStyle, styles.passwordInput]}
                placeholder={t("signIn.password")}
                placeholderTextColor={colors.mutedForeground}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                accessibilityLabel={t("signIn.password")}
              />
              <TouchableOpacity
                style={styles.eyeBtn}
                onPress={() => setShowPassword((v) => !v)}
                hitSlop={{ top: 13, bottom: 13, left: 13, right: 13 }}
                accessibilityRole="button"
                accessibilityLabel={showPassword ? t("signIn.hidePassword") : t("signIn.showPassword")}
              >
                <Feather
                  name={showPassword ? "eye-off" : "eye"}
                  size={18}
                  color={colors.mutedForeground}
                />
              </TouchableOpacity>
            </View>

            {errorBadge}
            {infoBadge}

            {renderSubmit(mode === "signin" ? t("signIn.signIn") : t("signIn.createAccount"), handleAuth)}

            {mode === "signin" &&
              renderLink(t("signIn.forgotPassword"), () => {
                setInfo("");
                goToStep("resetRequest");
              })}
          </>
        );
    }
  };

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
          {t("signIn.tagline")}
        </Text>

        {/* SSO Buttons — only on the main form */}
        {onForm && (
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
              accessibilityRole="button"
              accessibilityLabel={t("signIn.google")}
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
                {t("signIn.google")}
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
              accessibilityRole="button"
              accessibilityLabel={t("signIn.apple")}
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
                {t("signIn.apple")}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Divider — only on the main form */}
        {onForm && (
          <View style={[styles.dividerRow, { width: "100%", maxWidth: 400 }]}>
            <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
            <Text
              style={[
                styles.dividerText,
                { color: colors.mutedForeground, fontFamily: "Inter_400Regular" },
              ]}
            >
              {t("signIn.or")}
            </Text>
            <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
          </View>
        )}

        {/* Card — sign-in/up form, or one of the verification / reset steps */}
        <View
          style={[
            styles.card,
            { backgroundColor: colors.card, borderColor: colors.border, width: "100%", maxWidth: 400 },
          ]}
        >
          {renderCard()}
        </View>

        {/* Toggle sign-in / sign-up — only on the main form */}
        {onForm && (
          <View style={styles.toggleRow}>
            <Text
              style={[
                styles.toggleText,
                { color: colors.mutedForeground, fontFamily: "Inter_400Regular" },
              ]}
            >
              {mode === "signin" ? t("signIn.noAccount") : t("signIn.haveAccount")}
            </Text>
            <TouchableOpacity
              onPress={() => {
                setMode((m) => (m === "signin" ? "signup" : "signin"));
                setError("");
                setInfo("");
              }}
              hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
              accessibilityRole="button"
            >
              <Text
                style={[
                  styles.toggleLink,
                  { color: colors.primary, fontFamily: "Inter_600SemiBold" },
                ]}
              >
                {mode === "signin" ? t("signIn.signUp") : t("signIn.signIn")}
              </Text>
            </TouchableOpacity>
          </View>
        )}
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
  verifyHint: { fontSize: 14, lineHeight: 20 },
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
