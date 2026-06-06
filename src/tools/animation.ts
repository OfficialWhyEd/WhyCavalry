export function addKeyframe(
  layerId: string,
  attribute: string,
  frame: number,
  value: unknown
): string {
  return `
api.keyframe(${JSON.stringify(layerId)}, ${JSON.stringify(attribute)}, ${frame}, ${JSON.stringify(value)});
JSON.stringify({ keyframed: true, frame: ${frame} })`;
}

export function addEasing(
  layerId: string,
  attribute: string,
  startFrame: number,
  endFrame: number
): string {
  return `
api.magicEasing(${JSON.stringify(layerId)}, ${JSON.stringify(attribute)}, ${startFrame}, ${endFrame});
JSON.stringify({ eased: true })`;
}

export function deleteKeyframe(
  layerId: string,
  attribute: string,
  frame: number
): string {
  return `
api.deleteKeyframe(${JSON.stringify(layerId)}, ${JSON.stringify(attribute)}, ${frame});
JSON.stringify({ deleted: true })`;
}

export function deleteAnimation(layerId: string, attribute: string): string {
  return `
api.deleteAnimation(${JSON.stringify(layerId)}, ${JSON.stringify(attribute)});
JSON.stringify({ cleared: true })`;
}

export function getKeyframeTimes(layerId: string, attribute: string): string {
  return `
var times = api.getKeyframeTimes(${JSON.stringify(layerId)}, ${JSON.stringify(attribute)});
JSON.stringify({ times: times })`;
}

export function buildAnimation(
  layerId: string,
  attribute: string,
  keyframes: Array<{ frame: number; value: unknown }>,
  withEasing = true
): string {
  const kfLines = keyframes
    .map(
      (kf) =>
        `api.keyframe(${JSON.stringify(layerId)}, ${JSON.stringify(attribute)}, ${kf.frame}, ${JSON.stringify(kf.value)});`
    )
    .join("\n");

  const easingLine =
    withEasing && keyframes.length >= 2
      ? `api.magicEasing(${JSON.stringify(layerId)}, ${JSON.stringify(attribute)}, ${keyframes[0].frame}, ${keyframes[keyframes.length - 1].frame});`
      : "";

  return `
${kfLines}
${easingLine}
JSON.stringify({ animated: true, keyframes: ${keyframes.length} })`;
}

export function addFadeIn(
  layerId: string,
  startFrame: number,
  duration = 15
): string {
  return buildAnimation(
    layerId,
    "opacity",
    [
      { frame: startFrame, value: 0 },
      { frame: startFrame + duration, value: 1 },
    ],
    true
  );
}

export function addFadeOut(
  layerId: string,
  startFrame: number,
  duration = 15
): string {
  return buildAnimation(
    layerId,
    "opacity",
    [
      { frame: startFrame, value: 1 },
      { frame: startFrame + duration, value: 0 },
    ],
    true
  );
}

export function addScalePop(
  layerId: string,
  startFrame: number
): string {
  return buildAnimation(
    layerId,
    "scale",
    [
      { frame: startFrame, value: [0, 0] },
      { frame: startFrame + 12, value: [1.1, 1.1] },
      { frame: startFrame + 18, value: [1, 1] },
    ],
    true
  );
}

export function addSlideIn(
  layerId: string,
  startFrame: number,
  fromX: number,
  toX: number,
  y = 0,
  duration = 20
): string {
  return buildAnimation(
    layerId,
    "position",
    [
      { frame: startFrame, value: [fromX, y] },
      { frame: startFrame + duration, value: [toX, y] },
    ],
    true
  );
}

export function setExpression(
  layerId: string,
  attribute: string,
  expression: string
): string {
  return `
api.setAttributeExpression(${JSON.stringify(layerId)}, ${JSON.stringify(attribute)}, ${JSON.stringify(expression)});
JSON.stringify({ expressionSet: true })`;
}
