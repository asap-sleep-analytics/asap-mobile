// @ts-nocheck
import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useMemo, useState } from 'react';
import {
  Dimensions,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import AmbientBackdrop from '../../../components/AmbientBackdrop';
import GlassCard from '../../../components/GlassCard';
import { getApiErrorMessage } from '../../../services/api';
import { listSleepDiaryEntries, saveSleepDiaryEntry } from '../../../services/localHealth';
import { fonts, palette } from '../../../theme/tokens';

const { width } = Dimensions.get('window');

// ============================================================================
// UTILITIES
// ============================================================================

function estimateHours(start, end) {
  const [sh, sm] = String(start).split(':').map(Number);
  const [eh, em] = String(end).split(':').map(Number);
  if (![sh, sm, eh, em].every(Number.isFinite)) {
    return null;
  }

  const startMin = sh * 60 + sm;
  let endMin = eh * 60 + em;
  if (endMin <= startMin) {
    endMin += 24 * 60;
  }

  return Math.round(((endMin - startMin) / 60) * 10) / 10;
}

function format12h(timeValue) {
  const [hourText, minuteText] = String(timeValue).split(':');
  const hourNumber = Number(hourText);
  const minuteNumber = Number(minuteText);

  if (!Number.isFinite(hourNumber) || !Number.isFinite(minuteNumber)) {
    return '--';
  }

  const suffix = hourNumber >= 12 ? 'p.m.' : 'a.m.';
  const normalizedHour = hourNumber % 12 || 12;
  return `${normalizedHour}:${String(minuteNumber).padStart(2, '0')} ${suffix}`;
}

function isoDate(date) {
  return date.toISOString().slice(0, 10);
}

function formatDateLabel(dateStr) {
  const date = new Date(dateStr + 'T00:00:00Z');
  const today = new Date();
  const todayStr = isoDate(today);

  if (dateStr === todayStr) {
    return 'Hoy';
  }

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (dateStr === isoDate(yesterday)) {
    return 'Ayer';
  }

  return date.toLocaleDateString('es-CO', { month: 'short', day: 'numeric' });
}

function getLast7Days() {
  const days = [];
  const today = new Date();
  for (let i = 6; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    days.push(isoDate(date));
  }
  return days;
}

function analyzeSleepPattern(entries) {
  if (!entries || entries.length === 0) {
    return null;
  }

  const recentEntries = entries.slice(0, 7).filter((e) => e.start && e.end);
  if (recentEntries.length === 0) return null;

  const bedtimes = recentEntries.map((e) => {
    const [h, m] = String(e.start).split(':').map(Number);
    return h + m / 60;
  });

  const waketimes = recentEntries.map((e) => {
    const [h, m] = String(e.end).split(':').map(Number);
    return h + m / 60;
  });

  const avgBedtime = bedtimes.reduce((a, b) => a + b, 0) / bedtimes.length;
  const avgWaketime = waketimes.reduce((a, b) => a + b, 0) / waketimes.length;
  const avgSleep = recentEntries.reduce((sum, e) => sum + (e.total_hours || 0), 0) / recentEntries.length;

  // Si se acuesta muy tarde (después de las 12am) pero se levanta temprano (antes de las 8am)
  // y duerme poco (<7h), recomendar acostarse más temprano
  let recommendedHour = Math.round(avgBedtime % 24);
  let recommendedMin = Math.round((avgBedtime % 1) * 60);

  if (avgBedtime > 22 && avgWaketime < 8 && avgSleep < 7) {
    recommendedHour = Math.round((avgBedtime - 2) % 24);
    if (recommendedHour < 0) recommendedHour += 24;
    recommendedMin = Math.round((((avgBedtime - 2) % 1) || 0) * 60);
  }

  return {
    recommendedTime: `${String(recommendedHour).padStart(2, '0')}:${String(recommendedMin).padStart(
      2,
      '0',
    )}`,
    avgSleepHours: avgSleep.toFixed(1),
    consistency: recentEntries.length >= 5 ? 'Alta' : recentEntries.length >= 3 ? 'Media' : 'Baja',
  };
}

// ============================================================================
// TIME PICKER COMPONENT
// ============================================================================

function SimpleTimePicker({ value, onChange, mode = 'hour' }) {
  const values = mode === 'hour' ? Array.from({ length: 24 }, (_, i) => i) : Array.from({ length: 60 }, (_, i) => i);
  const itemSize = 50;
  const pickerHeight = 180;

  return (
    <View style={styles.timePickerContainer}>
      <FlatList
        data={values}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => onChange(item)}
            style={[
              styles.timePickerItem,
              item === value && styles.timePickerItemSelected,
            ]}
          >
            <Text
              style={[
                styles.timePickerItemText,
                item === value && styles.timePickerItemTextSelected,
              ]}
            >
              {String(item).padStart(2, '0')}
            </Text>
          </Pressable>
        )}
        keyExtractor={(item) => String(item)}
        scrollEnabled={true}
        snapToInterval={itemSize}
        decelerationRate="fast"
        showsVerticalScrollIndicator={false}
        style={{ height: pickerHeight }}
        contentContainerStyle={{ paddingVertical: (pickerHeight - itemSize) / 2 }}
      />
    </View>
  );
}

