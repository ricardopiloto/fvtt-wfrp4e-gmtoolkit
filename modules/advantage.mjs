import GMToolkit from "./gm-toolkit.mjs"
import { inActiveCombat } from "./utility.mjs"

export default class Advantage {

  /**
   * Entry point for adjustments to Advantage through .
   * @param {Object} character   :   Token
   * @param {string} adjustment  :   increase (+1), clear (=0), reduce (-1)
   * // TODO: add support for numeric adjustment values
   * @param {string} context     :   macro, wfrp4e:opposedTestResult, wfrp4e:applyDamage, createCombatant, preDeleteCombatant, createActiveEffect, loseMomentum
   * @returns {Array} update     :   outcome (String: increased, reduced, min, max, reset, no change),
   *                                 starting (Number: what the character's Advantage was at the start of the routine)
   *                                 new (Number: what the character's Advantage is at the end of the routine)
   **/
  static async update (character, adjustment, context = "macro") {
    // GUARDS. Exit if ...
    // TODO: add error message to set adjustment
    if (adjustment === null) return  // ... no adjustment set
    if (
      (character === undefined)  // ... no character set
      || (character?.document?.documentName !== "Token")  // ... not a Token.
      || (context === "macro" && canvas.tokens.controlled.length !== 1) // ... only one Token is not selected when using the macros
    ) {
      return ui.notifications.error(game.i18n.localize("GMTOOLKIT.Token.SingleSelect"), { console: true })
    }
    // ... not in combat, unless clearing Advantage
    if (!character.inCombat && adjustment !== "clear") {
      return ui.notifications.error(`${game.i18n.format("GMTOOLKIT.Advantage.NotInCombat", { actorName: character.name, sceneName: game.scenes.viewed.name })}`, { console: true })
    }

    // Gather key character info into a single convenient object
    const characterInfo = { name: character.name }
    characterInfo.advantage = {
      personal: {
        current: character.actor.status.advantage.value,
        max: character.actor.status.advantage.max
      },
      group: {
        affiliation: character.actor.advantageGroup,
        current: await game.settings.get("wfrp4e", "groupAdvantageValues")[character.actor.advantageGroup]
      }
    }
    GMToolkit.log(false, characterInfo)

    // Make the adjustment to the token actor and capture the outcome
    const updatedAdvantage = await this.adjust(
      character,
      characterInfo.advantage.personal,
      adjustment
    )

    // Report the outcome to the user
    const update = await this.report(
      updatedAdvantage,
      character,
      characterInfo.advantage.personal,
      context
    )
    update.outcome = updatedAdvantage.outcome
    update.new = updatedAdvantage.new
    update.starting = updatedAdvantage.starting
    GMToolkit.log(false, update)
    return update
  }

  static async adjust (character, advantage, adjustment) {
    GMToolkit.log(false, `Attempting to ${adjustment} Advantage for ${character.name} from ${advantage.current}`)
    let outcome = ""

    switch (adjustment) {
      case "increase":
        if (game.settings.get("wfrp4e", "useGroupAdvantage")
          || advantage.max === undefined
          || advantage.current < advantage.max) {
          advantage.new = Number(advantage.current + 1)
          const updated = await updateCharacterAdvantage()
          updated ? outcome = "increased" : outcome = "nochange"
        } else {
          outcome = "max"
        }
        break
      case "reduce":
        if (advantage.current > 0) {
          advantage.new = Number(advantage.current - 1)
          const updated = await updateCharacterAdvantage();
          (updated) ? outcome = "reduced" : outcome = "nochange"
        } else {
          outcome = "min"
        }
        break
      case "clear":
        if (advantage.current === 0) {
          outcome = "min"
        } else {
          advantage.new = Number(0)
          const updated = await updateCharacterAdvantage();
          (updated) ? outcome = "reset" : outcome = "nochange"
        }
        break
    }
    return {
      outcome,
      starting: advantage.current,
      new: advantage.new
    }

    async function updateCharacterAdvantage () {
      let updated = ""

      if (!character.actor.isOwner) {
        return updated = await game.socket.emit(
          `module.${GMToolkit.MODULE_ID}`,
          {
            type: "updateAdvantage",
            payload: {
              character: character.actor.id,
              updateData: { "system.status.advantage.value": advantage.new }
            }
          }
        )

      } else {
        return updated = await character.actor.update({ "system.status.advantage.value": advantage.new })
      }
    }
  }

