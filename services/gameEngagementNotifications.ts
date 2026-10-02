import {
  Capacitor,
} from "@capacitor/core";

import {
  LocalNotifications,
} from "@capacitor/local-notifications";


const ENGAGEMENT_CHANNEL_ID =
  "genz_games_engagement";


const ENGAGEMENT_REMINDER_ONE_ID =
  204811;


const ENGAGEMENT_REMINDER_TWO_ID =
  204812;


/*
 * Promotional / engagement notification window:
 *
 * 09:00 AM -> 08:59 PM
 *
 * From 09:00 PM until 08:59 AM we do not
 * send Play / Leaderboard / Records reminders.
 */
const NOTIFICATION_START_HOUR =
  9;


const NOTIFICATION_END_HOUR =
  21;


const FIRST_REMINDER_AFTER_HOURS =
  3;


const SECOND_REMINDER_AFTER_HOURS =
  3;


let initialized =
  false;


/*
 * =====================================================
 * MOVE A REMINDER INTO THE ALLOWED TIME WINDOW
 * =====================================================
 */
const normalizeReminderTime =
  (
    input:
      Date,
  ) => {

    const result =
      new Date(
        input,
      );


    const hour =
      result.getHours();


    /*
     * Before 9 AM:
     *
     * Move to 9 AM today.
     */
    if (
      hour <
      NOTIFICATION_START_HOUR
    ) {

      result.setHours(
        NOTIFICATION_START_HOUR,
        0,
        0,
        0,
      );


      return result;
    }


    /*
     * 9 PM or later:
     *
     * Never disturb the user at night.
     * Move this reminder to 9 AM tomorrow.
     */
    if (
      hour >=
      NOTIFICATION_END_HOUR
    ) {

      result.setDate(
        result.getDate() +
        1,
      );


      result.setHours(
        NOTIFICATION_START_HOUR,
        0,
        0,
        0,
      );


      return result;
    }


    return result;
  };


/*
 * =====================================================
 * INITIALIZE
 * =====================================================
 */
export async function initializeGameEngagementNotifications():
Promise<boolean> {

  if (
    !Capacitor.isNativePlatform()
  ) {

    return false;
  }


  try {

    if (
      Capacitor.getPlatform() ===
      "android"
    ) {

      await LocalNotifications
        .createChannel({
          id:
            ENGAGEMENT_CHANNEL_ID,

          name:
            "GenZGames Reminders",

          description:
            "Game, leaderboard and Records reminders from GenZGames.",

          importance:
            3,

          visibility:
            1,

          sound:
            "default",

          vibration:
            true,
        });
    }


    let permission =
      await LocalNotifications
        .checkPermissions();


    if (
      permission.display ===
      "prompt"
    ) {

      permission =
        await LocalNotifications
          .requestPermissions();
    }


    if (
      permission.display !==
      "granted"
    ) {

      console.warn(
        "Game reminder notification permission was not granted.",
      );


      return false;
    }


    initialized =
      true;


    return true;

  } catch (
    error
  ) {

    console.error(
      "Unable to initialize game engagement notifications:",
      error,
    );


    return false;
  }
}


/*
 * =====================================================
 * CANCEL PENDING ENGAGEMENT REMINDERS
 * =====================================================
 */
export async function cancelGameEngagementNotifications():
Promise<void> {

  if (
    !Capacitor.isNativePlatform()
  ) {

    return;
  }


  try {

    await LocalNotifications
      .cancel({
        notifications: [
          {
            id:
              ENGAGEMENT_REMINDER_ONE_ID,
          },

          {
            id:
              ENGAGEMENT_REMINDER_TWO_ID,
          },
        ],
      });

  } catch (
    error
  ) {

    console.error(
      "Unable to cancel GenZGames engagement reminders:",
      error,
    );
  }
}


/*
 * =====================================================
 * SCHEDULE INACTIVITY REMINDERS
 * =====================================================
 *
 * Called when GenZGames goes into background.
 *
 * Example:
 *
 * User leaves at 10 AM
 *
 * Reminder 1:
 * 1 PM
 *
 * Reminder 2:
 * 4 PM
 *
 *
 * User leaves at 8 PM
 *
 * +3h = 11 PM
 *
 * Reminder 1 becomes:
 * next day 9 AM
 *
 * Reminder 2:
 * next day 12 PM
 */
export async function scheduleGameEngagementNotifications():
Promise<boolean> {

  if (
    !Capacitor.isNativePlatform()
  ) {

    return false;
  }


  const ready =
    initialized ||
    await initializeGameEngagementNotifications();


  if (
    !ready
  ) {

    return false;
  }


  try {

    /*
     * Always replace the previous inactivity schedule.
     *
     * This means opening and leaving the app resets
     * the inactivity timer.
     */
    await cancelGameEngagementNotifications();


    const now =
      new Date();


    const firstCandidate =
      new Date(
        now.getTime() +
        FIRST_REMINDER_AFTER_HOURS *
          60 *
          60 *
          1000,
      );


    const firstReminder =
      normalizeReminderTime(
        firstCandidate,
      );


    const secondCandidate =
      new Date(
        firstReminder.getTime() +
        SECOND_REMINDER_AFTER_HOURS *
          60 *
          60 *
          1000,
      );


    const secondReminder =
      normalizeReminderTime(
        secondCandidate,
      );


    await LocalNotifications
      .schedule({
        notifications: [
          {
            id:
              ENGAGEMENT_REMINDER_ONE_ID,

            title:
              "🏆 Check Today’s Leaderboard",

            body:
              "See where you rank. Play a few games, earn rewards and climb higher!",

            schedule: {
              at:
                firstReminder,
            },

            channelId:
              ENGAGEMENT_CHANNEL_ID,

            sound:
              "default",

            extra: {
              type:
                "game_engagement",

              destination:
                "leaderboard",
            },
          },

          {
            id:
              ENGAGEMENT_REMINDER_TWO_ID,

            title:
              "👑 Can You Beat a Record?",

            body:
              "Check the latest GenZGames Records and take your place in the Top 3.",

            schedule: {
              at:
                secondReminder,
            },

            channelId:
              ENGAGEMENT_CHANNEL_ID,

            sound:
              "default",

            extra: {
              type:
                "game_engagement",

              destination:
                "records",
            },
          },
        ],
      });


    console.log(
      "GenZGames engagement reminders scheduled:",
      {
        first:
          firstReminder
            .toLocaleString(),

        second:
          secondReminder
            .toLocaleString(),
      },
    );


    return true;

  } catch (
    error
  ) {

    console.error(
      "Unable to schedule GenZGames engagement reminders:",
      error,
    );


    return false;
  }
}