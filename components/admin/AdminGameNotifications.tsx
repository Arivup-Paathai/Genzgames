import React, {
  useState,
} from "react";

import {
  Bell,
  CheckCircle2,
  Send,
  UserRound,
  Users,
} from "lucide-react";

import {
  httpsCallable,
} from "firebase/functions";

import {
  functions,
} from "../../services/firebase/firebase";


interface SendAdminNotificationRequest {
  recipientType:
    "all" |
    "user";

  userId?:
    string;

  title:
    string;

  message:
    string;
}


interface SendAdminNotificationResponse {
  success:
    boolean;

  recipientType:
    "all" |
    "user";

  userId?:
    string;

  notificationId:
    string;
}


const sendAdminNotification =
  httpsCallable<
    SendAdminNotificationRequest,
    SendAdminNotificationResponse
  >(
    functions,
    "sendAdminGenZGamesNotification",
  );


export const AdminGameNotifications:
React.FC = () => {

  const [
    recipientType,
    setRecipientType,
  ] =
    useState<
      "all" |
      "user"
    >(
      "all",
    );


  const [
    userId,
    setUserId,
  ] =
    useState(
      "",
    );


  const [
    title,
    setTitle,
  ] =
    useState(
      "",
    );


  const [
    message,
    setMessage,
  ] =
    useState(
      "",
    );


  const [
    sending,
    setSending,
  ] =
    useState(
      false,
    );


  const [
    successMessage,
    setSuccessMessage,
  ] =
    useState<
      string |
      null
    >(
      null,
    );


  const [
    errorMessage,
    setErrorMessage,
  ] =
    useState<
      string |
      null
    >(
      null,
    );


  const handleSend =
    async () => {

      const cleanTitle =
        title.trim();


      const cleanMessage =
        message.trim();


      const cleanUserId =
        userId.trim();


      if (
        cleanTitle.length <
          2 ||
        cleanTitle.length >
          80
      ) {
        setErrorMessage(
          "Title must be between 2 and 80 characters.",
        );

        return;
      }


      if (
        !cleanMessage ||
        cleanMessage.length >
          500
      ) {
        setErrorMessage(
          "Message must be between 1 and 500 characters.",
        );

        return;
      }


      if (
        recipientType ===
          "user" &&
        !cleanUserId
      ) {
        setErrorMessage(
          "Enter the selected user's ID.",
        );

        return;
      }


      const confirmed =
        window.confirm(
          recipientType ===
            "all"
            ? "Send this notification to all GenZGames users?"
            : "Send this notification only to the selected user?",
        );


      if (
        !confirmed
      ) {
        return;
      }


      try {

        setSending(
          true,
        );


        setErrorMessage(
          null,
        );


        setSuccessMessage(
          null,
        );


        await sendAdminNotification({
          recipientType,

          ...(recipientType ===
          "user"
            ? {
                userId:
                  cleanUserId,
              }
            : {}),

          title:
            cleanTitle,

          message:
            cleanMessage,
        });


        setSuccessMessage(
          recipientType ===
            "all"
            ? "Notification sent to all users."
            : "Notification sent to the selected user.",
        );


        setTitle(
          "",
        );


        setMessage(
          "",
        );


        if (
          recipientType ===
          "user"
        ) {
          setUserId(
            "",
          );
        }

      } catch (error) {

        console.error(
          "Unable to send GenZGames notification:",
          error,
        );


        setErrorMessage(
          "Unable to send notification.",
        );

      } finally {

        setSending(
          false,
        );
      }
    };


  return (
    <div className="space-y-5">

      <div>

        <div className="flex items-center gap-2">

          <Bell className="h-5 w-5 text-orange-500" />

          <h2 className="text-lg font-black">
            Send Notification
          </h2>

        </div>


        <p className="mt-1 text-xs app-text-muted">
          Send an update to all users or one selected user.
        </p>

      </div>


      <div className="grid grid-cols-2 gap-2 rounded-2xl border app-border app-surface p-1">

        <button
          type="button"
          onClick={() => {

            setRecipientType(
              "all",
            );


            setErrorMessage(
              null,
            );
          }}
          className={`flex items-center justify-center gap-2 rounded-xl px-3 py-3 text-xs font-black transition ${
            recipientType ===
            "all"
              ? "bg-orange-500 text-white shadow"
              : "app-text-secondary hover:bg-[var(--app-hover)]"
          }`}
        >

          <Users className="h-4 w-4" />

          All Users

        </button>


        <button
          type="button"
          onClick={() => {

            setRecipientType(
              "user",
            );


            setErrorMessage(
              null,
            );
          }}
          className={`flex items-center justify-center gap-2 rounded-xl px-3 py-3 text-xs font-black transition ${
            recipientType ===
            "user"
              ? "bg-orange-500 text-white shadow"
              : "app-text-secondary hover:bg-[var(--app-hover)]"
          }`}
        >

          <UserRound className="h-4 w-4" />

          Selected User

        </button>

      </div>


      {recipientType ===
        "user" && (

        <div>

          <label className="text-[10px] font-black uppercase tracking-wider app-text-muted">
            User ID
          </label>


          <input
            type="text"
            value={
              userId
            }
            onChange={(
              event,
            ) =>
              setUserId(
                event.target
                  .value,
              )
            }
            placeholder="Paste GenZGames user ID"
            className="mt-2 w-full rounded-xl border app-border app-input px-4 py-3 text-xs outline-none focus:border-orange-500"
          />


          <p className="mt-1 text-[10px] app-text-muted">
            You can copy the User ID from the Users tab.
          </p>

        </div>

      )}


      <div>

        <div className="flex items-center justify-between gap-3">

          <label className="text-[10px] font-black uppercase tracking-wider app-text-muted">
            Title
          </label>


          <span className="text-[10px] app-text-muted">
            {
              title.length
            }
            /80
          </span>

        </div>


        <input
          type="text"
          value={
            title
          }
          maxLength={
            80
          }
          onChange={(
            event,
          ) =>
            setTitle(
              event.target
                .value,
            )
          }
          placeholder="Example: New Game Update"
          className="mt-2 w-full rounded-xl border app-border app-input px-4 py-3 text-sm outline-none focus:border-orange-500"
        />

      </div>


      <div>

        <div className="flex items-center justify-between gap-3">

          <label className="text-[10px] font-black uppercase tracking-wider app-text-muted">
            Message
          </label>


          <span className="text-[10px] app-text-muted">
            {
              message.length
            }
            /500
          </span>

        </div>


        <textarea
          value={
            message
          }
          maxLength={
            500
          }
          rows={
            6
          }
          onChange={(
            event,
          ) =>
            setMessage(
              event.target
                .value,
            )
          }
          placeholder="Write the notification message..."
          className="mt-2 w-full resize-none rounded-xl border app-border app-input px-4 py-3 text-sm outline-none focus:border-orange-500"
        />

      </div>


      {errorMessage && (

        <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-3">

          <p className="text-xs text-rose-500">
            {
              errorMessage
            }
          </p>

        </div>

      )}


      {successMessage && (

        <div className="flex items-start gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3">

          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />


          <p className="text-xs text-emerald-500">
            {
              successMessage
            }
          </p>

        </div>

      )}


      <div className="rounded-2xl border app-border app-surface-secondary p-4">

        <p className="text-xs font-black">
          {
            recipientType ===
            "all"
              ? "Broadcast Notification"
              : "Private Notification"
          }
        </p>


        <p className="mt-1 text-[10px] leading-relaxed app-text-muted">

          {
            recipientType ===
            "all"
              ? "The push notification is sent through the GenZGames broadcast topic. It does not load every user account."
              : "Only the selected user's registered GenZGames devices will receive this notification."
          }

        </p>

      </div>


      <button
        type="button"
        disabled={
          sending
        }
        onClick={() =>
          void handleSend()
        }
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-orange-500 px-4 py-3 text-sm font-black text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50"
      >

        <Send className="h-4 w-4" />

        {
          sending
            ? "Sending..."
            : recipientType ===
                "all"
              ? "Send to All Users"
              : "Send to Selected User"
        }

      </button>

    </div>
  );
};