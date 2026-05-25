const { createUploadthing, createRouteHandler } = require("uploadthing/express");

const f = createUploadthing();

const uploadRouter = {
  mediaUploader: f({
    image: { maxFileSize: "8MB" },
    video: { maxFileSize: "256MB" }
  }).onUploadComplete(async ({ file }) => {
    return {
      url: file.url
    };
  })
};

module.exports = {
  uploadRouter,
  createRouteHandler
};