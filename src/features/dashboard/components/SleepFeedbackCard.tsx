// @ts-nocheck
import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import GlassCard from '../../../components/GlassCard';
import { getApiErrorMessage, submitSleepFeedback } from '../../../services/api';
import { fonts, palette } from '../../../theme/tokens';

const ratingScale = [1, 2, 3, 4, 5];

export default function SleepFeedbackCard({ sessionId, onSaved }) {
  const [rating, setRating] = useState(0);
  const [wokeTired, setWokeTired] = useState(null);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const disabled = useMemo(() => !sessionId || rating === 0 || submitting, [sessionId, rating, submitting]);

  const handleSubmit = async () => {
    if (!sessionId || rating === 0) {
      return;
    }

    setSubmitting(true);
    setMessage('');
    setError('');

    try {
      await submitSleepFeedback(sessionId, {
        calificacion_descanso: rating,
        desperto_cansado: wokeTired,
        comentario: comment.trim() || null,
      });
      setMessage('Feedback guardado. Gracias por entrenar el modelo con tu experiencia real.');
      onSaved?.();
    } catch (err) {
      setError(getApiErrorMessage(err, 'No fue posible guardar tu feedback.'));
    } finally {
      setSubmitting(false);
    }
  };

  if (!sessionId) {
    return (
      <GlassCard>
        <Text style={styles.title}>Feedback humano</Text>
        <Text style={styles.muted}>Finaliza una sesión para registrar cómo te sentiste al despertar.</Text>
      </GlassCard>
    );
  }

  return (
    <GlassCard style={styles.card}>
      <Text style={styles.eyebrow}>Tu percepción</Text>
      <Text style={styles.title}>¿Cómo te sentiste al despertar?</Text>
      <Text style={styles.muted}>Tu respuesta nos ayuda a personalizar mejor tus recomendaciones.</Text>

      <View style={styles.ratingRow}>
        {ratingScale.map((value) => {
          const active = rating === value;
          return (
            <Pressable
              key={value}
              onPress={() => setRating(value)}
              style={[styles.ratingChip, active ? styles.ratingChipActive : null]}
            >
              <Text style={[styles.ratingChipText, active ? styles.ratingChipTextActive : null]}>{value}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.toggleRow}>
        <Pressable
          onPress={() => setWokeTired(false)}
          style={[styles.toggleButton, wokeTired === false ? styles.toggleButtonActiveMint : null]}
        >
          <Text style={styles.toggleButtonText}>Desperté bien</Text>
        </Pressable>
        <Pressable
          onPress={() => setWokeTired(true)}
          style={[styles.toggleButton, wokeTired === true ? styles.toggleButtonActiveDanger : null]}
        >
          <Text style={styles.toggleButtonText}>Desperté cansado</Text>
        </Pressable>
      </View>

      <TextInput
        value={comment}
        onChangeText={setComment}
        style={styles.input}
        placeholder="Comentario opcional (máx. 500)"
        placeholderTextColor={palette.textMuted}
        multiline
        maxLength={500}
      />

      <Pressable
        onPress={handleSubmit}
        disabled={disabled}
        style={({ pressed }) => [styles.submitButton, disabled ? styles.submitButtonDisabled : null, pressed ? styles.pressed : null]}
      >
        {submitting ? <ActivityIndicator color="#03110C" /> : <Text style={styles.submitText}>Guardar feedback</Text>}
      </Pressable>

      {message ? <Text style={styles.successText}>{message}</Text> : null}
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  card: {
    borderColor: 'rgba(110,247,207,0.28)',
    backgroundColor: 'rgba(14,27,23,0.8)',
  },
  eyebrow: {
    color: palette.mint,
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  title: {
    marginTop: 8,
    color: palette.textPrimary,
    fontFamily: fonts.headingMedium,
    fontSize: 22,
  },
  muted: {
    marginTop: 6,
    color: palette.textSecondary,
    fontFamily: fonts.bodyRegular,
    lineHeight: 19,
  },
  ratingRow: {
    marginTop: 12,
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  ratingChip: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ratingChipActive: {
    borderColor: 'rgba(110,247,207,0.7)',
    backgroundColor: 'rgba(110,247,207,0.16)',
  },
  ratingChipText: {
    color: palette.textPrimary,
    fontFamily: fonts.bodyBold,
    fontSize: 16,
  },
  ratingChipTextActive: {
    color: palette.mint,
  },
  toggleRow: {
    marginTop: 12,
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  toggleButton: {
    flex: 1,
    minWidth: 150,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    alignItems: 'center',
  },
  toggleButtonActiveMint: {
    borderColor: 'rgba(110,247,207,0.65)',
    backgroundColor: 'rgba(110,247,207,0.12)',
  },
  toggleButtonActiveDanger: {
    borderColor: 'rgba(255,141,141,0.65)',
    backgroundColor: 'rgba(255,141,141,0.12)',
  },
  toggleButtonText: {
    color: palette.textPrimary,
    fontFamily: fonts.body,
    fontSize: 13,
  },
  input: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.03)',
    color: palette.textPrimary,
    fontFamily: fonts.bodyRegular,
    minHeight: 84,
    paddingHorizontal: 12,
    paddingVertical: 10,
    textAlignVertical: 'top',
  },
  submitButton: {
    marginTop: 12,
    borderRadius: 12,
    backgroundColor: palette.mint,
    alignItems: 'center',
    paddingVertical: 12,
  },
  submitButtonDisabled: {
    opacity: 0.55,
  },
  submitText: {
    color: '#03110C',
    fontFamily: fonts.bodyBold,
  },
  pressed: {
    opacity: 0.85,
  },
  successText: {
    marginTop: 10,
    color: palette.mint,
    fontFamily: fonts.bodyRegular,
    lineHeight: 18,
  },
  errorText: {
    marginTop: 10,
    color: palette.danger,
    fontFamily: fonts.body,
  },
});
