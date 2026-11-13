// Meroro brand: name, colors and the logo mark shared by the app, splash and icon.
export const BRAND = {
  name: 'Meroro',
  tagline: 'Phone streaming studio',
  author: 'Kartik Sabale',
  from: '#8b5cf6',
  to: '#f472b6'
}

// Dark tile, gradient "M" monogram, white live dot. Mirrored by the icon drawing in scripts/fetch-bins.mjs.
export const LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="100 100 824 824" width="100%" height="100%">
<defs><linearGradient id="meroro-g" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#8b5cf6"/><stop offset="1" stop-color="#f472b6"/></linearGradient></defs>
<rect x="100" y="100" width="824" height="824" rx="186" fill="#0d0b14"/>
<rect x="105" y="105" width="814" height="814" rx="181" fill="none" stroke="#fff" stroke-opacity=".12" stroke-width="10"/>
<path d="M312 690V376L512 576L712 376V690" fill="none" stroke="url(#meroro-g)" stroke-width="92" stroke-linecap="round" stroke-linejoin="round"/>
<circle cx="512" cy="356" r="50" fill="#fff"/></svg>`
