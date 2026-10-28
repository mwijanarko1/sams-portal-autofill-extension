# Install the extension

This guide is for staff who need to install SAMS Portal Autofill from a GitHub release. Use the Chrome steps for Google Chrome and the Safari steps for Safari on a Mac. For how to use it after install, see [STAFF-GUIDE.md](STAFF-GUIDE.md) or [USER-HANDOVER.md](USER-HANDOVER.md). Engineers: build and release steps are in the [README](../README.md).

Install only a package that SAMS has approved for your team.

## 1. Open the GitHub Releases page

Go to:

https://github.com/mwijanarko1/sams-portal-autofill-extension/releases

Open the latest release that SAMS has approved for your browser. Chrome and Safari have separate releases. The Safari release name ends in `-safari`.

## Install in Chrome

### 2. Download the zip

Under **Assets**, download the Chrome zip. The file name looks like `sams-portal-autofill-0.3.0-chrome.zip`. The version number changes with each release.

### 3. Unzip the download

Unzip the file on your computer. Keep the extracted folder. You will point Chrome at that folder in the next steps. Do not delete the folder after you load the extension.

### 4. Open Chrome extensions

1. Open Google Chrome.
2. Open the extensions page: the menu **⋮** → **Extensions** → **Manage Extensions**, or go to `chrome://extensions`.
3. Turn on **Developer mode** (top right).

### 5. Load the unpacked extension

1. Select **Load unpacked**.
2. Choose the folder you extracted from the zip.
3. Confirm that **SAMS Portal Autofill** appears in the list and is enabled.

Pin the extension to the toolbar if you want quick access.

## Install in Safari (macOS)

The Safari package is not signed yet. Safari loads it as a temporary extension. Safari removes a temporary extension after 24 hours or when it quits. You must repeat steps 5 and 6 each time. Nobody has tested this package in a running Safari yet, so report any problem to SAMS.

### 2. Download the zip

Under **Assets**, download the Safari zip. The file name looks like `sams-portal-autofill-0.3.0-safari-webextension.zip`.

### 3. Unzip the download

Unzip the file. Keep the extracted folder. It must contain a file named `manifest.json`. Do not select a folder that only contains an `.app`.

### 4. Turn on the Develop menu

1. Open Safari.
2. Open **Safari** → **Settings** → **Advanced**.
3. Turn on **Show features for web developers**. On older Safari versions, turn on **Show Develop menu in menu bar**.

### 5. Add the temporary extension

1. In the menu bar, select **Develop** → **Add Temporary Extension…**.
2. Choose the folder you extracted from the zip.
3. If Safari asks, confirm that you want to add it.

If Safari says the folder "cannot be used as an extension", you chose the wrong folder. Choose the folder that holds `manifest.json`.

### 6. Turn it on and allow websites

1. Open **Safari** → **Settings** → **Extensions**.
2. Turn on **SAMS Portal Autofill**.
3. Select **Edit Websites…** and allow it on SAMS CRM and on each university portal you use. Choose **Allow** for each one.

Open the extension from the toolbar on a CRM profile or an application page.

## After install

Follow [STAFF-GUIDE.md](STAFF-GUIDE.md) to copy a student and autofill a portal form.

To update Chrome later, download the new approved zip, unzip it, then on `chrome://extensions` select **Remove** on the old copy (or use **Reload** if you replaced the same folder) and load the new folder with **Load unpacked**.

To update Safari later, download the new approved Safari zip, unzip it, and add the new folder again with **Develop** → **Add Temporary Extension…**.
