import React, {
  useEffect,
  useState,
} from "react";

import {
  ArrowLeft,
  CalendarDays,
  Camera,
  Copy,
  Gift,
  Globe2,
  LockKeyhole,
  LogOut,
  Mail,
  Moon,
  Phone,
  Save,
  Sun,
  Trash2,
  UserCircle,
} from "lucide-react";



import {
  httpsCallable,
} from "firebase/functions";

import {
  functions,
} from "../firebase";

import {
  useAuth,
} from "../context/AuthContext";

import {
  cloudflareR2,
} from "../services/cloudflare/stream";


export type ThemeMode =
  | "dark"
  | "light";


interface ProfileProps {
  onBack:
    () => void;

  theme:
    ThemeMode;

  onThemeChange:
    (
      theme:
        ThemeMode,
    ) => void;
}


const MAX_PROFILE_PHOTO_BYTES =
  5 *
  1024 *
  1024;


const updateProfile =
  httpsCallable<
    {
      gamerName:
        string;

      dateOfBirth:
        string;

      phoneNumber:
        string;

      country:
        string;
    },
    {
      success:
        boolean;
    }
  >(
    functions,
    "updateMiniGamesProfile",
  );

  const createProfilePhotoUploadUrl =
  httpsCallable<
    {
      contentType:
        string;

      size:
        number;
    },
    {
      success:
        boolean;

      uploadUrl:
        string;

      expiresInSeconds:
        number;
    }
  >(
    functions,
    "createGenZGamesProfilePhotoUploadUrl",
  );


const confirmProfilePhotoUpload =
  httpsCallable<
    void,
    {
      success:
        boolean;

      photoUrl:
        string;
    }
  >(
    functions,
    "confirmGenZGamesProfilePhotoUpload",
  );


export const Profile:
React.FC<
  ProfileProps
