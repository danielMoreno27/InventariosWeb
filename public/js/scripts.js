// public/js/scripts.js (CÓDIGO CLIENTE)

document.addEventListener('DOMContentLoaded', () => {
    // Definir la ruta base para todas las llamadas a la API
    const API_BASE = '/api';

    // Función para obtener parámetros de la URL
    function getUrlParams() {
        const params = {};
        const queryString = window.location.search;
        const urlParams = new URLSearchParams(queryString);
        for (const [key, value] of urlParams.entries()) {
            params[key] = value;
        }
        return params;
    }

    // =======================================================
    // === LÓGICA DE CATÁLOGOS (catalogsListView.html) ===
    // =======================================================

    function displayCatalogError(message) {
        const container = document.getElementById('catalogos-list-container');
        if (container) {
            container.innerHTML = `<div class="alert alert-danger" role="alert">Error al cargar: ${message}</div>`;
        }
    }

    async function loadCatalogsList() {
        const container = document.getElementById('catalogos-list-container');
        if (!container) return;
        container.innerHTML = 'Cargando catálogos...';

        try {
            const response = await fetch(`${API_BASE}/catalogos`);
            
            // CORRECCIÓN CLAVE: Verificar la respuesta HTTP antes de leer JSON
            if (!response.ok) {
                // Si el servidor devuelve un error (404, 500, etc.), leemos el mensaje de error o usamos un mensaje genérico.
                const errorData = await response.json().catch(() => ({ error: `Error HTTP ${response.status}` }));
                throw new Error(errorData.error || `No se pudo conectar con el servidor (Estado: ${response.status}).`);
            }
            
            const catalogos = await response.json();
            
            if (!Array.isArray(catalogos)) {
                 throw new Error("Formato de datos de catálogos inválido.");
            }

            container.innerHTML = ''; 

            catalogos.forEach(catalogo => {
                // CORRECCIÓN: Usar operadores de seguridad para evitar 'undefined' antes de toUpperCase()
                const nombre = (catalogo.nombre || 'Nombre Desconocido').toUpperCase();
                const id = (catalogo.id || 'ID Desconocido').toUpperCase();
                const totalTelas = catalogo.totalTelas || 0;

                const html = `
                    <div class="col-md-4 mb-4">
                        <div class="card h-100">
                            <div class="card-body">
                                <h5 class="card-title"><a href="catalogsView.html?id=${id}&page=1">${nombre}</a></h5>
                                <p class="card-text">ID: ${id}</p>
                                <p class="card-text">Total de telas: ${totalTelas}</p>
                            </div>
                        </div>
                    </div>
                `;
                container.innerHTML += html;
            });

        } catch (error) {
            console.error("Error al cargar catálogos:", error);
            displayCatalogError(error.message);
        }
    }


    // =======================================================
    // === LÓGICA DE BÚSQUEDA SKU (skuView.html) ===
    // =======================================================

    function displaySkuError(message) {
        const container = document.getElementById('sku-details-container');
        const errorDiv = document.getElementById('error-message-sku');

        if (errorDiv) {
            errorDiv.textContent = `Error de conexión o datos: ${message}`;
            errorDiv.style.display = 'block';
        }
        if (container) container.innerHTML = '';
    }

    async function loadSkuDetails() {
        const params = getUrlParams();
        const sku = params.sku;
        
        const errorDiv = document.getElementById('error-message-sku');
        if (errorDiv) errorDiv.style.display = 'none';

        if (!sku) {
            displaySkuError("No se proporcionó un SKU para la búsqueda.");
            return;
        }

        document.getElementById('sku-search-title').textContent = `Buscando: ${sku.toUpperCase()}`;
        const container = document.getElementById('sku-details-container');
        if (container) container.innerHTML = 'Cargando detalles del SKU...';

        try {
            const response = await fetch(`${API_BASE}/sku/${sku}`);
            
            // CORRECCIÓN CLAVE: Esto evita el error "Unexpected token '<',..."
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: `Error HTTP ${response.status}` }));
                throw new Error(errorData.error || `El servidor no pudo procesar la solicitud (Estado: ${response.status}).`);
            }
            
            const data = await response.json();

            // Formatear la información
            const info = `
                <h4>Información del Artículo</h4>
                <p><strong>SKU:</strong> ${data.sku}</p>
                <p><strong>Clave:</strong> ${data.clave.toUpperCase()}</p>
                <p><strong>Tela/Color:</strong> ${data.telacolor.toUpperCase()}</p>
                <p><strong>Composición:</strong> ${data.composicion}</p>
            `;

            let movimientosTable = '<h4>Resultados de Inventario</h4><table class="table table-striped"><thead><tr><th>Orden</th><th>MTY (Metraje)</th><th>Traslado</th><th>Fecha</th></tr></thead><tbody>';
            
            data.movimientos.forEach(mov => {
                movimientosTable += `
                    <tr>
                        <td>${mov.orden.toUpperCase()}</td>
                        <td>${mov.mty}</td>
                        <td>${mov.traslado}</td>
                        <td>${mov.fecha}</td>
                    </tr>
                `;
            });

            movimientosTable += '</tbody></table>';

            container.innerHTML = info + movimientosTable;

        } catch (error) {
            console.error("Error al cargar detalles del SKU:", error);
            displaySkuError(error.message);
        }
    }

    // =======================================================
    // === ENRUTAMIENTO Y EJECUCIÓN ===
    // =======================================================
    
    // Obtenemos el nombre del archivo HTML actual para saber qué cargar
    const path = window.location.pathname;

    if (path.includes('catalogsListView.html')) {
        loadCatalogsList();
    } else if (path.includes('skuView.html')) {
        loadSkuDetails();
    }
    // Si tienes un archivo catalogsView.html, aquí es donde llamarías a la función de carga
});