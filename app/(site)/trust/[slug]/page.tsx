import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { TRUST_PAGES, TRUST_SLUGS } from "@/content/site";
import { Reveal } from "../../Reveal";

export function generateStaticParams() {
  return TRUST_SLUGS.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const page = TRUST_PAGES[slug];
  if (!page) return { title: "Trust Centre - Jojan One" };
  return {
    title: `${page.hero.title} - Jojan One`,
    description: page.hero.subtitle,
  };
}

export default async function TrustDocumentPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const page = TRUST_PAGES[slug];
  if (!page) notFound();

  return (
    <>
      <section className="s-page-hero">
        <div className="s-wrap s-wrap-narrow">
          <Link href="/trust" className="s-back">
            <ArrowLeft size={14} />
            Trust Centre
          </Link>
          <Reveal>
            <p className="s-eyebrow">{page.hero.eyebrow}</p>
            <h1 className="s-h1">{page.hero.title}</h1>
            <p className="s-lead">{page.hero.subtitle}</p>
            {page.lastUpdated ? (
              <p className="s-small" style={{ marginTop: 24 }}>
                Last updated {page.lastUpdated}
              </p>
            ) : null}
          </Reveal>
        </div>
      </section>

      <section className="s-section">
        <div className="s-wrap s-wrap-narrow">
          {page.intro ? (
            <Reveal>
              <p className="s-body" style={{ fontSize: 17 }}>
                {page.intro}
              </p>
            </Reveal>
          ) : null}

          <Reveal>
            <nav className="s-toc" aria-label="On this page">
              {page.sections.map((section) => (
                <a key={section.id} href={`#${section.id}`}>
                  {section.title}
                </a>
              ))}
            </nav>
          </Reveal>

          <div className="s-doc">
            {page.sections.map((section) => (
              <Reveal key={section.id} as="section">
                <div id={section.id}>
                  <h2>{section.title}</h2>
                  {section.paragraphs.map((paragraph) => (
                    <div key={paragraph.id} className="s-doc-item">
                      {paragraph.heading ? <h3>{paragraph.heading}</h3> : null}
                      <p className="s-body">{paragraph.text}</p>
                    </div>
                  ))}
                </div>
              </Reveal>
            ))}

            {page.subprocessors ? (
              <Reveal as="section">
                <h2>{page.subprocessors.title}</h2>
                <div className="s-table-scroll">
                  <table className="s-table">
                    <thead>
                      <tr>
                        <th>Sub-processor</th>
                        <th>Purpose</th>
                        <th>Location</th>
                      </tr>
                    </thead>
                    <tbody>
                      {page.subprocessors.items.map((item) => (
                        <tr key={item.id}>
                          <td>{item.name}</td>
                          <td>{item.purpose}</td>
                          <td>{item.location}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Reveal>
            ) : null}
          </div>

          <Reveal>
            <p className="s-small" style={{ marginTop: 48 }}>
              Questions about this document? Email{" "}
              <a href="mailto:trust@jojanone.com" className="s-link-blue">
                trust@jojanone.com
              </a>
              .
            </p>
          </Reveal>
        </div>
      </section>
    </>
  );
}
