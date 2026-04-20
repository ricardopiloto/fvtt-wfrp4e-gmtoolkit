# GM Toolkit (WFRP 4e) — Jiban

[![Version](https://img.shields.io/badge/dynamic/json?url=https://raw.githubusercontent.com/ricardopiloto/fvtt-wfrp4e-gmtoolkit/dev/module.json&label=Current+Version&query=version&color=blue)](https://github.com/ricardopiloto/fvtt-wfrp4e-gmtoolkit/releases/latest)
[![Foundry Compatibility](https://img.shields.io/badge/dynamic/json.svg?url=https%3A%2F%2Fraw.githubusercontent.com%2Fricardopiloto%2Ffvtt-wfrp4e-gmtoolkit%2Fdev%2Fmodule.json&label=Foundry%20VTT%20(min)&query=$.compatibility.minimum&colorB=orange)](https://foundryvtt.com/releases/)
[![GitHub release](https://img.shields.io/github/release-date/ricardopiloto/fvtt-wfrp4e-gmtoolkit?label=Released&color=brightgreen)](https://github.com/ricardopiloto/fvtt-wfrp4e-gmtoolkit/releases)
[![GitHub commits](https://img.shields.io/github/commits-since/ricardopiloto/fvtt-wfrp4e-gmtoolkit/latest?label=Commits%20Since%20Release&color=yellowgreen)](https://github.com/ricardopiloto/fvtt-wfrp4e-gmtoolkit/commits/)<br>
![Latest zip downloads](https://img.shields.io/github/downloads/ricardopiloto/fvtt-wfrp4e-gmtoolkit/latest/wfrp4e-gm-toolkit-jiban.zip?label=Downloads%20(current%20version)&color=blue)

Fork of **[GM Toolkit for WFRP4e](https://github.com/Jagusti/fvtt-wfrp4e-gmtoolkit)** with maintenance and compatibility work for this table. Utility module with tweaks, enhancements and macros to help GMs run [Warhammer Fantasy Roleplay (4e)](https://github.com/moo-man/WFRP4e-FoundryVTT) on [Foundry Virtual Tabletop](https://foundryvtt.com/).

Feature documentation still largely matches the upstream project; see the [upstream wiki](https://github.com/Jagusti/fvtt-wfrp4e-gmtoolkit/wiki), including:

- Automating individual and group [Advantage](https://github.com/Jagusti/fvtt-wfrp4e-gmtoolkit/wiki/advantage-handling)
- Sending [Dark Whispers](https://github.com/Jagusti/fvtt-wfrp4e-gmtoolkit/wiki/send-dark-whispers)
- Setting [token vision and light](https://github.com/Jagusti/fvtt-wfrp4e-gmtoolkit/wiki/set-token-vision-and-light)
- Rolling secret [group skill tests](https://github.com/Jagusti/fvtt-wfrp4e-gmtoolkit/wiki/group-test)
- Non-combat [damage](https://github.com/Jagusti/fvtt-wfrp4e-gmtoolkit/wiki/launch-damage-console)
- [Session turnover](https://github.com/Jagusti/fvtt-wfrp4e-gmtoolkit/wiki/session-turnover) (including [Add XP](https://github.com/Jagusti/fvtt-wfrp4e-gmtoolkit/wiki/add-xp) and [Reset Fortune](https://github.com/Jagusti/fvtt-wfrp4e-gmtoolkit/wiki/reset-fortune))
- ~~Token HUD extensions~~ — disabled since upstream 9.0.0.

## Compatibility

From `module.json` (check the manifest for the exact line at install time):

- **Foundry VTT:** minimum **13** (verified **14.347** in this fork)
- **WFRP4e:** minimum **9.5.0** (verified **9.5.4**)

## Languages

The module ships with UI strings for **English**, **Português (Brasil)**, **French**, **Japanese**, **German**, and **Polski**. Choose the language in Foundry’s core settings.

## Installation

1. In Foundry setup, **Install Module** and use the manifest URL:

   `https://github.com/ricardopiloto/fvtt-wfrp4e-gmtoolkit/releases/latest/download/module.json`

2. Enable the module for your world: **Settings → Manage Modules → GM Toolkit (WFRP4e) - Jiban** (title may match your installed build).

3. **Import macros and tables** via **Module Settings → Update GM Toolkit Content** ([Toolkit Maintenance](https://github.com/Jagusti/fvtt-wfrp4e-gmtoolkit/wiki/toolkit-maintenance)), or import from the compendium packs manually.

4. **Refresh hotbar shortcuts** after updates (drag from the GM Toolkit macro folder so shortcuts reference the current macro versions).

## References

- [Changelog](CHANGELOG.md)
- [Releases](https://github.com/ricardopiloto/fvtt-wfrp4e-gmtoolkit/releases)
- [Issues](https://github.com/ricardopiloto/fvtt-wfrp4e-gmtoolkit/issues)
- [Upstream repository](https://github.com/Jagusti/fvtt-wfrp4e-gmtoolkit) and [upstream wiki](https://github.com/Jagusti/fvtt-wfrp4e-gmtoolkit/wiki) 