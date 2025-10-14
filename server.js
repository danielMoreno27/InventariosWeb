// server.js - Versión Corregida (Octubre 2025)

const express = require('express');
const path = require('path');
const fs = require('fs'); 
// const fsPromises = require('fs/promises'); 

const app = express();
const PORT = process.env.PORT || 3000;

// =======================================================
// === CONFIGURACIÓN DE ARCHIVOS Y DATOS EN MEMORIA ===
// =======================================================

// Rutas a los archivos de datos. Se usa 'path.join(__dirname, ...)' para que funcionen
// correctamente en cualquier servidor (como Render).
const INVENTARIO_FILE = path.join(__dirname, 'data', 'infoweb_diario_old.TXT');
const CATALOGOS_FILE = path.join(__dirname, 'data', 'builder.js'); 

let inventarioData = [];
let catalogosData = []; 
let telacolorToSkuMap = new Map(); // Para mapear tela/color a su SKU principal


// =======================================================
// === FUNCIONES DE CARGA Y GUARDADO DE DATOS ===
// =======================================================

function loadInventarioData() {
    try {
        const data = fs.readFileSync(INVENTARIO_FILE, 'utf8');
        const lines = data.split(/\r?\n/).filter(line => line.trim() !== '');
    
        inventarioData = lines.map(line => {
            const values = line.split(',');
            const item = {};

            // 1. Campos fijos (Usamos índices para mayor seguridad)
            const sku = (values[0] || '').trim().toUpperCase(); 
            const clave = (values[1] || '').trim().toLowerCase(); 
            const telacolor = (values[2] || '').trim().toLowerCase(); 
            
            // 2. Composición y campos finales: 
            let composicion = '';
            let lastFour = ['', '', '', ''];
            
            if (values.length >= 7) { 
                composicion = values.slice(3, values.length - 4).join(',').trim();
                lastFour = values.slice(-4).map(v => (v || '').trim());
            } else if (values.length > 3) {
                // Caso simplificado
                composicion = values.slice(3).join(',').trim();
            }

            // 3. Asignación al objeto item
            item.sku = sku;
            item.clave = clave;
            item.telacolor = telacolor;
            item.composicion = composicion;
            item.orden = lastFour[0] ? lastFour[0].toLowerCase() : '';
            item.mty = lastFour[1] || '';
            item.traslado = lastFour[2] || '';
            item.fecha = lastFour[3] || '';
    
            // 4. Mapeo (para catálogos)
            if (sku.length > 0 && telacolor.length > 0 && !telacolorToSkuMap.has(telacolor)) {
                telacolorToSkuMap.set(telacolor, sku);
            }
    
            return item;
        })
        .filter(item => item.sku.length > 0); 
    
        console.log(`[INIT] Inventario cargado. Total de artículos: ${inventarioData.length}`);
    } catch (error) {
        console.error(`[ERROR] No se pudo cargar el archivo de inventario (${INVENTARIO_FILE}):`, error.message);
        inventarioData = [];
    }
}

function loadCatalogosData() {
    try {
        // CRÍTICO: Eliminar caché para recargar correctamente si el archivo cambia
        if (require.cache[require.resolve(CATALOGOS_FILE)]) {
            delete require.cache[require.resolve(CATALOGOS_FILE)];
        }
        const data = require(CATALOGOS_FILE);
    
        catalogosData = data.map(catalogo => ({
            ...catalogo,
            // ESTANDARIZACIÓN DE NOMBRES EN MEMORIA
            catalogo_id: String(catalogo.catalogo_id || '').toLowerCase(), 
            nombre_catalogo: String(catalogo.nombre_catalogo || ''),
            paginas: catalogo.paginas.map(pagina => ({
                ...pagina,
                telas: (pagina.telas || []).map(telacolor => {
                    const normalizedTelacolor = String(telacolor).trim().toLowerCase();
                    const skuEncontrado = telacolorToSkuMap.get(normalizedTelacolor) || 'SKU_NO_ENCONTRADO';

                    return {
                        nombre: telacolor, 
                        sku: skuEncontrado 
                    };
                })
            })),
            totalTelas: catalogo.paginas.reduce((count, pagina) => count + (pagina.telas ? pagina.telas.length : 0), 0),
        }));
        console.log(`[INIT] Catálogos cargados en memoria. Total: ${catalogosData.length}`);
    } catch (error) {
        console.error(`[ERROR] No se pudo cargar el archivo de catálogos (${CATALOGOS_FILE}):`, error.message);
        catalogosData = [];
    }
}

function saveCatalogosData() {
    try {
        // Prepara los datos para guardar en el disco, revirtiendo el mapeo de 'telas' a solo strings.
        const dataToSave = catalogosData.map(catalogo => ({
            catalogo_id: catalogo.catalogo_id.toUpperCase(), 
            nombre_catalogo: catalogo.nombre_catalogo,
            paginas: catalogo.paginas.map(pagina => ({
                numero_pagina: pagina.numero_pagina,
                telas: pagina.telas.map(t => t.nombre || t) // Vuelve a guardar solo el nombre
            }))
        }));

        const jsonString = JSON.stringify(dataToSave, null, 4);
        const fileContent = `module.exports = ${jsonString};`;

        fs.writeFileSync(CATALOGOS_FILE, fileContent, 'utf8');

        console.log(`[ADMIN] Catálogos guardados en ${CATALOGOS_FILE}`);
        // Nota: La próxima solicitud a loadCatalogosData() recargará los datos si es necesario.
        return true;
    } catch (error) {
        console.error(`[ERROR] No se pudo guardar el archivo de catálogos:`, error.message);
        return false;
    }
}

