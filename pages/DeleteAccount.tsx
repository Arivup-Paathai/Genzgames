import React from "react";
import {
  Gamepad2,
  Mail,
  ShieldCheck,
  Trash2,
} from "lucide-react";

const SUPPORT_EMAIL =
  "arivuppaathai@gmail.com";

export const DeleteAccount:
React.FC = () => {
  const subject =
    encodeURIComponent(
      "GenZGames Account Deletion Request",
    );

  const body =
    encodeURIComponent(
      [
        "Hello GenZGames Support,",
        "",
        "I would like to request deletion of my GenZGames account and associated personal data.",
        "",
        "My Google Sign-In email:",
        "",
        "My GenZGames display name (if available):",
        "",
        "Please confirm once my account deletion request has been processed.",
      ].join("\n"),
    );

  const mailLink =
    `mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`;

  return (
    <main
      className="
        min-h-screen
        bg-[#09090b]
        px-4
        py-10
        text-white
      "
    >
      <div
        className="
          mx-auto
          max-w-2xl
        "
      >
        <div
          className="
            mb-6
            text-center
          "
        >
          <div
            className="
              mx-auto
              flex
              h-16
              w-16
              items-center
              justify-center
              rounded-2xl
              bg-orange-500
            "
          >
            <Gamepad2
              className="
                h-8
                w-8
                text-white
              "
            />
          </div>

          <p
            className="
              mt-4
              text-xs
              font-black
              uppercase
              tracking-[0.2em]
              text-orange-500
            "
          >
            Arivup Paathai
          </p>

          <h1
            className="
              mt-2
              text-3xl
              font-black
            "
          >
            Delete GenZGames Account
          </h1>

          <p
            className="
              mt-3
              text-sm
              leading-6
              text-zinc-400
            "
          >
            You can request deletion of
            your GenZGames account and
            associated personal data
            without opening the app.
          </p>
        </div>

        <section
          className="
            rounded-3xl
            border
            border-zinc-800
            bg-zinc-900
            p-5
            shadow-2xl
            sm:p-7
          "
        >
          <div
            className="
              flex
              gap-3
              rounded-2xl
              border
              border-orange-500/20
              bg-orange-500/10
              p-4
            "
          >
            <ShieldCheck
              className="
                mt-0.5
                h-5
                w-5
                shrink-0
                text-orange-500
              "
            />

            <div>
              <h2
                className="
                  font-bold
                "
              >
                How to request deletion
              </h2>

              <p
                className="
                  mt-2
                  text-sm
                  leading-6
                  text-zinc-400
                "
              >
                Send an email to
                GenZGames Support using
                the email address linked
                to your Google Sign-In
                account.
              </p>
            </div>
          </div>

          <div
            className="
              mt-6
              rounded-2xl
              border
              border-zinc-800
              bg-zinc-950
              p-5
            "
          >
            <p
              className="
                text-xs
                font-bold
                uppercase
                tracking-wide
                text-zinc-500
              "
            >
              Contact
            </p>

            <p
              className="
                mt-2
                break-all
                text-lg
                font-black
                text-orange-500
              "
            >
              {SUPPORT_EMAIL}
            </p>

            <div
              className="
                mt-5
                space-y-2
                text-sm
                leading-6
                text-zinc-400
              "
            >
              <p>
                In your email, include:
              </p>

              <p>
                • Your Google Sign-In
                email address
              </p>

              <p>
                • Your GenZGames display
                name, if available
              </p>

              <p>
                • Subject:
                <strong className="text-zinc-200">
                  {" "}
                  GenZGames Account
                  Deletion Request
                </strong>
              </p>
            </div>
          </div>

          <a
            href={mailLink}
            className="
              mt-6
              flex
              w-full
              items-center
              justify-center
              gap-2
              rounded-xl
              bg-red-600
              px-4
              py-3.5
              font-black
              text-white
              transition
              hover:bg-red-500
              active:scale-[0.98]
            "
          >
            <Trash2
              className="
                h-5
                w-5
              "
            />

            Send Account Deletion Request
          </a>
        </section>

        <section
          className="
            mt-6
            rounded-3xl
            border
            border-zinc-800
            bg-zinc-900
            p-5
            sm:p-7
          "
        >
          <h2
            className="
              text-lg
              font-black
            "
          >
            What happens after your request?
          </h2>

          <div
            className="
              mt-4
              space-y-4
              text-sm
              leading-6
              text-zinc-400
            "
          >
            <p>
              We may verify that the
              deletion request belongs
              to the account owner before
              processing it.
            </p>

            <p>
              After verification, we will
              process deletion of the
              GenZGames account and
              associated personal data.
            </p>

            <p>
              Game progress, profile
              information and other
              account-linked data may no
              longer be recoverable after
              deletion.
            </p>

            <p>
              Some information may be
              retained when required for
              security, fraud prevention,
              payment, accounting or
              legal obligations.
            </p>
          </div>
        </section>

        <div
          className="
            mt-6
            flex
            items-center
            justify-center
            gap-2
            text-sm
            text-zinc-500
          "
        >
          <Mail
            className="
              h-4
              w-4
            "
          />

          <a
            href={`mailto:${SUPPORT_EMAIL}`}
            className="
              hover:text-orange-500
            "
          >
            {SUPPORT_EMAIL}
          </a>
        </div>

        <p
          className="
            mt-4
            text-center
            text-xs
            text-zinc-600
          "
        >
          GenZGames • Arivup Paathai
        </p>
      </div>
    </main>
  );
};