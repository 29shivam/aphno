import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';
import { api, ApiError } from '../api/client';
import { useAuth } from '../state/auth';
import { Button, ErrorText, Input } from '../ui';
import { colors } from '../theme';

export function LoginScreen() {
  const { signIn } = useAuth();
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [phone, setPhone] = useState('+91');
  const [code, setCode] = useState('');
  const [devCode, setDevCode] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function sendOtp() {
    setBusy(true);
    setError('');
    try {
      const res = await api.requestOtp(phone.trim());
      setDevCode(res.devCode ?? null);
      if (res.devCode) setCode(res.devCode); // dev convenience
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

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      <View style={styles.hero}>
        <Text style={styles.logo}>aphno.ai</Text>
        <Text style={styles.tagline}>Split bills. Settle over UPI.</Text>
      </View>

      {step === 'phone' ? (
        <View style={styles.form}>
          <Text style={styles.label}>Phone number</Text>
          <Input
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            autoFocus
            placeholder="+91 98765 43210"
          />
          <ErrorText>{error}</ErrorText>
          <View style={{ height: 12 }} />
          <Button label="Send code" onPress={sendOtp} loading={busy} />
        </View>
      ) : (
        <View style={styles.form}>
          <Text style={styles.label}>Enter the 6-digit code</Text>
          <Input
            value={code}
            onChangeText={setCode}
            keyboardType="number-pad"
            maxLength={6}
            autoFocus
            placeholder="••••••"
          />
          {devCode ? <Text style={styles.dev}>dev code: {devCode}</Text> : null}
          <ErrorText>{error}</ErrorText>
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
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, justifyContent: 'center', padding: 24 },
  hero: { alignItems: 'center', marginBottom: 40 },
  logo: { color: colors.text, fontSize: 40, fontWeight: '800', letterSpacing: 0.5 },
  tagline: { color: colors.muted, fontSize: 15, marginTop: 8 },
  form: { width: '100%', maxWidth: 420, alignSelf: 'center' },
  label: { color: colors.muted, fontSize: 13, marginBottom: 8, marginLeft: 4 },
  dev: { color: colors.faint, fontSize: 12, marginTop: 8, marginLeft: 4 },
});
