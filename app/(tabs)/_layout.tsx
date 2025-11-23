import CustomTabs from '@/src/components/navigation/CustomTabs';
import { Tabs } from 'expo-router';

const _layout = () => {
  return (
    <Tabs
      tabBar={(props) => <CustomTabs {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name='index' />
      <Tabs.Screen name='workout' />
      <Tabs.Screen name='history' />
      <Tabs.Screen name='statistics' />
      <Tabs.Screen name='profile' />
    </Tabs>
  );
};

export default _layout;