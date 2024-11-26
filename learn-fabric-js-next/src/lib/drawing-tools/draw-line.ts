import * as fabric from "fabric";
import { DrawingTool, Point } from "./types";

let startPoint: Point | null = null;
let isDrawing = false;
let previewLine: fabric.Line | null = null;
let startCircle: fabric.Circle | null = null;
let endCircle: fabric.Circle | null = null;

class ConnectionLine extends fabric.Line {
  source: fabric.Circle;
  target: fabric.Circle;
  private hitboxPadding = 5;
  private lastLeft: number = 0;
  private lastTop: number = 0;
  private isRemoving = false;

  constructor(
    source: fabric.Circle,
    target: fabric.Circle,
    options: Partial<fabric.Object> = {}
  ) {
    const points: [number, number, number, number] = [0, 0, 0, 0];
    super(points, {
      ...options,
      hasBorders: false,
      hasControls: false,
      perPixelTargetFind: true,
    });

    this.source = source;
    this.target = target;

    // Initially hide the circles
    this.source.set("fill", "transparent");
    this.target.set("fill", "transparent");

    // Update line position when circles move
    source.on("moving", () => {
      this.updatePosition();
      this.canvas?.requestRenderAll();
    });
    target.on("moving", () => {
      this.updatePosition();
      this.canvas?.requestRenderAll();
      this.showCircles();
    });

    // Show circles in any selected state
    this.on("selected", this.showCircles.bind(this));
    this.on("moving", this.showCircles.bind(this));
    this.on("scaling", this.showCircles.bind(this));
    this.on("rotating", this.showCircles.bind(this));
    this.on("mousedown", this.showCircles.bind(this));

    // Hide circles when deselected
    this.on("deselected", () => {
      this.source.set("fill", "transparent");
      this.target.set("fill", "transparent");
      this.canvas?.requestRenderAll();
    });

    // Handle line movement
    this.on("moving", () => {
      const dx = this.left! - this.lastLeft;
      const dy = this.top! - this.lastTop;

      // Move circles with the line
      this.source.set({
        left: this.source.left! + dx,
        top: this.source.top! + dy,
      });
      this.target.set({
        left: this.target.left! + dx,
        top: this.target.top! + dy,
      });

      this.source.setCoords();
      this.target.setCoords();
      this.updatePosition();

      // Store current position for next move
      this.lastLeft = this.left!;
      this.lastTop = this.top!;

      this.canvas?.requestRenderAll();
    });

    this.on("mousedown", () => {
      // Store initial position when starting to move
      this.lastLeft = this.left!;
      this.lastTop = this.top!;
    });

    // 刪除事件監聽
    this.on('removed', () => {
      // 檢查是否為使用者主動刪除（例如按下 Delete 鍵）
      if (this.isRemoving || !this.canvas) return;
      
      // 檢查是否仍在畫布中
      const isStillInCanvas = this.canvas.contains(this);
      if (isStillInCanvas) return;

      this.isRemoving = true;

      // 確保 source 和 target 還存在且有 canvas
      if (this.source?.canvas) {
        this.source.canvas.remove(this.source);
      }
      if (this.target?.canvas) {
        this.target.canvas.remove(this.target);
      }

      this.isRemoving = false;
    });

    // 端點的刪除事件監聽
    source.on('removed', () => {
      if (this.isRemoving || !this.canvas) return;
      
      const isStillInCanvas = this.canvas.contains(source);
      if (isStillInCanvas) return;

      this.isRemoving = true;
      
      if (this.canvas) {
        this.canvas.remove(this);
        if (this.target?.canvas) {
          this.target.canvas.remove(this.target);
        }
      }

      this.isRemoving = false;
    });

    // target 的事件處理
    target.on('removed', () => {
      if (this.isRemoving || !this.canvas) return;
      
      const isStillInCanvas = this.canvas.contains(target);
      if (isStillInCanvas) return;

      this.isRemoving = true;
      
      if (this.canvas) {
        this.canvas.remove(this);
        if (this.source?.canvas) {
          this.source.canvas.remove(this.source);
        }
      }

      this.isRemoving = false;
    });

    this.updatePosition();
  }

  showCircles() {
    this.source.set("fill", "red");
    this.target.set("fill", "red");
    this.canvas?.requestRenderAll();
  }

