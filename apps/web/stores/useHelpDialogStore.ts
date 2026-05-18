import { create } from 'zustand'

interface HelpDialogState {
  open: boolean
  actions: {
    openHelp:  () => void
    closeHelp: () => void
  }
}

const useHelpDialogStore = create<HelpDialogState>((set) => ({
  open: false,
  actions: {
    openHelp:  () => set({ open: true }),
    closeHelp: () => set({ open: false }),
  },
}))

export const useHelpDialogOpen = (): boolean =>
  useHelpDialogStore((s) => s.open)

export const useHelpDialogActions = (): HelpDialogState['actions'] =>
  useHelpDialogStore((s) => s.actions)
