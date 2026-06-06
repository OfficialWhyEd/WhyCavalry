#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import fs from "fs";
import path from "path";
import { execSync } from "child_process";

import {
  runInCavalry,
  queueCommand,
  listPendingCommands,
  clearPendingCommands,
  ensureBridgeDirs,
  getBridgeDir,
} from "./bridge.js";
import { templates } from "./templates/motionTemplates.js";
import * as scene from "./tools/scene.js";
import * as layers from "./tools/layers.js";
import * as animation from "./tools/animation.js";

const server = new Server(
  { name: "whycavalry", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "cavalry_run_script",
      description:
        "Execute arbitrary JavaScript in Cavalry via the file bridge. Requires the WhyCavalry Bridge to be running in Cavalry's Script Editor.",
      inputSchema: {
        type: "object",
        properties: {
          script: {
            type: "string",
            description: "JavaScript code to execute in Cavalry",
          },
          wait_for_result: {
            type: "boolean",
            description: "Wait for Cavalry to execute and return result (default: true)",
            default: true,
          },
        },
        required: ["script"],
      },
    },
    {
      name: "cavalry_generate_script",
      description:
        "Generate a Cavalry JavaScript snippet for any operation without executing it. Returns code ready to paste in Cavalry's Script Editor.",
      inputSchema: {
        type: "object",
        properties: {
          description: {
            type: "string",
            description: "Describe what you want to create or do in Cavalry",
          },
        },
        required: ["description"],
      },
    },
    {
      name: "cavalry_create_comp",
      description: "Create a new composition in Cavalry",
      inputSchema: {
        type: "object",
        properties: {
          name: { type: "string", description: "Composition name" },
          width: { type: "number", description: "Width in pixels", default: 1920 },
          height: { type: "number", description: "Height in pixels", default: 1080 },
          fps: { type: "number", description: "Frames per second", default: 30 },
          duration: { type: "number", description: "Duration in frames", default: 150 },
          bg_color: { type: "string", description: "Background color hex", default: "#000000" },
        },
        required: ["name"],
      },
    },
    {
      name: "cavalry_create_shape",
      description: "Create a shape layer in the active Cavalry composition",
      inputSchema: {
        type: "object",
        properties: {
          type: {
            type: "string",
            enum: ["rectangle", "ellipse", "polygon", "star", "line"],
            description: "Shape type",
          },
          name: { type: "string", description: "Layer name" },
          width: { type: "number", description: "Width", default: 200 },
          height: { type: "number", description: "Height", default: 200 },
          x: { type: "number", description: "X position", default: 0 },
          y: { type: "number", description: "Y position", default: 0 },
          fill_color: { type: "string", description: "Fill color hex", default: "#ffffff" },
          corner_radius: { type: "number", description: "Corner radius (rectangle only)", default: 0 },
        },
        required: ["type", "name"],
      },
    },
    {
      name: "cavalry_create_text",
      description: "Create a text layer in the active Cavalry composition",
      inputSchema: {
        type: "object",
        properties: {
          text: { type: "string", description: "Text content" },
          name: { type: "string", description: "Layer name" },
          font_size: { type: "number", description: "Font size", default: 72 },
          font_family: { type: "string", description: "Font family", default: "Inter" },
          color: { type: "string", description: "Text color hex", default: "#ffffff" },
          x: { type: "number", description: "X position", default: 0 },
          y: { type: "number", description: "Y position", default: 0 },
        },
        required: ["text", "name"],
      },
    },
    {
      name: "cavalry_set_attribute",
      description: "Set an attribute value on a Cavalry layer",
      inputSchema: {
        type: "object",
        properties: {
          layer_id: { type: "string", description: "Layer ID" },
          attribute: { type: "string", description: "Attribute name (e.g. position, scale, opacity, fillColor)" },
          value: { description: "Value to set (number, string, array, or object)" },
        },
        required: ["layer_id", "attribute", "value"],
      },
    },
    {
      name: "cavalry_add_keyframe",
      description: "Add a keyframe to a layer attribute",
      inputSchema: {
        type: "object",
        properties: {
          layer_id: { type: "string", description: "Layer ID" },
          attribute: { type: "string", description: "Attribute name" },
          frame: { type: "number", description: "Frame number" },
          value: { description: "Value at this keyframe" },
          magic_easing: { type: "boolean", description: "Apply magic easing to this keyframe", default: false },
        },
        required: ["layer_id", "attribute", "frame", "value"],
      },
    },
    {
      name: "cavalry_animate_layer",
      description: "Add a complete animation to a layer (multiple keyframes at once with optional easing)",
      inputSchema: {
        type: "object",
        properties: {
          layer_id: { type: "string", description: "Layer ID" },
          attribute: { type: "string", description: "Attribute to animate" },
          keyframes: {
            type: "array",
            description: "Array of {frame, value} pairs",
            items: {
              type: "object",
              properties: {
                frame: { type: "number" },
                value: {},
              },
            },
          },
          with_easing: { type: "boolean", description: "Apply magic easing", default: true },
        },
        required: ["layer_id", "attribute", "keyframes"],
      },
    },
    {
      name: "cavalry_add_preset_animation",
      description: "Add a preset animation to a layer (fade in, fade out, scale pop, slide in)",
      inputSchema: {
        type: "object",
        properties: {
          layer_id: { type: "string", description: "Layer ID" },
          preset: {
            type: "string",
            enum: ["fade_in", "fade_out", "scale_pop", "slide_in_left", "slide_in_right", "slide_in_top"],
            description: "Animation preset",
          },
          start_frame: { type: "number", description: "Start frame", default: 0 },
          duration: { type: "number", description: "Duration in frames", default: 20 },
        },
        required: ["layer_id", "preset"],
      },
    },
    {
      name: "cavalry_get_scene_info",
      description: "Get information about the currently active Cavalry scene (layers, composition, etc.)",
      inputSchema: { type: "object", properties: {} },
    },
    {
      name: "cavalry_save_scene",
      description: "Save the current Cavalry scene to a file",
      inputSchema: {
        type: "object",
        properties: {
          file_path: { type: "string", description: "Output file path (.cv). Defaults to ~/Documents/WhyCavalry/Scenes/" },
          file_name: { type: "string", description: "File name without extension" },
        },
        required: ["file_name"],
      },
    },
    {
      name: "cavalry_open_scene",
      description: "Open a Cavalry scene file",
      inputSchema: {
        type: "object",
        properties: {
          file_path: { type: "string", description: "Path to .cv scene file" },
        },
        required: ["file_path"],
      },
    },
    {
      name: "cavalry_use_template",
      description:
        "Create a complete motion graphics scene from a built-in template",
      inputSchema: {
        type: "object",
        properties: {
          template: {
            type: "string",
            enum: [
              "kinetic_text",
              "logo_animation",
              "lower_third",
              "particles",
              "text_reveal",
              "shape_morph",
              "data_viz_bars",
            ],
            description: "Template name",
          },
          params: {
            type: "object",
            description: "Template parameters (text, color, name, title, values, etc.)",
          },
        },
        required: ["template"],
      },
    },
    {
      name: "cavalry_connect_layers",
      description: "Connect two Cavalry layers (e.g. connect a distribution to a duplicator)",
      inputSchema: {
        type: "object",
        properties: {
          from_id: { type: "string", description: "Source layer ID" },
          to_id: { type: "string", description: "Target layer ID" },
          attribute: { type: "string", description: "Attribute to connect to" },
        },
        required: ["from_id", "to_id", "attribute"],
      },
    },
    {
      name: "cavalry_set_expression",
      description: "Set a JavaScript expression on a layer attribute for procedural animation",
      inputSchema: {
        type: "object",
        properties: {
          layer_id: { type: "string", description: "Layer ID" },
          attribute: { type: "string", description: "Attribute name" },
          expression: {
            type: "string",
            description: "JavaScript expression (use api.frame for current frame, api.index for duplicator index)",
          },
        },
        required: ["layer_id", "attribute", "expression"],
      },
    },
    {
      name: "cavalry_bridge_status",
      description: "Check the WhyCavalry bridge status (pending commands, dirs, etc.)",
      inputSchema: { type: "object", properties: {} },
    },
    {
      name: "cavalry_clear_queue",
      description: "Clear all pending commands in the bridge queue",
      inputSchema: { type: "object", properties: {} },
    },
    {
      name: "cavalry_open_in_cavalry",
      description: "Open a .cv scene file in Cavalry app",
      inputSchema: {
        type: "object",
        properties: {
          file_path: { type: "string", description: "Path to .cv file" },
        },
        required: ["file_path"],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "cavalry_run_script": {
        const { script, wait_for_result = true } = args as {
          script: string;
          wait_for_result?: boolean;
        };

        if (!wait_for_result) {
          const id = queueCommand(script);
          return {
            content: [
              {
                type: "text",
                text: `Script queued with ID: ${id}\nRun the WhyCavalry Bridge in Cavalry's Script Editor to execute it.`,
              },
            ],
          };
        }

        const result = await runInCavalry(script);
        return {
          content: [
            {
              type: "text",
              text: result.success
                ? `Result: ${JSON.stringify(result.value, null, 2)}`
                : `Error: ${result.error}`,
            },
          ],
        };
      }

      case "cavalry_generate_script": {
        const { description } = args as { description: string };
        return {
          content: [
            {
              type: "text",
              text: `Cavalry JavaScript for: "${description}"\n\nPaste this in Cavalry's Script Editor (Scripting > New Script) and click Run:\n\n\`\`\`javascript\n// WhyCavalry generated script\n// ${description}\n\n// Get or create a comp\nvar comp = api.getActiveComp() || api.createComp("WhyCavalry Scene");\napi.setActiveComp(comp);\n\n// Your code here - the full api object is available:\n// api.create(type, name) - create layers\n// api.set(layerId, attrs) - set attributes\n// api.keyframe(layerId, attr, frame, value) - add keyframes\n// api.magicEasing(layerId, attr, startFrame, endFrame) - add easing\n// api.connect(from, to, attr) - connect layers\n// api.parent(child, parent) - parent layers\n\n\`\`\`\n\nUse cavalry_run_script to execute directly via the bridge.`,
            },
          ],
        };
      }

      case "cavalry_create_comp": {
        const {
          name: compName,
          width = 1920,
          height = 1080,
          fps = 30,
          duration = 150,
          bg_color = "#000000",
        } = args as {
          name: string;
          width?: number;
          height?: number;
          fps?: number;
          duration?: number;
          bg_color?: string;
        };

        const script = scene.createComp(compName, width, height, fps, duration, bg_color);
        const result = await runInCavalry(script);
        return {
          content: [
            {
              type: "text",
              text: result.success
                ? `Comp "${compName}" created. ${JSON.stringify(result.value)}`
                : `Error: ${result.error}`,
            },
          ],
        };
      }

      case "cavalry_create_shape": {
        const {
          type: shapeType,
          name: layerName,
          width = 200,
          height = 200,
          x = 0,
          y = 0,
          fill_color = "#ffffff",
          corner_radius = 0,
        } = args as {
          type: string;
          name: string;
          width?: number;
          height?: number;
          x?: number;
          y?: number;
          fill_color?: string;
          corner_radius?: number;
        };

        const script = layers.createShape(shapeType, layerName, width, height, x, y, fill_color, corner_radius);
        const result = await runInCavalry(script);
        return {
          content: [
            {
              type: "text",
              text: result.success
                ? `Shape "${layerName}" created. Layer ID: ${(result.value as { layerId: string })?.layerId}`
                : `Error: ${result.error}`,
            },
          ],
        };
      }

      case "cavalry_create_text": {
        const {
          text,
          name: layerName,
          font_size = 72,
          font_family = "Inter",
          color = "#ffffff",
          x = 0,
          y = 0,
        } = args as {
          text: string;
          name: string;
          font_size?: number;
          font_family?: string;
          color?: string;
          x?: number;
          y?: number;
        };

        const script = layers.createText(text, layerName, font_size, font_family, color, x, y);
        const result = await runInCavalry(script);
        return {
          content: [
            {
              type: "text",
              text: result.success
                ? `Text layer "${layerName}" created. Layer ID: ${(result.value as { layerId: string })?.layerId}`
                : `Error: ${result.error}`,
            },
          ],
        };
      }

      case "cavalry_set_attribute": {
        const { layer_id, attribute, value } = args as {
          layer_id: string;
          attribute: string;
          value: unknown;
        };

        const script = layers.setAttribute(layer_id, attribute, value);
        const result = await runInCavalry(script);
        return {
          content: [
            {
              type: "text",
              text: result.success ? `Attribute "${attribute}" set.` : `Error: ${result.error}`,
            },
          ],
        };
      }

      case "cavalry_add_keyframe": {
        const { layer_id, attribute, frame, value, magic_easing = false } = args as {
          layer_id: string;
          attribute: string;
          frame: number;
          value: unknown;
          magic_easing?: boolean;
        };

        let script = animation.addKeyframe(layer_id, attribute, frame, value);
        if (magic_easing) {
          script += `\napi.magicEasing(${JSON.stringify(layer_id)}, ${JSON.stringify(attribute)}, ${frame}, ${frame});`;
        }

        const result = await runInCavalry(script);
        return {
          content: [
            {
              type: "text",
              text: result.success
                ? `Keyframe added at frame ${frame}.`
                : `Error: ${result.error}`,
            },
          ],
        };
      }

      case "cavalry_animate_layer": {
        const { layer_id, attribute, keyframes, with_easing = true } = args as {
          layer_id: string;
          attribute: string;
          keyframes: Array<{ frame: number; value: unknown }>;
          with_easing?: boolean;
        };

        const script = animation.buildAnimation(layer_id, attribute, keyframes, with_easing);
        const result = await runInCavalry(script);
        return {
          content: [
            {
              type: "text",
              text: result.success
                ? `Animation set: ${keyframes.length} keyframes on "${attribute}".`
                : `Error: ${result.error}`,
            },
          ],
        };
      }

      case "cavalry_add_preset_animation": {
        const { layer_id, preset, start_frame = 0, duration = 20 } = args as {
          layer_id: string;
          preset: string;
          start_frame?: number;
          duration?: number;
        };

        let script: string;
        switch (preset) {
          case "fade_in":
            script = animation.addFadeIn(layer_id, start_frame, duration);
            break;
          case "fade_out":
            script = animation.addFadeOut(layer_id, start_frame, duration);
            break;
          case "scale_pop":
            script = animation.addScalePop(layer_id, start_frame);
            break;
          case "slide_in_left":
            script = animation.addSlideIn(layer_id, start_frame, -1200, 0, 0, duration);
            break;
          case "slide_in_right":
            script = animation.addSlideIn(layer_id, start_frame, 1200, 0, 0, duration);
            break;
          case "slide_in_top":
            script = animation.addSlideIn(layer_id, start_frame, 0, 0, 700, duration);
            break;
          default:
            throw new Error(`Unknown preset: ${preset}`);
        }

        const result = await runInCavalry(script);
        return {
          content: [
            {
              type: "text",
              text: result.success
                ? `Preset "${preset}" applied.`
                : `Error: ${result.error}`,
            },
          ],
        };
      }

      case "cavalry_get_scene_info": {
        const result = await runInCavalry(scene.getSceneInfo());
        return {
          content: [
            {
              type: "text",
              text: result.success
                ? JSON.stringify(result.value, null, 2)
                : `Error: ${result.error}`,
            },
          ],
        };
      }

      case "cavalry_save_scene": {
        const { file_path, file_name } = args as {
          file_path?: string;
          file_name: string;
        };

        const scenesDir = path.join(
          process.env.HOME || "~",
          "Documents",
          "WhyCavalry",
          "Scenes"
        );
        if (!fs.existsSync(scenesDir)) fs.mkdirSync(scenesDir, { recursive: true });

        const finalPath = file_path || path.join(scenesDir, `${file_name}.cv`);
        const result = await runInCavalry(scene.saveScene(finalPath));
        return {
          content: [
            {
              type: "text",
              text: result.success
                ? `Scene saved to: ${finalPath}`
                : `Error: ${result.error}`,
            },
          ],
        };
      }

      case "cavalry_open_scene": {
        const { file_path } = args as { file_path: string };
        const result = await runInCavalry(scene.openScene(file_path));
        return {
          content: [
            {
              type: "text",
              text: result.success
                ? `Scene opened: ${file_path}`
                : `Error: ${result.error}`,
            },
          ],
        };
      }

      case "cavalry_use_template": {
        const { template, params = {} } = args as {
          template: keyof typeof templates;
          params?: Record<string, unknown>;
        };

        const templateFn = templates[template] as (...args: unknown[]) => string;
        if (!templateFn) throw new Error(`Unknown template: ${template}`);

        let script: string;
        switch (template) {
          case "kinetic_text":
            script = templates.kinetic_text(
              (params.text as string) || "Hello World",
              (params.font as string) || "Inter",
              (params.size as number) || 120,
              (params.color as string) || "#ffffff"
            );
            break;
          case "logo_animation":
            script = templates.logo_animation(
              (params.color as string) || "#ff4444",
              (params.duration as number) || 120
            );
            break;
          case "lower_third":
            script = templates.lower_third(
              (params.name as string) || "Name",
              (params.title as string) || "Title",
              (params.color as string) || "#0066ff"
            );
            break;
          case "particles":
            script = templates.particles(
              (params.count as number) || 100,
              (params.color as string) || "#ffffff"
            );
            break;
          case "text_reveal":
            script = templates.text_reveal(
              (params.text as string) || "Hello World",
              (params.color as string) || "#ffffff"
            );
            break;
          case "shape_morph":
            script = templates.shape_morph(
              (params.from_shape as string) || "ellipse",
              (params.to_shape as string) || "rectangle",
              (params.color as string) || "#ff6600"
            );
            break;
          case "data_viz_bars":
            script = templates.data_viz_bars(
              (params.values as number[]) || [50, 80, 30, 90, 60],
              (params.color as string) || "#4488ff"
            );
            break;
          default:
            throw new Error(`Unknown template: ${template}`);
        }

        const result = await runInCavalry(script);
        return {
          content: [
            {
              type: "text",
              text: result.success
                ? `Template "${template}" created successfully.`
                : `Error: ${result.error}`,
            },
          ],
        };
      }

      case "cavalry_connect_layers": {
        const { from_id, to_id, attribute } = args as {
          from_id: string;
          to_id: string;
          attribute: string;
        };

        const result = await runInCavalry(layers.connectLayers(from_id, to_id, attribute));
        return {
          content: [
            {
              type: "text",
              text: result.success ? "Layers connected." : `Error: ${result.error}`,
            },
          ],
        };
      }

      case "cavalry_set_expression": {
        const { layer_id, attribute, expression } = args as {
          layer_id: string;
          attribute: string;
          expression: string;
        };

        const result = await runInCavalry(
          animation.setExpression(layer_id, attribute, expression)
        );
        return {
          content: [
            {
              type: "text",
              text: result.success
                ? `Expression set on "${attribute}".`
                : `Error: ${result.error}`,
            },
          ],
        };
      }

      case "cavalry_bridge_status": {
        ensureBridgeDirs();
        const pending = listPendingCommands();
        return {
          content: [
            {
              type: "text",
              text: [
                `WhyCavalry Bridge Status`,
                `─────────────────────────`,
                `Bridge dir: ${getBridgeDir()}`,
                `Pending commands: ${pending.length}`,
                pending.length > 0 ? `Files: ${pending.join(", ")}` : "",
                ``,
                `To execute pending commands:`,
                `Open WhyCavalry-Bridge.js in Cavalry's Script Editor and click Run.`,
              ]
                .filter(Boolean)
                .join("\n"),
            },
          ],
        };
      }

      case "cavalry_clear_queue": {
        const cleared = clearPendingCommands();
        return {
          content: [
            {
              type: "text",
              text: `Cleared ${cleared} pending command(s).`,
            },
          ],
        };
      }

      case "cavalry_open_in_cavalry": {
        const { file_path } = args as { file_path: string };
        execSync(`open -a Cavalry "${file_path}"`);
        return {
          content: [
            {
              type: "text",
              text: `Opened in Cavalry: ${file_path}`,
            },
          ],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      content: [{ type: "text", text: `Error: ${message}` }],
      isError: true,
    };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("WhyCavalry MCP server started");
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
