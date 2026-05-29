import { describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen, within } from "@/test/test-utils";

import { formatInterval, RatingBar } from "../RatingBar";

describe("ratingBar", () => {
	describe("structure", () => {
		it("renders a labelled group containing four rating buttons", () => {
			renderWithProviders(<RatingBar onRate={vi.fn()} />);

			const group = screen.getByRole("group", { name: /rate this card/i });
			expect(group).toBeInTheDocument();
			expect(within(group).getAllByRole("button")).toHaveLength(4);
		});

		it("renders Again, Hard, Good, Easy in order", () => {
			renderWithProviders(<RatingBar onRate={vi.fn()} />);

			const buttons = screen.getAllByRole("button");
			// Accessible-name matching: order check uses the visible label, which
			// is the first word of each button's aria-label.
			expect(buttons[0]).toHaveAccessibleName(/^again/i);
			expect(buttons[1]).toHaveAccessibleName(/^hard/i);
			expect(buttons[2]).toHaveAccessibleName(/^good/i);
			expect(buttons[3]).toHaveAccessibleName(/^easy/i);
		});
	});

	describe("a11y", () => {
		it("sets aria-keyshortcuts for each button to its 1–4 mapping", () => {
			renderWithProviders(<RatingBar onRate={vi.fn()} />);

			expect(screen.getByRole("button", { name: /again/i })).toHaveAttribute("aria-keyshortcuts", "1");
			expect(screen.getByRole("button", { name: /hard/i })).toHaveAttribute("aria-keyshortcuts", "2");
			expect(screen.getByRole("button", { name: /good/i })).toHaveAttribute("aria-keyshortcuts", "3");
			expect(screen.getByRole("button", { name: /easy/i })).toHaveAttribute("aria-keyshortcuts", "4");
		});

		it("aria-label without intervals reads as 'Label (press N)'", () => {
			renderWithProviders(<RatingBar onRate={vi.fn()} />);

			expect(screen.getByRole("button", { name: /again/i })).toHaveAccessibleName("Again (press 1)");
			expect(screen.getByRole("button", { name: /easy/i })).toHaveAccessibleName("Easy (press 4)");
		});

		it("aria-label with intervals appends 'Next review approximately X.'", () => {
			renderWithProviders(
				<RatingBar
					onRate={vi.fn()}
					nextIntervals={{ again: "<10m", hard: "1d", good: "3d", easy: "1w" }}
				/>,
			);

			expect(screen.getByRole("button", { name: /again/i })).toHaveAccessibleName(
				"Again (press 1). Next review approximately <10m.",
			);
			expect(screen.getByRole("button", { name: /good/i })).toHaveAccessibleName(
				"Good (press 3). Next review approximately 3d.",
			);
		});
	});

	describe("interaction", () => {
		it("calls onRate with the correct value for each button", async () => {
			const onRate = vi.fn();
			const { user } = renderWithProviders(<RatingBar onRate={onRate} />);

			await user.click(screen.getByRole("button", { name: /again/i }));
			await user.click(screen.getByRole("button", { name: /hard/i }));
			await user.click(screen.getByRole("button", { name: /good/i }));
			await user.click(screen.getByRole("button", { name: /easy/i }));

			expect(onRate).toHaveBeenNthCalledWith(1, "again");
			expect(onRate).toHaveBeenNthCalledWith(2, "hard");
			expect(onRate).toHaveBeenNthCalledWith(3, "good");
			expect(onRate).toHaveBeenNthCalledWith(4, "easy");
		});
	});

	describe("interval row", () => {
		it("is hidden from assistive tech when present", () => {
			const { container } = renderWithProviders(
				<RatingBar
					onRate={vi.fn()}
					nextIntervals={{ again: "<10m", hard: "1d", good: "3d", easy: "1w" }}
				/>,
			);

			// Scope the selector to `div[aria-hidden]` because each button also
			// contains an `aria-hidden` SVG icon. We care about the interval-row
			// wrapper specifically — SR users get the interval through each
			// button's aria-label, avoiding duplicate announcements.
			const hidden = container.querySelector("div[aria-hidden=\"true\"]");
			expect(hidden).not.toBeNull();
			expect(hidden?.textContent ?? "").toMatch(/<10m/);
			expect(hidden?.textContent ?? "").toMatch(/~1d/); // framed with ~
			expect(hidden?.textContent ?? "").toMatch(/~3d/);
			expect(hidden?.textContent ?? "").toMatch(/~1w/);
		});

		it("is not rendered when nextIntervals is absent", () => {
			const { container } = renderWithProviders(<RatingBar onRate={vi.fn()} />);
			// Same scoping rationale as above — SVG icons are aria-hidden too.
			expect(container.querySelector("div[aria-hidden=\"true\"]")).toBeNull();
		});

		it("does not double-prefix intervals that already lead with <, ~, >, or ≈", () => {
			const { container } = renderWithProviders(
				<RatingBar
					onRate={vi.fn()}
					nextIntervals={{ again: "<10m", hard: "~2d", good: ">5d", easy: "≈1mo" }}
				/>,
			);

			const text = container.querySelector("div[aria-hidden=\"true\"]")?.textContent ?? "";
			// Each interval is rendered exactly once; no extra `~` prepended.
			expect(text).toContain("<10m");
			expect(text).not.toContain("~<");
			expect(text).toContain("~2d");
			expect(text).not.toContain("~~");
			expect(text).toContain(">5d");
			expect(text).toContain("≈1mo");
		});
	});
});

describe("formatInterval", () => {
	it("returns '<1m' for sub-minute values", () => {
		expect(formatInterval(0)).toBe("<1m");
		expect(formatInterval(0.0001)).toBe("<1m"); // ~8.6 seconds
	});

	it("formats minutes for [1m, 1h)", () => {
		expect(formatInterval(1 / 1440)).toBe("1m");
		expect(formatInterval(30 / 1440)).toBe("30m");
		expect(formatInterval(59 / 1440)).toBe("59m");
	});

	it("formats hours for [1h, 24h)", () => {
		expect(formatInterval(1 / 24)).toBe("1h");
		expect(formatInterval(12 / 24)).toBe("12h");
		expect(formatInterval(23 / 24)).toBe("23h");
	});

	it("formats days for [1d, 30d)", () => {
		expect(formatInterval(1)).toBe("1d");
		expect(formatInterval(7)).toBe("7d");
		expect(formatInterval(29)).toBe("29d");
	});

	it("formats months for [30d, 365d)", () => {
		expect(formatInterval(30)).toBe("1mo");
		expect(formatInterval(90)).toBe("3mo");
		expect(formatInterval(364)).toBe("12mo");
	});

	it("formats years for 365d+", () => {
		expect(formatInterval(365)).toBe("1.0y");
		expect(formatInterval(730)).toBe("2.0y");
		expect(formatInterval(1825)).toBe("5.0y");
	});

	it("rounds, not truncates, when collapsing units", () => {
		// 11 days rounds DOWN to 11d (still in day band, no rounding needed)
		expect(formatInterval(11)).toBe("11d");
		// 45 days is in months band → 45/30 = 1.5 → rounds to 2mo
		expect(formatInterval(45)).toBe("2mo");
		// 547.5 days → 1.5y → formatted with one decimal
		expect(formatInterval(547.5)).toBe("1.5y");
	});
});
