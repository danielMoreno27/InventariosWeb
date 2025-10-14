// public/js/admin.js

const API_BASE = '/api';
const listContainer = document.getElementById('catalog-list');
const createForm = document.getElementById('create-form');

let currentCatalogData = null; // Para almacenar el catálogo que se está editando

// ==========================================================
// RENDERIZADO Y LECTURA (READ)
// ==========================================================

async function loadCatalogList() {
    if (!listContainer) return; 
    listContainer.innerHTML = 'Cargando catálogos...';
    try {
        const response = await fetch(`${API_BASE}/catalogos`);
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `Error al cargar los catálogos. Estado: ${response.status}`);
        }
        
        const catalogos = await response.json();
        
        listContainer.innerHTML = '';
        
        catalogos.forEach(catalogo => {
            const id = String(catalogo.catalogo_id || '').toUpperCase();
            const nombre = String(catalogo.nombre_catalogo || 'Nombre Desconocido');
            
            const div = document.createElement('div');
            div.className = 'admin-card';
            div.innerHTML = `
                <h3>${nombre}</h3>
                <p>ID: ${id}</p>
                <p>Total Telas: ${catalogo.totalTelas || 0}</p>
                <button onclick="handleDelete('${id}')" class="delete-button">Eliminar</button>
                <button onclick="handleEdit('${id}')" class="secondary-button">Editar</button>
                <hr>
            `;
            listContainer.appendChild(div);
        });

    } catch (error) {
        listContainer.innerHTML = `<p style="color: red;">Error al cargar: ${error.message}</p>`;
    }
}


// ==========================================================
// CREACIÓN (CREATE)
// ==========================================================

if (createForm) { 
    createForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('new-id').value;
        const name = document.getElementById('new-name').value;
        
        try {
            const response = await fetch(`${API_BASE}/admin/catalogo`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    catalogo_id: id, 
                    nombre_catalogo: name,
                    paginas: [] 
                })
            });
            
            const result = await response.json();
            
            if (!response.ok) {
                throw new Error(result.error || `Fallo al crear el catálogo: ${response.status}`);
            }
            
            alert(`Catálogo '${name}' creado exitosamente.`);
            createForm.reset();
            loadCatalogList(); 
            
        } catch (error) {
            alert(`Error: ${error.message}`);
        }
    });
}


// ==========================================================
// ELIMINACIÓN (DELETE)
// ==========================================================

