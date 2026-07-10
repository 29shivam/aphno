import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import { api, ApiError } from '../api/client';
import { useAuth } from '../state/auth';
import { Button, ErrorText, Input } from '../ui';
import { colors } from '../theme';

WebBrowser.maybeCompleteAuthSession();

export function LoginScreen() {
  const { signIn } = useAuth();
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [phone, setPhone] = useState('+91');
  const [code, setCode] = useState('');
  const [devCode, setDevCode] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);

  // Entrance animation so it doesn't feel like a static page.
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1,
      duration: 550,
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  }, [anim]);

  // Google OAuth
  const [request, response, promptAsync] = Google.useAuthRequest({
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID,
  });

  useEffect(() => {
    if (!response) return;
    if (response.type === 'success') {
      const idToken =
        response.authentication?.idToken ??
        (response.params as Record<string, string> | undefined)?.id_token;
      if (idToken) void finishGoogle(idToken);
      else {
        setGoogleBusy(false);
        setError('Google did not return an ID token');
      }
    } else if (response.type === 'error' || response.type === 'dismiss') {
      setGoogleBusy(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [response]);

  async function finishGoogle(idToken: string) {
    setError('');
    try {
      const res = await api.googleAuth(idToken);
      signIn(res.token, res.user);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Google sign-in failed');
    } finally {
      setGoogleBusy(false);
    }
  }

  async function onGoogle() {
    if (!request) {
      setError('Google sign-in is not configured yet');
      return;
    }
    setError('');
    setGoogleBusy(true);
    await promptAsync();
  }

  async function sendOtp() {
    setBusy(true);
    setError('');
    try {
      const res = await api.requestOtp(phone.trim());
      setDevCode(res.devCode ?? null);
      if (res.devCode) setCode(res.devCode);
      setStep('code');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not send code');
    } finally {
      setBusy(false);
    }
  }

  async function verify() {
    setBusy(true);
    setError('');
    try {
      const res = await api.verifyOtp(phone.trim(), code.trim());
      signIn(res.token, res.user);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Verification failed');
    } finally {
      setBusy(false);
    }
  }

  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [24, 0] });

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      {/* soft brand glow */}
      <View style={styles.glow} pointerEvents="none" />

      <Animated.View style={[styles.card, { opacity: anim, transform: [{ translateY }] }]}>
        <View style={styles.logoWrap}>
          <Image source={require('../../assets/logo.png')} style={styles.logo} resizeMode="cover" />
        </View>
        <Text style={styles.brand}>aphno.ai</Text>
        <Text style={styles.tagline}>Split bills. Settle over UPI.</Text>

        {/* Google — primary */}
        <Pressable
          onPress={onGoogle}
          disabled={googleBusy}
          style={({ pressed }) => [styles.googleBtn, { opacity: pressed || googleBusy ? 0.85 : 1 }]}
        >
          {googleBusy ? (
            <ActivityIndicator color="#1f1f1f" />
          ) : (
            <>
              <GoogleG />
              <Text style={styles.googleText}>Continue with Google</Text>
            </>
          )}
        </Pressable>

        <View style={styles.divider}>
          <View style={styles.line} />
          <Text style={styles.dividerText}>or with phone</Text>
          <View style={styles.line} />
        </View>

        {step === 'phone' ? (
          <>
            <Input
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              placeholder="+91 98765 43210"
            />
            <View style={{ height: 12 }} />
            <Button label="Send code" onPress={sendOtp} loading={busy} />
          </>
        ) : (
          <>
            <Input
              value={code}
              onChangeText={setCode}
              keyboardType="number-pad"
              maxLength={6}
              autoFocus
              placeholder="6-digit code"
            />
            {devCode ? <Text style={styles.dev}>dev code: {devCode}</Text> : null}
            <View style={{ height: 12 }} />
            <Button label="Verify & continue" onPress={verify} loading={busy} />
            <View style={{ height: 8 }} />
            <Button
              label="← Use a different number"
              variant="ghost"
              onPress={() => {
                setStep('phone');
                setError('');
              }}
            />
          </>
        )}

        <ErrorText>{error}</ErrorText>
      </Animated.View>

      <Text style={styles.footer}>UPI-native · secure by design</Text>
    </KeyboardAvoidingView>
  );
}

function GoogleG() {
  // Simple multi-color "G" mark drawn with text (no extra deps).
  return (
    <View style={styles.gWrap}>
      <Text style={styles.gText}>G</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, justifyContent: 'center', padding: 20 },
  glow: {
    position: 'absolute',
    top: '12%',
    alignSelf: 'center',
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: colors.accent,
    opacity: 0.12,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
    backgroundColor: colors.card,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 26,
    alignItems: 'stretch',
  },
  logoWrap: { alignItems: 'center', marginBottom: 14 },
  logo: { width: 84, height: 84, borderRadius: 20 },
  brand: {
    color: colors.text,
    fontSize: 30,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  tagline: {
    color: colors.muted,
    fontSize: 14,
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 24,
  },
  googleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    paddingVertical: 14,
    minHeight: 50,
  },
  googleText: { color: '#1f1f1f', fontSize: 15, fontWeight: '700' },
  gWrap: { width: 20, height: 20, alignItems: 'center', justifyContent: 'center' },
  gText: { color: '#4285F4', fontSize: 18, fontWeight: '800' },
  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: 18 },
  line: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
  dividerText: { color: colors.faint, fontSize: 12, marginHorizontal: 12 },
  dev: { color: colors.faint, fontSize: 12, marginTop: 8, marginLeft: 4 },
  footer: {
    color: colors.faint,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 24,
  },
});
