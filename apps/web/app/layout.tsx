import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, DM_Sans, JetBrains_Mono, Noto_Sans_JP } from "next/font/google";
import { QueryProvider } from "@/components/providers/QueryProvider";
import { DevDockProvider } from "@/dev";
import { env } from "@/lib/env";
import "./globals.css";

const SITE_URL = env.NEXT_PUBLIC_SITE_URL;
const SITE_DESCRIPTION
	= "Japanese spaced repetition with calm daily reviews, smart card timing, and a teacher's eye for the words that need another pass.";

const dmSans = DM_Sans({
	subsets: ["latin"],
	variable: "--font-dm-sans-loaded",
	display: "swap",
});

const notoSansJP = Noto_Sans_JP({
	subsets: ["latin"],
	weight: ["400", "500", "700"],
	variable: "--font-noto-sans-jp-loaded",
	display: "swap",
});

// Bricolage Grotesque is the new display face. Variable across weight (200-800)
// and width axes; we let the variable file handle hierarchy without specifying
// fixed weights. Replaces DM Serif Display (Iwanami-era) entirely.
const bricolage = Bricolage_Grotesque({
	subsets: ["latin"],
	variable: "--font-bricolage-loaded",
	display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
	subsets: ["latin"],
	variable: "--font-jetbrains-mono-loaded",
	display: "swap",
});

// Title convention: every page.tsx (or per-segment layout.tsx, when the page is
// a client component) exports `metadata: { title: 'Sentence case' }`. The root
// template below turns that into `Sentence case | Tomo`. Do NOT redefine
// `title.template` in any child layout — it overrides this one entirely rather
// than extending it, which is how the brand drift to "TOMO" originally happened.
export const metadata: Metadata = {
	metadataBase: new URL(SITE_URL),
	title: {
		template: "%s | Tomo",
		default: "Tomo · Japanese spaced repetition",
	},
	description: SITE_DESCRIPTION,
	applicationName: "Tomo",
	authors: [{ name: "Tomo" }],
	keywords: ["Japanese", "spaced repetition", "SRS", "kanji", "vocabulary", "JLPT", "flashcards", "daily reviews"],
	icons: {
		icon: [
			{ url: "/brand/favicon.ico", sizes: "any" },
			{ url: "/brand/favicon.svg", type: "image/svg+xml" },
		],
		apple: "/brand/apple-touch-icon.png",
	},
	openGraph: {
		type: "website",
		siteName: "Tomo",
		title: "Tomo · Japanese spaced repetition",
		description: SITE_DESCRIPTION,
		url: "/",
		locale: "en_US",
		images: [
			{ url: "/brand/og.png", width: 1200, height: 630, alt: "Tomo - Japanese spaced repetition" },
		],
	},
	twitter: {
		card: "summary_large_image",
		title: "Tomo · Japanese spaced repetition",
		description: SITE_DESCRIPTION,
		images: ["/brand/og.png"],
	},
	robots: { index: true, follow: true },
};

// Theme color and color-scheme moved out of `metadata` in Next.js 15 — they
// now live on the dedicated `viewport` export.
export const viewport: Viewport = {
	themeColor: "#F4F1EC", // matches --color-cool-paper-base from globals.css
	colorScheme: "light",
};

// SEO surface: the public (marketing) tree — landing `/`, `/privacy`, `/terms`,
// `/help` — carries page metadata, canonicals, JSON-LD (Organization +
// WebApplication on `/`, FAQPage on `/help`), and the sitemap. PWA install is
// wired via `app/manifest.ts` + the generated `public/brand/icon-*.png`. The
// one remaining deferral is dynamic per-deck OG images (next/og): decks are
// auth-gated with no shareable public URLs, so the static `og.png` is correct
// until that changes.

export default function RootLayout({ children }: { children: React.ReactNode }): React.JSX.Element {
	return (
		<html
			lang="en"
			className={`${dmSans.variable} ${bricolage.variable} ${notoSansJP.variable} ${jetbrainsMono.variable}`}
		>
			<body>
				<QueryProvider>
					<DevDockProvider>
						{children}
					</DevDockProvider>
				</QueryProvider>
			</body>
		</html>
	);
}
