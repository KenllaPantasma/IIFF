// --- VARIABLES GLOBALES ---
let mapa;
let capas = {};
let datosObras = [];

// --- 1. MAPAS BASE ---
const topo = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', { attribution: '© OpenTopoMap' });
const sat = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { attribution: '© Esri' });
const osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap' });
const limitesAdmin = L.tileLayer.wms("https://www.ign.es/wms-inspire/unidades-administrativas", {
    layers: 'AU.AdministrativeUnit',
    format: 'image/png',
    transparent: true,
    attribution: '© IGN'
});
const esriClarity = L.tileLayer('https://clarity.maptiles.arcgis.com/arcgis/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    attribution: '© Esri'
});

mapa = L.map('map', {
    center: [42.58, -6.15],
    zoom: 9,
    layers: [topo]
});

mapa.attributionControl.setPrefix('Fuente: MITECO, Junta de Castilla y León y Xunta de Galicia');

// --- 2. ESTILOS ---
const estiloNormal = { color: "#501b05", weight: 2, fillColor: "#2ecc71", fillOpacity: 0.4 };
const estiloFiltro = { color: "#ffeb3b", weight: 4, fillOpacity: 0.8, dashArray: '' };
const estiloPerimetros = { color: "#e74c3c", weight: 2, fillOpacity: 0.1, opacity: 1 };

const coloresRN2000 = { 'A': '#e67e22', 'B': '#3498db', 'C': '#9b59b6' };
function estiloRN2000(feature) {
    const tipo = feature.properties.TIPO;
    const color = coloresRN2000[tipo] || '#95a5a6';
    return { color: "#333333", weight: 1.5, dashArray: '5, 5', fillColor: color, fillOpacity: 0.4 };
}

const estiloUso = (f) => {
    let colorCategoria;
    const uso = f.properties.Agrupación_x_Uso;
    switch (uso) {
        case 'Forestal arbolado': colorCategoria = '#1a5928'; break;
        case 'Forestal desarbolado': colorCategoria = '#7fb366'; break;
        case 'No forestal': colorCategoria = '#f3d97d'; break;
        default: colorCategoria = '#cccccc';
    }
    return { fillColor: colorCategoria, weight: 0.5, color: 'white', fillOpacity: 0.6 };
};

// --- 3. FUNCIONES DE APOYO ---
function buscarDetalle(id) {
    return datosObras.find(o => o.id_obra.trim() === id.trim());
}

function onEachMonte(feature, layer) {
    let html = `<div class="popup-header">Monte: ${feature.properties.nombre_monte}</div>`;
    if (feature.properties.lista_obras) {
        const ids = feature.properties.lista_obras.split(',').map(s => s.trim());
        ids.forEach(id => {
            const info = buscarDetalle(id);
            if (info) {
                html += `
                <div class="obra-item" style="margin-bottom:8px; border-bottom:1px solid #eee; padding-bottom:5px;">
                    <b style="color:#27ae60;">📂 ${info.nombre}</b><br>
                    <button onclick="abrirObraEnSidebar('${info.id_obra}')" 
                            style="margin-top:5px; background:#27ae60; color:white; border:none; padding:4px 8px; border-radius:4px; cursor:pointer; width:100%;">
                        🔎 Ver detalles técnicos
                    </button>
                </div>`;
            }
        });
    }
    layer.bindPopup(html);
}