  static async report (updatedAdvantage, character, resourceBase, context) {
    const update = []
    let type = "success"
    const options = {
      permanent: game.settings.get(GMToolkit.MODULE_ID, "persistAdvantageNotifications"),
      console: true
    }

    switch (context) {
      case "wfrp4e:opposedTestResult":
        if (updatedAdvantage.outcome === "increased") update.context = game.i18n.format("GMTOOLKIT.Advantage.Context.WonOpposedTest", { actorName: character.name })
        if (updatedAdvantage.outcome === "reset") update.context = game.i18n.format("GMTOOLKIT.Advantage.Context.LostOpposedTest", { actorName: character.name })
        break
      case "loseMomentum":
        update.context = game.i18n.format("GMTOOLKIT.Advantage.Context.LoseMomentum", { actorName: character.name })
        break
      case "createCombatant":
        update.context = game.i18n.format("GMTOOLKIT.Advantage.Context.AddedToCombat", { actorName: character.name })
        break
      case "preDeleteCombatant":
        update.context = game.i18n.format("GMTOOLKIT.Advantage.Context.RemovedFromCombat", { actorName: character.name })
        break
      default:
        break
    }

    switch (updatedAdvantage.outcome) {
      case "increased":
        update.notice = game.i18n.format("GMTOOLKIT.Advantage.Increased", { actorName: character.name, startingAdvantage: updatedAdvantage.starting, newAdvantage: updatedAdvantage.new })
        break
      case "reduced":
        update.notice = game.i18n.format("GMTOOLKIT.Advantage.Reduced", { actorName: character.name, startingAdvantage: updatedAdvantage.starting, newAdvantage: updatedAdvantage.new })
        break
      case "reset":
        update.notice = game.i18n.format("GMTOOLKIT.Advantage.Reset", { actorName: character.name, startingAdvantage: updatedAdvantage.starting })
        break
      case "min":
        update.notice = game.i18n.format("GMTOOLKIT.Advantage.None", { actorName: character.name, startingAdvantage: updatedAdvantage.starting })
        type = "info"
        break
      case "max":
        update.notice = game.i18n.format("GMTOOLKIT.Advantage.Max", { actorName: character.name, startingAdvantage: updatedAdvantage.starting, maxAdvantage: resourceBase.max })
        type = "info"
        break
      case "nochange":
      default:
        update.notice = game.i18n.format("GMTOOLKIT.Message.UnexpectedNoChange")
        type = "warning"
        break
    }

    const message = (update.context ? update.context : "") + update.notice
    // Bypass individual player Advantage updates if Group Advantage is being used
    if (game.user.isGM && !(game.settings.get("wfrp4e", "useGroupAdvantage"))) ui.notifications.notify(message, type, options)
    // Force refresh the token hud if it is visible
    if (character.hasActiveHUD) {await canvas.hud.token.render(true)}
    update.context = (update.context) ? update.context : context
    return update
  }

  /**
   * Clears combatant flags set for increasing token Advantage during combat.
   * @param {Array} advantaged   :   Array of Combatant
   * @param {boolean} startOfRound  :   Unset sorAdvantage flag at end of round
   **/
  static unsetFlags (advantaged, startOfRound = false) {
    advantaged.filter(c => c.unsetFlag(GMToolkit.MODULE_ID, "advantage"))
    for (const legacyId of GMToolkit.LEGACY_MODULE_IDS) {
      advantaged.filter(c => c.unsetFlag(legacyId, "advantage"))
    }
    if (startOfRound) {
      advantaged.filter(c => c.unsetFlag(GMToolkit.MODULE_ID, "sorAdvantage"))
      for (const legacyId of GMToolkit.LEGACY_MODULE_IDS) {
        advantaged.filter(c => c.unsetFlag(legacyId, "sorAdvantage"))
      }
    }
    GMToolkit.log(false, "Advantage Flags: Unset.")
  }

