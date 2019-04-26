const fs = require('fs');
const path = require('path');

const SRC_PATH = path.resolve(__dirname, '..', 'src');
const SAMPLES_PATH = path.resolve(__dirname, '..', 'samples');


/**
 * Create a directory for every group of maps.
 * @param {string} group which group the map belongs to
 */
function createMapDir(group) {
  const groupDir = path.join(SAMPLES_PATH, group);
  if (!fs.existsSync(groupDir))
    fs.mkdirSync(groupDir);
}


/**
 * Generates dummy dataset for a choropleth series of the map.
 * @param {Array<string>} idArr array of all region's IDs of the map
 * @return {Array} dummy data
 */
function generateDataSet(idArr) {
  return idArr.map((id, value) => ({id, value}));
}


/**
 * Generate map sample.
 * @param {string} group which group the map belongs to
 * @param {string} mapName name of the map
 */
function createMapDemo(group, mapName) {
  const srcPath = path.join(SRC_PATH, group, mapName);
  const distPath = path.join(SAMPLES_PATH, group);
  // read map JSON file
  fs.readFile(path.join(srcPath, `${mapName}.json`), 'utf8', (err, data) => {
    if (err) {
      console.log(err);
      return;
    }

    const jsonMap = JSON.parse(data);
    // array of all region IDs
    const idArr = jsonMap.features.map(feature => (feature.properties.id));
    const mapData = generateDataSet(idArr);
    let mapSampleTemplate = fs.readFileSync(path.resolve(__dirname, 'mapsample.tmpl.html'), 'utf8');
    mapSampleTemplate = mapSampleTemplate
      .replace(/{{map_name}}/g, mapName)
      .replace(/{{directory}}/g, group)
      .replace(/{{map_js}}/g, `${mapName}.js`)
      .replace("'{{map_data}}'", JSON.stringify(mapData))
      .replace(/},/g, '},\n\t\t\t');

    createMapDir(group);

    fs.writeFile(path.join(distPath, `${mapName}.html`), mapSampleTemplate, err => {
      if (err)
        console.log(err);
    });
  });
}


/**
 * Start building map samples collection.
 */
function buildSamples() {
  // read src directory
  fs.readdir(SRC_PATH, (err, groups) => {
    // create '/demos' folder
    if (!fs.existsSync(SAMPLES_PATH))
      fs.mkdirSync(SAMPLES_PATH);

    for (let i = 0; i < groups.length; i++) {
      const group = groups[i];
      let maps = fs.readdirSync(path.join(SRC_PATH, group));
      for (let j = 0; j < maps.length; j++) {
        const mapName = String(maps[j]).replace('.json', '');
        createMapDemo(group, mapName);
      }
    }
  });
}

buildSamples();
