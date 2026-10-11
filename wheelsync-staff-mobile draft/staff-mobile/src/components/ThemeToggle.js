import { Pressable, Text } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useAppTheme } from '../context/ThemeContext'

export default function ThemeToggle() {
  const { mode, colors, toggleTheme } = useAppTheme()
  const isDark = mode === 'dark'
  return (
    <Pressable
      onPress={toggleTheme}
      style={{
        flexDirection: 'row', alignItems: 'center', gap: 6,
        paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10,
        borderWidth: 1, borderColor: colors.border,
      }}
    >
      <Ionicons name={isDark ? 'sunny-outline' : 'moon-outline'} size={16} color={colors.textPrimary} />
      <Text style={{ color: colors.textPrimary, fontSize: 12, fontWeight: '600' }}>
        {isDark ? 'Light' : 'Dark'}
      </Text>
    </Pressable>
  )
}
