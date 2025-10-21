// migrate.js

require('dotenv').config();

const mongoose = require('mongoose');
const Catalog = require('./models/Catalog'); // Asegúrate que la ruta sea correcta
const catalogosJSON = require('./data/builder'); // Requerir tu archivo JSON/JS de catálogos
// Si tu archivo se llama builder.js, el 'require' lo lee directamente.

// URL de conexión a tu DB (usa tu URL real de Atlas o Render)
const DB_URI = process.env.MONGODB_URI || 'mongodb+srv://danicruz297_db_user:<db_password>@cluster0.blxed7z.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

/**
 * Función principal para conectar e insertar datos.
 */
async function migrateData() {
    console.log("[INICIO] Conectando a MongoDB...");
    
    try {
        await mongoose.connect(DB_URI);
        console.log("[DB] Conexión exitosa. Iniciando migración...");

        // 1. Limpiar la colección para evitar duplicados (CRÍTICO)
        await Catalog.deleteMany({});
        console.log("[DB] Colección 'catalogs' limpiada.");

        // 2. Preparar los datos
        // El archivo JSON contiene un array de objetos. Los preparamos.
        const catálogosAMigrar = catalogosJSON.map(catalogo => {
    
        // 1. Clonar y transformar las páginas
            const paginasTransformadas = catalogo.paginas.map(pagina => {
        
                let telasTransformadas = [];

                // CRÍTICO: Transformar el array de strings de telas a array de objetos
                if (pagina.telas && Array.isArray(pagina.telas)) {
                    telasTransformadas = pagina.telas.map(nombreTela => {
                
                        // Mongoose espera: { nombre: String, sku: String/undefined }
                        return { 
                            nombre: nombreTela,
                            // Dejamos el sku vacío por ahora para que la validación pase.
                            sku: '' 
                        }; 
                    });
                }
        
            // Devolvemos la página con las telas transformadas
            return {
                ...pagina,
                telas: telasTransformadas
            };
            }); // FIN del mapeo de páginas

        // 2. Calcular el total con la nueva estructura
        const totalTelasGlobal = paginasTransformadas.reduce((acc, pagina) => {
            return acc + (pagina.telas ? pagina.telas.length : 0);
            }, 0);

            // 3. Devolver el objeto de catálogo final
            return {
                catalogo_id: catalogo.catalogo_id || catalogo.ID_original.toUpperCase(),
                nombre_catalogo: catalogo.nombre_catalogo || catalogo.Nombre_original,
                paginas: paginasTransformadas, 
                totalTelas: totalTelasGlobal,
                orden: catalogo.orden || 999
                };
        });

        // 3. Insertar los datos en la base de datos
        const result = await Catalog.insertMany(catálogosAMigrar);
        
        console.log(`[ÉXITO] Migración completada. Se insertaron ${result.length} catálogos.`);

    } catch (error) {
        console.error("[ERROR] Fallo en la migración:", error.message);
        console.log("Asegúrate de que el Schema en models/Catalog.js coincide con los datos.");
    } finally {
        // Desconectar al finalizar
        await mongoose.disconnect();
        console.log("[FIN] Desconectado de MongoDB.");
    }
}

migrateData();