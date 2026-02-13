// PDF.js configuration
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

// Drawing variables
let drawingData = {
    scale: 1,
    rotation: 0,
    offsetX: 0,
    offsetY: 0,
    isDragging: false,
    startX: 0,
    startY: 0,
    pdfDoc: null,
    pageNum: 1
};

let currentPhotoSlot = null;
let photoCounter = 1;
let photoPages = 1;

// Initialize first photo page
initializePhotoPage(1);

// Worker table calculations
function updateWorkerTotals() {
    const rows = document.querySelectorAll('#workerTableBody tr');
    let builderTotal = 0;
    let servicesTotal = 0;

    rows.forEach(row => {
        const inputs = row.querySelectorAll('input[type="number"]');
        builderTotal += parseInt(inputs[0].value) || 0;
        servicesTotal += parseInt(inputs[1].value) || 0;
    });

    document.getElementById('builderTotal').textContent = builderTotal;
    document.getElementById('servicesTotal').textContent = servicesTotal;
}

// Add event listeners to worker inputs
document.getElementById('workerTableBody').addEventListener('input', updateWorkerTotals);

function deleteWorkerRow(btn) {
    const row = btn.closest('tr');
    if (row && row.parentNode) {
        row.parentNode.removeChild(row);
        updateWorkerTotals();
        checkPage1Overflow();
    }
}

function addWorkerRow() {
    const tbody = document.getElementById('workerTableBody');
    const row = document.createElement('tr');
    row.innerHTML = `
        <td><input type="text" placeholder="" /></td>
        <td><input type="number" value="" /></td>
        <td><input type="number" value="" /></td>
    `;
    tbody.appendChild(row);
    checkPage1Overflow();
}

// Worker table: right-click row to show Delete button
let workerRowDeleteTarget = null;
const workerRowDeleteBtn = document.getElementById('workerRowDeleteBtn');
document.getElementById('workerTableBody').addEventListener('contextmenu', function (e) {
    const row = e.target.closest('tr');
    if (!row) return;
    e.preventDefault();
    workerRowDeleteTarget = row;
    workerRowDeleteBtn.style.display = 'block';
    workerRowDeleteBtn.style.left = e.clientX + 4 + 'px';
    workerRowDeleteBtn.style.top = e.clientY + 4 + 'px';
});
if (workerRowDeleteBtn) {
    workerRowDeleteBtn.addEventListener('click', function () {
        if (workerRowDeleteTarget && workerRowDeleteTarget.parentNode) {
            workerRowDeleteTarget.parentNode.removeChild(workerRowDeleteTarget);
            updateWorkerTotals();
            checkPage1Overflow();
        }
        workerRowDeleteBtn.style.display = 'none';
        workerRowDeleteTarget = null;
    });
}
document.addEventListener('click', function () {
    workerRowDeleteBtn.style.display = 'none';
    workerRowDeleteTarget = null;
});

// A4 height in px (297mm at 96dpi) – when page1 exceeds this, move worker table to a new page
const PAGE_A4_HEIGHT_PX = Math.round(297 * 96 / 25.4);
const WORKER_TABLE_PAGE_ID = 'workerTablePage';

function checkPage1Overflow() {
    const page1 = document.getElementById('page1');
    const workerTable = document.querySelector('.worker-table');
    const container = document.getElementById('mainContainer');
    const photoPage1 = document.getElementById('photoPage1');
    if (!page1 || !workerTable || !container || !photoPage1) return;

    let extraPage = document.getElementById(WORKER_TABLE_PAGE_ID);
    const isWorkerTableInPage1 = page1.contains(workerTable);

    if (isWorkerTableInPage1 && page1.scrollHeight > PAGE_A4_HEIGHT_PX) {
        if (!extraPage) {
            extraPage = document.createElement('div');
            extraPage.className = 'page';
            extraPage.id = WORKER_TABLE_PAGE_ID;
            container.insertBefore(extraPage, photoPage1);
        }
        extraPage.appendChild(workerTable);
    } else if (extraPage && extraPage.contains(workerTable)) {
        page1.appendChild(workerTable);
        if (page1.scrollHeight > PAGE_A4_HEIGHT_PX) {
            extraPage.appendChild(workerTable);
        } else {
            extraPage.remove();
        }
    }
    updateContainerScale();
}

