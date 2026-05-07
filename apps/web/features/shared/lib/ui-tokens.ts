/**
 * ------------------------------------------------------
 * Shared UI Style Tokens
 * ------------------------------------------------------
 */
export const uiTokens = {
  layoutShell:
    'mx-auto flex min-h-screen w-full max-w-5xl flex-col px-4 py-8 text-slate-200 sm:w-[94%] sm:px-0 sm:py-12',
  sectionCard:
    'rounded-2xl border border-slate-700/80 bg-slate-900/70 p-6 backdrop-blur-sm sm:p-9',
  listCardItem:
    'flex flex-col gap-4 rounded-xl border border-slate-700 bg-slate-800/40 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:py-3',
  sectionTitle: 'mt-3 text-4xl font-semibold sm:text-5xl',
  sectionSubtitle: 'mt-2 text-lg text-slate-300 sm:text-xl',
  actionButton:
    'inline-flex h-12 w-full items-center justify-center rounded-xl border border-blue-400 bg-blue-700 px-5 text-base font-semibold text-white shadow-sm shadow-blue-900/40 transition hover:bg-blue-600 disabled:opacity-60 sm:w-auto sm:text-lg',
  totalAmountCard: 'border-emerald-700/60 bg-emerald-950/20',
  totalAmountValue: 'text-emerald-300',
  tableContainer:
    'mt-6 overflow-hidden rounded-xl border border-slate-700 bg-slate-800/30',
  tableText: 'min-w-full text-left text-lg',
  tableMobileRow:
    'mb-3 block border-t border-slate-700/80 p-4 md:mb-0 md:table-row md:p-0',
} as const;

/**
 * ------------------------------------------------------
 * Status Tone Map
 * ------------------------------------------------------
 */
export const statusToneByCode: Record<string, string> = {
  PAID: 'bg-emerald-900/40 text-emerald-300 border border-emerald-700/60',
  FAILED: 'bg-rose-900/40 text-rose-300 border border-rose-700/60',
  CANCELLED: 'bg-rose-900/40 text-rose-300 border border-rose-700/60',
  PROCESSING: 'bg-amber-900/40 text-amber-300 border border-amber-700/60',
  EXPIRED: 'bg-slate-800/60 text-slate-200 border border-slate-600/80',
};

/**
 * ------------------------------------------------------
 * Default Status Tone
 * ------------------------------------------------------
 */
export const defaultStatusTone =
  'bg-slate-800 text-slate-200 border border-slate-600';
