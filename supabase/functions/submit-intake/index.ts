import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (data: unknown) =>
  new Response(JSON.stringify(data), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const { intake_token, form } = await req.json()
    if (!intake_token || !form) return json({ error: 'intake_token and form required' })

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { data: coach } = await supabase
      .from('coaches')
      .select('id')
      .eq('intake_token', intake_token)
      .single()

    if (!coach) return json({ error: 'Ongeldige intake link' })

    const { data: client, error } = await supabase
      .from('clients')
      .insert({
        coach_id: coach.id,
        full_name: form.full_name,
        goal: form.goal,
        level: form.level || 'beginner',
        days_per_week: parseInt(form.days_per_week) || 3,
        equipment: form.equipment || [],
        injuries: form.injuries || null,
        age: form.age ? parseInt(form.age) : null,
        weight_kg: form.weight_kg ? parseFloat(form.weight_kg) : null,
        height_cm: form.height_cm ? parseFloat(form.height_cm) : null,
        gender: form.gender || null,
        phone: form.phone || null,
        medical_notes: form.medical_notes || null,
        intake_notes: form.intake_notes || null,
        status: 'intake',
        training_days: form.training_days || [],
      })
      .select()
      .single()

    if (error) return json({ error: error.message })
    return json({ success: true, client_id: client.id })
  } catch (err) {
    return json({ error: String(err) })
  }
})