// --- 4. PANEL LATERAL (SIDEBAR) ---
window.abrirObraEnSidebar = function (id) {
    const info = buscarDetalle(id);
    if (!info) return;

    const sidebar = document.getElementById("sidebar");
    const content = document.getElementById('sidebar-content');
    const buscador = document.getElementById('buscador-container');
    const btnToggle = document.getElementById('toggle-buscador');

    // Minimizar el buscador automáticamente al abrir una obra
    if (buscador) {
        buscador.classList.add('minimizada');
        if (btnToggle) btnToggle.innerText = '❯'; // Cambia la flecha a "abrir"
    }

    // Vamos a añadir la lógica para que en PC el mapa se desplace (clase sidebar-abierto) y en móvil no.
    const esMovil = window.innerWidth <= 768;

    if (esMovil) {
        sidebar.style.width = "100%"; // Ocupa todo el ancho en el móvil
        document.body.classList.remove("sidebar-abierto"); // No desplazamos el mapa
    } else {
        sidebar.style.width = "450px";
        document.body.classList.add("sidebar-abierto"); // SÍ desplazamos el mapa en PC
    }

    // Forzamos a Leaflet a recalcular el tamaño del mapa tras el movimiento
    setTimeout(() => {
        if (mapa) mapa.invalidateSize({ animate: true });
    }, 400);

    content.innerHTML = `
        <div style="padding: 15px;">
            <h2 style="color:#27ae60; margin-top:0;">${info.nombre}</h2>
            <hr>
            <p><b>Expediente:</b> ${info.id_obra}</p>
            <p><b>Presupuesto:</b> ${info.presupuesto.toLocaleString()} €</p>
            <p><b>Fecha inicio:</b> ${info.fecha_ini}</p>
            <p><b>Empresa:</b> ${info.empresa}</p>
            <p><b>Director de Obra:</b> ${info.Dir_obra || 'No disponible'}</p>
            <h3>Trabajos incluidos:</h3>
            <ul>${info.trabajos.map(t => `<li style="margin-bottom:10px;">${t}</li>`).join('')}</ul>
            <div style="height: 50px;">
        </div>`;
    content.scrollTop = 0;
}

window.cerrarSidebar = function () {
    // 1. Cerramos el panel visualmente
    document.getElementById("sidebar").style.width = "0";

    // 2. Quitamos la clase al body para que el mapa vuelva a ocupar todo el ancho (PC)
    document.body.classList.remove("sidebar-abierto");

    // 3. Reajuste técnico: el mapa debe "enterarse" de que su contenedor ha crecido
    setTimeout(() => {
        if (mapa) {
            mapa.invalidateSize({ animate: true });
        }
    }, 400); // 400ms coincide con la duración de la transición en tu CSS
};

// --- 5. SUGERENCIAS BUSCADOR ---
function actualizarSugerencias() {
    const filtroTipo = document.getElementById('tipo-busqueda').value;
    const dl = document.getElementById('opciones-obras');
    const input = document.getElementById('input-busqueda');

    if (!dl) return;

    switch (filtroTipo) {
        case 'obra': input.placeholder = "Escribe ID o nombre de obra..."; break;
        case 'empresa': input.placeholder = "Escribe nombre de la empresa..."; break;
        case 'director': input.placeholder = "Escribe nombre del director..."; break;
        case 'incendio': input.placeholder = "Escribe nombre del incendio..."; break;
        default: input.placeholder = "Buscar en todo...";
    }

    dl.innerHTML = "";
    input.value = "";

    let sugerencias = new Set();

    if ((filtroTipo === 'incendio' || filtroTipo === 'todo') && capas.perimetros) {
        capas.perimetros.eachLayer(f => {
            const nombre = f.feature.properties.NOMBRE_INCENDIO;
            if (nombre) sugerencias.add(nombre);
        });
    }

    datosObras.forEach(o => {
        if (filtroTipo === 'obra' || filtroTipo === 'todo') sugerencias.add(`${o.id_obra} | ${o.nombre}`);
        if ((filtroTipo === 'empresa' || filtroTipo === 'todo') && o.empresa) sugerencias.add(o.empresa);
        if ((filtroTipo === 'director' || filtroTipo === 'todo') && o.Dir_obra) sugerencias.add(o.Dir_obra);
    });

    sugerencias.forEach(texto => {
        dl.innerHTML += `<option value="${texto}"></option>`;
    });
}

// --- BOTÓN INTELIGENTE COPERNICUS ---
const botonCopernicus = L.control({ position: 'topright' });
botonCopernicus.onAdd = function (map) {
    const div = L.DomUtil.create('div', 'leaflet-bar leaflet-control');
    div.innerHTML = `<button title="Ver esta zona en Copernicus (Sentinel-2)" style="background-color: #ffffff; border: none; width: 34px; height: 34px; cursor: pointer; font-size: 18px; display: flex; align-items: center; justify-content: center; border-radius: 2px;">🛰️</button>`;
    div.onclick = function () {
        const centro = mapa.getCenter();
        const urlLimpia = `https://browser.dataspace.copernicus.eu/?zoom=${mapa.getZoom()}&lat=${centro.lat.toFixed(5)}&lng=${centro.lng.toFixed(5)}`;
        window.open(urlLimpia, '_blank');
    };
    return div;
};
botonCopernicus.addTo(mapa);


