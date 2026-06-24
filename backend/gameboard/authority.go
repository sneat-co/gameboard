package gameboard

import et "github.com/sneat-co/gameboard-ext/backend/eventtimeline"

// authorized maps each Source to the event types it may append, per the
// event-timeline source-authority requirement:
//   - scorekeeper: score, team-foul, substitution
//   - timekeeper:  clock, period, possession, timeout, status
//   - judge:       judge-ruling, correction
//   - consensus:   the play events (scorekeeper ∪ timekeeper) when there is no
//     official crew; rulings/corrections remain judge-only.
var authorized = map[et.Source]map[et.EventType]bool{
	et.SourceScorekeeper: setOf(et.EventScore, et.EventTeamFoul, et.EventSubstitution),
	et.SourceTimekeeper:  setOf(et.EventClock, et.EventPeriod, et.EventPossession, et.EventTimeout, et.EventStatus),
	et.SourceJudge:       setOf(et.EventJudgeRuling, et.EventCorrection),
	et.SourceConsensus: setOf(
		et.EventScore, et.EventTeamFoul, et.EventSubstitution,
		et.EventClock, et.EventPeriod, et.EventPossession, et.EventTimeout, et.EventStatus,
	),
}

func setOf(types ...et.EventType) map[et.EventType]bool {
	s := make(map[et.EventType]bool, len(types))
	for _, t := range types {
		s[t] = true
	}
	return s
}

// IsAuthorized reports whether source may append an event of the given type.
func IsAuthorized(source et.Source, eventType et.EventType) bool {
	return authorized[source][eventType]
}
