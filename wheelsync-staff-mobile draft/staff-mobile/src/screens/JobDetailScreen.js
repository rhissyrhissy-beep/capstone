import { useState } from 'react'
import { View, Text, Pressable, ScrollView, Alert } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '../lib/supabase'
import { useAppTheme } from '../context/ThemeContext'
import StatusBadge from '../components/StatusBadge'

export default function JobDetailScreen({ route, navigation }) {
  const { job } = route.params
  const { colors } = useAppTheme()
  const [status, setStatus] = useState(job.status)
  const [busy, setBusy] = useState(false)

  async function markOngoing() {
    setBusy(true)
    const { error } = await supabase.from('bookings').update({ status: 'ongoing' }).eq('id', job.id)
    setBusy(false)
    if (error) return Alert.alert('Error', error.message)
    setStatus('ongoing')
  }

  async function markCompleted() {
    setBusy(true)
    const { data: postRentalInspections, error: inspectionError } = await supabase
      .from('inspections')
      .select('id')
      .eq('booking_id', job.id)
      .eq('type', 'post_rental')
      .limit(1)
    if (inspectionError) {
      setBusy(false)
      return Alert.alert('Error', inspectionError.message)
    }
    if (!postRentalInspections?.length) {
      setBusy(false)
      return Alert.alert('Post-rental inspection required', 'Complete and save the post-rental inspection before releasing this vehicle.')
    }
    const actualReturnDate = new Date().toISOString().slice(0, 10)
    const { error } = await supabase.from('bookings').update({ status: 'completed', actual_return_date: actualReturnDate }).eq('id', job.id)
    setBusy(false)
    if (error) return Alert.alert('Error', error.message)
    setStatus('completed')
    Alert.alert('Booking completed', 'Nice work — this rental is now marked as completed.')
  }

  const Row = ({ label, value }) => (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border }}>
      <Text style={{ color: colors.textMuted, fontSize: 13 }}>{label}</Text>
      <Text style={{ color: colors.textPrimary, fontSize: 13, fontWeight: '600', flexShrink: 1, textAlign: 'right' }}>{value}</Text>
    </View>
  )

  return (
    <View style={{ flex: 1, backgroundColor: colors.bgVoid }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 56, paddingHorizontal: 20, paddingBottom: 12 }}>
        <Pressable onPress={() => navigation.goBack()} style={{ padding: 6 }}>
          <Ionicons name="chevron-back" size={22} color={colors.textPrimary} />
        </Pressable>
        <Text style={{ color: colors.textPrimary, fontSize: 18, fontWeight: '700' }}>Booking detail</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
        <View style={{ backgroundColor: colors.bgSurface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: colors.border }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
            <Text style={{ color: colors.textPrimary, fontSize: 16, fontWeight: '700' }}>
              {job.vehicles?.make} {job.vehicles?.model}
            </Text>
            <StatusBadge status={status} />
          </View>
          <Row label="Plate number" value={job.vehicles?.plate_number} />
          <Row label="Customer" value={job.profiles?.full_name} />
          <Row label="Phone" value={job.profiles?.phone ?? '—'} />
          <Row label="Rental period" value={`${job.start_date} → ${job.end_date}`} />
          <Row label="Pickup location" value={job.pickup_location ?? '—'} />
        </View>

        <View style={{ gap: 10 }}>
          {status === 'accepted' && (
            <Pressable onPress={markOngoing} disabled={busy} style={{ backgroundColor: colors.nebula3, borderRadius: 12, paddingVertical: 14, alignItems: 'center' }}>
              <Text style={{ color: 'white', fontWeight: '700' }}>Start rental (mark ongoing)</Text>
            </Pressable>
          )}

          <Pressable
            onPress={() => navigation.navigate('Inspection', { bookingId: job.id, type: 'pre_rental' })}
            style={{ backgroundColor: colors.bgSurface2, borderRadius: 12, paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: colors.border }}
          >
            <Text style={{ color: colors.textPrimary, fontWeight: '700' }}>Do pre-rental inspection</Text>
          </Pressable>

          <Pressable
            onPress={() => navigation.navigate('Inspection', { bookingId: job.id, type: 'post_rental' })}
            style={{ backgroundColor: colors.bgSurface2, borderRadius: 12, paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: colors.border }}
          >
            <Text style={{ color: colors.textPrimary, fontWeight: '700' }}>Do post-rental inspection</Text>
          </Pressable>

          {status === 'ongoing' && (
            <Pressable onPress={markCompleted} disabled={busy} style={{ backgroundColor: colors.success, borderRadius: 12, paddingVertical: 14, alignItems: 'center' }}>
              <Text style={{ color: 'white', fontWeight: '700' }}>Mark rental completed</Text>
            </Pressable>
          )}
        </View>
      </ScrollView>
    </View>
  )
}
