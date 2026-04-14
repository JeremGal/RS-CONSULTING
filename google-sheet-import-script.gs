/**
 * ============================================
 *  RS CONSULTING CRM — Import Direct Meta Leads
 * ============================================
 *
 *  Un clic = les nouveaux leads Meta dans le CRM
 *  - Produit : vide (à définir manuellement dans le CRM)
 *  - Statut : Nouveau
 *  - Type : Prospect (automatique)
 *  - Accès : Admins uniquement (pas d'assignation auto)
 *  - Date de réception, type de chauffage, surface, logement → notes_admin
 *
 *  Colonnes du Google Sheet :
 *  A = nom
 *  B = prénom
 *  C = numéro de téléphone
 *  D = email
 *  E = date de réception          (→ notes_admin)
 *  F = type de chauffage          (→ notes_admin)
 *  G = surface                    (→ notes_admin)
 *  H = statut d'envoi CRM (coché automatiquement ✅)
 *  I = type de logement (maison/appartement) (→ notes_admin)
 *
 * ============================================
 */
const NOM_FEUILLE = "LEAD JSR";
const SUPABASE_URL = "https://ytictibhedmaiveocfkw.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl0aWN0aWJoZWRtYWl2ZW9jZmt3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDU5NTgxNiwiZXhwIjoyMDg2MTcxODE2fQ._aPlRV4XtqQM02Fuq_ZNxDETvkGnoQm0bYLcSmO_EHI";

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("🚀 CRM")
    .addItem("🚀 Envoyer les NOUVEAUX leads au CRM", "envoyerNouveaux")
    .addItem("🚀 Envoyer TOUS les leads au CRM", "envoyerTous")
    .addSeparator()
    .addItem("📋 Aperçu (10 derniers)", "apercu")
    .addItem("🔧 Formater téléphones (33→0)", "formaterTelephones")
    .addItem("🔧 Ajouter en-tête", "ajouterEntete")
    .addSeparator()
    .addItem("⚙️ Configurer", "configurer")
    .addToUi();
}

function formaterTel(tel) {
  if (!tel) return null;
  var t = String(tel).replace(/[\s.\-()]/g, "").trim();
  if (t.match(/^33[1-9]/)) t = "0" + t.substring(2);
  if (t.match(/^\+33/)) t = "0" + t.substring(3);
  return t || null;
}

function formaterDate(val) {
  if (!val) return "";
  if (val instanceof Date) {
    var d = val;
    var pad = function(n) { return String(n).padStart(2, "0"); };
    return pad(d.getDate()) + "/" + pad(d.getMonth() + 1) + "/" + d.getFullYear();
  }
  return String(val).trim();
}

function supabaseRequest(endpoint, method, data) {
  var options = {
    method: method || "GET",
    headers: {
      "apikey": SUPABASE_KEY,
      "Authorization": "Bearer " + SUPABASE_KEY,
      "Content-Type": "application/json",
      "Prefer": "return=representation"
    },
    muteHttpExceptions: true
  };
  if (data) options.payload = JSON.stringify(data);
  var response = UrlFetchApp.fetch(SUPABASE_URL + "/rest/v1/" + endpoint, options);
  var code = response.getResponseCode();
  var body = response.getContentText();
  if (code >= 400) throw new Error("Erreur " + code + ": " + body);
  return body ? JSON.parse(body) : null;
}

function getDefaults() {
  var props = PropertiesService.getScriptProperties();
  var statusId = props.getProperty("STATUS_ID");
  try {
    if (!statusId) {
      var statuses = supabaseRequest("statuses?select=id,name&order=position", "GET");
      var s = statuses.find(function(s) { return s.name.toLowerCase() === "nouveau"; });
      if (!s) s = statuses.find(function(s) { return s.name.toLowerCase().indexOf("nouveau") > -1; });
      if (s) { statusId = s.id; props.setProperty("STATUS_ID", statusId); }
    }
  } catch(e) { Logger.log("Auto-detect failed: " + e.message); }
  // Produit laissé vide volontairement — à définir manuellement dans le CRM
  return { statusId: statusId, productId: null };
}

