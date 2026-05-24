// Public surface for the dev dock. Pages register state panels through these
// two hooks; the dock and the launcher are mounted once via `DevDockProvider`
// in the root layout.

export { DevDockProvider } from './DevDockProvider'
export { useDevStatePanel, useDevPanel } from './useDevStatePanel'
export type {
  UseDevStatePanelOptions,
  UseDevStatePanelResult,
  UseDevPanelOptions,
} from './useDevStatePanel'
export type { DevFixtureSpec } from './DevDockContext'
