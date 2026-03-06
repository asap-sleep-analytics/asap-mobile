import { useState } from 'react';

import { analyzeAudioMetadata } from '../services/api';

export function useAnalyzeAudio() {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const analyze = async (payload) => {
    setLoading(true);
    setError('');

    try {
      const data = await analyzeAudioMetadata(payload);
      setResult(data);
      return data;
    } catch (err) {
      setError('Unable to connect to analysis service.');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return {
    analyze,
    result,
    loading,
    error,
  };
}
