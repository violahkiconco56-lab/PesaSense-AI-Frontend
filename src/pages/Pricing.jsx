import { useEffect, useState } from "react";
import "./Pricing.css";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import { apiRequest } from "../api";

const PLANS = [
  {
    name: "Free",
    amount: 0,
    pricePeriod: "",
    features: [
      "Manual transaction tracking",
      "Up to 3 budgets",
      "1 savings goal",
      "Last 3 months of history",
      "Monthly summary",
    ],
  },
  {
    name: "Premium",
    amount: null,
    pricePeriod: "/ month",
    features: [
      "Everything in Free",
      "Unlimited budgets",
      "Up to 5 savings goals",
      "Full history and CSV export",
      "CSV statement import",
      "AI spending insights",
      "End-of-month forecast",
      "Unusual spending alerts",
      "Recurring bills and reminders",
    ],
    isPopular: true,
  },
];

function Pricing() {
  const [user, setUser] = useState(null);
  const [premiumPrice, setPremiumPrice] = useState(null);
  const [msisdn, setMsisdn] = useState("");
  const [payment, setPayment] = useState(null);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [paymentMessage, setPaymentMessage] = useState("");
  const [paymentError, setPaymentError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPolling, setIsPolling] = useState(false);

  useEffect(() => {
    apiRequest("/users/me").then(setUser).catch((error) => {
      setPaymentError(error.message);
    });
    apiRequest("/payments/premium/price")
      .then(setPremiumPrice)
      .catch((error) => setPaymentError(error.message));
  }, []);

  const premiumActive =
    user?.subscription_plan === "premium" &&
    user?.subscription_status === "active";

  async function pollPayment(reference) {
    setIsPolling(true);
    setPaymentError("");
    setPaymentMessage("Check your phone and approve the payment.");

    try {
      for (let attempt = 0; attempt < 40; attempt += 1) {
        await new Promise((resolve) => window.setTimeout(resolve, 3000));
        let result;
        try {
          result = await apiRequest(`/payments/${encodeURIComponent(reference)}`);
        } catch (error) {
          if (error.status === 502 || error.status === 503) continue;
          throw error;
        }

        setPayment(result);
        if (result.status === "success") {
          setPaymentMessage(result.message);
          setUser((previous) => ({
            ...previous,
            subscription_plan: "premium",
            subscription_status: "active",
            current_period_end: result.current_period_end,
          }));
          try {
            setUser(await apiRequest("/users/me"));
          } catch {
            setPaymentMessage(
              "Payment approved. Premium is active; reload the page to refresh your plan.",
            );
          }
          return;
        }
        if (result.status === "failed") {
          setPaymentMessage(result.message);
          return;
        }
      }
      setPaymentMessage(
        "Payment is still awaiting approval. You can check its status again below.",
      );
    } catch (error) {
      setPaymentError(error.message);
    } finally {
      setIsPolling(false);
    }
  }

  async function submitPayment(event) {
    event.preventDefault();
    setIsSubmitting(true);
    setPaymentError("");
    setPaymentMessage("");

    try {
      const result = await apiRequest("/payments/premium", {
        method: "POST",
        body: JSON.stringify({ msisdn }),
      });
      setPayment(result);
      setPaymentMessage(result.message);
      setShowPaymentForm(false);
      if (result.status === "pending") {
        await pollPayment(result.reference);
      } else if (result.status === "success") {
        setUser(await apiRequest("/users/me"));
      }
    } catch (error) {
      setPaymentError(error.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="app-layout">
      <Sidebar />
      <div className="content-shell">
        <Topbar />
        <main className="page pricing-page">
          <header className="page-header pricing-header">
            <div>
              <h1>Simple pricing for every Ugandan</h1>
              <p>Start free. Upgrade when you want smarter insights.</p>
            </div>
          </header>

          <section className="pricing-plans" aria-label="Available plans">
            {PLANS.map((plan) => {
              const isCurrent =
                plan.name.toLowerCase() ===
                (premiumActive ? "premium" : user?.subscription_plan || "free");
              const price =
                plan.amount === null
                  ? premiumPrice
                    ? `UGX ${new Intl.NumberFormat("en-UG").format(premiumPrice.amount)}`
                    : "UGX …"
                  : `UGX ${new Intl.NumberFormat("en-UG").format(plan.amount)}`;
              return (
                <article
                  className={`pricing-card${plan.isPopular ? " pricing-card-popular" : ""}`}
                  key={plan.name}
                >
                  {plan.isPopular && (
                    <span className="pricing-badge">Most popular</span>
                  )}
                  <h2>{plan.name}</h2>
                  <p className="pricing-price">
                    <span>{price}</span>
                    {plan.pricePeriod && (
                      <span className="pricing-period">{plan.pricePeriod}</span>
                    )}
                  </p>
                  <ul className="pricing-features">
                    {plan.features.map((feature) => (
                      <li key={feature}>{feature}</li>
                    ))}
                  </ul>
                  {isCurrent ? (
                    <button className="pricing-button" type="button" disabled>
                      Current plan
                    </button>
                  ) : plan.name === "Premium" ? (
                    <button
                      className="pricing-button"
                      type="button"
                      disabled={!premiumPrice || isSubmitting || isPolling}
                      onClick={() => {
                        setPaymentError("");
                        setPaymentMessage("");
                        setShowPaymentForm((visible) => !visible);
                      }}
                    >
                      {showPaymentForm ? "Cancel" : "Upgrade to Premium"}
                    </button>
                  ) : (
                    <button className="pricing-button" type="button" disabled>
                      {plan.name}
                    </button>
                  )}
                  {plan.name === "Premium" && showPaymentForm && (
                    <form className="payment-form" onSubmit={submitPayment}>
                      <label htmlFor="mobile-money-number">
                        MTN or Airtel Mobile Money number
                      </label>
                      <input
                        id="mobile-money-number"
                        type="tel"
                        autoComplete="tel"
                        inputMode="tel"
                        pattern="\+2567[0-9]{8}"
                        placeholder="+256701345678"
                        value={msisdn}
                        onChange={(event) => setMsisdn(event.target.value)}
                        title="Enter a Ugandan mobile number in +256 format."
                        required
                        disabled={isSubmitting || isPolling}
                      />
                      <p>
                        Enter your number with +256; you will approve the request
                        on your phone.
                      </p>
                      <button
                        className="pricing-button"
                        type="submit"
                        disabled={isSubmitting || isPolling}
                      >
                        {isSubmitting ? "Sending request…" : "Request payment"}
                      </button>
                    </form>
                  )}
                </article>
              );
            })}
          </section>

          <p className="pricing-note">
            Payment by MTN and Airtel Mobile Money is coming soon.
          </p>
          <p className="pricing-message" role="status" aria-live="polite">
            {paymentMessage}
          </p>
          {payment?.status === "pending" && !isPolling && (
            <button
              className="pricing-recheck"
              type="button"
              onClick={() => pollPayment(payment.reference)}
            >
              Check payment status
            </button>
          )}
          {paymentError && (
            <p className="pricing-error" role="alert">
              {paymentError}
            </p>
          )}
        </main>
      </div>
    </div>
  );
}

export default Pricing;
