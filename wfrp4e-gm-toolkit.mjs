/**
 * A utility module for Warhammer Fantasy Roleplay 4e Gamemasters.+
 * Author: Jagusti
 * Repository: https://github.com/Jagusti/fvtt-wfrp4e-gmtoolkit/
 * Issue Tracker: https://github.com/Jagusti/fvtt-wfrp4e-gmtoolkit/issues
 */

// Import Helpers
import GMToolkit from "./modules/gm-toolkit.mjs"
import * as GMToolkitUtility from "./modules/utility.mjs"

// Import Modules
import { GMToolkitSettings, registerGroupTestSettings } from "./modules/gm-toolkit-settings.mjs"
import Advantage from "./modules/advantage.mjs"
import { runSilentGroupTest, runGroupTest } from "./modules/group-test.mjs"
import { GroupTest } from "./apps/group-test.js"
import DarkWhispers from "./modules/dark-whispers.mjs"
import TokenHudExtension from "./modules/token-hud-extension.mjs"
import { DamageConsole } from "./apps/damage.js"
import { GMToolkitWelcome } from "./modules/welcome.mjs"
import SocketHandlers from "./modules/socket.mjs"
import GMToolkitAdvantageSettings from "./apps/gm-toolkit-advantage-settings.js"
import GMToolkitDarkWhispersSettings from "./apps/gm-toolkit-darkwhispers-settings.js"
import GMToolkitGroupTestSettings from "./apps/gm-toolkit-grouptest-settings.js"
import GMToolkitSessionManagementSettings from "./apps/gm-toolkit-session-management-settings.js"
import GMToolkitVisionSettings from "./apps/gm-toolkit-vision-settings.js"
import GMToolkitMaintenance from "./apps/gm-toolkit-maintenance.js"


/* -------------------------------------------- */
/*  Foundry VTT Initialisation                  */
/* -------------------------------------------- */

/**
 * Carry out initialisation routines
 */
Hooks.once("init", function () {
  GMToolkit.log(false, `Initialising ${GMToolkit.MODULE_NAME}.`)

  // Create namespace within game global
  game.gmtoolkit = {
    advantage: Advantage,
    utility: GMToolkitUtility,
    module: GMToolkit,
    grouptest: {
      launch: GroupTest,
      run: runGroupTest,
      silent: runSilentGroupTest
    },
    damage: {
      launch: DamageConsole
    },
    skills: [],
    settings: {
      advantage: GMToolkitAdvantageSettings,
      darkwhispers: GMToolkitDarkWhispersSettings,
      grouptest: GMToolkitGroupTestSettings,
      session: GMToolkitSessionManagementSettings,
      vision: GMToolkitVisionSettings,
      maintenance: GMToolkitMaintenance
    }
  }

})


/* -------------------------------------------- */
/*  Foundry VTT Ready                           */
/* -------------------------------------------- */

Hooks.once("ready", async function () {
  // Preload skills, used for Group Test settings registration
  if (!game.babele || game.babele.initialized) {
    GMToolkit.log(false, "Building skills as Babele is not active or is initialized")
    game.gmtoolkit.skills = await GMToolkitUtility.compileItems(["skill"])
  } else {
    GMToolkit.log(false, "Deferring skill list build until Babele is initialized.")
  }

  // Register module settings
  await GMToolkitSettings.register()

  GMToolkit.log(true, `${GMToolkit.MODULE_NAME} is ready.`)

  // Notify any player users that do not have characters assigned
  const spectators = GMToolkitUtility.getGroup("spectators").map(i => ` ${i.name}`)
  if (spectators.length > 0) {
    GMToolkit.log(true, `Spectators: ${spectators}`)
    if (!GMToolkit.getSettingCompat("suppressSpectatorNotice")) {
      ui.notifications.error(`${game.i18n.format("GMTOOLKIT.Message.Spectators", { spectators })}`, { permanent: true, console: false })
    }
  }

  // Register Handlebar helper to find an entry within an array
  Handlebars.registerHelper("ifIn", function (toFind, inList) {
    if (inList.indexOf(toFind) > -1) {
      return true
    }
  })

  // Register socket handler
  game.socket.on(`module.${GMToolkit.MODULE_ID}`, (data, options) => {
    SocketHandlers[data.type](data, options)
  })

  GMToolkitWelcome._welcomeMessage()

})


