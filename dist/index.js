const core = require("@actions/core");
const exec = require("@actions/exec");

async function run() {
  try {
    const cwd = process.env["GITHUB_WORKSPACE"];
    if (!cwd) {
      throw new Error("No GITHUB_WORKSPACE");
    }
  } catch (error) {
    console.error(error.message);
    core.setFailed(error.message);
  }

  const testName = core.getInput("test-name");
  const setupCommand = core.getInput("setup-command");
  const runCommand = core.getInput("run-command");
  const inputValue = core.getInput("input-value");
  const expectedOutput = core.getInput("expected-output");
  const comparison = core.getInput("comparison");
  const pointsAvailable = core.getInput("points");
  const setupResult = await exec.exec(setupCommand);

  if (setupResult.code !== 0) {
    core.setFailed("Setup command failed");
    return;
  }

  let output;
  const testProcess = spawn(runCommand, {
    shell: true,
    env: {
      PATH: process.env["PATH"],
      FORCE_COLOR: "true",
    },
  });

  process.stdout.write(indent("\n"));

  testProcess.stdout.on("data", (data) => {
    process.stdout.write(indent(data.toString()));
    output += data.toString();
  });

  testProcess.stderr.on("data", (data) => {
    process.stderr.write(indent(data.toString()));
  });

  testProcess.stdin.write(inputValue);
  testProcess.stdin.end();

  const expected = normalizeLineEndings(expectedOutput);
  const actual = normalizeLineEndings(output)

  switch (comparison) {
    case 'exact':
      if (actual != expected) {
        const result = {testName, pointsAwarded: 0, pointsAvailable, expected, actual, passed: false};
        core.setOutput('test-result', JSON.stringify(result));
      } else {
        const result = {testName, pointsAwarded: pointsAvailable, pointsAvailable, expected, actual, passed: true};
        core.setOutput('test-result', JSON.stringify(result));
      }
      break
    case 'regex':
      if (!actual.match(new RegExp(expectedOutput))) {
        const result = {testName, pointsAwarded: 0, pointsAvailable, expected, actual, passed: false};
        core.setOutput('test-result', JSON.stringify(result));
      } else {
        const result = {testName, pointsAwarded: pointsAvailable, pointsAvailable, expected, actual, passed: true};
        core.setOutput('test-result', JSON.stringify(result));
      }
      break
    default:
      if (!actual.includes(expected)) {
        const result = {testName, pointsAwarded: 0, pointsAvailable, expected, actual, passed: false};
        core.setOutput('test-result', JSON.stringify(result));
      } else {
        const result = {testName, pointsAwarded: pointsAvailable, pointsAvailable, expected, actual, passed: true};
        core.setOutput('test-result', JSON.stringify(result));
      }
      break
  }
}

async function awaitCompletion(testProcess) {
  return new Promise((resolve, reject) => {
    testProcess.once("exit", (code, signal) => {
      if (code !== 0) {
        reject(
          new Error(`Error: Exit with code: ${code} and signal: ${signal}`)
        );
      } else {
        resolve();
      }
    });

    testProcess.once("error", (error) => {
      reject(error);
    }
  });
}

function indent(text) {
  let str = "" + new String(text);
  str = str.replace(/\r\n/gim, "\n").replace(/\n/gim, "\n  ");
  return str;
}

function normalizeLineEndings (text){
  return text.replace(/\r\n/gi, '\n').trim()
}

run();
