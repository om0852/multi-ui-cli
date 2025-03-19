#!/usr/bin/env node

const fs = require("fs-extra");
const { exec } = require("child_process");
const path = require("path");
const inquirer = require("inquirer").default;
const axios = require("axios");
const babel = require("@babel/core");

// Configuration
const CONFIG_FILE = path.join(process.cwd(), "multi-ui.config.json");
const DEFAULT_COMPONENT_PATH = "src/app/"; // Default folder structure
const GITHUB_REPO = "om0852/multi-ui";
const COMPONENTS_PATH = "src/app"; // Path in the GitHub repo

// Utility function for installing Babel presets
const installBabelPresets = () => {
  return new Promise((resolve, reject) => {
    exec(
      "npm install --save-dev @babel/preset-react @babel/preset-typescript",
      (error, stdout, stderr) => {
        if (error) {
          return reject(`Error installing Babel presets: ${stderr}`);
        }
        resolve();
      }
    );
  });
};

// Setup: Ask user for project language preference and save it
const setupProject = async () => {
  try {
    const { language, directory } = await inquirer.prompt([
      {
        type: "list",
        name: "language",
        message: "Choose your project language:",
        choices: ["JavaScript", "TypeScript"],
      },
      {
        type: "input",
        name: "directory",
        message: "Enter the directory for components (default: src/app/):",
        default: `${DEFAULT_COMPONENT_PATH}`,
      },
    ]);

    // Append `multi-ui/components` to the user-provided directory
    const resolvedPath = path.join(directory, "multi-ui", "components");

    const config = {
      language: language.toLowerCase(),
      componentPath: resolvedPath,
    };

    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
    console.log(`Setup complete! Language: ${language}, Components Path: ${resolvedPath}`);
  } catch (error) {
    console.error("Setup failed:", error.message);
  }
};

// Fetch language preference and component path from config file
const getPreference = () => {
  if (fs.existsSync(CONFIG_FILE)) {
    const config = JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8"));
    return config;
  }
  console.warn("No preference found. Defaulting to TypeScript and default folder structure.");
  return { language: "typescript", componentPath: `${DEFAULT_COMPONENT_PATH}multi-ui/components` };
};

// Fetch component code from GitHub
const fetchComponentFromGitHub = async (componentName) => {
  const componentBaseName = componentName.toLowerCase().split("_")[0];
  const url = `https://raw.githubusercontent.com/${GITHUB_REPO}/main/app/${componentBaseName}/_components/${componentName}.tsx`;

  try {
    const response = await axios.get(url);
    if (response.status === 200) {
      return response.data;
    }
    throw new Error(`Failed to fetch component: ${response.statusText}`);
  } catch (error) {
    if (error.response?.status === 404) {
      throw new Error(`Component '${componentName}' not found at path: ${url}\nPlease check the component name and path.`);
    }
    throw new Error(`Error fetching component: ${error.message}`);
  }
};

// Convert TypeScript (.tsx) code to JavaScript (.jsx)
const convertTsxToJsx = (tsxCode, fileName) => {
  const transformed = babel.transformSync(tsxCode, {
    presets: ["@babel/preset-react", "@babel/preset-typescript"],
    filename: fileName,
  });
  return transformed.code;
};

// Create a new component
const createComponent = async (componentName) => {
  const { language, componentPath } = getPreference();
  const extension = language === "javascript" ? "jsx" : "tsx";
  const componentDir = path.join(process.cwd(), componentPath);

  try {
    // Ensure the directory exists
    fs.ensureDirSync(componentDir);

    // Define the component file path
    const componentFile = path.join(componentDir, `${componentName}.${extension}`);

    // Fetch the component code from GitHub
    console.log(`Fetching ${componentName} from GitHub...`);
    const componentCode = await fetchComponentFromGitHub(componentName);

    if (language === "javascript") {
      const jsxCode = convertTsxToJsx(componentCode, `${componentName}.tsx`);
      fs.writeFileSync(componentFile, jsxCode);
    } else {
      fs.writeFileSync(componentFile, componentCode);
    }

    console.log(`Component created at: ${componentFile}`);
  } catch (error) {
    console.error("Error creating component:", error.message);
  }
};

// Main CLI handler
const main = async () => {
  const [action, componentName] = process.argv.slice(2);

  switch (action) {
    case "setup":
      await installBabelPresets();
      await setupProject();
      break;
    case "add":
      if (!componentName) {
        console.error("Please provide a component name. Usage: npx multi-ui add <ComponentName>");
        break;
      }
      await createComponent(componentName);
      break;
    default:
      console.log(`
Usage:
  npx multi-ui setup          - Set up the project (choose language and path)
  npx multi-ui add <ComponentName> - Create a new component
      `);
  }
};

main().catch((error) => {
  console.error("Unexpected error:", error.message);
});
