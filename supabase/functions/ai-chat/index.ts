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
    const { client_id, messages } = await req.json()

    if (!client_id || !messages?.length) return json({ error: 'client_id and messages required' })

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY')
    if (!anthropicKey) return json({ error: 'Missing ANTHROPIC_API_KEY' })

    const supabase = createClient(supabaseUrl, serviceKey)

    const [{ data: client }, { data: checkIns }, { data: programs }] = await Promise.all([
      supabase.from('clients').select('*').eq('id', client_id).single(),
      supabase.from('check_ins').select('*').eq('client_id', client_id).order('submitted_at', { ascending: false }).limit(10),
      supabase.from('programs').select('id, title, created_at, weeks').eq('client_id', client_id).order('created_at', { ascending: false }).limit(5),
    ])

    if (!client) return json({ error: 'Client not found' })

    const bmi = client.weight_kg && client.height_cm
      ? (client.weight_kg / Math.pow(client.height_cm / 100, 2)).toFixed(1)
      : null

    const recentCheckIns = (checkIns ?? []).slice(0, 5).map((c: Record<string, unknown>) =>
      `Week ${c.week_number}: energie ${c.energy}/10${c.weight_kg ? `, gewicht ${c.weight_kg}kg` : ''}${c.sleep_hrs ? `, slaap ${c.sleep_hrs}u` : ''}${c.notes ? `, notitie: "${c.notes}"` : ''}`
    ).join('\n')

    const systemPrompt = `Je bent een slimme AI-assistent voor een personal trainer. Je helpt de coach met advies, vragen en analyses over hun client.

Client profiel:
- Naam: ${client.full_name}
- Doel: ${client.goal}
- Niveau: ${client.level}
- Leeftijd: ${client.age ?? 'onbekend'}
- Gewicht: ${client.weight_kg ? `${client.weight_kg} kg` : 'onbekend'}
- Lengte: ${client.height_cm ? `${client.height_cm} cm` : 'onbekend'}
${bmi ? `- BMI: ${bmi}` : ''}
- Trainingsdagen: ${client.days_per_week}x per week
- Apparatuur: ${client.equipment?.join(', ') || 'bodyweight'}
- Blessures: ${client.injuries || 'geen'}
${client.medical_notes ? `- Medische notities: ${client.medical_notes}` : ''}
- Programma's gegenereerd: ${(programs ?? []).length}

${recentCheckIns ? `Recente check-ins:\n${recentCheckIns}` : 'Nog geen check-ins.'}

Antwoord altijd in het Nederlands. Wees concreet, professioneel en to-the-point. Je helpt de coach — niet de client direct.`

    const claudeResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        system: systemPrompt,
        messages,
      }),
    })

    if (!claudeResponse.ok) {
      const err = await claudeResponse.text()
      return json({ error: `Claude API failed: ${err}` })
    }

    const data = await claudeResponse.json()
    const reply = data.content?.[0]?.text ?? ''

    return json({ reply })
  } catch (err) {
    return json({ error: `Unexpected error: ${String(err)}` })
  }
})
