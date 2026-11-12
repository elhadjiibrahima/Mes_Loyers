import { useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';

import { FormulaireLocataire } from '@/components/locataire-form';
import { Screen, T } from '@/components/ui';
import { getLocataire, updateLocataire, type Locataire } from '@/db/queries';
import { fermer } from '@/lib/actions';

export default function ModifierLocataire() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useSQLiteContext();
  const [loc, setLoc] = useState<Locataire | null>(null);

  useEffect(() => {
    getLocataire(db, Number(id)).then(setLoc);
  }, [db, id]);

  if (!loc) return null;
  return (
    <Screen>
      <FormulaireLocataire
        initial={loc}
        onSubmit={async (data) => {
          await updateLocataire(db, loc.id, data);
          fermer();
        }}
      />
      <T variant="small">
        Attention : changer le loyer ou le premier mois dû recalcule aussi les arriérés passés.
      </T>
    </Screen>
  );
}
