import { colors, spacingX, spacingY } from "@/constants/theme";
import { useLanguage } from "@/src/contexts/languageContext";
import {
  getFirstConflictAction,
  resolveConflict,
  subscribeToSyncQueue,
  SyncAction,
  SyncQueueSummary,
  getFailedSyncActions,
  retryFailedAction,
  removeFromSyncQueue,
} from "@/src/services/syncQueueService";
import { WarningCircle, X } from "phosphor-react-native";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Modal, ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";
import Typo from "./Typo";

type SyncStatusBannerProps = {
  onConflictResolved?: () => Promise<void> | void;
};

const EMPTY_SUMMARY: SyncQueueSummary = {
  total: 0,
  pending: 0,
  processing: 0,
  retryScheduled: 0,
  failed: 0,
  conflicts: 0,
  nextRetryAt: null,
};

const SyncStatusBanner = ({ onConflictResolved }: SyncStatusBannerProps) => {
  const { t } = useLanguage();
  const [summary, setSummary] = useState<SyncQueueSummary>(EMPTY_SUMMARY);
  const [firstConflict, setFirstConflict] = useState<SyncAction | null>(null);
  const [failedActions, setFailedActions] = useState<SyncAction[]>([]);
  const [modalVisible, setModalVisible] = useState(false);

  useEffect(() => {
    const unsubscribe = subscribeToSyncQueue((nextSummary) => {
      setSummary(nextSummary);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (summary.conflicts === 0) {
      setFirstConflict(null);
      return;
    }

    void getFirstConflictAction().then((conflictAction) => {
      setFirstConflict(conflictAction);
    });
  }, [summary.conflicts]);

  const loadFailedActions = useCallback(async () => {
    const failed = await getFailedSyncActions();
    setFailedActions(failed);
  }, []);

  const handleBannerPress = useCallback(() => {
    if (summary.failed > 0) {
      void loadFailedActions().then(() => {
        setModalVisible(true);
      });
    }
  }, [summary.failed, loadFailedActions]);

  const handleRetry = useCallback(async (actionId: string) => {
    const success = await retryFailedAction(actionId);
    if (success) {
      await loadFailedActions();
      if (onConflictResolved) {
        await onConflictResolved();
      }
    }
  }, [loadFailedActions, onConflictResolved]);

  const handleDismiss = useCallback(async (actionId: string) => {
    await removeFromSyncQueue(actionId);
    await loadFailedActions();
  }, [loadFailedActions]);

  // Close modal if no failed actions left
  useEffect(() => {
    if (modalVisible && failedActions.length === 0) {
      setModalVisible(false);
    }
  }, [failedActions.length, modalVisible]);

  const bannerMessage = useMemo(() => {
    if (summary.conflicts > 0) {
      return t("sync_status_conflict", { count: summary.conflicts });
    }

    if (summary.failed > 0) {
      return t("sync_status_failed", { count: summary.failed });
    }

    if (summary.retryScheduled > 0) {
      return t("sync_status_retrying", { count: summary.retryScheduled });
    }

    if (summary.pending > 0 || summary.processing > 0) {
      return t("sync_status_pending", {
        count: summary.pending + summary.processing,
      });
    }

    return "";
  }, [summary, t]);

  const handleResolveConflict = useCallback(
    async (resolution: "KEEP_SERVER" | "KEEP_LOCAL") => {
      if (!firstConflict) return;
      const resolved = await resolveConflict(firstConflict.id, resolution);
      if (!resolved) return;

      if (onConflictResolved) {
        await onConflictResolved();
      }
    },
    [firstConflict, onConflictResolved],
  );

  if (summary.total === 0 || !bannerMessage) {
    return null;
  }

  return (
    <>
      <TouchableOpacity
        style={styles.container}
        activeOpacity={summary.failed > 0 ? 0.85 : 1}
        onPress={handleBannerPress}
      >
        <View style={styles.messageRow}>
          <WarningCircle size={18} color={colors.white} weight="fill" />
          <Typo size={13} fontWeight="600" color={colors.white}>
            {bannerMessage}
          </Typo>
        </View>

        {summary.conflicts > 0 && firstConflict ? (
          <View style={styles.actionsRow}>
            <TouchableOpacity
              style={[styles.actionButton, styles.serverButton]}
              onPress={() => {
                void handleResolveConflict("KEEP_SERVER");
              }}
            >
              <Typo size={12} fontWeight="700" color={colors.white}>
                {t("sync_action_keep_server")}
              </Typo>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, styles.localButton]}
              onPress={() => {
                void handleResolveConflict("KEEP_LOCAL");
              }}
            >
              <Typo size={12} fontWeight="700" color={colors.black}>
                {t("sync_action_keep_local")}
              </Typo>
            </TouchableOpacity>
          </View>
        ) : null}
      </TouchableOpacity>

      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Typo size={18} fontWeight="700" color={colors.white}>
                {t("sync_failed_items_title") || "Failed Sync Items"}
              </Typo>
              <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.closeButton}>
                <X size={20} color={colors.white} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScroll}>
              {failedActions.map((action) => (
                <View key={action.id} style={styles.failedItemCard}>
                  <View style={styles.failedItemHeader}>
                    <Typo size={14} fontWeight="600" color={colors.primary}>
                      {action.type}
                    </Typo>
                    <Typo size={11} color={colors.neutral400}>
                      {new Date(action.timestamp).toLocaleString()}
                    </Typo>
                  </View>
                  
                  {action.lastError ? (
                    <Typo size={12} color={colors.chartDanger} style={styles.errorText}>
                      {action.lastError}
                    </Typo>
                  ) : null}

                  <View style={styles.failedItemActions}>
                    <TouchableOpacity
                      style={[styles.modalActionButton, styles.retryBtn]}
                      onPress={() => handleRetry(action.id)}
                    >
                      <Typo size={12} fontWeight="700" color={colors.black}>
                        {t("sync_action_retry") || "Retry"}
                      </Typo>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.modalActionButton, styles.dismissBtn]}
                      onPress={() => handleDismiss(action.id)}
                    >
                      <Typo size={12} fontWeight="700" color={colors.white}>
                        {t("sync_action_dismiss") || "Dismiss"}
                      </Typo>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
};

