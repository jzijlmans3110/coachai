import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
  if (!apiKey) return json({ error: 'ANTHROPIC_API_KEY not configured' }, 500)

  try {
    const { client_id } = await req.json()
    if (!client_id) return json({ error: 'client_id required' })

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Fetch all relevant client data in parallel
    const [
      { data: client },
      { data: checkIns },
      { data: program },
      { data: milestones },
      { data: sessionNotes },
      { data: measurements },
    ] = await Promise.all([
      supabase.from('clients').select('*').eq('id', client_id).single(),
      supabase.from('check_ins').select('*').eq('client_id', client_id).order('submitted_at', { ascending: false }).limit(8),
      supabase.from('programs').select('title, weeks, content').eq('client_id', client_id).order('created_at', { ascending: false }).limit(1).single(),
      supabase.from('milestones').select('*').eq('client_id', client_id).order('created_at', { ascending: false }),
      supabase.from('session_notes').select('content, session_date').eq('client_id', client_id).order('session_date', { ascending: false }).limit(3),
      supabase.from('body_measurements').select('*').eq('client_id', client_id).order('measured_at', { ascending: false }).limit(3),
    ])

    if (!client) return json({ error: 'Client not found' })

    // Build context for Claude
    const daysSinceLastCheckIn = checkIns && checkIns.length > 0
      ? Math.floor((Date.now() - new Date(checkIns[0].submitted_at).getTime()) / 86400000)
      : null

    const energyHistory = (checkIns ?? []).map(c => c.energy)
    const avgEnergy = energyHistory.length
      ? (energyHistory.reduce((s, e) => s + e, 0) / energyHistory.length).toFixed(1)
      : 'onbekend'

    const energyTrend = energyHistory.length >= 3
      ? energyHistory[0] > energyHistory[2] ? 'stijgend' : energyHistory[0] < energyHistory[2] ? 'dalend' : 'stabiel'
      : 'onvoldoende data'

    const weightHistory = (measurements ?? []).filter(m => m.weight_kg).map(m => m.weight_kg)
    const weightTrend = weightHistory.length >= 2
      ? weightHistory[0] < weightHistory[1] ? `−${(weightHistory[1] - weightHistory[0]).toFixed(1)} kg` : `+${(weightHistory[0] - weightHistory[1]).toFixed(1)} kg`
      : null

    const achievedMilestones = (milestones ?? []).filter(m => m.achieved_at)
    const openMilestones = (milestones ?? []).filter(m => !m.achieved_at)

    const context = `
Je bent een AI-assistent voor personal coaches. Genereer een beknopte session brief voor het coachgesprek.

CLIENT:
- Naam: ${client.full_name}
- Doel: ${client.goal}
- Niveau: ${client.level}
- Dagen per week: ${client.days_per_week}
- Status: ${client.status ?? 'actief'}

CHECK-INS (laatste ${(checkIns ?? []).length}, nieuwste eerst):
${(checkIns ?? []).map(c => `Week ${c.week_number}: energie ${c.energy}/10, slaap ${c.sleep_hrs ?? '?'}u, gewicht ${c.weight_kg ?? '?'} kg. Notitie: "${c.notes ?? 'geen'}"`).join('\n')}

STATISTIEKEN:
- Gem. energie: ${avgEnergy}/10
- Energietrend: ${energyTrend}
- Dagen geleden ingecheckt: ${daysSinceLastCheckIn ?? 'nooit'}
- Gewichtstrend: ${weightTrend ?? 'onbekend'}

HUIDIG PROGRAMMA: ${program ? `${program.title} (${program.weeks} weken)` : 'geen'}

BEHAALDE MILESTONES: ${achievedMilestones.map(m => m.title).join(', ') || 'geen'}
OPEN MILESTONES: ${openMilestones.map(m => m.title).join(', ') || 'geen'}

LAATSTE SESSION NOTES:
${(sessionNotes ?? []).map(n => `${n.session_date}: ${n.content}`).join('\n') || 'geen'}

Genereer een session brief als GELDIG JSON object (geen tekst ervoor/erna) in dit exacte formaat:
{
  "snapshot": {
    "avg_energy": "${avgEnergy}/10",
    "energy_trend": "${energyTrend}",
    "consistency": "X%",
    "last_checkin_days": ${daysSinceLastCheckIn ?? null},
    "weight_trend": ${weightTrend ? `"${weightTrend}"` : null}
  },
  "celebrate": ["punt 1", "punt 2"],
  "address": ["zorgpunt 1", "zorgpunt 2"],
  "talking_points": ["gesprekspunt 1", "gesprekspunt 2", "gesprekspunt 3"],
  "program_suggestion": "concrete suggestie of null"
}

Regels:
- celebrate: wat is er goed gegaan? Minimaal 1, maximaal 3 punten. Wees specifiek.
- address: wat heeft aandacht nodig? 1-3 punten. Concreet en actiegericht.
- talking_points: 3-4 concrete gesprekspunten voor de sessie. Begin met actiewerkwoord.
- program_suggestion: één concrete aanpassing aan het programma als data dit suggereert, anders null.
- Schrijf alles in het Nederlands. Wees concreet en bondig.
`

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        messages: [{ role: 'user', content: context }],
      }),
    })

    const aiData = await response.json()
    const text = aiData.content?.[0]?.text ?? ''

    let brief
    try {
      brief = JSON.parse(text)
    } catch {
      // Try extracting JSON from the response
      const match = text.match(/\{[\s\S]*\}/)
      if (match) {
        brief = JSON.parse(match[0])
      } else {
        return json({ error: 'AI kon geen geldige brief genereren' }, 500)
      }
    }

    return json({
      client_name: client.full_name,
      generated_at: new Date().toISOString(),
      ...brief,
    })
  } catch (err) {
    return json({ error: String(err) }, 500)
  }
})
