"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { ShowcaseGrid, ShowcaseItem } from "../_components/ShowcaseItem";
import { ShowcaseSection } from "../_components/ShowcaseSection";

export function DialogSection(): React.JSX.Element {
	const [open, setOpen] = useState(false);

	return (
		<ShowcaseSection
			id="dialog"
			title="Dialog"
			description="Native <dialog> with backdrop close + accessible header."
		>
			<ShowcaseGrid minColumnWidth={280}>
				<ShowcaseItem label="Dialog (interactive)" caption="open / onClose / title" fill>
					<Button onClick={() => setOpen(true)}>Open dialog</Button>
					<Dialog open={open} onClose={() => setOpen(false)} title="Confirm action">
						<div className="flex flex-col gap-4">
							<p className="text-sm text-faded-sumi">
								This is the dialog body. Click the backdrop or the close button to dismiss.
							</p>
							<div className="flex justify-end gap-2">
								<Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
								<Button onClick={() => setOpen(false)}>Confirm</Button>
							</div>
						</div>
					</Dialog>
				</ShowcaseItem>
			</ShowcaseGrid>
		</ShowcaseSection>
	);
}
