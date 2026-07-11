import { useState } from 'react';
import { ActivityIndicator, Image, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './src/state/auth';
import { useRealtime } from './src/state/realtime';
import { LoginScreen } from './src/screens/LoginScreen';
import { GroupsScreen } from './src/screens/GroupsScreen';
import { GroupDetailScreen } from './src/screens/GroupDetailScreen';
import { NotificationsScreen } from './src/screens/NotificationsScreen';
import { ProfileScreen } from './src/screens/ProfileScreen';
import { colors } from './src/theme';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
});

function Root() {
  const { user, loading } = useAuth();
  const [openGroupId, setOpenGroupId] = useState<string | null>(null);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfile, setShowProfile] = useState(false);

  // Keep the real-time channel open whenever signed in.
  useRealtime(Boolean(user));

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

  if (showProfile) {
    return <ProfileScreen onBack={() => setShowProfile(false)} />;
  }

  if (showNotifications) {
    return <NotificationsScreen onBack={() => setShowNotifications(false)} />;
  }

  if (openGroupId) {
    return <GroupDetailScreen groupId={openGroupId} onBack={() => setOpenGroupId(null)} />;
  }

  return (
    <GroupsScreen
      onOpen={setOpenGroupId}
      onOpenNotifications={() => setShowNotifications(true)}
      onOpenProfile={() => setShowProfile(true)}
    />
  );
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
