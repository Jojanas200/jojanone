import "./site.css";
import { SiteHeader } from "./SiteHeader";
import { SiteFooter } from "./SiteFooter";

/**
 * The public marketing site: home, capabilities, how it works, about, pricing,
 * trust and resources. Served from www.jojanone.com; the product lives on
 * app.jojanone.com and the middleware keeps the two apart.
 */

// The reveal-on-scroll state is only safe to apply when scripting is on -
// otherwise a visitor without JavaScript would see a page of blank sections.
// Stamped before first paint so nothing flashes in and back out.
const JS_FLAG = `document.documentElement.classList.add('s-js');`;

export default function SiteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="jo-site">
      <script dangerouslySetInnerHTML={{ __html: JS_FLAG }} />
      <SiteHeader />
      <main>{children}</main>
      <SiteFooter />
    </div>
  );
}
