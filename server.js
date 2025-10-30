// server.js - Versión con Inventario cargado desde Google Drive

const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const { config } = require('dotenv');
// Asumo que tienes el módulo Catalog definido en './models/Catalog'
const Catalog = require('./models/Catalog'); 

// ---------------------------------------------------------------
// === CONFIGURACIÓN GLOBAL ===
// ---------------------------------------------------------------

// URL de descarga directa del archivo TXT de Inventario en Google Drive
// ¡CRÍTICO! Asegúrate que la compartición de este archivo esté como "Cualquier persona con el enlace".
const DRIVE_INVENTARIO_URL = 'https://drive.google.com/uc?export=download&id=1ezEqhr26TvJhyZQv2VWUCXBmVbM630Yh';

let dotenvConfig = {};

// Lógica de carga de variables de entorno (.env)
if (process.env.NODE_ENV === 'production' && process.env.RENDER) {
    dotenvConfig.path = '/etc/secrets/.env';
} else {
    dotenvConfig.path = path.resolve(__dirname, '.env');
}

config(dotenvConfig);

// CRÍTICO: Configuración de la Base de Datos MongoDB
const DB_URI = process.env.MONGODB_URI || 'mongodb+srv://danicruz297_db_user:1Hrwu7aZArMLR7Pn@cluster0.blxed7z.mongodb.net/test?retryWrites=true&w=majority&appName=Cluster0';

mongoose.connect(DB_URI)
    .then(() => console.log("[DB] Conectado exitosamente a MongoDB."))
    .catch(err => {
        console.error('[DB] Error de conexión a MongoDB:', err.message);
        // El servidor puede continuar si solo la DB está fallando y queremos probar el inventario.
    })

const app = express();
const PORT = process.env.PORT || 3000;

// =======================================================
// === DATOS EN MEMORIA ===
// =======================================================

let inventarioData = [];
let telacolorToSkuMap = new Map();


// =======================================================
// === FUNCIÓN CLAVE: CARGA ASÍNCRONA DESDE DRIVE ===
// =======================================================

/**
 * Descarga y procesa el archivo de inventario directamente desde Google Drive.
 * @returns {void}
 */
async function loadInventarioData() {
    try {
        console.log('[INIT] Descargando inventario desde Google Drive...');
        
        // --- USO DE FETCH PARA DESCARGAR EL CONTENIDO ---
        const response = await fetch(DRIVE_INVENTARIO_URL);

        if (!response.ok) {
            throw new Error(`Error HTTP ${response.status}: No se pudo descargar el archivo.`);
        }
        
        // Obtener el contenido del archivo como texto plano
        const data = await response.text(); 
        // ---------------------------------------------------

        // El resto del procesamiento es igual a como lo tenías:
        const lines = data.split(/\r?\n/).filter(line => line.trim() !== '');

        inventarioData = lines.map(line => {
            const values = line.split(',').map(v => (v || '').trim());
            const item = {};
            
            const sku = (values[0] || '').toUpperCase(); 
            const telacolor = (values[2] || '').toLowerCase(); 
            const clave = (values[1] || '').toLowerCase();
            
            let composicion = '';
            let lastFour = ['', '', '', ''];

            if (values.length >= 7) { 
                composicion = values.slice(3, values.length - 4).join(',').trim(); 
                lastFour = values.slice(-4);
            } else if (values.length > 3) {
                composicion = values.slice(3).join(',').trim();
            }

            item.sku = sku;
            item.clave = clave;
            item.telacolor = telacolor;
            item.composicion = composicion;
            item.orden = lastFour[0] ? lastFour[0].toLowerCase() : '';
            item.mty = lastFour[1] || '';
            item.traslado = lastFour[2] || '';
            item.fecha = lastFour[3] || '';

            if (sku.length > 0 && telacolor.length > 0 && !telacolorToSkuMap.has(telacolor)) {
                telacolorToSkuMap.set(telacolor, sku);
            }

            return item;
        })
        .filter(item => item.sku.length > 0); 

        console.log(`[INIT] Inventario cargado. Total de artículos: ${inventarioData.length}`);
    } catch (error) {
        console.error(`[ERROR] No se pudo cargar el inventario (Drive):`, error.message);
        inventarioData = [];
    }
}


// =======================================================
// === INICIALIZACIÓN Y CONFIGURACIÓN DEL SERVIDOR ===
// =======================================================

/**
 * Inicializa el servidor Express, esperando primero a que se carguen los datos.
 * @returns {void}
 */
