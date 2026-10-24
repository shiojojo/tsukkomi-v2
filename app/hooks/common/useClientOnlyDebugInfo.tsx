import { useState, useEffect } from 'react';
import type { useNavigation } from 'react-router';

type NavigationState = ReturnType<typeof useNavigation>;

export function useClientOnlyDebugInfo(
  navigation: NavigationState,
  isLoading: boolean,
  loadingTimeout: boolean,
) {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient || !import.meta.env.DEV) {
    return null;
  }

  return (
    <div className="toast-black">
      <div>Nav: {navigation.state}</div>
      <div>Loading: {isLoading ? 'YES' : 'NO'}</div>
      <div>Timeout: {loadingTimeout ? 'YES' : 'NO'}</div>
      {navigation.location && <div>To: {navigation.location.pathname}</div>}
    </div>
  );
}
