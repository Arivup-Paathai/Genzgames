import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  Capacitor,
} from "@capacitor/core";

import {
  FirebaseAuthentication,
} from "@capacitor-firebase/authentication";

import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithCredential,
  signInWithPopup,
  signOut as firebaseSignOut,
} from "firebase/auth";

import {
  httpsCallable,
} from "firebase/functions";

import {
  auth,
  functions,
} from "../firebase";

import {
  getCurrentPushToken,
  initializePushNotifications,
} from "../services/pushNotifications";


export type MiniGamesRole =
  | "user"
  | "admin"
  | "super_admin";


export interface MiniGamesUser {
  id: string;

  email?: string;

  displayName: string;

  photoUrl?: string;

  phoneNumber?: string;

  dateOfBirth?: string;

  country?: string;

  referralId?: string;

  referredByReferralId?: string;

  role: MiniGamesRole;
}


type ToastType =
  | "success"
  | "error"
  | "info";


interface Toast {
  id: number;

  message: string;

  type: ToastType;
}


interface AuthValue {
  currentUser:
    MiniGamesUser |
    null;

  isAuthLoading:
    boolean;

  isAdmin:
    boolean;

  signInWithGoogle:
    () => Promise<void>;

  signOutUser:
    () => Promise<void>;

  refreshProfile:
  () => Promise<void>;

  addToast:
    (
      message: string,
      type?: ToastType,
    ) => void;
}


const AuthContext =
  createContext<
    AuthValue |
    null
  >(
    null,
  );


interface MiniGamesProfileResult {
  success: boolean;

  profile:
    MiniGamesUser;
}


const ensureProfile =
  httpsCallable<
    void,
    MiniGamesProfileResult
  >(
    functions,
    "ensureMiniGamesUserProfile",
  );


const getProfile =
  httpsCallable<
    void,
    MiniGamesProfileResult
  >(
    functions,
    "getMiniGamesProfile",
  );


export const AuthProvider:
React.FC<
  React.PropsWithChildren