// Drawing upload handlers
const drawingUpload = document.getElementById('drawingUpload');
const drawingFileInput = document.getElementById('drawingFileInput');
const drawingContainer = document.getElementById('drawingContainer');
const drawingCanvas = document.getElementById('drawingCanvas');
const drawingContextMenu = document.getElementById('drawingContextMenu');

drawingUpload.addEventListener('click', () => {
    drawingFileInput.click();
});

drawingUpload.addEventListener('dragover', (e) => {
    e.preventDefault();
    drawingUpload.classList.add('dragover');
});

drawingUpload.addEventListener('dragleave', () => {
    drawingUpload.classList.remove('dragover');
});

drawingUpload.addEventListener('drop', (e) => {
    e.preventDefault();
    drawingUpload.classList.remove('dragover');
    const files = e.dataTransfer.files;
    if (files.length > 0 && files[0].type === 'application/pdf') {
        loadPDF(files[0]);
    }
});

drawingFileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
        loadPDF(e.target.files[0]);
    }
});

async function loadPDF(file) {
    const fileReader = new FileReader();
    fileReader.onload = async function() {
        const typedarray = new Uint8Array(this.result);
        
        try {
            const pdf = await pdfjsLib.getDocument(typedarray).promise;
            drawingData.pdfDoc = pdf;
            renderPDF();
            drawingUpload.style.display = 'none';
            drawingCanvas.style.display = 'block';
        } catch (error) {
            console.error('Error loading PDF:', error);
            alert('Error loading PDF file');
        }
    };
    fileReader.readAsArrayBuffer(file);
}

// Right-click context menu for location plan (when PDF is loaded)
drawingContainer.addEventListener('contextmenu', function (e) {
    if (drawingCanvas.style.display !== 'block' || !drawingData.pdfDoc) return;
    e.preventDefault();
    drawingContextMenu.style.display = 'block';
    drawingContextMenu.style.left = e.clientX + 'px';
    drawingContextMenu.style.top = e.clientY + 'px';
});

document.addEventListener('click', function () {
    drawingContextMenu.style.display = 'none';
});

document.getElementById('drawingMenuRotate').addEventListener('click', function (e) {
    e.stopPropagation();
    drawingData.rotation = (drawingData.rotation + 90) % 360;
    renderPDF();
    drawingContextMenu.style.display = 'none';
});

document.getElementById('drawingMenuReset').addEventListener('click', function (e) {
    e.stopPropagation();
    resetDrawing();
    drawingContextMenu.style.display = 'none';
});

document.getElementById('drawingMenuRemove').addEventListener('click', function (e) {
    e.stopPropagation();
    removeDrawing();
    drawingContextMenu.style.display = 'none';
});

// Wheel zoom: mouse position as center; wheel down = zoom in, wheel up = zoom out
drawingContainer.addEventListener('wheel', function (e) {
    if (drawingCanvas.style.display !== 'block' || !drawingData.pdfDoc) return;
    e.preventDefault();
    const rect = drawingContainer.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const oldScale = drawingData.scale;
    const factor = e.deltaY > 0 ? 1 / 1.06 : 1.06;
    const newScale = Math.max(0.2, Math.min(8, oldScale * factor));
    if (newScale === oldScale) return;
    drawingData.offsetX = mouseX - (mouseX - drawingData.offsetX) * newScale / oldScale;
    drawingData.offsetY = mouseY - (mouseY - drawingData.offsetY) * newScale / oldScale;
    drawingData.scale = newScale;
    renderPDF();
}, { passive: false });

// Render scale for 2K/4K: minimum 2x, or devicePixelRatio for high-DPI displays
const PDF_RENDER_DPI_SCALE = Math.max(2, window.devicePixelRatio || 1);

