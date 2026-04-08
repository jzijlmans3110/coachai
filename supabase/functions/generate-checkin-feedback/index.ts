import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { check_in_id } = await req.json()

    if (!check_in_id) {
      return new Response(JSON.stringify({ error: 'check_in_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Fetch check-in + client
    const { data: checkIn, error: ciError } = await supabase
      .from('check_ins')
      .select('*, clients(full_name, goal, level)')
      .eq('id', check_in_id)
      .single()

    if (ciError || !checkIn) {
      return new Response(JSON.stringify({ error: 'Check-in not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const client = checkIn.clients as { full_name: string; goal: string; level: string }

    const userMessage = `Write a short, motivational feedback paragraph (3-5 sentences) for a ${client.level} athlete named ${client.full_name}.
Their goal is: ${client.goal}
Week ${checkIn.week_number} check-in data:
- Energy level: ${checkIn.energy}/10
${checkIn.weight_kg ? `- Weight: ${checkIn.weight_kg} kg` : ''}
${checkIn.sleep_hrs ? `- Average sleep: ${checkIn.sleep_hrs} hours` : ''}
${checkIn.notes ? `- Notes: ${checkIn.notes}` : ''}

Be encouraging, specific to their data, and give one actionable tip for next week.`

    const claudeResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': Deno.env.get('ANTHROPIC_API_KEY')!,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 512,
        system: 'You are a supportive, expert personal trainer writing brief check-in feedback. Write naturally and warmly. Plain text only, no markdown.',
        messages: [{ role: 'user', content: userMessage }],
      }),
    })

    if (!claudeResponse.ok) {
      console.error('Claude API error:', await claudeResponse.text())
      return new Response(JSON.stringify({ error: 'AI generation failed' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const claudeData = await claudeResponse.json()
    const feedback = claudeData.content?.[0]?.text ?? ''

    // Update check-in with AI feedback
    await supabase
      .from('check_ins')
      .update({ ai_feedback: feedback })
      .eq('id', check_in_id)

    return new Response(JSON.stringify({ feedback }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('Unexpected error:', err)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
