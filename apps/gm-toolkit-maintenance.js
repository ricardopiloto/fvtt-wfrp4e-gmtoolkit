import GMToolkit from "../modules/gm-toolkit.mjs"
import { getGMToolkitFolderIds, refreshToolkitContent, strip } from "../modules/utility.mjs"

export default class GMToolkitMaintenance
  extends HandlebarsApplicationMixin(ApplicationV2) {

  static DEFAULT_OPTIONS = {
    id: "gmtoolkit-maintenance",
    tag: "form",
    form: {
      handler: GMToolkitMaintenance.onSubmit,
      submitOnChange: false,
      closeOnSubmit: false
    },
    position: { width: 560 },
    window: {
      icon: "fas fa-gear",
      title: `${GMToolkit.MODULE_NAME_FULL} Maintenance`,
      contentClasses: ["standard-form"]
    },
    actions: {
      macros: GMToolkitMaintenance.updateMacros,
      tables: GMToolkitMaintenance.updateRollTable
    }
  }

  static PARTS = {
    form: {
      template: `/${GMToolkit.modulePath("templates/gm-toolkit-maintenance.html")}`,
      classes: ["gmtoolkit", "scrollable"]
    },
    footer: {
      template: "templates/generic/form-footer.hbs"
    }
  }

  async _prepareContext (options) {
    const context = await super._prepareContext(options)

    context.macros = await buildLocalizedContent(game.macros)
    context.tables = await buildLocalizedContent(game.tables)
    context.buttons = [
      {
        type: "submit",
        icon: "fa-solid fa-ban",
        label: "Cancel",
        action: "cancel"
      },
      {
        type: "button",
        icon: "fa-solid fa-th-list",
        label: "Update RollTables",
        action: "tables"
      },
      {
        type: "button",
        icon: "fa-solid fa-code",
        label: "Update Macros",
        action: "macros"
      }
    ]

    return context
  }

  static async onSubmit (event, form, formData) {
    if (event.submitter.dataset.action === "cancel") this.close()
  }

  static async updateMacros () {
    await refreshToolkitContent("Macro")
  }

  static async updateRollTable () {
    await refreshToolkitContent("RollTable")
  }

} // End class GMToolkitMaintenance

/**
 * Read toolkit version from compendium index entries (flags may use canonical or legacy module scope).
 * @param {ClientDocument|object} d Compendium index document or plain object with flags
 * @returns {string|undefined}
 */
function getCompendiumToolkitVersion (d) {
  if (!d) return undefined
  const raw = d.flags ?? d.toObject?.()?.flags ?? {}
  for (const scope of [GMToolkit.MODULE_ID, ...GMToolkit.LEGACY_MODULE_IDS]) {
    const ver = raw[scope]?.version
    if (ver !== undefined && ver !== null && ver !== "") return ver
  }
  return undefined
}

/** Image URL for Maintenance list rows (read `thumbnail`/`img`; do not assign onto Document instances). */
function maintenanceThumbnail (doc) {
  return doc.thumbnail ?? doc.img ?? "icons/svg/dice-target.svg"
}

async function buildLocalizedContent (documentType) {
  GMToolkit.log(false, "Starting buildLocalizedContent")

  const folderType = documentType === game.macros ? "Macro" : "RollTable"
  const gmtFolders = getGMToolkitFolderIds(folderType)
  const toolkitContent = documentType.filter(
    m => gmtFolders.includes(m.folder?.id)
  ).sort((a, b) => a.name.localeCompare(b.name))
  const contentArray = []
  let pack = []

  // Set translationKey prefix, depending on document type
  let translationKeyPrefix = ""
  if (documentType === game.macros) {
    translationKeyPrefix = "GMTOOLKIT.Macro"
    pack = game.packs.get(`${game.gmtoolkit.module.MODULE_ID}.gm-toolkit-macros`)
  }
  if (documentType === game.tables) {
    translationKeyPrefix = "GMTOOLKIT.Table"
    pack = game.packs.get(`${game.gmtoolkit.module.MODULE_ID}.gm-toolkit-tables`)
  }

  if (!pack) {
    GMToolkit.log(false, "Maintenance: compendium pack not found for", documentType === game.macros ? "macros" : "tables")
    return []
  }

  // Get Compendium documents
  const documents = await pack.getDocuments()
  const emptyLabel = game.i18n.localize("GMTOOLKIT.Dialog.Maintenance.Empty")

  // No local macros/tables: list compendium rows with Empty -> compendium version
  if (toolkitContent.length === 0) {
    const rows = documents
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(d => ({
        id: d.id,
        name: d.name,
        img: d.img,
        thumbnail: maintenanceThumbnail(d),
        translationKey: strip(d.name, translationKeyPrefix, "."),
        localVersion: emptyLabel,
        compendiumVersion: getCompendiumToolkitVersion(d)
      }))
    GMToolkit.log(false, "buildLocalizedContent: empty local folder, compendium-only rows =", rows.length)
    return rows
  }

  // Build localized array from world documents (plain rows — Macro/RollTable `thumbnail` is getter-only)
  for (const doc of toolkitContent) {
    const translationKey = strip(doc.name, translationKeyPrefix, ".")
    contentArray.push({
      id: doc.id,
      name: doc.name,
      img: doc.img,
      thumbnail: maintenanceThumbnail(doc),
      translationKey,
      localVersion: GMToolkit.getFlagCompat(doc, "version"),
      compendiumVersion: documents
        .filter(d => d.name === game.i18n.localize(translationKey))
        .map(d => getCompendiumToolkitVersion(d))[0]
    })
  }

  GMToolkit.log(false, "buildLocalizedContent: local rows =", contentArray.length, folderType)
  GMToolkit.log(false, "Ending buildLocalizedContent")

  return contentArray

}  // End function buildLocalizedContent()