// =======================================================
// === INICIALIZACIÓN Y MIDDLEWARE ===
// =======================================================

loadInventarioData();
loadCatalogosData();

app.use(express.static(path.join(__dirname, 'public'))); 
app.use(express.json()); 
app.use(express.urlencoded({ extended: true })); 

// =======================================================
// === RUTAS DE LECTURA PÚBLICAS (API GET) ===
// =======================================================

// 1. Obtener lista de catálogos
app.get('/api/catalogos', (req, res) => {
    // CORRECCIÓN CLAVE: Devolvemos las propiedades con los nombres estandarizados
    // para que funcionen con adminView.html y admin.js.
    const publicCatalogos = catalogosData.map(c => ({
        catalogo_id: c.catalogo_id || '', // ANTES: id
        nombre_catalogo: c.nombre_catalogo || '', // ANTES: nombre
        totalTelas: c.totalTelas
    }));
    res.json(publicCatalogos);
});

// 2. Obtener un catálogo específico
app.get('/api/catalogo/:id', (req, res) => {
    const catalogoId = req.params.id.toLowerCase();
    const catalogo = catalogosData.find(c => c.catalogo_id === catalogoId);

    if (catalogo) {
        res.json(catalogo);
    } else {
        res.status(404).json({ error: 'Catálogo no encontrado.' });
    }
});

// 3. Obtener detalle de SKU/Inventario (Busca por SKU o por Telacolor)
app.get('/api/sku/:id', (req, res) => {
    const searchId = decodeURIComponent(req.params.id).trim();
    const isSkuSearch = searchId.includes('-') || (searchId.length > 4 && !searchId.includes(' '));

    let detail;

    // A) BÚSQUEDA POR SKU
    if (isSkuSearch) {
        const normalizedSku = searchId.toUpperCase();
        detail = inventarioData.find(item => item.sku === normalizedSku);
    }

    // B) BÚSQUEDA POR TELA/COLOR
    if (!detail) {
        const normalizedTelacolor = searchId.toLowerCase(); 
        detail = inventarioData.find(item => 
            (item.telacolor && item.telacolor.trim() === normalizedTelacolor)
        );
    }

    if (!detail) {
        return res.status(404).json({ error: `Artículo '${searchId.toUpperCase()}' no encontrado en el inventario. Asegúrese de que el SKU o el nombre de la tela sean correctos.` });
    }

    const skuEncontrado = detail.sku;
    const movimientos = inventarioData.filter(item => item.sku === skuEncontrado);

    const response = {
        sku: skuEncontrado,
        clave: detail.clave,
        telacolor: detail.telacolor,
        composicion: detail.composicion,
        movimientos: movimientos
    };

    res.json(response);
});


// =======================================================
// === RUTAS DE ADMINISTRACIÓN (CRUD) ===
// =======================================================

// 4. CREATE (Crear Nuevo Catálogo)
app.post('/api/admin/catalogo', (req, res) => {
    const nuevoCatalogo = req.body;
    const nuevoId = String(nuevoCatalogo.catalogo_id || '').trim().toLowerCase();

    if (!nuevoId) {
        return res.status(400).json({ error: 'El campo catalogo_id es obligatorio.' });
    }

    if (catalogosData.some(c => c.catalogo_id === nuevoId)) {
        return res.status(409).json({ error: `El catálogo con ID '${nuevoId}' ya existe.` });
    }

    const catalogoAAnadir = {
        catalogo_id: nuevoId,
        nombre_catalogo: nuevoCatalogo.nombre_catalogo || 'Nuevo Catálogo',
        paginas: nuevoCatalogo.paginas || [],
    };

    catalogosData.push(catalogoAAnadir); 
    if (saveCatalogosData()) {
        res.status(201).json({ message: 'Catálogo creado exitosamente.', catalogo: catalogoAAnadir });
    } else {
        res.status(500).json({ error: 'Error al guardar los datos en el disco.' });
    }
});


// 5. UPDATE (Actualizar Catálogo Existente)
app.put('/api/admin/catalogo/:id', (req, res) => {
    const idToUpdate = req.params.id.trim().toLowerCase();
    const updates = req.body;

    const index = catalogosData.findIndex(c => c.catalogo_id === idToUpdate);

    if (index === -1) {
        return res.status(404).json({ error: `Catálogo con ID '${idToUpdate}' no encontrado.` });
    }

    if (updates.nombre_catalogo) {
        catalogosData[index].nombre_catalogo = updates.nombre_catalogo;
    }
    if (updates.paginas) {
        catalogosData[index].paginas = updates.paginas;
    }

    if (saveCatalogosData()) {
        res.json({ message: 'Catálogo actualizado exitosamente.', catalogo: catalogosData[index] });
    } else {
        res.status(500).json({ error: 'Error al guardar los datos en el disco.' });
    }
});


// 6. DELETE (Eliminar Catálogo)
app.delete('/api/admin/catalogo/:id', (req, res) => {
    const idToDelete = req.params.id.trim().toLowerCase();

    const initialLength = catalogosData.length;
    catalogosData = catalogosData.filter(c => c.catalogo_id !== idToDelete);

    if (catalogosData.length === initialLength) {
        return res.status(404).json({ error: `Catálogo con ID '${idToDelete}' no encontrado.` });
    }

    if (saveCatalogosData()) {
        res.json({ message: 'Catálogo eliminado exitosamente.' });
    } else {
        res.status(500).json({ error: 'Error al guardar los datos en el disco después de la eliminación.' });
    }
});


// =======================================================
// === INICIO DEL SERVIDOR ===
// =======================================================

app.listen(PORT, () => {
    console.log(`Servidor Altimatex Inventarios corriendo en http://localhost:${PORT}`);
});