async function handleDelete(id) {
    if (!confirm(`¿Estás seguro de que quieres eliminar el catálogo con ID: ${id}?`)) {
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/admin/catalogo/${id.toLowerCase()}`, {
            method: 'DELETE',
        });
        
        const result = await response.json();
        
        if (!response.ok) {
            throw new Error(result.error || `Fallo al eliminar el catálogo: ${response.status}`);
        }
        
        alert(`Catálogo '${id}' eliminado.`);
        loadCatalogList(); 
        
    } catch (error) {
        alert(`Error: ${error.message}`);
    }
}

// ==========================================================
// EDICIÓN (UPDATE - Lógica de Vista)
// ==========================================================

// 1. Manejador para el botón "Editar"
function handleEdit(id) {
    // Redirige a la nueva vista de edición
    window.location.href = `editView.html?id=${id}`;
}

// 2. Carga los datos del catálogo para edición
async function loadEditView(catalogoId) {
    const nameDisplay = document.getElementById('catalog-name-display');
    const idDisplay = document.getElementById('catalog-id-display');
    const loadingMsg = document.getElementById('loading-message');
    const errorMsg = document.getElementById('error-message');
    
    if (!nameDisplay || !idDisplay || !loadingMsg || !errorMsg) return;

    errorMsg.style.display = 'none';
    loadingMsg.style.display = 'block';

    try {
        const response = await fetch(`${API_BASE}/catalogo/${catalogoId}`);
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || `Error HTTP: ${response.status}`);
        }
        
        currentCatalogData = data; // Guarda los datos globales

        // 1. Mostrar metadatos
        nameDisplay.textContent = data.nombre_catalogo;
        idDisplay.textContent = data.catalogo_id.toUpperCase();
        document.getElementById('edit-name').value = data.nombre_catalogo;

        // 2. Renderizar páginas y formulario
        renderPages(data.paginas);
        
    } catch (error) {
        errorMsg.textContent = `Error al cargar el catálogo: ${error.message}`;
        errorMsg.style.display = 'block';
    } finally {
        loadingMsg.style.display = 'none';
    }
}

// 3. Renderiza las páginas con sus telas
function renderPages(paginas) {
    const container = document.getElementById('pages-container');
    container.innerHTML = '';
    
    if (!paginas || paginas.length === 0) {
        container.innerHTML = '<p>Este catálogo no tiene páginas aún.</p>';
        return;
    }

    paginas.sort((a, b) => a.numero_pagina - b.numero_pagina).forEach(pagina => {
        const pageDiv = document.createElement('div');
        pageDiv.className = 'page-editor-card';
        pageDiv.innerHTML = `
            <h4>Página #${pagina.numero_pagina}</h4>
            <textarea id="telas-page-${pagina.numero_pagina}" rows="5" placeholder="Ingrese telas separadas por coma, ej: Tela color, Otra tela roja">
                ${(pagina.telas || []).map(t => t.nombre || t).join(', ')}
            </textarea>
            <button onclick="handleUpdatePage(${pagina.numero_pagina})" class="button primary-button page-save-button">Guardar Cambios de Página</button>
        `;
        container.appendChild(pageDiv);
    });
}


// ==========================================================
// EDICIÓN (UPDATE - Lógica de Acciones)
// ==========================================================

// 4. Guardar SOLO el nombre del catálogo
document.getElementById('edit-metadata-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const newName = document.getElementById('edit-name').value;
    
    if (!currentCatalogData) return;

    // Actualiza el objeto local
    currentCatalogData.nombre_catalogo = newName;
    
    const success = await handleUpdate(currentCatalogData);
    if (success) {
        alert('Nombre del catálogo actualizado exitosamente.');
        document.getElementById('catalog-name-display').textContent = newName; // Actualiza la vista
    }
});


// 5. Guardar el contenido de una página específica
async function handleUpdatePage(pageNumber) {
    if (!currentCatalogData) return;
    
    const textarea = document.getElementById(`telas-page-${pageNumber}`);
    if (!textarea) return;

    const rawTelas = textarea.value.split(',').map(t => t.trim()).filter(t => t.length > 0);
    
    // Busca la página en los datos locales y actualiza
    const pageIndex = currentCatalogData.paginas.findIndex(p => p.numero_pagina === pageNumber);
    
    if (pageIndex !== -1) {
        // En el frontend guardamos solo el nombre (el backend maneja el mapeo a SKU al guardar)
        currentCatalogData.paginas[pageIndex].telas = rawTelas.map(nombre => ({ nombre: nombre, sku: 'PENDIENTE' })); 
    }

    const success = await handleUpdate(currentCatalogData);
    if (success) {
        alert(`Página ${pageNumber} actualizada exitosamente. El backend remapeará los SKUs.`);
        // Recarga la vista para limpiar el 'PENDIENTE' si es necesario, pero generalmente no hace falta.
    }
}

// 6. Añadir una nueva página
document.getElementById('add-page-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const newPageNumber = parseInt(document.getElementById('new-page-number').value, 10);
    
    if (!currentCatalogData) return;
    
    if (currentCatalogData.paginas.some(p => p.numero_pagina === newPageNumber)) {
        alert(`La página ${newPageNumber} ya existe.`);
        return;
    }
    
    const newPage = {
        numero_pagina: newPageNumber,
        telas: []
    };
    
    currentCatalogData.paginas.push(newPage);
    
    const success = await handleUpdate(currentCatalogData);
    if (success) {
        alert(`Página ${newPageNumber} añadida exitosamente.`);
        renderPages(currentCatalogData.paginas); // Vuelve a renderizar la lista
        document.getElementById('add-page-form').reset();
    }
});

// 7. Función principal de guardado (llama al PUT del servidor)
async function handleUpdate(dataToSend) {
    try {
        const response = await fetch(`${API_BASE}/admin/catalogo/${dataToSend.catalogo_id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(dataToSend)
        });
        
        const result = await response.json();
        
        if (!response.ok) {
            alert(`Error al guardar: ${result.error || response.statusText}`);
            return false;
        }
        return true;
    } catch (error) {
        alert(`Error de red al guardar: ${error.message}`);
        return false;
    }
}


// ==========================================================
// INICIALIZACIÓN
// ==========================================================

// Globalizar las funciones para que funcionen con onclick en el HTML
window.handleDelete = handleDelete; 
window.handleEdit = handleEdit;
window.handleUpdatePage = handleUpdatePage;
window.loadEditView = loadEditView;

// Inicia la carga de la lista de catálogos si estamos en la vista de administrador principal
document.addEventListener('DOMContentLoaded', () => {
    if (window.location.pathname.includes('adminView.html')) {
        loadCatalogList();
    }
});