const DECISION_STAGES = {
  NEW_PROCESSED: "new_processed",
  FETCH_RESTRICTED: "fetch_restricted",
  PRE_PROCESS_MATCH: "pre_process_match",
  POST_PROCESS_MATCH: "post_process_match",
};

const DECISION_EVENTS = {
  NEW: "new",
  REVISITED: "revisited",
  UPDATED: "updated",
  FETCH_RESTRICTED: "fetch_restricted",
};

const DECISION_TABLE = {
  [DECISION_STAGES.NEW_PROCESSED]: {
    defaultEvent: DECISION_EVENTS.NEW,
    updates: ["firstSeenAt", "lastSeenAt", "timesSeen", "score"],
  },
  [DECISION_STAGES.FETCH_RESTRICTED]: {
    defaultEvent: DECISION_EVENTS.FETCH_RESTRICTED,
    updates: ["lastSeenAt", "fetchRestricted", "score"],
  },
  [DECISION_STAGES.PRE_PROCESS_MATCH]: {
    defaultEvent: DECISION_EVENTS.REVISITED,
    updates: ["lastSeenAt", "timesSeen", "score"],
  },
  [DECISION_STAGES.POST_PROCESS_MATCH]: {
    defaultEvent: DECISION_EVENTS.REVISITED,
    updates: ["lastSeenAt", "timesSeen", "score", "revisionCount"],
  },
};

function normalizeStage(stage) {
  const raw = String(stage || "").trim();
  if (!raw) return DECISION_STAGES.NEW_PROCESSED;
  if (Object.values(DECISION_STAGES).includes(raw)) return raw;
  return DECISION_STAGES.NEW_PROCESSED;
}

function parseSeenReason(reason = "") {
  const raw = String(reason || "").trim();

  if (!raw) {
    return {
      stage: DECISION_STAGES.POST_PROCESS_MATCH,
      matchedBy: "unknown",
      reason: "unknown",
    };
  }

  if (raw.startsWith("pre_process_")) {
    return {
      stage: DECISION_STAGES.PRE_PROCESS_MATCH,
      matchedBy: raw.replace("pre_process_", "") || "unknown",
      reason: raw,
    };
  }

  if (raw.startsWith("post_process_")) {
    return {
      stage: DECISION_STAGES.POST_PROCESS_MATCH,
      matchedBy: raw.replace("post_process_", "") || "unknown",
      reason: raw,
    };
  }

  return {
    stage: DECISION_STAGES.POST_PROCESS_MATCH,
    matchedBy: "unknown",
    reason: raw,
  };
}

function buildDecisionEntry({
  at,
  stage,
  event,
  reason,
  matchedBy,
  fetchRestricted,
  duplicateReason,
}) {
  return {
    at: String(at || new Date().toISOString()),
    stage: normalizeStage(stage),
    event: String(event || DECISION_EVENTS.NEW),
    reason: String(reason || ""),
    matchedBy: String(matchedBy || ""),
    duplicateReason: String(duplicateReason || ""),
    fetchRestricted: Boolean(fetchRestricted),
  };
}

function appendDecisionTrace(trace = [], entry, maxEntries = 20) {
  const list = Array.isArray(trace) ? trace.slice(0) : [];
  list.push(entry);

  if (maxEntries <= 0) return list;
  if (list.length <= maxEntries) return list;
  return list.slice(list.length - maxEntries);
}

module.exports = {
  DECISION_TABLE,
  DECISION_STAGES,
  DECISION_EVENTS,
  parseSeenReason,
  buildDecisionEntry,
  appendDecisionTrace,
};