/* -------------------------------------------- */
/*  Other Hooks                                 */
/* -------------------------------------------- */

// Register module debug flag with Developer Mode custom hook
Hooks.once("devModeReady", ({ registerPackageDebugFlag }) => {
  registerPackageDebugFlag(GMToolkit.MODULE_ID)
})

// Disable movement on holding scene (preUpdateToken: TokenDocument, diff, operation, userId)
Hooks.on("preUpdateToken", (tokenDocument, change) => {
  GMToolkit.log(false, `${tokenDocument.x} -> ${change?.x}, ${tokenDocument.y} -> ${change?.y}`)
  if (!game.user.isGM && game.canvas.scene.name === GMToolkit.getSettingCompat("holdingScene")) {
    if (change?.x) {change.x = tokenDocument.x}
    if (change?.y) {change.y = tokenDocument.y}
  }
})

// Display Token Hud Extension if enabled (html may be jQuery or HTMLElement in v14)
Hooks.on("renderTokenHUD", (app, html, data) => {
  const $html = html?.jquery ? html : $(html)
  if (game.settings.get(GMToolkit.MODULE_ID, "enableTokenHudExtensions")) {
    TokenHudExtension.addTokenHudExtensions(app, $html, data)
  }
  const statusEffects = $html.find(".status-effects")[0]
  if (statusEffects) {
    statusEffects.style.background = `${GMToolkit.getSettingCompat("tokenHudStatusEffectsBackground")}`
  }
})

// If Babele is installed, wait until it completed initialisation and then compile localized skills list used for Group Tests
Hooks.once("babele.ready", async function () {
  // Preload skills, used for Group Test settings registration
  if (!game.babele || game.babele.initialized) {
    console.log("Building skills now Babele is ready")
    game.gmtoolkit.skills = await GMToolkitUtility.compileItems(["skill"])
    registerGroupTestSettings()
  }
})


/* -------------------------------------------- */
/*  Entry Context                               */
/* -------------------------------------------- */

Hooks.on("getChatMessageContextOptions", (application, menuItems) => {
  menuItems.push({
    label: game.i18n.localize("GMTOOLKIT.ChatFlavour.Title"),
    icon: "fas fa-pen-fancy",
    visible: game.user.isGM,
    onClick: (event, target) => {
      const messageEl = target.closest("[data-message-id]")
      const messageId = messageEl?.dataset.messageId
      const message = game.messages.get(messageId)
      let result
      foundry.applications.api.DialogV2.wait({
        window: { title: game.i18n.localize("GMTOOLKIT.ChatFlavour.Title") },
        rejectClose: false,
        content: `<form>
              <div class="form-group">
                <input type="text"
                  id="messageflavor"
                  name="messageflavor"
                  placeholder="${game.i18n.localize("GMTOOLKIT.ChatFlavour.Placeholder")}"
                  value="${Handlebars.escapeExpression(message?.flavor ?? "")}"
                />
              </div>
              </form>`,
        buttons: [
          {
            icon: "<i class='fas fa-check'></i>",
            label: game.i18n.localize("GMTOOLKIT.Dialog.Apply"),
            action: "apply",
            default: "yes",
            callback: (event, button, dialog) => {
              result = new foundry.applications.ux
                .FormDataExtended(button.form).object
            }
          },
          {
            icon: "<i class='fas fa-times'></i>",
            label: game.i18n.localize("GMTOOLKIT.Dialog.Cancel"),
            action: "cancel"
          }
        ],
        close: () => {
          console.log(result)
          if (result) {
            const messageFlavor = result.messageflavor
            message?.update({ flavor: messageFlavor })
          }
        }
      })
    }
  })
})
