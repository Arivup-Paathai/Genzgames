import {
  Capacitor,
} from "@capacitor/core";

import {
  LocalNotifications,
} from "@capacitor/local-notifications";


const MINING_CHANNEL_ID =
  "genz_games_mining";


/*
 * One notification for the complete
 * Cash Mine group.
 */
const CASH_MINE_NOTIFICATION_ID =
  204803;


/*
 * One separate notification for the
 * complete Real Gold Mining group.
 */
const REAL_GOLD_NOTIFICATION_ID =
  204804;


let initialized =
  false;


export async function initializeMiningNotifications():
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
            MINING_CHANNEL_ID,

          name:
            "GenZGames Mining",

          description:
            "Notifications when your GenZGames miners are ready to collect.",

          importance:
            5,

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
        "Mining notification permission was not granted.",
      );

      return false;
    }


    initialized =
      true;


    return true;

  } catch (error) {

    console.error(
      "Unable to initialize mining notifications:",
      error,
    );


    return false;
  }
}


/*
 * =====================================================
 * CASH MINE GROUP NOTIFICATION
 * =====================================================
 */

export async function cancelGoldMineReadyNotification():
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
              CASH_MINE_NOTIFICATION_ID,
          },
        ],
      });

  } catch (error) {

    console.error(
      "Unable to cancel Cash Mine notification:",
      error,
    );
  }
}


export async function scheduleGoldMineReadyNotification(
  remainingSeconds:
    number,
):
Promise<boolean> {

  if (
    !Capacitor.isNativePlatform()
  ) {

    return false;
  }


  const ready =
    initialized ||
    await initializeMiningNotifications();


  if (
    !ready
  ) {

    return false;
  }


  const safeRemainingSeconds =
    Math.max(
      1,

      Math.floor(
        remainingSeconds,
      ),
    );


  try {

    /*
     * There is only ONE Cash Mine notification.
     *
     * Scheduling again replaces the previous
     * reminder with the latest group completion
     * time.
     */
    await cancelGoldMineReadyNotification();


    await LocalNotifications
      .schedule({
        notifications: [
          {
            id:
              CASH_MINE_NOTIFICATION_ID,

            title:
              "⛏️ Cash Mining Complete!",

            body:
              "Your Cash Miners are ready. Open GenZGames and collect your rewards.",

            schedule: {
              at:
                new Date(
                  Date.now() +
                  safeRemainingSeconds *
                    1000,
                ),
            },

            channelId:
              MINING_CHANNEL_ID,

            sound:
              "default",

            extra: {
              type:
                "cash_mine_ready",
            },
          },
        ],
      });


    return true;

  } catch (error) {

    console.error(
      "Unable to schedule Cash Mine notification:",
      error,
    );


    return false;
  }
}


/*
 * =====================================================
 * REAL GOLD MINING GROUP NOTIFICATION
 * =====================================================
 */

export async function cancelRealGoldMineReadyNotification():
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
              REAL_GOLD_NOTIFICATION_ID,
          },
        ],
      });

  } catch (error) {

    console.error(
      "Unable to cancel Real Gold Mining notification:",
      error,
    );
  }
}


export async function scheduleRealGoldMineReadyNotification(
  remainingSeconds:
    number,
):
Promise<boolean> {

  if (
    !Capacitor.isNativePlatform()
  ) {

    return false;
  }


  const ready =
    initialized ||
    await initializeMiningNotifications();


  if (
    !ready
  ) {

    return false;
  }


  const safeRemainingSeconds =
    Math.max(
      1,

      Math.floor(
        remainingSeconds,
      ),
    );


  try {

    /*
     * There is only ONE Real Gold Mining
     * notification for both Gold Miners.
     */
    await cancelRealGoldMineReadyNotification();


    await LocalNotifications
      .schedule({
        notifications: [
          {
            id:
              REAL_GOLD_NOTIFICATION_ID,

            title:
              "🪙 Gold Mining Complete!",

            body:
              "Your Gold Miners are ready. Open GenZGames and collect your Gold + Diamonds.",

            schedule: {
              at:
                new Date(
                  Date.now() +
                  safeRemainingSeconds *
                    1000,
                ),
            },

            channelId:
              MINING_CHANNEL_ID,

            sound:
              "default",

            extra: {
              type:
                "real_gold_mine_ready",
            },
          },
        ],
      });


    return true;

  } catch (error) {

    console.error(
      "Unable to schedule Real Gold Mining notification:",
      error,
    );


    return false;
  }
}