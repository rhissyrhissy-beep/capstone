import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { ThemeProvider, useAppTheme } from './src/context/ThemeContext'
import { AuthProvider, useAuth } from './src/context/AuthContext'
import LoginScreen from './src/screens/LoginScreen'
import JobsScreen from './src/screens/JobsScreen'
import JobDetailScreen from './src/screens/JobDetailScreen'
import InspectionScreen from './src/screens/InspectionScreen'

const Stack = createNativeStackNavigator()

function RootNavigator() {
  const { session, profile, loading } = useAuth()
  const { mode, colors } = useAppTheme()

  if (loading) return null

  const navTheme = {
    ...(mode === 'dark' ? DarkTheme : DefaultTheme),
    colors: {
      ...(mode === 'dark' ? DarkTheme.colors : DefaultTheme.colors),
      background: colors.bgVoid,
      card: colors.bgSurface,
      text: colors.textPrimary,
      border: colors.border,
      primary: colors.nebula3,
    },
  }

  const isStaff = session && profile?.role === 'staff'

  return (
    <NavigationContainer theme={navTheme}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {isStaff && session ? (
          <>
            <Stack.Screen name="Jobs" component={JobsScreen} />
            <Stack.Screen name="JobDetail" component={JobDetailScreen} />
            <Stack.Screen name="Inspection" component={InspectionScreen} />
          </>
        ) : (
          <Stack.Screen name="Login" component={LoginScreen} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  )
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthProvider>
          <RootNavigator />
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  )
}