// --- 6. CARGA PRINCIPAL (FETCH SERVIDOR) ---
async function cargarVisorLocal() {
    try {
        console.log("Descargando datos del servidor...");

        // Añadimos un parámetro aleatorio (?v=...) para saltar la caché del servidor
        const version = Date.now();

        const [resMontes, resPerimetros, resRN2000, resUso, resDetalle] = await Promise.all([
            fetch(`data/montes_actuacion.geojson?v=${version}`).then(r => { if (!r.ok) throw new Error("Falta montes"); return r.json(); }),
            fetch(`data/perimetros.geojson?v=${version}`).then(r => { if (!r.ok) throw new Error("Falta perimetros"); return r.json(); }),
            fetch(`data/rn_2000.geojson?v=${version}`).then(r => { if (!r.ok) throw new Error("Falta RN2000"); return r.json(); }),
            fetch(`data/uso_forestal.geojson?v=${version}`).then(r => { if (!r.ok) throw new Error("Falta uso"); return r.json(); }),
            fetch(`data/obras_detalle.json?v=${version}`).then(r => { if (!r.ok) throw new Error("Falta obras"); return r.json(); })
        ]);

        datosObras = resDetalle;
        window.jsonObrasDetalle = resDetalle;

        capas.montes = L.geoJSON(resMontes, { style: estiloNormal, onEachFeature: onEachMonte }).addTo(mapa);

        capas.perimetros = L.geoJSON(resPerimetros, {
            style: estiloPerimetros,
            onEachFeature: (f, l) => {
                l.bindTooltip(`<b>Incendio:</b> ${f.properties.NOMBRE_INCENDIO}`, { sticky: true, direction: "top" });
                l.on('click', (e) => {
                    capas.montes.eachLayer(monteLayer => {
                        if (monteLayer.getBounds().contains(e.latlng)) monteLayer.fire('click', e);
                    });
                });
            }
        }).addTo(mapa);

        capas.rn2000 = L.geoJSON(resRN2000, {
            style: estiloRN2000,
            onEachFeature: (f, l) => l.bindTooltip(`<b>Red Natura:</b> ${f.properties.SITE_NAME}<br>Código: ${f.properties.SITE_CODE}`)
        });

        capas.usoForestal = L.geoJSON(resUso, {
            style: estiloUso,
            onEachFeature: (f, l) => l.bindTooltip(`<b>Uso:</b> ${f.properties.Agrupación_x_Uso}`)
        });

        const overlayMaps = {
            "🏛️ Límites Administrativos": limitesAdmin,
            "🌲 Montes y Obras": capas.montes,
            "🔥 Perímetros": capas.perimetros,
            "🦋 Red Natura": capas.rn2000,
            "🍂 Uso Forestal": capas.usoForestal
        };

        // --- Control de capas adaptativo ---
        const esPantallaPequena = window.innerWidth < 768;

        const controlCapas = L.control.layers({ "Topografía": topo, "Satélite": sat, "Esri Clarity (Reciente)": esriClarity, "Callejero": osm }, overlayMaps, {
            position: esPantallaPequena ? 'bottomright' : 'topright', // Se va abajo en móviles
            collapsed: true
        }).addTo(mapa);

        // Si es móvil, también movemos el botón de Zoom al lado contrario (abajo izquierda)
        if (esPantallaPequena) {
            mapa.zoomControl.setPosition('bottomleft');
        }

        // 1. Creamos el buscador de direcciones pero SIN añadirlo al mapa directamente como control estándar
        const buscadorDirecciones = L.Control.geocoder({
            defaultMarkGeocode: false,
            placeholder: "Buscar dirección...",
            collapsed: false,
            geocoder: L.Control.Geocoder.nominatim({ geocodingQueryParams: { countrycodes: 'es' } })
        });

        // 2. Lo añadimos al mapa para que funcione la lógica
        buscadorDirecciones.addTo(mapa);

        // 3. MOVEMOS el elemento HTML del geocoder dentro de nuestro buscador de obras
        const contenedorDestino = document.getElementById('geocoder-insertar');
        contenedorDestino.appendChild(buscadorDirecciones.getContainer());

        // 4. Mantenemos tu lógica de 'markgeocode'
        buscadorDirecciones.on('markgeocode', function (e) {
            limpiarBusqueda();
            mapa.flyTo(e.geocode.center, 16, { animate: true, duration: 1.5 });
            const marker = L.marker(e.geocode.center).addTo(mapa)
                .bindPopup(`<b>Ubicación:</b><br>${e.geocode.name}`).openPopup();
            mapa.once('click', () => mapa.removeLayer(marker));
        });

        capas.montes.bringToFront();
        mapa.on('overlayadd', () => capas.montes.bringToFront());

        const selector = document.getElementById('tipo-busqueda');
        if (selector) selector.addEventListener('change', actualizarSugerencias);
        actualizarSugerencias();
        console.log("Capas cargadas con éxito");

    } catch (e) {
        console.error("Error detallado:", e);
        // Esto te dirá exactamente qué archivo está fallando en una ventana emergente
        alert("Error de carga: " + e.message);
    }
}