function getDonnees() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(NOM_FEUILLE);
  if (!sheet) { SpreadsheetApp.getUi().alert("❌ Feuille '" + NOM_FEUILLE + "' introuvable !"); return null; }
  var lastRow = sheet.getLastRow();
  if (lastRow < 1) { SpreadsheetApp.getUi().alert("Feuille vide."); return null; }
  var firstCell = String(sheet.getRange(1, 1).getValue()).toLowerCase().trim();
  var startRow = 1;
  if (["nom", "name", "prenom", "prénom", "contact"].some(function(h) { return firstCell.indexOf(h) > -1; })) startRow = 2;
  if (startRow > lastRow) { SpreadsheetApp.getUi().alert("Aucune donnée."); return null; }
  // On lit jusqu'à la colonne I (9), la colonne H (8) = marqueur ✅ (ignorée par ligneVersProspect)
  var lastCol = Math.min(Math.max(sheet.getLastColumn(), 9), 9);
  var data = sheet.getRange(startRow, 1, lastRow - startRow + 1, lastCol).getValues();
  data = data.filter(function(row) { return row.some(function(cell) { return String(cell).trim() !== ""; }); });
  return { sheet: sheet, data: data, startRow: startRow };
}

function ligneVersProspect(row, defaults) {
  // Colonnes :
  // A = nom, B = prénom, C = tel, D = email,
  // E = date réception, F = type chauffage, G = surface,
  // H = marqueur CRM (ignoré), I = type logement
  var nom = String(row[0] || "").trim();
  var prenom = String(row[1] || "").trim();
  var tel = formaterTel(row[2]);
  var email = String(row[3] || "").trim();
  var dateReception = formaterDate(row[4]);
  var typeChauffage = String(row[5] || "").replace(/_/g, " ").trim();
  var surface = String(row[6] || "").replace(/_/g, " ").trim();
  // row[7] = colonne H = marqueur ✅, ignoré
  var typeLogement = String(row[8] || "").replace(/_/g, " ").trim();

  // Construction notes_admin avec labels clairs
  var notesParts = [];
  if (dateReception) notesParts.push("📅 Reçu : " + dateReception);
  if (typeChauffage) notesParts.push("🔥 Chauffage : " + typeChauffage);
  if (surface) notesParts.push("📐 Surface : " + surface);
  if (typeLogement) notesParts.push("🏠 Logement : " + typeLogement);
  var notesAdmin = notesParts.join(" | ");

  var prospect = {
    first_name: prenom || null,
    last_name: nom || null,
    email: email || null,
    phone: tel,
    notes_admin: notesAdmin || null,
    source: "Meta Ads",
    is_client: false
  };
  if (defaults.statusId) prospect.status_id = defaults.statusId;
  if (defaults.productId) prospect.product_id = defaults.productId;
  Object.keys(prospect).forEach(function(k) {
    if (prospect[k] === null || prospect[k] === undefined || prospect[k] === "") delete prospect[k];
  });
  return prospect;
}

function envoyerNouveaux() {
  var result = getDonnees();
  if (!result) return;
  var sheet = result.sheet, startRow = result.startRow, data = result.data;
  var colH;
  try { colH = sheet.getRange(startRow, 8, data.length, 1).getValues(); }
  catch(e) { colH = data.map(function() { return [""]; }); }
  var nouveaux = [], indexNouveaux = [];
  data.forEach(function(row, i) {
    if (String(colH[i][0]).trim() !== "✅") { nouveaux.push(row); indexNouveaux.push(i); }
  });
  if (nouveaux.length === 0) {
    SpreadsheetApp.getUi().alert("✅ Tous les leads sont déjà dans le CRM !");
    return;
  }
  var ui = SpreadsheetApp.getUi();
  var confirm = ui.alert("🚀 Envoyer " + nouveaux.length + " leads au CRM ?",
    "Produit : (à définir)\nStatut : Nouveau\nType : Prospect\n\n" +
    nouveaux.slice(0, 5).map(function(r) {
      var prenom = String(r[1] || "").trim();
      var nom = String(r[0] || "").trim();
      return "• " + (prenom + " " + nom).trim() + " — " + (r[3] || r[2] || "");
    }).join("\n") +
    (nouveaux.length > 5 ? "\n... et " + (nouveaux.length - 5) + " autres" : ""),
    ui.ButtonSet.YES_NO);
  if (confirm !== ui.Button.YES) return;
  var defaults = getDefaults();
  var success = 0, erreurs = [];
  for (var b = 0; b < nouveaux.length; b += 50) {
    var batch = nouveaux.slice(b, b + 50);
    var prospects = batch.map(function(row) { return ligneVersProspect(row, defaults); });
    try {
      supabaseRequest("prospects", "POST", prospects);
      success += batch.length;
      for (var j = 0; j < batch.length; j++) sheet.getRange(startRow + indexNouveaux[b + j], 8).setValue("✅");
    } catch(e) {
      batch.forEach(function(row, j) {
        try {
          supabaseRequest("prospects", "POST", [ligneVersProspect(row, defaults)]);
          success++;
          sheet.getRange(startRow + indexNouveaux[b + j], 8).setValue("✅");
        } catch(e2) {
          var label = String(row[1] || "") + " " + String(row[0] || "");
          erreurs.push(label.trim() + ": " + e2.message);
        }
      });
    }
  }
  var msg = "✅ " + success + " leads envoyés au CRM !\n\n📦 Produit : à définir manuellement\n📌 Statut : Nouveau\n👤 Type : Prospect\n🔒 Visibles uniquement par les admins";
  if (erreurs.length > 0) msg += "\n\n⚠️ " + erreurs.length + " erreurs :\n" + erreurs.slice(0, 10).join("\n");
  msg += "\n\n🔄 Rafraîchis le CRM pour les voir.";
  ui.alert(msg);
}

