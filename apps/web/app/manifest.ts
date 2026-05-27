import type { MetadataRoute } from "next";

// PWA web manifest. Next serves this at `/manifest.webmanifest` and injects the
// `<link rel="manifest">` automatically. Makes Tomo installable on mobile and
// desktop — useful for a daily-use study app the learner returns to each
// morning.
//
// Icons are generated from the brand SVGs into `public/brand/` (see DATABASE /
// brand assets): `icon-192`/`icon-512` are the full kitsune + 友 mark on the
// soft plate (`purpose: 'any'`); `icon-maskable-512` is the cream fox on a
// full-bleed Inari Vermillion field with a ~20% safe zone so the OS mask
// (circle / squircle) never clips the mark.
//
// `theme_color` / `background_color` match the app's Cool Paper Base page and
// the root `viewport.themeColor`, so the install splash and browser chrome stay
// on-palette. `start_url: '/today'` drops the learner straight into the daily
// hub; unauthenticated installs fall through middleware to `/login` as usual.
export default function manifest(): MetadataRoute.Manifest {
	return {
		name: "Tomo · Japanese spaced repetition",
		short_name: "Tomo",
		description:
      "Japanese spaced repetition with calm daily reviews, smart card timing, and a teacher's eye for the words that need another pass.",
		lang: "en",
		start_url: "/today",
		display: "standalone",
		background_color: "#F4F1EC",
		theme_color: "#F4F1EC",
		categories: ["education", "productivity"],
		icons: [
			{ src: "/brand/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
			{ src: "/brand/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
			{ src: "/brand/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
		],
	};
}
