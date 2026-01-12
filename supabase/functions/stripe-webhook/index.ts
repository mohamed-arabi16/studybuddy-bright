import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14.21.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, stripe-signature",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Helper to extract customer ID from Stripe objects
function getCustomerId(customer: string | Stripe.Customer | Stripe.DeletedCustomer | null): string | null {
  if (!customer) return null;
  return typeof customer === 'string' ? customer : customer.id;
}

// Helper to extract subscription ID from Stripe objects
function getSubscriptionId(subscription: string | Stripe.Subscription | null): string | null {
  if (!subscription) return null;
  return typeof subscription === 'string' ? subscription : subscription.id;
}

// Logging helper for structured logs
const log = (event: string, data?: Record<string, unknown>) => {
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    level: 'info',
    function_name: 'stripe-webhook',
    event,
    ...data,
  }));
};

const logError = (event: string, error: Error, data?: Record<string, unknown>) => {
  console.error(JSON.stringify({
    timestamp: new Date().toISOString(),
    level: 'error',
    function_name: 'stripe-webhook',
    event,
    error: {
      message: error.message,
      stack: error.stack,
    },
    ...data,
  }));
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
  const stripeWebhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  if (!stripeSecretKey || !stripeWebhookSecret) {
    logError("config_error", new Error("Missing Stripe configuration"));
    return new Response(
      JSON.stringify({ error: "Webhook not configured" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: "2023-10-16",
    });

    // Get the signature from headers
    const signature = req.headers.get("stripe-signature");
    if (!signature) {
      log("missing_signature");
      return new Response(
        JSON.stringify({ error: "Missing stripe-signature header" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get the raw body for signature verification
    const body = await req.text();
    
    // Verify the webhook signature
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(body, signature, stripeWebhookSecret);
    } catch (err) {
      const verifyError = err instanceof Error ? err : new Error(String(err));
      logError("signature_verification_failed", verifyError);
      return new Response(
        JSON.stringify({ error: "Invalid signature" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    log("webhook_received", { event_type: event.type, event_id: event.id });

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Handle specific event types
    switch (event.type) {
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionUpdate(supabase, subscription, event.id);
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionDeleted(supabase, subscription, event.id);
        break;
      }

      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        await handlePaymentSucceeded(supabase, invoice);
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        await handlePaymentFailed(supabase, invoice);
        break;
      }

      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutCompleted(supabase, session, event.id);
        break;
      }

      default:
        log("unhandled_event_type", { event_type: event.type });
    }

    return new Response(
      JSON.stringify({ received: true, event_type: event.type }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logError("webhook_error", err);
    return new Response(
      JSON.stringify({ error: "Webhook handler failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

/**
 * Handle subscription created or updated events
 */
async function handleSubscriptionUpdate(
  supabase: any,
  subscription: Stripe.Subscription,
  eventId: string
) {
  const customerId = getCustomerId(subscription.customer);
  if (!customerId) {
    log("missing_customer_id", { subscription_id: subscription.id });
    return;
  }

  log("processing_subscription_update", {
    subscription_id: subscription.id,
    customer_id: customerId,
    status: subscription.status,
  });

  // Map Stripe status to our status
  const statusMap: Record<string, string> = {
    active: "active",
    trialing: "trialing",
    past_due: "past_due",
    canceled: "canceled",
    unpaid: "expired",
    incomplete: "expired",
    incomplete_expired: "expired",
    paused: "canceled",
  };

  const status = statusMap[subscription.status] || "expired";

  // Find user by stripe_customer_id
  const { data: existingSub } = await supabase
    .from("subscriptions")
    .select("id, user_id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();

  if (!existingSub) {
    log("customer_not_found", { customer_id: customerId });
    return;
  }

  // Update the subscription
  const { error } = await supabase
    .from("subscriptions")
    .update({
      status,
      stripe_subscription_id: subscription.id,
      current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
      current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
      stripe_event_id: eventId,
      last_webhook_at: new Date().toISOString(),
    })
    .eq("id", existingSub.id);

  if (error) {
    logError("subscription_update_failed", new Error(error.message), {
      subscription_id: subscription.id,
    });
  } else {
    log("subscription_updated", {
      subscription_id: subscription.id,
      user_id: existingSub.user_id,
      status,
    });
  }
}

/**
 * Handle subscription deleted/canceled events
 */
async function handleSubscriptionDeleted(
  supabase: any,
  subscription: Stripe.Subscription,
  eventId: string
) {
  const customerId = getCustomerId(subscription.customer);
  if (!customerId) {
    log("missing_customer_id", { subscription_id: subscription.id });
    return;
  }

  log("processing_subscription_deletion", {
    subscription_id: subscription.id,
    customer_id: customerId,
  });

  const { error } = await supabase
    .from("subscriptions")
    .update({
      status: "canceled",
      stripe_event_id: eventId,
      last_webhook_at: new Date().toISOString(),
    })
    .eq("stripe_customer_id", customerId);

  if (error) {
    logError("subscription_deletion_failed", new Error(error.message), {
      subscription_id: subscription.id,
    });
  } else {
    log("subscription_deleted", { subscription_id: subscription.id });
  }
}

/**
 * Handle successful payment
 */
async function handlePaymentSucceeded(
  supabase: any,
  invoice: Stripe.Invoice
) {
  const customerId = getCustomerId(invoice.customer);
  if (!customerId) return;

  log("payment_succeeded", {
    invoice_id: invoice.id,
    customer_id: customerId,
    amount: invoice.amount_paid,
  });

  // Update subscription to active if it was past_due
  await supabase
    .from("subscriptions")
    .update({ status: "active" })
    .eq("stripe_customer_id", customerId)
    .eq("status", "past_due");
}

/**
 * Handle failed payment
 */
async function handlePaymentFailed(
  supabase: any,
  invoice: Stripe.Invoice
) {
  const customerId = getCustomerId(invoice.customer);
  if (!customerId) return;

  log("payment_failed", {
    invoice_id: invoice.id,
    customer_id: customerId,
    attempt_count: invoice.attempt_count,
  });

  // Mark subscription as past_due
  await supabase
    .from("subscriptions")
    .update({ status: "past_due" })
    .eq("stripe_customer_id", customerId)
    .eq("status", "active");
}

/**
 * Handle checkout session completed (new subscription)
 */
async function handleCheckoutCompleted(
  supabase: any,
  session: Stripe.Checkout.Session,
  eventId: string
) {
  const userId = session.client_reference_id;
  const customerId = getCustomerId(session.customer);
  const subscriptionId = getSubscriptionId(session.subscription);

  if (!userId || !customerId) {
    log("checkout_missing_data", {
      has_user_id: !!userId,
      has_customer_id: !!customerId,
    });
    return;
  }

  log("checkout_completed", {
    session_id: session.id,
    user_id: userId,
    customer_id: customerId,
  });

  // Upsert subscription record
  const { error } = await supabase
    .from("subscriptions")
    .upsert({
      user_id: userId,
      stripe_customer_id: customerId,
      stripe_subscription_id: subscriptionId,
      status: "active",
      stripe_event_id: eventId,
      last_webhook_at: new Date().toISOString(),
    }, {
      onConflict: "user_id",
    });

  if (error) {
    logError("checkout_subscription_upsert_failed", new Error(error.message), {
      user_id: userId,
    });
  } else {
    log("subscription_created_from_checkout", { user_id: userId });
  }
}
