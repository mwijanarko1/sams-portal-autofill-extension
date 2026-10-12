function show(enabled, useSettingsInsteadOfPreferences) {
    if (useSettingsInsteadOfPreferences) {
        document.getElementsByClassName('state-on')[0].innerText = "SAMS Portal Autofill’s extension is currently on. You can turn it off in the Extensions section of Safari Settings.";
        document.getElementsByClassName('state-off')[0].innerText = "SAMS Portal Autofill’s extension is currently off. You can turn it on in the Extensions section of Safari Settings.";
        document.getElementsByClassName('state-unknown')[0].innerText = "You can turn on SAMS Portal Autofill’s extension in the Extensions section of Safari Settings.";
        document.getElementsByClassName('open-preferences')[0].innerText = "Quit and Open Safari Settings…";
    }

    if (typeof enabled === "boolean") {
        document.body.classList.toggle(`state-on`, enabled);
        document.body.classList.toggle(`state-off`, !enabled);
    } else {
        document.body.classList.remove(`state-on`);
        document.body.classList.remove(`state-off`);
    }
}

const errorMessages = {
    "state": "Could not check whether the SAMS Portal Autofill extension is on. Open Safari, choose Safari > Settings, then Extensions, to check it.",
    "open-settings": "Could not open Safari Settings. Open Safari, choose Safari > Settings, then Extensions, and turn on SAMS Portal Autofill.",
};

function showError(kind) {
    const message = document.querySelector(".error");
    message.textContent = errorMessages[kind] || errorMessages["state"];
    message.hidden = false;
}

function openPreferences() {
    webkit.messageHandlers.controller.postMessage("open-preferences");
}

document.querySelector("button.open-preferences").addEventListener("click", openPreferences);
