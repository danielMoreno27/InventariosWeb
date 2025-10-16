// public/js/builder.js (CÓDIGO CLIENTE CORREGIDO)

// --- Funciones de Utilidad ---

function getUrlParams() {
    const params = {};
    const urlParams = new URLSearchParams(window.location.search);
    for (const [key, value] of urlParams.entries()) {
        params[key] = value;
    }
    return params;
}

/**
 * Carga el contenido de navBar.html (se mantiene)
 */
async function loadNavbar() {
    try {
        const response = await fetch('navBar.html');
        if (response.ok) {
            const navHtml = await response.text();
            document.body.insertAdjacentHTML('afterbegin', navHtml);
            
            // Lógica para el formulario de búsqueda en el navbar
            const searchFormNav = document.getElementById('search-form-nav');
            if (searchFormNav) {
                searchFormNav.addEventListener('submit', function(e) {
                    e.preventDefault();
                    const skuInput = document.getElementById('sku-input-nav');
                    if (skuInput && skuInput.value.trim()) {
                         // Enviamos el valor como 'sku' (puede ser SKU o telacolor)
                         window.location.href = `skuView.html?sku=${skuInput.value.trim()}`;
                    }
                });
            }
        } else {
            console.error('Error al cargar la barra de navegación.');
        }
    } catch (e) {
        console.error('Error de red al cargar la barra de navegación:', e);
    }
}

// --- VISTAS ---

// VISTA: Lista de Catálogos (catalogsListView.html)
async function loadCatalogsList() {
    const container = document.getElementById('catalogs-list-container');
    const loadingMessage = document.getElementById('loading-message');
    const errorMessage = document.getElementById('error-message');

    if (!container || !loadingMessage || !errorMessage) return;

    loadingMessage.style.display = 'block';
    errorMessage.style.display = 'none';
    container.innerHTML = '';

    try {
        const response = await fetch('/api/catalogos');
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: `Error HTTP ${response.status}` }));
            throw new Error(errorData.error || `No se pudo conectar con el servidor (Estado: ${response.status}).`);
        }
        
        const catalogos = await response.json();

        catalogos.forEach(catalogo => {
            // CORRECCIÓN CLAVE: Usamos catalogo_id y nombre_catalogo
            const nombre = (catalogo.nombre_catalogo || 'Nombre Desconocido');
            const id = (catalogo.catalogo_id || 'ID Desconocido');
            const totalTelas = catalogo.totalTelas || 0;

            const card = document.createElement('a');
            card.className = 'catalog-card';
            card.href = `catalogsView.html?id=${id}&page=1`; 
            // Usamos toUpperCase aquí para la presentación en la tarjeta
            card.innerHTML = `<h3>${nombre.toUpperCase()}</h3><p>ID: ${id.toUpperCase()}</p><p>Total Telas: ${totalTelas}</p>`; 
            container.appendChild(card);
        });

    } catch (error) {
        errorMessage.textContent = `Error al cargar: ${error.message}`;
        errorMessage.style.display = 'block';
    } finally {
        loadingMessage.style.display = 'none';
    }
}


