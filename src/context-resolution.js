/* ============================================================
 * GENERIC PRONOUN / ENTITY CONTEXT RESOLUTION (additive layer)
 *
 * Resolves pronouns and implicit references ("it", "its", "they",
 * "their", "them", "this", "these", "those", "that") to the latest
 * specific investment entity from the conversation history, BEFORE
 * the existing keyword/intent matching runs.
 *
 * Example:
 *   "What are bonds?"          -> currentEntity = bonds
 *   "How do they generate returns?" ->
 *       resolved to "How do bonds generate returns?" and answered.
 *
 * No external AI API. No per-question hardcoded cases: works for
 * every entity in LOCAL_TOPICS (stocks, bonds, ETFs, REITs,
 * diversification, investment risk, portfolio risk, etc.) and any
 * topic added later.
 * ============================================================ */

(function () {
    "use strict";

    /*
     * Personal/possessive pronouns and implicit references that may
     * stand for the previous conversation entity.
     */
    const PRONOUN_RE =
        /\b(its?|it|they|their|theirs|them|this|these|those|that)\b/i;

    /* Words that must never be treated as a pronoun reference. */
    const PRONOUN_STOP_RE =
        /\b(that is|that way|in that case|it depends|as it were)\b/i;

    /*
     * Find the latest specific entity in the conversation history.
     * User questions are checked first (they state what the user is
     * talking about), then assistant answers as a fallback.
     */
    function findLatestEntity(history) {
        const entries = Array.isArray(history) ? history : [];

        for (const entry of [...entries].reverse()) {
            if (!entry || entry.role !== "user") continue;
            const found = findTopicInText(entry.content);
            if (found) return found;
        }

        for (const entry of [...entries].reverse()) {
            if (!entry) continue;
            const found = findTopicInText(entry.content);
            if (found) return found;
        }

        return null;
    }

    /*
     * A question is a pronoun/implicit-reference question when it
     * contains a pronoun, names no topic of its own, and is not a
     * pure greeting.
     */
    function isPronounQuestion(question) {
        const text = String(question || "").trim();

        if (!text) return false;
        if (findTopicInText(text)) return false;
        if (PRONOUN_STOP_RE.test(text)) return false;

        return PRONOUN_RE.test(text);
    }

    /*
     * Substitute pronouns with the entity name so the rewritten
     * question reads naturally, e.g.:
     *   "How do they generate returns?" -> "How do bonds generate returns?"
     *   "What are their risks?"         -> "What are the bonds risks?"
     *   "Is it worth buying?"           -> "Is bonds worth buying?"
     */
    function rewritePronouns(text, entity) {
        const name = String(entity.name || "").toLowerCase();

        return String(text)
            .replace(/\b(it|its|this|that|they|them|their|theirs|these|those)\b/gi, name);
    }

    /*
     * Resolve a pronoun question against the conversation history.
     * Returns { entity, question } when a previous entity applies,
     * otherwise null (nothing to resolve from context).
     */
    function resolvePronounContext(question, history) {
        if (!isPronounQuestion(question)) return null;

        const entity = findLatestEntity(history);

        if (!entity) return null;

        const resolved = rewritePronouns(question, entity);

        /* Track the entity for elaboration / variant logic. */
        if (typeof sessionContext !== "undefined") {
            sessionContext.lastTopicKey = entity.key;
        }

        return { entity: entity, question: resolved };
    }

    /* Expose for testing and reuse. */
    window.__resolvePronounContext = resolvePronounContext;
    window.__isPronounQuestion = isPronounQuestion;

    /* ============================================================
     * PATCH 1: isContextualFollowUp
     * Any question that contains a pronoun AND names no topic of its
     * own is a contextual follow-up, even when it does not match the
     * fixed phrase list (e.g. "How safe are they?", "What are their
     * returns over time?"). This single hook lets the pronoun flow
     * through the guard, the pure-follow-up routing and the answer
     * engine everywhere else unchanged.
     * ============================================================ */

    if (typeof isContextualFollowUp === "function") {
        const baseIsContextualFollowUp = isContextualFollowUp;

        window.isContextualFollowUp = function (text) {
            if (baseIsContextualFollowUp(text)) return true;
            return isPronounQuestion(text);
        };
    }

    /* ============================================================
     * PATCH 2: getLocalAnswer
     * Run BEFORE the existing keyword/intent matching: when the
     * question resolves to a previous entity, try the contextual
     * follow-up engine first. If it has no section for the intent,
     * re-run the original engine with the pronouns substituted by
     * the entity name so keyword matching sees "bonds", "etfs",
     * "diversification" etc. instead of "they"/"it".
     * The generic greeting/fallback can no longer fire for a
     * resolvable pronoun question.
     * ============================================================ */

    if (typeof getLocalAnswer === "function") {
        const baseGetLocalAnswer = getLocalAnswer;

        window.getLocalAnswer = function (question, history) {
            const resolved =
                resolvePronounContext(question, history);

            if (resolved) {
                /*
                 * Prefer the intent-aware engine: it answers the
                 * CURRENT intent (definition, how, why, risks,
                 * benefits, example, types) about the resolved
                 * entity.
                 */
                if (typeof getFollowUpAnswer === "function") {
                    const contextual =
                        getFollowUpAnswer(question, history);

                    if (contextual) return contextual;
                }

                /*
                 * Fall back to the keyword engine, but on the
                 * rewritten question ("How do bonds generate
                 * returns?") instead of the pronoun text.
                 */
                return baseGetLocalAnswer(
                    resolved.question,
                    history
                );
            }

            return baseGetLocalAnswer(question, history);
        };
    }

})();