function envoyerTous() {
  var result = getDonnees();
  if (!result) return;
  var ui = SpreadsheetApp.getUi();
  var confirm = ui.alert("⚠️ Envoyer les " + result.data.length + " leads ?",
    "ATTENTION : Peut créer des doublons.\nUtilise plutôt 'Envoyer les NOUVEAUX'.", ui.ButtonSet.YES_NO);
  if (confirm !== ui.Button.YES) return;
  var defaults = getDefaults();
  var success = 0, erreurs = [], sheet = result.sheet, startRow = result.startRow;
  for (var b = 0; b < result.data.length; b += 50) {
    var batch = result.data.slice(b, b + 50);
    var prospects = batch.map(function(row) { return ligneVersProspect(row, defaults); });
    try {
      supabaseRequest("prospects", "POST", prospects);
      success += batch.length;
      for (var j = 0; j < batch.length; j++) sheet.getRange(startRow + b + j, 8).setValue("✅");
    } catch(e) {
      batch.forEach(function(row, j) {
        try {
          supabaseRequest("prospects", "POST", [ligneVersProspect(row, defaults)]);
          success++;
          sheet.getRange(startRow + b + j, 8).setValue("✅");
        } catch(e2) {
          var label = String(row[1] || "") + " " + String(row[0] || "");
          erreurs.push(label.trim() + ": " + e2.message);
        }
      });
    }
  }
  var msg = "✅ " + success + " leads envoyés !";
  if (erreurs.length > 0) msg += "\n\n⚠️ " + erreurs.length + " erreurs :\n" + erreurs.slice(0, 10).join("\n");
  ui.alert(msg);
}

function apercu() {
  var result = getDonnees();
  if (!result) return;
  var derniers = result.data.slice(-10);
  var txt = "📋 APERÇU\n==========\n\n";
  derniers.forEach(function(row, i) {
    var prenom = String(row[1] || "").trim();
    var nom = String(row[0] || "").trim();
    var tel = formaterTel(row[2]) || "-";
    var email = String(row[3] || "").trim() || "-";
    txt += (i+1) + ". " + prenom + " " + nom + "  📞 " + tel + "  📧 " + email + "\n";
  });
  txt += "\nTotal : " + result.data.length;
  SpreadsheetApp.getUi().alert(txt);
}

function formaterTelephones() {
  var result = getDonnees();
  if (!result) return;
  var count = 0;
  result.data.forEach(function(row, i) {
    var tel = String(row[2] || "").trim();
    var f = formaterTel(tel);
    if (f && f !== tel) { result.sheet.getRange(result.startRow + i, 3).setNumberFormat("@").setValue(f); count++; }
  });
  SpreadsheetApp.getUi().alert("✅ " + count + " numéros formatés.");
}

function ajouterEntete() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(NOM_FEUILLE);
  if (!sheet) { SpreadsheetApp.getUi().alert("❌ Feuille introuvable !"); return; }
  var f = String(sheet.getRange(1,1).getValue()).toLowerCase().trim();
  if (["nom","name","prenom"].some(function(h){return f.indexOf(h)>-1;})) { SpreadsheetApp.getUi().alert("ℹ️ En-tête déjà présent."); return; }
  sheet.insertRowBefore(1);
  var h = ["nom","prenom","tel","email","date_reception","type_chauffage","surface","CRM","type_logement"];
  sheet.getRange(1,1,1,h.length).setValues([h]).setFontWeight("bold").setBackground("#E8F5E9");
  SpreadsheetApp.getUi().alert("✅ En-tête ajouté !");
}

function configurer() {
  PropertiesService.getScriptProperties().deleteAllProperties();
  var d = getDefaults();
  SpreadsheetApp.getUi().alert("⚙️ Configuration",
    "Auto-détecté :\n\nStatut : " + (d.statusId ? "Nouveau ✅" : "❌ Crée un statut 'Nouveau' dans le CRM") +
    "\nProduit : laissé vide (à définir dans le CRM)\nType : Prospect (automatique ✅)",
    SpreadsheetApp.getUi().ButtonSet.OK);
}
