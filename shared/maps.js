/**
 * Build a deep-link URL that opens driving directions in Google Maps or Apple Maps.
 *
 * Rules:
 *  - Prefer coordinates when both coords and name exist (a name alone is ambiguous).
 *  - Always build via URLSearchParams — never concatenate user input into a URL.
 *  - On mobile, navigate in the SAME tab (window.location.href) so the OS
 *    hands off to the installed Maps app; window.open() is popup-blocked.
 *
 * @param {object} d   navigate_details row (destination_lat, destination_lng, destination_name, address_line)
 * @param {'google'|'apple'} app
 * @returns {string}
 */
export function buildMapsUrl(d, app = 'google') {
  const hasCoords =
    Number.isFinite(d.destination_lat) && Number.isFinite(d.destination_lng);

  const dest = hasCoords
    ? `${d.destination_lat},${d.destination_lng}`
    : d.destination_name || d.address_line || '';

  if (app === 'apple') {
    return `https://maps.apple.com/?${new URLSearchParams({
      daddr: dest,
      dirflg: 'd',
    })}`;
  }

  return `https://www.google.com/maps/dir/?${new URLSearchParams({
    api: '1',
    destination: dest,
    travelmode: 'driving',
  })}`;
}
