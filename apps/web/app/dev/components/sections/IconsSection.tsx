import { ArrowGlyph } from "@/components/icons/arrow-glyph";
import { CramMark, DrillMark } from "@/components/icons/dashboard-marks";
import {
	BookOpen,
	Briefcase,
	CheckMark,
	PaceIntensive,
	PaceLight,
	PaceSteady,
	SpeechBubble,
	ToriiGate,
} from "@/components/icons/study-marks";
import { ShowcaseGrid, ShowcaseItem } from "../_components/ShowcaseItem";
import { ShowcaseSection } from "../_components/ShowcaseSection";

const ICON_CLASS = "h-8 w-8 text-sumi-ink";

export function IconsSection(): React.JSX.Element {
	return (
		<ShowcaseSection
			id="icons"
			title="Icons"
			description="Hairline line-art glyphs (stroke 1.25, currentColor)."
		>
			<ShowcaseGrid minColumnWidth={160}>
				<ShowcaseItem label="ArrowGlyph (left)" caption='direction="left"'>
					<ArrowGlyph direction="left" className={ICON_CLASS} />
				</ShowcaseItem>
				<ShowcaseItem label="ArrowGlyph (right)" caption='direction="right"'>
					<ArrowGlyph direction="right" className={ICON_CLASS} />
				</ShowcaseItem>
				<ShowcaseItem label="CheckMark" caption="animate={false}">
					<CheckMark className={ICON_CLASS} animate={false} />
				</ShowcaseItem>
				<ShowcaseItem label="ToriiGate" caption=""><ToriiGate className={ICON_CLASS} /></ShowcaseItem>
				<ShowcaseItem label="SpeechBubble" caption=""><SpeechBubble className={ICON_CLASS} /></ShowcaseItem>
				<ShowcaseItem label="BookOpen" caption=""><BookOpen className={ICON_CLASS} /></ShowcaseItem>
				<ShowcaseItem label="Briefcase" caption=""><Briefcase className={ICON_CLASS} /></ShowcaseItem>
				<ShowcaseItem label="PaceLight" caption=""><PaceLight className={ICON_CLASS} /></ShowcaseItem>
				<ShowcaseItem label="PaceSteady" caption=""><PaceSteady className={ICON_CLASS} /></ShowcaseItem>
				<ShowcaseItem label="PaceIntensive" caption=""><PaceIntensive className={ICON_CLASS} /></ShowcaseItem>
				<ShowcaseItem label="DrillMark" caption=""><DrillMark className={ICON_CLASS} /></ShowcaseItem>
				<ShowcaseItem label="CramMark" caption=""><CramMark className={ICON_CLASS} /></ShowcaseItem>
			</ShowcaseGrid>
		</ShowcaseSection>
	);
}
