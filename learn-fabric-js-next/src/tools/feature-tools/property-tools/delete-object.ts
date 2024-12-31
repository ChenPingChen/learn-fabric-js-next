import { CustomPolygon } from "@/lib/drawing-tools/polygon/CustomPolygon";
import DeleteIcon from "../../../components/ui/icons/DeleteIcon";
import { FeatureTool } from "../../../types/feature-tools";
import { Object as FabricObject } from "fabric";

const deleteObject: FeatureTool = {
  name: "Delete Object",
  description: "Delete selected object",
  price: 0,
  icon: DeleteIcon,
  isCommon: true, // This is a common tool for all objects
  action: (object: FabricObject) => {
    const canvas = object?.canvas;
    if (!canvas) {
      console.error("No canvas available");
      return;
    }

    // 檢查是否為門物件且屬於某個群組
    if (object.type === 'path' && object.group) {
      const group = object.group as CustomPolygon;
      group.removeDoor(object as any);
    } else {
      // 一般物件的刪除處理
      canvas.remove(object);
    }

    canvas.discardActiveObject();
    canvas.requestRenderAll();
  },
};

export default deleteObject;
