# Transactional Email (Supabase Auth + Resend SMTP)

Tomo's auth emails — signup confirmation, password reset, and email change — are
sent by **Supabase Auth (GoTrue)** through a **custom Resend SMTP** connection,
using branded templates in [`supabase/templates/`](../supabase/templates). This
replaces Supabase's default sender (which is rate-limited and unbranded).

> **Why OTP, not links.** Tomo verifies a typed **6-digit code** client-side
> (`supabase.auth.verifyOtp(...)` in
> [`apps/web/lib/actions/auth.actions.ts`](../apps/web/lib/actions/auth.actions.ts)).
> There are no `/callback` or `token_hash` routes. Every template therefore leads
> with `{{ .Token }}` (the code) — a link-only template would silently break auth.
> Don't "improve" these templates by replacing the code with a confirm button.

---

## 1. Architecture at a glance

| Concern | Owner |
|---|---|
| Sending the email | Supabase Auth (GoTrue) via SMTP |
| SMTP transport | Resend (`smtp.resend.com:465`) |
| Template HTML + subjects | `supabase/templates/*.html` + `[auth.email.template.*]` in `config.toml` |
| Local config + secrets | `supabase/config.toml` (`env(...)`) + project-root `.env` |
| Production config + secrets | Hosted Supabase dashboard (project `kukkptyopjdtuzgzamua`) |

**No application code sends email.** The web and API apps never hold SMTP
credentials. The SMTP password is a Supabase-only secret.

### Layout
Full-bleed editorial composition: warm paper (`#FDFBF7`) fills the entire email
body (no floating card or canvas gutter), so the design uses the client's whole
container. A full-bleed vermillion top stripe is the brand signature; full-width
hairline rules divide the editorial bands. A justified running head (brand left,
section label right) and footer (caption left, domain right) use the full width.
Left-aligned oversized Bricolage headline with a vermillion underline, and the
OTP set as a typographic specimen on a cream inset with a vermillion baseline.
Built from tables, borders, and type only, with `<!--[if mso]>` width wrappers,
so it degrades cleanly in Outlook. Tokens mirror [DESIGN.md](./DESIGN.md);
change the design doc first.

