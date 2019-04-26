const fs = require('fs');
const path = require('path');
const childProcess = require('child_process');


/**
 * Returns the current package version from package.json
 * @return {string} current package version
 */
function getVersion() {
  const stdout = childProcess.execSync('node -p "require(\'./package.json\').version"');
  return stdout.toString('utf8').trim();
};


/**
 * Filters items that starts with '.'
 * @param {Array.<string>} arr Array of strings.
 * @return {Array.<string>} filtered array.
 */
function filter(arr) {
  return arr.filter(item => !item.startsWith('.'));
}


/**
 * Returns list of files recursively.
 * @return {Promise.<Array>} Promise that will be resolved to array of files.
 */
function filesList(dirPath, filePath = '') {
  return new Promise(resolve => {
    const absolutePath = path.resolve(dirPath, filePath);
    fs.stat(absolutePath, (_, stat) => {
      if (stat.isDirectory())
        dir(absolutePath).then(resolve);
      else
        resolve([absolutePath]);
    });
  })
}


/**
 * Read content of the directory.
 * @return {Promise.<Array>} Promise resolved to the array of files/dirs.
 */
function dir(dirPath) {
  return new Promise(resolve => {
    fs.readdir(dirPath, (err, files) => {
      files = filter(files);
      const promises = files.map(filePath => filesList(dirPath, filePath));
      Promise.all(promises).then(foldersContents => {
        resolve(foldersContents.reduce((filesArray, folderContent) => filesArray.concat(folderContent), []));
      });
    });
  });
}


module.exports = {
    getVersion,
    filesList
}

