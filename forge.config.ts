import type { ForgeConfig } from '@electron-forge/shared-types'
import MakerZIP from '@electron-forge/maker-zip'

export default {
  rebuildConfig: {
    ignoreModules: ['uiohook-napi', 'decibri'],
  },
  makers: [
    new MakerZIP({}, ['win32']),
  ],
} satisfies ForgeConfig