async function renderPDF() {
    if (!drawingData.pdfDoc) return;

    const page = await drawingData.pdfDoc.getPage(drawingData.pageNum);
    const effectiveScale = drawingData.scale * PDF_RENDER_DPI_SCALE;
    const viewport = page.getViewport({ scale: effectiveScale, rotation: drawingData.rotation });
    
    const canvas = drawingCanvas;
    const context = canvas.getContext('2d');
    
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    
    // Display size in CSS pixels so canvas fits container; bitmap stays high-res for 2K/4K
    canvas.style.width = (viewport.width / PDF_RENDER_DPI_SCALE) + 'px';
    canvas.style.height = (viewport.height / PDF_RENDER_DPI_SCALE) + 'px';
    canvas.style.left = drawingData.offsetX + 'px';
    canvas.style.top = drawingData.offsetY + 'px';

    const renderContext = {
        canvasContext: context,
        viewport: viewport
    };

    await page.render(renderContext).promise;
}

function zoomIn() {
    drawingData.scale *= 1.2;
    renderPDF();
}

function zoomOut() {
    drawingData.scale /= 1.2;
    renderPDF();
}

function rotateDrawing(degrees) {
    drawingData.rotation = (drawingData.rotation + degrees) % 360;
    renderPDF();
}

function resetDrawing() {
    drawingData.scale = 1;
    drawingData.rotation = 0;
    drawingData.offsetX = 0;
    drawingData.offsetY = 0;
    renderPDF();
}

function removeDrawing() {
    drawingCanvas.style.display = 'none';
    drawingUpload.style.display = 'flex';
    drawingData.pdfDoc = null;
}

// Canvas dragging
drawingCanvas.addEventListener('mousedown', (e) => {
    drawingData.isDragging = true;
    drawingData.startX = e.clientX - drawingData.offsetX;
    drawingData.startY = e.clientY - drawingData.offsetY;
});

document.addEventListener('mousemove', (e) => {
    if (drawingData.isDragging) {
        drawingData.offsetX = e.clientX - drawingData.startX;
        drawingData.offsetY = e.clientY - drawingData.startY;
        drawingCanvas.style.left = drawingData.offsetX + 'px';
        drawingCanvas.style.top = drawingData.offsetY + 'px';
    }
});

document.addEventListener('mouseup', () => {
    drawingData.isDragging = false;
});

// Photo handling
function initializePhotoPage(pageNum) {
    const grid = document.getElementById(`photoGrid${pageNum}`);
    grid.innerHTML = '';

    for (let i = 0; i < 6; i++) {
        const photoItem = document.createElement('div');
        photoItem.className = 'photo-item';
        
        const photoUpload = document.createElement('div');
        photoUpload.className = 'photo-upload';
        photoUpload.dataset.photoId = photoCounter;
        
        const placeholder = document.createElement('div');
        placeholder.className = 'placeholder-text';
        placeholder.innerHTML = '<p>📷 Drag photo here or click</p>';
        photoUpload.appendChild(placeholder);

        const removeBtn = document.createElement('button');
        removeBtn.className = 'remove-photo';
        removeBtn.innerHTML = '×';
        removeBtn.onclick = (e) => {
            e.stopPropagation();
            removePhoto(photoUpload);
        };
        photoUpload.appendChild(removeBtn);

        const photoLabel = document.createElement('div');
        photoLabel.className = 'photo-label';
        photoLabel.textContent = `Photo (${photoCounter})`;

        photoItem.appendChild(photoUpload);
        photoItem.appendChild(photoLabel);
        grid.appendChild(photoItem);

        setupPhotoUpload(photoUpload);
        photoCounter++;
    }
}

function setupPhotoUpload(element) {
    element.addEventListener('click', () => {
        currentPhotoSlot = element;
        document.getElementById('photoFileInput').click();
    });

    element.addEventListener('dragover', (e) => {
        e.preventDefault();
        element.classList.add('dragover');
    });

    element.addEventListener('dragleave', () => {
        element.classList.remove('dragover');
    });

    element.addEventListener('drop', (e) => {
        e.preventDefault();
        element.classList.remove('dragover');
        const photoId = e.dataTransfer.getData('application/x-photo-id');
        if (photoId) {
            const item = photoStore.find((p) => p.id === photoId);
            if (item) {
                displayPhotoFromDataUrl(element, item.dataUrl);
                return;
            }
        }
        const files = e.dataTransfer.files;
        if (files.length > 0 && files[0].type.startsWith('image/')) {
            displayPhoto(element, files[0]);
        }
    });
}

