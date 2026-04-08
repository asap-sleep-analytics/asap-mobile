import React, { useContext, useState } from 'react';
import {
	ActivityIndicator,
	Pressable,
	ScrollView,
	StyleSheet,
	Switch,
	Text,
	TextInput,
	View,
} from 'react-native';

import AmbientBackdrop from '../../../components/AmbientBackdrop';
import GlassCard from '../../../components/GlassCard';
import { AppContext } from '../../../context/AppContext';
import { getApiErrorMessage, loginUser, registerUser } from '../../../services/api';
import { fonts, palette } from '../../../theme/tokens';

export default function AuthScreen() {
	const { signIn } = useContext(AppContext) as {
		signIn: (token: string, userPayload: unknown, expiresInSeconds?: number) => Promise<void>;
	};
	const [mode, setMode] = useState<'login' | 'register'>('login');
	const [nombreCompleto, setNombreCompleto] = useState('');
	const [email, setEmail] = useState('');
	const [password, setPassword] = useState('');
	const [roncaHabitualmente, setRoncaHabitualmente] = useState(false);
	const [cansancioDiurno, setCansancioDiurno] = useState(false);
	const [aceptaConsentimientoDatos, setAceptaConsentimientoDatos] = useState(false);
	const [aceptaDisclaimerMedico, setAceptaDisclaimerMedico] = useState(false);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState('');

	const isRegisterMode = mode === 'register';
	const legalPending = isRegisterMode && (!aceptaConsentimientoDatos || !aceptaDisclaimerMedico);

	const handleSubmit = async () => {
		setLoading(true);
		setError('');

		try {
			const payload = isRegisterMode
				? {
						nombre_completo: nombreCompleto,
						email,
						password,
						ronca_habitualmente: roncaHabitualmente,
						cansancio_diurno: cansancioDiurno,
						acepta_consentimiento_datos: aceptaConsentimientoDatos,
						acepta_disclaimer_medico: aceptaDisclaimerMedico,
					}
				: {
						email,
						password,
					};

			const response = isRegisterMode ? await registerUser(payload) : await loginUser(payload);

			await signIn(response.access_token, response.usuario, response.expires_in);
		} catch (err: unknown) {
			setError(getApiErrorMessage(err, 'No fue posible autenticar al usuario.'));
		} finally {
			setLoading(false);
		}
	};

	return (
		<AmbientBackdrop>
			<ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
				<Text style={styles.badge}>Acceso de plataforma</Text>
				<Text style={styles.title}>Iniciar sesión o registrarme</Text>
				<Text style={styles.subtitle}>
					{isRegisterMode
						? 'Crea tu cuenta para comenzar a monitorear tu sueño de forma simple y segura.'
						: 'Inicia sesión para ver tu progreso nocturno y recomendaciones.'}
				</Text>

				<GlassCard>
					<View style={styles.modeRow}>
						<Pressable
							style={[styles.modeButton, mode === 'login' ? styles.modeButtonActive : null]}
							onPress={() => setMode('login')}
						>
							<Text style={[styles.modeButtonText, mode === 'login' ? styles.modeButtonTextActive : null]}>
								Login
							</Text>
						</Pressable>
						<Pressable
							style={[styles.modeButton, mode === 'register' ? styles.modeButtonActive : null]}
							onPress={() => setMode('register')}
						>
							<Text style={[styles.modeButtonText, mode === 'register' ? styles.modeButtonTextActive : null]}>
								Registro
							</Text>
						</Pressable>
					</View>

					{isRegisterMode ? (
						<>
							<Text style={styles.label}>Nombre completo</Text>
							<TextInput
								value={nombreCompleto}
								onChangeText={setNombreCompleto}
								style={styles.input}
								autoCapitalize="words"
								placeholder="Tu nombre"
								placeholderTextColor={palette.textMuted}
							/>
						</>
					) : null}

					<Text style={styles.label}>Correo</Text>
					<TextInput
						value={email}
						onChangeText={setEmail}
						style={styles.input}
						keyboardType="email-address"
						autoCapitalize="none"
						placeholder="nombre@correo.com"
						placeholderTextColor={palette.textMuted}
					/>

					<Text style={styles.label}>Contrasena</Text>
					<TextInput
						value={password}
						onChangeText={setPassword}
						style={styles.input}
						secureTextEntry
						placeholder="Minimo 8 caracteres"
						placeholderTextColor={palette.textMuted}
					/>

					{isRegisterMode ? (
						<>
							<View style={styles.switchRow}>
								<Text style={styles.switchLabel}>Roncas habitualmente</Text>
								<Switch
									value={roncaHabitualmente}
									onValueChange={setRoncaHabitualmente}
									trackColor={{ false: 'rgba(255,255,255,0.24)', true: 'rgba(110,247,207,0.5)' }}
									thumbColor={roncaHabitualmente ? palette.mint : '#f4f3f4'}
								/>
							</View>

							<View style={styles.switchRow}>
								<Text style={styles.switchLabel}>Sientes cansancio diurno</Text>
								<Switch
									value={cansancioDiurno}
									onValueChange={setCansancioDiurno}
									trackColor={{ false: 'rgba(255,255,255,0.24)', true: 'rgba(110,247,207,0.5)' }}
									thumbColor={cansancioDiurno ? palette.mint : '#f4f3f4'}
								/>
							</View>

							<View style={styles.switchRow}>
								<Text style={styles.switchLabel}>Acepto tratamiento de datos (Ley 1581)</Text>
								<Switch
									value={aceptaConsentimientoDatos}
									onValueChange={setAceptaConsentimientoDatos}
									trackColor={{ false: 'rgba(255,255,255,0.24)', true: 'rgba(110,247,207,0.5)' }}
									thumbColor={aceptaConsentimientoDatos ? palette.mint : '#f4f3f4'}
								/>
							</View>

							<View style={styles.switchRow}>
								<Text style={styles.switchLabel}>Acepto que no reemplaza diagnostico medico</Text>
								<Switch
									value={aceptaDisclaimerMedico}
									onValueChange={setAceptaDisclaimerMedico}
									trackColor={{ false: 'rgba(255,255,255,0.24)', true: 'rgba(110,247,207,0.5)' }}
									thumbColor={aceptaDisclaimerMedico ? palette.mint : '#f4f3f4'}
								/>
							</View>
						</>
					) : null}

					<Pressable
						style={[styles.submitButton, loading || legalPending ? styles.disabledButton : null]}
						onPress={handleSubmit}
						disabled={loading || legalPending}
					>
						{loading ? (
							<ActivityIndicator color="#02120D" />
						) : (
							<Text style={styles.submitButtonText}>{isRegisterMode ? 'Crear cuenta' : 'Entrar'}</Text>
						)}
					</Pressable>

					{legalPending ? <Text style={styles.helperText}>Debes aceptar los dos consentimientos para registrar.</Text> : null}
					{error ? <Text style={styles.errorText}>{error}</Text> : null}
				</GlassCard>
			</ScrollView>
		</AmbientBackdrop>
	);
}

