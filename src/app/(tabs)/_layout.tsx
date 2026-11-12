import { NativeTabs } from 'expo-router/native-tabs';
import { useColorScheme } from 'react-native';

import { Colors } from '@/constants/theme';

export default function TabsLayout() {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];

  return (
    <NativeTabs
      backgroundColor={colors.backgroundElement}
      indicatorColor={colors.backgroundSelected}
      labelStyle={{ selected: { color: colors.primary } }}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Loyers</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="banknote" md="payments" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="logements">
        <NativeTabs.Trigger.Label>Logements</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="building.2" md="apartment" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="locataires">
        <NativeTabs.Trigger.Label>Locataires</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="person.2" md="group" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="profil">
        <NativeTabs.Trigger.Label>Profil</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="person.crop.circle" md="account_circle" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
