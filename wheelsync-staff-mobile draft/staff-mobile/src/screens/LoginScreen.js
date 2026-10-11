import { useState } from 'react'
import { View, Text, TextInput, Pressable, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { useAuth } from '../context/AuthContext'
import { useAppTheme } from '../context/ThemeContext'
import ThemeToggle from '../components/ThemeToggle'

export default function LoginScreen() {
  const { signInWithPassword } = useAuth()
  const { colors } = useAppTheme()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleSubmit() {
    setError('')
    setBusy(true)
    const { error } = await signInWithPassword(email.trim(), password)
    setBusy(false)
    if (error) setError(error.message)
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1, backgroundColor: colors.bgVoid }}
    >
      <View style={{ position: 'absolute', top: 56, right: 20, zIndex: 10 }}>
        <ThemeToggle />
      </View>
      <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: 28 }}>
        <View style={{ alignItems: 'center', marginBottom: 32 }}>
          <LinearGradient
            colors={colors.gradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ width: 64, height: 64, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}
          >
            <Text style={{ color: 'white', fontSize: 28, fontWeight: '800' }}>W</Text>
          </LinearGradient>
          <Text style={{ color: colors.textPrimary, fontSize: 22, fontWeight: '700' }}>WheelSync Staff</Text>
          <Text style={{ color: colors.textMuted, fontSize: 13, marginTop: 4, textAlign: 'center' }}>
            Sign in with the account your admin created for you.
          </Text>
        </View>

        <View style={{ backgroundColor: colors.bgSurface, borderRadius: 20, padding: 20, borderWidth: 1, borderColor: colors.border, gap: 14 }}>
          {error ? (
            <Text style={{ color: colors.danger, fontSize: 13, backgroundColor: colors.danger + '1f', padding: 10, borderRadius: 10 }}>
              {error}
            </Text>
          ) : null}

          <View style={{ gap: 6 }}>
            <Text style={{ color: colors.textMuted, fontSize: 13 }}>Email</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              placeholder="staff@pardzcarrental.com"
              placeholderTextColor={colors.textFaint}
              style={{
                backgroundColor: colors.bgSurface2, color: colors.textPrimary,
                borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, borderColor: colors.border,
              }}
            />
          </View>

          <View style={{ gap: 6 }}>
            <Text style={{ color: colors.textMuted, fontSize: 13 }}>Password</Text>
            <TextInput
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              placeholder="••••••••"
              placeholderTextColor={colors.textFaint}
              style={{
                backgroundColor: colors.bgSurface2, color: colors.textPrimary,
                borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, borderColor: colors.border,
              }}
            />
          </View>

          <Pressable onPress={handleSubmit} disabled={busy || !email || !password}>
            <LinearGradient
              colors={colors.gradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{ borderRadius: 10, paddingVertical: 13, alignItems: 'center', opacity: busy || !email || !password ? 0.6 : 1 }}
            >
              {busy ? <ActivityIndicator color="white" /> : <Text style={{ color: 'white', fontWeight: '700' }}>Sign in</Text>}
            </LinearGradient>
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  )
}