const styles = StyleSheet.create({
	container: {
		paddingHorizontal: 20,
		paddingTop: 20,
		paddingBottom: 28,
	},
	badge: {
		alignSelf: 'flex-start',
		borderWidth: 1,
		borderColor: 'rgba(110,247,207,0.35)',
		backgroundColor: 'rgba(110,247,207,0.08)',
		borderRadius: 999,
		paddingHorizontal: 10,
		paddingVertical: 6,
		color: palette.mint,
		fontFamily: fonts.bodyBold,
		fontSize: 11,
		textTransform: 'uppercase',
		letterSpacing: 1,
	},
	title: {
		marginTop: 14,
		fontSize: 32,
		lineHeight: 36,
		color: palette.textPrimary,
		fontFamily: fonts.heading,
	},
	subtitle: {
		marginTop: 10,
		marginBottom: 14,
		color: palette.textSecondary,
		lineHeight: 22,
		fontFamily: fonts.body,
	},
	modeRow: {
		marginTop: 4,
		flexDirection: 'row',
		backgroundColor: 'rgba(255,255,255,0.07)',
		borderRadius: 12,
		padding: 4,
		gap: 8,
	},
	modeButton: {
		flex: 1,
		alignItems: 'center',
		borderRadius: 10,
		paddingVertical: 10,
	},
	modeButtonActive: {
		backgroundColor: 'rgba(110,247,207,0.18)',
		borderWidth: 1,
		borderColor: 'rgba(110,247,207,0.4)',
	},
	modeButtonText: {
		color: palette.textSecondary,
		fontFamily: fonts.body,
	},
	modeButtonTextActive: {
		color: palette.mint,
	},
	label: {
		marginTop: 14,
		marginBottom: 6,
		color: palette.textSecondary,
		fontFamily: fonts.body,
	},
	input: {
		borderWidth: 1,
		borderColor: 'rgba(255,255,255,0.18)',
		borderRadius: 12,
		backgroundColor: 'rgba(255,255,255,0.03)',
		color: palette.textPrimary,
		fontFamily: fonts.bodyRegular,
		paddingHorizontal: 12,
		paddingVertical: 10,
	},
	switchRow: {
		marginTop: 12,
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
		gap: 12,
	},
	switchLabel: {
		flex: 1,
		color: palette.textSecondary,
		fontFamily: fonts.bodyRegular,
		lineHeight: 20,
	},
	submitButton: {
		marginTop: 20,
		borderRadius: 12,
		backgroundColor: palette.mint,
		alignItems: 'center',
		paddingVertical: 12,
	},
	disabledButton: {
		opacity: 0.6,
	},
	submitButtonText: {
		color: '#03110C',
		fontSize: 15,
		fontFamily: fonts.bodyBold,
	},
	helperText: {
		marginTop: 10,
		color: palette.warning,
		fontFamily: fonts.bodyRegular,
		fontSize: 12,
	},
	errorText: {
		marginTop: 12,
		color: palette.danger,
		fontFamily: fonts.body,
	},
});
