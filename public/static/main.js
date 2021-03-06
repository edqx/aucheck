const eRes = document.querySelector(".result");
const eButton = document.querySelector(".submit");

const eIpAddress = document.querySelector(".ip");
const ePort = document.querySelector(".port");

const eShowAdvanced = document.querySelector(".show-advanced");
const eAdvanced = document.querySelector(".advanced-wrapper");

const eAttmeptAuth = document.querySelector(".attempt-auth");
const eClientVersion = document.querySelector(".client-version");
const eReactorHandshake = document.querySelector(".reactor-handshake");
const eMode = document.querySelector(".check-mode");
const eGameCode = document.querySelector(".game-code");

const eModList = document.querySelector(".mod-list");
const eModId = document.querySelector(".mod-id");
const eModVersion = document.querySelector(".mod-version");
const eCreateMod = document.querySelector(".create-mod");

const eGameCodeWrapper = document.querySelector(".game-code-wrapper");

const eAllToggleButtons = document.querySelectorAll("button.toggle");

const mods = [];

const error_codes = {
    "INVALID_IP": "error: the ip or dns you entered was invalid",
    "BAD_REQUEST": "error: something went wrong with the request",
    "TIMED_OUT_CONNECTING": "error: the client timed out while trying to identify with the server",
    "TIMED_OUT_JOINING": "error: the client timed out while trying to join the room",
    "JOIN_FAIL": "error: the client failed to join the room",
    "BAD_VERSION": "error: the server doesn't accept the version that you entered (see advanced options)",
    "TIMED_OUT_CREATING": "error: the client timed out while trying to create a room",
    "CREATE_FAIL": "error: the client failed to create a room",
    "BLOCKED": "error: that ip or dns is blocked",
    "UNKNOWN": "error: an unknown error occurred, please contact edward#2222 on discord"
}

function show_string(msg) {
    eRes.innerHTML = msg;
}

function show_message(msg) {
    eRes.className = "result";
    show_string(msg);
}

function show_success(msg) {
    eRes.className = "result success";
    show_string(msg);
}

function show_error(err) {
    eRes.className = "result error";
    show_string(err);
}

async function attempt_connect() {
    if (!eIpAddress.value)
        return;

    show_message("Attempting to connect..");

    const res = await fetch("/invoke",
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                ip: eIpAddress.value,
                port: parseInt(ePort.value) || 22023,
                mode: eMode.value,
                code: eGameCode.value,
                client_version: eClientVersion.value || "2021.4.2",
                reactor_handshake: eReactorHandshake.getAttribute("checked") === "true",
                attempt_auth: eAttmeptAuth.getAttribute("checked") === "true",
                mods,
                get_ping: true
            })
        }
    );

    if (res.status === 429) {
        const reset = res.headers.get("X-RateLimit-Reset");
        const servertime = res.headers.get("X-ServerTime");

        if (!reset || !servertime) {
            return show_error("error: please wait another minute before trying again");
        }

        const stimestamp = parseInt(servertime);
        const rtimestamp = parseInt(reset) * 1000;
        const ms = rtimestamp - stimestamp;

        return show_error("error: please wait " + Math.ceil(ms / 1000) + " seconds before trying again")
    }
    
    const json = await res.json();

    if (res.status === 200) {
        show_success("your server appears to be working fine, ping: " + json.ping + "ms");
    } else {
        show_error(json.reason ? error_codes[json.reason] : error_codes["UNKNOWN"]);
    }
}

eButton.addEventListener("click", attempt_connect);

let showing_advanced = false;

function toggle_advanced() {
    showing_advanced = !showing_advanced;

    if (showing_advanced) {
        eShowAdvanced.innerHTML = "click to hide advanced options";
        eAdvanced.style.display = "flex";
    } else {
        eShowAdvanced.innerHTML = "click to show advanced options";
        eAdvanced.style.display = "none";
    }
}

eShowAdvanced.addEventListener("click", toggle_advanced);

for (const button of eAllToggleButtons) {
    const val = button.getAttribute("default") || "true";
    button.setAttribute("checked", val);
    button.innerHTML = val === "true" ? "yes" : "no";

    button.addEventListener("click", () => {
        const is_checked = button.getAttribute("checked");

        if (is_checked === "true") {
            button.setAttribute("checked", "false");
            button.innerHTML = "no";
        } else {
            button.setAttribute("checked", "true");
            button.innerHTML = "yes";
        }
    });
}

function create_mod(id, version) {
    const wrapper = document.createElement("div");
    wrapper.className = "mod-item";

    const modid = document.createElement("input");
    modid.className = "mod-id";
    modid.value = id;
    modid.placeholder = "mod id";

    const modversion = document.createElement("input");
    modversion.className = "mod-version";
    modversion.value = version;
    modversion.placeholder = "version";

    const remove = document.createElement("button");
    remove.style.backgroundColor = "rgb(206, 76, 76)";
    remove.innerHTML = "-";
    remove.className = "delete-mod";

    wrapper.appendChild(modid);
    wrapper.appendChild(modversion);
    wrapper.appendChild(remove);

    eModList.appendChild(wrapper);

    const mod_info = {
        id,
        version
    };
    mods.push(mod_info)
    
    remove.addEventListener("click", () => {
        eModList.removeChild(wrapper);
        mods.splice(mods.indexOf(mod_info), 1);
    });
}

function on_create_mod_click() {
    if (eModId.value && eModVersion.value) {
        create_mod(eModId.value, eModVersion.value);
        eModId.value = "";
        eModVersion.value = "";
    }
}

eCreateMod.addEventListener("click", on_create_mod_click);

create_mod("gg.reactor.api", "0.4.0-ci.54");

function on_mode_select() {
    eGameCodeWrapper.style.display =
        eMode.value === "join"
            ? "flex"
            : "none";
}

eMode.addEventListener("change", on_mode_select);
on_mode_select();