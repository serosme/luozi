import type { ForgeConfig } from '@electron-forge/shared-types'

const config: ForgeConfig = {
  rebuildConfig: {
    // 都是 N-API 预编译产物，无需按 Electron ABI 重编
    ignoreModules: ['uiohook-napi', 'decibri'],
  },

  makers: [
    {
      name: '@electron-forge/maker-zip',
      platforms: ['win32'],
      config: {},
    },
  ],
}

export default config
