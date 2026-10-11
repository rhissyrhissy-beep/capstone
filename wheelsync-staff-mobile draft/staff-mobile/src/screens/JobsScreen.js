import { useCallback, useEffect, useState } from 'react'
import { View, Text, Pressable, RefreshControl, ScrollView } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useAppTheme } from '../context/ThemeContext'
import ThemeToggle from '../components/ThemeToggle'
import StatusBadge from '../components/StatusBadge'

export default function JobsScreen({ navigation }) {
  const { profile, signOut } = useAuth()
  const { colors } = useAppTheme()
  const [jobs, setJobs] = useState([])
  const [notifications, setNotifications] = useState([])
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setError('')
    const [{ data, error: jobsError }, { data: notificationData, error: notificationsError }] = await Promise.all([
      supabase
        .from('bookings')
        .select('id, start_date, end_date, status, pickup_location, vehicles(make, model, plate_number), profiles:customer_id(full_name, phone)')
        .eq('assigned_staff_id', profile.id)
        .in('status', ['accepted', 'ongoing', 'completed'])
        .order('start_date', { ascending: true }),
      supabase
        .from('notifications')
        .select('id, title, body, is_read, created_at')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false })
        .limit(5),
    ])
    if (jobsError || notificationsError) {
      setError(jobsError?.message || notificationsError?.message || 'Unable to load your staff workspace.')
      return
    }
    setJobs(data ?? [])
    setNotifications(notificationData ?? [])
  }, [profile.id])

  useEffect(() => {
    load()
    const channel = supabase
      .channel('staff-jobs')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings', filter: `assigned_staff_id=eq.${profile.id}` }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${profile.id}` }, load)
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [load, profile.id])

  async function handleRefresh() {
    setRefreshing(true)
    await load()
    setRefreshing(false)
  }

  async function markNotificationRead(id) {
    const { error: updateError } = await supabase.from('notifications').update({ is_read: true }).eq('id', id).eq('user_id', profile.id)
    if (updateError) {
      setError(updateError.message)
      return
    }
    load()
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bgVoid }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 56, paddingHorizontal: 20, paddingBottom: 16 }}>
        <View>
          <Text style={{ color: colors.textPrimary, fontSize: 20, fontWeight: '700' }}>My jobs</Text>
          <Text style={{ color: colors.textMuted, fontSize: 13 }}>Hi {profile?.full_name?.split(' ')[0]}, here's what's assigned to you.</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <ThemeToggle />
          <Pressable onPress={signOut} style={{ padding: 8, borderRadius: 10, borderWidth: 1, borderColor: colors.border }}>
            <Ionicons name="log-out-outline" size={18} color={colors.textPrimary} />
          </Pressable>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 20, paddingTop: 0, gap: 12 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.textPrimary} />}
      >
        {error ? (
          <View style={{ backgroundColor: colors.danger + '1f', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: colors.danger }}>
            <Text style={{ color: colors.danger, fontSize: 13 }}>{error}</Text>
          </View>
        ) : null}
        {notifications.length > 0 && (
          <View style={{ backgroundColor: colors.bgSurface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: colors.border, gap: 8 }}>
            <Text style={{ color: colors.textPrimary, fontWeight: '700' }}>Notifications</Text>
            {notifications.map((notification) => (
              <Pressable key={notification.id} onPress={() => markNotificationRead(notification.id)} style={{ paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                <Text style={{ color: colors.textPrimary, fontWeight: notification.is_read ? '500' : '800' }}>{notification.title}</Text>
                <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }}>{notification.body}</Text>
              </Pressable>
            ))}
          </View>
        )}
        {jobs.length === 0 && (
          <View style={{ backgroundColor: colors.bgSurface, borderRadius: 16, padding: 24, borderWidth: 1, borderColor: colors.border }}>
            <Text style={{ color: colors.textMuted, textAlign: 'center' }}>No jobs assigned yet. Pull down to refresh.</Text>
          </View>
        )}
        {jobs.map((job) => (
          <Pressable
            key={job.id}
            onPress={() => navigation.navigate('JobDetail', { job })}
            style={{ backgroundColor: colors.bgSurface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: colors.border }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <View style={{ flex: 1, paddingRight: 8 }}>
                <Text style={{ color: colors.textPrimary, fontWeight: '600' }}>
                  {job.vehicles?.make} {job.vehicles?.model} ({job.vehicles?.plate_number})
                </Text>
                <Text style={{ color: colors.textMuted, fontSize: 13, marginTop: 3 }}>
                  {job.profiles?.full_name} · {job.profiles?.phone}
                </Text>
                <Text style={{ color: colors.textFaint, fontSize: 12, marginTop: 3 }}>
                  {job.start_date} → {job.end_date}
                </Text>
              </View>
              <StatusBadge status={job.status} />
            </View>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  )
}
