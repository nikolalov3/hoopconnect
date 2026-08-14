/**
 * Card customization catalog helpers (backgrounds).
 *
 * - loadBackgroundCatalog / useBackgroundCatalog: the active background items
 *   from `card_items` (readable by everyone via RLS). Cached across the app.
 * - backgroundAsset: resolve an equipped background id -> asset_path for render.
 * - useOwnedBackgrounds: the items a user may equip (everyone's defaults + their
 *   own user_unlocks rows).
 * - redeemCode: call the redeem_code() RPC (grants an item from a code).
 *
 * Frames still come from lib/frames.js (equipped_frame) — unchanged.
 */
import { useState, useEffect } from 'react'
import { supabase } from './supabase'

let _catalogPromise = null

export function loadBackgroundCatalog() {
  if (!_catalogPromise) {
    _catalogPromise = supabase
      .from('card_items')
      .select('id,name,asset_path,rarity,is_default,sort')
      .eq('type', 'background').eq('active', true)
      .order('sort', { ascending: true })
      .then(r => r.data || [])
      // Table may not exist yet (migration not run) — degrade to no backgrounds.
      .catch(() => [])
  }
  return _catalogPromise
}

export function useBackgroundCatalog() {
  const [items, setItems] = useState([])
  useEffect(() => {
    let cancelled = false
    loadBackgroundCatalog().then(d => { if (!cancelled) setItems(d) })
    return () => { cancelled = true }
  }, [])
  return items
}

// asset_path for an equipped background id (null-safe).
export function backgroundAsset(catalog, id) {
  if (!id) return null
  return catalog.find(i => i.id === id)?.asset_path ?? null
}

// Background items a user may equip: catalog defaults + their unlocks.
export function useOwnedBackgrounds(userId, catalog) {
  const [ownedIds, setOwnedIds] = useState([])
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    if (!userId) { setOwnedIds([]); return }
    let cancelled = false
    supabase.from('user_unlocks').select('item_id').eq('user_id', userId)
      .then(r => { if (!cancelled) setOwnedIds((r.data || []).map(x => x.item_id)) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [userId, reloadKey])

  const owned = catalog.filter(i => i.is_default || ownedIds.includes(i.id))
  return { owned, reload: () => setReloadKey(k => k + 1) }
}

export async function redeemCode(code) {
  const { data, error } = await supabase.rpc('redeem_code', { p_code: (code || '').trim() })
  if (error) throw error
  return data  // [{ item_id, item_type, item_name }]
}
