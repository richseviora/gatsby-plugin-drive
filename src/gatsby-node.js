const googleapi = require(`./googleapis`);
const path = require(`path`);
const mkdirp = require(`mkdirp`);
const fs = require(`fs`);

const log = str => console.log(`\n\n🚗 `, str);
const FOLDER = `application/vnd.google-apps.folder`;
const GOOGLE_DOC = "application/vnd.google-apps.document";

let shouldExportGDocs;
let exportMime;
let middleware;

exports.onPreBootstrap = (firstArg, optionsArg) => {
  const { graphql, actions, createNodeId, createContentDigest } = firstArg;
  const {
    folderId,
    keyFile,
    key,
    destination,
    exportGDocs,
    exportMimeType,
    exportMiddleware
  } = optionsArg;
  return new Promise(async resolve => {
    log(`Started downloading content`);

    // Get token and fetch root folder.
    const token = keyFile
      ? await googleapi.getToken({ keyFile })
      : await googleapi.getToken({ key });
    const cmsFiles = await googleapi.getFolder(folderId, token);
    shouldExportGDocs = exportGDocs;
    exportMime = exportMimeType;
    middleware = exportMiddleware === undefined ? x => x : exportMiddleware;

    // Create content directory if it doesn't exist.
    mkdirp(destination);

    // Start downloading recursively through all folders.
    console.time(`Downloading content`);
    recursiveFolders(cmsFiles, undefined, token, destination, firstArg).then(
      () => {
        console.timeEnd(`Downloading content`);
        resolve();
      }
    );
  });
};

function recursiveFolders(array, parent = "", token, destination, gatsbyApi) {
  return new Promise(async (resolve, reject) => {
    let promises = [];
    let filesToDownload = shouldExportGDocs
      ? array
      : array.filter(file => file.mimeType !== GOOGLE_DOC);

    for (let file of filesToDownload) {
      // Check if it`s a folder or a file
      if (file.mimeType === FOLDER) {
        // If it`s a folder, create it in filesystem
        log(`Creating folder ${parent}/${file.name}`);
        mkdirp(path.join(destination, parent, file.name));

        // Then, get the files inside and run the function again.
        const files = await googleapi.getFolder(file.id, token);
        promises.push(
          recursiveFolders(files, `${parent}/${file.name}`, token, destination)
        );
      } else {
        promises.push(
          new Promise(async (resolve, reject) => {
            // If it`s a file, download it and convert to buffer.
            const dest = path.join(
              destination,
              parent,
              getFilenameByMime(file)
            );
            const metaData = await googleapi.getFileMetadata(file.id, token);
            if (fs.existsSync(dest)) {
              createNode(gatsbyApi, dest, metaData);
              resolve(getFilenameByMime(file));
              return log(`Using cached ${getFilenameByMime(file)}`);
            }

            const buffer =
              file.mimeType === GOOGLE_DOC
                ? await middleware(
                    googleapi.getGDoc(file.id, token, exportMime)
                  )
                : await googleapi.getFile(file.id, token);

            // Finally, write buffer to file.
            fs.writeFile(dest, buffer, err => {
              if (err) return log(err);
              createNode(gatsbyApi, dest, metaData);
              log(`Saved file ${getFilenameByMime(file)}`);
              resolve(getFilenameByMime(file));
            });
          })
        );
      }
    }

    Promise.all(promises).then(() => resolve());
  });
}

const fileExtensionsByMime = new Map([
  ["text/html", ".html"],
  ["application/zip", ".zip"],
  ["text/plain", ".txt"],
  ["application/rtf", ".rtf"],
  ["application/vnd.oasis.opendocument.text", ".odt"],
  ["application/pdf", ".pdf"],
  [
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".docx"
  ],
  ["application/epub+zip", ".epub"]
]);

const getFilenameByMime = file => {
  if (file.mimeType === GOOGLE_DOC) {
    return `${file.name}${fileExtensionsByMime.get(exportMime)}`;
  } else {
    return file.name;
  }
};

function createNode(gatsbyApi, dest, metaData) {
  const node = {
    localPath: dest,
    name: metaData.name,
    googleId: metaData.id,
    createdTime: metaData.createdTime,
    webContentLink: metaData.webContentLink,
    id: gatsbyApi.createNodeId(`DriveDownload-${metaData.id}`),
    internal: {
      type: "DriveDownload",
      contentDigest: gatsbyApi.createContentDigest(metaData)
    }
  }
  gatsbyApi.actions.createNode(node);
}
