// @ts-nocheck
import React, { useEffect, useMemo, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import AmbientBackdrop from '../../../components/AmbientBackdrop';
import GlassCard from '../../../components/GlassCard';
import { getTipsProgress, saveTipsProgress } from '../../../services/localHealth';
import { fonts, palette } from '../../../theme/tokens';
import { getTipsModuleById } from '../tipsContent';

export default function TipsDetailScreen({ route }) {
  const moduleId = route?.params?.moduleId;
  const module = useMemo(() => getTipsModuleById(moduleId), [moduleId]);
  const [checkedItems, setCheckedItems] = useState([]);
  const [expandedSectionIndex, setExpandedSectionIndex] = useState(0);

  useEffect(() => {
    async function loadProgress() {
      if (!moduleId) {
        return;
      }
      const progress = await getTipsProgress();
      const saved = progress?.[moduleId]?.checked;
      setCheckedItems(Array.isArray(saved) ? saved : []);
    }

    loadProgress();
  }, [moduleId]);

  if (!module) {
    return (
      <AmbientBackdrop>
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyText}>No se encontró este módulo de consejos.</Text>
        </View>
      </AmbientBackdrop>
    );
  }

  const toggleChecklist = async (item) => {
    const nextChecked = checkedItems.includes(item)
      ? checkedItems.filter((value) => value !== item)
      : [...checkedItems, item];

    setCheckedItems(nextChecked);
    await saveTipsProgress(module.id, nextChecked);
  };

  const progress = module.checklist.length > 0 ? Math.round((checkedItems.length / module.checklist.length) * 100) : 0;

  const openResource = async (url) => {
    try {
      await Linking.openURL(url);
    } catch {
      // Evita bloquear la navegación si falla el enlace.
    }
  };

  return (
    <AmbientBackdrop>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={[styles.badge, { borderColor: `${module.accent}70`, color: module.accent }]}>Módulo</Text>
        <Text style={styles.title}>{module.title}</Text>
        <Text style={styles.subtitle}>{module.description}</Text>

        <GlassCard style={styles.progressCard}>
          <View style={styles.progressTopRow}>
            <Text style={styles.progressTitle}>Tu avance</Text>
            <Text style={styles.progressValue}>{progress}%</Text>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progress}%`, backgroundColor: module.accent }]} />
          </View>
          <Text style={styles.progressHint}>{checkedItems.length} de {module.checklist.length} acciones completadas</Text>
        </GlassCard>

        {module.sections.map((section, index) => {
          const expanded = expandedSectionIndex === index;
          return (
            <GlassCard key={`${module.id}-${section.title}`} style={styles.sectionCard}>
              <Pressable onPress={() => setExpandedSectionIndex(expanded ? -1 : index)} style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>{section.title}</Text>
                <Text style={styles.sectionToggle}>{expanded ? 'Ocultar' : 'Ver'}</Text>
              </Pressable>
              {expanded ? (
                <View style={styles.sectionBody}>
                  {section.bullets.map((bullet) => (
                    <View key={bullet} style={styles.bulletRow}>
                      <Text style={styles.bulletDot}>•</Text>
                      <Text style={styles.bulletText}>{bullet}</Text>
                    </View>
                  ))}
                </View>
              ) : null}
            </GlassCard>
          );
        })}

        <GlassCard>
          <Text style={styles.sectionTitle}>Checklist interactivo</Text>
          <View style={styles.checklistWrap}>
            {module.checklist.map((item) => {
              const selected = checkedItems.includes(item);
              return (
                <Pressable
                  key={item}
                  onPress={() => toggleChecklist(item)}
                  style={({ pressed }) => [
                    styles.checkItem,
                    selected ? styles.checkItemSelected : null,
                    pressed ? styles.pressed : null,
                  ]}
                >
                  <Text style={styles.checkIcon}>{selected ? '✓' : '○'}</Text>
                  <Text style={[styles.checkText, selected ? styles.checkTextSelected : null]}>{item}</Text>
                </Pressable>
              );
            })}
          </View>
        </GlassCard>

        <GlassCard>
          <Text style={styles.sectionTitle}>Fuentes en español y Colombia</Text>
          <View style={styles.resourcesWrap}>
            {module.resources.map((resource) => (
              <Pressable key={resource.url} style={({ pressed }) => [styles.resourceButton, pressed ? styles.pressed : null]} onPress={() => openResource(resource.url)}>
                <Text style={styles.resourceButtonText}>{resource.label}</Text>
              </Pressable>
            ))}
          </View>
        </GlassCard>
      </ScrollView>
    </AmbientBackdrop>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 28,
    gap: 12,
  },
  emptyWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    color: palette.textSecondary,
    fontFamily: fonts.body,
  },
  badge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    borderWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  title: {
    marginTop: 8,
    color: palette.textPrimary,
    fontFamily: fonts.heading,
    fontSize: 30,
    lineHeight: 34,
  },
  subtitle: {
    marginTop: 6,
    color: palette.textSecondary,
    fontFamily: fonts.bodyRegular,
    lineHeight: 20,
  },
  progressCard: {
    borderColor: 'rgba(255,255,255,0.16)',
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  progressTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressTitle: {
    color: palette.textPrimary,
    fontFamily: fonts.bodyBold,
    fontSize: 14,
  },
  progressValue: {
    color: palette.mint,
    fontFamily: fonts.headingMedium,
    fontSize: 20,
  },
  progressTrack: {
    marginTop: 10,
    borderRadius: 999,
    height: 10,
    backgroundColor: 'rgba(255,255,255,0.12)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
  },
  progressHint: {
    marginTop: 8,
    color: palette.textMuted,
    fontFamily: fonts.bodyRegular,
    fontSize: 12,
  },
  sectionCard: {
    borderColor: 'rgba(255,255,255,0.14)',
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    color: palette.textPrimary,
    fontFamily: fonts.bodyBold,
    fontSize: 15,
  },
  sectionToggle: {
    color: palette.mint,
    fontFamily: fonts.bodyBold,
    fontSize: 12,
  },
  sectionBody: {
    marginTop: 8,
    gap: 6,
  },
  bulletRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
  },
  bulletDot: {
    color: palette.mint,
    fontFamily: fonts.bodyBold,
    marginTop: 2,
  },
  bulletText: {
    flex: 1,
    color: palette.textSecondary,
    fontFamily: fonts.bodyRegular,
    lineHeight: 20,
  },
  checklistWrap: {
    marginTop: 8,
    gap: 8,
  },
  checkItem: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    paddingHorizontal: 10,
    paddingVertical: 10,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  checkItemSelected: {
    borderColor: 'rgba(110,247,207,0.65)',
    backgroundColor: 'rgba(110,247,207,0.12)',
  },
  checkIcon: {
    color: palette.mint,
    fontFamily: fonts.bodyBold,
    fontSize: 14,
  },
  checkText: {
    flex: 1,
    color: palette.textSecondary,
    fontFamily: fonts.body,
  },
  checkTextSelected: {
    color: palette.textPrimary,
  },
  resourcesWrap: {
    marginTop: 8,
    gap: 8,
  },
  resourceButton: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(149,178,255,0.48)',
    backgroundColor: 'rgba(149,178,255,0.16)',
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  resourceButtonText: {
    color: '#D9E1FF',
    fontFamily: fonts.bodyBold,
    fontSize: 13,
  },
  pressed: {
    opacity: 0.82,
  },
});