document.getElementById('photoFileInput').addEventListener('change', (e) => {
    if (e.target.files.length > 0 && currentPhotoSlot) {
        displayPhoto(currentPhotoSlot, e.target.files[0]);
    }
    e.target.value = ''; // Reset input
});

const MAX_PHOTO_SIZE = 528;
const PHOTO_QUALITY = 0.85;

// Left panel photo library: store { id, dataUrl } for drag-to-slot
let photoStore = [];
let nextPhotoStoreId = 1;

// Quick Dispatch: double-click to send photo to next slot in order
let quickDispatchEnabled = false;
let dispatchOrder = []; // [{ photoId, slotIndex }], slotIndex 1-based

const PANEL_THUMB_MAX = 400;

function resizeImageToDataUrl(file, maxSize) {
    const limit = maxSize || MAX_PHOTO_SIZE;
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                let w = img.width, h = img.height;
                if (w > limit || h > limit) {
                    if (w > h) {
                        h = Math.round((h * limit) / w);
                        w = limit;
                    } else {
                        w = Math.round((w * limit) / h);
                        h = limit;
                    }
                }
                const canvas = document.createElement('canvas');
                canvas.width = w;
                canvas.height = h;
                canvas.getContext('2d').drawImage(img, 0, 0, w, h);
                resolve(canvas.toDataURL('image/jpeg', PHOTO_QUALITY));
            };
            img.onerror = () => reject(new Error('Image load failed'));
            img.src = e.target.result;
        };
        reader.onerror = () => reject(new Error('File read failed'));
        reader.readAsDataURL(file);
    });
}

function addPhotosToStore(files) {
    if (!files || !files.length) return;
    [].forEach.call(files, (file) => {
        if (!file.type.startsWith('image/')) return;
        Promise.all([
            resizeImageToDataUrl(file, PANEL_THUMB_MAX),
            resizeImageToDataUrl(file, MAX_PHOTO_SIZE)
        ]).then(([thumbnailDataUrl, dataUrl]) => {
            const id = 'p' + (nextPhotoStoreId++);
            photoStore.push({ id, dataUrl, thumbnailDataUrl });
            renderPhotoPanelThumbnails();
        }).catch(() => {});
    });
}

function renderPhotoPanelThumbnails() {
    const list = document.getElementById('photoPanelList');
    if (!list) return;
    list.innerHTML = '';
    photoStore.forEach((item) => {
        const div = document.createElement('div');
        div.className = 'photo-panel-thumb';
        div.draggable = true;
        div.dataset.photoId = item.id;
        const img = document.createElement('img');
        img.src = item.thumbnailDataUrl || item.dataUrl;
        img.alt = 'Photo';
        div.appendChild(img);

        const entry = dispatchOrder.find(function (d) { return d.photoId === item.id; });
        if (entry) {
            div.classList.add('dispatched');
            const badge = document.createElement('span');
            badge.className = 'dispatch-slot-badge';
            badge.textContent = String(entry.slotIndex);
            div.appendChild(badge);
        }

        div.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('application/x-photo-id', item.id);
            e.dataTransfer.effectAllowed = 'copy';
        });

        if (quickDispatchEnabled) {
            div.addEventListener('dblclick', function (e) {
                e.preventDefault();
                handleQuickDispatchDoubleClick(item.id);
            });
        }
        list.appendChild(div);
    });
}

