import React, { useEffect, useState } from 'react';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';

export default function DragTest() {
  const [isClient, setIsClient] = useState(false);
  const [items, setItems] = useState([
    { id: '1', name: 'Item 1' },
    { id: '2', name: 'Item 2' },
  ]);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const onDragEnd = (result) => {
    if (!result.destination) return;
    const reordered = Array.from(items);
    const [moved] = reordered.splice(result.source.index, 1);
    reordered.splice(result.destination.index, 0, moved);
    setItems(reordered);
  };

  return (
    <div>
      <h3>Test DragDrop</h3>
      {isClient && (
        <DragDropContext onDragEnd={onDragEnd}>
          <Droppable droppableId="test-droppable" direction="horizontal">
            {(provided) => (
              <div
                style={{ display: 'flex', gap: '10px', padding: '20px' }}
                {...provided.droppableProps}
                ref={provided.innerRef}
              >
                {items.map((item, index) => (
                  <Draggable key={item.id} draggableId={item.id} index={index}>
                    {(provided) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        {...provided.dragHandleProps}
                        style={{
                          userSelect: 'none',
                          padding: 16,
                          border: '1px solid black',
                          borderRadius: 4,
                          background: 'white',
                          ...provided.draggableProps.style
                        }}
                      >
                        {item.name}
                      </div>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>
      )}
    </div>
  );
}
