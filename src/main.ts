import "./style.css";
import { initializePlatform } from './native';
import { initializeOffline } from './offline';

const dispose=await initializePlatform();
initializeOffline();
if(import.meta.hot)import.meta.hot.dispose(dispose);

if (new URLSearchParams(location.search).get("mode") === "demo") {
  void import("./demo-ui");
} else {
  void import("./play-ui");
}