function handleQuickDispatchDoubleClick(photoId) {
    const item = photoStore.find(function (p) { return p.id === photoId; });
    if (!item) return;

    const lastEntry = dispatchOrder[dispatchOrder.length - 1];
    const isLastDispatched = lastEntry && lastEntry.photoId === photoId;

    if (isLastDispatched) {
        const slotEl = getPhotoSlotElement(lastEntry.slotIndex);
        if (slotEl) removePhoto(slotEl);
        dispatchOrder.pop();
        renderPhotoPanelThumbnails();
        return;
    }

    if (dispatchOrder.some(function (d) { return d.photoId === photoId; })) return;

    const nextSlot = dispatchOrder.length + 1;
    ensurePhotoPagesForSlot(nextSlot);
    const slotEl = getPhotoSlotElement(nextSlot);
    if (!slotEl) return;
    displayPhotoFromDataUrl(slotEl, item.dataUrl);
    dispatchOrder.push({ photoId: photoId, slotIndex: nextSlot });
    renderPhotoPanelThumbnails();
}

(function setupPhotoPanel() {
    const zone = document.getElementById('photoPanelUploadZone');
    const input = document.getElementById('photoPanelFileInput');
    if (!zone || !input) return;
    zone.addEventListener('click', () => input.click());
    zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('dragover'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));
    zone.addEventListener('drop', (e) => {
        e.preventDefault();
        zone.classList.remove('dragover');
        addPhotosToStore(e.dataTransfer.files);
    });
    input.addEventListener('change', (e) => {
        addPhotosToStore(e.target.files);
        e.target.value = '';
    });

    const quickDispatchBtn = document.getElementById('quickDispatchBtn');
    const quickDispatchHint = document.getElementById('quickDispatchHint');
    if (quickDispatchBtn && quickDispatchHint) {
        quickDispatchBtn.addEventListener('click', function () {
            quickDispatchEnabled = !quickDispatchEnabled;
            quickDispatchBtn.classList.toggle('active', quickDispatchEnabled);
            quickDispatchBtn.textContent = quickDispatchEnabled ? 'Quick Dispatch (ON)' : 'Quick Dispatch';
            quickDispatchHint.style.display = quickDispatchEnabled ? 'block' : 'none';
            renderPhotoPanelThumbnails();
        });
    }
})();

function displayPhotoFromDataUrl(element, dataUrl) {
    element.innerHTML = '';
    const img = document.createElement('img');
    img.src = dataUrl;
    element.appendChild(img);
    const removeBtn = document.createElement('button');
    removeBtn.className = 'remove-photo';
    removeBtn.innerHTML = '×';
    removeBtn.onclick = (e) => { e.stopPropagation(); removePhoto(element); };
    element.appendChild(removeBtn);
}

function displayPhoto(element, file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
            let w = img.width;
            let h = img.height;
            if (w > MAX_PHOTO_SIZE || h > MAX_PHOTO_SIZE) {
                if (w > h) {
                    h = Math.round((h * MAX_PHOTO_SIZE) / w);
                    w = MAX_PHOTO_SIZE;
                } else {
                    w = Math.round((w * MAX_PHOTO_SIZE) / h);
                    h = MAX_PHOTO_SIZE;
                }
            }
            const canvas = document.createElement('canvas');
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, w, h);
            const dataUrl = canvas.toDataURL('image/jpeg', PHOTO_QUALITY);

            element.innerHTML = '';
            const outImg = document.createElement('img');
            outImg.src = dataUrl;
            element.appendChild(outImg);

            const removeBtn = document.createElement('button');
            removeBtn.className = 'remove-photo';
            removeBtn.innerHTML = '×';
            removeBtn.onclick = (event) => {
                event.stopPropagation();
                removePhoto(element);
            };
            element.appendChild(removeBtn);
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

function removePhoto(element) {
    const placeholder = document.createElement('div');
    placeholder.className = 'placeholder-text';
    placeholder.innerHTML = '<p>📷 Drag photo here or click</p>';
    element.innerHTML = '';
    element.appendChild(placeholder);

    const removeBtn = document.createElement('button');
    removeBtn.className = 'remove-photo';
    removeBtn.innerHTML = '×';
    removeBtn.onclick = (e) => {
        e.stopPropagation();
        removePhoto(element);
    };
    element.appendChild(removeBtn);
}

