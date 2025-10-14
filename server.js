// server.js
const express = require('express');
const path = require('path');
const fs = require('fs'); 
// const fsPromises = require('fs/promises'); // Descomentar si lo necesitas más adelante

const app = express();
const PORT = process.env.PORT || 3000;

// =======================================================
// === CONFIGURACIÓN DE ARCHIVOS Y DATOS EN MEMORIA ===
// =======================================================

// Archivo de Inventario (TXT)
const INVENTARIO_FILE = path.join(__dirname, 'data', 'infoweb_diario_old.TXT');
// Archivo de Datos de Catálogos (el que usa module.exports)
const CATALOGOS_FILE = path.join(__dirname, 'data', 'builder.js'); 

let inventarioData = [];
let catalogosData = []; 
let telacolorToSkuMap = new Map(); // NUEVO: Para mapear tela/color a su SKU principal


// =======================================================
// === FUNCIONES DE CARGA DE DATOS ===
// =======================================================

function loadInventarioData() {
    try {
        const data = fs.readFileSync(INVENTARIO_FILE, 'utf8');
        // Usar /\r?\n/ es más robusto para saltos de línea
        const lines = data.split(/\r?\n/).filter(line => line.trim() !== '');
        
        inventarioData = lines.map(line => {
            const values = line.split(',');
            const item = {};

            // 1. Campos fijos (Usamos índices para mayor seguridad)
            const sku = (values[0] || '').trim().toUpperCase(); 
            const clave = (values[1] || '').trim().toLowerCase(); 
            const telacolor = (values[2] || '').trim().toLowerCase(); 
            
            // 2. Composición y campos finales: Asumimos que los últimos 4 campos están ahí si values.length >= 7
            let composicion = '';
            let lastFour = ['', '', '', ''];
            
            if (values.length >= 7) { 
                 // Juntamos todo entre el Telacolor (índice 2) y los últimos 4 campos
                 composicion = values.slice(3, values.length - 4).join(',').trim();
                 lastFour = values.slice(-4).map(v => (v || '').trim());
            } else if (values.length > 3) {
                // Caso simplificado donde no hay 7 columnas completas, asumimos que el resto es composición
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
        // CRÍTICO: SOLO FILTRAMOS POR SKU. SI LA CLAVE ESTÁ VACÍA, NO IMPORTA.
        // Si un SKU es válido, debe cargarse.
        .filter(item => item.sku.length > 0); 
        
        console.log(`[INIT] Inventario cargado. Total de artículos: ${inventarioData.length}`);
    } catch (error) {
        // El error de JSON que viste era de otra prueba, pero esto manejará el error de carga de archivo si persiste.
        console.error(`[ERROR] No se pudo cargar el archivo de inventario (${INVENTARIO_FILE}):`, error.message);
        inventarioData = [];
    }
}

function loadCatalogosData() {
    try {
        // Importante: Eliminar caché para recargar si el archivo cambia en tiempo de ejecución
        if (require.cache[require.resolve(CATALOGOS_FILE)]) {
            delete require.cache[require.resolve(CATALOGOS_FILE)];
        }
        // Usamos require ya que es un archivo JS con module.exports
        const data = require(CATALOGOS_FILE);
        
        catalogosData = data.map(catalogo => ({
            ...catalogo,
            catalogo_id: String(catalogo.catalogo_id || '').toLowerCase(), 
            nombre_catalogo: String(catalogo.nombre_catalogo || ''),       
            paginas: catalogo.paginas.map(pagina => ({
                ...pagina,
                // CRÍTICO: Reemplazamos el array de strings 'telas' por un array de objetos con nombre y SKU
                telas: (pagina.telas || []).map(telacolor => {
                    const normalizedTelacolor = String(telacolor).trim().toLowerCase();
                    const skuEncontrado = telacolorToSkuMap.get(normalizedTelacolor) || 'SKU_NO_ENCONTRADO';

                    return {
                        nombre: telacolor, // Nombre original (con mayúsculas si las tenía)
                        sku: skuEncontrado // El SKU que usaremos para la búsqueda
                    };
                })
            })),
            // Recalculamos el total de telas, ahora usando el nuevo formato de paginas.telas
            totalTelas: catalogo.paginas.reduce((count, pagina) => count + (pagina.telas ? pagina.telas.length : 0), 0),
        }));
        console.log(`[INIT] Catálogos cargados en memoria. Total: ${catalogosData.length}`);
    } catch (error) {
        console.error(`[ERROR] No se pudo cargar el archivo de catálogos (${CATALOGOS_FILE}):`, error.message);
        catalogosData = [];
    }
}

// server.js (AGREGA esta función de utilidad)

function saveCatalogosData() {
    try {
        // 1. Limpieza de datos (igual que antes)
        const dataToSave = catalogosData.map(catalogo => ({
            catalogo_id: catalogo.catalogo_id.toUpperCase(), // Guardamos el ID en mayúsculas
            nombre_catalogo: catalogo.nombre_catalogo,
            paginas: catalogo.paginas.map(pagina => ({
                numero_pagina: pagina.numero_pagina,
                // Solo guardamos el array de strings/nombres de tela, como estaba originalmente
                telas: pagina.telas.map(t => t.nombre || t) // CRÍTICO: 't.nombre || t' para manejar si ya es un string
            }))
        }));

        // 2. Convertir a una cadena JSON con indentación (4 espacios)
        const jsonString = JSON.stringify(dataToSave, null, 4);
        
        // 3. CRÍTICO: ENVOLVER el JSON en 'module.exports = ...;'
        const fileContent = `module.exports = ${jsonString};`;

        fs.writeFileSync(CATALOGOS_FILE, fileContent, 'utf8');

        console.log(`[ADMIN] Catálogos guardados en ${CATALOGOS_FILE}`);
        // Volvemos a cargar los datos (esto no debería ser necesario si el archivo
        // se lee con 'require' en el inicio, pero es buena práctica)
        // loadCatalogosData(); 
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
app.use(express.json()); // Para manejar payloads JSON en solicitudes POST
app.use(express.urlencoded({ extended: true })); // Para manejar datos de formularios

// =======================================================
// === RUTAS DE LECTURA PÚBLICAS (API GET) ===
// =======================================================

// 1. Obtener lista de catálogos
app.get('/api/catalogos', (req, res) => {
    const publicCatalogos = catalogosData.map(c => ({
        catalogo_id: c.catalogo_id || '',
        nombre_catalogo: c.nombre_catalogo || '', 
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
    // CRÍTICO: Usar decodeURIComponent para manejar espacios (%20) y trim() para eliminar espacios
    const searchId = decodeURIComponent(req.params.id).trim();

    // 1. Normalizar el parámetro de búsqueda
    // Si contiene un guion, o parece un código corto y sin espacios, es probable SKU.
    const isSkuSearch = searchId.includes('-') || (searchId.length > 4 && !searchId.includes(' '));
    
    let detail;

    // A) BÚSQUEDA POR SKU
    if (isSkuSearch) {
        const normalizedSku = searchId.toUpperCase();
        detail = inventarioData.find(item => item.sku === normalizedSku);
    }

    // B) BÚSQUEDA POR TELA/COLOR (Intenta solo si no se encontró, o si claramente es un nombre de tela)
    if (!detail) {
        // Normalizamos el telacolor de la búsqueda a minúsculas
        const normalizedTelacolor = searchId.toLowerCase(); 
        
        // Ahora buscamos en el inventario, asegurando que el item.telacolor esté limpio también
        detail = inventarioData.find(item => 
            // Buscamos coincidencia exacta después de normalizar (trim y lower)
            (item.telacolor && item.telacolor.trim() === normalizedTelacolor)
        );
    }
    
    // C) Si sigue sin encontrarse, fallar.
    if (!detail) {
        return res.status(404).json({ error: `Artículo '${searchId.toUpperCase()}' no encontrado en el inventario. Asegúrese de que el SKU o el nombre de la tela sean correctos.` });
    }

    // 4. Usamos el SKU del artículo encontrado para obtener TODOS sus movimientos
    const skuEncontrado = detail.sku;
    const movimientos = inventarioData.filter(item => item.sku === skuEncontrado);

    // 5. Construimos la respuesta
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
// === RUTAS DE ADMINISTRACIÓN / POST (VACÍAS) ===
// =======================================================

// Aquí puedes añadir tus rutas para crear, modificar o eliminar datos (e.g., POST, PUT, DELETE)
// Si necesitas rutas para subir archivos o modificar catálogos, irían aquí.

/* // Ejemplo de ruta POST (descomentar y completar si es necesario)
app.post('/api/admin/nuevo-catalogo', (req, res) => {
    // const nuevoCatalogo = req.body;
    // Lógica para guardar el nuevo catálogo en builder.js
    res.status(201).json({ message: 'Catálogo creado' });
});

// Ejemplo de ruta para recargar datos sin reiniciar el servidor (útil para administración)
app.post('/api/admin/reload-data', (req, res) => {
    loadInventarioData();
    loadCatalogosData();
    res.json({ message: 'Datos de inventario y catálogos recargados con éxito.' });
});
*/

// server.js (AGREGA estas nuevas rutas CRUD)

// CRÍTICO: Asegúrate de tener 'app.use(express.json());' al inicio para leer el body
// app.use(express.json());

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

    // Adaptamos la estructura para que coincida con lo que tenemos en memoria
    const catalogoAAnadir = {
        catalogo_id: nuevoId,
        nombre_catalogo: nuevoCatalogo.nombre_catalogo || 'Nuevo Catálogo',
        paginas: nuevoCatalogo.paginas || [],
    };
    
    // Lo añadimos al array en memoria y guardamos
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

    // Actualizamos solo las propiedades permitidas (nombre, páginas)
    if (updates.nombre_catalogo) {
        catalogosData[index].nombre_catalogo = updates.nombre_catalogo;
    }
    if (updates.paginas) {
        // Si se actualizan las páginas, debemos recargar el mapeo de SKU (esto es complejo, por ahora solo reemplazaremos)
        // Para simplificar, solo permitiremos reemplazar el array de páginas completo.
        // En una app real, deberías validar la estructura de las páginas/telas.
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
    // Filtramos para eliminar el catálogo de la lista en memoria
    catalogosData = catalogosData.filter(c => c.catalogo_id !== idToDelete);

    if (catalogosData.length === initialLength) {
        return res.status(404).json({ error: `Catálogo con ID '${idToDelete}' no encontrado.` });
    }

    if (saveCatalogosData()) {
        res.json({ message: 'Catálogo eliminado exitosamente.' });
    } else {
        // En caso de fallo, intentamos revertir (aunque esto es un poco avanzado para empezar)
        // Por ahora, solo reportamos el error.
        res.status(500).json({ error: 'Error al guardar los datos en el disco después de la eliminación.' });
    }
});


// =======================================================
// === INICIO DEL SERVIDOR ===
// =======================================================

app.listen(PORT, () => {
    console.log(`Servidor Altimatex Inventarios corriendo en http://localhost:${PORT}`);
});