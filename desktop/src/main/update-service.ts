/**
 * The update service of the client.
 *
 * The updater runs in the main process, because it needs the file system and
 * the network of the application. The renderer asks whether a new release is
 * there, and the main process answers.
 *
 * A build with no release feed never updates itself. That is not a failure:
 * the client installs and works, and the user installs a new version by hand.
 * RELEASING.md explains how a feed is made.
 */

import { app } from 'electron';
import { autoUpdater } from 'electron-updater';
import type { UpdateState } from '../renderer/src/shared/contract';

/** The answer of a build that has no feed, or no updater. */
const NO_UPDATE: UpdateState = { available: false, version: null, error: null };

export class UpdateService {
  private readonly ready: Promise<typeof autoUpdater | null>;

  constructor() {
    this.ready = this.load();
  }

  private async load(): Promise<typeof autoUpdater | null> {
    // The update configuration ships inside the package. A development run
    // has none, so the updater is not prepared at all.
    if (!app.isPackaged) {
      return null;
    }
    try {
      autoUpdater.autoDownload = true;
      autoUpdater.autoInstallOnAppQuit = true;
      return autoUpdater;
    } catch (cause) {
      console.info('[update] the updater is not part of this build', cause);
      return null;
    }
  }

  /** Check the release feed for a newer build. */
  async check(): Promise<UpdateState> {
    const updater = await this.ready;
    if (!updater) return NO_UPDATE;
    try {
      const result = await updater.checkForUpdates();
      const version = readVersion(result);
      return { available: version !== null, version, error: null };
    } catch (cause) {
      // The feed is not there, or the network is gone. The client works
      // without an update, so this is not shown to the user.
      return {
        available: false,
        version: null,
        error: cause instanceof Error ? cause.message : String(cause),
      };
    }
  }

  /** Download the newer build, if there is one. */
  async download(): Promise<UpdateState> {
    const updater = await this.ready;
    if (!updater) return NO_UPDATE;
    try {
      const result = await updater.downloadUpdate();
      const version = readVersion(result);
      return { available: version !== null, version, error: null };
    } catch (cause) {
      return {
        available: false,
        version: null,
        error: cause instanceof Error ? cause.message : String(cause),
      };
    }
  }
}

/**
 * The version of a release.
 *
 * The updater answers with different shapes: a check names the update, and a
 * download names the files. The version is read from either.
 */
function readVersion(result: unknown): string | null {
  if (!result || typeof result !== 'object') return null;
  const candidate = result as { updateInfo?: { version?: string }; version?: string };
  const version = candidate.updateInfo?.version ?? candidate.version;
  return typeof version === 'string' && version.length > 0 ? version : null;
}