  updatePosition() {
    if (!this.source || !this.target) return;

    const sourceCenter = {
      x: this.source.left! + this.source.radius!,
      y: this.source.top! + this.source.radius!,
    };

    const targetCenter = {
      x: this.target.left! + this.target.radius!,
      y: this.target.top! + this.target.radius!,
    };

    // Update line coordinates
    this.set({
      x1: sourceCenter.x,
      y1: sourceCenter.y,
      x2: targetCenter.x,
      y2: targetCenter.y,
      left: Math.min(sourceCenter.x, targetCenter.x),
      top: Math.min(sourceCenter.y, targetCenter.y),
    });

    // Update last position
    this.lastLeft = this.left!;
    this.lastTop = this.top!;

    this.setCoords();
  }

  // Override containsPoint to implement precise hit detection
  containsPoint(point: fabric.Point): boolean {
    const lineStart = new fabric.Point(this.x1!, this.y1!);
    const lineEnd = new fabric.Point(this.x2!, this.y2!);

    // Calculate distance from point to line
    const distance = this.distanceFromPointToLine(point, lineStart, lineEnd);

    return distance <= this.hitboxPadding;
  }

  // Helper method to calculate distance from point to line
  private distanceFromPointToLine(
    point: fabric.Point,
    lineStart: fabric.Point,
    lineEnd: fabric.Point
  ): number {
    const lineLength = lineStart.distanceFrom(lineEnd);
    if (lineLength === 0) return point.distanceFrom(lineStart);

    const t =
      ((point.x - lineStart.x) * (lineEnd.x - lineStart.x) +
        (point.y - lineStart.y) * (lineEnd.y - lineStart.y)) /
      (lineLength * lineLength);

    if (t < 0) return point.distanceFrom(lineStart);
    if (t > 1) return point.distanceFrom(lineEnd);

    return point.distanceFrom(
      new fabric.Point(
        lineStart.x + t * (lineEnd.x - lineStart.x),
        lineStart.y + t * (lineEnd.y - lineStart.y)
      )
    );
  }
}

export const drawLine: DrawingTool = {
  name: "line",
  cursor: "crosshair",

  handleMouseDown: (canvas: fabric.Canvas, pointer: Point) => {
    startPoint = pointer;
    isDrawing = true;

    // 建立預覽虛線
    previewLine = new fabric.Line([pointer.x, pointer.y, pointer.x, pointer.y], {
      strokeDashArray: [5, 5],
      stroke: '#000',
      strokeWidth: 2,
      selectable: false
    });
    
    canvas.add(previewLine);
    canvas.requestRenderAll();
  },

  handleMouseMove: (canvas: fabric.Canvas, pointer: Point) => {
    if (!isDrawing || !startPoint || !previewLine) return;

    // 更新預覽線的終點
    previewLine.set({
      x2: pointer.x,
      y2: pointer.y
    });
    
    canvas.requestRenderAll();
  },

  handleMouseUp: (canvas: fabric.Canvas, pointer: Point) => {
    if (!isDrawing || !startPoint) {
      return;
    }

    // 移除預覽線
    if (previewLine) {
      canvas.remove(previewLine);
    }

    // 建立起點和終點控制點
    const permStartCircle = new fabric.Circle({
      left: startPoint.x - 10,
      top: startPoint.y - 10,
      radius: 10,
      fill: "transparent", // 初始為透明
      selectable: true,
      hasControls: false,
      hasBorders: false,
    });

    const permEndCircle = new fabric.Circle({
      left: pointer.x - 10,
      top: pointer.y - 10,
      radius: 10,
      fill: "transparent", // 初始為透明
      selectable: true,
      hasControls: false,
      hasBorders: false,
    });

    // 建立可編輯的連接線
    const connectionLine = new ConnectionLine(permStartCircle, permEndCircle, {
      stroke: '#000',
      strokeWidth: 2,
      selectable: true,
    });

    // 加入所有元素到畫布
    canvas.add(permStartCircle);
    canvas.add(permEndCircle);
    canvas.add(connectionLine);
    canvas.setActiveObject(connectionLine);

    // 重置狀態
    isDrawing = false;
    startPoint = null;
    previewLine = null;
    canvas.requestRenderAll();
  },

  cleanUp: (canvas: fabric.Canvas) => {
    if (previewLine) {
      canvas.remove(previewLine);
    }
    if (startCircle) {
      canvas.remove(startCircle);
    }
    if (endCircle) {
      canvas.remove(endCircle);
    }
    startPoint = null;
    isDrawing = false;
    previewLine = null;
    startCircle = null;
    endCircle = null;
    canvas.requestRenderAll();
  }
};
