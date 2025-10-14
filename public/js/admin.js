// public/js/admin.js

const API_BASE = '/api';
const listContainer = document.getElementById('catalog-list');
const createForm = document.getElementById('create-form');

// ==========================================================
// RENDERIZADO Y LECTURA (READ)
// ==========================================================

async function loadCatalogList() {
    listContainer.innerHTML = 'Cargando catálogos...';
    try {
        // Usamos la ruta GET que ya tenías
        const response = await fetch(`${API_BASE}/catalogos`);
        if (!response.ok) {
            throw new Error(`Error al cargar los catálogos. Estado: ${response.status}`);
        }
        const catalogos = await response.json();
        
        listContainer.innerHTML = '';
        
        catalogos.forEach(catalogo => {
            const div = document.createElement('div');
            div.className = 'admin-card';
            div.innerHTML = `
                <h3>${catalogo.nombre_catalogo}</h3>
                <p>ID: ${catalogo.catalogo_id}</p>
                <p>Total Telas: ${catalogo.totalTelas || 0}</p>
                <button onclick="handleDelete('${catalogo.catalogo_id}')" class="delete-button">Eliminar</button>
                <button onclick="alert('Funcionalidad de Edición pendiente para ${catalogo.catalogo_id}')">Editar</button>
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
                paginas: [] // Inicialmente vacío
            })
        });
        
        const result = await response.json();
        
        if (!response.ok) {
            throw new Error(result.error || `Fallo al crear el catálogo: ${response.status}`);
        }
        
        alert(`Catálogo '${name}' creado exitosamente.`);
        createForm.reset();
        loadCatalogList(); // Refrescar la lista
        
    } catch (error) {
        alert(`Error: ${error.message}`);
    }
});


// ==========================================================
// ELIMINACIÓN (DELETE)
// ==========================================================

async function handleDelete(id) {
    if (!confirm(`¿Estás seguro de que quieres eliminar el catálogo con ID: ${id.toUpperCase()}?`)) {
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/admin/catalogo/${id}`, {
            method: 'DELETE',
        });
        
        const result = await response.json();
        
        if (!response.ok) {
            throw new Error(result.error || `Fallo al eliminar el catálogo: ${response.status}`);
        }
        
        alert(`Catálogo '${id.toUpperCase()}' eliminado.`);
        loadCatalogList(); // Refrescar la lista
        
    } catch (error) {
        alert(`Error: ${error.message}`);
    }
}

// Inicializar
loadCatalogList();