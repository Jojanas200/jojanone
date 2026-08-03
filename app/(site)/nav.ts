/**
 * The marketing site's navigation, in one place so the header, the footer and
 * the sitemap can never drift apart.
 *
 * Sign-in and sign-up are relative on purpose: on www.jojanone.com the
 * middleware redirects anything outside the marketing routes to
 * app.jojanone.com, so /login resolves to the product wherever it is served
 * from - including localhost, where there is only one host.
 */

export const SIGN_IN_HREF = "/login";
export const GET_STARTED_HREF = "/login";

/**
 * Only accounts we can point at are listed. The design shows LinkedIn,
 * Facebook and Instagram; add the other two here once their handles exist,
 * rather than shipping icons that link nowhere.
 */
export const SOCIAL_LINKS = [
  {
    label: "LinkedIn",
    href: "https://www.linkedin.com/in/anastasia-ayivor-",
  },
] as const;

export const PRIMARY_NAV = [
  { label: "Capabilities", href: "/capabilities" },
  { label: "How It Works", href: "/how-it-works" },
  { label: "About", href: "/about" },
  { label: "Pricing", href: "/pricing" },
] as const;

export const FOOTER_NAV = [
  {
    heading: "Product",
    links: [
      { label: "Capabilities", href: "/capabilities" },
      { label: "Jova", href: "/capabilities/jova" },
      {
        label: "Business Confidence Score",
        href: "/capabilities/business-confidence-score",
      },
      { label: "Academy", href: "/capabilities/academy" },
      { label: "Pricing", href: "/pricing" },
    ],
  },
  {
    heading: "Company",
    links: [
      { label: "About", href: "/about" },
      { label: "Our Story", href: "/about/story" },
      { label: "Founder", href: "/about/founder" },
      { label: "Leadership & Team", href: "/about/team" },
      { label: "Contact", href: "/contact" },
    ],
  },
  {
    heading: "Trust & Legal",
    links: [
      { label: "Trust Centre", href: "/trust" },
      { label: "Security", href: "/trust/security" },
      { label: "Privacy Policy", href: "/trust/privacy" },
      { label: "Terms of Service", href: "/trust/terms" },
      { label: "Cookie Policy", href: "/trust/cookies" },
      { label: "Responsible AI", href: "/trust/ai" },
      { label: "Data Processing", href: "/trust/dpa" },
    ],
  },
  {
    heading: "Resources",
    links: [
      { label: "Help Centre", href: "/help" },
      { label: "Guides & Insights", href: "/guides" },
    ],
  },
] as const;
