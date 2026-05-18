import React, { useState, useMemo, useCallback, memo, useEffect, useRef } from 'react';
import {
  Users, BarChart3, Settings, UserCheck, Search, Plus, X, Edit, Trash2,
  ChevronLeft, ChevronRight, LogOut, Tag, FolderOpen, Check, AlertCircle, Building2,
  FileText, Send, Upload, UserPlus, UserMinus, RotateCcw, Eye, Copy, RefreshCw,
  Save, Package, Phone, Mail, MapPin, Calendar, Bell, BellRing, Clock, ChevronDown,
  ArrowUp, ArrowDown, Image, Paperclip, CheckCircle, XCircle, History, Filter, Map,
  List, Loader2, Navigation, Truck, Crown, CalendarDays, CalendarCheck, Euro,
  Sun, Moon, Layers, ArrowUpRight, ArrowDownRight, Award, Zap, Activity,
  Trophy, Banknote, GitBranch, AlertTriangle, LogIn, Shield, UserX, Timer,
  MessageSquare, Hash, Lock, Briefcase
} from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './theme-light.css';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { supabase } from './lib/supabase';
import {
  useProspects, useCounts, useReferenceData, useNotes, useDocuments, useReminders,
  useActivityLog, useMapData, useSiretLookup, useAddressSearch, useUserStats, useDiagnostic,
  usePlanning, useDevisStats, useSites, logEnhanced, useGlobalTimeline, useAlerts, usePresence,
  useChat, useUnreadChat
} from './hooks/useData';

// =====================================================
// UTILITIES
// =====================================================
const formatDate = d => d ? new Date(d).toLocaleDateString('fr-FR') : '—';
const formatDateTime = d => d ? new Date(d).toLocaleString('fr-FR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' }) : '—';
const formatRelative = d => {
  if (!d) return '—';
  const diff = Date.now() - new Date(d).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "à l'instant";
  if (m < 60) return `il y a ${m}min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `il y a ${h}h`;
  const days = Math.floor(h / 24);
  if (days < 7) return `il y a ${days}j`;
  return formatDate(d);
};
const cn = (...c) => c.filter(Boolean).join(' ');
const formatSize = b => { if (!b) return ''; if (b < 1024) return b+' o'; if (b < 1048576) return (b/1024).toFixed(0)+' Ko'; return (b/1048576).toFixed(1)+' Mo'; };
const isImg = m => m && m.startsWith('image/');
const actionLabels = { create:'Création', update:'Modification', delete:'Suppression', status_change:'Statut modifié', assign:'Attribution', unassign:'Retrait', note:'Note ajoutée', document:'Document ajouté' };
const logoUrl = '/logo.png';

// Grille tarifaire devis automatique
const TARIFS = [
  { installer:'verlaine', typeLed:'led_cloche', mode:'installation', secteur:'animaux', prix:5 },
  { installer:'verlaine', typeLed:'led_cloche', mode:'installation', secteur:'commerce', prix:15 },
  { installer:'verlaine', typeLed:'led_cloche', mode:'installation', secteur:'agriculture', prix:15 },
  { installer:'enerlia', typeLed:'led_cloche', mode:'installation', secteur:'commerce', prix:15 },
  { installer:'enerlia', typeLed:'led_cloche', mode:'installation', secteur:'agriculture', prix:15 },
  { installer:'enerlia', typeLed:'led_reglette', mode:'installation', secteur:'commerce', prix:10 },
  { installer:'enerlia', typeLed:'led_reglette', mode:'installation', secteur:'agriculture', prix:10 },
  { installer:'enerlia', typeLed:'led_cloche', mode:'livraison', secteur:'commerce', prix:18 },
  { installer:'enerlia', typeLed:'led_cloche', mode:'livraison', secteur:'agriculture', prix:18 },
  { installer:'bts', typeLed:'led_cloche', mode:'installation', secteur:'commerce', prix:12 },
  { installer:'bts', typeLed:'led_cloche', mode:'installation', secteur:'agriculture', prix:12 },
  { installer:'neo', typeLed:'led_cloche', mode:'installation', secteur:'commerce', prix:20 },
  { installer:'neo', typeLed:'led_cloche', mode:'installation', secteur:'agriculture', prix:5 },
];
const SECTEUR_MAP = { agriculteur:'agriculture', agricultrice:'agriculture', agri:'agriculture', commerce:'commerce', commerçant:'commerce', commercial:'commerce', animaux:'animaux', animal:'animaux', élevage:'animaux', elevage:'animaux' };
const normSecteur = s => { if (!s) return ''; const k = s.toLowerCase().trim(); return SECTEUR_MAP[k] || k; };
const calcDevis = (installerName, typeLed, modePose, secteur, nbLed) => {
  if (!installerName || !typeLed || !modePose || !secteur || !nbLed) return null;
  const instKey = installerName.toLowerCase().trim();
  const secNorm = normSecteur(secteur);
  const tarif = TARIFS.find(t => instKey.includes(t.installer) && t.typeLed === typeLed && t.mode === modePose && t.secteur === secNorm);
  return tarif ? tarif.prix * parseInt(nbLed) : null;
};
const typeLedLabels = { led_cloche: 'LED Cloche', led_reglette: 'LED Réglette' };
const modePoseLabels = { installation: 'Installation', livraison: 'Livraison' };

// Barème des plafonds de ressources MaPrimeRénov' pour calcul catégorie aide
const BAREME_IDF = [
  { personnes: 1, bleu: 24031, jaune: 29253, violet: 40851 },
  { personnes: 2, bleu: 35270, jaune: 42933, violet: 60051 },
  { personnes: 3, bleu: 42357, jaune: 51564, violet: 71846 },
  { personnes: 4, bleu: 49455, jaune: 60208, violet: 84562 },
  { personnes: 5, bleu: 56580, jaune: 68877, violet: 96817 },
];
const BAREME_IDF_SUPP = { bleu: 7116, jaune: 8663, violet: 12257 };
const BAREME_HORS_IDF = [
  { personnes: 1, bleu: 17363, jaune: 22259, violet: 31185 },
  { personnes: 2, bleu: 25393, jaune: 32553, violet: 45842 },
  { personnes: 3, bleu: 30540, jaune: 39148, violet: 55196 },
  { personnes: 4, bleu: 35676, jaune: 45735, violet: 64550 },
  { personnes: 5, bleu: 40835, jaune: 52348, violet: 73907 },
];
const BAREME_HORS_IDF_SUPP = { bleu: 5151, jaune: 6598, violet: 9357 };

const calcCategorieAide = (nbPersonnes, revenuFiscal, isIDF) => {
  if (!nbPersonnes || !revenuFiscal || nbPersonnes < 1) return null;
  const nb = parseInt(nbPersonnes);
  const rev = parseFloat(revenuFiscal);
  if (isNaN(nb) || isNaN(rev)) return null;
  const bareme = isIDF ? BAREME_IDF : BAREME_HORS_IDF;
  const supp = isIDF ? BAREME_IDF_SUPP : BAREME_HORS_IDF_SUPP;
  let plafonds;
  if (nb <= 5) {
    plafonds = bareme.find(b => b.personnes === nb);
  } else {
    const base = bareme.find(b => b.personnes === 5);
    const extra = nb - 5;
    plafonds = { bleu: base.bleu + extra * supp.bleu, jaune: base.jaune + extra * supp.jaune, violet: base.violet + extra * supp.violet };
  }
  if (!plafonds) return null;
  if (rev <= plafonds.bleu) return 'bleu';
  if (rev <= plafonds.jaune) return 'jaune';
  if (rev <= plafonds.violet) return 'violet';
  return 'rose';
};
const categorieAideLabels = { bleu: 'Très modeste', jaune: 'Modeste', violet: 'Intermédiaire', rose: 'Aisé' };
const categorieAideColors = { bleu: '#3B82F6', jaune: '#EAB308', violet: '#8B5CF6', rose: '#EC4899' };
const getProductCode = (prospect, products) => {
  const p = prospect?.product || (prospect?.product_id && products?.find(pr => pr.id === prospect.product_id));
  if (!p) return null;
  const name = (p.name || '').toLowerCase().trim();
  // Destratificateur tertiaire
  if (name.includes('destrat') && name.includes('tertiaire')) return 'destrat_tertiaire';
  // Destratificateur industriel
  if (name.includes('destrat') && name.includes('industriel')) return 'destrat_industriel';
  // Déshumidificateur serre agricole
  if (name.includes('deshumidifi') || name.includes('déshumidifi')) return 'deshumidificateur';
  // VMC serre agricole
  if (name.includes('vmc') && name.includes('serre')) return 'vmc_serre';
  // Haute pression flottante
  if (name.includes('haute') && name.includes('pression')) return 'haute_pression';
  // ITI — y compris codes CEE : BAR-TH-174 (ITI murs int.), BAR-EN-101 (combles), BAR-EN-103 (planchers), BAR-EN-102 (ITE)
  if (name.includes('iti') || name.includes('ite') || name.includes('isolation') || name.includes('174') || name.includes('101') || name.includes('102') || name.includes('103')) return 'iti';
  // PAC — y compris codes CEE : BAR-TH-171 (PAC air/eau), BAR-TH-143 (solaire combi), BAR-TH-148 (CET)
  if (name.includes('pac') || name.includes('pompe') || name.includes('split') || name.includes('171') || name.includes('143') || name.includes('148')) return 'pac';
  if (name.includes('led')) return 'led';
  return null;
};

// Calcul d'éligibilité automatique par produit
const checkEligibility = (pCode, form) => {
  if (!pCode) return null;
  const reasons = [];
  if (pCode === 'destrat_tertiaire' || pCode === 'destrat_industriel') {
    const minPuissance = pCode === 'destrat_tertiaire' ? 200 : 400;
    if (form.batiment_chauffe === 'non') reasons.push('Bâtiment non chauffé');
    if (form.type_chauffage && form.type_chauffage !== 'gaz' && form.type_chauffage !== 'fuel') reasons.push('Chauffage ni gaz ni fuel');
    if (form.puissance_chauffage && parseFloat(form.puissance_chauffage) < minPuissance) reasons.push(`Puissance < ${minPuissance} kW`);
    if (form.hauteur_sous_plafond && parseFloat(form.hauteur_sous_plafond) < 5) reasons.push('Hauteur sous plafond < 5m');
    const filled = form.batiment_chauffe && form.type_chauffage && form.puissance_chauffage && form.hauteur_sous_plafond;
    if (!filled) return { status: 'incomplete', label: 'Infos manquantes', reasons: [] };
    return reasons.length > 0 ? { status: 'non_eligible', label: 'NON ÉLIGIBLE', reasons } : { status: 'eligible', label: 'ÉLIGIBLE DESTRATIFICATEUR', reasons: [] };
  }
  if (pCode === 'haute_pression') {
    if (!form.groupe_froid_existant) reasons.push('Pas de groupe froid');
    if (form.surface_groupe_froid && parseFloat(form.surface_groupe_froid) < 15) reasons.push('Surface groupe froid < 15 m²');
    if (form.puissance_electrique && parseFloat(form.puissance_electrique) < 50) reasons.push('Puissance < 50 kW');
    const filled = form.groupe_froid_existant !== undefined && form.surface_groupe_froid && form.puissance_electrique;
    if (!filled) return { status: 'incomplete', label: 'Infos manquantes', reasons: [] };
    return reasons.length > 0 ? { status: 'non_eligible', label: 'NON ÉLIGIBLE', reasons } : { status: 'eligible', label: 'ÉLIGIBLE HP FLOTTANTE', reasons: [] };
  }
  if (pCode === 'vmc_serre' || pCode === 'deshumidificateur') {
    if (form.surface_serre && parseFloat(form.surface_serre) < 1000) reasons.push('Surface serre < 1 000 m²');
    if (form.serre_electrifiee === false) reasons.push('Serre non électrifiée');
    if (form.type_serre === 'horticole') reasons.push('Serre horticole (maraîchère requise)');
    if (form.deja_prime_cee_deshumidificateur) reasons.push('Prime CEE déjà perçue');
    const filled = form.surface_serre && form.serre_electrifiee !== undefined && form.type_serre;
    if (!filled) return { status: 'incomplete', label: 'Infos manquantes', reasons: [] };
    return reasons.length > 0 ? { status: 'non_eligible', label: 'NON ÉLIGIBLE', reasons } : { status: 'eligible', label: pCode === 'vmc_serre' ? 'ÉLIGIBLE VMC SERRE' : 'ÉLIGIBLE DÉSHUMIDIFICATEUR', reasons: [] };
  }
  return null;
};

// Mapping Type de site / activité → Produit recommandé (basé sur la Fiche PRO)
const TYPES_SITE_ACTIVITE = [
  { value: 'usine', label: 'Usine', product: 'destrat_industriel' },
  { value: 'site_production', label: 'Site de Production', product: 'destrat_industriel' },
  { value: 'ateliers', label: 'Ateliers', product: 'destrat_industriel' },
  { value: 'metallerie', label: 'Métallerie', product: 'destrat_industriel' },
  { value: 'plastique', label: 'Plastique', product: 'destrat_industriel' },
  { value: 'autres_chaine_production', label: 'AUTRES Chaîne de production', product: 'destrat_tertiaire' },
  { value: 'lieu_sportif', label: 'Lieu sportif', product: 'destrat_tertiaire' },
  { value: 'commerce', label: 'Commerce', product: 'destrat_tertiaire' },
  { value: 'carrosserie', label: 'Carrosserie', product: 'destrat_tertiaire' },
  { value: 'garage', label: 'Garage', product: 'destrat_tertiaire' },
  { value: 'autres_commerces', label: 'AUTRES COMMERCES', product: 'destrat_tertiaire' },
  { value: 'stockage_surgele', label: 'Stockage Surgelé', product: 'haute_pression' },
  { value: 'agriculteur', label: 'Agriculteur', product: 'haute_pression' },
  { value: 'supermarche', label: 'Supermarché', product: 'haute_pression' },
  { value: 'data_center', label: 'Data Center', product: 'haute_pression' },
  { value: 'logistique', label: 'Logistique', product: 'haute_pression' },
  { value: 'autres_groupe_froid', label: 'AUTRES Groupe de froid', product: 'haute_pression' },
  { value: 'serres_maraicheres', label: 'Serres agricoles / maraîchères', product: 'vmc_serre' },
  { value: 'entrepot_stockage', label: 'Entrepôt de stockage', product: null },
];

const PRODUCT_LABELS = {
  destrat_industriel: 'DESTRATIFICATEUR INDUSTRIEL',
  destrat_tertiaire: 'DESTRATIFICATEUR TERTIAIRE',
  haute_pression: 'HP FLOTTANTE',
  vmc_serre: 'DÉSHUMIDIFICATEUR ou VMC',
};

const getRecommendedProduct = (typeSite) => {
  if (!typeSite) return null;
  const found = TYPES_SITE_ACTIVITE.find(t => t.value === typeSite);
  return found || null;
};

// Zone climatique par département (code postal → 2 premiers chiffres → département)
const ZONE_H1_DEPTS = ['01','02','03','05','08','10','14','15','19','21','23','25','27','28','38','39','42','43','45','51','52','54','55','57','58','59','60','61','62','63','67','68','69','70','71','73','74','75','76','77','78','80','87','88','89','90','91','92','93','94','95'];
const ZONE_H2_DEPTS = ['04','07','09','12','16','17','18','22','24','26','29','31','32','33','35','36','37','40','41','44','46','47','48','49','50','53','56','64','65','72','79','81','82','84','85','86'];
const ZONE_H3_DEPTS = ['06','11','13','20','2A','2B','30','34','66','83'];

const getZoneClimatique = (postalCode) => {
  if (!postalCode || postalCode.length < 2) return null;
  let dept = postalCode.substring(0, 2);
  // Corse: 20xxx → H3
  if (ZONE_H1_DEPTS.includes(dept)) return 'H1';
  if (ZONE_H2_DEPTS.includes(dept)) return 'H2';
  if (ZONE_H3_DEPTS.includes(dept)) return 'H3';
  return null;
};

const zoneColors = { H1: '#3B82F6', H2: '#F59E0B', H3: '#EF4444' };

// Commission et reste à charge PAC auto-calculé selon catégorie aide + zone climatique
const calcPacCommission = (categorie, zone) => {
  if (!categorie || !zone) return null;
  if (categorie === 'bleu' && zone === 'H1') return { reste_a_charge: 1, commission: 3000 };
  if (categorie === 'bleu' && (zone === 'H2' || zone === 'H3')) return { reste_a_charge: 1, commission: 2500 };
  if (categorie === 'jaune' && zone === 'H1') return { reste_a_charge: 2500, commission: 2000 };
  if (categorie === 'jaune' && (zone === 'H2' || zone === 'H3')) return { reste_a_charge: 3000, commission: 2000 };
  return null;
};

// Détermine si une combinaison ITI Jaune requiert un choix Option A / Option B
const itiNeedsOption = (categorie, surfaceHabitable, surfaceIsoler) => {
  if (categorie !== 'jaune') return false;
  const h = Number(surfaceHabitable) || 0;
  const i = Number(surfaceIsoler) || 0;
  // Jaune 90-110 m² et -160 m² à isoler → Option A ou B
  if (h >= 90 && h < 110 && i > 0 && i < 160) return true;
  // Jaune 110-130 m² et +160 m² à isoler → Option A ou B
  if (h >= 110 && h < 130 && i >= 160) return true;
  return false;
};

// Commission et reste à charge ITI (BAR-TH-174) selon 22 règles
// Retourne { rac, commission } — la commission est la valeur totale du dossier (ex: 1200 €)
const calcItiCommission = (categorie, surfaceHabitable, surfaceIsoler, option) => {
  if (!categorie || !surfaceHabitable || !surfaceIsoler) return null;
  const h = Number(surfaceHabitable);
  const i = Number(surfaceIsoler);
  if (h <= 0 || i <= 0) return null;
  const isPlus = i >= 160;

  // 🔵 BLEU — RAC 0 partout
  if (categorie === 'bleu') {
    if (h >= 60 && h < 90) return { rac: 0, commission: isPlus ? 1000 : 1200 };
    if (h >= 90 && h < 110) return { rac: 0, commission: isPlus ? 1200 : 1500 };
    if (h >= 110 && h < 130) return { rac: 0, commission: isPlus ? 1500 : 1800 };
    if (h >= 130) return { rac: 0, commission: isPlus ? 1800 : 2000 };
    return null;
  }

  // 🟡 JAUNE
  if (categorie === 'jaune') {
    if (h >= 60 && h < 90) {
      if (isPlus) return { rac: 10 * i, commission: 800 };
      return { rac: 1500, commission: 1000 };
    }
    if (h >= 90 && h < 110) {
      if (isPlus) return { rac: 1500, commission: 1000 };
      if (option === 'B') return { rac: 1000, commission: 1000 };
      return { rac: 0, commission: 500 };
    }
    if (h >= 110 && h < 130) {
      if (isPlus) {
        if (option === 'B') return { rac: 1000, commission: 1000 };
        return { rac: 0, commission: 500 };
      }
      return { rac: 0, commission: 1000 };
    }
    if (h >= 130) {
      if (isPlus) return { rac: 0, commission: 1000 };
      return { rac: 0, commission: 1200 };
    }
    return null;
  }

  // 🟣 VIOLET — RAC au m²
  if (categorie === 'violet') {
    if (h >= 60 && h < 90) return { rac: 30 * i, commission: 500 };
    if (h >= 90 && h < 110) return { rac: 20 * i, commission: 500 };
    if (h >= 110 && h < 130) return { rac: 15 * i, commission: 1000 };
    if (h >= 130) return { rac: 15 * i, commission: 800 };
    return null;
  }

  return null;
};

// Somme des 5 surfaces à isoler
const sumSurfacesIsoler = (f) => {
  const v = (k) => parseFloat(f[k]) || 0;
  return v('surface_mur_interieur') + v('surface_mur_exterieur') + v('surface_fenetre') + v('surface_sous_sol') + v('surface_comble');
};

// Types de chauffage existant
const typeChauffageOptions = [
  { value: 'pac_air_eau', label: 'PAC Air/Eau' },
  { value: 'pac_air_air', label: 'PAC Air/Air' },
  { value: 'electrique', label: 'Électrique' },
  { value: 'bois', label: 'Bois' },
  { value: 'gaz', label: 'Gaz' },
  { value: 'fuel', label: 'Fuel' },
];

const typeProjetOptions = [
  { value: 'pro', label: 'Professionnel' },
  { value: 'particulier', label: 'Particulier' },
];

const typeCibleOptions = [
  { value: 'stockage_surgele', label: 'Stockage surgelé' },
  { value: 'agriculteurs', label: 'Agriculteurs' },
  { value: 'supermarche', label: 'Supermarché' },
  { value: 'data_center', label: 'Data Center' },
  { value: 'logistique', label: 'Logistique' },
  { value: 'garage', label: 'Garage' },
  { value: 'lieu_sportif', label: 'Lieu sportif' },
  { value: 'commerce', label: 'Commerce' },
  { value: 'carrosserie', label: 'Carrosserie' },
  { value: 'usine', label: 'Usine' },
  { value: 'site_production', label: 'Site de production' },
  { value: 'ateliers', label: 'Ateliers' },
  { value: 'metallerie', label: 'Métallerie' },
  { value: 'plastique', label: 'Plastique' },
];

// =====================================================
// BASE COMPONENTS
// =====================================================
const Logo = memo(({ size = 36 }) => (
  <div className="flex items-center gap-2.5">
    <img src={logoUrl} alt="G" style={{ width: size, height: size }} className="object-contain" />
    <div><div className="font-extrabold text-white tracking-tight" style={{ fontSize: size*0.42 }}>RS CONSULTING</div><div className="text-[9px] text-slate-400 font-semibold tracking-[0.2em] uppercase -mt-0.5">CRM</div></div>
  </div>
));

const Alert = memo(({ alert, onClose }) => {
  useEffect(() => { if (alert) { const t = setTimeout(onClose, 3500); return () => clearTimeout(t); } }, [alert, onClose]);
  if (!alert) return null;
  return <div className={cn("fixed top-4 right-4 z-[100] px-5 py-3 rounded-xl shadow-2xl flex items-center gap-3 animate-slide-in text-white", alert.type==='success'?'bg-emerald-500':'bg-red-500')}>{alert.type==='success'?<Check className="w-5 h-5"/>:<AlertCircle className="w-5 h-5"/>}<span className="font-medium text-sm">{alert.message}</span></div>;
});

const Loading = memo(() => <div className="flex items-center justify-center h-screen bg-slate-900"><div className="text-center"><Logo size={64}/><div className="mt-6 flex items-center justify-center gap-2 text-slate-400"><Loader2 className="w-5 h-5 animate-spin"/><span>Chargement...</span></div></div></div>);

const Badge = memo(({ children, color, className, small }) => <span className={cn("inline-flex items-center px-2 rounded-full font-medium", small?"text-[10px] py-0":"text-xs py-0.5", className)} style={{ backgroundColor: color+'20', color }}>{children}</span>);

const Modal = memo(({ open, onClose, title, icon: Icon, children, size='md' }) => {
  if (!open) return null;
  const s = { sm:'max-w-md', md:'max-w-xl', lg:'max-w-3xl', xl:'max-w-5xl' };
  return <div className="fixed inset-0 z-50 flex items-start justify-center pt-[5vh] p-4 bg-black/60 overflow-y-auto" onClick={onClose}><div className={cn("bg-slate-800 rounded-2xl shadow-2xl w-full mb-8", s[size])} onClick={e=>e.stopPropagation()}><div className="flex items-center justify-between px-6 py-4 border-b border-slate-700"><div className="flex items-center gap-3">{Icon&&<Icon className="w-5 h-5 text-emerald-400"/>}<h2 className="text-lg font-semibold text-white">{title}</h2></div><button onClick={onClose} className="p-2 hover:bg-slate-700 rounded-lg"><X className="w-5 h-5 text-slate-400"/></button></div>{children}</div></div>;
});

const Btn = memo(({ children, onClick, variant='default', size='md', disabled, className, icon: Icon, ...p }) => {
  const v = { primary:'bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/20', danger:'bg-red-500 hover:bg-red-600 text-white', ghost:'hover:bg-slate-700 text-slate-400 hover:text-white', default:'bg-slate-700 hover:bg-slate-600 text-white' };
  const sz = { sm:'px-3 py-1.5 text-xs', md:'px-4 py-2 text-sm', lg:'px-5 py-3 text-sm' };
  return <button onClick={onClick} disabled={disabled} className={cn("inline-flex items-center gap-2 rounded-xl font-medium transition-all disabled:opacity-50 disabled:pointer-events-none", v[variant], sz[size], className)} {...p}>{Icon&&<Icon className={size==='sm'?'w-3.5 h-3.5':'w-4 h-4'}/>}{children}</button>;
});

const Input = memo(({ className, ...p }) => <input {...p} className={cn("px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-colors", className)} />);
const Select = memo(({ className, children, ...p }) => <select {...p} className={cn("px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm focus:border-emerald-500 outline-none", className)}>{children}</select>);

const FilterButton = memo(({ active, onClick, children, count, color }) => (
  <button onClick={onClick} className={cn("w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-sm transition-all", active?"bg-emerald-500/20 text-emerald-400":"hover:bg-slate-700/50 text-slate-300")}>
    <span className="flex items-center gap-2 truncate">{color&&<span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }}/>}<span className="truncate">{children}</span></span>
    {count!==undefined&&<span className={cn("px-1.5 py-0.5 rounded-full text-[10px] font-medium ml-1 flex-shrink-0", active?"bg-emerald-500 text-white":"bg-slate-700 text-slate-400")}>{count}</span>}
  </button>
));

const StatusDropdown = memo(({ currentId, statuses, onChange }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const cur = statuses.find(s => s.id === currentId);
  useEffect(() => { const h = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }; document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h); }, []);
  return <div ref={ref} className="relative">
    <button onClick={e=>{ e.stopPropagation(); setOpen(!open); }} className="flex items-center gap-1 group">{cur?<Badge color={cur.color}>{cur.name}</Badge>:<span className="text-slate-500 text-sm">—</span>}<ChevronDown className="w-3 h-3 text-slate-500 opacity-0 group-hover:opacity-100"/></button>
    {open&&<div className="absolute top-full left-0 mt-1 w-40 bg-slate-700 rounded-lg shadow-xl border border-slate-600 py-1 z-30">{statuses.map(s=><button key={s.id} onClick={e=>{ e.stopPropagation(); onChange(s.id); setOpen(false); }} className={cn("w-full px-3 py-1.5 text-left text-sm hover:bg-slate-600 flex items-center gap-2", s.id===currentId&&"bg-slate-600")}><span className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }}/>{s.name}</button>)}</div>}
  </div>;
});

// =====================================================
// ADDRESS AUTOCOMPLETE (API Adresse Data Gouv)
// =====================================================
const AddressAutocomplete = memo(({ value, onChange, onSelect, placeholder="Rechercher une adresse..." }) => {
  const [q, setQ] = useState(value || '');
  const [show, setShow] = useState(false);
  const { results, search, clear } = useAddressSearch();
  const ref = useRef(null);
  useEffect(() => { setQ(value || ''); }, [value]);
  useEffect(() => { const h = e => { if (ref.current && !ref.current.contains(e.target)) setShow(false); }; document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h); }, []);
  const handleInput = e => { const v = e.target.value; setQ(v); onChange?.(v); search(v); setShow(true); };
  const handleSelect = item => { setQ(item.label); setShow(false); clear(); onSelect?.(item); };
  return <div ref={ref} className="relative">
    <div className="relative"><MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"/><Input value={q} onChange={handleInput} placeholder={placeholder} className="w-full pl-10 pr-4" onFocus={() => results.length>0 && setShow(true)}/></div>
    {show&&results.length>0&&<div className="absolute top-full left-0 right-0 mt-1 bg-slate-700 rounded-lg shadow-xl border border-slate-600 py-1 z-40 max-h-48 overflow-auto">{results.map((r,i)=><button key={i} onClick={()=>handleSelect(r)} className="w-full px-3 py-2 text-left text-sm hover:bg-slate-600 text-white flex items-center gap-2"><Navigation className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0"/><span className="truncate">{r.label}</span></button>)}</div>}
  </div>;
});

// =====================================================
// MAP VIEW (Leaflet)
// =====================================================
const MapView = memo(({ markers, statuses, users, isAdmin, onSelect }) => {
  const mapRef = useRef(null);
  const inst = useRef(null);
  const layer = useRef(null);
  const [is3D, setIs3D] = useState(false);
  const glMapRef = useRef(null);
  const glInst = useRef(null);
  const [selStatuses, setSelStatuses] = useState(new Set());
  const [selUsers, setSelUsers] = useState(new Set());
  const [showFilters, setShowFilters] = useState(false);

  const toggleStatus = useCallback(id => setSelStatuses(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; }), []);
  const toggleUser = useCallback(id => setSelUsers(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; }), []);

  const filtered = useMemo(() => {
    let f = markers || [];
    if (selStatuses.size > 0) f = f.filter(m => selStatuses.has(m.status_id));
    if (selUsers.size > 0) f = f.filter(m => (m.assignedUserIds || []).some(uid => selUsers.has(uid)));
    return f;
  }, [markers, selStatuses, selUsers]);

  // 2D Leaflet map
  useEffect(() => {
    if (is3D || !mapRef.current || inst.current) return;
    const map = L.map(mapRef.current, { zoomControl: true }).setView([46.603354, 1.888334], 6);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap', maxZoom: 18 }).addTo(map);
    inst.current = map;
    layer.current = L.layerGroup().addTo(map);
    return () => { map.remove(); inst.current = null; };
  }, [is3D]);

  useEffect(() => {
    if (is3D || !inst.current || !layer.current) return;
    layer.current.clearLayers();
    if (!filtered || !filtered.length) return;
    const sm = {}; statuses.forEach(s => { sm[s.id] = s.color; });
    filtered.forEach(m => {
      if (!m.latitude || !m.longitude) return;
      const color = sm[m.status_id] || '#6B7280';
      const name = m.company_name || `${m.first_name||''} ${m.last_name||''}`.trim();
      const c = L.circleMarker([m.latitude, m.longitude], { radius: 7, fillColor: color, color: '#1e293b', weight: 2, fillOpacity: 0.85 });
      c.bindPopup(`<div style="font-family:Inter,sans-serif;min-width:140px"><strong>${name}</strong>${m.city?`<br><span style="color:#94a3b8;font-size:12px">${m.city}</span>`:''}</div>`);
      c.on('click', () => onSelect?.(m));
      c.addTo(layer.current);
    });
    const valid = filtered.filter(m => m.latitude && m.longitude);
    if (valid.length > 0) inst.current.fitBounds(L.latLngBounds(valid.map(m=>[m.latitude,m.longitude])), { padding:[30,30], maxZoom:13 });
  }, [filtered, statuses, is3D]);

  // 3D MapLibre GL map
  useEffect(() => {
    if (!is3D || !glMapRef.current) return;
    if (glInst.current) { glInst.current.remove(); glInst.current = null; }
    const loadMapLibre = async () => {
      if (!window.maplibregl) {
        const link = document.createElement('link'); link.rel='stylesheet'; link.href='https://cdnjs.cloudflare.com/ajax/libs/maplibre-gl/4.7.1/maplibre-gl.min.css'; document.head.appendChild(link);
        await new Promise((resolve, reject) => { const s=document.createElement('script'); s.src='https://cdnjs.cloudflare.com/ajax/libs/maplibre-gl/4.7.1/maplibre-gl.min.js'; s.onload=resolve; s.onerror=reject; document.head.appendChild(s); });
      }
      const maplibregl = window.maplibregl;
      const valid = (filtered||[]).filter(m => m.latitude && m.longitude);
      const center = valid.length > 0 ? [valid.reduce((s,m)=>s+m.longitude,0)/valid.length, valid.reduce((s,m)=>s+m.latitude,0)/valid.length] : [1.888334, 46.603354];
      const map = new maplibregl.Map({
        container: glMapRef.current,
        style: { version:8, sources:{ osm:{ type:'raster', tiles:['https://a.tile.openstreetmap.org/{z}/{x}/{y}.png','https://b.tile.openstreetmap.org/{z}/{x}/{y}.png'], tileSize:256, attribution:'© OpenStreetMap' }, satellite:{ type:'raster', tiles:['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'], tileSize:256, attribution:'© Esri' }}, layers:[{ id:'satellite', type:'raster', source:'satellite', minzoom:0, maxzoom:19 }, { id:'osm-overlay', type:'raster', source:'osm', minzoom:0, maxzoom:19, paint:{'raster-opacity':0.3} }] },
        center, zoom: valid.length > 0 ? 7 : 6, pitch: 60, bearing: -20, maxPitch: 85
      });
      map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right');
      const sm = {}; statuses.forEach(s => { sm[s.id] = s.color; });
      map.on('load', () => {
        valid.forEach(m => {
          const color = sm[m.status_id] || '#6B7280';
          const name = m.company_name || `${m.first_name||''} ${m.last_name||''}`.trim();
          const el = document.createElement('div');
          el.className = 'crm-marker-3d';
          el.style.cssText = `width:16px;height:16px;border-radius:50%;background:${color};border:2px solid #1e293b;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,0.4);`;
          const marker = new maplibregl.Marker({ element: el }).setLngLat([m.longitude, m.latitude])
            .setPopup(new maplibregl.Popup({ offset:10, closeButton:false }).setHTML(`<div style="font-family:Inter,sans-serif;padding:4px"><strong>${name}</strong>${m.city?`<br><span style="color:#666;font-size:12px">${m.city}</span>`:''}</div>`))
            .addTo(map);
          el.addEventListener('click', () => onSelect?.(m));
        });
        if (valid.length > 1) {
          const bounds = new maplibregl.LngLatBounds();
          valid.forEach(m => bounds.extend([m.longitude, m.latitude]));
          map.fitBounds(bounds, { padding:50, maxZoom:13, pitch:60 });
        }
      });
      glInst.current = map;
    };
    loadMapLibre().catch(e => console.warn('MapLibre 3D load error:', e));
    return () => { if (glInst.current) { glInst.current.remove(); glInst.current = null; } };
  }, [is3D, filtered, statuses]);

  const activeFilterCount = selStatuses.size + selUsers.size;

  return <div className="relative w-full h-full">
    {/* Map mode toggle */}
    <div className="absolute top-3 left-3 z-[500] flex gap-2">
      <div className="flex bg-slate-800 rounded-lg p-0.5 shadow-lg border border-slate-600">
        <button onClick={()=>{if(glInst.current){glInst.current.remove();glInst.current=null;} setIs3D(false);}} className={cn("px-3 py-1.5 rounded-md text-xs font-medium transition-colors", !is3D?'bg-emerald-500 text-white':'text-slate-400 hover:text-white')}>2D</button>
        <button onClick={()=>{if(inst.current){inst.current.remove();inst.current=null;} setIs3D(true);}} className={cn("px-3 py-1.5 rounded-md text-xs font-medium transition-colors", is3D?'bg-emerald-500 text-white':'text-slate-400 hover:text-white')}>3D</button>
      </div>
      <button onClick={()=>setShowFilters(f=>!f)} className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium shadow-lg border transition-colors", showFilters||activeFilterCount>0 ? "bg-emerald-500 text-white border-emerald-400" : "bg-slate-800 text-slate-300 border-slate-600 hover:text-white")}>
        <Filter className="w-3.5 h-3.5"/>Filtres{activeFilterCount>0&&<span className="bg-white/20 px-1.5 rounded-full text-[10px]">{activeFilterCount}</span>}
      </button>
      {activeFilterCount>0&&<button onClick={()=>{setSelStatuses(new Set());setSelUsers(new Set());}} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 shadow-lg"><RotateCcw className="w-3 h-3"/>Reset</button>}
    </div>

    {/* Filter panel */}
    {showFilters && <div className="absolute top-14 left-3 z-[500] bg-slate-800/95 backdrop-blur border border-slate-600 rounded-xl shadow-2xl p-4 w-72 max-h-[60vh] overflow-y-auto">
      <div className="mb-3">
        <div className="text-[10px] font-semibold text-slate-500 uppercase mb-2 flex items-center gap-1.5"><FolderOpen className="w-3 h-3"/> Statuts</div>
        <div className="flex flex-wrap gap-1.5">
          {statuses.map(s=><button key={s.id} onClick={()=>toggleStatus(s.id)} className={cn("inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-medium border transition-all", selStatuses.has(s.id) ? "border-white/30 shadow-sm" : "border-transparent opacity-60 hover:opacity-100")} style={{ backgroundColor: s.color+'25', color: s.color, borderColor: selStatuses.has(s.id) ? s.color : 'transparent' }}>
            <span className="w-2 h-2 rounded-full" style={{backgroundColor:s.color}}/>{s.name}
          </button>)}
        </div>
      </div>
      {isAdmin && users && users.length > 0 && <div>
        <div className="text-[10px] font-semibold text-slate-500 uppercase mb-2 flex items-center gap-1.5"><Users className="w-3 h-3"/> Assigné à</div>
        <div className="flex flex-wrap gap-1.5">
          {users.map(u=><button key={u.id} onClick={()=>toggleUser(u.id)} className={cn("inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[11px] font-medium border transition-all", selUsers.has(u.id) ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/50" : "bg-slate-700/50 text-slate-400 border-transparent hover:text-white")}>
            <span className={cn("w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold text-white", u.role==='admin'?"bg-emerald-500":"bg-blue-500")}>{u.first_name?.[0]}</span>
            {u.first_name} {u.last_name?.[0]}.
          </button>)}
        </div>
      </div>}
    </div>}

    {/* Counter */}
    <div className="absolute bottom-3 left-3 z-[500] bg-slate-800/90 backdrop-blur px-3 py-1.5 rounded-lg text-xs text-slate-300 border border-slate-600 shadow-lg">
      {filtered.filter(m=>m.latitude&&m.longitude).length} prospect(s) affichés
    </div>

    {!is3D && <div ref={mapRef} className="w-full h-full rounded-xl" style={{ minHeight:'400px' }}/>}
    {is3D && <div ref={glMapRef} className="w-full h-full rounded-xl" style={{ minHeight:'400px' }}/>}
  </div>;
});

const SingleMapView = memo(({ lat, lng, name }) => {
  const ref = useRef(null);
  useEffect(() => {
    if (!ref.current) return;
    const map = L.map(ref.current).setView([lat, lng], 15);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap' }).addTo(map);
    L.circleMarker([lat, lng], { radius: 10, fillColor: '#10b981', color: '#1e293b', weight: 3, fillOpacity: 0.9 }).addTo(map).bindPopup(`<strong>${name}</strong>`).openPopup();
    return () => map.remove();
  }, [lat, lng, name]);
  return <div ref={ref} className="w-full h-full"/>;
});

// =====================================================
// LOGIN
// =====================================================
const LoginPage = memo(() => {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  const [ld, setLd] = useState(false);
  const go = async e => { e.preventDefault(); setErr(''); setLd(true); try { await signIn(email, pw); } catch (er) { setErr(er.message); } finally { setLd(false); } };
  return <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4"><div className="w-full max-w-md">
    <div className="text-center mb-8"><Logo size={56}/></div>
    <form onSubmit={go} className="bg-slate-800 rounded-2xl p-8 shadow-xl border border-slate-700">
      <h1 className="text-2xl font-bold text-white mb-6 text-center">Connexion</h1>
      {err&&<div className="mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-400 text-sm">{err}</div>}
      <div className="space-y-4">
        <Input type="email" placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} className="w-full py-3" required/>
        <Input type="password" placeholder="Mot de passe" value={pw} onChange={e=>setPw(e.target.value)} className="w-full py-3" required/>
        <Btn variant="primary" size="lg" disabled={ld} className="w-full justify-center" type="submit">{ld?<><Loader2 className="w-4 h-4 animate-spin"/> Connexion...</>:'Se connecter'}</Btn>
      </div>
    </form>
  </div></div>;
});

// =====================================================
// MAIN APP
// =====================================================
const MainApp = memo(({ themeBtn }) => {
  const { profile, signOut, isAdmin } = useAuth();
  const {
    prospects, total, loading, error, params, refresh,
    setSearch, setFilter, setPage, setSort, resetFilters,
    addProspect, updateProspect, quickUpdateStatus, deleteProspect, duplicateProspect,
    assignUser, unassignUser, bulkAssign, bulkUnassign, bulkUpdateStatus, bulkUpdateSource, bulkDelete,
    importProspects
  } = useProspects();
  const { counts, refresh: refreshCounts } = useCounts();
  const {
    categories, statuses, products, installers, sources, profiles: users, refresh: refreshRef,
    addCategory, updateCategory, deleteCategory, addStatus, updateStatus, deleteStatus,
    addProduct, updateProduct, deleteProduct, addInstaller, updateInstaller, deleteInstaller,
    addSource, updateSource, deleteSource,
    updateUserRole, deactivateUser, activateUser
  } = useReferenceData();
  const { reminders, overdueCount, completeReminder: completeGR, deleteReminder: deleteGR, snoozeReminder: snoozeGR } = useReminders();
  const { markers } = useMapData(params);
  const { results: diagResults, runDiagnostic } = useDiagnostic();
  const onlineUsers = usePresence(profile?.id, profile);
  const unreadChat = useUnreadChat();
  const [chatToast, setChatToast] = useState(null); // { channel, pingKey }

  const [view, setView] = useState('list');
  const [mainView, setMainView] = useState('table');
  const [spId, setSpId] = useState(null);
  const [spFallback, setSpFallback] = useState(null);
  const [searchInput, setSearchInput] = useState('');
  const [selected, setSelected] = useState(new Set());
  const [modal, setModal] = useState(null);
  const [alert, setAlert] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const showAlert = useCallback((msg, type='success') => setAlert({ message: msg, type }), []);
  const clearAlert = useCallback(() => setAlert(null), []);
  const totalPages = Math.ceil(total / params.perPage);
  const activeUsers = users.filter(u => u.active);

  const selectedProspect = useMemo(() => {
    if (!spId) return null;
    return prospects.find(p => p.id === spId) || spFallback;
  }, [spId, prospects, spFallback]);

  // Build map: prospect_id → next pending reminder (cross-ref RPC data with live reminders)
  const reminderMap = useMemo(() => {
    const map = {};
    // Build a Set of completed reminder IDs from global state (most up-to-date)
    const completedIds = new Set(reminders.filter(r => r.completed).map(r => r.id));
    // From RPC data — but skip if it's been completed in live state
    prospects.forEach(p => {
      if (p.next_reminder && !completedIds.has(p.next_reminder.id)) {
        map[p.id] = p.next_reminder;
      }
    });
    // Fallback/override: from global reminders (always live)
    reminders.filter(r => !r.completed).sort((a,b) => new Date(a.due_date) - new Date(b.due_date)).forEach(r => {
      if (!map[r.prospect_id]) map[r.prospect_id] = r;
    });
    return map;
  }, [prospects, reminders]);

  useEffect(() => { if (spId) { const f = prospects.find(p => p.id === spId); if (f) setSpFallback(f); } }, [spId, prospects]);

  // Database health check
  const [dbError, setDbError] = useState(null);
  useEffect(() => {
    (async () => {
      try {
        const { error: testErr } = await supabase.from('profiles').select('id').limit(1);
        if (testErr) { setDbError(`DB: ${testErr.message}`); return; }
        if (isAdmin) {
          const { error: rpcErr } = await supabase.rpc('search_prospects', { p_search:'', p_page:1, p_per_page:1 });
          if (rpcErr) setDbError(`RPC: ${rpcErr.message}`);
        }
      } catch(e) { setDbError(e.message); }
    })();
  }, [isAdmin]);

  // Browser notifications — request permission
  useEffect(() => { if ('Notification' in window && Notification.permission==='default') Notification.requestPermission(); }, []);

  // In-app notification system — checks every 15s for reminders due within 15 min
  const lastNotifiedRef = useRef(new Set());
  const [activeNotifs, setActiveNotifs] = useState([]);

  // Auto-dismiss notifications after 30 seconds
  useEffect(() => {
    if (activeNotifs.length === 0) return;
    const timer = setTimeout(() => {
      setActiveNotifs(prev => prev.length > 0 ? prev.slice(1) : prev); // Remove oldest
    }, 30000);
    return () => clearTimeout(timer);
  }, [activeNotifs]);

  // Clean lastNotifiedRef when reminders are uncompleted (so they can re-notify)
  useEffect(() => {
    const pendingIds = new Set(reminders.filter(r => !r.completed).map(r => r.id));
    // Remove from notified set any IDs that are now pending (were uncompleted)
    lastNotifiedRef.current.forEach(id => {
      if (pendingIds.has(id)) {
        // Check if it's NOT currently in the upcoming/overdue window — if so, let it re-notify
        const rem = reminders.find(r => r.id === id);
        if (rem) {
          const due = new Date(rem.due_date).getTime();
          const now = Date.now();
          if (due > now + 15 * 60000) lastNotifiedRef.current.delete(id); // Not due yet, allow re-notify later
        }
      }
    });
  }, [reminders]);

  useEffect(() => {
    const checkReminders = () => {
      const now = Date.now();
      const in15 = now + 15 * 60000; // 15 minutes from now
      const upcoming = reminders.filter(r => {
        if (r.completed || lastNotifiedRef.current.has(r.id)) return false;
        const due = new Date(r.due_date).getTime();
        return due <= in15 && due > now - 60000; // Due within 15 min OR just passed (1 min grace)
      });
      const overdue = reminders.filter(r => {
        if (r.completed || lastNotifiedRef.current.has(r.id)) return false;
        return new Date(r.due_date).getTime() <= now;
      });
      const toNotify = [...upcoming, ...overdue].filter((r, i, a) => a.findIndex(x => x.id === r.id) === i);
      if (toNotify.length > 0) {
        toNotify.forEach(r => lastNotifiedRef.current.add(r.id));
        setActiveNotifs(prev => {
          const existingIds = new Set(prev.map(n => n.id));
          const newOnes = toNotify.filter(r => !existingIds.has(r.id));
          return [...prev, ...newOnes];
        });
        // Also send browser notification if permitted
        if ('Notification' in window && Notification.permission === 'granted') {
          toNotify.forEach(r => {
            const name = r.prospect?.company_name || `${r.prospect?.first_name||''} ${r.prospect?.last_name||''}`.trim() || 'Prospect';
            new Notification('🔔 RS CONSULTING — Rappel !', { body: `${r.message||'Rappel'}\n📋 ${name}`, icon: logoUrl, tag: `reminder-${r.id}` });
          });
        }
      }
    };
    checkReminders();
    const iv = setInterval(checkReminders, 15000); // Check every 15 seconds
    return () => clearInterval(iv);
  }, [reminders]);

  const dismissNotif = useCallback(id => setActiveNotifs(prev => prev.filter(n => n.id !== id)), []);

  // Chat toast: show ephemeral notification when a new chat message arrives (and user isn't currently in chat view/panel)
  const prevPingKeyRef = useRef(0);
  useEffect(() => {
    if (!unreadChat.pingKey || unreadChat.pingKey === prevPingKeyRef.current) return;
    prevPingKeyRef.current = unreadChat.pingKey;
    // Only toast if user isn't already viewing chat page
    if (view === 'chat') return;
    // Pick the channel with latest increase (first non-zero)
    const u = unreadChat.unread || {};
    const ch = ['general','iti','pac'].find(c => (u[c]||0) > 0) || 'general';
    setChatToast({ channel: ch, key: unreadChat.pingKey });
    // Auto-dismiss after 5s
    const t = setTimeout(() => setChatToast(null), 5000);
    // Play soft beep (optional, best-effort)
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = 'sine'; o.frequency.value = 880;
        g.gain.value = 0.04;
        o.connect(g); g.connect(ctx.destination);
        o.start();
        o.stop(ctx.currentTime + 0.12);
        setTimeout(() => ctx.close(), 250);
      }
    } catch {}
    // Browser notification if permitted & tab hidden
    if ('Notification' in window && Notification.permission === 'granted' && document.hidden) {
      try { new Notification('💬 Nouveau message', { body: `Nouveau message dans #${ch}`, icon: logoUrl, tag: `chat-${ch}` }); } catch {}
    }
    return () => clearTimeout(t);
  }, [unreadChat.pingKey, unreadChat.unread, view]);
  const handleNotifGoTo = useCallback((r) => {
    if (r.prospect_id) {
      setSpId(r.prospect_id);
      setSpFallback({ id: r.prospect_id, company_name: r.prospect?.company_name, first_name: r.prospect?.first_name, last_name: r.prospect?.last_name });
      setView('detail');
    }
    dismissNotif(r.id);
  }, [dismissNotif]);
  const handleNotifSnooze = useCallback(async (r) => {
    try { await snoozeGR(r.id, 15); lastNotifiedRef.current.delete(r.id); } catch(e) { showAlert('Erreur snooze rappel','error'); }
    dismissNotif(r.id);
  }, [snoozeGR, dismissNotif, showAlert]);

  const handleSearch = useCallback(v => { setSearchInput(v); setSearch(v); }, [setSearch]);
  const openProspect = useCallback(p => { setSpId(p.id); setSpFallback(p); setView('detail'); }, []);
  const closeProspect = useCallback(() => { setSpId(null); setSpFallback(null); setView('list'); }, []);

  const handleAdd = useCallback(async d => { await addProspect(d); setModal(null); showAlert('Prospect créé avec succès !'); refreshCounts(); }, [addProspect,showAlert,refreshCounts]);
  const handleUpdate = useCallback(async (id,d) => { try { await updateProspect(id,d); showAlert('Mis à jour'); refreshCounts(); } catch(e) { showAlert(e.message,'error'); } }, [updateProspect,showAlert,refreshCounts]);
  const handleQuickStatus = useCallback(async (id,sid) => { try { await quickUpdateStatus(id,sid,statuses); refreshCounts(); } catch(e) { showAlert(e.message,'error'); } }, [quickUpdateStatus,showAlert,statuses,refreshCounts]);
  const handleDelete = useCallback(async id => { if(!confirm('Supprimer ?')) return; try { await deleteProspect(id); closeProspect(); showAlert('Supprimé'); } catch(e) { showAlert(e.message,'error'); } }, [deleteProspect,closeProspect,showAlert]);
  const handleDuplicate = useCallback(async p => { try { await duplicateProspect(p); showAlert('Dupliqué'); } catch(e) { showAlert(e.message,'error'); } }, [duplicateProspect,showAlert]);
  const handleAssign = useCallback(async (pid,uid) => { try { await assignUser(pid,uid); showAlert('Assigné'); } catch(e) { showAlert(e.message,'error'); } }, [assignUser,showAlert]);
  const handleUnassign = useCallback(async (pid,uid) => { try { await unassignUser(pid,uid); showAlert('Retiré'); } catch(e) { showAlert(e.message,'error'); } }, [unassignUser,showAlert]);
  const handleBulkAssign = useCallback(async (uids,mode) => { try { await bulkAssign(Array.from(selected),uids,mode); setSelected(new Set()); setModal(null); showAlert(`${selected.size} attribués`); } catch(e) { showAlert(e.message,'error'); } }, [bulkAssign,selected,showAlert]);
  const handleBulkUnassign = useCallback(async (uids) => { try { await bulkUnassign(Array.from(selected), uids); refreshCounts(); setSelected(new Set()); setModal(null); showAlert('Désattribués'); } catch(e) { showAlert(e.message,'error'); } }, [bulkUnassign,selected,showAlert,refreshCounts]);
  const handleBulkStatus = useCallback(async sid => { try { await bulkUpdateStatus(Array.from(selected),sid,statuses); refreshCounts(); setSelected(new Set()); showAlert('Statuts mis à jour'); } catch(e) { showAlert(e.message,'error'); } }, [bulkUpdateStatus,selected,showAlert,statuses,refreshCounts]);
  const handleBulkSource = useCallback(async srcId => { try { await bulkUpdateSource(Array.from(selected), srcId, sources); refreshCounts(); setSelected(new Set()); showAlert('Provenance mise à jour'); } catch(e) { showAlert(e.message,'error'); } }, [bulkUpdateSource,selected,showAlert,sources,refreshCounts]);
  const handleBulkDelete = useCallback(async () => { if(!confirm(`Supprimer ${selected.size} prospects ?`)) return; try { await bulkDelete(Array.from(selected)); setSelected(new Set()); showAlert('Supprimés'); } catch(e) { showAlert(e.message,'error'); } }, [bulkDelete,selected,showAlert]);


  const handleImport = useCallback(async (data,mappings,catId,statusId,productId) => {
    try {
      const mapped = data.map(row => {
        let fn='', ln='';
        if (mappings.prenom) fn = row[mappings.prenom]||'';
        if (mappings.nom_famille) ln = row[mappings.nom_famille]||'';
        if (mappings.nom && !mappings.prenom && !mappings.nom_famille) { const p = (row[mappings.nom]||'').trim().split(/\s+/); fn=p[0]||''; ln=p.slice(1).join(' ')||''; }
        return { first_name:fn, last_name:ln, company_name:mappings.societe?row[mappings.societe]||null:null, siret:mappings.siret?row[mappings.siret]||null:null, phone:mappings.tel?row[mappings.tel]||null:null, email:mappings.mail?row[mappings.mail]||null:null, address:mappings.adresse?row[mappings.adresse]||null:null, postal_code:mappings.cp?row[mappings.cp]||null:null, city:mappings.ville?row[mappings.ville]||null:null, surface:mappings.surface?parseInt(row[mappings.surface])||null:null, nb_led:mappings.nb_led?parseInt(row[mappings.nb_led])||null:null };
      });
      const res = await importProspects(mapped,catId,statusId,productId);
      setModal(null);
      showAlert(`${res.success} importés${res.errors.length?` (${res.errors.length} erreurs)`:''}`);
    } catch(e) { showAlert(e.message,'error'); }
  }, [importProspects,showAlert]);

  const toggleSelect = useCallback(id => { setSelected(p => { const n=new Set(p); if(n.has(id)) n.delete(id); else n.add(id); return n; }); }, []);
  // Client-side source enrichment (RPC returns source object but enrich if missing)
  const displayProspects = useMemo(() => {
    const srcMap = Object.fromEntries((sources||[]).map(s => [s.id, s]));
    return prospects.map(p => p.source_id && !p.source && srcMap[p.source_id] ? { ...p, source: srcMap[p.source_id] } : p);
  }, [prospects, sources]);
  const selectAll = useCallback(() => { setSelected(s => s.size===displayProspects.length ? new Set() : new Set(displayProspects.map(p=>p.id))); }, [displayProspects]);
  const toggleFilter = useCallback((key,val) => { const c=params[key]||[]; setFilter(key, c.includes(val)?c.filter(x=>x!==val):[...c,val]); }, [params,setFilter]);

  // === DETAIL VIEW ===
  if (view==='detail' && selectedProspect) return <>
    <Alert alert={alert} onClose={clearAlert}/>
    <DetailPage prospect={selectedProspect} onClose={closeProspect} onUpdate={handleUpdate} onDelete={handleDelete}
      onDuplicate={handleDuplicate} onAssign={handleAssign} onUnassign={handleUnassign}
      categories={categories} statuses={statuses} products={products} installers={installers} sources={sources}
      users={activeUsers} isAdmin={isAdmin} userRole={profile?.role} onlineUsers={onlineUsers} showAlert={showAlert} onQuickStatus={handleQuickStatus} unreadChat={unreadChat}/>
  </>;
  if (view==='stats' && isAdmin) return <><Alert alert={alert} onClose={clearAlert}/><StatsPage onBack={()=>setView('list')} statuses={statuses} products={products} categories={categories} counts={counts} isAdmin={isAdmin} allUsers={users} onOpenProspect={openProspect} onlineUsers={onlineUsers}/></>;
  if (view==='activity') return <><Alert alert={alert} onClose={clearAlert}/><ActivityPage onBack={()=>setView('list')}/></>;
  if (view==='planning') return <><Alert alert={alert} onClose={clearAlert}/><PlanningPage onBack={()=>setView('list')} onOpenProspect={openProspect} reminders={reminders} isAdmin={isAdmin}/></>;
  if (view==='chat') return <><Alert alert={alert} onClose={clearAlert}/><ChatPage onBack={()=>setView('list')} allUsers={users} onlineUsers={onlineUsers} unreadChat={unreadChat}/></>;

  // === MAIN LIST VIEW ===
  return (
    <div className="h-screen flex bg-slate-900">
      <Alert alert={alert} onClose={clearAlert}/>
      {dbError&&<div className="fixed top-0 left-0 right-0 z-[99] bg-red-500/90 px-4 py-2 text-white text-xs flex items-center gap-2"><AlertCircle className="w-4 h-4"/><span><strong>Erreur DB :</strong> {dbError}</span><button onClick={()=>setDbError(null)} className="ml-auto hover:bg-red-400/50 rounded p-1"><X className="w-3.5 h-3.5"/></button></div>}


      {/* In-app reminder notifications — top right */}
      {activeNotifs.length>0 && <div className="fixed top-4 right-4 z-[200] space-y-3 max-w-sm">
        {activeNotifs.map(r => {
          const name = r.prospect?.company_name || `${r.prospect?.first_name||''} ${r.prospect?.last_name||''}`.trim() || 'Prospect';
          const isOverdue = new Date(r.due_date) <= new Date();
          return <div key={r.id} className="bg-slate-800 border border-emerald-500/50 rounded-xl shadow-2xl shadow-emerald-500/20 p-4 animate-pulse-once">
            <div className="flex items-start gap-3">
              <div className={cn("w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0", isOverdue?"bg-red-500":"bg-emerald-500")}>
                <Bell className="w-5 h-5 text-white"/>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white font-semibold text-sm">🔔 Rappel{isOverdue?' — EN RETARD':' dans moins de 15 min'}</p>
                <p className="text-slate-300 text-sm mt-0.5">{r.message || 'Rappel'}</p>
                <p className="text-emerald-400 text-xs mt-1">📋 {name} • ⏰ {formatDateTime(r.due_date)}</p>
              </div>
              <button onClick={()=>dismissNotif(r.id)} className="p-1 hover:bg-slate-700 rounded text-slate-400"><X className="w-4 h-4"/></button>
            </div>
            <div className="flex gap-2 mt-3">
              <button onClick={()=>handleNotifGoTo(r)} className="flex-1 px-3 py-2 bg-emerald-500 hover:bg-emerald-400 text-white text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5"><Eye className="w-3.5 h-3.5"/>Voir la fiche</button>
              <button onClick={()=>handleNotifSnooze(r)} className="flex-1 px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5"><Clock className="w-3.5 h-3.5"/>Rappeler dans 15m</button>
            </div>
          </div>;
        })}
      </div>}

      {/* Chat toast — new message arrived */}
      {chatToast && <div className="fixed bottom-4 right-4 z-[210] max-w-sm animate-pulse-once">
        <button onClick={()=>{ setChatToast(null); setView('chat'); }} className="w-full text-left bg-slate-800 border border-emerald-500/50 rounded-xl shadow-2xl shadow-emerald-500/20 p-4 hover:bg-slate-700/80 transition-colors">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 bg-emerald-500">
              <MessageSquare className="w-5 h-5 text-white"/>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white font-semibold text-sm">💬 Nouveau message</p>
              <p className="text-slate-300 text-xs mt-0.5">Salon <span className="text-emerald-400 font-medium">#{chatToast.channel}</span></p>
              <p className="text-emerald-400 text-[11px] mt-1">Clique pour ouvrir le chat</p>
            </div>
            <span onClick={(e)=>{e.stopPropagation(); setChatToast(null);}} className="p-1 hover:bg-slate-700 rounded text-slate-400 cursor-pointer"><X className="w-4 h-4"/></span>
          </div>
        </button>
      </div>}

      {/* Mobile overlay */}
      {sidebarOpen && <div className="fixed inset-0 bg-black/40 z-20 lg:hidden" onClick={()=>setSidebarOpen(false)}/>}

      {/* SIDEBAR */}
      <aside className={cn("bg-slate-800/95 backdrop-blur border-r border-slate-700 flex flex-col transition-all duration-300 flex-shrink-0 z-30", sidebarOpen?"w-64 fixed lg:relative inset-y-0 left-0":"w-0 overflow-hidden")}>
        <div className="p-4 border-b border-slate-700"><Logo/></div>

        <div className="p-3">
          <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"/><Input value={searchInput} onChange={e=>handleSearch(e.target.value)} placeholder="Rechercher..." className="w-full pl-10 pr-4 py-2.5 rounded-xl"/></div>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {/* Type: Client / Prospect */}
          <div>
            <div className="text-[10px] font-semibold text-slate-500 uppercase mb-1.5 flex items-center gap-1.5"><Crown className="w-3 h-3"/> Type</div>
            <div className="space-y-0.5">
              <FilterButton active={params.clientFilter==='all'} onClick={()=>setFilter('clientFilter','all')} count={counts.total}>Tous</FilterButton>
              <FilterButton active={params.clientFilter==='prospect'} onClick={()=>setFilter('clientFilter','prospect')} count={counts.prospects||0} color="#3B82F6">Prospects</FilterButton>
              <FilterButton active={params.clientFilter==='client'} onClick={()=>setFilter('clientFilter','client')} count={counts.clients||0} color="#10B981">Clients</FilterButton>
            </div>
          </div>

          {/* Type de projet */}
          <div>
            <div className="text-[10px] font-semibold text-slate-500 uppercase mb-1.5 flex items-center gap-1.5"><Briefcase className="w-3 h-3"/> Type de projet</div>
            <div className="space-y-0.5">
              <FilterButton active={params.typeProjetFilter==='all'} onClick={()=>setFilter('typeProjetFilter','all')} count={counts.total}>Tous</FilterButton>
              <FilterButton active={params.typeProjetFilter==='pro'} onClick={()=>setFilter('typeProjetFilter','pro')} count={counts.type_projet_pro||0} color="#8B5CF6">Professionnel</FilterButton>
              <FilterButton active={params.typeProjetFilter==='particulier'} onClick={()=>setFilter('typeProjetFilter','particulier')} count={counts.type_projet_particulier||0} color="#EC4899">Particulier</FilterButton>
            </div>
          </div>

          {/* Transmis à installateur */}
          <div>
            <div className="text-[10px] font-semibold text-slate-500 uppercase mb-1.5 flex items-center gap-1.5"><Truck className="w-3 h-3"/> Transmis installateur</div>
            <div className="space-y-0.5">
              <FilterButton active={params.transmisFilter==='all'} onClick={()=>setFilter('transmisFilter','all')} count={counts.total}>Tous</FilterButton>
              <FilterButton active={params.transmisFilter==='oui'} onClick={()=>setFilter('transmisFilter','oui')} count={counts.transmis||0} color="#F59E0B">Transmis</FilterButton>
              <FilterButton active={params.transmisFilter==='non'} onClick={()=>setFilter('transmisFilter','non')} count={Math.max(0,(counts.total||0)-(counts.transmis||0))} color="#6B7280">Non transmis</FilterButton>
            </div>
          </div>

          {/* Produits */}
          <div>
            <div className="text-[10px] font-semibold text-slate-500 uppercase mb-1.5 flex items-center gap-1.5"><Package className="w-3 h-3"/> Produits</div>
            <div className="space-y-0.5">
              <FilterButton active={!params.productIds.length} onClick={()=>setFilter('productIds',[])} count={counts.total}>Tous</FilterButton>
              {products.map(p=><FilterButton key={p.id} active={params.productIds.includes(p.id)} onClick={()=>toggleFilter('productIds',p.id)} count={counts.by_product?.[p.id]||0} color={p.color}>{p.name}</FilterButton>)}
              <FilterButton active={params.productIds.includes('none')} onClick={()=>toggleFilter('productIds','none')} count={counts.by_product?.none||0}>Sans produit</FilterButton>
            </div>
          </div>

          {/* Attribution (admin) */}
          {isAdmin && <div>
            <div className="text-[10px] font-semibold text-slate-500 uppercase mb-1.5 flex items-center gap-1.5"><UserCheck className="w-3 h-3"/> Attribution</div>
            <div className="space-y-0.5">
              <FilterButton active={!params.userIds.length} onClick={()=>setFilter('userIds',[])} count={counts.total}>Tous</FilterButton>
              <FilterButton active={params.userIds.includes('none')} onClick={()=>toggleFilter('userIds','none')} count={counts.unassigned||0}>Non attribués</FilterButton>
              {activeUsers.filter(u=>u.role==='user').map(u=><FilterButton key={u.id} active={params.userIds.includes(u.id)} onClick={()=>toggleFilter('userIds',u.id)} count={counts.by_user?.[u.id]||0}>{u.first_name} {u.last_name?.[0]}.</FilterButton>)}
            </div>
          </div>}

          {/* Statuts */}
          <div>
            <div className="text-[10px] font-semibold text-slate-500 uppercase mb-1.5 flex items-center gap-1.5"><FolderOpen className="w-3 h-3"/> Statuts</div>
            <div className="space-y-0.5">
              <FilterButton active={!params.statusIds.length} onClick={()=>setFilter('statusIds',[])} count={counts.total}>Tous</FilterButton>
              {statuses.map(s=><FilterButton key={s.id} active={params.statusIds.includes(s.id)} onClick={()=>toggleFilter('statusIds',s.id)} count={counts.by_status?.[s.id]||0} color={s.color}>{s.name}</FilterButton>)}
            </div>
          </div>

          {/* Installateurs */}
          <div>
            <div className="text-[10px] font-semibold text-slate-500 uppercase mb-1.5 flex items-center gap-1.5"><Building2 className="w-3 h-3"/> Installateurs</div>
            <div className="space-y-0.5">
              <FilterButton active={!params.installerIds.length} onClick={()=>setFilter('installerIds',[])} count={counts.total}>Tous</FilterButton>
              {installers.map(i=><FilterButton key={i.id} active={params.installerIds.includes(i.id)} onClick={()=>toggleFilter('installerIds',i.id)} count={counts.by_installer?.[i.id]||0}>{i.name}</FilterButton>)}
            </div>
          </div>

          {/* Provenance (admin only) */}
          {isAdmin && sources && sources.length > 0 && <div>
            <div className="text-[10px] font-semibold text-slate-500 uppercase mb-1.5 flex items-center gap-1.5"><Zap className="w-3 h-3"/> Provenance</div>
            <div className="space-y-0.5">
              <FilterButton active={!params.sourceIds?.length} onClick={()=>setFilter('sourceIds',[])} count={counts.total}>Toutes</FilterButton>
              {sources.map(s=><FilterButton key={s.id} active={(params.sourceIds||[]).includes(s.id)} onClick={()=>toggleFilter('sourceIds',s.id)} count={counts.by_source?.[s.id]||0} color={s.color}>{s.name}</FilterButton>)}
              <FilterButton active={(params.sourceIds||[]).includes('none')} onClick={()=>toggleFilter('sourceIds','none')} count={counts.by_source?.none||0}>Sans provenance</FilterButton>
            </div>
          </div>}

          {/* Date de création */}
          <div>
            <div className="text-[10px] font-semibold text-slate-500 uppercase mb-1.5 flex items-center gap-1.5"><Calendar className="w-3 h-3"/> Date de création</div>
            <div className="flex flex-wrap gap-1 mb-2">
              {[
                { label:"Aujourd'hui", fn:()=>{ const t=new Date().toISOString().slice(0,10); setFilter('dateFrom',t+'T00:00:00Z'); setFilter('dateTo',t+'T23:59:59Z'); }},
                { label:'7 jours', fn:()=>{ const d=new Date(); d.setDate(d.getDate()-7); setFilter('dateFrom',d.toISOString().slice(0,10)+'T00:00:00Z'); setFilter('dateTo',null); }},
                { label:'30 jours', fn:()=>{ const d=new Date(); d.setDate(d.getDate()-30); setFilter('dateFrom',d.toISOString().slice(0,10)+'T00:00:00Z'); setFilter('dateTo',null); }},
              ].map(s=><button key={s.label} onClick={s.fn} className="px-2 py-0.5 text-[10px] rounded bg-slate-700 text-slate-400 hover:bg-slate-600 hover:text-white transition-colors">{s.label}</button>)}
            </div>
            <div className="space-y-1.5">
              <Input type="date" value={params.dateFrom?.slice(0,10)||''} onChange={e=>setFilter('dateFrom',e.target.value?e.target.value+'T00:00:00Z':null)} className="w-full text-xs" placeholder="Du"/>
              <Input type="date" value={params.dateTo?.slice(0,10)||''} onChange={e=>setFilter('dateTo',e.target.value?e.target.value+'T23:59:59Z':null)} className="w-full text-xs" placeholder="Au"/>
            </div>
          </div>

          {(params.productIds.length>0||params.categoryIds.length>0||params.statusIds.length>0||params.installerIds.length>0||params.userIds.length>0||params.dateFrom||params.dateTo||params.clientFilter!=='all'||params.typeProjetFilter!=='all'||params.transmisFilter!=='all')&&
            <button onClick={()=>{resetFilters();setSearchInput('');}} className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs text-red-400 hover:bg-red-500/10 rounded-lg"><RotateCcw className="w-3 h-3"/> Réinitialiser</button>}
        </div>

        <div className="p-4 border-t border-slate-700">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 bg-emerald-500 rounded-lg flex items-center justify-center text-white font-bold text-sm">{profile?.first_name?.[0]}</div>
            <div className="flex-1 min-w-0"><div className="text-white font-medium text-sm truncate">{profile?.first_name} {profile?.last_name}</div>{isAdmin&&<Badge color="#10B981" small>Admin</Badge>}</div>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={signOut} className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg text-xs"><LogOut className="w-3.5 h-3.5"/> Déconnexion</button>
            {themeBtn}
          </div>
          {isAdmin&&<button onClick={async()=>{const r=await runDiagnostic();const msg=Object.entries(r).map(([k,v])=>`${k}: ${v}`).join('\n');window.alert('DIAGNOSTIC CRM\n\n'+msg);}} className="w-full flex items-center justify-center gap-2 px-3 py-1.5 text-slate-500 hover:text-slate-300 rounded-lg text-[10px] mt-1">🔧 Diagnostic DB</button>}
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Header */}
        <header className="bg-slate-800/30 border-b border-slate-700 px-4 md:px-6 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <button onClick={()=>setSidebarOpen(!sidebarOpen)} className="p-2 hover:bg-slate-700 rounded-lg text-slate-400"><Filter className="w-5 h-5"/></button>
              <div><h1 className="text-xl font-bold text-white">{params.clientFilter==='client'?'Clients':params.clientFilter==='prospect'?'Prospects':'Tous les contacts'}</h1><p className="text-xs text-slate-400">{total.toLocaleString('fr-FR')} résultats • Page {params.page}/{totalPages||1}</p></div>
            </div>
            <div className="flex items-center gap-2 flex-wrap justify-end">
              <div className="flex bg-slate-700 rounded-lg p-0.5">
                <button onClick={()=>setMainView('table')} className={cn("px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5", mainView==='table'?'bg-emerald-500 text-white':'text-slate-400 hover:text-white')}><List className="w-3.5 h-3.5"/>Liste</button>
                <button onClick={()=>setMainView('map')} className={cn("px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5", mainView==='map'?'bg-emerald-500 text-white':'text-slate-400 hover:text-white')}><Map className="w-3.5 h-3.5"/>Carte</button>
              </div>
              <Btn icon={RefreshCw} variant="ghost" size="sm" onClick={()=>{refresh();refreshCounts();}}/>
              
              {isAdmin&&<Btn icon={Upload} size="sm" onClick={()=>setModal('import')}>Import</Btn>}
              {isAdmin&&<Btn icon={BarChart3} size="sm" onClick={()=>setView('stats')}>Stats</Btn>}
              <Btn icon={CalendarDays} size="sm" onClick={()=>setView('planning')}>Planning</Btn>
              <div className="relative">
                <Btn icon={MessageSquare} size="sm" onClick={()=>setView('chat')}>Chat</Btn>
                {unreadChat.total>0 && <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-red-500 rounded-full text-[10px] text-white flex items-center justify-center font-bold animate-pulse pointer-events-none">{unreadChat.total>99?'99+':unreadChat.total}</span>}
              </div>
              <div className="relative"><Btn icon={Bell} variant="ghost" size="sm" onClick={()=>setModal('reminders')}/>{overdueCount>0&&<span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-[10px] text-white flex items-center justify-center font-bold animate-pulse">{overdueCount}</span>}</div>
              {isAdmin&&<Btn icon={History} variant="ghost" size="sm" onClick={()=>setView('activity')}/>}
              {isAdmin&&<Btn icon={Users} variant="ghost" size="sm" onClick={()=>setModal('users')}/>}
              {isAdmin&&<Btn icon={Settings} variant="ghost" size="sm" onClick={()=>setModal('settings')}/>}
              <Btn icon={Plus} variant="primary" size="sm" onClick={()=>setModal('add')}>Ajouter</Btn>
            </div>
          </div>

          {selected.size>0&&<div className="mt-3 flex items-center gap-2 p-2.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex-wrap">
            <span className="text-emerald-400 font-medium text-sm">{selected.size} sélectionné(s)</span>
            {isAdmin&&<Btn size="sm" variant="primary" icon={UserCheck} onClick={()=>setModal('bulk-assign')}>Attribuer</Btn>}
            {isAdmin&&<Btn size="sm" variant="ghost" icon={UserMinus} onClick={()=>setModal('bulk-unassign')}>Désattribuer</Btn>}
            <Select className="py-1.5 text-xs" value="" onChange={e=>{if(e.target.value) handleBulkStatus(e.target.value);}}><option value="">Changer statut...</option>{statuses.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</Select>
            {isAdmin && sources && sources.length > 0 && <Select className="py-1.5 text-xs" value="" onChange={e=>{if(e.target.value) handleBulkSource(e.target.value==='none'?null:e.target.value);}}><option value="">Provenance...</option>{sources.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}<option value="none">— Aucune —</option></Select>}
            {isAdmin&&<Btn size="sm" variant="danger" icon={Trash2} onClick={handleBulkDelete}>Supprimer</Btn>}
            <Btn size="sm" variant="ghost" onClick={()=>setSelected(new Set())}>Annuler</Btn>
          </div>}
        </header>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {mainView==='map' ? (
            <div className="h-full p-4 flex flex-col"><div className="flex-1"><MapView markers={markers} statuses={statuses} users={activeUsers} isAdmin={isAdmin} onSelect={openProspect}/></div></div>
          ) : (
            <div className="h-full overflow-auto">
              {error ? <div className="flex flex-col items-center justify-center h-64"><AlertCircle className="w-12 h-12 text-red-400 mb-4"/><p className="text-red-400 text-center mb-2 font-semibold">Erreur de chargement</p><p className="text-red-400/80 text-sm text-center mb-4 max-w-md">{error}</p><Btn variant="primary" onClick={refresh}>Réessayer</Btn><p className="text-slate-500 text-xs mt-3">Ouvrez la console (F12) pour plus de détails</p></div>
              : loading&&prospects.length===0 ? <div className="flex flex-col items-center justify-center h-64"><Loader2 className="w-8 h-8 text-emerald-400 animate-spin"/><p className="text-slate-400 text-sm mt-4">Chargement des prospects...</p></div>
              : prospects.length===0 ? <div className="flex flex-col items-center justify-center h-64"><FolderOpen className="w-12 h-12 text-slate-600 mb-4"/><p className="text-slate-400 mb-4">Aucun prospect</p><Btn variant="primary" icon={Plus} onClick={()=>setModal('add')}>Ajouter</Btn></div>
              : <table className="w-full">
                <thead className="sticky top-0 bg-slate-800/90 backdrop-blur-sm z-10">
                  <tr className="text-left text-xs text-slate-400 font-medium">
                    <th className="pl-4 pr-2 py-3 w-10"><input type="checkbox" checked={selected.size===displayProspects.length&&displayProspects.length>0} onChange={selectAll} className="rounded"/></th>
                    <th className="px-2 py-3 cursor-pointer hover:text-white w-16" onClick={()=>setSort('prospect_number')}><span className="flex items-center gap-1"># {params.sortCol==='prospect_number'&&(params.sortDir==='asc'?<ArrowUp className="w-3 h-3"/>:<ArrowDown className="w-3 h-3"/>)}</span></th>
                    <th className="px-2 py-3 cursor-pointer hover:text-white" onClick={()=>setSort('company_name')}><span className="flex items-center gap-1">Prospect {params.sortCol==='company_name'&&(params.sortDir==='asc'?<ArrowUp className="w-3 h-3"/>:<ArrowDown className="w-3 h-3"/>)}</span></th>
                    <th className="px-2 py-3 hidden lg:table-cell">Téléphone</th>
                    <th className="px-2 py-3 hidden xl:table-cell cursor-pointer hover:text-white" onClick={()=>setSort('postal_code')}>CP</th>
                    <th className="px-2 py-3 hidden md:table-cell">Produit</th>
                    <th className="px-2 py-3 hidden lg:table-cell">Type projet</th>
                    <th className="px-2 py-3 hidden lg:table-cell">Installateur</th>
                    <th className="px-2 py-3">Statut</th>

                    <th className="px-2 py-3 hidden lg:table-cell w-16">Transmis</th>
                    {isAdmin&&<th className="px-2 py-3 hidden xl:table-cell">Assigné</th>}
                    {isAdmin&&<th className="px-2 py-3 hidden xl:table-cell">Provenance</th>}
                    <th className="px-2 py-3 hidden md:table-cell">Rappel</th>
                    <th className="px-2 py-3 hidden lg:table-cell cursor-pointer hover:text-white" onClick={()=>setSort('created_at')}><span className="flex items-center gap-1">Créé le {params.sortCol==='created_at'&&(params.sortDir==='asc'?<ArrowUp className="w-3 h-3"/>:<ArrowDown className="w-3 h-3"/>)}</span></th>
                    <th className="px-2 py-3 cursor-pointer hover:text-white" onClick={()=>setSort('updated_at')}><span className="flex items-center gap-1">Modifié {params.sortCol==='updated_at'&&(params.sortDir==='asc'?<ArrowUp className="w-3 h-3"/>:<ArrowDown className="w-3 h-3"/>)}</span></th>
                    <th className="px-2 py-3 w-16"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/50">
                  {displayProspects.map(p => <tr key={p.id} className="hover:bg-slate-800/30 cursor-pointer transition-colors" onClick={()=>openProspect(p)}>
                    <td className="pl-4 pr-2 py-2.5" onClick={e=>e.stopPropagation()}><input type="checkbox" checked={selected.has(p.id)} onChange={()=>toggleSelect(p.id)} className="rounded"/></td>
                    <td className="px-2 py-2.5 text-xs text-slate-400 font-mono">{p.prospect_number||'—'}</td>
                    <td className="px-2 py-2.5"><div className="font-medium text-white text-sm">{p.company_name||`${p.first_name} ${p.last_name}`}</div>{p.company_name&&<div className="text-xs text-slate-400">{p.first_name} {p.last_name}</div>}</td>
                    <td className="px-2 py-2.5 text-slate-300 text-sm hidden lg:table-cell">{p.phone||'—'}</td>
                    <td className="px-2 py-2.5 text-slate-300 text-sm hidden xl:table-cell">{p.postal_code||'—'}</td>
                    <td className="px-2 py-2.5 hidden md:table-cell">{p.product&&<Badge color={p.product.color} small>{p.product.name}</Badge>}</td>
                    <td className="px-2 py-2.5 hidden lg:table-cell text-sm text-slate-300">{p.type_projet === 'pro' ? 'Professionnel' : p.type_projet === 'particulier' ? 'Particulier' : <span className="text-slate-600">—</span>}</td>
                    <td className="px-2 py-2.5 hidden lg:table-cell text-sm text-slate-300">{p.installer?.name||<span className="text-slate-600">—</span>}</td>
                    <td className="px-2 py-2.5" onClick={e=>e.stopPropagation()}><StatusDropdown currentId={p.status_id} statuses={statuses} onChange={sid=>handleQuickStatus(p.id,sid)}/></td>

                    <td className="px-2 py-2.5 hidden lg:table-cell">{p.transmis_installateur ? <span className="w-5 h-5 bg-amber-500 rounded-full flex items-center justify-center" title="Transmis"><Check className="w-3 h-3 text-white"/></span> : <span className="text-slate-600">—</span>}</td>
                    {isAdmin&&<td className="px-2 py-2.5 hidden xl:table-cell">
                      {(()=>{const au=(p.assignedUsers||[]).filter(u=>u.role==='user');return au.length>0 ? <div className="flex -space-x-1.5">{au.slice(0,3).map((u,i)=><div key={i} className="w-6 h-6 bg-emerald-500 rounded-full flex items-center justify-center text-white text-[10px] font-bold border-2 border-slate-900" title={`${u.first_name} ${u.last_name}`}>{u.first_name?.[0]}</div>)}{au.length>3&&<div className="w-6 h-6 bg-slate-600 rounded-full flex items-center justify-center text-white text-[10px] border-2 border-slate-900">+{au.length-3}</div>}</div> : <span className="text-slate-500 text-xs">—</span>})()}
                    </td>}
                    {isAdmin&&<td className="px-2 py-2.5 hidden xl:table-cell">{p.source ? <Badge color={p.source.color} small>{p.source.name}</Badge> : <span className="text-slate-600 text-xs">—</span>}</td>}
                    <td className="px-2 py-2.5 hidden md:table-cell">{(()=>{
                      const rem = reminderMap[p.id];
                      if (!rem) return <span className="text-slate-600 text-xs">—</span>;
                      const due = new Date(rem.due_date);
                      const isOverdue = due < new Date();
                      return <div className={cn("text-[11px] font-medium flex items-center gap-1", isOverdue?"text-red-400":"text-amber-400")} title={rem.message||'Rappel'}>
                        <Bell className="w-3 h-3"/>{due.toLocaleDateString('fr-FR',{day:'2-digit',month:'2-digit'})} {due.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})}
                      </div>;
                    })()}</td>
                    <td className="px-2 py-2.5 text-xs text-slate-400 hidden lg:table-cell">{formatDate(p.created_at)}</td>
                    <td className="px-2 py-2.5 text-xs text-slate-400">{formatRelative(p.updated_at)}</td>
                    <td className="px-2 py-2.5" onClick={e=>e.stopPropagation()}><div className="flex gap-0.5"><button onClick={()=>openProspect(p)} className="p-1.5 hover:bg-slate-700 rounded-lg text-slate-400"><Eye className="w-3.5 h-3.5"/></button>{isAdmin&&<button onClick={()=>handleDuplicate(p)} className="p-1.5 hover:bg-slate-700 rounded-lg text-slate-400"><Copy className="w-3.5 h-3.5"/></button>}</div></td>
                  </tr>)}
                </tbody>
              </table>}
            </div>
          )}
        </div>

        {/* Pagination */}
        {mainView==='table'&&<div className="px-4 md:px-6 py-3 border-t border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-400">Page {params.page}/{totalPages||1} • {total.toLocaleString('fr-FR')}</span>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-slate-500">Afficher</span>
              {[50,100].map(n => <button key={n} onClick={()=>{setFilter('perPage',n);setPage(1);}} className={cn("px-2 py-1 rounded-md text-[11px] font-medium transition-all", params.perPage===n?"bg-emerald-500/20 text-emerald-400":"text-slate-500 hover:text-white hover:bg-slate-700/50")}>{n}</button>)}
              <button onClick={()=>{setFilter('perPage',9999);setPage(1);}} className={cn("px-2 py-1 rounded-md text-[11px] font-medium transition-all", params.perPage>=9999?"bg-emerald-500/20 text-emerald-400":"text-slate-500 hover:text-white hover:bg-slate-700/50")}>Tous</button>
            </div>
          </div>
          {totalPages>1&&<div className="flex items-center gap-1">
            <Btn size="sm" variant="ghost" icon={ChevronLeft} onClick={()=>setPage(Math.max(1,params.page-1))} disabled={params.page===1}/>
            {[...Array(Math.min(5,totalPages))].map((_,i) => { let pn; if(totalPages<=5) pn=i+1; else if(params.page<=3) pn=i+1; else if(params.page>=totalPages-2) pn=totalPages-4+i; else pn=params.page-2+i; return <button key={pn} onClick={()=>setPage(pn)} className={cn("w-8 h-8 rounded-lg text-xs font-medium", pn===params.page?"bg-emerald-500 text-white":"hover:bg-slate-700 text-slate-400")}>{pn}</button>; })}
            <Btn size="sm" variant="ghost" icon={ChevronRight} onClick={()=>setPage(Math.min(totalPages,params.page+1))} disabled={params.page===totalPages}/>
          </div>}
        </div>}
      </main>

      {/* MODALS */}
      <ProspectModal open={modal==='add'} onClose={()=>setModal(null)} onSubmit={handleAdd} categories={categories} statuses={statuses} products={products} installers={installers} sources={sources} isAdmin={isAdmin} existingProspects={prospects}/>
      <ImportModal open={modal==='import'} onClose={()=>setModal(null)} onImport={handleImport} categories={categories} statuses={statuses} products={products}/>
      <BulkAssignModal open={modal==='bulk-assign'} onClose={()=>setModal(null)} users={activeUsers} count={selected.size} onAssign={handleBulkAssign}/>
      <BulkUnassignModal open={modal==='bulk-unassign'} onClose={()=>setModal(null)} users={activeUsers} count={selected.size} onUnassign={handleBulkUnassign}/>
      <UsersModal open={modal==='users'} onClose={()=>setModal(null)} users={users} isAdmin={isAdmin} updateUserRole={updateUserRole} deactivateUser={deactivateUser} activateUser={activateUser}/>
      <RemindersModal open={modal==='reminders'} onClose={()=>setModal(null)} reminders={reminders} completeReminder={completeGR} deleteReminder={deleteGR} showAlert={showAlert} onOpenProspect={openProspect}/>
      <SettingsModal open={modal==='settings'} onClose={()=>setModal(null)} installers={installers} categories={categories} statuses={statuses} products={products} sources={sources} users={activeUsers} addInstaller={addInstaller} updateInstaller={updateInstaller} deleteInstaller={deleteInstaller} addCategory={addCategory} updateCategory={updateCategory} deleteCategory={deleteCategory} addStatus={addStatus} updateStatus={updateStatus} deleteStatus={deleteStatus} addProduct={addProduct} updateProduct={updateProduct} deleteProduct={deleteProduct} addSource={addSource} updateSource={updateSource} deleteSource={deleteSource}/>
    </div>
  );
});

// =====================================================
// SITE CARD (used in DetailPage Sites tab)
// =====================================================
const SiteCard = memo(({ site, index, onUpdateSite, onDeleteSite, onAddBuilding, onUpdateBuilding, onDeleteBuilding, showAlert }) => {
  const [editingSite, setEditingSite] = useState(false);
  const [siteForm, setSiteForm] = useState({ name: site.name, address: site.address, postal_code: site.postal_code, city: site.city });
  const [expanded, setExpanded] = useState(true);

  useEffect(() => { setSiteForm({ name: site.name, address: site.address, postal_code: site.postal_code, city: site.city }); }, [site]);

  const saveSite = async () => {
    try { await onUpdateSite(site.id, siteForm); setEditingSite(false); showAlert('Site mis à jour'); } catch(e) { showAlert(e.message, 'error'); }
  };

  return <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
    {/* Site header */}
    <div className="flex items-center justify-between px-4 py-3 bg-slate-800 border-b border-slate-700">
      <button onClick={()=>setExpanded(!expanded)} className="flex items-center gap-2 flex-1 min-w-0">
        <ChevronDown className={cn("w-4 h-4 text-slate-400 transition-transform", !expanded && "-rotate-90")}/>
        <Layers className="w-4 h-4 text-emerald-400"/>
        <span className="text-white font-medium text-sm truncate">{site.name || `Site ${index+1}`}</span>
        {site.city && <span className="text-slate-400 text-xs">— {site.city}</span>}
        <span className="text-slate-500 text-xs ml-1">({site.buildings?.length || 0} bât.)</span>
      </button>
      <div className="flex items-center gap-1 flex-shrink-0">
        <button onClick={()=>setEditingSite(!editingSite)} className="p-1.5 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-emerald-400"><Edit className="w-3.5 h-3.5"/></button>
        <button onClick={async()=>{if(confirm('Supprimer ce site et tous ses bâtiments ?')){try{await onDeleteSite(site.id);showAlert('Site supprimé');}catch(e){showAlert(e.message,'error');}}}} className="p-1.5 hover:bg-red-500/20 rounded-lg text-slate-400 hover:text-red-400"><Trash2 className="w-3.5 h-3.5"/></button>
      </div>
    </div>

    {/* Site edit form */}
    {editingSite && <div className="px-4 py-3 bg-slate-700/30 border-b border-slate-700 space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <div><label className="text-[10px] text-slate-400">Nom du site</label><Input value={siteForm.name||''} onChange={e=>setSiteForm(f=>({...f,name:e.target.value}))} className="w-full text-xs py-1.5" placeholder="Ex: Siège social"/></div>
        <div><label className="text-[10px] text-slate-400">Ville</label><Input value={siteForm.city||''} onChange={e=>setSiteForm(f=>({...f,city:e.target.value}))} className="w-full text-xs py-1.5"/></div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div className="col-span-2"><label className="text-[10px] text-slate-400">Adresse</label><Input value={siteForm.address||''} onChange={e=>setSiteForm(f=>({...f,address:e.target.value}))} className="w-full text-xs py-1.5"/></div>
        <div><label className="text-[10px] text-slate-400">Code postal</label><Input value={siteForm.postal_code||''} onChange={e=>setSiteForm(f=>({...f,postal_code:e.target.value}))} className="w-full text-xs py-1.5"/></div>
      </div>
      <div className="flex justify-end gap-2">
        <Btn size="sm" onClick={()=>setEditingSite(false)}>Annuler</Btn>
        <Btn size="sm" variant="primary" icon={Save} onClick={saveSite}>Enregistrer</Btn>
      </div>
    </div>}

    {/* Buildings */}
    {expanded && <div className="p-4 space-y-3">
      {(site.buildings || []).map((b, bi) => <BuildingCard key={b.id} building={b} index={bi} onUpdate={onUpdateBuilding} onDelete={onDeleteBuilding} showAlert={showAlert}/>)}

      {(site.buildings || []).length === 0 && <p className="text-center text-slate-500 text-xs py-3">Aucun bâtiment — ajoutez-en un ci-dessous</p>}

      <button onClick={async()=>{try{await onAddBuilding(site.id);showAlert('Bâtiment ajouté');}catch(e){showAlert(e.message,'error');}}} className="w-full flex items-center justify-center gap-2 py-2.5 border-2 border-dashed border-slate-600 rounded-xl text-sm text-slate-400 hover:border-emerald-500 hover:text-emerald-400 transition-colors">
        <Plus className="w-4 h-4"/> Ajouter un bâtiment
      </button>
    </div>}
  </div>;
});

const BuildingCard = memo(({ building, index, onUpdate, onDelete, showAlert }) => {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(building);
  const [ratioMode, setRatioMode] = useState(''); // '', '25', '30', 'custom'
  const [customRatio, setCustomRatio] = useState('');

  useEffect(() => { setForm(building); }, [building]);

  // Auto-calc nb_luminaire_total when surface or ratio changes
  const currentRatio = ratioMode === 'custom' ? parseFloat(customRatio) : parseFloat(ratioMode);
  const surfaceVal = parseFloat(form.surface);
  useEffect(() => {
    if (editing && surfaceVal > 0 && currentRatio > 0) {
      const total = Math.ceil(surfaceVal / currentRatio);
      setForm(f => ({ ...f, nb_luminaire_total: total }));
    }
  }, [editing, surfaceVal, currentRatio]);

  const save = async () => {
    try {
      const { id, site_id, created_at, ...data } = form;
      await onUpdate(building.id, data);
      setEditing(false);
      showAlert('Bâtiment mis à jour');
    } catch(e) { showAlert(e.message, 'error'); }
  };

  const field = (label, key, type='text', placeholder='') => (
    <div>
      <label className="text-[10px] text-slate-400">{label}</label>
      {editing
        ? <Input type={type} value={form[key]!=null?form[key]:''} onChange={e=>setForm(f=>({...f,[key]:e.target.value}))} className="w-full text-xs py-1.5" placeholder={placeholder}/>
        : <p className="text-white text-sm mt-0.5">{form[key] || <span className="text-slate-500">—</span>}</p>
      }
    </div>
  );

  return <div className="bg-slate-700/40 rounded-xl p-3.5 border border-slate-700/50">
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 bg-slate-600 rounded-lg flex items-center justify-center text-white text-xs font-bold">{index+1}</div>
        {editing
          ? <Input value={form.name||''} onChange={e=>setForm(f=>({...f,name:e.target.value}))} className="text-sm py-1 font-medium" placeholder="Nom du bâtiment"/>
          : <span className="text-white font-medium text-sm">{building.name || `Bâtiment ${index+1}`}</span>
        }
      </div>
      <div className="flex items-center gap-1">
        {editing ? <>
          <Btn size="sm" onClick={()=>{setForm(building);setEditing(false);}}>Annuler</Btn>
          <Btn size="sm" variant="primary" icon={Save} onClick={save}>OK</Btn>
        </> : <>
          <button onClick={()=>setEditing(true)} className="p-1.5 hover:bg-slate-600 rounded-lg text-slate-400 hover:text-emerald-400"><Edit className="w-3.5 h-3.5"/></button>
          <button onClick={async()=>{if(confirm('Supprimer ce bâtiment ?')){try{await onDelete(building.id);showAlert('Bâtiment supprimé');}catch(e){showAlert(e.message,'error');}}}} className="p-1.5 hover:bg-red-500/20 rounded-lg text-slate-400 hover:text-red-400"><Trash2 className="w-3.5 h-3.5"/></button>
        </>}
      </div>
    </div>
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
      {field('Surface (m²)', 'surface', 'number', 'Ex: 500')}
      {field('Nb luminaires existants', 'nb_luminaire_existant', 'number', 'Ex: 24')}
      {field('Nb luminaires en création', 'nb_luminaire_creation', 'number', 'Ex: 20')}
      <div>
        <label className="text-[10px] text-slate-400">1 luminaire tous les…</label>
        {editing ? <div className="flex items-center gap-1.5 mt-0.5">
          <select value={ratioMode} onChange={e=>{setRatioMode(e.target.value);if(e.target.value!=='custom')setCustomRatio('');}} className="bg-slate-600 border border-slate-500 rounded-lg text-xs text-white py-1.5 px-2 focus:border-emerald-500 outline-none">
            <option value="">—</option>
            <option value="25">25 m²</option>
            <option value="30">30 m²</option>
            <option value="custom">Autre</option>
          </select>
          {ratioMode==='custom' && <Input type="number" value={customRatio} onChange={e=>setCustomRatio(e.target.value)} className="w-16 text-xs py-1.5" placeholder="m²"/>}
        </div> : <p className="text-white text-sm mt-0.5">—</p>}
      </div>
      <div>
        <label className="text-[10px] text-slate-400">Nb luminaires total</label>
        {editing
          ? <div className="flex items-center gap-2 mt-0.5">
              <Input type="number" value={form.nb_luminaire_total!=null?form.nb_luminaire_total:''} onChange={e=>setForm(f=>({...f,nb_luminaire_total:e.target.value}))} className="w-full text-xs py-1.5" placeholder="Auto ou manuel"/>
              {surfaceVal > 0 && currentRatio > 0 && <span className="text-[10px] text-slate-400 whitespace-nowrap">{surfaceVal}÷{currentRatio}</span>}
            </div>
          : <p className="text-white text-sm mt-0.5 font-semibold">{form.nb_luminaire_total || <span className="text-slate-500">—</span>}</p>
        }
      </div>
      <div>
        <label className="text-[10px] text-slate-400">% création / total</label>
        <p className={cn("text-sm mt-0.5 font-semibold", form.nb_luminaire_total > 0 && form.nb_luminaire_creation > 0 ? (Math.round((form.nb_luminaire_creation / form.nb_luminaire_total) * 100) >= 50 ? "text-amber-400" : "text-emerald-400") : "text-slate-500")}>
          {form.nb_luminaire_total > 0 && form.nb_luminaire_creation != null ? `${Math.round((form.nb_luminaire_creation / form.nb_luminaire_total) * 100)}%` : '—'}
        </p>
      </div>
      {field('Type de luminaire', 'type_luminaire', 'text', 'Ex: LED Cloche 150W')}
      {field('Hauteur sous plafond (m)', 'hauteur_plafond', 'number', 'Ex: 8')}
      {field('Parcelle cadastrale', 'parcelle_cadastrale', 'text', 'Ex: AB-1234')}
      {field('Notes', 'notes', 'text', 'Remarques...')}
    </div>
  </div>;
});

// =====================================================
// DETAIL PAGE
// =====================================================
const DetailPage = memo(({ prospect: prospectProp, onClose, onUpdate, onDelete, onDuplicate, onAssign, onUnassign, categories, statuses, products, installers, sources, users, isAdmin, userRole, onlineUsers, showAlert, onQuickStatus, unreadChat }) => {
  const [showChatPanel, setShowChatPanel] = useState(false);
  // Fetch full prospect directly (RPC might not return all columns like nb_led)
  const [fullProspect, setFullProspect] = useState(null);
  const refetchFull = useCallback(() => {
    supabase.from('prospects').select('*').eq('id', prospectProp.id).single().then(({ data }) => {
      if (data) setFullProspect(data);
    });
  }, [prospectProp.id]);
  // Fetch on mount AND when prospect gets updated via realtime
  useEffect(() => { refetchFull(); }, [prospectProp.id, prospectProp.updated_at, refetchFull]);

  // Merge: full DB data + list data (which has joins like status, category, etc.)
  const prospect = useMemo(() => {
    if (!fullProspect) return prospectProp;
    return { ...prospectProp, ...fullProspect, 
      // Keep joined objects from prospectProp (not in raw DB row)
      status: prospectProp.status, category: prospectProp.category, product: prospectProp.product, 
      installer: prospectProp.installer, assignedUsers: prospectProp.assignedUsers, assignedUserIds: prospectProp.assignedUserIds };
  }, [prospectProp, fullProspect]);

  const [form, setForm] = useState(prospect);
  const [editing, setEditing] = useState(false);
  const [activeTab, setActiveTab] = useState('info');
  const [newNote, setNewNote] = useState('');
  const [noteLoading, setNoteLoading] = useState(false);
  const [reminderDate, setReminderDate] = useState('');
  const [reminderMsg, setReminderMsg] = useState('');
  const [reminderSaving, setReminderSaving] = useState(false);
  const [reminderBusy, setReminderBusy] = useState(null); // id of reminder being acted on

  const { notes, addNote, deleteNote } = useNotes(prospect.id);
  const { documents, uploadDocuments, deleteDocument, getDocumentUrl, uploading, uploadProgress } = useDocuments(prospect.id);
  const { sites, addSite, updateSite, deleteSite, addBuilding, updateBuilding, deleteBuilding } = useSites(prospect.id);
  const { reminders, addReminder, completeReminder, uncompleteReminder, deleteReminder } = useReminders(prospect.id);
  const { logs } = useActivityLog(prospect.id);

  // Track view
  const viewTracked = useRef(false);
  useEffect(() => { if (!viewTracked.current) { viewTracked.current = true; logEnhanced('view', prospect.id, { ctx: { company: prospect.company_name || prospect.first_name } }); } }, [prospect.id]);
  const { lookup: siretLookup, loading: siretLd } = useSiretLookup();

  // Smart form sync: merge prospect into form, never wipe non-null values with null/undefined
  const lastSavedRef = useRef(null);
  useEffect(() => {
    if (!editing) {
      setForm(prev => {
        const merged = { ...prospect };
        // Preserve values that exist in form but are null/undefined in prospect (RPC might not return all cols)
        const protectedFields = ['nb_led','nb_led_reel','ca_previsionnel','ca_reel','surface','type_led','mode_pose','puissance_pac','nb_panneaux','notes_admin','source','source_id','closer_id','date_pose','nb_personnes_foyer','revenu_fiscal_ref','is_ile_de_france','categorie_aide','reste_a_charge','surface_sous_sol','surface_comble','surface_isoler_total','has_vmc','surface_habitable','surface_chauffer','zone_climatique','commission_pac','commission_admin','commission_telepro','commission_fournisseur','iti_option','ballon_type','type_chauffage','date_audit','numero_fiscal','type_logement','type_projet','surface_batiment','surface_mur_interieur','surface_mur_exterieur','surface_fenetre','has_pac_split'];
        protectedFields.forEach(k => {
          if ((merged[k] === undefined || merged[k] === null) && prev[k] != null && prev[k] !== '') {
            merged[k] = prev[k];
          }
        });
        // If we just saved, keep the saved values for 3s to avoid race with realtime
        if (lastSavedRef.current && Date.now() - lastSavedRef.current.time < 3000) {
          Object.entries(lastSavedRef.current.data).forEach(([k, v]) => {
            if (v != null) merged[k] = v;
          });
        }
        return merged;
      });
    }
  }, [prospect, editing]);

  const assignedIds = prospect.assignedUserIds || [];
  const assignedUsers = users.filter(u => assignedIds.includes(u.id) && u.role === 'user');
  const unassignedUsers = users.filter(u => !assignedIds.includes(u.id) && u.role === 'user');

  const autoSaveTimer = useRef(null);
  const handleSave = async () => {
    clearTimeout(autoSaveTimer.current);
    const saveData = { ...form };
    ['nb_led','nb_led_reel','ca_previsionnel','ca_reel','surface','puissance_pac','nb_panneaux','nb_personnes_foyer','revenu_fiscal_ref','reste_a_charge','surface_sous_sol','surface_comble','surface_isoler_total','surface_habitable','surface_chauffer','commission_pac','commission_admin','commission_telepro','commission_fournisseur','surface_batiment','surface_mur_interieur','surface_mur_exterieur','surface_fenetre'].forEach(k => {
      if (saveData[k] !== null && saveData[k] !== undefined && saveData[k] !== '') saveData[k] = Number(saveData[k]);
    });
    // Auto-compute zone climatique from postal code
    if (saveData.postal_code) {
      const zone = getZoneClimatique(saveData.postal_code);
      if (zone) saveData.zone_climatique = zone;
    }
    // Auto-compute categorie_aide et surface_isoler_total (somme des 5 surfaces à isoler)
    const cat = calcCategorieAide(saveData.nb_personnes_foyer, saveData.revenu_fiscal_ref, saveData.is_ile_de_france);
    if (cat) saveData.categorie_aide = cat;
    const totalIsoler = sumSurfacesIsoler(saveData);
    if (totalIsoler > 0) saveData.surface_isoler_total = totalIsoler;
    // Auto-compute commissions selon produit
    const pCode = getProductCode(prospect, products);
    if (pCode === 'pac' && cat && saveData.zone_climatique) {
      const pacCalc = calcPacCommission(cat, saveData.zone_climatique);
      if (pacCalc) { saveData.reste_a_charge = pacCalc.reste_a_charge; saveData.commission_pac = pacCalc.commission; }
    }
    const itiSurfH = parseFloat(saveData.surface_batiment) || parseFloat(saveData.surface_habitable) || 0;
    if (pCode === 'iti' && cat && itiSurfH > 0 && totalIsoler > 0) {
      const itiCalc = calcItiCommission(cat, itiSurfH, totalIsoler, saveData.iti_option || 'A');
      if (itiCalc) {
        saveData.reste_a_charge = itiCalc.rac;
        saveData.commission_admin = itiCalc.commission;
        // Télépro/Fournisseur ne sont plus utilisés — on les remet à null pour propreté
        saveData.commission_telepro = null;
        saveData.commission_fournisseur = null;
      }
    }
    lastSavedRef.current = { time: Date.now(), data: saveData };
    try { await onUpdate(prospect.id, saveData); refetchFull(); setEditing(false); } catch(e) { showAlert(e.message,'error'); }
  };

  const handleSiret = async () => {
    try {
      const r = await siretLookup(form.siret);
      setForm(f => ({ ...f, company_name: r.company_name||f.company_name, address: r.address||f.address, postal_code: r.postal_code||f.postal_code, city: r.city||f.city, latitude: r.latitude, longitude: r.longitude }));
      showAlert('SIRET trouvé — données remplies');
    } catch(e) { showAlert(e.message,'error'); }
  };

  const handleAddrSelect = item => {
    const zone = getZoneClimatique(item.postcode);
    setForm(f => ({ ...f, address: item.name, postal_code: item.postcode, city: item.city?.toUpperCase(), latitude: item.latitude, longitude: item.longitude, zone_climatique: zone }));
  };

  // Auto-calc CA Prévisionnel (from nb_led) and CA Réel (from nb_led_reel) — debounced save
  const secteurFromCat = useMemo(() => categories.find(c => c.id === form.category_id)?.name?.toLowerCase() || null, [categories, form.category_id]);
  const autoCalcRef = useRef({ ca_previsionnel: null, ca_reel: null });

  // Compute CA values (instant display update, no save)
  const computedCaP = useMemo(() => {
    const instName = installers.find(i => i.id === form.installer_id)?.name;
    return form.nb_led ? calcDevis(instName, form.type_led, form.mode_pose, secteurFromCat, form.nb_led) : null;
  }, [form.installer_id, form.type_led, form.mode_pose, secteurFromCat, form.nb_led, installers]);

  const computedCaR = useMemo(() => {
    const instName = installers.find(i => i.id === form.installer_id)?.name;
    return form.nb_led_reel ? calcDevis(instName, form.type_led, form.mode_pose, secteurFromCat, form.nb_led_reel) : null;
  }, [form.installer_id, form.type_led, form.mode_pose, secteurFromCat, form.nb_led_reel, installers]);

  // Update form display immediately when CA changes
  useEffect(() => {
    if (!isAdmin) return;
    const updates = {};
    if (computedCaP !== null && computedCaP !== autoCalcRef.current.ca_previsionnel) updates.ca_previsionnel = computedCaP;
    if (computedCaR !== null && computedCaR !== autoCalcRef.current.ca_reel) updates.ca_reel = computedCaR;
    if (Object.keys(updates).length > 0) {
      autoCalcRef.current = { ca_previsionnel: computedCaP ?? autoCalcRef.current.ca_previsionnel, ca_reel: computedCaR ?? autoCalcRef.current.ca_reel };
      setForm(f => ({ ...f, ...updates }));
    }
  }, [computedCaP, computedCaR, isAdmin]);

  // Debounced save: persist CA + nb_led values together (800ms after last change)
  useEffect(() => {
    if (!isAdmin) return;
    clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => {
      const payload = {};
      if (computedCaP !== null) { payload.ca_previsionnel = computedCaP; payload.nb_led = form.nb_led ? parseInt(form.nb_led) : null; }
      if (computedCaR !== null) { payload.ca_reel = computedCaR; payload.nb_led_reel = form.nb_led_reel ? parseInt(form.nb_led_reel) : null; }
      if (Object.keys(payload).length > 0) {
        lastSavedRef.current = { time: Date.now(), data: payload };
        onUpdate(prospect.id, payload).then(() => refetchFull()).catch(() => {});
      }
    }, 800);
    return () => clearTimeout(autoSaveTimer.current);
  }, [computedCaP, computedCaR, form.nb_led, form.nb_led_reel, isAdmin, prospect.id, onUpdate]);

  const handleAddNote = async () => { if (!newNote.trim()) return; setNoteLoading(true); try { await addNote(newNote); setNewNote(''); } catch(e) { showAlert(e.message,'error'); } setNoteLoading(false); };

  const handleUpload = async e => {
    const files = Array.from(e.target.files||[]); if (!files.length) return;
    try { const res = await uploadDocuments(files); showAlert(res.errors.length ? `${res.success} uploadés, ${res.errors.length} erreurs` : `${res.success} document(s) uploadé(s)`, res.success>0?'success':'error'); } catch(err) { showAlert(err.message,'error'); }
    e.target.value = '';
  };

  const openDoc = async doc => { try { const url = await getDocumentUrl(doc); if (url) window.open(url,'_blank'); } catch(e) { showAlert(e.message,'error'); } };

  const handleAddReminder = async () => { if (!reminderDate || reminderSaving) return; setReminderSaving(true); try { await addReminder(prospect.id, reminderDate, reminderMsg); setReminderDate(''); setReminderMsg(''); showAlert('Rappel créé ✓'); } catch(e) { showAlert(e.message,'error'); } setReminderSaving(false); };

  // Render FUNCTION (not component) — prevents React from unmounting/remounting inputs on each render
  const field = (label, name, type='text', options, disabled, children) => (
    <div key={name}>
      <label className="block text-xs text-slate-400 mb-1">{label}</label>
      {children ? children : type==='select' ? <Select value={form[name]||''} onChange={e=>setForm(f=>({...f,[name]:e.target.value||null}))} disabled={!editing||disabled} className="w-full disabled:opacity-60"><option value="">—</option>{options?.map(o=><option key={o.id} value={o.id}>{o.name}</option>)}</Select>
      : type==='textarea' ? <textarea value={form[name]||''} onChange={e=>setForm(f=>({...f,[name]:e.target.value}))} disabled={!editing} rows={3} className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm disabled:opacity-60 focus:border-emerald-500 outline-none resize-none"/>
      : <Input type={type} value={form[name]!=null?form[name]:''} onChange={e=>setForm(f=>({...f,[name]:e.target.value}))} disabled={!editing} className="w-full disabled:opacity-60"/>}
    </div>
  );

  const totalBuildings = sites.reduce((s, site) => s + (site.buildings?.length || 0), 0);
  const tabs = [
    { id:'info', icon:Building2, label:'Fiche' },
    { id:'notes', icon:FileText, label:`Commentaires (${notes.length})` },
    { id:'documents', icon:Paperclip, label:`Docs (${documents.length})` },
    { id:'sites', icon:Layers, label:`Sites (${sites.length})` },
    { id:'reminders', icon:Bell, label:`Rappels (${reminders.length})` },
    ...(isAdmin ? [{ id:'attribution', icon:UserCheck, label:`Équipe (${assignedIds.length})` }] : []),
    { id:'location', icon:MapPin, label:'Carte' },
    { id:'activity', icon:History, label:'Historique' }
  ];

  return (
    <div className="h-screen flex flex-col bg-slate-900">
      <header className="bg-slate-800/50 border-b border-slate-700 px-4 md:px-6 py-3 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="p-2 hover:bg-slate-700 rounded-xl text-slate-400"><ChevronLeft className="w-5 h-5"/></button>
            <div>
              <h1 className="text-lg font-bold text-white">{prospect.prospect_number ? <span className="text-slate-400 font-mono mr-2">#{prospect.prospect_number}</span> : null}{prospect.company_name||`${prospect.first_name} ${prospect.last_name}`}</h1>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                {prospect.is_client ? <Badge color="#10B981">✓ Client</Badge> : <Badge color="#3B82F6">Prospect</Badge>}
                {prospect.created_at&&<span className="text-xs text-slate-400">Créé le {formatDate(prospect.created_at)}</span>}
                {prospect.status&&<Badge color={prospect.status.color}>{prospect.status.name}</Badge>}
                {prospect.product&&<Badge color={prospect.product.color} small>{prospect.product.name}</Badge>}
                {prospect.category&&<Badge color={prospect.category.color} small>{prospect.category.name}</Badge>}
                {prospect.transmis_installateur&&<Badge color="#F59E0B" small>📤 Transmis</Badge>}
                {prospect.date_pose&&<Badge color="#8B5CF6" small>📅 Pose: {formatDate(prospect.date_pose)}</Badge>}
                {prospect.type_led&&<Badge color="#06B6D4" small>{typeLedLabels[prospect.type_led]}</Badge>}
                {prospect.mode_pose&&<Badge color="#A855F7" small>{modePoseLabels[prospect.mode_pose]}</Badge>}
                {prospect.categorie_aide&&<Badge color={categorieAideColors[prospect.categorie_aide]} small>Profil {prospect.categorie_aide}</Badge>}
                {prospect.has_vmc&&<Badge color="#14B8A6" small>VMC</Badge>}
                {prospect.closer&&<Badge color="#F97316" small>🎯 {prospect.closer.first_name} {prospect.closer.last_name}</Badge>}
                {isAdmin&&prospect.source&&<Badge color={prospect.source.color||'#6B7280'} small>📍 {prospect.source.name}</Badge>}
                {isAdmin&&assignedUsers.length>0&&<span className="text-xs text-slate-400">• {assignedUsers.map(u=>u.first_name).join(', ')}</span>}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {editing ? <>
              <Btn size="sm" onClick={()=>{setForm(prospect);setEditing(false);}}>Annuler</Btn>
              <Btn size="sm" variant="primary" icon={Save} onClick={handleSave}>Enregistrer</Btn>
            </> : <>
              <div className="relative">
                <Btn size="sm" variant="ghost" icon={MessageSquare} onClick={()=>setShowChatPanel(true)} title="Chat équipe">Chat</Btn>
                {unreadChat?.total>0 && <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-red-500 rounded-full text-[10px] text-white flex items-center justify-center font-bold animate-pulse">{unreadChat.total>99?'99+':unreadChat.total}</span>}
              </div>
              {isAdmin&&<Btn size="sm" variant="ghost" icon={Copy} onClick={()=>onDuplicate(prospect)}/>}
              <Btn size="sm" icon={Edit} onClick={()=>setEditing(true)}>Modifier</Btn>
              {isAdmin&&<Btn size="sm" variant="ghost" onClick={()=>onDelete(prospect.id)}><Trash2 className="w-4 h-4 text-red-400"/></Btn>}
            </>}
          </div>
        </div>
      </header>

      {/* Callback banner if status is "A rappeler" */}
      {prospect.status?.name?.toLowerCase().includes('rappeler') && (
        <div className="bg-amber-500/10 border-b border-amber-500/30 px-6 py-2 flex items-center gap-3">
          <BellRing className="w-4 h-4 text-amber-400 animate-pulse"/>
          <span className="text-amber-400 text-sm font-medium">Client à rappeler</span>
          {reminders.filter(r=>!r.completed).length===0&&<span className="text-amber-300/60 text-xs">— Créez un rappel dans l'onglet Rappels</span>}
        </div>
      )}

      <div className="border-b border-slate-700 px-4 md:px-6 overflow-x-auto">
        <div className="flex gap-0.5">{tabs.map(t=><button key={t.id} onClick={()=>setActiveTab(t.id)} className={cn("flex items-center gap-1.5 py-2.5 px-3 text-xs font-medium border-b-2 -mb-px transition-colors whitespace-nowrap", activeTab===t.id?"border-emerald-500 text-emerald-400":"border-transparent text-slate-400 hover:text-white")}><t.icon className="w-3.5 h-3.5"/>{t.label}</button>)}</div>
      </div>

      <div className="flex-1 overflow-auto p-4 md:p-6">
        {/* INFO TAB */}
        {activeTab==='info' && <div className="max-w-4xl grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2"><Building2 className="w-4 h-4 text-emerald-400"/> Entreprise</h3>
            <div><label className="block text-xs text-slate-400 mb-1">SIRET</label><div className="flex gap-2"><Input value={form.siret||''} onChange={e=>setForm(f=>({...f,siret:e.target.value}))} disabled={!editing} className="flex-1 disabled:opacity-60" placeholder="N° SIRET"/>{editing&&<Btn size="sm" variant="primary" onClick={handleSiret} disabled={siretLd||!form.siret}>{siretLd?<Loader2 className="w-4 h-4 animate-spin"/>:<Search className="w-4 h-4"/>}</Btn>}</div></div>
            {field("Raison sociale", "company_name")}
            <div className="grid grid-cols-2 gap-3">{field("Prénom", "first_name")}{field("Nom", "last_name")}</div>
          </div>
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2"><Phone className="w-4 h-4 text-emerald-400"/> Contact</h3>
            {field("Téléphone", "phone")}
            {field("Email", "email", "email")}
            <div><label className="block text-xs text-slate-400 mb-1">Adresse</label>{editing ? <AddressAutocomplete value={form.address||''} onChange={v=>setForm(f=>({...f,address:v}))} onSelect={handleAddrSelect}/> : <Input value={form.address||''} disabled className="w-full disabled:opacity-60"/>}</div>
            <div className="grid grid-cols-2 gap-3">{field("Code postal", "postal_code")}{field("Ville", "city")}</div>
          </div>
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2"><Package className="w-4 h-4 text-emerald-400"/> Commercial & Attribution</h3>
            {/* TYPE DE SITE / ACTIVITÉ — avant la sélection produit */}
            <div>
              <label className="block text-xs text-slate-400 mb-1">Type de site / activité</label>
              <Select value={form.type_site_activite||''} onChange={async e => {
                const val = e.target.value || null;
                const prev = form.type_site_activite;
                setForm(f=>({...f,type_site_activite:val}));
                lastSavedRef.current = { time: Date.now(), data: { type_site_activite: val } };
                try { await onUpdate(prospect.id, { type_site_activite: val }); refetchFull(); } catch(err) { showAlert(err.message,'error'); setForm(f=>({...f,type_site_activite:prev})); }
              }} className="w-full">
                <option value="">— Sélectionner le type de site —</option>
                <optgroup label="Industriel">
                  {TYPES_SITE_ACTIVITE.filter(t=>t.product==='destrat_industriel').map(t=><option key={t.value} value={t.value}>{t.label}</option>)}
                </optgroup>
                <optgroup label="Tertiaire">
                  {TYPES_SITE_ACTIVITE.filter(t=>t.product==='destrat_tertiaire').map(t=><option key={t.value} value={t.value}>{t.label}</option>)}
                </optgroup>
                <optgroup label="Groupe de froid">
                  {TYPES_SITE_ACTIVITE.filter(t=>t.product==='haute_pression').map(t=><option key={t.value} value={t.value}>{t.label}</option>)}
                </optgroup>
                <optgroup label="Serre agricole">
                  {TYPES_SITE_ACTIVITE.filter(t=>t.product==='vmc_serre').map(t=><option key={t.value} value={t.value}>{t.label}</option>)}
                </optgroup>
                <optgroup label="Autre">
                  {TYPES_SITE_ACTIVITE.filter(t=>t.product===null).map(t=><option key={t.value} value={t.value}>{t.label}</option>)}
                </optgroup>
              </Select>
              {(() => {
                const si = getRecommendedProduct(form.type_site_activite);
                if (!si) return null;
                const rl = si.product ? PRODUCT_LABELS[si.product] : 'NON ÉLIGIBLE';
                const bad = !si.product;
                return <div className={`mt-2 p-2 rounded-lg text-center font-bold text-xs ${bad ? 'bg-red-500/20 border border-red-500/40 text-red-400' : 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-400'}`}>
                  <span className="text-[9px] uppercase tracking-wider font-medium opacity-70 block mb-0.5">⚙ Système recommandé</span>
                  {bad ? <><XCircle className="w-3 h-3 inline mr-1"/>{rl}</> : <><CheckCircle className="w-3 h-3 inline mr-1"/>{rl}</>}
                </div>;
              })()}
            </div>
            {/* LIVE SELECTORS — instant save, no edit mode needed */}
            {[
              { label:'Statut', field:'status_id', options: statuses, color: true },
              { label:'Produit', field:'product_id', options: products, color: true },
              { label:"Secteur d'activité", field:'category_id', options: categories, color: true },
              { label:'Installateur', field:'installer_id', options: installers, color: false },
            ].map(({ label, field: fieldName, options, color }) => (
              <div key={fieldName}>
                <label className="block text-xs text-slate-400 mb-1">{label}</label>
                <div className="flex items-center gap-2">
                  {color && form[fieldName] && options.find(o=>o.id===form[fieldName]) && <span className="w-3 h-3 rounded-full flex-shrink-0" style={{backgroundColor: options.find(o=>o.id===form[fieldName])?.color}}/>}
                  <Select value={form[fieldName]||''} onChange={async e => {
                    const val = e.target.value || null;
                    const prev = form[fieldName];
                    setForm(f=>({...f,[fieldName]:val}));
                    if (fieldName === 'status_id') {
                      const targetStatus = statuses.find(s => s.id === val);
                      const isClient = targetStatus?.is_final || false;
                      setForm(f=>({...f,is_client:isClient}));
                      try {
                        await onUpdate(prospect.id, { [fieldName]: val, is_client: isClient });
                        refetchFull();
                      } catch(err) {
                        showAlert(err.message,'error');
                        setForm(f=>({...f,[fieldName]:prev, is_client: prospect.is_client}));
                      }
                    } else {
                      try { await onUpdate(prospect.id, { [fieldName]: val }); refetchFull(); } catch(err) { showAlert(err.message,'error'); setForm(f=>({...f,[fieldName]:prev})); }
                    }
                  }} className="w-full">
                    <option value="">— Aucun —</option>
                    {options.map(o=><option key={o.id} value={o.id}>{o.name}</option>)}
                  </Select>
                </div>
              </div>
            ))}
            {/* Type de projet — instant save */}
            <div>
              <label className="block text-xs text-slate-400 mb-1">Type de projet</label>
              <Select value={form.type_projet||''} onChange={async e => {
                const val = e.target.value || null;
                const prev = form.type_projet;
                setForm(f=>({...f,type_projet:val}));
                lastSavedRef.current = { time: Date.now(), data: { type_projet: val } };
                try { await onUpdate(prospect.id, { type_projet: val }); refetchFull(); } catch(err) { showAlert(err.message,'error'); setForm(f=>({...f,type_projet:prev})); }
              }} className="w-full">
                <option value="">— Aucun —</option>
                <option value="particulier">Particulier</option>
                <option value="pro">Professionnel</option>
              </Select>
            </div>
            {editing && field("Source", "source")}
            {/* PROVENANCE — admin only, instant save */}
            {isAdmin && <div>
              <label className="block text-xs text-slate-400 mb-1">Provenance</label>
              <div className="flex items-center gap-2">
                {form.source_id && (sources||[]).find(s=>s.id===form.source_id) && <span className="w-3 h-3 rounded-full flex-shrink-0" style={{backgroundColor: (sources||[]).find(s=>s.id===form.source_id)?.color || '#6B7280'}}/>}
                <Select value={form.source_id||''} onChange={async e => {
                  const val = e.target.value || null;
                  const prev = form.source_id;
                  setForm(f=>({...f,source_id:val}));
                  try { await onUpdate(prospect.id, { source_id: val }); refetchFull(); } catch(err) { showAlert(err.message,'error'); setForm(f=>({...f,source_id:prev})); }
                }} className="w-full">
                  <option value="">— Aucune —</option>
                  {(sources||[]).map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
                </Select>
              </div>
            </div>}
            {/* CLOSER — qui a shooté/fermé le client (instant save) */}
            <div>
              <label className="block text-xs text-slate-400 mb-1">Closer (qui a shooté le client)</label>
              <Select value={form.closer_id||''} onChange={async e => {
                const val = e.target.value || null;
                const prev = form.closer_id;
                setForm(f=>({...f,closer_id:val}));
                try { await onUpdate(prospect.id, { closer_id: val }); refetchFull(); } catch(err) { showAlert(err.message,'error'); setForm(f=>({...f,closer_id:prev})); }
              }} className="w-full">
                <option value="">— Aucun —</option>
                {users.map(u=><option key={u.id} value={u.id}>{u.first_name} {u.last_name}</option>)}
              </Select>
            </div>
            {/* TRANSMIS À INSTALLATEUR — instant toggle, no edit mode needed */}
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">Transmis à installateur</label>
              <label className="flex items-center gap-3 bg-slate-800 rounded-lg px-3 py-2.5 cursor-pointer hover:bg-slate-700/50 transition-colors">
                <div className={cn("w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all",
                  form.transmis_installateur ? "bg-amber-500 border-amber-500" : "border-slate-500 hover:border-amber-400")}>
                  {form.transmis_installateur && <Check className="w-4 h-4 text-white"/>}
                </div>
                <input type="checkbox" className="hidden" checked={form.transmis_installateur||false} onChange={async e => {
                  const val = e.target.checked;
                  const prev = form.transmis_installateur;
                  setForm(f=>({...f,transmis_installateur:val}));
                  try { await onUpdate(prospect.id, { transmis_installateur: val }); refetchFull(); } catch(err) { showAlert(err.message,'error'); setForm(f=>({...f,transmis_installateur:prev})); }
                }}/>
                <span className={cn("text-sm font-medium", form.transmis_installateur?"text-amber-400":"text-slate-400")}>
                  {form.transmis_installateur ? "✓ Transmis" : "Non transmis"}
                </span>
                {form.transmis_installateur && <Truck className="w-4 h-4 text-amber-400 ml-auto"/>}
              </label>
            </div>
            {/* INLINE USER ASSIGNMENT */}
            {isAdmin && <div>
              <label className="block text-xs text-slate-400 mb-1.5">Utilisateur(s) assigné(s)</label>
              <div className="space-y-1.5">
                {assignedUsers.map(u => (
                  <div key={u.id} className="flex items-center justify-between bg-slate-800 rounded-lg px-3 py-2">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 bg-emerald-500 rounded-full flex items-center justify-center text-white text-[10px] font-bold">{u.first_name?.[0]}</div>
                      <span className="text-white text-sm">{u.first_name} {u.last_name}</span>
                    </div>
                    <button onClick={async()=>{try{await onUnassign(prospect.id,u.id);}catch(err){showAlert(err.message,'error');}}} className="p-1 hover:bg-red-500/20 rounded text-red-400"><UserMinus className="w-3.5 h-3.5"/></button>
                  </div>
                ))}
                {assignedUsers.length===0 && <p className="text-slate-500 text-xs py-1">Aucun assigné</p>}
                {unassignedUsers.length > 0 && (
                  <Select value="" onChange={async e => {
                    if (!e.target.value) return;
                    try { await onAssign(prospect.id, e.target.value); } catch(err) { showAlert(err.message,'error'); }
                  }} className="w-full mt-1">
                    <option value="">+ Assigner un utilisateur...</option>
                    {unassignedUsers.map(u => <option key={u.id} value={u.id}>{u.first_name} {u.last_name}</option>)}
                  </Select>
                )}
              </div>
            </div>}
          </div>
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2"><FileText className="w-4 h-4 text-emerald-400"/> Détails techniques</h3>
            {(() => {
              const pCode = getProductCode(prospect, products);
              const computedCategorie = calcCategorieAide(form.nb_personnes_foyer, form.revenu_fiscal_ref, form.is_ile_de_france);
              // ===== PRODUIT LED =====
              if (pCode === 'led') return <>
                <div className="grid grid-cols-2 gap-3">{field("Surface (m²)", "surface", "number")}{field("Nb LED à installer", "nb_led", "number")}</div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Nb LED réel installé</label>
                  <Input type="number" value={form.nb_led_reel!=null?form.nb_led_reel:''} onChange={e=>setForm(f=>({...f,nb_led_reel:e.target.value}))} disabled={!editing} className="w-full disabled:opacity-60" placeholder="Nombre réel de LED installées"/>
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Matériel installé</label>
                  <Select value={form.type_led||''} onChange={async e => {
                    const val = e.target.value || null;
                    const prev = form.type_led;
                    setForm(f=>({...f,type_led:val}));
                    lastSavedRef.current = { time: Date.now(), data: { type_led: val } };
                    try { await onUpdate(prospect.id, { type_led: val }); refetchFull(); } catch(err) { showAlert(err.message,'error'); setForm(f=>({...f,type_led:prev})); }
                  }} className="w-full">
                    <option value="">— Aucun —</option>
                    {Object.entries(typeLedLabels).map(([k,v])=><option key={k} value={k}>{v}</option>)}
                  </Select>
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Installation ou Livraison</label>
                  <Select value={form.mode_pose||''} onChange={async e => {
                    const val = e.target.value || null;
                    const prev = form.mode_pose;
                    setForm(f=>({...f,mode_pose:val}));
                    lastSavedRef.current = { time: Date.now(), data: { mode_pose: val } };
                    try { await onUpdate(prospect.id, { mode_pose: val }); refetchFull(); } catch(err) { showAlert(err.message,'error'); setForm(f=>({...f,mode_pose:prev})); }
                  }} className="w-full">
                    <option value="">— Aucun —</option>
                    {Object.entries(modePoseLabels).map(([k,v])=><option key={k} value={k}>{v}</option>)}
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">{field("Puissance PAC (kW)", "puissance_pac", "number")}{field("Nb panneaux", "nb_panneaux", "number")}</div>
                {isAdmin && <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">CA Prévisionnel (€)</label>
                    <Input type="number" value={form.ca_previsionnel!=null?form.ca_previsionnel:''} onChange={e=>setForm(f=>({...f,ca_previsionnel:e.target.value}))} disabled={!editing} className="w-full disabled:opacity-60" placeholder="Auto"/>
                    {computedCaP !== null && form.nb_led && <p className="text-[10px] text-emerald-400/70 mt-1">{form.nb_led} LED × {(computedCaP/parseInt(form.nb_led)).toFixed(0)}€ = {computedCaP.toLocaleString('fr-FR')}€</p>}
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">CA Réel (€)</label>
                    <Input type="number" value={form.ca_reel!=null?form.ca_reel:''} onChange={e=>setForm(f=>({...f,ca_reel:e.target.value}))} disabled={!editing} className="w-full disabled:opacity-60" placeholder="Auto"/>
                    {computedCaR !== null && form.nb_led_reel && <p className="text-[10px] text-amber-400/70 mt-1">{form.nb_led_reel} LED × {(computedCaR/parseInt(form.nb_led_reel)).toFixed(0)}€ = {computedCaR.toLocaleString('fr-FR')}€</p>}
                  </div>
                </div>}
              </>;
              // ===== PRODUIT ITI =====
              if (pCode === 'iti') return <>
                {/* Zone climatique badge */}
                {form.zone_climatique && <div className="flex items-center gap-2 p-2 rounded-lg" style={{ backgroundColor: zoneColors[form.zone_climatique] + '20', borderLeft: `3px solid ${zoneColors[form.zone_climatique]}` }}>
                  <span className="w-3 h-3 rounded-full" style={{ backgroundColor: zoneColors[form.zone_climatique] }}/>
                  <span className="text-sm font-semibold" style={{ color: zoneColors[form.zone_climatique] }}>Zone {form.zone_climatique}</span>
                </div>}
                {/* Catégorie aide — calcul auto */}
                <div className="bg-slate-800/50 rounded-xl p-3 space-y-3 border border-slate-700">
                  <p className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">Calcul catégorie aide</p>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Île-de-France ?</label>
                    <Select value={form.is_ile_de_france ? 'true' : 'false'} onChange={async e => {
                      const val = e.target.value === 'true';
                      const prev = form.is_ile_de_france;
                      setForm(f => ({...f, is_ile_de_france: val}));
                      const newCat = calcCategorieAide(form.nb_personnes_foyer, form.revenu_fiscal_ref, val);
                      const saveData = { is_ile_de_france: val };
                      if (newCat) saveData.categorie_aide = newCat;
                      lastSavedRef.current = { time: Date.now(), data: saveData };
                      try { await onUpdate(prospect.id, saveData); refetchFull(); } catch(err) { showAlert(err.message,'error'); setForm(f=>({...f,is_ile_de_france:prev})); }
                    }} className="w-full">
                      <option value="false">Hors Île-de-France</option>
                      <option value="true">Île-de-France</option>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {field("Nb personnes dans le foyer", "nb_personnes_foyer", "number")}
                    {field("Revenu fiscal de référence (€)", "revenu_fiscal_ref", "number")}
                  </div>
                  {computedCategorie && <div className="flex items-center gap-2 mt-2 p-2 rounded-lg" style={{ backgroundColor: categorieAideColors[computedCategorie] + '20', borderLeft: `3px solid ${categorieAideColors[computedCategorie]}` }}>
                    <span className="w-3 h-3 rounded-full" style={{ backgroundColor: categorieAideColors[computedCategorie] }}/>
                    <span className="text-sm font-semibold" style={{ color: categorieAideColors[computedCategorie] }}>Profil {computedCategorie}</span>
                    <span className="text-xs text-slate-400">({categorieAideLabels[computedCategorie]})</span>
                  </div>}
                  {form.categorie_aide && !computedCategorie && <Badge color={categorieAideColors[form.categorie_aide]}>Profil {form.categorie_aide} ({categorieAideLabels[form.categorie_aide]})</Badge>}
                </div>
                {field("Numéro fiscal", "numero_fiscal")}
                {/* Surfaces */}
                <div className="bg-slate-800/50 rounded-xl p-3 space-y-3 border border-slate-700">
                  <p className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">Surfaces</p>
                  {field("Surface bâtiment (m²)", "surface_batiment", "number")}
                  <div className="grid grid-cols-2 gap-3">
                    {field("Surface mur intérieur à isoler (m²)", "surface_mur_interieur", "number")}
                    {field("Surface mur extérieur à isoler (m²)", "surface_mur_exterieur", "number")}
                  </div>
                  {field("Surface fenêtre à isoler (m²)", "surface_fenetre", "number")}
                  <div className="grid grid-cols-2 gap-3">
                    {field("Surface sous-sol à isoler (m²)", "surface_sous_sol", "number")}
                    {field("Surface comble à isoler (m²)", "surface_comble", "number")}
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Surface totale à isoler (m²)</label>
                    <Input type="number" value={(() => { const t = sumSurfacesIsoler(form); return t > 0 ? t : (form.surface_isoler_total || ''); })()} disabled className="w-full disabled:opacity-60 bg-slate-700/30" placeholder="Auto-calculé (somme des 5 surfaces)"/>
                    {sumSurfacesIsoler(form) > 0 && <p className="text-[10px] text-emerald-400/70 mt-1">Mur int {form.surface_mur_interieur||0} + Mur ext {form.surface_mur_exterieur||0} + Fenêtre {form.surface_fenetre||0} + Sous-sol {form.surface_sous_sol||0} + Comble {form.surface_comble||0} = {sumSurfacesIsoler(form)} m²</p>}
                  </div>
                </div>
                {/* VMC / PAC Split */}
                <div className="flex items-center gap-6">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={!!form.has_vmc} onChange={async e => {
                      const val = e.target.checked;
                      const prev = form.has_vmc;
                      setForm(f => ({...f, has_vmc: val, ...(val ? { has_pac_split: false } : {})}));
                      const saveData = { has_vmc: val };
                      if (val) saveData.has_pac_split = false;
                      lastSavedRef.current = { time: Date.now(), data: saveData };
                      try { await onUpdate(prospect.id, saveData); refetchFull(); } catch(err) { showAlert(err.message,'error'); setForm(f=>({...f, has_vmc: prev})); }
                    }} className="rounded border-slate-500"/>
                    <span className="text-sm text-slate-300">VMC</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={!!form.has_pac_split} onChange={async e => {
                      const val = e.target.checked;
                      const prev = form.has_pac_split;
                      setForm(f => ({...f, has_pac_split: val, ...(val ? { has_vmc: false } : {})}));
                      const saveData = { has_pac_split: val };
                      if (val) saveData.has_vmc = false;
                      lastSavedRef.current = { time: Date.now(), data: saveData };
                      try { await onUpdate(prospect.id, saveData); refetchFull(); } catch(err) { showAlert(err.message,'error'); setForm(f=>({...f, has_pac_split: prev})); }
                    }} className="rounded border-slate-500"/>
                    <span className="text-sm text-slate-300">PAC / Split</span>
                  </label>
                </div>
                {/* ITI — Option A/B + Commissions auto */}
                {(() => {
                  const cat = computedCategorie || form.categorie_aide;
                  const totalIsoler = sumSurfacesIsoler(form);
                  const surfH = parseFloat(form.surface_batiment) || parseFloat(form.surface_habitable) || 0;
                  const needsOption = itiNeedsOption(cat, surfH, totalIsoler);
                  const itiCalc = calcItiCommission(cat, surfH, totalIsoler, form.iti_option || 'A');
                  return <>
                    {needsOption && <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
                      <label className="block text-xs font-semibold text-amber-400 mb-2 uppercase tracking-wider">Option à choisir</label>
                      <Select value={form.iti_option || 'A'} onChange={async e => {
                        const val = e.target.value;
                        const prev = form.iti_option;
                        setForm(f => ({...f, iti_option: val}));
                        const saveData = { iti_option: val };
                        const newCalc = calcItiCommission(cat, surfH, totalIsoler, val);
                        if (newCalc) {
                          saveData.reste_a_charge = newCalc.rac;
                          saveData.commission_admin = newCalc.admin;
                          saveData.commission_telepro = newCalc.telepro;
                          saveData.commission_fournisseur = newCalc.fournisseur;
                        }
                        lastSavedRef.current = { time: Date.now(), data: saveData };
                        try { await onUpdate(prospect.id, saveData); refetchFull(); } catch(err) { showAlert(err.message,'error'); setForm(f=>({...f, iti_option: prev})); }
                      }} className="w-full">
                        <option value="A">Option A (RAC 0 € / Admin 500 €)</option>
                        <option value="B">Option B (RAC 1 000 € / Admin 1 000 €)</option>
                      </Select>
                    </div>}
                    {itiCalc ? <div className="bg-slate-800/50 rounded-xl p-3 space-y-2 border border-slate-700">
                      <p className="text-xs font-semibold text-emerald-400 uppercase tracking-wider flex items-center gap-1"><Euro className="w-3 h-3"/> Calcul automatique (BAR-TH-174)</p>
                      <div className="flex justify-between"><span className="text-xs text-slate-400">Reste à charge</span><span className="text-sm font-bold text-white">{itiCalc.rac.toLocaleString('fr-FR')} €</span></div>
                      {isAdmin && <div className="flex justify-between pt-1 border-t border-slate-700"><span className="text-xs font-semibold text-slate-300">Commission</span><span className="text-sm font-bold text-emerald-400">{itiCalc.commission.toLocaleString('fr-FR')} €</span></div>}
                    </div> : <div className="bg-slate-800/30 border border-dashed border-slate-600 rounded-lg p-3 text-xs text-slate-400">
                      <p className="font-semibold text-slate-300 mb-1 flex items-center gap-1"><AlertCircle className="w-3 h-3"/> Calcul commission ITI en attente</p>
                      <p className="text-[11px]">Pour afficher le Reste à charge et les commissions, renseignez :</p>
                      <ul className="list-disc list-inside mt-1 space-y-0.5 text-[11px]">
                        {!cat && <li className="text-amber-400">Catégorie d'aide (Nb personnes + revenu fiscal)</li>}
                        {surfH <= 0 && <li className="text-amber-400">Surface bâtiment</li>}
                        {totalIsoler <= 0 && <li className="text-amber-400">Au moins une surface à isoler (mur int/ext, fenêtre, sous-sol, comble)</li>}
                        {cat === 'rose' && <li className="text-red-400">Profil Rose (Aisé) : pas d'aide CEE applicable</li>}
                      </ul>
                    </div>}
                  </>;
                })()}
              </>;
              // ===== PRODUIT PAC =====
              if (pCode === 'pac') {
                const pacCalc = calcPacCommission(computedCategorie || form.categorie_aide, form.zone_climatique);
                return <>
                  {/* Zone climatique badge */}
                  {form.zone_climatique && <div className="flex items-center gap-2 p-2 rounded-lg" style={{ backgroundColor: zoneColors[form.zone_climatique] + '20', borderLeft: `3px solid ${zoneColors[form.zone_climatique]}` }}>
                    <span className="w-3 h-3 rounded-full" style={{ backgroundColor: zoneColors[form.zone_climatique] }}/>
                    <span className="text-sm font-semibold" style={{ color: zoneColors[form.zone_climatique] }}>Zone {form.zone_climatique}</span>
                  </div>}
                  {/* Catégorie aide — calcul auto */}
                  <div className="bg-slate-800/50 rounded-xl p-3 space-y-3 border border-slate-700">
                    <p className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">Calcul catégorie aide</p>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Île-de-France ?</label>
                      <Select value={form.is_ile_de_france ? 'true' : 'false'} onChange={async e => {
                        const val = e.target.value === 'true';
                        const prev = form.is_ile_de_france;
                        setForm(f => ({...f, is_ile_de_france: val}));
                        const newCat = calcCategorieAide(form.nb_personnes_foyer, form.revenu_fiscal_ref, val);
                        const saveData = { is_ile_de_france: val };
                        if (newCat) saveData.categorie_aide = newCat;
                        // Auto-compute PAC commission with new IDF value
                        if (newCat && form.zone_climatique) {
                          const pc = calcPacCommission(newCat, form.zone_climatique);
                          if (pc) { saveData.reste_a_charge = pc.reste_a_charge; saveData.commission_pac = pc.commission; }
                        }
                        lastSavedRef.current = { time: Date.now(), data: saveData };
                        try { await onUpdate(prospect.id, saveData); refetchFull(); } catch(err) { showAlert(err.message,'error'); setForm(f=>({...f,is_ile_de_france:prev})); }
                      }} className="w-full">
                        <option value="false">Hors Île-de-France</option>
                        <option value="true">Île-de-France</option>
                      </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      {field("Nb personnes dans le foyer", "nb_personnes_foyer", "number")}
                      {field("Revenu fiscal de référence (€)", "revenu_fiscal_ref", "number")}
                    </div>
                    {computedCategorie && <div className="flex items-center gap-2 mt-2 p-2 rounded-lg" style={{ backgroundColor: categorieAideColors[computedCategorie] + '20', borderLeft: `3px solid ${categorieAideColors[computedCategorie]}` }}>
                      <span className="w-3 h-3 rounded-full" style={{ backgroundColor: categorieAideColors[computedCategorie] }}/>
                      <span className="text-sm font-semibold" style={{ color: categorieAideColors[computedCategorie] }}>Profil {computedCategorie}</span>
                      <span className="text-xs text-slate-400">({categorieAideLabels[computedCategorie]})</span>
                    </div>}
                    {form.categorie_aide && !computedCategorie && <Badge color={categorieAideColors[form.categorie_aide]}>Profil {form.categorie_aide} ({categorieAideLabels[form.categorie_aide]})</Badge>}
                  </div>
                  {field("Numéro fiscal", "numero_fiscal")}
                  {/* Reste à charge — visible par tous */}
                  {pacCalc && <div className="bg-slate-800/50 rounded-xl p-3 space-y-2 border border-slate-700">
                    <div><label className="block text-xs text-slate-400 mb-1">Reste à charge (€)</label><div className="text-lg font-bold text-white">{pacCalc.reste_a_charge.toLocaleString('fr-FR')} €</div></div>
                    <p className="text-[10px] text-slate-500">Profil {computedCategorie || form.categorie_aide} + Zone {form.zone_climatique}</p>
                  </div>}
                  {/* Commission — admin uniquement */}
                  {isAdmin && pacCalc && <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-3 space-y-2">
                    <p className="text-xs font-semibold text-emerald-400 uppercase tracking-wider flex items-center gap-1"><Crown className="w-3 h-3"/> Commission PAC</p>
                    <div className="text-lg font-bold text-emerald-400">{pacCalc.commission.toLocaleString('fr-FR')} €</div>
                  </div>}
                  {!pacCalc && <>
                    {field("Reste à charge (€)", "reste_a_charge", "number")}
                    {isAdmin && field("Commission (€)", "commission_pac", "number")}
                  </>}
                  {/* Puissance PAC */}
                  {field("Puissance PAC (kW)", "puissance_pac", "number")}
                  {/* Ballon */}
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Type de ballon</label>
                    <Select value={form.ballon_type||''} onChange={async e => {
                      const val = e.target.value || null;
                      const prev = form.ballon_type;
                      setForm(f=>({...f,ballon_type:val}));
                      lastSavedRef.current = { time: Date.now(), data: { ballon_type: val } };
                      try { await onUpdate(prospect.id, { ballon_type: val }); refetchFull(); } catch(err) { showAlert(err.message,'error'); setForm(f=>({...f,ballon_type:prev})); }
                    }} className="w-full">
                      <option value="">— Aucun —</option>
                      <option value="electrique">Ballon électrique</option>
                      <option value="thermodynamique">Ballon thermodynamique</option>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {field("Surface habitable (m²)", "surface_habitable", "number")}
                    {field("Surface à chauffer (m²)", "surface_chauffer", "number")}
                  </div>
                </>;
              }
              // ===== DESTRATIFICATEUR TERTIAIRE =====
              if (pCode === 'destrat_tertiaire') return <>
                <div className="bg-violet-500/10 border border-violet-500/30 rounded-xl p-3 space-y-3">
                  <p className="text-xs font-semibold text-violet-400 uppercase tracking-wider flex items-center gap-1"><Zap className="w-3 h-3"/> Critères d'éligibilité — Destrat. tertiaire</p>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Bâtiment chauffé ?</label>
                    <Select value={form.batiment_chauffe||''} onChange={async e => {
                      const val = e.target.value || null;
                      const prev = form.batiment_chauffe;
                      setForm(f=>({...f,batiment_chauffe:val}));
                      lastSavedRef.current = { time: Date.now(), data: { batiment_chauffe: val } };
                      try { await onUpdate(prospect.id, { batiment_chauffe: val }); refetchFull(); } catch(err) { showAlert(err.message,'error'); setForm(f=>({...f,batiment_chauffe:prev})); }
                    }} className="w-full">
                      <option value="">— Sélectionner —</option>
                      <option value="oui_totalite">Oui, la totalité du site</option>
                      <option value="oui_partiellement">Oui, partiellement</option>
                      <option value="non">Non</option>
                    </Select>
                    {form.batiment_chauffe === 'non' && <p className="text-[11px] text-red-400 mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3"/> Le bâtiment doit être chauffé</p>}
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Mode de chauffage (gaz ou fuel obligatoire)</label>
                    <Select value={form.type_chauffage||''} onChange={async e => {
                      const val = e.target.value || null;
                      const prev = form.type_chauffage;
                      setForm(f=>({...f,type_chauffage:val}));
                      lastSavedRef.current = { time: Date.now(), data: { type_chauffage: val } };
                      try { await onUpdate(prospect.id, { type_chauffage: val }); refetchFull(); } catch(err) { showAlert(err.message,'error'); setForm(f=>({...f,type_chauffage:prev})); }
                    }} className="w-full">
                      <option value="">— Sélectionner —</option>
                      <option value="gaz">Chaudière à Gaz</option>
                      <option value="fuel">Chaudière à Fuel</option>
                    </Select>
                    {form.type_chauffage && form.type_chauffage !== 'gaz' && form.type_chauffage !== 'fuel' && <p className="text-[11px] text-red-400 mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3"/> Gaz ou Fuel obligatoire</p>}
                  </div>
                  {field("Puissance totale du chauffage (kW)", "puissance_chauffage", "number")}
                  {form.puissance_chauffage && parseFloat(form.puissance_chauffage) < 200 && <p className="text-[11px] text-red-400 flex items-center gap-1"><AlertCircle className="w-3 h-3"/> Minimum 200 kW requis</p>}
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Chaudière remplacée depuis 2017 ?</label>
                    <Select value={form.chaudiere_remplacee_2017 ? 'true' : 'false'} onChange={async e => {
                      const val = e.target.value === 'true';
                      const prev = form.chaudiere_remplacee_2017;
                      setForm(f=>({...f,chaudiere_remplacee_2017:val}));
                      lastSavedRef.current = { time: Date.now(), data: { chaudiere_remplacee_2017: val } };
                      try { await onUpdate(prospect.id, { chaudiere_remplacee_2017: val }); refetchFull(); } catch(err) { showAlert(err.message,'error'); setForm(f=>({...f,chaudiere_remplacee_2017:prev})); }
                    }} className="w-full">
                      <option value="false">Non</option>
                      <option value="true">Oui</option>
                    </Select>
                  </div>
                  {field("Hauteur sous plafond (m)", "hauteur_sous_plafond", "number")}
                  {form.hauteur_sous_plafond && parseFloat(form.hauteur_sous_plafond) < 5 && <p className="text-[11px] text-red-400 flex items-center gap-1"><AlertCircle className="w-3 h-3"/> Minimum 5m requis</p>}
                  {field("Surface bâtiment (m²)", "surface_batiment", "number")}
                  {(() => { const elig = checkEligibility('destrat_tertiaire', form); if (!elig) return null; return <div className={`mt-2 p-3 rounded-lg text-center font-bold text-sm ${elig.status === 'eligible' ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-400' : elig.status === 'non_eligible' ? 'bg-red-500/20 border border-red-500/40 text-red-400' : 'bg-slate-600/20 border border-slate-500/30 text-slate-400'}`}>{elig.status === 'eligible' ? <CheckCircle className="w-4 h-4 inline mr-1"/> : elig.status === 'non_eligible' ? <XCircle className="w-4 h-4 inline mr-1"/> : <AlertCircle className="w-4 h-4 inline mr-1"/>}{elig.label}{elig.reasons.length > 0 && <p className="text-[10px] font-normal mt-1">{elig.reasons.join(' • ')}</p>}</div>; })()}
                </div>
                {isAdmin && <div className="grid grid-cols-2 gap-3">{field("CA Prévisionnel (€)", "ca_previsionnel", "number")}{field("CA Réel (€)", "ca_reel", "number")}</div>}
              </>;
              // ===== DESTRATIFICATEUR INDUSTRIEL =====
              if (pCode === 'destrat_industriel') return <>
                <div className="bg-indigo-500/10 border border-indigo-500/30 rounded-xl p-3 space-y-3">
                  <p className="text-xs font-semibold text-indigo-400 uppercase tracking-wider flex items-center gap-1"><Zap className="w-3 h-3"/> Critères d'éligibilité — Destrat. industriel</p>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Bâtiment chauffé ?</label>
                    <Select value={form.batiment_chauffe||''} onChange={async e => {
                      const val = e.target.value || null;
                      const prev = form.batiment_chauffe;
                      setForm(f=>({...f,batiment_chauffe:val}));
                      lastSavedRef.current = { time: Date.now(), data: { batiment_chauffe: val } };
                      try { await onUpdate(prospect.id, { batiment_chauffe: val }); refetchFull(); } catch(err) { showAlert(err.message,'error'); setForm(f=>({...f,batiment_chauffe:prev})); }
                    }} className="w-full">
                      <option value="">— Sélectionner —</option>
                      <option value="oui_totalite">Oui, la totalité du site</option>
                      <option value="oui_partiellement">Oui, partiellement</option>
                      <option value="non">Non</option>
                    </Select>
                    {form.batiment_chauffe === 'non' && <p className="text-[11px] text-red-400 mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3"/> Le bâtiment doit être chauffé</p>}
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Mode de chauffage (gaz ou fuel obligatoire)</label>
                    <Select value={form.type_chauffage||''} onChange={async e => {
                      const val = e.target.value || null;
                      const prev = form.type_chauffage;
                      setForm(f=>({...f,type_chauffage:val}));
                      lastSavedRef.current = { time: Date.now(), data: { type_chauffage: val } };
                      try { await onUpdate(prospect.id, { type_chauffage: val }); refetchFull(); } catch(err) { showAlert(err.message,'error'); setForm(f=>({...f,type_chauffage:prev})); }
                    }} className="w-full">
                      <option value="">— Sélectionner —</option>
                      <option value="gaz">Chaudière à Gaz</option>
                      <option value="fuel">Chaudière à Fuel</option>
                    </Select>
                    {form.type_chauffage && form.type_chauffage !== 'gaz' && form.type_chauffage !== 'fuel' && <p className="text-[11px] text-red-400 mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3"/> Gaz ou Fuel obligatoire</p>}
                  </div>
                  {field("Puissance totale du chauffage (kW)", "puissance_chauffage", "number")}
                  {form.puissance_chauffage && parseFloat(form.puissance_chauffage) < 400 && <p className="text-[11px] text-red-400 flex items-center gap-1"><AlertCircle className="w-3 h-3"/> Minimum 400 kW requis</p>}
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Chaudière remplacée depuis 2017 ?</label>
                    <Select value={form.chaudiere_remplacee_2017 ? 'true' : 'false'} onChange={async e => {
                      const val = e.target.value === 'true';
                      const prev = form.chaudiere_remplacee_2017;
                      setForm(f=>({...f,chaudiere_remplacee_2017:val}));
                      lastSavedRef.current = { time: Date.now(), data: { chaudiere_remplacee_2017: val } };
                      try { await onUpdate(prospect.id, { chaudiere_remplacee_2017: val }); refetchFull(); } catch(err) { showAlert(err.message,'error'); setForm(f=>({...f,chaudiere_remplacee_2017:prev})); }
                    }} className="w-full">
                      <option value="false">Non</option>
                      <option value="true">Oui</option>
                    </Select>
                  </div>
                  {field("Hauteur sous plafond (m)", "hauteur_sous_plafond", "number")}
                  {form.hauteur_sous_plafond && parseFloat(form.hauteur_sous_plafond) < 5 && <p className="text-[11px] text-red-400 flex items-center gap-1"><AlertCircle className="w-3 h-3"/> Minimum 5m requis</p>}
                  {field("Surface bâtiment (m²)", "surface_batiment", "number")}
                  {(() => { const elig = checkEligibility('destrat_industriel', form); if (!elig) return null; return <div className={`mt-2 p-3 rounded-lg text-center font-bold text-sm ${elig.status === 'eligible' ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-400' : elig.status === 'non_eligible' ? 'bg-red-500/20 border border-red-500/40 text-red-400' : 'bg-slate-600/20 border border-slate-500/30 text-slate-400'}`}>{elig.status === 'eligible' ? <CheckCircle className="w-4 h-4 inline mr-1"/> : elig.status === 'non_eligible' ? <XCircle className="w-4 h-4 inline mr-1"/> : <AlertCircle className="w-4 h-4 inline mr-1"/>}{elig.label}{elig.reasons.length > 0 && <p className="text-[10px] font-normal mt-1">{elig.reasons.join(' • ')}</p>}</div>; })()}
                </div>
                {isAdmin && <div className="grid grid-cols-2 gap-3">{field("CA Prévisionnel (€)", "ca_previsionnel", "number")}{field("CA Réel (€)", "ca_reel", "number")}</div>}
              </>;
              // ===== HAUTE PRESSION FLOTTANTE =====
              if (pCode === 'haute_pression') return <>
                <div className="bg-pink-500/10 border border-pink-500/30 rounded-xl p-3 space-y-3">
                  <p className="text-xs font-semibold text-pink-400 uppercase tracking-wider flex items-center gap-1"><Zap className="w-3 h-3"/> Critères d'éligibilité — Haute pression flottante</p>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">GTB / GTC installé ?</label>
                    <Select value={form.gtb_gtc_installe ? 'true' : 'false'} onChange={async e => {
                      const val = e.target.value === 'true';
                      const prev = form.gtb_gtc_installe;
                      setForm(f=>({...f,gtb_gtc_installe:val}));
                      lastSavedRef.current = { time: Date.now(), data: { gtb_gtc_installe: val } };
                      try { await onUpdate(prospect.id, { gtb_gtc_installe: val }); refetchFull(); } catch(err) { showAlert(err.message,'error'); setForm(f=>({...f,gtb_gtc_installe:prev})); }
                    }} className="w-full">
                      <option value="false">Non</option>
                      <option value="true">Oui</option>
                    </Select>
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Groupes froids (chambre froide, meubles frigo)</label>
                    <Select value={form.groupe_froid_existant ? 'true' : 'false'} onChange={async e => {
                      const val = e.target.value === 'true';
                      const prev = form.groupe_froid_existant;
                      setForm(f=>({...f,groupe_froid_existant:val}));
                      lastSavedRef.current = { time: Date.now(), data: { groupe_froid_existant: val } };
                      try { await onUpdate(prospect.id, { groupe_froid_existant: val }); refetchFull(); } catch(err) { showAlert(err.message,'error'); setForm(f=>({...f,groupe_froid_existant:prev})); }
                    }} className="w-full">
                      <option value="false">Non</option>
                      <option value="true">Oui</option>
                    </Select>
                    <p className="text-[10px] text-red-400 mt-0.5 font-medium">EXCLU LA CLIMATISATION !!!</p>
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Groupe ancien ou neuf</label>
                    <Select value={form.groupe_ancien_neuf||''} onChange={async e => {
                      const val = e.target.value || null;
                      const prev = form.groupe_ancien_neuf;
                      setForm(f=>({...f,groupe_ancien_neuf:val}));
                      lastSavedRef.current = { time: Date.now(), data: { groupe_ancien_neuf: val } };
                      try { await onUpdate(prospect.id, { groupe_ancien_neuf: val }); refetchFull(); } catch(err) { showAlert(err.message,'error'); setForm(f=>({...f,groupe_ancien_neuf:prev})); }
                    }} className="w-full">
                      <option value="">— Sélectionner —</option>
                      <option value="ancien">Ancien</option>
                      <option value="neuf">Neuf</option>
                    </Select>
                  </div>
                  {field("Surface du groupe froid (m²)", "surface_groupe_froid", "number")}
                  {form.surface_groupe_froid && parseFloat(form.surface_groupe_froid) < 15 && <p className="text-[11px] text-red-400 flex items-center gap-1"><AlertCircle className="w-3 h-3"/> Minimum 15 m² requis</p>}
                  {field("Puissance électrique (kW)", "puissance_electrique", "number")}
                  {form.puissance_electrique && parseFloat(form.puissance_electrique) < 50 && <p className="text-[11px] text-red-400 flex items-center gap-1"><AlertCircle className="w-3 h-3"/> Minimum 50 kW requis</p>}
                  {field("Surface bloc de froid (m²)", "surface_bloc_froid", "number")}
                  {field("Surface bâtiment (m²)", "surface_batiment", "number")}
                  {(() => { const elig = checkEligibility('haute_pression', form); if (!elig) return null; return <div className={`mt-2 p-3 rounded-lg text-center font-bold text-sm ${elig.status === 'eligible' ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-400' : elig.status === 'non_eligible' ? 'bg-red-500/20 border border-red-500/40 text-red-400' : 'bg-slate-600/20 border border-slate-500/30 text-slate-400'}`}>{elig.status === 'eligible' ? <CheckCircle className="w-4 h-4 inline mr-1"/> : elig.status === 'non_eligible' ? <XCircle className="w-4 h-4 inline mr-1"/> : <AlertCircle className="w-4 h-4 inline mr-1"/>}{elig.label}{elig.reasons.length > 0 && <p className="text-[10px] font-normal mt-1">{elig.reasons.join(' • ')}</p>}</div>; })()}
                </div>
                {isAdmin && <div className="grid grid-cols-2 gap-3">{field("CA Prévisionnel (€)", "ca_previsionnel", "number")}{field("CA Réel (€)", "ca_reel", "number")}</div>}
              </>;
              // ===== VMC SERRE AGRICOLE =====
              if (pCode === 'vmc_serre') return <>
                <div className="bg-orange-500/10 border border-orange-500/30 rounded-xl p-3 space-y-3">
                  <p className="text-xs font-semibold text-orange-400 uppercase tracking-wider flex items-center gap-1"><Zap className="w-3 h-3"/> Critères d'éligibilité — VMC serre agricole</p>
                  {field("Surface serre (m²)", "surface_serre", "number")}
                  {form.surface_serre && parseFloat(form.surface_serre) < 1000 && <p className="text-[11px] text-red-400 flex items-center gap-1"><AlertCircle className="w-3 h-3"/> Minimum 1 000 m² requis</p>}
                  <p className="text-[11px] text-slate-400">Si le client a plusieurs serres, ne prendre que celle de 1 000 m² minimum</p>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Serre électrifiée</label>
                    <Select value={form.serre_electrifiee ? 'true' : 'false'} onChange={async e => {
                      const val = e.target.value === 'true';
                      const prev = form.serre_electrifiee;
                      setForm(f=>({...f,serre_electrifiee:val}));
                      lastSavedRef.current = { time: Date.now(), data: { serre_electrifiee: val } };
                      try { await onUpdate(prospect.id, { serre_electrifiee: val }); refetchFull(); } catch(err) { showAlert(err.message,'error'); setForm(f=>({...f,serre_electrifiee:prev})); }
                    }} className="w-full">
                      <option value="false">Non</option>
                      <option value="true">Oui</option>
                    </Select>
                    {!form.serre_electrifiee && <p className="text-[11px] text-amber-400 mt-1">La serre doit être électrifiée</p>}
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Type de serre</label>
                    <Select value={form.type_serre||''} onChange={async e => {
                      const val = e.target.value || null;
                      const prev = form.type_serre;
                      setForm(f=>({...f,type_serre:val}));
                      lastSavedRef.current = { time: Date.now(), data: { type_serre: val } };
                      try { await onUpdate(prospect.id, { type_serre: val }); refetchFull(); } catch(err) { showAlert(err.message,'error'); setForm(f=>({...f,type_serre:prev})); }
                    }} className="w-full">
                      <option value="">— Sélectionner —</option>
                      <option value="maraichere">Maraîchère</option>
                      <option value="horticole">Horticole</option>
                    </Select>
                    {form.type_serre === 'horticole' && <p className="text-[11px] text-red-400 mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3"/> NON ÉLIGIBLE — uniquement serres maraîchères</p>}
                    <p className="text-[10px] text-slate-500 mt-0.5">Vérifier sur Pappers si maraîchère</p>
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Statut d'occupation</label>
                    <Select value={form.statut_occupation||''} onChange={async e => {
                      const val = e.target.value || null;
                      const prev = form.statut_occupation;
                      setForm(f=>({...f,statut_occupation:val}));
                      lastSavedRef.current = { time: Date.now(), data: { statut_occupation: val } };
                      try { await onUpdate(prospect.id, { statut_occupation: val }); refetchFull(); } catch(err) { showAlert(err.message,'error'); setForm(f=>({...f,statut_occupation:prev})); }
                    }} className="w-full">
                      <option value="">— Sélectionner —</option>
                      <option value="proprietaire">Propriétaire</option>
                      <option value="locataire">Locataire</option>
                    </Select>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={!!form.deja_prime_cee_deshumidificateur} onChange={async e => {
                      const val = e.target.checked;
                      const prev = form.deja_prime_cee_deshumidificateur;
                      setForm(f=>({...f,deja_prime_cee_deshumidificateur:val}));
                      lastSavedRef.current = { time: Date.now(), data: { deja_prime_cee_deshumidificateur: val } };
                      try { await onUpdate(prospect.id, { deja_prime_cee_deshumidificateur: val }); refetchFull(); } catch(err) { showAlert(err.message,'error'); setForm(f=>({...f,deja_prime_cee_deshumidificateur:prev})); }
                    }} className="rounded border-slate-500"/>
                    <span className="text-sm text-slate-300">Déjà bénéficié d'une prime CEE pour déshumidificateur</span>
                  </label>
                  {form.deja_prime_cee_deshumidificateur && <p className="text-[11px] text-red-400 flex items-center gap-1"><AlertCircle className="w-3 h-3"/> NON ÉLIGIBLE — prime déjà perçue</p>}
                  {field("Surface bâtiment (m²)", "surface_batiment", "number")}
                  {(() => { const elig = checkEligibility('vmc_serre', form); if (!elig) return null; return <div className={`mt-2 p-3 rounded-lg text-center font-bold text-sm ${elig.status === 'eligible' ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-400' : elig.status === 'non_eligible' ? 'bg-red-500/20 border border-red-500/40 text-red-400' : 'bg-slate-600/20 border border-slate-500/30 text-slate-400'}`}>{elig.status === 'eligible' ? <CheckCircle className="w-4 h-4 inline mr-1"/> : elig.status === 'non_eligible' ? <XCircle className="w-4 h-4 inline mr-1"/> : <AlertCircle className="w-4 h-4 inline mr-1"/>}{elig.label}{elig.reasons.length > 0 && <p className="text-[10px] font-normal mt-1">{elig.reasons.join(' • ')}</p>}</div>; })()}
                </div>
                {isAdmin && <div className="grid grid-cols-2 gap-3">{field("CA Prévisionnel (€)", "ca_previsionnel", "number")}{field("CA Réel (€)", "ca_reel", "number")}</div>}
              </>;
              // ===== DÉSHUMIDIFICATEUR SERRE AGRICOLE =====
              if (pCode === 'deshumidificateur') return <>
                <div className="bg-teal-500/10 border border-teal-500/30 rounded-xl p-3 space-y-3">
                  <p className="text-xs font-semibold text-teal-400 uppercase tracking-wider flex items-center gap-1"><Zap className="w-3 h-3"/> Critères d'éligibilité — Déshumidificateur serre</p>
                  <p className="text-[11px] text-teal-300 font-medium">SERRES MARAÎCHÈRES UNIQUEMENT</p>
                  {field("Surface serre (m²)", "surface_serre", "number")}
                  {form.surface_serre && parseFloat(form.surface_serre) < 1000 && <p className="text-[11px] text-red-400 flex items-center gap-1"><AlertCircle className="w-3 h-3"/> Minimum 1 000 m² requis</p>}
                  <p className="text-[11px] text-slate-400">Si le client a plusieurs serres, ne prendre que celle de 1 000 m² minimum</p>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Serre électrifiée</label>
                    <Select value={form.serre_electrifiee ? 'true' : 'false'} onChange={async e => {
                      const val = e.target.value === 'true';
                      const prev = form.serre_electrifiee;
                      setForm(f=>({...f,serre_electrifiee:val}));
                      lastSavedRef.current = { time: Date.now(), data: { serre_electrifiee: val } };
                      try { await onUpdate(prospect.id, { serre_electrifiee: val }); refetchFull(); } catch(err) { showAlert(err.message,'error'); setForm(f=>({...f,serre_electrifiee:prev})); }
                    }} className="w-full">
                      <option value="false">Non</option>
                      <option value="true">Oui</option>
                    </Select>
                    {!form.serre_electrifiee && <p className="text-[11px] text-amber-400 mt-1">La serre doit être électrifiée</p>}
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Type de serre</label>
                    <Select value={form.type_serre||''} onChange={async e => {
                      const val = e.target.value || null;
                      const prev = form.type_serre;
                      setForm(f=>({...f,type_serre:val}));
                      lastSavedRef.current = { time: Date.now(), data: { type_serre: val } };
                      try { await onUpdate(prospect.id, { type_serre: val }); refetchFull(); } catch(err) { showAlert(err.message,'error'); setForm(f=>({...f,type_serre:prev})); }
                    }} className="w-full">
                      <option value="">— Sélectionner —</option>
                      <option value="maraichere">Maraîchère</option>
                      <option value="horticole">Horticole</option>
                    </Select>
                    {form.type_serre === 'horticole' && <p className="text-[11px] text-red-400 mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3"/> NON ÉLIGIBLE — uniquement serres maraîchères</p>}
                    <p className="text-[10px] text-slate-500 mt-0.5">Vérifier sur Pappers si maraîchère</p>
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Statut d'occupation</label>
                    <Select value={form.statut_occupation||''} onChange={async e => {
                      const val = e.target.value || null;
                      const prev = form.statut_occupation;
                      setForm(f=>({...f,statut_occupation:val}));
                      lastSavedRef.current = { time: Date.now(), data: { statut_occupation: val } };
                      try { await onUpdate(prospect.id, { statut_occupation: val }); refetchFull(); } catch(err) { showAlert(err.message,'error'); setForm(f=>({...f,statut_occupation:prev})); }
                    }} className="w-full">
                      <option value="">— Sélectionner —</option>
                      <option value="proprietaire">Propriétaire</option>
                      <option value="locataire">Locataire</option>
                    </Select>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={!!form.deja_prime_cee_deshumidificateur} onChange={async e => {
                      const val = e.target.checked;
                      const prev = form.deja_prime_cee_deshumidificateur;
                      setForm(f=>({...f,deja_prime_cee_deshumidificateur:val}));
                      lastSavedRef.current = { time: Date.now(), data: { deja_prime_cee_deshumidificateur: val } };
                      try { await onUpdate(prospect.id, { deja_prime_cee_deshumidificateur: val }); refetchFull(); } catch(err) { showAlert(err.message,'error'); setForm(f=>({...f,deja_prime_cee_deshumidificateur:prev})); }
                    }} className="rounded border-slate-500"/>
                    <span className="text-sm text-slate-300">Déjà bénéficié d'une prime CEE pour déshumidificateur</span>
                  </label>
                  {form.deja_prime_cee_deshumidificateur && <p className="text-[11px] text-red-400 flex items-center gap-1"><AlertCircle className="w-3 h-3"/> NON ÉLIGIBLE — prime déjà perçue</p>}
                  {field("Surface bâtiment (m²)", "surface_batiment", "number")}
                  {(() => { const elig = checkEligibility('deshumidificateur', form); if (!elig) return null; return <div className={`mt-2 p-3 rounded-lg text-center font-bold text-sm ${elig.status === 'eligible' ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-400' : elig.status === 'non_eligible' ? 'bg-red-500/20 border border-red-500/40 text-red-400' : 'bg-slate-600/20 border border-slate-500/30 text-slate-400'}`}>{elig.status === 'eligible' ? <CheckCircle className="w-4 h-4 inline mr-1"/> : elig.status === 'non_eligible' ? <XCircle className="w-4 h-4 inline mr-1"/> : <AlertCircle className="w-4 h-4 inline mr-1"/>}{elig.label}{elig.reasons.length > 0 && <p className="text-[10px] font-normal mt-1">{elig.reasons.join(' • ')}</p>}</div>; })()}
                </div>
                {isAdmin && <div className="grid grid-cols-2 gap-3">{field("CA Prévisionnel (€)", "ca_previsionnel", "number")}{field("CA Réel (€)", "ca_reel", "number")}</div>}
              </>;
              return null;
            })()}
            {/* CHAMPS COMMUNS À TOUS LES PRODUITS */}
            {/* Type de projet — pro/particulier */}
            <div>
              <label className="block text-xs text-slate-400 mb-1">Type de projet</label>
              <Select value={form.type_projet||''} onChange={async e => {
                const val = e.target.value || null;
                const prev = form.type_projet;
                setForm(f=>({...f,type_projet:val}));
                lastSavedRef.current = { time: Date.now(), data: { type_projet: val } };
                try { await onUpdate(prospect.id, { type_projet: val }); refetchFull(); } catch(err) { showAlert(err.message,'error'); setForm(f=>({...f,type_projet:prev})); }
              }} className="w-full">
                <option value="">— Sélectionner —</option>
                {typeProjetOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </Select>
            </div>
            {/* Type de cible — dropdown */}
            {form.type_projet === 'pro' && <div>
              <label className="block text-xs text-slate-400 mb-1">Type de cible</label>
              <Select value={form.type_cible||''} onChange={async e => {
                const val = e.target.value || null;
                const prev = form.type_cible;
                setForm(f=>({...f,type_cible:val}));
                lastSavedRef.current = { time: Date.now(), data: { type_cible: val } };
                try { await onUpdate(prospect.id, { type_cible: val }); refetchFull(); } catch(err) { showAlert(err.message,'error'); setForm(f=>({...f,type_cible:prev})); }
              }} className="w-full">
                <option value="">— Sélectionner —</option>
                {typeCibleOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </Select>
            </div>}
            {/* Type logement — particulier */}
            {form.type_projet === 'particulier' && <div>
              <label className="block text-xs text-slate-400 mb-1">Type de logement</label>
              <Select value={form.type_logement||''} onChange={async e => {
                const val = e.target.value || null;
                const prev = form.type_logement;
                setForm(f=>({...f,type_logement:val}));
                lastSavedRef.current = { time: Date.now(), data: { type_logement: val } };
                try { await onUpdate(prospect.id, { type_logement: val }); refetchFull(); } catch(err) { showAlert(err.message,'error'); setForm(f=>({...f,type_logement:prev})); }
              }} className="w-full">
                <option value="">— Aucun —</option>
                <option value="maison">Maison</option>
                <option value="appartement">Appartement</option>
              </Select>
            </div>}
            {/* Type de chauffage existant — masqué pour les produits qui ont déjà leur propre champ chauffage inline */}
            {!['destrat_tertiaire','destrat_industriel','haute_pression','vmc_serre','deshumidificateur'].includes(getProductCode(prospect, products)) && <div>
              <label className="block text-xs text-slate-400 mb-1">Type de chauffage existant</label>
              <Select value={form.type_chauffage||''} onChange={async e => {
                const val = e.target.value || null;
                const prev = form.type_chauffage;
                setForm(f=>({...f,type_chauffage:val}));
                lastSavedRef.current = { time: Date.now(), data: { type_chauffage: val } };
                try { await onUpdate(prospect.id, { type_chauffage: val }); refetchFull(); } catch(err) { showAlert(err.message,'error'); setForm(f=>({...f,type_chauffage:prev})); }
              }} className="w-full">
                <option value="">— Aucun —</option>
                {typeChauffageOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </Select>
            </div>}
            {/* DATE D'AUDIT — instant save */}
            <div>
              <label className="block text-xs text-slate-400 mb-1">Date d'audit</label>
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-amber-400 flex-shrink-0"/>
                <Input type="datetime-local" value={(() => {
                  if (!form.date_audit) return '';
                  const d = new Date(form.date_audit);
                  const pad = n => String(n).padStart(2,'0');
                  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
                })()} onChange={async e => {
                  const val = e.target.value ? new Date(e.target.value).toISOString() : null;
                  const prev = form.date_audit;
                  setForm(f=>({...f,date_audit:val}));
                  try { await onUpdate(prospect.id, { date_audit: val }); refetchFull(); } catch(err) { showAlert(err.message,'error'); setForm(f=>({...f,date_audit:prev})); }
                }} className="flex-1"/>
                {form.date_audit && <button onClick={async () => {
                  const prev = form.date_audit;
                  setForm(f=>({...f,date_audit:null}));
                  try { await onUpdate(prospect.id, { date_audit: null }); refetchFull(); } catch(err) { showAlert(err.message,'error'); setForm(f=>({...f,date_audit:prev})); }
                }} className="p-1.5 hover:bg-red-500/20 rounded text-red-400" title="Supprimer la date"><X className="w-4 h-4"/></button>}
              </div>
              {form.date_audit && <p className="text-xs text-amber-400 mt-1 flex items-center gap-1"><Calendar className="w-3 h-3"/> Audit prévu le {formatDateTime(form.date_audit)}</p>}
            </div>
            {/* DATE DE POSE — instant save (commun à tous les produits) */}
            <div>
              <label className="block text-xs text-slate-400 mb-1">Date de pose prévue</label>
              <div className="flex items-center gap-2">
                <CalendarDays className="w-4 h-4 text-emerald-400 flex-shrink-0"/>
                <Input type="datetime-local" value={(() => {
                  if (!form.date_pose) return '';
                  const d = new Date(form.date_pose);
                  const pad = n => String(n).padStart(2,'0');
                  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
                })()} onChange={async e => {
                  const val = e.target.value ? new Date(e.target.value).toISOString() : null;
                  const prev = form.date_pose;
                  setForm(f=>({...f,date_pose:val}));
                  try { await onUpdate(prospect.id, { date_pose: val }); refetchFull(); } catch(err) { showAlert(err.message,'error'); setForm(f=>({...f,date_pose:prev})); }
                }} className="flex-1"/>
                {form.date_pose && <button onClick={async () => {
                  const prev = form.date_pose;
                  setForm(f=>({...f,date_pose:null}));
                  try { await onUpdate(prospect.id, { date_pose: null }); refetchFull(); } catch(err) { showAlert(err.message,'error'); setForm(f=>({...f,date_pose:prev})); }
                }} className="p-1.5 hover:bg-red-500/20 rounded text-red-400" title="Supprimer la date"><X className="w-4 h-4"/></button>}
              </div>
              {form.date_pose && <p className="text-xs text-emerald-400 mt-1 flex items-center gap-1"><CalendarCheck className="w-3 h-3"/> Pose prévue le {formatDateTime(form.date_pose)}</p>}
            </div>
            {isAdmin && field("Notes admin", "notes_admin", "textarea")}
          </div>
        </div>}

        {/* NOTES TAB — REALTIME */}
        {activeTab==='notes' && <div className="max-w-2xl space-y-4">
          <div className="flex gap-2">
            <Input value={newNote} onChange={e=>setNewNote(e.target.value)} placeholder="Ajouter un commentaire..." className="flex-1 py-3" onKeyDown={e=>e.key==='Enter'&&!e.shiftKey&&handleAddNote()}/>
            <Btn variant="primary" onClick={handleAddNote} disabled={noteLoading||!newNote.trim()} icon={Send}/>
          </div>
          <p className="text-[10px] text-slate-500 italic">💬 Les commentaires apparaissent en temps réel pour tous les utilisateurs ayant accès à cette fiche</p>
          <div className="space-y-3">{notes.map(n=><div key={n.id} className="bg-slate-800 rounded-xl p-4">
            <div className="flex items-start justify-between mb-2"><div className="flex items-center gap-2"><div className="w-7 h-7 bg-emerald-500 rounded-full flex items-center justify-center text-white text-xs font-bold">{n.profile?.first_name?.[0]}</div><div><span className="text-white font-medium text-sm">{n.profile?.first_name} {n.profile?.last_name}</span><span className="text-slate-400 text-xs ml-2">{formatRelative(n.created_at)}</span></div></div><button onClick={()=>deleteNote(n.id)} className="p-1 hover:bg-slate-700 rounded text-slate-500 hover:text-red-400"><Trash2 className="w-3.5 h-3.5"/></button></div>
            <p className="text-slate-300 text-sm whitespace-pre-wrap">{n.content}</p>
          </div>)}{notes.length===0&&<p className="text-center text-slate-500 py-8 text-sm">Aucun commentaire</p>}</div>
        </div>}

        {/* DOCUMENTS TAB */}
        {activeTab==='documents' && <div className="max-w-2xl space-y-4">
          <label className="flex flex-col items-center justify-center w-full h-28 border-2 border-dashed border-slate-600 rounded-xl cursor-pointer hover:border-emerald-500 transition-colors">
            {uploading ? <><Loader2 className="w-6 h-6 text-emerald-400 animate-spin mb-1"/><p className="text-emerald-400 text-sm">{uploadProgress}%</p></> : <><Upload className="w-6 h-6 text-slate-500 mb-1"/><p className="text-slate-400 text-sm">PDF, images, documents (max 10MB)</p></>}
            <input type="file" className="hidden" multiple accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv" onChange={handleUpload} disabled={uploading}/>
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{documents.map(doc=><div key={doc.id} className="bg-slate-800 rounded-xl p-3 flex items-start gap-3 group">
            <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0", isImg(doc.mime_type)?"bg-purple-500/20":"bg-slate-700")}>{isImg(doc.mime_type)?<Image className="w-5 h-5 text-purple-400"/>:<Paperclip className="w-5 h-5 text-slate-400"/>}</div>
            <div className="flex-1 min-w-0"><button onClick={()=>openDoc(doc)} className="text-white text-sm font-medium hover:text-emerald-400 truncate block w-full text-left">{doc.name}</button><div className="text-xs text-slate-400 mt-0.5">{formatSize(doc.file_size)} • {doc.profile?.first_name} • {formatRelative(doc.created_at)}</div></div>
            <button onClick={()=>{if(confirm('Supprimer ?')) deleteDocument(doc);}} className="p-1 opacity-0 group-hover:opacity-100 hover:bg-red-500/20 rounded text-red-400"><Trash2 className="w-3.5 h-3.5"/></button>
          </div>)}</div>
          {documents.length===0&&<p className="text-center text-slate-500 py-8 text-sm">Aucun document</p>}
        </div>}

        {/* SITES TAB */}
        {activeTab==='sites' && <div className="max-w-3xl space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2"><Layers className="w-4 h-4 text-emerald-400"/> Sites ({sites.length})</h3>
            <Btn variant="primary" size="sm" icon={Plus} onClick={async()=>{try{await addSite({name:`Site ${sites.length+1}`});showAlert('Site ajouté');}catch(e){showAlert(e.message,'error');}}}>Ajouter un site</Btn>
          </div>

          {sites.length===0 && <div className="text-center py-12 bg-slate-800 rounded-xl border border-slate-700">
            <Layers className="w-10 h-10 text-slate-600 mx-auto mb-3"/>
            <p className="text-slate-400 mb-2">Aucun site</p>
            <p className="text-xs text-slate-500 mb-4">Ajoutez un site pour renseigner les bâtiments et luminaires du client</p>
            <Btn variant="primary" size="sm" icon={Plus} onClick={async()=>{try{await addSite({name:'Site 1'});showAlert('Site ajouté');}catch(e){showAlert(e.message,'error');}}}>Ajouter le premier site</Btn>
          </div>}

          {sites.map((site, si) => <SiteCard key={site.id} site={site} index={si} onUpdateSite={updateSite} onDeleteSite={deleteSite} onAddBuilding={addBuilding} onUpdateBuilding={updateBuilding} onDeleteBuilding={deleteBuilding} showAlert={showAlert}/>)}
        </div>}

        {/* REMINDERS TAB */}
        {activeTab==='reminders' && <div className="max-w-2xl space-y-4">
          <div className="bg-slate-800 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2"><Clock className="w-4 h-4 text-emerald-400"/> Nouveau rappel</h3>
            <div className="flex gap-2 flex-wrap">
              <Input type="datetime-local" value={reminderDate} onChange={e=>setReminderDate(e.target.value)} className="w-52"/>
              <Input value={reminderMsg} onChange={e=>setReminderMsg(e.target.value)} placeholder="Rappeler pour..." className="flex-1 min-w-[200px]" onKeyDown={e=>e.key==='Enter'&&reminderDate&&handleAddReminder()}/>
              <Btn variant="primary" icon={reminderSaving?Loader2:Bell} onClick={handleAddReminder} disabled={!reminderDate||reminderSaving}>{reminderSaving?'...':'Programmer'}</Btn>
            </div>
            <div className="flex gap-2 mt-2 flex-wrap">
              {['Dans 1h','Demain 9h','Lundi 9h','Dans 3j'].map((label,i) => {
                const getD = () => { const d=new Date(); if(i===0) d.setHours(d.getHours()+1); else if(i===1){d.setDate(d.getDate()+1);d.setHours(9,0,0,0);} else if(i===2){const day=d.getDay();const dm=day===0?1:8-day;d.setDate(d.getDate()+dm);d.setHours(9,0,0,0);} else {d.setDate(d.getDate()+3);d.setHours(9,0,0,0);}
                  const pad=n=>String(n).padStart(2,'0'); return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`; };
                return <button key={i} onClick={()=>setReminderDate(getD())} className="px-3 py-1 bg-slate-700 hover:bg-slate-600 rounded-lg text-xs text-slate-300 transition-colors">{label}</button>;
              })}
            </div>
          </div>
          {/* Pending reminders */}
          {(()=>{
            const pending = reminders.filter(r=>!r.completed);
            const completed = reminders.filter(r=>r.completed);
            return <>
              <div className="space-y-2">{pending.map(r => {
                const over = new Date(r.due_date)<new Date();
                const busy = reminderBusy === r.id;
                return <div key={r.id} className={cn("flex items-center gap-3 p-3 rounded-xl transition-all duration-200", over?"bg-red-500/10 border border-red-500/30":"bg-slate-800", busy&&"opacity-40 pointer-events-none scale-[0.98]")}>
                  <button disabled={busy} onClick={async()=>{setReminderBusy(r.id);try{await completeReminder(r.id);showAlert('Rappel complété ✓');}catch(e){showAlert(e.message,'error');}setReminderBusy(null);}} className={cn("w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all hover:scale-110", over?"border-red-500 hover:bg-red-500":"border-slate-500 hover:border-emerald-500 hover:bg-emerald-500")}>{busy&&<Loader2 className="w-3 h-3 text-white animate-spin"/>}</button>
                  <div className="flex-1 min-w-0"><p className="text-sm text-white">{r.message||'Rappel'}</p><p className={cn("text-xs",over?"text-red-400 font-medium":"text-slate-400")}>{over?'⚠ EN RETARD — ':''}{formatDateTime(r.due_date)}</p></div>
                  <button disabled={busy} onClick={async()=>{setReminderBusy(r.id);try{await deleteReminder(r.id);}catch(e){showAlert(e.message,'error');}setReminderBusy(null);}} className="p-1.5 hover:bg-red-500/20 rounded-lg text-slate-500 hover:text-red-400 transition-colors disabled:opacity-30"><Trash2 className="w-3.5 h-3.5"/></button>
                </div>;
              })}{pending.length===0&&<p className="text-center text-slate-500 py-4 text-sm">Aucun rappel en attente</p>}</div>
              {/* Completed reminders - collapsible with uncomplete */}
              {completed.length>0&&<div>
                <p className="text-xs text-slate-500 uppercase font-semibold mb-2">✓ Terminés ({completed.length})</p>
                <div className="space-y-1">{completed.slice(0,5).map(r=>{
                  const busy = reminderBusy === r.id;
                  return <div key={r.id} className={cn("flex items-center gap-3 p-2.5 rounded-xl bg-slate-800/30 transition-all duration-200", busy?"opacity-20 pointer-events-none scale-[0.98]":"opacity-50 hover:opacity-80")}>
                    <button disabled={busy} onClick={async()=>{setReminderBusy(r.id);try{await uncompleteReminder(r.id);showAlert('Rappel remis en attente');}catch(e){showAlert(e.message,'error');}setReminderBusy(null);}} title="Remettre en attente" className="w-5 h-5 bg-emerald-500 hover:bg-amber-500 rounded-full flex items-center justify-center flex-shrink-0 transition-colors cursor-pointer">{busy?<Loader2 className="w-3 h-3 text-white animate-spin"/>:<Check className="w-3 h-3 text-white"/>}</button>
                    <div className="flex-1 min-w-0"><p className="text-sm text-slate-400 line-through">{r.message||'Rappel'}</p><p className="text-xs text-slate-500">{formatDateTime(r.due_date)}</p></div>
                    <button disabled={busy} onClick={async()=>{setReminderBusy(r.id);try{await deleteReminder(r.id);}catch(e){showAlert(e.message,'error');}setReminderBusy(null);}} className="p-1 hover:bg-red-500/20 rounded text-slate-600 hover:text-red-400 transition-colors disabled:opacity-30"><Trash2 className="w-3 h-3"/></button>
                  </div>;}
                )}{completed.length>5&&<p className="text-xs text-slate-600 text-center">+{completed.length-5} autres</p>}</div>
              </div>}
            </>;
          })()}
        </div>}

        {/* ATTRIBUTION TAB */}
        {activeTab==='attribution' && isAdmin && <div className="max-w-2xl space-y-6">
          <div>
            <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2"><UserCheck className="w-4 h-4 text-emerald-400"/> Assignés ({assignedUsers.length})</h3>
            {assignedUsers.length>0 ? <div className="space-y-2">{assignedUsers.map(u=><div key={u.id} className="flex items-center justify-between bg-slate-800 rounded-xl p-3">
              <div className="flex items-center gap-3"><div className="w-8 h-8 bg-emerald-500 rounded-full flex items-center justify-center text-white text-sm font-bold">{u.first_name?.[0]}</div><div><p className="text-white text-sm font-medium">{u.first_name} {u.last_name}</p><p className="text-xs text-slate-400">{u.email}</p></div></div>
              {isAdmin&&<Btn size="sm" variant="ghost" onClick={()=>onUnassign(prospect.id,u.id)}><UserMinus className="w-4 h-4 text-red-400"/></Btn>}
            </div>)}</div> : <p className="text-slate-500 bg-slate-800 rounded-xl p-4 text-center text-sm">Aucun utilisateur assigné</p>}
          </div>
          {isAdmin&&unassignedUsers.length>0&&<div>
            <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2"><UserPlus className="w-4 h-4 text-slate-400"/> Assigner</h3>
            <div className="space-y-2">{unassignedUsers.map(u=><div key={u.id} className="flex items-center justify-between bg-slate-800/50 rounded-xl p-3">
              <div className="flex items-center gap-3"><div className="w-8 h-8 bg-slate-600 rounded-full flex items-center justify-center text-white text-sm font-bold">{u.first_name?.[0]}</div><div><p className="text-white text-sm font-medium">{u.first_name} {u.last_name}</p><p className="text-xs text-slate-400">{u.email}</p></div></div>
              <Btn size="sm" variant="primary" icon={UserPlus} onClick={()=>onAssign(prospect.id,u.id)}>Assigner</Btn>
            </div>)}</div>
          </div>}
        </div>}

        {/* MAP TAB */}
        {activeTab==='location' && <div className="max-w-3xl">
          {prospect.latitude&&prospect.longitude ? <div className="h-[400px] rounded-xl overflow-hidden border border-slate-700"><SingleMapView lat={prospect.latitude} lng={prospect.longitude} name={prospect.company_name||`${prospect.first_name} ${prospect.last_name}`}/></div>
          : <div className="flex flex-col items-center justify-center h-64 text-center"><MapPin className="w-12 h-12 text-slate-600 mb-4"/><p className="text-slate-400 mb-2">Pas de coordonnées GPS</p><p className="text-xs text-slate-500">Utilisez la recherche d'adresse ou le SIRET pour géolocaliser ce prospect</p></div>}
        </div>}

        {/* ACTIVITY TAB */}
        {activeTab==='activity' && <div className="max-w-2xl space-y-2">
          {logs.map(log=><div key={log.id} className="flex items-start gap-3 p-3 bg-slate-800/50 rounded-xl">
            <div className="w-7 h-7 bg-slate-700 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0">{log.profile?.first_name?.[0]}</div>
            <div><p className="text-sm text-white"><span className="font-medium">{log.profile?.first_name} {log.profile?.last_name}</span> — {actionLabels[log.action]||log.action}</p><p className="text-xs text-slate-400">{formatDateTime(log.created_at)}</p></div>
          </div>)}
          {logs.length===0&&<p className="text-center text-slate-500 py-8 text-sm">Aucune activité</p>}
        </div>}
      </div>
      {/* Chat équipe — panneau latéral */}
      {showChatPanel && <ChatSidePanel onClose={()=>setShowChatPanel(false)} allUsers={users} onlineUsers={onlineUsers} unreadChat={unreadChat}/>}
    </div>
  );
});

// =====================================================
// CHAT SIDE PANEL — slide-over réutilisable depuis n'importe quelle page
// =====================================================
const ChatSidePanel = memo(({ onClose, allUsers, onlineUsers, unreadChat }) => {
  // Open on the channel that has the most unread messages, if any
  const initialChannel = (() => {
    const u = unreadChat?.unread || {};
    const maxCh = Object.keys(u).reduce((a,b) => (u[a]||0) >= (u[b]||0) ? a : b, 'general');
    return (u[maxCh] || 0) > 0 ? maxCh : 'general';
  })();
  const [activeChannel, setActiveChannel] = useState(initialChannel);
  const { messages, loading, sendMessage, deleteMessage } = useChat(activeChannel);
  const [msg, setMsg] = useState('');
  const [sending, setSending] = useState(false);
  const endRef = useRef(null);
  const { profile } = useAuth();
  // Mark channel as read whenever it becomes active (and on initial mount)
  useEffect(() => { unreadChat?.markRead?.(activeChannel); }, [activeChannel, unreadChat]);
  // Also mark as read whenever new messages arrive while panel is open on this channel
  useEffect(() => {
    if (messages.length > 0) unreadChat?.markRead?.(activeChannel);
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, activeChannel, unreadChat]);
  const handleSend = async () => {
    if (!msg.trim() || sending) return;
    setSending(true);
    try { await sendMessage(msg); setMsg(''); } catch(e) { console.warn(e); }
    finally { setSending(false); }
  };
  const channels = [
    { id: 'general', label: 'Général', color: '#10B981' },
    { id: 'iti', label: 'ITI', color: '#3B82F6' },
    { id: 'pac', label: 'PAC', color: '#EF4444' },
  ];
  return <div className="fixed inset-0 z-50 flex" onClick={onClose}>
    <div className="flex-1 bg-black/40"/>
    <div className="w-[440px] max-w-full bg-slate-900 border-l border-slate-700 flex flex-col shadow-2xl" onClick={e=>e.stopPropagation()}>
      <div className="px-4 py-3 border-b border-slate-700 flex items-center justify-between">
        <div className="flex items-center gap-2"><MessageSquare className="w-4 h-4 text-emerald-400"/><h2 className="text-sm font-semibold text-white">Chat équipe</h2></div>
        <button onClick={onClose} className="p-1.5 hover:bg-slate-800 rounded text-slate-400"><X className="w-4 h-4"/></button>
      </div>
      <div className="px-4 py-2 border-b border-slate-700 flex gap-1.5">
        {channels.map(ch => {
          const cnt = unreadChat?.unread?.[ch.id] || 0;
          return <button key={ch.id} onClick={()=>setActiveChannel(ch.id)} className={cn("relative px-2.5 py-1 rounded text-xs font-medium transition-colors", activeChannel===ch.id?"bg-slate-700 text-white":"text-slate-400 hover:text-white")} style={activeChannel===ch.id?{borderBottom:`2px solid ${ch.color}`}:{}}>
            # {ch.label}
            {cnt>0 && activeChannel!==ch.id && <span className="ml-1 inline-flex items-center justify-center min-w-[16px] h-4 px-1 bg-red-500 rounded-full text-[9px] text-white font-bold">{cnt>99?'99+':cnt}</span>}
          </button>;
        })}
      </div>
      <div className="flex-1 overflow-auto px-4 py-3 space-y-1">
        {loading && <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 text-emerald-400 animate-spin"/></div>}
        {!loading && messages.length===0 && <p className="text-xs text-slate-500 text-center py-8">Aucun message</p>}
        {messages.map((m, i) => {
          const isMe = m.user_id === profile?.id;
          const prev = i > 0 ? messages[i-1] : null;
          const showHeader = !prev || prev.user_id !== m.user_id || (new Date(m.created_at) - new Date(prev.created_at) > 300000);
          const userObj = m.profile || (allUsers||[]).find(u => u.id === m.user_id) || {};
          return <div key={m.id} className={cn("group", showHeader && "mt-2")}>
            {showHeader && <div className="flex items-center gap-2 mb-0.5">
              <div className={cn("w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold", isMe?"bg-emerald-600":"bg-blue-600")}>{userObj.first_name?.[0]||'?'}</div>
              <span className={cn("text-xs font-semibold", isMe?"text-emerald-400":"text-white")}>{userObj.first_name||'Utilisateur'} {userObj.last_name||''}</span>
              <span className="text-[9px] text-slate-500">{formatDateTime(m.created_at)}</span>
            </div>}
            <div className="flex items-start gap-1 pl-8">
              <p className="text-xs text-slate-300 leading-relaxed flex-1 whitespace-pre-wrap break-words">{m.content}</p>
              {isMe && <button onClick={async()=>{if(confirm('Supprimer ?')) try{await deleteMessage(m.id);}catch(e){}}} className="p-0.5 opacity-0 group-hover:opacity-100 hover:bg-red-500/20 rounded text-red-400"><Trash2 className="w-3 h-3"/></button>}
            </div>
          </div>;
        })}
        <div ref={endRef}/>
      </div>
      <div className="px-4 py-3 border-t border-slate-700 flex gap-2">
        <Input value={msg} onChange={e=>setMsg(e.target.value)} placeholder={`Message dans #${channels.find(c=>c.id===activeChannel)?.label}`} className="flex-1" onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();handleSend();}}}/>
        <Btn variant="primary" size="sm" onClick={handleSend} disabled={sending||!msg.trim()} icon={Send}>{sending?<Loader2 className="w-3 h-3 animate-spin"/>:null}</Btn>
      </div>
    </div>
  </div>;
});

// =====================================================
// INTERACTIVE LINE CHART — standalone component with hover tooltip
// =====================================================
const InteractiveLineChart = memo(({ data, lines, height=140, labels=true, formatY }) => {
  const [hoverIdx, setHoverIdx] = useState(null);
  const svgRef = useRef(null);
  const w = 700, h = height, padL = 5, padR = 5, padT = 10, padB = labels ? 22 : 5;
  const chartW = w - padL - padR, chartH = h - padT - padB;
  const maxVal = Math.max(...lines.flatMap(ln => data.map(d => d[ln.key])), 1);
  const xStep = data.length > 1 ? chartW / (data.length - 1) : chartW;
  const getY = v => padT + chartH - (v / maxVal) * chartH;
  const getX = i => padL + i * xStep;
  const fmtVal = v => formatY ? formatY(v) : (v >= 1000000 ? `${(v/1000000).toFixed(1)}M` : v >= 1000 ? `${(v/1000).toFixed(0)}k` : v.toLocaleString('fr-FR'));

  const handleMouseMove = useCallback((e) => {
    if (!svgRef.current || !data.length) return;
    const rect = svgRef.current.getBoundingClientRect();
    const mouseX = ((e.clientX - rect.left) / rect.width) * w;
    const idx = Math.round((mouseX - padL) / xStep);
    const clamped = Math.max(0, Math.min(data.length - 1, idx));
    setHoverIdx(clamped);
  }, [data.length, xStep, w, padL]);

  const hi = hoverIdx;
  const tipW = 130;

  return <svg ref={svgRef} viewBox={`0 0 ${w} ${h}`} className="w-full cursor-crosshair" preserveAspectRatio="none"
    onMouseMove={handleMouseMove} onMouseLeave={() => setHoverIdx(null)}>
    {/* Grid */}
    {[0, 0.5, 1].map(p => <line key={p} x1={padL} x2={w-padR} y1={getY(maxVal*p)} y2={getY(maxVal*p)} stroke="#334155" strokeWidth="0.5" strokeDasharray={p===0?"0":"3,3"}/>)}
    <text x={padL+2} y={padT+8} fill="#64748b" fontSize="8" fontFamily="system-ui">{fmtVal(maxVal)}</text>
    <text x={padL+2} y={getY(0)-2} fill="#64748b" fontSize="8" fontFamily="system-ui">0</text>
    {/* Lines + areas */}
    {lines.map(ln => {
      const points = data.map((d, i) => `${getX(i)},${getY(d[ln.key])}`).join(' ');
      const areaPoints = `${getX(0)},${getY(0)} ` + points + ` ${getX(data.length-1)},${getY(0)}`;
      return <g key={ln.key}>
        <polygon points={areaPoints} fill={ln.color} opacity="0.08"/>
        <polyline points={points} fill="none" stroke={ln.color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round"/>
        {data.map((d, i) => <circle key={i} cx={getX(i)} cy={getY(d[ln.key])} r={hi === i ? 5 : (d[ln.key] > 0 ? 2 : 0)} fill={ln.color} opacity={hi === i ? 1 : 0.6} style={{transition:'r 0.1s, opacity 0.1s'}}/>)}
      </g>;
    })}
    {/* Hover vertical line + tooltip */}
    {hi !== null && data[hi] && <>
      <line x1={getX(hi)} x2={getX(hi)} y1={padT} y2={h-padB} stroke="#94a3b8" strokeWidth="1" strokeDasharray="4,3" opacity="0.5"/>
      <rect x={getX(hi) > w/2 ? getX(hi) - tipW - 10 : getX(hi) + 10} y={padT + 2} width={tipW} height={18 + lines.length * 15} rx="5" fill="#0f172aee" stroke="#334155" strokeWidth="0.7"/>
      <text x={(getX(hi) > w/2 ? getX(hi) - tipW - 10 : getX(hi) + 10) + 8} y={padT + 15} fill="#f1f5f9" fontSize="9" fontWeight="700" fontFamily="system-ui">{data[hi].label}</text>
      {lines.map((ln, li) => <text key={ln.key} x={(getX(hi) > w/2 ? getX(hi) - tipW - 10 : getX(hi) + 10) + 8} y={padT + 30 + li * 15} fill={ln.color} fontSize="8.5" fontWeight="bold" fontFamily="system-ui">{ln.label || ln.key}: {fmtVal(data[hi][ln.key])}</text>)}
    </>}
    {/* X labels */}
    {labels && data.map((d, i) => i % Math.ceil(data.length/8) === 0 && <text key={i} x={getX(i)} y={h-3} fill="#475569" fontSize="7" textAnchor="middle" fontFamily="system-ui">{d.label}</text>)}
  </svg>;
});

// =====================================================
// STATS PAGE
// =====================================================
const periodLabels = { today:"Aujourd'hui", '7d':'7 jours', '30d':'30 jours', month:'Ce mois', all:'Tout', custom:'Dates' };
const StatsPage = memo(({ onBack, statuses, products, categories, counts, isAdmin, allUsers, onOpenProspect, onlineUsers }) => {
  const { profile } = useAuth();
  const userRole = profile?.role;
  const { rows: caRows, loading: devisLoading } = useDevisStats();
  const { logs: timeline, loading: tlLoading } = useGlobalTimeline(500);
  const [selUser, setSelUser] = useState(null);
  const [tab, setTab] = useState('overview');
  const [localPeriod, setLocalPeriod] = useState('month');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [tlFilter, setTlFilter] = useState('all');
  const [tlUserFilter, setTlUserFilter] = useState('all');
  const [caMode, setCaMode] = useState('cumul'); // cumul | daily
  const [filterProductId, setFilterProductId] = useState('all');
  const [filterUserId, setFilterUserId] = useState('all');

  const period = localPeriod;
  const changePeriod = useCallback(p => setLocalPeriod(p), []);
  const onlineCount = onlineUsers ? Object.keys(onlineUsers).length : 0;

  // ===== PERIOD BOUNDS =====
  const periodBounds = useMemo(() => {
    const now = new Date();
    if (period === 'custom' && customFrom) {
      const start = new Date(customFrom + 'T00:00:00');
      const end = customTo ? new Date(customTo + 'T23:59:59') : now;
      return { start, end };
    }
    const start = new Date();
    if (period === 'today') start.setHours(0,0,0,0);
    else if (period === '7d') { start.setDate(now.getDate() - 7); start.setHours(0,0,0,0); }
    else if (period === '30d') { start.setDate(now.getDate() - 30); start.setHours(0,0,0,0); }
    else if (period === 'month') { start.setDate(1); start.setHours(0,0,0,0); }
    else if (period === 'all') { start.setFullYear(2000, 0, 1); start.setHours(0,0,0,0); }
    return { start, end: now };
  }, [period, customFrom, customTo]);

  const prevBounds = useMemo(() => {
    const dur = periodBounds.end - periodBounds.start;
    return { start: new Date(periodBounds.start.getTime() - dur), end: new Date(periodBounds.start.getTime() - 1) };
  }, [periodBounds]);

  const periodLabel = useMemo(() => {
    if (period === 'custom' && customFrom) {
      const f = new Date(customFrom).toLocaleDateString('fr-FR', { day:'numeric', month:'short' });
      const t = customTo ? new Date(customTo).toLocaleDateString('fr-FR', { day:'numeric', month:'short' }) : "aujourd'hui";
      return `${f} → ${t}`;
    }
    return periodLabels[period] || period;
  }, [period, customFrom, customTo]);

  // ===== ALL STATS =====
  // Pre-filter by product and user
  const filteredCaRows = useMemo(() => {
    let rows = caRows;
    if (filterProductId !== 'all') rows = rows.filter(r => r.product_id === filterProductId);
    if (filterUserId !== 'all') rows = rows.filter(r => (r.assigned_users && Array.isArray(r.assigned_users) ? r.assigned_users.includes(filterUserId) : (r.created_by === filterUserId || r.user_id === filterUserId)));
    // Calcul du "gain" par dossier selon produit ET rôle.
    // Si les colonnes commission_* sont vides en base (anciennes fiches),
    // on re-calcule à la volée via calcItiCommission / calcPacCommission.
    return rows.map(r => {
      const prod = products.find(p => p.id === r.product_id);
      const pCode = prod ? getProductCode({ product: prod }, products) : null;
      let _gain = 0, _gainReel = 0;

      // Calcule la catégorie si elle manque en base
      let cat = r.categorie_aide;
      if (!cat && r.nb_personnes_foyer && r.revenu_fiscal_ref) {
        cat = calcCategorieAide(r.nb_personnes_foyer, r.revenu_fiscal_ref, r.is_ile_de_france);
      }

      if (pCode === 'pac') {
        // PAC : commission_pac en base, sinon calcul live à partir de cat + zone
        let pacVal = parseFloat(r.commission_pac) || 0;
        if (!pacVal && cat && r.zone_climatique) {
          const pc = calcPacCommission(cat, r.zone_climatique);
          if (pc) pacVal = pc.commission;
        }
        const v = isAdmin ? pacVal : 0;
        _gain = v; _gainReel = v;
      } else if (pCode === 'iti') {
        // ITI : commission unique (commission_admin). Calcul live si vide.
        let cAdm = parseFloat(r.commission_admin) || 0;
        if (!cAdm && cat) {
          const surfH = (parseFloat(r.surface_batiment) || parseFloat(r.surface_habitable) || 0);
          const totalIsoler = (parseFloat(r.surface_mur_interieur)||0) + (parseFloat(r.surface_mur_exterieur)||0) + (parseFloat(r.surface_fenetre)||0) + (parseFloat(r.surface_sous_sol)||0) + (parseFloat(r.surface_comble)||0);
          if (surfH > 0 && totalIsoler > 0) {
            const ic = calcItiCommission(cat, surfH, totalIsoler, r.iti_option || 'A');
            if (ic) cAdm = ic.commission;
          }
        }
        const v = isAdmin ? cAdm : 0;
        _gain = v; _gainReel = v;
      } else {
        _gain = r._ca || 0; _gainReel = r._reel || 0;
      }
      return { ...r, _gain, _gainReel, _pCode: pCode };
    });
  }, [caRows, filterProductId, filterUserId, products, isAdmin, userRole]);

  const periodStats = useMemo(() => {
    const inR = (r, b) => { const d = new Date(r.created_at); return d >= b.start && d <= b.end; };
    const periodRows = filteredCaRows.filter(r => inR(r, periodBounds));
    const prevRows = filteredCaRows.filter(r => inR(r, prevBounds));

    const compute = (rows) => {
      const total = rows.length;
      const clients = rows.filter(r => r.is_client).length;
      const transmis = rows.filter(r => r.transmis_installateur).length;
      let caTotal = 0, caReel = 0, caCount = 0;
      const by_status = {}, by_product = {}, by_category = {}, caByStatus = {}, caByUser = {};
      rows.forEach(r => {
        if (r.status_id) by_status[r.status_id] = (by_status[r.status_id] || 0) + 1;
        if (r.product_id) by_product[r.product_id] = (by_product[r.product_id] || 0) + 1;
        if (r.category_id) by_category[r.category_id] = (by_category[r.category_id] || 0) + 1;
        const sid = r.status_id || 'none';
        if (!caByStatus[sid]) caByStatus[sid] = { count: 0, sum: 0, sumReel: 0 };
        if (r._gain > 0 || r._gainReel > 0) { caByStatus[sid].count++; caByStatus[sid].sum += r._gain; caByStatus[sid].sumReel += r._gainReel; caTotal += r._gain; caReel += r._gainReel; caCount++; }
        // CA by assigned user
        if (r.assigned_users && Array.isArray(r.assigned_users)) {
          r.assigned_users.forEach(uid => {
            if (!caByUser[uid]) caByUser[uid] = { ca: 0, reel: 0, count: 0 };
            caByUser[uid].ca += r._gain || 0; caByUser[uid].reel += r._gainReel || 0; caByUser[uid].count++;
          });
        } else if (r.user_id) {
          if (!caByUser[r.user_id]) caByUser[r.user_id] = { ca: 0, reel: 0, count: 0 };
          caByUser[r.user_id].ca += r._gain || 0; caByUser[r.user_id].reel += r._gainReel || 0; caByUser[r.user_id].count++;
        }
      });
      return { total, clients, transmis, caTotal, caReel, caCount, by_status, by_product, by_category, caByStatus, caByUser };
    };

    const curr = compute(periodRows);
    const prev = compute(prevRows);

    // Time-series
    const tsMap = {};
    periodRows.forEach(r => {
      const d = new Date(r.created_at); d.setHours(0,0,0,0);
      const key = d.toISOString().slice(0,10);
      if (!tsMap[key]) tsMap[key] = { date: key, ca_prev: 0, ca_reel: 0, count: 0, newProspects: 0 };
      if (r._gain > 0 || r._gainReel > 0) { tsMap[key].ca_prev += r._gain; tsMap[key].ca_reel += r._gainReel; tsMap[key].count++; }
      tsMap[key].newProspects++;
    });

    // Mini sparklines (last 7 data points for KPI cards)
    const sorted = Object.values(tsMap).sort((a,b) => a.date.localeCompare(b.date));
    const last7 = sorted.slice(-7);
    const sparkCA = last7.map(d => d.ca_prev);
    const sparkReel = last7.map(d => d.ca_reel);
    const sparkProspects = last7.map(d => d.newProspects);

    const topProspects = [...periodRows].filter(r => r._gain > 0).sort((a,b) => b._gain - a._gain).slice(0, 8);

    return { ...curr, prev, timeSeries: sorted, topProspects, allTotal: filteredCaRows.length, sparkCA, sparkReel, sparkProspects };
  }, [filteredCaRows, periodBounds, prevBounds]);

  const pc = periodStats;
  const conversionRate = pc.total > 0 ? ((pc.clients / pc.total) * 100).toFixed(1) : 0;
  const transmisRate = pc.total > 0 ? ((pc.transmis / pc.total) * 100).toFixed(0) : 0;
  const caMoyen = pc.caCount > 0 ? Math.round(pc.caTotal / pc.caCount) : 0;
  const realization = pc.caTotal > 0 ? ((pc.caReel / pc.caTotal) * 100).toFixed(0) : 0;
  const statusData = statuses.map(s => ({ ...s, count: pc.by_status[s.id] || 0 })).sort((a,b) => b.count - a.count);
  const statusTotal = statusData.reduce((s,d) => s + d.count, 0);
  const maxStatus = Math.max(...statusData.map(s => s.count), 1);
  const productData = products.map(p => ({ ...p, count: pc.by_product[p.id] || 0 })).sort((a,b) => b.count - a.count);
  const categoryData = categories.map(c => ({ ...c, count: pc.by_category[c.id] || 0 })).sort((a,b) => b.count - a.count);

  // ===== ACTIVITY =====
  const periodActivity = useMemo(() => {
    const inRange = timeline.filter(l => { const d = new Date(l.created_at); return d >= periodBounds.start && d <= periodBounds.end; });
    const prevRange = timeline.filter(l => { const d = new Date(l.created_at); return d >= prevBounds.start && d <= prevBounds.end; });
    const byAction = {};
    inRange.forEach(l => { byAction[l.action] = (byAction[l.action] || 0) + 1; });
    return { total: inRange.length, prevTotal: prevRange.length, creates: byAction.create || 0, updates: byAction.update || 0, statusChanges: byAction.status_change || 0, notes: byAction.note || 0, byAction };
  }, [timeline, periodBounds, prevBounds]);

  // ===== TEAM =====
  const teamStats = useMemo(() => {
    const periodLogs = timeline.filter(l => { const d = new Date(l.created_at); return d >= periodBounds.start && d <= periodBounds.end; });
    const prevLogs = timeline.filter(l => { const d = new Date(l.created_at); return d >= prevBounds.start && d <= prevBounds.end; });
    const byUser = {};
    (allUsers || []).forEach(u => {
      const ca = pc.caByUser?.[u.id] || { ca: 0, reel: 0, count: 0 };
      byUser[u.id] = { id: u.id, first_name: u.first_name, last_name: u.last_name, email: u.email, role: u.role,
        created_count: 0, updates_count: 0, notes_count: 0, status_changes: 0, total_actions: 0,
        prev_actions: 0, last_activity: null, recent_actions: [], by_status: {},
        ca_prev: ca.ca, ca_reel: ca.reel, prospect_count: ca.count };
    });
    prevLogs.forEach(l => { if (l.user_id && byUser[l.user_id]) byUser[l.user_id].prev_actions++; });
    periodLogs.forEach(l => {
      if (!l.user_id || !byUser[l.user_id]) return;
      const u = byUser[l.user_id];
      if (l.action === 'create') u.created_count++;
      if (l.action === 'update') u.updates_count++;
      if (l.action === 'note') u.notes_count++;
      if (l.action === 'status_change') { u.status_changes++; if (l.metadata?.new_status_id) u.by_status[l.metadata.new_status_id] = (u.by_status[l.metadata.new_status_id] || 0) + 1; }
      u.total_actions++;
      if (!u.last_activity || l.created_at > u.last_activity) u.last_activity = l.created_at;
      if (u.recent_actions.length < 20) u.recent_actions.push(l);
    });
    return Object.values(byUser).sort((a,b) => b.total_actions - a.total_actions);
  }, [timeline, periodBounds, prevBounds, allUsers, pc.caByUser]);

  const users = teamStats;
  const sel = selUser ? users.find(u => u.id === selUser) : null;
  const maxActions = Math.max(...users.map(u => u.total_actions || 0), 1);

  // ===== CURVES =====
  const curveDays = useMemo(() => Math.min(Math.max(Math.ceil((periodBounds.end - periodBounds.start) / 86400000), 1), 365), [periodBounds]);

  const caCurveData = useMemo(() => {
    const days = [];
    for (let i = curveDays - 1; i >= 0; i--) {
      const d = new Date(periodBounds.end); d.setDate(d.getDate() - i); d.setHours(0,0,0,0);
      const key = d.toISOString().slice(0,10);
      const ts = pc.timeSeries.find(t => t.date === key);
      days.push({ date: d, label: d.toLocaleDateString('fr-FR', { day:'2-digit', month:'2-digit' }), ca_prev: ts?.ca_prev || 0, ca_reel: ts?.ca_reel || 0 });
    }
    let cumP = 0, cumR = 0;
    days.forEach(d => { cumP += d.ca_prev; cumR += d.ca_reel; d.cum_prev = cumP; d.cum_reel = cumR; });
    return days;
  }, [pc.timeSeries, curveDays, periodBounds]);

  const activityCurveData = useMemo(() => {
    const days = [];
    for (let i = curveDays - 1; i >= 0; i--) {
      const d = new Date(periodBounds.end); d.setDate(d.getDate() - i); d.setHours(0,0,0,0);
      days.push({ date: d, label: d.toLocaleDateString('fr-FR', { day:'2-digit', month:'2-digit' }), total: 0, creates: 0, updates: 0, notes: 0 });
    }
    timeline.forEach(l => {
      const d = new Date(l.created_at); d.setHours(0,0,0,0);
      const idx = days.findIndex(day => day.date.getTime() === d.getTime());
      if (idx >= 0) { days[idx].total++; if (l.action === 'create') days[idx].creates++; if (l.action === 'update') days[idx].updates++; if (l.action === 'note') days[idx].notes++; }
    });
    return days;
  }, [timeline, curveDays, periodBounds]);

  // ===== TIMELINE =====
  const actionMeta = {
    login: { label:'Connexion', icon: LogIn, color:'text-cyan-400', bg:'bg-cyan-500/15' },
    view: { label:'Consultation', icon: Eye, color:'text-slate-400', bg:'bg-slate-600/20' },
    create: { label:'Création', icon: Plus, color:'text-emerald-400', bg:'bg-emerald-500/15' },
    update: { label:'Modification', icon: Edit, color:'text-blue-400', bg:'bg-blue-500/15' },
    status_change: { label:'Chgt statut', icon: RefreshCw, color:'text-amber-400', bg:'bg-amber-500/15' },
    note: { label:'Commentaire', icon: FileText, color:'text-purple-400', bg:'bg-purple-500/15' },
    document: { label:'Document', icon: Paperclip, color:'text-pink-400', bg:'bg-pink-500/15' },
    delete: { label:'Suppression', icon: Trash2, color:'text-red-400', bg:'bg-red-500/15' },
    assign: { label:'Attribution', icon: UserPlus, color:'text-green-400', bg:'bg-green-500/15' },
    unassign: { label:'Retrait', icon: UserMinus, color:'text-orange-400', bg:'bg-orange-500/15' },
    reminder_add: { label:'Rappel créé', icon: Bell, color:'text-yellow-400', bg:'bg-yellow-500/15' },
    reminder_done: { label:'Rappel fait', icon: CheckCircle, color:'text-green-400', bg:'bg-green-500/15' },
  };
  const defaultAction = { label:'Action', icon: Zap, color:'text-slate-400', bg:'bg-slate-700' };

  const filteredTimeline = useMemo(() => {
    let tl = timeline.filter(l => { const d = new Date(l.created_at); return d >= periodBounds.start && d <= periodBounds.end; });
    if (tlFilter !== 'all') tl = tl.filter(l => l.action === tlFilter);
    if (tlUserFilter !== 'all') tl = tl.filter(l => l.user_id === tlUserFilter);
    return tl;
  }, [timeline, periodBounds, tlFilter, tlUserFilter]);

  const timelineByDay = useMemo(() => {
    const map = {};
    filteredTimeline.forEach(l => {
      const key = new Date(l.created_at).toLocaleDateString('fr-FR', { weekday:'long', day:'numeric', month:'long' });
      if (!map[key]) map[key] = [];
      map[key].push(l);
    });
    return Object.entries(map);
  }, [filteredTimeline]);

  // ===== UI HELPERS =====
  const cmpDelta = (curr, prev) => {
    if (prev === 0 && curr === 0) return null;
    if (prev === 0) return { pct: '+∞', up: true };
    const p = ((curr - prev) / prev * 100).toFixed(0);
    return { pct: `${p > 0 ? '+' : ''}${p}%`, up: curr >= prev };
  };

  const Donut = ({ data, size=80, stroke=10 }) => {
    const r = (size - stroke) / 2, circ = 2 * Math.PI * r, total = data.reduce((s, d) => s + d.value, 0);
    let offset = 0;
    return <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="transform -rotate-90">
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#1e293b" strokeWidth={stroke}/>
      {data.filter(d=>d.value>0).map((d, i) => { const pct = d.value / total, dash = circ * pct, o = offset; offset += dash;
        return <circle key={i} cx={size/2} cy={size/2} r={r} fill="none" stroke={d.color} strokeWidth={stroke} strokeDasharray={`${dash} ${circ - dash}`} strokeDashoffset={-o} strokeLinecap="round" className="transition-all duration-700"/>;
      })}
    </svg>;
  };

  const Delta = ({ d, big }) => d ? <span className={cn("font-semibold flex items-center gap-0.5", big?"text-xs":"text-[10px]", d.up ? "text-emerald-400" : "text-red-400")}>{d.up ? <ArrowUpRight className={big?"w-3.5 h-3.5":"w-3 h-3"}/> : <ArrowDownRight className={big?"w-3.5 h-3.5":"w-3 h-3"}/>}{d.pct}</span> : null;

  // Mini sparkline bars for KPI cards
  const SparkBars = ({ data, color='#10b981' }) => {
    if (!data || data.length === 0) return null;
    const max = Math.max(...data, 1);
    return <div className="flex items-end gap-px h-6 mt-1.5">{data.map((v, i) =>
      <div key={i} className="flex-1 rounded-sm min-w-[3px] transition-all duration-500" style={{ height: `${Math.max((v/max)*100, 8)}%`, backgroundColor: color, opacity: i === data.length - 1 ? 1 : 0.5 }}/>
    )}</div>;
  };

  const Kpi = ({ icon: Icon, label, value, sub, color, bg, d, spark, sparkColor }) => (
    <div className="bg-slate-800/80 backdrop-blur rounded-2xl p-4 border border-slate-700/50 hover:border-slate-600/80 transition-all group">
      <div className="flex items-center justify-between mb-1">
        <div className={cn("w-8 h-8 rounded-xl flex items-center justify-center", bg||"bg-slate-700")}><Icon className={cn("w-4 h-4", color||"text-slate-400")}/></div>
        <Delta d={d}/>
      </div>
      <p className="text-[10px] text-slate-500 uppercase tracking-wider font-medium">{label}</p>
      <p className={cn("text-2xl font-extrabold mt-0.5 tracking-tight", color||"text-white")}>{value}</p>
      {sub && <p className="text-[10px] text-slate-500 mt-0.5">{sub}</p>}
      {spark && spark.length > 0 && <SparkBars data={spark} color={sparkColor || '#10b981'}/>}
    </div>
  );

  // Conversion funnel
  const funnelSteps = [
    { label: 'Fiches créées', value: pc.total, color: '#10b981', icon: FolderOpen },
    { label: 'Transmis install.', value: pc.transmis, color: '#f59e0b', icon: Send },
    { label: 'Clients signés', value: pc.clients, color: '#22c55e', icon: CheckCircle },
  ];

  const tabs = [['overview','Vue globale',BarChart3],['team','Équipe',Users],['activity','Activité',Activity]];

  return <div className="h-screen flex flex-col bg-slate-900">
    {/* HEADER */}
    <header className="bg-slate-800/60 backdrop-blur-sm border-b border-slate-700/80 px-6 py-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2 hover:bg-slate-700 rounded-xl text-slate-400 transition-colors"><ChevronLeft className="w-5 h-5"/></button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center shadow-lg shadow-emerald-500/20"><BarChart3 className="w-5 h-5 text-white"/></div>
            <div><h1 className="text-lg font-bold text-white">Tableau de bord</h1><p className="text-[11px] text-slate-400">{periodLabel} · {pc.total} fiches · {pc.caTotal.toLocaleString('fr-FR')} € CA{filterProductId !== 'all' ? ` · ${products.find(p=>p.id===filterProductId)?.name||''}` : ''}{filterUserId !== 'all' ? ` · ${(allUsers||[]).find(u=>u.id===filterUserId)?.first_name||''}` : ''}</p></div>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {onlineCount > 0 && <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-3 py-1.5">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"/>
            <span className="text-xs text-emerald-400 font-medium">{onlineCount} en ligne</span>
          </div>}
          <div className="flex bg-slate-700/50 rounded-xl p-0.5 gap-0.5">
            {['today','7d','30d','month','all'].map(k =>
              <button key={k} onClick={()=>changePeriod(k)} className={cn("px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all whitespace-nowrap", period===k?"bg-emerald-500 text-white shadow-md shadow-emerald-500/25":"text-slate-400 hover:text-white hover:bg-slate-700/50")}>{periodLabels[k]}</button>
            )}
            <button onClick={()=>changePeriod('custom')} className={cn("px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all flex items-center gap-1", period==='custom'?"bg-emerald-500 text-white shadow-md shadow-emerald-500/25":"text-slate-400 hover:text-white hover:bg-slate-700/50")}><Calendar className="w-3 h-3"/>Dates</button>
          </div>
          {/* Product & User filters */}
          <div className="flex items-center gap-1.5 bg-slate-700/40 rounded-xl px-2 py-1">
            <Package className="w-3.5 h-3.5 text-slate-500"/>
            <select value={filterProductId} onChange={e => setFilterProductId(e.target.value)} className="bg-transparent border-none text-xs text-white focus:outline-none cursor-pointer py-1">
              <option value="all">Tous produits</option>
              {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-1.5 bg-slate-700/40 rounded-xl px-2 py-1">
            <Users className="w-3.5 h-3.5 text-slate-500"/>
            <select value={filterUserId} onChange={e => setFilterUserId(e.target.value)} className="bg-transparent border-none text-xs text-white focus:outline-none cursor-pointer py-1">
              <option value="all">Tous utilisateurs</option>
              {(allUsers||[]).map(u => <option key={u.id} value={u.id}>{u.first_name} {u.last_name}</option>)}
            </select>
          </div>
          {(filterProductId !== 'all' || filterUserId !== 'all') && <button onClick={() => { setFilterProductId('all'); setFilterUserId('all'); }} className="p-1.5 hover:bg-red-500/20 rounded-lg text-red-400 transition-colors" title="Réinitialiser filtres"><X className="w-3.5 h-3.5"/></button>}
          {period === 'custom' && <div className="flex items-center gap-2">
            <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} className="px-2 py-1.5 bg-slate-700 border border-slate-600 rounded-lg text-white text-xs focus:border-emerald-500 outline-none" />
            <span className="text-slate-500 text-xs">→</span>
            <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} className="px-2 py-1.5 bg-slate-700 border border-slate-600 rounded-lg text-white text-xs focus:border-emerald-500 outline-none" />
          </div>}
        </div>
      </div>
    </header>

    {/* TABS */}
    <div className="bg-slate-800/30 border-b border-slate-700/60 px-6">
      <div className="flex gap-1 -mb-px">{tabs.map(([k,v,Ic])=>
        <button key={k} onClick={()=>setTab(k)} className={cn("flex items-center gap-1.5 px-4 py-3 text-xs font-medium border-b-2 transition-all", tab===k?"border-emerald-500 text-emerald-400":"border-transparent text-slate-500 hover:text-slate-300")}>
          <Ic className="w-3.5 h-3.5"/>{v}
          {k==='team' && onlineCount > 0 && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"/>}
        </button>
      )}</div>
    </div>

    <div className="flex-1 overflow-auto p-6"><div className="max-w-7xl mx-auto space-y-5">

      {/* ==================== VUE GLOBALE ==================== */}
      {tab==='overview' && <>
        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <Kpi icon={FolderOpen} label="Fiches créées" value={pc.total} color="text-emerald-400" bg="bg-emerald-500/15" d={cmpDelta(pc.total, pc.prev.total)} sub={pc.allTotal !== pc.total ? `${pc.allTotal} au total` : ''} spark={pc.sparkProspects} sparkColor="#10b981"/>
          <Kpi icon={CheckCircle} label="Clients signés" value={pc.clients} color="text-green-400" bg="bg-green-500/15" d={cmpDelta(pc.clients, pc.prev.clients)} sub={`${conversionRate}% conversion`}/>
          <Kpi icon={Send} label="Transmis install." value={pc.transmis} color="text-amber-400" bg="bg-amber-500/15" d={cmpDelta(pc.transmis, pc.prev.transmis)} sub={pc.total > 0 ? `${transmisRate}% des fiches` : ''}/>
          <Kpi icon={Banknote} label="CA Prévisionnel" value={`${pc.caTotal >= 1000 ? `${(pc.caTotal/1000).toFixed(1)}k` : pc.caTotal} €`} color="text-yellow-400" bg="bg-yellow-500/15" d={cmpDelta(pc.caTotal, pc.prev.caTotal)} sub={caMoyen > 0 ? `${caMoyen.toLocaleString('fr-FR')} €/fiche` : ''} spark={pc.sparkCA} sparkColor="#facc15"/>
          <Kpi icon={Euro} label="CA Réel" value={`${pc.caReel >= 1000 ? `${(pc.caReel/1000).toFixed(1)}k` : pc.caReel} €`} color="text-emerald-400" bg="bg-emerald-500/15" d={cmpDelta(pc.caReel, pc.prev.caReel)} sub={`${realization}% réalisé`} spark={pc.sparkReel} sparkColor="#34d399"/>
          <Kpi icon={Activity} label="Actions CRM" value={periodActivity.total} color="text-cyan-400" bg="bg-cyan-500/15" d={cmpDelta(periodActivity.total, periodActivity.prevTotal)} sub={`${periodActivity.creates} créations`}/>
        </div>

        {/* Conversion Funnel */}
        <div className="bg-slate-800/80 backdrop-blur rounded-2xl p-5 border border-slate-700/50">
          <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2"><GitBranch className="w-4 h-4 text-emerald-400"/>Entonnoir de conversion</h3>
          <div className="flex items-center gap-3">{funnelSteps.map((step, i) => {
            const pct = i > 0 && funnelSteps[0].value > 0 ? ((step.value / funnelSteps[0].value) * 100).toFixed(0) : 100;
            const Ic = step.icon;
            return <React.Fragment key={i}>
              {i > 0 && <div className="flex flex-col items-center gap-0.5 px-2"><ChevronRight className="w-4 h-4 text-slate-600"/><span className="text-[10px] text-slate-500 font-medium">{pct}%</span></div>}
              <div className="flex-1 rounded-xl p-4 border transition-all hover:scale-[1.02]" style={{backgroundColor: step.color + '10', borderColor: step.color + '30'}}>
                <div className="flex items-center gap-2 mb-2"><Ic className="w-4 h-4" style={{color:step.color}}/><span className="text-xs text-slate-400 font-medium">{step.label}</span></div>
                <p className="text-3xl font-black" style={{color:step.color}}>{step.value}</p>
                {i > 0 && <div className="mt-2 bg-slate-900/50 rounded-full h-1.5 overflow-hidden"><div className="h-full rounded-full transition-all duration-700" style={{width:`${pct}%`, backgroundColor:step.color}}/></div>}
              </div>
            </React.Fragment>;
          })}</div>
        </div>

        {/* CA Curves with toggle */}
        {caCurveData.length > 1 && <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-slate-800/80 backdrop-blur rounded-2xl p-5 border border-slate-700/50">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2"><Banknote className="w-4 h-4 text-yellow-400"/>Chiffre d'affaires</h3>
              <div className="flex bg-slate-700/50 rounded-lg p-0.5">
                <button onClick={()=>setCaMode('cumul')} className={cn("px-2 py-1 rounded-md text-[10px] font-medium transition-all", caMode==='cumul'?"bg-yellow-500/20 text-yellow-400":"text-slate-500 hover:text-slate-300")}>Cumulé</button>
                <button onClick={()=>setCaMode('daily')} className={cn("px-2 py-1 rounded-md text-[10px] font-medium transition-all", caMode==='daily'?"bg-yellow-500/20 text-yellow-400":"text-slate-500 hover:text-slate-300")}>Quotidien</button>
              </div>
            </div>
            <div className="flex gap-4 mb-3">
              <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-yellow-400"/><span className="text-[10px] text-slate-500">Prévisionnel</span></div>
              <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-emerald-400"/><span className="text-[10px] text-slate-500">Réel</span></div>
            </div>
            <InteractiveLineChart data={caCurveData} lines={caMode==='cumul' ? [{key:'cum_prev', color:'#facc15', label:'Prévisionnel'},{key:'cum_reel', color:'#34d399', label:'Réel'}] : [{key:'ca_prev', color:'#facc15', label:'Prévisionnel'},{key:'ca_reel', color:'#34d399', label:'Réel'}]} height={160} formatY={v => v >= 1000 ? `${(v/1000).toFixed(0)}k€` : `${v}€`}/>
          </div>
          <div className="bg-slate-800/80 backdrop-blur rounded-2xl p-5 border border-slate-700/50">
            <h3 className="text-sm font-semibold text-white mb-1 flex items-center gap-2"><Activity className="w-4 h-4 text-emerald-400"/>Activité quotidienne</h3>
            <div className="flex gap-4 mb-3">
              {[{k:'total',l:'Total',c:'#10b981'},{k:'creates',l:'Créations',c:'#3b82f6'},{k:'notes',l:'Notes',c:'#a855f7'}].map(ln =>
                <div key={ln.k} className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full" style={{backgroundColor:ln.c}}/><span className="text-[10px] text-slate-500">{ln.l}</span></div>
              )}
            </div>
            <InteractiveLineChart data={activityCurveData} lines={[{key:'total', color:'#10b981', label:'Total'},{key:'creates', color:'#3b82f6', label:'Créations'},{key:'notes', color:'#a855f7', label:'Notes'}]} height={160}/>
          </div>
        </div>}

        {/* Pipeline + Répartitions */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="bg-slate-800/80 backdrop-blur rounded-2xl p-5 border border-slate-700/50 lg:col-span-2">
            <h3 className="text-sm font-semibold text-white mb-4 flex items-center justify-between">
              <span className="flex items-center gap-2"><GitBranch className="w-4 h-4 text-emerald-400"/>Pipeline</span>
              <span className="text-xs text-slate-500 font-normal">{statusTotal} fiches</span>
            </h3>
            {/* Stacked bar summary */}
            <div className="flex rounded-full h-3 overflow-hidden mb-5 bg-slate-700/30">
              {statusData.filter(s=>s.count>0).map(s => <div key={s.id} className="h-full transition-all duration-700" style={{width:`${(s.count/Math.max(statusTotal,1))*100}%`, backgroundColor:s.color}} title={`${s.name}: ${s.count}`}/>)}
            </div>
            <div className="space-y-2">{statusData.map(s => {
              const pct = maxStatus > 0 ? (s.count / maxStatus * 100) : 0;
              const totalPct = pc.total > 0 ? (s.count / pc.total * 100).toFixed(0) : 0;
              const ca = pc.caByStatus[s.id]?.sum || 0;
              const caR = pc.caByStatus[s.id]?.sumReel || 0;
              return <div key={s.id} className="group hover:bg-slate-700/20 rounded-xl px-2 py-1.5 -mx-2 transition-colors">
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{backgroundColor:s.color}}/>
                  <span className="text-white text-sm font-medium flex-1">{s.name}</span>
                  <span className="text-slate-500 text-[10px] w-8 text-right">{totalPct}%</span>
                  {ca > 0 && <span className="text-yellow-400/80 text-[10px] w-20 text-right">{ca >= 1000 ? `${(ca/1000).toFixed(1)}k` : ca} €</span>}
                  {caR > 0 && <span className="text-emerald-400/60 text-[10px] w-16 text-right">{caR >= 1000 ? `${(caR/1000).toFixed(1)}k` : caR} € réel</span>}
                  <span className="text-white font-bold text-sm w-8 text-right">{s.count}</span>
                </div>
                <div className="bg-slate-700/30 rounded-full h-2 overflow-hidden"><div className="h-full rounded-full transition-all duration-700" style={{width:`${Math.max(pct, 2)}%`, backgroundColor:s.color, opacity:0.8}}/></div>
              </div>;
            })}</div>
            {/* Total row */}
            <div className="mt-3 pt-3 border-t border-slate-700/50 flex items-center gap-2 px-2">
              <span className="text-slate-400 text-sm font-medium flex-1">Total</span>
              {pc.caTotal > 0 && <span className="text-yellow-400 text-sm font-bold">{pc.caTotal.toLocaleString('fr-FR')} €</span>}
              {pc.caReel > 0 && <span className="text-emerald-400 text-xs">{pc.caReel.toLocaleString('fr-FR')} € réel</span>}
              <span className="text-white font-bold text-sm w-8 text-right">{statusTotal}</span>
            </div>
          </div>
          <div className="space-y-4">
            <div className="bg-slate-800/80 backdrop-blur rounded-2xl p-4 border border-slate-700/50">
              <h3 className="text-xs font-semibold text-white mb-3 flex items-center gap-2"><Package className="w-3.5 h-3.5 text-blue-400"/>Produits</h3>
              <div className="flex items-center gap-3">
                <Donut data={productData.map(p=>({value:p.count, color:p.color}))}/>
                <div className="space-y-1.5 flex-1">{productData.filter(p=>p.count>0).map(p => {
                  const pct = pc.total > 0 ? ((p.count/pc.total)*100).toFixed(0) : 0;
                  return <div key={p.id} className="flex items-center gap-2"><span className="w-2 h-2 rounded-full flex-shrink-0" style={{backgroundColor:p.color}}/><span className="text-slate-300 text-xs flex-1 truncate">{p.name}</span><span className="text-slate-500 text-[10px]">{pct}%</span><span className="text-white text-xs font-bold">{p.count}</span></div>;
                })}</div>
              </div>
            </div>
            <div className="bg-slate-800/80 backdrop-blur rounded-2xl p-4 border border-slate-700/50">
              <h3 className="text-xs font-semibold text-white mb-3 flex items-center gap-2"><Tag className="w-3.5 h-3.5 text-purple-400"/>Secteurs</h3>
              <div className="flex items-center gap-3">
                <Donut data={categoryData.map(c=>({value:c.count, color:c.color}))}/>
                <div className="space-y-1.5 flex-1">{categoryData.filter(c=>c.count>0).map(c => {
                  const pct = pc.total > 0 ? ((c.count/pc.total)*100).toFixed(0) : 0;
                  return <div key={c.id} className="flex items-center gap-2"><span className="w-2 h-2 rounded-full flex-shrink-0" style={{backgroundColor:c.color}}/><span className="text-slate-300 text-xs flex-1 truncate">{c.name}</span><span className="text-slate-500 text-[10px]">{pct}%</span><span className="text-white text-xs font-bold">{c.count}</span></div>;
                })}</div>
              </div>
            </div>
          </div>
        </div>

        {/* CA par statut + Top prospects */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-slate-800/80 backdrop-blur rounded-2xl p-5 border border-slate-700/50">
            <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2"><Euro className="w-4 h-4 text-yellow-400"/>CA par statut</h3>
            <div className="space-y-2.5">{statuses.map(s => {
              const d = pc.caByStatus[s.id] || { count: 0, sum: 0, sumReel: 0 };
              if (d.sum === 0 && d.sumReel === 0) return null;
              const pctOfTotal = pc.caTotal > 0 ? (d.sum / pc.caTotal * 100).toFixed(0) : 0;
              const real = d.sum > 0 ? ((d.sumReel / d.sum) * 100).toFixed(0) : 0;
              return <div key={s.id} className="flex items-center gap-3">
                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{backgroundColor:s.color}}/>
                <span className="text-slate-300 text-sm flex-1">{s.name} <span className="text-slate-600">({d.count})</span></span>
                <div className="w-16 bg-slate-700/30 rounded-full h-1.5"><div className="h-full rounded-full" style={{width:`${pctOfTotal}%`, backgroundColor:s.color}}/></div>
                <span className="text-yellow-400 font-semibold text-sm w-20 text-right">{d.sum.toLocaleString('fr-FR')} €</span>
                {d.sumReel > 0 && <span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded-md", Number(real) >= 80 ? "bg-emerald-500/15 text-emerald-400" : Number(real) >= 30 ? "bg-amber-500/15 text-amber-400" : "bg-red-500/15 text-red-400")}>{real}% réalisé</span>}
              </div>;
            })}</div>
          </div>
          <div className="bg-slate-800/80 backdrop-blur rounded-2xl p-5 border border-slate-700/50">
            <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2"><Trophy className="w-4 h-4 text-yellow-400"/>Top prospects par CA</h3>
            {pc.topProspects.length === 0 ? <p className="text-slate-500 text-sm text-center py-8">Aucun prospect avec CA sur cette période</p> :
            <div className="space-y-1.5">{pc.topProspects.map((p, i) => {
              const st = statuses.find(s => s.id === p.status_id);
              const medals = ['🥇','🥈','🥉'];
              return <div key={p.id||i} onClick={()=>p.id && onOpenProspect({id:p.id})} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-slate-700/40 cursor-pointer transition-all group">
                <span className="text-sm w-6 text-center">{i<3 ? medals[i] : <span className="text-slate-600 text-xs">{i+1}</span>}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white font-medium truncate group-hover:text-emerald-400 transition-colors">{p.company_name || `${p.first_name||''} ${p.last_name||''}`.trim() || '—'}</p>
                  {st && <div className="flex items-center gap-1 mt-0.5"><span className="w-1.5 h-1.5 rounded-full" style={{backgroundColor:st.color}}/><span className="text-[10px] text-slate-500">{st.name}</span></div>}
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-yellow-400 font-bold text-sm">{p._gain.toLocaleString('fr-FR')} €</p>
                  {p._reel > 0 && <p className="text-emerald-400 text-[10px]">{p._reel.toLocaleString('fr-FR')} € réel</p>}
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-slate-700 group-hover:text-slate-500 transition-colors"/>
              </div>;
            })}</div>}
          </div>
        </div>
      </>}

      {/* ==================== ÉQUIPE ==================== */}
      {tab==='team' && <>
        {/* Online bar */}
        {onlineCount > 0 && <div className="flex items-center gap-3 bg-emerald-500/5 rounded-2xl px-5 py-3 border border-emerald-500/15">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"/>
          <span className="text-sm text-emerald-400 font-semibold">{onlineCount} en ligne maintenant</span>
          <div className="flex -space-x-2 ml-2">{(allUsers||[]).filter(u => onlineUsers[u.id]).map(u =>
            <div key={u.id} className={cn("w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold ring-2 ring-slate-900", u.role==='admin'?"bg-gradient-to-br from-emerald-400 to-emerald-600":"bg-gradient-to-br from-blue-400 to-blue-600")} title={`${u.first_name} ${u.last_name}`}>{u.first_name?.[0]}</div>
          )}</div>
        </div>}

        {/* Team KPI summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-slate-800/80 rounded-2xl p-4 border border-slate-700/50 text-center">
            <p className="text-[10px] text-slate-500 uppercase mb-1">Utilisateurs actifs</p>
            <p className="text-2xl font-extrabold text-white">{users.filter(u=>u.total_actions>0).length}<span className="text-sm text-slate-500 font-normal">/{users.length}</span></p>
          </div>
          <div className="bg-slate-800/80 rounded-2xl p-4 border border-slate-700/50 text-center">
            <p className="text-[10px] text-slate-500 uppercase mb-1">Actions totales</p>
            <p className="text-2xl font-extrabold text-cyan-400">{users.reduce((s,u)=>s+u.total_actions,0)}</p>
          </div>
          <div className="bg-slate-800/80 rounded-2xl p-4 border border-slate-700/50 text-center">
            <p className="text-[10px] text-slate-500 uppercase mb-1">Moy. actions/user</p>
            <p className="text-2xl font-extrabold text-blue-400">{users.length>0 ? (users.reduce((s,u)=>s+u.total_actions,0)/users.filter(u=>u.total_actions>0).length||0).toFixed(0) : 0}</p>
          </div>
          <div className="bg-slate-800/80 rounded-2xl p-4 border border-slate-700/50 text-center">
            <p className="text-[10px] text-slate-500 uppercase mb-1">CA total géré</p>
            <p className="text-2xl font-extrabold text-yellow-400">{(users.reduce((s,u)=>s+u.ca_prev,0)/1000).toFixed(1)}k€</p>
          </div>
        </div>

        <div className="bg-slate-800/80 backdrop-blur rounded-2xl border border-slate-700/50 overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-700/50 flex items-center gap-2"><Award className="w-4 h-4 text-emerald-400"/><h3 className="text-sm font-semibold text-white">Performance — {periodLabel}</h3></div>
          <div className="overflow-x-auto"><table className="w-full"><thead><tr className="border-b border-slate-700/50 text-left bg-slate-900/30">
            <th className="px-3 py-2.5 text-[10px] text-slate-500 font-semibold uppercase w-8">#</th>
            <th className="px-3 py-2.5 text-[10px] text-slate-500 font-semibold uppercase">Utilisateur</th>
            <th className="px-3 py-2.5 text-[10px] text-slate-500 font-semibold uppercase text-center">Créées</th>
            <th className="px-3 py-2.5 text-[10px] text-slate-500 font-semibold uppercase text-center">Modifs</th>
            <th className="px-3 py-2.5 text-[10px] text-slate-500 font-semibold uppercase text-center">Notes</th>
            <th className="px-3 py-2.5 text-[10px] text-slate-500 font-semibold uppercase text-center">Statuts</th>
            <th className="px-3 py-2.5 text-[10px] text-slate-500 font-semibold uppercase text-center">Total</th>
            <th className="px-3 py-2.5 text-[10px] text-slate-500 font-semibold uppercase text-center">Δ</th>
            <th className="px-3 py-2.5 text-[10px] text-slate-500 font-semibold uppercase text-center">CA géré</th>
            <th className="px-3 py-2.5 text-[10px] text-slate-500 font-semibold uppercase">Activité</th>
          </tr></thead><tbody>
            {users.map((u,i)=>{
              const pct=(u.total_actions/maxActions)*100;
              const medals=['🥇','🥈','🥉'];
              const d = cmpDelta(u.total_actions, u.prev_actions);
              const isOnline = !!onlineUsers?.[u.id];
              return <tr key={u.id} onClick={()=>setSelUser(selUser===u.id?null:u.id)} className={cn("border-b border-slate-700/30 hover:bg-emerald-500/5 cursor-pointer transition-colors", selUser===u.id && "bg-emerald-500/10")}>
                <td className="px-3 py-2.5">{i<3 && u.total_actions>0 ? <span className="text-base">{medals[i]}</span> : <span className="text-slate-600 text-xs">{i+1}</span>}</td>
                <td className="px-3 py-2.5"><div className="flex items-center gap-2.5"><div className="relative"><div className={cn("w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold",u.role==='admin'?"bg-gradient-to-br from-emerald-400 to-emerald-600":"bg-gradient-to-br from-blue-400 to-blue-600")}>{u.first_name?.[0]}</div>{isOnline && <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-400 rounded-full border-2 border-slate-800"/>}</div><div><p className="text-white text-sm font-medium leading-tight">{u.first_name} {u.last_name}{isOnline && <span className="ml-1 text-[9px] text-emerald-400">●</span>}</p><p className="text-[10px] text-slate-500">{u.role==='admin'?'Admin':u.role==='fournisseur'?'Fournisseur':'Collaborateur'}</p></div></div></td>
                <td className="px-3 py-2.5 text-center"><span className={cn("text-sm font-bold", u.created_count > 0 ? "text-white" : "text-slate-600")}>{u.created_count}</span></td>
                <td className="px-3 py-2.5 text-center"><span className={cn("text-sm font-bold", u.updates_count > 0 ? "text-white" : "text-slate-600")}>{u.updates_count}</span></td>
                <td className="px-3 py-2.5 text-center"><span className={cn("text-sm font-bold", u.notes_count > 0 ? "text-white" : "text-slate-600")}>{u.notes_count}</span></td>
                <td className="px-3 py-2.5 text-center"><span className={cn("text-sm font-bold", u.status_changes > 0 ? "text-white" : "text-slate-600")}>{u.status_changes}</span></td>
                <td className="px-3 py-2.5 text-center"><span className={cn("inline-flex px-2 py-0.5 rounded-full text-xs font-bold", u.total_actions>15?"bg-emerald-500/20 text-emerald-400":u.total_actions>5?"bg-blue-500/20 text-blue-400":"bg-slate-700/50 text-slate-400")}>{u.total_actions}</span></td>
                <td className="px-3 py-2.5 text-center"><Delta d={d}/></td>
                <td className="px-3 py-2.5 text-center">{u.ca_prev > 0 ? <span className="text-yellow-400 text-xs font-semibold">{u.ca_prev >= 1000 ? `${(u.ca_prev/1000).toFixed(1)}k€` : `${u.ca_prev}€`}</span> : <span className="text-slate-600 text-xs">—</span>}</td>
                <td className="px-3 py-2.5"><div className="w-20"><div className="bg-slate-700/30 rounded-full h-1.5 overflow-hidden"><div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all" style={{width:`${pct}%`}}/></div></div></td>
              </tr>;
            })}
          </tbody></table></div>
        </div>

        {/* Inline user detail */}
        {sel && <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="bg-slate-800/80 backdrop-blur rounded-2xl p-5 border border-slate-700/50">
            <div className="flex items-center gap-3 mb-4">
              <div className="relative">
                <div className={cn("w-12 h-12 rounded-full flex items-center justify-center text-white text-lg font-bold",sel.role==='admin'?"bg-gradient-to-br from-emerald-400 to-emerald-600":"bg-gradient-to-br from-blue-400 to-blue-600")}>{sel.first_name?.[0]}</div>
                {onlineUsers?.[sel.id] && <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-400 rounded-full border-2 border-slate-800 animate-pulse"/>}
              </div>
              <div>
                <p className="text-white font-bold">{sel.first_name} {sel.last_name}{onlineUsers?.[sel.id] && <span className="ml-2 text-xs text-emerald-400 font-normal">● en ligne</span>}</p>
                <p className="text-xs text-slate-400">{sel.email}</p>
                {sel.ca_prev > 0 && <p className="text-xs text-yellow-400 font-semibold mt-0.5">{sel.ca_prev.toLocaleString('fr-FR')} € CA géré · {sel.prospect_count} prospects</p>}
              </div>
            </div>
            <h4 className="text-xs text-slate-500 font-semibold uppercase mb-2">Changements de statut</h4>
            <div className="space-y-1.5">{statuses.map(s=>{const c=sel.by_status?.[s.id]||0;if(!c)return null;return<div key={s.id} className="flex items-center gap-2"><span className="w-2 h-2 rounded-full" style={{backgroundColor:s.color}}/><span className="text-slate-300 text-xs flex-1">{s.name}</span><span className="text-white text-xs font-bold">{c}</span></div>;})}</div>
          </div>
          <div className="bg-slate-800/80 backdrop-blur rounded-2xl p-5 border border-slate-700/50">
            <h4 className="text-xs text-slate-500 font-semibold uppercase mb-3">Commentaires récents</h4>
            <div className="space-y-2">{(() => {
              const notes = (sel.recent_actions||[]).filter(a => a.action === 'note');
              return notes.length === 0 ? <p className="text-slate-500 text-sm text-center py-4">Aucun commentaire</p> : notes.slice(0,6).map((n,i) =>
                <div key={i} className="bg-slate-700/20 rounded-lg p-2.5 border border-slate-700/30">
                  <div className="flex items-center justify-between mb-1"><p className="text-xs font-medium text-emerald-400">{n.metadata?.company_name || 'Prospect'}</p><p className="text-[10px] text-slate-500">{formatRelative(n.created_at)}</p></div>
                  {n.metadata?.content && <p className="text-xs text-slate-300 leading-relaxed">{n.metadata.content.length > 100 ? n.metadata.content.slice(0,100)+'…' : n.metadata.content}</p>}
                </div>
              );
            })()}</div>
          </div>
          <div className="bg-slate-800/80 backdrop-blur rounded-2xl p-5 border border-slate-700/50">
            <h4 className="text-xs text-slate-500 font-semibold uppercase mb-3">Dernières actions</h4>
            <div className="space-y-1">{(sel.recent_actions||[]).slice(0,12).map((a,i)=>{
              const meta=actionMeta[a.action]||defaultAction;const Ic=meta.icon;
              return <div key={i} className="flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-slate-700/20 transition-colors">
                <div className={cn("w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0", meta.bg)}><Ic className={cn("w-3 h-3", meta.color)}/></div>
                <span className="text-xs text-white flex-1">{meta.label}</span>
                <span className="text-[10px] text-slate-500">{formatRelative(a.created_at)}</span>
              </div>;
            })}</div>
          </div>
        </div>}
      </>}

      {/* ==================== ACTIVITÉ ==================== */}
      {tab==='activity' && <>
        <div className="flex flex-wrap gap-3 items-center bg-slate-800/40 rounded-xl px-4 py-2.5 border border-slate-700/30">
          <div className="flex items-center gap-2"><Filter className="w-3.5 h-3.5 text-slate-500"/><select value={tlFilter} onChange={e=>setTlFilter(e.target.value)} className="bg-slate-800 border border-slate-700 rounded-lg text-xs text-white px-3 py-1.5 focus:border-emerald-500 outline-none"><option value="all">Toutes les actions</option>{Object.entries(actionMeta).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}</select></div>
          <div className="flex items-center gap-2"><Users className="w-3.5 h-3.5 text-slate-500"/><select value={tlUserFilter} onChange={e=>setTlUserFilter(e.target.value)} className="bg-slate-800 border border-slate-700 rounded-lg text-xs text-white px-3 py-1.5 focus:border-emerald-500 outline-none"><option value="all">Tous les utilisateurs</option>{(allUsers||[]).map(u=><option key={u.id} value={u.id}>{u.first_name} {u.last_name}</option>)}</select></div>
          <span className="text-xs text-slate-500 ml-auto font-medium">{filteredTimeline.length} événements</span>
        </div>

        {/* Action breakdown cards */}
        <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
          {Object.entries(periodActivity.byAction).sort((a,b)=>b[1]-a[1]).slice(0,6).map(([action, count]) => {
            const meta = actionMeta[action] || defaultAction;
            const Ic = meta.icon;
            const pct = periodActivity.total > 0 ? ((count/periodActivity.total)*100).toFixed(0) : 0;
            return <div key={action} className="bg-slate-800/80 rounded-xl p-3 border border-slate-700/30 text-center hover:border-slate-600/50 transition-colors">
              <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center mx-auto mb-1.5", meta.bg)}><Ic className={cn("w-4 h-4", meta.color)}/></div>
              <p className="text-lg font-bold text-white">{count}</p>
              <p className="text-[10px] text-slate-500">{meta.label}</p>
              <p className="text-[9px] text-slate-600 mt-0.5">{pct}%</p>
            </div>;
          })}
        </div>

        {/* Timeline feed */}
        {tlLoading ? <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 text-emerald-400 animate-spin"/></div> :
        <div className="space-y-4">{timelineByDay.slice(0,20).map(([day, events]) => (
          <div key={day}>
            <div className="flex items-center gap-3 mb-2"><span className="text-xs font-semibold text-slate-500 uppercase">{day}</span><div className="flex-1 h-px bg-slate-700/30"/><span className="text-[10px] text-slate-600 bg-slate-800 px-2 rounded-full">{events.length}</span></div>
            <div className="space-y-0.5">{events.map((l, i) => {
              const meta = actionMeta[l.action] || defaultAction;
              const Ic = meta.icon;
              const userName = l.profile ? `${l.profile.first_name||''} ${l.profile.last_name||''}`.trim() : 'Système';
              const ctx = l.context || {};
              let detail = '';
              if (l.action === 'status_change' && l.old_value && l.new_value) detail = `${l.old_value} → ${l.new_value}`;
              else if (l.action === 'update' && ctx.fields) detail = `${(ctx.fields||[]).join(', ')}`;
              else if (l.action === 'note' && ctx.preview) detail = ctx.preview;
              else if (l.action === 'create' && ctx.company) detail = ctx.company;
              else if ((l.action === 'assign' || l.action === 'unassign') && (ctx.assigned_user_id || ctx.removed_user_id)) { const uid = ctx.assigned_user_id || ctx.removed_user_id; const u = (allUsers||[]).find(x=>x.id===uid); detail = u ? `${u.first_name} ${u.last_name}` : ''; }
              const time = new Date(l.created_at).toLocaleTimeString('fr-FR', { hour:'2-digit', minute:'2-digit' });
              return <div key={l.id||i} className="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-slate-800/60 group transition-colors">
                <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0", meta.bg)}><Ic className={cn("w-3.5 h-3.5", meta.color)}/></div>
                <span className="text-white text-sm font-medium w-28 truncate">{userName}</span>
                <span className={cn("text-[10px] px-1.5 py-0.5 rounded-md", meta.bg, meta.color)}>{meta.label}</span>
                {detail && <span className="text-xs text-slate-400 flex-1 truncate">{detail}</span>}
                {l.prospect_id && <button onClick={()=>onOpenProspect({id:l.prospect_id})} className="p-1 rounded hover:bg-emerald-500/15 text-slate-600 hover:text-emerald-400 opacity-0 group-hover:opacity-100 transition-all"><Eye className="w-3.5 h-3.5"/></button>}
                <span className="text-[10px] text-slate-600 flex-shrink-0 w-10 text-right">{time}</span>
              </div>;
            })}</div>
          </div>
        ))}</div>}
      </>}

    </div></div>
  </div>;
});

// =====================================================
// PLANNING PAGE (Date de pose / Agenda)
// =====================================================
const PlanningPage = memo(({ onBack, onOpenProspect, reminders, isAdmin }) => {
  const { events, audits, loading } = usePlanning();
  const [selectedMonth, setSelectedMonth] = useState(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`; });
  const [viewMode, setViewMode] = useState('calendar'); // 'calendar' | 'list'
  const [planningTab, setPlanningTab] = useState('poses'); // 'poses' | 'rappels' | 'audits'

  // Group events by date
  const eventsByDate = useMemo(() => {
    const map = {};
    events.forEach(e => {
      if (!e.date_pose) return;
      const d = new Date(e.date_pose);
      const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      if (!map[key]) map[key] = [];
      map[key].push(e);
    });
    return map;
  }, [events]);

  // Group audits by date
  const auditsByDate = useMemo(() => {
    const map = {};
    audits.forEach(e => {
      if (!e.date_audit) return;
      const d = new Date(e.date_audit);
      const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      if (!map[key]) map[key] = [];
      map[key].push(e);
    });
    return map;
  }, [audits]);

  // Group reminders by date
  const remindersByDate = useMemo(() => {
    const map = {};
    reminders.filter(r => !r.completed).forEach(r => {
      if (!r.due_date) return;
      const d = new Date(r.due_date);
      const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      if (!map[key]) map[key] = [];
      map[key].push(r);
    });
    return map;
  }, [reminders]);

  const activeEventsByDate = planningTab === 'poses' ? eventsByDate : planningTab === 'audits' ? auditsByDate : remindersByDate;

  // Calendar data
  const calendarData = useMemo(() => {
    const [year, month] = selectedMonth.split('-').map(Number);
    const firstDay = new Date(year, month - 1, 1);
    const lastDay = new Date(year, month, 0);
    const startPad = (firstDay.getDay() + 6) % 7; // Monday start
    const days = [];
    for (let i = -startPad; i < lastDay.getDate(); i++) {
      const date = new Date(year, month - 1, i + 1);
      const key = `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
      days.push({ date, key, events: activeEventsByDate[key] || [], isCurrentMonth: i >= 0 });
    }
    // Pad end to fill last week
    while (days.length % 7 !== 0) {
      const last = days[days.length - 1].date;
      const next = new Date(last); next.setDate(next.getDate() + 1);
      const key = `${next.getFullYear()}-${String(next.getMonth()+1).padStart(2,'0')}-${String(next.getDate()).padStart(2,'0')}`;
      days.push({ date: next, key, events: activeEventsByDate[key] || [], isCurrentMonth: false });
    }
    return days;
  }, [selectedMonth, activeEventsByDate]);

  const todayDate = new Date();
  const today = `${todayDate.getFullYear()}-${String(todayDate.getMonth()+1).padStart(2,'0')}-${String(todayDate.getDate()).padStart(2,'0')}`;
  const todayStart = new Date(todayDate.getFullYear(), todayDate.getMonth(), todayDate.getDate());
  const upcomingEvents = events.filter(e => e.date_pose && new Date(e.date_pose) >= todayStart);
  const pastEvents = events.filter(e => e.date_pose && new Date(e.date_pose) < todayStart).reverse();
  const pendingReminders = reminders.filter(r => !r.completed).sort((a,b) => new Date(a.due_date) - new Date(b.due_date));
  const upcomingReminders = pendingReminders.filter(r => new Date(r.due_date) >= todayStart);
  const overdueReminders = pendingReminders.filter(r => new Date(r.due_date) < todayStart);

  const navMonth = (dir) => {
    const [y, m] = selectedMonth.split('-').map(Number);
    const d = new Date(y, m - 1 + dir, 1);
    setSelectedMonth(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`);
  };

  const monthNames = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
  const [sYear, sMonth] = selectedMonth.split('-').map(Number);

  return <div className="h-screen flex flex-col bg-slate-900">
    <header className="bg-slate-800/50 border-b border-slate-700 px-6 py-4"><div className="flex items-center justify-between">
      <div className="flex items-center gap-4">
        <button onClick={onBack} className="p-2 hover:bg-slate-700 rounded-xl text-slate-400"><ChevronLeft className="w-5 h-5"/></button>
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            {planningTab==='poses' ? <><CalendarDays className="w-5 h-5 text-emerald-400"/> Planning des poses</> : planningTab==='audits' ? <><Calendar className="w-5 h-5 text-blue-400"/> Planning des audits</> : <><Bell className="w-5 h-5 text-amber-400"/> Calendrier des rappels</>}
          </h1>
          <p className="text-xs text-slate-400">{planningTab==='poses' ? `${upcomingEvents.length} pose(s) à venir • ${events.length} total` : planningTab==='audits' ? `${audits.filter(a=>a.date_audit&&new Date(a.date_audit)>=todayStart).length} audit(s) à venir • ${audits.length} total` : `${pendingReminders.length} rappel(s) en attente • ${overdueReminders.length} en retard`}</p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <div className="flex bg-slate-700 rounded-lg p-0.5">
          <button onClick={()=>setPlanningTab('poses')} className={cn("px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5", planningTab==='poses'?'bg-emerald-500 text-white':'text-slate-400 hover:text-white')}><CalendarDays className="w-3.5 h-3.5"/>Poses</button>
          <button onClick={()=>setPlanningTab('audits')} className={cn("px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5", planningTab==='audits'?'bg-blue-500 text-white':'text-slate-400 hover:text-white')}><Calendar className="w-3.5 h-3.5"/>Audits</button>
          <button onClick={()=>setPlanningTab('rappels')} className={cn("px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5", planningTab==='rappels'?'bg-amber-500 text-white':'text-slate-400 hover:text-white')}><Bell className="w-3.5 h-3.5"/>Rappels{overdueReminders.length>0&&<span className="ml-1 px-1.5 py-0.5 bg-red-500 text-white text-[10px] rounded-full font-bold">{overdueReminders.length}</span>}</button>
        </div>
        <div className="flex bg-slate-700 rounded-lg p-0.5">
          <button onClick={()=>setViewMode('calendar')} className={cn("px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5", viewMode==='calendar'?'bg-emerald-500 text-white':'text-slate-400 hover:text-white')}><Calendar className="w-3.5 h-3.5"/>Calendrier</button>
          <button onClick={()=>setViewMode('list')} className={cn("px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5", viewMode==='list'?'bg-emerald-500 text-white':'text-slate-400 hover:text-white')}><List className="w-3.5 h-3.5"/>Liste</button>
        </div>
      </div>
    </div></header>

    <div className="flex-1 overflow-auto p-6">
      {loading ? <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 text-emerald-400 animate-spin"/></div> :

      viewMode === 'calendar' ? (
        <div className="max-w-6xl mx-auto">
          {/* Month navigation */}
          <div className="flex items-center justify-between mb-4">
            <button onClick={()=>navMonth(-1)} className="p-2 hover:bg-slate-700 rounded-lg text-slate-400"><ChevronLeft className="w-5 h-5"/></button>
            <h2 className="text-lg font-bold text-white">{monthNames[sMonth-1]} {sYear}</h2>
            <button onClick={()=>navMonth(1)} className="p-2 hover:bg-slate-700 rounded-lg text-slate-400"><ChevronRight className="w-5 h-5"/></button>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 gap-1 mb-1">
            {['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'].map(d => <div key={d} className="text-center text-xs text-slate-500 font-medium py-2">{d}</div>)}
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7 gap-1">
            {calendarData.map(({ date, key, events: dayEvents, isCurrentMonth }) => (
              <div key={key} className={cn("min-h-[90px] rounded-lg p-1.5 border transition-colors",
                key === today ? (planningTab==='poses'?"border-emerald-500 bg-emerald-500/10":planningTab==='audits'?"border-blue-500 bg-blue-500/10":"border-amber-500 bg-amber-500/10") : "border-slate-700/50",
                isCurrentMonth ? "bg-slate-800/50" : "bg-slate-800/20 opacity-50")}>
                <div className="text-xs text-slate-400 mb-1">{date.getDate()}</div>
                <div className="space-y-0.5">
                  {planningTab==='poses' ? dayEvents.slice(0, 3).map(ev => (
                    <button key={ev.id} onClick={() => onOpenProspect(ev)} className="w-full text-left px-1.5 py-0.5 rounded text-[10px] font-medium truncate hover:opacity-80 transition-opacity" style={{ backgroundColor: (ev.status?.color || '#6B7280') + '30', color: ev.status?.color || '#6B7280' }}>
                      {ev.company_name || `${ev.first_name||''} ${ev.last_name||''}`}
                    </button>
                  )) : planningTab==='audits' ? dayEvents.slice(0, 3).map(ev => (
                    <button key={ev.id} onClick={() => onOpenProspect(ev)} className="w-full text-left px-1.5 py-0.5 rounded text-[10px] font-medium truncate hover:opacity-80 transition-opacity bg-blue-500/20 text-blue-400">
                      {ev.company_name || `${ev.first_name||''} ${ev.last_name||''}`}
                    </button>
                  )) : dayEvents.slice(0, 3).map(r => {
                    const isOverdue = new Date(r.due_date) < new Date();
                    const name = r.prospect?.company_name || `${r.prospect?.first_name||''} ${r.prospect?.last_name||''}`.trim() || 'Rappel';
                    return <button key={r.id} onClick={() => r.prospect_id && onOpenProspect({ id: r.prospect_id, company_name: r.prospect?.company_name, first_name: r.prospect?.first_name, last_name: r.prospect?.last_name })} className={cn("w-full text-left px-1.5 py-0.5 rounded text-[10px] font-medium truncate hover:opacity-80 transition-opacity", isOverdue?"bg-red-500/20 text-red-400":"bg-amber-500/20 text-amber-400")}>
                      {name}
                    </button>;
                  })}
                  {dayEvents.length > 3 && <div className="text-[10px] text-slate-500 pl-1">+{dayEvents.length - 3} autres</div>}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : planningTab === 'audits' ? (
        /* AUDITS LIST VIEW */
        <div className="max-w-4xl mx-auto space-y-6">
          {(() => {
            const todayStart = new Date(); todayStart.setHours(0,0,0,0);
            const upcomingAudits = audits.filter(a => a.date_audit && new Date(a.date_audit) >= todayStart).sort((a,b) => new Date(a.date_audit) - new Date(b.date_audit));
            const pastAudits = audits.filter(a => a.date_audit && new Date(a.date_audit) < todayStart).sort((a,b) => new Date(b.date_audit) - new Date(a.date_audit));
            return <>
              {upcomingAudits.length > 0 && <div>
                <h3 className="text-sm font-semibold text-blue-400 uppercase mb-3 flex items-center gap-2"><Calendar className="w-4 h-4"/> Audits à venir ({upcomingAudits.length})</h3>
                <div className="space-y-2">{upcomingAudits.map(ev => (
                  <div key={ev.id} onClick={() => onOpenProspect(ev)} className="flex items-center gap-4 p-4 bg-slate-800 rounded-xl border border-slate-700 hover:border-blue-500/50 cursor-pointer transition-colors">
                    <div className="w-14 h-14 bg-blue-500/20 rounded-xl flex flex-col items-center justify-center flex-shrink-0">
                      <span className="text-blue-400 text-lg font-bold">{new Date(ev.date_audit).getDate()}</span>
                      <span className="text-blue-400 text-[10px] uppercase">{new Date(ev.date_audit).toLocaleDateString('fr-FR', { month: 'short' })}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-medium text-sm">{ev.company_name || `${ev.first_name||''} ${ev.last_name||''}`}</p>
                      <p className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
                        {ev.city && <span className="flex items-center gap-1"><MapPin className="w-3 h-3"/>{ev.city}</span>}
                        {ev.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3"/>{ev.phone}</span>}
                        <span className="flex items-center gap-1"><Clock className="w-3 h-3"/>{new Date(ev.date_audit).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      {ev.status && <Badge color={ev.status.color} small>{ev.status.name}</Badge>}
                      {ev.installer && <span className="text-xs text-slate-400">{ev.installer.name}</span>}
                    </div>
                  </div>
                ))}</div>
              </div>}
              {pastAudits.length > 0 && <div>
                <h3 className="text-sm font-semibold text-slate-500 uppercase mb-3 flex items-center gap-2"><History className="w-4 h-4"/> Audits passés ({pastAudits.length})</h3>
                <div className="space-y-2">{pastAudits.slice(0, 20).map(ev => (
                  <div key={ev.id} onClick={() => onOpenProspect(ev)} className="flex items-center gap-4 p-3 bg-slate-800/50 rounded-xl border border-slate-700/50 hover:border-slate-600 cursor-pointer transition-colors opacity-70">
                    <div className="w-12 h-12 bg-slate-700 rounded-xl flex flex-col items-center justify-center flex-shrink-0">
                      <span className="text-slate-400 text-sm font-bold">{new Date(ev.date_audit).getDate()}</span>
                      <span className="text-slate-500 text-[10px] uppercase">{new Date(ev.date_audit).toLocaleDateString('fr-FR', { month: 'short' })}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-slate-300 font-medium text-sm">{ev.company_name || `${ev.first_name||''} ${ev.last_name||''}`}</p>
                      <p className="text-xs text-slate-500">{ev.city || ''} {ev.installer ? `• ${ev.installer.name}` : ''}</p>
                    </div>
                    {ev.status && <Badge color={ev.status.color} small>{ev.status.name}</Badge>}
                  </div>
                ))}</div>
              </div>}
              {audits.length === 0 && <div className="text-center py-16">
                <Calendar className="w-12 h-12 text-slate-600 mx-auto mb-4"/>
                <p className="text-slate-400 mb-2">Aucun audit planifié</p>
                <p className="text-xs text-slate-500">Ajoutez une date d'audit dans la fiche d'un prospect pour la voir apparaître ici</p>
              </div>}
            </>;
          })()}
        </div>
      ) : planningTab === 'poses' ? (
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Upcoming */}
          {upcomingEvents.length > 0 && <div>
            <h3 className="text-sm font-semibold text-emerald-400 uppercase mb-3 flex items-center gap-2"><CalendarCheck className="w-4 h-4"/> Poses à venir ({upcomingEvents.length})</h3>
            <div className="space-y-2">{upcomingEvents.map(ev => (
              <div key={ev.id} onClick={() => onOpenProspect(ev)} className="flex items-center gap-4 p-4 bg-slate-800 rounded-xl border border-slate-700 hover:border-emerald-500/50 cursor-pointer transition-colors">
                <div className="w-14 h-14 bg-emerald-500/20 rounded-xl flex flex-col items-center justify-center flex-shrink-0">
                  <span className="text-emerald-400 text-lg font-bold">{new Date(ev.date_pose).getDate()}</span>
                  <span className="text-emerald-400 text-[10px] uppercase">{new Date(ev.date_pose).toLocaleDateString('fr-FR', { month: 'short' })}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-medium text-sm">{ev.company_name || `${ev.first_name||''} ${ev.last_name||''}`}</p>
                  <p className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
                    {ev.city && <span className="flex items-center gap-1"><MapPin className="w-3 h-3"/>{ev.city}</span>}
                    {ev.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3"/>{ev.phone}</span>}
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3"/>{new Date(ev.date_pose).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                  {ev.status && <Badge color={ev.status.color} small>{ev.status.name}</Badge>}
                  {ev.installer && <span className="text-xs text-slate-400">{ev.installer.name}</span>}
                  {isAdmin && ev.ca_previsionnel && <span className="text-xs text-yellow-400 font-medium">{parseFloat(ev.ca_previsionnel).toLocaleString('fr-FR')} € prév.</span>}
                  {isAdmin && ev.ca_reel && <span className="text-xs text-emerald-300 font-medium">{parseFloat(ev.ca_reel).toLocaleString('fr-FR')} € réel</span>}
                </div>
              </div>
            ))}</div>
          </div>}

          {/* Past */}
          {pastEvents.length > 0 && <div>
            <h3 className="text-sm font-semibold text-slate-500 uppercase mb-3 flex items-center gap-2"><History className="w-4 h-4"/> Passées ({pastEvents.length})</h3>
            <div className="space-y-2">{pastEvents.slice(0, 20).map(ev => (
              <div key={ev.id} onClick={() => onOpenProspect(ev)} className="flex items-center gap-4 p-3 bg-slate-800/50 rounded-xl border border-slate-700/50 hover:border-slate-600 cursor-pointer transition-colors opacity-70">
                <div className="w-12 h-12 bg-slate-700 rounded-xl flex flex-col items-center justify-center flex-shrink-0">
                  <span className="text-slate-400 text-sm font-bold">{new Date(ev.date_pose).getDate()}</span>
                  <span className="text-slate-500 text-[10px] uppercase">{new Date(ev.date_pose).toLocaleDateString('fr-FR', { month: 'short' })}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-slate-300 font-medium text-sm">{ev.company_name || `${ev.first_name||''} ${ev.last_name||''}`}</p>
                  <p className="text-xs text-slate-500">{ev.city || ''} {ev.installer ? `• ${ev.installer.name}` : ''}</p>
                </div>
                {ev.status && <Badge color={ev.status.color} small>{ev.status.name}</Badge>}
              </div>
            ))}</div>
          </div>}

          {events.length === 0 && <div className="text-center py-16">
            <CalendarDays className="w-12 h-12 text-slate-600 mx-auto mb-4"/>
            <p className="text-slate-400 mb-2">Aucune pose planifiée</p>
            <p className="text-xs text-slate-500">Ajoutez une date de pose dans la fiche d'un prospect pour la voir apparaître ici</p>
          </div>}
        </div>
      ) : (
        /* RAPPELS LIST VIEW */
        <div className="max-w-4xl mx-auto space-y-6">
          {overdueReminders.length > 0 && <div>
            <h3 className="text-sm font-semibold text-red-400 uppercase mb-3 flex items-center gap-2"><BellRing className="w-4 h-4 animate-pulse"/> En retard ({overdueReminders.length})</h3>
            <div className="space-y-2">{overdueReminders.map(r => {
              const name = r.prospect?.company_name || `${r.prospect?.first_name||''} ${r.prospect?.last_name||''}`.trim() || 'Rappel';
              return <div key={r.id} onClick={() => r.prospect_id && onOpenProspect({ id: r.prospect_id, company_name: r.prospect?.company_name, first_name: r.prospect?.first_name, last_name: r.prospect?.last_name })} className="flex items-center gap-4 p-4 bg-red-500/10 rounded-xl border border-red-500/30 hover:border-red-400 cursor-pointer transition-colors">
                <div className="w-14 h-14 bg-red-500/20 rounded-xl flex flex-col items-center justify-center flex-shrink-0">
                  <span className="text-red-400 text-lg font-bold">{new Date(r.due_date).getDate()}</span>
                  <span className="text-red-400 text-[10px] uppercase">{new Date(r.due_date).toLocaleDateString('fr-FR', { month: 'short' })}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-medium text-sm">{r.message||'Rappel'}</p>
                  <p className="text-xs text-red-400 flex items-center gap-2 mt-0.5">
                    <span className="flex items-center gap-1"><Bell className="w-3 h-3"/>{name}</span>
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3"/>{formatDateTime(r.due_date)}</span>
                  </p>
                </div>
                <Badge color="#EF4444" small>⚠ En retard</Badge>
              </div>;
            })}</div>
          </div>}

          {upcomingReminders.length > 0 && <div>
            <h3 className="text-sm font-semibold text-amber-400 uppercase mb-3 flex items-center gap-2"><Bell className="w-4 h-4"/> À venir ({upcomingReminders.length})</h3>
            <div className="space-y-2">{upcomingReminders.map(r => {
              const name = r.prospect?.company_name || `${r.prospect?.first_name||''} ${r.prospect?.last_name||''}`.trim() || 'Rappel';
              return <div key={r.id} onClick={() => r.prospect_id && onOpenProspect({ id: r.prospect_id, company_name: r.prospect?.company_name, first_name: r.prospect?.first_name, last_name: r.prospect?.last_name })} className="flex items-center gap-4 p-4 bg-slate-800 rounded-xl border border-slate-700 hover:border-amber-500/50 cursor-pointer transition-colors">
                <div className="w-14 h-14 bg-amber-500/20 rounded-xl flex flex-col items-center justify-center flex-shrink-0">
                  <span className="text-amber-400 text-lg font-bold">{new Date(r.due_date).getDate()}</span>
                  <span className="text-amber-400 text-[10px] uppercase">{new Date(r.due_date).toLocaleDateString('fr-FR', { month: 'short' })}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-medium text-sm">{r.message||'Rappel'}</p>
                  <p className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
                    <span className="flex items-center gap-1"><Bell className="w-3 h-3"/>{name}</span>
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3"/>{formatDateTime(r.due_date)}</span>
                  </p>
                </div>
              </div>;
            })}</div>
          </div>}

          {pendingReminders.length === 0 && <div className="text-center py-16">
            <Bell className="w-12 h-12 text-slate-600 mx-auto mb-4"/>
            <p className="text-slate-400 mb-2">Aucun rappel en attente</p>
            <p className="text-xs text-slate-500">Programmez des rappels depuis la fiche d'un prospect</p>
          </div>}
        </div>
      )}
    </div>
  </div>;
});

// =====================================================
// ACTIVITY PAGE
// =====================================================
const ActivityPage = memo(({ onBack }) => {
  const { logs, loading } = useActivityLog();
  return <div className="h-screen flex flex-col bg-slate-900">
    <header className="bg-slate-800/50 border-b border-slate-700 px-6 py-4"><div className="flex items-center gap-4"><button onClick={onBack} className="p-2 hover:bg-slate-700 rounded-xl text-slate-400"><ChevronLeft className="w-5 h-5"/></button><h1 className="text-xl font-bold text-white">Journal d'activité</h1></div></header>
    <div className="flex-1 overflow-auto p-6"><div className="max-w-3xl mx-auto space-y-2">
      {loading ? <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 text-emerald-400 animate-spin"/></div> : logs.map(log=>
        <div key={log.id} className="flex items-start gap-3 p-3 bg-slate-800/50 rounded-xl"><div className="w-8 h-8 bg-slate-700 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0">{log.profile?.first_name?.[0]}</div><div className="flex-1"><p className="text-sm text-white"><span className="font-medium">{log.profile?.first_name} {log.profile?.last_name}</span> — {actionLabels[log.action]||log.action}</p><p className="text-xs text-slate-400">{formatDateTime(log.created_at)}</p></div></div>
      )}
    </div></div>
  </div>;
});

// =====================================================
// CHAT PAGE
// =====================================================
const ChatPage = memo(({ onBack, allUsers, onlineUsers, unreadChat }) => {
  // Default channel: the one with the most unread, else iti
  const initialChannel = (() => {
    const u = unreadChat?.unread || {};
    const maxCh = Object.keys(u).reduce((a,b) => (u[a]||0) >= (u[b]||0) ? a : b, 'iti');
    return (u[maxCh] || 0) > 0 ? maxCh : 'iti';
  })();
  const [activeChannel, setActiveChannel] = useState(initialChannel);
  const { messages, loading, sendMessage, deleteMessage } = useChat(activeChannel);
  const [msg, setMsg] = useState('');
  const [sending, setSending] = useState(false);
  const endRef = useRef(null);
  const { profile } = useAuth();

  useEffect(() => { unreadChat?.markRead?.(activeChannel); }, [activeChannel, unreadChat]);
  useEffect(() => {
    if (messages.length > 0) unreadChat?.markRead?.(activeChannel);
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, activeChannel, unreadChat]);

  const handleSend = async () => {
    if (!msg.trim() || sending) return;
    setSending(true);
    try { await sendMessage(msg); setMsg(''); } catch(e) { console.warn(e); }
    finally { setSending(false); }
  };

  const channels = [
    { id: 'iti', label: 'ITI', color: '#3B82F6', icon: Hash },
    { id: 'pac', label: 'PAC', color: '#EF4444', icon: Hash },
    { id: 'general', label: 'Général', color: '#10B981', icon: MessageSquare },
  ];

  return <div className="h-screen flex flex-col bg-slate-900">
    <header className="bg-slate-800/60 backdrop-blur-sm border-b border-slate-700/80 px-6 py-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2 hover:bg-slate-700 rounded-xl text-slate-400 transition-colors"><ChevronLeft className="w-5 h-5"/></button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg"><MessageSquare className="w-5 h-5 text-white"/></div>
            <div><h1 className="text-lg font-bold text-white">Chat d'équipe</h1><p className="text-[11px] text-slate-400">Conversations par produit</p></div>
          </div>
        </div>
      </div>
    </header>

    <div className="flex flex-1 overflow-hidden">
      {/* Sidebar channels */}
      <div className="w-52 bg-slate-800/40 border-r border-slate-700/60 p-3 flex flex-col gap-1.5">
        <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider px-2 mb-1">Salons</p>
        {channels.map(ch => {
          const ChIcon = ch.icon;
          const cnt = unreadChat?.unread?.[ch.id] || 0;
          return <button key={ch.id} onClick={() => setActiveChannel(ch.id)} className={cn("flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-all", activeChannel === ch.id ? "bg-emerald-500/15 text-emerald-400 shadow-sm" : "text-slate-400 hover:text-white hover:bg-slate-700/50")}>
            <ChIcon className="w-4 h-4" style={{ color: activeChannel === ch.id ? ch.color : undefined }}/>
            <span className="flex-1 text-left">{ch.label}</span>
            {cnt>0 && activeChannel!==ch.id && <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 bg-red-500 rounded-full text-[10px] text-white font-bold">{cnt>99?'99+':cnt}</span>}
          </button>;
        })}
        <div className="flex-1"/>
        {onlineUsers && Object.keys(onlineUsers).length > 0 && <div className="border-t border-slate-700/50 pt-3 mt-2">
          <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider px-2 mb-2">En ligne</p>
          <div className="space-y-1">{(allUsers||[]).filter(u => onlineUsers[u.id]).map(u =>
            <div key={u.id} className="flex items-center gap-2 px-2 py-1">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"/>
              <span className="text-xs text-slate-300">{u.first_name} {u.last_name}</span>
            </div>
          )}</div>
        </div>}
      </div>

      {/* Chat area */}
      <div className="flex-1 flex flex-col">
        {/* Channel header */}
        <div className="px-5 py-3 border-b border-slate-700/50 flex items-center gap-2">
          <Hash className="w-4 h-4" style={{ color: channels.find(c=>c.id===activeChannel)?.color }}/>
          <span className="text-white font-semibold text-sm">{channels.find(c=>c.id===activeChannel)?.label}</span>
          <span className="text-xs text-slate-500 ml-2">{messages.length} messages</span>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-auto px-5 py-4 space-y-1">
          {loading && <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 text-emerald-400 animate-spin"/></div>}
          {!loading && messages.length === 0 && <div className="text-center py-16"><MessageSquare className="w-12 h-12 text-slate-600 mx-auto mb-4"/><p className="text-slate-400">Aucun message dans ce salon</p><p className="text-xs text-slate-500 mt-1">Soyez le premier à écrire !</p></div>}
          {messages.map((m, i) => {
            const isMe = m.user_id === profile?.id;
            const prev = i > 0 ? messages[i-1] : null;
            const showHeader = !prev || prev.user_id !== m.user_id || (new Date(m.created_at) - new Date(prev.created_at) > 300000);
            const isOnline = !!onlineUsers?.[m.user_id];
            // Fallback: lookup dans allUsers si le join FK a échoué
            const userObj = m.profile || (allUsers||[]).find(u => u.id === m.user_id) || {};
            return <div key={m.id} className={cn("group", showHeader && "mt-3")}>
              {showHeader && <div className="flex items-center gap-2 mb-1">
                <div className="relative">
                  <div className={cn("w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold", isMe ? "bg-gradient-to-br from-emerald-400 to-emerald-600" : "bg-gradient-to-br from-blue-400 to-blue-600")}>{userObj.first_name?.[0] || '?'}</div>
                  {isOnline && <div className="absolute -bottom-0.5 -right-0.5 w-2 h-2 bg-emerald-400 rounded-full border border-slate-900"/>}
                </div>
                <span className={cn("text-sm font-semibold", isMe ? "text-emerald-400" : "text-white")}>{userObj.first_name || 'Utilisateur'} {userObj.last_name || ''}</span>
                <span className="text-[10px] text-slate-500">{formatDateTime(m.created_at)}</span>
              </div>}
              <div className="flex items-start gap-2 pl-9">
                <p className="text-sm text-slate-300 leading-relaxed flex-1 whitespace-pre-wrap break-words">{m.content}</p>
                {isMe && <button onClick={async () => { if(confirm('Supprimer ce message ?')) try { await deleteMessage(m.id); } catch(e) {} }} className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-red-500/20 text-red-400 transition-all flex-shrink-0"><Trash2 className="w-3 h-3"/></button>}
              </div>
            </div>;
          })}
          <div ref={endRef}/>
        </div>

        {/* Input */}
        <div className="px-5 py-3 border-t border-slate-700/50 bg-slate-800/30">
          <div className="flex items-center gap-3">
            <Input value={msg} onChange={e => setMsg(e.target.value)} placeholder={`Message dans #${channels.find(c=>c.id===activeChannel)?.label}...`} className="flex-1 py-3" onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}/>
            <Btn variant="primary" onClick={handleSend} disabled={sending || !msg.trim()} icon={Send}>{sending ? <Loader2 className="w-4 h-4 animate-spin"/> : null}</Btn>
          </div>
        </div>
      </div>
    </div>
  </div>;
});

// =====================================================
// MODALS
// =====================================================
const ProspectModal = memo(({ open, onClose, onSubmit, categories, statuses, products, installers, sources, isAdmin, existingProspects = [] }) => {
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const { lookup, loading: siretLd } = useSiretLookup();
  useEffect(() => { if(open) { setErr(''); setSaving(false); setPhoneWarning(null); setForm({ first_name:'', last_name:'', company_name:'', phone:'', email:'', city:'', siret:'', address:'', postal_code:'', category_id:categories[0]?.id||'', status_id:statuses[0]?.id||'', product_id:products[0]?.id||'', installer_id:'', source_id:'', transmis_installateur: false, date_pose: null, date_audit: null, type_led:'', mode_pose:'', nb_led:'', nb_led_reel:'', nb_personnes_foyer:'', revenu_fiscal_ref:'', is_ile_de_france:false, categorie_aide:'', reste_a_charge:'', surface_sous_sol:'', surface_comble:'', surface_isoler_total:'', has_vmc:false, has_pac_split:false, surface_habitable:'', surface_chauffer:'', zone_climatique:'', commission_pac:'', ballon_type:'', type_chauffage:'', numero_fiscal:'', type_logement:'', type_projet:'', surface_batiment:'', surface_mur_interieur:'', surface_mur_exterieur:'', surface_fenetre:'' }); } }, [open, categories, statuses, products]);

  const handleSiret = async () => { try { const r=await lookup(form.siret); setForm(f=>({...f,company_name:r.company_name||f.company_name,address:r.address||f.address,postal_code:r.postal_code||f.postal_code,city:r.city||f.city,latitude:r.latitude,longitude:r.longitude})); } catch(e) { setErr(e.message); } };
  const handleAddr = item => { const zone = getZoneClimatique(item.postcode); setForm(f=>({...f,address:item.name,postal_code:item.postcode,city:item.city?.toUpperCase(),latitude:item.latitude,longitude:item.longitude,zone_climatique:zone})); };
  const [phoneWarning, setPhoneWarning] = useState(null);
  const checkPhoneDuplicate = useCallback((phone) => {
    if (!phone || phone.trim().length < 4) { setPhoneWarning(null); return false; }
    const clean = phone.replace(/[\s.\-()]/g, '');
    const match = existingProspects.find(p => p.phone && p.phone.replace(/[\s.\-()]/g, '') === clean);
    if (match) { setPhoneWarning(match); return true; }
    setPhoneWarning(null); return false;
  }, [existingProspects]);

  const go = async e => {
    e.preventDefault(); setErr(''); setSaving(true);
    // Check phone duplicate — block creation if number already exists
    if (form.phone && form.phone.trim()) {
      const clean = form.phone.replace(/[\s.\-()]/g, '');
      const match = existingProspects.find(p => p.phone && p.phone.replace(/[\s.\-()]/g, '') === clean);
      if (match) { setErr(`⚠️ Attention : prospect déjà existant avec ce numéro — ${match.first_name || ''} ${match.last_name || ''} (${match.company_name || 'Sans entreprise'}). Seul un admin peut dupliquer une fiche.`); setSaving(false); return; }
    }
    const submitData = { ...form };
    // Auto-compute zone climatique
    if (submitData.postal_code) { const z = getZoneClimatique(submitData.postal_code); if (z) submitData.zone_climatique = z; }
    // Auto-compute categorie_aide et surface_isoler_total (somme des 5 surfaces)
    const cat = calcCategorieAide(submitData.nb_personnes_foyer, submitData.revenu_fiscal_ref, submitData.is_ile_de_france);
    if (cat) submitData.categorie_aide = cat;
    const totalIsoler = sumSurfacesIsoler(submitData);
    if (totalIsoler > 0) submitData.surface_isoler_total = totalIsoler;
    // Auto-compute commissions selon produit
    const selProdForCalc = products.find(p => p.id === submitData.product_id);
    const pCodeForCalc = selProdForCalc ? getProductCode({ product: selProdForCalc }, products) : null;
    if (pCodeForCalc === 'pac' && cat && submitData.zone_climatique) {
      const pc = calcPacCommission(cat, submitData.zone_climatique);
      if (pc) { submitData.reste_a_charge = pc.reste_a_charge; submitData.commission_pac = pc.commission; }
    }
    const mItiSurfH = parseFloat(submitData.surface_batiment) || parseFloat(submitData.surface_habitable) || 0;
    if (pCodeForCalc === 'iti' && cat && mItiSurfH > 0 && totalIsoler > 0) {
      const ic = calcItiCommission(cat, mItiSurfH, totalIsoler, submitData.iti_option || 'A');
      if (ic) {
        submitData.reste_a_charge = ic.rac;
        submitData.commission_admin = ic.commission;
      }
    }
    try { await onSubmit(submitData); }
    catch(e) { setErr(e.message||'Erreur lors de la création'); import.meta.env.DEV&&console.warn('ProspectModal submit error:', e); }
    finally { setSaving(false); }
  };

  return <Modal open={open} onClose={onClose} title="Nouveau prospect" icon={Plus} size="lg">
    <form onSubmit={go} className="p-6 space-y-4">
      {err&&<div className="p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-400 text-sm flex items-center gap-2"><AlertCircle className="w-4 h-4 flex-shrink-0"/>{err}</div>}
      <div><label className="text-xs text-slate-400">SIRET (auto-remplit les infos)</label><div className="flex gap-2 mt-1"><Input placeholder="N° SIRET" value={form.siret||''} onChange={e=>setForm(f=>({...f,siret:e.target.value}))} className="flex-1"/><Btn type="button" variant="primary" size="sm" onClick={handleSiret} disabled={siretLd||!form.siret}>{siretLd?<Loader2 className="w-4 h-4 animate-spin"/>:<Search className="w-4 h-4"/>}</Btn></div></div>
      <Input placeholder="Raison sociale" value={form.company_name||''} onChange={e=>setForm(f=>({...f,company_name:e.target.value}))} className="w-full py-3"/>
      <div className="grid grid-cols-2 gap-3"><Input placeholder="Prénom *" value={form.first_name||''} onChange={e=>setForm(f=>({...f,first_name:e.target.value}))} className="py-3" required/><Input placeholder="Nom" value={form.last_name||''} onChange={e=>setForm(f=>({...f,last_name:e.target.value}))} className="py-3"/></div>
      <div className="grid grid-cols-2 gap-3"><Input placeholder="Téléphone" value={form.phone||''} onChange={e=>{setForm(f=>({...f,phone:e.target.value})); checkPhoneDuplicate(e.target.value);}} className={`py-3 ${phoneWarning ? 'border-amber-500 ring-1 ring-amber-500/50' : ''}`}/><Input placeholder="Email" type="email" value={form.email||''} onChange={e=>setForm(f=>({...f,email:e.target.value}))} className="py-3"/></div>
      {phoneWarning && <div className="p-3 bg-amber-500/20 border border-amber-500/50 rounded-lg text-amber-400 text-sm flex items-center gap-2"><AlertCircle className="w-4 h-4 flex-shrink-0"/>⚠️ Ce numéro existe déjà : <strong>{phoneWarning.first_name||''} {phoneWarning.last_name||''}</strong> ({phoneWarning.company_name||'Sans entreprise'}). La création sera bloquée — seul un admin peut dupliquer une fiche.</div>}
      <AddressAutocomplete value={form.address||''} onChange={v=>setForm(f=>({...f,address:v}))} onSelect={handleAddr}/>
      <div className="grid grid-cols-2 gap-3"><Input placeholder="Code postal" value={form.postal_code||''} onChange={e=>{const v=e.target.value; const z=getZoneClimatique(v); setForm(f=>({...f,postal_code:v,zone_climatique:z}));}} className="py-3"/><Input placeholder="Ville" value={form.city||''} onChange={e=>setForm(f=>({...f,city:e.target.value}))} className="py-3"/></div>
      {form.zone_climatique && <div className="flex items-center gap-2 p-2 rounded-lg" style={{ backgroundColor: zoneColors[form.zone_climatique] + '20' }}><span className="w-3 h-3 rounded-full" style={{ backgroundColor: zoneColors[form.zone_climatique] }}/><span className="text-sm font-semibold" style={{ color: zoneColors[form.zone_climatique] }}>Zone {form.zone_climatique}</span></div>}
      {/* TYPE DE SITE — avant le produit pour guider le choix */}
      <div>
        <Select value={form.type_site_activite||''} onChange={e=>setForm(f=>({...f,type_site_activite:e.target.value||null}))} className="py-3">
          <option value="">— Type de site / activité —</option>
          <optgroup label="Industriel">
            {TYPES_SITE_ACTIVITE.filter(t=>t.product==='destrat_industriel').map(t=><option key={t.value} value={t.value}>{t.label}</option>)}
          </optgroup>
          <optgroup label="Tertiaire">
            {TYPES_SITE_ACTIVITE.filter(t=>t.product==='destrat_tertiaire').map(t=><option key={t.value} value={t.value}>{t.label}</option>)}
          </optgroup>
          <optgroup label="Groupe de froid">
            {TYPES_SITE_ACTIVITE.filter(t=>t.product==='haute_pression').map(t=><option key={t.value} value={t.value}>{t.label}</option>)}
          </optgroup>
          <optgroup label="Serre agricole">
            {TYPES_SITE_ACTIVITE.filter(t=>t.product==='vmc_serre').map(t=><option key={t.value} value={t.value}>{t.label}</option>)}
          </optgroup>
          <optgroup label="Autre">
            {TYPES_SITE_ACTIVITE.filter(t=>t.product===null).map(t=><option key={t.value} value={t.value}>{t.label}</option>)}
          </optgroup>
        </Select>
        {(() => {
          const si = getRecommendedProduct(form.type_site_activite);
          if (!si) return null;
          const rl = si.product ? PRODUCT_LABELS[si.product] : 'NON ÉLIGIBLE';
          const bad = !si.product;
          return <div className={`mt-1 p-2 rounded-lg text-center font-bold text-xs ${bad ? 'bg-red-500/20 border border-red-500/40 text-red-400' : 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-400'}`}>
            ⚙ Recommandé : {rl}
          </div>;
        })()}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Select value={form.product_id||''} onChange={e=>setForm(f=>({...f,product_id:e.target.value}))} className="py-3"><option value="">Produit</option>{products.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</Select>
        <Select value={form.installer_id||''} onChange={e=>setForm(f=>({...f,installer_id:e.target.value}))} className="py-3"><option value="">Installateur</option>{installers.map(i=><option key={i.id} value={i.id}>{i.name}</option>)}</Select>
      </div>
      {isAdmin && sources && sources.length > 0 && <Select value={form.source_id||''} onChange={e=>setForm(f=>({...f,source_id:e.target.value}))} className="py-3"><option value="">Provenance</option>{sources.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</Select>}
      <div className="grid grid-cols-2 gap-3">
        <Select value={form.category_id||''} onChange={e=>setForm(f=>({...f,category_id:e.target.value}))} className="py-3"><option value="">Secteur d'activité</option>{categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</Select>
        <Select value={form.status_id||''} onChange={e=>setForm(f=>({...f,status_id:e.target.value}))} className="py-3"><option value="">Statut</option>{statuses.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</Select>
      </div>
      {/* Champs dynamiques selon le produit sélectionné */}
      {(() => {
        const selProd = products.find(p => p.id === form.product_id);
        const pCode = selProd ? getProductCode({ product: selProd }, products) : null;
        const computedCat = calcCategorieAide(form.nb_personnes_foyer, form.revenu_fiscal_ref, form.is_ile_de_france);
        if (pCode === 'led') return <>
          <div className="grid grid-cols-2 gap-3">
            <Select value={form.type_led||''} onChange={e=>setForm(f=>({...f,type_led:e.target.value}))} className="py-3"><option value="">Matériel</option>{Object.entries(typeLedLabels).map(([k,v])=><option key={k} value={k}>{v}</option>)}</Select>
            <Select value={form.mode_pose||''} onChange={e=>setForm(f=>({...f,mode_pose:e.target.value}))} className="py-3"><option value="">Mode pose</option>{Object.entries(modePoseLabels).map(([k,v])=><option key={k} value={k}>{v}</option>)}</Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input placeholder="Nb LED à installer" type="number" value={form.nb_led||''} onChange={e=>setForm(f=>({...f,nb_led:e.target.value}))} className="py-3"/>
            <Input placeholder="Nb LED réel installé" type="number" value={form.nb_led_reel||''} onChange={e=>setForm(f=>({...f,nb_led_reel:e.target.value}))} className="py-3"/>
          </div>
        </>;
        if (pCode === 'iti') return <>
          <div className="bg-slate-700/30 rounded-xl p-3 space-y-3">
            <p className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">Détails ITI</p>
            {form.zone_climatique && <div className="flex items-center gap-2 p-2 rounded-lg" style={{ backgroundColor: zoneColors[form.zone_climatique] + '20' }}><span className="w-3 h-3 rounded-full" style={{ backgroundColor: zoneColors[form.zone_climatique] }}/><span className="text-sm font-semibold" style={{ color: zoneColors[form.zone_climatique] }}>Zone {form.zone_climatique}</span></div>}
            <Select value={form.is_ile_de_france ? 'true' : 'false'} onChange={e=>setForm(f=>({...f,is_ile_de_france:e.target.value==='true'}))} className="py-3"><option value="false">Hors Île-de-France</option><option value="true">Île-de-France</option></Select>
            <div className="grid grid-cols-2 gap-3">
              <Input placeholder="Nb personnes foyer" type="number" value={form.nb_personnes_foyer||''} onChange={e=>setForm(f=>({...f,nb_personnes_foyer:e.target.value}))} className="py-3"/>
              <Input placeholder="Revenu fiscal réf. (€)" type="number" value={form.revenu_fiscal_ref||''} onChange={e=>setForm(f=>({...f,revenu_fiscal_ref:e.target.value}))} className="py-3"/>
            </div>
            {computedCat && <div className="flex items-center gap-2 p-2 rounded-lg" style={{ backgroundColor: categorieAideColors[computedCat] + '20' }}><span className="w-3 h-3 rounded-full" style={{ backgroundColor: categorieAideColors[computedCat] }}/><span className="text-sm font-semibold" style={{ color: categorieAideColors[computedCat] }}>Profil {computedCat} ({categorieAideLabels[computedCat]})</span></div>}
            <Input placeholder="Numéro fiscal" value={form.numero_fiscal||''} onChange={e=>setForm(f=>({...f,numero_fiscal:e.target.value}))} className="py-3"/>
            <Input placeholder="Reste à charge (€)" type="number" value={form.reste_a_charge||''} onChange={e=>setForm(f=>({...f,reste_a_charge:e.target.value}))} className="py-3"/>
            <Input placeholder="Surface bâtiment (m²)" type="number" value={form.surface_batiment||''} onChange={e=>setForm(f=>({...f,surface_batiment:e.target.value}))} className="py-3"/>
            <div className="grid grid-cols-2 gap-3">
              <Input placeholder="Surface mur intérieur (m²)" type="number" value={form.surface_mur_interieur||''} onChange={e=>setForm(f=>({...f,surface_mur_interieur:e.target.value}))} className="py-3"/>
              <Input placeholder="Surface mur extérieur (m²)" type="number" value={form.surface_mur_exterieur||''} onChange={e=>setForm(f=>({...f,surface_mur_exterieur:e.target.value}))} className="py-3"/>
            </div>
            <Input placeholder="Surface fenêtre (m²)" type="number" value={form.surface_fenetre||''} onChange={e=>setForm(f=>({...f,surface_fenetre:e.target.value}))} className="py-3"/>
            <div className="grid grid-cols-2 gap-3">
              <Input placeholder="Surface sous-sol (m²)" type="number" value={form.surface_sous_sol||''} onChange={e=>setForm(f=>({...f,surface_sous_sol:e.target.value}))} className="py-3"/>
              <Input placeholder="Surface comble (m²)" type="number" value={form.surface_comble||''} onChange={e=>setForm(f=>({...f,surface_comble:e.target.value}))} className="py-3"/>
            </div>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={!!form.has_vmc} onChange={e=>setForm(f=>({...f,has_vmc:e.target.checked,has_pac_split:e.target.checked?false:f.has_pac_split}))} className="rounded border-slate-500"/><span className="text-sm text-slate-300">VMC</span></label>
              <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={!!form.has_pac_split} onChange={e=>setForm(f=>({...f,has_pac_split:e.target.checked,has_vmc:e.target.checked?false:f.has_vmc}))} className="rounded border-slate-500"/><span className="text-sm text-slate-300">PAC / Split</span></label>
            </div>
          </div>
        </>;
        if (pCode === 'pac') { const pacCalcModal = calcPacCommission(computedCat, form.zone_climatique); return <>
          <div className="bg-slate-700/30 rounded-xl p-3 space-y-3">
            <p className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">Détails PAC</p>
            {form.zone_climatique && <div className="flex items-center gap-2 p-2 rounded-lg" style={{ backgroundColor: zoneColors[form.zone_climatique] + '20' }}><span className="w-3 h-3 rounded-full" style={{ backgroundColor: zoneColors[form.zone_climatique] }}/><span className="text-sm font-semibold" style={{ color: zoneColors[form.zone_climatique] }}>Zone {form.zone_climatique}</span></div>}
            <Select value={form.is_ile_de_france ? 'true' : 'false'} onChange={e=>setForm(f=>({...f,is_ile_de_france:e.target.value==='true'}))} className="py-3"><option value="false">Hors Île-de-France</option><option value="true">Île-de-France</option></Select>
            <div className="grid grid-cols-2 gap-3">
              <Input placeholder="Nb personnes foyer" type="number" value={form.nb_personnes_foyer||''} onChange={e=>setForm(f=>({...f,nb_personnes_foyer:e.target.value}))} className="py-3"/>
              <Input placeholder="Revenu fiscal réf. (€)" type="number" value={form.revenu_fiscal_ref||''} onChange={e=>setForm(f=>({...f,revenu_fiscal_ref:e.target.value}))} className="py-3"/>
            </div>
            {computedCat && <div className="flex items-center gap-2 p-2 rounded-lg" style={{ backgroundColor: categorieAideColors[computedCat] + '20' }}><span className="w-3 h-3 rounded-full" style={{ backgroundColor: categorieAideColors[computedCat] }}/><span className="text-sm font-semibold" style={{ color: categorieAideColors[computedCat] }}>Profil {computedCat} ({categorieAideLabels[computedCat]})</span></div>}
            <Input placeholder="Numéro fiscal" value={form.numero_fiscal||''} onChange={e=>setForm(f=>({...f,numero_fiscal:e.target.value}))} className="py-3"/>
            {pacCalcModal && <div className="bg-slate-600/20 border border-slate-600/30 rounded-lg p-2"><div><span className="text-[10px] text-slate-400">Reste à charge</span><div className="text-sm font-bold text-white">{pacCalcModal.reste_a_charge} €</div></div></div>}
            {isAdmin && pacCalcModal && <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-2"><div><span className="text-[10px] text-slate-400">Commission</span><div className="text-sm font-bold text-emerald-400">{pacCalcModal.commission} €</div></div></div>}
            <Input placeholder="Puissance PAC (kW)" type="number" value={form.puissance_pac||''} onChange={e=>setForm(f=>({...f,puissance_pac:e.target.value}))} className="py-3"/>
            <Select value={form.ballon_type||''} onChange={e=>setForm(f=>({...f,ballon_type:e.target.value}))} className="py-3"><option value="">Type de ballon</option><option value="electrique">Ballon électrique</option><option value="thermodynamique">Ballon thermodynamique</option></Select>
            <div className="grid grid-cols-2 gap-3">
              <Input placeholder="Surface habitable (m²)" type="number" value={form.surface_habitable||''} onChange={e=>setForm(f=>({...f,surface_habitable:e.target.value}))} className="py-3"/>
              <Input placeholder="Surface à chauffer (m²)" type="number" value={form.surface_chauffer||''} onChange={e=>setForm(f=>({...f,surface_chauffer:e.target.value}))} className="py-3"/>
            </div>
          </div>
        </>; }
        // ===== DESTRATIFICATEUR TERTIAIRE (modal) =====
        if (pCode === 'destrat_tertiaire') return <div className="bg-slate-700/30 rounded-xl p-3 space-y-3">
          <p className="text-xs font-semibold text-violet-400 uppercase tracking-wider">Destrat. tertiaire</p>
          <Select value={form.batiment_chauffe||''} onChange={e=>setForm(f=>({...f,batiment_chauffe:e.target.value}))} className="py-3"><option value="">Bâtiment chauffé ?</option><option value="oui_totalite">Oui, la totalité du site</option><option value="oui_partiellement">Oui, partiellement</option><option value="non">Non</option></Select>
          <Select value={form.type_chauffage||''} onChange={e=>setForm(f=>({...f,type_chauffage:e.target.value}))} className="py-3"><option value="">Mode de chauffage</option><option value="gaz">Chaudière à Gaz</option><option value="fuel">Chaudière à Fuel</option></Select>
          <Input placeholder="Puissance chauffage (kW) — min 200kW" type="number" value={form.puissance_chauffage||''} onChange={e=>setForm(f=>({...f,puissance_chauffage:e.target.value}))} className="py-3"/>
          <Select value={form.chaudiere_remplacee_2017 ? 'true' : 'false'} onChange={e=>setForm(f=>({...f,chaudiere_remplacee_2017:e.target.value==='true'}))} className="py-3"><option value="false">Chaudière remplacée depuis 2017 : Non</option><option value="true">Chaudière remplacée depuis 2017 : Oui</option></Select>
          <Input placeholder="Hauteur sous plafond (m) — min 5m" type="number" value={form.hauteur_sous_plafond||''} onChange={e=>setForm(f=>({...f,hauteur_sous_plafond:e.target.value}))} className="py-3"/>
          <Input placeholder="Surface bâtiment (m²)" type="number" value={form.surface_batiment||''} onChange={e=>setForm(f=>({...f,surface_batiment:e.target.value}))} className="py-3"/>
        </div>;
        // ===== DESTRATIFICATEUR INDUSTRIEL (modal) =====
        if (pCode === 'destrat_industriel') return <div className="bg-slate-700/30 rounded-xl p-3 space-y-3">
          <p className="text-xs font-semibold text-indigo-400 uppercase tracking-wider">Destrat. industriel</p>
          <Select value={form.batiment_chauffe||''} onChange={e=>setForm(f=>({...f,batiment_chauffe:e.target.value}))} className="py-3"><option value="">Bâtiment chauffé ?</option><option value="oui_totalite">Oui, la totalité du site</option><option value="oui_partiellement">Oui, partiellement</option><option value="non">Non</option></Select>
          <Select value={form.type_chauffage||''} onChange={e=>setForm(f=>({...f,type_chauffage:e.target.value}))} className="py-3"><option value="">Mode de chauffage</option><option value="gaz">Chaudière à Gaz</option><option value="fuel">Chaudière à Fuel</option></Select>
          <Input placeholder="Puissance chauffage (kW) — min 400kW" type="number" value={form.puissance_chauffage||''} onChange={e=>setForm(f=>({...f,puissance_chauffage:e.target.value}))} className="py-3"/>
          <Select value={form.chaudiere_remplacee_2017 ? 'true' : 'false'} onChange={e=>setForm(f=>({...f,chaudiere_remplacee_2017:e.target.value==='true'}))} className="py-3"><option value="false">Chaudière remplacée depuis 2017 : Non</option><option value="true">Chaudière remplacée depuis 2017 : Oui</option></Select>
          <Input placeholder="Hauteur sous plafond (m) — min 5m" type="number" value={form.hauteur_sous_plafond||''} onChange={e=>setForm(f=>({...f,hauteur_sous_plafond:e.target.value}))} className="py-3"/>
          <Input placeholder="Surface bâtiment (m²)" type="number" value={form.surface_batiment||''} onChange={e=>setForm(f=>({...f,surface_batiment:e.target.value}))} className="py-3"/>
        </div>;
        // ===== HAUTE PRESSION FLOTTANTE (modal) =====
        if (pCode === 'haute_pression') return <div className="bg-slate-700/30 rounded-xl p-3 space-y-3">
          <p className="text-xs font-semibold text-pink-400 uppercase tracking-wider">Haute pression flottante</p>
          <Select value={form.gtb_gtc_installe ? 'true' : 'false'} onChange={e=>setForm(f=>({...f,gtb_gtc_installe:e.target.value==='true'}))} className="py-3"><option value="false">GTB / GTC installé : Non</option><option value="true">GTB / GTC installé : Oui</option></Select>
          <Select value={form.groupe_froid_existant ? 'true' : 'false'} onChange={e=>setForm(f=>({...f,groupe_froid_existant:e.target.value==='true'}))} className="py-3"><option value="false">Groupes froids : Non</option><option value="true">Groupes froids : Oui</option></Select>
          <Select value={form.groupe_ancien_neuf||''} onChange={e=>setForm(f=>({...f,groupe_ancien_neuf:e.target.value}))} className="py-3"><option value="">Groupe ancien ou neuf</option><option value="ancien">Ancien</option><option value="neuf">Neuf</option></Select>
          <Input placeholder="Surface groupe froid (m²) — min 15m²" type="number" value={form.surface_groupe_froid||''} onChange={e=>setForm(f=>({...f,surface_groupe_froid:e.target.value}))} className="py-3"/>
          <Input placeholder="Puissance électrique (kW) — min 50kW" type="number" value={form.puissance_electrique||''} onChange={e=>setForm(f=>({...f,puissance_electrique:e.target.value}))} className="py-3"/>
          <Input placeholder="Surface bloc de froid (m²)" type="number" value={form.surface_bloc_froid||''} onChange={e=>setForm(f=>({...f,surface_bloc_froid:e.target.value}))} className="py-3"/>
          <Input placeholder="Surface bâtiment (m²)" type="number" value={form.surface_batiment||''} onChange={e=>setForm(f=>({...f,surface_batiment:e.target.value}))} className="py-3"/>
        </div>;
        // ===== VMC SERRE AGRICOLE (modal) =====
        if (pCode === 'vmc_serre') return <div className="bg-slate-700/30 rounded-xl p-3 space-y-3">
          <p className="text-xs font-semibold text-orange-400 uppercase tracking-wider">VMC serre agricole</p>
          <Input placeholder="Surface serre (m²) — min 1 000m²" type="number" value={form.surface_serre||''} onChange={e=>setForm(f=>({...f,surface_serre:e.target.value}))} className="py-3"/>
          <Select value={form.serre_electrifiee ? 'true' : 'false'} onChange={e=>setForm(f=>({...f,serre_electrifiee:e.target.value==='true'}))} className="py-3"><option value="false">Serre électrifiée : Non</option><option value="true">Serre électrifiée : Oui</option></Select>
          <Select value={form.type_serre||''} onChange={e=>setForm(f=>({...f,type_serre:e.target.value}))} className="py-3"><option value="">Type de serre</option><option value="maraichere">Maraîchère</option><option value="horticole">Horticole</option></Select>
          <Select value={form.statut_occupation||''} onChange={e=>setForm(f=>({...f,statut_occupation:e.target.value}))} className="py-3"><option value="">Statut occupation</option><option value="proprietaire">Propriétaire</option><option value="locataire">Locataire</option></Select>
          <Input placeholder="Surface bâtiment (m²)" type="number" value={form.surface_batiment||''} onChange={e=>setForm(f=>({...f,surface_batiment:e.target.value}))} className="py-3"/>
        </div>;
        // ===== DÉSHUMIDIFICATEUR (modal) =====
        if (pCode === 'deshumidificateur') return <div className="bg-slate-700/30 rounded-xl p-3 space-y-3">
          <p className="text-xs font-semibold text-teal-400 uppercase tracking-wider">Déshumidificateur serre</p>
          <Input placeholder="Surface serre (m²) — min 1 000m²" type="number" value={form.surface_serre||''} onChange={e=>setForm(f=>({...f,surface_serre:e.target.value}))} className="py-3"/>
          <Select value={form.serre_electrifiee ? 'true' : 'false'} onChange={e=>setForm(f=>({...f,serre_electrifiee:e.target.value==='true'}))} className="py-3"><option value="false">Serre électrifiée : Non</option><option value="true">Serre électrifiée : Oui</option></Select>
          <Select value={form.type_serre||''} onChange={e=>setForm(f=>({...f,type_serre:e.target.value}))} className="py-3"><option value="">Type de serre</option><option value="maraichere">Maraîchère</option><option value="horticole">Horticole</option></Select>
          <Select value={form.statut_occupation||''} onChange={e=>setForm(f=>({...f,statut_occupation:e.target.value}))} className="py-3"><option value="">Statut occupation</option><option value="proprietaire">Propriétaire</option><option value="locataire">Locataire</option></Select>
          <Input placeholder="Surface bâtiment (m²)" type="number" value={form.surface_batiment||''} onChange={e=>setForm(f=>({...f,surface_batiment:e.target.value}))} className="py-3"/>
        </div>;
        return null;
      })()}
      {/* Champs communs */}
      <Select value={form.type_projet||''} onChange={e=>setForm(f=>({...f,type_projet:e.target.value}))} className="py-3"><option value="">Type de projet</option>{typeProjetOptions.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</Select>
      {form.type_projet === 'pro' && <Select value={form.type_cible||''} onChange={e=>setForm(f=>({...f,type_cible:e.target.value}))} className="py-3"><option value="">Type de cible</option>{typeCibleOptions.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</Select>}
      {form.type_projet === 'particulier' && <Select value={form.type_logement||''} onChange={e=>setForm(f=>({...f,type_logement:e.target.value}))} className="py-3"><option value="">Type de logement</option><option value="maison">Maison</option><option value="appartement">Appartement</option></Select>}
      {(() => { const selP = products.find(p => p.id === form.product_id); const pc = selP ? getProductCode({ product: selP }, products) : null; return !['destrat_tertiaire','destrat_industriel','haute_pression','vmc_serre','deshumidificateur'].includes(pc); })() && <Select value={form.type_chauffage||''} onChange={e=>setForm(f=>({...f,type_chauffage:e.target.value}))} className="py-3"><option value="">Type chauffage existant</option>{typeChauffageOptions.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</Select>}
      <Btn variant="primary" size="lg" className="w-full justify-center" type="submit" disabled={saving}>{saving?<><Loader2 className="w-4 h-4 animate-spin"/> Création...</>:'Créer le prospect'}</Btn>
    </form>
  </Modal>;
});

const ImportModal = memo(({ open, onClose, onImport, categories, statuses, products }) => {
  const [step, setStep] = useState(1); const [file, setFile] = useState(null); const [data, setData] = useState([]); const [headers, setHeaders] = useState([]); const [mappings, setMappings] = useState({}); const [productId, setProductId] = useState(''); const [catId, setCatId] = useState(''); const [statusId, setStatusId] = useState('');
  useEffect(() => { if(open) { setStep(1);setFile(null);setData([]);setHeaders([]);setMappings({});setProductId(products[0]?.id||'');setCatId(categories[0]?.id||'');setStatusId(statuses[0]?.id||''); } }, [open]);

  const fields = [{key:'nom',label:'Nom complet'},{key:'prenom',label:'Prénom'},{key:'nom_famille',label:'Nom de famille'},{key:'societe',label:'Entreprise'},{key:'siret',label:'SIRET'},{key:'tel',label:'Téléphone'},{key:'mail',label:'Email'},{key:'adresse',label:'Adresse'},{key:'cp',label:'Code postal'},{key:'ville',label:'Ville'},{key:'surface',label:'Surface'},{key:'nb_led',label:'Nb LED'}];

  const handleFile = e => { const f=e.target.files?.[0]; if(!f) return; setFile(f);
    const reader = new FileReader(); reader.onload = evt => {
      const text=evt.target?.result; const lines=text.split('\n').filter(l=>l.trim()); if(lines.length<2) return;
      const delim=text.includes(';')?';':','; const hdrs=lines[0].split(delim).map(h=>h.trim().replace(/"/g,'')); setHeaders(hdrs);
      const rows=lines.slice(1).map(line=>{const vals=line.split(delim).map(v=>v.trim().replace(/"/g,'')); const obj={}; hdrs.forEach((h,i)=>obj[h]=vals[i]||''); return obj; }); setData(rows);
      const aliases={nom:['nom','name','contact'],prenom:['prenom','prénom','firstname'],nom_famille:['nom_famille','lastname'],societe:['societe','société','entreprise','company','raison'],siret:['siret'],tel:['tel','telephone','téléphone','phone','mobile','portable'],mail:['mail','email'],adresse:['adresse','address','rue'],cp:['cp','code_postal','postal'],ville:['ville','city','commune'],surface:['surface','m2'],nb_led:['nb_led','led']};
      const autoMap={}; fields.forEach(f=>{const m=hdrs.find(h=>aliases[f.key]?.some(a=>h.toLowerCase().includes(a)));if(m)autoMap[f.key]=m;}); setMappings(autoMap); setStep(2);
    }; reader.readAsText(f);
  };

  return <Modal open={open} onClose={onClose} title="Import CSV" icon={Upload} size="lg"><div className="p-6">
    {step===1&&<label className="flex flex-col items-center justify-center w-full h-36 border-2 border-dashed border-slate-600 rounded-xl cursor-pointer hover:border-emerald-500"><Upload className="w-10 h-10 text-slate-500 mb-2"/><p className="text-slate-400 text-sm">Sélectionner un fichier CSV</p><input type="file" accept=".csv,.txt" className="hidden" onChange={handleFile}/></label>}
    {step===2&&<div className="space-y-4">
      <div className="bg-slate-700/30 rounded-xl p-3"><p className="text-white font-medium text-sm">{file?.name}</p><p className="text-xs text-slate-400">{data.length.toLocaleString('fr-FR')} lignes</p></div>
      <div className="grid grid-cols-2 gap-3 max-h-48 overflow-auto">{fields.map(f=><div key={f.key}><label className="text-xs text-slate-400">{f.label}</label><Select value={mappings[f.key]||''} onChange={e=>setMappings(m=>({...m,[f.key]:e.target.value}))} className="w-full mt-1 text-xs"><option value="">Ignorer</option>{headers.map(h=><option key={h} value={h}>{h}</option>)}</Select></div>)}</div>
      <div className="grid grid-cols-3 gap-3">
        <div><label className="text-xs text-slate-400">Produit</label><Select value={productId} onChange={e=>setProductId(e.target.value)} className="w-full mt-1 text-xs"><option value="">Aucun</option>{products.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</Select></div>
        <div><label className="text-xs text-slate-400">Secteur d'activité</label><Select value={catId} onChange={e=>setCatId(e.target.value)} className="w-full mt-1 text-xs"><option value="">Aucun</option>{categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</Select></div>
        <div><label className="text-xs text-slate-400">Statut</label><Select value={statusId} onChange={e=>setStatusId(e.target.value)} className="w-full mt-1 text-xs"><option value="">Aucun</option>{statuses.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</Select></div>
      </div>
      <div className="flex gap-3"><Btn onClick={()=>setStep(1)}>← Retour</Btn><Btn variant="primary" className="flex-1 justify-center" onClick={()=>onImport(data,mappings,catId,statusId,productId)} disabled={!mappings.nom&&!mappings.prenom&&!mappings.tel&&!mappings.societe}>Importer {data.length.toLocaleString('fr-FR')} fiches</Btn></div>
    </div>}
  </div></Modal>;
});

const BulkAssignModal = memo(({ open, onClose, users, count, onAssign }) => {
  const [sel, setSel] = useState([]); const [mode, setMode] = useState('add');
  useEffect(() => { if(open){setSel([]);setMode('add');} }, [open]);
  return <Modal open={open} onClose={onClose} title={`Attribuer ${count} prospects`} icon={UserCheck}><div className="p-6 space-y-4">
    <div className="flex gap-2"><Btn className="flex-1 justify-center" variant={mode==='add'?'primary':'default'} size="sm" onClick={()=>setMode('add')}>Ajouter</Btn><Btn className="flex-1 justify-center" variant={mode==='replace'?'primary':'default'} size="sm" onClick={()=>setMode('replace')}>Remplacer</Btn></div>
    <div className="space-y-2 max-h-60 overflow-auto">{users.filter(u=>u.role==='user').map(u=><label key={u.id} className="flex items-center gap-3 p-3 bg-slate-700/50 rounded-xl cursor-pointer hover:bg-slate-700"><input type="checkbox" checked={sel.includes(u.id)} onChange={e=>setSel(s=>e.target.checked?[...s,u.id]:s.filter(x=>x!==u.id))} className="rounded"/><span className="text-white text-sm">{u.first_name} {u.last_name}</span></label>)}</div>
    <Btn variant="primary" size="lg" className="w-full justify-center" onClick={()=>onAssign(sel,mode)} disabled={!sel.length}>Attribuer</Btn>
  </div></Modal>;
});

const BulkUnassignModal = memo(({ open, onClose, users, count, onUnassign }) => {
  const [sel, setSel] = useState([]); const [all, setAll] = useState(false);
  useEffect(() => { if(open){setSel([]);setAll(false);} }, [open]);
  return <Modal open={open} onClose={onClose} title={`Désattribuer ${count} prospects`} icon={UserMinus}><div className="p-6 space-y-4">
    <label className="flex items-center gap-3 p-3 bg-red-500/10 border border-red-500/30 rounded-xl cursor-pointer hover:bg-red-500/20">
      <input type="checkbox" checked={all} onChange={e=>{setAll(e.target.checked);if(e.target.checked)setSel([]);}} className="rounded"/>
      <span className="text-red-400 text-sm font-medium">Retirer tous les utilisateurs</span>
    </label>
    {!all && <div className="space-y-2 max-h-60 overflow-auto">{users.filter(u=>u.role==='user').map(u=><label key={u.id} className="flex items-center gap-3 p-3 bg-slate-700/50 rounded-xl cursor-pointer hover:bg-slate-700"><input type="checkbox" checked={sel.includes(u.id)} onChange={e=>setSel(s=>e.target.checked?[...s,u.id]:s.filter(x=>x!==u.id))} className="rounded"/><span className="text-white text-sm">{u.first_name} {u.last_name}</span></label>)}</div>}
    <Btn variant="danger" size="lg" className="w-full justify-center" onClick={()=>onUnassign(all?[]:sel)} disabled={!all&&!sel.length}>Désattribuer</Btn>
  </div></Modal>;
});

const UsersModal = memo(({ open, onClose, users, isAdmin, updateUserRole, deactivateUser, activateUser }) => (
  <Modal open={open} onClose={onClose} title="Utilisateurs" icon={Users} size="lg"><div className="p-6 space-y-3 max-h-[60vh] overflow-auto">
    {users.map(u=><div key={u.id} className={cn("flex items-center justify-between p-3 rounded-xl", u.active?"bg-slate-700/50":"bg-slate-700/20 opacity-60")}>
      <div className="flex items-center gap-3"><div className={cn("w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold", u.active?"bg-emerald-500":"bg-slate-600")}>{u.first_name?.[0]}</div><div><p className="text-white text-sm font-medium">{u.first_name} {u.last_name}</p><p className="text-xs text-slate-400">{u.email}</p></div></div>
      <div className="flex items-center gap-2">{isAdmin&&<Select value={u.role} onChange={e=>updateUserRole(u.id,e.target.value)} className="text-xs py-1"><option value="user">User</option><option value="fournisseur">Fournisseur</option><option value="admin">Admin</option></Select>}{isAdmin&&(u.active ? <Btn size="sm" variant="ghost" onClick={()=>{if(confirm(`Désactiver ${u.first_name} ?`)) deactivateUser(u.id);}}><XCircle className="w-4 h-4 text-red-400"/></Btn> : <Btn size="sm" variant="ghost" onClick={()=>activateUser(u.id)}><CheckCircle className="w-4 h-4 text-emerald-400"/></Btn>)}</div>
    </div>)}
  </div></Modal>
));

const RemindersModal = memo(({ open, onClose, reminders, completeReminder, deleteReminder, showAlert, onOpenProspect }) => {
  const [busy, setBusy] = useState(null);
  const pending=reminders.filter(r=>!r.completed); const overdue=pending.filter(r=>new Date(r.due_date)<new Date()); const upcoming=pending.filter(r=>new Date(r.due_date)>=new Date());
  const handleComplete = async (id) => { setBusy(id); try { await completeReminder(id); } catch(e) { showAlert?.('Erreur: '+e.message,'error'); } setBusy(null); };
  const handleDelete = async (id) => { setBusy(id); try { await deleteReminder(id); } catch(e) { showAlert?.('Erreur: '+e.message,'error'); } setBusy(null); };
  const handleOpen = (r) => { if (r.prospect?.id && onOpenProspect) { onClose(); onOpenProspect({ id: r.prospect.id, company_name: r.prospect.company_name, first_name: r.prospect.first_name, last_name: r.prospect.last_name }); } };
  const renderItem = (r, isOverdue) => {
    const isBusy = busy === r.id;
    const prospectName = r.prospect?.company_name || `${r.prospect?.first_name||''} ${r.prospect?.last_name||''}`.trim() || '—';
    return <div key={r.id} className={cn("flex items-center gap-3 p-3 rounded-xl transition-all duration-200", isOverdue?"bg-red-500/10 border border-red-500/30":"bg-slate-800", isBusy&&"opacity-40 pointer-events-none scale-[0.98]")}>
      <button disabled={isBusy} onClick={()=>handleComplete(r.id)} className={cn("w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all hover:scale-110", isOverdue?"border-red-500 hover:bg-red-500":"border-slate-500 hover:border-emerald-500 hover:bg-emerald-500")}>{isBusy&&<Loader2 className="w-3 h-3 text-white animate-spin"/>}</button>
      <div className="flex-1 min-w-0 cursor-pointer" onClick={()=>handleOpen(r)}>
        <p className="text-sm text-white hover:text-emerald-400 transition-colors">{r.message||'Rappel'}</p>
        <p className={cn("text-xs",isOverdue?"text-red-400":"text-slate-400")}>{formatDateTime(r.due_date)} • <span className="underline decoration-dotted">{prospectName}</span></p>
      </div>
      <button disabled={isBusy} onClick={()=>handleOpen(r)} className="p-1.5 hover:bg-slate-700 rounded-lg text-slate-500 hover:text-emerald-400 transition-colors" title="Ouvrir la fiche"><Eye className="w-3.5 h-3.5"/></button>
      <button disabled={isBusy} onClick={()=>handleDelete(r.id)} className={cn("p-1 hover:bg-red-500/20 rounded transition-colors disabled:opacity-30", isOverdue?"text-red-400":"text-slate-500 hover:text-red-400")}><Trash2 className="w-3.5 h-3.5"/></button>
    </div>;
  };
  return <Modal open={open} onClose={onClose} title={`Rappels (${pending.length}${overdue.length?' • '+overdue.length+' en retard':''})`} icon={Bell} size="lg"><div className="p-6 space-y-4 max-h-[60vh] overflow-auto">
    {overdue.length>0&&<div><h3 className="text-xs font-semibold text-red-400 uppercase mb-2 flex items-center gap-1"><BellRing className="w-3 h-3 animate-pulse"/> En retard ({overdue.length})</h3><div className="space-y-2">{overdue.map(r=>renderItem(r, true))}</div></div>}
    {upcoming.length>0&&<div><h3 className="text-xs font-semibold text-slate-400 uppercase mb-2 flex items-center gap-1"><Clock className="w-3 h-3"/> À venir ({upcoming.length})</h3><div className="space-y-2">{upcoming.map(r=>renderItem(r, false))}</div></div>}
    {pending.length===0&&<p className="text-center text-slate-500 py-8 text-sm">Aucun rappel en attente 🎉</p>}
  </div></Modal>;
});

const SettingsModal = memo(({ open, onClose, installers, categories, statuses, products, sources, users, addInstaller, updateInstaller, deleteInstaller, addCategory, updateCategory, deleteCategory, addStatus, updateStatus, deleteStatus, addProduct, updateProduct, deleteProduct, addSource, updateSource, deleteSource }) => {
  const [tab, setTab] = useState('installers');
  const [instF, setInstF] = useState({name:'',zone:'',phone:''}); const [catF, setCatF] = useState({name:'',color:'#6B7280'}); const [statF, setStatF] = useState({name:'',color:'#6B7280',is_final:false}); const [prodF, setProdF] = useState({name:'',color:'#6B7280'}); const [srcF, setSrcF] = useState({name:'',color:'#6B7280'});
  const [err, setErr] = useState(''); const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState(null); const [editData, setEditData] = useState({});

  const run = async (fn, ...args) => { setErr(''); setSaving(true); try { await fn(...args); setSaving(false); return true; } catch(e) { setErr(e.message||'Erreur'); import.meta.env.DEV&&console.warn('Settings error:', e); setSaving(false); return false; } };

  const startEdit = (item, fields) => { setEditId(item.id); const d = {}; fields.forEach(f => d[f] = item[f]); setEditData(d); };
  const cancelEdit = () => { setEditId(null); setEditData({}); };
  const saveEdit = async (updateFn, id) => { if (await run(updateFn, id, editData)) cancelEdit(); };

  // Render function (NOT component) — prevents unmount/remount flicker when editing
  const renderSList = (items, onDelete, onUpdate, renderItem, editFields) => <div className="space-y-1.5 max-h-56 overflow-auto">{items.map(item=><div key={item.id} className="flex items-center justify-between p-2.5 bg-slate-700/50 rounded-lg gap-2">
    {editId === item.id ? (
      <div className="flex items-center gap-2 flex-1 flex-wrap">{editFields.map(f =>
        f.type === 'color' ? <input key={f.key} type="color" value={editData[f.key]||'#6B7280'} onChange={e=>setEditData(d=>({...d,[f.key]:e.target.value}))} className="w-8 h-7 bg-slate-600 border border-slate-500 rounded cursor-pointer"/>
        : f.type === 'checkbox' ? <label key={f.key} className="flex items-center gap-1 text-xs text-slate-300"><input type="checkbox" checked={editData[f.key]||false} onChange={e=>setEditData(d=>({...d,[f.key]:e.target.checked}))}/>{f.label}</label>
        : <Input key={f.key} value={editData[f.key]||''} onChange={e=>setEditData(d=>({...d,[f.key]:e.target.value}))} placeholder={f.label} className="flex-1 min-w-[80px] text-xs py-1"/>
      )}
        <Btn size="sm" variant="primary" onClick={()=>saveEdit(onUpdate, item.id)} disabled={saving}><Check className="w-3 h-3"/></Btn>
        <Btn size="sm" variant="ghost" onClick={cancelEdit}><X className="w-3 h-3"/></Btn>
      </div>
    ) : (
      <>{renderItem(item)}<div className="flex items-center gap-1 flex-shrink-0">
        <button onClick={()=>startEdit(item, editFields.map(f=>f.key))} className="p-1 hover:bg-slate-600 rounded text-slate-400 hover:text-emerald-400"><Edit className="w-3.5 h-3.5"/></button>
        <button onClick={()=>{if(confirm('Supprimer ?')) run(onDelete, item.id);}} className="p-1 hover:bg-red-500/20 rounded text-red-400"><Trash2 className="w-3.5 h-3.5"/></button>
      </div></>
    )}
  </div>)}</div>;

  const instEditFields = [{key:'name',label:'Nom',type:'text'},{key:'zone',label:'Zone',type:'text'},{key:'phone',label:'Tél',type:'text'}];
  const catEditFields = [{key:'name',label:'Nom',type:'text'},{key:'color',label:'Couleur',type:'color'}];
  const statEditFields = [{key:'name',label:'Nom',type:'text'},{key:'color',label:'Couleur',type:'color'},{key:'is_final',label:'Final',type:'checkbox'}];
  // Nom produit NON modifiable depuis l'UI — seule la couleur peut être changée.
  // La détection du type produit (ITI/PAC/LED) dépend du nom (getProductCode), donc changer un nom
  // casse toute la logique métier. Pour renommer un produit, modifier getProductCode() dans le code.
  const prodEditFields = [{key:'color',label:'Couleur',type:'color'}];
  const srcEditFields = [{key:'name',label:'Nom',type:'text'},{key:'color',label:'Couleur',type:'color'}];

  return <Modal open={open} onClose={onClose} title="Paramètres" icon={Settings} size="lg">
    <div className="flex border-b border-slate-700 overflow-x-auto">{[['installers','Installateurs'],['categories','Secteurs'],['statuses','Statuts'],['products','Produits'],['sources','Provenances']].map(([t,l])=><button key={t} onClick={()=>{setTab(t);setErr('');cancelEdit();}} className={cn("flex-1 py-3 text-xs font-medium whitespace-nowrap px-2", tab===t?"text-emerald-400 border-b-2 border-emerald-500":"text-slate-400 hover:text-white")}>{l}</button>)}</div>
    <div className="p-6">
      {err&&<div className="mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-400 text-sm flex items-center gap-2"><AlertCircle className="w-4 h-4 flex-shrink-0"/>{err}</div>}
      {tab==='installers'&&<div className="space-y-3">
        <div className="flex gap-2"><Input placeholder="Nom *" value={instF.name} onChange={e=>setInstF(f=>({...f,name:e.target.value}))} className="flex-1"/><Input placeholder="Zone" value={instF.zone} onChange={e=>setInstF(f=>({...f,zone:e.target.value}))} className="w-28"/><Input placeholder="Tél" value={instF.phone} onChange={e=>setInstF(f=>({...f,phone:e.target.value}))} className="w-28"/><Btn variant="primary" size="sm" disabled={saving||!instF.name} onClick={async()=>{if(await run(addInstaller,instF))setInstF({name:'',zone:'',phone:''});}}>{saving?<Loader2 className="w-3.5 h-3.5 animate-spin"/>:'+'}</Btn></div>
        {renderSList(installers, deleteInstaller, updateInstaller, i=><div className="flex-1 min-w-0"><span className="text-white text-sm font-medium">{i.name}</span>{i.zone&&<span className="text-slate-400 text-xs ml-2">({i.zone})</span>}{i.phone&&<span className="text-slate-500 text-xs ml-2">{i.phone}</span>}</div>, instEditFields)}
      </div>}
      {tab==='categories'&&<div className="space-y-3">
        <div className="flex gap-2"><Input placeholder="Nom *" value={catF.name} onChange={e=>setCatF(f=>({...f,name:e.target.value}))} className="flex-1"/><input type="color" value={catF.color} onChange={e=>setCatF(f=>({...f,color:e.target.value}))} className="w-10 h-9 bg-slate-700 border border-slate-600 rounded-lg cursor-pointer"/><Btn variant="primary" size="sm" disabled={saving||!catF.name} onClick={async()=>{if(await run(addCategory,catF))setCatF({name:'',color:'#6B7280'});}}>{saving?<Loader2 className="w-3.5 h-3.5 animate-spin"/>:'+'}</Btn></div>
        {renderSList(categories, deleteCategory, updateCategory, c=><div className="flex items-center gap-2 flex-1 min-w-0"><span className="w-3 h-3 rounded-full flex-shrink-0" style={{backgroundColor:c.color}}/><span className="text-white text-sm font-medium">{c.name}</span></div>, catEditFields)}
      </div>}
      {tab==='statuses'&&<div className="space-y-3">
        <div className="flex gap-2 items-center"><Input placeholder="Nom *" value={statF.name} onChange={e=>setStatF(f=>({...f,name:e.target.value}))} className="flex-1"/><input type="color" value={statF.color} onChange={e=>setStatF(f=>({...f,color:e.target.value}))} className="w-10 h-9 bg-slate-700 border border-slate-600 rounded-lg cursor-pointer"/><label className="flex items-center gap-1.5 text-slate-300 text-xs whitespace-nowrap"><input type="checkbox" checked={statF.is_final} onChange={e=>setStatF(f=>({...f,is_final:e.target.checked}))}/> Final</label><Btn variant="primary" size="sm" disabled={saving||!statF.name} onClick={async()=>{if(await run(addStatus,statF))setStatF({name:'',color:'#6B7280',is_final:false});}}>{saving?<Loader2 className="w-3.5 h-3.5 animate-spin"/>:'+'}</Btn></div>
        {renderSList(statuses, deleteStatus, updateStatus, s=><div className="flex items-center gap-2 flex-1 min-w-0"><span className="w-3 h-3 rounded-full flex-shrink-0" style={{backgroundColor:s.color}}/><span className="text-white text-sm font-medium">{s.name}</span>{s.is_final&&<Badge color="#EF4444" small>Final</Badge>}</div>, statEditFields)}
      </div>}
      {tab==='products'&&<div className="space-y-3">
        <div className="p-2.5 bg-amber-500/10 border border-amber-500/30 rounded-lg text-xs text-amber-300 flex items-start gap-2"><AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5"/><span>Le <b>nom</b> d'un produit ne peut pas être modifié depuis l'interface (la détection ITI/PAC/LED dépend du nom). Pour renommer, contactez le développeur.</span></div>
        <div className="flex gap-2"><Input placeholder="Nom *" value={prodF.name} onChange={e=>setProdF(f=>({...f,name:e.target.value}))} className="flex-1"/><input type="color" value={prodF.color} onChange={e=>setProdF(f=>({...f,color:e.target.value}))} className="w-10 h-9 bg-slate-700 border border-slate-600 rounded-lg cursor-pointer"/><Btn variant="primary" size="sm" disabled={saving||!prodF.name} onClick={async()=>{if(await run(addProduct,prodF))setProdF({name:'',color:'#6B7280'});}}>{saving?<Loader2 className="w-3.5 h-3.5 animate-spin"/>:'+'}</Btn></div>
        {renderSList(products, deleteProduct, updateProduct, p=><div className="flex items-center gap-2 flex-1 min-w-0"><span className="w-3 h-3 rounded-full flex-shrink-0" style={{backgroundColor:p.color}}/><span className="text-white text-sm font-medium">{p.name}</span><Lock className="w-3 h-3 text-slate-500" title="Nom verrouillé"/></div>, prodEditFields)}
      </div>}
      {tab==='sources'&&<div className="space-y-3">
        <div className="flex gap-2"><Input placeholder="Nom * (ex: Campagne Meta, Call Maroc...)" value={srcF.name} onChange={e=>setSrcF(f=>({...f,name:e.target.value}))} className="flex-1"/><input type="color" value={srcF.color} onChange={e=>setSrcF(f=>({...f,color:e.target.value}))} className="w-10 h-9 bg-slate-700 border border-slate-600 rounded-lg cursor-pointer"/><Btn variant="primary" size="sm" disabled={saving||!srcF.name} onClick={async()=>{if(await run(addSource,srcF))setSrcF({name:'',color:'#6B7280'});}}>{saving?<Loader2 className="w-3.5 h-3.5 animate-spin"/>:'+'}</Btn></div>
        <div className="space-y-1.5 max-h-64 overflow-auto">{(sources||[]).map(s=><div key={s.id} className="flex items-center justify-between p-2.5 bg-slate-700/50 rounded-lg gap-2">
          {editId===s.id ? <div className="flex items-center gap-2 flex-1"><Input value={editData.name||''} onChange={e=>setEditData(d=>({...d,name:e.target.value}))} className="flex-1 text-sm"/><input type="color" value={editData.color||'#6B7280'} onChange={e=>setEditData(d=>({...d,color:e.target.value}))} className="w-8 h-8 bg-slate-700 border border-slate-600 rounded cursor-pointer"/><Btn size="sm" variant="primary" onClick={async()=>{await run(updateSource,s.id,editData);cancelEdit();}}>✓</Btn><Btn size="sm" variant="ghost" onClick={cancelEdit}>✕</Btn></div> : <>
            <div className="flex items-center gap-2 flex-1 min-w-0"><span className="w-3 h-3 rounded-full flex-shrink-0" style={{backgroundColor:s.color}}/><span className="text-white text-sm font-medium">{s.name}</span></div>
            <Select value={s.linked_user_id||''} onChange={async e=>{const v=e.target.value||null;setSaving(true);try{await updateSource(s.id,{linked_user_id:v});}finally{setSaving(false);}}} className="text-[11px] py-1 max-w-[140px]">
              <option value="">Aucun lié</option>
              {(users||[]).filter(u=>u.role!=='admin').map(u=><option key={u.id} value={u.id}>{u.first_name} {u.last_name}{u.role==='fournisseur'?' (fournisseur)':''}</option>)}
            </Select>
            <div className="flex items-center gap-0.5">
              <button onClick={()=>{setEditId(s.id);setEditData({name:s.name,color:s.color});}} className="p-1 hover:bg-slate-600 rounded text-slate-400"><Edit className="w-3.5 h-3.5"/></button>
              <button disabled={saving} onClick={async()=>{if(confirm(`Supprimer "${s.name}" ?`)){setSaving(true);try{await deleteSource(s.id);}finally{setSaving(false);}}}} className="p-1 hover:bg-red-500/20 rounded text-slate-500 hover:text-red-400"><Trash2 className="w-3.5 h-3.5"/></button>
            </div>
          </>}
        </div>)}</div>
      </div>}
    </div>
  </Modal>;
});

// =====================================================
// APP ENTRY
// =====================================================
export default function App() {
  const { user, loading, authError } = useAuth();
  const [theme, setTheme] = useState(() => localStorage.getItem('crm-theme') || 'dark');
  useEffect(() => { document.documentElement.setAttribute('data-theme', theme); localStorage.setItem('crm-theme', theme); }, [theme]);
  const toggleTheme = useCallback(() => setTheme(t => t === 'dark' ? 'light' : 'dark'), []);

  // Track login
  const loggedRef = useRef(false);
  useEffect(() => {
    if (user && !loggedRef.current) { loggedRef.current = true; logEnhanced('login', null, { ctx: { ua: navigator.userAgent?.slice(0,100) } }); }
    if (!user) loggedRef.current = false;
  }, [user]);

  const ThemeBtn = <button onClick={toggleTheme} className="p-2 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition-colors" title={theme==='dark'?'Mode clair':'Mode sombre'}>{theme==='dark'?<Sun className="w-4 h-4"/>:<Moon className="w-4 h-4"/>}</button>;

  if (loading) return <Loading/>;
  if (authError && !user) return <div className="flex items-center justify-center h-screen bg-slate-900"><div className="text-center max-w-md p-8">
    <Logo size={56}/><h2 className="text-xl font-bold text-white mt-6 mb-2">Erreur de connexion</h2>
    <p className="text-slate-400 text-sm mb-4">{authError}</p>
    <p className="text-slate-500 text-xs">Vérifiez que Supabase est correctement configuré et que les variables d'environnement sont définies.</p>
    <Btn variant="primary" className="mt-6" onClick={()=>window.location.reload()}>Réessayer</Btn>
  </div></div>;
  if (!user) return <LoginPage/>;
  return <MainApp themeBtn={ThemeBtn}/>;
}

export function AppWrapper() { return <AuthProvider><App/></AuthProvider>; }