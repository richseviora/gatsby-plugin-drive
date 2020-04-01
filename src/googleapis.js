const { GoogleToken } = require("gtoken");
const request = require("request");

const delayInMs = 105 * 1000;

const getToken = ({ keyFile, key }) => {
  return new Promise((resolve, reject) => {
    const scope = ["https://www.googleapis.com/auth/drive"];
    const gtoken = keyFile
      ? new GoogleToken({
          keyFile,
          scope: scope
        })
      : new GoogleToken({
          email: key.client_email,
          scope: scope,
          key: key.private_key.replace(/(\\r)|(\\n)/g, "\n")
        });

    gtoken.getToken((err, token) => {
      if (err) {
        reject(err);
      } else {
        resolve(token);
      }
    });
  });
};

const getFolderInternal = (
  folderId,
  token,
  log,
  resolve,
  reject,
  nextPageToken = null,
  fileArray = []
) => {
  const options = {
    uri: `https://www.googleapis.com/drive/v3/files`,
    auth: {
      bearer: token
    },
    qs: {
      q: `'${folderId}' in parents`,
      pageSize: 1000,
      fields: "kind,nextPageToken,files(id,name,kind,mimeType,modifiedTime)"
    }
  };
  if (nextPageToken) {
    options.qs.pageToken = nextPageToken;
  }
  request(options, (err, res, body) => {
    if (err) {
      reject(err);
    } else {
      const parsedBody = JSON.parse(body);
      const newFileArray = fileArray.concat(parsedBody.files);
      if (parsedBody.nextPageToken) {
        log("Fetching additional page");
        getFolderInternal(
          folderId,
          token,
          log,
          resolve,
          reject,
          parsedBody.nextPageToken,
          newFileArray
        );
      } else {
        resolve(newFileArray);
      }
    }
  });
};

const getFolder = (
  folderId,
  token,
  log,
  nextPageToken = null,
  fileArray = []
) => {
  return new Promise((resolve, reject) => {
    getFolderInternal(folderId, token, log, resolve, reject);
  });
};

const getFile = (fileId, token, log) => {
  return new Promise((resolve, reject) => {
    requestFile(resolve, reject, fileId, token, delayInMs, log);
  });
};

/**
 *
 *
 * @returns [Promise<FileMetadata>]
 */

const getFileMetadata = (fileId, token, log) => {
  return new Promise((resolve, reject) => {
    requestFileMetadata(resolve, reject, fileId, token, delayInMs);
  });
};

const getGDoc = (fileId, token, mimeType, log) => {
  return new Promise((resolve, reject) => {
    request(
      {
        uri: `https://www.googleapis.com/drive/v3/files/${fileId}/export`,
        auth: {
          bearer: token
        },
        encoding: null,
        qs: {
          mimeType: mimeType
        }
      },
      (err, res, body) => {
        if (err) {
          reject(err);
        } else {
          resolve(body);
        }
      }
    );
  });
};

module.exports = {
  getToken,
  getFolder,
  getFile,
  getGDoc,
  getFileMetadata
};

function requestFileMetadata(resolve, reject, fileId, token, delay) {
  request(
    {
      uri: `https://www.googleapis.com/drive/v3/files/${fileId}?fields=webContentLink%2C%20createdTime%2C%20id%2C%20name`,
      auth: {
        bearer: token
      },
      contentType: "application/json"
    },
    (err, res, body) => {
      if (err) {
        reject(err);
      } else if (res.statusCode == 403) {
        setTimeout(() => {
          requestFileMetadata(resolve, reject, fileId, token, delay);
        }, delay);
      } else {
        resolve(JSON.parse(body));
      }
    }
  );
}

function requestFile(resolve, reject, fileId, token, delay, log) {
  request(
    {
      uri: `https://www.googleapis.com/drive/v3/files/${fileId}`,
      auth: {
        bearer: token
      },
      encoding: null,
      qs: {
        alt: "media"
      }
    },
    (err, res, body) => {
      if (err) {
        reject(err);
      } else if (res.statusCode == 403) {
        log("rate limited, waiting");
        setTimeout(() => {
          requestFile(resolve, reject, fileId, token, delay);
        }, delay);
      } else {
        resolve(body);
      }
    }
  );
}
