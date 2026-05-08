import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { fetchHealth } from './src/api/client';

const queryClient = new QueryClient();

function HealthScreen() {
  const { data, isLoading, error, isRefetching } = useQuery({
    queryKey: ['health'],
    queryFn: fetchHealth,
    refetchInterval: 5000,
  });

  if (isLoading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#7a86b3" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>backend unreachable</Text>
        <Text style={styles.error}>{String(error)}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>APHNO</Text>
      <Text style={styles.subtitle}>week 0 — pipes are alive</Text>
      <View style={styles.card}>
        <Row label="status" value={data?.status ?? '-'} />
        <Row label="db connected" value={String(data?.dbConnected)} />
        <Row label="user count" value={String(data?.userCount)} />
        <Row label="uptime" value={`${data?.uptime.toFixed(1)}s`} />
      </View>
      <Text style={styles.hint}>{isRefetching ? 'refreshing…' : 'auto-refresh every 5s'}</Text>
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <HealthScreen />
      <StatusBar style="light" />
    </QueryClientProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0b1020',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  title: { color: '#fff', fontSize: 32, fontWeight: '700', letterSpacing: 2 },
  subtitle: { color: '#7a86b3', fontSize: 14, marginTop: 4, marginBottom: 32 },
  card: {
    width: '100%',
    backgroundColor: '#141a33',
    borderRadius: 12,
    padding: 20,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomColor: '#222a4d',
    borderBottomWidth: 1,
  },
  label: { color: '#7a86b3', fontSize: 13 },
  value: { color: '#fff', fontSize: 14, fontWeight: '600' },
  hint: { color: '#4a5680', fontSize: 12, marginTop: 16 },
  error: { color: '#ff6b81', textAlign: 'center', marginTop: 12 },
});
