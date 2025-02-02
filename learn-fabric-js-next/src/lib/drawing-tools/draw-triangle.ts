import * as fabric from "fabric";
import { DrawingTool, Point } from "./types";

let activeShape: fabric.Triangle | null = null;
let startPoint: Point | null = null;

export const drawTriangle: DrawingTool = {
  name: "triangle",
  cursor: "crosshair",

  handleMouseDown: (canvas: fabric.Canvas, pointer: Point) => {
    startPoint = pointer;
    activeShape = new fabric.Triangle({
      left: pointer.x,
      top: pointer.y,
      width: 0,
      height: 0,
      fill: "transparent",
      stroke: "black",
      strokeWidth: 2,
      selectable: true,
      hasControls: true,
    });
    canvas.add(activeShape);
  },

  handleMouseMove: (canvas: fabric.Canvas, pointer: Point) => {
    if (!activeShape || !startPoint) return;

    const width = Math.abs(startPoint.x - pointer.x);
    const height = Math.abs(startPoint.y - pointer.y);
    const left = Math.min(startPoint.x, pointer.x);
    const top = Math.min(startPoint.y, pointer.y);

    activeShape.set({
      width,
      height,
      left,
      top,
    });

    canvas.renderAll();
  },

  handleMouseUp: (canvas: fabric.Canvas) => {
    if (activeShape) {
      canvas.setActiveObject(activeShape);
      activeShape = null;
      startPoint = null;
    }
  },

  cleanUp: () => {
    activeShape = null;
    startPoint = null;
  },
};
