import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Alert, Linking } from 'react-native';

import { MODES, type Locataire, type Paiement, type Profil } from '@/db/queries';
import { formatDate, formatGNF, libelleMois } from '@/lib/format';

/** Normalise un numéro guinéen pour WhatsApp (ex. "620 00 00 00" -> "224620000000"). */
function numeroWhatsApp(tel: string) {
  let n = tel.replace(/\D/g, '');
  if (n.startsWith('00')) n = n.slice(2);
  if (n.length === 9) n = `224${n}`;
  return n;
}

export async function relancerWhatsApp(opts: {
  telephone: string | null;
  nom: string;
  mois: string;
  reste: number;
  proprietaire?: string;
}) {
  if (!opts.telephone) {
    Alert.alert('Pas de numéro', "Ajoutez un numéro de téléphone à ce locataire pour le relancer.");
    return;
  }
  const signature = opts.proprietaire ? `\n\n${opts.proprietaire}` : '';
  const message =
    `Bonjour ${opts.nom},\n\nPetit rappel : le loyer de ${libelleMois(opts.mois)} ` +
    `reste à régler (${formatGNF(opts.reste)}).\nMerci de faire le nécessaire dès que possible.${signature}`;
  const url = `https://wa.me/${numeroWhatsApp(opts.telephone)}?text=${encodeURIComponent(message)}`;
  try {
    await Linking.openURL(url);
  } catch {
    Alert.alert('Erreur', "Impossible d'ouvrir WhatsApp.");
  }
}

function echapper(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

function htmlQuittance(p: Paiement, l: Locataire, profil: Profil) {
  const mode = MODES.find((m) => m.value === p.mode)?.label ?? p.mode;
  const proprio = echapper(profil.nom || 'Le propriétaire');
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/>
<style>
  body { font-family: -apple-system, Roboto, Helvetica, Arial, sans-serif; color: #111; padding: 40px; }
  h1 { font-size: 26px; margin: 0 0 4px; color: #0F7B5F; }
  .muted { color: #666; font-size: 13px; }
  .box { border: 1px solid #ddd; border-radius: 10px; padding: 20px; margin-top: 24px; }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; }
  td { padding: 8px 0; border-bottom: 1px solid #eee; font-size: 15px; }
  td:last-child { text-align: right; font-weight: 600; }
  .total { font-size: 20px; color: #0F7B5F; }
  .sign { margin-top: 48px; text-align: right; }
</style></head><body>
  <h1>Quittance de loyer</h1>
  <div class="muted">N° Q-${p.id.toString().padStart(5, '0')} · ${libelleMois(p.mois)}</div>

  <div class="box">
    <strong>Propriétaire :</strong> ${proprio}<br/>
    ${profil.telephone ? `Tél. : ${echapper(profil.telephone)}<br/>` : ''}
    <br/>
    <strong>Locataire :</strong> ${echapper(l.nom)}<br/>
    ${l.logement_nom ? `Logement : ${echapper(l.logement_nom)}` : ''}
  </div>

  <div class="box">
    Je soussigné(e) ${proprio} déclare avoir reçu de ${echapper(l.nom)} la somme ci-dessous
    au titre du loyer de <strong>${libelleMois(p.mois)}</strong>.
    <table>
      <tr><td>Période</td><td>${libelleMois(p.mois)}</td></tr>
      <tr><td>Date du paiement</td><td>${formatDate(p.date_paiement)}</td></tr>
      <tr><td>Mode de paiement</td><td>${mode}</td></tr>
      <tr><td>Montant reçu</td><td class="total">${formatGNF(p.montant)}</td></tr>
    </table>
  </div>

  <div class="sign">
    Fait à ${echapper(profil.ville || '__________')}, le ${formatDate(p.date_paiement)}<br/><br/>
    ${proprio}
  </div>
</body></html>`;
}

export async function partagerQuittance(p: Paiement, l: Locataire, profil: Profil) {
  try {
    const { uri } = await Print.printToFileAsync({ html: htmlQuittance(p, l, profil) });
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Quittance de loyer' });
    } else {
      Alert.alert('Quittance créée', uri);
    }
  } catch (e) {
    Alert.alert('Erreur', 'La quittance n’a pas pu être générée.');
  }
}
