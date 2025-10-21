const mongoose = require('mongoose');

// Esquema para las Telas dentro de una Página
const TelaSchema = new mongoose.Schema({
    nombre: { type: String, required: true }, // Ejemplo: "Leonora Teal"
    sku: { type: String, required: false },    // Ejemplo: "190624-94261"
    // Puedes añadir más campos de tela si los tienes
}, { _id: false }); // No necesitamos un ID automático para cada tela

// Esquema para las Páginas dentro de un Catálogo
const PaginaSchema = new mongoose.Schema({
    numero_pagina: { type: Number, required: true }, // 1, 2, 3...
    telas: [TelaSchema] // Array de Telas
}, { _id: false }); // No necesitamos un ID automático para cada página

// Esquema Principal para el Catálogo
const CatalogSchema = new mongoose.Schema({
    // Este será tu ID corto para las URLs (ej: 'catalogo1')
    catalogo_id: { type: String, required: true, unique: true, uppercase: true },
    
    // Nombre largo para la interfaz (ej: 'Catalogo de Telas Ligeras 2024')
    nombre_catalogo: { type: String, required: true }, 

    // Campo que almacena todas las páginas y sus telas
    paginas: [PaginaSchema],

    // TotalTelas se puede calcular, pero lo almacenamos para velocidad
    totalTelas: { type: Number, default: 0 }, 
    
    // Campo opcional para ordenar los catálogos en la lista
    orden: { type: Number, default: 999 }
});

// Exportar el Modelo de Catálogo
module.exports = mongoose.model('Catalog', CatalogSchema);