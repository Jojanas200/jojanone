import Link from "next/link";
import { ArrowRight, Check, Minus } from "lucide-react";
import { listPublishedPlans } from "@/server/services/platform-plans";
import { MODULES } from "@/config/modules.config";
import { CORE_MODULES, planAllowsModule } from "@/shared/plans/entitlements";
import { pricingContent } from "@/content/site";
import { Reveal } from "../Reveal";
import { GET_STARTED_HREF } from "../nav";

export const metadata = {
  title: "Pricing - Jojan One",
  description: pricingContent.hero.subtitle,
};

// Packages are operator-managed: what is priced here is exactly what Admin >
// Packages has published, so the public page can never drift from what is
// actually sold. Short revalidation so publishing a change shows up promptly.
export const revalidate = 60;

/**
 * The trial copy was written when the trial was fixed at 14 days; operators now
 * set it per package. Rather than let the prose contradict the catalogue, the
 * number is substituted from whatever the published packages actually offer.
 */
const withTrialDays = (text: string, days: number) =>
  days === 14
    ? text
    : text.replace(
        /\b14([- ])([Dd])ay/g,
        (_m, gap: string, d: string) => `${days}${gap}${d}ay`,
      );

const money = (minor: number | null, currency: string) =>
  minor === null
    ? "Talk to us"
    : minor === 0
      ? "Free"
      : new Intl.NumberFormat("en-GB", {
          style: "currency",
          currency,
          maximumFractionDigits: minor % 100 === 0 ? 0 : 2,
        }).format(minor / 100);

const CORE_SET = new Set<string>(CORE_MODULES);

/** Every module a visitor could be shown, minus the ones with no page of their own. */
const COMPARABLE = MODULES.filter(
  (module) => module.key !== "dashboard" && module.key !== "settings",
);

