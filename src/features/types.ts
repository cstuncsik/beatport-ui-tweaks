export type FeatureMeta = {
  id: string
  label: string
  description: string
  enabled: boolean
  // paid feature, locked until a license is present; unused until the license step
  pro?: boolean
}

// A feature's behavior on beatport.com pages, run by features/runtime.ts.
export type ContentFeature = {
  id: string
  // once when the content script starts; listeners installed here check the body class themselves
  start?: () => void
  // when the stored flag arrives at start and whenever it flips later, after the body class was set
  toggle?: (enabled: boolean) => void
}
