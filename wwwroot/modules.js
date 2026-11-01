// Links remain ordinary section anchors when JavaScript is unavailable.
const panels = [...document.querySelectorAll('.area-panel')];
const areaLinks = [...document.querySelectorAll('[data-area]')];
const navigation = document.querySelector('.area-navigation');
const areas = new Set(panels.map(panel => panel.id));

function selectArea(area) {
  const selected = areas.has(area) ? area : 'backend';
  for (const panel of panels) panel.hidden = panel.id !== selected;
  for (const link of navigation.querySelectorAll('[data-area]')) {
    if (link.dataset.area === selected) link.setAttribute('aria-current', 'location');
    else link.removeAttribute('aria-current');
  }
}

for (const link of areaLinks) {
  link.addEventListener('click', event => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    selectArea(link.dataset.area);
  });
}
window.addEventListener('hashchange', () => selectArea(location.hash.slice(1)));
document.body.classList.add('library-enhanced');
selectArea(location.hash.slice(1));
