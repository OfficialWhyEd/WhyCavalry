export function createComp(
  name: string,
  width: number,
  height: number,
  fps: number,
  duration: number,
  bgColor: string
): string {
  return `
var comp = api.createComp(${JSON.stringify(name)});
api.setActiveComp(comp);
api.set(comp, {
  resolution: [${width}, ${height}],
  frameRate: ${fps},
  duration: ${duration},
  backgroundColor: ${JSON.stringify(bgColor)}
});
JSON.stringify({ compId: comp, name: ${JSON.stringify(name)} })`;
}

export function getSceneInfo(): string {
  return `
var comp = api.getActiveComp();
var layers = api.getCompLayers(comp);
var info = {
  compId: comp,
  layerCount: layers.length,
  layers: layers.map(function(id) {
    return {
      id: id,
      name: api.getNiceName(id),
      type: api.getLayerType(id)
    };
  }),
  scenePath: api.getSceneFilePath()
};
JSON.stringify(info)`;
}

export function saveScene(filePath: string): string {
  return `
api.saveSceneAs(${JSON.stringify(filePath)});
JSON.stringify({ saved: true, path: ${JSON.stringify(filePath)} })`;
}

export function openScene(filePath: string): string {
  return `
api.openScene(${JSON.stringify(filePath)}, false);
JSON.stringify({ opened: true, path: ${JSON.stringify(filePath)} })`;
}

export function setFrame(frame: number): string {
  return `
api.setFrame(${frame});
JSON.stringify({ frame: ${frame} })`;
}

export function addRenderQueueItem(
  outputPath: string,
  format = "mp4"
): string {
  return `
var comp = api.getActiveComp();
var item = api.addRenderQueueItem(comp);
api.set(item, { path: ${JSON.stringify(outputPath)}, format: ${JSON.stringify(format)} });
JSON.stringify({ queued: true, path: ${JSON.stringify(outputPath)} })`;
}