async function initializeServer() {
    // ESPERAR: El servidor debe esperar a que el inventario se descargue de Drive
    await loadInventarioData(); 

    // MIDDLEWARE
    app.use(express.static(path.join(__dirname, 'public'))); 
    app.use(express.json()); 
    app.use(express.urlencoded({ extended: true })); 

    // =======================================================
    // === RUTAS DE LECTURA PÚBLICAS (API GET) ===
    // =======================================================

    // 1. Obtener lista de catálogos
    app.get('/api/catalogos', async (req, res) => {
        try {
            const catalogos = await Catalog.find({})
                .select('catalogo_id nombre_catalogo totalTelas orden') 
                .sort({ orden: 1, nombre_catalogo: 1 });
        
            res.json(catalogos);
        } catch (error) {
            console.error("Error al obtener la lista de catálogos:", error);
            res.status(500).json({ error: 'Error interno del servidor al obtener catálogos.' });
        }
    });

    // 2. Obtener un catálogo específico
    app.get('/api/catalogo/:catalogoId', async (req, res) => {
        const id = req.params.catalogoId.toUpperCase(); 

        try {
            const catalogo = await Catalog.findOne({ catalogo_id: id });
        
            if (!catalogo) {
                return res.status(404).json({ error: `Catálogo con ID ${id} no encontrado.` });
            }
        
            res.json(catalogo);
        } catch (error) {
            console.error("Error al obtener catálogo específico:", error);
            res.status(500).json({ error: 'Error interno del servidor.' });
        }
    });

    // 3. Obtener detalle de SKU/Inventario (USA MEMORIA cargada de Drive)
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
                (item.telacolor && item.telacolor === normalizedTelacolor)
            );
        }

        if (!detail) {
            return res.status(404).json({ error: `Artículo '${searchId.toUpperCase()}' no encontrado en el inventario.` });
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

    // 4. Obtener el SKU de la tela a partir del nombre
    app.get('/api/catalogo/sku-by-telacolor/:telacolor', (req, res) => {
        const busqueda = req.params.telacolor;
        const telaColorLimpia = busqueda.trim().toLowerCase(); 
        const skuEncontrado = telacolorToSkuMap.get(telaColorLimpia);
        
        if (skuEncontrado) {
            res.json({ sku: skuEncontrado });
        } else {
            res.status(404).json({ error: `SKU no encontrado para la tela: ${busqueda}` });
        }
    });


    // =======================================================
    // === RUTAS DE ADMINISTRACIÓN (CRUD) ===
    // =======================================================
    
    // (Todas tus rutas POST, PUT, DELETE se mantienen sin cambios ya que usan MongoDB, no el inventario)

    // 4. CREATE (Crear Nuevo Catálogo)
    app.post('/api/admin/catalogo', async (req, res) => {
        const nuevoCatalogo = req.body;
        const nuevoId = String(nuevoCatalogo.catalogo_id || '').trim().toUpperCase();

        if (!nuevoId) {
            return res.status(400).json({ error: 'El campo catalogo_id es obligatorio.' });
        }
        const totalTelasCalculado = (nuevoCatalogo.paginas || []).reduce((count, pagina) => count + (pagina.telas ? pagina.telas.length : 0), 0);

        const catalogoAAnadir = new Catalog({
            catalogo_id: nuevoId,
            nombre_catalogo: nuevoCatalogo.nombre_catalogo || 'Nuevo Catálogo',
            paginas: nuevoCatalogo.paginas || [],
            totalTelas: totalTelasCalculado
        });

        try {
            const savedCatalog = await catalogoAAnadir.save();
            res.status(201).json({ message: 'Catálogo creado exitosamente en la DB.', catalogo: savedCatalog });

        } catch (error) {
            if (error.code === 11000) {
                return res.status(409).json({ error: `El catálogo con ID '${nuevoId}' ya existe.` });
            }
            console.error("Error al crear catálogo en DB:", error);
            res.status(500).json({ error: 'Error al crear el catálogo en la base de datos.', details: error.message });
        }
    });


    // 5. UPDATE (Actualizar Catálogo Existente)
    app.put('/api/catalogo/:catalogoId', async (req, res) => {
        const id = req.params.catalogoId.toUpperCase();
        const newData = req.body;
        
        if (newData.paginas) {
            newData.totalTelas = newData.paginas.reduce((count, pagina) => count + (pagina.telas ? pagina.telas.length : 0), 0);
        }

        try {
            const updatedCatalog = await Catalog.findOneAndUpdate(
                { catalogo_id: id },
                newData,
                { new: true, runValidators: true }
            );

            if (!updatedCatalog) {
                return res.status(404).json({ error: `Catálogo con ID ${id} no encontrado para actualizar.` });
            }
            
            res.json({ message: 'Catálogo actualizado exitosamente y guardado en la DB.', data: updatedCatalog });

        } catch (error) {
            console.error("Error al actualizar catálogo:", error);
            res.status(500).json({ error: 'Error al actualizar el catálogo en la base de datos.' });
        }
    });


    // 6. DELETE (Eliminar Catálogo)
    app.delete('/api/admin/catalogo/:id', async (req, res) => {
        const idToDelete = req.params.id.trim().toUpperCase();

        try {
            const result = await Catalog.deleteOne({ catalogo_id: idToDelete });

            if (result.deletedCount === 0) {
                return res.status(404).json({ error: `Catálogo con ID '${idToDelete}' no encontrado.` });
            }

            res.json({ message: 'Catálogo eliminado exitosamente de la DB.' });

        } catch (error) {
            console.error("Error al eliminar catálogo de la DB:", error);
            res.status(500).json({ error: 'Error al eliminar el catálogo de la base de datos.' });
        }
    });


    // =======================================================
    // === INICIO DEL SERVIDOR ===
    // =======================================================

    app.listen(PORT, () => {
        console.log(`Servidor Altimatex Inventarios corriendo en http://localhost:${PORT}`);
    });
}

// Llamada de inicio
initializeServer();