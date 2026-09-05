// Angielskie zasoby jako JEDEN moduł → Vite robi z tego jeden chunk, ładowany
// dynamicznie tylko gdy wykryty język to en (src/i18n/index.js).
import common from './common.json'
import auth from './auth.json'
import onboarding from './onboarding.json'
import home from './home.json'
import shooting from './shooting.json'
import calendar from './calendar.json'
import stats from './stats.json'
import achievements from './achievements.json'
import recovery from './recovery.json'
import club from './club.json'
import joinClub from './joinClub.json'
import qrLanding from './qrLanding.json'
import arenaRoad from './arenaRoad.json'
import settings from './settings.json'
import leaderboard from './leaderboard.json'
import notifications from './notifications.json'
import frames from './frames.json'
import leagueInfo from './leagueInfo.json'
import addSession from './addSession.json'
import trainingCard from './trainingCard.json'
import appStory from './appStory.json'
import rank from './rank.json'

export default {
  common, auth, onboarding, home, shooting, calendar, stats, achievements, recovery,
  club, joinClub, qrLanding, arenaRoad, settings, leaderboard, notifications, frames,
  leagueInfo, addSession, trainingCard, appStory, rank,
}