export default async function PricingPage() {
  const { hero, trialIntro, trialBadge, platformNote, faq, cta } =
    pricingContent;
  const plans = await listPublishedPlans();
  const trialDays = Math.max(0, ...plans.map((plan) => plan.trialDays), 0);
  const trial = (text: string) => withTrialDays(text, trialDays || 14);

  return (
    <>
      <section className="s-page-hero">
        <div className="s-wrap">
          <Reveal className="s-head">
            <p className="s-eyebrow">{hero.eyebrow}</p>
            <h1 className="s-h1">{hero.title}</h1>
            <p className="s-lead">{hero.subtitle}</p>
          </Reveal>
        </div>
      </section>

      <section className="s-section-tight">
        <div className="s-wrap">
          <Reveal>
            <div className="s-card" style={{ padding: 32 }}>
              <span className="s-tag">{trial(trialBadge)}</span>
              <h2 className="s-h3" style={{ margin: "16px 0 12px" }}>
                {trial(trialIntro.title)}
              </h2>
              <p className="s-body">{trial(trialIntro.body)}</p>
              <p className="s-small" style={{ marginTop: 14 }}>
                {trialIntro.note}
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="s-section" style={{ paddingTop: 32 }}>
        <div className="s-wrap">
          {plans.length === 0 ? (
            <Reveal>
              <div
                className="s-card"
                style={{ textAlign: "center", padding: 48 }}
              >
                <h2 className="s-h3" style={{ marginBottom: 12 }}>
                  Our packages are being updated.
                </h2>
                <p className="s-body">
                  Get in touch and we will talk you through the options for your
                  business.
                </p>
                <div className="s-actions" style={{ justifyContent: "center" }}>
                  <Link href="/contact" className="s-btn s-btn-primary">
                    Talk to us
                    <ArrowRight size={16} />
                  </Link>
                </div>
              </div>
            </Reveal>
          ) : (
            <div
              className="s-plans"
              style={{
                gridTemplateColumns: `repeat(${Math.min(plans.length, 3)}, minmax(0, 1fr))`,
                marginTop: 0,
              }}
            >
              {plans.map((plan, i) => (
                <Reveal key={plan.key} delay={i * 70}>
                  <div
                    className={`s-plan ${plan.isHighlighted ? "s-plan-featured" : ""}`}
                    style={{ height: "100%" }}
                  >
                    {plan.isHighlighted ? (
                      <span
                        className="s-tag"
                        style={{ alignSelf: "flex-start" }}
                      >
                        Most popular
                      </span>
                    ) : null}
                    <h2
                      className="s-h3"
                      style={{ marginTop: plan.isHighlighted ? 16 : 0 }}
                    >
                      {plan.name}
                    </h2>
                    <p className="s-plan-price">
                      {money(plan.priceMinor, plan.currency)}
                      {plan.priceMinor !== null && plan.priceMinor > 0 ? (
                        <span className="s-plan-per">
                          {" "}
                          /{plan.billingInterval}
                        </span>
                      ) : null}
                    </p>
                    <p className="s-small">
                      {plan.seatLimit === null
                        ? "Unlimited seats"
                        : `Up to ${plan.seatLimit} seats`}
                    </p>
                    {plan.description ? (
                      <p className="s-body" style={{ marginTop: 16 }}>
                        {plan.description}
                      </p>
                    ) : null}

                    <ul className="s-plan-features">
                      {plan.trialDays > 0 ? (
                        <li className="s-check">
                          <Check size={16} />
                          <span>{plan.trialDays}-day free trial</span>
                        </li>
                      ) : null}
                      <li className="s-check">
                        <Check size={16} />
                        <span>
                          Compliance, risk, contracts, people, data protection
                          and governance
                        </span>
                      </li>
                      <li className="s-check">
                        <Check size={16} />
                        <span>
                          Policies, evidence and the Business Confidence Score
                        </span>
                      </li>
                      {COMPARABLE.filter(
                        (module) =>
                          !CORE_SET.has(module.key) &&
                          planAllowsModule(plan.features, module.key),
                      ).map((module) => (
                        <li key={module.key} className="s-check">
                          <Check size={16} />
                          <span>{module.title}</span>
                        </li>
                      ))}
                    </ul>

                    <Link
                      href={
                        plan.priceMinor === null ? "/contact" : GET_STARTED_HREF
                      }
                      className={`s-btn ${plan.isHighlighted ? "s-btn-primary" : "s-btn-ghost"}`}
                    >
                      {plan.priceMinor === null ? "Talk to us" : "Get started"}
                    </Link>
                  </div>
                </Reveal>
              ))}
            </div>
          )}

          <Reveal>
            <p className="s-small" style={{ marginTop: 32, maxWidth: 760 }}>
              {platformNote}
            </p>
          </Reveal>
        </div>
      </section>

      {plans.length > 0 ? (
        <section className="s-section s-section-lift">
          <div className="s-wrap">
            <Reveal className="s-head">
              <h2 className="s-h2">What is in each package</h2>
              <p className="s-lead">
                Core protection is in every package, because the Business
                Confidence Score is derived from it. The rest depends on the
                package you choose.
              </p>
            </Reveal>

            <Reveal>
              <div className="s-table-scroll" style={{ marginTop: 40 }}>
                <table className="s-table">
                  <thead>
                    <tr>
                      <th>Module</th>
                      {plans.map((plan) => (
                        <th key={plan.key} style={{ textAlign: "center" }}>
                          {plan.name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {COMPARABLE.map((module) => (
                      <tr key={module.key}>
                        <td style={{ color: "#fff" }}>{module.title}</td>
                        {plans.map((plan) => {
                          const included = planAllowsModule(
                            plan.features,
                            module.key,
                          );
                          return (
                            <td key={plan.key} style={{ textAlign: "center" }}>
                              {included ? (
                                <Check
                                  size={16}
                                  color="#14B8A6"
                                  aria-label="Included"
                                />
                              ) : (
                                <Minus
                                  size={16}
                                  color="#667085"
                                  aria-label="Not included"
                                />
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Reveal>
          </div>
        </section>
      ) : null}

      <section className="s-section">
        <div className="s-wrap s-wrap-narrow">
          <Reveal>
            <h2 className="s-h2">{faq.title}</h2>
          </Reveal>
          <div className="s-doc" style={{ marginTop: 40 }}>
            {faq.items.map((item, i) => (
              <Reveal key={item.id} delay={(i % 3) * 50}>
                <div>
                  <h3 className="s-h4" style={{ marginBottom: 10 }}>
                    {trial(item.question)}
                  </h3>
                  <p className="s-body">{trial(item.answer)}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="s-cta">
        <div className="s-wrap s-wrap-narrow">
          <Reveal>
            <h2 className="s-h2">{cta.title}</h2>
            <p className="s-lead">{trial(cta.subtitle)}</p>
            <div className="s-actions">
              <Link href={GET_STARTED_HREF} className="s-btn s-btn-primary">
                {cta.primaryCta}
                <ArrowRight size={16} />
              </Link>
              <Link href="/contact" className="s-btn s-btn-ghost">
                {cta.secondaryCta}
              </Link>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}
