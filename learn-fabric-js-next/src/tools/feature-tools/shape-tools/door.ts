import * as fabric from 'fabric';
import { FeatureTool } from '@/types/feature-tools';
import DoorIcon from '@/components/ui/icons/Door';
import { CustomPolygon } from '@/lib/drawing-tools/polygon/CustomPolygon';

const door: FeatureTool = {
  name: "door",
  description: "Add door to region",
  price: 0,
  icon: DoorIcon,
  objectType: "region",
  action: (object: fabric.Object) => {
    if (!(object instanceof CustomPolygon) || !object.canvas) {
      console.error("Door tool can only be used with CustomPolygon objects");
      return;
    }
    
    const canvas = object.canvas;
    let isDrawing = false;
    let startPoint: fabric.Point | null = null;
    let previewPath: fabric.Path | null = null;
    let previewPoint: fabric.Circle | null = null;

    // 轉換點到群組局部座標系
    const toLocalPoint = (point: fabric.Point): fabric.Point => {
      const matrix = fabric.util.invertTransform(object.calcTransformMatrix());
      return fabric.util.transformPoint(point, matrix);
    };

    // 轉換點到畫布座標系
    const toGlobalPoint = (point: fabric.Point): fabric.Point => {
      const matrix = object.calcTransformMatrix();
      return fabric.util.transformPoint(point, matrix);
    };
    
    // 創建預覽點
    const createPreviewPoint = (point: fabric.Point) => {
      const globalPoint = toGlobalPoint(point);
      return new fabric.Circle({
        left: globalPoint.x - 5,
        top: globalPoint.y - 5,
        radius: 5,
        fill: 'rgba(255, 0, 0, 0.5)',
        selectable: false,
        evented: false
      });
    };

    // 計算點到線段的距離（在局部座標系中）
    const getPointToLineDistance = (point: fabric.Point, lineStart: fabric.Point, lineEnd: fabric.Point) => {
      const lineVector = {
        x: lineEnd.x - lineStart.x,
        y: lineEnd.y - lineStart.y
      };
      
      const pointVector = {
        x: point.x - lineStart.x,
        y: point.y - lineStart.y
      };
      
      const lineLengthSq = lineVector.x * lineVector.x + lineVector.y * lineVector.y;
      
      const t = Math.max(0, Math.min(1, (
        pointVector.x * lineVector.x + pointVector.y * lineVector.y
      ) / lineLengthSq));
      
      const projectionPoint = new fabric.Point(
        lineStart.x + t * lineVector.x,
        lineStart.y + t * lineVector.y
      );
      
      const distance = Math.sqrt(
        Math.pow(point.x - projectionPoint.x, 2) + 
        Math.pow(point.y - projectionPoint.y, 2)
      );
      
      return { distance, point: projectionPoint, t };
    };

    // 找到最近的邊界點（在局部座標系中）
    const findClosestEdgePoint = (globalPointer: fabric.Point): {point: fabric.Point, edge: fabric.Line} | null => {
      const THRESHOLD = 10;
      let closestPoint = null;
      let minDistance = Infinity;
      let closestEdge = null;

      // 轉換到局部座標系
      const localPointer = toLocalPoint(globalPointer);
      
      object.edges.forEach(edge => {
        const p1 = new fabric.Point(edge.x1!, edge.y1!);
        const p2 = new fabric.Point(edge.x2!, edge.y2!);
        
        const result = getPointToLineDistance(localPointer, p1, p2);
        
        if (result.distance < THRESHOLD && result.t >= 0 && result.t <= 1) {
          if (result.distance < minDistance) {
            minDistance = result.distance;
            closestPoint = result.point;
            closestEdge = edge;
          }
        }
      });
  
      return closestPoint && closestEdge ? {point: closestPoint, edge: closestEdge} : null;
    };

    // 找到兩點之間的路徑（在局部座標系中）
    const findPathBetweenPoints = (
      localStart: fabric.Point,
      localEnd: fabric.Point
    ): fabric.Point[] => {
      let startEdgeIndex = -1;
      let endEdgeIndex = -1;
      
      object.edges.forEach((edge, i) => {
        const p1 = new fabric.Point(edge.x1!, edge.y1!);
        const p2 = new fabric.Point(edge.x2!, edge.y2!);
        
        const startResult = getPointToLineDistance(localStart, p1, p2);
        const endResult = getPointToLineDistance(localEnd, p1, p2);
        
        if (startResult.distance < 5 && startResult.t >= 0 && startResult.t <= 1) {
          startEdgeIndex = i;
          localStart = startResult.point;
        }
        if (endResult.distance < 5 && endResult.t >= 0 && endResult.t <= 1) {
          endEdgeIndex = i;
          localEnd = endResult.point;
        }
      });
  
      if (startEdgeIndex === -1 || endEdgeIndex === -1) return [];
  
      const path: fabric.Point[] = [localStart];
      
      if (startEdgeIndex === endEdgeIndex) {
        return [localStart, localEnd];
      }
  
      let currentIndex = startEdgeIndex;
      while (currentIndex !== endEdgeIndex) {
        currentIndex = (currentIndex + 1) % object.edges.length;
        const edge = object.edges[currentIndex];
        path.push(new fabric.Point(edge.x1!, edge.y1!));
      }
      
      path.push(localEnd);
      return path;
    };
    
    // 更新或創建預覽線
    const updatePreviewLine = (localStart: fabric.Point, localEnd: fabric.Point) => {
      const localPathPoints = findPathBetweenPoints(localStart, localEnd);
      
      if (previewPath) {
        canvas.remove(previewPath);
      }
      
      if (localPathPoints.length < 2) {
        previewPath = null;
        return;
      }
      
      // 轉換回全局座標用於顯示
      const globalPoints = localPathPoints.map(toGlobalPoint);
      
      let pathString = `M ${globalPoints[0].x} ${globalPoints[0].y}`;
      for (let i = 1; i < globalPoints.length; i++) {
        pathString += ` L ${globalPoints[i].x} ${globalPoints[i].y}`;
      }

      previewPath = new fabric.Path(pathString, {
        stroke: 'red',
        strokeWidth: 2,
        strokeDashArray: [5, 5],
        fill: '',
        selectable: false,
        evented: false
      });
      
      canvas.add(previewPath);
      canvas.requestRenderAll();
    };

    const cleanup = () => {
      if (previewPath) canvas.remove(previewPath);
      if (previewPoint) canvas.remove(previewPoint);
      canvas.off('mouse:move', handleMouseMove);
      canvas.off('mouse:down', handleMouseDown);
      canvas.requestRenderAll();
    };

    const handleMouseMove = (e: fabric.TEvent<MouseEvent>) => {
      const pointer = canvas.getPointer(e.e);
      const result = findClosestEdgePoint(new fabric.Point(pointer.x, pointer.y));
      
      if (previewPath) canvas.remove(previewPath);
      if (previewPoint) canvas.remove(previewPoint);

      if (result) {
        previewPoint = createPreviewPoint(result.point);
        canvas.add(previewPoint);

        if (isDrawing && startPoint) {
          updatePreviewLine(startPoint, result.point);
        }
      }
      
      canvas.requestRenderAll();
    };

    const handleMouseDown = (e: fabric.TEvent<MouseEvent>) => {
      const pointer = canvas.getPointer(e.e);
      const result = findClosestEdgePoint(new fabric.Point(pointer.x, pointer.y));
      
      if (!result) return;
  
      if (!isDrawing) {
        isDrawing = true;
        startPoint = result.point;
      } else {
        const localPathPoints = findPathBetweenPoints(startPoint!, result.point);
        
        if (localPathPoints.length < 2) {
          isDrawing = false;
          startPoint = null;
          return;
        }
  
        // 使用局部座標創建路徑
        let pathString = `M ${localPathPoints[0].x} ${localPathPoints[0].y}`;
        for (let i = 1; i < localPathPoints.length; i++) {
          pathString += ` L ${localPathPoints[i].x} ${localPathPoints[i].y}`;
        }
  
        const doorPath = new fabric.Path(pathString, {
          stroke: 'red',
          strokeWidth: 2,
          fill: '',
          evented: true,
          selectable: true,
          objectType: 'door',
          originX: 'left',
          originY: 'top'
        });
        
        object.addDoor(doorPath);
        
        cleanup();
        isDrawing = false;
        startPoint = null;
      }
      
      canvas.requestRenderAll();
    };

    canvas.on('mouse:move', handleMouseMove as any);
    canvas.on('mouse:down', handleMouseDown as any);

    return cleanup;
  }
};

export default door;