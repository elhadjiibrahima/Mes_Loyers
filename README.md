# Mes Loyers — gestion locative (React Native / Expo)

Application mobile multiplateforme (Android + iPhone) pour les propriétaires :
logements, locataires, encaissement des loyers, relances WhatsApp et quittances PDF.
Fonctionne **hors ligne** (base SQLite locale).

## Lancer le projet

```bash
npm install
npx expo start
```

Scannez le QR code avec l'application **Expo Go** sur votre téléphone.

## Fonctionnalités (v1)

- **Loyers** : tableau du mois (encaissé / attendu / reste), statut Payé · Partiel · Impayé, navigation entre les mois
- **Encaisser** un loyer (espèces, Orange Money, MTN MoMo, virement)
- **Relance WhatsApp** pré-remplie en un clic (numéros guinéens convertis en +224 automatiquement)
- **Quittance PDF** générée et partagée (WhatsApp, e-mail…)
- **Logements** (libre / occupé) et **locataires** (actifs / partis) avec historique des paiements
- **Profil** du propriétaire imprimé sur les quittances

## Structure

```
src/
  app/                 écrans (Expo Router)
    (tabs)/            Loyers, Logements, Locataires, Profil
    logement/nouveau   ajout d'un logement
    locataire/         ajout + fiche locataire
    paiement/nouveau   encaissement
  db/schema.ts         création / migrations SQLite
  db/queries.ts        toutes les requêtes
  lib/actions.ts       relance WhatsApp + quittance PDF
  lib/format.ts        formats GNF, mois, dates
  components/ui.tsx    composants d'interface
```

## Prochaines étapes

1. Comptes utilisateurs + synchronisation cloud (Supabase)
2. Rappels automatiques avant l'échéance (notifications)
3. Abonnement payant (Orange Money / MTN MoMo)
4. Publication sur Play Store / App Store avec EAS Build
