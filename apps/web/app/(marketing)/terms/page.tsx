import type { Metadata } from 'next'

import { LegalP, LegalSection, LegalShell } from '../_components/legal'
import type { TocEntry } from '../_components/marketing-doc'

export const metadata: Metadata = {
  title: 'Terms of Service',
  description:
    'The terms that govern your use of Tomo: your account, acceptable use, ownership of the cards and words you add, AI-generated content, disclaimers, and dispute resolution.',
  alternates: { canonical: '/terms' },
}

const TOC: readonly TocEntry[] = [
  { id: 'service', label: 'The service' },
  { id: 'eligibility', label: 'Eligibility and account' },
  { id: 'acceptable-use', label: 'Acceptable use' },
  { id: 'your-content', label: 'Your content' },
  { id: 'generated', label: 'AI-generated content' },
  { id: 'tomo-content', label: 'Tomo content and brand' },
  { id: 'disclaimers', label: 'Disclaimers' },
  { id: 'liability', label: 'Limitation of liability' },
  { id: 'indemnification', label: 'Indemnification' },
  { id: 'termination', label: 'Termination' },
  { id: 'governing-law', label: 'Governing law and disputes' },
  { id: 'changes', label: 'Changes' },
  { id: 'misc', label: 'Miscellaneous' },
]

export default function TermsPage(): React.JSX.Element {
  return (
    <LegalShell
      title="Terms of Service"
      updated="May 25, 2026"
      kanji="約"
      toc={TOC}
      intro="These terms govern your use of Tomo. By creating an account or using the service, you agree to them and to our Privacy Policy."
    >
      <LegalSection id="service" heading="The service">
        <LegalP>
          Tomo is a spaced-repetition app for Japanese learners. We are actively developing it, so
          features may change, and the service is provided on an as-is basis. These terms, together with
          our Privacy Policy, form the agreement between you and Tomo for your use of the service.
        </LegalP>
      </LegalSection>

      <LegalSection id="eligibility" heading="Eligibility and account">
        <LegalP>
          You must be old enough to form a binding contract in your jurisdiction to use Tomo. You are
          responsible for the activity under your account and for keeping your credentials secure. Please
          provide accurate information when you sign up and keep it current, and tell us promptly if you
          suspect unauthorized use of your account.
        </LegalP>
      </LegalSection>

      <LegalSection id="acceptable-use" heading="Acceptable use">
        <LegalP>
          Use Tomo for your own Japanese study. You agree not to disrupt or overload the service, abuse
          the card-generation features through automation or scraping, reverse-engineer the product,
          infringe anyone’s intellectual property, upload unlawful or harmful content, or attempt to
          access accounts or systems you are not authorized to use.
        </LegalP>
      </LegalSection>

      <LegalSection id="your-content" heading="Your content">
        <LegalP>
          You keep ownership of the cards and words you add. You grant Tomo a limited, worldwide,
          non-exclusive license to host, store, and process that content, including sending it to our
          service providers, solely to generate your study material and run your review schedule. You
          represent that you have the rights necessary to submit the content you add.
        </LegalP>
      </LegalSection>

      <LegalSection id="generated" heading="AI-generated content">
        <LegalP>
          Tomo produces readings, example sentences, mnemonics, and weak-spot guidance using automated
          systems. Generated content can be inaccurate or incomplete, so review it before relying on it,
          especially for exams or other consequential purposes. You are responsible for what you keep and
          study, and Tomo is not liable for reliance on generated content.
        </LegalP>
      </LegalSection>

      <LegalSection id="tomo-content" heading="Tomo content and brand">
        <LegalP>
          Premade decks and other Tomo-provided material are made available for your personal study and
          remain ours or our licensors’. The Tomo name and the kitsune brand mark belong to Tomo and may
          not be used without permission.
        </LegalP>
      </LegalSection>

      <LegalSection id="disclaimers" heading="Disclaimers">
        <LegalP>
          Tomo is provided “as is” and “as available,” without warranties of any kind, whether express or
          implied, including any implied warranties of merchantability, fitness for a particular purpose,
          and non-infringement. We do not guarantee specific learning outcomes, uninterrupted
          availability, or that the service will be error-free.
        </LegalP>
      </LegalSection>

      <LegalSection id="liability" heading="Limitation of liability">
        <LegalP>
          To the maximum extent permitted by law, Tomo will not be liable for any indirect, incidental,
          special, consequential, or punitive damages, or for any loss of data, goodwill, or profits,
          arising from your use of the service. To the extent liability cannot be excluded, our total
          liability is limited to the amount you paid us for the service in the twelve months before the
          claim or, where you paid nothing, the smallest amount permitted by applicable law.
        </LegalP>
      </LegalSection>

      <LegalSection id="indemnification" heading="Indemnification">
        <LegalP>
          You agree to indemnify and hold Tomo harmless from claims, damages, and reasonable expenses
          arising out of the content you submit, your use of the service, or your violation of these
          terms or of any law or third-party right.
        </LegalP>
      </LegalSection>

      <LegalSection id="termination" heading="Termination">
        <LegalP>
          You may stop using Tomo and delete your account at any time. We may suspend or terminate access
          if these terms are violated or to protect the service or its users. On termination, your right
          to use the service ends; provisions that by their nature should survive (such as content
          licenses you granted, disclaimers, limitation of liability, and indemnification) will survive.
        </LegalP>
      </LegalSection>

      <LegalSection id="governing-law" heading="Governing law and disputes">
        <LegalP>
          These terms are governed by the laws of [your governing jurisdiction], without regard to its
          conflict-of-laws rules, and you and Tomo submit to the exclusive jurisdiction of the courts
          located there. Before filing a claim, you agree to contact us so we can try to resolve it
          informally; most concerns can be settled that way.
        </LegalP>
      </LegalSection>

      <LegalSection id="changes" heading="Changes to these terms">
        <LegalP>
          We may update these terms from time to time. When we do, we will revise the date above and, for
          material changes, provide a more prominent notice. Continuing to use Tomo after changes take
          effect means you accept the updated terms.
        </LegalP>
      </LegalSection>

      <LegalSection id="misc" heading="Miscellaneous">
        <LegalP>
          These terms and the Privacy Policy are the entire agreement between you and Tomo regarding the
          service. If any provision is found unenforceable, the rest stay in effect. Our failure to
          enforce a provision is not a waiver of it. You may not assign these terms without our consent;
          we may assign them in connection with a merger, acquisition, or sale of assets.
        </LegalP>
      </LegalSection>
    </LegalShell>
  )
}
