import { setupServer } from "msw/node";

import { handlers } from "./handlers";

/**
 * MSW Node-side server reused across the test suite.
 *
 * `setupFiles` in `vitest.config.ts` registers the lifecycle (listen / reset /
 * close). Tests append per-case handlers with `server.use(http.get(...))`.
 */
export const server = setupServer(...handlers);
