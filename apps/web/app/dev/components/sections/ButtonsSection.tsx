import { ArrowGlyph } from "@/components/icons/arrow-glyph";
import { Button } from "@/components/ui/Button";
import { ShowcaseGrid, ShowcaseItem } from "../_components/ShowcaseItem";
import { ShowcaseSection } from "../_components/ShowcaseSection";

const VARIANTS = ["primary", "secondary", "editorial", "ghost", "danger"] as const;
const SIZES = ["sm", "md", "lg"] as const;

export function ButtonsSection(): React.JSX.Element {
	return (
		<ShowcaseSection
			id="buttons"
			title="Button"
			description="Five variants × three sizes, plus loading, disabled, icon-only, and leading/trailing icon states."
		>
			<div>
				<h3 className="text-xs text-faded-sumi mb-3">Variants × sizes</h3>
				<ShowcaseGrid minColumnWidth={200}>
					{VARIANTS.flatMap(variant =>
						SIZES.map(size => (
							<ShowcaseItem
								key={`${variant}-${size}`}
								label={`${variant} / ${size}`}
								caption={`variant="${variant}" size="${size}"`}
							>
								<Button variant={variant} size={size}>
									Continue
								</Button>
							</ShowcaseItem>
						)),
					)}
				</ShowcaseGrid>
			</div>

			<div>
				<h3 className="text-xs text-faded-sumi mb-3">States</h3>
				<ShowcaseGrid minColumnWidth={200}>
					<ShowcaseItem label="Loading" caption="loading">
						<Button loading>Saving</Button>
					</ShowcaseItem>
					<ShowcaseItem label="Disabled" caption="disabled">
						<Button disabled>Continue</Button>
					</ShowcaseItem>
					<ShowcaseItem label="Leading icon" caption='leadingIcon={<ArrowGlyph direction="left" />}'>
						<Button variant="secondary" leadingIcon={<ArrowGlyph direction="left" />}>Back</Button>
					</ShowcaseItem>
					<ShowcaseItem label="Trailing icon" caption='trailingIcon={<ArrowGlyph direction="right" />}'>
						<Button trailingIcon={<ArrowGlyph direction="right" />}>Continue</Button>
					</ShowcaseItem>
					<ShowcaseItem label="Icon only" caption="iconOnly leadingIcon={...}">
						<Button iconOnly leadingIcon={<ArrowGlyph direction="right" />} aria-label="Next" />
					</ShowcaseItem>
				</ShowcaseGrid>
			</div>
		</ShowcaseSection>
	);
}