### Brand logo
The header uses the kitsune mark at
`apps/web/public/brand/logo-email.png` (a transparent PNG rendered from
`logo.svg` — email clients can't display inline SVG). It is referenced by its
**absolute production URL** `https://www.tomo-srs.com/brand/logo-email.png`, so
**the web app must be deployed for the image to load** (a local-only build won't
serve it to a real inbox). The mark is `alt=""` (decorative); if a client blocks
remote images, the live `TOMO` wordmark beneath it still carries the brand. To
regenerate after a logo change:

```bash
rsvg-convert -w 256 -h 256 apps/web/public/brand/logo.svg \
  -o apps/web/public/brand/logo-email.png
```

---

## 2. Required environment variables

These are consumed by the **Supabase CLI** (local) via `env(...)` interpolation in
`config.toml`. They are **not** `NEXT_PUBLIC_*` and must never reach the browser,
`apps/web`, or `apps/api`.

| Variable | Example | Purpose |
|---|---|---|
| `SUPABASE_AUTH_SMTP_PASS` | `re_xxxxxxxx…` | Resend API key, used as the SMTP password. **Secret.** |
| `SUPABASE_AUTH_SITE_URL` | `http://localhost:3000` (local) / `https://www.tomo-srs.com` (prod) | Canonical site URL for the auth redirect allow-list. |

Put them in the **gitignored project-root `.env`** (the repo `.gitignore` already
ignores `.env` / `.env.*`):

```dotenv
# .env  (project root — gitignored, read by `supabase start`)
SUPABASE_AUTH_SMTP_PASS=re_your_resend_api_key
SUPABASE_AUTH_SITE_URL=http://localhost:3000
```

---

## 3. Local development setup

1. **Create a Resend account** and an **API key** (Resend dashboard → API Keys).
   For local testing you do not need a verified domain — see step 4 for the
   no-send option.
2. Add `SUPABASE_AUTH_SMTP_PASS` and `SUPABASE_AUTH_SITE_URL` to the project-root
   `.env` (above).
3. Restart the stack so the CLI re-reads `config.toml` + env:
   ```bash
   supabase stop && supabase start    # or: supabase db reset
   ```
   If the CLI reports a config schema error, your CLI may be older than the
   `[auth.email.smtp]` / `[auth.email.template.*]` keys — upgrade with
   `npm install -g supabase`.
4. **Two ways to test locally:**
   - **Inbucket (default, no real send):** leave SMTP disabled by simply *not*
     setting the env var — or keep it set but inspect captured mail at
     <http://localhost:54324>. Inbucket shows the rendered HTML and the
     auto-generated plain-text part. Best for fast template iteration.
   - **Real send via Resend:** with a verified Resend domain and the API key set,
     GoTrue will actually deliver. Use a real inbox to confirm deliverability.

---

## 4. Production setup (hosted project)

The version-controlled `config.toml` is the source of truth for **local**. The
hosted project is configured in the dashboard (mirror the same values):

1. **Authentication → SMTP Settings** (Enable Custom SMTP):
   - Host `smtp.resend.com`, Port `465`, Username `resend`,
     Password = Resend API key, Sender `noreply@tomo-srs.com`, Sender name `Tomo`.
2. **Authentication → Email Templates** — paste each file's HTML and subject:
   | Template | Subject | Source file |
   |---|---|---|
   | Confirm signup | `Confirm your Tomo account` | `supabase/templates/confirmation.html` |
   | Reset password | `Reset your Tomo password` | `supabase/templates/recovery.html` |
   | Change email address | `Confirm your new Tomo email` | `supabase/templates/email_change.html` |
3. **Authentication → URL Configuration** — set Site URL to
   `https://www.tomo-srs.com` and add it to the redirect allow-list.
4. **Authentication → Providers → Email** — confirm "Confirm email" is on and OTP
   length/expiry match (`6` / `60s`).

> If your Supabase CLI version supports `supabase config push`, you can sync the
> `[auth.*]` blocks from `config.toml` to the linked project instead of pasting
> by hand. Verify the result in the dashboard either way — the dashboard remains
> the authoritative prod surface.

---

## 5. Plain-text reference copy

Supabase/GoTrue templates are **HTML-only**; GoTrue auto-derives the `text/plain`
multipart part by stripping the HTML, so we can't ship separate `.txt` files. The
HTML is kept linear so that derived text reads cleanly. For reference, the
plain-text equivalent of each email is:

**Confirmation**
```
Welcome to Tomo.

You're all set to begin. Enter this code in the app to confirm your
account and start practicing:

  {{ .Token }}

Expires in 1 minute. If you didn't create a Tomo account, you can
ignore this email. Nothing will happen.

Tomo, Japanese spaced repetition
```

**Password reset**
```
Reset your password.

Enter this code in the app to confirm it's you, then choose a new password:

  {{ .Token }}

Expires in 1 minute. If you didn't ask for this, ignore this email.
Your password stays the same.

Tomo, Japanese spaced repetition
```

**Email change**
```
Confirm your new email.

Enter this code in the app to switch your Tomo account email
to {{ .NewEmail }}:

  {{ .Token }}

Expires in 1 minute. If you didn't request this, ignore this message
and consider updating your password.

Tomo, Japanese spaced repetition
```

---

## 6. Testing the full flow

1. **Config parses:** `supabase stop && supabase start` with no schema error.
2. **Render + branding:** trigger each flow against local Supabase and inspect in
   Inbucket (<http://localhost:54324>):
   - Signup — web app or `apps/web/dev/panels/auth-signup.tsx`.
   - Password reset — `/forgot-password`.
   - Email change — from account settings (or a `supabase` admin call).
   Confirm the **6-digit `{{ .Token }}` renders**, subjects are correct, and the
   auto-generated plain-text part is readable.
3. **Regression gate (most important):** type the emailed code into the verify UI.
   `verifyOtp({ type: "signup" | "recovery" })` must succeed and establish a
   session. This proves the templates didn't break auth.
4. **Cross-client:** run each template through Litmus / Email on Acid /
   <https://www.mail-tester.com> for Gmail, Outlook, Apple Mail, and dark mode.
   Confirm the layout holds when `@import` fonts are stripped (system fallback
   stacks take over).
5. **Production smoke test:** after dashboard config, send a real signup to a
   Gmail *and* an Outlook address; confirm inbox placement (not spam).

---

## 7. Security & deliverability checklist

- [ ] **Verified sending domain** in Resend for `tomo-srs.com` (not the shared
      `onboarding@resend.dev`).
- [ ] **SPF** — TXT record includes `include:_spf.resend.com`.
- [ ] **DKIM** — Resend-provided CNAME records added and verified.
- [ ] **DMARC** — `v=DMARC1; p=quarantine; rua=mailto:dmarc@tomo-srs.com`, then
      tighten to `p=reject` once reports look clean.
- [ ] **Dedicated from-address** `noreply@tomo-srs.com` with a monitored
      `reply-to` (or a clear "send-only" note, as the footer states).
- [ ] **OTP hardening** — `otp_expiry = 60`, `max_frequency = "60s"` in
      `config.toml` (and mirrored in the dashboard).
- [ ] **Logo reachable** — `https://www.tomo-srs.com/brand/logo-email.png`
      returns 200 over HTTPS (deploy the web app first); confirm it renders in a
      real client, not just Inbucket.
- [ ] **No secrets in the repo or client** — `SUPABASE_AUTH_SMTP_PASS` lives only
      in the gitignored `.env` (local) and the hosted dashboard (prod). It is
      never a `NEXT_PUBLIC_*` var and never in `apps/api/.env`.
- [ ] **Account-enumeration stance preserved** — password reset resolves the same
      way for unknown addresses (see `requestPasswordResetAction`); don't surface
      "no such account".
- [ ] **End-to-end tested** — signup, reset, and email-change all complete after
      the template change.
- [ ] **Spam-score pass** — `mail-tester.com` score ≥ 9/10 and SPF/DKIM/DMARC all
      report `pass` in "show original" headers.

---

*Templates and tokens mirror [docs/DESIGN.md](./DESIGN.md). Update the design doc
first, then the templates, so brand truth stays in one place.*
