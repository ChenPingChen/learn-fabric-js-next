import * as fabric from 'fabric';
import { DrawingTool } from './types';
import { CustomPolygon } from './polygon/CustomPolygon';

let isDrawingDoor = false;
let startPoint: any = null;

export const drawDoor: DrawingTool = {
  name: "door",
  cursor: "crosshair",

  init: (canvas: fabric.Canvas) => {
    canvas.selection = true;
    canvas.defaultCursor = "crosshair";
  },

  handleMouseDown: (canvas: fabric.Canvas, pointer: { x: number; y: number }) => {
    const activeObject = canvas.getActiveObject();
    if (!(activeObject && activeObject instanceof CustomPolygon)) {
      return;
    }

    const doorPoint = activeObject.findClosestPointOnEdge(new fabric.Point(pointer.x, pointer.y));
    if (!doorPoint) return;

    if (!isDrawingDoor) {
      isDrawingDoor = true;
      startPoint = doorPoint;
    } else {
      activeObject.addDoor(startPoint, doorPoint);
      isDrawingDoor = false;
      startPoint = null;
      canvas.requestRenderAll();
    }
  },

  cleanUp: (canvas: fabric.Canvas) => {
    isDrawingDoor = false;
    startPoint = null;
    if (canvas) {
      canvas.requestRenderAll();
    }
  }
};