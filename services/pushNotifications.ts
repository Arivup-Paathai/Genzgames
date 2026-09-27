import {
  Capacitor,
} from "@capacitor/core";

import {
  PushNotifications,
  type ActionPerformed,
  type PushNotificationSchema,
  type Token,
} from "@capacitor/push-notifications";


export type MiniGamesPushType =
  | "admin_redemption"
  | "payout"
  | "admin_message";


export interface MiniGamesPushNavigation {
  type: MiniGamesPushType;

  redemptionId?: string;

  status?: string;

  notificationId?: string;

  scope?: string;
}


type NavigationHandler =
  (
    navigation:
      MiniGamesPushNavigation,
  ) => void;


type ForegroundHandler =
  (
    notification:
      PushNotificationSchema,
  ) => void;


let initialized =
  false;

let currentPushToken =
  "";

let navigationHandler:
  NavigationHandler | null =
    null;

let pendingNavigation:
  MiniGamesPushNavigation | null =
    null;


const cleanString =
  (
    value: unknown,
  ) =>
    typeof value === "string"
      ? value.trim()
      : "";


const parseNavigation =
  (
    data:
      Record<string, unknown> |
      undefined,
  ):
    MiniGamesPushNavigation |
    null => {

    if (!data) {
      return null;
    }

    const type =
      cleanString(
        data.type,
      ) as MiniGamesPushType;


    if (
      type !== "admin_redemption" &&
      type !== "payout" &&
      type !== "admin_message"
    ) {
      return null;
    }


    return {
      type,

      redemptionId:
        cleanString(
          data.redemptionId,
        ) || undefined,

      status:
        cleanString(
          data.status,
        ) || undefined,

      notificationId:
        cleanString(
          data.notificationId,
        ) || undefined,

      scope:
        cleanString(
          data.scope,
        ) || undefined,
    };
  };


const deliverNavigation =
  (
    navigation:
      MiniGamesPushNavigation,
  ) => {

    if (
      navigationHandler
    ) {
      navigationHandler(
        navigation,
      );

      pendingNavigation =
        null;

      return;
    }


    pendingNavigation =
      navigation;
  };


export const setMiniGamesPushNavigationHandler =
  (
    handler:
      NavigationHandler | null,
  ) => {

    navigationHandler =
      handler;


    if (
      !handler ||
      !pendingNavigation
    ) {
      return;
    }


    const navigation =
      pendingNavigation;

    pendingNavigation =
      null;

    handler(
      navigation,
    );
  };


export const getCurrentPushToken =
  () =>
    currentPushToken;


const createAndroidNotificationChannel =
  async () => {

    if (
      Capacitor.getPlatform() !==
      "android"
    ) {
      return;
    }


    await PushNotifications
      .createChannel({
        id:
          "mini_games_wallet",

        name:
          "GenZGames Notifications",

        description:
          "GenZGames updates, rewards, redemption and payment notifications.",

        importance:
          5,

        visibility:
          1,

        sound:
          "default",

        vibration:
          true,
      });
  };


export const initializePushNotifications =
  async (
    onToken:
      (
        token: string,
      ) =>
        void |
        Promise<void>,

    onForegroundNotification?:
      ForegroundHandler,
  ) => {

    if (
      !Capacitor.isNativePlatform() ||
      initialized
    ) {
      return;
    }


    initialized =
      true;


    await PushNotifications
      .addListener(
        "registration",
        (
          token:
            Token,
        ) => {

          currentPushToken =
            token.value.trim();


          if (
            currentPushToken
          ) {
            void onToken(
              currentPushToken,
            );
          }
        },
      );


    await PushNotifications
      .addListener(
        "registrationError",
        (
          error,
        ) => {

          console.error(
            "Push notification registration failed:",
            error,
          );
        },
      );


    await PushNotifications
      .addListener(
        "pushNotificationReceived",
        (
          notification:
            PushNotificationSchema,
        ) => {

          console.log(
            "GenZGames push received:",
            notification,
          );


          onForegroundNotification?.(
            notification,
          );
        },
      );


    await PushNotifications
      .addListener(
        "pushNotificationActionPerformed",
        (
          action:
            ActionPerformed,
        ) => {

          const data =
            action.notification
              .data as
                | Record<
                    string,
                    unknown
                  >
                | undefined;


          const navigation =
            parseNavigation(
              data,
            );


          if (
            navigation
          ) {
            deliverNavigation(
              navigation,
            );
          }
        },
      );


    let permission =
      await PushNotifications
        .checkPermissions();


    if (
      permission.receive ===
      "prompt"
    ) {
      permission =
        await PushNotifications
          .requestPermissions();
    }


    if (
      permission.receive !==
      "granted"
    ) {
      console.warn(
        "Notification permission was not granted.",
      );

      return;
    }


    try {

      await createAndroidNotificationChannel();

    } catch (error) {

      console.error(
        "Unable to create notification channel:",
        error,
      );

    }


    await PushNotifications
      .register();
  };