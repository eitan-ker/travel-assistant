export enum Role {
  System = 'system',
  User = 'user',
  Assistant = 'assistant',
}

export enum Verdict {
  Pass = 'PASS',
  Refine = 'REFINE',
  Clarify = 'CLARIFY',
}

export enum SupervisorVerdict {
  Pass = 'PASS',
  Refined = 'REFINED',
  Skipped = 'SKIPPED',
  Clarify = 'CLARIFY',
}

export enum DataSource {
  Claude = 'Claude',
  OpenWeatherMap = 'OpenWeatherMap',
  RestCountries = 'RestCountries',
  OpenTripMap = 'OpenTripMap',
  Frankfurter = 'Frankfurter',
  KnowledgeBase = 'Knowledge Base',
  WebSearch = 'Web Search',
}

export enum DataType {
  Weather = 'weather',
  CountryInfo = 'country_info',
  Attractions = 'attractions',
}
