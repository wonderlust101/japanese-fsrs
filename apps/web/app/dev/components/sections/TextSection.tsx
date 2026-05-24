import { FuriganaText }            from '@/components/ui/FuriganaText'
import { Logo }                    from '@/components/ui/Logo'
import { ShowcaseGrid, ShowcaseItem } from '../_components/ShowcaseItem'
import { ShowcaseSection }            from '../_components/ShowcaseSection'

const WORDMARK_SIZES = ['sm', 'md', 'lg', 'xl'] as const

export function TextSection(): React.JSX.Element {
  return (
    <ShowcaseSection
      id="text"
      title="Text + brand marks"
      description="FuriganaText (Japanese reading annotations) and the Logo / wordmark composition."
    >
      <div>
        <h3 className="text-xs text-faded-sumi mb-3">FuriganaText</h3>
        <ShowcaseGrid minColumnWidth={240}>
          <ShowcaseItem label="Single word" caption='text="日本語" reading="にほんご"'>
            <FuriganaText text="日本語" reading="にほんご" className="text-2xl" />
          </ShowcaseItem>
          <ShowcaseItem label="Verb" caption='text="食べる" reading="たべる"'>
            <FuriganaText text="食べる" reading="たべる" className="text-2xl" />
          </ShowcaseItem>
          <ShowcaseItem label="Compound" caption='text="勉強する" reading="べんきょうする"'>
            <FuriganaText text="勉強する" reading="べんきょうする" className="text-2xl" />
          </ShowcaseItem>
        </ShowcaseGrid>
      </div>

      <div>
        <h3 className="text-xs text-faded-sumi mb-3">Logo</h3>
        <ShowcaseGrid minColumnWidth={260}>
          {WORDMARK_SIZES.map(wordmarkSize => (
            <ShowcaseItem
              key={wordmarkSize}
              label={`wordmark / ${wordmarkSize}`}
              caption={`wordmarkSize="${wordmarkSize}"`}
            >
              <Logo wordmarkSize={wordmarkSize} />
            </ShowcaseItem>
          ))}
          <ShowcaseItem label="No wordmark" caption='showWordmark={false}'>
            <Logo showWordmark={false} />
          </ShowcaseItem>
          <ShowcaseItem label="Inverted" caption='tone="inverted"'>
            <div className="bg-inari-vermillion p-4 rounded-xs">
              <Logo tone="inverted" />
            </div>
          </ShowcaseItem>
        </ShowcaseGrid>
      </div>
    </ShowcaseSection>
  )
}
