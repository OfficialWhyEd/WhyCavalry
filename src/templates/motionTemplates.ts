export const templates = {
  kinetic_text: (text: string, font = "Inter", size = 120, color = "#ffffff") => `
var comp = api.createComp("Kinetic Text");
api.setActiveComp(comp);
api.set(comp, { resolution: [1920, 1080], backgroundColor: "#000000", frameRate: 30, duration: 150 });

var textLayer = api.create("text", "${text}");
api.set(textLayer, { text: "${text}", fontSize: ${size}, fontFamily: "${font}" });
api.set(textLayer, { fillColor: "${color}" });
api.set(textLayer, { position: [0, 0] });

// Slide-in animation
api.keyframe(textLayer, "position", 0, [-960, 0]);
api.keyframe(textLayer, "position", 20, [0, 0]);
api.magicEasing(textLayer, "position", 0, 20);

// Scale pop
api.keyframe(textLayer, "scale", 0, [0.8, 0.8]);
api.keyframe(textLayer, "scale", 20, [1, 1]);
api.magicEasing(textLayer, "scale", 0, 20);

api.select(textLayer);
comp`,

  logo_animation: (color = "#ff4444", duration = 120) => `
var comp = api.createComp("Logo Animation");
api.setActiveComp(comp);
api.set(comp, { resolution: [1920, 1080], backgroundColor: "#000000", frameRate: 30, duration: ${duration} });

// Background shape
var bg = api.create("rectangle", "Background");
api.set(bg, { width: 300, height: 300, cornerRadius: 40 });
api.set(bg, { fillColor: "${color}" });

// Scale reveal
api.keyframe(bg, "scale", 0, [0, 0]);
api.keyframe(bg, "scale", 20, [1.1, 1.1]);
api.keyframe(bg, "scale", 30, [1, 1]);
api.magicEasing(bg, "scale", 0, 30);

// Rotation
api.keyframe(bg, "rotation", 0, -45);
api.keyframe(bg, "rotation", 30, 0);
api.magicEasing(bg, "rotation", 0, 30);

comp`,

  lower_third: (name: string, title: string, color = "#0066ff") => `
var comp = api.createComp("Lower Third");
api.setActiveComp(comp);
api.set(comp, { resolution: [1920, 1080], backgroundColor: "transparent", frameRate: 30, duration: 150 });

// Accent bar
var bar = api.create("rectangle", "Bar");
api.set(bar, { width: 400, height: 6, fillColor: "${color}" });
api.set(bar, { position: [-760, 380] });
api.keyframe(bar, "scale", 0, [0, 1]);
api.keyframe(bar, "scale", 15, [1, 1]);
api.magicEasing(bar, "scale", 0, 15);

// Name text
var nameLayer = api.create("text", "Name");
api.set(nameLayer, { text: "${name}", fontSize: 52, fontFamily: "Inter", fillColor: "#ffffff" });
api.set(nameLayer, { position: [-760, 340] });
api.keyframe(nameLayer, "opacity", 0, 0);
api.keyframe(nameLayer, "opacity", 20, 1);

// Title text
var titleLayer = api.create("text", "Title");
api.set(titleLayer, { text: "${title}", fontSize: 32, fontFamily: "Inter", fillColor: "${color}" });
api.set(titleLayer, { position: [-760, 395] });
api.keyframe(titleLayer, "opacity", 5, 0);
api.keyframe(titleLayer, "opacity", 25, 1);

comp`,

  particles: (count = 100, color = "#ffffff") => `
var comp = api.createComp("Particles");
api.setActiveComp(comp);
api.set(comp, { resolution: [1920, 1080], backgroundColor: "#000000", frameRate: 30, duration: 300 });

var dot = api.create("ellipse", "Dot");
api.set(dot, { width: 8, height: 8, fillColor: "${color}" });

var duplicator = api.create("duplicator", "Duplicator");
api.set(duplicator, { count: ${count} });
api.parent(dot, duplicator);

var scatter = api.create("scatter", "Scatter");
api.set(scatter, { width: 1920, height: 1080 });
api.connect(scatter, duplicator, "distribution");

// Float animation
var floatJs = api.create("javascript", "Float");
api.set(floatJs, { script: "var t = api.frame / 30; return [Math.sin(api.index * 0.3 + t) * 20, Math.cos(api.index * 0.5 + t * 0.7) * 15];" });
api.connect(floatJs, dot, "position");

comp`,

  text_reveal: (text: string, color = "#ffffff") => `
var comp = api.createComp("Text Reveal");
api.setActiveComp(comp);
api.set(comp, { resolution: [1920, 1080], backgroundColor: "#000000", frameRate: 30, duration: 120 });

var textLayer = api.create("text", "${text}");
api.set(textLayer, { text: "${text}", fontSize: 100, fontFamily: "Inter", fillColor: "${color}" });

var textSeq = api.create("textSequencer", "Sequencer");
api.set(textSeq, { inDelay: 0.5, inDuration: 0.3 });
api.connect(textSeq, textLayer, "sequencer");

comp`,

  shape_morph: (fromShape = "ellipse", toShape = "rectangle", color = "#ff6600") => `
var comp = api.createComp("Shape Morph");
api.setActiveComp(comp);
api.set(comp, { resolution: [1920, 1080], backgroundColor: "#000000", frameRate: 30, duration: 120 });

var shape = api.create("${fromShape}", "Shape");
api.set(shape, { width: 200, height: 200, fillColor: "${color}" });

// Morph via scale
api.keyframe(shape, "scale", 0, [1, 1]);
api.keyframe(shape, "scale", 30, [1.5, 0.5]);
api.keyframe(shape, "scale", 60, [0.5, 1.5]);
api.keyframe(shape, "scale", 90, [1, 1]);
api.magicEasing(shape, "scale", 0, 90);

// Rotation spin
api.keyframe(shape, "rotation", 0, 0);
api.keyframe(shape, "rotation", 90, 360);

comp`,

  data_viz_bars: (values: number[], color = "#4488ff") => `
var comp = api.createComp("Data Viz");
api.setActiveComp(comp);
api.set(comp, { resolution: [1920, 1080], backgroundColor: "#111111", frameRate: 30, duration: 120 });

var values = ${JSON.stringify(values)};
var maxVal = Math.max.apply(null, values);
var barWidth = Math.floor(1600 / values.length) - 10;
var startX = -800 + barWidth / 2;

values.forEach(function(val, i) {
  var bar = api.create("rectangle", "Bar " + (i + 1));
  var barHeight = Math.floor((val / maxVal) * 600);
  api.set(bar, { width: barWidth, height: barHeight, fillColor: "${color}" });
  api.set(bar, { position: [startX + i * (barWidth + 10), -540 + barHeight / 2] });
  api.set(bar, { pivotY: 1 });

  api.keyframe(bar, "scale", i * 3, [1, 0]);
  api.keyframe(bar, "scale", i * 3 + 20, [1, 1]);
  api.magicEasing(bar, "scale", i * 3, i * 3 + 20);
});

comp`,
};

export type TemplateName = keyof typeof templates;
