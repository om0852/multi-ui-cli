#!/usr/bin/env node

const fs = require("fs-extra");
const { exec } = require("child_process");
const path = require("path");
const inquirer = require("inquirer").default;
const axios = require("axios");
const babel = require("@babel/core");

// Configuration
const preferenceFile = path.join(process.cwd(), "multi-ui.config.json");

// GitHub Repository Config
const GITHUB_REPO = "om0852/multi-ui";
const COMPONENTS_PATH = "src/app"; // Path to components in the GitHub repo

// Function to ask for language preference
const setupProject = async () => {
  try {
    const { language } = await inquirer.prompt([
      {
        type: "list",
        name: "language",
        message: "Choose your project language:",
        choices: ["JavaScript", "TypeScript"],
      },
    ]);

    const preference = { language: language.toLowerCase() };

    // Save preference to a config file
    fs.writeFileSync(preferenceFile, JSON.stringify(preference, null, 2));
    console.log(`Project setup complete! Language preference saved: ${language}`);
  } catch (error) {
    console.error("Error during setup:", error);
  }
};

// Function to fetch stored language preference
const getPreference = () => {
  if (fs.existsSync(preferenceFile)) {
    const preference = JSON.parse(fs.readFileSync(preferenceFile, "utf8"));
    return preference.language;
  }
  console.warn("No preference found. Defaulting to TypeScript.");
  return "typescript";
};

// Function to fetch component code from GitHub
const fetchComponentFromGitHub = async (componentName) => {
  try {
    const url = `https://raw.githubusercontent.com/${GITHUB_REPO}/main/${COMPONENTS_PATH}/${componentName.toLowerCase().split("_")[0]}/_components/${componentName}.tsx`;
    const response = await axios.get(url);

    if (response.status === 200) {
      return response.data;
    } else {
      throw new Error(`Failed to fetch component from GitHub: ${response.status}`);
    }
  } catch (error) {
    console.error("Error fetching component from GitHub:", error.message);
    throw error;
  }
};

// Function to convert .tsx files to .jsx
const convertTsxToJsx = async (inputDir, outputDir) => {
  const files = fs.readdirSync(inputDir);

  files.forEach((file) => {
    const ext = path.extname(file);
    if (ext === ".tsx") {
      const filePath = path.join(inputDir, file);
      const outputFilePath = path.join(outputDir, file.replace(".tsx", ".jsx"));

      const code = fs.readFileSync(filePath, "utf-8");

      const transformed = babel.transformSync(code, {
        presets: ["@babel/preset-react", "@babel/preset-typescript"],
        filename: file,
      });

      fs.outputFileSync(outputFilePath, transformed.code);
      console.log(`Converted: ${file} -> ${outputFilePath}`);
    }
  });
};

// Function to create a component
const createComponent = async (componentName) => {
  try {
    const language = getPreference();
    const extension = language === "javascript" ? "jsx" : "tsx";

    // Define the directory to store components
    const componentPath = path.join(process.cwd(), "multi-ui", "components");
    const componentFile = `${componentPath}/${componentName}.${extension}`;

    // Ensure the directory exists
    if (!fs.existsSync(componentPath)) {
      fs.mkdirSync(componentPath, { recursive: true });
    }

    // Fetch the component code
    console.log(`Fetching ${componentName} from GitHub...`);
    let componentCode = await fetchComponentFromGitHub(componentName);

    // Convert TypeScript to JavaScript if the preference is JavaScript
    if (language === "javascript") {
      console.log(`Converting ${componentName} to JavaScript...`);

      // Convert the fetched TSX to JSX using Babel
      const inputDir = path.join(process.cwd(), "multi-ui", "components", componentName);
      const outputDir = path.join(process.cwd(), "multi-ui", "components", "converted");
      await convertTsxToJsx(inputDir, outputDir);

      // Optionally, you can save the JSX file directly here after conversion.
    } else {
      // Save the component as it is for TypeScript
      fs.writeFileSync(componentFile, componentCode);
      console.log(`${componentName} created at ${componentFile}`);
    }
  } catch (error) {
    console.error("Error creating component:", error);
  }
};

// Main function to handle CLI actions
const main = async () => {
  const [action, componentName] = process.argv.slice(2);

  if (action === "setup") {
    await setupProject();
  } else if (action === "add" && componentName) {
    await createComponent(componentName);
  } else {
    console.log(
      "Usage:\n  npx multi-ui setup         - Set up the project\n  npx multi-ui add <ComponentName> - Create a new component"
    );
  }
};

main();
