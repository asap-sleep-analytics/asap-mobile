import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

export default function ResultCard({ result }) {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>Analysis Result</Text>
      <Text style={styles.text}>Status: {result.status}</Text>
      <Text style={styles.text}>Quality Score: {result.quality_score}</Text>
      <Text style={styles.subtitle}>Insights:</Text>
      {result.insights?.map((insight, index) => (
        <Text key={`${insight}-${index}`} style={styles.bullet}>
          - {insight}
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0B2545',
  },
  subtitle: {
    marginTop: 10,
    fontWeight: '700',
    color: '#1E293B',
  },
  text: {
    marginTop: 8,
    color: '#334155',
  },
  bullet: {
    marginTop: 6,
    color: '#334155',
  },
});
