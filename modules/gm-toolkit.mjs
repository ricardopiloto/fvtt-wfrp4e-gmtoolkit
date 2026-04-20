export default class GMToolkit {

  static MODULE_ID = "wfrp4e-gm-toolkit-jiban"
  static LEGACY_MODULE_IDS = ["wfrp4e-gm-toolkit"]

  static MODULE_ABBREV = "GMTOOLKIT"

  static MODULE_NAME = "GM Toolkit"

  static MODULE_NAME_FULL = "GM Toolkit (WFRP4e) -Jiban"

  static modulePath (relativePath) {
    const rel = relativePath?.startsWith("/") ? relativePath.slice(1) : relativePath
    return `modules/${this.MODULE_ID}/${rel}`
  }

  static _settingKey (namespace, key) {
    return `${namespace}.${key}`
  }

  static getSettingCompat (key, { writeback = false } = {}) {
    const currentSetting = game.settings.settings.get(this._settingKey(this.MODULE_ID, key))
    const defaultValue = currentSetting?.default
    const newValue = game.settings.get(this.MODULE_ID, key)

    for (const legacyId of this.LEGACY_MODULE_IDS) {
      const legacySettingKey = this._settingKey(legacyId, key)
      if (!game.settings.settings.has(legacySettingKey)) continue

      const legacyValue = game.settings.get(legacyId, key)
      if (newValue === defaultValue && legacyValue !== defaultValue) {
        if (writeback) {
          game.settings.set(this.MODULE_ID, key, legacyValue)
        }
        return legacyValue
      }
    }

    return newValue
  }

  static setSetting (key, value) {
    return game.settings.set(this.MODULE_ID, key, value)
  }

  static getFlagCompat (document, key, { writeback = false } = {}) {
    let newValue
    try {
      newValue = document?.getFlag?.(this.MODULE_ID, key)
    } catch (_) {
      newValue = undefined
    }
    if (newValue !== undefined) return newValue

    for (const legacyId of this.LEGACY_MODULE_IDS) {
      let legacyValue
      const legacyActive = game.modules?.get?.(legacyId)?.active === true

      if (legacyActive) {
        try {
          legacyValue = document?.getFlag?.(legacyId, key)
        } catch (_) {
          legacyValue = undefined
        }
      } else {
        const flags = document?.flags ?? document?.toObject?.()?.flags
        const path = `${legacyId}.${key}`
        legacyValue = foundry?.utils?.getProperty ? foundry.utils.getProperty(flags, path) : flags?.[legacyId]?.[key]
      }
      if (legacyValue !== undefined) {
        if (writeback) {
          try {
            document?.setFlag?.(this.MODULE_ID, key, legacyValue)
          } catch (_) {
            // Ignore writeback errors; read compatibility should never throw.
          }
        }
        return legacyValue
      }
    }

    return undefined
  }

  /**
   * A small helper function which leverages developer mode flags to gate debug logs.
   * @param {boolean} force forces the log even if the debug flag is not on
   * @param  {...any} args what to log
   */
  static log (force, ...args) {
    const shouldLog = force || game.modules.get("_dev-mode")?.api?.getPackageDebugValue(this.MODULE_ID)

    if (shouldLog) {
      // console.groupCollapsed("%s%c%s%c%s", "🛠️ ", "color: black; background: orange;", this.MODULE_ID, "color: unset; background: unset;", " | ", ...args)
      console.groupCollapsed("%s%c%s%c%s", "🛠️ ", "color: black; background: orange;", this.MODULE_ID, "color: unset; background: unset;", " | ", args[0])
      console.log(...args.slice(1))
      console.trace()
      console.groupEnd()
    }
  }

}
