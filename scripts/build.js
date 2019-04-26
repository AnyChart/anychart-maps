const mapshaper = require('mapshaper');
const fs = require('fs');
const xml2js = require('xml2js');
const admZip = require('adm-zip');
const path = require('path');
const {getVersion} = require('./utils');

const SRC_PATH = path.resolve(__dirname, '..', 'src');
const DIST_PATH = path.resolve(__dirname, '..', 'dist');
const CJS_PATH = path.resolve(__dirname, '..', 'cjs');


/**
 * Start building maps packages to dist folder.
 */
function buildMaps() {
  const groups = fs.readdirSync(path.resolve(__dirname, '..', 'src'));
  // create '/dist' folder
  if (!fs.existsSync(DIST_PATH))
    fs.mkdirSync(DIST_PATH);
  // create '/cjs' folder
  if (!fs.existsSync(CJS_PATH))
    fs.mkdirSync(CJS_PATH);

  const version = getVersion();
  const now = new Date();
  const fullYear = now.getUTCFullYear();
  const fullMonth = String(now.getUTCMonth() + 1).padStart(2, '0');
  const fullDate = String(now.getUTCDate()).padStart(2, '0');

  for (let i = 0; i < groups.length; i++) {
    const group = groups[i];
    const maps = fs.readdirSync(path.join(SRC_PATH, group));
    for (let j = 0; j < maps.length; j++) {
      let mapName = String(maps[j]).replace('.json', '');
      generateMapPackage(group, mapName, version, fullYear, fullMonth, fullDate);
    }
  }
}


/**
 * Generate a map package from source geojson map.
 * @param {string} group which group the map belongs to
 * @param {string} mapName name of the map
 * @param {string} version current collection version
 * @param {number} fullYear creation year
 * @param {string} fullMonth creation month
 * @param {string} fullDate creation date
 */
function generateMapPackage(group, mapName, version, fullYear, fullMonth, fullDate) {
  const srcPath = path.join(SRC_PATH, group, mapName);
  const distPath = path.join(DIST_PATH, group, mapName);
  const distCjsPath = path.join(CJS_PATH, group, mapName);
  const srcJsonPath = path.join(srcPath, `${mapName}.json`);
  const banner = getBanner(mapName, version, fullYear, fullMonth, fullDate);

  // create a package directory for the map
  fs.mkdirSync(distPath, {recursive: true});
  fs.mkdirSync(distCjsPath, {recursive: true});
  generateJsonJs(srcJsonPath, distPath, distCjsPath, mapName, banner);
  generateTopoJsonJs(srcJsonPath, distPath, distCjsPath, mapName, banner);
  generateShp(srcJsonPath, distPath, mapName);
  generateSvg(srcJsonPath, distPath, mapName);
}


/**
 * Generates cjs map module content.
 * @param {string} banner License banner for the file.
 * @param {string} mapName Name of the map
 * @param {string} jsonMap Map content in json (topo json)
 */
function makeMapModuleContent(banner, mapName, jsonMap) {
  return `${banner}
const ${mapName} = ${jsonMap};

window['anychart'] = window['anychart'] || {};
window['anychart']['maps'] = window['anychart']['maps'] || {};
window['anychart']['maps']['${mapName}'] = ${mapName};

module.exports = ${mapName};
`;
}


/**
 * Generates json and js map.
 * @param {string} srcJsonPath absolute path to source geojson map
 * @param {string} distPath absolute path to the map folder in dist collection
 * @param {string} distCjsPath absolute path to the map folder in cjs collection
 * @param {string} mapName name of the map
 * @param {string} banner the js file header
 */