// VISTA: Catálogo Específico (catalogsView.html)
async function loadCatalogView(catalogoId, pageNumber) {
    const messageElement = document.getElementById('message');
    const slider = document.getElementById('slider');
    
    // CRÍTICO: El catalogoId debe ser válido, si no, lanzamos un error claro
    if (!catalogoId || catalogoId.toUpperCase() === 'UNDEFINED') {
        if (messageElement) messageElement.textContent = 'Error: ID de Catálogo no proporcionado o es inválido.';
        return;
    }

    if (messageElement) messageElement.textContent = `Cargando Catálogo: ${catalogoId.toUpperCase()}, Página ${pageNumber}...`;
    if (slider) slider.innerHTML = '';

    try {
        // La ruta de catálogos es /api/catalogo/:id
        const url = `/api/catalogo/${catalogoId}`;
        const response = await fetch(url);
        const data = await response.json();

        if (!response.ok) throw new Error(data.error || `Error HTTP: ${response.status}`);
        
        // Buscamos la página específica en la respuesta del servidor
        const pagina = data.paginas.find(p => p.numero_pagina === pageNumber);
        
        if (!pagina) {
             throw new Error(`Página ${pageNumber} no encontrada para este catálogo.`);
        }

        const totalPages = data.paginas.length;
        
        if (document.getElementById('catalog-name')) {
            // CORRECCIÓN CLAVE: Usamos nombre_catalogo (ya estaba bien, pero se revisa)
            document.getElementById('catalog-name').textContent = data.nombre_catalogo || 'Catálogo Desconocido';
        }
        if (document.getElementById('catalog-id')) {
            document.getElementById('catalog-id').textContent = `Página ${pageNumber} de ${totalPages}`;
        }
        if (messageElement) messageElement.textContent = ''; 

        renderPagination(catalogoId, pageNumber, totalPages);

        const telas = pagina.telas; // Esto ahora es un array de objetos: [{nombre: 'Leonora Teal', sku: '190624-94261'}, ...]
        
        if (telas && telas.length > 0) {
            slider.innerHTML = telas.map(telaObj => {
                
                // CRÍTICO: Usamos telaObj.sku para la búsqueda y telaObj.nombre para la presentación
                const nombreLimpio = telaObj.nombre || 'Desconocido';
                const skuParaBusqueda = telaObj.sku; // Ya está limpio y en mayúsculas desde el backend
                const nombreParaImagen = nombreLimpio
                    .toUpperCase()                  // 1. Convertir todo a MAYÚSCULAS
                    .replace(/\s+/g, '_')           // 2. Reemplaza uno o más espacios por un guion bajo
                    .replace(/[^A-Z0-9_]/g, '_')    // 3. ELIMINA CUALQUIER CARACTER QUE NO SEA LETRA MAYÚSCULA, NÚMERO O GUION BAJO
                
                // Usamos el SKU para la URL de la vista de detalle.
                // CRÍTICO: Si el SKU no se encontró, usamos el nombre original para la URL de búsqueda.
                const urlSku = (skuParaBusqueda && skuParaBusqueda !== 'SKU_NO_ENCONTRADO') ? skuParaBusqueda : nombreLimpio;

                return `
                    <a href="skuView.html?sku=${urlSku}" class="carousel-item-link">
                        <div class="carousel-item">
                            <h3 class="slide-title">${nombreLimpio.toUpperCase()}</h3>
                            <p>SKU: ${skuParaBusqueda}</p> 
                            <img src="/images/${nombreParaImagen}.JPG" alt="Imagen de ${nombreLimpio}" class="slide-image">
                        </div>
                    </a>
                `;
            }).join('');
            
            handleSlider(telas.length);

        } else {
            if (slider) slider.innerHTML = `<div class="carousel-item"><p>No se encontraron telas en la página ${pageNumber}.</p></div>`;
            const controls = document.getElementById('slider-controls');
            if (controls) controls.style.display = 'none';
        }

    } catch (error) {
        if (messageElement) messageElement.textContent = `Error: ${error.message}`;
    }
}

// Función de Renderizado de Paginación (Se mantiene)
function renderPagination(catalogoId, currentPage, totalPages) {
    const paginationContainer = document.getElementById('pagination');
    let html = '';
    const rangeSize = 5; 

    if (currentPage > 1) {
        html += `<a href="catalogsView.html?id=${catalogoId}&page=${currentPage - 1}" class="pagination-btn">Anterior</a>`;
    }

    let startPage = Math.max(1, currentPage - Math.floor(rangeSize / 2));
    let endPage = Math.min(totalPages, currentPage + Math.floor(rangeSize / 2));

    if (endPage - startPage + 1 < rangeSize) {
        if (startPage === 1) {
            endPage = Math.min(totalPages, startPage + rangeSize - 1);
        } else if (endPage === totalPages) {
            startPage = Math.max(1, totalPages - rangeSize + 1);
        }
    }
    
    if (startPage > 1) {
        html += `<a href="catalogsView.html?id=${catalogoId}&page=1" class="pagination-link">1</a>`;
        if (startPage > 2) {
            html += `<span class="pagination-dots">...</span>`;
        }
    }

    for (let i = startPage; i <= endPage; i++) {
        const activeClass = i === currentPage ? 'pagination-link active' : 'pagination-link';
        html += `<a href="catalogsView.html?id=${catalogoId}&page=${i}" class="${activeClass}">${i}</a>`;
    }
    
    if (endPage < totalPages) {
        if (endPage < totalPages - 1) {
            html += `<span class="pagination-dots">...</span>`;
        }
        if (endPage < totalPages) {
            html += `<a href="catalogsView.html?id=${catalogoId}&page=${totalPages}" class="pagination-link">${totalPages}</a>`;
        }
    }

    if (currentPage < totalPages) {
        html += `<a href="catalogsView.html?id=${catalogoId}&page=${currentPage + 1}" class="pagination-btn">Siguiente</a>`;
    }

    if (paginationContainer) paginationContainer.innerHTML = html;
}

// Función de Manejo del Slider (Carousel) (Se mantiene)
function handleSlider(numSlides) {
    const slider = document.getElementById('slider');
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');
    const controls = document.getElementById('slider-controls');
    
    if (numSlides <= 1 || !slider) {
        if (controls) controls.style.display = 'none';
        return;
    }

    let slideIndex = 0; 

    function updateSliderPosition() {
        slider.style.transform = `translateX(-${slideIndex * 100}%)`;
    }

    if (prevBtn) prevBtn.onclick = () => { if (slideIndex > 0) { slideIndex--; updateSliderPosition(); } };
    if (nextBtn) nextBtn.onclick = () => { if (slideIndex < numSlides - 1) { slideIndex++; updateSliderPosition(); } };
    
    if (controls) controls.style.display = 'flex';
}

