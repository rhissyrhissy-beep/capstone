import { useState } from 'react'
import { View, Text, TextInput, Pressable, ScrollView, Alert, ActivityIndicator } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useAppTheme } from '../context/ThemeContext'

const CHECKLIST_ITEMS = [
  'Exterior body / paint',
  'Tires & spare tire',
  'Headlights & taillights',
  'Windshield & mirrors',
  'Interior upholstery',
  'Air conditioning',
  'Tools & accessories complete',
  'Documents (OR/CR) in glove box',
]

export default function InspectionScreen({ route, navigation }) {
  const { bookingId, type } = route.params
  const { profile } = useAuth()
  const { colors } = useAppTheme()
  const [checklist, setChecklist] = useState(Object.fromEntries(CHECKLIST_ITEMS.map((i) => [i, true])))
  const [odometer, setOdometer] = useState('')
  const [fuelLevel, setFuelLevel] = useState('Full')
  const [damageNotes, setDamageNotes] = useState('')
  const [damageFee, setDamageFee] = useState('')
  const [busy, setBusy] = useState(false)

  function toggle(item) {
    setChecklist((c) => ({ ...c, [item]: !c[item] }))
  }

  async function submit() {
    setBusy(true)
    const { error } = await supabase.from('inspections').insert({
      booking_id: bookingId,
      staff_id: profile.id,
      type,
      checklist,
      odometer_reading: odometer ? Number(odometer) : null,
      fuel_level: fuelLevel,
      damage_notes: damageNotes,
      damage_fee: damageFee ? Number(damageFee) : 0,
    })
    setBusy(false)
    if (error) return Alert.alert('Error', error.message)
    Alert.alert('Inspection saved', 'The inspection record has been logged for this booking.', [
      { text: 'OK', onPress: () => navigation.goBack() },
    ])
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bgVoid }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 56, paddingHorizontal: 20, paddingBottom: 12 }}>
        <Pressable onPress={() => navigation.goBack()} style={{ padding: 6 }}>
          <Ionicons name="chevron-back" size={22} color={colors.textPrimary} />
        </Pressable>
        <Text style={{ color: colors.textPrimary, fontSize: 18, fontWeight: '700' }}>
          {type === 'pre_rental' ? 'Pre-rental' : 'Post-rental'} inspection
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, gap: 14, paddingBottom: 60 }}>
        <View style={{ backgroundColor: colors.bgSurface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: colors.border, gap: 4 }}>
          <Text style={{ color: colors.textMuted, fontSize: 13, marginBottom: 4 }}>Checklist</Text>
          {CHECKLIST_ITEMS.map((item) => (
            <Pressable
              key={item}
              onPress={() => toggle(item)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 }}
            >
              <Ionicons
                name={checklist[item] ? 'checkbox' : 'square-outline'}
                size={20}
                color={checklist[item] ? colors.success : colors.textFaint}
              />
              <Text style={{ color: colors.textPrimary, fontSize: 14, flex: 1 }}>{item}</Text>
            </Pressable>
          ))}
        </View>

        <View style={{ backgroundColor: colors.bgSurface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: colors.border, gap: 12 }}>
          <View style={{ gap: 6 }}>
            <Text style={{ color: colors.textMuted, fontSize: 13 }}>Odometer reading (km)</Text>
            <TextInput
              value={odometer}
              onChangeText={setOdometer}
              keyboardType="number-pad"
              placeholder="e.g. 24310"
              placeholderTextColor={colors.textFaint}
              style={{ backgroundColor: colors.bgSurface2, color: colors.textPrimary, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: colors.border }}
            />
          </View>

          <View style={{ gap: 6 }}>
            <Text style={{ color: colors.textMuted, fontSize: 13 }}>Fuel level</Text>
            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
              {['Empty', '1/4', '1/2', '3/4', 'Full'].map((lvl) => (
                <Pressable
                  key={lvl}
                  onPress={() => setFuelLevel(lvl)}
                  style={{
                    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999,
                    backgroundColor: fuelLevel === lvl ? colors.nebula3 : colors.bgSurface2,
                    borderWidth: 1, borderColor: colors.border,
                  }}
                >
                  <Text style={{ color: fuelLevel === lvl ? 'white' : colors.textPrimary, fontSize: 12, fontWeight: '600' }}>{lvl}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={{ gap: 6 }}>
            <Text style={{ color: colors.textMuted, fontSize: 13 }}>Damage notes (optional)</Text>
            <TextInput
              value={damageNotes}
              onChangeText={setDamageNotes}
              multiline
              numberOfLines={3}
              placeholder="e.g. small scratch on rear bumper"
              placeholderTextColor={colors.textFaint}
              style={{ backgroundColor: colors.bgSurface2, color: colors.textPrimary, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: colors.border, minHeight: 70, textAlignVertical: 'top' }}
            />
          </View>

          <View style={{ gap: 6 }}>
            <Text style={{ color: colors.textMuted, fontSize: 13 }}>Applicable damage fee (optional)</Text>
            <TextInput
              value={damageFee}
              onChangeText={setDamageFee}
              keyboardType="decimal-pad"
              placeholder="e.g. 1500"
              placeholderTextColor={colors.textFaint}
              style={{ backgroundColor: colors.bgSurface2, color: colors.textPrimary, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: colors.border }}
            />
          </View>
        </View>

        <Pressable
          onPress={submit}
          disabled={busy}
          style={{ backgroundColor: colors.nebula1, borderRadius: 12, paddingVertical: 14, alignItems: 'center', opacity: busy ? 0.6 : 1 }}
        >
          {busy ? <ActivityIndicator color="white" /> : <Text style={{ color: 'white', fontWeight: '700' }}>Save inspection</Text>}
        </Pressable>
      </ScrollView>
    </View>
  )
}
