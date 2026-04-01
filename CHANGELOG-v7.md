# GALLUBIX CRM v7 — Changelog

## Nouvelles fonctionnalités

### 1. Calendrier des Rappels (distinct du planning poses)
- Onglet **Poses** / **Rappels** dans le Planning
- Vue calendrier et vue liste pour les rappels
- Badge compteur des rappels en retard

### 2. Colonnes supplémentaires dans la liste principale
- **Installateur** : nom de l'installateur assigné directement visible
- **Rappel** : date et heure du prochain rappel avec indicateur retard (rouge)

### 3. Closer (qui a shooté le client)
- Menu déroulant dans la fiche pour sélectionner qui a fermé/shooté le client
- Différent de l'attribution — c'est le commercial qui a converti le prospect
- Badge visible dans l'en-tête de la fiche

### 4. Matériel installé
- Menu déroulant : **LED Cloche** / **LED Réglette**
- Badge visible dans l'en-tête de la fiche

### 5. Nb LED réel installé
- Champ séparé du nb LED prévu pour tracker le réel

### 6. Installation ou Livraison
- Menu déroulant : **Installation** / **Livraison**
- Utilisé dans le calcul automatique du devis

### 7. Secteur d'activité
- Menu déroulant : **Commerce** / **Agriculture** / **Animaux**
- Utilisé dans le calcul automatique du devis

### 8. Calcul automatique du devis
Bouton **€ Auto** qui calcule le montant du devis selon la grille :

| Installateur | Matériel | Mode | Secteur | Prix/LED |
|---|---|---|---|---|
| Verlaine | LED Cloche | Installation | Animaux | 5€ |
| Verlaine | LED Cloche | Installation | Commerce/Agri | 15€ |
| Enerlia | LED Cloche | Installation | Commerce/Agri | 15€ |
| Enerlia | LED Réglette | Installation | Commerce/Agri | 10€ |
| Enerlia | LED Cloche | Livraison | Commerce/Agri | 18€ |
| BTS | LED Cloche | Installation | Commerce/Agri | 12€ |
| NEO | LED Cloche | Installation | Commerce | 20€ |
| NEO | LED Cloche | Installation | Agri | 5€ |

**Formule** : `Prix/LED × Nb LED`

### 9. Carte 3D
- Toggle **2D/3D** sur la carte principale
- Vue satellite avec inclinaison (pitch) et rotation
- Navigation 3D complète (Ctrl+drag pour incliner)
- MapLibre GL chargé dynamiquement via CDN

---

## 🚀 Installation

### 1. Migration SQL (Supabase SQL Editor)
Exécuter le fichier `database-migration-v7.sql` dans votre Supabase SQL Editor.

> ⚠️ **AUCUNE DONNÉE N'EST MODIFIÉE OU SUPPRIMÉE** — on ajoute uniquement 5 nouvelles colonnes et met à jour la RPC search_prospects.

### 2. Déployer le frontend
Remplacer les fichiers `src/App.jsx` et `src/hooks/useData.js` puis :
```bash
npm install
npm run build
```

---

## Structure des nouvelles colonnes SQL

| Colonne | Type | Description |
|---|---|---|
| `closer_id` | UUID → profiles | Qui a shooté/fermé le client |
| `type_led` | TEXT ('led_cloche'/'led_reglette') | Matériel installé |
| `nb_led_reel` | INT | Nombre réel de LED installées |
| `mode_pose` | TEXT ('installation'/'livraison') | Mode de pose |
| `secteur` | TEXT ('commerce'/'agriculture'/'animaux') | Secteur d'activité du client |