// VISTA: Búsqueda de SKU (skuView.html)
async function loadSkuView(sku) {
    const container = document.getElementById('sku-results');
    const title = document.getElementById('sku-title');

    if (!container || !title) return;

    // CRÍTICO: Aseguramos que sku no sea undefined/null antes de llamar a toUpperCase()
    title.textContent = `Detalle de Artículo: ${(sku || '').toUpperCase()}`; 
    container.innerHTML = 'Cargando...';

    try {
        // La URL envía el valor tal cual (SKU o telacolor)
        const url = `/api/sku/${sku}`; 
        const response = await fetch(url);
        
        if (!response.ok) {
            // Capturamos el mensaje de error del backend
            const errorData = await response.json().catch(() => ({ error: `Error HTTP ${response.status}` }));
            throw new Error(errorData.error || `Error desconocido al buscar el SKU/Tela: ${sku}`);
        }
        
        const data = await response.json(); 
        
        const primerArticulo = data;
        const telaColor = primerArticulo.telacolor || 'Desconocido';
        const nombreImagen = telaColor.toUpperCase().replace(/ /g, '_'); 
        
        // --- Lógica de fecha (Se mantiene) ---
        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0); 

        function formatInventoryDate(dateString) {
             // Mantenemos la lógica de traducción de meses para compatibilidad
             const inventarioDate = new Date(dateString.replace(/ene/i, 'Jan').replace(/feb/i, 'Feb').replace(/mar/i, 'Mar').replace(/abr/i, 'Apr').replace(/may/i, 'May').replace(/jun/i, 'Jun').replace(/jul/i, 'Jul').replace(/ago/i, 'Aug').replace(/sep/i, 'Sep').replace(/oct/i, 'Oct').replace(/nov/i, 'Nov').replace(/dic/i, 'Dec'));
             inventarioDate.setHours(0, 0, 0, 0);

             if (isNaN(inventarioDate)) {
                 return `<td>${dateString}</td>`;
             }
             
             if (inventarioDate < hoy) {
                 return `<td class="status-almacen">En Almacen</td>`;
             } else {
                 return `<td>${dateString}</td>`;
             }
        }
        
        // --- Generación del HTML ---
        container.innerHTML = `
            <div class="sku-details-header">
                <a href="/images/${nombreImagen}.JPG" target="_blank">
                    <img src="/images/${nombreImagen}.JPG" alt="Imagen de ${telaColor}" class="sku-image">
                </a>
            </div>
            
            <div class="article-info">
                <h2>Información del Artículo</h2>
                <p><strong>SKU:</strong> ${primerArticulo.sku.toUpperCase()}</p>
                <p><strong>Clave:</strong> ${primerArticulo.clave.toUpperCase()}</p>
                <p><strong>Tela/Color:</strong> ${primerArticulo.telacolor.toUpperCase()}</p>
                <p><strong>Composición:</strong> ${primerArticulo.composicion.toUpperCase()}</p>
            </div>

            <hr>
            
            <h2>Resultados de Inventario</h2>
            <div class="inventory-table-wrapper">
                <table class="inventory-table">
                    <thead>
                        <tr>
                            <th>Orden</th>
                            <th>MTY (Metraje)</th>
                            <th>Traslado</th>
                            <th>Fecha de Llegada</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${data.movimientos.map(item => `
                            <tr>
                                <td>${item.orden}</td>
                                <td>${item.mty}</td>
                                <td>${item.traslado}</td>
                                ${formatInventoryDate(item.fecha)}
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;

    } catch (error) {
        // En caso de error, mostramos el mensaje de error del backend
        container.innerHTML = `<p class="error-message">Error: ${error.message}</p>`;
    }
}


// --- Lógica de Inicialización (Entry Point) ---

document.addEventListener('DOMContentLoaded', () => {
    loadNavbar(); 
    
    const path = window.location.pathname;
    
    if (path.includes('catalogsListView.html')) {
        loadCatalogsList();
    } else if (path.includes('catalogsView.html')) {
        const params = getUrlParams();
        if (params.id) {
            loadCatalogView(params.id, parseInt(params.page, 10) || 1); 
        }
    } else if (path.includes('skuView.html')) {
        const params = getUrlParams();
        if (params.sku) {
            // El parámetro 'sku' puede ser un SKU real o un telacolor
            loadSkuView(params.sku); 
        } else {
             const resultsDiv = document.getElementById('sku-results');
             if (resultsDiv) resultsDiv.innerHTML = '<p>Introduce un SKU o nombre de Tela para buscar.</p>';
        }
    }
    
    // Lógica para el formulario de búsqueda en la página principal (index.html, etc.)
    const searchForm = document.getElementById('search-form-main');
    if (searchForm) {
        searchForm.addEventListener('submit', function(e) {
            e.preventDefault();
            const skuInput = document.getElementById('sku-input-main');
            if (skuInput && skuInput.value.trim()) {
                 window.location.href = `skuView.html?sku=${skuInput.value.trim()}`;
            }
        });
    }
});