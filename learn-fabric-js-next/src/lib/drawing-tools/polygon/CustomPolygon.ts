import * as fabric from 'fabric';
import { PolygonVertex } from './PolygonVertex';
import { PolygonEdge } from './PolygonEdge';

export class CustomPolygon extends fabric.Group {
  vertices: PolygonVertex[];
  edges: PolygonEdge[];
  doors: fabric.Path[] = [];
  static type = 'region';

  constructor(vertices: PolygonVertex[], edges: PolygonEdge[], options: Partial<fabric.FabricObjectProps> = {}) {
    // 首先將所有物件傳入 super
    const objects = [...vertices, ...edges];
    super(objects, {
      ...options,
      subTargetCheck: true,
      interactive: true,
    });

    this.vertices = vertices;
    this.edges = edges;
    this.doors = [];

    // 初始化座標系統
    this.initializeCoordinateSystem();

    // 設置所有變換相關的事件監聽器
    this.setupTransformationEvents();

    // 設置頂點可見性相關的事件監聽器
    this.setupVisibilityEvents();

    // 設置頂點移動事件
    this.setupVertexEvents();

    // 初始隱藏頂點
    this.hideVertices();
  }

  // 設置變換相關的事件監聽器
  private setupTransformationEvents() {
    // 保留原有的代碼
    const transformEvents = ['modified', 'scaling', 'rotating', 'moving'];
    transformEvents.forEach(eventName => {
      this.on(eventName as keyof fabric.GroupEvents, () => {
        this.initializeCoordinateSystem();
        this.updateDoors();
      });
    });
  
    // 添加雙擊事件處理
    this.edges.forEach(edge => {
      edge.on('mousedblclick', (e) => {
        if (!e.absolutePointer) return;
        
        // 將畫布座標轉換為本地座標
        const matrix = fabric.util.invertTransform(this.calcTransformMatrix());
        const localPoint = fabric.util.transformPoint(e.absolutePointer, matrix);
        
        // 在邊上添加新頂點
        this.addVertexOnEdge(edge, localPoint);
      });
    });
  }

  // 設置頂點可見性相關的事件監聽器
  private setupVisibilityEvents() {
    // 滑鼠懸停事件
    this.on('mouseover', () => this.showVertices());

    // 滑鼠離開事件
    this.on('mouseout', (e) => {
      const isOverVertex = this.vertices.some(vertex =>
        e.absolutePointer &&
        vertex.containsPoint(e.absolutePointer)
      );
      const isSelected = this.canvas?.getActiveObject() === this;

      if (!isOverVertex && !isSelected) {
        this.hideVertices();
      }
    });

    // 選中和取消選中事件
    this.on('selected', () => this.showVertices());
    this.on('deselected', () => {
      if (!this.hoverCursor) {
        this.hideVertices();
      }
    });
  }

  // 設置頂點移動事件
  private setupVertexEvents() {
    this.vertices.forEach(vertex => {
      vertex.on('moving', () => {
        vertex.edges.forEach(edge => edge.updatePosition());
        this.updateDoors();
        this.setCoords();
      });
    });
  }

  private initializeCoordinateSystem() {
    // 更新群組本身的座標
    this.setCoords();

    // 更新所有頂點的座標
    this.vertices.forEach(vertex => {
      vertex.setCoords();
      // 確保頂點的相對位置正確
      vertex.edges.forEach(edge => {
        edge.setCoords();
        edge.updatePosition();
      });
    });

    // 更新所有邊的座標
    this.edges.forEach(edge => {
      edge.setCoords();
    });

    // 更新所有門的座標
    this.doors.forEach(door => {
      door.setCoords();
    });
  }

  // 添加新的方法來添加門
  addDoor(door: fabric.Path) {
    this.doors.push(door);
    this._objects.push(door);
    door.group = this;
    
    // 確保 door 與 canvas 正確關聯
    if (this.canvas) {
      door.canvas = this.canvas;
    }
    
    // 設置必要的屬性
    door.set({
      selectable: true,
      evented: true,
      hasControls: true
    });

    this.updateObjects();
  }

  private updateDoors() {
    this.doors.forEach(door => {
      if (!door.path || door.path.length < 2) return;
      if (this.canvas && !door.canvas) {
        door.canvas = this.canvas;
      }
      // 更新門的變換
      door.setCoords();

      // 設置門的變換屬性與群組一致
      door.set({
        scaleX: 1,
        scaleY: 1,
        angle: 0,
        flipX: false,
        flipY: false
      });

      // 確保門的座標系統與群組同步
      door.setCoords();
    });

    if (this.canvas) {
      this.canvas.requestRenderAll();
    }
  }
  
  removeDoor(door: fabric.Path) {
    const doorIndex = this.doors.indexOf(door);
    if (doorIndex > -1) {
      // 從 doors 數組中移除
      this.doors.splice(doorIndex, 1);
      
      // 從群組的 _objects 中移除
      const objectIndex = this._objects.indexOf(door);
      if (objectIndex > -1) {
        this._objects.splice(objectIndex, 1);
      }
      
      // 更新群組
      this.updateObjects();
    }
  }

