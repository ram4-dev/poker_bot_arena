import api from './client'

export interface WalletInfo {
  balance: number
  locked_balance: number
  total: number
  can_rescue: boolean
}

export interface LedgerEntry {
  id: string
  type: string
  amount: number
  balance_after: number
  description: string | null
  created_at: string
}

export interface LedgerResponse {
  items: LedgerEntry[]
  total: number
  pages: number
  page: number
}

const PAGE_SIZE = 20

export const walletApi = {
  get: () =>
    api.get<any>('/wallet').then(r => ({
      ...r,
      data: { ...r.data, can_rescue: r.data.can_rescue ?? false } as WalletInfo,
    })),

  ledger: (page = 1) =>
    api.get<any>(`/wallet/ledger?offset=${(page - 1) * PAGE_SIZE}&limit=${PAGE_SIZE}`).then(r => ({
      ...r,
      data: {
        items: r.data.items,
        total: r.data.total,
        pages: Math.max(1, Math.ceil(r.data.total / PAGE_SIZE)),
        page,
      } as LedgerResponse,
    })),

  rescue: () =>
    api.post<any>('/wallet/rescue').then(r => ({ ...r, data: r.data as WalletInfo })),
}
