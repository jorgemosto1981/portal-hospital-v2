"use strict";

const { getApps, initializeApp } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore, FieldValue, Timestamp } = require("firebase-admin/firestore");

function resolveProjectId() {
  if (process.env.GCLOUD_PROJECT) return process.env.GCLOUD_PROJECT;
  if (process.env.GCP_PROJECT) return process.env.GCP_PROJECT;
  try {
    if (process.env.FIREBASE_CONFIG) {
      const cfg = JSON.parse(process.env.FIREBASE_CONFIG);
      if (cfg && cfg.projectId) return cfg.projectId;
    }
  } catch (_) {
    /* ignore */
  }
  return undefined;
}

if (!getApps().length) {
  const projectId = resolveProjectId();
  initializeApp(projectId ? { projectId } : {});
}

const db = getFirestore();
const auth = getAuth();

module.exports = {
  db,
  auth,
  FieldValue,
  Timestamp,
};

