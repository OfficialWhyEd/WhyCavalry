// WhyCavalry Bridge v1.0
// Run this in Cavalry's Script Editor to execute commands from the MCP server.
//
// Setup: Scripting > New Script > paste this > Run
// The bridge reads commands from ~/.whycavalry/cmd/ and writes results to ~/.whycavalry/res/

var homeDir = api.getHomeFolder();
var cmdDir = homeDir + "/.whycavalry/cmd";
var resDir = homeDir + "/.whycavalry/res";

// Ensure directories exist
api.makeFolder(homeDir + "/.whycavalry");
api.makeFolder(cmdDir);
api.makeFolder(resDir);

// Find all pending command files
var cmdFiles = api.listDirectory(cmdDir);
var executed = 0;
var errors = 0;

cmdFiles.forEach(function(filePath) {
  if (!filePath.endsWith(".json")) return;

  var raw = api.readFromFile(filePath);
  if (!raw) return;

  var cmd;
  try {
    cmd = JSON.parse(raw);
  } catch(e) {
    api.log("WhyCavalry: failed to parse command file: " + filePath);
    errors++;
    return;
  }

  var result = { id: cmd.id, success: false };

  try {
    // eval executes the script in Cavalry's JS context with full api access
    var returnVal = eval(cmd.script);
    result.success = true;
    // If script returned a JSON string, parse it; otherwise wrap it
    if (typeof returnVal === "string") {
      try {
        result.value = JSON.parse(returnVal);
      } catch(e) {
        result.value = returnVal;
      }
    } else if (returnVal !== undefined) {
      result.value = returnVal;
    } else {
      result.value = null;
    }
    executed++;
  } catch(e) {
    result.error = e.toString();
    errors++;
  }

  // Write result file
  var resultPath = resDir + "/" + cmd.id + ".json";
  api.writeToFile(resultPath, JSON.stringify(result), true);

  // Remove processed command
  api.deleteFilePath(filePath);
});

api.log("WhyCavalry Bridge: executed " + executed + " command(s), " + errors + " error(s).");

if (executed === 0 && errors === 0) {
  api.log("WhyCavalry Bridge: no pending commands found in " + cmdDir);
}