function generateJsonJs(srcJsonPath, distPath, distCjsPath, mapName, banner) {
  // copy json from src to dist
  fs.copyFileSync(srcJsonPath, path.join(distPath, `${mapName}.json`));
  const jsonMap = fs.readFileSync(srcJsonPath, 'utf8');
  // prepare JS template
  let jsMap = `${banner}\n`;
  jsMap += `(function() {\nwindow['anychart']=window['anychart']||{};window['anychart']['maps']=window['anychart']['maps']||{};window['anychart']['maps']['${mapName}']=`;
  jsMap += jsonMap + '\n})();';
  fs.writeFileSync(path.join(distPath, `${mapName}.js`), jsMap);
  // prepare module template
  const mapModule = makeMapModuleContent(banner, mapName, jsonMap);
  fs.writeFileSync(path.join(distCjsPath, 'index.js'), mapModule);
}


/**
 * Generates topo.json and topo.js map
 * @param {string} srcJsonPath absolute path to source geojson map
 * @param {string} distPath absolute path to the map folder in dist collection
 * @param {string} distCjsPath absolute path to the map folder in cjs collection
 * @param {string} mapName name of the map
 * @param {string} banner the js file header
 */
function generateTopoJsonJs(srcJsonPath, distPath, distCjsPath, mapName, banner) {
  const topoJsonName = `${mapName}.topo.json`;
  // generate TopoJson and save in variable
  mapshaper.applyCommands(`-i ${srcJsonPath} -o ${topoJsonName} format=topojson`, null, (err, output) => {
    if (err) {
      console.log(err);
      return;
    }
    let topoJsonMap = output[topoJsonName];
    // get projection type and offsets from JSON map
    const jsonMap = JSON.parse(fs.readFileSync(srcJsonPath));
    topoJsonMap = JSON.parse(topoJsonMap);
    // if projection exists add it
    if (jsonMap.crs)
      topoJsonMap.crs = jsonMap.crs;
    // if offsets exist add them
    if (jsonMap['ac-tx'])
      topoJsonMap['ac-tx'] = jsonMap['ac-tx'];
    // save TopoJson file
    topoJsonMap = JSON.stringify(topoJsonMap);
    fs.writeFileSync(path.join(distPath, `${topoJsonName}`), topoJsonMap);
    // prepare TopoJs template
    let topoJsMap = `${banner}\n`;
    topoJsMap += `(function() {\nwindow['anychart']=window['anychart']||{};window['anychart']['maps']=window['anychart']['maps']||{};window['anychart']['maps']['${mapName}']=`;
    // add TopoJson to the template
    topoJsMap += topoJsonMap + '\n})();';
    // save TopoJs file
    fs.writeFileSync(path.join(distPath, `${mapName}.topo.js`), topoJsMap);
    // prepare module template
    const mapModule = makeMapModuleContent(banner, mapName, topoJsonMap);
    fs.writeFileSync(path.join(distCjsPath, 'topo.js'), mapModule);
  });
}


/**
 * Generates SHP map project archived into zip
 * @param {string} srcJsonPath absolute path to source geojson map
 * @param {string} distPath absolute path to the map folder in dist collection
 * @param {string} mapName name of the map
 */
function generateShp(srcJsonPath, distPath, mapName) {
  mapshaper.runCommands(`-i ${srcJsonPath} -o ${distPath} format=shapefile`, () => {
    zipShpFiles(distPath, mapName);
  });
}


/**
 * Generates svg map
 * @param {string} srcJsonPath absolute path to source geojson map
 * @param {string} distPath absolute path to the map folder in dist collection
 * @param {string} mapName name of the map
 */
function generateSvg(srcJsonPath, distPath, mapName) {
  // the JSON map should have id field which is equal to code_hasc
  mapshaper.runCommands(`-i ${srcJsonPath} -o ${distPath} format=svg id-field=id width=700 height=700`, () => {
    addSvgMeta(srcJsonPath, distPath, mapName);
  });
}


/**
 * Adds geo meta information for every SVG path related to map region
 * and drops unnecessary SVG tags and attributes.
 * @param {string} srcJsonPath absolute path to source geojson map
 * @param {string} distPath absolute path to the map folder in dist collection
 * @param {string} mapName name of the map
 */
