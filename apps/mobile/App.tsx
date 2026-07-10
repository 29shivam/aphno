import { useState } from 'react';
import { ActivityIndicator, Image, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './src/state/auth';
import { LoginScreen } from './src/screens/LoginScreen';
import { GroupsScreen } from './src/screens/GroupsScreen';
import { GroupDetailScreen } from './src/screens/GroupDetailScreen';
import { colors } from './src/theme';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
});

function Root() {
  const { user, loading } = useAuth();
  const [openGroupId, setOpenGroupId] = useState<string | null>(null);

  if (loading) {
    return (
      <View style={styles.center}>
        <Image source={require('./assets/logo.png')} style={styles.splashLogo} resizeMode="cover" />
        <Text style={styles.splashBrand}>aphno.ai</Text>
        <ActivityIndicator size="small" color={colors.accent} style={{ marginTop: 20 }} />
      </View>
    );
  }

  if (!user) return <LoginScreen />;

  if (openGroupId) {
    return <GroupDetailScreen groupId={openGroupId} onBack={() => setOpenGroupId(null)} />;
  }

  return <GroupsScreen onOpen={setOpenGroupId} />;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <SafeAreaView style={styles.safe}>
          <Root />
        </SafeAreaView>
        <StatusBar style="light" />
      </AuthProvider>
    </QueryClientProvider>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  splashLogo: { width: 96, height: 96, borderRadius: 24 },
  splashBrand: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '800',
    marginTop: 16,
    letterSpacing: 0.3,
  },
});
