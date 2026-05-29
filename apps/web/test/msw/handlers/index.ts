/**
 * Combined MSW handler barrel.
 *
 * `defaultHandlers` is the flat array spread into `setupServer(...)` — it
 * concatenates the per-resource defaults so every common endpoint has a
 * happy-path interceptor without each test having to register one.
 *
 * Named helpers stay on the per-resource modules so import sites read as
 * `import { mockLoginInvalidCredentials } from "@/test/msw/handlers/auth"`
 * — explicit about which resource is being overridden.
 */

import authHandlers from "./auth";
import cardsHandlers from "./cards";
import decksHandlers from "./decks";
import insightsHandlers from "./insights";
import reviewsHandlers from "./reviews";

export const defaultHandlers = [
	...authHandlers,
	...decksHandlers,
	...cardsHandlers,
	...reviewsHandlers,
	...insightsHandlers,
];

export {
	mockChangePasswordSuccess,
	mockChangePasswordWrongCurrent,
	mockDeleteAccountSuccess,
	mockLoginInvalidCredentials,
	mockLoginSuccess,
	mockLogoutSuccess,
	mockProfileSuccess,
	mockProfileUnauthorized,
	mockResendOtpSuccess,
	mockSignupDuplicateEmail,
	mockSignupSuccess,
	mockVerifyOtpInvalid,
	mockVerifyOtpSuccess,
} from "./auth";

export {
	mockCreateCardRateLimited,
	mockCreateCardSuccess,
	mockDeleteCardSuccess,
	mockGetCardNotFound,
	mockGetCardSuccess,
	mockListCrossDeckCardsEmpty,
	mockListCrossDeckCardsSuccess,
	mockListDeckCardsSuccess,
	mockUpdateCardConflict,
	mockUpdateCardSuccess,
} from "./cards";

export {
	mockCreateDeckSuccess,
	mockDeleteDeckSuccess,
	mockGetDeckNotFound,
	mockGetDeckSuccess,
	mockListDecksEmpty,
	mockListDecksSuccess,
	mockListPremadeDecksSuccess,
	mockUpdateDeckConflict,
	mockUpdateDeckSuccess,
} from "./decks";

export {
	mockDistributionsSuccess,
	mockForecastEmpty,
	mockForecastSuccess,
	mockMaturityHistoryEmpty,
	mockMaturityHistorySuccess,
	mockStatisticsSuccess,
} from "./insights";

export {
	mockDayReflectionSuccess,
	mockDueQueueEmpty,
	mockDueQueueSuccess,
	mockRatingsPreviewSuccess,
	mockSessionSummaryNotFound,
	mockSessionSummarySuccess,
	mockSubmitReviewServerError,
	mockSubmitReviewSuccess,
} from "./reviews";
