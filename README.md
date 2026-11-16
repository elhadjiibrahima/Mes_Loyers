# Mes Loyers — gestion locative (React Native / Expo)

Application mobile multiplateforme (Android, iPhone, web) pour les propriétaires :
logements, locataires, encaissement des loyers, relances WhatsApp, quittances PDF,
dépenses et bilan annuel. Fonctionne **hors ligne**.

## Lancer le projet

```bash
npm install
npx expo start          # puis scanner le QR code avec Expo Go
npx expo start --web    # version navigateur
```

## Fonctionnalités

- **Accueil** : encaissé du mois, loyers à relancer, à venir (avant l'échéance) et à jour ; carte « Pour commencer » au premier lancement
- **Encaisser** : montant réparti automatiquement sur plusieurs mois (avance), jamais avant le premier loyer dû ; quittance PDF envoyée après l'enregistrement
- **Locataires** : jour d'échéance, caution, historique des loyers (une augmentation ne change pas les mois passés), départ avec retenue sur caution, suppression d'une saisie erronée
- **Logements** : taux d'occupation, revenu mensuel, « libre depuis N jours »
- **Bilan** : encaissements et dépenses par mois et par logement, bénéfice net, export PDF
- **Profil** : nom imprimé sur les quittances, **sauvegarde / restauration** des données

## Base de données (SQLite)

Les données sont dans une base SQLite locale, `loyers.db`, ouverte par `expo-sqlite`
(`SQLiteProvider` dans `src/app/_layout.tsx`).

| Table | Contenu |
| --- | --- |
| `logements` | nom, adresse, loyer affiché |
| `locataires` | contact, logement, dates d'entrée et de sortie, caution, jour d'échéance |
| `loyers_historique` | loyer de chaque locataire et mois à partir duquel il s'applique |
| `paiements` | mois payé, montant, date, mode ; `lot` regroupe un paiement sur plusieurs mois |
| `depenses` | travaux, électricité, eau, taxes… par logement |
| `parametres` | profil du propriétaire |

- **Migrations** : `src/db/schema.ts` (version actuelle : 3). Les mises à jour de l'application
  convertissent la base existante sans perte de données.
- **Requêtes et calculs** (arriérés, échéances, répartition des paiements, bilan) : `src/db/queries.ts`.
- **Sauvegarde** : `src/db/sauvegarde.ts` exporte toute la base dans un fichier `.json`
  (partagé par WhatsApp, Drive, e-mail…) et la restaure sur n'importe quel appareil.

## Structure

```
src/
  app/                  écrans (Expo Router)
    (tabs)/             Accueil, Logements, Locataires, Bilan, Profil
    logement/           ajout, modification
    locataire/          ajout, fiche, modification, départ
    paiement/nouveau    encaissement
    depense/nouveau     dépense
  db/                   schéma SQLite, requêtes, sauvegarde
  lib/                  formats (GNF, dates), actions (WhatsApp, PDF)
  components/           composants d'interface
```

## Avant une publication sur les stores

- Identifiants Android / iOS : `com.elhadjiibrahima.mesloyers` dans `app.json` (à changer si besoin, avant la première publication).
- Construire avec EAS : `npx eas-cli@latest build`.
