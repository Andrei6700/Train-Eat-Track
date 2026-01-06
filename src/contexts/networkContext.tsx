import NetInfo, { NetInfoState } from "@react-native-community/netinfo";
import React, { createContext, useContext, useEffect, useState } from "react";

type NetworkContextType = {
  isConnected: boolean;
  isOfflineMode: boolean;
};

const NetworkContext = createContext<NetworkContextType>({
  isConnected: true,
  isOfflineMode: false,
});

export const NetworkProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [isConnected, setIsConnected] = useState(true);
  const [isOfflineMode, setIsOfflineMode] = useState(false);

  useEffect(() => {
    // Check initial connection status
    NetInfo.fetch().then((state) => {
      const connected = state.isConnected ?? true;
      setIsConnected(connected);
      setIsOfflineMode(!connected);
    });

    // Subscribe to connection changes
    const unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
      const connected = state.isConnected ?? true;
      setIsConnected(connected);
      setIsOfflineMode(!connected);

      if (connected) {
        console.log(" [NetworkContext] Back online");
      } else {
        console.log(" [NetworkContext] Offline mode");
      }
    });

    return () => unsubscribe();
  }, []);

  return (
    <NetworkContext.Provider value={{ isConnected, isOfflineMode }}>
      {children}
    </NetworkContext.Provider>
  );
};

export const useNetwork = () => {
  const context = useContext(NetworkContext);
  if (!context) {
    throw new Error("useNetwork must be used within a NetworkProvider");
  }
  return context;
};