import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (data: unknown) => new Response(JSON.stringify(data), {
  status: 200, headers: { ...cors, 'Content-Type': 'application/json' },
})

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const { client_id } = await req.json()
    if (!client_id) return json({ error: 'client_id is required' })

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const [{ data: client }, { data: checkIns }, { data: programs }] = await Promise.all([
      supabase.from('clients').select('*').eq('id', client_id).single(),
      supabase.from('check_ins').select('*').eq('client_id', client_id).order('submitted_at', { ascending: true }),
      supabase.from('programs').select('title, created_at, weeks').eq('client_id', client_id).order('created_at', { ascending: false }),
    ])

    if (!client) return json({ error: 'Client not found' })

    const checkInSummary = (checkIns ?? []).map(c =>
      `Week ${c.week_number}: energie ${c.energy}/10, gewicht ${c.weight_kg ?? '?'}kg, slaap ${c.sleep_hrs ?? '?'}u${c.notes ? `, notities: "${c.notes}"` : ''}`
    ).join('\n')

    const prompt = `Je bent een expert personal trainer en data-analist. Analyseer de voortgang van deze client en geef bruikbare inzichten.

CLIENT:
Naam: ${client.full_name}
Doel: ${client.goal}
Niveau: ${client.level}
Dagen per week: ${client.days_per_week}
Blessures: ${client.injuries || 'geen'}
Programma's: ${programs?.length ?? 0} gegenereerd

CHECK-IN HISTORY (${(checkIns ?? []).length} check-ins):
${checkInSummary || 'Nog geen check-ins'}

Geef je analyse als JSON:
{
  "samenvatting": "2-3 zinnen over algemene voortgang",
  "energie_trend": "stijgend | dalend | stabiel",
  "aandachtspunten": ["punt 1", "punt 2"],
  "sterke_punten": ["punt 1", "punt 2"],
  "aanbevelingen": ["actie 1", "actie 2", "actie 3"],
  "score": 7,
  "score_toelichting": "korte uitleg van de score (1-10)"
}`

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': Deno.env.get('ANTHROPIC_API_KEY')!,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        system: 'Je bent een expert coach-analist. Antwoord altijd met valide JSON, geen markdown.',
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    if (!res.ok) return json({ error: `Claude fout: ${await res.text()}` })

    const aiData = await res.json()
    let raw = aiData.content?.[0]?.text ?? '{}'
    raw = raw.replace(/```(?:json)?/g, '').trim()
    const s = raw.indexOf('{'), e = raw.lastIndexOf('}')
    if (s !== -1 && e !== -1) raw = raw.slice(s, e + 1)

    let insights
    try { insights = JSON.parse(raw) }
    catch { return json({ error: 'Parse fout' }) }

    return json({ insights })
  } catch (err) {
    return json({ error: String(err) })
  }
})
