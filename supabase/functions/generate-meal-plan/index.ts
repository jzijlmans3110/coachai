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
    const { client_id, coach_id } = await req.json()
    if (!client_id || !coach_id) return json({ error: 'client_id and coach_id required' })

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY')
    if (!anthropicKey) return json({ error: 'Missing ANTHROPIC_API_KEY' })

    const supabase = createClient(supabaseUrl, serviceKey)

    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('*')
      .eq('id', client_id)
      .eq('coach_id', coach_id)
      .single()

    if (clientError || !client) return json({ error: 'Client not found' })

    const bmi = client.weight_kg && client.height_cm
      ? parseFloat((client.weight_kg / Math.pow(client.height_cm / 100, 2)).toFixed(1))
      : null

    // Estimate TDEE
    let tdee = 2200
    if (client.weight_kg && client.height_cm && client.age) {
      const bmr = client.gender === 'vrouw'
        ? 447.6 + (9.25 * client.weight_kg) + (3.1 * client.height_cm) - (4.33 * client.age)
        : 88.36 + (13.4 * client.weight_kg) + (4.8 * client.height_cm) - (5.7 * client.age)
      const activityFactor = client.days_per_week >= 5 ? 1.55 : client.days_per_week >= 3 ? 1.375 : 1.2
      tdee = Math.round(bmr * activityFactor)
    }

    const goalCalories = client.goal?.toLowerCase().includes('afval') || client.goal?.toLowerCase().includes('cut')
      ? Math.round(tdee * 0.85)
      : client.goal?.toLowerCase().includes('spier') || client.goal?.toLowerCase().includes('bulk')
      ? Math.round(tdee * 1.1)
      : tdee

    const userMessage = `Maak een 7-daags voedingsplan voor:
Naam: ${client.full_name}
Doel: ${client.goal}
Niveau: ${client.level}
${client.gender ? `Geslacht: ${client.gender}` : ''}
${client.age ? `Leeftijd: ${client.age}` : ''}
${client.weight_kg ? `Gewicht: ${client.weight_kg} kg` : ''}
${client.height_cm ? `Lengte: ${client.height_cm} cm` : ''}
${bmi ? `BMI: ${bmi}` : ''}
Geschatte calorieëndoelstelling: ${goalCalories} kcal/dag
Medische notities: ${client.medical_notes || 'geen'}

Maak een realistisch, uitvoerbaar Nederlands voedingsplan. Gebruik Nederlandse maaltijdnamen en voedingsmiddelen.`

    const claudeResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 8000,
        system: `Je bent een expert voedingsdeskundige en diëtist. Respond with valid JSON only, no markdown, no explanation.
Format:
{
  "title": "7-daags voedingsplan",
  "calories_target": 2200,
  "protein_target": 150,
  "carbs_target": 220,
  "fat_target": 70,
  "days": [
    {
      "day": "Maandag",
      "total_calories": 2180,
      "total_protein": 148,
      "meals": [
        {
          "name": "Ontbijt",
          "time": "08:00",
          "foods": ["Havermout 80g", "Banaan", "Skyr 150g"],
          "calories": 520,
          "protein": 32
        }
      ]
    }
  ]
}`,
        messages: [{ role: 'user', content: userMessage }],
      }),
    })

    if (!claudeResponse.ok) {
      const err = await claudeResponse.text()
      return json({ error: `Claude API failed (${claudeResponse.status}): ${err}` })
    }

    const claudeData = await claudeResponse.json()
    const rawContent = claudeData.content?.[0]?.text ?? ''

    let cleaned = rawContent.trim()
    cleaned = cleaned.replace(/^```(?:json)?[\r\n]*/m, '').replace(/[\r\n]*```\s*$/m, '').trim()
    const start = cleaned.indexOf('{')
    const end = cleaned.lastIndexOf('}')
    if (start !== -1 && end !== -1) cleaned = cleaned.slice(start, end + 1)

    let planContent
    try {
      planContent = JSON.parse(cleaned)
    } catch (e) {
      return json({ error: `Parse error: ${String(e)}` })
    }

    const { data: plan, error: insertError } = await supabase
      .from('meal_plans')
      .insert({
        client_id,
        coach_id,
        title: planContent.title ?? '7-daags voedingsplan',
        content: planContent,
        ai_generated: true,
      })
      .select()
      .single()

    if (insertError) return json({ error: `DB insert failed: ${insertError.message}` })

    return json({ plan })
  } catch (err) {
    return json({ error: `Unexpected error: ${String(err)}` })
  }
})