// --- 7. LÓGICA DEL BUSCADOR ---
function ejecutarBusqueda() {
    let valorInput = document.getElementById('input-busqueda').value.trim().toLowerCase();
    const filtroTipo = document.getElementById('tipo-busqueda').value;

    if (!valorInput) return limpiarBusqueda();

    let valorBusqueda = valorInput.includes('|') ? valorInput.split('|')[0].trim().toLowerCase() : valorInput;
    const listaHTML = document.getElementById('lista-resultados');
    const panel = document.getElementById('resultados-busqueda');
    listaHTML.innerHTML = "";

    let encontradoAlgunaCosa = false;

    let obrasFiltradas = datosObras.filter(o => {
        const matchObra = o.nombre.toLowerCase().includes(valorBusqueda) || o.id_obra.toLowerCase().includes(valorBusqueda);
        const matchEmpresa = o.empresa && o.empresa.toLowerCase().includes(valorBusqueda);
        const matchDirector = o.Dir_obra && o.Dir_obra.toLowerCase().includes(valorBusqueda);

        if (filtroTipo === 'obra') return matchObra;
        if (filtroTipo === 'empresa') return matchEmpresa;
        if (filtroTipo === 'director') return matchDirector;
        if (filtroTipo === 'todo') return matchObra || matchEmpresa || matchDirector;
        return false;
    }).sort((a, b) => {
        const nomA = a.nombre.toLowerCase(), nomB = b.nombre.toLowerCase();
        return nomA !== nomB ? nomA.localeCompare(nomB) : a.id_obra.localeCompare(b.id_obra);
    });

    obrasFiltradas.forEach(obra => {
        encontradoAlgunaCosa = true;
        const item = document.createElement('div');
        item.className = "item-res";
        item.style = "padding:12px; border-bottom:1px solid #eee; cursor:pointer; background:white;";
        item.innerHTML = `<div style="font-weight:bold; color:#27ae60;">📂 ${obra.nombre}</div><div style="font-size:0.85em; color:#666;">ID: ${obra.id_obra} | Director: ${obra.Dir_obra}</div>`;
        item.onclick = () => seleccionarObraCompleta(obra.id_obra);
        listaHTML.appendChild(item);
    });

    if (filtroTipo === 'incendio' || filtroTipo === 'todo') {
        capas.perimetros.eachLayer(layer => {
            const nombreIncendio = (layer.feature.properties.NOMBRE_INCENDIO || "").toLowerCase();
            if (nombreIncendio.includes(valorBusqueda)) {
                encontradoAlgunaCosa = true;
                const itemI = document.createElement('div');
                itemI.className = "item-res";
                itemI.style = "padding:12px; border-bottom:1px solid #eee; cursor:pointer; background:#fff5f5;";
                itemI.innerHTML = `<div style="font-weight:bold; color:#e74c3c;">🔥 Incendio: ${nombreIncendio}</div>`;
                itemI.onclick = () => {
                    layer.setStyle({ color: "#e74c3c", weight: 6, fillOpacity: 0.5 });
                    mapa.flyToBounds(layer.getBounds(), { padding: [50, 50], duration: 1.5 });
                    layer.openPopup();
                };
                listaHTML.appendChild(itemI);
            }
        });
    }

    if (encontradoAlgunaCosa) panel.style.display = "block";
    else { alert("No se hallaron resultados."); panel.style.display = "none"; }
}

window.seleccionarObraCompleta = function (idObra) {
    let bounds = L.latLngBounds();
    let encontradoEnMapa = false;

    capas.montes.eachLayer(layer => {
        const listaIdsObras = (layer.feature.properties.lista_obras || "").split(',').map(s => s.trim());
        if (listaIdsObras.includes(idObra)) {
            layer.setStyle(estiloFiltro);
            bounds.extend(layer.getBounds());
            encontradoEnMapa = true;
        } else {
            layer.setStyle({ opacity: 0.1, fillOpacity: 0.05 });
        }
    });

    if (encontradoEnMapa) mapa.fitBounds(bounds, { padding: [50, 50], duration: 1.5 });
    abrirObraEnSidebar(idObra);
}