export default SyncStatusBanner;

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.warning,
    paddingVertical: spacingY._10,
    paddingHorizontal: spacingX._15,
    borderTopWidth: 2,
    borderTopColor: colors.black,
    gap: spacingY._10,
  },
  messageRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacingX._7,
  },
  actionsRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: spacingX._10,
  },
  actionButton: {
    paddingVertical: spacingY._7,
    paddingHorizontal: spacingX._15,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: colors.black,
    minHeight: 44,
    justifyContent: "center",
  },
  serverButton: {
    backgroundColor: colors.danger,
  },
  localButton: {
    backgroundColor: colors.primary,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.75)",
    justifyContent: "center",
    alignItems: "center",
    padding: spacingX._20,
  },
  modalContent: {
    backgroundColor: colors.neutral800,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: colors.border,
    width: "100%",
    maxHeight: "80%",
    padding: spacingX._20,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacingY._15,
  },
  closeButton: {
    padding: 4,
  },
  modalScroll: {
    flexGrow: 0,
  },
  failedItemCard: {
    backgroundColor: colors.neutral900,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacingX._12,
    marginBottom: spacingY._12,
  },
  failedItemHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacingY._5,
  },
  errorText: {
    marginBottom: spacingY._10,
    fontStyle: "italic",
  },
  failedItemActions: {
    flexDirection: "row",
    gap: spacingX._10,
    justifyContent: "flex-end",
  },
  modalActionButton: {
    paddingVertical: spacingY._7,
    paddingHorizontal: spacingX._15,
    borderRadius: 6,
    justifyContent: "center",
    alignItems: "center",
    minWidth: 80,
  },
  retryBtn: {
    backgroundColor: colors.primary,
  },
  dismissBtn: {
    backgroundColor: colors.neutral700,
    borderWidth: 1,
    borderColor: colors.border,
  },
});