  static async loseMomentum (combat) {
    let checkNotGained = "" // List of tokens that have not accrued advantage
    let checkGained = "" // List of tokens that have accrued advantage
    let noAdvantage = "" // List of tokens that have no advantage at the end of the round
    let combatantLine = "" // Html string for constructing dialog
    let round = combat.round
    const combatantAdvantage = []

    combat.combatants.forEach(combatant => {
      combatantAdvantage.startOfRound = GMToolkit.getFlagCompat(combatant, "sorAdvantage")
      // eslint-disable-next-line max-len
      combatantAdvantage.endOfRound = combatant.token.actor.system.status?.advantage?.value
      const checkToLoseMomentum
        = (combatantAdvantage.endOfRound - combatantAdvantage.startOfRound > 0)
          ? false
          : "checked"

      // TODO: Define and replace the inline styles within the stylesheet
      if (!combatantAdvantage.endOfRound) {
        noAdvantage += `<img src="${combatant.img}" style = "height: 2rem; border: none; padding-right: 2px; padding-left: 2px; max-width: fit-content;" alt="${combatant.name}" title="${combatant.name}">&nbsp;${combatant.name}</img>`
      } else {
        combatantLine = `
                <div class="form-group">
                <input type="checkbox" id="${combatant.tokenId}" name="${combatant.tokenId}" value="${combatant.name}" ${checkToLoseMomentum}> 
                <img src="${combatant.img}" style = "height: 2rem; vertical-align : middle; border: none; padding-right: 6px; padding-left: 2px; max-width: fit-content;" />
                <label for="${combatant.tokenId}" style = "text-align: left;  border: none;">  <strong>${combatant.name}</strong></label>
                <label for="${combatant.tokenId}"  style = "text-align: left;  border: none;"> ${combatantAdvantage.startOfRound} &rarr; ${combatantAdvantage.endOfRound} </label>
                </div>
                `;
        (checkToLoseMomentum)
          ? checkNotGained += combatantLine
          : checkGained += combatantLine
      }
    })

    // Exit without prompt if no combatant has Advantage to lose
    if (checkGained === "" && checkNotGained === "") {
      const uiNotice = game.i18n.format("GMTOOLKIT.Message.Advantage.NoCombatantsWithAdvantage", { combatRound: round })
      if (game.user.isGM) {
        ui.notifications.notify(uiNotice, "info", {
          permanent: game.settings.get(GMToolkit.MODULE_ID, "persistAdvantageNotifications"),
          console: true
        })
      }
      return
    }

    // Explain empty dialog sections
    if (checkGained === "") checkGained = `<div class="form-group">${game.i18n.localize("GMTOOLKIT.Message.Advantage.NoCombatantsAccruedAdvantage")}</div>`
    if (checkNotGained === "") checkNotGained = `<div class="form-group">${game.i18n.localize("GMTOOLKIT.Message.Advantage.NoCombatantsNotAccruedAdvantage")}</div>`
    if (noAdvantage === "") noAdvantage = game.i18n.localize("GMTOOLKIT.Message.Advantage.NoCombatantsWithoutAdvantage")

    const templateData = {
      gained: checkGained,
      notgained: checkNotGained,
      none: noAdvantage
    }
    const dialogContent = await renderTemplate(GMToolkit.modulePath("templates/gm-toolkit-advantage-momentum.html"), templateData)
    let lostAdvantage = ""

    foundry.applications.api.DialogV2.wait({
      window: { title: game.i18n.format("GMTOOLKIT.Dialog.Advantage.LoseMomentum.Title", { combatRound: round }) },
      rejectClose: false,
      content: dialogContent,
      buttons: [
        {
          label: game.i18n.localize("GMTOOLKIT.Dialog.Advantage.LoseMomentum.Button"),
          action: "reduceAdvantage",
          callback: async (event, button, dialog) => {
            const response = new foundry.applications.ux
              .FormDataExtended(button.form).object
            // Reduce advantage for selected combatants
            for ( const combatant of combat.combatants ) {
              if (response[combatant.tokenId] === combatant.name) {
                const token = canvas.tokens.placeables
                  .filter(a => a.id === combatant.tokenId)[0]
                const result = await this.update(token, "reduce", "loseMomentum")
                lostAdvantage += `${token.name}: ${result.starting} &rarr; ${result.new} <br/>`
              }
            }
            // Confirm changes made in whisper to GM
            if (lostAdvantage !== "") {
              const chatData = game.wfrp4e.utility.chatDataSetup(lostAdvantage, "gmroll", false)
              chatData.flavor = game.i18n.format("GMTOOLKIT.Message.Advantage.LostMomentum", { combatRound: round })
              ChatMessage.create(chatData, {})
            }
          }
        },
        {
          label: game.i18n.localize("GMTOOLKIT.Dialog.Cancel"),
          action: "cancel"
        }
      ]
    }
    )

    GMToolkit.log(false, "Lose Momentum at End of Round: Finished.")

  }

  /**
   * Actor used for Drilled checks: combatant link first, then token document (covers missing `combatant.actor`).
   * @param {Combatant} combatant
   * @returns {Actor|null}
   */
  static numericalSuperiorityResolvedActor (combatant) {
    return combatant.actor ?? combatant.token?.actor ?? null
  }