window.cerrarResultados = function () {
    document.getElementById('resultados-busqueda').style.display = 'none';
}

window.limpiarBusqueda = function () {
    capas.montes.setStyle(estiloNormal);
    capas.perimetros.setStyle(estiloPerimetros);
    document.getElementById('input-busqueda').value = "";
    const panel = document.getElementById('resultados-busqueda');
    if (panel) panel.style.display = "none";
    cerrarSidebar();
    capas.perimetros.bringToBack();
    mapa.closePopup();

    const boundsIncendios = capas.perimetros.getBounds();
    if (boundsIncendios.isValid()) mapa.fitBounds(boundsIncendios, { padding: [50, 50] });
    else mapa.setView([42.58, -6.15], 9);
    capas.montes.bringToFront();
}

document.getElementById('btn-buscar').addEventListener('click', ejecutarBusqueda);
document.getElementById('btn-limpiar').addEventListener('click', limpiarBusqueda);

// --- 8. LEYENDAS ---
const leyendaUso = L.control({ position: 'bottomright' });
leyendaUso.onAdd = function () {
    const div = L.DomUtil.create('div', 'info legend');
    div.innerHTML = '<h4 style="margin:0 0 8px; font-size:14px;">Uso del Suelo</h4>';
    [{ nom: 'Forestal arbolado', col: '#1a5928' }, { nom: 'Forestal desarbolado', col: '#7fb366' }, { nom: 'No forestal', col: '#f3d97d' }].forEach(cat => {
        div.innerHTML += `<div style="display: flex; align-items: center; margin-bottom: 4px;"><i style="background: ${cat.col}; width: 18px; height: 18px; margin-right: 8px; border: 1px solid rgba(0,0,0,0.2); display: inline-block;"></i><span>${cat.nom}</span></div>`;
    });
    return div;
};

const leyendaRN2000 = L.control({ position: 'bottomright' });
leyendaRN2000.onAdd = function () {
    const div = L.DomUtil.create('div', 'info legend');
    div.innerHTML = '<h4 style="margin:0 0 8px; font-size:14px;">Red Natura 2000</h4>';
    [{ nom: 'ZEPA (Tipo A)', col: '#e67e22' }, { nom: 'LIC (Tipo B)', col: '#3498db' }, { nom: 'LIC/ZEPA (Tipo C)', col: '#9b59b6' }].forEach(cat => {
        div.innerHTML += `<div style="display: flex; align-items: center; margin-bottom: 4px;"><i style="background: ${cat.col}; width: 18px; height: 18px; margin-right: 8px; border: 1px dashed #333; display: inline-block;"></i><span>${cat.nom}</span></div>`;
    });
    return div;
};

mapa.on('overlayadd', e => {
    if (e.name.includes('Uso Forestal')) leyendaUso.addTo(mapa);
    if (e.name.includes('Red Natura')) leyendaRN2000.addTo(mapa);
});
mapa.on('overlayremove', e => {
    if (e.name.includes('Uso Forestal')) mapa.removeControl(leyendaUso);
    if (e.name.includes('Red Natura')) mapa.removeControl(leyendaRN2000);
});

// --- 9. MINIMAPA ---
const capaMinimapa = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { minZoom: 5, maxZoom: 6 });
new L.Control.MiniMap(capaMinimapa, {
    toggleDisplay: true, minimized: false, position: 'bottomleft', width: 150, height: 150,
    aimingRectOptions: { color: "#ff7800", weight: 1, interactive: false },
    shadowRectOptions: { color: "#000000", weight: 1, interactive: false, opacity: 0, fillOpacity: 0 }
}).addTo(mapa);

// --- LÓGICA PARA MINIMIZAR EL BUSCADOR ---
const btnToggle = document.getElementById('toggle-buscador');
const buscador = document.getElementById('buscador-container');

if (btnToggle) {
    btnToggle.addEventListener('click', () => {
        buscador.classList.toggle('minimizada');
        // Cambia la flecha según el estado
        btnToggle.innerText = buscador.classList.contains('minimizada') ? '❯' : '❮';
    });
}

cargarVisorLocal();