> =
  ({
    onBack,
    theme,
    onThemeChange,
  }) => {

    const {
      currentUser,
      refreshProfile,
      signOutUser,
      addToast,
    } =
      useAuth();


    const [
      gamerName,
      setGamerName,
    ] =
      useState(
        currentUser
          ?.displayName ??
        "",
      );


    const [
      dateOfBirth,
      setDateOfBirth,
    ] =
      useState(
        currentUser
          ?.dateOfBirth ??
        "",
      );


    const [
      phoneNumber,
      setPhoneNumber,
    ] =
      useState(
        currentUser
          ?.phoneNumber ??
        "",
      );


    const [
      country,
      setCountry,
    ] =
      useState(
        currentUser
          ?.country ??
        "",
      );
    const [
      referredByInput,
      setReferredByInput,
    ] =
      useState(
        currentUser
          ?.referredByReferralId ??
        "",
      );


    const [
      applyingReferral,
      setApplyingReferral,
    ] =
      useState(
        false,
      );

    const [
      selectedPhoto,
      setSelectedPhoto,
    ] =
      useState<
        File |
        null
      >(
        null,
      );


    const [
      photoPreview,
      setPhotoPreview,
    ] =
      useState(
        currentUser
          ?.photoUrl ??
        "",
      );


    const [
      saving,
      setSaving,
    ] =
      useState(
        false,
      );


    useEffect(
      () => {

        setGamerName(
          currentUser
            ?.displayName ??
          "",
        );

        setDateOfBirth(
          currentUser
            ?.dateOfBirth ??
          "",
        );

        setPhoneNumber(
          currentUser
            ?.phoneNumber ??
          "",
        );

        setCountry(
          currentUser
            ?.country ??
          "",
        );


        setReferredByInput(
          currentUser
            ?.referredByReferralId ??
          "",
        );


        setPhotoPreview(
          currentUser
            ?.photoUrl ??
          "",
        );

      },
      [
        currentUser,
      ],
    );


    if (
      !currentUser
    ) {
      return null;
    }


    const handlePhoto =
      (
        event:
          React.ChangeEvent<
            HTMLInputElement
          >,
      ) => {

        const file =
          event.target
            .files
            ?.[0];


        if (
          !file
        ) {
          return;
        }


        const allowedTypes =
          [
            "image/jpeg",
            "image/png",
            "image/webp",
          ];


        if (
          !allowedTypes.includes(
            file.type,
          )
        ) {

          addToast(
            "Use JPG, PNG or WEBP for your profile photo.",
            "error",
          );

          event.target.value =
            "";

          return;
        }


        if (
          file.size >
          MAX_PROFILE_PHOTO_BYTES
        ) {

          addToast(
            "Profile photo must be 5 MB or smaller.",
            "error",
          );

          event.target.value =
            "";

          return;
        }


        setSelectedPhoto(
          file,
        );


        setPhotoPreview(
          URL.createObjectURL(
            file,
          ),
        );
      };


    const saveProfile =
      async () => {

        const cleanName =
          gamerName.trim();


        if (
          cleanName.length <
          3
        ) {
          addToast(
            "Gamer Name must be at least 3 characters.",
            "error",
          );

          return;
        }


        setSaving(
          true,
        );


        try {

          let profileDetailsSaved =
  false;


await updateProfile({
  gamerName:
    cleanName,

  dateOfBirth,

  phoneNumber:
    phoneNumber.trim(),

  country:
    country.trim(),
});


profileDetailsSaved =
  true;


if (
  selectedPhoto
) {

  const uploadRequest =
    await createProfilePhotoUploadUrl({
      contentType:
        selectedPhoto.type,

      size:
        selectedPhoto.size,
    });


  const uploadResponse =
    await fetch(
      uploadRequest
        .data
        .uploadUrl,

      {
        method:
          "PUT",

        headers: {
          "Content-Type":
            selectedPhoto.type,
        },

        body:
          selectedPhoto,
      },
    );


  if (
    !uploadResponse.ok
  ) {

    console.error(
      "R2 profile photo upload failed:",
      uploadResponse.status,
      uploadResponse.statusText,
    );


    if (
      profileDetailsSaved
    ) {
      throw new Error(
        "PROFILE_PHOTO_UPLOAD_FAILED_AFTER_DETAILS",
      );
    }


    throw new Error(
      "PROFILE_PHOTO_UPLOAD_FAILED",
    );
  }


  await confirmProfilePhotoUpload();
}


await refreshProfile();


setSelectedPhoto(
  null,
);


addToast(
  "Profile updated successfully.",
  "success",
);


        } catch (
          error
        ) {

          console.error(
            "Profile update failed:",
            error,
          );


          const code =
            (
              error as {
                code?: string;
              }
            ).code;


          if (
  code ===
  "functions/already-exists"
) {

  addToast(
    "That Gamer Name is already taken. Try another one.",
    "error",
  );

} else if (
  error instanceof
    Error &&
  error.message ===
    "PROFILE_PHOTO_UPLOAD_FAILED_AFTER_DETAILS"
) {

  await refreshProfile();


  addToast(
    "Profile details were saved, but the photo upload failed. Please try the photo again.",
    "error",
  );

} else {

  addToast(
    "Unable to update profile. Please try again.",
    "error",
  );
}

        } finally {

          setSaving(
            false,
          );
        }
      };
        const copyReferralId =
      async () => {

        const referralId =
          currentUser
            .referralId
            ?.trim() ??
          "";


        if (
          !referralId
        ) {

          addToast(
            "Referral ID is not available yet.",
            "info",
          );

          return;
        }


        try {

          await navigator
            .clipboard
            .writeText(
              referralId,
            );


          addToast(
            "Referral ID copied.",
            "success",
          );

        } catch (
          error
        ) {

          console.error(
            "Unable to copy referral ID:",
            error,
          );


          addToast(
            "Unable to copy the referral ID.",
            "error",
          );
        }
      };


    const applyReferral =
      async () => {

        if (
          currentUser
            .referredByReferralId
        ) {

          addToast(
            "A referral ID has already been applied to this account.",
            "info",
          );

          return;
        }


        const referralId =
          referredByInput
            .trim()
            .toUpperCase();


        if (
          !referralId
        ) {

          addToast(
            "Enter a referral ID.",
            "error",
          );

          return;
        }


        if (
          referralId ===
          currentUser
            .referralId
            ?.trim()
            .toUpperCase()
        ) {

          addToast(
            "You cannot use your own referral ID.",
            "error",
          );

          return;
        }


        setApplyingReferral(
          true,
        );


        try {

          const result =
            await cloudflareR2
              .applyGenZGamesReferral(
                referralId,
              );


          await refreshProfile();


          setReferredByInput(
            result.referralId,
          );


          addToast(
            `Referral applied successfully. The referrer received ${result.diamondsGranted} 💎.`,
            "success",
          );

        } catch (
          error
        ) {

          console.error(
            "Unable to apply GenZGames referral:",
            error,
          );


          const code =
            (
              error as {
                code?:
                  string;
              }
            ).code ??
            "";


          if (
            code ===
            "functions/not-found"
          ) {

            addToast(
              "Referral ID was not found.",
              "error",
            );

          } else if (
            code ===
            "functions/failed-precondition"
          ) {

            addToast(
              "A referral ID has already been applied to this account.",
              "error",
            );

          } else if (
            code ===
            "functions/invalid-argument"
          ) {

            addToast(
              "Enter a valid referral ID.",
              "error",
            );

          } else {

            addToast(
              "Unable to apply the referral ID. Please try again.",
              "error",
            );
          }

        } finally {

          setApplyingReferral(
            false,
          );
        }
      };


    const requestAccountDeletion =
      () => {

        const subject =
          encodeURIComponent(
            "GenZGames - Account Deletion Request",
          );


        const body =
          encodeURIComponent(
            [
              "Hello Arivup Paathai,",
              "",
              "I would like to request deletion of my GenZGames account and associated account data.",
              "",
              `Gamer Name: ${currentUser.displayName}`,
              `Registered Email: ${currentUser.email ?? ""}`,
              `User ID: ${currentUser.id}`,
              "",
              "Thank you.",
            ].join(
              "\n",
            ),
          );


        window.location.href =
          `mailto:arivuppaathai@gmail.com?subject=${subject}&body=${body}`;
      };


    const inputClass =
      "mt-2 w-full rounded-2xl border app-border app-input px-4 py-3 text-sm app-text outline-none transition focus:border-orange-500";


    return (
      <div
        className="min-h-screen app-bg app-text"
        style={{
          paddingBottom:
            "calc(100px + env(safe-area-inset-bottom))",
        }}
      >

        <header
          className="sticky top-0 z-[120] border-b app-border bg-[var(--app-bg)]/95 px-4 pb-3 backdrop-blur"
          style={{
            paddingTop:
              "calc(env(safe-area-inset-top) + 10px)",
          }}
        >

          <div className="mx-auto flex max-w-3xl items-center gap-3">

            <button
              type="button"
              onClick={
                onBack
              }
              className="flex h-10 w-10 items-center justify-center rounded-full border app-border app-surface"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>

            <div>

              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-orange-500">
                GenZGames
              </p>

              <h1 className="text-lg font-black">
                Profile
              </h1>

            </div>

          </div>

        </header>


        <main className="mx-auto max-w-3xl space-y-4 px-4 py-5">

          <section className="rounded-3xl border app-border app-surface p-5">

            <div className="flex flex-col items-center">

              <div className="relative">

                {photoPreview ? (

                  <img
                    src={
                      photoPreview
                    }
                    alt="Profile"
                    className="h-28 w-28 rounded-full object-cover ring-4 ring-orange-500/20"
                  />

                ) : (

                  <div className="flex h-28 w-28 items-center justify-center rounded-full app-surface-secondary ring-4 ring-orange-500/20">
                    <UserCircle className="h-16 w-16 app-text-secondary" />
                  </div>

                )}


                <label className="absolute -bottom-1 -right-1 flex h-10 w-10 cursor-pointer items-center justify-center rounded-full bg-orange-500 text-white shadow-xl">

                  <Camera className="h-5 w-5" />

                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={
                      handlePhoto
                    }
                  />

                </label>

              </div>


              <p className="mt-3 text-xs app-text-secondary">
                JPG, PNG or WEBP • Maximum 5 MB
              </p>

            </div>

          </section>


          <section className="space-y-5 rounded-3xl border app-border app-surface p-5">

            <div>

              <label className="text-xs font-black uppercase tracking-wider app-text-secondary">
                Gamer Name
              </label>

              <input
                value={
                  gamerName
                }
                onChange={
                  (
                    event,
                  ) =>
                    setGamerName(
                      event.target
                        .value,
                    )
                }
                maxLength={
                  24
                }
                className={
                  inputClass
                }
                placeholder="Choose a unique Gamer Name"
              />

              <p className="mt-2 text-[11px] app-text-muted">
                Gamer Names are unique. 3–24 characters.
              </p>

            </div>


            <div>

              <label className="flex items-center gap-2 text-xs font-black uppercase tracking-wider app-text-secondary">
                <CalendarDays className="h-4 w-4" />
                Date of Birth
              </label>

              <input
                type="date"
                value={
                  dateOfBirth
                }
                max={
                  new Date()
                    .toISOString()
                    .slice(
                      0,
                      10,
                    )
                }
                onChange={
                  (
                    event,
                  ) =>
                    setDateOfBirth(
                      event.target
                        .value,
                    )
                }
                className={
                  inputClass
                }
              />

            </div>


            <div>

              <label className="flex items-center gap-2 text-xs font-black uppercase tracking-wider app-text-secondary">
                <Mail className="h-4 w-4" />
                Email
              </label>

              <input
                value={
                  currentUser.email ??
                  ""
                }
                readOnly
                className={`${inputClass} opacity-70`}
              />

              <p className="mt-2 text-[11px] app-text-muted">
                Email comes from your Google account and cannot be changed here.
              </p>

            </div>


            <div>

              <label className="flex items-center gap-2 text-xs font-black uppercase tracking-wider app-text-secondary">
                <Phone className="h-4 w-4" />
                Phone Number
              </label>

              <input
                type="tel"
                value={
                  phoneNumber
                }
                onChange={
                  (
                    event,
                  ) =>
                    setPhoneNumber(
                      event.target
                        .value,
                    )
                }
                className={
                  inputClass
                }
                placeholder="+91 9876543210"
              />

            </div>


            <div>

              <label className="flex items-center gap-2 text-xs font-black uppercase tracking-wider app-text-secondary">
                <Globe2 className="h-4 w-4" />
                Country
              </label>

              <input
                value={
                  country
                }
                onChange={
                  (
                    event,
                  ) =>
                    setCountry(
                      event.target
                        .value,
                    )
                }
                className={
                  inputClass
                }
                placeholder="India"
              />

            </div>

          </section>


          <section className="rounded-3xl border app-border app-surface p-5">

            <div className="flex items-start gap-3">

              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-500">

                <Gift className="h-5 w-5" />

              </div>


              <div className="min-w-0 flex-1">

                <h2 className="font-black">
                  Referral
                </h2>

                <p className="mt-1 text-xs app-text-muted">
                  Invite new players and earn 20 daily leaderboard diamonds when they successfully use your Referral ID.
                </p>

              </div>

            </div>


            <div className="mt-5">

              <label className="text-xs font-black uppercase tracking-wider app-text-secondary">
                Your Referral ID
              </label>


              <div className="mt-2 flex items-center gap-2">

                <div className="min-w-0 flex-1 rounded-2xl border app-border app-input px-4 py-3">

                  <p className="truncate font-mono text-sm font-black text-cyan-500">
                    {
                      currentUser
                        .referralId ||
                      "Preparing..."
                    }
                  </p>

                </div>


                <button
                  type="button"
                  disabled={
                    !currentUser
                      .referralId
                  }
                  onClick={() =>
                    void copyReferralId()
                  }
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border app-border app-surface-secondary transition disabled:opacity-40"
                  aria-label="Copy referral ID"
                >

                  <Copy className="h-4 w-4" />

                </button>

              </div>


              <p className="mt-2 text-[11px] app-text-muted">
                Your Referral ID is permanent and cannot be changed.
              </p>

            </div>


            <div className="mt-6">

              <label className="text-xs font-black uppercase tracking-wider app-text-secondary">
                Referred By
              </label>


              {currentUser
                .referredByReferralId ? (

                <div className="mt-2">

                  <div className="flex items-center gap-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3">

                    <LockKeyhole className="h-4 w-4 shrink-0 text-emerald-500" />


                    <div className="min-w-0 flex-1">

                      <p className="truncate font-mono text-sm font-black text-emerald-500">
                        {
                          currentUser
                            .referredByReferralId
                        }
                      </p>

                      <p className="mt-1 text-[10px] app-text-muted">
                        Referral locked to this account
                      </p>

                    </div>

                  </div>


                  <p className="mt-2 text-[11px] app-text-muted">
                    A profile can use only one referral ID. It cannot be changed after being applied.
                  </p>

                </div>

              ) : (

                <div className="mt-2">

                  <input
                    value={
                      referredByInput
                    }
                    onChange={(
                      event,
                    ) =>
                      setReferredByInput(
                        event.target
                          .value
                          .toUpperCase(),
                      )
                    }
                    maxLength={
                      12
                    }
                    className="w-full rounded-2xl border app-border app-input px-4 py-3 font-mono text-sm font-black uppercase app-text outline-none transition focus:border-cyan-500"
                    placeholder="GZXXXXXXXXXX"
                    autoCapitalize="characters"
                    autoCorrect="off"
                    spellCheck={
                      false
                    }
                  />


                  <button
                    type="button"
                    disabled={
                      applyingReferral ||
                      !referredByInput
                        .trim()
                    }
                    onClick={() =>
                      void applyReferral()
                    }
                    className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-cyan-500 px-4 py-3 text-sm font-black text-white transition disabled:opacity-50"
                  >

                    <Gift className="h-4 w-4" />

                    {
                      applyingReferral
                        ? "Applying..."
                        : "Apply Referral ID"
                    }

                  </button>


                  <p className="mt-2 text-[11px] app-text-muted">
                    This can be entered only once. After successful verification, it is permanently linked to your account.
                  </p>

                </div>

              )}

            </div>

          </section>


          <section className="rounded-3xl border app-border app-surface p-5">

            <p className="text-xs font-black uppercase tracking-wider app-text-secondary">
              Theme
            </p>


            <div className="mt-3 grid grid-cols-2 gap-3">

              <button
                type="button"
                onClick={() =>
                  onThemeChange(
                    "dark",
                  )
                }
                className={`rounded-2xl border p-4 text-left transition ${
                  theme ===
                  "dark"
                    ? "border-orange-500 bg-orange-500/10"
                    : "app-border app-surface-secondary"
                }`}
              >

                <Moon className="mb-2 h-5 w-5" />

                <p className="font-black">
                  Dark
                </p>

              </button>


              <button
                type="button"
                onClick={() =>
                  onThemeChange(
                    "light",
                  )
                }
                className={`rounded-2xl border p-4 text-left transition ${
                  theme ===
                  "light"
                    ? "border-orange-500 bg-orange-500/10"
                    : "app-border app-surface-secondary"
                }`}
              >

                <Sun className="mb-2 h-5 w-5" />

                <p className="font-black">
                  Light
                </p>

              </button>

            </div>

          </section>


          <button
            type="button"
            disabled={
              saving
            }
            onClick={() =>
              void saveProfile()
            }
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-orange-500 px-4 py-4 font-black text-white disabled:opacity-50"
          >

            <Save className="h-5 w-5" />

            {saving
              ? "Saving..."
              : "Save Profile"}

          </button>


          <section className="rounded-3xl border border-red-500/30 bg-red-500/5 p-5">

            <div className="flex items-start gap-3">

              <Trash2 className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />

              <div>

                <h2 className="font-black text-red-500">
                  Delete Account
                </h2>

                <p className="mt-2 text-xs app-text-secondary">
                  Request deletion of your GenZGames account and associated account data.
                </p>

                <p className="mt-3 text-xs font-bold">
                  Account deletion:
                </p>

                <p className="mt-1 text-sm font-black text-red-500">
                  arivuppaathai@gmail.com
                </p>


                <button
                  type="button"
                  onClick={
                    requestAccountDeletion
                  }
                  className="mt-4 rounded-xl border border-red-500/30 px-4 py-2.5 text-xs font-black text-red-500"
                >
                  Request Account Deletion
                </button>

              </div>

            </div>

          </section>


          <button
            type="button"
            onClick={() =>
              void signOutUser()
            }
            className="flex w-full items-center justify-center gap-2 rounded-2xl border app-border app-surface px-4 py-4 font-black"
          >

            <LogOut className="h-5 w-5" />

            Sign Out

          </button>

        </main>

      </div>
    );
  };