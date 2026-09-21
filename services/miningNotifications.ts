import {
  Capacitor,
} from "@capacitor/core";

import {
  LocalNotifications,
} from "@capacitor/local-notifications";


const MINING_NOTIFICATION_ID =
  204803;


const MINING_CHANNEL_ID =
  "genz_games_mining";


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
            "Gold Mine",

          description:
            "Notifications when your GenZGames Gold Mine is ready to collect.",

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
        "Gold Mine notification permission was not granted.",
      );

      return false;
    }


    initialized =
      true;


    return true;

  } catch (error) {

    console.error(
      "Unable to initialize Gold Mine notifications:",
      error,
    );


    return false;
  }
}


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
              MINING_NOTIFICATION_ID,
          },
        ],
      });

  } catch (error) {

    console.error(
      "Unable to cancel Gold Mine notification:",
      error,
    );
  }
}


export async function scheduleGoldMineReadyNotification(
  remainingSeconds:
    number,

  rewardPaise =
    3,

  diamonds =
    2,
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
     * One Gold Mine cycle can exist
     * at a time.
     *
     * Cancel the previous scheduled
     * notification before creating
     * the new one.
     */
    await cancelGoldMineReadyNotification();


    const rewardRupees =
      (
        rewardPaise /
        100
      ).toFixed(
        2,
      );


    await LocalNotifications
      .schedule({
        notifications: [
          {
            id:
              MINING_NOTIFICATION_ID,

            title:
              "⛏️ Mining Complete!",

            body:
              `Your Gold Mine is full. Collect ₹${rewardRupees} + ${diamonds} 💎 now.`,

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
                "gold_mine_ready",
            },
          },
        ],
      });


    return true;

  } catch (error) {

    console.error(
      "Unable to schedule Gold Mine notification:",
      error,
    );


    return false;
  }
}