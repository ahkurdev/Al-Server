import type { ActionResult } from "../../shared/types";

export class UpdaterService {
  async check(): Promise<ActionResult> {
    try {
      const { autoUpdater } = await import("electron-updater");
      autoUpdater.autoDownload = false;
      const res = await autoUpdater.checkForUpdates();
      const ver = res?.updateInfo?.version ?? "unknown";
      return { success: true, message: `Latest: ${ver}` };
    } catch (err) {
      return { success: false, message: err instanceof Error ? err.message : String(err) };
    }
  }

  async downloadAndInstall(): Promise<ActionResult> {
    try {
      const { autoUpdater } = await import("electron-updater");
      await autoUpdater.downloadUpdate();
      autoUpdater.quitAndInstall(false, true);
      return { success: true, message: "Update downloaded, restarting" };
    } catch (err) {
      return { success: false, message: err instanceof Error ? err.message : String(err) };
    }
  }
}