  /**
   * Normalize a talent display name for Drilled comparisons (trim + lower case).
   * @param {string|undefined|null} s
   * @returns {string}
   */
  static _normalizeDrilledName (s) {
    return (s ?? "").trim().toLowerCase()
  }

  /**
   * Whether a WFRP4e talent item counts as **Drilled** for numerical superiority.
   * Matches localized `NAME.Drilled` and case-insensitive **Drilled** (English compendium name),
   * so sheets that keep English names still match non-English UI locales.
   * @param {Item} item
   * @returns {boolean}
   */
  static _talentItemIsDrilled (item) {
    if (item?.type !== "talent") return false
    const nameNorm = Advantage._normalizeDrilledName(item.name)
    if (!nameNorm) return false
    const localizedNorm = Advantage._normalizeDrilledName(game.i18n.localize("NAME.Drilled"))
    return nameNorm === localizedNorm || nameNorm === "drilled"
  }

  /**
   * Scan actor items for Drilled advances (no logging). Caller must pass an actor with `.items` if iterating.
   * @param {Actor} actor   Actor with `items` collection.
   * @returns {{ total: number, matches: Array<{ name: string, advances: number }>, drilledName: string }}
   */
  static _drilledAdvancesScan (actor) {
    const drilledName = game.i18n.localize("NAME.Drilled")
    const matches = []
    let total = 0
    for (const item of actor.items) {
      if (Advantage._talentItemIsDrilled(item)) {
        const adv = Number(item.system?.advances?.value) || 0
        matches.push({ name: item.name, advances: adv })
        total += adv
      }
    }
    return { total, matches, drilledName }
  }

  /**
   * Total advances in the Drilled talent for an actor (all talent items with that name).
   * Diagnostic logging (package debug) runs only inside this routine.
   * @param {Actor|null|undefined} actor
   * @param {{ combatantId?: string, tokenId?: string }|undefined} [logContext]  Passed from numerical superiority only.
   * @returns {number}
   */
  static totalDrilledAdvances (actor, logContext) {
    if (!actor) {
      GMToolkit.log(false, "Advantage.totalDrilledAdvances", {
        logContext,
        reason: "missing actor",
        total: 0
      })
      return 0
    }
    if (!actor.items) {
      GMToolkit.log(false, "Advantage.totalDrilledAdvances", {
        logContext,
        actorId: actor.id,
        actorName: actor.name,
        reason: "no items collection",
        total: 0
      })
      return 0
    }
    const { total, matches, drilledName } = Advantage._drilledAdvancesScan(actor)
    GMToolkit.log(false, "Advantage.totalDrilledAdvances", {
      logContext,
      actorId: actor.id,
      actorName: actor.name,
      drilledName,
      matchCount: matches.length,
      ...(matches.length ? { matches } : {}),
      total
    })
    return total
  }

  /**
   * Weight for numerical superiority: 2 if the actor has at least one Drilled advance, else 1.
   * @param {Actor|null|undefined} actor
   * @param {{ combatantId?: string, tokenId?: string }|undefined} [logContext]  Passed through to `totalDrilledAdvances`.
   * @returns {1|2}
   */
  static numericalSuperiorityWeight (actor, logContext) {
    return Advantage.totalDrilledAdvances(actor, logContext) >= 1 ? 2 : 1
  }

  static numericalSuperiorityActorEligibleForDrilled (actor) {
    if (!actor?.hasCondition) return true
    return !(actor.hasCondition("dead") || actor.hasCondition("unconscious"))
  }

  static numericalSuperiorityActorEligibleForTally (actor) {
    return Advantage.numericalSuperiorityActorEligibleForDrilled(actor)
  }

