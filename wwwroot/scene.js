// A small sprite layer shared by both missions. Geometry comes from the renderer.
const factory = {
  manifest: null,
  get anchors() { return this.manifest.anchors; },
  path(...names) { return names.map(name => this.anchors[name]); },
  position(element, point) {
    element.style.left = `${point[0] / 10.4}%`;
    element.style.top = `${point[1] / 6.2}%`;
  },
  sprite(element, name, point, local = false) {
    const asset = this.manifest.assets[name];
    const img = element.querySelector('img');
    if (img && img.getAttribute('src') !== asset.file) img.src = asset.file;
    element.style.width = `calc(var(--u) * ${asset.size[0]})`;
    element.style.height = `calc(var(--u) * ${asset.size[1]})`;
    if (local) {
      element.style.left = `calc(var(--u) * ${-asset.pivot[0]})`;
      element.style.top = `calc(var(--u) * ${-asset.pivot[1]})`;
    } else {
      this.position(element, point);
      element.style.marginLeft = `calc(var(--u) * ${-asset.pivot[0]})`;
      element.style.marginTop = `calc(var(--u) * ${-asset.pivot[1]})`;
    }
  },
  update(state, working) {
    this.sprite(document.querySelector('.robot-art'), working && !state.paused ? 'robot-working' : 'robot-idle', null, true);
    this.sprite(document.querySelector('.warehouse-art'), state.databaseOnline ? 'storage-online' : 'storage-offline', null, true);
    const stock = document.querySelector('#stock-packages');
    const count = Math.min(3, state.orders.length);
    if (stock.childElementCount !== count) {
      stock.replaceChildren(...Array.from({length: count}, (_, i) => {
        const box = document.createElement('span'); box.className = 'stock-box';
        box.innerHTML = '<img alt="" draggable="false">';
        this.sprite(box, 'parcel', this.manifest.stockSlots[i]); return box;
      }));
    }
  }
};
const factoryReady = fetch('/assets/factory/manifest.json?v=geometry-2').then(response => {
  if (!response.ok) throw new Error('Factory asset manifest could not be loaded.');
  return response.json();
}).then(manifest => {
  factory.manifest = manifest;
  document.querySelector('.factory-floor').src = manifest.assets['factory-floor'].file;
  document.documentElement.style.setProperty('--parcel-image', `url("${manifest.assets.parcel.file}")`);
  for (const [name, selector] of Object.entries({sender:'.sender',api:'.api-station',queue:'.queue-station',worker:'.worker-station',database:'.database-station'})) {
    factory.position(document.querySelector(selector), manifest.stations[name]);
  }
  factory.sprite(document.querySelector('.api-art'), 'intake-scanner', null, true);
  factory.sprite(document.querySelector('#parcel'), 'parcel', null, true);
  document.querySelector('#parcel span').style.top = `calc(var(--u) * ${manifest.assets.parcel.pivot[1] + 26})`;
  for (const [id, names] of [['direct-route',['apiOut','dbApproach','dbIn']], ['queued-route',['apiOut','branch','queueIn','queue','worker','turn','dbApproach','dbIn']]]) {
    document.getElementById(id).setAttribute('d', factory.path(...names).map((p,i)=>`${i?'L':'M'}${p.join(' ')}`).join(' '));
  }
});
