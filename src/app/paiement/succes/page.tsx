import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getStripe, isStripeConfigured } from "@/lib/stripe";
import { fulfillPayment } from "@/lib/payment-fulfillment";
import { formatCentsToEuros } from "@/lib/money";

export const dynamic = "force-dynamic";

const RETURN_LINKS: Record<string, { href: string; label: string }> = {
  MEMBERSHIP: { href: "/mon-compte", label: "Retour à mon adhésion" },
  EVENT: { href: "/calendar", label: "Retour aux événements" },
  BALANCE_TOPUP: { href: "/profil", label: "Retour à mon profil" },
};

export default async function PaymentSuccessPage({
  searchParams,
}: {
  searchParams: { session_id?: string };
}) {
  const session = await getServerSession(authOptions);
  const sessionId = searchParams.session_id;

  let payment = null;
  let error: string | null = null;

  if (!sessionId) {
    error = "Session de paiement introuvable.";
  } else if (!isStripeConfigured()) {
    error = "Le paiement en ligne n'est pas configuré.";
  } else {
    try {
      // Vérification directe auprès de Stripe : couvre le cas où le webhook
      // n'est pas (encore) configuré ou n'a pas encore été reçu.
      const checkoutSession = await getStripe().checkout.sessions.retrieve(sessionId);
      if (checkoutSession.payment_status === "paid") {
        payment = await fulfillPayment(sessionId);
        if (!payment) error = "Paiement introuvable dans notre base.";
      } else {
        error = "Le paiement n'a pas été confirmé par Stripe.";
      }
    } catch {
      error = "Impossible de vérifier le paiement auprès de Stripe.";
    }
  }

  const returnLink = (payment && RETURN_LINKS[payment.type]) ?? { href: "/", label: "Retour à l'accueil" };

  return (
    <div className="mx-auto max-w-lg px-4 py-20 text-center">
      {payment && payment.userId === session?.user?.id ? (
        <>
          <div className="text-6xl">✅</div>
          <h1 className="mt-6 font-display text-3xl text-silver-100">Paiement confirmé</h1>
          <p className="mt-4 text-slate-300">{payment.label}</p>
          {payment.stripeFeesCents > 0 ? (
            <div className="mt-3 inline-block rounded-xl border border-primary-700 bg-primary-900/40 px-6 py-4 text-left text-sm text-slate-400">
              <div className="flex justify-between gap-8">
                <span>Montant</span>
                <span className="text-slate-200">{formatCentsToEuros(payment.amount)}</span>
              </div>
              <div className="mt-1 flex justify-between gap-8">
                <span>Frais de traitement</span>
                <span className="text-slate-200">{formatCentsToEuros(payment.stripeFeesCents)}</span>
              </div>
              <div className="mt-2 flex justify-between gap-8 border-t border-primary-700 pt-2 font-semibold">
                <span className="text-slate-200">Total débité</span>
                <span className="font-display text-xl text-emerald-400">
                  {formatCentsToEuros(payment.amount + payment.stripeFeesCents)}
                </span>
              </div>
            </div>
          ) : (
            <p className="mt-2 font-display text-4xl text-emerald-400">
              {formatCentsToEuros(payment.amount)}
            </p>
          )}
          <p className="mt-4 text-sm text-slate-400">
            Un email de confirmation a été envoyé à votre adresse email.
          </p>
        </>
      ) : payment ? (
        <>
          <div className="text-6xl">✅</div>
          <h1 className="mt-6 font-display text-3xl text-silver-100">Paiement confirmé</h1>
          <p className="mt-4 text-slate-300">Le paiement a bien été enregistré.</p>
        </>
      ) : (
        <>
          <div className="text-6xl">⚠️</div>
          <h1 className="mt-6 font-display text-3xl text-silver-100">Vérification impossible</h1>
          <p className="mt-4 text-slate-300">{error}</p>
          <p className="mt-2 text-sm text-slate-400">
            Si vous avez bien été débité, le paiement sera confirmé automatiquement sous peu.
          </p>
        </>
      )}
      <Link
        href={returnLink.href}
        className="mt-8 inline-block rounded-md bg-primary-400 px-5 py-2.5 font-semibold text-primary-950 hover:bg-silver-300"
      >
        {returnLink.label}
      </Link>
    </div>
  );
}
