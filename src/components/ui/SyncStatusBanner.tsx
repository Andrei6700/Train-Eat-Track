import { colors, spacingX, spacingY } from "@/constants/theme";
import { useLanguage } from "@/src/contexts/languageContext";
import {
  getFirstConflictAction,
  resolveConflict,
  subscribeToSyncQueue,
  SyncAction,
  SyncQueueSummary,
} from "@/src/services/syncQueueService";
import { WarningCircle } from "phosphor-react-native";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
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
    <View style={styles.container}>
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
    </View>
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
});
