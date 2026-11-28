// Both frontends use the same authenticated room and registration service.
export function gameApiPath(route: 'accounts' | 'rooms'): string {
  return 'https://double-game-black.vercel.app/api/' + route;
}
