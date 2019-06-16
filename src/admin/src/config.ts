const {
  SOUND_FX_ENABLED,
  SCENE_FX_ENABLED
} = process.env;

//const requireConfigMessage = 'REQUIRED CONFIGURATION WAS NOT PROVIDED';

export const isSoundFxEnabled: boolean =
  Boolean(SOUND_FX_ENABLED === 'true') ||
  false;

export const isSceneFxEnabled: boolean =
  Boolean(SCENE_FX_ENABLED === 'true') ||
  false;
