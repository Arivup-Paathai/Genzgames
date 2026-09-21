import React, { useEffect, useState } from "react";
import { HashRouter, Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { App as CapacitorApp } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { StatusBar, Style } from "@capacitor/status-bar";
import { Bell, LogIn, ShieldCheck, UserCircle } from "lucide-react";
import Splash from "./pages/Splash";
import { GenZGames } from "./pages/GenZGames";
import { AdminPanel } from "./pages/AdminPanel";
import { Notifications } from "./pages/Notifications";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { showGenZGoldMineBanner } from "./services/admob";
import {
  setMiniGamesPushNavigationHandler,
} from "./services/pushNotifications";
import {
  Profile,
  type ThemeMode,
} from "./pages/Profile";
const Shell: React.FC = () => {
  const {
  currentUser,
  isAuthLoading,
  isAdmin,
  signInWithGoogle,
} = useAuth();
  const [
  view,
  setView,
] =
  useState<
    | "games"
    | "admin"
    | "notifications"
    | "profile"
  >(
    "games",
  );


const [
  theme,
  setTheme,
] =
  useState<
    ThemeMode
  >(
    () =>
      localStorage.getItem(
        "miniGamesTheme",
      ) ===
      "light"
        ? "light"
        : "dark",
  );
  const navigate = useNavigate();

  useEffect(
  () => {

    setMiniGamesPushNavigationHandler(
      (
        navigation,
      ) => {

        if (
          navigation.type ===
          "admin_redemption"
        ) {
          setView(
            "admin",
          );

          return;
        }


        setView(
          "notifications",
        );
      },
    );


    return () => {
      setMiniGamesPushNavigationHandler(
        null,
      );
    };

  },
  [],
);

  useEffect(
  () => {

        document.documentElement
      .setAttribute(
        "data-theme",
        theme,
      );


    document.documentElement
      .classList
      .toggle(
        "dark",
        theme ===
        "dark",
      );


    localStorage.setItem(
      "miniGamesTheme",
      theme,
    );


    if (
      !Capacitor.isNativePlatform()
    ) {
      return;
    }


    void StatusBar
      .setOverlaysWebView({
        overlay:
          false,
      });


    void StatusBar
      .setStyle({
        style:
          theme ===
          "dark"
            ? Style.Dark
            : Style.Light,
      });


    void StatusBar
      .setBackgroundColor({
        color:
          theme ===
          "dark"
            ? "#080808"
            : "#f8fafc",
      });

  },
  [
    theme,
  ],
);


useEffect(
  () => {

    if (
      !Capacitor.isNativePlatform()
    ) {
      return;
    }


    void showGenZGoldMineBanner();

  },
  [],
);

  if (
  view ===
  "admin"
) {
  return isAdmin
    ? (
        <AdminPanel
          onBack={() =>
            setView(
              "games",
            )
          }
        />
      )
    : (
        <Navigate
          to="/home"
          replace
        />
      );
}


if (
  view ===
  "notifications"
) {
  return (
    <Notifications
      onBack={() =>
        setView(
          "games",
        )
      }
    />
  );
}


if (
  view ===
  "profile"
) {
  return currentUser
    ? (
        <Profile
          onBack={() =>
            setView(
              "games",
            )
          }
          theme={
            theme
          }
          onThemeChange={
            setTheme
          }
        />
      )
    : (
        <Navigate
          to="/home"
          replace
        />
      );
}

  return <div className="min-h-screen app-bg app-text" style={{paddingBottom:"calc(90px + env(safe-area-inset-bottom))"}}>
    <header className="sticky top-0 z-[120] border-b app-border bg-[var(--app-bg)]/95 px-4 pb-3 backdrop-blur" style={{paddingTop:"calc(env(safe-area-inset-top) + 10px)"}}>
      <div className="mx-auto flex max-w-4xl items-center gap-2">
        <div className="min-w-0 flex-1"><p className="text-[10px] font-black uppercase tracking-[0.2em] text-orange-500">Arivup Paathai</p><h1 className="truncate text-base font-black">GenZGames</h1></div>
        {currentUser && <button onClick={() => setView("notifications")} className="h-10 w-10 rounded-full app-surface border app-border flex items-center justify-center" aria-label="Notifications"><Bell className="h-4 w-4"/></button>}
        {isAdmin && <button onClick={() => setView("admin")} className="h-10 rounded-full bg-orange-500 px-3 text-xs font-black text-white flex items-center gap-1.5"><ShieldCheck className="h-4 w-4"/>Admin</button>}
        {isAuthLoading ? <div className="h-10 w-24 animate-pulse rounded-full app-surface"/> : currentUser ? 
        <button
  onClick={() =>
    setView(
      "profile",
    )
  }
  className="h-10 rounded-full app-surface border app-border px-3 text-xs font-black flex items-center gap-2"
>{currentUser.photoUrl ? <img
  src={currentUser.photoUrl}
  alt={currentUser.displayName}
  className="h-6 w-6 rounded-full object-cover"
/> : <UserCircle className="h-5 w-5"/>}<span className="max-w-20 truncate">{currentUser.displayName}</span></button> : <button onClick={() => void signInWithGoogle()} className="h-10 rounded-full bg-white px-3 text-xs font-black text-black flex items-center gap-2"><LogIn className="h-4 w-4"/>
Sign In</button>}
      </div>
    </header>
    {!currentUser && (
  <div className="mx-auto max-w-4xl px-4 pt-4">
    <div className="rounded-2xl border border-orange-500/20 bg-orange-500/10 p-4 text-sm">
      <strong>Sign in to play & earn.</strong>

      <div className="mt-1 text-xs app-text-secondary">
        Sign in with Google to play games, save progress, earn rewards and redeem to your UPI ID.
      </div>
    </div>
  </div>
)}
    <GenZGames onExit={() => { if (Capacitor.isNativePlatform()) void CapacitorApp.exitApp(); else navigate("/"); }} />
  </div>;
};

const AppRoutes = () => <Routes><Route path="/" element={<Splash/>}/><Route path="/home" element={<Shell/>}/><Route path="*" element={<Navigate to="/" replace/>}/></Routes>;

const App: React.FC = () => <AuthProvider><HashRouter><AppRoutes/></HashRouter></AuthProvider>;
export default App;
