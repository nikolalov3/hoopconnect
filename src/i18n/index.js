import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'

// ── Locale resources — player app (hoopconnect.pl) only ─────────────────────
// Coach panel (trener.hoopconnect.pl) and admin (gu.hoopconnect.pl) are
// separate apps and not covered by this i18n instance.
import enCommon from './locales/en/common.json'
import enAuth from './locales/en/auth.json'
import enOnboarding from './locales/en/onboarding.json'
import enHome from './locales/en/home.json'
import enShooting from './locales/en/shooting.json'
import enCalendar from './locales/en/calendar.json'
import enStats from './locales/en/stats.json'
import enAchievements from './locales/en/achievements.json'
import enRecovery from './locales/en/recovery.json'
import enClub from './locales/en/club.json'
import enJoinClub from './locales/en/joinClub.json'
import enQrLanding from './locales/en/qrLanding.json'
import enArenaRoad from './locales/en/arenaRoad.json'
import enSettings from './locales/en/settings.json'
import enLeaderboard from './locales/en/leaderboard.json'
import enNotifications from './locales/en/notifications.json'
import enFrames from './locales/en/frames.json'
import enLeagueInfo from './locales/en/leagueInfo.json'
import enAddSession from './locales/en/addSession.json'
import enTrainingCard from './locales/en/trainingCard.json'
import enActivityCalendar from './locales/en/activityCalendar.json'

import plCommon from './locales/pl/common.json'
import plAuth from './locales/pl/auth.json'
import plOnboarding from './locales/pl/onboarding.json'
import plHome from './locales/pl/home.json'
import plShooting from './locales/pl/shooting.json'
import plCalendar from './locales/pl/calendar.json'
import plStats from './locales/pl/stats.json'
import plAchievements from './locales/pl/achievements.json'
import plRecovery from './locales/pl/recovery.json'
import plClub from './locales/pl/club.json'
import plJoinClub from './locales/pl/joinClub.json'
import plQrLanding from './locales/pl/qrLanding.json'
import plArenaRoad from './locales/pl/arenaRoad.json'
import plSettings from './locales/pl/settings.json'
import plLeaderboard from './locales/pl/leaderboard.json'
import plNotifications from './locales/pl/notifications.json'
import plFrames from './locales/pl/frames.json'
import plLeagueInfo from './locales/pl/leagueInfo.json'
import plAddSession from './locales/pl/addSession.json'
import plTrainingCard from './locales/pl/trainingCard.json'
import plActivityCalendar from './locales/pl/activityCalendar.json'

const LANG_STORAGE_KEY = 'hc_lang'

// Każdy język systemu inny niż polski → angielski. Polska → polski (domyślna,
// historyczna wersja apki). Wykrywane z `navigator.language` (ustawienia
// systemowe telefonu/przeglądarki), bez żadnego promptu o lokalizację.
const detector = new LanguageDetector()
detector.addDetector({
  name: 'systemLanguageOrPolish',
  lookup() {
    const langs = (typeof navigator !== 'undefined' && navigator.languages) || []
    const primary = (typeof navigator !== 'undefined' && navigator.language) || ''
    const all = [primary, ...langs].filter(Boolean)
    return all.some(l => l.toLowerCase().startsWith('pl')) ? 'pl' : 'en'
  },
})

i18n
  .use(detector)
  .use(initReactI18next)
  .init({
    resources: {
      en: {
        common: enCommon, auth: enAuth, onboarding: enOnboarding, home: enHome,
        shooting: enShooting, calendar: enCalendar, stats: enStats,
        achievements: enAchievements, recovery: enRecovery, club: enClub,
        joinClub: enJoinClub, qrLanding: enQrLanding, arenaRoad: enArenaRoad,
        settings: enSettings, leaderboard: enLeaderboard,
        notifications: enNotifications, frames: enFrames, leagueInfo: enLeagueInfo,
        addSession: enAddSession, trainingCard: enTrainingCard,
        activityCalendar: enActivityCalendar,
      },
      pl: {
        common: plCommon, auth: plAuth, onboarding: plOnboarding, home: plHome,
        shooting: plShooting, calendar: plCalendar, stats: plStats,
        achievements: plAchievements, recovery: plRecovery, club: plClub,
        joinClub: plJoinClub, qrLanding: plQrLanding, arenaRoad: plArenaRoad,
        settings: plSettings, leaderboard: plLeaderboard,
        notifications: plNotifications, frames: plFrames, leagueInfo: plLeagueInfo,
        addSession: plAddSession, trainingCard: plTrainingCard,
        activityCalendar: plActivityCalendar,
      },
    },
    fallbackLng: 'en',
    supportedLngs: ['en', 'pl'],
    defaultNS: 'common',
    ns: [
      'common', 'auth', 'onboarding', 'home', 'shooting', 'calendar', 'stats',
      'achievements', 'recovery', 'club', 'joinClub', 'qrLanding', 'arenaRoad',
      'settings', 'leaderboard', 'notifications', 'frames', 'leagueInfo', 'addSession',
      'trainingCard', 'activityCalendar',
    ],
    detection: {
      order: ['localStorage', 'systemLanguageOrPolish'],
      lookupLocalStorage: LANG_STORAGE_KEY,
      caches: ['localStorage'],
    },
    interpolation: { escapeValue: false },
  })

export default i18n
