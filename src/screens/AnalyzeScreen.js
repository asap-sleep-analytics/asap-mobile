import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import ResultCard from '../components/ResultCard';
import { useAnalyzeAudio } from '../hooks/useAnalyzeAudio';

function toNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export default function AnalyzeScreen() {
  const [fileName, setFileName] = useState('subject_001.wav');
  const [durationSeconds, setDurationSeconds] = useState('35.5');
  const [sampleRate, setSampleRate] = useState('22050');
  const [channels, setChannels] = useState('1');

  const { analyze, result, loading, error } = useAnalyzeAudio();

  const handleAnalyze = async () => {
    await analyze({
      file_name: fileName,
      duration_seconds: toNumber(durationSeconds, 0),
      sample_rate_hz: toNumber(sampleRate, 0),
      channels: toNumber(channels, 1),
      codec: 'pcm_s16le',
      patient_id: 'PT-001',
      extra: {
        source: 'expo-mobile',
      },
    });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>File Name</Text>
      <TextInput value={fileName} onChangeText={setFileName} style={styles.input} />

      <Text style={styles.label}>Duration Seconds</Text>
      <TextInput
        value={durationSeconds}
        onChangeText={setDurationSeconds}
        style={styles.input}
        keyboardType="decimal-pad"
      />

      <Text style={styles.label}>Sample Rate (Hz)</Text>
      <TextInput
        value={sampleRate}
        onChangeText={setSampleRate}
        style={styles.input}
        keyboardType="number-pad"
      />

      <Text style={styles.label}>Channels</Text>
      <TextInput
        value={channels}
        onChangeText={setChannels}
        style={styles.input}
        keyboardType="number-pad"
      />

      <Pressable style={styles.button} onPress={handleAnalyze} disabled={loading}>
        <Text style={styles.buttonText}>{loading ? 'Analyzing...' : 'Analyze Metadata'}</Text>
      </Pressable>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      {result ? <ResultCard result={result} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F4F7FB',
    padding: 20,
  },
  label: {
    marginTop: 12,
    marginBottom: 6,
    fontSize: 14,
    color: '#334155',
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
  },
  button: {
    marginTop: 20,
    backgroundColor: '#0B2545',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  errorText: {
    marginTop: 12,
    color: '#B91C1C',
  },
});
