import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { supabase, logActivity } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

/* ============================
   Enhanced activity logging (with old/new values + context)
   ============================ */
export const logEnhanced = async (action, prospectId, opts = {}) => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from('activity_logs').insert([{
      user_id: user.id, action, prospect_id: prospectId || null,
      old_value: opts.old || null, new_value: opts.new || null,
      context: opts.ctx || {}
    }]);
  } catch(e) {}
};

/* ============================
   Transform prospect from RPC
   ============================ */
function transformProspect(p) {
  if (!p) return p;
  const a = p.assignments || [];
  return { ...p, assignedUsers: a.map(x => x.profile).filter(Boolean), assignedUserIds: a.map(x => x.user_id).filter(Boolean) };
}

/* ============================
   HOOK: useProspects
   ============================ */
const __DEV__ = import.meta.env.DEV;
const log = (...args) => { if (__DEV__) console.log('[CRM]', ...args); };
const warn = (...args) => { if (__DEV__) console.warn('[CRM]', ...args); };

export function useProspects() {
  const [prospects, setProspects] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { profile, isAdmin } = useAuth();
  const [params, setParams] = useState({
    search: '', productIds: [], categoryIds: [], statusIds: [],
    installerIds: [], userIds: [], sourceIds: [], unassigned: false, noProduct: false,
    noInstaller: false, dateFrom: null, dateTo: null,
    clientFilter: 'all', // 'all' | 'client' | 'prospect'
    transmisFilter: 'all', // 'all' | 'oui' | 'non'
    sortCol: 'updated_at', sortDir: 'desc', page: 1, perPage: 50
  });
  const debounceRef = useRef(null);
  const rpcWorksRef = useRef(true);
  const initialLoadDone = useRef(false); // Only show spinner on first load

  /* --- FALLBACK: direct query when RPC doesn't exist --- */
  const fetchDirect = useCallback(async (p) => {
    log('Using DIRECT query (RPC unavailable)');
    let query = supabase.from('prospects')
      .select(`*, category:categories(*), status:statuses(*), product:products(*), installer:installers(*), source:sources(*)`, { count: 'exact' })
      .order(p.sortCol || 'updated_at', { ascending: p.sortDir === 'asc' })
      .range((p.page - 1) * p.perPage, p.page * p.perPage - 1);

    if (p.search) {
      if (p.search.startsWith('#')) {
        const num = p.search.slice(1);
        query = query.eq('prospect_number', parseInt(num));
      } else {
        query = query.or(`company_name.ilike.%${p.search}%,last_name.ilike.%${p.search}%,first_name.ilike.%${p.search}%,phone.ilike.%${p.search}%,city.ilike.%${p.search}%,email.ilike.%${p.search}%`);
      }
    }
    if (p.productIds.length > 0) {
      const ids = p.productIds.filter(x => x !== 'none');
      const hasNone = p.productIds.includes('none');
      if (ids.length > 0 && hasNone) {
        query = query.or(`product_id.in.(${ids.join(',')}),product_id.is.null`);
      } else if (ids.length > 0) {
        query = query.in('product_id', ids);
      } else if (hasNone) {
        query = query.is('product_id', null);
      }
    }
    if (p.categoryIds.length > 0) query = query.in('category_id', p.categoryIds);
    if (p.statusIds.length > 0) query = query.in('status_id', p.statusIds);
    if (p.installerIds.length > 0) {
      const ids = p.installerIds.filter(x => x !== 'none');
      const hasNone = p.installerIds.includes('none');
      if (ids.length > 0 && hasNone) {
        query = query.or(`installer_id.in.(${ids.join(',')}),installer_id.is.null`);
      } else if (ids.length > 0) {
        query = query.in('installer_id', ids);
      } else if (hasNone) {
        query = query.is('installer_id', null);
      }
    }
    if (p.clientFilter === 'client') query = query.eq('is_client', true);
    if (p.clientFilter === 'prospect') query = query.eq('is_client', false);
    if (p.transmisFilter === 'oui') query = query.eq('transmis_installateur', true);
    if (p.transmisFilter === 'non') query = query.eq('transmis_installateur', false);
    if (p.dateFrom) query = query.gte('created_at', p.dateFrom);
    if (p.dateTo) query = query.lte('created_at', p.dateTo);
    if (p.sourceIds?.length > 0) {
      const ids = p.sourceIds.filter(x => x !== 'none');
      const hasNone = p.sourceIds.includes('none');
      if (ids.length > 0 && hasNone) {
        query = query.or(`source_id.in.(${ids.join(',')}),source_id.is.null`);
      } else if (ids.length > 0) {
        query = query.in('source_id', ids);
      } else if (hasNone) {
        query = query.is('source_id', null);
      }
    }

    const { data, error: qErr, count } = await query;
    if (qErr) throw qErr;

    // For direct queries, build a simpler transform
    const rows = (data || []).map(row => ({
      ...row,
      assignments: [],
      assignedUsers: [],
      assignedUserIds: []
    }));

    // Try to get assignments for these prospects
    if (rows.length > 0) {
      const ids = rows.map(r => r.id);
      const { data: assigns } = await supabase.from('prospect_assignments')
        .select('prospect_id, user_id, profile:profiles!assignments_user_profile_fk(id, first_name, last_name, email, role)')
        .in('prospect_id', ids);
      if (assigns) {
        const map = {};
        assigns.forEach(a => {
          if (!map[a.prospect_id]) map[a.prospect_id] = [];
          map[a.prospect_id].push(a);
        });
        rows.forEach(r => {
          const ra = map[r.id] || [];
          r.assignments = ra;
          r.assignedUsers = ra.map(x => x.profile).filter(Boolean);
          r.assignedUserIds = ra.map(x => x.user_id).filter(Boolean);
        });
      }
    }

    return { rows, total: count || rows.length };
  }, []);

  /* --- Main fetch --- */
  const fetchProspects = useCallback(async (p) => {
    const pp = p || params;
    try {
      // Only show loading spinner on first load — subsequent refreshes update silently
      if (!initialLoadDone.current) setLoading(true);
      setError(null);

      // Try RPC first
      if (rpcWorksRef.current) {
        try {
          const { data, error: rpcError } = await supabase.rpc('search_prospects', {
            p_search: pp.search || '',
            p_product_ids: pp.productIds.length > 0 ? pp.productIds.filter(x => x !== 'none') : null,
            p_category_ids: pp.categoryIds.length > 0 ? pp.categoryIds : null,
            p_status_ids: pp.statusIds.length > 0 ? pp.statusIds : null,
            p_installer_ids: pp.installerIds.length > 0 ? pp.installerIds.filter(x => x !== 'none') : null,
            p_user_ids: pp.userIds.length > 0 ? pp.userIds.filter(x => x !== 'none') : null,
            p_unassigned: pp.userIds.includes('none') || pp.unassigned,
            p_no_product: pp.productIds.includes('none'),
            p_no_installer: pp.installerIds.includes('none'),
            p_date_from: pp.dateFrom || null, p_date_to: pp.dateTo || null,
            p_sort_col: pp.sortCol, p_sort_dir: pp.sortDir,
            p_page: pp.page, p_per_page: pp.perPage,
            p_is_client: pp.clientFilter === 'client' ? true : pp.clientFilter === 'prospect' ? false : null,
            p_transmis: pp.transmisFilter === 'oui' ? true : pp.transmisFilter === 'non' ? false : null,
            p_source_ids: pp.sourceIds?.length > 0 ? pp.sourceIds.filter(x => x !== 'none') : null,
            p_no_source: pp.sourceIds?.includes('none') || false
          });
          if (rpcError) throw rpcError;
          const result = data || { data: [], total: 0 };
          const rows = Array.isArray(result.data) ? result.data : [];
          log('RPC OK:', rows.length, 'rows, total:', result.total);
          const filteredRows = rows.map(transformProspect);
          const filteredTotal = result.total || 0;
          setProspects(filteredRows);
          setTotal(filteredTotal);
          initialLoadDone.current = true;
          return;
        } catch (rpcErr) {
          warn('RPC search_prospects failed, switching to direct query:', rpcErr.message);
          rpcWorksRef.current = false;
        }
      }

      // Fallback to direct query
      const result = await fetchDirect(pp);
      setProspects(result.rows);
      setTotal(result.total);
      initialLoadDone.current = true;

    } catch (e) {
      warn('fetchProspects FATAL:', e);
      setError(`Chargement échoué: ${e.message}`);
      setProspects([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [params, fetchDirect]);

  useEffect(() => { if (profile) fetchProspects(); }, [fetchProspects, profile]);

  // Realtime
  useEffect(() => {
    if (!profile) return;
    let rt = null;
    const df = () => { clearTimeout(rt); rt = setTimeout(() => fetchProspects(), 600); };
    const ch = supabase.channel('prospects_rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'prospects' }, df)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'prospect_assignments' }, df)
      .subscribe();
    return () => { clearTimeout(rt); supabase.removeChannel(ch); };
  }, [profile, fetchProspects]);

  const setSearch = useCallback(val => { clearTimeout(debounceRef.current); debounceRef.current = setTimeout(() => setParams(p => ({ ...p, search: val, page: 1 })), 300); }, []);
  const setFilter = useCallback((key, val) => setParams(p => ({ ...p, [key]: val, page: 1 })), []);
  const setPage = useCallback(page => setParams(p => ({ ...p, page })), []);
  const setSort = useCallback(col => setParams(p => ({ ...p, sortCol: col, sortDir: p.sortCol === col && p.sortDir === 'asc' ? 'desc' : 'asc', page: 1 })), []);
  const resetFilters = useCallback(() => setParams(p => ({ ...p, search: '', productIds: [], categoryIds: [], statusIds: [], installerIds: [], userIds: [], sourceIds: [], unassigned: false, noProduct: false, noInstaller: false, dateFrom: null, dateTo: null, clientFilter: 'all', transmisFilter: 'all', page: 1 })), []);

  /* --- ADD PROSPECT --- */
  const addProspect = useCallback(async (data) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Non connecté — reconnectez-vous');
    const insert = { ...data, created_by: user.id };
    ['assignedUsers','assignedUserIds','assignments','product','category','status','installer','closer','next_reminder','prospect_number'].forEach(k => delete insert[k]);
    Object.keys(insert).forEach(k => { if (insert[k] === '') insert[k] = null; });
    // Ensure numeric fields are proper numbers (not strings from inputs)
    ['nb_led','nb_led_reel','ca_previsionnel','ca_reel','surface','puissance_pac','nb_panneaux','nb_personnes_foyer','revenu_fiscal_ref','reste_a_charge','commission_pac','commission_admin','commission_telepro','commission_fournisseur','surface_sous_sol','surface_comble','surface_isoler_total','surface_habitable','surface_chauffer','surface_batiment','surface_mur_interieur','surface_mur_exterieur','surface_fenetre'].forEach(k => {
      if (insert[k] !== null && insert[k] !== undefined) { const n = Number(insert[k]); insert[k] = isNaN(n) ? null : n; }
    });
    log('INSERT prospect');
    const { data: row, error } = await supabase.from('prospects').insert([insert]).select().single();
    if (error) throw new Error(`Création: ${error.message}${error.hint ? ' ('+error.hint+')' : ''}`);
    if (!row) throw new Error('Insert OK mais aucune donnée retournée — vérifiez les policies RLS SELECT');
    // Self-assign
    try { await supabase.from('prospect_assignments').insert([{ prospect_id: row.id, user_id: user.id }]); } catch(e) { /* ignore duplicate */ }
    logEnhanced('create', row.id, { ctx: { company: row.company_name, first_name: row.first_name } });
    // Realtime will sync the list, but force refresh for immediate display
    fetchProspects();
    return row;
  }, [fetchProspects]);

  /* --- UPDATE PROSPECT (optimistic + enhanced logging) --- */
  const updateProspect = useCallback(async (id, data) => {
    const clean = { ...data };
    ['id','created_at','prospect_number','product','category','status','installer','assignments','assignedUsers','assignedUserIds','closer','next_reminder'].forEach(k => delete clean[k]);
    Object.keys(clean).forEach(k => { if (clean[k] === '') clean[k] = null; });
    // Ensure numeric fields are proper numbers (not strings from inputs)
    ['nb_led','nb_led_reel','ca_previsionnel','ca_reel','surface','puissance_pac','nb_panneaux','nb_personnes_foyer','revenu_fiscal_ref','reste_a_charge','commission_pac','commission_admin','commission_telepro','commission_fournisseur','surface_sous_sol','surface_comble','surface_isoler_total','surface_habitable','surface_chauffer','surface_batiment','surface_mur_interieur','surface_mur_exterieur','surface_fenetre'].forEach(k => {
      if (clean[k] !== null && clean[k] !== undefined) { const n = Number(clean[k]); clean[k] = isNaN(n) ? null : n; }
    });
    let prev;
    let changedFields = {};
    // Optimistic: update IDs instantly
    setProspects(ps => { prev = [...ps]; const old = ps.find(p=>p.id===id); if (old) { Object.keys(clean).forEach(k => { if (String(old[k]||'') !== String(clean[k]||'')) changedFields[k] = { from: old[k], to: clean[k] }; }); } return ps.map(p => p.id === id ? { ...p, ...clean, updated_at: new Date().toISOString() } : p); });
    try {
      const { error } = await supabase.from('prospects').update({ ...clean, updated_at: new Date().toISOString() }).eq('id', id);
      if (error) throw new Error(`MAJ: ${error.message}`);
      const fieldNames = Object.keys(changedFields);
      logEnhanced('update', id, { old: JSON.stringify(Object.fromEntries(fieldNames.map(f=>[f,changedFields[f].from]))), new: JSON.stringify(Object.fromEntries(fieldNames.map(f=>[f,changedFields[f].to]))), ctx: { fields: fieldNames } });
      // Refetch single row with joins so names/colors update instantly in list
      if (fieldNames.some(f => f.endsWith('_id'))) {
        const { data: fresh } = await supabase.from('prospects')
          .select('*, category:categories(*), status:statuses(*), product:products(*), installer:installers(*), source:sources(*)')
          .eq('id', id).single();
        if (fresh) setProspects(ps => ps.map(p => p.id === id ? { ...p, ...fresh, assignments: p.assignments, assignedUsers: p.assignedUsers, assignedUserIds: p.assignedUserIds } : p));
      }
    } catch (e) {
      setProspects(prev);
      throw e;
    }
  }, []);

  /* --- QUICK STATUS CHANGE (optimistic — most used action, also auto-sets is_client) --- */
  const quickUpdateStatus = useCallback(async (id, statusId, statuses) => {
    const targetStatus = (statuses || []).find(s => s.id === statusId);
    const isClient = targetStatus?.is_final || false;
    let prev;
    let oldStatusName = '—';
    setProspects(ps => { prev = [...ps]; const old = ps.find(p=>p.id===id); oldStatusName = (statuses||[]).find(s=>s.id===old?.status_id)?.name || '—'; return ps.map(p => p.id === id ? { ...p, status_id: statusId, status: targetStatus || p.status, is_client: isClient, updated_at: new Date().toISOString() } : p); });
    try {
      const { error } = await supabase.from('prospects').update({ status_id: statusId, is_client: isClient, updated_at: new Date().toISOString() }).eq('id', id);
      if (error) throw new Error(error.message);
      logEnhanced('status_change', id, { old: oldStatusName, new: targetStatus?.name || '—', ctx: { old_status_id: prev?.find(p=>p.id===id)?.status_id, new_status_id: statusId } });
    } catch (e) {
      setProspects(prev);
      throw e;
    }
  }, []);

  /* --- DELETE PROSPECT (optimistic) --- */
  const deleteProspect = useCallback(async (id) => {
    // Optimistic: remove from list instantly
    let prev; let prevTotal;
    setProspects(ps => { prev = [...ps]; return ps.filter(p => p.id !== id); });
    setTotal(t => { prevTotal = t; return t - 1; });
    try {
      const { error } = await supabase.from('prospects').delete().eq('id', id);
      if (error) throw new Error(error.message);
      logEnhanced('delete', id, { ctx: { company: prev?.find(p=>p.id===id)?.company_name } });
    } catch (e) {
      setProspects(prev); setTotal(prevTotal); // Rollback
      throw e;
    }
  }, []);

  const duplicateProspect = useCallback(async (p) => {
    // Duplication admin uniquement: on garde SEULEMENT Entreprise + Contact + Adresse
    // Tout le reste est vierge (détails techniques, statut commercial, etc.)
    const copy = {
      company_name: (p.company_name || '') + ' (copie)',
      siret: p.siret || null,
      first_name: p.first_name || '',
      last_name: p.last_name || null,
      phone: p.phone || null,
      email: p.email || null,
      address: p.address || null,
      postal_code: p.postal_code || null,
      city: p.city || null,
      latitude: p.latitude || null,
      longitude: p.longitude || null,
      // Garder produit/catégorie/statut par défaut mais reset le reste
      category_id: p.category_id || null,
      status_id: p.status_id || null,
      product_id: p.product_id || null,
      source_id: p.source_id || null,
      installer_id: null,
      transmis_installateur: false,
      closer_id: null,
      date_pose: null,
      type_led: null, mode_pose: null, nb_led: null, nb_led_reel: null, surface: null, puissance_pac: null, nb_panneaux: null,
      ca_previsionnel: null, ca_reel: null, notes_admin: null,
      nb_personnes_foyer: null, revenu_fiscal_ref: null, is_ile_de_france: false,
      categorie_aide: null, reste_a_charge: null, commission_pac: null,
      commission_admin: null, commission_telepro: null, commission_fournisseur: null, iti_option: null,
      surface_sous_sol: null, surface_comble: null, surface_isoler_total: null, has_vmc: false, has_pac_split: false,
      surface_habitable: null, surface_chauffer: null,
      zone_climatique: null, ballon_type: null, type_chauffage: null,
      date_audit: null, numero_fiscal: null, type_logement: null, type_projet: null,
      surface_batiment: null, surface_mur_interieur: null, surface_mur_exterieur: null, surface_fenetre: null,
    };
    return addProspect(copy);
  }, [addProspect]);

  const assignUser = useCallback(async (prospectId, userId) => {
    const { error } = await supabase.from('prospect_assignments').insert([{ prospect_id: prospectId, user_id: userId }]);
    if (error && error.code !== '23505') throw new Error(error.message);
    logEnhanced('assign', prospectId, { ctx: { assigned_user_id: userId } });
    // Realtime will sync — but force for immediate update since assignments affect joined data
    fetchProspects();
  }, [fetchProspects]);

  const unassignUser = useCallback(async (prospectId, userId) => {
    const { error } = await supabase.from('prospect_assignments').delete().eq('prospect_id', prospectId).eq('user_id', userId);
    if (error) throw new Error(error.message);
    logEnhanced('unassign', prospectId, { ctx: { removed_user_id: userId } });
    fetchProspects();
  }, [fetchProspects]);

  const bulkAssign = useCallback(async (ids, userIds, mode = 'add') => {
    for (let i = 0; i < ids.length; i += 100) {
      const batch = ids.slice(i, i + 100);
      if (mode === 'replace') await supabase.from('prospect_assignments').delete().in('prospect_id', batch);
      const inserts = batch.flatMap(pid => userIds.map(uid => ({ prospect_id: pid, user_id: uid })));
      if (inserts.length) await supabase.from('prospect_assignments').upsert(inserts, { onConflict: 'prospect_id,user_id' });
    }
    fetchProspects(); // Single fetch at end, not per batch
  }, [fetchProspects]);

  const bulkUnassign = useCallback(async (ids, userIds) => {
    for (let i = 0; i < ids.length; i += 200) {
      const batch = ids.slice(i, i + 200);
      if (userIds && userIds.length > 0) {
        // Unassign specific users
        for (const uid of userIds) {
          await supabase.from('prospect_assignments').delete().in('prospect_id', batch).eq('user_id', uid);
        }
      } else {
        // Unassign all
        await supabase.from('prospect_assignments').delete().in('prospect_id', batch);
      }
    }
    fetchProspects();
  }, [fetchProspects]);

  const bulkUpdateStatus = useCallback(async (ids, statusId, statuses) => {
    // Determine if target status is final → is_client
    const targetStatus = (statuses || []).find(s => s.id === statusId);
    const isClient = targetStatus?.is_final || false;
    // Optimistic: update all selected prospects instantly
    let prev;
    setProspects(ps => { prev = [...ps]; return ps.map(p => ids.includes(p.id) ? { ...p, status_id: statusId, is_client: isClient, updated_at: new Date().toISOString() } : p); });
    try {
      for (let i = 0; i < ids.length; i += 200) await supabase.from('prospects').update({ status_id: statusId, is_client: isClient, updated_at: new Date().toISOString() }).in('id', ids.slice(i, i + 200));
    } catch (e) {
      setProspects(prev); // Rollback
      throw e;
    }
  }, []);

  const bulkUpdateSource = useCallback(async (ids, sourceId, sources) => {
    const srcObj = sourceId ? (sources || []).find(s => s.id === sourceId) || null : null;
    let prev;
    setProspects(ps => { prev = [...ps]; return ps.map(p => ids.includes(p.id) ? { ...p, source_id: sourceId || null, source: srcObj, updated_at: new Date().toISOString() } : p); });
    try {
      for (let i = 0; i < ids.length; i += 200) await supabase.from('prospects').update({ source_id: sourceId || null, updated_at: new Date().toISOString() }).in('id', ids.slice(i, i + 200));
    } catch (e) {
      setProspects(prev);
      throw e;
    }
  }, []);

  const bulkDelete = useCallback(async (ids) => {
    // Optimistic: remove from list instantly
    let prev; let prevTotal;
    setProspects(ps => { prev = [...ps]; return ps.filter(p => !ids.includes(p.id)); });
    setTotal(t => { prevTotal = t; return t - ids.length; });
    try {
      for (let i = 0; i < ids.length; i += 200) await supabase.from('prospects').delete().in('id', ids.slice(i, i + 200));
    } catch (e) {
      setProspects(prev); setTotal(prevTotal); // Rollback
      throw e;
    }
  }, []);

  const importProspects = useCallback(async (rows, catId, statusId, productId) => {
    const { data: { user } } = await supabase.auth.getUser();
    let success = 0; const errors = [];
    for (let i = 0; i < rows.length; i += 100) {
      const batch = rows.slice(i, i + 100).map(r => ({ ...r, created_by: user.id, category_id: catId || null, status_id: statusId || null, product_id: productId || null }));
      const { data, error } = await supabase.from('prospects').insert(batch).select('id');
      if (error) errors.push(error.message); else {
        success += data.length;
        await supabase.from('prospect_assignments').upsert(data.map(d => ({ prospect_id: d.id, user_id: user.id })), { onConflict: 'prospect_id,user_id' });
      }
    } fetchProspects();
    return { success, errors };
  }, [fetchProspects]);

  const exportCSV = useCallback(async () => {
    // Try RPC first, fallback to direct
    let rows = [];
    const { data, error } = await supabase.rpc('export_prospects', {
      p_search: params.search || '', p_product_ids: params.productIds.length > 0 ? params.productIds.filter(x => x !== 'none') : null,
      p_category_ids: params.categoryIds.length > 0 ? params.categoryIds : null, p_status_ids: params.statusIds.length > 0 ? params.statusIds : null,
      p_installer_ids: params.installerIds.length > 0 ? params.installerIds.filter(x => x !== 'none') : null,
      p_user_ids: params.userIds.length > 0 ? params.userIds.filter(x => x !== 'none') : null
    });
    if (error) {
      // Fallback
      const { data: d2 } = await supabase.from('prospects').select('*').limit(10000);
      rows = d2 || [];
    } else { rows = data || []; }
    if (!rows.length) throw new Error('Aucune donnée');
    const headers = Object.keys(rows[0]);
    const csv = '\uFEFF' + headers.join(';') + '\n' + rows.map(r => headers.map(h => `"${(r[h]||'').toString().replace(/"/g,'""')}"`).join(';')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `rs-consulting-${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
    return rows.length;
  }, [params]);

  return { prospects, total, loading, error, params, refresh: fetchProspects, setSearch, setFilter, setPage, setSort, resetFilters,
    addProspect, updateProspect, quickUpdateStatus, deleteProspect, duplicateProspect,
    assignUser, unassignUser, bulkAssign, bulkUnassign, bulkUpdateStatus, bulkUpdateSource, bulkDelete, importProspects, exportCSV };
}

/* ============================
   HOOK: useCounts
   ============================ */
export function useCounts() {
  const [counts, setCounts] = useState({ total: 0, clients: 0, prospects: 0, transmis: 0, by_status: {}, by_product: {}, by_category: {}, by_installer: {}, by_user: {}, by_source: {}, unassigned: 0 });
  const { profile, isAdmin } = useAuth();

  const fetchCounts = useCallback(async () => {
    try {
      if (isAdmin) {
        const { data, error } = await supabase.rpc('get_prospect_counts');
        if (error) {
          warn('get_prospect_counts RPC failed, using fallback:', error.message);
          const { count } = await supabase.from('prospects').select('id', { count: 'exact', head: true });
          setCounts(c => ({ ...c, total: count || 0 }));
          return;
        }
        if (data) setCounts(data);
        // Supplement with source counts (not in RPC)
        try {
          const { data: srcRows } = await supabase.from('prospects').select('source_id');
          if (srcRows) {
            const by_source = {};
            srcRows.forEach(p => {
              if (p.source_id) by_source[p.source_id] = (by_source[p.source_id]||0) + 1;
              else by_source['none'] = (by_source['none']||0) + 1;
            });
            setCounts(c => ({ ...c, by_source }));
          }
        } catch(e) { /* ignore */ }
      } else {
        // Non-admin: use search_prospects RPC (SECURITY DEFINER, handles source-linked visibility)
        try {
          const { data: rpcData } = await supabase.rpc('search_prospects', {
            p_search: '', p_page: 1, p_per_page: 10000
          });
          const ps = rpcData?.data || [];
          const by_status = {}, by_product = {}, by_category = {}, by_installer = {}, by_source = {};
          ps.forEach(p => {
            if (p.status_id) by_status[p.status_id] = (by_status[p.status_id]||0) + 1;
            if (p.product_id) by_product[p.product_id] = (by_product[p.product_id]||0) + 1;
            else by_product['none'] = (by_product['none']||0) + 1;
            if (p.category_id) by_category[p.category_id] = (by_category[p.category_id]||0) + 1;
            if (p.installer_id) by_installer[p.installer_id] = (by_installer[p.installer_id]||0) + 1;
            if (p.source_id) by_source[p.source_id] = (by_source[p.source_id]||0) + 1;
            else by_source['none'] = (by_source['none']||0) + 1;
          });
          setCounts({
            total: rpcData?.total || ps.length,
            clients: ps.filter(p => p.is_client).length,
            prospects: ps.filter(p => !p.is_client).length,
            transmis: ps.filter(p => p.transmis_installateur).length,
            by_status, by_product, by_category, by_installer, by_source,
            by_user: {}, unassigned: 0
          });
        } catch(e) { warn('Non-admin counts via RPC failed:', e); }
      }
    } catch (e) { warn('Counts error:', e); }
  }, [profile, isAdmin]);

  useEffect(() => {
    if (!profile) return;
    fetchCounts();
    const iv = setInterval(fetchCounts, 60000);
    return () => clearInterval(iv);
  }, [profile, fetchCounts]);

  useEffect(() => {
    if (!profile) return; let rt = null;
    const df = () => { clearTimeout(rt); rt = setTimeout(fetchCounts, 800); };
    const ch = supabase.channel('counts_rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'prospects' }, df)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'prospect_assignments' }, df)
      .subscribe();
    return () => { clearTimeout(rt); supabase.removeChannel(ch); };
  }, [profile, fetchCounts]);

  return { counts, refresh: fetchCounts };
}

/* ============================
   HOOK: useReferenceData
   ============================ */
export function useReferenceData() {
  const [categories, setCategories] = useState([]);
  const [statuses, setStatuses] = useState([]);
  const [products, setProducts] = useState([]);
  const [installers, setInstallers] = useState([]);
  const [sources, setSources] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const { profile } = useAuth();

  const fetchAll = useCallback(async () => {
    try {
      const [c, s, p, i, pr, src] = await Promise.all([
        supabase.from('categories').select('*').order('position'),
        supabase.from('statuses').select('*').order('position'),
        supabase.from('products').select('*').order('position'),
        supabase.from('installers').select('*').order('name'),
        supabase.from('profiles').select('*').order('first_name'),
        supabase.from('sources').select('*').order('name')
      ]);
      setCategories(c.data || []); setStatuses(s.data || []); setProducts(p.data || []); setInstallers(i.data || []); setProfiles(pr.data || []); setSources(src.data || []);
      log('RefData loaded:', { cat: (c.data||[]).length, stat: (s.data||[]).length, prod: (p.data||[]).length, inst: (i.data||[]).length, prof: (pr.data||[]).length, src: (src.data||[]).length });
      if (c.error) warn('categories:', c.error);
      if (s.error) warn('statuses:', s.error);
      if (p.error) warn('products:', p.error);
      if (i.error) warn('installers:', i.error);
      if (pr.error) warn('profiles:', pr.error);
      if (src.error && src.error.code !== '42P01') warn('sources:', src.error); // 42P01 = table not found, ignore on first deploy
    } catch (e) { warn('RefData FATAL:', e); }
  }, []);

  useEffect(() => { if (profile) fetchAll(); }, [profile, fetchAll]);

  const slug = s => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

  const crudFor = (table, xform) => ({
    add: async d => {
      const payload = xform ? xform(d) : d;
      log(` INSERT ${table}:`, payload);
      const { data: row, error } = await supabase.from(table).insert([payload]).select();
      if (error) { warn(` INSERT ${table}:`, error); throw new Error(`${error.message}${error.details ? ' — '+error.details : ''}`); }
      log(` ${table} OK:`, row);
      await fetchAll();
    },
    upd: async (id, d) => { const { error } = await supabase.from(table).update(d).eq('id', id); if (error) throw new Error(error.message); await fetchAll(); },
    del: async id => {
      log(` DELETE ${table}:`, id);
      const { error } = await supabase.from(table).delete().eq('id', id);
      if (error) { warn(` DELETE ${table}:`, error); throw new Error(error.message); }
      await fetchAll();
    }
  });

  const cc = crudFor('categories');
  const sc = crudFor('statuses', d => ({ ...d, code: slug(d.name) + '_' + Date.now().toString(36) }));
  const pc = crudFor('products', d => ({ ...d, code: slug(d.name) + '_' + Date.now().toString(36) }));
  const ic = crudFor('installers');
  const src = crudFor('sources');

  const updateUserRole = useCallback(async (id, role) => { const { error } = await supabase.from('profiles').update({ role }).eq('id', id); if (error) throw new Error(error.message); fetchAll(); }, [fetchAll]);
  const deactivateUser = useCallback(async id => { const { error } = await supabase.from('profiles').update({ active: false }).eq('id', id); if (error) throw new Error(error.message); fetchAll(); }, [fetchAll]);
  const activateUser = useCallback(async id => { const { error } = await supabase.from('profiles').update({ active: true }).eq('id', id); if (error) throw new Error(error.message); fetchAll(); }, [fetchAll]);

  return { categories, statuses, products, installers, sources, profiles, refresh: fetchAll,
    addCategory: cc.add, updateCategory: cc.upd, deleteCategory: cc.del,
    addStatus: sc.add, updateStatus: sc.upd, deleteStatus: sc.del,
    addProduct: pc.add, updateProduct: pc.upd, deleteProduct: pc.del,
    addInstaller: ic.add, updateInstaller: ic.upd, deleteInstaller: ic.del,
    addSource: src.add, updateSource: src.upd, deleteSource: src.del,
    updateUserRole, deactivateUser, activateUser };
}

/* ============================
   HOOK: useNotes
   ============================ */
export function useNotes(prospectId) {
  const [notes, setNotes] = useState([]);
  const { profile } = useAuth();
  const fetchNotes = useCallback(async () => {
    if (!prospectId) return;
    try {
      let { data, error } = await supabase.from('notes').select('*, profile:profiles!notes_user_profile_fk(id, first_name, last_name)').eq('prospect_id', prospectId).order('created_at', { ascending: false });
      if (error) {
        const res = await supabase.from('notes').select('*').eq('prospect_id', prospectId).order('created_at', { ascending: false });
        data = res.data;
      }
      if (data) setNotes(data);
    } catch(e) { /* network error — keep current state */ }
  }, [prospectId]);
  useEffect(() => { fetchNotes(); }, [fetchNotes]);
  useEffect(() => { if (!prospectId) return; const ch = supabase.channel(`n_${prospectId}`).on('postgres_changes', { event: '*', schema: 'public', table: 'notes', filter: `prospect_id=eq.${prospectId}` }, fetchNotes).subscribe(); return () => supabase.removeChannel(ch); }, [prospectId, fetchNotes]);
  const addNote = useCallback(async content => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Non connecté');
    // Optimistic: show note immediately
    const tempId = crypto.randomUUID();
    const tempNote = { id: tempId, prospect_id: prospectId, user_id: user.id, content, created_at: new Date().toISOString(), profile: profile ? { id: profile.id, first_name: profile.first_name, last_name: profile.last_name } : null };
    setNotes(prev => [tempNote, ...prev]);
    try {
      const { error } = await supabase.from('notes').insert([{ prospect_id: prospectId, user_id: user.id, content }]);
      if (error) { setNotes(prev => prev.filter(n => n.id !== tempId)); throw new Error(error.message); }
      logEnhanced('note', prospectId, { ctx: { preview: content?.slice(0, 80) } });
      // Refresh to get real data with server-generated id
      setTimeout(() => fetchNotes(), 300);
    } catch(e) { setNotes(prev => prev.filter(n => n.id !== tempId)); throw e; }
  }, [prospectId, profile, fetchNotes]);
  const deleteNote = useCallback(async id => {
    let snapshot;
    setNotes(p => { snapshot = [...p]; return p.filter(n => n.id !== id); }); // Optimistic remove
    await new Promise(r => setTimeout(r, 0)); // Flush so snapshot is captured
    try {
      const { error } = await supabase.from('notes').delete().eq('id', id);
      if (error) { if (snapshot) setNotes(snapshot); throw new Error(error.message); }
    } catch(e) { if (snapshot) setNotes(snapshot); throw e; }
  }, []);
  return { notes, addNote, deleteNote, refresh: fetchNotes };
}

/* ============================
   HOOK: useDocuments
   ============================ */
export function useDocuments(prospectId) {
  const [documents, setDocuments] = useState([]); const [uploading, setUploading] = useState(false); const [uploadProgress, setUploadProgress] = useState(0);
  const { profile } = useAuth();
  const fetchDocs = useCallback(async () => {
    if (!prospectId) return;
    try {
      let { data, error } = await supabase.from('documents').select('*, profile:profiles!documents_user_profile_fk(id, first_name, last_name)').eq('prospect_id', prospectId).order('created_at', { ascending: false });
      if (error) {
        const res = await supabase.from('documents').select('*').eq('prospect_id', prospectId).order('created_at', { ascending: false });
        data = res.data;
      }
      if (data) setDocuments(data);
    } catch(e) { /* network error — keep current state */ }
  }, [prospectId]);
  useEffect(() => { fetchDocs(); }, [fetchDocs]);
  useEffect(() => { if (!prospectId) return; const ch = supabase.channel(`d_${prospectId}`).on('postgres_changes', { event: '*', schema: 'public', table: 'documents', filter: `prospect_id=eq.${prospectId}` }, fetchDocs).subscribe(); return () => supabase.removeChannel(ch); }, [prospectId, fetchDocs]);

  const uploadDocuments = useCallback(async files => {
    setUploading(true); setUploadProgress(0);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Non connecté');
    let success = 0; const errors = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i]; const fp = `${prospectId}/${Date.now()}_${file.name}`;
      try {
        const { error: ue } = await supabase.storage.from('documents').upload(fp, file); if (ue) throw ue;
        const { error: de } = await supabase.from('documents').insert([{ prospect_id: prospectId, user_id: user.id, name: file.name, file_path: fp, mime_type: file.type, file_size: file.size }]); if (de) throw de;
        success++;
        // Optimistic: add to list immediately
        setDocuments(prev => [{ id: crypto.randomUUID(), prospect_id: prospectId, user_id: user.id, name: file.name, file_path: fp, mime_type: file.type, file_size: file.size, created_at: new Date().toISOString(), profile: profile ? { id: profile.id, first_name: profile.first_name, last_name: profile.last_name } : null }, ...prev]);
        logEnhanced('document', prospectId, { ctx: { filename: file.name, size: file.size } });
      } catch (e) { errors.push({ file: file.name, error: e.message }); }
      setUploadProgress(Math.round(((i + 1) / files.length) * 100));
    }
    setUploading(false);
    // Refresh to get real server data
    setTimeout(() => fetchDocs(), 500);
    return { success, errors };
  }, [prospectId, profile, fetchDocs]);

  const deleteDocument = useCallback(async doc => {
    let snapshot;
    setDocuments(d => { snapshot = [...d]; return d.filter(x => x.id !== doc.id); }); // Optimistic remove
    await new Promise(r => setTimeout(r, 0)); // Flush so snapshot is captured
    try {
      await supabase.storage.from('documents').remove([doc.file_path]);
      await supabase.from('documents').delete().eq('id', doc.id);
    } catch(e) { if (snapshot) setDocuments(snapshot); throw e; }
  }, []);
  const getDocumentUrl = useCallback(async doc => { const { data } = await supabase.storage.from('documents').createSignedUrl(doc.file_path, 3600); return data?.signedUrl; }, []);
  return { documents, uploadDocuments, deleteDocument, getDocumentUrl, uploading, uploadProgress };
}

/* ============================
   HOOK: useReminders (OPTIMISTIC)
   ============================ */
export function useReminders(prospectId = null) {
  const [reminders, setReminders] = useState([]); 
  const { profile } = useAuth();
  const rtRef = useRef(null);
  const snapshotRef = useRef(null); // Safe rollback for delete
  const [tick, setTick] = useState(0); // Ticker for overdueCount freshness
  
  const fetchReminders = useCallback(async () => {
    if (!profile) return;
    let q = supabase.from('reminders').select('*, prospect:prospects(id, company_name, first_name, last_name)').order('due_date', { ascending: true });
    if (profile.role !== 'admin') q = q.eq('user_id', profile.id);
    if (prospectId) q = q.eq('prospect_id', prospectId);
    const { data } = await q; 
    if (data) setReminders(data);
  }, [profile, prospectId]);
  
  useEffect(() => { fetchReminders(); }, [fetchReminders]);
  
  // Fast realtime sync — 250ms debounce for responsive updates
  useEffect(() => { 
    if (!profile) return; 
    const debouncedFetch = () => { clearTimeout(rtRef.current); rtRef.current = setTimeout(fetchReminders, 250); };
    const ch = supabase.channel(`r_${profile.id}_${prospectId||'a'}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reminders' }, debouncedFetch)
      .subscribe(); 
    return () => { clearTimeout(rtRef.current); supabase.removeChannel(ch); }; 
  }, [profile, prospectId, fetchReminders]);

  // Tick every 30s so overdueCount auto-updates when reminders become overdue
  useEffect(() => {
    const iv = setInterval(() => setTick(t => t + 1), 30000);
    return () => clearInterval(iv);
  }, []);
  
  // Overdue count — recalculates on reminders change AND every 30s tick
  const overdueCount = useMemo(() => {
    return reminders.filter(r => !r.completed && new Date(r.due_date) < new Date()).length;
  }, [reminders, tick]);
  
  const addReminder = useCallback(async (pid, dueDate, message) => {
    if (!profile) throw new Error('Non connecté');
    const isoDate = new Date(dueDate).toISOString();
    const tempId = crypto.randomUUID();
    const optimistic = {
      id: tempId, prospect_id: pid, user_id: profile.id, due_date: isoDate, 
      message, completed: false, completed_at: null, created_at: new Date().toISOString(),
      prospect: null
    };
    setReminders(prev => [...prev, optimistic].sort((a,b) => new Date(a.due_date) - new Date(b.due_date)));
    try {
      const { error } = await supabase.from('reminders').insert([{ prospect_id: pid, user_id: profile.id, due_date: isoDate, message }]);
      if (error) throw new Error(error.message);
      logEnhanced('reminder_add', pid, { ctx: { due: isoDate, message: message?.slice(0,80) } });
      setTimeout(fetchReminders, 150);
    } catch(e) {
      setReminders(prev => prev.filter(r => r.id !== tempId));
      throw e;
    }
  }, [profile, fetchReminders]);
  
  const completeReminder = useCallback(async id => {
    let reminderInfo = {};
    setReminders(prev => { const r = prev.find(x=>x.id===id); reminderInfo = { prospect_id: r?.prospect_id, message: r?.message, due_date: r?.due_date }; return prev.map(r => r.id === id ? { ...r, completed: true, completed_at: new Date().toISOString() } : r); });
    try {
      const { error } = await supabase.from('reminders').update({ completed: true, completed_at: new Date().toISOString() }).eq('id', id); 
      if (error) throw new Error(error.message);
      logEnhanced('reminder_done', reminderInfo.prospect_id, { ctx: { message: reminderInfo.message?.slice(0,80), due: reminderInfo.due_date } });
    } catch(e) {
      setReminders(prev => prev.map(r => r.id === id ? { ...r, completed: false, completed_at: null } : r));
      throw e;
    }
  }, []);

  const uncompleteReminder = useCallback(async id => {
    // Optimistic: mark uncompleted instantly
    setReminders(prev => prev.map(r => r.id === id ? { ...r, completed: false, completed_at: null } : r));
    try {
      const { error } = await supabase.from('reminders').update({ completed: false, completed_at: null }).eq('id', id); 
      if (error) throw new Error(error.message);
    } catch(e) {
      setReminders(prev => prev.map(r => r.id === id ? { ...r, completed: true, completed_at: new Date().toISOString() } : r)); // Rollback
      throw e;
    }
  }, []);
  
  const deleteReminder = useCallback(async id => {
    // Capture snapshot via ref BEFORE state update — safe across React batching
    snapshotRef.current = null;
    setReminders(prev => { snapshotRef.current = prev; return prev.filter(r => r.id !== id); });
    // Flush: ensure React processes the updater so snapshot is captured
    await new Promise(r => setTimeout(r, 0));
    try {
      const { error } = await supabase.from('reminders').delete().eq('id', id); 
      if (error) throw new Error(error.message);
    } catch(e) {
      if (snapshotRef.current) setReminders(snapshotRef.current); // Rollback
      throw e;
    }
  }, []);
  
  const snoozeReminder = useCallback(async (id, minutes = 15) => {
    const newDate = new Date(Date.now() + minutes * 60000).toISOString();
    // Optimistic: update date instantly
    setReminders(prev => prev.map(r => r.id === id ? { ...r, due_date: newDate } : r)
      .sort((a,b) => new Date(a.due_date) - new Date(b.due_date)));
    try {
      const { error } = await supabase.from('reminders').update({ due_date: newDate }).eq('id', id);
      if (error) throw new Error(error.message);
    } catch(e) {
      fetchReminders(); // Full refresh on error
      throw e;
    }
  }, [fetchReminders]);
  
  return { reminders, overdueCount, addReminder, completeReminder, uncompleteReminder, deleteReminder, snoozeReminder, refresh: fetchReminders };
}

/* ============================
   Other hooks
   ============================ */
export function useActivityLog(prospectId = null) {
  const [logs, setLogs] = useState([]); const [loading, setLoading] = useState(true);
  const fetchLogs = useCallback(async () => {
    let q = supabase.from('activity_logs').select('*, profile:profiles!activity_logs_user_profile_fk(id, first_name, last_name)').order('created_at', { ascending: false }).limit(100);
    if (prospectId) q = q.eq('prospect_id', prospectId);
    let { data, error } = await q;
    if (error) {
      let q2 = supabase.from('activity_logs').select('*').order('created_at', { ascending: false }).limit(100);
      if (prospectId) q2 = q2.eq('prospect_id', prospectId);
      const res = await q2; data = res.data;
    }
    setLogs(data || []); setLoading(false);
  }, [prospectId]);
  useEffect(() => { fetchLogs(); }, [fetchLogs]);
  return { logs, loading, refresh: fetchLogs };
}

export function useUserStats() {
  const [data, setData] = useState(null); const [loading, setLoading] = useState(false); const [period, setPeriod] = useState('month');
  const { profile } = useAuth();
  const fetchStats = useCallback(async p => {
    try { setLoading(true); const { data: r, error } = await supabase.rpc('get_user_performance', { p_period: p || period }); if (error) throw error; setData(r); } catch (e) { warn('Stats:', e); } finally { setLoading(false); }
  }, [period]);
  useEffect(() => { if (!profile || profile.role !== 'admin') return; fetchStats(); }, [profile, fetchStats]);
  const changePeriod = useCallback(p => { setPeriod(p); fetchStats(p); }, [fetchStats]);
  return { data, loading, period, changePeriod, refresh: fetchStats };
}

export function useMapData(params) {
  const [markers, setMarkers] = useState([]); const [loading, setLoading] = useState(false);
  const { profile, isAdmin } = useAuth();
  const fetchMarkers = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    try {
      // Get user's assigned prospect IDs if non-admin
      let allowedIds = null;
      if (!isAdmin) {
        const { data: assigned } = await supabase.from('prospect_assignments').select('prospect_id').eq('user_id', profile.id);
        allowedIds = new Set((assigned||[]).map(a => a.prospect_id));
        if (allowedIds.size === 0) { setMarkers([]); setLoading(false); return; }
      }
      const { data, error } = await supabase.rpc('get_map_data', {
        p_search: params?.search || '', p_product_ids: params?.productIds?.length > 0 ? params.productIds.filter(x => x !== 'none') : null,
        p_category_ids: params?.categoryIds?.length > 0 ? params.categoryIds : null, p_status_ids: params?.statusIds?.length > 0 ? params.statusIds : null,
        p_installer_ids: params?.installerIds?.length > 0 ? params.installerIds.filter(x => x !== 'none') : null, p_user_ids: params?.userIds?.length > 0 ? params.userIds.filter(x => x !== 'none') : null,
        p_date_from: params?.dateFrom || null, p_date_to: params?.dateTo || null
      });
      if (error) throw error;
      let filtered = data || [];
      if (allowedIds) filtered = filtered.filter(m => allowedIds.has(m.id));
      const ids = filtered.map(m => m.id);
      let assignMap = {};
      if (ids.length > 0) {
        const { data: assigns } = await supabase.from('prospect_assignments').select('prospect_id, user_id').in('prospect_id', ids);
        (assigns||[]).forEach(a => { if (!assignMap[a.prospect_id]) assignMap[a.prospect_id] = []; assignMap[a.prospect_id].push(a.user_id); });
      }
      setMarkers(filtered.map(m => ({ ...m, assignedUserIds: assignMap[m.id] || [] })));
    } catch (e) {
      warn('Map fallback:', e.message);
      let q = supabase.from('prospects').select('id, company_name, first_name, last_name, city, latitude, longitude, status_id').not('latitude', 'is', null).limit(5000);
      if (!isAdmin) {
        const { data: assigned } = await supabase.from('prospect_assignments').select('prospect_id').eq('user_id', profile.id);
        const myIds = (assigned||[]).map(a => a.prospect_id);
        if (myIds.length === 0) { setMarkers([]); setLoading(false); return; }
        q = q.in('id', myIds);
      }
      const { data } = await q;
      const ids = (data||[]).map(m => m.id);
      let assignMap = {};
      if (ids.length > 0) {
        const { data: assigns } = await supabase.from('prospect_assignments').select('prospect_id, user_id').in('prospect_id', ids);
        (assigns||[]).forEach(a => { if (!assignMap[a.prospect_id]) assignMap[a.prospect_id] = []; assignMap[a.prospect_id].push(a.user_id); });
      }
      setMarkers((data||[]).map(m => ({ ...m, assignedUserIds: assignMap[m.id] || [] })));
    } finally { setLoading(false); }
  }, [profile, isAdmin, params?.search, params?.productIds, params?.categoryIds, params?.statusIds, params?.installerIds, params?.userIds, params?.dateFrom, params?.dateTo]);
  useEffect(() => { fetchMarkers(); }, [fetchMarkers]);
  return { markers, loading, refresh: fetchMarkers };
}

export function useSiretLookup() {
  const [loading, setLoading] = useState(false);
  const lookup = useCallback(async siret => {
    const clean = (siret || '').replace(/\s/g, '');
    if (clean.length < 9) throw new Error('SIRET invalide (min 9 chiffres)');
    setLoading(true);
    try {
      const res = await fetch(`https://recherche-entreprises.api.gouv.fr/search?q=${clean}&page=1&per_page=1`);
      if (!res.ok) throw new Error('Erreur API');
      const json = await res.json();
      if (!json.results?.length) throw new Error('SIRET non trouvé');
      const c = json.results[0], s = c.siege || {};
      return { company_name: c.nom_complet || '', siret: s.siret || clean, address: [s.numero_voie, s.type_voie, s.libelle_voie].filter(Boolean).join(' '), postal_code: s.code_postal || '', city: (s.libelle_commune || '').toUpperCase(), latitude: s.latitude ? parseFloat(s.latitude) : null, longitude: s.longitude ? parseFloat(s.longitude) : null };
    } finally { setLoading(false); }
  }, []);
  return { lookup, loading };
}

export function useAddressSearch() {
  const [results, setResults] = useState([]); const [loading, setLoading] = useState(false); const timer = useRef(null);
  const search = useCallback(query => {
    clearTimeout(timer.current);
    if (!query || query.length < 3) { setResults([]); return; }
    timer.current = setTimeout(async () => {
      setLoading(true);
      try { const res = await fetch(`https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(query)}&limit=5`); const json = await res.json(); setResults((json.features || []).map(f => ({ label: f.properties.label, name: f.properties.name, postcode: f.properties.postcode, city: f.properties.city, latitude: f.geometry.coordinates[1], longitude: f.geometry.coordinates[0] }))); } catch { setResults([]); } finally { setLoading(false); }
    }, 300);
  }, []);
  return { results, loading, search, clear: useCallback(() => setResults([]), []) };
}

/* ============================
   HOOK: useSites (sites + buildings per prospect)
   ============================ */
export function useSites(prospectId) {
  const [sites, setSites] = useState([]);
  const [loading, setLoading] = useState(true);
  const { profile } = useAuth();

  const fetchSites = useCallback(async () => {
    if (!profile || !prospectId) { setSites([]); setLoading(false); return; }
    try {
      const { data, error } = await supabase
        .from('sites')
        .select('*, buildings(*)')
        .eq('prospect_id', prospectId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      // Sort buildings within each site
      const sorted = (data || []).map(s => ({
        ...s,
        buildings: (s.buildings || []).sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
      }));
      setSites(sorted);
    } catch (e) {
      if (import.meta.env.DEV) console.warn('useSites error:', e);
      setSites([]);
    } finally { setLoading(false); }
  }, [profile, prospectId]);

  useEffect(() => { fetchSites(); }, [fetchSites]);

  // Realtime
  useEffect(() => {
    if (!profile || !prospectId) return;
    let rt = null;
    const df = () => { clearTimeout(rt); rt = setTimeout(fetchSites, 400); };
    const ch = supabase.channel(`sites_${prospectId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sites', filter: `prospect_id=eq.${prospectId}` }, df)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'buildings' }, df)
      .subscribe();
    return () => { clearTimeout(rt); supabase.removeChannel(ch); };
  }, [profile, prospectId, fetchSites]);

  const addSite = useCallback(async (data = {}) => {
    if (!profile) throw new Error('Non connecté');
    const { error } = await supabase.from('sites').insert([{ prospect_id: prospectId, name: data.name || 'Site 1', address: data.address || null, postal_code: data.postal_code || null, city: data.city || null, latitude: data.latitude || null, longitude: data.longitude || null }]);
    if (error) throw new Error(error.message);
    await fetchSites();
  }, [profile, prospectId, fetchSites]);

  const updateSite = useCallback(async (siteId, data) => {
    const { error } = await supabase.from('sites').update(data).eq('id', siteId);
    if (error) throw new Error(error.message);
    await fetchSites();
  }, [fetchSites]);

  const deleteSite = useCallback(async (siteId) => {
    const { error } = await supabase.from('sites').delete().eq('id', siteId);
    if (error) throw new Error(error.message);
    await fetchSites();
  }, [fetchSites]);

  const addBuilding = useCallback(async (siteId, data = {}) => {
    // Count existing buildings for default name
    const site = sites.find(s => s.id === siteId);
    const num = (site?.buildings?.length || 0) + 1;
    const { error } = await supabase.from('buildings').insert([{ site_id: siteId, name: data.name || `Bâtiment ${num}`, surface: data.surface || null, nb_luminaire_existant: data.nb_luminaire_existant || null, nb_luminaire_creation: data.nb_luminaire_creation || null, nb_luminaire_total: data.nb_luminaire_total || null, type_luminaire: data.type_luminaire || null, hauteur_plafond: data.hauteur_plafond || null, parcelle_cadastrale: data.parcelle_cadastrale || null, notes: data.notes || null }]);
    if (error) throw new Error(error.message);
    await fetchSites();
  }, [sites, fetchSites]);

  const updateBuilding = useCallback(async (buildingId, data) => {
    const { error } = await supabase.from('buildings').update(data).eq('id', buildingId);
    if (error) throw new Error(error.message);
    await fetchSites();
  }, [fetchSites]);

  const deleteBuilding = useCallback(async (buildingId) => {
    const { error } = await supabase.from('buildings').delete().eq('id', buildingId);
    if (error) throw new Error(error.message);
    await fetchSites();
  }, [fetchSites]);

  return { sites, loading, addSite, updateSite, deleteSite, addBuilding, updateBuilding, deleteBuilding, refresh: fetchSites };
}

/* ============================
   HOOK: useDiagnostic
   ============================ */
export function useDiagnostic() {
  const [results, setResults] = useState(null);
  const { profile } = useAuth();
  const runDiagnostic = useCallback(async () => {
    const checks = {};
    // Test tables
    for (const t of ['profiles', 'prospects', 'categories', 'statuses', 'products', 'installers']) {
      const { data, error } = await supabase.from(t).select('id').limit(1);
      checks[`table_${t}`] = error ? `❌ ${error.message}` : `✅ ${(data || []).length} row`;
    }
    // Test RPC search
    const { error: re1 } = await supabase.rpc('search_prospects', { p_search: '', p_page: 1, p_per_page: 1 });
    checks.rpc_search = re1 ? `❌ ${re1.message}` : '✅';
    // Test RPC counts
    const { error: re2 } = await supabase.rpc('get_prospect_counts');
    checks.rpc_counts = re2 ? `❌ ${re2.message}` : '✅';
    // Test INSERT (categories)
    const { data: testRow, error: ie } = await supabase.from('categories').insert([{ name: '__DIAG_TEST__', color: '#000' }]).select().single();
    checks.insert_category = ie ? `❌ ${ie.message}` : '✅';
    if (testRow) { await supabase.from('categories').delete().eq('id', testRow.id); checks.cleanup = '✅'; }
    // Profile info
    checks.role = profile?.role || '?';
    checks.active = String(profile?.active !== false);
    log('DIAGNOSTIC:', checks);
    setResults(checks);
    return checks;
  }, [profile]);
  return { results, runDiagnostic };
}

/* ============================
   HOOK: usePlanning (date_pose)
   ============================ */
export function usePlanning() {
  const [events, setEvents] = useState([]);
  const [audits, setAudits] = useState([]);
  const [loading, setLoading] = useState(true);
  const { profile, isAdmin } = useAuth();

  const fetchEvents = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    try {
      let myIds = null;
      if (!isAdmin) {
        const { data: assigned } = await supabase.from('prospect_assignments').select('prospect_id').eq('user_id', profile.id);
        myIds = (assigned||[]).map(a => a.prospect_id);
        if (myIds.length === 0) { setEvents([]); setAudits([]); setLoading(false); return; }
      }
      // Fetch poses
      let qPose = supabase
        .from('prospects')
        .select('id, company_name, first_name, last_name, city, address, postal_code, phone, date_pose, status_id, installer_id, installer:installers(name), status:statuses(name,color), ca_previsionnel, ca_reel')
        .not('date_pose', 'is', null)
        .order('date_pose', { ascending: true });
      if (myIds) qPose = qPose.in('id', myIds);
      // Fetch audits
      let qAudit = supabase
        .from('prospects')
        .select('id, company_name, first_name, last_name, city, address, postal_code, phone, date_audit, status_id, installer_id, installer:installers(name), status:statuses(name,color), product_id')
        .not('date_audit', 'is', null)
        .order('date_audit', { ascending: true });
      if (myIds) qAudit = qAudit.in('id', myIds);

      const [poseRes, auditRes] = await Promise.all([qPose, qAudit]);
      if (poseRes.error) throw poseRes.error;
      if (auditRes.error) throw auditRes.error;
      setEvents(poseRes.data || []);
      setAudits(auditRes.data || []);
    } catch (e) {
      warn('Planning fetch error:', e);
      setEvents([]);
      setAudits([]);
    } finally {
      setLoading(false);
    }
  }, [profile, isAdmin]);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  // Realtime
  useEffect(() => {
    if (!profile) return;
    let rt = null;
    const df = () => { clearTimeout(rt); rt = setTimeout(fetchEvents, 600); };
    const ch = supabase.channel('planning_rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'prospects' }, df)
      .subscribe();
    return () => { clearTimeout(rt); supabase.removeChannel(ch); };
  }, [profile, fetchEvents]);

  return { events, audits, loading, refresh: fetchEvents };
}

/* ============================
   HOOK: useDevisStats (CA prévisionnel + CA réel by status)
   ============================ */
export function useDevisStats() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const { profile } = useAuth();

  const fetchDevisStats = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('prospects')
        .select('status_id, product_id, category_id, installer_id, ca_previsionnel, ca_reel, commission_pac, commission_admin, commission_telepro, commission_fournisseur, categorie_aide, zone_climatique, surface_batiment, surface_habitable, surface_mur_interieur, surface_mur_exterieur, surface_fenetre, surface_sous_sol, surface_comble, iti_option, is_ile_de_france, nb_personnes_foyer, revenu_fiscal_ref, created_at, updated_at, is_client, transmis_installateur, created_by');
      if (error) throw error;
      setRows((data || []).map(r => ({
        ...r,
        _ca: parseFloat(r.ca_previsionnel) || 0,
        _reel: parseFloat(r.ca_reel) || 0,
        _commPac: parseFloat(r.commission_pac) || 0,
        _commIti: (parseFloat(r.commission_admin) || 0) + (parseFloat(r.commission_telepro) || 0) + (parseFloat(r.commission_fournisseur) || 0),
      })));
    } catch (e) {
      warn('DevisStats error:', e);
    } finally {
      setLoading(false);
    }
  }, [profile]);

  useEffect(() => { fetchDevisStats(); }, [fetchDevisStats]);

  useEffect(() => {
    if (!profile) return;
    let rt = null;
    const df = () => { clearTimeout(rt); rt = setTimeout(fetchDevisStats, 1000); };
    const ch = supabase.channel('devis_stats_rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'prospects' }, df)
      .subscribe();
    return () => { clearTimeout(rt); supabase.removeChannel(ch); };
  }, [profile, fetchDevisStats]);

  return { rows, loading, refresh: fetchDevisStats };
}

/* ============================
   HOOK: useGlobalTimeline (all activity logs with full context)
   ============================ */
export function useGlobalTimeline(limit = 300) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const { profile } = useAuth();

  const fetchLogs = useCallback(async () => {
    if (!profile || profile.role !== 'admin') { setLoading(false); return; }
    try {
      const { data, error } = await supabase
        .from('activity_logs')
        .select('*, profile:profiles!activity_logs_user_profile_fk(id, first_name, last_name, email, role)')
        .order('created_at', { ascending: false })
        .limit(limit);
      if (error) {
        // Fallback without profile join
        const { data: d2 } = await supabase.from('activity_logs').select('*').order('created_at', { ascending: false }).limit(limit);
        setLogs(d2 || []);
      } else {
        setLogs(data || []);
      }
    } catch (e) { warn('Timeline:', e); }
    finally { setLoading(false); }
  }, [profile, limit]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  // Realtime
  useEffect(() => {
    if (!profile || profile.role !== 'admin') return;
    let rt = null;
    const df = () => { clearTimeout(rt); rt = setTimeout(fetchLogs, 500); };
    const ch = supabase.channel('timeline_rt')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'activity_logs' }, df)
      .subscribe();
    return () => { clearTimeout(rt); supabase.removeChannel(ch); };
  }, [profile, fetchLogs]);

  return { logs, loading, refresh: fetchLogs };
}

/* ============================
   HOOK: useAlerts (missed reminders, dormant prospects, stuck pipeline)
   ============================ */
export function useAlerts() {
  const [alerts, setAlerts] = useState({ missedReminders: [], dormantProspects: [], stuckProspects: [], recentLogins: [], stats: {} });
  const [loading, setLoading] = useState(true);
  const { profile } = useAuth();

  const fetchAlerts = useCallback(async () => {
    if (!profile || profile.role !== 'admin') { setLoading(false); return; }
    try {
      // 1. Missed reminders (due_date < now, not completed)
      const now = new Date().toISOString();
      const { data: missed } = await supabase.from('reminders')
        .select('*, profile:profiles!reminders_user_id_fkey(first_name, last_name)')
        .lt('due_date', now).or('completed.is.null,completed.eq.false')
        .order('due_date', { ascending: false }).limit(50);

      // 2. Prospects without activity in 7+ days
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const { data: dormant } = await supabase.from('prospects')
        .select('id, company_name, first_name, last_name, updated_at, status:statuses(name, color)')
        .lt('updated_at', sevenDaysAgo).eq('is_client', false)
        .order('updated_at', { ascending: true }).limit(30);

      // 3. Recent logins (last 50 login events)
      const { data: logins } = await supabase.from('activity_logs')
        .select('*, profile:profiles!activity_logs_user_profile_fk(first_name, last_name, email)')
        .eq('action', 'login')
        .order('created_at', { ascending: false }).limit(50);

      // 4. Activity stats (last 24h, 7d, 30d)
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const { data: recentLogs } = await supabase.from('activity_logs')
        .select('action, user_id, created_at')
        .gte('created_at', thirtyDaysAgo);

      // Compute stats
      const now24 = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const now7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const stats = { 
        actions_24h: 0, actions_7d: 0, actions_30d: 0,
        logins_24h: 0, logins_7d: 0,
        views_24h: 0, views_7d: 0,
        creates_7d: 0, updates_7d: 0, notes_7d: 0, status_changes_7d: 0,
        by_user_7d: {}, by_action_7d: {},
        hourly_7d: Array(24).fill(0)
      };
      (recentLogs || []).forEach(l => {
        const d = new Date(l.created_at);
        stats.actions_30d++;
        if (d >= now7d) {
          stats.actions_7d++;
          const uid = l.user_id;
          stats.by_user_7d[uid] = (stats.by_user_7d[uid] || 0) + 1;
          stats.by_action_7d[l.action] = (stats.by_action_7d[l.action] || 0) + 1;
          stats.hourly_7d[d.getHours()]++;
          if (l.action === 'create') stats.creates_7d++;
          if (l.action === 'update') stats.updates_7d++;
          if (l.action === 'note') stats.notes_7d++;
          if (l.action === 'status_change') stats.status_changes_7d++;
          if (l.action === 'login') stats.logins_7d++;
          if (l.action === 'view') stats.views_7d++;
        }
        if (d >= now24) {
          stats.actions_24h++;
          if (l.action === 'login') stats.logins_24h++;
          if (l.action === 'view') stats.views_24h++;
        }
      });

      setAlerts({
        missedReminders: missed || [],
        dormantProspects: dormant || [],
        recentLogins: logins || [],
        stats
      });
    } catch (e) { warn('Alerts:', e); }
    finally { setLoading(false); }
  }, [profile]);

  useEffect(() => { fetchAlerts(); }, [fetchAlerts]);

  return { alerts, loading, refresh: fetchAlerts };
}

// =====================================================
// PRESENCE — real-time online status
// =====================================================
export function usePresence(userId, userInfo) {
  const [onlineUsers, setOnlineUsers] = useState({});

  useEffect(() => {
    if (!userId) return;
    const channel = supabase.channel('crm-presence', {
      config: { presence: { key: userId } }
    });

    channel.on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState();
      const online = {};
      Object.entries(state).forEach(([key, presences]) => {
        if (presences.length > 0) online[key] = { ...presences[0], online: true };
      });
      setOnlineUsers(online);
    });

    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await channel.track({
          user_id: userId,
          first_name: userInfo?.first_name || '',
          last_name: userInfo?.last_name || '',
          online_at: new Date().toISOString()
        });
      }
    });

    // Heartbeat every 30s to keep presence alive
    const hb = setInterval(() => {
      channel.track({
        user_id: userId,
        first_name: userInfo?.first_name || '',
        last_name: userInfo?.last_name || '',
        online_at: new Date().toISOString()
      });
    }, 30000);

    return () => { clearInterval(hb); channel.unsubscribe(); };
  }, [userId, userInfo?.first_name, userInfo?.last_name]);

  return onlineUsers;
}

/* ============================
   HOOK: useChat (realtime chat by channel)
   ============================ */
export function useChat(channel) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const { profile } = useAuth();

  const fetchMessages = useCallback(async () => {
    if (!profile || !channel) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*, profile:profiles(id, first_name, last_name, role)')
        .eq('channel', channel)
        .order('created_at', { ascending: true })
        .limit(200);
      if (error) throw error;
      setMessages(data || []);
    } catch (e) {
      if (import.meta.env.DEV) console.warn('Chat fetch error:', e);
    } finally {
      setLoading(false);
    }
  }, [profile, channel]);

  useEffect(() => { fetchMessages(); }, [fetchMessages]);

  // Realtime subscription
  useEffect(() => {
    if (!profile || !channel) return;
    let debounce = null;
    const ch = supabase.channel(`chat_${channel}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `channel=eq.${channel}` }, payload => {
        // Immediate optimistic insert with profile data
        clearTimeout(debounce);
        debounce = setTimeout(fetchMessages, 300);
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'chat_messages' }, () => {
        clearTimeout(debounce);
        debounce = setTimeout(fetchMessages, 300);
      })
      .subscribe();
    return () => { clearTimeout(debounce); supabase.removeChannel(ch); };
  }, [profile, channel, fetchMessages]);

  const sendMessage = useCallback(async (content) => {
    if (!profile || !content.trim()) return;
    const { error } = await supabase.from('chat_messages').insert([{
      channel, user_id: profile.id, content: content.trim()
    }]);
    if (error) throw error;
  }, [profile, channel]);

  const deleteMessage = useCallback(async (id) => {
    const { error } = await supabase.from('chat_messages').delete().eq('id', id);
    if (error) throw error;
  }, []);

  return { messages, loading, sendMessage, deleteMessage, refresh: fetchMessages };
}