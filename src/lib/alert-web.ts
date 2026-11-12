import { Alert, Platform, type AlertButton } from 'react-native';

/**
 * Sur le web, Alert.alert de React Native ne fait rien : on le remplace par les
 * boîtes de dialogue du navigateur pour que confirmations et messages fonctionnent.
 */
export function installerAlertWeb() {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;

  Alert.alert = (titre: string, message?: string, boutons?: AlertButton[]) => {
    const texte = [titre, message].filter(Boolean).join('\n\n');
    const actions = (boutons ?? []).filter((b) => b.style !== 'cancel');

    if (actions.length <= 1 && (boutons?.length ?? 0) <= 1) {
      window.alert(texte);
      actions[0]?.onPress?.();
      return;
    }
    if (actions.length === 1) {
      if (window.confirm(texte)) actions[0].onPress?.();
      return;
    }
    const choix = window.prompt(`${texte}\n\n${actions.map((b, i) => `${i + 1}. ${b.text}`).join('\n')}\n\nTapez le numéro :`);
    const index = Number(choix) - 1;
    actions[index]?.onPress?.();
  };
}
