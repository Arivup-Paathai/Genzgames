import {
  AdMob,
  BannerAdOptions,
  BannerAdPosition,
  BannerAdSize,
  InterstitialAdPluginEvents,
  RewardAdPluginEvents,
  type AdOptions,
  type RewardAdOptions,
} from "@capacitor-community/admob";

import {
  Capacitor,
  type PluginListenerHandle,
} from "@capacitor/core";


// ------------------------------------------------------------
// // GenZGames production AdMob units
// ------------------------------------------------------------

// Rewarded:
// - Sudoku hint
// - Restore lives
// - Unlock next level
const REWARDED_AD_ID =
  "ca-app-pub-8415981787960817/9332723517";


// App-wide adaptive banner:
// Home + Sudoku + Gold Mine + Wallet/Admin screens
const BANNER_AD_ID =
  "ca-app-pub-8415981787960817/6111256937";


// Gold Mine start interstitial
const MINING_INTERSTITIAL_AD_ID =
  "ca-app-pub-8415981787960817/8715957715";


// IMPORTANT:
// Keep true while testing from Android Studio.
// Change to false only for production / Play Store release.
const USE_TEST_ADS = false;


let initialized = false;
let rewardBusy = false;
let interstitialBusy = false;
let bannerVisible = false;


// ------------------------------------------------------------
// Initialize AdMob
// ------------------------------------------------------------

export async function initializeAdMob():
Promise<void> {

  if (
    !Capacitor.isNativePlatform() ||
    initialized
  ) {
    return;
  }

  try {

    await AdMob.initialize();

    initialized = true;

  } catch (error) {

    console.error(
      "AdMob initialization failed:",
      error,
    );

  }

}


// ------------------------------------------------------------
// GenZGames entry interstitial
// Not used
// ------------------------------------------------------------

export async function showGenZGamesEntryInterstitial():
Promise<boolean> {

  return false;

}


// ------------------------------------------------------------
// Gold Mine interstitial
//
// User taps Start
// → Interstitial opens
// → User closes ad
// → Mining start flow continues
//
// If ad fails, mining must still continue.
// ------------------------------------------------------------

export async function showGenZGoldMineInterstitial():
Promise<boolean> {

  if (
    !Capacitor.isNativePlatform() ||
    interstitialBusy
  ) {
    return false;
  }


  interstitialBusy = true;


  let dismissedListener:
    PluginListenerHandle |
    null =
      null;

  let failedListener:
    PluginListenerHandle |
    null =
      null;


  try {

    await initializeAdMob();


    const options:
      AdOptions = {

        adId:
          MINING_INTERSTITIAL_AD_ID,

        isTesting:
          USE_TEST_ADS,

      };


    await AdMob.prepareInterstitial(
      options,
    );


    let finish:
      (
        value: boolean,
      ) => void =
        () => {};


    const finished =
      new Promise<boolean>(
        (
          resolve,
        ) => {

          finish =
            resolve;

        },
      );


    dismissedListener =
      await AdMob.addListener(
        InterstitialAdPluginEvents.Dismissed,
        () => {

          finish(
            true,
          );

        },
      );


    failedListener =
      await AdMob.addListener(
        InterstitialAdPluginEvents.FailedToShow,
        () => {

          finish(
            false,
          );

        },
      );


    await AdMob.showInterstitial();


    return await finished;

  } catch (error) {

    console.error(
      "Gold Mine interstitial failed:",
      error,
    );

    return false;

  } finally {

    interstitialBusy =
      false;


    await dismissedListener
      ?.remove();

    await failedListener
      ?.remove();

  }

}


// ------------------------------------------------------------
// Rewarded ad
//
// Used for:
// - Hint
// - Restore lives
// - Unlock next Sudoku level
// ------------------------------------------------------------

export async function showGenZGamesRewardedAd():
Promise<boolean> {

  if (
    !Capacitor.isNativePlatform() ||
    rewardBusy
  ) {
    return false;
  }


  rewardBusy =
    true;


  let rewarded =
    false;


  let rewardedListener:
    PluginListenerHandle |
    null =
      null;

  let dismissedListener:
    PluginListenerHandle |
    null =
      null;

  let failedListener:
    PluginListenerHandle |
    null =
      null;


  try {

    await initializeAdMob();


    const options:
      RewardAdOptions = {

        adId:
          REWARDED_AD_ID,

        isTesting:
          USE_TEST_ADS,

      };


    await AdMob.prepareRewardVideoAd(
      options,
    );


    let finish:
      (
        value: boolean,
      ) => void =
        () => {};


    const finished =
      new Promise<boolean>(
        (
          resolve,
        ) => {

          finish =
            resolve;

        },
      );


    rewardedListener =
      await AdMob.addListener(
        RewardAdPluginEvents.Rewarded,
        () => {

          rewarded =
            true;

        },
      );


    dismissedListener =
      await AdMob.addListener(
        RewardAdPluginEvents.Dismissed,
        () => {

          finish(
            rewarded,
          );

        },
      );


    failedListener =
      await AdMob.addListener(
        RewardAdPluginEvents.FailedToShow,
        () => {

          finish(
            false,
          );

        },
      );


    await AdMob.showRewardVideoAd();


    return await finished;

  } catch (error) {

    console.error(
      "Rewarded ad failed:",
      error,
    );

    return false;

  } finally {

    rewardBusy =
      false;


    await rewardedListener
      ?.remove();

    await dismissedListener
      ?.remove();

    await failedListener
      ?.remove();

  }

}


// ------------------------------------------------------------
// App-wide adaptive banner
//
// Home
// Sudoku
// Gold Mine
// Revenue
// Admin
//
// One banner only.
// ------------------------------------------------------------

export async function showGenZGoldMineBanner():
Promise<boolean> {

  if (
    !Capacitor.isNativePlatform()
  ) {
    return false;
  }


  if (
    bannerVisible
  ) {
    return true;
  }


  try {

    await initializeAdMob();


    const options:
      BannerAdOptions = {

        adId:
          BANNER_AD_ID,

        adSize:
          BannerAdSize.ADAPTIVE_BANNER,

        position:
          BannerAdPosition.BOTTOM_CENTER,

        margin:
          0,

        isTesting:
          USE_TEST_ADS,

      };


    await AdMob.showBanner(
      options,
    );


    bannerVisible =
      true;


    return true;

  } catch (error) {

    console.error(
      "Adaptive banner failed:",
      error,
    );


    bannerVisible =
      false;


    return false;

  }

}


// ------------------------------------------------------------
// Banner stays alive across the whole GenZGames.
//
// Gold Mine may call this during unmount,
// but we deliberately do NOT remove the banner.
// ------------------------------------------------------------

export async function removeGenZGoldMineBanner():
Promise<void> {

  return;

}