  /**
   * When Group Advantage is active, shift one group pool Advantage toward the side with greater
   * weighted presence: **Friendly** tokens add to the players-side total; **Hostile** and **Neutral**
   * tokens add to the enemies-side total. Each combatant with a token contributes **1**, or **2** if
   * the encounter includes at least one tallied combatant with Drilled (≥1 advance) and this
   * combatant’s resolved actor also has Drilled (≥1 advance). Uses WFRP4e `enemies` /
   * `players` pools, clamped to 0 and the world's configured Advantage maximum.
   * @param {Combat} combat   Active encounter (caller ensures combatants exist).
   */
  static async applyGroupNumericalSuperiority (combat) {
    const updateGroupAdvantage = game.wfrp4e?.utility?.updateGroupAdvantage
    if (typeof updateGroupAdvantage !== "function") return

    const tallied = []
    let friendlyTallyCount = 0
    let enemyTallyCount = 0

    for (const c of combat.combatants) {
      const token = c.token
      if (!token) continue
      const d = token.disposition
      if (d !== CONST.TOKEN_DISPOSITIONS.FRIENDLY
        && d !== CONST.TOKEN_DISPOSITIONS.HOSTILE
        && d !== CONST.TOKEN_DISPOSITIONS.NEUTRAL) continue

      const resolved = Advantage.numericalSuperiorityResolvedActor(c)
      const ctx = { combatantId: c.id, tokenId: token.id }

      if (resolved && !Advantage.numericalSuperiorityActorEligibleForTally(resolved)) continue

      tallied.push({ c, token, d, resolved, ctx })

      if (d === CONST.TOKEN_DISPOSITIONS.FRIENDLY) friendlyTallyCount++
      else enemyTallyCount++
    }

    const drilledEngagementAllowed = friendlyTallyCount !== 1
    const drilledQuorumPlayers = drilledEngagementAllowed && friendlyTallyCount >= 2
    const drilledQuorumEnemies = drilledEngagementAllowed && enemyTallyCount >= 2

    let encounterHasDrilled = false
    let firstDrilledActorLabel = ""
    for (const t of tallied) {
      if (!t.resolved) continue
      if (!Advantage.numericalSuperiorityActorEligibleForDrilled(t.resolved)) continue

      const sideQuorum = (t.d === CONST.TOKEN_DISPOSITIONS.FRIENDLY)
        ? drilledQuorumPlayers
        : drilledQuorumEnemies
      if (!sideQuorum) continue

      if (Advantage.totalDrilledAdvances(t.resolved, t.ctx) >= 1) {
        encounterHasDrilled = true
        firstDrilledActorLabel = t.resolved.name ?? t.resolved.id
        break
      }
    }

    let playersSide = 0
    let enemiesSide = 0
    for (const t of tallied) {
      let w = 1
      if (encounterHasDrilled && t.resolved && Advantage.numericalSuperiorityActorEligibleForDrilled(t.resolved)) {
        const sideQuorum = (t.d === CONST.TOKEN_DISPOSITIONS.FRIENDLY)
          ? drilledQuorumPlayers
          : drilledQuorumEnemies
        if (sideQuorum) {
          w = Advantage.numericalSuperiorityWeight(t.resolved, t.ctx)
        }
      }
      if (t.d === CONST.TOKEN_DISPOSITIONS.FRIENDLY) playersSide += w
      else enemiesSide += w
    }

    GMToolkit.log(false, "applyGroupNumericalSuperiority", {
      combatId: combat.id,
      round: combat.round,
      friendlyTallyCount,
      enemyTallyCount,
      drilledEngagementAllowed,
      drilledQuorumPlayers,
      drilledQuorumEnemies,
      encounterHasDrilled,
      ...(encounterHasDrilled ? { exampleDrilledActor: firstDrilledActorLabel } : {}),
      playersSide,
      enemiesSide
    })

    if (playersSide + enemiesSide === 0) {
      return
    }

    if (playersSide === enemiesSide) {
      return
    }

    const current = foundry.utils.duplicate(game.settings.get("wfrp4e", "groupAdvantageValues"))
    let players = Number(current.players) || 0
    let enemies = Number(current.enemies) || 0
    const rawMax = game.settings.get("wfrp4e", "advantagemax")
    const maxAdv = Number.isNumeric(rawMax) ? Number(rawMax) : Infinity

    const favorEnemies = enemiesSide > playersSide

    if (favorEnemies) {
      enemies = Math.min(enemies + 1, maxAdv)
      players = Math.max(players - 1, 0)
    } else {
      players = Math.min(players + 1, maxAdv)
      enemies = Math.max(enemies - 1, 0)
    }

    if (players === Number(current.players) && enemies === Number(current.enemies)) {
      return
    }

    await game.wfrp4e.utility.updateGroupAdvantage({ players, enemies })
  }

} // End Class


