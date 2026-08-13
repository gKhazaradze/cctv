import type { City } from '../types'

/**
 * The synthetic "All cameras" group.
 *
 * It owns no cameras of its own — selecting it makes the grid show every camera
 * across every city, collection and the user's own additions. Modelled as a
 * `City` like every other group so selection, the header and the theater treat
 * it uniformly; the "show everything" behaviour is a one-line special case in
 * App where cameras are filtered by group.
 */
export const ALL_GROUP_ID = '__all__'

export const allGroup: City = {
  id: ALL_GROUP_ID,
  name: 'All cameras',
  country: 'Everywhere',
  countryCode: '',
  kind: 'all',
  icon: '🌐',
  blurb: 'Every camera we have — cities, collections, and your own — in one grid.',
}
