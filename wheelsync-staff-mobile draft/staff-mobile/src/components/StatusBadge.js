import { View, Text } from 'react-native'
import { useAppTheme } from '../context/ThemeContext'

const COLOR_KEY = {
  pending: 'warning',
  accepted: 'success',
  ongoing: 'nebula3',
  completed: 'nebula2',
  rejected: 'danger',
  cancelled: 'danger',
}

export default function StatusBadge({ status }) {
  const { colors } = useAppTheme()
  const color = colors[COLOR_KEY[status]] ?? colors.textMuted
  return (
    <View style={{ backgroundColor: color + '26', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999 }}>
      <Text style={{ color, fontSize: 12, fontWeight: '700' }}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Text>
    </View>
  )
}
