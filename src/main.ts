import "./style.css";
import { initializePlatform } from './native';

const dispose=await initializePlatform();
if(import.meta.hot)import.meta.hot.dispose(dispose);

if (new URLSearchParams(location.search).get("mode") === "demo") {
  void import("./demo-ui");
} else {
  void import("./play-ui");
}
