import { useEffect, useState } from 'react';
import { Alert } from 'react-native';

import { DateField, MonthField } from '@/components/date-fields';
import { Button, Chips, Field, T } from '@/components/ui';
import { listLogements, type Locataire, type LocataireForm, type Logement } from '@/db/queries';
import { useSQLiteContext } from 'expo-sqlite';
import { aujourdHui, formatGNF, parseMontant } from '@/lib/format';

/** Formulaire commun à la création et à la modification d'un locataire. */
export function FormulaireLocataire({
  initial,
  onSubmit,
}: {
  initial?: Locataire;
  onSubmit: (data: LocataireForm) => Promise<void>;
}) {
  const db = useSQLiteContext();
  const [logements, setLogements] = useState<Logement[]>([]);
  const [nom, setNom] = useState(initial?.nom ?? '');
  const [telephone, setTelephone] = useState(initial?.telephone ?? '');
  const [logementId, setLogementId] = useState<number | null>(initial?.logement_id ?? null);
  const [dateEntree, setDateEntree] = useState(initial?.date_entree ?? aujourdHui());
  const [debutLoyer, setDebutLoyer] = useState(initial?.debut_loyer ?? aujourdHui().slice(0, 7));
  const [loyer, setLoyer] = useState(initial ? String(initial.loyer) : '');
  const [caution, setCaution] = useState(initial?.caution ? String(initial.caution) : '');
  const [envoi, setEnvoi] = useState(false);

  useEffect(() => {
    listLogements(db).then(setLogements);
  }, [db]);

  // Logements proposés : les libres + celui du locataire modifié.
  const choix = logements.filter((l) => !l.locataire_id || l.locataire_id === initial?.id);

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
    if (!nom.trim()) return Alert.alert('Nom manquant', 'Indiquez le nom du locataire.');
    if (montant <= 0) return Alert.alert('Loyer manquant', 'Indiquez le loyer mensuel.');
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

      <T variant="small">Logement</T>
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
      <Field label="Caution versée (GNF)" value={caution} onChangeText={setCaution} keyboardType="number-pad" placeholder="0" />
      {parseMontant(caution) > 0 && <T variant="small">Caution : {formatGNF(parseMontant(caution))}</T>}

      <DateField label="Date d'entrée" value={dateEntree} onChange={changerEntree} />
      <MonthField label="Premier loyer dû" value={debutLoyer} onChange={setDebutLoyer} />
      <T variant="small">
        Si le locataire entre en fin de mois, choisissez le mois suivant comme premier loyer dû.
      </T>

      <Button title="Enregistrer" onPress={enregistrer} disabled={envoi} />
    </>
  );
}