Hooks.on("wfrp4e:applyDamage", async function (scriptArgs) {
  GMToolkit.log(false, scriptArgs)
  if (!scriptArgs?.opposedTest?.defenderTest?.context?.unopposed) return // Only apply when Outmanouevring (ie, damage from an unopposed test).
  if (scriptArgs.opposedTest.attackerTest.preData.dualWielding) return // Exit if this is the first strike when Dual Wielding
  if (!game.settings.get(GMToolkit.MODULE_ID, "automateDamageAdvantage")) return
  if (!inActiveCombat(scriptArgs.opposedTest.attackerTest.actor)
    || !inActiveCombat(scriptArgs.opposedTest.defenderTest.actor)) return // Exit if either actor is not in the active combat

  const uiNotice = `${game.i18n.format("GMTOOLKIT.Advantage.Automation.Outmanoeuvre", { actorName: scriptArgs.actor.name, attackerName: scriptArgs.attacker.name, totalWoundLoss: scriptArgs.totalWoundLoss } )}`
  const message = uiNotice
  const type = "success"
  const options = { permanent: game.settings.get(GMToolkit.MODULE_ID, "persistAdvantageNotifications"), console: true }

  if (game.user.isGM) {ui.notifications.notify(message, type, options)}

  // Clear advantage on actor that has taken damage when not using Group  Advantage
  if (!game.settings.get("wfrp4e", "useGroupAdvantage")) {
    const character = Array.from(game.combats.active.combatants)
      .filter(c => c.actor === scriptArgs.actor)[0]
      .token.object
    await Advantage.update(character, "clear", "wfrp4e:applyDamage" )
  }

  // Increase advantage on actor that dealt damage, as long as it has not already been updated for this test
  const character = Array.from(game.combats.active.combatants)
    .filter(c => c.actor === scriptArgs.attacker)[0]
    .token.object
  if (character.combatant.getFlag(GMToolkit.MODULE_ID, "advantage")?.outmanoeuvre !== scriptArgs.opposedTest.attackerTest.message.id) {
    await Advantage.update(character, "increase", "wfrp4e:applyDamage")

    if (!character.actor.isOwner) {
      await game.socket.emit(`module.${GMToolkit.MODULE_ID}`, {
        type: "setFlag",
        payload: {
          character: character.combatant,
          updateData: {
            flag: "advantage",
            key: "outmanoeuvre",
            value: scriptArgs.opposedTest.attackerTest.message.id
          }
        }
      })
    } else {
      await character.combatant.setFlag(GMToolkit.MODULE_ID, "advantage", { outmanoeuvre: scriptArgs.opposedTest.attackerTest.message.id })
    }

  } else {
    GMToolkit.log(true, `Advantage increase already applied to ${character.name} for outmanoeuvring.`)
  }

  GMToolkit.log(false, "Outmanoeuvring Advantage: Finished.")
})


