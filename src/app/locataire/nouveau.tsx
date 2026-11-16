import { useSQLiteContext } from 'expo-sqlite';

import { FormulaireLocataire } from '@/components/locataire-form';
import { Screen } from '@/components/ui';
import { addLocataire } from '@/db/queries';
import { fermer } from '@/lib/actions';

export default function NouveauLocataire() {
  const db = useSQLiteContext();
  return (
    <Screen>
      <FormulaireLocataire
        onSubmit={async (data) => {
          await addLocataire(db, data);
          fermer();
        }}
      />
    </Screen>
  );
}
