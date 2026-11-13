// Meroro brand: logo mark (gradient squircle, phone, broadcast waves) shared by the app, splash and icon.
export const BRAND = {
  name: 'Meroro',
  tagline: 'Phone streaming studio',
  author: 'Kartik Sabale',
  from: '#7c3aed',
  to: '#ec4899'
}

export const LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="100 100 824 824" width="100%" height="100%">
<defs><linearGradient id="meroro-g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${BRAND.from}"/><stop offset="1" stop-color="${BRAND.to}"/></linearGradient></defs>
<rect x="100" y="100" width="824" height="824" rx="186" fill="url(#meroro-g)"/>
<rect x="358" y="228" width="308" height="568" rx="44" fill="none" stroke="#fff" stroke-width="32"/>
<circle cx="512" cy="512" r="62" fill="#fff"/>
<g fill="none" stroke="#fff" stroke-width="18" stroke-linecap="round">
<path d="M588.6 447.7A100 100 0 0 1 588.6 576.3M435.4 447.7A100 100 0 0 0 435.4 576.3"/>
<path d="M610 429.7A128 128 0 0 1 610 594.3M414 429.7A128 128 0 0 0 414 594.3"/>
</g></svg>`
