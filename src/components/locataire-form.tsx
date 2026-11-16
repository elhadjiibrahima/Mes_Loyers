import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Alert, View } from 'react-native';

import { useAcces } from '@/auth/contexte';
import { DateField, MonthField } from '@/components/date-fields';
import { Button, Card, Chips, Field, T } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { listLogements, telephoneValide, type Locataire, type LocataireForm, type Logement } from '@/db/queries';
import { useTheme } from '@/hooks/use-theme';
import { aujourdHui, formatGNF, libelleMois, moisCourant, parseMontant } from '@/lib/format';

const JOURS_COURANTS = [1, 5, 10, 15, 30];

/** Formulaire commun à la création et à la modification d'un locataire. */
export function FormulaireLocataire({
  initial,
  onSubmit,
}: {
  initial?: Locataire;
  onSubmit: (data: LocataireForm) => Promise<void>;
}) {
  const db = useSQLiteContext();
  const c = useTheme();
  const [logements, setLogements] = useState<Logement[]>([]);
  const [nom, setNom] = useState(initial?.nom ?? '');
  const [telephone, setTelephone] = useState(initial?.telephone ?? '');
  const [logementId, setLogementId] = useState<number | null>(initial?.logement_id ?? null);
  const [dateEntree, setDateEntree] = useState(initial?.date_entree ?? aujourdHui());
  const [debutLoyer, setDebutLoyer] = useState(initial?.debut_loyer ?? aujourdHui().slice(0, 7));
  const [loyer, setLoyer] = useState(initial ? String(initial.loyer) : '');
  const [loyerDepuis, setLoyerDepuis] = useState(moisCourant());
  const [caution, setCaution] = useState(initial?.caution ? String(initial.caution) : '');
  const [jour, setJour] = useState(String(initial?.jour_echeance ?? 5));
  const [envoi, setEnvoi] = useState(false);
  const acces = useAcces();

  useEffect(() => {
    listLogements(db).then(setLogements);
  }, [db]);

  // Logements proposés : les libres + celui du locataire modifié.
  const choix = logements.filter((l) => !l.locataire_id || l.locataire_id === initial?.id);
  const loyerChange = initial != null && parseMontant(loyer) > 0 && parseMontant(loyer) !== initial.loyer;
  const telOk = telephoneValide(telephone);

  const choisirLogement = (id: number) => {
    setLogementId(id);
    const l = logements.find((x) => x.id === id);
    if (l && (!loyer || !initial)) setLoyer(String(l.loyer));
  };

  const changerEntree = (d: string) => {
    // Par défaut, le premier loyer dû est celui du mois d'entrée.
    if (debutLoyer === dateEntree.slice(0, 7)) setDebutLoyer(d.slice(0, 7));
    setDateEntree(d);
  };

  const enregistrer = async () => {
    const montant = parseMontant(loyer);
    const j = parseInt(jour, 10);
    if (!nom.trim()) return Alert.alert('Nom manquant', 'Indiquez le nom du locataire.');
    if (!telOk) return Alert.alert('Téléphone invalide', 'Saisissez un numéro avec 8 à 15 chiffres, par exemple 620 00 00 00.');
    if (montant <= 0) return Alert.alert('Loyer manquant', 'Indiquez le loyer mensuel.');
    if (!(j >= 1 && j <= 31)) return Alert.alert("Jour d'échéance invalide", 'Choisissez un jour entre 1 et 31.');
    if (!acces.peutModifier()) return;
    setEnvoi(true);
    try {
      await onSubmit({
        nom: nom.trim(),
        telephone: telephone.trim(),
        logement_id: logementId,
        date_entree: dateEntree,
        debut_loyer: debutLoyer,
        loyer: montant,
        caution: parseMontant(caution),
        jour_echeance: j,
        loyer_depuis: loyerChange ? loyerDepuis : undefined,
      });
    } catch (e) {
      Alert.alert(
        'Enregistrement impossible',
        e instanceof Error && e.message === 'occupe' ? 'Ce logement est déjà occupé.' : 'Une erreur est survenue.',
      );
    } finally {
      setEnvoi(false);
    }
  };

  return (
    <>
      <Field label="Nom complet" value={nom} onChangeText={setNom} placeholder="Ex. Fatoumata Bah" autoFocus={!initial} />
      <Field label="Téléphone (WhatsApp)" value={telephone} onChangeText={setTelephone} keyboardType="phone-pad" placeholder="Ex. 620 00 00 00" />
      {!telOk && (
        <T variant="small" color={c.danger}>
          Numéro invalide : seulement des chiffres (8 à 15), espaces et « + » acceptés.
        </T>
      )}

      <T variant="label">Logement</T>
      {choix.length === 0 ? (
        <T variant="small">Aucun logement libre. Ajoutez-en un dans l'onglet Logements.</T>
      ) : (
        <Chips options={choix.map((l) => ({ value: l.id, label: l.nom }))} value={logementId} onChange={choisirLogement} />
      )}

      <Field
        label="Loyer mensuel (GNF)"
        value={loyer}
        onChangeText={setLoyer}
        keyboardType="number-pad"
        placeholder="Rempli automatiquement avec le loyer du logement"
      />
      {loyerChange && (
        <Card style={{ backgroundColor: c.warningBg, gap: Spacing.two }}>
          <T style={{ fontWeight: '700' }} color={c.warning}>
            Nouveau loyer : {formatGNF(parseMontant(loyer))} (avant {formatGNF(initial!.loyer)})
          </T>
          <MonthField label="À partir de" value={loyerDepuis} onChange={setLoyerDepuis} min={debutLoyer} />
          <T variant="small" color={c.warning}>
            Les mois d'avant {libelleMois(loyerDepuis)} gardent l'ancien loyer. Pour corriger une erreur de saisie,
            choisissez le premier mois du contrat.
          </T>
        </Card>
      )}

      <View style={{ gap: Spacing.one }}>
        <Field label="Loyer dû chaque mois le" value={jour} onChangeText={setJour} keyboardType="number-pad" placeholder="5" />
        <Chips
          options={JOURS_COURANTS.map((n) => ({ value: n, label: n === 1 ? '1er' : String(n) }))}
          value={JOURS_COURANTS.find((n) => String(n) === jour) ?? null}
          onChange={(n) => setJour(String(n))}
        />
        <T variant="small">Avant cette date, le loyer du mois n'est pas compté comme un retard.</T>
      </View>

      <Field label="Caution versée (GNF)" value={caution} onChangeText={setCaution} keyboardType="number-pad" placeholder="0" />

      <DateField label="Date d'entrée" value={dateEntree} onChange={changerEntree} />
      <MonthField label="Premier loyer dû" value={debutLoyer} onChange={setDebutLoyer} />
      <T variant="small">Si le locataire entre en fin de mois, choisissez le mois suivant comme premier loyer dû.</T>

      <Button title="Enregistrer" onPress={enregistrer} disabled={envoi} />
    </>
  );
}