  addVertexOnEdge(edge: PolygonEdge, point: fabric.Point) {
    // 1. 創建新頂點
    const newVertex = new PolygonVertex({
      left: point.x - 6,
      top: point.y - 6,
      fill: '#fff',
      stroke: '#000',
      strokeWidth: 1,
      hasControls: false,
      hasBorders: false,
      selectable: true
    });
  
    // 2. 創建新的邊，並繼承原邊的屬性
    const newEdge1 = new PolygonEdge(edge.source, newVertex, {
      stroke: edge.stroke,
      strokeWidth: edge.strokeWidth,
      hasBorders: false,
      hasControls: false,
      perPixelTargetFind: true,
      selectable: false,
      evented: true,
      hoverCursor: 'pointer'
    });
  
    const newEdge2 = new PolygonEdge(newVertex, edge.target, {
      stroke: edge.stroke,
      strokeWidth: edge.strokeWidth,
      hasBorders: false,
      hasControls: false,
      perPixelTargetFind: true,
      selectable: false,
      evented: true,
      hoverCursor: 'pointer'
    });
  
    // 3. 設置群組關係
    newVertex.group = this;
    newEdge1.group = this;
    newEdge2.group = this;
  
    // 4. 設置新頂點的邊關係
    newVertex.edges = [newEdge1, newEdge2];
  
    // 5. 更新原有頂點的邊關係
    edge.source.edges = edge.source.edges.map(e => 
      e === edge ? newEdge1 : e
    );
    
    edge.target.edges = edge.target.edges.map(e => 
      e === edge ? newEdge2 : e
    );
  
    // 6. 更新邊的連接關係
    newEdge1.nextEdge = newEdge2;
    newEdge2.prevEdge = newEdge1;
    
    if (edge.prevEdge) {
      edge.prevEdge.nextEdge = newEdge1;
      newEdge1.prevEdge = edge.prevEdge;
    }
    
    if (edge.nextEdge) {
      edge.nextEdge.prevEdge = newEdge2;
      newEdge2.nextEdge = edge.nextEdge;
    }
  
    // 7. 更新頂點和邊的數組
    const targetIndex = this.vertices.indexOf(edge.target);
    this.vertices.splice(targetIndex, 0, newVertex);
  
    const edgeIndex = this.edges.indexOf(edge);
    this.edges.splice(edgeIndex, 1, newEdge1, newEdge2);
  
    // 8. 從群組中移除舊邊
    this._objects = this._objects.filter(obj => obj !== edge);
  
    // 9. 添加新物件到群組
    this._objects.push(newVertex, newEdge1, newEdge2);
  
    // 10. 設置新邊的雙擊事件
    [newEdge1, newEdge2].forEach(newEdge => {
      newEdge.on('mousedblclick', (e) => {
        if (!e.absolutePointer) return;
        const matrix = fabric.util.invertTransform(this.calcTransformMatrix());
        const localPoint = fabric.util.transformPoint(e.absolutePointer, matrix);
        this.addVertexOnEdge(newEdge, localPoint);
      });
    });
  
    // 11. 設置頂點移動事件
    newVertex.on('moving', () => {
      newVertex.edges.forEach(e => e.updatePosition());
      this.updateDoors();
      this.setCoords();
    });
  
    // 12. 確保所有物件都與 canvas 關聯
    if (this.canvas) {
      [newVertex, newEdge1, newEdge2].forEach(obj => {
        obj.canvas = this.canvas;
      });
    }
  
    // 13. 更新座標系統
    this.initializeCoordinateSystem();
  
    // 14. 重建群組物件列表
    this._objects = [...this.vertices, ...this.edges, ...this.doors];
  
    // 15. 更新群組
    this.updateObjects();
  
    // 16. 強制更新顯示
    if (this.canvas) {
      this.canvas.requestRenderAll();
    }
  }
  
  // 添加顯示頂點的方法
  private showVertices() {
    this.vertices.forEach(vertex => {
      vertex.set({
        visible: true,
        selectable: true,
        evented: true
      });
    });
    if (this.canvas) {
      this.canvas.requestRenderAll();
    }
  }

  // 隱藏頂點並禁用互動
  private hideVertices() {
    this.vertices.forEach(vertex => {
      vertex.set({
        visible: false,
        selectable: false,
        evented: false
      });
    });
    if (this.canvas) {
      this.canvas.requestRenderAll();
    }
  }

  // 如果需要更新群組中的物件，可以使用這個方法
  updateObjects() {
    // 更新群組中的物件
    this._objects = [...this.vertices, ...this.edges, ...this.doors];
    if (this.canvas) {
      this._objects.forEach(obj => {
        if (!obj.canvas) {
          obj.canvas = this.canvas;
        }
      });
    }
    // 初始化座標系統
    this.initializeCoordinateSystem();

    // 更新門
    this.updateDoors();

    // 請求重新渲染
    if (this.canvas) {
      this.canvas.requestRenderAll();
    }
  }
}