Hooks.on("wfrp4e:opposedTestResult", async function (opposedTest, attackerTest, defenderTest) {
  GMToolkit.log(true, "wfrp4e:opposedTestResult", opposedTest, attackerTest, defenderTest)

  // For Group Advantage, handle tests which should not generate advantage
  if (
    game.settings.get("wfrp4e", "useGroupAdvantage")
    && attackerTest.data?.result?.options?.preventAdvantage === true
  ) {
    GMToolkit.log(true, "No advantage gained for winning an opposed test that should not generate advantage.")
    return
  }

  // CHARGING: Set Advantage flag if attacker and/or defender charged, and Group Advantage is not being used. Do this once before exiting for unopposed tests.
  if (!game.settings.get("wfrp4e", "useGroupAdvantage")) {
    // Flag attacker charging
    if (attackerTest.data.preData?.charging || attackerTest.data.result.other === game.i18n.localize("Charging")) {
      if (!attackerTest.actor.isOwner) {
        await game.socket.emit(`module.${GMToolkit.MODULE_ID}`, {
          type: "setFlag",
          payload: {
            character: Array.from(game.combats.active.combatants)
              .filter(c => c.actor === opposedTest.attacker)[0],
            updateData: {
              flag: "advantage",
              key: "charging",
              value: opposedTest.attackerTest.message.id
            }
          }
        })
      } else {
        await Array.from(game.combats.active.combatants)
          .filter(c => c.actor === opposedTest.attacker)[0]
          .setFlag(GMToolkit.MODULE_ID, "advantage", { charging: opposedTest.attackerTest.message.id })
      }
    }
    // Flag defender charging
    if (defenderTest.data.preData?.charging || defenderTest.data.result.other === game.i18n.localize("Charging")) {
      if (!defenderTest.actor.isOwner) {
        await game.socket.emit(`module.${GMToolkit.MODULE_ID}`, {
          type: "setFlag",
          payload: {
            character: Array.from(game.combats.active.combatants)
              .filter(c => c.actor === opposedTest.defender)[0],
            updateData: {
              flag: "advantage",
              key: "charging",
              value: opposedTest.attackerTest.message.id
            }
          }
        })
      } else {
        await Array.from(game.combats.active.combatants)
          .filter(c => c.actor === opposedTest.defender)[0]
          .setFlag(GMToolkit.MODULE_ID, "advantage", { charging: opposedTest.attackerTest.message.id })
      }
    }
  } // END: Flag for CHARGING

  // WINNING: Update Advantage for Opposed Tests
  if (defenderTest.context.unopposed) return // Unopposed Test. Advantage from outmanouevring is handled if damage is applied (on wfrp4e:applyDamage hook)
  if (attackerTest.data.result.canDualWield) return // Exit if this is the first strike when Dual Wielding
  if (!game.settings.get(GMToolkit.MODULE_ID, "automateOpposedTestAdvantage")) return

  const attacker = attackerTest.actor
  const defender = defenderTest.actor
  if (!inActiveCombat(attacker) || !inActiveCombat(defender)) return // Exit if either actor is not in the active combat

  const winner = opposedTest.result.winner === "attacker" ? attacker : defender
  const loser = opposedTest.result.winner === "attacker" ? defender : attacker

  const uiNotice = `${game.i18n.format("GMTOOLKIT.Advantage.Automation.OpposedTest", { winner: winner.name, loser: loser.name } )}`
  const message = uiNotice
  const type = "success"
  const options = { permanent: game.settings.get(GMToolkit.MODULE_ID, "persistAdvantageNotifications"), console: true }

  if (game.user.isGM) {ui.notifications.notify(message, type, options)}

  // Clear advantage on actor token that has lost opposed test when not using Group Advantage
  if (!game.settings.get("wfrp4e", "useGroupAdvantage")) {
    const character = Array.from(game.combats.active.combatants)
      .filter(c => c.actor === loser)[0]
      .token.object
    await Advantage.update(character, "clear", "wfrp4e:opposedTestResult" )
  }

  // Increase advantage on actor token that has won opposed test, as long as it has not already been updated for this test.
  const character = Array.from(game.combats.active.combatants)
    .filter(c => c.actor === winner)[0]
    .token.object
  if (character.combatant.getFlag(GMToolkit.MODULE_ID, "advantage")?.opposed !== opposedTest.attackerTest.message.id) {
    if (game.settings.get("wfrp4e", "useGroupAdvantage") === true && character.actor !== attacker) {
      GMToolkit.log(true, "No advantage gained for winning an opposed test you did not initiate.")
    } else {
      const resolution = await Advantage.update(character, "increase", "wfrp4e:opposedTestResult")
      if (!winner.isOwner) {
        await game.socket.emit(`module.${GMToolkit.MODULE_ID}`, {
          type: "setFlag",
          payload: {
            character: character.combatant,
            updateData: {
              flag: "advantage",
              key: "opposed",
              value: opposedTest.attackerTest.message.id
            }
          }
        })
        GMToolkit.log(true, "Advantage: wfrp4e:OpposedTestResult. Socket update resolved.", resolution )
      } else {
        await character.combatant
          .setFlag(GMToolkit.MODULE_ID, "advantage",
            { opposed: opposedTest.attackerTest.message.id }
          )
      }
    }
  } else {
    GMToolkit.log(true, `Advantage increase already applied to ${character.name} for winning opposed test.`)
  }

  GMToolkit.log(true, "Advantage: Opposed Test. Finished.")
})


// Intercept when an actor gets a condition during combat
Hooks.on("createActiveEffect", async function (conditionEffect) {
  GMToolkit.log(false, conditionEffect)
  // GUARDS. Exit if ...
  if (!game.settings.get(GMToolkit.MODULE_ID, "automateConditionAdvantage")) return // ... not using condition automation
  if (game.settings.get("wfrp4e", "useGroupAdvantage")) return // ... Group Advantage is in play
  if (!game.user.isUniqueGM) return // ... not a GM
  if (!conditionEffect.parent.inCombat) return // ... not in combat
  if (!conditionEffect.isCondition) return  // ... not a system recognised condition
  const nonConditions = ["dead", "fear", "grappling", "engaged"]
  const condId = conditionEffect.conditionId
  if (nonConditions.includes(condId)) return // ... not a core rules combat condition

  // Clear Advantage
  const token = canvas.tokens.placeables.filter(
    t => conditionEffect.parent.id === (t?.actor?.id || t?.document?.id)
  )[0]
  await Advantage.update(token, "clear", "createActiveEffect")

  // Notification declarations
  const uiNotice = `${game.i18n.format("GMTOOLKIT.Advantage.Automation.Condition", { character: conditionEffect.parent.name, condition: conditionEffect.displayLabel } )}`
  const message = uiNotice
  const type = "info"
  const options = {
    permanent: game.settings.get(GMToolkit.MODULE_ID, "persistAdvantageNotifications"),
    console: true
  }
  if (game.user.isGM) {ui.notifications.notify(message, type, options)}
})