function addSvgMeta(srcJsonPath, distPath, mapName) {
  //get all meta info from JSON source and store in a JSON object
  const meta = {};
  const jsonMap = JSON.parse(fs.readFileSync(srcJsonPath, 'utf8'));
  for (let i = 0; i < jsonMap.features.length; i++) {
    let prop = jsonMap.features[i].properties;
    meta[prop.id] = prop;
  }
  //read the SVG map generated by mapshaper
  const outputSvg = fs.readFileSync(path.join(distPath, `${mapName}.svg`), 'utf8');
  // parse SVG to JSON for easier manipulation
  xml2js.parseString(outputSvg, function(err, svgMap) {
    if (err) {
      console.log(err);
      return;
    }
    // remove unnecessary SVG tags and attributes
    delete svgMap.svg.$.version;
    delete svgMap.svg.$.baseProfile;
    delete svgMap.svg.$.viewBox;
    delete svgMap.svg.$['stroke-linecap'];
    delete svgMap.svg.$['stroke-linejoin'];
    // get an array of region paths
    let regionPaths = svgMap.svg.g[0].path;
    // add styles and meta to every region path
    for (let i = 0; i < regionPaths.length; i++) {
      // add default AnyChart svg styles
      regionPaths[i].$.fill = "#cee3f5";
      regionPaths[i].$.stroke = "#6e6e6e";
      regionPaths[i].$['stroke-width'] = "0.4";
      //add meta
      let regionMeta = meta[regionPaths[i].$.id];
      regionPaths[i].desc = {};
      for (let key in regionMeta) {
        regionPaths[i].desc[key] = regionMeta[key];
      }
    }
    // convert our json back to svg
    const builder = new xml2js.Builder();
    svgMap = builder.buildObject(svgMap);
    // remove unnecessary XML attribute
    svgMap = svgMap.replace(' standalone="yes"', '');
    // save the final svg map
    fs.writeFileSync(path.join(distPath, `${mapName}.svg`), svgMap);
  });
}


/**
 * Archives all SHP project files into zip
 * @param {string} distPath absolute path to the map folder in dist collection
 * @param {string} mapName name of the map
 */
function zipShpFiles(distPath, mapName) {
  // main shp files
  const files = [`${mapName}.shp`, `${mapName}.dbf`, `${mapName}.shx`];
  // read files in folder
  const distFiles = fs.readdirSync(distPath);
  // custom projection file
  const prj = `${mapName}.prj`;
  // if it exists add it for zipping
  if (distFiles.includes(prj))
    files.push(prj);
  // resolve absolute paths
  const paths = files.map(filePath => path.resolve(distPath, filePath));
  // create zip for shp files
  const zip = new admZip();
  // zip main shp files
  paths.forEach(path => zip.addLocalFile(path));
  //remove main shp files from dist directory
  paths.forEach(fs.unlinkSync);
  // write zip
  zip.writeZip(path.join(distPath, `${mapName}.zip`));
}


/**
 * Returns banner for the files that are built.
 * @param {string} mapName Name of the map.
 * @param {string} version Version of the package/collection.
 * @param {number} fullYear Build year.
 * @param {string} fullMonth Build month.
 * @param {string} fullDate Build date.
 * @return {string} Banner.
 */
function getBanner(mapName, version, fullYear, fullMonth, fullDate) {
  const buildDate = `${fullYear}-${fullMonth}-${fullDate}`;
  return `/**
 * AnyChart is lightweight robust charting library with great API and Docs, that works with your stack and has tons of chart types and features.
 *
 * Map: ${mapName}
 * Version: ${version} (${buildDate})
 * License: https://www.anychart.com/buy/
 * Contact: sales@anychart.com
 * Copyright: AnyChart.com ${fullYear}. All rights reserved.
 */`;
}

buildMaps();
