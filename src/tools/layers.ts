export function createShape(
  type: string,
  name: string,
  width: number,
  height: number,
  x: number,
  y: number,
  fillColor: string,
  cornerRadius = 0
): string {
  return `
var layer = api.create(${JSON.stringify(type)}, ${JSON.stringify(name)});
var attrs = { width: ${width}, height: ${height}, fillColor: ${JSON.stringify(fillColor)} };
${cornerRadius > 0 ? `attrs.cornerRadius = ${cornerRadius};` : ""}
api.set(layer, attrs);
api.set(layer, { position: [${x}, ${y}] });
JSON.stringify({ layerId: layer, name: ${JSON.stringify(name)} })`;
}

export function createText(
  text: string,
  name: string,
  fontSize: number,
  fontFamily: string,
  color: string,
  x: number,
  y: number
): string {
  return `
var layer = api.create("text", ${JSON.stringify(name)});
api.set(layer, {
  text: ${JSON.stringify(text)},
  fontSize: ${fontSize},
  fontFamily: ${JSON.stringify(fontFamily)},
  fillColor: ${JSON.stringify(color)}
});
api.set(layer, { position: [${x}, ${y}] });
JSON.stringify({ layerId: layer, name: ${JSON.stringify(name)} })`;
}

export function createNull(name: string, x = 0, y = 0): string {
  return `
var layer = api.create("null", ${JSON.stringify(name)});
api.set(layer, { position: [${x}, ${y}] });
JSON.stringify({ layerId: layer })`;
}

export function createDuplicator(
  name: string,
  count: number,
  targetLayerId: string
): string {
  return `
var dup = api.create("duplicator", ${JSON.stringify(name)});
api.set(dup, { count: ${count} });
api.parent(${JSON.stringify(targetLayerId)}, dup);
JSON.stringify({ duplicatorId: dup })`;
}

export function deleteLayer(layerId: string): string {
  return `
api.deleteLayer(${JSON.stringify(layerId)});
JSON.stringify({ deleted: ${JSON.stringify(layerId)} })`;
}

export function renameLayer(layerId: string, newName: string): string {
  return `
api.rename(${JSON.stringify(layerId)}, ${JSON.stringify(newName)});
JSON.stringify({ renamed: true })`;
}

export function parentLayer(childId: string, parentId: string): string {
  return `
api.parent(${JSON.stringify(childId)}, ${JSON.stringify(parentId)});
JSON.stringify({ parented: true })`;
}

export function setVisible(layerId: string, visible: boolean): string {
  return `
api.set(${JSON.stringify(layerId)}, { visible: ${visible} });
JSON.stringify({ visible: ${visible} })`;
}

export function getLayerInfo(layerId: string): string {
  return `
var info = {
  id: ${JSON.stringify(layerId)},
  name: api.getNiceName(${JSON.stringify(layerId)}),
  type: api.getLayerType(${JSON.stringify(layerId)}),
  parent: api.getParent(${JSON.stringify(layerId)}),
  children: api.getChildren(${JSON.stringify(layerId)})
};
JSON.stringify(info)`;
}

export function connectLayers(
  fromId: string,
  toId: string,
  attribute: string
): string {
  return `
api.connect(${JSON.stringify(fromId)}, ${JSON.stringify(toId)}, ${JSON.stringify(attribute)});
JSON.stringify({ connected: true })`;
}

export function setAttribute(
  layerId: string,
  attribute: string,
  value: unknown
): string {
  const attrs: Record<string, unknown> = {};
  attrs[attribute] = value;
  return `
api.set(${JSON.stringify(layerId)}, ${JSON.stringify(attrs)});
JSON.stringify({ set: true })`;
}

export function getAttribute(layerId: string, attribute: string): string {
  return `
var val = api.get(${JSON.stringify(layerId)}, ${JSON.stringify(attribute)});
JSON.stringify({ value: val })`;
}
