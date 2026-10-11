import { View, ScrollView, StatusBar } from 'react-native'
import { useAppTheme } from '../context/ThemeContext'

// Common page wrapper: applies the galaxy void background + safe scroll padding.
export default function Screen({ children, scroll = true }) {
  const { colors, mode } = useAppTheme()
  const Wrapper = scroll ? ScrollView : View
  return (
    <View style={{ flex: 1, backgroundColor: colors.bgVoid }}>
      <StatusBar barStyle={mode === 'dark' ? 'light-content' : 'dark-content'} />
      <Wrapper contentContainerStyle={scroll ? { padding: 20, paddingBottom: 40 } : undefined} style={!scroll ? { flex: 1, padding: 20 } : undefined}>
        {children}
      </Wrapper>
    </View>
  )
}
