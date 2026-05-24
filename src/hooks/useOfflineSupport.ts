import { useNetwork } from "@/src/contexts/networkContext";
import {
  addToSyncQueue,
  getPendingActionsCount,
  SyncActionType,
} from "@/src/services/syncQueueService";
import { useCallback, useEffect, useState } from "react";

type UseOfflineSupportReturn = {
  isOffline: boolean;
  pendingActions: number;
  queueAction: (type: SyncActionType, data: any) => Promise<void>;
  executeWithOfflineSupport: <T>(
    onlineAction: () => Promise<T>,
    offlineAction: () => Promise<T>,
    syncType?: SyncActionType,
    syncData?: any
  ) => Promise<T>;
};

export const useOfflineSupport = (): UseOfflineSupportReturn => {
  const { isConnected } = useNetwork();
  const [pendingActions, setPendingActions] = useState(0);

  useEffect(() => {
    loadPendingCount();
  }, [isConnected]);

  const loadPendingCount = async () => {
    const count = await getPendingActionsCount();
    setPendingActions(count);
  };

  const queueAction = useCallback(
    async (type: SyncActionType, data: any) => {
      await addToSyncQueue({ type, data });
      await loadPendingCount();
    },
    []
  );

  const executeWithOfflineSupport = useCallback(
    async <T>(
      onlineAction: () => Promise<T>,
      offlineAction: () => Promise<T>,
      syncType?: SyncActionType,
      syncData?: any
    ): Promise<T> => {
      if (isConnected) {
        try {
          return await onlineAction();
        } catch (_error) {
          console.log("⚠️ Online action failed, falling back to offline");
          if (syncType && syncData) {
            await queueAction(syncType, syncData);
          }
          return await offlineAction();
        }
      } else {
        if (syncType && syncData) {
          await queueAction(syncType, syncData);
        }
        return await offlineAction();
      }
    },
    [isConnected, queueAction]
  );

  return {
    isOffline: !isConnected,
    pendingActions,
    queueAction,
    executeWithOfflineSupport,
  };
};