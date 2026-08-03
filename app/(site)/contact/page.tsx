import { Mail } from "lucide-react";
import { contact } from "@/content/site";
import { Reveal } from "../Reveal";
import { ContactForm } from "./ContactForm";

export const metadata = {
  title: "Contact - Jojan One",
  description: contact.hero.subtitle,
};

export default function ContactPage() {
  const { hero, channels, office } = contact;

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

      <section className="s-section">
        <div className="s-wrap">
          <div className="s-grid s-grid-3" style={{ marginTop: 0 }}>
            {channels.map((channel, i) => (
              <Reveal key={channel.id} delay={i * 70}>
                <div className="s-card" style={{ height: "100%" }}>
                  <span className="s-icon">
                    <Mail size={18} />
                  </span>
                  <h2 className="s-h4" style={{ marginBottom: 10 }}>
                    {channel.label}
                  </h2>
                  <p className="s-small">{channel.description}</p>
                  <a
                    href={`mailto:${channel.email}`}
                    className="s-link-blue"
                    style={{
                      display: "inline-block",
                      marginTop: 16,
                      fontSize: 14,
                    }}
                  >
                    {channel.email}
                  </a>
                  <p className="s-small" style={{ marginTop: 10 }}>
                    {channel.responseTime}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="s-section s-section-lift">
        <div className="s-wrap">
          <div className="s-grid s-grid-2" style={{ marginTop: 0, gap: 48 }}>
            <Reveal>
              <ContactForm />
            </Reveal>

            <Reveal delay={90}>
              <div className="s-card" style={{ height: "100%" }}>
                <h2 className="s-h4" style={{ marginBottom: 16 }}>
                  {office.title}
                </h2>
                <address
                  className="s-body"
                  style={{ fontStyle: "normal", lineHeight: 1.9 }}
                >
                  {office.name}
                  <br />
                  {office.line1}
                  <br />
                  {office.line2}
                  <br />
                  {office.line3}
                  <br />
                  {office.line4}
                </address>
                <p className="s-small" style={{ marginTop: 20 }}>
                  {office.company}
                </p>
              </div>
            </Reveal>
          </div>
        </div>
      </section>
    </>
  );
}