function addPhotoPage() {
    photoPages++;
    const newPage = document.createElement('div');
    newPage.className = 'page';
    newPage.id = `photoPage${photoPages}`;
    
    const header = document.createElement('h2');
    header.className = 'photo-page-header';
    header.textContent = 'Progress Photos';
    newPage.appendChild(header);
    
    const photoGrid = document.createElement('div');
    photoGrid.className = 'photo-grid';
    photoGrid.id = `photoGrid${photoPages}`;
    
    newPage.appendChild(photoGrid);
    document.getElementById('mainContainer').appendChild(newPage);
    
    initializePhotoPage(photoPages);
    updateDeletePhotoPageButton();
    updateContainerScale();
}

// Get the .photo-upload element for 1-based global slot (1-6 = page1, 7-12 = page2, ...)
function getPhotoSlotElement(slotIndex) {
    const pageNum = Math.ceil(slotIndex / 6);
    const slotInPage = (slotIndex - 1) % 6;
    const grid = document.getElementById(`photoGrid${pageNum}`);
    if (!grid) return null;
    const slots = grid.querySelectorAll('.photo-upload');
    return slots[slotInPage] || null;
}

// Ensure at least enough photo pages for the given 1-based slot (e.g. 7 -> 2 pages)
function ensurePhotoPagesForSlot(slotIndex) {
    const requiredPages = Math.ceil(slotIndex / 6);
    while (photoPages < requiredPages) {
        addPhotoPage();
    }
}

function deleteLastPhotoPage() {
    if (photoPages <= 2) return;
    const lastPage = document.getElementById(`photoPage${photoPages}`);
    if (lastPage) lastPage.remove();
    photoPages--;
    photoCounter -= 6;
    dispatchOrder = dispatchOrder.filter(function (d) { return d.slotIndex <= photoPages * 6; });
    renderPhotoPanelThumbnails();
    updateDeletePhotoPageButton();
    updateContainerScale();
}

function updateDeletePhotoPageButton() {
    const btn = document.getElementById('deletePhotoPageBtn');
    if (btn) btn.disabled = photoPages <= 2;
}

function printReport() {
    window.print();
}

// Inspection date: show weekday when date is selected
const weekdays = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
document.getElementById('inspectionDate').addEventListener('change', function() {
    const val = this.value;
    const w = document.getElementById('inspectionDateWeekday');
    if (val) {
        const parts = val.split('-');
        const d = new Date(parseInt(parts[0],10), parseInt(parts[1],10) - 1, parseInt(parts[2],10));
        w.textContent = '(' + weekdays[d.getDay()] + ')';
    } else {
        w.textContent = '';
    }
});

// Initial totals calculation
updateWorkerTotals();
updateDeletePhotoPageButton();

// After layout, move worker table to new page if page1 would overflow
setTimeout(checkPage1Overflow, 100);

// Uniform scale: first page and photo pages fit in app-main (same scale for width and height)
const MM_TO_PX = 96 / 25.4;
const CONTAINER_REF_WIDTH_MM = 210;

function updateContainerScale() {
    const appMain = document.getElementById('appMain');
    const wrapper = document.getElementById('containerScaleWrapper');
    const container = document.getElementById('mainContainer');
    if (!appMain || !wrapper || !container) return;

    const appW = appMain.clientWidth;
    const appH = appMain.clientHeight;
    if (appW <= 0 || appH <= 0) return;

    const refWidthPx = CONTAINER_REF_WIDTH_MM * MM_TO_PX;
    const naturalH = container.scrollHeight;
    const naturalW = refWidthPx;

    /* Scale to fit app-main width; height scales with same ratio (vertical scroll if needed) */
    const scale = Math.min(appW / naturalW, 1);
    const scaledW = naturalW * scale;
    const scaledH = naturalH * scale;

    wrapper.style.width = scaledW + 'px';
    wrapper.style.height = scaledH + 'px';
    wrapper.style.minHeight = scaledH + 'px';

    container.style.position = 'absolute';
    container.style.left = '0';
    container.style.top = '0';
    container.style.width = naturalW + 'px';
    container.style.height = naturalH + 'px';
    container.style.transform = 'scale(' + scale + ')';
    container.style.transformOrigin = 'top left';
}

window.addEventListener('resize', updateContainerScale);
setTimeout(updateContainerScale, 150);
