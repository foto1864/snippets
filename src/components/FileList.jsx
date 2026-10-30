import { useEffect, useState } from 'react';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { IMAGE_KINDS, detectKind, formatBytes } from '../lib/files';
import { imageThumbnail } from '../lib/image';
import { closePdf, openPdf, pageThumbnail } from '../lib/pdf';

const thumbCache = new WeakMap();

/** Generates (and caches) a thumbnail for an image or PDF file. */
function useThumbnail(file) {
  const [state, setState] = useState(() => thumbCache.get(file) || null);
  useEffect(() => {
    if (thumbCache.has(file)) {
      setState(thumbCache.get(file));
      return;
    }
    let alive = true;
    (async () => {
      const kind = detectKind(file);
      let result = { url: null, pages: null };
      try {
        if (kind === 'pdf') {
          const doc = await openPdf(file);
          result = { url: await pageThumbnail(doc, 1, 120), pages: doc.numPages };
          closePdf(doc);
        } else if (IMAGE_KINDS.includes(kind)) {
          result = { url: await imageThumbnail(file, 160), pages: null };
        }
      } catch {
        result = { url: null, pages: null, error: true };
      }
      thumbCache.set(file, result);
      if (alive) setState(result);
    })();
    return () => {
      alive = false;
    };
  }, [file]);
  return state;
}

export function FileThumb({ file }) {
  const thumb = useThumbnail(file);
  const kind = detectKind(file);
  return (
    <div className="thumb">
      {thumb?.url ? (
        <img src={thumb.url} alt="" draggable={false} />
      ) : (
        <span className={`thumb-badge kind-${kind}`}>{thumb ? kind?.toUpperCase() : '…'}</span>
      )}
    </div>
  );
}

function Card({ item, index, onRemove, sortable, renderExtra }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
    disabled: !sortable,
  });
  const thumb = useThumbnail(item.file);
  return (
    <li
      ref={setNodeRef}
      className={`file-card${isDragging ? ' is-dragging' : ''}${sortable ? ' is-sortable' : ''}`}
      style={{ transform: CSS.Translate.toString(transform), transition }}
    >
      <div className="file-card-handle" {...(sortable ? { ...attributes, ...listeners } : {})}>
        {sortable && <span className="file-index">{index + 1}</span>}
        <FileThumb file={item.file} />
      </div>
      <div className="file-card-body">
        <div className="file-name" title={item.file.name}>
          {item.file.name}
        </div>
        <div className="file-meta">
          {formatBytes(item.file.size)}
          {thumb?.pages ? ` · ${thumb.pages} page${thumb.pages === 1 ? '' : 's'}` : ''}
          {thumb?.error ? ' · could not preview' : ''}
        </div>
        {renderExtra?.(item, thumb)}
      </div>
      <button
        type="button"
        className="icon-btn file-remove"
        onClick={() => onRemove(item.id)}
        aria-label={`Remove ${item.file.name}`}
      >
        ×
      </button>
    </li>
  );
}

/**
 * Grid of selected files. When `sortable`, items can be reordered by drag
 * (mouse, touch or keyboard).
 */
export default function FileList({ items, setItems, sortable = false, renderExtra }) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const remove = (id) => setItems((list) => list.filter((i) => i.id !== id));

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={({ active, over }) => {
        if (!over || active.id === over.id) return;
        setItems((list) => {
          const from = list.findIndex((i) => i.id === active.id);
          const to = list.findIndex((i) => i.id === over.id);
          return arrayMove(list, from, to);
        });
      }}
    >
      <SortableContext items={items.map((i) => i.id)} strategy={rectSortingStrategy}>
        <ul className="file-grid">
          {items.map((item, index) => (
            <Card
              key={item.id}
              item={item}
              index={index}
              onRemove={remove}
              sortable={sortable}
              renderExtra={renderExtra}
            />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}

export { arrayMove };
