// One stroke weight, one join style, one grid. Icons are drawn to sit beside
// the wordmark's hairlines rather than shout over them.

const s = (d, extra = "") =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"
        stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${d}</svg>`;

export const ICON = {
  home: s(`<path d="M3.6 10.4 12 3.9l8.4 6.5"/><path d="M5.6 9.6V19a1 1 0 0 0 1 1h3.2v-4.6h4.4V20h3.2a1 1 0 0 0 1-1V9.6"/>`),

  menu: s(`<path d="M4 6.5h11"/><path d="M4 12h11"/><path d="M4 17.5h11"/>
           <circle cx="19.2" cy="6.5" r="1.15" fill="currentColor" stroke="none"/>
           <circle cx="19.2" cy="12" r="1.15" fill="currentColor" stroke="none"/>
           <circle cx="19.2" cy="17.5" r="1.15" fill="currentColor" stroke="none"/>`),

  // The check-in tab wears the brand's own letter — the tilted L from BALANCE.
  // Checking in and the mark mean the same thing, so they may as well look it.
  checkin: s(`<path d="M7.4 8.1 11.9 16 18 12.4" stroke-width="1.9"/>`),

  account: s(`<circle cx="12" cy="8.4" r="3.5"/><path d="M4.9 20c.7-3.7 3.6-5.7 7.1-5.7s6.4 2 7.1 5.7"/>`),

  bag: s(`<path d="M5.6 8.2h12.8l-.9 11a1.6 1.6 0 0 1-1.6 1.5H8.1a1.6 1.6 0 0 1-1.6-1.5z"/>
          <path d="M9 8.2V6.9a3 3 0 0 1 6 0v1.3"/>`),

  back: s(`<path d="M14.5 5.5 8 12l6.5 6.5"/>`),
  close: s(`<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>`),
  chev: s(`<path d="M9.5 5.5 16 12l-6.5 6.5"/>`),
  plus: s(`<path d="M12 5.6v12.8M5.6 12h12.8"/>`),
  minus: s(`<path d="M5.6 12h12.8"/>`),
  check: s(`<path d="M5.5 12.4 10 16.8l8.5-9"/>`),

  pin: s(`<path d="M12 21s6.6-6.2 6.6-11a6.6 6.6 0 1 0-13.2 0C5.4 14.8 12 21 12 21z"/>
          <circle cx="12" cy="10" r="2.4"/>`),
  clock: s(`<circle cx="12" cy="12" r="8.4"/><path d="M12 7.3V12l3.2 2"/>`),
  people: s(`<circle cx="9.2" cy="9" r="3.1"/>
             <path d="M3.4 19.4c.6-3 2.8-4.7 5.8-4.7s5.2 1.7 5.8 4.7"/>
             <path d="M16.2 6.3a3.1 3.1 0 0 1 0 5.9"/><path d="M17.6 14.9c2.1.5 3.4 2.1 3.8 4.5"/>`),
  receipt: s(`<path d="M6 3.6h12v17l-2.4-1.6-2.4 1.6-2.4-1.6L8.4 21 6 19.4z"/>
              <path d="M9.4 8.6h5.2M9.4 12.6h5.2"/>`),
  instagram: s(`<rect x="3.6" y="3.6" width="16.8" height="16.8" rx="5"/>
                <circle cx="12" cy="12" r="3.9"/>
                <circle cx="17.1" cy="6.9" r="1.05" fill="currentColor" stroke="none"/>`),
  phone: s(`<path d="M6.3 3.9h3l1.5 3.8-1.9 1.4a11.5 11.5 0 0 0 5 5l1.4-1.9 3.8 1.5v3a1.8 1.8 0 0 1-2 1.8A15.9 15.9 0 0 1 4.5 5.9a1.8 1.8 0 0 1 1.8-2z"/>`),
  share: s(`<path d="M12 15.4V4.1"/><path d="m8.2 7.7 3.8-3.6 3.8 3.6"/>
            <path d="M5.6 13.2v5.6a1.6 1.6 0 0 0 1.6 1.6h9.6a1.6 1.6 0 0 0 1.6-1.6v-5.6"/>`),
  download: s(`<path d="M12 3.9v11.4"/><path d="m8.2 11.6 3.8 3.7 3.8-3.7"/>
               <path d="M5.6 14.6v4.2a1.6 1.6 0 0 0 1.6 1.6h9.6a1.6 1.6 0 0 0 1.6-1.6v-4.2"/>`),
  trash: s(`<path d="M4.9 6.9h14.2"/><path d="M9.4 6.9V5.3a1.4 1.4 0 0 1 1.4-1.4h2.4a1.4 1.4 0 0 1 1.4 1.4v1.6"/>
            <path d="M6.9 6.9 7.8 19a1.5 1.5 0 0 0 1.5 1.4h5.4a1.5 1.5 0 0 0 1.5-1.4l.9-12.1"/>`),
  edit: s(`<path d="M4.6 15.6 15.4 4.8a2.1 2.1 0 0 1 3 3L7.6 18.6l-4 1 1-4z"/>`),
  info: s(`<circle cx="12" cy="12" r="8.4"/><path d="M12 11.2v5"/>
           <circle cx="12" cy="8.2" r=".95" fill="currentColor" stroke="none"/>`),
  leaf: s(`<path d="M20 4.4C11.2 4 4.6 7.4 4.6 14.2a5.2 5.2 0 0 0 5.2 5.2C16.6 19.4 20 12.9 20 4.4z"/>
           <path d="M4.6 19.4C7.3 14.7 11 10.6 16 8"/>`),
  cup: s(`<path d="M5.4 7.2h11.2v6.2a5.6 5.6 0 0 1-11.2 0z"/>
          <path d="M16.6 8.6h1.6a2.4 2.4 0 0 1 0 4.8h-1.6"/><path d="M4.4 20.1h13.2"/>`),
  bell: s(`<path d="M9.5 19.4a2.6 2.6 0 0 0 5 0"/>
           <path d="M18.4 16.4H5.6c1.2-1 1.8-2.4 1.8-4.2v-1.6a4.6 4.6 0 1 1 9.2 0v1.6c0 1.8.6 3.2 1.8 4.2z"/>`),
};

/** Inflate an icon into a real node. */
export function icon(name, cls = "") {
  const span = document.createElement("span");
  span.innerHTML = ICON[name] || "";
  const svg = span.firstElementChild;
  if (svg && cls) svg.setAttribute("class", cls);
  return svg || span;
}
