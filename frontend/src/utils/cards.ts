// PyPokerEngine card format: SuitRank — e.g. "HA" = Ace of Hearts, "CT" = Ten of Clubs

const RANK_DISPLAY: Record<string, string> = { T: '10' }
const SUIT_SYMBOL: Record<string, string> = { h: '♥', d: '♦', s: '♠', c: '♣' }
const SUIT_COLOR_RED = '#e05c5c'
const SUIT_COLOR_BLACK = '#c8d0e0'

export interface ParsedCard {
  suit: string       // lowercase: h d s c
  rank: string       // display rank: A K Q J 10 9...2
  symbol: string     // ♥ ♦ ♠ ♣
  color: string      // red or black
}

export function parseCard(code: string): ParsedCard {
  const suit = code[0].toLowerCase()
  const rawRank = code.slice(1)
  const rank = RANK_DISPLAY[rawRank] ?? rawRank
  const symbol = SUIT_SYMBOL[suit] ?? suit
  const color = ['h', 'd'].includes(suit) ? SUIT_COLOR_RED : SUIT_COLOR_BLACK
  return { suit, rank, symbol, color }
}