Hooks.on("createCombatant", function (combatant) {
  // ADDING TO COMBAT: clear token Advantage only if enabled, and Group Advantage is not being used.
  // If Group Advantage is used, the system handles syncing individual advantage with the group
  if (game.user.isUniqueGM && game.settings.get(GMToolkit.MODULE_ID, "clearAdvantageCombatJoin") && !game.settings.get("wfrp4e", "useGroupAdvantage")) {
    const token = canvas.tokens.placeables
      .filter(a => a.id === combatant.tokenId)[0]
    Advantage.update(token, "clear", "createCombatant")
    Advantage.unsetFlags([combatant])
  }
})

Hooks.on("deleteCombatant", function (combatant) {
  if (game.user.isUniqueGM && game.settings.get(GMToolkit.MODULE_ID, "clearAdvantageCombatLeave")) {
    const token = canvas.tokens.placeables
      .filter(a => a.id === combatant.tokenId)[0]
    Advantage.update(token, "clear", "deleteCombatant")
  }
})


/**
 * Foundry v14+: use documented combat hooks (see hookEvents.combatRound / combatTurnChange).
 * `combatRound` runs on the initiating client before the Combat document is updated.
 */
Hooks.on("combatRound", async function (combat, updateData, updateOptions) {
  const numericalSettingsOn = game.settings.get("wfrp4e", "useGroupAdvantage")
    && game.settings.get(GMToolkit.MODULE_ID, "automateGroupAdvantageNumericalSuperiority")

  const logNumericalSkip = (reason, force = false) => {
    if (!numericalSettingsOn) return
    GMToolkit.log(force, "combatRound: numerical superiority skipped", {
      reason,
      combatId: combat.id,
      combatRound: combat.round,
      updateRound: updateData?.round
    })
  }

  if (!game.user.isUniqueGM) {
    logNumericalSkip("not_unique_gm", false)
    return
  }
  if (!combat.combatants.size) {
    logNumericalSkip("no_combatants")
    return
  }
  if (!Number.isFinite(updateData?.round)) {
    logNumericalSkip("invalid_update_round")
    return
  }
  if (!(updateData.round > combat.round)) {
    logNumericalSkip("round_not_advancing")
    return
  }
  if (!combat.started) {
    logNumericalSkip("combat_not_started")
    return
  }

  if (game.settings.get(GMToolkit.MODULE_ID, "promptMomentumLoss")
    && !game.settings.get("wfrp4e", "useGroupAdvantage")) {
    GMToolkit.log(false, "combatRound: compare Advantage at start and end of round")
    Advantage.loseMomentum(combat)
  }

  if (numericalSettingsOn && combat.round >= 1) {
    GMToolkit.log(false, "combatRound: Group Advantage numerical superiority")
    await Advantage.applyGroupNumericalSuperiority(combat)
  } else if (numericalSettingsOn) {
    logNumericalSkip("round_below_minimum")
  }
})


/**
 * After the Combat database update when round or turn advances; used for post-round bookkeeping.
 */
Hooks.on("combatTurnChange", async function (combat, prior, current) {
  if (!game.user.isUniqueGM || !combat.combatants.size) return
  if (!combat.round) return
  if (prior.round === current.round) return

  GMToolkit.log(false, "combatTurnChange (round): post-update bookkeeping — unsetting Advantage flags (not numerical superiority / Drilled)")
  const advFlagged = combat.combatants.filter(c => GMToolkit.getFlagCompat(c, "advantage") !== undefined)
  if (advFlagged.length) await Advantage.unsetFlags(advFlagged)

  GMToolkit.log(false, "combatTurnChange: Setting startOfRound flag")
  if (combat.turns && combat.isActive && !game.settings.get("wfrp4e", "useGroupAdvantage")) {
    combat.combatants.forEach(async c => {
      await c.setFlag(GMToolkit.MODULE_ID, "sorAdvantage", c.token.actor.system.status?.advantage?.value ?? 0)
      for (const legacyId of GMToolkit.LEGACY_MODULE_IDS) {
        await c.unsetFlag(legacyId, "sorAdvantage")
      }
      GMToolkit.log(false, `${c.name}:  ${c.getFlag(GMToolkit.MODULE_ID, "sorAdvantage")}`)
    })
  }
})
