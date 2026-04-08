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
    const { portal_token } = await req.json()
    if (!portal_token) return json({ error: 'portal_token required' })

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { data: client } = await supabase
      .from('clients')
      .select('id, full_name, goal, level, days_per_week, equipment, injuries, age, weight_kg, height_cm, gender, experience_years, training_days')
      .eq('portal_token', portal_token)
      .single()

    if (!client) return json({ error: 'Ongeldig portaal token' })

    const [{ data: programs }, { data: checkIns }, { data: mealPlans }, { data: milestones }] = await Promise.all([
      supabase.from('programs').select('*').eq('client_id', client.id).order('created_at', { ascending: false }).limit(3),
      supabase.from('check_ins').select('*').eq('client_id', client.id).order('submitted_at', { ascending: false }).limit(10),
      supabase.from('meal_plans').select('*').eq('client_id', client.id).order('created_at', { ascending: false }).limit(1),
      supabase.from('milestones').select('*').eq('client_id', client.id).order('created_at', { ascending: false }),
    ])

    return json({ client, programs: programs ?? [], checkIns: checkIns ?? [], mealPlans: mealPlans ?? [], milestones: milestones ?? [] })
  } catch (err) {
    return json({ error: String(err) })
  }
})