> =
  ({
    children,
  }) => {

    const [
      currentUser,
      setCurrentUser,
    ] =
      useState<
        MiniGamesUser |
        null
      >(
        null,
      );


    const [
      isAuthLoading,
      setIsAuthLoading,
    ] =
      useState(
        true,
      );


    const [
      toasts,
      setToasts,
    ] =
      useState<
        Toast[]
      >(
        [],
      );


    // ------------------------------------------------------------
    // Toast
    // ------------------------------------------------------------

    const addToast =
      useCallback(
        (
          message:
            string,

          type:
            ToastType =
              "info",
        ) => {

          const id =
            Date.now() +
            Math.floor(
              Math.random() *
              1000,
            );


          setToasts(
            (
              items,
            ) => [
              ...items,
              {
                id,
                message,
                type,
              },
            ],
          );


          window.setTimeout(
            () =>
              setToasts(
                (
                  items,
                ) =>
                  items.filter(
                    (
                      item,
                    ) =>
                      item.id !==
                      id,
                  ),
              ),

            3200,
          );

        },
        [],
      );


    // ------------------------------------------------------------
    // Register FCM device
    // IMPORTANT:
    // Declared BEFORE any useEffect that uses it.
    // ------------------------------------------------------------

    const registerPushDevice =
      useCallback(
        async (
          token:
            string,
        ) => {

          const cleanToken =
            token.trim();


          if (
            !cleanToken ||
            !auth.currentUser ||
            !Capacitor.isNativePlatform()
          ) {
            return;
          }


          try {

            const callable =
              httpsCallable<
                {
                  token:
                    string;

                  platform:
                    string;
                },
                {
                  success:
                    boolean;

                  deviceId:
                    string;
                }
              >(
                functions,
                "registerPushDevice",
              );


            await callable({
              token:
                cleanToken,

              platform:
                Capacitor.getPlatform(),
            });

          } catch (
            error
          ) {

            console.error(
              "Unable to register push device:",
              error,
            );

          }
        },
        [],
      );


    // ------------------------------------------------------------
    // Unregister FCM device
    // ------------------------------------------------------------

    const unregisterPushDevice =
      useCallback(
        async (
          token:
            string,
        ) => {

          const cleanToken =
            token.trim();


          if (
            !cleanToken ||
            !auth.currentUser ||
            !Capacitor.isNativePlatform()
          ) {
            return;
          }


          try {

            const callable =
              httpsCallable<
                {
                  token:
                    string;
                },
                {
                  success:
                    boolean;
                }
              >(
                functions,
                "unregisterPushDevice",
              );


            await callable({
              token:
                cleanToken,
            });

          } catch (
            error
          ) {

            console.error(
              "Unable to unregister push device:",
              error,
            );

          }
        },
        [],
      );
const refreshProfile =
  useCallback(
    async () => {

      if (
        !auth.currentUser
      ) {
        return;
      }


      try {

        const result =
          await getProfile();


        setCurrentUser(
          result.data
            .profile,
        );

      } catch (
        error
      ) {

        console.error(
          "Unable to refresh GenZGames profile:",
          error,
        );

      }
    },
    [],
  );

    // ------------------------------------------------------------
    // Initialize native push notifications
    // ------------------------------------------------------------

    useEffect(
      () => {

        if (
          !Capacitor.isNativePlatform()
        ) {
          return;
        }


        void initializePushNotifications(
          async (
            token,
          ) => {

            if (
              !auth.currentUser
            ) {
              return;
            }


            await registerPushDevice(
              token,
            );
          },

          (
            notification,
          ) => {

            const title =
              notification
                .title
                ?.trim() ||
              "GenZGames";


            const body =
              notification
                .body
                ?.trim() ||
              "";


            addToast(
              body
                ? `${title}: ${body}`
                : title,

              "info",
            );
          },
        );

      },
      [
        addToast,
        registerPushDevice,
      ],
    );


    // ------------------------------------------------------------
    // Firebase Auth listener
    // ------------------------------------------------------------

    useEffect(
      () => {

        const unsubscribe =
          onAuthStateChanged(
            auth,

            async (
              user,
            ) => {

              if (
                !user
              ) {

                setCurrentUser(
                  null,
                );

                setIsAuthLoading(
                  false,
                );

                return;
              }


              try {

  const result =
    await ensureProfile();


  setCurrentUser(
    result.data
      .profile,
  );

} catch (
  error
) {

  console.error(
    "Unable to ensure GenZGames profile:",
    error,
  );


  setCurrentUser({
    id:
      user.uid,

    email:
      user.email ??
      undefined,

    displayName:
      user
        .displayName
        ?.trim() ||
      "Player",

    photoUrl:
      user.photoURL ??
      undefined,

    role:
      "user",
  });

}


              // If FCM registration happened before Google sign-in,
              // register the already-known token now.
              const existingPushToken =
                getCurrentPushToken();


              if (
                existingPushToken
              ) {

                void registerPushDevice(
                  existingPushToken,
                );

              }


              setIsAuthLoading(
                false,
              );
            },
          );


        return () => {
          unsubscribe();
        };

      },
      [
        registerPushDevice,
      ],
    );


    // ------------------------------------------------------------
    // Google Sign-In
    // ------------------------------------------------------------

    const signInWithGoogle =
      useCallback(
        async () => {

          try {

            if (
              Capacitor.isNativePlatform()
            ) {

              const native =
                await FirebaseAuthentication
                  .signInWithGoogle({
                    skipNativeAuth:
                      true,
                  });


              const idToken =
                native
                  .credential
                  ?.idToken;


              if (
                !idToken
              ) {
                throw new Error(
                  "Google Sign-In did not return an ID token.",
                );
              }


              const credential =
                GoogleAuthProvider
                  .credential(
                    idToken,

                    native
                      .credential
                      ?.accessToken ??
                      undefined,
                  );


              await signInWithCredential(
                auth,
                credential,
              );

            } else {

              const provider =
                new GoogleAuthProvider();


              provider
                .setCustomParameters({
                  prompt:
                    "select_account",
                });


              await signInWithPopup(
                auth,
                provider,
              );

            }


            addToast(
              "Signed in successfully.",
              "success",
            );

          } catch (
            error
          ) {

            console.error(
              "Google sign-in failed:",
              error,
            );


            const message =
              error instanceof
                Error
                ? error.message
                : String(
                    error,
                  );


            if (
              message
                .trim()
                .startsWith(
                  "7:",
                )
            ) {

              addToast(
                "Google sign-in could not connect. Check your internet or Google Play services and try again.",
                "error",
              );

            } else {

              addToast(
                "Google sign-in failed. Please try again.",
                "error",
              );

            }

          }
        },
        [
          addToast,
        ],
      );


    // ------------------------------------------------------------
    // Sign-Out
    // Remove push token BEFORE Firebase sign-out.
    // ------------------------------------------------------------

    const signOutUser =
      useCallback(
        async () => {

          try {

            const pushToken =
              getCurrentPushToken();


            if (
              pushToken
            ) {

              await unregisterPushDevice(
                pushToken,
              );

            }


            await firebaseSignOut(
              auth,
            );


            if (
              Capacitor.isNativePlatform()
            ) {

              await FirebaseAuthentication
                .signOut();

            }


            addToast(
              "Signed out.",
              "info",
            );

          } catch (
            error
          ) {

            console.error(
              "Sign out failed:",
              error,
            );


            addToast(
              "Unable to sign out.",
              "error",
            );

          }
        },
        [
          addToast,
          unregisterPushDevice,
        ],
      );


    // ------------------------------------------------------------
    // Context value
    // ------------------------------------------------------------

    const value =
      useMemo<
        AuthValue
      >(
        () => ({
          currentUser,

          isAuthLoading,

          isAdmin:
            currentUser
              ?.role ===
              "admin" ||
            currentUser
              ?.role ===
              "super_admin",

          signInWithGoogle,

          signOutUser,

refreshProfile,

addToast,
        }),

        [
          currentUser,
          isAuthLoading,
          signInWithGoogle,
          signOutUser,
          addToast,
          refreshProfile,
        ],
      );


    return (
      <AuthContext.Provider
        value={
          value
        }
      >

        {children}

        <div className="fixed left-1/2 top-[calc(env(safe-area-inset-top)+12px)] z-[500] w-[min(92vw,420px)] -translate-x-1/2 space-y-2 pointer-events-none">

          {toasts.map(
            (
              toast,
            ) => (

              <div
                key={
                  toast.id
                }

                className={`rounded-2xl border px-4 py-3 text-sm font-bold shadow-2xl backdrop-blur ${
                  toast.type ===
                  "error"

                    ? "border-red-400/30 bg-red-950/90 text-red-100"

                    : toast.type ===
                      "success"

                      ? "border-emerald-400/30 bg-emerald-950/90 text-emerald-100"

                      : "border-white/10 bg-zinc-900/95 text-white"
                }`}
              >

                {
                  toast.message
                }

              </div>

            ),
          )}

        </div>

      </AuthContext.Provider>
    );
  };


export const useAuth =
  () => {

    const value =
      useContext(
        AuthContext,
      );


    if (
      !value
    ) {
      throw new Error(
        "useAuth must be used inside AuthProvider",
      );
    }


    return value;
  };