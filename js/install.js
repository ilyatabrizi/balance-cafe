// Home-screen install. Chrome hands us a prompt we can fire ourselves; iOS
// Safari does not, so there we explain the Share → Add to Home Screen path.

let deferred = null;

export function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches
    || window.navigator.standalone === true;
}

export const canInstall = () => !!deferred;

export async function promptInstall() {
  if (!deferred) return "unavailable";
  deferred.prompt();
  const { outcome } = await deferred.userChoice;
  deferred = null;
  window.dispatchEvent(new CustomEvent("bal:installable"));
  return outcome;
}

window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferred = e;
  window.dispatchEvent(new CustomEvent("bal:installable"));
});

window.addEventListener("appinstalled", () => {
  deferred = null;
  window.dispatchEvent(new CustomEvent("bal:installable"));
});
