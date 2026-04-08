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
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { data: coach } = await supabaseAdmin
      .from('coaches')
      .select('full_name, stripe_customer_id')
      .eq('id', user.id)
      .single()

    const mollieKey = Deno.env.get('MOLLIE_API_KEY')!
    const origin = req.headers.get('origin') ?? Deno.env.get('SITE_URL') ?? 'https://coachai-seven.vercel.app'

    // Get or create Mollie customer
    let mollieCustomerId = coach?.stripe_customer_id // reusing field for Mollie customer ID

    if (!mollieCustomerId) {
      const customerRes = await fetch('https://api.mollie.com/v2/customers', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${mollieKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: coach?.full_name ?? user.email,
          email: user.email,
          metadata: { supabase_user_id: user.id },
        }),
      })
      const customer = await customerRes.json()
      mollieCustomerId = customer.id

      await supabaseAdmin
        .from('coaches')
        .update({ stripe_customer_id: mollieCustomerId })
        .eq('id', user.id)
    }

    // Create first payment (establishes mandate for subscription)
    const paymentRes = await fetch('https://api.mollie.com/v2/payments', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${mollieKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: { currency: 'EUR', value: '49.00' },
        customerId: mollieCustomerId,
        sequenceType: 'first',
        description: 'CoachAI Pro — monthly subscription',
        redirectUrl: `${origin}/settings?upgraded=true`,
        webhookUrl: `${Deno.env.get('SUPABASE_URL')}/functions/v1/mollie-webhook`,
        metadata: { supabase_user_id: user.id },
      }),
    })

    const payment = await paymentRes.json()

    if (!payment._links?.checkout?.href) {
      console.error('Mollie payment error:', payment)
      return new Response(JSON.stringify({ error: 'Failed to create payment' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ url: payment._links.checkout.href }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('Checkout error:', err)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
