import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { installGlobalAudioUnlock } from "./audioManager";
import { initializeAdMob } from "./services/admob";
import "./index.css";

const root = document.getElementById("root");
if (!root) throw new Error("Could not find root element");
installGlobalAudioUnlock();
void initializeAdMob();
ReactDOM.createRoot(root).render(<React.StrictMode><App/></React.StrictMode>);