// ============================================================================
// SLEEP HISTORY BAR COMPONENT
// ============================================================================

function SleepHistoryBar({ entry, isSelected, onPress }) {
  const hours = entry.total_hours || 0;
  const barHeight = Math.max(Math.min(hours * 20, 140), 30);
  const barColor = hours >= 7 ? palette.mint : hours >= 5 ? '#FF9F43' : '#FF6B6B';

  return (
    <Pressable
      onPress={onPress}
      style={[styles.verticalBarContainer, isSelected && styles.verticalBarSelected]}
    >
      <View style={[styles.verticalBarChart, isSelected && styles.verticalBarChartSelected]}>
        <View
          style={[
            styles.verticalBarFill,
            {
              height: `${(barHeight / 140) * 100}%`,
              backgroundColor: barColor,
            },
          ]}
        />
      </View>
      <Text style={styles.verticalBarHours}>{hours}h</Text>
      <Text style={styles.verticalBarDate}>{formatDateLabel(entry.date)}</Text>
    </Pressable>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function SleepDiaryScreen({ navigation }) {
  const [diaryEntries, setDiaryEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedTab, setSelectedTab] = useState('sleep');
  const [selectedDate, setSelectedDate] = useState(null);
  const [tempStart, setTempStart] = useState('23:00');
  const [tempEnd, setTempEnd] = useState('07:00');

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const rows = await listSleepDiaryEntries();
      setDiaryEntries(Array.isArray(rows) ? rows : []);
    } catch (err) {
      setError(getApiErrorMessage(err, 'No fue posible cargar tu registro de sueño.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  const sleepRecommendation = useMemo(() => analyzeSleepPattern(diaryEntries), [diaryEntries]);

  const handleSave = async () => {
    const totalHours = estimateHours(tempStart, tempEnd);
    if (totalHours === null) {
      setError('No se pudo calcular la duración. Verifica los horarios.');
      return;
    }

    try {
      const dateToSave = selectedDate || isoDate(new Date());
      const nextEntry = {
        id: `${Date.now()}`,
        date: dateToSave,
        start: tempStart,
        end: tempEnd,
        total_hours: totalHours,
        created_at: new Date().toISOString(),
      };

      const updated = await saveSleepDiaryEntry(nextEntry);
      setDiaryEntries(Array.isArray(updated) ? updated : []);
      setShowAddModal(false);
      setSelectedDate(null);
      setTempStart('23:00');
      setTempEnd('07:00');
    } catch {
      setError('No fue posible guardar el registro.');
    }
  };

  const handleTimeChange = (value, type, timeType) => {
    const [h, m] = (timeType === 'start' ? tempStart : tempEnd).split(':').map(Number);
    const newH = type === 'hour' ? value : h;
    const newM = type === 'minute' ? value : m;
    const newTime = `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}`;

    if (timeType === 'start') {
      setTempStart(newTime);
    } else {
      setTempEnd(newTime);
    }
  };

  const parseTime = (timeStr) => {
    const [h, m] = timeStr.split(':').map(Number);
    return { h, m };
  };

  const currentStart = parseTime(tempStart);
  const currentEnd = parseTime(tempEnd);
  const estimatedHours = estimateHours(tempStart, tempEnd);

  return (
    <AmbientBackdrop>
      <ScrollView contentContainerStyle={styles.container}>
        {/* Header */}
        <Text style={styles.badge}>Registro de sueño</Text>
        <Text style={styles.title}>Tu historial</Text>

        {diaryEntries.length > 0 && (
          <>
            {/* Sleep History */}
            <GlassCard style={styles.historyCard}>
              <Text style={styles.sectionTitle}>Últimos 7 días</Text>
              <FlatList
                data={getLast7Days().map((date) => {
                  const entry = diaryEntries.find((e) => e.date === date);
                  return entry || { date, id: date, total_hours: 0 };
                })}
                renderItem={({ item }) => (
                  <SleepHistoryBar
                    entry={item}
                    isSelected={selectedDate === item.date}
                    onPress={() => {
                      setSelectedDate(item.date);
                      setShowAddModal(true);
                    }}
                  />
                )}
                keyExtractor={(item) => item.date}
                horizontal
                scrollEnabled
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.historyListHorizontal}
              />
            </GlassCard>

            {/* Today's Sleep Record */}
            {(() => {
              const todayEntry = diaryEntries.find((e) => e.date === isoDate(new Date()));
              return todayEntry ? (
                <GlassCard style={styles.todayCard}>
                  <Text style={styles.sectionTitle}>Registro de hoy</Text>
                  <View style={styles.todayRecordContent}>
                    <View style={styles.todayRecordItem}>
                      <Text style={styles.todayRecordLabel}>ÇCuantas horas dormiste?</Text>
                      <Text style={styles.todayRecordValue}>{todayEntry.total_hours}h</Text>
                    </View>
                    <View style={styles.todayRecordDivider} />
                    <View style={styles.todayRecordItem}>
                      <Text style={styles.todayRecordLabel}>Horario</Text>
                      <Text style={styles.todayRecordTime}>
                        {format12h(todayEntry.start)} – {format12h(todayEntry.end)}
                      </Text>
                    </View>
                  </View>
                </GlassCard>
              ) : null;
            })()}

            {/* Sleep Analysis & Recommendation */}
            {sleepRecommendation && !showAddModal && (
              <GlassCard style={styles.recommendationCard}>
                <Text style={styles.sectionTitle}>Recomendación de sueño</Text>

                <View style={styles.recommendationGrid}>
                  <View style={styles.recommendationItem}>
                    <Text style={styles.recommendationLabel}>Hora recomendada</Text>
                    <Text style={styles.recommendationValue}>
                      {format12h(sleepRecommendation.recommendedTime)}
                    </Text>
                  </View>

                  <View style={styles.recommendationItem}>
                    <Text style={styles.recommendationLabel}>Promedio de sueño</Text>
                    <Text style={styles.recommendationValue}>
                      {sleepRecommendation.avgSleepHours}h
                    </Text>
                  </View>

                  <View style={styles.recommendationItem}>
                    <Text style={styles.recommendationLabel}>Consistencia</Text>
                    <Text style={styles.recommendationValue}>{sleepRecommendation.consistency}</Text>
                  </View>
                </View>

                <Text style={styles.recommendationText}>
                  🌙 Basándonos en tu patrón de sueño, te recomendamos acostarte a las{' '}
                  <Text style={{ color: palette.mint, fontFamily: fonts.bodyBold }}>
                    {format12h(sleepRecommendation.recommendedTime)}
                  </Text>{' '}
                  para un descanso óptimo.
                </Text>
              </GlassCard>
            )}
          </>
        )}

        {diaryEntries.length === 0 && !loading && (
          <GlassCard style={styles.emptyCard}>
            <Text style={styles.emptyText}>No hay registros de sueño aún.</Text>
            <Text style={styles.emptySubtext}>Añade tu primer registro para ver análisis y recomendaciones.</Text>
          </GlassCard>
        )}

        {error && <Text style={styles.errorText}>{error}</Text>}

        {/* Add Button */}
        <Pressable
          onPress={() => {
            setSelectedDate(null);
            setShowAddModal(true);
          }}
          style={({ pressed }) => [styles.addButton, pressed && styles.pressed]}
        >
          <Text style={styles.addButtonText}>+ Añadir horas de sueño</Text>
        </Pressable>
      </ScrollView>

      {/* Modal para añadir sueño */}
      <Modal visible={showAddModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Pressable onPress={() => setShowAddModal(false)}>
                <Text style={styles.modalCloseButton}>✕</Text>
              </Pressable>
              <Text style={styles.modalTitle}>
                {selectedDate ? `Registrar: ${formatDateLabel(selectedDate)}` : 'Registrar sueño'}
              </Text>
              <View style={{ width: 30 }} />
            </View>

            {/* Tabs */}
            <View style={styles.tabsContainer}>
              <Pressable
                onPress={() => setSelectedTab('sleep')}
                style={[styles.tab, selectedTab === 'sleep' && styles.tabActive]}
              >
                <Text style={[styles.tabText, selectedTab === 'sleep' && styles.tabTextActive]}>
                  A dormir
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setSelectedTab('wake')}
                style={[styles.tab, selectedTab === 'wake' && styles.tabActive]}
              >
                <Text style={[styles.tabText, selectedTab === 'wake' && styles.tabTextActive]}>
                  A levantarse
                </Text>
              </Pressable>
            </View>

            {/* Time Selection */}
            <View style={styles.timeSelectionContainer}>
              {selectedTab === 'sleep' ? (
                <>
                  <Text style={styles.timeLabel}>Hora a dormir</Text>
                  <Text style={styles.timeLargeDisplay}>{tempStart}</Text>

                  <View style={styles.timePickersRow}>
                    <View style={styles.timePickerSection}>
                      <Text style={styles.timeSubLabel}>Hora</Text>
                      <SimpleTimePicker
                        value={currentStart.h}
                        onChange={(h) => handleTimeChange(h, 'hour', 'start')}
                        mode="hour"
                      />
                    </View>
                    <Text style={styles.timeSeparator}>:</Text>
                    <View style={styles.timePickerSection}>
                      <Text style={styles.timeSubLabel}>Min</Text>
                      <SimpleTimePicker
                        value={currentStart.m}
                        onChange={(m) => handleTimeChange(m, 'minute', 'start')}
                        mode="minute"
                      />
                    </View>
                  </View>
                </>
              ) : (
                <>
                  <Text style={styles.timeLabel}>Hora a levantarse</Text>
                  <Text style={styles.timeLargeDisplay}>{tempEnd}</Text>

                  <View style={styles.timePickersRow}>
                    <View style={styles.timePickerSection}>
                      <Text style={styles.timeSubLabel}>Hora</Text>
                      <SimpleTimePicker
                        value={currentEnd.h}
                        onChange={(h) => handleTimeChange(h, 'hour', 'end')}
                        mode="hour"
                      />
                    </View>
                    <Text style={styles.timeSeparator}>:</Text>
                    <View style={styles.timePickerSection}>
                      <Text style={styles.timeSubLabel}>Min</Text>
                      <SimpleTimePicker
                        value={currentEnd.m}
                        onChange={(m) => handleTimeChange(m, 'minute', 'end')}
                        mode="minute"
                      />
                    </View>
                  </View>
                </>
              )}
            </View>

            {/* Summary */}
            <GlassCard style={styles.summaryBox}>
              <Text style={styles.summaryLabel}>Duración estimada</Text>
              <Text style={styles.summaryValue}>{estimatedHours ?? '--'} horas</Text>
            </GlassCard>

            {/* Actions */}
            <View style={styles.modalActions}>
              <Pressable
                onPress={() => setShowAddModal(false)}
                style={({ pressed }) => [styles.cancelButton, pressed && styles.pressed]}
              >
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </Pressable>
              <Pressable
                onPress={handleSave}
                style={({ pressed }) => [styles.saveButton, pressed && styles.pressed]}
              >
                <Text style={styles.saveButtonText}>Guardar</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </AmbientBackdrop>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    paddingBottom: 40,
    gap: 20,
  },
  badge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(110,247,207,0.36)',
    backgroundColor: 'rgba(110,247,207,0.1)',
    color: palette.mint,
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginBottom: 8,
  },
  title: {
    color: palette.textPrimary,
    fontFamily: fonts.heading,
    fontSize: 32,
    lineHeight: 36,
    marginBottom: 20,
  },
  sectionTitle: {
    color: palette.warning,
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  historyCard: {
    borderColor: 'rgba(255,255,255,0.14)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  historyList: {
    gap: 12,
  },
  historyListHorizontal: {
    gap: 12,
    paddingHorizontal: 4,
  },
  verticalBarContainer: {
    width: 80,
    height: 160,
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  verticalBarSelected: {
    borderColor: palette.mint,
    backgroundColor: 'rgba(110,247,207,0.12)',
  },
  verticalBarChart: {
    width: 40,
    height: 140,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'flex-end',
    overflow: 'hidden',
    marginBottom: 6,
  },
  verticalBarChartSelected: {
    backgroundColor: 'rgba(110,247,207,0.2)',
  },
  verticalBarFill: {
    width: '100%',
    borderRadius: 6,
  },
  verticalBarHours: {
    color: palette.textPrimary,
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    marginBottom: 2,
  },
  verticalBarDate: {
    color: palette.textSecondary,
    fontFamily: fonts.bodyRegular,
    fontSize: 10,
  },
  recommendationCard: {
    borderColor: 'rgba(255,255,255,0.14)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  recommendationGrid: {
    flexDirection: 'row',
    marginBottom: 12,
    gap: 8,
  },
  recommendationItem: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 0,
    backgroundColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  recommendationLabel: {
    color: palette.textSecondary,
    fontFamily: fonts.bodyBold,
    fontSize: 10,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  recommendationValue: {
    color: palette.mint,
    fontFamily: fonts.headingMedium,
    fontSize: 14,
  },
  recommendationText: {
    color: '#FFFFFF',
    fontFamily: fonts.bodyRegular,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 4,
  },
  emptyCard: {
    borderColor: 'rgba(255,255,255,0.14)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyText: {
    color: palette.textPrimary,
    fontFamily: fonts.headingMedium,
    fontSize: 14,
    marginBottom: 6,
  },
  emptySubtest: {
    color: palette.textSecondary,
    fontFamily: fonts.bodyRegular,
    fontSize: 12,
    textAlign: 'center',
    paddingHorizontal: 16,
  },
  errorText: {
    color: '#FF8A80',
    fontFamily: fonts.bodyBold,
    fontSize: 14,
    textAlign: 'center',
    marginHorizontal: 4,
    marginTop: 8,
  },
  addButton: {
    borderRadius: 14,
    backgroundColor: palette.mint,
    alignItems: 'center',
    paddingVertical: 13,
    marginTop: 12,
  },
  addButtonText: {
    color: '#03110C',
    fontFamily: fonts.bodyBold,
    fontSize: 15,
  },
  pressed: {
    opacity: 0.75,
  },

  // MODAL STYLES
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1a3333',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 28,
    maxHeight: '92%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    marginBottom: 20,
  },
  modalTitle: {
    color: palette.textPrimary,
    fontFamily: fonts.headingMedium,
    fontSize: 18,
  },
  modalCloseButton: {
    fontSize: 24,
    color: palette.textSecondary,
    width: 30,
    textAlign: 'center',
  },
  tabsContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 0,
    borderWidth: 0,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
    backgroundColor: 'transparent',
    alignItems: 'center',
  },
  tabActive: {
    borderBottomColor: palette.mint,
  },
  tabText: {
    color: palette.textSecondary,
    fontFamily: fonts.bodyBold,
    fontSize: 12,
  },
  tabTextActive: {
    color: palette.mint,
  },
  timeSelectionContainer: {
    marginBottom: 16,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  timeLabel: {
    color: palette.textPrimary,
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 10,
  },
  timeLargeDisplay: {
    color: palette.mint,
    fontFamily: fonts.heading,
    fontSize: 40,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 16,
  },
  timePickersRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  timePickerSection: {
    alignItems: 'center',
    flex: 1,
  },
  timePickerContainer: {
    height: 140,
    justifyContent: 'center',
    borderRadius: 8,
    borderWidth: 0,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  timePickerItem: {
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  timePickerItemText: {
    color: palette.textSecondary,
    fontFamily: fonts.bodyRegular,
    fontSize: 14,
  },
  timePickerItemSelected: {
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  timePickerItemTextSelected: {
    color: palette.mint,
    fontSize: 18,
    fontFamily: fonts.bodyBold,
  },
  timeSubLabel: {
    color: palette.textSecondary,
    fontFamily: fonts.bodyBold,
    fontSize: 10,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  timeSeparator: {
    color: palette.textPrimary,
    fontFamily: fonts.heading,
    fontSize: 28,
    marginBottom: 12,
  },
  summaryBox: {
    borderColor: 'rgba(110,247,207,0.36)',
    backgroundColor: 'rgba(110,247,207,0.08)',
    paddingHorizontal: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 16,
    borderRadius: 10,
    borderWidth: 1,
  },
  summaryLabel: {
    color: palette.textSecondary,
    fontFamily: fonts.bodyBold,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  summaryValue: {
    marginTop: 4,
    color: palette.mint,
    fontFamily: fonts.headingMedium,
    fontSize: 20,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
  },
  cancelButton: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    paddingVertical: 11,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  cancelButtonText: {
    color: palette.textPrimary,
    fontFamily: fonts.bodyBold,
    fontSize: 13,
  },
  saveButton: {
    flex: 1,
    borderRadius: 10,
    backgroundColor: palette.mint,
    paddingVertical: 11,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#03110C',
    fontFamily: fonts.bodyBold,
    fontSize: 13,
  },
  todayCard: {
    borderColor: 'rgba(255,255,255,0.14)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  todayRecordContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  todayRecordItem: {
    flex: 1,
    alignItems: 'center',
  },
  todayRecordDivider: {
    width: 1,
    height: 50,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  todayRecordLabel: {
    color: palette.textSecondary,
    fontFamily: fonts.bodyBold,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  todayRecordValue: {
    color: palette.mint,
    fontFamily: fonts.headingMedium,
    fontSize: 28,
  },
  todayRecordTime: {
    color: palette.textPrimary,
    fontFamily: fonts.bodyBold,
    fontSize: 13,
  },
});
