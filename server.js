// server.js - Versión Final (Solo MongoDB para Catálogos)

const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
const { config } = require('dotenv');
const Catalog = require('./models/Catalog');

let dotenvConfig = {};

// Verificar si estamos en un entorno Render (donde se usa la ruta de secrets)
if (process.env.NODE_ENV === 'production' && process.env.RENDER) {
    // Render almacena Secret Files en /etc/secrets/<filename>
    dotenvConfig.path = '/etc/secrets/.env';
} else {
    // Entorno local o de desarrollo
    dotenvConfig.path = path.resolve(__dirname, '.env');
}

// Cargar las variables de entorno usando la ruta definida
config(dotenvConfig);

// CRÍTICO: Asegúrate de que esta URL funcione y que tu DB esté activa.
const DB_URI = process.env.MONGODB_URI || 'mongodb+srv://danicruz297_db_user:1Hrwu7aZArMLR7Pn@cluster0.blxed7z.mongodb.net/test?retryWrites=true&w=majority&appName=Cluster0';

mongoose.connect(DB_URI)
    .then(() => console.log("[DB] Conectado exitosamente a MongoDB."))
    .catch(err => {
        console.error('[DB] Error de conexión a MongoDB:', err.message);
        // Si no puedes conectarte a la DB, el servidor no debería iniciar.
        // process.exit(1); 
    })

const app = express();
const PORT = process.env.PORT || 3000;

// =======================================================
// === CONFIGURACIÓN DE ARCHIVOS Y DATOS EN MEMORIA ===
// =======================================================

const INVENTARIO_FILE = path.join(__dirname, 'data', 'infoweb_diario_old.TXT');

let inventarioData = [];
// SE ELIMINA: let catalogosData = []; 
let telacolorToSkuMap = new Map();


// =======================================================
// === FUNCIONES DE CARGA Y GUARDADO DE DATOS (Solo Inventario) ===
// =======================================================

function loadInventarioData() {
    try {
        // Usamos fs/promises como en server.js o fs.readFileSync si no es asíncrono.
        // Asumiendo que esta función es síncrona, usamos fs.readFileSync.
        const data = fs.readFileSync(INVENTARIO_FILE, 'utf8');
        const lines = data.split(/\r?\n/).filter(line => line.trim() !== '');

        inventarioData = lines.map(line => {
            // PASO 1: Dividir y LIMPIAR (trim) todos los valores de la línea
            const values = line.split(',').map(v => (v || '').trim());
            const item = {};
            
            // PASO 2: Asignar y normalizar mayúsculas/minúsculas
            // Ahora solo necesitamos aplicar mayúsculas/minúsculas, ya están limpias de espacios.
            const sku = (values[0] || '').toUpperCase(); // Solo a mayúsculas
            const telacolor = (values[2] || '').toLowerCase(); // Solo a minúsculas
            
            // La columna 1 ('clave') también debe ir a minúsculas para la búsqueda.
            const clave = (values[1] || '').toLowerCase();
            
            // Lógica para la 'composicion' y 'lastFour' (indices)
            let composicion = '';
            let lastFour = ['', '', '', ''];

            if (values.length >= 7) { 
                // Usar values.slice que ya son strings limpios
                composicion = values.slice(3, values.length - 4).join(',').trim(); 
                lastFour = values.slice(-4);
            } else if (values.length > 3) {
                composicion = values.slice(3).join(',').trim();
            }

            // PASO 3: Construir el objeto
            item.sku = sku;
            item.clave = clave;
            item.telacolor = telacolor; // Ya está limpio y en minúsculas
            item.composicion = composicion;
            item.orden = lastFour[0] ? lastFour[0].toLowerCase() : '';
            item.mty = lastFour[1] || '';
            item.traslado = lastFour[2] || '';
            item.fecha = lastFour[3] || '';

            // Mapeo (para catálogos)
            // Esto solo se ejecuta una vez por cada tela única para obtener un SKU de ejemplo.
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

// SE ELIMINA: function loadCatalogosData() { ... }
// SE ELIMINA: function saveCatalogosData() { ... }

// =======================================================
// === INICIALIZACIÓN Y MIDDLEWARE ===
// =======================================================

loadInventarioData();
// SE ELIMINA: loadCatalogosData();

app.use(express.static(path.join(__dirname, 'public'))); 
app.use(express.json()); 
app.use(express.urlencoded({ extended: true })); 

// =======================================================
// === RUTAS DE LECTURA PÚBLICAS (API GET) - USAN DB y Memoria ===
// =======================================================

// 1. Obtener lista de catálogos (USA DB - ¡CORRECTO!)
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

// 2. Obtener un catálogo específico (USA DB - ¡CORRECTO!)
app.get('/api/catalogo/:catalogoId', async (req, res) => {
    // Aseguramos que el ID de búsqueda esté en el mismo formato que en la DB (toUpperCase)
    const id = req.params.catalogoId.toUpperCase(); 

    try {
        // Usamos findOne para buscar por el ID que definimos en el esquema.
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

// 3. Obtener detalle de SKU/Inventario (USA MEMORIA - ¡CORRECTO!)
app.get('/api/sku/:id', (req, res) => {
    // ... (Tu lógica de búsqueda de inventario se mantiene intacta, lo cual es correcto)
    
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
// === RUTAS DE ADMINISTRACIÓN (CRUD) - AHORA SOLO DB ===
// =======================================================

// 4. CREATE (Crear Nuevo Catálogo) - ¡USA DB AHORA!
app.post('/api/admin/catalogo', async (req, res) => {
    const nuevoCatalogo = req.body;
    const nuevoId = String(nuevoCatalogo.catalogo_id || '').trim().toUpperCase(); // Usamos toUpperCase por el schema

    if (!nuevoId) {
        return res.status(400).json({ error: 'El campo catalogo_id es obligatorio.' });
    }

    // Calcular el total de telas para el campo 'totalTelas' en la DB
    const totalTelasCalculado = (nuevoCatalogo.paginas || []).reduce((count, pagina) => count + (pagina.telas ? pagina.telas.length : 0), 0);

    const catalogoAAnadir = new Catalog({
        catalogo_id: nuevoId,
        nombre_catalogo: nuevoCatalogo.nombre_catalogo || 'Nuevo Catálogo',
        paginas: nuevoCatalogo.paginas || [],
        totalTelas: totalTelasCalculado
    });

    try {
        // Guardar en MongoDB. El error de duplicado (409) se maneja aquí.
        const savedCatalog = await catalogoAAnadir.save();
        res.status(201).json({ message: 'Catálogo creado exitosamente en la DB.', catalogo: savedCatalog });

    } catch (error) {
        // Manejo de error de duplicado o validación
        if (error.code === 11000) { // Código de error de duplicado de MongoDB
            return res.status(409).json({ error: `El catálogo con ID '${nuevoId}' ya existe.` });
        }
        console.error("Error al crear catálogo en DB:", error);
        res.status(500).json({ error: 'Error al crear el catálogo en la base de datos.', details: error.message });
    }
});


// 5. UPDATE (Actualizar Catálogo Existente) - ¡USA DB AHORA!
// Esta ruta ya estaba bien, la dejamos igual.
app.put('/api/catalogo/:catalogoId', async (req, res) => {
    const id = req.params.catalogoId.toUpperCase();
    const newData = req.body;
    
    // Recalcular totalTelas si se envían nuevas páginas
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


// 6. DELETE (Eliminar Catálogo) - ¡USA DB AHORA!
app.delete('/api/admin/catalogo/:id', async (req, res) => {
    const idToDelete = req.params.id.trim().toUpperCase(); // Usamos toUpperCase para la DB

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