import "./ui/styles.css";
import { App } from "./ui/app";

const app = new App();
app.start().catch((err) => {
  console.error(err);
  const el = document.getElementById("loader");
  if (el) el.textContent = "Something went wrong while loading. Please refresh.";
});
