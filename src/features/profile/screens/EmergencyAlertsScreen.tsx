// @ts-nocheck
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as Contacts from 'expo-contacts';

import AmbientBackdrop from '../../../components/AmbientBackdrop';
import GlassCard from '../../../components/GlassCard';
import {
  getEmergencyAlertSettings,
  saveEmergencyAlertSettings,
} from '../../../services/localHealth';
import { fonts, palette } from '../../../theme/tokens';

const THRESHOLD_OPTIONS = [6, 8, 10, 12];

export default function EmergencyAlertsScreen({ navigation }) {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [contactsPickerVisible, setContactsPickerVisible] = useState(false);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [availableContacts, setAvailableContacts] = useState([]);
  const [selectedContactIds, setSelectedContactIds] = useState([]);
  const [contactSearch, setContactSearch] = useState('');

  useEffect(() => {
    async function load() {
      setLoading(true);
      const current = await getEmergencyAlertSettings();
      setSettings(current);
      setLoading(false);
    }
    load();
  }, []);

  const updateMethod = (methodKey, value) => {
    setSettings((prev) => ({
      ...prev,
      methods: {
        ...(prev?.methods || {}),
        [methodKey]: value,
      },
    }));
  };

  const save = async () => {
    if (!settings) {
      return;
    }

    setSaving(true);
    setError('');
    try {
      const updated = await saveEmergencyAlertSettings(settings);
      setSettings(updated);
      navigation?.goBack?.();
    } catch {
      setError('No fue posible guardar la configuración de alertas.');
    } finally {
      setSaving(false);
    }
  };

  const normalizeContact = (contact) => {
    const fullName = [contact.firstName, contact.lastName].filter(Boolean).join(' ').trim();
    const displayName = contact.name || fullName || 'Contacto sin nombre';
    const phone = contact.phoneNumbers?.[0]?.number || '';
    const email = contact.emails?.[0]?.email || '';

    return {
      id: contact.id,
      name: displayName,
      phone,
      email,
      initials: displayName
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase())
        .join(''),
    };
  };

    const contactKey = (contact) => String(contact?.id || contact?.phone || contact?.email || contact?.name || '').trim().toLowerCase();

    const resolveSavedContact = (savedContact) => {
      if (!savedContact) {
        return savedContact;
      }

      const match = availableContacts.find((contact) => {
        if (savedContact.id && contact.id === savedContact.id) {
          return true;
        }

        if (savedContact.phone && contact.phone && contact.phone === savedContact.phone) {
          return true;
        }

        if (savedContact.email && contact.email && contact.email === savedContact.email) {
          return true;
        }

        return contactKey(contact) === contactKey(savedContact);
      });

      return match ? { ...savedContact, ...match } : savedContact;
    };

    const selectedSavedContacts = useMemo(
      () => (Array.isArray(settings?.contacts) ? settings.contacts.map(resolveSavedContact) : []),
      [settings?.contacts, availableContacts],
    );

  const openContactsPicker = async () => {
    setLoadingContacts(true);
    setError('');

      try {
        const permissions = await Contacts.requestPermissionsAsync();
        if (permissions.status !== 'granted') {
          setError('No se otorgaron permisos de contactos.');
          return;
        }

        const response = await Contacts.getContactsAsync({
          fields: [Contacts.Fields.Name, Contacts.Fields.FirstName, Contacts.Fields.LastName, Contacts.Fields.PhoneNumbers, Contacts.Fields.Emails],
          pageSize: 250,
        });

        const normalized = (response?.data || [])
          .map(normalizeContact)
          .filter((contact) => contact.phone || contact.email)
          .filter((contact, index, array) => array.findIndex((item) => item.id === contact.id) === index)
          .sort((left, right) => left.name.localeCompare(right.name, 'es'));

        setAvailableContacts(normalized);
        setSelectedContactIds(
          normalized
            .filter((contact) => selectedSavedContacts.some((saved) => contactKey(saved) === contactKey(contact)))
            .map((contact) => contact.id),
        );
        setContactsPickerVisible(true);
      } finally {
        setLoadingContacts(false);
      }
  };

  const filteredContacts = useMemo(() => {
    const query = contactSearch.trim().toLowerCase();
    if (!query) {
      return availableContacts;
    }

    return availableContacts.filter((contact) => {
      const haystack = `${contact.name} ${contact.phone} ${contact.email}`.toLowerCase();
      return haystack.includes(query);
    });
  }, [availableContacts, contactSearch]);

  const saveSelectedContacts = () => {
    const selectedRows = availableContacts.filter((contact) => selectedContactIds.includes(contact.id));

    setSettings((prev) => {
      const rows = Array.isArray(prev?.contacts) ? prev.contacts : [];

      const merged = [...rows];
      selectedRows.forEach((contact) => {
        if (!merged.some((row) => contactKey(row) === contactKey(contact))) {
          merged.push(contact);
        }
      });

      return {
        ...prev,
        contacts: merged.slice(0, 5),
      };
    });

    setContactsPickerVisible(false);
    setSelectedContactIds([]);
  };

  const removeContact = (contactToRemove) => {
    setSettings((prev) => ({
      ...prev,
      contacts: (prev?.contacts || []).filter((row) => contactKey(row) !== contactKey(contactToRemove)),
    }));
  };

  if (loading || !settings) {
    return (
      <AmbientBackdrop>
        <View style={styles.loaderWrap}>
          <ActivityIndicator color={palette.mint} />
          <Text style={styles.loaderText}>Cargando alertas de emergencia...</Text>
        </View>
      </AmbientBackdrop>
    );
  }

  return (
    <AmbientBackdrop>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.badge}>Seguridad</Text>
        <Text style={styles.title}>Alertas de apnea severa</Text>
        <Text style={styles.subtitle}>Configura cómo avisar y a quién contactar si detectamos un caso crítico.</Text>

        <GlassCard>
          <View style={styles.rowBetween}>
            <Text style={styles.label}>Sistema de alertas</Text>
            <Switch value={settings.enabled} onValueChange={(value) => setSettings((prev) => ({ ...prev, enabled: value }))} />
          </View>

          <Text style={styles.sectionTitle}>Umbral de severidad</Text>
          <View style={styles.chipsWrap}>
            {THRESHOLD_OPTIONS.map((value) => {
              const selected = settings.severe_threshold_events === value;
              return (
                <Pressable
                  key={`threshold-${value}`}
                  onPress={() => setSettings((prev) => ({ ...prev, severe_threshold_events: value }))}
                  style={({ pressed }) => [styles.chip, selected ? styles.chipSelected : null, pressed ? styles.pressed : null]}
                >
                  <Text style={[styles.chipText, selected ? styles.chipTextSelected : null]}>{value} eventos</Text>
                </Pressable>
              );
            })}
          </View>
        </GlassCard>

        <GlassCard>
          <Text style={styles.sectionTitle}>Canales de alerta</Text>
          <View style={styles.optionRow}><Text style={styles.optionText}>Notificación local</Text><Switch value={!!settings.methods.notification} onValueChange={(v) => updateMethod('notification', v)} /></View>
          <View style={styles.optionRow}><Text style={styles.optionText}>Vibrar / intentar despertar</Text><Switch value={!!settings.methods.wake_alarm} onValueChange={(v) => updateMethod('wake_alarm', v)} /></View>
          <View style={styles.optionRow}><Text style={styles.optionText}>WhatsApp</Text><Switch value={!!settings.methods.whatsapp} onValueChange={(v) => updateMethod('whatsapp', v)} /></View>
          <View style={styles.optionRow}><Text style={styles.optionText}>SMS</Text><Switch value={!!settings.methods.sms} onValueChange={(v) => updateMethod('sms', v)} /></View>
          <View style={styles.optionRow}><Text style={styles.optionText}>Correo</Text><Switch value={!!settings.methods.email} onValueChange={(v) => updateMethod('email', v)} /></View>
          <View style={styles.optionRow}><Text style={styles.optionText}>Auto envío sin confirmar</Text><Switch value={!!settings.auto_dispatch} onValueChange={(v) => setSettings((prev) => ({ ...prev, auto_dispatch: v }))} /></View>
        </GlassCard>

        <GlassCard>
          <Text style={styles.sectionTitle}>Contactos predeterminados</Text>
          <Pressable onPress={openContactsPicker} style={({ pressed }) => [styles.primaryButton, pressed ? styles.pressed : null]}>
            <Text style={styles.primaryButtonText}>{loadingContacts ? 'Cargando contactos...' : 'Elegir contactos de mi agenda'}</Text>
          </Pressable>

          {selectedSavedContacts.map((contact, index) => (
            <View key={`selected-${contactKey(contact) || index}`} style={styles.contactRow}>
              <View style={styles.contactAvatar}><Text style={styles.contactAvatarText}>{(contact.initials || contact.name?.[0] || '?').toUpperCase()}</Text></View>
              <View style={styles.contactInfo}>
                <Text style={styles.contactName}>{contact.name}</Text>
                <Text style={styles.contactMeta}>{contact.phone || contact.email || 'Contacto guardado'}</Text>
              </View>
              <Pressable onPress={() => removeContact(contact)} style={styles.removeButton}><Text style={styles.removeButtonText}>Quitar</Text></Pressable>
            </View>
          ))}
        </GlassCard>

        <Pressable onPress={save} disabled={saving} style={({ pressed }) => [styles.saveButton, pressed ? styles.pressed : null, saving ? styles.disabled : null]}>
          {saving ? <ActivityIndicator color="#03110C" /> : <Text style={styles.saveButtonText}>Guardar configuración</Text>}
        </Pressable>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}
      </ScrollView>

      <Modal visible={contactsPickerVisible} transparent animationType="fade" onRequestClose={() => setContactsPickerVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Selecciona contactos</Text>
            <Text style={styles.modalSubtitle}>Elige uno o varios contactos de tu agenda para tus alertas de emergencia.</Text>

            <TextInput
              value={contactSearch}
              onChangeText={setContactSearch}
              placeholder="Buscar por nombre, teléfono o correo"
              placeholderTextColor={palette.textMuted}
              style={styles.searchInput}
            />

            <ScrollView style={styles.contactList} contentContainerStyle={styles.contactListContent}>
              {filteredContacts.map((contact) => {
                const selected = selectedContactIds.includes(contact.id);

                return (
                  <Pressable
                    key={`picker-${contact.id}`}
                    onPress={() => {
                      setSelectedContactIds((prev) => (
                        prev.includes(contact.id)
                          ? prev.filter((id) => id !== contact.id)
                          : [...prev, contact.id]
                      ));
                    }}
                    style={({ pressed }) => [styles.pickRow, selected ? styles.pickRowSelected : null, pressed ? styles.pressed : null]}
                  >
                    <View style={styles.contactAvatar}><Text style={styles.contactAvatarText}>{(contact.initials || contact.name?.[0] || '?').toUpperCase()}</Text></View>
                    <View style={styles.pickInfo}>
                      <Text style={styles.pickName}>{contact.name}</Text>
                      <Text style={styles.pickMeta}>{contact.phone || contact.email || 'Sin teléfono ni correo'}</Text>
                    </View>
                    <View style={[styles.pickCheckbox, selected ? styles.pickCheckboxSelected : null]}>
                      <Text style={styles.pickCheckboxText}>{selected ? '✓' : ''}</Text>
                    </View>
                  </Pressable>
                );
              })}

              {filteredContacts.length === 0 ? <Text style={styles.emptyContactsText}>No encontramos contactos con ese filtro.</Text> : null}
            </ScrollView>

            <View style={styles.modalActions}>
              <Pressable style={styles.modalGhost} onPress={() => setContactsPickerVisible(false)}>
                <Text style={styles.modalGhostText}>Cancelar</Text>
              </Pressable>
              <Pressable style={styles.modalPrimary} onPress={saveSelectedContacts} disabled={selectedContactIds.length === 0}>
                <Text style={styles.modalPrimaryText}>Agregar ({selectedContactIds.length})</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
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
  loaderWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loaderText: {
    marginTop: 8,
    color: palette.textSecondary,
    fontFamily: fonts.body,
  },
  badge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,141,141,0.45)',
    backgroundColor: 'rgba(255,141,141,0.14)',
    color: '#FFB8B8',
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
    fontSize: 32,
    lineHeight: 36,
  },
  subtitle: {
    marginTop: 6,
    color: palette.textSecondary,
    fontFamily: fonts.bodyRegular,
    lineHeight: 20,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    color: palette.textPrimary,
    fontFamily: fonts.bodyBold,
    fontSize: 14,
  },
  sectionTitle: {
    marginTop: 10,
    color: palette.warning,
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  chipsWrap: {
    marginTop: 8,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    paddingHorizontal: 11,
    paddingVertical: 7,
  },
  chipSelected: {
    borderColor: 'rgba(255,141,141,0.7)',
    backgroundColor: 'rgba(255,141,141,0.22)',
  },
  chipText: {
    color: palette.textSecondary,
    fontFamily: fonts.body,
    fontSize: 12,
  },
  chipTextSelected: {
    color: '#FFD0D0',
    fontFamily: fonts.bodyBold,
  },
  optionRow: {
    marginTop: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  optionText: {
    color: palette.textSecondary,
    fontFamily: fonts.body,
  },
  primaryButton: {
    marginTop: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(149,178,255,0.6)',
    backgroundColor: 'rgba(149,178,255,0.2)',
    alignItems: 'center',
    paddingVertical: 10,
  },
  primaryButtonText: {
    color: '#DBE3FF',
    fontFamily: fonts.bodyBold,
    fontSize: 13,
  },
  contactRow: {
    marginTop: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    backgroundColor: 'rgba(255,255,255,0.03)',
    paddingHorizontal: 10,
    paddingVertical: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  contactAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(149,178,255,0.45)',
    backgroundColor: 'rgba(149,178,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  contactAvatarText: {
    color: '#D9E1FF',
    fontFamily: fonts.bodyBold,
    fontSize: 14,
  },
  contactInfo: {
    flex: 1,
  },
  contactName: {
    color: palette.textPrimary,
    fontFamily: fonts.bodyBold,
  },
  contactMeta: {
    marginTop: 3,
    color: palette.textMuted,
    fontFamily: fonts.bodyRegular,
    fontSize: 12,
  },
  removeButton: {
    marginLeft: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,141,141,0.5)',
    backgroundColor: 'rgba(255,141,141,0.15)',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  removeButtonText: {
    color: '#FFC2C2',
    fontFamily: fonts.bodyBold,
    fontSize: 12,
  },
  suggestedButton: {
    marginTop: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  suggestedText: {
    color: palette.textSecondary,
    fontFamily: fonts.body,
    fontSize: 12,
  },
  saveButton: {
    marginTop: 4,
    borderRadius: 14,
    backgroundColor: palette.mint,
    alignItems: 'center',
    paddingVertical: 13,
  },
  saveButtonText: {
    color: '#03110C',
    fontFamily: fonts.bodyBold,
    fontSize: 15,
  },
  disabled: {
    opacity: 0.62,
  },
  errorText: {
    color: palette.danger,
    fontFamily: fonts.body,
  },
  pressed: {
    opacity: 0.82,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.62)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    backgroundColor: '#07110F',
    padding: 16,
    maxHeight: '88%',
  },
  modalTitle: {
    color: palette.textPrimary,
    fontFamily: fonts.headingMedium,
    fontSize: 20,
  },
  modalSubtitle: {
    marginTop: 6,
    color: palette.textSecondary,
    fontFamily: fonts.bodyRegular,
    lineHeight: 20,
  },
  searchInput: {
    marginTop: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    color: palette.textPrimary,
    fontFamily: fonts.body,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  contactList: {
    marginTop: 12,
  },
  contactListContent: {
    gap: 8,
    paddingBottom: 10,
  },
  pickRow: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    backgroundColor: 'rgba(255,255,255,0.03)',
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  pickRowSelected: {
    borderColor: 'rgba(110,247,207,0.6)',
    backgroundColor: 'rgba(110,247,207,0.12)',
  },
  pickInfo: {
    flex: 1,
  },
  pickName: {
    color: palette.textPrimary,
    fontFamily: fonts.bodyBold,
    fontSize: 14,
  },
  pickMeta: {
    marginTop: 3,
    color: palette.textMuted,
    fontFamily: fonts.bodyRegular,
    fontSize: 12,
  },
  pickCheckbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickCheckboxSelected: {
    borderColor: 'rgba(110,247,207,0.7)',
    backgroundColor: 'rgba(110,247,207,0.2)',
  },
  pickCheckboxText: {
    color: palette.mint,
    fontFamily: fonts.bodyBold,
    fontSize: 13,
  },
  emptyContactsText: {
    color: palette.textMuted,
    fontFamily: fonts.body,
    fontSize: 12,
    textAlign: 'center',
    paddingVertical: 12,
  },
  modalActions: {
    marginTop: 10,
    flexDirection: 'row',
    gap: 8,
  },
  modalGhost: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    paddingVertical: 10,
  },
  modalGhostText: {
    color: palette.textPrimary,
    fontFamily: fonts.body,
  },
  modalPrimary: {
    flex: 1,
    borderRadius: 12,
    backgroundColor: palette.mint,
    alignItems: 'center',
    paddingVertical: 10,
  },
  modalPrimaryText: {
    color: '#03110C',
    fontFamily: fonts.bodyBold,
  },
});
