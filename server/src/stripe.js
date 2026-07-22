// Real Stripe test-mode client — backs the web apps' PaymentSheet. See services.js's
// `payments` object for the (unrelated, still-simulated) checkout-hold lifecycle, which
// customer-native's PaymentSheet and the automatic order-creation hold continue to use.
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export async function createPaymentIntent({ amountCents, description, receiptEmail }) {
  return stripe.paymentIntents.create({
    amount: Math.round(amountCents),
    currency: 'sgd',
    description,
    receipt_email: receiptEmail || undefined,
    automatic_payment_methods: { enabled: true },
  });
}

export async function retrievePaymentIntent(id) {
  return stripe.paymentIntents.retrieve(id);
}
