const { GoogleToken } = require("gtoken");
const request = require("request");

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

const getFolder = (folderId, token) => {
  return new Promise((resolve, reject) => {
    request(
      {
        uri: `https://www.googleapis.com/drive/v3/files`,
        auth: {
          bearer: token
        },
        qs: {
          q: `'${folderId}' in parents`,
          pageSize: 1000
        }
      },
      (err, res, body) => {
        if (err) {
          reject(err);
        } else {
          resolve(JSON.parse(body).files);
        }
      }
    );
  });
};

const getFile = (fileId, token) => {
  return new Promise((resolve, reject) => {
    requestFile(resolve, reject, fileId, token, 1100);
  });
};

/**
 * 
 * 
 * @returns [Promise<FileMetadata>] 
 */ 
const getFileMetadata = (fileId, token) => {
  return new Promise((resolve, reject) => {
    requestFileMetadata(resolve, reject, fileId, token, 1100);
  })
}

const getGDoc = (fileId, token, mimeType) => {
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
  getFileMetadata,
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
          requestFileMetadata(resolve, reject, fileId, token, delay * 2);
        }, delay * 2);
      } else {
        resolve(JSON.parse(body));
      }
    }
  );
}

function requestFile(resolve, reject, fileId, token, delay) {
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
        setTimeout(() => {
          requestFile(resolve, reject, fileId, token, delay * 2);
        }, delay * 2);
      } else {
        resolve(body);
      }
    }
  );
}
