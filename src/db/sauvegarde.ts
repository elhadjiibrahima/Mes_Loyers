import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import type { SQLiteDatabase } from 'expo-sqlite';
import { Platform } from 'react-native';

import { DATABASE_VERSION } from '@/db/schema';
import { aujourdHui } from '@/lib/format';

/** Tables sauvegardées, dans l'ordre où elles doivent être restaurées (clés étrangères). */
const TABLES = ['parametres', 'logements', 'locataires', 'loyers_historique', 'paiements', 'depenses'] as const;

type Ligne = Record<string, string | number | null>;

export type Sauvegarde = {
  application: 'mes-loyers';
  version: number;
  exporte_le: string;
  tables: Record<(typeof TABLES)[number], Ligne[]>;
};

export async function creerSauvegarde(db: SQLiteDatabase): Promise<Sauvegarde> {
  const tables = {} as Sauvegarde['tables'];
  for (const t of TABLES) tables[t] = await db.getAllAsync<Ligne>(`SELECT * FROM ${t}`);
  return { application: 'mes-loyers', version: DATABASE_VERSION, exporte_le: new Date().toISOString(), tables };
}

/** Exporte toute la base dans un fichier .json et ouvre le partage (WhatsApp, Drive, e-mail…). */
export async function exporterSauvegarde(db: SQLiteDatabase) {
  const contenu = JSON.stringify(await creerSauvegarde(db));
  const nom = `mes-loyers-sauvegarde-${aujourdHui()}.json`;

  if (Platform.OS === 'web') {
    const url = URL.createObjectURL(new Blob([contenu], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = nom;
    a.click();
    URL.revokeObjectURL(url);
    return;
  }
  const fichier = new File(Paths.cache, nom);
  if (fichier.exists) fichier.delete();
  fichier.create();
  fichier.write(contenu);
  await Sharing.shareAsync(fichier.uri, { mimeType: 'application/json', dialogTitle: 'Sauvegarde Mes Loyers' });
}

/** Lit et vérifie un fichier de sauvegarde choisi par l'utilisateur. Renvoie null si annulé. */
export async function choisirSauvegarde(): Promise<Sauvegarde | null> {
  const res = await DocumentPicker.getDocumentAsync({ type: ['application/json', 'text/plain', '*/*'], copyToCacheDirectory: true });
  if (res.canceled || !res.assets?.[0]) return null;
  const asset = res.assets[0];
  const texte = asset.file ? await asset.file.text() : await new File(asset.uri).text();
  let data: Sauvegarde;
  try {
    data = JSON.parse(texte);
  } catch {
    throw new Error('Ce fichier n’est pas une sauvegarde Mes Loyers.');
  }
  if (data?.application !== 'mes-loyers' || !data.tables) throw new Error('Ce fichier n’est pas une sauvegarde Mes Loyers.');
  if (data.version > DATABASE_VERSION) throw new Error('Cette sauvegarde vient d’une version plus récente de l’application. Mettez-la à jour.');
  return data;
}

/** Remplace toutes les données par celles de la sauvegarde. */
export async function restaurerSauvegarde(db: SQLiteDatabase, data: Sauvegarde) {
  await db.withTransactionAsync(async () => {
    for (const t of [...TABLES].reverse()) await db.runAsync(`DELETE FROM ${t}`);
    for (const t of TABLES) {
      const lignes = data.tables[t] ?? [];
      const colonnes = new Set((await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${t})`)).map((c) => c.name));
      for (const ligne of lignes) {
        // On ignore les colonnes inconnues ; les colonnes absentes prennent leur valeur par défaut.
        const cles = Object.keys(ligne).filter((k) => colonnes.has(k));
        if (cles.length === 0) continue;
        await db.runAsync(
          `INSERT INTO ${t} (${cles.join(', ')}) VALUES (${cles.map(() => '?').join(', ')})`,
          ...cles.map((k) => ligne[k]),
        );
      }
    }
    // Sauvegarde ancienne (sans historique des loyers) : on le reconstitue.
    if (!data.tables.loyers_historique?.length) {
      await db.runAsync(
        'INSERT OR IGNORE INTO loyers_historique (locataire_id, depuis, montant) SELECT id, debut_loyer, loyer FROM locataires',
      );
    }
  });
}

export function resumeSauvegarde(data: Sauvegarde) {
  const n = (t: (typeof TABLES)[number]) => data.tables[t]?.length ?? 0;
  return `${n('logements')} logement(s), ${n('locataires')} locataire(s), ${n('paiements')} paiement(s), ${n('depenses')} dépense(s)`;
}
