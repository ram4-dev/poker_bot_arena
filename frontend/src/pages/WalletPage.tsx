import { useEffect, useState } from 'react'
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts'
import { TrendingUp, Lock, AlertCircle } from 'lucide-react'
import AppShell from '../components/AppShell'
import { walletApi, type WalletInfo, type LedgerEntry } from '../api/wallet'
import { useAuth } from '../context/AuthContext'

const TYPE_LABELS: Record<string, string> = {
  initial_grant: 'Welcome Bonus',
  session_result: 'Session Result',
  daily_rescue: 'Daily Rescue',
  buy_in_lock: 'Buy-in Locked',
  buy_in_unlock: 'Buy-in Unlocked',
}

const TYPE_BADGE: Record<string, string> = {
  initial_grant: 'badge-indigo',
  session_result: 'badge-mint',
  daily_rescue: 'badge-indigo',
  buy_in_lock: 'badge-grey',
  buy_in_unlock: 'badge-grey',
}

export default function WalletPage() {
  const { refreshUser } = useAuth()
  const [wallet, setWallet]       = useState<WalletInfo | null>(null)
  const [ledger, setLedger]       = useState<LedgerEntry[]>([])
  const [page, setPage]           = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [rescuing, setRescuing]   = useState(false)
  const [rescueMsg, setRescueMsg] = useState('')

  const loadWallet = () => walletApi.get().then(r => setWallet(r.data)).catch(() => {})
  const loadLedger = (p: number) => walletApi.ledger(p).then(r => {
    setLedger(r.data.items)
    setTotalPages(r.data.pages)
  }).catch(() => {})

  useEffect(() => { loadWallet(); loadLedger(1) }, [])
  useEffect(() => { loadLedger(page) }, [page])

  const handleRescue = async () => {
    setRescuing(true)
    setRescueMsg('')
    try {
      await walletApi.rescue()
      await loadWallet()
      await refreshUser()
      setRescueMsg('Emergency funds deposited: +500 chips')
      loadLedger(1)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setRescueMsg(msg ?? 'Rescue not available yet')
    } finally {
      setRescuing(false)
    }
  }

  const sparkData = [...ledger].reverse().map(e => ({ balance: e.balance_after }))

  return (
    <AppShell>
      <div style={{ maxWidth: 760 }}>

        {/* Header */}
        <div style={{ marginBottom: 28 }}>
          <div className="label" style={{ marginBottom: 8 }}>Financial Operations</div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 22, color: 'var(--on-surface)', letterSpacing: '-0.02em' }}>
            Digital Wallet
          </h1>
          <p style={{ fontFamily: 'var(--font-display)', fontSize: 13, color: 'var(--on-surface-variant)', marginTop: 4 }}>
            Track your chip balance and transaction history
          </p>
        </div>

        {/* Balance hero */}
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
            <div>
              <div className="label" style={{ marginBottom: 10 }}>Available Balance</div>
              <div style={{
                fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 40,
                color: 'var(--secondary)', letterSpacing: '-0.03em',
                textShadow: '0 0 30px rgba(63,255,160,0.3)',
              }}>
                ♟ {wallet?.balance?.toLocaleString() ?? '—'}
              </div>
              {wallet && wallet.locked_balance > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8 }}>
                  <Lock size={11} style={{ color: 'var(--on-surface-variant)' }} />
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--on-surface-variant)' }}>
                    ♟ {wallet.locked_balance.toLocaleString()} locked in active sessions
                  </span>
                </div>
              )}
            </div>
            <div style={{
              width: 44, height: 44, borderRadius: 4,
              background: 'rgba(63,255,160,0.1)',
              border: '1px solid rgba(63,255,160,0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <TrendingUp size={20} style={{ color: 'var(--secondary)' }} />
            </div>
          </div>

          {sparkData.length > 1 && (
            <div style={{ marginBottom: wallet?.can_rescue ? 16 : 0 }}>
              <ResponsiveContainer width="100%" height={72}>
                <LineChart data={sparkData}>
                  <Line type="monotone" dataKey="balance" stroke="var(--primary-container)" strokeWidth={2} dot={false} />
                  <XAxis hide />
                  <YAxis hide />
                  <Tooltip
                    contentStyle={{ background: 'var(--surface-high)', border: '1px solid var(--outline)', borderRadius: 4, fontSize: 11, fontFamily: 'JetBrains Mono' }}
                    formatter={(v: number) => [`♟ ${v.toLocaleString()}`, 'Balance']}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {wallet?.can_rescue && (
            <div style={{
              paddingTop: 16, borderTop: '1px solid var(--outline-variant)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <AlertCircle size={14} style={{ color: 'var(--tertiary)', flexShrink: 0 }} />
                <div>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: 13, color: 'var(--on-surface)' }}>
                    Emergency rescue available
                  </div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--on-surface-variant)', marginTop: 2 }}>
                    RECEIVE +500 CHIPS
                  </div>
                </div>
              </div>
              <button className="btn-primary" style={{ fontSize: 13, flexShrink: 0 }} onClick={handleRescue} disabled={rescuing}>
                <TrendingUp size={13} />
                {rescuing ? '...' : 'Rescue'}
              </button>
            </div>
          )}

          {rescueMsg && (
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--secondary)', marginTop: 10 }}>{rescueMsg}</p>
          )}
        </div>

        {/* Transaction ledger */}
        <div className="card">
          <div className="label" style={{ marginBottom: 16 }}>Transaction Ledger</div>

          {ledger.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 0' }}>
              <p style={{ fontFamily: 'var(--font-display)', fontSize: 13, color: 'var(--on-surface-variant)' }}>
                No transactions yet
              </p>
            </div>
          ) : (
            <>
              <table className="data-table" style={{ marginBottom: 16 }}>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Type</th>
                    <th>Description</th>
                    <th>Amount</th>
                    <th>Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {ledger.map(e => (
                    <tr key={e.id}>
                      <td style={{ color: 'var(--on-surface-variant)', fontFamily: 'var(--font-mono)', fontSize: 11 }}>
                        {new Date(e.created_at).toLocaleDateString()}
                      </td>
                      <td>
                        <span className={`badge ${TYPE_BADGE[e.type] ?? 'badge-grey'}`}>
                          {TYPE_LABELS[e.type] ?? e.type}
                        </span>
                      </td>
                      <td style={{ color: 'var(--on-surface-variant)', fontSize: 12 }}>
                        {e.description ?? '—'}
                      </td>
                      <td className="text-numeric" style={{ fontWeight: 700, color: e.amount >= 0 ? 'var(--secondary)' : 'var(--tertiary)' }}>
                        {e.amount >= 0 ? '+' : ''}{e.amount.toLocaleString()}
                      </td>
                      <td className="text-numeric" style={{ color: 'var(--on-surface)' }}>
                        ♟ {e.balance_after.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {totalPages > 1 && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
                  <button className="btn-ghost" style={{ fontSize: 12 }}
                    onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
                    ← Prev
                  </button>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--on-surface-variant)' }}>
                    {page} / {totalPages}
                  </span>
                  <button className="btn-ghost" style={{ fontSize: 12 }}
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
                    Next →
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </AppShell>
  )
}
