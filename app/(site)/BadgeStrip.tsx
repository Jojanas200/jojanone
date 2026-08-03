import { Brain, Lock, Shield, SquareCheckBig } from "lucide-react";

const BADGES = [
  { label: "AI Powered", icon: Brain },
  { label: "Secure by Design", icon: Lock },
  { label: "UK GDPR Ready", icon: Shield },
  { label: "Business Protection Platform", icon: SquareCheckBig },
];

/**
 * The reassurance strip that closes the home page. It sits above the footer
 * but is not part of it: the design uses it on the home page only, and pages
 * that end on their own statement (the team page's founder quote) run
 * straight into the footer.
 */
export function BadgeStrip() {
  return (
    <section className="s-light s-light-plain">
      <div className="s-wrap">
        <div className="s-badges">
          <div>
            <h2 className="s-h4" style={{ marginBottom: 10 }}>
              Built for Modern Businesses
            </h2>
            <p className="s-small">
              Built for organisations that take compliance, governance, risk
              management and business growth seriously.
            </p>
          </div>
          <div className="s-badges-list">
            {BADGES.map((badge) => (
              <div key={badge.label} className="s-badge">
                <span>
                  <badge.icon size={17} />
                </span>
                {badge.label}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
